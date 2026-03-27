import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  let jwtPayload = { userId: 'token_user' };

  /** @type {any} */
  const scenario = {
    whereCalls: [],
    getResult: { data: [] },
    countResult: { total: 0 }
  };

  function resetScenario() {
    scenario.whereCalls = [];
    scenario.getResult = { data: [] };
    scenario.countResult = { total: 0 };
  }

  function createCollection(name) {
    const collection = {
      where(query) {
        scenario.whereCalls.push({ name, query });
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
      async get() {
        if (typeof scenario.getResult === 'function') {
          return scenario.getResult(name);
        }
        return scenario.getResult;
      },
      async count() {
        if (typeof scenario.countResult === 'function') {
          return scenario.countResult(name);
        }
        return scenario.countResult;
      }
    };

    return collection;
  }

  return {
    scenario,
    resetScenario,
    setJwtPayload(payload) {
      jwtPayload = payload;
    },
    getJwtPayload() {
      return jwtPayload;
    },
    mockDb: {
      command: {
        in(values) {
          return { $in: values };
        }
      },
      collection(name) {
        return createCollection(name);
      }
    }
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
  verifyJWT: vi.fn(() => mocked.getJwtPayload())
}));

vi.mock('../../laf-backend/functions/_shared/api-response', async () => {
  const { createApiResponseMock } = await import('../../tests/__mocks__/api-response-mock.js');
  return createApiResponseMock();
});

vi.mock('../../laf-backend/functions/_shared/auth-middleware', () => ({
  requireAuth: (ctx) => {
    const token = ctx?.headers?.authorization?.replace('Bearer ', '') || '';
    if (!token) return { code: 401, success: false, message: '请先登录' };
    const payload = mocked.getJwtPayload();
    if (!payload) return { code: 401, success: false, message: '登录已过期，请重新登录' };
    return { userId: payload.userId };
  },
  isAuthError: (result) => result?.code === 401
}));

import questionBankHandler from '../../laf-backend/functions/question-bank';

describe('[安全审计] question-bank 安全防护', () => {
  beforeEach(() => {
    mocked.resetScenario();
    mocked.setJwtPayload({ userId: 'token_user' });
  });

  it('get 应过滤答案字段并限制分页参数', async () => {
    mocked.scenario.getResult = {
      data: [
        {
          _id: 'q1',
          question: '1+1=?',
          answer: '2',
          correct_answer: '2',
          analysis: 'basic math'
        }
      ]
    };
    mocked.scenario.countResult = { total: 205 };

    const result = /** @type {any} */ (
      await questionBankHandler({
        body: {
          action: 'get',
          data: {
            category: { $ne: null },
            difficulty: 'easy',
            keyword: 'math',
            page: -5,
            pageSize: 999
          }
        },
        headers: {}
      })
    );

    expect(result.code).toBe(0);
    expect(result.data.page).toBe(1);
    expect(result.data.pageSize).toBe(100);
    expect(result.data.hasMore).toBe(true);
    expect(result.data.list[0].answer).toBeUndefined();
    expect(result.data.list[0].correct_answer).toBeUndefined();

    const whereCall = mocked.scenario.whereCalls.find((item) => item.name === 'questions');
    expect(whereCall).toBeTruthy();
    expect(whereCall.query.is_active).toBe(true);
    expect(whereCall.query.review_status).toBe('approved');
    expect(whereCall.query.difficulty).toBe('easy');
    expect(whereCall.query.category).toBeUndefined();
  });

  it('getByIds 应拒绝非法 ID 列表', async () => {
    const result = /** @type {any} */ (
      await questionBankHandler({
        body: {
          action: 'getByIds',
          data: {
            ids: [1, { $gt: '' }, null]
          }
        },
        headers: {}
      })
    );

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('不合法');
  });

  it('getByIds 应仅使用安全字符串 ID 并过滤答案字段', async () => {
    mocked.scenario.getResult = {
      data: [
        {
          _id: 'id_1',
          question: 'test',
          answer: 'A',
          correct_answer: 'A',
          difficulty: 'medium'
        }
      ]
    };

    const result = /** @type {any} */ (
      await questionBankHandler({
        body: {
          action: 'getByIds',
          data: {
            ids: ['id_1', '', 'id_2', 123]
          }
        },
        headers: {}
      })
    );

    expect(result.code).toBe(0);
    expect(result.data[0].answer).toBeUndefined();
    expect(result.data[0].correct_answer).toBeUndefined();

    const whereCall = mocked.scenario.whereCalls.find((item) => item.name === 'questions');
    expect(whereCall.query._id.$in).toEqual(['id_1', 'id_2']);
  });

  it('非公开 action 缺少 token 时应返回 401', async () => {
    const result = /** @type {any} */ (
      await questionBankHandler({
        body: {
          action: 'admin_sync',
          data: {}
        },
        headers: {}
      })
    );

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
  });

  it('公开 action 即使 token 无效也应正常执行（random 在 publicActions 中）', async () => {
    mocked.setJwtPayload(null);

    const result = /** @type {any} */ (
      await questionBankHandler({
        body: {
          action: 'random',
          data: { count: 1 }
        },
        headers: {
          authorization: 'Bearer invalid_token'
        }
      })
    );

    // random 是 publicAction，即使 token 无效也应正常执行（code=0），不返回 401
    expect(result.code).toBe(0);
  });
});
