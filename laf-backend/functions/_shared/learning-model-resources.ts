import crypto from 'node:crypto';

export type ModelResultPolicy = {
  version: string;
  ttlMs: number;
  maxEntries: number;
  maxBytes: number;
  maxResultBytes: number;
};
const defaults: ModelResultPolicy = {
  version: 'model-result-cache-v1',
  ttlMs: 86400000,
  maxEntries: 32,
  maxBytes: 1048576,
  maxResultBytes: 131072
};
export const MODEL_USAGE_MAX_BYTES = 4096;
export const MODEL_ACCOUNT_RESERVE_MAX_BYTES = 7 * 1048576;

// 服务端资源配置，不是销售权益；失效配置在调用前拒绝，不降为无限缓存。
export function modelResultPolicy(raw = process.env.LEARNING_MODEL_RESULT_CACHE || ''): ModelResultPolicy {
  let input: any;
  try {
    input = raw ? JSON.parse(raw) : {};
  } catch {
    throw Object.assign(new Error('模型结果缓存配置不合法'), { code: 'POLICY_INVALID' });
  }
  const valid = input && typeof input === 'object' && !Array.isArray(input);
  const limits = {
    ttlMs: [60000, 604800000],
    maxEntries: [1, 100],
    maxBytes: [1024, 4194304],
    maxResultBytes: [1024, 262144]
  };
  if (!valid || Object.keys(input).some((key) => !Object.hasOwn(limits, key)))
    throw Object.assign(new Error('模型结果缓存配置不合法'), { code: 'POLICY_INVALID' });
  const policy = { ...defaults, ...input };
  if (
    Object.entries(limits).some(
      ([key, [min, max]]) => !Number.isSafeInteger(policy[key]) || policy[key] < min || policy[key] > max
    ) ||
    policy.maxResultBytes > policy.maxBytes
  )
    throw Object.assign(new Error('模型结果缓存配置超出资源边界'), { code: 'POLICY_INVALID' });
  return policy;
}
function encoded(value: any) {
  try {
    const text = JSON.stringify(value);
    return typeof text === 'string' ? text : null;
  } catch {
    return null;
  }
}
export function modelResourceBytes(value: any) {
  const text = encoded(value);
  return text === null ? Infinity : Buffer.byteLength(text);
}
const tokenFields = ['prompt_tokens', 'completion_tokens', 'total_tokens'];
const detailFields: Record<string, string[]> = {
  prompt_tokens_details: ['cached_tokens', 'audio_tokens'],
  completion_tokens_details: [
    'reasoning_tokens',
    'audio_tokens',
    'accepted_prediction_tokens',
    'rejected_prediction_tokens'
  ]
};
const token = (value: any) => Number.isSafeInteger(value) && value >= 0;
// 未适配的账单字段不能被遗漏后结算成零；只有已知文本计费结构可定价。
export function supportedBillingUsage(usage: any) {
  if (!usage || typeof usage !== 'object' || Array.isArray(usage) || modelResourceBytes(usage) > MODEL_USAGE_MAX_BYTES)
    return false;
  if (!token(usage.prompt_tokens) || !token(usage.completion_tokens)) return false;
  for (const [key, value] of Object.entries(usage)) {
    if (tokenFields.includes(key)) {
      if (!token(value)) return false;
    } else if (Object.hasOwn(detailFields, key)) {
      if (value === null) continue;
      if (typeof value !== 'object' || Array.isArray(value)) return false;
      for (const [name, count] of Object.entries(value)) {
        if (!detailFields[key].includes(name) || !token(count) || (name === 'audio_tokens' && count !== 0))
          return false;
      }
    } else return false;
  }
  return true;
}
// 正常账单完整保留；异常大账单只保留已知数值、摘要与待复核标记，绝不保存截断正文。
export function boundedModelUsage(usage: any) {
  if (usage === null || usage === undefined)
    return { usage: null, evidence: { status: 'missing', bytes: 0, truncated: false } };
  const text = encoded(usage),
    bytes = text === null ? null : Buffer.byteLength(text);
  const valid = usage && typeof usage === 'object' && !Array.isArray(usage) && bytes !== null;
  const truncated = !valid || bytes! > MODEL_USAGE_MAX_BYTES;
  const safe: any = {};
  if (valid && truncated) {
    for (const key of tokenFields) if (token(usage[key])) safe[key] = usage[key];
    for (const [key, fields] of Object.entries(detailFields)) {
      const detail: any = {};
      for (const name of fields) if (token(usage[key]?.[name])) detail[name] = usage[key][name];
      if (Object.keys(detail).length) safe[key] = detail;
    }
  }
  return {
    usage: truncated ? safe : structuredClone(usage),
    evidence: {
      status: truncated ? 'truncated' : supportedBillingUsage(usage) ? 'complete' : 'unsupported',
      bytes,
      truncated,
      ...(text !== null ? { sha256: crypto.createHash('sha256').update(text).digest('hex') } : {})
    }
  };
}
export function modelResultState(call: any, now = Date.now(), policy = modelResultPolicy()) {
  if (call.resultDeletedAt) return 'deleted';
  if (call.resultReleasedReason) return call.resultReleasedReason;
  if (!call.result) return 'unavailable';
  const expiry = Math.min(call.resultExpiresAt ?? Infinity, (call.resultCachedAt ?? call.at) + policy.ttlMs);
  if (!Number.isFinite(expiry) || now >= expiry) return 'expired';
  if (modelResourceBytes(call.result) > policy.maxResultBytes) return 'oversize';
  return 'available';
}
export function maintainModelResources(account: any, now = Date.now(), policy = modelResultPolicy()) {
  const result = structuredClone(account);
  let changed = false;
  const release = (call: any, reason: string) => {
    call.result = null;
    call.resultReleasedAt = now;
    call.resultReleasedReason = reason;
    changed = true;
  };
  const retained: { call: any; bytes: number }[] = [];
  for (const call of result.calls) {
    if (call.usage && (!call.usageEvidence || modelResourceBytes(call.usage) > MODEL_USAGE_MAX_BYTES)) {
      const bounded = boundedModelUsage(call.usage);
      call.usage = bounded.usage;
      call.usageEvidence = bounded.evidence;
      changed = true;
    }
    if (!call.result) continue;
    const state = modelResultState(call, now, policy);
    if (state !== 'available') release(call, state);
    else retained.push({ call, bytes: modelResourceBytes(call.result) });
  }
  retained.reverse().sort((a, b) => (b.call.resultCachedAt ?? b.call.at) - (a.call.resultCachedAt ?? a.call.at));
  let bytes = 0,
    entries = 0;
  for (const item of retained) {
    if (entries >= policy.maxEntries || bytes + item.bytes > policy.maxBytes) release(item.call, 'capacity');
    else {
      bytes += item.bytes;
      entries++;
    }
  }
  return {
    account: changed ? result : account,
    reused: !changed,
    cache: { policy, entries, bytes, expiryEnforcement: 'on_access' }
  };
}
export function modelResultUnavailable(call: any, now = Date.now(), policy = modelResultPolicy()) {
  const state = modelResultState(call, now, policy);
  if (state === 'available') return null;
  return {
    code: 410,
    success: false as const,
    error: state === 'deleted' ? 'MODEL_RESULT_DELETED' : 'MODEL_RESULT_UNAVAILABLE',
    cacheStatus: state,
    message:
      state === 'deleted'
        ? '私人教学结果已删除，费用事实仍保留；不会重新调用模型'
        : '原教学缓存已过期、超出容量或不可用，费用事实仍保留；不会重新生成或扣量，可查看已保存对话'
  };
}
