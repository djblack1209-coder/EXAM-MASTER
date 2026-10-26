import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { freeModelPricing } from '../../laf-backend/functions/_shared/ai-providers/free-model-presets';
const { seedFreeModels, seedCallReceipt, FREE_SEED_CHOICES, FREE_SEED_ORIGINS } = createRequire(import.meta.url)(
  '../../scripts/build/seed-dev-test-models.mjs'
);
const env = {
  NODE_ENV: 'test',
  YOZI_BUILD_CHANNEL: 'test',
  HOST: '127.0.0.1',
  DB_NAME: 'yozi_dev_test',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/yozi_dev_test',
  PORT: '4382'
};
const endpoints = {
  zai: 'https://api.z.ai/api/paas/v4/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  agnes: 'https://apihub.agnes-ai.com/v1/chat/completions',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
};
function fixture({ failures = {}, pending = false, lostResponse = false, saveForbidden = false } = {}) {
  const profiles = new Map(),
    calls = [];
  const catalog = FREE_SEED_CHOICES.map((choice) => ({
    id: choice.providerId,
    provider: choice.providerId,
    status: 'verified',
    baseMatchesOfficial: true,
    credentialAvailable: true,
    endpoint: endpoints[choice.providerId],
    baseURL: endpoints[choice.providerId].replace('/chat/completions', ''),
    models: [choice.model]
  }));
  const readAccount = vi.fn(() => ({ token: 'unit-private-token' }));
  const readCredential = vi.fn(() => 'unit-private-provider-key');
  const pricing = vi.fn(({ endpoint, model }) =>
    FREE_SEED_CHOICES.some((choice) => endpoints[choice.providerId] === endpoint && choice.model === model)
      ? { inputPerMillion: 0, outputPerMillion: 0 }
      : null
  );
  const fetchImpl = vi.fn(async (_url, options) => {
    const body = JSON.parse(options.body);
    let result;
    if (body.action === 'list') result = { code: 0, data: { models: [...profiles.values()] } };
    if (body.action === 'save') {
      if (saveForbidden && body.profile.id === 'dev-agnes-byok')
        result = { code: 503, success: false, error: 'ENDPOINT_FORBIDDEN' };
      else {
        profiles.set(body.profile.id, { ...body.profile, configured: true });
        result = { success: true, data: { keySaved: true } };
      }
    }
    if (body.action === 'test') {
      const classification = failures[body.modelId];
      const isPending = pending && body.modelId === 'dev-openrouter-byok';
      calls.push({
        id: body.requestId,
        source: 'byok',
        status: isPending ? 'reserved' : classification ? 'failed' : 'completed',
        actualCost: classification || isPending ? null : 0,
        executionStage: 'provider_called'
      });
      if (lostResponse && body.modelId === 'dev-openrouter-byok')
        throw Object.assign(new Error(), { code: 'ETIMEDOUT' });
      result =
        classification || isPending
          ? {
              code: classification === 'RATE_LIMITED' ? 429 : 503,
              success: false,
              connectionError: classification || 'TIMEOUT',
              status: isPending ? 'reserved' : 'failed'
            }
          : { code: 0, success: true, data: { requestId: body.requestId } };
    }
    if (body.action === 'result')
      result = pending
        ? { code: 409, success: false, status: 'reserved' }
        : { code: 0, data: { requestId: body.requestId } };
    if (body.action === 'delete') {
      profiles.delete(body.profileId);
      result = { code: 0, data: { removed: true } };
    }
    if (body.action === 'preferences') result = { code: 0, data: body.preferences };
    if (body.action === 'usage') result = { code: 0, data: { calls } };
    if (!result) throw new Error('UNEXPECTED_UNIT_REQUEST');
    return { ok: true, status: 200, json: async () => result };
  });
  return {
    profiles,
    calls,
    catalog,
    readCredential,
    pricing,
    readAccount,
    fetchImpl,
    args: {
      env,
      accountFile: 'unused-private-fixture.json',
      readAccount,
      readCredential,
      pricing,
      readCatalog: () => catalog,
      fetchImpl
    }
  };
}
const bodies = (mock, action) =>
  mock.mock.calls.map(([, options]) => JSON.parse(options.body)).filter((body) => body.action === action);
