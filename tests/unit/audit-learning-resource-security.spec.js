import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  let jwtPayload = { userId: 'user_token' };

  const scenario = {
    whereCalls: [],
    addCalls: [],
    updateCalls: [],
    getOne: {},
    get: {},
    count: {},
    docGet: {}
  };

  function resetScenario() {
    scenario.whereCalls = [];
    scenario.addCalls = [];
    scenario.updateCalls = [];
    scenario.getOne = {};
    scenario.get = {};
    scenario.count = {};
    scenario.docGet = {};
  }

  function resolveResult(store, name, payload, fallback) {
    const handler = store[name];
    if (typeof handler === 'function') {
      return handler(payload);
    }
    if (handler !== undefined) {
      return handler;
    }
    return fallback;
  }

  function createCollection(name) {
    const state = {
      query: null,
      skip: 0,
      limit: 0,
      orderBy: null
    };

    const collection = {
      where(query) {
        state.query = query;
        scenario.whereCalls.push({ name, query });
        return collection;
      },
      orderBy(field, order) {
        state.orderBy = { field, order };
        return collection;
      },
      skip(value) {
        state.skip = value;
        return collection;
      },
      limit(value) {
        state.limit = value;
        return collection;
      },
      field() {
        return collection;
      },
      async get() {
        return resolveResult(scenario.get, name, state, { data: [] });
      },
      async getOne() {
        return resolveResult(scenario.getOne, name, state, { data: null });
      },
      async count() {
        return resolveResult(scenario.count, name, state, { total: 0 });
      },
      async add(payload) {
        scenario.addCalls.push({ name, payload });
        return { id: 'mock_id', ids: ['mock_id'] };
      },
      async update(payload) {
        scenario.updateCalls.push({ name, query: state.query, payload });
        return { updated: 1 };
      },
      async remove() {
        return { deleted: 1 };
      },
      doc(id) {
        return {
          async get() {
            return resolveResult(scenario.docGet, name, id, { data: null });
          },
          async update(payload) {
            scenario.updateCalls.push({ name, id, payload });
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
      in: (arr) => ({ $in: arr }),
      gte: (value) => ({ $gte: value }),
      inc: (value) => ({ $inc: value })
    },
    RegExp: (options) => options,
    collection: (name) => createCollection(name)
  };

  const checkRateLimitMock = vi.fn((_key, _limit, _windowMs) => ({ allowed: true, remaining: 9 }));

  return {
    scenario,
    resetScenario,
    mockDb,
    checkRateLimitMock,
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
  const mock = createApiResponseMock();
  mock.checkRateLimit = (key, limit, windowMs) => mocked.checkRateLimitMock(key, limit, windowMs);
  return mock;
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

vi.mock('../../laf-backend/functions/_shared/validator', () => ({
  validate: vi.fn(() => ({ valid: true, errors: [] }))
}));

import learningResourceHandler from '../../laf-backend/functions/learning-resource';

describe('[安全审计] learning-resource 关键防护', () => {
  beforeEach(() => {
    mocked.setJwtPayload({ userId: 'user_token' });
    mocked.checkRateLimitMock.mockClear();
    mocked.checkRateLimitMock.mockReturnValue({ allowed: true, remaining: 9 });
    mocked.resetScenario();
  });

  it('敏感操作缺少 token 时应拒绝', async () => {
    const result = await learningResourceHandler({
      body: {
        action: 'recordProgress',
        userId: 'spoof_user',
        data: { resourceId: 'res_1', progress: 20 }
      },
      headers: {}
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
  });

  it('仅 body.token 不应通过敏感操作鉴权', async () => {
    const result = await learningResourceHandler({
      body: {
        action: 'recordProgress',
        token: 'body_token_only',
        userId: 'spoof_user',
        data: { resourceId: 'res_1', progress: 20 }
      },
      headers: {}
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
  });

  it('收藏不存在资源应返回 404，避免脏收藏记录', async () => {
    mocked.scenario.docGet.learning_resources = { data: null };

    const result = await learningResourceHandler({
      body: {
        action: 'favorite',
        userId: 'spoof_user',
        data: { resourceId: 'res_missing', action: 'add' }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(result.code).toBe(404);
    expect(result.success).toBe(false);
    const favoriteAdd = mocked.scenario.addCalls.find((item) => item.name === 'resource_favorites');
    expect(favoriteAdd).toBeUndefined();
  });

  it('recordProgress 应使用 token 用户并限制进度与时长上限', async () => {
    mocked.setJwtPayload({ userId: 'real_user' });
    mocked.scenario.docGet.learning_resources = { data: { _id: 'res_1', status: 'published' } };
    mocked.scenario.getOne.learning_progress = { data: null };

    const result = await learningResourceHandler({
      body: {
        action: 'recordProgress',
        userId: 'spoof_user',
        data: {
          resourceId: 'res_1',
          progress: 999,
          duration: 999999
        }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(result.code).toBe(0);

    const progressAdd = mocked.scenario.addCalls.find((item) => item.name === 'learning_progress');
    expect(progressAdd).toBeTruthy();
    expect(progressAdd.payload.user_id).toBe('real_user');
    expect(progressAdd.payload.progress).toBe(100);
    expect(progressAdd.payload.total_duration).toBe(24 * 60 * 60);
  });

  it('getUserFavorites 应忽略请求体 userId，防止 IDOR', async () => {
    mocked.setJwtPayload({ userId: 'owner_user' });
    mocked.scenario.get.resource_favorites = { data: [] };
    mocked.scenario.count.resource_favorites = { total: 0 };

    const result = await learningResourceHandler({
      body: {
        action: 'getUserFavorites',
        userId: 'spoof_user',
        data: { page: 1, limit: 20 }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(result.code).toBe(0);
    const favoriteQuery = mocked.scenario.whereCalls.find((item) => item.name === 'resource_favorites');
    expect(favoriteQuery).toBeTruthy();
    expect(favoriteQuery.query.user_id).toBe('owner_user');
  });

  it('公开操作在无 token 时应忽略 body.userId，并按 IP 维度限流', async () => {
    const result = await learningResourceHandler({
      body: {
        action: 'getHotResources',
        userId: 'spoof_user',
        data: { period: 'week' }
      },
      headers: { 'x-real-ip': '1.2.3.4' }
    });

    expect(result.code).toBe(0);
    expect(mocked.checkRateLimitMock).toHaveBeenCalledWith('lr_ip_1.2.3.4', 60, 60000);
  });

  it('非法 category 参数应被拒绝，避免查询污染', async () => {
    const result = await learningResourceHandler({
      body: {
        action: 'getHotResources',
        data: { category: '$ne_hack', period: 'all' }
      },
      headers: {}
    });

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
  });

  it('search 的非法 subject 参数应被拒绝', async () => {
    const result = await learningResourceHandler({
      body: {
        action: 'search',
        data: { keyword: '考研', subject: 'DROP_TABLE' }
      },
      headers: {}
    });

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
  });
});
