import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  let jwtPayload = { userId: 'token_user' };

  const scenario = {
    whereCalls: [],
    updateCalls: [],
    docGets: [],
    docGetData: {
      users: (id) => ({ data: { _id: id, achievements: [] } })
    }
  };

  function resetScenario() {
    scenario.whereCalls = [];
    scenario.updateCalls = [];
    scenario.docGets = [];
    scenario.docGetData = {
      users: (id) => ({ data: { _id: id, achievements: [] } })
    };
  }

  function createCollection(name) {
    const state = { query: null };

    const collection = {
      where(query) {
        state.query = query;
        scenario.whereCalls.push({ name, query });
        return collection;
      },
      async update(payload) {
        scenario.updateCalls.push({ name, query: state.query, payload });
        return { updated: 1 };
      },
      async getOne() {
        return { data: null };
      },
      doc(id) {
        scenario.docGets.push({ name, id });
        return {
          async get() {
            const resolver = scenario.docGetData[name];
            if (typeof resolver === 'function') {
              return resolver(id);
            }
            return resolver || { data: null };
          },
          async update(payload) {
            scenario.updateCalls.push({ name, id, payload });
            return { updated: 1 };
          }
        };
      }
    };

    return collection;
  }

  const mockDb = {
    command: {
      neq: (value) => ({ $ne: value }),
      push: (value) => ({ $push: value })
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
    if (!token) return { code: 401, success: false, message: '请先登录', timestamp: Date.now() };
    const payload = mocked.getJwtPayload();
    if (!payload) return { code: 401, success: false, message: '登录已过期，请重新登录', timestamp: Date.now() };
    return { userId: payload.userId };
  },
  isAuthError: (result) => result?.code === 401
}));

import achievementManagerHandler from '../../laf-backend/functions/achievement-manager';

describe('[安全审计] achievement-manager 认证与IDOR防护', () => {
  beforeEach(() => {
    mocked.resetScenario();
    mocked.setJwtPayload({ userId: 'token_user' });
  });

  it('读取操作缺少 token 时应拒绝', async () => {
    const result = await achievementManagerHandler({
      body: {
        action: 'getAll',
        userId: 'victim_user',
        data: {}
      },
      headers: {}
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
  });

  it('仅 body.token 时应拒绝（要求 Header Token）', async () => {
    const result = await achievementManagerHandler({
      body: {
        action: 'getAll',
        token: 'body_token_only',
        userId: 'victim_user',
        data: {}
      },
      headers: {}
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
  });

  it('读取操作应忽略伪造 userId，强制使用 token 用户', async () => {
    mocked.setJwtPayload({ userId: 'real_user' });
    mocked.scenario.docGetData.users = (id) => ({
      data: { _id: id, achievements: [{ id: 'first_login', unlocked_at: 111 }] }
    });

    const result = await achievementManagerHandler({
      body: {
        action: 'getAll',
        userId: 'spoof_user',
        data: {}
      },
      headers: {
        authorization: 'Bearer valid_token'
      }
    });

    expect(result.code).toBe(0);
    const usersDoc = mocked.scenario.docGets.find((item) => item.name === 'users');
    expect(usersDoc).toBeTruthy();
    expect(usersDoc.id).toBe('real_user');
  });

  it('unlock 应仅更新 token 用户的成就数据', async () => {
    mocked.setJwtPayload({ userId: 'owner_user' });

    const result = await achievementManagerHandler({
      body: {
        action: 'unlock',
        userId: 'attacker_user',
        data: {
          achievementId: 'first_login'
        }
      },
      headers: {
        authorization: 'Bearer valid_token'
      }
    });

    expect(result.code).toBe(0);
    const updateCall = mocked.scenario.updateCalls.find((item) => item.name === 'users' && item.query);
    expect(updateCall).toBeTruthy();
    expect(updateCall.query._id).toBe('owner_user');
  });
});
