import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

// 仅回环合成HTTP/TLS，不加载模型、不读生产配置、不安装证书、不装配移动SDK。
const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'tmp/app-connector-validation');
await mkdir(output, { recursive: true });
const work = await mkdtemp(path.join(output, 'run-'));
const javaHome = process.env.WENLI_TEST_JAVA_HOME || '/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home';
const env = { PATH: process.env.PATH, TMPDIR: work };
const token = randomBytes(32).toString('hex');
const fixedOrigin = 'https://wenli-app.invalid';
const checks = [],
  children = [],
  servers = [],
  timers = new Set(),
  received = [];
let sinkRequests = 0,
  tlsRequests = 0;
const command = (exe, args) => {
  const result = spawnSync(exe, args, { cwd: root, env, encoding: 'utf8', timeout: 60000 });
  if (result.error || result.status !== 0)
    throw new Error(
      `编译或工具未通过: ${path.basename(exe)} ${result.status ?? 'unavailable'} ${result.stderr?.slice(0, 3000) || ''}`
    );
  return result.stdout.trim();
};
const listening = async (server) => {
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
};
const delayed = (fn, ms) => {
  const timer = setTimeout(() => {
    timers.delete(timer);
    fn();
  }, ms);
  timers.add(timer);
};
const waitFor = async (predicate) => {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('原生请求未到达合成回环服务器');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};
function client(exe, args) {
  const child = spawn(exe, args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  children.push(child);
  const pending = new Map(),
    counts = new Map();
  let logs = '';
  child.stderr.on('data', (b) => {
    logs = (logs + b.toString()).slice(-4000);
  });
  const failPending = () => {
    for (const queue of pending.values())
      for (const q of queue) {
        clearTimeout(q.timer);
        q.reject(new Error('原生校验进程异常退出'));
      }
    pending.clear();
  };
  child.on('error', failPending);
  child.on('exit', failPending);
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    const p = line.split('\t');
    if (p[0] !== 'result') return;
    const id = Buffer.from(p[1], 'base64').toString();
    counts.set(id, (counts.get(id) || 0) + 1);
    const queue = pending.get(id);
    if (!queue?.length) return;
    const q = queue.splice(p[2] === 'REQUEST_CONFLICT' ? queue.length - 1 : 0, 1)[0];
    if (!queue.length) pending.delete(id);
    clearTimeout(q.timer);
    q.resolve({
      id,
      ...(p[2] !== '-' ? { code: p[2] } : {}),
      status: Number(p[3]),
      receivedBytes: Number(p[4]),
      body: Buffer.from(p[5] || '', 'base64').toString()
    });
  });
  const b64 = (v) => Buffer.from(String(v)).toString('base64');
  return {
    counts,
    request(o) {
      return new Promise((resolve, reject) => {
        const queue = pending.get(o.id) || [];
        const entry = { resolve, reject, timer: null };
        entry.timer = setTimeout(() => {
          queue.splice(queue.indexOf(entry), 1);
          if (!queue.length) pending.delete(o.id);
          reject(new Error(`原生回调未在预算内返回: ${o.id}`));
        }, 8000);
        queue.push(entry);
        pending.set(o.id, queue);
        child.stdin.write(
          [
            'request',
            ...[o.id, o.url, o.method, o.token, o.allowedOrigins.join('\n')].map(b64),
            o.body === undefined ? '-' : b64(o.body),
            o.timeout,
            o.limit,
            o.consent
          ].join('\t') + '\n'
        );
      });
    },
    cancel(id) {
      child.stdin.write(`cancel\t${b64(id)}\n`);
    },
    close() {
      child.stdin.write('close\n');
    },
    async stop() {
      if (child.exitCode !== null) {
        lines.close();
        return;
      }
      const done = once(child, 'exit');
      child.stdin.end();
      const timer = setTimeout(() => child.kill('SIGKILL'), 2000);
      await done;
      clearTimeout(timer);
      lines.close();
      assert.equal(child.exitCode, 0, logs);
    }
  };
}
let fatal;
try {
  const sink = http.createServer((_req, res) => {
    sinkRequests++;
    res.end('{}');
  });
  const sinkPort = await listening(sink);
  const fixture = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const part of req) chunks.push(part);
    let input;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    } catch {
      res.writeHead(400);
      res.end('{}');
      return;
    }
    received.push({
      path: req.url,
      method: req.method,
      origin: req.headers.origin,
      authorized: req.headers.authorization === `Bearer ${token}`,
      input
    });
    if (req.headers.authorization !== `Bearer ${token}` || req.headers.origin !== fixedOrigin) {
      res.writeHead(403);
      res.end('{}');
      return;
    }
    const value = input.fixtureCase || 'normal';
    if (value === 'redirect' || value === 'location') {
      res.writeHead(value === 'redirect' ? 307 : 200, { Location: `http://127.0.0.1:${sinkPort}/sink` });
      res.end('{}');
      return;
    }
    if (value === 'declared-size') {
      res.writeHead(200, { 'Content-Length': '10001' });
      res.end('x'.repeat(10001));
      return;
    }
    if (value === 'chunk-size') {
      res.writeHead(200);
      res.write('x'.repeat(64));
      res.end('x'.repeat(64));
      return;
    }
    if (value === 'invalid-utf8') {
      res.end(Buffer.from([0xc3, 0x28]));
      return;
    }
    if (value === 'error-status') {
      res.writeHead(403);
      res.end(JSON.stringify({ success: false, code: 'FORBIDDEN' }));
      return;
    }
    const finish = () => {
      if (!res.destroyed)
        res.end(
          JSON.stringify({
            success: true,
            data: { message: '合成中文🙂', operation: req.url.slice(1), requestId: input.requestId || null }
          })
        );
    };
    if (value === 'slow') delayed(finish, 1200);
    else finish();
  });
  const fixturePort = await listening(fixture),
    origin = `http://127.0.0.1:${fixturePort}`;
  command('openssl', [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    path.join(work, 'fixture.key'),
    '-out',
    path.join(work, 'fixture.crt'),
    '-subj',
    '/CN=localhost',
    '-days',
    '1',
    '-addext',
    'subjectAltName=IP:127.0.0.1'
  ]);
  // HTTPS使用系统信任；合成自签证书从不加入钥匙串。
  const secure = https.createServer(
    { key: await readFile(path.join(work, 'fixture.key')), cert: await readFile(path.join(work, 'fixture.crt')) },
    (_req, res) => {
      tlsRequests++;
      res.end('{}');
    }
  );
  const securePort = await listening(secure),
    secureOrigin = `https://127.0.0.1:${securePort}`;
  const classes = path.join(work, 'classes');
  await mkdir(classes);
  command(path.join(javaHome, 'bin/javac'), [
    '--release',
    '8',
    '-d',
    classes,
    'nativeplugins/Wenli-Connector/android/src/cn/wenli/connector/ConnectorTransport.java',
    'tests/native/app-connector/ConnectorHarness.java'
  ]);
  if (process.platform !== 'darwin') throw new Error('此双内核验收需要macOS Foundation，当前平台未通过该项');
  command('xcrun', [
    'clang',
    '-fobjc-arc',
    '-fmodules',
    '-Wall',
    '-Werror',
    '-framework',
    'Foundation',
    '-I',
    'nativeplugins/Wenli-Connector/ios/src',
    'nativeplugins/Wenli-Connector/ios/src/WenliConnectorTransport.m',
    'tests/native/app-connector/connector-harness.m',
    '-o',
    path.join(work, 'foundation-harness')
  ]);
  for (const [name, exe, args] of [
    // OpenJDK过滤Origin，独立测试JVM允许内核的固定Origin；不改变App或主进程配置。
    [
      'Java',
      path.join(javaHome, 'bin/java'),
      ['-Dsun.net.http.allowRestrictedHeaders=true', '-cp', classes, 'ConnectorHarness']
    ],
    ['Foundation', path.join(work, 'foundation-harness'), []]
  ]) {
    const native = client(exe, args);
    let serial = 0;
    const options = (patch = {}) => {
      const o = {
        id: `${name}_${++serial}`,
        url: origin + '/chat',
        method: 'POST',
        token,
        allowedOrigins: [origin],
        body: JSON.stringify({ fixtureCase: 'normal', requestId: 'synthetic-business-id' }),
        timeout: 3000,
        limit: 10000,
        consent: true,
        ...patch
      };
      if (o.body && JSON.parse(o.body).fixtureCase === 'slow')
        o.body = JSON.stringify({ ...JSON.parse(o.body), requestId: o.id });
      return o;
    };
    const check = async (label, fn) => {
      await fn();
      checks.push({ kernel: name, name: label, passed: true });
    };
    try {
      await check('鉴权健康/文本/资料续解析/删除及严格UTF8字节', async () => {
        for (const route of ['/health', '/chat', '/parse', '/delete']) {
          const o = options({
              url: origin + route,
              ...(route === '/health' ? { method: 'GET', body: undefined } : {})
            }),
            r = await native.request(o);
          assert.equal(r.status, 200);
          assert.equal(r.code, undefined);
          assert.equal(r.receivedBytes, Buffer.byteLength(r.body));
          assert.equal(JSON.parse(r.body).data.message, '合成中文🙂');
          assert.equal(received.at(-1).authorized, true);
          assert.equal(received.at(-1).origin, fixedOrigin);
          assert.equal(received.at(-1).path, route);
        }
      });
      for (const [value, code, patch] of [
        ['redirect', 'REDIRECT_FORBIDDEN', {}],
        ['location', 'REDIRECT_FORBIDDEN', {}],
        ['declared-size', 'RESPONSE_LIMIT', {}],
        ['chunk-size', 'RESPONSE_LIMIT', { limit: 100 }],
        ['invalid-utf8', 'INVALID_ENCODING', {}]
      ])
        await check(value, async () => {
          const r = await native.request(options({ body: JSON.stringify({ fixtureCase: value }), ...patch }));
          assert.equal(r.code, code);
        });
      await check('非成功HTTP保留状态供业务拒绝', async () => {
        const r = await native.request(options({ body: JSON.stringify({ fixtureCase: 'error-status' }) }));
        assert.equal(r.status, 403);
        assert.equal(JSON.parse(r.body).success, false);
      });
      await check('非法授权/目标/方法/容量/时限在发送前拒绝', async () => {
        const before = received.length;
        for (const patch of [
          { consent: false },
          { token: 'short' },
          { allowedOrigins: [] },
          { url: origin + '/arbitrary' },
          { url: origin + '/chat?secret=none' },
          { url: origin + '/chat#fragment' },
          { url: origin.replace('http://', 'http://user@') + '/chat' },
          { method: 'PUT' },
          { timeout: 0 },
          { timeout: 35001 },
          { timeout: 1.5 },
          { limit: 2000001 },
          { limit: 1.5 },
          { method: 'GET', body: '{}' }
        ])
          assert.equal((await native.request(options(patch))).code, 'INVALID_REQUEST');
        assert.equal(received.length, before);
      });
      await check('超时只回调一次且迟到正文不采纳', async () => {
        const o = options({ body: JSON.stringify({ fixtureCase: 'slow' }), timeout: 250 });
        assert.equal((await native.request(o)).code, 'TIMEOUT');
        await new Promise((resolve) => delayed(resolve, 1400));
        assert.equal(native.counts.get(o.id), 1);
      });
      await check('在途取消仅中止对应请求', async () => {
        const o = options({ body: JSON.stringify({ fixtureCase: 'slow' }) }),
          p = native.request(o);
        await waitFor(() => received.some((r) => r.input.fixtureCase === 'slow' && r.input.requestId === o.id));
        native.cancel(o.id);
        assert.equal((await p).code, 'CANCELLED');
      });
      await check('重复ID拒绝且原任务仍可取消', async () => {
        const o = options({ body: JSON.stringify({ fixtureCase: 'slow' }) }),
          p = native.request(o);
        await waitFor(() => received.some((r) => r.input.requestId === o.id));
        const before = received.length;
        assert.equal((await native.request(o)).code, 'REQUEST_CONFLICT');
        assert.equal(received.length, before);
        native.cancel(o.id);
        assert.equal((await p).code, 'CANCELLED');
        assert.equal(native.counts.get(o.id), 2);
      });
      await check('四请求上限不新增发送', async () => {
        const requests = Array.from({ length: 4 }, () => options({ body: JSON.stringify({ fixtureCase: 'slow' }) }));
        const first = requests.map((o) => native.request(o));
        await waitFor(() => received.filter((r) => requests.some((o) => r.input.requestId === o.id)).length === 4);
        assert.equal((await native.request(options())).code, 'RATE_LIMIT');
        for (const o of requests) native.cancel(o.id);
        assert.deepEqual(
          (await Promise.all(first)).map((r) => r.code),
          Array(4).fill('CANCELLED')
        );
      });
      await check('系统TLS拒绝自签证书，零HTTP到达', async () => {
        assert.equal(
          (await native.request(options({ url: secureOrigin + '/chat', allowedOrigins: [secureOrigin] }))).code,
          'CONNECTION_FAILED'
        );
        assert.equal(tlsRequests, 0);
      });
      await check('关闭释放任务且后续请求拒绝', async () => {
        const o = options({ body: JSON.stringify({ fixtureCase: 'slow' }) }),
          p = native.request(o);
        await waitFor(() => received.some((r) => r.input.requestId === o.id));
        native.close();
        assert.equal((await p).code, 'CANCELLED');
        assert.equal((await native.request(options())).code, 'CANCELLED');
      });
    } finally {
      await native.stop();
    }
  }
  assert.equal(sinkRequests, 0);
  checks.push({ kernel: 'both', name: '重定向目标零请求与零令牌', passed: true });
} catch (error) {
  fatal = error.message;
  process.exitCode = 1;
} finally {
  for (const timer of timers) clearTimeout(timer);
  for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
  await Promise.all(
    servers.map(
      (server) =>
        new Promise((resolve) => {
          server.close(resolve);
          server.closeAllConnections();
        })
    )
  );
  await rm(work, { recursive: true, force: true });
  const hashes = {};
  for (const file of [
    'nativeplugins/Wenli-Connector/android/src/cn/wenli/connector/ConnectorTransport.java',
    'nativeplugins/Wenli-Connector/ios/src/WenliConnectorTransport.m',
    'tests/native/app-connector/ConnectorHarness.java',
    'tests/native/app-connector/connector-harness.m'
  ])
    hashes[file] = createHash('sha256')
      .update(await readFile(path.join(root, file)))
      .digest('hex');
  const report = {
    passed: !fatal,
    checks,
    ...(fatal ? { error: fatal } : {}),
    sinkRequests,
    tlsRequests,
    requestCount: received.length,
    sourceHashes: hashes,
    scope: 'macOS上的真实JDK/Foundation回环HTTP与TLS内核；不代表DCloud移动SDK装配、Android/iOS设备或真实供应商',
    cleanup: { serversClosed: servers.every((s) => !s.listening), syntheticKeysRemoved: true }
  };
  await writeFile(path.join(output, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
