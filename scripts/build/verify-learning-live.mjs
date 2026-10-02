import { spawn } from 'node:child_process';
import { once } from 'node:events';
import crypto from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { readFreeApiCredential } from './free-api-catalog.mjs';
import { createArithmeticQuestion, executeLearningTool } from '../../src/services/learning/learning-tools.js';
import {
  emptyLearningState,
  applyLearningOperation,
  summarizeLearning
} from '../../src/services/learning/learning-domain.js';

const { values } = parseArgs({
  options: {
    catalog: { type: 'string' },
    provider: { type: 'string', default: 'zai' },
    output: { type: 'string', default: 'tmp/free-api-closure' }
  }
});
if (!values.catalog || process.env.LEARNING_TEST_MONGO_URI !== 'mongodb://127.0.0.1:27189/exam_learning_isolated')
  throw new Error('Explicit private catalog and fixed local isolated Mongo URI required');
const output = values.output;
assert.ok(/^tmp\/[a-zA-Z0-9_/-]+$/.test(output) && !output.split('/').includes('..'), 'Use a local tmp output');
mkdirSync(output, { recursive: true, mode: 0o700 });
assert.ok(['zai', 'zhipu', 'gemini', 'groq'].includes(values.provider), 'Only reviewed catalog providers are allowed');
const approvedBase =
  values.provider === 'groq'
    ? 'https://api.groq.com/openai/v1'
    : values.provider === 'zhipu'
      ? 'https://open.bigmodel.cn/api/paas/v4'
      : values.provider === 'gemini'
        ? 'https://generativelanguage.googleapis.com/v1beta/openai'
        : 'https://api.z.ai/api/paas/v4';
