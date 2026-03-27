import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    jwtPayload: { userId: 'user_del_1' },
    usersById: {},
    userUpdates: []
  };

  function resetScenario() {
    scenario.jwtPayload = { userId: 'user_del_1' };
    scenario.usersById = {};
    scenario.userUpdates = [];
  }

  const verifyJWT = vi.fn((token) => {
    if (!token) return null;
    return scenario.jwtPayload;
  });

  const mockDb = {
    command: {
      remove: () => ({ $remove: true })
    },
    collection(name) {
      if (name !== 'users') {
        throw new Error(`Unexpected collection: ${name}`);
      }

      return {
        doc(id) {
          return {
            async get() {
              return { data: scenario.usersById[id] || null };
            },
            async update(payload) {
              scenario.userUpdates.push({ id, payload });
              const previous = scenario.usersById[id] || { _id: id };
              scenario.usersById[id] = { ...previous, ...payload };
              return { updated: 1 };
            }
          };
        }
      };
    }
  };

  return {
    scenario,
    resetScenario,
    verifyJWT,
    mockDb
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
  return createApiResponseMock();
});

vi.mock('../../laf-backend/functions/_shared/auth-middleware', () => ({
  requireAuth: (ctx) => {
    // 从 headers.authorization 解析 token
    const token = ctx?.headers?.authorization?.replace('Bearer ', '') || '';
    if (!token) return { code: 401, success: false, message: '请先登录' };
    // 从 login mock 的 verifyJWT 获取 userId
    const payload = mocked.verifyJWT(token);
    if (!payload) return { code: 401, success: false, message: 'token无效' };
    return { userId: payload.userId };
  },
  isAuthError: (result) => result?.code === 401
}));

import accountDeleteHandler from '../../laf-backend/functions/account-delete';

describe('[安全审计] account-delete 显式 action 与失败保护', () => {
  beforeEach(() => {
    mocked.resetScenario();
  });

  it('缺少 action 时应拒绝，避免默认进入 request', async () => {
    mocked.scenario.usersById.user_del_1 = { _id: 'user_del_1', account_status: 'active' };

    const result = await accountDeleteHandler({
      headers: { authorization: 'Bearer token_1' },
      body: {}
    });

    expect(result.code).toBe(400);
    expect(result.message).toContain('action');
    expect(result.requestId).toMatch(/^accdel_/);
    expect(mocked.scenario.userUpdates.length).toBe(0);
  });

  it('request 时用户不存在应返回 404，避免落入 500', async () => {
    const result = await accountDeleteHandler({
      headers: { authorization: 'Bearer token_1' },
      body: { action: 'request' }
    });

    expect(result.code).toBe(404);
    expect(result.success).toBe(false);
    expect(result.requestId).toMatch(/^accdel_/);
  });

  it('request 时应正常写入 pending_deletion 与冷静期时间', async () => {
    mocked.scenario.usersById.user_del_1 = { _id: 'user_del_1', account_status: 'active' };

    const result = await accountDeleteHandler({
      headers: { authorization: 'Bearer token_1' },
      body: { action: 'request' }
    });

    expect(result.code).toBe(0);
    expect(result.success).toBe(true);
    expect(result.requestId).toMatch(/^accdel_/);
    expect(mocked.scenario.userUpdates.length).toBe(1);
    expect(mocked.scenario.userUpdates[0].payload).toEqual(
      expect.objectContaining({
        account_status: 'pending_deletion',
        deletion_requested_at: expect.any(Number),
        deletion_scheduled_at: expect.any(Number),
        updated_at: expect.any(Number)
      })
    );
  });

  it('JWT 无效时应返回 401', async () => {
    mocked.scenario.jwtPayload = null;

    const result = await accountDeleteHandler({
      headers: { authorization: 'Bearer token_1' },
      body: { action: 'status' }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.requestId).toMatch(/^accdel_/);
  });

  it('仅 body.token 不应通过鉴权（应要求 Header Token）', async () => {
    const result = await accountDeleteHandler({
      headers: {},
      body: { action: 'status', token: 'body_token_only' }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.requestId).toMatch(/^accdel_/);
  });

  it('仅 headers.token 不应通过鉴权（应要求 Authorization）', async () => {
    const result = await accountDeleteHandler({
      headers: { token: 'token_header_only' },
      body: { action: 'status' }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.requestId).toMatch(/^accdel_/);
  });
});
