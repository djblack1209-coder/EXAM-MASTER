#!/usr/bin/env node
// Synthetic exercise-generation probe: production prompt/schema, parse gates (incl. stated word count),
// blind-fill calibration and one bounded repair, over real BYOK transport. No server, database or learning
// writes. Transport, budget, capability and dev paid fallback handling follow writing-mixed-replay.mjs.
import { readFileSync, writeFileSync, lstatSync, realpathSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { readFreeApiCredential } from '../build/free-api-catalog.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const { values } = parseArgs({
  options: {
    runtime: { type: 'string' },
    output: { type: 'string' },
    'capability-from': { type: 'string' },
    case: { type: 'string' },
    model: { type: 'string', default: 'agnes-3.0-flash' },
    repeat: { type: 'string', default: '1' },
    budget: { type: 'string', default: '40' },
    interval: { type: 'string', default: '15' },
    'free-only': { type: 'boolean', default: false }
  }
});
const repetitions = Number(values.repeat),
  budget = Number(values.budget),
  interval = Number(values.interval);
// 供应商有并发与分钟限流：调用串行发出，两次调用之间至少间隔 interval 秒，不连续重试；
// 限流时该条改由开发付费兜底作答，未启用兜底则停。
if (!Number.isInteger(interval) || interval < 0 || interval > 120) throw new Error('interval must be 0..120 seconds');
if (![1, 3].includes(repetitions) || !Number.isInteger(budget) || budget < 1 || budget > 60)
  throw new Error('repeat must be 1 or 3; budget must be 1..60 (including probes, calibration and repair)');
if (
  ![
    'agnes-3.0-flash',
    'glm-4.7-flash',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'google/gemma-4-26b-a4b-it:free',
    'dots-studio/dots-3-note-preview:free'
  ].includes(values.model)
)
  throw new Error('Only exact reviewed zero-price routes are allowed');
