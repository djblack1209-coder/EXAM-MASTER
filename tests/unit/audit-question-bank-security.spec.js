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

describe('retired public bank security', () => {
  beforeEach(() => {
    mocked.resetScenario();
    mocked.setJwtPayload({ userId: 'token_user' });
  });
  const context = (action, headers = {}, data = {}) => ({
    body: { action, data },
    socket: { remoteAddress: '192.0.2.1' },
    headers
  });
  it.each(['get', 'getByIds', 'random'])('returns 410 without querying or exposing answers for %s', async (action) => {
    const result = await questionBankHandler(context(action, {}, { ids: [1, { $gt: '' }, null], pageSize: 999 }));
    expect(result).toMatchObject({ success: false, code: 410, error: 'QUESTION_BANK_RETIRED' });
    expect(result.data).toBeUndefined();
    expect(mocked.scenario.whereCalls).toEqual([]);
  });
  it('preserves authentication on non-public actions', async () => {
    expect(await questionBankHandler(context('admin_sync'))).toMatchObject({ success: false, code: 401 });
  });
  it('retired public access with an invalid token still returns no content', async () => {
    mocked.setJwtPayload(null);
    expect(await questionBankHandler(context('random', { authorization: 'Bearer invalid_token' }))).toMatchObject({
      success: false,
      code: 410
    });
    expect(mocked.scenario.whereCalls).toEqual([]);
  });
  it('rejects an authenticated caller claiming another owner before retirement handling', async () => {
    const ctx = context('get', { authorization: 'Bearer test' });
    ctx.body.userId = 'another_owner';
    expect(await questionBankHandler(ctx)).toMatchObject({ success: false, code: 403 });
    expect(mocked.scenario.whereCalls).toEqual([]);
  });
});
