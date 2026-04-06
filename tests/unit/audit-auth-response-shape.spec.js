import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    jwtPayload: { userId: 'user_auth_1' }
  };

  const verifyJWT = vi.fn(() => scenario.jwtPayload);

  function createCollection() {
    const collection = {
      where: () => collection,
      field: () => collection,
      orderBy: () => collection,
      skip: () => collection,
      limit: () => collection,
      aggregate: () => ({
        match: () => ({
          group: () => ({
            end: async () => ({ data: [] })
          }),
          sample: () => ({
            end: async () => ({ data: [] })
          })
        })
      }),
      get: async () => ({ data: [] }),
      getOne: async () => ({ data: null }),
      count: async () => ({ total: 0 }),
      add: async () => ({ id: 'mock_id', ids: ['mock_id'] }),
      remove: async () => ({ deleted: 0 }),
      doc: () => ({
        update: async () => ({ updated: 1 }),
        remove: async () => ({ deleted: 1 })
      })
    };

    return collection;
  }

  const mockDb = {
    command: {
      gte: (value) => ({ $gte: value }),
      in: (value) => ({ $in: value })
    },
    collection: () => createCollection()
  };

  function resetScenario() {
    scenario.jwtPayload = { userId: 'user_auth_1' };
    verifyJWT.mockClear();
  }

  return {
    scenario,
    verifyJWT,
    mockDb,
    resetScenario
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
  verifyJWT: mocked.verifyJWT
}));

vi.mock('../../laf-backend/functions/_shared/auth', () => ({
  verifyJWT: mocked.verifyJWT,
  extractBearerToken: (rawToken) => {
    if (typeof rawToken !== 'string') return '';
    const trimmed = rawToken.trim();
    const match = trimmed.match(/^Bearer(?:\s+(.+))?$/i);
    return match ? (match[1] || '').trim() : trimmed;
  }
}));

// ai-friend-memory 现在使用 requireAuth 统一认证中间件
vi.mock('../../laf-backend/functions/_shared/auth-middleware', () => ({
  requireAuth: (ctx) => {
    const payload = mocked.scenario.jwtPayload;
    const rawToken = ctx.headers?.['authorization'] || ctx.headers?.Authorization;
    if (!rawToken) {
      return { code: 401, success: false, message: '请先登录' };
    }
    if (!payload || !payload.userId) {
      return { code: 401, success: false, message: '登录已过期，请重新登录' };
    }
    return { userId: payload.userId, payload };
  },
  isAuthError: (result) => 'code' in result && result.code !== 0
}));

// study-stats 已被 user-stats 替代并删除（H028），相关测试用例同步移除
import aiFriendMemoryHandler from '../../laf-backend/functions/ai-friend-memory';
import questionBankHandler from '../../laf-backend/functions/question-bank';

describe('[安全审计] 鉴权失败响应形态一致性', () => {
  beforeEach(() => {
    mocked.resetScenario();
  });

  // study-stats 相关测试用例已移除（H028: 云函数被 user-stats 替代并删除）

  it('ai-friend-memory 缺少 token 时应返回 success=false', async () => {
    const result = /** @type {any} */ (
      await aiFriendMemoryHandler({
        headers: {},
        body: { action: 'get', userId: 'user_auth_1' }
      })
    );

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('登录');
  });

  it('ai-friend-memory userId 不匹配时应返回 403 且 success=false', async () => {
    mocked.scenario.jwtPayload = { userId: 'real_user' };

    const result = /** @type {any} */ (
      await aiFriendMemoryHandler({
        headers: { authorization: 'Bearer valid_token' },
        body: { action: 'get', userId: 'spoof_user' }
      })
    );

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('身份验证失败');
  });

  it('ai-friend-memory 缺少 action 时应返回 400 且 success=false', async () => {
    const result = /** @type {any} */ (
      await aiFriendMemoryHandler({
        headers: { authorization: 'Bearer valid_token' },
        body: { userId: 'user_auth_1' }
      })
    );

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('缺少 action');
  });

  it('question-bank token 无效时，非公开 action 应返回 success=false', async () => {
    mocked.scenario.jwtPayload = null;

    const result = /** @type {any} */ (
      await questionBankHandler({
        headers: { authorization: 'Bearer invalid_token' },
        body: { action: 'admin_sync', userId: 'user_auth_1', data: {} }
      })
    );

    // admin_sync 不在 publicActions 中，无效 token 应返回 401
    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
  });

  it('question-bank userId 不匹配时应返回 403 且 success=false', async () => {
    mocked.scenario.jwtPayload = { userId: 'real_user' };

    const result = /** @type {any} */ (
      await questionBankHandler({
        headers: { authorization: 'Bearer valid_token' },
        body: { action: 'get', userId: 'spoof_user', data: {} }
      })
    );

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('身份验证失败');
  });

  it('question-bank 未认证且缺少 action 时应返回 401（不暴露参数要求）', async () => {
    const result = /** @type {any} */ (
      await questionBankHandler({
        headers: {},
        body: { data: {} }
      })
    );

    // 防御纵深：未认证时优先返回 401，不向未登录用户暴露接口参数要求
    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('认证');
  });
});