const apiKey = readFreeApiCredential(values.catalog, values.provider, approvedBase);
const port = 4383;
const base = `http://127.0.0.1:${port}`;
const owner = `free_closure_${crypto.randomUUID()}`;
const secret = crypto.randomBytes(32).toString('hex');
const tokenFor = (userId) => {
  const h = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
  const p = Buffer.from(JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
  return `${h}.${p}.${crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url')}`;
};
const server = spawn(process.execPath, ['laf-backend/standalone/dist/standalone/server.js'], {
  env: {
    PATH: process.env.PATH,
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: String(port),
    MONGODB_URI: process.env.LEARNING_TEST_MONGO_URI,
    DB_NAME: 'exam_learning_isolated',
    STORAGE_DIR: `${output}/http-storage`,
    JWT_SECRET: secret,
    LEARNING_VAULT_KEY: crypto.randomBytes(32).toString('hex'),
    ALLOWED_ORIGINS: 'http://127.0.0.1:4212',
    LEARNING_ALLOWED_ORIGINS: new URL(approvedBase).origin,
    LEARNING_PLATFORM_CALLS_ENABLED: 'false',
    LEARNING_PAYMENT_SANDBOX_ENABLED: 'false'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
const interruptController = new AbortController();
const interrupt = () => {
  interruptController.abort();
  if (server.exitCode === null && server.signalCode === null) server.kill('SIGTERM');
};
process.once('SIGTERM', interrupt);
process.once('SIGINT', interrupt);
server.stdout.on('data', (b) => (logs += b));
server.stderr.on('data', (b) => (logs += b));
const post = async (route, body, userId = owner) => {
  const response = await fetch(base + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${tokenFor(userId)}` },
    body: JSON.stringify(body),
    signal: AbortSignal.any([AbortSignal.timeout(35000), interruptController.signal])
  });
  return response.json();
};
let state = emptyLearningState(owner, 'America/Los_Angeles');
const persist = () => writeFileSync(`${output}/learning-state.json`, JSON.stringify(state, null, 2), { mode: 0o600 });
const repository = {
  read: () => structuredClone(state),
  commit: (operation) => {
    const out = applyLearningOperation(state, { ...operation, at: Date.now() });
    state = out.state;
    persist();
    return out;
  }
};
let serial = 0;
const apply = (type, data, id = `live_${++serial}`) => repository.commit({ id, type, data }).result;
const profile = {
  id: `${values.provider}-glm-flash`,
  provider:
    values.provider === 'groq'
      ? 'Groq'
      : values.provider === 'zhipu'
        ? '智谱'
        : values.provider === 'gemini'
          ? 'Google Gemini'
          : 'Z.ai',
  model:
    values.provider === 'groq'
      ? 'openai/gpt-oss-20b'
      : values.provider === 'gemini'
        ? 'gemini-2.5-flash-lite'
        : 'glm-4.7-flash',
  endpoint: `${approvedBase}/chat/completions`,
  apiKey,
  structured: true
};
const report = {
  provider: profile.provider,
  model: profile.model,
  realCallsMaximum: 3,
  data: '仅合成学习任务，不上传用户资料',
  actualPayments: 0,
  results: [],
  calls: [],
  error: null
};
let calls = 0;
async function realCall(route, body) {
  assert.ok(++calls <= 3, 'Hard real-call budget exceeded');
  const r = await post(route, body);
  report.calls.push({
    requestId: body.requestId,
    success: r.success,
    code: r.code,
    error: r.error || null,
    data: r.success
      ? {
          model: r.data.model,
          structured: r.data.structured,
          usageStatus: r.data.usageStatus,
          message: r.data.message,
          tools: r.data.tools
        }
      : null
  });
  assert.equal(r.success, true, `Real provider call failed: ${r.error || r.code}`);
  return r;
}
async function check(name, action) {
  await action();
  report.results.push({ name, passed: true });
}
try {
  const deadline = Date.now() + 10000;
  while (!logs.includes('[server] Listening')) {
    assert.ok(Date.now() < deadline && server.exitCode === null, 'Isolated backend startup failed');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await check('服务端加密保存指定免费型号，前端列表不含密钥', async () => {
    assert.equal((await post('/learning-models', { action: 'save', profile, shareConsent: true })).success, true);
    const list = await post('/learning-models', { action: 'list' });
    assert.equal(list.data.platformEnabled, false);
    assert.equal(list.data.models[0].connectionStatus, 'untested');
    assert.ok(!JSON.stringify(list).includes(apiKey));
  });
  await check('真实连接测试计入用量而不计入学习作答', async () => {
    await realCall('/learning-models', {
      action: 'test',
      modelId: profile.id,
      requestId: 'free_connection_1',
      shareConsent: true
    });
    assert.equal((await post('/learning-models', { action: 'list' })).data.models[0].connectionStatus, 'connected');
    assert.equal(state.attempts.length, 0);
  });
  const conversationId = apply('conversation.start', { goal: '理解12+8，做完后根据错因复习' }, 'live_conversation').id;
  const q = createArithmeticQuestion('live_arithmetic', '12 + 8');
  apply('question.add', { question: q });
  apply('question.focus', { conversationId, questionKey: 'live_arithmetic@1' });
  apply('plan.set', {
    tasks: [{ id: 'live_task', title: '独立作答12+8', questionKey: 'live_arithmetic@1', condition: 'submitted' }],
    reason: '固定可核验任务'
  });
  await check('聊天首答错误自动形成可靠错题与计划进度', async () => {
    apply('attempt.submit', { conversationId, answer: '19', explicit: true }, 'live_answer_first');
    const s = summarizeLearning(state);
    assert.equal(s.first.numerator, 1);
    assert.equal(s.first.denominator, 1);
    assert.equal(s.mistakes.length, 1);
    assert.equal(s.tasks.rate, 1);
  });
  const body = {
    requestId: 'free_teaching_1',
    modelId: profile.id,
    shareConsent: true,
    messages: [
      {
        role: 'user',
        content:
          '12+8我答成19。请直接讲解凑整方法，用hint工具记录这次一级提示，用plan工具设置原题复习任务。不要出新题，也不要声称已完成工具操作。'
      }
    ],
    learningContext: {
      owner,
      goal: '理解加法凑整',
      question: { prompt: q.prompt, questionKey: 'live_arithmetic@1' },
      attempt: { id: 'live_answer_first', answer: '19', grade: { status: 'reliable', outcome: 'wrong' } },
      strategy: { method: 'explain' }
    }
  };
  await check('真实模型按用户意愿讲解并经权限校验执行提示和计划', async () => {
    const r = await realCall('/proxy-ai', body);
    assert.equal(r.data.structured, true);
    assert.equal(r.data.question, null);
    assert.ok(r.data.tools.some((t) => t.name === 'hint'));
    assert.ok(r.data.tools.some((t) => t.name === 'plan'));
    const context = {
      conversationId,
      permissions: ['read', 'learn'],
      calls: 0,
      maxCalls: 3,
      deadline: Date.now() + 5000,
      origin: 'model',
      model: profile.id,
      lockedMethod: 'explain'
    };
    r.data.tools.forEach((call, i) =>
      executeLearningTool(repository, { ...call, id: `live_model_tool_${i}` }, context)
    );
    apply('message.add', { conversationId, role: 'assistant', content: r.data.message });
  });
  await check('重复请求复用真实结果，不重复请求或扣额度', async () => {
    const reused = await post('/proxy-ai', body);
    assert.equal(reused.reused, true);
    assert.equal(reused.success, true);
  });
  await check('提示后修正保留首答事实，不冒充独立掌握', async () => {
    const result = apply(
      'attempt.submit',
      { conversationId, answer: '20', explicit: true, kind: 'revision', parentAttemptId: 'live_answer_first' },
      'live_answer_revision'
    );
    assert.ok(result.hints.length > 0);
    const s = summarizeLearning(state);
    assert.equal(s.first.denominator, 1);
    assert.equal(s.mistakes.length, 1);
    assert.equal(Object.values(s.knowledge)[0].status, '需提示');
  });
  await check('真实Mongo同步与重开保持跨入口统计一致', async () => {
    for (let i = 0; i < state.events.length; i += 50) {
      const r = await post('/learning-sync', {
        action: 'push',
        timezone: state.timezone,
        operations: state.events.slice(i, i + 50)
      });
      assert.equal(r.success, true);
    }
    const r = await post('/learning-sync', { action: 'pull' });
    assert.equal(r.success, true);
    assert.deepEqual(summarizeLearning(r.data.state).first, summarizeLearning(state).first);
    assert.equal(r.data.state.attempts.length, 2);
    const other = await post('/learning-models', { action: 'list' }, 'another_isolated_user');
    assert.equal(other.data.models.length, 0);
  });
  await check('真实用量完整记录，自带API不扣平台额度，未确认账户成本保持待结算', async () => {
    const r = await post('/learning-models', { action: 'usage' });
    assert.equal(r.success, true);
    assert.equal(r.data.calls.length, 2);
    assert.equal(r.data.entitlement.spent, 0);
    assert.equal(r.data.cost.spent, 0);
    for (const c of r.data.calls) {
      assert.equal(c.source, 'byok');
      const catalogFreePreset = ['zai', 'zhipu'].includes(values.provider);
      assert.equal(c.actualCost, catalogFreePreset ? 0 : null);
      assert.equal(c.costStatus, catalogFreePreset ? 'settled' : 'pending');
      assert.ok(c.usage.prompt_tokens > 0);
    }
    report.usage = r.data;
    report.statistics = summarizeLearning(state);
  });
} catch (e) {
  report.error = String(e.message).split(apiKey).join('[REDACTED]');
  process.exitCode = 1;
} finally {
  process.off('SIGTERM', interrupt);
  process.off('SIGINT', interrupt);
  if (server.exitCode === null && server.signalCode === null) {
    const exit = once(server, 'exit');
    server.kill('SIGTERM');
    const timeout = setTimeout(() => server.kill('SIGKILL'), 5000);
    try {
      await exit;
    } finally {
      clearTimeout(timeout);
    }
  }
  writeFileSync(`${output}/http-server.log`, logs.split(apiKey).join('[REDACTED]'), { mode: 0o600 });
  report.actualCalls = calls;
  writeFileSync(`${output}/live-report.json`, JSON.stringify(report, null, 2).split(apiKey).join('[REDACTED]') + '\n', {
    mode: 0o600
  });
  console.log(
    JSON.stringify({
      realCalls: calls,
      passed: report.results.length,
      error: report.error,
      evidence: `${output}/live-report.json`
    })
  );
}
