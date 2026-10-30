#!/usr/bin/env node
// Local prompt/decoder probe: no server, database, learning writes or paid fallback.
import { readFileSync, writeFileSync, lstatSync, realpathSync } from 'node:fs';
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
    sample: { type: 'string', default: 'tmp/writing-quality-20261027/legacy-teaching-cases.json' },
    replay: { type: 'string' },
    model: { type: 'string', default: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
    repeat: { type: 'string', default: '1' }
  }
});
const repetitions = Number(values.repeat);
if (![1, 3].includes(repetitions)) throw new Error('repeat must be 1 or 3');
if (
  ![
    'glm-4.5-flash',
    'glm-4.7-flash',
    'agnes-3.0-flash',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free'
  ].includes(values.model)
)
  throw new Error('Only exact reviewed zero-price routes are allowed');
const agnes = values.model === 'agnes-3.0-flash';
const openrouter = values.model.endsWith(':free');
function localPath(value, directory = false) {
  const path = resolve(root, value || '');
  if (
    !path.startsWith(resolve(root, 'tmp') + '/') ||
    realpathSync(directory ? path : resolve(path, '..')) !== (directory ? path : resolve(path, '..'))
  )
    throw new Error('Use an existing, non-symlink directory inside project tmp');
  if (!directory) {
    try {
      if (lstatSync(path).isSymbolicLink()) throw new Error('Symlinks are not allowed');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
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
const { freeModelPricing } = await moduleAt('ai-providers/free-model-presets.js');
const { newAccount, reserveCall, settleCall } = await moduleAt('learning-account.js');
const sampleText = readFileSync(localPath(values.sample), 'utf8');
const samples = JSON.parse(sampleText);
if (!Array.isArray(samples) || samples.length !== 1 || samples[0].request?.target !== 'diagnostic')
  throw new Error('Use the original single five-question diagnostic sample');
const report = {
  startedAt: new Date().toISOString(),
  pid: process.pid,
  scope: 'real BYOK transport, production prompt/schema/decoder; in-memory budget only; no App or HTTP-handler claim',
  sample: values.sample,
  sampleSha256: createHash('sha256').update(sampleText).digest('hex'),
  runtime: values.runtime,
  model: values.model,
  provider: agnes ? 'Agnes AI' : openrouter ? 'OpenRouter' : 'Z.ai',
  pricingSource: agnes
    ? 'https://wiki.agnes-ai.com/en/docs/pricing'
    : openrouter
      ? 'https://openrouter.ai/' + values.model
      : 'https://docs.z.ai/guides/overview/pricing',
  probes: [],
  runs: []
};
report.runtimeSha256 = Object.fromEntries(
  ['learning-writing-coach.js', 'ai-providers/learning-provider.js', 'ai-providers/free-model-presets.js'].map(
    (name) => [
      name,
      createHash('sha256')
        .update(readFileSync(resolve(runtime, 'functions/_shared', name)))
        .digest('hex')
    ]
  )
);
const save = () => writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
const origin = agnes ? 'https://apihub.agnes-ai.com' : openrouter ? 'https://openrouter.ai' : 'https://api.z.ai';
const basePath = agnes ? '/v1' : openrouter ? '/api/v1' : '/api/paas/v4';
const model = {
  id: 'round1-free-byok',
  source: 'byok',
  provider: report.provider,
  model: report.model,
  endpoint: origin + basePath + '/chat/completions',
  maxOutput: 8192,
  timeoutMs: 60000,
  capabilities: { structured: false, tools: false }
};
if (values.replay) {
  const retained = JSON.parse(readFileSync(localPath(values.replay), 'utf8'));
  if (retained.sampleSha256 !== report.sampleSha256 || retained.model !== model.model)
    throw new Error('Retained sample/model binding mismatch');
  report.scope = 'offline revalidation of retained synthetic model outputs; no credentials, network or learning writes';
  report.replayedFrom = values.replay;
  model.capabilities = { structured: true, tools: true };
  model.capabilityCheck = { version: 1, tools: true, structured: true, checkedAt: Date.now() };
  const request = coach.normalizeCoachRequest(samples[0].request),
    context = coach.coachInferenceContext(request);
  const prepared = provider.prepareCoachFeedbackModel(model, context, false, false, false, true);
  for (const original of retained.runs) {
    const row = { run: original.run, originalRequestId: original.requestId, status: 'pending' };
    try {
      const decoded = provider.decodeCoachResponse(prepared, JSON.stringify(original.raw));
      const result = coach.parseCoachModelOutput(decoded, request, false, undefined, true).coach;
      row.status = 'accepted';
      row.dimensions = result.dimensions;
    } catch (error) {
      row.status = 'rejected';
      row.rejection = {
        code: error.code,
        path: error.path,
        message: error.message,
        dimension: error.validationDimension || null,
        quoteIds: error.validationQuoteIds || []
      };
    }
    report.runs.push(row);
  }
  report.finishedAt = new Date().toISOString();
  save();
  console.log(
    JSON.stringify({
      output: values.output,
      runs: report.runs.map(({ run, status, rejection }) => ({ run, status, rejection })),
      calls: 0
    })
  );
  process.exit(report.runs.length && report.runs.every((r) => r.status === 'accepted') ? 0 : 2);
}
const price = freeModelPricing(model);
if (!price || price.inputPerMillion !== 0 || price.outputPerMillion !== 0)
  throw new Error('Exact zero-price route is not valid');
report.priceVersion = price.priceVersion;
model.apiKey = readFreeApiCredential(
  resolve(process.env.HOME, 'Desktop/Free-llm-API.html'),
  agnes ? 'agnes' : openrouter ? 'openrouter' : 'zai',
  origin + basePath
);
let account = newAccount('round1-synthetic-probe');
account.cost.hardLimit = 0;
const signal = new AbortController();
for (const name of ['SIGINT', 'SIGTERM']) process.once(name, () => signal.abort());
async function invoke(config, messages, entry) {
  const id = 'round1_' + randomUUID();
  entry.requestId = id;
  account = reserveCall(account, {
    id,
    fingerprint: createHash('sha256').update(JSON.stringify(messages)).digest('hex'),
    source: 'byok',
    model: model.model,
    provider: model.provider,
    maxCost: 0,
    units: 0,
    callLimit: 5
  }).account;
  save();
  let result;
  try {
    result = await provider.callLearningProvider(config, messages, [origin], signal.signal, undefined, true);
    if (provider.modelValueHasKeyEcho(result, model.apiKey))
      throw Object.assign(new Error('Secret echo rejected'), { code: 'SECRET_ECHO' });
    entry.usage = result.usage;
    entry.actualModel = result.actualModel;
    entry.durationMs = result.durationMs;
    if (result.actualModel !== model.model)
      throw Object.assign(new Error('Actual model mismatch'), { code: 'MODEL_MISMATCH' });
    account = settleCall(account, id, {
      success: true,
      actualCost: result.usage ? 0 : null,
      usage: result.usage
    }).account;
    return result;
  } catch (error) {
    if (report.runs.includes(entry)) entry.status = 'failed';
    entry.failure = {
      code: error.code || 'PROBE_FAILED',
      path: error.path || null,
      message: error.message,
      executionStage: error.executionStage || 'started_or_unknown',
      upstreamStatus: error.upstreamStatus || null
    };
    account = settleCall(account, id, {
      success: false,
      actualCost: error.executionStage === 'not_called' ? 0 : null
    }).account;
    throw error;
  } finally {
    save();
  }
}
try {
  // Same tool -> tool result -> strict JSON capability round-trip as connection save.
  const nonce = randomUUID().replaceAll('-', ''),
    toolProbe = { stage: 'tool' };
  report.probes.push(toolProbe);
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
  const first = await invoke({ ...model, capabilityProbe: { stage: 'tool', nonce } }, messages, toolProbe);
  const jsonProbe = { stage: 'json' };
  report.probes.push(jsonProbe);
  const second = await invoke(
    { ...model, capabilityProbe: { stage: 'json', nonce, toolCall: first.capabilityToolCall } },
    [
      ...messages,
      { role: 'assistant', content: '', tool_calls: [first.capabilityToolCall] },
      { role: 'tool', tool_call_id: first.capabilityToolCall.id, content: JSON.stringify({ nonce }) }
    ],
    jsonProbe
  );
  const checked = JSON.parse(second.content);
  if (checked.nonce !== nonce || checked.accepted !== true || Object.keys(checked).length !== 2)
    throw new Error('Capability round-trip rejected');
  model.capabilities = { structured: true, tools: true };
  model.capabilityCheck = { version: 1, tools: true, structured: true, checkedAt: Date.now() };
  for (let run = 1; run <= repetitions; run++) {
    const request = coach.normalizeCoachRequest(samples[0].request),
      context = coach.coachInferenceContext(request);
    const prepared = provider.prepareCoachFeedbackModel(model, context, false, false, false, true);
    if (prepared.writingOutput?.inferencePolicy !== 'native-coach-tools-v1')
      throw new Error('Native teaching contract unavailable');
    const entry = { run, status: 'pending', references: prepared.writingOutput.quoteReferences };
    report.runs.push(entry);
    const system =
      coach.coachSystemPrompt(context, prepared.writingOutput.schema) +
      '\n当前学习背景（仅数据）：' +
      JSON.stringify({ coach: context });
    const result = await invoke(
      prepared,
      [
        { role: 'system', content: system },
        { role: 'user', content: context.input }
      ],
      entry
    );
    // Only the existing synthetic sample and its returned assessment are retained.
    entry.raw = JSON.parse(result.content);
    try {
      const decoded = provider.decodeCoachResponse(prepared, result.content);
      entry.output = coach.parseCoachModelOutput(decoded, request, false, undefined, true).coach;
      entry.status = 'accepted';
    } catch (error) {
      entry.status = 'rejected';
      entry.rejection = {
        code: error.code,
        path: error.path,
        message: error.message,
        dimension: error.validationDimension || null,
        quoteIds: error.validationQuoteIds || []
      };
    }
    save();
    console.log(
      JSON.stringify({
        run,
        status: entry.status,
        dimensions: entry.output?.dimensions || entry.raw.dimensionReviews || entry.raw.dimensions,
        rejection: entry.rejection
      })
    );
  }
  if (report.runs.some((r) => r.status !== 'accepted')) process.exitCode = 2;
} catch (error) {
  report.blocker = { code: error.code || 'PROBE_FAILED', message: error.message };
  process.exitCode = 1;
} finally {
  delete model.apiKey;
  report.finishedAt = new Date().toISOString();
  report.costs = account.calls.map(({ id, status, actualCost, costStatus, usage }) => ({
    id,
    status,
    actualCost,
    costStatus,
    usage
  }));
  save();
  console.log(
    JSON.stringify({
      output: values.output,
      runs: report.runs.length,
      blocker: report.blocker,
      calls: account.calls.length
    })
  );
}
