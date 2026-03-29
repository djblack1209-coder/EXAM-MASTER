/**
 * QA Round 19: 后端安全回归测试
 *
 * 覆盖：
 * 1. question-bank seed_preset 需要认证
 * 2. group-service 使用 requireAuth 统一认证中间件
 * 3. ai-friend-memory 使用 requireAuth 统一认证中间件 + userId 校验
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock cloud
vi.mock('@lafjs/cloud', () => ({
  default: {
    database: () => ({
      collection: () => ({
        where: () => ({
          getOne: async () => ({ data: null }),
          get: async () => ({ data: [] }),
          count: async () => ({ total: 0 })
        }),
        add: async () => ({ id: 'test_id' }),
        doc: () => ({ update: async () => ({ updated: 1 }), remove: async () => ({}) }),
        limit: () => ({ get: async () => ({ data: [] }) })
      }),
      command: { gt: () => ({}), lt: () => ({}), eq: () => ({}), in: () => ({}) }
    }),
    fetch: async () => ({ data: {} })
  }
}));

// Mock auth-middleware（question-bank 使用 requireAuth）
const mockRequireAuth = vi.fn();
const mockIsAuthError = vi.fn();
vi.mock('../../laf-backend/functions/_shared/auth-middleware', () => ({
  requireAuth: (...args) => mockRequireAuth(...args),
  isAuthError: (...args) => mockIsAuthError(...args)
}));

// Mock admin-auth
const mockRequireAdminAccess = vi.fn();
vi.mock('../../laf-backend/functions/_shared/admin-auth', () => ({
  requireAdminAccess: (...args) => mockRequireAdminAccess(...args)
}));

// Mock api-response（完整版，包含 unauthorized/sanitizeString 等）
vi.mock('../../laf-backend/functions/_shared/api-response', async () => {
  const { createApiResponseMock } = await import('../../tests/__mocks__/api-response-mock.js');
  return {
    ...createApiResponseMock(),
    sanitizeString: (str, maxLen) => (typeof str === 'string' ? str.slice(0, maxLen) : '')
  };
});

// Mock other deps
vi.mock('../../laf-backend/functions/_shared/perf-monitor', () => ({
  perfMonitor: { start: () => () => {} }
}));

// Mock auth（group-service 和 ai-friend-memory 直接使用这些函数做认证）
const mockVerifyJWT = vi.fn();
const mockExtractBearerToken = vi.fn();
vi.mock('../../laf-backend/functions/_shared/auth', () => ({
  verifyJWT: (...args) => mockVerifyJWT(...args),
  extractBearerToken: (...args) => mockExtractBearerToken(...args)
}));

describe('[QA 安全审计] question-bank seed_preset 权限检查', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('seed_preset 无 admin 权限时应返回 403（已修复安全隐患）', async () => {
    // seed_preset 现已添加 requireAdminAccess 检查
    // 普通用户无法导入题目
    mockRequireAuth.mockReturnValue({ userId: 'normal_user' });
    mockIsAuthError.mockReturnValue(false);
    mockRequireAdminAccess.mockReturnValue({ ok: false, code: 403, message: '需要管理员权限' });

    const questionBank = (await import('../../laf-backend/functions/question-bank')).default;
    const ctx = {
      body: { action: 'seed_preset', data: { questions: [{ question: 'test', options: ['A'], answer: 'A' }] } },
      headers: { authorization: 'Bearer valid_token' }
    };

    const result = await questionBank(ctx);
    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('管理员权限');
  });

  it('get 操作不需要 admin 权限', async () => {
    mockRequireAuth.mockReturnValue({ userId: 'user_123' });
    mockIsAuthError.mockReturnValue(false);

    const questionBank = (await import('../../laf-backend/functions/question-bank')).default;
    const ctx = {
      body: { action: 'get', data: {} },
      headers: { authorization: 'Bearer valid_token' }
    };

    const _result = await questionBank(ctx);
    // get 应该正常执行（不调用 requireAdminAccess）
    expect(mockRequireAdminAccess).not.toHaveBeenCalled();
  });
});

describe('[QA 安全审计] group-service 认证（使用 requireAuth 统一中间件）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('无 token 时应返回 401', async () => {
    // requireAuth 在缺少 token 时返回错误响应
    mockRequireAuth.mockReturnValue({ code: 401, success: false, message: '请先登录' });
    mockIsAuthError.mockReturnValue(true);

    const groupService = (await import('../../laf-backend/functions/group-service')).default;
    const ctx = {
      body: { action: 'get_groups' },
      headers: {}
    };

    const result = await groupService(ctx);
    expect(result.code).toBe(401);
    expect(result.message).toContain('登录');
  });

  it('有效 token 时应正常执行', async () => {
    // requireAuth 在有效 token 时返回 userId
    mockRequireAuth.mockReturnValue({ userId: 'user_abc', payload: { userId: 'user_abc' } });
    mockIsAuthError.mockReturnValue(false);

    const groupService = (await import('../../laf-backend/functions/group-service')).default;
    const ctx = {
      body: { action: 'get_groups' },
      headers: { authorization: 'Bearer valid' }
    };

    const result = await groupService(ctx);
    expect(mockRequireAuth).toHaveBeenCalled();
    // 不应崩溃
    expect(result.requestId).toBeDefined();
  });
});

describe('[QA 安全审计] ai-friend-memory 认证 + userId 校验', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('无 token 时应返回 401', async () => {
    // requireAuth 在缺少 token 时返回错误响应
    mockRequireAuth.mockReturnValue({ code: 401, success: false, message: '请先登录' });
    mockIsAuthError.mockReturnValue(true);

    const aiFriendMemory = (await import('../../laf-backend/functions/ai-friend-memory')).default;
    const ctx = {
      body: { action: 'get', friendType: 'study_buddy' },
      headers: {}
    };

    const result = await aiFriendMemory(ctx);
    expect(result.code).toBe(401);
    expect(result.message).toContain('登录');
  });

  it('userId 不匹配时应返回 403', async () => {
    // requireAuth 返回有效用户
    mockRequireAuth.mockReturnValue({ userId: 'real_user', payload: { userId: 'real_user' } });
    mockIsAuthError.mockReturnValue(false);

    const aiFriendMemory = (await import('../../laf-backend/functions/ai-friend-memory')).default;
    const ctx = {
      body: { action: 'get', userId: 'fake_user', friendType: 'buddy' },
      headers: { authorization: 'Bearer valid' }
    };

    const result = await aiFriendMemory(ctx);
    expect(result.code).toBe(403);
  });
});
