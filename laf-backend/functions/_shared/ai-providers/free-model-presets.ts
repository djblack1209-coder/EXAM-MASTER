import crypto from 'node:crypto';
import { DEV_TEST } from '../build-channel.js';
import { MODEL_CONNECTION_PRESETS } from './model-endpoints.js';
// 只保存公开接入事实；密钥来自用户保险库，目录存在不代表账户额度可用。
export const FREE_MODEL_PRESETS = MODEL_CONNECTION_PRESETS;
// Only documented native chat routes; output bounds and other profiles stay unchanged.
export function modelInferenceParameters(model: { model: string; endpoint?: string }) {
  if (
    model.model === 'glm-4.7-flash' &&
    ['https://open.bigmodel.cn/api/paas/v4/chat/completions', 'https://api.z.ai/api/paas/v4/chat/completions'].includes(
      model.endpoint || ''
    )
  )
    return { thinking: { type: 'enabled' } };
  if (model.model === 'agnes-2.5-flash' && model.endpoint === 'https://apihub.agnes-ai.com/v1/chat/completions')
    return { chat_template_kwargs: { enable_thinking: true } };
  if (
    (model.model === 'openai/gpt-oss-20b' || (DEV_TEST && model.model === 'openai/gpt-oss-120b')) &&
    model.endpoint === 'https://api.groq.com/openai/v1/chat/completions'
  )
    return {
      reasoning_effort: 'high',
      ...(DEV_TEST && model.model === 'openai/gpt-oss-120b' ? { include_reasoning: false } : {})
    };
  if (
    model.model === 'nvidia/nemotron-3-ultra-550b-a55b:free' &&
    model.endpoint === 'https://openrouter.ai/api/v1/chat/completions'
  )
    return { reasoning: { effort: 'high' } };
  return null;
}
// Exact zero-price routes checked against the provider's public catalog.
// This does not assign a free price to account trials or arbitrary model names.
const REVIEWED_FREE_ROUTES = ['google/gemma-4-26b-a4b-it:free', 'nvidia/nemotron-3-super-120b-a12b:free'];

export function freeModelPricing(model: { model: string; endpoint: string }, now = Date.now()) {
  if (
    model.endpoint === 'https://openrouter.ai/api/v1/chat/completions' &&
    model.model === 'nvidia/nemotron-3-ultra-550b-a55b:free' &&
    now < Date.parse('2026-11-02')
  )
    return { inputPerMillion: 0, outputPerMillion: 0, priceVersion: 'openrouter-nemotron-3-ultra-free-2026-10-30' };
  if (
    model.endpoint === 'https://api.z.ai/api/paas/v4/chat/completions' &&
    model.model === 'glm-4.7-flash' &&
    now < Date.parse('2026-11-29')
  )
    return { inputPerMillion: 0, outputPerMillion: 0, priceVersion: 'zai-glm-4.7-flash-free-2026-10-30' };
  if (
    model.endpoint === 'https://openrouter.ai/api/v1/chat/completions' &&
    REVIEWED_FREE_ROUTES.includes(model.model) &&
    now < Date.parse('2026-11-19')
  )
    return { inputPerMillion: 0, outputPerMillion: 0, priceVersion: 'openrouter-free-routes-2026-10-20' };
  const preset = FREE_MODEL_PRESETS.find(
    (p) => p.pricing === 'official_free_model' && p.model === model.model && p.endpoint === model.endpoint
  );
  if (!preset || !('expiresAt' in preset) || now >= Date.parse(preset.expiresAt)) return null;
  return { inputPerMillion: 0, outputPerMillion: 0, priceVersion: preset.priceVersion };
}

export function modelConfigurationVersion(model: any): string {
  const fields = [
    model.id,
    model.model,
    model.provider,
    model.endpoint,
    model.keyRef || model.apiKey || '',
    model.maxOutput,
    model.capabilities
  ];
  const inference = modelInferenceParameters(model);
  if (inference) fields.push(inference);
  // 无新策略时哈希逐字保持旧定义，旧连接测试与缓存不因升级失效。
  if (model.writingOutput)
    fields.push(
      model.writingOutput.contract,
      model.writingOutput.inferencePolicy,
      model.writingOutput.reasoningEffort,
      model.writingOutput.schemaDigest
    );
  return crypto.createHash('sha256').update(JSON.stringify(fields)).digest('hex');
}
export function modelConnectionState(model: any, calls: any[], now = Date.now()) {
  const configurationVersion = modelConfigurationVersion(model);
  const latestStream = calls
    .filter(
      (c) =>
        c.modelId === model.id &&
        c.model === model.model &&
        (c.connectionVersion || c.configurationVersion) === configurationVersion &&
        c.transport === 'sse-v1' &&
        c.status !== 'reserved'
    )
    .at(-1);
  const streamState = {
    streamStatus:
      model.capabilities?.stream !== true
        ? 'undeclared'
        : !latestStream
          ? 'untested'
          : now - (latestStream.at || 0) > 86400000
            ? 'stale'
            : latestStream.status === 'completed'
              ? 'connected'
              : 'failed',
    lastStreamCheckedAt: latestStream?.at || null
  };
  const latestVision = calls
    .filter(
      (c) =>
        c.modelId === model.id &&
        c.model === model.model &&
        (c.connectionVersion || c.configurationVersion) === configurationVersion &&
        c.inputMode === 'image' &&
        c.status !== 'reserved'
    )
    .at(-1);
  const visionState = {
    visionStatus:
      model.capabilities?.vision !== true || model.visionAdapter !== 'openai-image-url-v1'
        ? 'undeclared'
        : !latestVision
          ? 'untested'
          : now - (latestVision.at || 0) > 86400000
            ? 'stale'
            : latestVision.status === 'completed'
              ? 'connected'
              : 'failed',
    lastVisionCheckedAt: latestVision?.at || null
  };
  const latest = calls
    .filter(
      (c) =>
        c.modelId === model.id &&
        c.model === model.model &&
        (c.connectionVersion || c.configurationVersion) === configurationVersion &&
        c.status !== 'reserved'
    )
    .at(-1);
  if (!latest) {
    const check = model.capabilityCheck;
    if (
      check?.version === 1 &&
      check.tools === true &&
      check.structured === true &&
      Number.isSafeInteger(check.checkedAt)
    )
      return {
        connectionStatus: now - check.checkedAt > 86400000 ? 'stale' : 'connected',
        lastCheckedAt: check.checkedAt,
        ...streamState,
        ...visionState
      };
    return { connectionStatus: 'untested', lastCheckedAt: null, ...streamState, ...visionState };
  }
  const age = now - (latest.at || 0);
  return {
    ...streamState,
    ...visionState,
    connectionStatus: age > 86400000 ? 'stale' : latest.status === 'completed' ? 'connected' : 'failed',
    lastCheckedAt: latest.at,
    lastError: latest.connectionError || latest.errorCode || null
  };
}
