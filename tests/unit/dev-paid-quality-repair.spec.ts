import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  mixedDiagnosticRequest,
  mixedDiagnosticReply,
  mixedDiagnosticVerification
} from '../fixtures/writing-mixed.js';

// 开发付费兜底只在 dev/test 构建出现：免费模型原答与返修都未通过教学校验后，同一请求由 DeepSeek 质量型号再答一次（:repair2）。
const mock = vi.hoisted(() => ({ rows: new Map(), users: new Map() }));
vi.mock('../../laf-backend/functions/_shared/build-channel', () => ({ DEV_TEST: true }));
vi.mock('@lafjs/cloud', () => ({
  default: {
    res: undefined,
    database: () => ({
      collection: (name: string) => ({
        add: async (row: any) => {
          const id = `${name}:${row._id}`;
          if (mock.rows.has(id)) throw { code: 11000 };
          mock.rows.set(id, structuredClone(row));
        },
        where: (query: any) => {
          const matches = () =>
            [...new Map([...(name === 'users' ? mock.users.entries() : []), ...mock.rows.entries()]).entries()].filter(
              ([id, row]: any) =>
                id.startsWith(`${name}:`) && Object.entries(query).every(([k, value]) => row[k] === value)
            );
          return {
            get: async () => ({ data: matches().map(([, row]) => structuredClone(row)) }),
            update: async (next: any) => {
              const rows = matches();
              rows.forEach(([id, row]: any) => mock.rows.set(id, { ...row, ...structuredClone(next) }));
              return { updated: rows.length };
            },
            remove: async () => {
              const rows = matches();
              rows.forEach(([id]) => mock.rows.delete(id));
              return { deleted: rows.length };
            }
          };
        }
      })
    })
  }
}));
vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  unauthorized: (message: string) => ({ code: 401, success: false, message }),
  checkRateLimitDistributed: vi.fn(async () => ({ allowed: true }))
}));
vi.mock('../../laf-backend/functions/_shared/ai-providers/learning-provider', async (original) => ({
  ...(await original<any>()),
  callStreamingLearningProvider: vi.fn(),
  callCapabilityProvider: vi.fn(async (config: any) => {
    const probe = config.capabilityProbe;
    return {
      content: JSON.stringify(probe.stage === 'tool' ? { nonce: probe.nonce } : { nonce: probe.nonce, accepted: true }),
      ...(probe.stage === 'tool'
        ? {
            capabilityToolCall: {
              id: 'synthetic_capability_call',
              type: 'function',
              function: { name: 'yozi_capability_echo', arguments: JSON.stringify({ nonce: probe.nonce }) }
            }
          }
        : {}),
      actualModel: config.model,
      usage: { prompt_tokens: 1, completion_tokens: 1 },
      durationMs: 1
    };
  }),
  callLearningProvider: vi.fn()
}));
const { default: models } = await import('../../laf-backend/functions/learning-models');
const { default: ai } = await import('../../laf-backend/functions/proxy-ai');
const { DEV_PAID_FALLBACK_FILE } = await import('../../laf-backend/functions/_shared/ai-providers/dev-paid-fallback');
const { callLearningProvider, ProviderError } =
  await import('../../laf-backend/functions/_shared/ai-providers/learning-provider');

