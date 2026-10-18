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
import ai, { costFromUsage, runLearningModelTask } from '../../laf-backend/functions/proxy-ai';
import stream from '../../laf-backend/functions/proxy-ai-stream';
import sync from '../../laf-backend/functions/learning-sync';
import subscription from '../../laf-backend/functions/learning-subscriptions';
import { parsePastedMaterial } from '../../src/services/learning/material-intake.js';
import { PAGE_PNG, PAGE_SOURCE, PAGE_READING } from '../fixtures/learning-vision.js';
import {
  callLearningProvider,
  callStreamingLearningProvider,
  buildLearningRequest,
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

it('保存已知基础地址时补齐真实请求路径，继续检查白名单且不发起模型请求', async () => {
  const profile = {
    id: 'normalized',
    model: 'glm-4.7-flash',
    provider: '智谱',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/',
    apiKey: 'synthetic-profile-key'
  };
  expect((await models(context({ action: 'save', profile, shareConsent: true }))).success).toBe(false);
  expect(mock.rows.size).toBe(0);
  vi.stubEnv('LEARNING_ALLOWED_ORIGINS', 'https://open.bigmodel.cn');
  expect((await models(context({ action: 'save', profile, shareConsent: true }))).success).toBe(true);
  const account = [...mock.rows.values()].find((row: any) => Array.isArray(row.profiles));
  expect(account.profiles[0]).toMatchObject({
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    pricing: 'official_free_model'
  });
  expect(account.profiles[0]).not.toHaveProperty('apiKey');
  expect(callLearningProvider).not.toHaveBeenCalled();
});

describe('诗词调用接续', () => {
  const body = { action: 'poetry', context: 'independent-practice-correct' };

  it('沿用身份与限流，默认关闭的查询不读取账户、不写数据、不调用模型', async () => {
    expect((await models({ headers: {}, body })).code).toBe(401);
    mock.allowed = false;
    expect((await models(context(body))).code).toBe(429);
    mock.allowed = true;
    expect(await models(context(body))).toEqual({ code: 0, success: true, data: { reference: null } });
    expect(mock.queries).toEqual([]);
    expect(mock.rows.size).toBe(0);
    expect(callLearningProvider).not.toHaveBeenCalled();
    expect(callStreamingLearningProvider).not.toHaveBeenCalled();
    const catalog = await models(context({ action: 'list' }));
    expect(catalog.data.poetryReferenceEnabled).toBe(false);
  });

  it.each([
    { action: 'poetry', context: 'other-topic' },
    { ...body, answer: 'synthetic private answer' },
    { ...body, conversationId: 'synthetic-private-id' },
    { ...body, endpoint: 'https://untrusted.example/graphql' },
    { action: 'poetry', context: { prompt: 'synthetic private prompt' } }
  ])('拒绝任意情境、私有字段或指定上游：%j', async (invalid) => {
    expect((await models(context(invalid))).code).toBe(400);
    expect(mock.queries).toEqual([]);
    expect(mock.rows.size).toBe(0);
    expect(callLearningProvider).not.toHaveBeenCalled();
  });
});
it.each([
  ['learning-visual-v2', { template: 'constant_net_force', massKg: 2, netForceN: 4, direction: 'right' }],
  [
    'learning-visual-v3',
    {
      template: 'accelerated_motion',
      massKg: 2,
      initialVelocityMps: 1,
      netForceN: 4,
      direction: 'right',
      physicalSeconds: 2
    }
  ],
  [
    'learning-visual-v4',
    {
      template: 'velocity_time_graph',
      points: [
        { time: 0, velocity: 2 },
        { time: 2, velocity: -2 }
      ]
    }
  ],
  [
    'learning-visual-v5',
    {
      template: 'work_kinetic_energy',
      massKg: 2,
      initialVelocityMps: 1,
      netForceN: 4,
      direction: 'right',
      physicalSeconds: 2
    }
  ]
])('受保护接口向%s发送相符能力，接纳只读演示但不写学习事实，并幂等复用', async (visualization, argumentsValue) => {
  await models(
    context({
      action: 'save',
      shareConsent: true,
      profile: {
        id: 'diagram-model',
        model: 'explicit-test-id',
        apiKey: 'test-only-diagram-key',
        endpoint: 'https://provider.example/chat'
      }
    })
  );
  vi.mocked(callLearningProvider).mockResolvedValueOnce({
    content: JSON.stringify({
      message: '先预测，再观察。',
      tools: [{ id: 'diagram-candidate', name: 'visualize', arguments: argumentsValue }]
    }),
    actualModel: 'explicit-test-id',
    usage: { prompt_tokens: 15, completion_tokens: 12 },
    durationMs: 1
  });
  const body = {
    requestId: 'declared-diagram',
    modelId: 'diagram-model',
    shareConsent: true,
    messages: [{ role: 'user', content: '合成物理任务' }],
    learningContext: { owner: 'u1', capabilities: { visualization }, strategy: { method: 'diagram' } }
  };
  const result = await ai(context(body));
  expect(result.success).toBe(true);
  expect(result.data.tools[0]).toMatchObject({ name: 'visualize', arguments: argumentsValue });
  const messages: any = vi.mocked(callLearningProvider).mock.calls[0][1];
  expect(messages[0].content).not.toContain('当前客户端未声明动态演示能力，不得请求 visualize');
  expect(messages[0].content).not.toContain('test-only-diagram-key');
  const replay = await ai(context(body));
  const { resultCache: _firstCacheMetadata, ...firstOutput } = result.data;
  expect(replay.reused).toBe(true);
  expect(replay.data).toEqual(firstOutput);
  expect(callLearningProvider).toHaveBeenCalledTimes(1);
  expect([...mock.rows.keys()].some((key) => key.startsWith('learning_states:'))).toBe(false);
});
it('旧v4或未知客户端不能采用新能量演示，未知版本给模型明确禁止且不产生学习事实', async () => {
  await models(
    context({
      action: 'save',
      shareConsent: true,
      profile: {
        id: 'diagram-model',
        model: 'explicit-test-id',
        apiKey: 'test-only-diagram-key',
        endpoint: 'https://provider.example/chat'
      }
    })
  );
  for (const visualization of ['learning-visual-v4', 'unknown-version']) {
    vi.mocked(callLearningProvider).mockResolvedValueOnce({
      content: JSON.stringify({
        message: '不可信新演示',
        tools: [
          {
            id: 'energy-candidate',
            name: 'visualize',
            arguments: {
              template: 'work_kinetic_energy',
              massKg: 2,
              initialVelocityMps: 1,
              netForceN: 4,
              direction: 'right',
              physicalSeconds: 2
            }
          }
        ]
      }),
      actualModel: 'explicit-test-id',
      usage: { prompt_tokens: 15, completion_tokens: 12 },
      durationMs: 1
    });
    const result = await ai(
      context({
        requestId: 'incompatible-' + visualization,
        modelId: 'diagram-model',
        shareConsent: true,
        messages: [{ role: 'user', content: '合成物理任务' }],
        learningContext: { owner: 'u1', capabilities: { visualization } }
      })
    );
    expect(result.success).toBe(false);
  }
  const messages: any = vi.mocked(callLearningProvider).mock.calls.at(-1)?.[1];
  expect(messages[0].content).toContain('当前客户端未声明动态演示能力，不得请求 visualize');
  expect([...mock.rows.keys()].some((key) => key.startsWith('learning_states:'))).toBe(false);
});
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
        task: { track: 'toefl', stage: '自述阶段', edition: '未验证版本' },
        capabilities: {
          evaluation: 'ai_assisted_only',
          officialScore: 'verified',
          apiKey: 'UNTRUSTED_CAPABILITY_SECRET'
        },
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
  expect(JSON.parse(json).task).toMatchObject({ track: 'toefl', stage: '自述阶段', edition: '未验证版本' });
  expect(JSON.parse(json).capabilities.officialScore).toBe('unverified');
  expect(system).not.toContain('UNTRUSTED_CAPABILITY_SECRET');
});
it('非法学习任务在调用和费用预留前拒绝', async () => {
  const result = await ai(
    context({
      requestId: 'invalid-task',
      modelId: 'missing-model',
      shareConsent: true,
      messages: [{ role: 'user', content: '合成任务' }],
      learningContext: { task: { track: 'invented' } }
    })
  );
  expect(result.success).toBe(false);
  expect(callLearningProvider).not.toHaveBeenCalled();
  expect(mock.rows.size).toBe(0);
});
it('当前题讲解拦截擅自新题，明确变式仍返回待核对候选并幂等缓存', async () => {
  await models(
    context({
      action: 'save',
      shareConsent: true,
      profile: {
        id: 'boundary-model',
        model: 'explicit-test-id',
        apiKey: 'fixture-boundary-key',
        endpoint: 'https://provider.example/chat'
      }
    })
  );
  for (const method of ['explain', 'variant']) {
    vi.mocked(callLearningProvider).mockResolvedValueOnce({
      content: JSON.stringify({ message: '实际讲解内容', tools: [], question: { prompt: '模型候选题', options: [] } }),
      actualModel: 'explicit-test-id',
      usage: { prompt_tokens: 15, completion_tokens: 12 },
      durationMs: 1
    });
    const body = {
      requestId: `boundary-${method}`,
      modelId: 'boundary-model',
      shareConsent: true,
      messages: [{ role: 'user', content: method }],
      learningContext: { question: { questionKey: 'source@1' }, strategy: { method } }
    };
    const result = await ai(context(body));
    expect(result.success).toBe(true);
    expect(result.data.message).toBe('实际讲解内容');
    if (method === 'explain') expect(result.data.question).toBeNull();
    else expect(result.data.question).toMatchObject({ prompt: '模型候选题', validation: null });
    expect((await ai(context(body))).data.question).toEqual(result.data.question);
  }
  expect(callLearningProvider).toHaveBeenCalledTimes(2);
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
  it.each([
    ...['plan.set', 'timezone.set'].flatMap((type) =>
      [
        ['array', ['UTC']],
        ['number', 24],
        ['null', null],
        ['empty', ''],
        ['overlong', 'U'.repeat(81)],
        ['unknown', 'Invalid/Zone']
      ].map(([label, timezone]) => ({ type, label, fields: { timezone } }))
    ),
    { type: 'timezone.set', label: 'missing', fields: {} }
  ])('全新时区操作 $type/$label 返回 422/INVALID_INPUT，不改变云端原记录', async ({ type, label, fields }) => {
    const saved = await sync(
      context({
        action: 'push',
        operations: [
          {
            id: `valid-sync-zone-${type}-${label}`,
            type: 'plan.set',
            at: 1790848800000,
            data: { tasks: [], timezone: 'UTC' }
          }
        ]
      })
    );
    expect(saved.code).toBe(0);
    const before = structuredClone([...mock.rows.entries()]);
    const result = await sync(
      context({
        action: 'push',
        operations: [
          {
            id: `fresh-invalid-sync-zone-${type}-${label}`,
            type,
            at: 1790848800000,
            data: type === 'plan.set' ? { tasks: [], ...fields } : fields
          }
        ]
      })
    );
    expect(result).toMatchObject({ code: 422, success: false, error: 'INVALID_INPUT' });
    expect([...mock.rows.entries()]).toEqual(before);
  });
  it.each(['UTC', 'US/Pacific', '+23:00'])('同步保留合法时区 %s，未指定计划时区时沿用账户', async (timezone) => {
    const result = await sync(
      context({
        action: 'push',
        operations: [
          { id: `sync-account-zone-${timezone}`, type: 'timezone.set', at: 1790848800000, data: { timezone } },
          { id: `sync-explicit-zone-${timezone}`, type: 'plan.set', at: 1790848800000, data: { tasks: [], timezone } },
          { id: `sync-inherited-zone-${timezone}`, type: 'plan.set', at: 1790848800000, data: { tasks: [] } }
        ]
      })
    );
    expect(result).toMatchObject({ code: 0, success: true });
    expect(result.data.state.timezone).toBe(timezone);
    expect(result.data.state.plans).toHaveLength(2);
    for (const plan of result.data.state.plans) expect(plan.timezone).toBe(timezone);
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
it('DNS 网络保护拒绝后保留未调用及零成本事实，同ID不重发或产生教学结果', async () => {
  await streamProfile();
  const failure = new ProviderError('SSRF_BLOCKED', '模型域名解析到禁止的网络地址');
  failure.executionStage = 'not_called';
  vi.mocked(callLearningProvider).mockRejectedValueOnce(failure);
  const body = streamBody('dns-not-called');
  expect(await ai(context(body))).toMatchObject({
    success: false,
    error: 'SSRF_BLOCKED',
    message: expect.stringContaining('本次未调用模型')
  });
  const usage = await models(context({ action: 'usage' }));
  expect(usage.data.calls).toHaveLength(1);
  expect(usage.data.calls[0]).toMatchObject({
    status: 'failed',
    actualCost: 0,
    executionStage: 'not_called',
    costStatus: 'settled',
    usage: null,
    errorCode: 'SSRF_BLOCKED'
  });
  expect(usage.data.entitlement.spent).toBe(0);
  expect(usage.data.cost.spent).toBe(0);
  expect((await ai(context(body))).code).toBe(409);
  expect(await models(context({ action: 'result', requestId: body.requestId }))).toMatchObject({
    success: false,
    message: expect.stringContaining('没有可恢复的回复')
  });
  expect(callLearningProvider).toHaveBeenCalledTimes(1);
  expect((await models(context({ action: 'usage' }, 'u2'))).data.calls).toHaveLength(0);
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

describe('明确写作反馈在预留前约束输出，收到后仍校验原答', () => {
  const account = () => [...mock.rows.values()].find((row: any) => row.user_id === 'u1' && Array.isArray(row.calls));
  const body = () => ({
    requestId: 'bound-writing-request',
    requestBinding: 'binding_writing_fixture',
    modelId: 'groq-writing-fixture',
    shareConsent: true,
    feedbackAttemptId: 'saved-writing-attempt',
    feedbackOutputContract: 'writing-feedback-output-v1',
    messages: [{ role: 'user', content: '请评阅已保存原答。' }],
    learningContext: {
      owner: 'u1',
      question: {
        questionKey: 'writing-fixture@1',
        prompt: '合成写作题',
        uncertainties: [],
        rubric: {
          id: 'saved-writing-rubric',
          version: 1,
          source: { kind: 'project_original' },
          criteria: [{ id: 'reader', name: '读者', description: '明确读者', maxScore: 2 }]
        }
      },
      attempt: { id: 'saved-writing-attempt', answer: '  Reading club meets Friday.\nReading club meets Friday.  ' }
    }
  });
  const output = () => ({
    message: '仍需核对。',
    tools: [
      {
        name: 'assess',
        arguments: {
          attemptId: 'saved-writing-attempt',
          rubricId: 'saved-writing-rubric',
          outcome: 'partial',
          feedback: '辅助反馈。',
          dimensions: [
            {
              criterionId: 'reader',
              score: 1,
              feedback: '明确了社团。',
              evidence: [{ quote: 'Reading club', start: 2, end: 14 }]
            }
          ]
        }
      }
    ]
  });
  async function prepare() {
    vi.stubEnv('LEARNING_ALLOWED_ORIGINS', 'https://api.groq.com');
    expect(
      (
        await models(
          context({
            action: 'save',
            shareConsent: true,
            profile: {
              id: 'groq-writing-fixture',
              provider: 'Groq',
              model: 'openai/gpt-oss-20b',
              endpoint: 'https://api.groq.com/openai/v1/chat/completions',
              apiKey: 'fixture-only-groq-key',
              structured: true,
              stream: true
            }
          })
        )
      ).success
    ).toBe(true);
    vi.mocked(callLearningProvider).mockImplementation(async () => ({
      content: JSON.stringify(output()),
      actualModel: 'openai/gpt-oss-20b',
      usage: { prompt_tokens: 28, completion_tokens: 40 },
      durationMs: 1
    }));
  }
  it('实际接口向已核对型号发送绑定编号的严格格式，并按相同推理及输出配置预留、幂等复用', async () => {
    await prepare();
    vi.mocked(callLearningProvider).mockImplementationOnce(async (config, messages) => {
      // 观察真实调用边界，不能在供应商已调用后才修补预算。
      expect(account().calls[0]).toMatchObject({
        status: 'reserved',
        maxOutput: config.maxOutput,
        reasoningEffort: 'low',
        inputByteBound: Buffer.byteLength(JSON.stringify(buildLearningRequest(config, messages)))
      });
      return {
        content: JSON.stringify(output()),
        actualModel: config.model,
        usage: { prompt_tokens: 28, completion_tokens: 40 },
        durationMs: 1
      };
    });
    const result = await ai(context(body()));
    expect(result.success).toBe(true);
    const [config, messages] = vi.mocked(callLearningProvider).mock.calls[0];
    const request: any = buildLearningRequest(config, messages);
    expect(request).toMatchObject({
      max_tokens: 2000,
      reasoning_effort: 'low',
      response_format: { type: 'json_schema', json_schema: { strict: true } }
    });
    const schema = request.response_format.json_schema.schema;
    expect(schema.additionalProperties).toBe(false);
    const args = schema.properties.tools.items.properties.arguments;
    expect(args.required).toContain('rubricId');
    expect(args.properties.rubricId.enum).toEqual(['saved-writing-rubric']);
    expect(args.properties.attemptId.enum).toEqual(['saved-writing-attempt']);
    const score = args.properties.dimensions.items.anyOf[0].properties.score;
    // 数值格式不替代宿主半分和上限校验；供应商不再收到混合数值枚举。
    expect(score.type).toEqual(['number', 'null']);
    expect(score).not.toHaveProperty('enum');
    const savedAccount: any = account();
    expect(savedAccount.calls[0]).toMatchObject({
      outputContract: 'writing-feedback-output-v1',
      inferencePolicy: 'groq-writing-strict-v1',
      maxOutput: 2000,
      reasoningEffort: 'low',
      executionStage: 'received',
      status: 'completed'
    });
    expect(savedAccount.calls[0].schemaDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(savedAccount.calls[0].inputByteBound).toBe(Buffer.byteLength(JSON.stringify(request)));
    expect(savedAccount.profiles[0].maxOutput).toBe(1000);
    expect((await ai(context(body()))).reused).toBe(true);
    expect(callLearningProvider).toHaveBeenCalledOnce();
  });
  it('没有明确反馈标记的历史/普通讲解不启用新参数或格式，即使上下文含量表和原答', async () => {
    await prepare();
    const legacy: any = body();
    delete legacy.feedbackAttemptId;
    delete legacy.feedbackOutputContract;
    expect((await ai(context(legacy))).success).toBe(true);
    const [config, messages] = vi.mocked(callLearningProvider).mock.calls[0];
    expect(buildLearningRequest(config, messages)).toMatchObject({
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });
    expect(buildLearningRequest(config, messages)).not.toHaveProperty('reasoning_effort');
    expect(config.writingOutput).toBeUndefined();
    expect(account().calls[0]).not.toHaveProperty('outputContract');
  });
  for (const invalid of [
    'missing-rubric',
    'scalar-evidence',
    'bad-range',
    'wrong-attempt',
    'extra-tool',
    'fractional-score',
    'excess-score'
  ]) {
    it(`不缓存 ${invalid}，保留真实收到阶段与待结算费用`, async () => {
      await prepare();
      const bad: any = output();
      const args = bad.tools[0].arguments;
      if (invalid === 'missing-rubric') delete args.rubricId;
      if (invalid === 'scalar-evidence') args.dimensions[0].evidence = 'Reading club';
      if (invalid === 'bad-range') args.dimensions[0].evidence[0].start = 0;
      if (invalid === 'wrong-attempt') args.attemptId = 'other';
      if (invalid === 'extra-tool') bad.tools.push({ name: 'progress', arguments: {} });
      if (invalid === 'fractional-score') args.dimensions[0].score = 0.25;
      if (invalid === 'excess-score') args.dimensions[0].score = 2.5;
      vi.mocked(callLearningProvider).mockResolvedValueOnce({
        content: JSON.stringify(bad),
        actualModel: 'openai/gpt-oss-20b',
        usage: { prompt_tokens: 28, completion_tokens: 40 },
        durationMs: 1
      });
      expect((await ai(context(body()))).success).toBe(false);
      const call: any = account().calls[0];
      expect(call).toMatchObject({
        status: 'failed',
        executionStage: 'received',
        actualCost: null,
        costStatus: 'pending'
      });
      expect(call.result).toBeNull();
      expect(call.usage.completion_tokens).toBe(40);
    });
  }
  it('格式版本、原答编号、量表或严格流式不合法时，未预留且未调用供应商', async () => {
    await prepare();
    for (const patch of [
      { feedbackOutputContract: undefined },
      { feedbackOutputContract: 'invented' },
      { feedbackAttemptId: 'other' },
      { learningContext: { ...body().learningContext, question: null } }
    ])
      expect((await ai(context({ ...body(), ...patch }))).success).toBe(false);
    expect((await runLearningModelTask(context(body()), { stream: true })).success).toBe(false);
    expect(account().calls).toEqual([]);
    expect(callLearningProvider).not.toHaveBeenCalled();
    expect(callStreamingLearningProvider).not.toHaveBeenCalled();
  });
});
