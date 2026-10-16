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
const javaHome =
  process.env.YOZI_TEST_JAVA_HOME ||
  process.env.WENLI_TEST_JAVA_HOME ||
  '/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home';
const env = { PATH: process.env.PATH, TMPDIR: work };
const token = randomBytes(32).toString('hex');
const fixedOrigin = 'https://wenli-app.invalid';
const checks = [],
  children = [],
  servers = [],
  timers = new Set(),
  received = [],
  loopbackPorts = [];
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
  const port = server.address().port;
  loopbackPorts.push(port);
  return port;
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
  child.yoziStartedAt = new Date().toISOString();
  children.push(child);
  const pending = new Map(),
    counts = new Map(),
    events = new Map();
  let markReady, rejectReady;
  const ready = new Promise((resolve, reject) => {
    markReady = resolve;
    rejectReady = reject;
  });
  const readyTimer = setTimeout(() => rejectReady(new Error('原生夹具未在60秒内就绪')), 60000);
  let logs = '';
  child.stderr.on('data', (b) => {
    logs = (logs + b.toString()).slice(-4000);
  });
  const failPending = () => {
    clearTimeout(readyTimer);
    rejectReady(new Error('原生夹具在就绪前退出'));
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
    if (line === 'ready') {
      clearTimeout(readyTimer);
      markReady();
      return;
    }
    const p = line.split('\t');
    if (p[0] !== 'result') return;
    const id = Buffer.from(p[1], 'base64').toString();
    const value = {
      id,
      ...(p[2] !== '-' ? { code: p[2] } : {}),
      status: Number(p[3]),
      receivedBytes: Number(p[4]),
      body: Buffer.from(p[5] || '', 'base64').toString(),
      kind: p[6] === '-' ? undefined : p[6],
      sequence: Number(p[7]),
      contentType: Buffer.from(p[8] || '', 'base64').toString(),
      bytes: Buffer.from(p[9] || '', 'base64')
    };
    const history = events.get(id) || [];
    history.push(value);
    events.set(id, history);
    if (!['headers', 'chunk'].includes(value.kind)) counts.set(id, (counts.get(id) || 0) + 1);
    const queue = pending.get(id);
    if (!queue?.length) return;
    if (['headers', 'chunk'].includes(value.kind)) {
      queue[0].onEvent?.(value);
      return;
    }
    const q = queue.splice(p[2] === 'REQUEST_CONFLICT' ? queue.length - 1 : 0, 1)[0];
    if (!queue.length) pending.delete(id);
    clearTimeout(q.timer);
    q.resolve({ ...value, events: history });
  });
  const b64 = (v) => Buffer.from(String(v)).toString('base64');
  return {
    counts,
    ready,
    events,
    request(o, streaming = false, onEvent) {
      return new Promise((resolve, reject) => {
        const queue = pending.get(o.id) || [];
        const entry = { resolve, reject, onEvent, timer: null };
        entry.timer = setTimeout(
          () => {
            queue.splice(queue.indexOf(entry), 1);
            if (!queue.length) pending.delete(o.id);
            reject(new Error(`原生回调未在预算内返回: ${o.id}`));
          },
          Math.max(8000, Number.isFinite(o.timeout) ? Math.min(o.timeout, 100000) + 5000 : 0)
        );
        queue.push(entry);
        pending.set(o.id, queue);
        child.stdin.write(
          [
            streaming ? 'stream' : 'request',
            ...[o.id, o.url, o.method, o.token, o.allowedOrigins.join('\n')].map(b64),
            o.body === undefined ? '-' : b64(o.body),
            JSON.stringify(o.timeout),
            JSON.stringify(o.limit),
            JSON.stringify(o.consent)
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
      clearTimeout(readyTimer);
      if (child.exitCode !== null || child.signalCode !== null) {
        lines.close();
        return;
      }
      const done = once(child, 'exit');
      child.stdin.end();
      const timer = setTimeout(() => child.kill('SIGTERM'), 2000);
      const force = setTimeout(() => child.kill('SIGKILL'), 4000);
      await done;
      clearTimeout(timer);
      clearTimeout(force);
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
      accept: req.headers.accept,
      input
    });
    if (req.headers.authorization !== `Bearer ${token}` || req.headers.origin !== fixedOrigin) {
      res.writeHead(403);
      res.end('{}');
      return;
    }
    const value = input.fixtureCase || 'normal';
    if (value === 'material-long') {
      delayed(() => res.end(JSON.stringify({ success: true, data: { retained: true } })), 36000);
      return;
    }
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
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, code: 'FORBIDDEN' }));
      return;
    }
    // 并发/取消夹具保持未完成，避免宿主负载使固定延迟抢先完成。
    if (value === 'hold') return;
    if (value.startsWith('stream-')) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
      res.flushHeaders();
      if (value === 'stream-invalid-utf8') {
        res.end(Buffer.from([0xe4, 0xb8]));
        return;
      }
      const bytes = Buffer.from('event: preview\nid: 1\ndata: {"text":"合成中文🙂"}\n\n');
      const split = bytes.indexOf(Buffer.from('中')) + 1;
      res.write(bytes.subarray(0, split));
      delayed(() => {
        if (!res.destroyed) res.write(bytes.subarray(split, split + 3));
      }, 30);
      if (value !== 'stream-hold-open')
        delayed(
          () => {
            if (!res.destroyed) res.end(bytes.subarray(split + 3));
          },
          value === 'stream-hold' ? 1200 : 60
        );
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
    '-J-Xms16m',
    '-J-Xmx256m',
    '--release',
    '8',
    '-d',
    classes,
    'nativeplugins/Yozi-Connector/android/src/cn/yozi/connector/ConnectorTransport.java',
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
    'nativeplugins/Yozi-Connector/ios/src',
    'nativeplugins/Yozi-Connector/ios/src/YoziConnectorTransport.m',
    'tests/native/app-connector/connector-harness.m',
    '-o',
    path.join(work, 'foundation-harness')
  ]);
  for (const [name, exe, args] of [
    // OpenJDK过滤Origin，独立测试JVM允许内核的固定Origin；不改变App或主进程配置。
    [
      'Java',
      path.join(javaHome, 'bin/java'),
      ['-Xms16m', '-Xmx128m', '-Dsun.net.http.allowRestrictedHeaders=true', '-cp', classes, 'ConnectorHarness']
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
        timeout: 15000,
        limit: 10000,
        consent: true,
        ...patch
      };
      if (o.body && ['slow', 'hold'].includes(JSON.parse(o.body).fixtureCase))
        o.body = JSON.stringify({ ...JSON.parse(o.body), requestId: o.id });
      return o;
    };
    const check = async (label, fn) => {
      await fn();
      checks.push({ kernel: name, name: label, passed: true });
    };
    try {
      await native.ready;
      await check('逐页解析可超过35秒并保持100秒总预算；其他路由不扩权', async () => {
        const before = received.length;
        for (const patch of [
          { url: origin + '/parse', timeout: 100001 },
          { url: origin + '/parse', timeout: 100000, method: 'GET', body: undefined },
          { url: origin + '/health', timeout: 100000 },
          { url: origin + '/chat', timeout: 100000 },
          { url: origin + '/delete', timeout: 100000 }
        ])
          assert.equal((await native.request(options(patch))).code, 'INVALID_REQUEST');
        assert.equal(received.length, before);
        const started = Date.now();
        const result = await native.request(
          options({ url: origin + '/parse', timeout: 100000, body: JSON.stringify({ fixtureCase: 'material-long' }) })
        );
        assert.equal(result.code, undefined);
        assert.equal(JSON.parse(result.body).data.retained, true);
        assert.ok(Date.now() - started >= 35000);
        const held = options({
          url: origin + '/parse',
          timeout: 100000,
          body: JSON.stringify({ fixtureCase: 'hold' })
        });
        const pending = native.request(held);
        await waitFor(() => received.some((r) => r.input.requestId === held.id));
        native.cancel(held.id);
        assert.equal((await pending).code, 'CANCELLED');
      });
      await check('鉴权健康/文本/资料续解析/删除及严格UTF8字节', async () => {
        for (const route of ['/health', '/chat', '/parse', '/delete']) {
          const o = options({
              url: origin + route,
              ...(route === '/health' ? { method: 'GET', body: undefined } : {})
            }),
            r = await native.request(o);
          assert.equal(r.code, undefined);
          assert.equal(r.status, 200);
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
          { consent: 1 },
          { consent: 'true' },
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
          { timeout: true },
          { limit: 2000001 },
          { limit: 1.5 },
          { limit: true },
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
        const o = options({ body: JSON.stringify({ fixtureCase: 'hold' }) }),
          p = native.request(o);
        await waitFor(() => received.some((r) => r.input.fixtureCase === 'hold' && r.input.requestId === o.id));
        native.cancel(o.id);
        assert.equal((await p).code, 'CANCELLED');
      });
      await check('重复ID拒绝且原任务仍可取消', async () => {
        const o = options({ body: JSON.stringify({ fixtureCase: 'hold' }) }),
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
        const requests = Array.from({ length: 4 }, () => options({ body: JSON.stringify({ fixtureCase: 'hold' }) }));
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
      const streamOptions = (patch = {}) =>
        options({ url: origin + '/proxy-ai-stream', body: JSON.stringify({ fixtureCase: 'stream-normal' }), ...patch });
      await check('原生流响应头、跨UTF8分块与唯一完成回执按序', async () => {
        const o = streamOptions({ timeout: 45000, limit: 2097152 }),
          r = await native.request(o, true);
        assert.equal(r.code, undefined);
        assert.equal(r.kind, 'complete');
        assert.equal(r.events[0].kind, 'headers');
        assert.equal(r.events[0].status, 200);
        assert.equal(r.events[0].contentType, 'text/event-stream; charset=utf-8');
        assert.equal(r.events[0].receivedBytes, 0);
        const parts = r.events.filter((v) => v.kind === 'chunk');
        assert.ok(parts.length >= 2 && parts.length <= 256);
        const bytes = Buffer.concat(parts.map((v) => v.bytes));
        assert.equal(bytes.toString(), 'event: preview\nid: 1\ndata: {"text":"合成中文🙂"}\n\n');
        let total = 0;
        r.events.forEach((v, i) => {
          assert.equal(v.sequence, i + 1);
          if (v.kind === 'chunk') {
            total += v.bytes.length;
            assert.ok(v.bytes.length > 0 && v.bytes.length <= 8192);
          }
          assert.equal(v.receivedBytes, total);
        });
        assert.equal(r.receivedBytes, bytes.length);
        assert.equal(native.counts.get(o.id), 1);
        assert.equal(received.at(-1).path, '/proxy-ai-stream');
        assert.equal(received.at(-1).accept, 'text/event-stream');
      });
      await check('流入口隔离与严格许可/时限/容量在发送前拒绝', async () => {
        const before = received.length;
        for (const patch of [
          { url: origin + '/chat' },
          { method: 'GET' },
          { consent: false },
          { consent: 1 },
          { consent: 'true' },
          { allowedOrigins: [] },
          { token: 'short' },
          { url: origin + '/proxy-ai-stream?x=1' },
          { url: origin + '/proxy-ai-stream#x' },
          { body: undefined },
          { timeout: true },
          { timeout: 45001 },
          { timeout: 1.5 },
          { limit: true },
          { limit: 2097153 },
          { limit: 1.5 }
        ])
          assert.equal((await native.request(streamOptions(patch), true)).code, 'INVALID_REQUEST');
        assert.equal((await native.request(options({ url: origin + '/proxy-ai-stream' }))).code, 'INVALID_REQUEST');
        assert.equal(received.length, before);
      });
      for (const [value, code, patch] of [
        ['redirect', 'REDIRECT_FORBIDDEN', {}],
        ['location', 'REDIRECT_FORBIDDEN', {}],
        ['declared-size', 'RESPONSE_LIMIT', {}],
        ['chunk-size', 'RESPONSE_LIMIT', { limit: 100 }],
        ['invalid-utf8', 'INVALID_ENCODING', {}],
        ['stream-invalid-utf8', 'INVALID_ENCODING', {}]
      ])
        await check(`流式${value}`, async () => {
          const o = streamOptions({ body: JSON.stringify({ fixtureCase: value }), ...patch });
          const r = await native.request(o, true);
          assert.equal(r.code, code);
          assert.ok(!r.events.some((e) => e.kind === 'complete'));
          assert.equal(native.counts.get(o.id), 1);
        });
      await check('流式非成功JSON保留403及完整字节，不能伪造成功', async () => {
        const r = await native.request(streamOptions({ body: JSON.stringify({ fixtureCase: 'error-status' }) }), true);
        assert.equal(r.events[0].status, 403);
        assert.equal(r.events[0].contentType, 'application/json');
        assert.equal(
          JSON.parse(Buffer.concat(r.events.filter((e) => e.kind === 'chunk').map((e) => e.bytes)).toString()).success,
          false
        );
      });
      for (const cancel of [false, true])
        await check(`流式预览后${cancel ? '取消' : '超时'}无迟到回执`, async () => {
          const o = streamOptions({
            body: JSON.stringify({ fixtureCase: 'stream-hold' }),
            timeout: cancel ? 3000 : 250
          });
          const p = native.request(o, true, (e) => {
            if (cancel && e.kind === 'chunk') native.cancel(o.id);
          });
          const r = await p;
          assert.equal(r.code, cancel ? 'CANCELLED' : 'TIMEOUT');
          assert.ok(r.events.some((e) => e.kind === 'headers'));
          assert.ok(r.events.some((e) => e.kind === 'chunk'));
          const eventCount = native.events.get(o.id).length;
          await new Promise((resolve) => delayed(resolve, 1400));
          assert.equal(native.events.get(o.id).length, eventCount);
          assert.equal(native.counts.get(o.id), 1);
        });
      await check('流式与普通请求共享四任务上限且逐项取消', async () => {
        const list = Array.from({ length: 4 }, (_, i) =>
          i % 2
            ? streamOptions({
                body: JSON.stringify({ fixtureCase: 'stream-hold-open' })
              })
            : options({ body: JSON.stringify({ fixtureCase: 'hold' }) })
        );
        const jobs = list.map((o, i) => native.request(o, i % 2 === 1));
        await waitFor(() =>
          list.every(
            (o) =>
              native.events.get(o.id)?.some((e) => e.kind === 'headers') ||
              received.some((r) => r.input.requestId === o.id)
          )
        );
        const before = received.length;
        assert.equal((await native.request(streamOptions(), true)).code, 'RATE_LIMIT');
        assert.equal(received.length, before);
        list.forEach((o) => native.cancel(o.id));
        assert.deepEqual(
          (await Promise.all(jobs)).map((r) => r.code),
          Array(4).fill('CANCELLED')
        );
      });
      await check('流式系统TLS拒绝自签证书，零HTTP到达', async () => {
        assert.equal(
          (
            await native.request(
              streamOptions({ url: secureOrigin + '/proxy-ai-stream', allowedOrigins: [secureOrigin] }),
              true
            )
          ).code,
          'CONNECTION_FAILED'
        );
        assert.equal(tlsRequests, 0);
      });
      await check('关闭释放任务且后续请求拒绝', async () => {
        const o = options({ body: JSON.stringify({ fixtureCase: 'hold' }) }),
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
  for (const child of children)
    if (child.exitCode === null && child.signalCode === null) {
      const done = once(child, 'exit');
      child.stdin.end();
      const graceful = setTimeout(() => child.kill('SIGTERM'), 2000);
      const force = setTimeout(() => child.kill('SIGKILL'), 4000);
      await done;
      clearTimeout(graceful);
      clearTimeout(force);
    }
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
    'nativeplugins/Yozi-Connector/android/src/cn/yozi/connector/ConnectorTransport.java',
    'nativeplugins/Yozi-Connector/ios/src/YoziConnectorTransport.m',
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
    resources: {
      loopbackPorts,
      children: children.map((c) => ({
        pid: c.pid,
        startedAt: c.yoziStartedAt,
        consumer: 'private native connector fixture CLI',
        exitCode: c.exitCode,
        signal: c.signalCode
      }))
    },
    scope: 'macOS上的真实JDK/Foundation回环HTTP与TLS内核；不代表DCloud移动SDK装配、Android/iOS设备或真实供应商',
    cleanup: {
      serversClosed: servers.every((s) => !s.listening),
      syntheticKeysRemoved: true,
      childrenReaped: children.every((c) => c.exitCode !== null || c.signalCode !== null)
    }
  };
  await writeFile(path.join(output, 'latest.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