const PAID_KEY = 'synthetic-paid-key-secret';
const context = (body: any) => {
  const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId: 'u1', exp: Math.floor(Date.now() / 1000) + 60 })).toString(
    'base64url'
  );
  const signature = crypto
    .createHmac('sha256', 'test-only-jwt-secret')
    .update(`${header}.${payload}`)
    .digest('base64url');
  return { headers: { authorization: `Bearer ${header}.${payload}.${signature}` }, body };
};
const completed = {
  actualModel: 'explicit-test-id',
  usage: { prompt_tokens: 4, completion_tokens: 8 },
  usageComplete: true,
  durationMs: 2,
  finishReason: 'tool_calls',
  coachFunctionResult: true
};
const reply = (config: any, valid: boolean) => {
  const wire = mixedDiagnosticReply(config);
  if (!valid) wire.dimensionReviews.grammar = { score: 1, comment: '重复归因', evidenceIds: ['q2'] } as any;
  return {
    ...completed,
    actualModel: config.model,
    finishReason: config.writingOutput?.inferencePolicy === 'native-coach-json-v1' ? 'stop' : 'tool_calls',
    coachFunctionResult: config.writingOutput?.inferencePolicy === 'native-coach-json-v1' ? undefined : true,
    content: JSON.stringify(wire)
  };
};
// 免费作答依次返回 answers 里的结果；兜底作答一律合格；盲填与全部句法题独立复核。
function provider(answers: Array<'valid' | 'invalid' | 'limited'>) {
  const seen: string[] = [];
  vi.mocked(callLearningProvider).mockImplementation(async (config: any) => {
    if (config.writingOutput?.contract === 'writing-error-verification-v2')
      return {
        ...completed,
        actualModel: config.model,
        content: JSON.stringify(mixedDiagnosticVerification())
      };
    seen.push(config.devPaidFallback ? config.model : 'free');
    if (config.devPaidFallback) return reply(config, config.model === 'deepseek-v4-pro');
    const answer = answers.shift();
    if (answer === 'limited') throw new ProviderError('RATE_LIMITED', 'synthetic limit');
    return reply(config, answer === 'valid');
  });
  return seen;
}
const ledger = () => [...mock.rows.values()].find((row: any) => row.user_id === 'u1' && row.calls) as any;
const body = (id: string) => ({
  requestId: id,
  requestBinding: 'binding_fixture_only',
  modelId: 'fixture-stream',
  shareConsent: true,
  messages: [{ role: 'user', content: '理解函数' }],
  learningContext: { owner: 'u1', coach: mixedDiagnosticRequest() }
});