function localPath(value, directory = false) {
  const path = resolve(root, value || '');
  if (
    !path.startsWith(resolve(root, 'tmp') + '/') ||
    realpathSync(directory ? path : resolve(path, '..')) !== (directory ? path : resolve(path, '..'))
  )
    throw new Error('Use an existing, non-symlink directory inside project tmp');
  if (!directory)
    try {
      if (lstatSync(path).isSymbolicLink()) throw new Error('Symlinks are not allowed');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  return path;
}
const runtime = localPath(values.runtime, true),
  output = localPath(values.output);
try {
  lstatSync(output);
  throw new Error('Preserve existing evidence; choose a new output filename');
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const moduleAt = (name) => import(pathToFileURL(resolve(runtime, 'functions/_shared', name)));
const provider = await moduleAt('ai-providers/learning-provider.js');
const coach = await moduleAt('learning-writing-coach.js');
const { learningTimeout } = await moduleAt('learning-runtime-policy.js');
const { freeModelPricing, modelInferenceParameters } = await moduleAt('ai-providers/free-model-presets.js');
const { newAccount, reserveCall, settleCall } = await moduleAt('learning-account.js');
const fallback = await moduleAt('ai-providers/dev-paid-fallback.js').catch(() => null);
const hash = (value) => createHash('sha256').update(value).digest('hex');

// 与客户端 coachInputFor 同形的出题请求：两种考试的摸底，以及两种篇幅的每日训练。
const day = new Date().toISOString().slice(0, 10);
const base = {
  contract: 'kaoyan-writing-coach-v1',
  day,
  minutes: 25,
  sources: [],
  weaknesses: [],
  exerciseContract: coach.COACH_EXERCISE_CONTRACT
};
const diagnostic = { phase: 'diagnostic', target: 'diagnostic', input: '开始十分钟摸底', task: '五项摸底，题量各一题' };
const daily = {
  phase: 'daily',
  target: 'daily',
  input: '安排今天的训练',
  task:
    '先复习，再依序训练，按已保存薄弱点调整。上次已保存反馈：' +
    JSON.stringify([
      { name: '语法', score: 2 },
      { name: '搭配', score: 1 },
      { name: '表达', score: 2 },
      { name: '任务完成', score: 2 }
    ])
};
let samples = [
  { name: 'english1-diagnostic', request: { ...base, ...diagnostic, exam: 'english1', essayType: 'small' } },
  { name: 'english2-diagnostic', request: { ...base, ...diagnostic, exam: 'english2', essayType: 'small' } },
  { name: 'english1-daily-large', request: { ...base, ...daily, exam: 'english1', essayType: 'large' } },
  { name: 'english2-daily-small', request: { ...base, ...daily, exam: 'english2', essayType: 'small' } }
];
if (values.case) samples = samples.filter((sample) => sample.name === values.case);
if (!samples.length) throw new Error('Unknown case');
for (const sample of samples) coach.normalizeCoachRequest(sample.request);

const route =
  values.model === 'agnes-3.0-flash'
    ? {
        credential: 'agnes',
        provider: 'Agnes AI',
        origin: 'https://apihub.agnes-ai.com',
        basePath: '/v1',
        pricingSource: 'https://wiki.agnes-ai.com/en/docs/pricing'
      }
    : values.model === 'glm-4.7-flash'
      ? {
          credential: 'zhipu',
          provider: '智谱',
          origin: 'https://open.bigmodel.cn',
          basePath: '/api/paas/v4',
          pricingSource: 'https://docs.bigmodel.cn/cn/guide/start/pricing.md'
        }
      : {
          credential: 'openrouter',
          provider: 'OpenRouter',
          origin: 'https://openrouter.ai',
          basePath: '/api/v1',
          pricingSource: 'https://openrouter.ai/' + values.model
        };
const openrouter = route.credential === 'openrouter';
const { origin, basePath } = route;
const model = {
  id: 'generation-free-byok',
  source: 'byok',
  provider: route.provider,
  model: values.model,
  endpoint: origin + basePath + '/chat/completions',
  maxOutput: 8192,
  timeoutMs: learningTimeout({ coach: samples[0].request }),
  capabilities: { structured: false, tools: false }
};
const report = {
  startedAt: new Date().toISOString(),
  pid: process.pid,
  scope:
    'real BYOK transport, production exercise prompt/schema, parse gates, blind-fill calibration and bounded repair; in-memory budget only; no App or HTTP-handler claim',
  cases: samples.map(({ name }) => name),
  requests: Object.fromEntries(samples.map(({ name, request }) => [name, request])),
  runtime: values.runtime,
  model: model.model,
  endpoint: model.endpoint,
  provider: model.provider,
  pricingSource: route.pricingSource,
  intervalSeconds: interval,
  timeoutMs: model.timeoutMs,
  inferenceParameters: modelInferenceParameters(model),
  budget,
  probes: [],
  runs: [],
  dailyCounters: []
};
report.runtimeSha256 = Object.fromEntries(
  ['learning-writing-coach.js', 'ai-providers/learning-provider.js', 'ai-providers/free-model-presets.js'].map(
    (name) => [name, hash(readFileSync(resolve(runtime, 'functions/_shared', name)))]
  )
);
const save = () => writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
const rejection = (error) => ({
  code: error.code || 'PROBE_FAILED',
  path: error.path || null,
  message: error.message
});
const price = freeModelPricing(model);
if (!price || price.inputPerMillion !== 0 || price.outputPerMillion !== 0)
  throw new Error('Exact zero-price route is not valid');
report.priceVersion = price.priceVersion;
if (openrouter) {
  const response = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(15000) });
  const catalog = await response.json();
  const exact = catalog.data?.find((entry) => entry.id === model.model);
  if (
    !response.ok ||
    !exact ||
    Number(exact.pricing?.prompt) !== 0 ||
    Number(exact.pricing?.completion) !== 0 ||
    Object.entries(exact.pricing).some(([key, value]) => !['prompt', 'completion'].includes(key) && Number(value) !== 0)
  )
    throw new Error('Public catalog no longer confirms exact all-zero route');
  report.livePricing = {
    checkedAt: new Date().toISOString(),
    source: 'https://openrouter.ai/api/v1/models',
    id: exact.id,
    pricing: exact.pricing,
    supportedParameters: exact.supported_parameters
  };
}
model.apiKey = readFreeApiCredential(
  resolve(process.env.HOME, 'Desktop/Free-llm-API.html'),
  route.credential,
  origin + basePath
);
// 开发付费兜底：本机有权限 600 的密钥文件即启用（与开发后端同一文件），--free-only 关闭；运行时不含兜底模块则不启用。
const paidFile = resolve(process.env.HOME, '.config/deepseek-lazy-yozi.env');
const paidReady = !values['free-only'] && Boolean(fallback?.DEV_PAID_FALLBACK_ID);
if (paidReady && !process.env[fallback.DEV_PAID_FALLBACK_FILE] && existsSync(paidFile))
  process.env[fallback.DEV_PAID_FALLBACK_FILE] = paidFile;
