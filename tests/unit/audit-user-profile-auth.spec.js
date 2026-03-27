import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    jwtPayload: { userId: 'user_profile_1' },
    userDoc: {
      _id: 'user_profile_1',
      nickname: '测试用户',
      avatar_url: '',
      target_school: '',
      target_major: ''
    }
  };

  const verifyJWT = vi.fn(() => scenario.jwtPayload);

  const mockDb = {
    collection: (name) => ({
      where: (_query) => ({
        getOne: async () => ({ data: name === 'users' ? scenario.userDoc : null }),
        update: async () => ({ updated: 1 })
      }),
      doc: () => ({
        update: async () => ({ updated: 1 })
      })
    })
  };

  const mockCloud = {
    database: () => mockDb,
    storage: {
      bucket: () => ({
        writeFile: async () => undefined,
        getFileUrl: async () => 'https://example.com/avatar.jpg'
      })
    }
  };

  function resetScenario() {
    scenario.jwtPayload = { userId: 'user_profile_1' };
    scenario.userDoc = {
      _id: 'user_profile_1',
      nickname: '测试用户',
      avatar_url: '',
      target_school: '',
      target_major: ''
    };
    verifyJWT.mockClear();
  }

  return {
    scenario,
    verifyJWT,
    mockCloud,
    resetScenario
  };
});

vi.mock('../../laf-backend/functions/login', () => ({
  verifyJWT: mocked.verifyJWT
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

vi.mock('@lafjs/cloud', () => ({
  default: mocked.mockCloud
}));

vi.mock('../../laf-backend/node_modules/@lafjs/cloud/dist/index.js', () => ({
  default: mocked.mockCloud
}));

import userProfileHandler from '../../laf-backend/functions/user-profile';

describe('[安全审计] user-profile 鉴权响应语义', () => {
  beforeEach(() => {
    mocked.resetScenario();
  });

  it('缺少 Authorization 时应返回 401', async () => {
    const result = await userProfileHandler({
      body: { action: 'get', userId: 'user_profile_1' },
      headers: {}
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('认证');
  });

  it('仅 body.token 不应通过鉴权（应要求 Header Token）', async () => {
    const result = await userProfileHandler({
      body: { action: 'get', userId: 'user_profile_1', token: 'body_token_only' },
      headers: {}
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
  });

  it('无效 token 时应返回 401', async () => {
    mocked.scenario.jwtPayload = null;

    const result = await userProfileHandler({
      body: { action: 'get', userId: 'user_profile_1' },
      headers: { authorization: 'Bearer invalid_token' }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('无效');
  });

  it('token 用户与目标用户不一致时应返回 403', async () => {
    mocked.scenario.jwtPayload = { userId: 'another_user' };

    const result = await userProfileHandler({
      body: { action: 'get', userId: 'user_profile_1' },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('无权访问');
  });

  it('token 与目标用户一致时应正常通过鉴权', async () => {
    const result = await userProfileHandler({
      body: { action: 'get', userId: 'user_profile_1' },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(mocked.verifyJWT).toHaveBeenCalledWith('valid_token');
    expect(result.code).toBe(0);
    expect(result.success).toBe(true);
    expect('data' in result ? result.data?._id : undefined).toBe('user_profile_1');
    expect(result.requestId).toMatch(/^UP-/);
  });
});