beforeEach(() =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('REAL_NETWORK_FORBIDDEN');
    })
  )
);
afterEach(() => {
  expect(globalThis.fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe('reviewed free-provider seeding', () => {
  it.each([
    ['missing', 'MISSING_USAGE'],
    ['unsupported', 'UNSUPPORTED_USAGE'],
    ['truncated', 'TRUNCATED_USAGE'],
    ['complete', 'AWAITING_COST_RECEIPT'],
    ['private-provider-text', 'AWAITING_COST_RECEIPT']
  ])('reports bounded pending-cost evidence %s without publishing raw usage', (status, costReason) => {
    const receipt = seedCallReceipt({
      id: 'seed_agnes_unit',
      status: 'completed',
      actualCost: null,
      usage: { private_text: 'private-provider-text', key: 'synthetic-secret' },
      usageEvidence: { status, sha256: 'private-hash' }
    });
    expect(receipt).toMatchObject({ actualCost: null, costReason });
    expect(JSON.stringify(receipt)).not.toMatch(/private-provider-text|synthetic-secret|private-hash/);
  });
  it('keeps reservations pending and preserves real zero settlements without recalculating history', () => {
    expect(seedCallReceipt({ status: 'reserved', actualCost: null }).costReason).toBe('REQUEST_PENDING');
    expect(seedCallReceipt({ actualCost: 0 })).toMatchObject({ actualCost: 0, costReason: 'SETTLED' });
  });
  it('tries distinct model IDs in the reviewed provider order', () => {
    expect(FREE_SEED_CHOICES.map((choice) => choice.providerId)).toEqual(['openrouter', 'agnes', 'zai', 'zhipu']);
    expect(new Set(FREE_SEED_CHOICES.map((choice) => choice.model)).size).toBe(FREE_SEED_CHOICES.length);
  });
  it('restricts every candidate to the existing exact zero-price policy and its expiry', () => {
    expect(new Set(FREE_SEED_ORIGINS)).toEqual(
      new Set(Object.values(endpoints).map((endpoint) => new URL(endpoint).origin))
    );
    for (const choice of FREE_SEED_CHOICES) {
      const model = { model: choice.model, endpoint: endpoints[choice.providerId] };
      expect(freeModelPricing(model, Date.parse('2026-10-26'))).toMatchObject({
        inputPerMillion: 0,
        outputPerMillion: 0
      });
      expect(freeModelPricing(model, Date.parse('2026-11-20'))).toBeNull();
      expect(freeModelPricing({ ...model, model: 'unreviewed-paid-alias' }, Date.parse('2026-10-26'))).toBeNull();
    }
  });
  it('continues after a limited provider, gets two distinct alternatives and keeps the failed cost unknown', async () => {
    const f = fixture({ failures: { 'dev-openrouter-byok': 'RATE_LIMITED' } });
    const report = await seedFreeModels(f.args);
    expect(report.success).toBe(true);
    expect(report.connections.map((item) => item.providerId)).toEqual(['agnes', 'zai']);
    expect(report.selectedModelId).toBe('dev-agnes-byok');
    expect(report.attempts.map((item) => item.classification)).toEqual(['RATE_LIMITED', 'CONNECTED', 'CONNECTED']);
    expect(report).toMatchObject({ providerCalls: 3, actualCost: null, pendingCosts: 1 });
    expect(report.attempts[0].receipts[0]).toMatchObject({ status: 'failed', actualCost: null });
    expect(f.profiles.has('dev-openrouter-byok')).toBe(false);
    expect(bodies(f.fetchImpl, 'test')).toHaveLength(3);
    expect(JSON.stringify(report)).not.toMatch(/unit-private/);
  });
  it('stops after two providers, rather than counting two models of one provider', async () => {
    const f = fixture();
    const report = await seedFreeModels(f.args);
    expect(report.success).toBe(true);
    expect(report.connections.map((item) => item.providerId)).toEqual(['openrouter', 'agnes']);
    expect(report.selectedModelId).toBe('dev-agnes-byok');
    expect(report.attempts).toHaveLength(2);
    expect(report.providerCalls).toBe(2);
    expect(report.actualCost).toBe(0);
    expect(bodies(f.fetchImpl, 'test')).toHaveLength(2);
  });
  it('queries a pending original request once, keeps its profile and tries the other free providers', async () => {
    const f = fixture({ pending: true });
    const report = await seedFreeModels(f.args);
    expect(report.success).toBe(true);
    expect(report.attempts[0]).toMatchObject({ classification: 'TIMEOUT', requestPending: true });
    expect(f.profiles.has('dev-openrouter-byok')).toBe(true);
    expect(bodies(f.fetchImpl, 'result')).toHaveLength(1);
    expect(bodies(f.fetchImpl, 'test').filter((body) => body.modelId === 'dev-openrouter-byok')).toHaveLength(1);
    expect(report.actualCost).toBeNull();
  });
  it('recovers a lost response by its original request id without another provider call', async () => {
    const f = fixture({ lostResponse: true });
    const report = await seedFreeModels(f.args);
    expect(report.success).toBe(true);
    const tests = bodies(f.fetchImpl, 'test'),
      queries = bodies(f.fetchImpl, 'result');
    expect(queries).toHaveLength(1);
    expect(queries[0].requestId).toBe(tests[0].requestId);
    expect(tests).toHaveLength(2);
  });
  it.each(['MODEL_UNAVAILABLE', 'SERVICE_UNAVAILABLE', 'KEY_INVALID'])(
    'records %s and tries the next reviewed free provider',
    async (classification) => {
      const f = fixture({ failures: { 'dev-openrouter-byok': classification } });
      const report = await seedFreeModels(f.args);
      expect(report.success).toBe(true);
      expect(report.attempts[0].classification).toBe(classification);
      expect(report.connections.map((item) => item.providerId)).toEqual(['agnes', 'zai']);
    }
  );
  it('reports an exhausted shortlist and an endpoint rejection without changing the server allowlist', async () => {
    const f = fixture({
      failures: { 'dev-openrouter-byok': 'RATE_LIMITED', 'dev-zhipu-byok': 'MODEL_UNAVAILABLE' },
      saveForbidden: true
    });
    const report = await seedFreeModels(f.args);
    expect(report.success).toBe(false);
    expect(report.error).toBe('INSUFFICIENT_FREE_PROVIDERS');
    expect(report.attempts.map((item) => item.classification)).toEqual([
      'RATE_LIMITED',
      'ENDPOINT_FORBIDDEN',
      'CONNECTED',
      'MODEL_UNAVAILABLE'
    ]);
    expect(report.connections).toHaveLength(1);
  });
  it.each(['unverified', 'credential-missing', 'unofficial', 'unpriced', 'expired'])(
    'skips %s candidates before reading credentials or calling models',
    async (kind) => {
      const f = fixture();
      for (const row of f.catalog) {
        if (kind === 'unverified') row.status = 'unknown';
        if (kind === 'credential-missing') row.credentialAvailable = false;
        if (kind === 'unofficial') row.baseMatchesOfficial = false;
      }
      if (['unpriced', 'expired'].includes(kind)) f.args.pricing = () => null;
      const report = await seedFreeModels(f.args);
      expect(report.success).toBe(false);
      expect(report.attempts.every((item) => item.classification === 'NO_REVIEWED_FREE_ROUTE')).toBe(true);
      expect(f.readCredential).not.toHaveBeenCalled();
      expect(bodies(f.fetchImpl, 'test')).toHaveLength(0);
      expect(report.providerCalls).toBe(0);
    }
  );
  it('keeps a pre-existing incompatible profile and never overwrites its key', async () => {
    const f = fixture();
    f.profiles.set('dev-openrouter-byok', {
      id: 'dev-openrouter-byok',
      configured: true,
      model: 'different-model',
      endpoint: endpoints.openrouter
    });
    const report = await seedFreeModels(f.args);
    expect(report.success).toBe(true);
    expect(report.attempts[0].classification).toBe('EXISTING_PROFILE_MISMATCH');
    expect(f.profiles.get('dev-openrouter-byok').model).toBe('different-model');
    expect(bodies(f.fetchImpl, 'save').some((body) => body.profile.id === 'dev-openrouter-byok')).toBe(false);
  });
  it('refuses production before reading any account or issuing requests', async () => {
    const f = fixture();
    await expect(seedFreeModels({ ...f.args, env: { ...env, NODE_ENV: 'production' } })).rejects.toThrow(
      'DEV_TEST_ONLY'
    );
    expect(f.readAccount).not.toHaveBeenCalled();
    expect(f.fetchImpl).not.toHaveBeenCalled();
  });
  it('stops on a QA permission refusal without querying or trying another provider', async () => {
    const f = fixture();
    const normal = f.args.fetchImpl;
    f.args.fetchImpl = vi.fn((url, options) => {
      if (JSON.parse(options.body).action === 'test') throw Object.assign(new Error(), { code: 'EPERM' });
      return normal(url, options);
    });
    const report = await seedFreeModels(f.args);
    expect(report.success).toBe(false);
    expect(report.error).toBe('EPERM');
    expect(report.attempts).toHaveLength(1);
    expect(report.attempts[0].classification).toBe('EPERM');
    expect(bodies(f.args.fetchImpl, 'result')).toHaveLength(0);
  });
  it('keeps missing receipts unknown instead of treating an unobserved call as free', async () => {
    const f = fixture();
    const normal = f.args.fetchImpl;
    f.args.fetchImpl = (url, options) =>
      JSON.parse(options.body).action === 'usage'
        ? Promise.resolve({ ok: true, status: 200, json: async () => ({ code: 0, data: { calls: [] } }) })
        : normal(url, options);
    const report = await seedFreeModels(f.args);
    expect(report.success).toBe(true);
    expect(report).toMatchObject({ providerCalls: null, actualCost: null, pendingCosts: null });
    expect(report.attempts.every((attempt) => attempt.receiptUnverified)).toBe(true);
  });
  it('does not accept a successful JSON body over an HTTP failure without querying the original request', async () => {
    const f = fixture();
    const normal = f.args.fetchImpl;
    f.args.fetchImpl = async (url, options) => {
      const response = await normal(url, options),
        body = JSON.parse(options.body);
      return body.action === 'test' && body.modelId === 'dev-openrouter-byok'
        ? { ...response, ok: false, status: 500 }
        : response;
    };
    const report = await seedFreeModels(f.args);
    expect(report.success).toBe(true);
    expect(bodies(f.fetchImpl, 'result')).toHaveLength(1);
    expect(bodies(f.fetchImpl, 'test')).toHaveLength(2);
  });
});
