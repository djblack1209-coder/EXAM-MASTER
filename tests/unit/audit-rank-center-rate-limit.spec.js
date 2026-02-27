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

vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  sanitizeString: (value) => String(value ?? ''),
  validateUserId: (value) => typeof value === 'string' && value.length > 0,
  success: (data, message = 'success') => ({ code: 0, success: true, message, data }),
  badRequest: (message = 'bad request') => ({ code: 400, success: false, message }),
  tooManyRequests: (message = 'too many requests') => ({ code: 429, success: false, message }),
  unauthorized: (message = 'unauthorized') => ({ code: 401, success: false, message }),
  serverError: (message = 'server error') => ({ code: 500, success: false, message }),
  generateRequestId: () => 'rank_test_req',
  checkRateLimitDistributed: mocked.checkRateLimitDistributed
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
    expect(result.requestId).toBe('rank_test_req');
    expect(mocked.verifyJWT).toHaveBeenCalledWith('valid_token');
    expect(mocked.checkRateLimitDistributed).toHaveBeenCalledTimes(1);
  });
});
