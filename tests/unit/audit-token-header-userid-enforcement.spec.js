import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  let jwtPayload = { userId: 'token_user' };

  const scenario = {
    whereCalls: [],
    docCalls: [],
    getData: {},
    getOneData: {},
    countData: {}
  };

  function resetScenario() {
    scenario.whereCalls = [];
    scenario.docCalls = [];
    scenario.getData = {};
    scenario.getOneData = {};
    scenario.countData = {};
  }

  function resolve(store, name, payload, fallback) {
    const resolver = store[name];
    if (typeof resolver === 'function') return resolver(payload);
    if (resolver !== undefined) return resolver;
    return fallback;
  }

  function createCollection(name) {
    const state = { query: null, skip: 0, limit: 0, orderBy: null };

    const collection = {
      where(query) {
        state.query = query;
        scenario.whereCalls.push({ name, query });
        return collection;
      },
      orderBy(field, direction) {
        state.orderBy = { field, direction };
        return collection;
      },
      limit(value) {
        state.limit = value;
        return collection;
      },
      skip(value) {
        state.skip = value;
        return collection;
      },
      field() {
        return collection;
      },
      async get() {
        return resolve(scenario.getData, name, state, { data: [] });
      },
      async getOne() {
        return resolve(scenario.getOneData, name, state, { data: null });
      },
      async count() {
        return resolve(scenario.countData, name, state, { total: 0 });
      },
      async add() {
        return { id: 'mock_id', ids: ['mock_id'] };
      },
      async update() {
        return { updated: 1 };
      },
      doc(id) {
        scenario.docCalls.push({ name, id });
        return {
          async get() {
            if (name === 'users') {
              return { data: { _id: id, total_questions: 120, streak_days: 9 } };
            }
            return { data: null };
          },
          async update() {
            return { updated: 1 };
          },
          async remove() {
            return { deleted: 1 };
          }
        };
      }
    };

    return collection;
  }

  const mockDb = {
    command: {
      gt: (value) => ({ $gt: value }),
      gte: (value) => ({ $gte: value }),
      lte: (value) => ({ $lte: value }),
      inc: (value) => ({ $inc: value })
    },
    collection(name) {
      return createCollection(name);
    }
  };

  return {
    mockDb,
    scenario,
    resetScenario,
    getJwtPayload: () => jwtPayload,
    setJwtPayload: (value) => {
      jwtPayload = value;
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

import learningGoalHandler from '../../laf-backend/functions/learning-goal';
import userStatsHandler from '../../laf-backend/functions/user-stats';

describe('[安全审计] token来源兼容与userId强制绑定', () => {
  beforeEach(() => {
    mocked.resetScenario();
    mocked.setJwtPayload({ userId: 'token_user' });
  });

  it('learning-goal 应支持 Authorization 头并忽略 body 的 userId 伪造', async () => {
    mocked.setJwtPayload({ userId: 'goal_owner' });
    mocked.scenario.getData.learning_goals = { data: [] };

    const result = await learningGoalHandler({
      body: {
        action: 'get',
        userId: 'spoof_user',
        data: {}
      },
      headers: {
        authorization: 'Bearer valid_token'
      }
    });

    expect(result.code).toBe(0);
    const queryCall = mocked.scenario.whereCalls.find((item) => item.name === 'learning_goals');
    expect(queryCall).toBeTruthy();
    expect(queryCall.query.user_id).toBe('goal_owner');
  });

  it('user-stats 应支持 Authorization 头并忽略 body 的 userId 伪造', async () => {
    mocked.setJwtPayload({ userId: 'stats_owner' });
    mocked.scenario.countData.users = (state) => (state.query ? { total: 8 } : { total: 100 });

    const result = await userStatsHandler({
      body: {
        action: 'getRankInfo',
        userId: 'spoof_user',
        data: {}
      },
      headers: {
        authorization: 'Bearer valid_token'
      }
    });

    expect(result.code).toBe(0);
    const userDocCall = mocked.scenario.docCalls.find((item) => item.name === 'users');
    expect(userDocCall).toBeTruthy();
    expect(userDocCall.id).toBe('stats_owner');
  });

  it('learning-goal 仅 body.token 时应拒绝（要求 Header Token）', async () => {
    const result = await learningGoalHandler({
      body: {
        action: 'get',
        token: 'body_token_only',
        userId: 'spoof_user',
        data: {}
      },
      headers: {}
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
  });

  it('user-stats 仅 body.token 时应拒绝（要求 Header Token）', async () => {
    const result = await userStatsHandler({
      body: {
        action: 'getRankInfo',
        token: 'body_token_only',
        userId: 'spoof_user',
        data: {}
      },
      headers: {}
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
  });
});