let dir: string;
beforeEach(async () => {
  mock.rows.clear();
  mock.users.clear();
  mock.users.set('users:u1', { _id: 'u1', status: 'active' });
  vi.clearAllMocks();
  vi.stubEnv('JWT_SECRET', 'test-only-jwt-secret');
  vi.stubEnv('LEARNING_VAULT_KEY', 'a'.repeat(64));
  vi.stubEnv('LEARNING_ALLOWED_ORIGINS', 'https://provider.example');
  vi.stubEnv('LEARNING_PLATFORM_MODELS', '[]');
  vi.stubEnv('LEARNING_PLATFORM_CALLS_ENABLED', 'false');
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yozi-quality-'));
  const file = path.join(dir, 'paid.env');
  fs.writeFileSync(file, `DEEPSEEK_API_KEY=${PAID_KEY}\n`, { mode: 0o600 });
  vi.stubEnv(DEV_PAID_FALLBACK_FILE, file);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  const saved = await models(
    context({
      action: 'save',
      shareConsent: true,
      profile: {
        id: 'fixture-stream',
        model: 'explicit-test-id',
        apiKey: 'fixture-only-stream-key',
        endpoint: 'https://provider.example/chat',
        stream: false
      }
    })
  );
  expect(saved.success).toBe(true);
  const account = ledger();
  account.calls = account.calls.filter((call: any) => !call.id.startsWith('save_'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

it.each(['valid', 'secret-echo', 'wrong-model', 'unfinished'])(
  '免费复核限流后仅开发兜底核对，来源与待结算费用保留：%s',
  async (mode) => {
    vi.stubEnv('LEARNING_ALLOWED_ORIGINS', 'https://provider.example,https://apihub.agnes-ai.com');
    expect(
      (
        await models(
          context({
            action: 'save',
            shareConsent: true,
            profile: {
              id: 'fixture-stream',
              provider: 'Agnes AI',
              model: 'agnes-3.0-flash',
              endpoint: 'https://apihub.agnes-ai.com/v1/chat/completions',
              apiKey: 'fixture-only-stream-key'
            }
          })
        )
      ).success
    ).toBe(true);
    ledger().calls = [];
    vi.mocked(callLearningProvider).mockImplementation(async (config: any) => {
      if (config.writingOutput?.contract === 'writing-error-verification-v2') {
        if (!config.devPaidFallback) throw new ProviderError('RATE_LIMITED', 'synthetic free verification limit');
        return {
          ...completed,
          finishReason: mode === 'unfinished' ? 'length' : 'stop',
          coachFunctionResult: undefined,
          actualModel: mode === 'wrong-model' ? 'unselected-model' : config.model,
          content:
            mode === 'secret-echo' ? JSON.stringify({ echo: PAID_KEY }) : JSON.stringify(mixedDiagnosticVerification())
        };
      }
      return reply(config, true);
    });
    const result = await ai(context(body('verification-fallback-' + mode)));
    expect(callLearningProvider).toHaveBeenCalledTimes(mode === 'unfinished' ? 5 : 3);
    expect(ledger().calls).toHaveLength(1);
    expect(ledger().calls[0]).toMatchObject({ actualCost: null, costStatus: 'pending' });
    if (mode === 'valid') {
      expect(result).toMatchObject({
        success: true,
        data: {
          model: 'agnes-3.0-flash',
          usageStatus: 'pending',
          coachVerification: { status: 'completed', sources: [{ model: 'deepseek-flash', paidFallback: true }] }
        }
      });
      expect(ledger().calls[0].usage.verification).toMatchObject({ prompt_tokens: 4, completion_tokens: 8 });
    } else {
      expect(result.success).toBe(false);
      expect(result).not.toHaveProperty('data.coach');
      expect(ledger().calls[0]).toMatchObject({ status: 'failed', result: null });
    }
    expect(JSON.stringify(ledger())).not.toContain(PAID_KEY);
  }
);

it('sends the same request to the DeepSeek quality model once the free repair is rejected', async () => {
  const seen = provider(['invalid', 'invalid']);
  const request = body('quality-repair');
  const result = await ai(context(request));
  expect(seen).toEqual(['free', 'free', 'deepseek-v4-pro']);
  expect(result).toMatchObject({
    success: true,
    data: { requestId: request.requestId, modelId: request.modelId, repairRequestId: request.requestId + ':repair2' }
  });
  expect(ledger().calls.map((call: any) => [call.id, call.status])).toEqual([
    [request.requestId, 'failed'],
    [request.requestId + ':repair1', 'failed'],
    [request.requestId + ':repair2', 'completed']
  ]);
  expect(ledger().calls[2].repairOf).toBe(request.requestId);
  // DeepSeek 的系统提示带着原请求的返修反馈。
  const paidMessages = vi
    .mocked(callLearningProvider)
    .mock.calls.find(([config]: any) => config.model === 'deepseek-v4-pro')![1];
  expect(paidMessages[0].content).toContain('"dimension":"语法","quoteIds":["q2"]');
  expect(JSON.stringify(ledger())).not.toContain(PAID_KEY);
  const calls = vi.mocked(callLearningProvider).mock.calls.length;
  const status = await models(context({ action: 'result', requestId: request.requestId }));
  expect(status).toMatchObject({
    success: true,
    data: { modelId: request.modelId, repairRequestId: request.requestId + ':repair2' }
  });
  expect(await ai(context(request))).toMatchObject({
    success: true,
    reused: true,
    data: { repairRequestId: request.requestId + ':repair2' }
  });
  expect(vi.mocked(callLearningProvider).mock.calls).toHaveLength(calls);
});

it('stops after the free repair when the fallback is not armed', async () => {
  vi.stubEnv(DEV_PAID_FALLBACK_FILE, '');
  const seen = provider(['invalid', 'invalid']);
  const request = body('quality-unarmed');
  const result = await ai(context(request));
  expect(seen).toEqual(['free', 'free']);
  expect(result).toMatchObject({
    success: false,
    repairExhausted: true,
    repairRequestId: request.requestId + ':repair1'
  });
  expect(ledger().calls).toHaveLength(2);
});

it('repairs a rate-limited answer from DeepSeek with the free model first', async () => {
  // 原答由兜底作答：返修按预留时的免费连接校验，不因作答型号不同而拒绝。
  const seen = provider(['limited', 'valid']);
  const request = body('quality-after-limit');
  const result = await ai(context(request));
  expect(seen).toEqual(['free', 'deepseek-flash', 'free']);
  expect(result).toMatchObject({
    success: true,
    data: { requestId: request.requestId, repairRequestId: request.requestId + ':repair1' }
  });
});
