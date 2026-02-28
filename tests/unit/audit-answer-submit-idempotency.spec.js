import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    jwtPayload: { userId: 'ans_user_1' },
    getOne: {}
  };

  function resetScenario() {
    scenario.jwtPayload = { userId: 'ans_user_1' };
    scenario.getOne = {};
  }

  function createCollection(name) {
    const state = { query: null };

    const collection = {
      where(query) {
        state.query = query;
        return collection;
      },
      orderBy() {
        return collection;
      },
      skip() {
        return collection;
      },
      limit() {
        return collection;
      },
      async getOne() {
        return scenario.getOne[name] || { data: null };
      },
      async get() {
        return { data: [] };
      },
      async count() {
        return { total: 0 };
      },
      async add() {
        return { id: `${name}_id` };
      },
      async update() {
        return { updated: 1 };
      },
      doc() {
        return {
          async update() {
            return { updated: 1 };
          }
        };
      }
    };

    return collection;
  }

  const mockDb = {
    command: {
      gt: (value) => ({ $gt: value }),
      inc: (value) => ({ $inc: value })
    },
    collection(name) {
      return createCollection(name);
    }
  };

  return {
    scenario,
    resetScenario,
    mockDb
  };
});

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

vi.mock('../../laf-backend/functions/login', () => ({
  verifyJWT: vi.fn(() => mocked.scenario.jwtPayload)
}));

vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  badRequest: (message = 'bad request') => ({ code: 400, success: false, message }),
  unauthorized: (message = 'unauthorized') => ({ code: 401, success: false, message }),
  serverError: (message = 'server error', error) => ({ code: 500, success: false, message, error }),
  generateRequestId: () => 'ans_test_req',
  wrapResponse: (response, requestId) => ({ ...response, requestId, duration: 1 }),
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  checkRateLimitDistributed: vi.fn(async () => ({
    allowed: true,
    remaining: 119,
    resetAt: Date.now() + 60000,
    source: 'memory'
  }))
}));

import answerSubmitHandler from '../../laf-backend/functions/answer-submit';

describe('[安全审计] answer-submit 幂等响应一致性', () => {
  beforeEach(() => {
    mocked.resetScenario();
  });

  it('幂等处理中重复提交应返回 429 且 success=false', async () => {
    mocked.scenario.getOne.idempotency_records = {
      data: {
        _id: 'idem_processing_1',
        status: 'processing',
        created_at: Date.now()
      }
    };

    const result = /** @type {any} */ (
      await answerSubmitHandler({
        body: {
          action: 'submit',
          idempotencyKey: 'idem_processing_1',
          data: {
            question_id: 'q_1',
            user_answer: 'A',
            session_id: 'session_1',
            duration: 5,
            practice_mode: 'normal'
          }
        },
        headers: {
          authorization: 'Bearer valid_token'
        }
      })
    );

    expect(result.code).toBe(429);
    expect(result.success).toBe(false);
    expect(result.message).toContain('请求正在处理中');
    expect(result.isDuplicate).toBe(true);
    expect(result.requestId).toBe('ans_test_req');
  });
});
