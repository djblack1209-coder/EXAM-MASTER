import crypto from 'node:crypto';
import { MODEL_CONNECTION_PRESETS } from './model-endpoints.js';
// 只保存公开接入事实；密钥来自用户保险库，目录存在不代表账户额度可用。
export const FREE_MODEL_PRESETS = MODEL_CONNECTION_PRESETS;

export function freeModelPricing(model: { model: string; endpoint: string }, now = Date.now()) {
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
        c.configurationVersion === configurationVersion &&
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
        c.configurationVersion === configurationVersion &&
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
        c.configurationVersion === configurationVersion &&
        c.status !== 'reserved'
    )
    .at(-1);
  if (!latest) return { connectionStatus: 'untested', lastCheckedAt: null, ...streamState, ...visionState };
  const age = now - (latest.at || 0);
  return {
    ...streamState,
    ...visionState,
    connectionStatus: age > 86400000 ? 'stale' : latest.status === 'completed' ? 'connected' : 'failed',
    lastCheckedAt: latest.at,
    lastError: latest.errorCode || null
  };
}
