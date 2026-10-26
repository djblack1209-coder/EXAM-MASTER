import { describe, expect, it } from 'vitest';
import {
  DISCOVERY_CANDIDATES,
  REVIEWED_HIGHEST_TIERS,
  evaluateHighestTier,
  metadataFreshness,
  mergeMetadataField,
  unknownMetadata,
  type HighestTierRule
} from '../../laf-backend/functions/_shared/ai-providers/model-metadata';
import { MODEL_CONNECTION_PRESETS } from '../../laf-backend/functions/_shared/ai-providers/model-endpoints.js';
import { freeModelPricing } from '../../laf-backend/functions/_shared/ai-providers/free-model-presets';
const NOW = Date.UTC(2026, 9, 24);
const known = (value: any, source = 'fixture-document') => ({
  value,
  state: 'known' as const,
  reason: 'documented',
  sourceRef: [source],
  sourcePath: 'fixture'
});
const observed = {
  maxOutputTokens: known(10000),
  maxReasoningTokens: known(200),
  supportedParameters: known(['fixture_effort']),
  reasoningLevels: known(['fixture-highest'])
};
const rule: HighestTierRule = {
  model: 'google/gemma-4-26b-a4b-it:free',
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  approved: true,
  highestReasoningLevel: 'fixture-highest',
  parameter: 'fixture_effort',
  outputIncludesReasoning: false,
  reviewDueAt: NOW + 10000
};
const input = { now: NOW, requestedOutputTokens: 1000, budgetApproved: true, sourcesFresh: true };
describe('发现元数据与最高档离线纯合同', () => {
  it('当前目录没有获批最高档，API能力不能生成映射或改变免费判定', () => {
    expect(Object.keys(DISCOVERY_CANDIDATES)).toEqual(['deepseek', 'groq']);
    expect(REVIEWED_HIGHEST_TIERS).toEqual([]);
    for (const preset of MODEL_CONNECTION_PRESETS) {
      const before = freeModelPricing(preset, NOW);
      expect(evaluateHighestTier(undefined, observed, input)).toEqual({
        allowed: false,
        reasonCode: 'HIGHEST_LEVEL_UNKNOWN'
      });
      expect(freeModelPricing(preset, NOW)).toEqual(before);
    }
  });
  it('来源无序，冲突保留双方，新鲜度独立于字段state', () => {
    const a = known(100, 'document'),
      b = known(200, 'api');
    const merged = mergeMetadataField(a, b);
    expect(merged.state).toBe('conflict');
    expect(merged.sourceRef).toEqual(['document', 'api']);
    expect(evaluateHighestTier(rule, { ...observed, maxOutputTokens: merged }, input).reasonCode).toBe(
      'METADATA_CONFLICT'
    );
    expect(metadataFreshness({ expiresAt: NOW }, NOW)).toBe('stale');
    expect(a.state).toBe('known');
    expect(unknownMetadata().value).toBeNull();
    expect(evaluateHighestTier(rule, observed, { ...input, sourcesFresh: false }).reasonCode).toBe('METADATA_STALE');
  });
  it('未核推理计入、隐私协议和未定正文余量均拒绝', () => {
    expect(evaluateHighestTier({ ...rule, outputIncludesReasoning: 'unknown' }, observed, input).reasonCode).toBe(
      'OUTPUT_REASONING_UNKNOWN'
    );
    expect(evaluateHighestTier({ ...rule, requiresReasoningHistory: true }, observed, input).reasonCode).toBe(
      'PRIVACY_REVIEW_REQUIRED'
    );
    expect(evaluateHighestTier({ ...rule, outputIncludesReasoning: true }, observed, input).allowed).toBe(false);
    expect(
      evaluateHighestTier({ ...rule, outputIncludesReasoning: true }, observed, { ...input, minimumBodyTokens: 100 })
    ).toEqual({ allowed: true, reasonCode: null });
  });
  it('API只可否决参数，预算／免费冲突不降档或改输入', () => {
    const before = JSON.stringify({ rule, observed, input });
    expect(evaluateHighestTier(rule, { ...observed, supportedParameters: known([]) }, input).reasonCode).toBe(
      'PARAMETER_UNSUPPORTED'
    );
    for (const change of [{ requestedOutputTokens: 2001 }, { budgetApproved: false }])
      expect(evaluateHighestTier(rule, observed, { ...input, ...change }).reasonCode).toBe(
        'BUDGET_OR_FREE_SCOPE_CONFLICT'
      );
    expect(evaluateHighestTier({ ...rule, model: 'unknown-fixture' }, observed, input).reasonCode).toBe(
      'BUDGET_OR_FREE_SCOPE_CONFLICT'
    );
    expect(JSON.stringify({ rule, observed, input })).toBe(before);
  });
});
