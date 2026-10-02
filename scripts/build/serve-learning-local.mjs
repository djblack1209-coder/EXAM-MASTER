import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { parseArgs } from 'node:util';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { readFreeApiCredential } from './free-api-catalog.mjs';

// 仅用于本机隔离验收。复用真实前端构建、JWT鉴权和后端，绝不部署或创建登录绕过。
const { values } = parseArgs({ options: { catalog: { type: 'string' }, port: { type: 'string', default: '4212' } } });
const frontendPort = Number(values.port);
assert.ok(
  Number.isInteger(frontendPort) && frontendPort >= 4212 && frontendPort <= 4219,
  'Isolated H5 port must be 4212–4219'
);
assert.ok(
  values.catalog && process.env.LEARNING_TEST_MONGO_URI === 'mongodb://127.0.0.1:27189/exam_learning_isolated',
  'Explicit catalog and fixed isolated Mongo required'
);
const output = 'tmp/free-api-closure';
const state = JSON.parse(readFileSync(`${output}/learning-state.json`, 'utf8'));
assert.match(state.owner, /^free_closure_[a-f0-9-]+$/);
assert.equal(
  JSON.parse(readFileSync(`${output}/live-report.json`, 'utf8')).error,
  null,
  'Successful real validation required before interactive verification'
);
const apiKey = readFreeApiCredential(
  values.catalog,
  'gemini',
  'https://generativelanguage.googleapis.com/v1beta/openai'
);
const secret = crypto.randomBytes(32).toString('hex');
const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
const payload = Buffer.from(
  JSON.stringify({ userId: state.owner, exp: Math.floor(Date.now() / 1000) + 1800 })
).toString('base64url');
const token = `${header}.${payload}.${crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')}`;
const backend = spawn(process.execPath, ['laf-backend/standalone/dist/standalone/server.js'], {
  env: {
    PATH: process.env.PATH,
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: '4383',
    MONGODB_URI: process.env.LEARNING_TEST_MONGO_URI,
    DB_NAME: 'exam_learning_isolated',
    STORAGE_DIR: `${output}/http-storage`,
    JWT_SECRET: secret,
    LEARNING_VAULT_KEY: crypto.randomBytes(32).toString('hex'),
    ALLOWED_ORIGINS: `http://127.0.0.1:${frontendPort}`,
    LEARNING_ALLOWED_ORIGINS: 'https://generativelanguage.googleapis.com',
    LEARNING_BYOK_CALL_LIMIT: '5',
    LEARNING_PLATFORM_CALLS_ENABLED: 'false',
    LEARNING_PAYMENT_SANDBOX_ENABLED: 'false'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
// 启动失败或静态端口占用时也清理本脚本启动的子进程。
process.once('exit', () => backend.kill('SIGTERM'));
backend.stdout.on('data', (b) => (logs += b));
backend.stderr.on('data', (b) => (logs += b));
const deadline = Date.now() + 10000;
while (!logs.includes('[server] Listening')) {
  assert.ok(Date.now() < deadline && backend.exitCode === null, 'Backend startup failed');
  await new Promise((r) => setTimeout(r, 100));
}
const saved = await (
  await fetch('http://127.0.0.1:4383/learning-models', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      action: 'save',
      shareConsent: true,
      profile: {
        id: 'gemini-glm-flash',
        provider: 'Google Gemini',
        model: 'gemini-2.5-flash-lite',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
        structured: true,
        apiKey
      }
    }),
    signal: AbortSignal.timeout(5000)
  })
).json();
assert.equal(saved.success, true);
const root = realpathSync('dist/build/h5');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};
const frontend = createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.url === '/__isolated-session') {
    // TEST_ONLY账号仅访问本轮固定隔离库；API密钥与服务端签名材料不写入此页面。
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(
      `<!doctype html><meta charset="utf-8"><title>EXAM-MASTER 本机隔离验收</title><h1>本机隔离验收</h1><p>进入原项目候选界面。只使用合成学习记录和本轮隔离账号，模型密钥留在服务端。最多5次自带API请求（含已有2次）；不收费、不部署。</p><button id="enter">进入候选界面</button><script>document.getElementById('enter').onclick=()=>{localStorage.setItem('EXAM_USER_ID',${JSON.stringify(state.owner)});localStorage.setItem('EXAM_TOKEN',${JSON.stringify(token)});location.href='/#/pages/learning/index';};</script>`
    );
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url || '/', `http://127.0.0.1:${frontendPort}`).pathname);
    let file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep)) throw new Error('Forbidden');
    if (!existsSync(file) && !extname(file)) file = resolve(root, 'index.html');
    if (!realpathSync(file).startsWith(root + sep)) throw new Error('Forbidden');
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(readFileSync(file));
  } catch {
    res.statusCode = 404;
    res.end('Not found');
  }
});
frontend.listen(frontendPort, '127.0.0.1');
console.log(
  `Isolated existing H5: http://127.0.0.1:${frontendPort}/__isolated-session ; model request cap=5 ; no production access`
);
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  frontend.close();
  if (backend.exitCode === null && backend.signalCode === null) {
    const exited = once(backend, 'exit');
    backend.kill('SIGTERM');
    await exited;
  }
  writeFileSync(`${output}/interactive-server.log`, logs.split(apiKey).join('[REDACTED]'), { mode: 0o600 });
  process.exit(0);
};
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
setTimeout(stop, 30 * 60 * 1000).unref();
