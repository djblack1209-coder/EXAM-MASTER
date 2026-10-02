import { spawn } from 'node:child_process';
import { once } from 'node:events';
import crypto from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { serveStatic } from './mobile-viewport-smoke.mjs';
import { readFreeApiCredential } from './free-api-catalog.mjs';
import {
  createArithmeticQuestion,
  createAlgebraVariant,
  executeLearningTool
} from '../../src/services/learning/learning-tools.js';
import {
  emptyLearningState,
  applyLearningOperation,
  summarizeLearning,
  createMaterialObjectiveQuestion,
  createMaterialObjectiveVariant,
  learningTaskContext
} from '../../src/services/learning/learning-domain.js';
import { parsePastedMaterial, questionFromMaterial } from '../../src/services/learning/material-intake.js';

const { values } = parseArgs({
  options: {
    catalog: { type: 'string' },
    provider: { type: 'string', default: 'zai' },
    output: { type: 'string', default: 'tmp/free-api-closure' },
    suite: { type: 'boolean', default: false },
    tasks: { type: 'string' }
  }
});
if (!values.catalog || process.env.LEARNING_TEST_MONGO_URI !== 'mongodb://127.0.0.1:27189/exam_learning_isolated')
  throw new Error('Explicit private catalog and fixed local isolated Mongo URI required');
