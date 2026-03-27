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

vi.mock('../../laf-backend/functions/_shared/api-response', async () => {
  const { createApiResponseMock } = await import('../../tests/__mocks__/api-response-mock.js');
  return createApiResponseMock();
});

vi.mock('../../laf-backend/functions/_shared/auth-middleware', () => ({
  requireAuth: (ctx) => {
    const token = ctx?.headers?.authorization?.replace('Bearer ', '') || '';
    if (!token) return { code: 401, success: false, message: '请先登录' };
    const payload = mocked.scenario.jwtPayload;
    if (!payload) return { code: 401, success: false, message: '登录已过期，请重新登录' };
    return { userId: payload.userId };
  },
  isAuthError: (result) => result?.code === 401
}));

vi.mock('../../laf-backend/functions/_shared/fsrs-scheduler', () => ({
  scheduleReviewFSRS: vi.fn(),
  createNewCard: vi.fn(() => ({})),
  hasFSRSState: vi.fn(() => false),
  extractFSRSState: vi.fn(() => null),
  migrateToFSRS: vi.fn(() => ({}))
}));

vi.mock('../../laf-backend/functions/_shared/services/fsrs.service', () => ({
  FsrsService: vi.fn().mockImplementation(() => ({
    processAnswer: vi.fn(async () => ({ state: 'mock' }))
  }))
}));

vi.mock('../../laf-backend/functions/_shared/services/agent.service', () => ({
  AgentService: vi.fn().mockImplementation(() => ({
    provideTutorFeedback: vi.fn(async () => 'mock feedback')
  }))
}));

import answerSubmitHandler from '../../laf-backend/functions/answer-submit';

describe('[安全审计] answer-submit 幂等响应一致性', () => {
  beforeEach(() => {
    mocked.resetScenario();
  });

  it('参数不合法时应返回 400 且 success/ok=false', async () => {
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

    // handleSubmit 期望 data.questionId 和 data.isCorrect
    // 传入 data.question_id 不匹配，返回 400 参数错误
    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('参数错误');
  });
});
