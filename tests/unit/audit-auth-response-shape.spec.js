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

import studyStatsHandler from '../../laf-backend/functions/study-stats';
import aiFriendMemoryHandler from '../../laf-backend/functions/ai-friend-memory';
import questionBankHandler from '../../laf-backend/functions/question-bank';

describe('[安全审计] 鉴权失败响应形态一致性', () => {
  beforeEach(() => {
    mocked.resetScenario();
  });

  it('study-stats 缺少 token 时应返回 success=false', async () => {
    const result = await studyStatsHandler({
      headers: {},
      body: { action: 'get', userId: 'user_auth_1' }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('缺少认证 token');
  });

  it('study-stats token 无效时应返回 success=false', async () => {
    mocked.scenario.jwtPayload = null;

    const result = await studyStatsHandler({
      headers: { authorization: 'Bearer invalid_token' },
      body: { action: 'get', userId: 'user_auth_1' }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('token 无效或已过期');
  });

  it('study-stats userId 不匹配时应返回 403 且 success=false', async () => {
    mocked.scenario.jwtPayload = { userId: 'real_user' };

    const result = await studyStatsHandler({
      headers: { authorization: 'Bearer valid_token' },
      body: { action: 'get', userId: 'spoof_user' }
    });

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('身份验证失败');
  });

  it('study-stats 缺少 action 时应返回 400 且 success=false', async () => {
    const result = await studyStatsHandler({
      headers: { authorization: 'Bearer valid_token' },
      body: { userId: 'user_auth_1' }
    });

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('缺少 action');
  });

  it('ai-friend-memory 缺少 token 时应返回 success=false', async () => {
    const result = await aiFriendMemoryHandler({
      headers: {},
      body: { action: 'get', userId: 'user_auth_1' }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('缺少认证 token');
  });

  it('ai-friend-memory userId 不匹配时应返回 403 且 success=false', async () => {
    mocked.scenario.jwtPayload = { userId: 'real_user' };

    const result = await aiFriendMemoryHandler({
      headers: { authorization: 'Bearer valid_token' },
      body: { action: 'get', userId: 'spoof_user' }
    });

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('身份验证失败');
  });

  it('ai-friend-memory 缺少 action 时应返回 400 且 success=false', async () => {
    const result = await aiFriendMemoryHandler({
      headers: { authorization: 'Bearer valid_token' },
      body: { userId: 'user_auth_1' }
    });

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('缺少 action');
  });

  it('question-bank token 无效时应返回 success=false', async () => {
    mocked.scenario.jwtPayload = null;

    const result = await questionBankHandler({
      headers: { authorization: 'Bearer invalid_token' },
      body: { action: 'get', userId: 'user_auth_1', data: {} }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('token 无效或已过期');
  });

  it('question-bank userId 不匹配时应返回 403 且 success=false', async () => {
    mocked.scenario.jwtPayload = { userId: 'real_user' };

    const result = await questionBankHandler({
      headers: { authorization: 'Bearer valid_token' },
      body: { action: 'get', userId: 'spoof_user', data: {} }
    });

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('身份验证失败');
  });

  it('question-bank 缺少 action 时应返回 400 且 success=false', async () => {
    const result = await questionBankHandler({
      headers: {},
      body: { data: {} }
    });

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('缺少 action');
  });
});
