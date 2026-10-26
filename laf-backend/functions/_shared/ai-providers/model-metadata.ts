import { freeModelPricing } from './free-model-presets.js';

// Candidate transport boundaries only. They are not discovery/credential grants.
export const DISCOVERY_CANDIDATES = Object.freeze({
  deepseek: {
    provider: 'DeepSeek',
    origin: 'https://api.deepseek.com',
    chatPath: '/chat/completions',
    listPath: '/models',
    detailPrefix: null,
    authorization: 'bearer'
  },
  groq: {
    provider: 'Groq',
    origin: 'https://api.groq.com',
    chatPath: '/openai/v1/chat/completions',
    listPath: '/openai/v1/models',
    detailPrefix: '/openai/v1/models/',
    authorization: 'bearer'
  }
});
export type MetadataField = {
  value: any;
  state: 'known' | 'unknown' | 'not_applicable' | 'conflict';
  reason: string;
  sourceRef: string[];
  sourcePath: string | null;
};
export const unknownMetadata = (reason = 'not_returned'): MetadataField => ({
  value: null,
  state: 'unknown',
  reason,
  sourceRef: [],
  sourcePath: null
});
export const metadataFreshness = (source: { expiresAt: number | null }, now: number) =>
  source.expiresAt !== null && Number.isSafeInteger(source.expiresAt) && now < source.expiresAt ? 'fresh' : 'stale';

export type HighestTierRule = {
  model: string;
  endpoint: string;
  approved: boolean;
  highestReasoningLevel: string | null;
  parameter: string | null;
  outputIncludesReasoning: boolean | 'unknown';
  requiresReasoningHistory?: boolean;
  reviewDueAt: number | null;
};
// No per-model highest-tier quotation has been approved. Discovery cannot fill this registry.
export const REVIEWED_HIGHEST_TIERS: readonly HighestTierRule[] = Object.freeze([]);

export function mergeMetadataField(document: MetadataField, observed: MetadataField): MetadataField {
  if (document.state === 'unknown') return observed;
  if (observed.state === 'unknown') return document;
  if (
    document.state !== 'conflict' &&
    document.state === observed.state &&
    JSON.stringify(document.value) === JSON.stringify(observed.value)
  )
    return { ...document, sourceRef: [...new Set([...document.sourceRef, ...observed.sourceRef])] };
  return {
    value: null,
    state: 'conflict',
    reason: 'source_conflict',
    sourceRef: [...new Set([...document.sourceRef, ...observed.sourceRef])],
    sourcePath: null
  };
}

export function evaluateHighestTier(
  rule: HighestTierRule | undefined,
  observed: Record<string, MetadataField>,
  input: {
    now: number;
    requestedOutputTokens: number;
    budgetApproved: boolean;
    sourcesFresh: boolean;
    minimumBodyTokens?: number;
  }
) {
  const denied = (reasonCode: string) => ({ allowed: false, reasonCode });
  if (Object.values(observed).some((field) => field.state === 'conflict')) return denied('METADATA_CONFLICT');
  if (!input.sourcesFresh) return denied('METADATA_STALE');
  if (rule?.requiresReasoningHistory) return denied('PRIVACY_REVIEW_REQUIRED');
  if (!rule?.approved || !rule.highestReasoningLevel || !rule.parameter) return denied('HIGHEST_LEVEL_UNKNOWN');
  if (!Number.isSafeInteger(rule.reviewDueAt) || input.now >= rule.reviewDueAt!) return denied('METADATA_STALE');
  if (rule.outputIncludesReasoning === 'unknown') return denied('OUTPUT_REASONING_UNKNOWN');
  // API declarations can veto a reviewed parameter, but can never generate one.
  for (const [name, expected] of [
    ['supportedParameters', rule.parameter],
    ['reasoningLevels', rule.highestReasoningLevel]
  ]) {
    const field = observed[name];
    if (field?.state === 'known' && (!Array.isArray(field.value) || !field.value.includes(expected)))
      return denied('PARAMETER_UNSUPPORTED');
  }
  const output = observed.maxOutputTokens;
  if (output?.state !== 'known' || !Number.isSafeInteger(output.value) || output.value <= 0)
    return denied('OUTPUT_LIMIT_UNKNOWN');
  const requested = input.requestedOutputTokens;
  if (
    !input.budgetApproved ||
    !Number.isSafeInteger(requested) ||
    requested <= 0 ||
    requested > 2000 ||
    requested > output.value ||
    !freeModelPricing(rule, input.now)
  )
    return denied('BUDGET_OR_FREE_SCOPE_CONFLICT');
  if (rule.outputIncludesReasoning) {
    const reasoning = observed.maxReasoningTokens;
    if (
      reasoning?.state !== 'known' ||
      !Number.isSafeInteger(reasoning.value) ||
      reasoning.value < 0 ||
      !Number.isSafeInteger(input.minimumBodyTokens) ||
      input.minimumBodyTokens! <= 0 ||
      reasoning.value + input.minimumBodyTokens! > requested
    )
      return denied('BUDGET_OR_FREE_SCOPE_CONFLICT');
  }
  return { allowed: true, reasonCode: null };
}
