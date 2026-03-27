import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    jwtPayload: { userId: 'rank_user_1' },
    rateAllowed: false
  };

  const verifyJWT = vi.fn(() => scenario.jwtPayload);
  const checkRateLimitDistributed = vi.fn(async () => ({
    allowed: scenario.rateAllowed,
    remaining: scenario.rateAllowed ? 1 : 0,
    resetAt: Date.now() + 30_000,
    source: 'memory'
  }));

  const mockDb = {
    command: {
      inc: (value) => ({ $inc: value }),
      in: (value) => ({ $in: value }),
      neq: (value) => ({ $neq: value })
    },
    collection: () => ({
      where: () => ({
        getOne: async () => ({ data: null }),
        count: async () => ({ total: 0 }),
        update: async () => ({ updated: 1 }),
        orderBy: () => ({
          limit: () => ({
            get: async () => ({ data: [] })
          })
        }),
        get: async () => ({ data: [] })
      }),
      add: async () => ({ id: 'mock_id' })
    })
  };

  function resetScenario() {
    scenario.jwtPayload = { userId: 'rank_user_1' };
    scenario.rateAllowed = false;
    verifyJWT.mockClear();
    checkRateLimitDistributed.mockClear();
  }

  return {
    scenario,
    verifyJWT,
    checkRateLimitDistributed,
    mockDb,
    resetScenario
  };
});

vi.mock('../../laf-backend/functions/login', () => ({
  verifyJWT: mocked.verifyJWT
}));

vi.mock('@lafjs/cloud', () => ({
  default: {
    database: () => mocked.mockDb
  }
}));

vi.mock('../../laf-backend/node_modules/@lafjs/cloud/dist/index.js', () => ({
  default: {
    database: () => mocked.mockDb
  }
}));

vi.mock('../../laf-backend/functions/_shared/api-response', async () => {
  const { createApiResponseMock } = await import('../../tests/__mocks__/api-response-mock.js');
  const mock = createApiResponseMock();
  mock.checkRateLimitDistributed = mocked.checkRateLimitDistributed;
  return mock;
});

vi.mock('../../laf-backend/functions/_shared/auth-middleware', () => ({
  requireAuth: (ctx) => {
    const token = ctx?.headers?.authorization?.replace('Bearer ', '') || '';
    if (!token) return { code: 401, success: false, message: '请先登录' };
    const payload = mocked.verifyJWT(token);
    if (!payload) return { code: 401, success: false, message: 'token无效' };
    return { userId: payload.userId, payload };
  },
  isAuthError: (result) => result?.code === 401
}));

import rankCenterHandler from '../../laf-backend/functions/rank-center';

describe('[安全审计] rank-center 限流语义一致性', () => {
  beforeEach(() => {
    mocked.resetScenario();
  });

  it('update 限流触发时应返回 429（而非 400）', async () => {
    mocked.scenario.rateAllowed = false;

    const result = await rankCenterHandler({
      headers: { authorization: 'Bearer valid_token' },
      body: {
        action: 'update',
        uid: 'spoof_user',
        score: 100,
        nickName: 'Rank User'
      }
    });

    expect(result.code).toBe(429);
    expect(result.success).toBe(false);
    expect(result.message).toContain('频繁');
    expect(result.requestId).toMatch(/^rank_/);
    expect(mocked.verifyJWT).toHaveBeenCalled();
    expect(mocked.checkRateLimitDistributed).toHaveBeenCalledTimes(1);
  });
});