const paidModel = paidReady ? fallback.devPaidFallbackSettings(true)?.model : null;
report.paidFallback = { armed: Boolean(paidModel), model: paidModel || null, calls: 0 };
let account = newAccount('generation-synthetic-probe');
account.cost.hardLimit = 0;
const signal = new AbortController();
for (const name of ['SIGINT', 'SIGTERM']) process.once(name, () => signal.abort());

async function counter(stage) {
  if (!openrouter) return;
  try {
    const res = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: 'Bearer ' + model.apiKey },
      signal: AbortSignal.timeout(10000)
    });
    const value = (await res.json()).data?.free_model_daily_requests;
    const data = value
      ? Object.fromEntries(
          Object.entries(value).filter(([key]) =>
            ['used', 'limit', 'remaining', 'resets_at', 'reset_at', 'reset'].includes(key)
          )
        )
      : null;
    report.dailyCounters.push({
      stage,
      at: new Date().toISOString(),
      httpStatus: res.status,
      data,
      localAttemptedCalls: account.calls.length
    });
    if (data && Number.isFinite(data.remaining)) report.remainingAtLastCheck = data.remaining;
  } catch {
    report.dailyCounters.push({ stage, data: null, localAttemptedCalls: account.calls.length });
  }
  save();
}
let lastCallEndedAt = 0;
const spent = () => account.calls.length + report.paidFallback.calls;
// answer=true 只给主作答调用：免费模型限流、额度不足或空回答时，同一请求按原合同改由 DeepSeek 作答。
// 兜底配置直接调用（同条复核、校准、返修）不占免费账目，也不等免费供应商的间隔；免费账目只记免费模型。
async function invoke(config, messages, entry, validate, answer = false, quality = false) {
  if (signal.signal.aborted) throw new Error('Cancelled');
  if (spent() >= budget || report.remainingAtLastCheck === 0) throw new Error('Planned call budget exhausted');
  const paid = config.devPaidFallback === true;
  // quality：免费返修仍未通过，这次直接由兜底质量型号作答，不调用免费模型。
  const free = !paid && !quality;
  const wait = free ? lastCallEndedAt + interval * 1000 - Date.now() : 0;
  if (wait > 0) await new Promise((done) => setTimeout(done, wait));
  entry.requestId = 'generation_' + randomUUID();
  entry.startedAt = new Date().toISOString();
  if (paid) {
    report.paidFallback.calls++;
    entry.paidFallback = { model: config.model };
  } else if (free)
    account = reserveCall(account, {
      id: entry.requestId,
      fingerprint: hash(JSON.stringify(messages)),
      source: 'byok',
      model: model.model,
      provider: model.provider,
      maxCost: 0,
      units: 0,
      callLimit: budget
    }).account;
  save();
  const start = Date.now();
  let result,
    freeError = null,
    answering = config,
    ledger = free;
  const failFree = (error, observed) => {
    ledger = false;
    account = settleCall(account, entry.requestId, {
      success: false,
      actualCost:
        (observed?.actualModel === model.model && observed?.usage) || error.executionStage === 'not_called' ? 0 : null,
      usage: observed?.usage || null,
      errorCode: error.code || 'PROBE_FAILED'
    }).account;
  };
  const send = (target, targetMessages, origins) => {
    if (target === config)
      return provider
        .callLearningProvider(target, targetMessages, origins, signal.signal, undefined, true)
        .catch((error) => {
          freeError = error;
          throw error;
        });
    // 免费模型没给出可用回答：先结清它的账目，再由兜底作答。返修仍被拒（quality）时这次没有免费调用。
    if (!quality) failFree(freeError, freeError.observed);
    if (spent() >= budget) throw new Error('Planned call budget exhausted');
    report.paidFallback.calls++;
    answering = target;
    entry.paidFallback = quality
      ? { trigger: 'QUALITY_REJECTED', model: target.model }
      : {
          trigger: freeError.code === 'INVALID_RESPONSE' ? 'EMPTY_RESPONSE' : freeError.code,
          freeError: rejection(freeError),
          model: target.model
        };
    return provider.callLearningProvider(target, targetMessages, origins, signal.signal, undefined, true);
  };
  try {
    result =
      answer && !paid && report.paidFallback.armed
        ? (
            await fallback.callWithDevPaidFallback(send, config, messages, [origin], {
              enabled: true,
              armed: true,
              stream: false,
              signal: signal.signal,
              quality
            })
          ).response
        : await send(config, messages, [paid ? fallback.DEV_PAID_FALLBACK_ORIGIN : origin]);
    if (provider.modelValueHasKeyEcho(result, model.apiKey) || provider.modelValueHasKeyEcho(result, answering.apiKey))
      throw Object.assign(new Error('Secret echo rejected'), { code: 'SECRET_ECHO' });
    if (result.actualModel !== answering.model)
      throw Object.assign(new Error('Actual model mismatch'), { code: 'MODEL_MISMATCH' });
    entry.actualModel = result.actualModel;
    entry.durationMs = result.durationMs;
    entry.usage = result.usage;
    try {
      entry.raw = JSON.parse(result.content);
    } catch {
      /* Never retain an unparseable body. */
    }
    if (validate) validate(result.content);
    entry.status = 'accepted';
    if (ledger)
      account = settleCall(account, entry.requestId, {
        success: true,
        actualCost: result.usage ? 0 : null,
        usage: result.usage
      }).account;
    return { result, answering };
  } catch (error) {
    entry.status = error.code === 'COACH_INVALID' ? 'rejected' : 'failed';
    entry.rejection = rejection(error);
    entry.upstreamStatus = error.upstreamStatus || null;
    const observed = result || error.observed;
    entry.usage = observed?.usage || null;
    entry.actualModel = observed?.actualModel || null;
    entry.durationMs = observed?.durationMs || entry.durationMs;
    if (ledger) failFree(error, observed);
    return { error, result, answering };
  } finally {
    if (free) lastCallEndedAt = Date.now();
    entry.wallDurationMs = Date.now() - start;
    if (free) await counter(entry.requestId);
    save();
  }
}
// 免费通过率只算测到免费模型的条目，兜底条目单列：首次作答就限流或额度不足的不进免费分母（无论是否兜底）；
// 免费模型已作答过（空回答，或到返修才换）的仍记免费未通过。
function freeAndPaidSummary(rows) {
  const switched = rows.filter((row) => row.paidFallback);
  const measured = rows.filter(
    (row) =>
      !['RATE_LIMITED', 'UPSTREAM_QUOTA'].includes(
        row.paidFallback ? row.paidFallback.attempt === 0 && row.paidFallback.trigger : row.attempts[0]?.rejection?.code
      )
  );
  const triggers = {};
  for (const row of switched) triggers[row.paidFallback.trigger] = (triggers[row.paidFallback.trigger] || 0) + 1;
  return {
    free: {
      runs: measured.length,
      accepted: measured.filter((row) => !row.paidFallback && row.status === 'accepted').length,
      notMeasured: rows.length - measured.length
    },
    paidFallback: {
      ...report.paidFallback,
      runs: switched.length,
      accepted: switched.filter((row) => row.status === 'accepted').length,
      triggers
    }
  };
}
async function capability() {
  if (values['capability-from']) {
    const retained = JSON.parse(readFileSync(localPath(values['capability-from']), 'utf8'));
    if (
      retained.model !== model.model ||
      retained.endpoint !== model.endpoint ||
      !retained.capabilityVerified ||
      Date.now() - Date.parse(retained.startedAt) > 86400000
    )
      throw new Error('Capability receipt does not match model/endpoint or is stale');
    report.capabilityFrom = values['capability-from'];
  } else {
    const nonce = randomUUID().replaceAll('-', '');
    const messages = [
      {
        role: 'system',
        content:
          'This is a capability test. Follow the requested tool or JSON schema exactly. No learning data is provided.'
      },
      {
        role: 'user',
        content: `Call yozi_capability_echo with nonce ${nonce}. After its result return JSON with the same nonce and accepted=true.`
      }
    ];
    const first = { stage: 'tool' };
    report.probes.push(first);
    const a = await invoke({ ...model, timeoutMs: 30000, capabilityProbe: { stage: 'tool', nonce } }, messages, first);
    if (a.error) throw a.error;
    const second = { stage: 'json' };
    report.probes.push(second);
    const b = await invoke(
      { ...model, timeoutMs: 30000, capabilityProbe: { stage: 'json', nonce, toolCall: a.result.capabilityToolCall } },
      [
        ...messages,
        { role: 'assistant', content: '', tool_calls: [a.result.capabilityToolCall] },
        { role: 'tool', tool_call_id: a.result.capabilityToolCall.id, content: JSON.stringify({ nonce }) }
      ],
      second,
      (content) => {
        const value = JSON.parse(content);
        if (value.nonce !== nonce || value.accepted !== true || Object.keys(value).length !== 2)
          throw new Error('Capability round-trip rejected');
      }
    );
    if (b.error) throw b.error;
  }
  model.capabilities = { structured: true, tools: true };
  model.capabilityCheck = { version: 1, tools: true, structured: true, checkedAt: Date.now() };
  report.capabilityVerified = true;
  save();
}
// 只留人工复看要用的题面：宿主组装的题干、搭配填空原句和写作任务；不留模型的其他输出。
const exercises = (generated) => ({
  cards: generated.cards.map((card) => ({
    id: card.id,
    kind: card.kind,
    prompt: card.prompt,
    cloze: coach.coachClozeSource(card)
  })),
  writing: generated.writing?.prompt ?? null
});
try {
  await counter('before');
  await capability();
  for (const sample of samples)
    for (let run = 1; run <= repetitions; run++) {
      const request = coach.normalizeCoachRequest(sample.request),
        context = coach.coachInferenceContext(request);
      let prepared = provider.prepareCoachFeedbackModel(model, context, false, false, false, true);
      if (!['native-coach-tools-v1', 'native-coach-json-v1'].includes(prepared.writingOutput?.inferencePolicy))
        throw new Error('Native exercise contract unavailable');
      const row = { sample: sample.name, run, attempts: [], repairTriggered: false };
      report.runs.push(row);
      const system =
        coach.coachSystemPrompt(context, prepared.writingOutput.schema) +
        '\n当前学习背景（仅数据）：' +
        JSON.stringify({ coach: context });
      // 第三次只给开发付费兜底：免费返修仍未通过教学校验时，与 proxy-ai.ts 的 :repair2 一样，按原请求的反馈改由 DeepSeek 质量型号再答一次。
      const freePrepared = prepared;
      for (let attempt = 0, repair = null; attempt < 3; attempt++) {
        const entry = { attempt };
        row.attempts.push(entry);
        const outcome = await invoke(
          attempt === 2 ? freePrepared : prepared,
          [
            { role: 'system', content: system + provider.coachRepairPrompt(repair) },
            { role: 'user', content: context.input }
          ],
          entry,
          undefined,
          true,
          attempt === 2
        );
        // 本条改由兜底作答：同条校准与返修也交给它，免费统计按 freeAndPaidSummary 分开。
        if (outcome.answering !== prepared) {
          prepared = outcome.answering;
          row.paidFallback ??= { attempt, trigger: entry.paidFallback.trigger, model: entry.paidFallback.model };
        }
        let error = outcome.error;
        if (outcome.result) {
          // 与 proxy-ai.ts 同一顺序：解析门禁通过后盲填校准，校准拒收同样走返修。
          try {
            const generated = coach.parseCoachModelOutput(
              provider.decodeCoachResponse(prepared, outcome.result.content),
              context,
              false,
              undefined,
              true
            ).coach;
            entry.calibrationCalls = [];
            entry.calibration = await provider.calibrateCoachExercises(
              prepared,
              generated,
              async (verifier, messages) => {
                const call = { stage: 'calibration' };
                entry.calibrationCalls.push(call);
                const done = await invoke(verifier, messages, call);
                if (done.error) throw done.error;
                return done.result.content;
              }
            );
            if (entry.calibration?.status !== 'completed' || entry.calibration?.passes !== 2)
              throw Object.assign(new Error('练习核对未完成，题目未下发'), {
                code: 'COACH_INVALID',
                path: 'exerciseCalibration',
                repairForbidden: true
              });
            entry.output = exercises(generated);
            entry.status = 'accepted';
          } catch (caught) {
            error = caught;
            entry.status = caught.code === 'COACH_INVALID' ? 'rejected' : 'failed';
            entry.rejection = rejection(caught);
          }
        }
        if (entry.output) {
          row.status = 'accepted';
          break;
        }
        row.status = entry.status;
        if (error?.repairForbidden) break;
        if (error?.code === 'RATE_LIMITED') throw error;
        if (attempt === 1 && error?.code === 'COACH_INVALID' && report.paidFallback.armed) continue;
        if (attempt) break;
        repair =
          error?.code === 'COACH_INVALID'
            ? provider.coachRepairFeedback(prepared, error, outcome.result?.content)
            : null;
        if (!repair) break;
        row.repairTriggered = true;
      }
      row.calls = row.attempts.reduce((sum, attempt) => sum + 1 + (attempt.calibrationCalls?.length || 0), 0);
      row.durationMs = row.attempts.reduce(
        (sum, attempt) =>
          sum +
          attempt.wallDurationMs +
          (attempt.calibrationCalls || []).reduce((total, call) => total + call.wallDurationMs, 0),
        0
      );
      save();
      console.log(
        JSON.stringify({
          sample: sample.name,
          run,
          status: row.status,
          repair: row.repairTriggered,
          paidFallback: row.paidFallback || null,
          rejections: row.attempts.map((attempt) => attempt.rejection || null),
          calibration: row.attempts.at(-1).calibration || null,
          durationMs: row.durationMs,
          calls: account.calls.length
        })
      );
    }
  if (report.runs.some((row) => row.status !== 'accepted')) process.exitCode = 2;
} catch (error) {
  report.blocker = { code: error.code || 'PROBE_FAILED', message: error.message };
  process.exitCode = 1;
} finally {
  await counter('finished');
  delete model.apiKey;
  report.finishedAt = new Date().toISOString();
  report.costs = account.calls.map(({ id, status, actualCost, costStatus, usage }) => ({
    id,
    status,
    actualCost,
    costStatus,
    usage
  }));
  report.calls = account.calls.length;
  if (report.paidFallback)
    report.summary = freeAndPaidSummary(report.runs.filter((row) => row.attempts?.[0]?.requestId));
  report.notRun = samples.flatMap((sample) =>
    Array.from({ length: repetitions }, (_, index) => ({ sample: sample.name, run: index + 1 })).filter(
      (planned) =>
        !report.runs.some(
          (row) =>
            row.sample === planned.sample &&
            row.run === planned.run &&
            row.attempts?.length &&
            row.attempts[0].requestId
        )
    )
  );
  save();
  console.log(
    JSON.stringify({
      output: values.output,
      runs: report.runs.length,
      blocker: report.blocker,
      calls: report.calls,
      dailyCounter: report.dailyCounters.at(-1)?.data || null,
      summary: report.summary || null
    })
  );
}