const output = values.output;
assert.ok(/^tmp\/[a-zA-Z0-9_/-]+$/.test(output) && !output.split('/').includes('..'), 'Use a local tmp output');
mkdirSync(output, { recursive: true, mode: 0o700 });
assert.ok(['zai', 'zhipu', 'gemini', 'groq'].includes(values.provider), 'Only reviewed catalog providers are allowed');
const selectedTasks = values.tasks?.split(',');
if (selectedTasks) {
  assert.ok(!values.suite, 'Select the whole suite or named remaining tasks');
  assert.equal(new Set(selectedTasks).size, selectedTasks.length, 'Do not repeat real model tasks');
  assert.ok(
    selectedTasks.every((task) => ['postgraduate', 'civil', 'ielts', 'toefl', 'alternate', 'web'].includes(task)),
    'Unknown task'
  );
  assert.ok(!selectedTasks.includes('web') || selectedTasks.length === 1, 'Web acceptance runs separately');
  assert.ok(
    !selectedTasks.includes('alternate') || values.provider === 'groq',
    'Alternate model uses the reviewed provider'
  );
}
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
let frontend, browserServer, browserPage;
const interruptController = new AbortController();
const interrupt = () => {
  interruptController.abort();
  void browserServer?.kill().catch(() => false);
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
  realCallsMaximum: selectedTasks?.length || (values.suite ? 8 : 3),
  data: '仅合成学习任务，不上传用户资料',
  actualPayments: 0,
  results: [],
  calls: [],
  error: null
};
let calls = 0;
async function realCall(route, body) {
  assert.ok(++calls <= report.realCallsMaximum, 'Hard real-call budget exceeded');
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
async function verifyTaskSuite(selected = ['postgraduate', 'civil', 'ielts', 'toefl', 'alternate']) {
  const scenarios = [
    {
      track: 'postgraduate',
      text: '在实数范围内解方程 x+2=5，写出全部精确解。',
      wrong: '2',
      answer: '3',
      variantAnswer: 'x-3'
    },
    {
      track: 'civil',
      text: '2024: 80\n2025: 100\n2026: 150',
      kind: 'growth_percent',
      from: '2024',
      to: '2025',
      wrong: '20%',
      answer: '25%',
      variantAnswer: '50%'
    },
    ...['ielts', 'toefl'].map((track) => ({
      track,
      text: 'Departure city: Bristol\nArrival city: Oxford\nTravel day: Monday',
      kind: 'literal',
      from: 'Departure city',
      wrong: 'London',
      answer: 'Bristol',
      variantAnswer: 'Oxford'
    }))
  ];
  for (const scenario of scenarios.filter((scenario) => selected.includes(scenario.track)))
    await check(`${scenario.track}：实际模型讲解、原文规则、帮助修正及独立复测`, async () => {
      const prefix = `suite_${scenario.track}`;
      const conversationId = apply(
        'conversation.start',
        { goal: '完成所给合成材料练习', task: { track: scenario.track, edition: '合成材料，非官方试题或评分' } },
        `${prefix}_conversation`
      ).id;
      apply('material.add', { material: parsePastedMaterial(scenario.text, `${prefix}_material`) });
      const material = state.materials.at(-1);
      const question = scenario.kind
        ? createMaterialObjectiveQuestion(`${prefix}_q`, material, { ...scenario, segmentId: material.segments[0].id })
        : questionFromMaterial(
            material,
            { segmentId: material.segments[0].id, prompt: scenario.text, type: 'subjective' },
            `${prefix}_q`
          );
      const key = apply('question.add', { question }).questionKey;
      apply('question.focus', { conversationId, questionKey: key });
      const first = apply(
        'attempt.submit',
        { conversationId, answer: scenario.wrong, explicit: true },
        `${prefix}_first`
      );
      assert.equal(first.grade.status, 'reliable');
      assert.equal(first.grade.outcome, 'wrong');
      const response = await realCall('/proxy-ai', {
        requestId: `${prefix}_teach`,
        modelId: profile.id,
        shareConsent: true,
        messages: [
          {
            role: 'user',
            content:
              '请针对我的原答讲解。严格返回规定JSON，以hint工具记一级提示，以plan工具安排当前已知题目的独立复测。不要新建题，不要代答，不宣称工具已执行或官方分数。'
          }
        ],
        learningContext: {
          owner,
          goal: '理解所给材料',
          task: state.conversations.at(-1).task,
          capabilities: learningTaskContext(state, conversationId),
          strategy: { method: 'explain' },
          question: { prompt: question.prompt, questionKey: key, source: question.source },
          attempt: { id: first.id, answer: first.answer, grade: first.grade }
        }
      });
      assert.equal(response.data.structured, true);
      assert.equal(response.data.question, null);
      assert.ok(response.data.tools.some((t) => t.name === 'hint'));
      assert.ok(response.data.tools.some((t) => t.name === 'plan'));
      const context = {
        conversationId,
        permissions: ['read', 'learn'],
        calls: 0,
        maxCalls: 3,
        deadline: Date.now() + 5000,
        origin: 'model',
        model: profile.model,
        lockedMethod: 'explain'
      };
      response.data.tools.forEach((call, index) =>
        executeLearningTool(repository, { ...call, id: `${prefix}_tool_${index}` }, context)
      );
      apply('message.add', { conversationId, role: 'assistant', content: response.data.message });
      const revision = apply(
        'attempt.submit',
        { conversationId, answer: scenario.answer, explicit: true },
        `${prefix}_revision`
      );
      assert.equal(revision.grade.outcome, 'correct');
      assert.ok(revision.hints.length > 0);
      const saved = state.questions.find((q) => `${q.id}@${q.version}` === key);
      const variant = scenario.kind
        ? createMaterialObjectiveVariant(`${prefix}_variant`, saved, state)
        : createAlgebraVariant(`${prefix}_variant`, saved);
      assert.ok(variant);
      const variantKey = apply('question.add', { question: variant }).questionKey;
      apply('question.focus', { conversationId, questionKey: variantKey });
      const independent = apply(
        'attempt.submit',
        { conversationId, answer: scenario.variantAnswer, explicit: true },
        `${prefix}_independent`
      );
      assert.equal(independent.grade.outcome, 'correct');
      assert.equal(independent.kind, 'variant');
      assert.equal(independent.hints.length, 0);
      report.scenarios ||= [];
      report.scenarios.push({
        track: scenario.track,
        originalKey: key,
        variantKey,
        originalWrong: true,
        revisionHelped: true,
        independentCorrect: true,
        source: saved.source,
        officialScore: 'unverified',
        semanticQuality: 'unverified'
      });
    });
  if (values.provider === 'groq' && selected.includes('alternate'))
    await check('另一实际模型使用同一宿主规则与任务工具', async () => {
      if (!state.conversations.some((conversation) => conversation.id === 'live_conversation')) {
        apply('conversation.start', { goal: '独立作答12+8', task: { track: 'primary' } }, 'live_conversation');
        apply('question.add', { question: createArithmeticQuestion('live_arithmetic', '12 + 8') });
        apply('question.focus', { conversationId: 'live_conversation', questionKey: 'live_arithmetic@1' });
        apply(
          'attempt.submit',
          { conversationId: 'live_conversation', answer: '19', explicit: true },
          'live_answer_first'
        );
      }
      const alternate = { ...profile, id: 'groq-closure-alt', model: 'openai/gpt-oss-120b' };
      assert.equal(
        (await post('/learning-models', { action: 'save', profile: alternate, shareConsent: true })).success,
        true
      );
      const response = await realCall('/proxy-ai', {
        requestId: 'suite_alternate',
        modelId: alternate.id,
        shareConsent: true,
        messages: [
          {
            role: 'user',
            content:
              '12+8我答19。严格返回规定JSON，以hint工具记一级凑整提示，以plan工具安排当前题目独立复测。不要新题，不宣称已执行。'
          }
        ],
        learningContext: {
          owner,
          task: { track: 'primary' },
          question: { prompt: '计算 12 + 8。', questionKey: 'live_arithmetic@1' },
          attempt: { id: 'live_answer_first', answer: '19', grade: { status: 'reliable', outcome: 'wrong' } }
        }
      });
      assert.equal(response.data.structured, true);
      assert.ok(response.data.tools.some((t) => t.name === 'hint'));
      assert.ok(response.data.tools.some((t) => t.name === 'plan'));
      const context = {
        conversationId: 'live_conversation',
        permissions: ['read', 'learn'],
        calls: 0,
        maxCalls: 3,
        deadline: Date.now() + 5000,
        origin: 'model',
        model: alternate.model,
        lockedMethod: 'explain'
      };
      response.data.tools.forEach((call, index) =>
        executeLearningTool(repository, { ...call, id: `suite_alt_tool_${index}` }, context)
      );
      report.alternateModel = alternate.model;
    });
}
async function verifyBrowserClosure() {
  report.stage = 'browser_start';
  const webOwner = `${owner}_web`;
  assert.equal(
    (await post('/learning-models', { action: 'save', profile, shareConsent: true }, webOwner)).success,
    true
  );
  const staticServer = await serveStatic(resolve('dist/build/h5'), 4212);
  frontend = staticServer.server;
  const { chromium } = await import('playwright');
  browserServer = await chromium.launchServer({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  report.browserPid = browserServer.process().pid;
  const browser = await chromium.connect(browserServer.wsEndpoint());
  const page = await browser.newPage();
  browserPage = page;
  page.setDefaultTimeout(20000);
  const origin = `http://127.0.0.1:${staticServer.port}`;
  const token = tokenFor(webOwner);
  await page.addInitScript(
    ({ user, token }) => {
      localStorage.setItem('EXAM_USER_ID', user);
      localStorage.setItem('EXAM_TOKEN', token);
    },
    { user: webOwner, token }
  );
  await page.route('**/*', async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    const api = url.pathname.split('/').at(-1);
    if (!['learning-models', 'learning-sync', 'proxy-ai'].includes(api) || request.method() !== 'POST')
      return route.abort('blockedbyclient');
    if (api === 'proxy-ai') assert.ok(++calls <= report.realCallsMaximum, 'Browser real-call budget exceeded');
    const response = await route.fetch({ url: `${base}/${api}`, timeout: 35000, maxRedirects: 0 });
    if (api === 'proxy-ai') {
      const r = await response.json();
      report.browserModel = {
        success: r.success,
        error: r.error || null,
        structured: r.data?.structured,
        question: r.data?.question || null,
        toolNames: r.data?.tools?.map((t) => t.name) || []
      };
    }
    await route.fulfill({ response });
  });
  const button = (name) => page.getByRole('button', { name, exact: true });
  const input = (label) => page.locator(`uni-input[aria-label="${label}"] input, input[aria-label="${label}"]`);
  const draft = () => page.locator('.composer textarea');
  const answer = async (value) => {
    await draft().fill(value);
    await button('确认这是正式作答').click();
  };
  await page.goto(`${origin}/#/pages/learning/index`, { waitUntil: 'networkidle' });
  report.stage = 'browser_task';
  await page.locator('[data-test="task-track-civil"]').click();
  await input('年级或学习阶段').fill('数量与资料分析');
  await input('教材或考试版本').fill('合成材料，非官方试题');
  await page.locator('.goal-panel textarea').fill('从所给数据理解增长率并独立复测');
  await button('开始学习').click();
  report.stage = 'browser_material';
  await page.locator('[data-test="task-status"]').filter({ hasText: '考公' }).waitFor();
  await button('导入与校对资料').click();
  await page.locator('.panel textarea').first().fill('2024: 80\n2025: 100\n2026: 150');
  await button('本地保存分段资料').click();
  await button('从此资料组织一道题').click();
  await page.locator('[data-test="objective-kind-growth_percent"]').click();
  await input('所查字段或基期字段').fill('2024');
  await input('现期字段').fill('2025');
  await page.locator('[data-test="start-objective"]').click();
  await page.locator('[data-test="task-status"]').filter({ hasText: '已有独立校验依据' }).waitFor();
  await answer('20%');
  await page.locator('.session-progress').filter({ hasText: '错题 1' }).waitFor();
  report.stage = 'browser_model';
  await button('本地学习 · 模型连接').click();
  await button('查看云模型').click();
  await button('使用此模型').click();
  await page.getByRole('checkbox', { name: /允许向所选模型发送/ }).click();
  await button('直接讲解').click();
  await button('直接讲解').waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => {
      const b = [...document.querySelectorAll('[role=button]')].find((e) => e.textContent.trim() === '直接讲解');
      return b && !b.hasAttribute('disabled') && b.getAttribute('aria-disabled') !== 'true';
    },
    null,
    { timeout: 40000 }
  );
  assert.equal(report.browserModel?.success, true, 'Actual browser model request failed');
  assert.equal(report.browserModel.structured, true);
  assert.equal(report.browserModel.question, null);
  report.stage = 'browser_retest';
  await answer('25%');
  await button('变式练习').click();
  await page.locator('.question-prompt').filter({ hasText: '“2026”相对“2025”' }).waitFor();
  await answer('50%');
  report.stage = 'browser_export_sync';
  await button('记录与隐私').click();
  const download = page.waitForEvent('download');
  await button('导出记录').click();
  await (await download).cancel();
  const backup = await page
    .locator('uni-textarea[aria-label="学习记录 JSON 备份"] textarea, textarea[aria-label="学习记录 JSON 备份"]')
    .inputValue();
  const saved = JSON.parse(backup);
  assert.equal(saved.owner, webOwner);
  assert.equal(saved.conversations[0].task.track, 'civil');
  assert.equal(saved.attempts.length, 3);
  assert.equal(saved.attempts[0].grade.outcome, 'wrong');
  assert.ok(saved.attempts[1].hints.length > 0);
  assert.equal(saved.attempts[2].kind, 'variant');
  assert.equal(saved.attempts[2].hints.length, 0);
  assert.equal(saved.attempts[2].grade.outcome, 'correct');
  assert.equal(saved.reviews.length, 2);
  assert.ok(!backup.includes(apiKey));
  await button('校验并预览').click();
  await page.getByText(/新增 0 个操作/).waitFor();
  await button('同步学习记录').click();
  await page.getByText('同步当前用户的学习记录', { exact: true }).waitFor();
  await page.getByText('OK', { exact: true }).click();
  await page.getByText('学习记录已同步并按服务端事实重算。', { exact: true }).waitFor();
  const cloud = await post('/learning-sync', { action: 'pull' }, webOwner);
  assert.equal(cloud.success, true);
  assert.equal(cloud.data.state.attempts.length, 3);
  assert.equal(cloud.data.state.conversations[0].task.track, 'civil');
  assert.equal(cloud.data.state.questions[0].validation.evidenceId, 'material-objective-v1');
  await page.reload({ waitUntil: 'networkidle' });
  report.stage = 'browser_reload';
  await page.locator('[data-test="task-status"]').filter({ hasText: '考公' }).waitFor();
  await page.locator('.question-prompt').filter({ hasText: '“2026”相对“2025”' }).waitFor();
  const usage = await post('/learning-models', { action: 'usage' }, webOwner);
  assert.equal(usage.data.calls.length, 1);
  assert.equal(usage.data.entitlement.spent, 0);
  report.browserClosure = {
    task: 'civil',
    actualBrowser: true,
    originalMaterial: 'synthetic_text',
    attempts: 3,
    originalWrong: true,
    revisionHelped: true,
    independentVariantCorrect: true,
    reviews: 2,
    exportPreview: true,
    authenticatedMongoSync: true,
    reloadPreserved: true,
    actualSupplierCalls: 1,
    providerCost: usage.data.calls[0].costStatus,
    semanticQuality: 'unverified'
  };
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
  if (selectedTasks?.includes('web')) {
    await check('实际网页完成材料、真实模型、修正、独立复测、复习、导出、同步与重开', verifyBrowserClosure);
  } else if (selectedTasks) {
    report.stage = 'selected_task_api';
    await verifyTaskSuite(selectedTasks);
  } else {
    if (values.suite)
      await check('实际网页完成材料、真实模型、修正、独立复测、复习、导出、同步与重开', verifyBrowserClosure);
    report.stage = 'arithmetic_api';
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
    const conversationId = apply(
      'conversation.start',
      { goal: '理解12+8，做完后根据错因复习', task: { track: 'primary' } },
      'live_conversation'
    ).id;
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
  }
  if (values.suite || (selectedTasks && !selectedTasks.includes('web'))) {
    report.stage = 'task_api_suite';
    if (!selectedTasks) await verifyTaskSuite();
    await check('新增任务和资料规则经真实同步重放后保持原答、来源与独立结果', async () => {
      for (let index = 0; index < state.events.length; index += 50)
        assert.equal(
          (
            await post('/learning-sync', {
              action: 'push',
              timezone: state.timezone,
              operations: state.events.slice(index, index + 50)
            })
          ).success,
          true
        );
      const cloud = await post('/learning-sync', { action: 'pull' });
      assert.equal(cloud.success, true);
      assert.equal(cloud.data.state.attempts.length, state.attempts.length);
      assert.deepEqual(summarizeLearning(cloud.data.state).first, summarizeLearning(state).first);
      for (const scenario of report.scenarios || [])
        assert.equal(
          cloud.data.state.questions.find((q) => `${q.id}@${q.version}` === scenario.originalKey).source.materialId,
          scenario.source.materialId
        );
    });
    report.suiteUsage = (await post('/learning-models', { action: 'usage' })).data;
    report.statistics = summarizeLearning(state);
  }
  report.stage = 'complete';
} catch (e) {
  report.error = String(e.message).split(apiKey).join('[REDACTED]');
  if (browserPage && !browserPage.isClosed())
    report.browserDebug = await browserPage
      .locator('body')
      .innerText()
      .then((text) => text.slice(0, 3500))
      .catch(() => 'Browser unavailable');
  process.exitCode = 1;
} finally {
  process.off('SIGTERM', interrupt);
  process.off('SIGINT', interrupt);
  if (browserServer) {
    const timeout = setTimeout(() => void browserServer.kill().catch(() => false), 5000);
    try {
      await browserServer.close();
    } catch {
      await browserServer.kill().catch(() => false);
    } finally {
      clearTimeout(timeout);
      await browserServer.kill().catch(() => false);
    }
    report.browserClosed = browserServer.process().exitCode !== null || browserServer.process().signalCode !== null;
  }
  if (frontend) {
    frontend.closeAllConnections();
    await new Promise((resolve) => frontend.close(resolve));
    report.frontendClosed = true;
  }
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
  report.backendClosed = server.exitCode !== null || server.signalCode !== null;
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
      stage: report.stage,
      evidence: `${output}/live-report.json`
    })
  );
}
