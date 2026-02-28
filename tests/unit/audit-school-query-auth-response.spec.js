import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    jwtPayload: /** @type {any} */ ({ userId: 'school_user_1' })
  };

  const verifyJWT = vi.fn(() => scenario.jwtPayload);

  const mockDb = {
    command: {
      in: (value) => ({ $in: value })
    },
    collection: () => ({
      where: () => ({
        getOne: async () => ({ data: null }),
        get: async () => ({ data: [] }),
        remove: async () => ({ deleted: 0 })
      }),
      add: async () => ({ id: 'mock_id' })
    })
  };

  function resetScenario() {
    scenario.jwtPayload = { userId: 'school_user_1' };
    verifyJWT.mockClear();
  }

  return {
    scenario,
    verifyJWT,
    mockDb,
    resetScenario
  };
});

vi.mock('../../laf-backend/functions/_shared/auth', () => ({
  verifyJWT: mocked.verifyJWT,
  extractBearerToken: (rawToken) => {
    if (typeof rawToken !== 'string') return '';
    const trimmed = rawToken.trim();
    const match = trimmed.match(/^Bearer(?:\s+(.+))?$/i);
    return match ? (match[1] || '').trim() : trimmed;
  }
}));

vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
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

import schoolQueryHandler from '../../laf-backend/functions/school-query';

describe('[安全审计] school-query 鉴权响应形态一致性', () => {
  beforeEach(() => {
    mocked.resetScenario();
  });

  it('缺少 action 时应返回 400 且 success=false', async () => {
    const result = await schoolQueryHandler({
      headers: {},
      body: {}
    });

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('缺少 action');
  });

  it('未知 action 时应返回 400 且 success=false', async () => {
    const result = await schoolQueryHandler({
      headers: {},
      body: { action: 'unknown_action', data: {} }
    });

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('未知的 action');
  });

  it('收藏类操作缺少 token 时应返回 401 且 success=false', async () => {
    const result = await schoolQueryHandler({
      headers: {},
      body: { action: 'add_favorite', data: { schoolId: 's_1' } }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('需要登录');
  });

  it('携带无效 token 时应返回 401 且 success=false', async () => {
    mocked.scenario.jwtPayload = null;

    const result = await schoolQueryHandler({
      headers: { authorization: 'Bearer invalid_token' },
      body: { action: 'list', data: {} }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('token 无效或已过期');
  });

  it('token 缺少 userId 时，收藏操作应返回 401 且 success=false', async () => {
    mocked.scenario.jwtPayload = {};

    const result = await schoolQueryHandler({
      headers: { authorization: 'Bearer valid_token' },
      body: { action: 'get_favorites', data: {} }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('未登录');
  });

  it('sync_from_chsi 缺少管理员密钥时应返回 403 且带 requestId', async () => {
    process.env.ADMIN_SECRET = 'test_secret_for_sync';

    const result = await schoolQueryHandler({
      headers: {},
      body: { action: 'sync_from_chsi', data: {} }
    });

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('无权执行');
    expect(result.requestId).toMatch(/^school_/);
  });
});
