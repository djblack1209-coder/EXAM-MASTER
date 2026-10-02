import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  rows: new Map(),
  allowed: true,
  queries: [] as any[],
  response: undefined as any,
  failStateDelete: false
}));
vi.mock('@lafjs/cloud', () => ({
  default: {
    get res() {
      return mock.response;
    },
    database: () => ({
      collection: (name: string) => ({
        add: async (row: any) => {
          const id = `${name}:${row._id}`;
          if (mock.rows.has(id)) throw { code: 11000 };
          mock.rows.set(id, structuredClone(row));
        },
        where: (query: any) => {
          mock.queries.push({ name, query });
          const matches = () =>
            [...mock.rows.entries()].filter(
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
              if (name === 'learning_states' && mock.failStateDelete) throw new Error('isolated deletion failure');
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
  checkRateLimitDistributed: vi.fn(async () => ({ allowed: mock.allowed }))
}));
vi.mock('../../laf-backend/functions/_shared/ai-providers/learning-provider', async (original) => ({
  ...(await original<any>()),
  callStreamingLearningProvider: vi.fn(),
  callLearningProvider: vi.fn(async () => ({
    content: '{"message":"隔离测试回复","tools":[]}',
    actualModel: 'explicit-test-id',
    usage: { prompt_tokens: 15, completion_tokens: 12 },
    durationMs: 1
  }))
}));
import models from '../../laf-backend/functions/learning-models';
import ai, { costFromUsage } from '../../laf-backend/functions/proxy-ai';
import stream from '../../laf-backend/functions/proxy-ai-stream';
import sync from '../../laf-backend/functions/learning-sync';
import subscription from '../../laf-backend/functions/learning-subscriptions';
import { parsePastedMaterial } from '../../src/services/learning/material-intake.js';
import { PAGE_PNG, PAGE_SOURCE, PAGE_READING } from '../fixtures/learning-vision.js';
import {
  callLearningProvider,
  callStreamingLearningProvider,
  ProviderError
} from '../../laf-backend/functions/_shared/ai-providers/learning-provider';
const context = (body: any = {}, userId = 'u1') => {
  const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId, exp: Math.floor(Date.now() / 1000) + 60 })).toString(
    'base64url'
  );
  const signature = crypto
    .createHmac('sha256', 'test-only-jwt-secret')
    .update(`${header}.${payload}`)
    .digest('base64url');
  return { headers: { authorization: `Bearer ${header}.${payload}.${signature}` }, body };
};
beforeEach(() => {
  mock.response = undefined;
  mock.rows.clear();
  mock.queries.length = 0;
  mock.allowed = true;
  mock.failStateDelete = false;
  vi.clearAllMocks();
  vi.stubEnv('JWT_SECRET', 'test-only-jwt-secret');
  vi.stubEnv('LEARNING_VAULT_KEY', 'a'.repeat(64));
  vi.stubEnv('LEARNING_ALLOWED_ORIGINS', 'https://provider.example');
  vi.stubEnv('LEARNING_PLATFORM_MODELS', '[]');
  vi.stubEnv('LEARNING_PLATFORM_CALLS_ENABLED', 'false');
  vi.stubEnv('LEARNING_PAYMENT_SANDBOX_ENABLED', 'false');
});
it('登录身份与学习上下文不一致时，拒绝向模型发送旧用户内容或预留费用', async () => {
  const result = await ai(
    context({
      requestId: 'changed-owner',
      modelId: 'explicit-test-id',
      shareConsent: true,
      messages: [{ role: 'user', content: 'private context' }],
      learningContext: { owner: 'u2' }
    })
  );
  expect(result.code).toBe(403);
  expect(callLearningProvider).not.toHaveBeenCalled();
  expect(mock.rows.size).toBe(0);
});
afterEach(() => vi.unstubAllEnvs());
const visualBody = (id = 'visual-request') => ({
  requestId: id,
  modelId: 'byo-vision',
  shareConsent: true,
  imageShareConsent: true,
  messages: [{ role: 'user', content: '请辅助解读原页图，不判分' }],
  images: [{ dataUrl: PAGE_PNG, source: PAGE_SOURCE }],
  learningContext: {
    owner: 'u1',
    question: { questionKey: 'private-image@1', source: { ...PAGE_SOURCE, kind: 'private_material' } }
  }
});
async function saveVisualModel(vision = true) {
  return models(
    context({
      action: 'save',
      shareConsent: true,
      profile: {
        id: 'byo-vision',
        model: 'explicit-test-id',
        endpoint: 'https://provider.example/chat',
        apiKey: 'test-only-vision-key',
        vision
      }
    })
  );
}
it('视觉型号显式声明，一张页图绑定当前用户题目；重试/恢复只复用账单且成本待核验', async () => {
  expect((await saveVisualModel()).success).toBe(true);
  vi.mocked(callLearningProvider).mockResolvedValueOnce({
    content: JSON.stringify({ visualReading: PAGE_READING, tools: [], question: null }),
    actualModel: 'explicit-test-id',
    usage: { prompt_tokens: 340, completion_tokens: 150 },
    durationMs: 1
  });
  const result = await ai(context(visualBody()));
  expect(result.success).toBe(true);
  expect(result.data.visualReading).toMatchObject({ status: 'ai_assisted', source: PAGE_SOURCE });
  expect(result.data.usageStatus).toBe('pending');
  const sent = vi.mocked(callLearningProvider).mock.calls[0][1];
  expect(sent.at(-1)?.content).toEqual([
    { type: 'text', text: '请辅助解读原页图，不判分' },
    { type: 'image_url', image_url: { url: PAGE_PNG } }
  ]);
  expect((await ai(context(visualBody()))).reused).toBe(true);
  expect(callLearningProvider).toHaveBeenCalledTimes(1);
  const recovered = await models(context({ action: 'result', requestId: 'visual-request' }));
  expect(recovered.data.visualReading).toEqual(result.data.visualReading);
  const usage = (await models(context({ action: 'usage' }))).data;
  expect(usage.calls).toHaveLength(1);
  expect(usage.calls[0]).toMatchObject({ inputMode: 'image', priceVersion: 'vision-pricing-unverified' });
  expect(usage.calls[0]).toMatchObject({ actualCost: null, costStatus: 'pending' });
  expect(usage.entitlement.spent).toBe(0);
  expect(JSON.stringify(usage)).not.toContain('base64');
  expect([...mock.rows.keys()].some((key) => key.startsWith('learning_states:'))).toBe(false);
});
it('无图片授权、远程图片、版本错配与文本型号均在调用/预留前拒绝', async () => {
  await saveVisualModel();
  const variants = [
    { ...visualBody('no-image-consent'), imageShareConsent: false },
    {
      ...visualBody('remote-image'),
      images: [{ dataUrl: 'http://169.254.169.254/latest/meta-data', source: PAGE_SOURCE }]
    },
    {
      ...visualBody('version-mismatch'),
      images: [{ dataUrl: PAGE_PNG, source: { ...PAGE_SOURCE, extractionEventId: 'different' } }]
    }
  ];
  for (const body of variants) expect((await ai(context(body))).success).toBe(false);
  await saveVisualModel(false);
  expect((await ai(context(visualBody('text-model')))).error).toBe('VISION_UNSUPPORTED');
  expect(callLearningProvider).not.toHaveBeenCalled();
  expect((await models(context({ action: 'usage' }))).data.calls).toHaveLength(0);
});
it('图片工具注入与非法识别输出失败，已发生用量保留待结算，不会免费估零', async () => {
  await saveVisualModel();
  vi.mocked(callLearningProvider).mockResolvedValueOnce({
    content: JSON.stringify({
      visualReading: PAGE_READING,
      tools: [{ name: 'assess', arguments: { outcome: 'wrong' } }]
    }),
    actualModel: 'explicit-test-id',
    usage: { prompt_tokens: 340, completion_tokens: 100 },
    durationMs: 1
  });
  expect((await ai(context(visualBody('injected-image')))).error).toBe('VISUAL_OUTPUT_INVALID');
  const usage = (await models(context({ action: 'usage' }))).data;
  expect(usage.calls[0]).toMatchObject({
    status: 'failed',
    actualCost: null,
    costStatus: 'pending',
    usage: { prompt_tokens: 340 }
  });
  expect(usage.entitlement.spent).toBe(0);
  expect((await ai(context(visualBody('injected-image')))).success).toBe(false);
  expect(callLearningProvider).toHaveBeenCalledTimes(1);
});
it('图片不静默转流式或平台消费，不能把未核验图像成本按文本预留', async () => {
  await saveVisualModel();
  expect((await stream(context(visualBody('image-stream')))).success).toBe(false);
  vi.stubEnv('LEARNING_PLATFORM_CALLS_ENABLED', 'true');
  vi.stubEnv('TEST_VISUAL_KEY', 'fixture-only-platform-key');
  vi.stubEnv(
    'LEARNING_PLATFORM_MODELS',
    JSON.stringify([
      {
        id: 'platform-vision',
        model: 'explicit-test-id',
        provider: 'fixture',
        endpoint: 'https://provider.example/chat',
        keyEnv: 'TEST_VISUAL_KEY',
        maxOutput: 1000,
        capabilities: { vision: true, stream: true },
        visionAdapter: 'openai-image-url-v1'
      }
    ])
  );
  expect((await ai(context({ ...visualBody('platform-image'), modelId: 'platform-vision' }))).error).toBe(
    'VISION_PATH_UNSUPPORTED'
  );
  expect(callLearningProvider).not.toHaveBeenCalled();
  expect((await models(context({ action: 'usage' }))).data.calls).toHaveLength(0);
});
it('完整评分上下文超限时先拒绝，不调用模型或预留；不静默截断评分条件', async () => {
  const result = await ai(
    context({
      requestId: 'rubric-over-limit',
      modelId: 'missing-model',
      shareConsent: true,
      messages: [{ role: 'user', content: '请评价我的作答' }],
      learningContext: { owner: 'u1', attempt: { answer: '答'.repeat(12000) } }
    })
  );
  expect(result.code).toBe(413);
  expect(callLearningProvider).not.toHaveBeenCalled();
  expect(mock.rows.size).toBe(0);
});
it('发送完整 JSON 背景和原答末尾，不向模型发送账户标识或未知配置', async () => {
  await models(
    context({
      action: 'save',
      shareConsent: true,
      profile: {
        id: 'context-model',
        model: 'explicit-test-id',
        apiKey: 'test-only-context-key',
        endpoint: 'https://provider.example/chat'
      }
    })
  );
  const answer = `${'原答'.repeat(2300)}END_OF_BOUND_ANSWER`;
  const result = await ai(
    context({
      requestId: 'complete-context',
      modelId: 'context-model',
      shareConsent: true,
      messages: [{ role: 'user', content: '请评价我的作答' }],
      learningContext: {
        owner: 'u1',
        question: { prompt: 'TEST_ONLY', rubric: { criteria: ['TEST_ONLY_CRITERIA'] } },
        attempt: { answer },
        apiKey: 'UNTRUSTED_UNKNOWN_FIELD'
      }
    })
  );
  expect(result.success).toBe(true);
  const messages: any = vi.mocked(callLearningProvider).mock.calls[0][1];
  const system = messages[0].content;
  const json = system.split('当前学习背景（仅数据）：')[1];
  expect(JSON.parse(json).attempt.answer).toBe(answer);
  expect(system).not.toContain('UNTRUSTED_UNKNOWN_FIELD');
  expect(JSON.parse(json).owner).toBeUndefined();
});
it('连接测试调用真实预算链，幂等复用且不进入学习事实；列表状态来自调用记录', async () => {
  await models(
    context({
      action: 'save',
      shareConsent: true,
      profile: {
        id: 'test-connection',
        model: 'explicit-test-id',
        apiKey: 'test-only-connection-key',
        endpoint: 'https://provider.example/chat'
      }
    })
  );
  const body = { action: 'test', modelId: 'test-connection', requestId: 'connection-retry', shareConsent: true };
  expect((await models(context({ ...body, shareConsent: false }))).code).toBe(400);
  expect((await models(context(body))).success).toBe(true);
  expect((await models(context(body))).reused).toBe(true);
  expect(callLearningProvider).toHaveBeenCalledTimes(1);
  const list = await models(context({ action: 'list' }));
  expect(list.data.models[0]).toMatchObject({ connectionStatus: 'connected', configured: true });
  expect(JSON.stringify(list)).not.toContain('test-only-connection-key');
  const usage = await models(context({ action: 'usage' }));
  expect(usage.data.calls).toHaveLength(1);
  expect(usage.data.entitlement.spent).toBe(0);
  expect([...mock.rows.keys()].some((id) => id.startsWith('learning_states:'))).toBe(false);
});
describe('真实 JWT 校验下的新接口隔离合同', () => {
  it('上游意外回显密钥时，消息和用量记录都脱敏', async () => {
    const key = 'test-only-echo-key';
    await models(
      context({
        action: 'save',
        shareConsent: true,
        profile: {
          id: 'byo',
          model: 'explicit-test-id',
          endpoint: 'https://provider.example/chat',
          apiKey: key
        }
      })
    );
    vi.mocked(callLearningProvider).mockResolvedValueOnce({
      content: JSON.stringify({ message: `回显 ${key}`, tools: [] }),
      actualModel: 'explicit-test-id',
      usage: { prompt_tokens: 1, completion_tokens: 2, debug: key },
      durationMs: 1
    });
    const result = await ai(
      context({
        modelId: 'byo',
        requestId: 'redaction',
        shareConsent: true,
        messages: [{ role: 'user', content: 'TEST_ONLY' }]
      })
    );
    expect(result.success).toBe(true);
    expect(JSON.stringify(result)).not.toContain(key);
    expect(JSON.stringify([...mock.rows.values()])).not.toContain(key);
  });
  it('未知计费项与负价格保持待结算，不把无效价格当零成本', () => {
    const model: any = { inputPerMillion: 2, outputPerMillion: 4, priceVersion: 'TEST_ONLY_v1' };
    const usage = { prompt_tokens: 100, completion_tokens: 50 };
    expect(costFromUsage(usage, model)).toBe(0.0004);
    expect(costFromUsage(usage, { ...model, inputPerMillion: -1 })).toBeNull();
    expect(costFromUsage({ ...usage, billable_extra: { ocr: 1 } }, model)).toBeNull();
    expect(costFromUsage({ ...usage, search_cost: 1 }, model)).toBeNull();
    expect(costFromUsage({ ...usage, prompt_tokens: 100.5 }, model)).toBeNull();
    expect(costFromUsage({ ...usage, completion_tokens_details: { reasoning_tokens: 10 } }, model)).toBeNull();
  });
  it('所有新入口拒绝缺失或篡改的 JWT，不触发外部模型', async () => {
    for (const endpoint of [models, ai, stream, sync, subscription]) {
      expect((await endpoint({ headers: {}, body: {} })).code).toBe(401);
      expect((await endpoint({ ...context(), headers: { authorization: 'Bearer forged' } })).code).toBe(401);
    }
    expect(callLearningProvider).not.toHaveBeenCalled();
    expect(mock.rows.size).toBe(0);
  });
  it('真实收费关闭、限流失败拒绝、流式非法输入在调用前拒绝', async () => {
    expect((await subscription(context({ action: 'order', environment: 'production', paid: true }))).success).toBe(
      false
    );
    expect((await stream(context())).code).toBe(400);
    mock.allowed = false;
    expect((await ai(context())).code).toBe(429);
    expect(callLearningProvider).not.toHaveBeenCalled();
  });
  it('调用前取消经过身份隔离并阻止后来到达的请求，不产生上游调用', async () => {
    const profile = {
      id: 'byo',
      model: 'explicit-test-id',
      endpoint: 'https://provider.example/chat',
      apiKey: 'test-only'
    };
    await models(context({ action: 'save', profile, shareConsent: true }));
    const cancelled = await models(context({ action: 'cancel', requestId: 'early' }));
    expect(cancelled.data).toMatchObject({ cancellationRecorded: true, executionStopped: true });
    const body = {
      modelId: 'byo',
      requestId: 'early',
      messages: [{ role: 'user', content: 'TEST_ONLY' }],
      shareConsent: true
    };
    expect((await ai(context(body))).code).toBe(499);
    expect(callLearningProvider).not.toHaveBeenCalled();
    await models(context({ action: 'cancel', requestId: 'early' }, 'u2'));
    const accounts: any[] = [...mock.rows.entries()]
      .filter(([id]) => id.startsWith('learning_accounts:'))
      .map(([, row]) => row);
    expect(accounts).toHaveLength(2);
    expect(accounts.every((row) => row.calls.length === 1)).toBe(true);
  });
  it('在途取消后即使上游成功也不返回可执行教学，保留上游用量并取消权益扣除', async () => {
    await models(
      context({
        action: 'save',
        shareConsent: true,
        profile: {
          id: 'byo',
          model: 'explicit-test-id',
          endpoint: 'https://provider.example/chat',
          apiKey: 'test-only'
        }
      })
    );
    let release: any;
    let started: any;
    const ready = new Promise((resolve) => {
      started = resolve;
    });
    vi.mocked(callLearningProvider).mockImplementationOnce(async () => {
      started();
      return new Promise((resolve) => {
        release = resolve;
      });
    });
    const request = ai(
      context({
        modelId: 'byo',
        requestId: 'inflight',
        shareConsent: true,
        messages: [{ role: 'user', content: 'TEST_ONLY' }]
      })
    );
    await ready;
    const cancelled = await models(context({ action: 'cancel', requestId: 'inflight' }));
    expect(cancelled.data.executionStopped).toBe(false);
    release({
      content: '{"message":"不应执行的教学","tools":[]}',
      actualModel: 'explicit-test-id',
      usage: { prompt_tokens: 7, completion_tokens: 8 },
      durationMs: 1
    });
    expect((await request).code).toBe(499);
    const account: any = [...mock.rows.entries()].find(([id]) => id.startsWith('learning_accounts:'))?.[1];
    expect(account.calls[0]).toMatchObject({
      status: 'cancelled',
      result: null,
      entitlementCharged: 0,
      usage: { prompt_tokens: 7, completion_tokens: 8 }
    });
  });
  it('服务端保存的密钥隔离、列表/账户脱敏，自带 API 不扣平台额度，重复请求不二次调用', async () => {
    const profile = {
      id: 'byo',
      model: 'explicit-test-id',
      endpoint: 'https://provider.example/v1/chat/completions',
      apiKey: 'test-only-upstream-key',
      structured: true
    };
    expect((await models(context({ action: 'save', profile, shareConsent: true }))).success).toBe(true);
    const account: any = [...mock.rows.entries()].find(([id]) => id.startsWith('learning_accounts:'))?.[1];
    expect(JSON.stringify(account)).not.toContain('test-only-upstream-key');
    expect(account.profiles[0].vault).toBeUndefined();
    expect(account.profiles[0].keyRef).toBeTruthy();
    const listed = await models(context({ action: 'list' }));
    expect(JSON.stringify(listed)).not.toMatch(/ciphertext|keyRef|test-only-upstream-key/);
    expect((await models(context({ action: 'list' }, 'u2'))).data.models).toHaveLength(0);
    const body = {
      requestId: 'r1',
      modelId: 'byo',
      messages: [{ role: 'user', content: '学习测试' }],
      shareConsent: true
    };
    expect((await ai(context(body))).success).toBe(true);
    expect((await ai(context(body))).reused).toBe(true);
    expect(callLearningProvider).toHaveBeenCalledTimes(1);
    const usage = await models(context({ action: 'usage' }));
    expect(usage.data.entitlement.spent).toBe(0);
    expect((await models(context({ action: 'delete', profileId: 'byo' }))).success).toBe(true);
    expect([...mock.rows.keys()].filter((id) => id.startsWith('learning_model_keys:'))).toHaveLength(0);
  });
  it('同步忽略客户端用户身份且保持私有范围', async () => {
    const result = await sync(
      context({
        action: 'push',
        userId: 'u2',
        operations: [{ id: 'c1', type: 'conversation.start', at: Date.now(), data: { goal: '独立目标' } }]
      })
    );
    expect(result.success).toBe(true);
    expect(result.data.state.owner).toBe('u1');
    expect((await sync(context({ action: 'pull' }, 'u2'))).data.state.conversations).toHaveLength(0);
  });
});

function streamResponse(backpressure = false) {
  const response: any = new EventEmitter();
  response.headersSent = false;
  response.writableEnded = false;
  response.destroyed = false;
  response.parts = [];
  response.setHeader = vi.fn();
  response.write = (text: string) => {
    response.headersSent = true;
    response.parts.push(text);
    return !backpressure;
  };
  response.end = () => {
    response.writableEnded = true;
    response.emit('close');
  };
  response.destroy = () => {
    response.destroyed = true;
    response.emit('close');
  };
  return response;
}
async function streamProfile(enabled = true, owner = 'u1') {
  await models(
    context(
      {
        action: 'save',
        shareConsent: true,
        profile: {
          id: 'fixture-stream',
          model: 'explicit-test-id',
          apiKey: 'fixture-only-stream-key',
          endpoint: 'https://provider.example/chat',
          stream: enabled
        }
      },
      owner
    )
  );
}
const streamBody = (id = 'stream-fixture') => ({
  requestId: id,
  requestBinding: 'binding_fixture_only',
  modelId: 'fixture-stream',
  shareConsent: true,
  messages: [{ role: 'user', content: '理解函数' }],
  learningContext: { owner: 'u1' }
});
const streamCompleted = {
  content: '{"message":"分步讲解","tools":[]}',
  actualModel: 'explicit-test-id',
  usage: { prompt_tokens: 4, completion_tokens: 8 },
  usageComplete: true,
  durationMs: 2
};
it('原缓存过期后恢复/同ID重试都明确不可用，保留账单且不再发起模型调用', async () => {
  await streamProfile();
  const body = streamBody('cache-expiry');
  expect((await ai(context(body))).success).toBe(true);
  const row: any = [...mock.rows.values()].find((a: any) => a.user_id === 'u1' && a.calls);
  row.calls[0].resultExpiresAt = Date.now() - 1;
  const before = structuredClone(row.cost);
  const read = await models(context({ action: 'result', requestId: body.requestId }));
  expect(read).toMatchObject({ code: 410, cacheStatus: 'expired', error: 'MODEL_RESULT_UNAVAILABLE' });
  expect((await ai(context(body))).code).toBe(410);
  expect(callLearningProvider).toHaveBeenCalledTimes(1);
  const actual = [...mock.rows.values()].find((a: any) => a.user_id === 'u1' && a.calls);
  expect(actual.cost).toEqual(before);
  expect(actual.calls).toHaveLength(1);
  expect(actual.calls[0].result).toBeNull();
  expect((await models(context({ action: 'result', requestId: body.requestId }, 'u2'))).code).toBe(404);
  expect((await models(context({ action: 'usage' }))).data.resultCache).toMatchObject({
    entries: 0,
    bytes: 0,
    expiryEnforcement: 'on_access'
  });
});
it('缓存容量与异常用量经过真实端点合同，不把恢复请求变为成功空结果或新消费', async () => {
  vi.stubEnv('LEARNING_MODEL_RESULT_CACHE', '{"maxEntries":1}');
  await streamProfile();
  expect((await ai(context(streamBody('cache-old')))).success).toBe(true);
  vi.mocked(callLearningProvider).mockResolvedValueOnce({
    ...streamCompleted,
    usage: { prompt_tokens: 4, completion_tokens: 8, billable_extra: 'PRIVATE_USAGE'.repeat(10000) }
  });
  expect((await ai(context(streamBody('cache-new')))).success).toBe(true);
  expect((await models(context({ action: 'result', requestId: 'cache-old' }))).code).toBe(410);
  expect(await ai(context(streamBody('cache-old')))).toMatchObject({ code: 410, cacheStatus: 'capacity' });
  const current = await models(context({ action: 'usage' }));
  expect(current.data.calls).toHaveLength(2);
  expect(current.data.resultCache.entries).toBe(1);
  expect(current.data.calls[1]).toMatchObject({
    actualCost: null,
    usageEvidence: { status: 'truncated', truncated: true }
  });
  expect(JSON.stringify(current)).not.toContain('PRIVATE_USAGE');
  expect(callLearningProvider).toHaveBeenCalledTimes(2);
  expect(current.data.entitlement.spent).toBe(0);
});
it('无效缓存配置在上游调用或费用预留前拒绝', async () => {
  await streamProfile();
  vi.stubEnv('LEARNING_MODEL_RESULT_CACHE', '{"maxEntries":0}');
  expect((await ai(context(streamBody('no-charge')))).error).toBe('POLICY_INVALID');
  expect(callLearningProvider).not.toHaveBeenCalled();
  expect([...mock.rows.values()].find((a: any) => a.calls).calls).toHaveLength(0);
});
describe('模型结果缓存的隐私删除', () => {
  it('删除云副本清除本账户结果、保留费用和密钥，跨账户不受影响，旧请求不能再生成', async () => {
    for (const owner of ['u1', 'u2']) {
      await streamProfile(true, owner);
      const body = { ...streamBody('private-result'), learningContext: { owner } };
      expect((await ai(context(body, owner))).success).toBe(true);
      await sync(context({ action: 'pull' }, owner));
    }
    const before = (await models(context({ action: 'usage' }))).data;
    const deleted = await sync(context({ action: 'delete' }));
    expect(deleted.data).toMatchObject({ deleted: true, modelResultCacheDeleted: true, erasedResults: 1 });
    const after = (await models(context({ action: 'usage' }))).data;
    expect(after.cost).toEqual(before.cost);
    expect(after.entitlement).toEqual(before.entitlement);
    expect(after.calls[0]).toMatchObject({ status: 'completed', actualCost: null });
    expect((await models(context({ action: 'result', requestId: 'private-result' }))).code).toBe(410);
    expect((await ai(context(streamBody('private-result')))).code).toBe(410);
    expect(callLearningProvider).toHaveBeenCalledTimes(2);
    expect((await models(context({ action: 'result', requestId: 'private-result' }, 'u2'))).success).toBe(true);
    expect((await models(context({ action: 'list' }))).data.models).toHaveLength(1);
    expect([...mock.rows.keys()].filter((id) => id.startsWith('learning_model_keys:'))).toHaveLength(2);
    expect(
      [...mock.rows.entries()].filter(([id]) => id.startsWith('learning_states:')).map(([, row]) => row.user_id)
    ).toEqual(['u2']);
    expect((await sync(context({ action: 'delete' }))).data.erasedResults).toBe(0);
  });
  it('删除先原子标记在途取消，晚到的已计费用量只能结算、不能回填正文', async () => {
    await streamProfile();
    let release: any, started: any;
    const ready = new Promise((resolve) => (started = resolve));
    vi.mocked(callLearningProvider).mockImplementationOnce(async (_model, _messages, _origins, signal) => {
      started(signal);
      return new Promise((resolve) => (release = resolve));
    });
    const pending = ai(context(streamBody('delete-inflight')));
    const signal: any = await ready;
    expect((await sync(context({ action: 'delete' }))).data.cancellationRecorded).toBe(1);
    expect(signal.aborted).toBe(true);
    release(streamCompleted);
    expect((await pending).code).toBe(499);
    const call = (await models(context({ action: 'usage' }))).data.calls[0];
    expect(call).toMatchObject({
      status: 'cancelled',
      entitlementCharged: 0,
      actualCost: null,
      usage: streamCompleted.usage
    });
    expect((await models(context({ action: 'result', requestId: 'delete-inflight' }))).code).toBe(410);
    const row: any = [...mock.rows.entries()].find(([id]) => id.startsWith('learning_accounts:'))?.[1];
    expect(row.calls[0].result).toBeNull();
  });
  it('资料墓碑先校验再清除结果；无效批次不清除，重复补传不删除后续新结果', async () => {
    await streamProfile();
    await ai(context(streamBody('before-material-delete')));
    const material = parsePastedMaterial('私人提取文字', 'private-m1');
    expect(
      (
        await sync(
          context({
            action: 'push',
            operations: [{ id: 'material-added', type: 'material.add', at: Date.now(), data: { material } }]
          })
        )
      ).success
    ).toBe(true);
    const deletion = {
      id: 'material-erased',
      type: 'material.delete',
      at: Date.now(),
      data: { materialId: 'private-m1', questionKeys: [] }
    };
    expect(
      (
        await sync(
          context({
            action: 'push',
            operations: [{ ...deletion, data: { materialId: 'private-m1', questionKeys: null } }]
          })
        )
      ).success
    ).toBe(false);
    expect((await models(context({ action: 'result', requestId: 'before-material-delete' }))).success).toBe(true);
    const deleted = await sync(context({ action: 'push', operations: [deletion] }));
    expect(deleted.success).toBe(true);
    expect(deleted.data.state.materials).toHaveLength(0);
    expect((await models(context({ action: 'result', requestId: 'before-material-delete' }))).code).toBe(410);
    await ai(context(streamBody('after-material-delete')));
    expect((await sync(context({ action: 'push', operations: [deletion] }))).data.revision).toBe(deleted.data.revision);
    expect((await models(context({ action: 'result', requestId: 'after-material-delete' }))).success).toBe(true);
  });
  it('云状态删除失败不冒充成功；结果先清除，重试完成余下步骤', async () => {
    await streamProfile();
    await ai(context(streamBody('retry-erase')));
    await sync(context({ action: 'pull' }));
    mock.failStateDelete = true;
    expect((await sync(context({ action: 'delete' }))).success).toBe(false);
    expect([...mock.rows.keys()].some((id) => id.startsWith('learning_states:'))).toBe(true);
    expect((await models(context({ action: 'result', requestId: 'retry-erase' }))).code).toBe(410);
    mock.failStateDelete = false;
    expect((await sync(context({ action: 'delete' }))).data.deleted).toBe(true);
    expect([...mock.rows.keys()].some((id) => id.startsWith('learning_states:'))).toBe(false);
    expect(callLearningProvider).toHaveBeenCalledTimes(1);
  });
});
describe('流式实际预算、终止收据与取消隔离', () => {
  it('未声明流式能力或没有可靠后端传输时不调用模型，已预留已知未调用结算为零', async () => {
    await streamProfile(false);
    expect((await stream(context(streamBody()))).code).toBe(422);
    expect(callStreamingLearningProvider).not.toHaveBeenCalled();
    await streamProfile();
    expect((await stream(context(streamBody()))).error).toBe('STREAM_TRANSPORT_UNAVAILABLE');
    const usage = await models(context({ action: 'usage' }));
    expect(usage.data.calls).toHaveLength(1);
    expect(usage.data.calls[0]).toMatchObject({ actualCost: 0, executionStage: 'not_called', costStatus: 'settled' });
    expect(callStreamingLearningProvider).not.toHaveBeenCalled();
  });
  it('完整 SSE 绑定当前型号并在终止前校验；只读结果和同ID重播都不追加用量', async () => {
    await streamProfile();
    const response = streamResponse();
    mock.response = response;
    vi.mocked(callStreamingLearningProvider).mockImplementationOnce(async (_model, _messages, _origins, options) => {
      options?.onPreview?.('{"message":"先讲解 fixture-only-stream-key 已经调整计划，之后继续教学","tools":[]}');
      return streamCompleted;
    });
    expect(await stream(context(streamBody()))).toBeNull();
    expect(response.writableEnded).toBe(true);
    const text = response.parts.join('');
    expect(text).toContain('event: preview');
    expect(text).toContain('event: result');
    expect(text).not.toContain('fixture-only-stream-key');
    expect(text).not.toContain('已经调整计划');
    const before = structuredClone([...mock.rows.values()]);
    const read = await models(context({ action: 'result', requestId: 'stream-fixture' }));
    expect(read).toMatchObject({
      success: true,
      reused: true,
      data: { modelId: 'fixture-stream', requestBinding: 'binding_fixture_only', transport: 'sse-v1' }
    });
    expect([...mock.rows.values()]).toEqual(before);
    mock.response = streamResponse();
    await stream(context(streamBody()));
    expect(callStreamingLearningProvider).toHaveBeenCalledOnce();
    const usage = await models(context({ action: 'usage' }));
    expect(usage.data.calls).toHaveLength(1);
    expect(usage.data.entitlement.spent).toBe(0);
    expect((await models(context({ action: 'result', requestId: 'stream-fixture' }, 'u2'))).code).toBe(404);
  });
  it('输出截断/模型错配和未知成本不变成成功；仅完整已见用量可以结算', async () => {
    await streamProfile();
    mock.response = streamResponse();
    const failed = new ProviderError('INCOMPLETE_OUTPUT', 'fixture');
    failed.observed = {
      actualModel: 'explicit-test-id',
      usage: { prompt_tokens: 4, completion_tokens: 8 },
      usageComplete: false
    };
    vi.mocked(callStreamingLearningProvider).mockRejectedValueOnce(failed);
    await stream(context(streamBody()));
    expect(mock.response.parts.join('')).toContain('event: error');
    expect(mock.response.parts.join('')).not.toContain('event: result');
    const usage = await models(context({ action: 'usage' }));
    expect(usage.data.calls[0]).toMatchObject({
      status: 'failed',
      actualCost: null,
      costStatus: 'pending',
      executionStage: 'started',
      usageComplete: false
    });
    expect((await models(context({ action: 'result', requestId: 'stream-fixture' }))).success).toBe(false);
  });
  it('客户端背压终止供应商输出，不落成功结果或零成本假账', async () => {
    await streamProfile();
    mock.response = streamResponse(true);
    vi.mocked(callStreamingLearningProvider).mockImplementationOnce(async (_m, _msgs, _o, options) => {
      options?.onPreview?.('{"message":"这是足够长的教学预览内容，供背压校验使用","tools":[]}');
      return streamCompleted;
    });
    await stream(context(streamBody()));
    const usage = await models(context({ action: 'usage' }));
    expect(usage.data.calls[0]).toMatchObject({ status: 'failed', errorCode: 'CLIENT_BACKPRESSURE', actualCost: null });
    expect(mock.response.writableEnded).toBe(true);
  });
  it('服务端取消中断正在执行的同账户任务，异账户同ID不能取消它', async () => {
    await streamProfile();
    mock.response = streamResponse();
    let started: any;
    const ready = new Promise<void>((resolve) => (started = resolve));
    vi.mocked(callStreamingLearningProvider).mockImplementationOnce(
      async (_m, _msgs, _o, options) =>
        new Promise((_resolve, reject) => {
          started();
          options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true });
        })
    );
    const pending = stream(context(streamBody()));
    await ready;
    expect((await models(context({ action: 'cancel', requestId: 'stream-fixture' }, 'u2'))).success).toBe(true);
    expect((await models(context({ action: 'result', requestId: 'stream-fixture' }))).code).toBe(409);
    await models(context({ action: 'cancel', requestId: 'stream-fixture' }));
    await pending;
    const usage = await models(context({ action: 'usage' }));
    expect(usage.data.calls[0]).toMatchObject({ status: 'cancelled', actualCost: null, costStatus: 'pending' });
    expect((await models(context({ action: 'result', requestId: 'stream-fixture' }))).code).toBe(499);
    expect(callStreamingLearningProvider).toHaveBeenCalledOnce();
  });
  it('取消先到、模型配置已更换或关联令牌不同，不复用错误结果或新增调用', async () => {
    await streamProfile();
    mock.response = streamResponse();
    await models(context({ action: 'cancel', requestId: 'cancel-first' }));
    expect((await stream(context(streamBody('cancel-first')))).success).toBe(false);
    expect(callStreamingLearningProvider).not.toHaveBeenCalled();
    vi.mocked(callStreamingLearningProvider).mockResolvedValueOnce(streamCompleted);
    await stream(context(streamBody()));
    mock.response = streamResponse();
    const changed = await stream(context({ ...streamBody(), requestBinding: 'other_binding_fixture' }));
    expect(changed.error).toBe('IDEMPOTENCY_CONFLICT');
    vi.stubEnv(
      'LEARNING_PLATFORM_MODELS',
      JSON.stringify([
        {
          id: 'fixture-stream',
          model: 'other-real-model',
          endpoint: 'https://provider.example/chat',
          keyEnv: 'FIXTURE_MODEL_KEY',
          provider: 'isolated',
          maxOutput: 100,
          capabilities: { stream: true, structured: true, tools: false, vision: false },
          inputPerMillion: 1,
          outputPerMillion: 1,
          priceVersion: 'test-only'
        }
      ])
    );
    vi.stubEnv('LEARNING_PLATFORM_CALLS_ENABLED', 'true');
    vi.stubEnv('FIXTURE_MODEL_KEY', 'fixture-only-platform-key');
    expect((await stream(context(streamBody()))).success).toBe(false);
    expect(callStreamingLearningProvider).toHaveBeenCalledOnce();
  });
});
