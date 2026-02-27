import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    jwtPayload: { userId: 'group_user_1' }
  };

  const verifyJWT = vi.fn(() => scenario.jwtPayload);

  const mockDb = {
    command: {
      lt: (value) => ({ $lt: value }),
      in: (value) => ({ $in: value }),
      inc: (value) => ({ $inc: value })
    },
    collection: () => ({
      where: () => ({
        get: async () => ({ data: [] }),
        update: async () => ({ updated: 1 }),
        count: async () => ({ total: 0 })
      }),
      doc: () => ({
        get: async () => ({ data: null }),
        update: async () => ({ updated: 1 })
      }),
      add: async () => ({ id: 'mock_id' }),
      orderBy: () => ({
        skip: () => ({
          limit: () => ({
            get: async () => ({ data: [] })
          })
        })
      })
    })
  };

  function resetScenario() {
    scenario.jwtPayload = { userId: 'group_user_1' };
    verifyJWT.mockClear();
  }

  return {
    scenario,
    verifyJWT,
    mockDb,
    resetScenario
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

import groupServiceHandler from '../../laf-backend/functions/group-service';

describe('[安全审计] group-service 鉴权 userId 一致性', () => {
  beforeEach(() => {
    mocked.resetScenario();
  });

  it('仅携带有效 token 且未声明 x-user-id 时，不应误判为用户不匹配', async () => {
    const result = await groupServiceHandler({
      headers: { authorization: 'Bearer valid_token' },
      body: {}
    });

    expect(mocked.verifyJWT).toHaveBeenCalledWith('valid_token');
    expect(result.code).toBe(400);
    expect(result.message).toContain('action 不能为空');
  });

  it('声明 userId 与 token 不一致时，应返回 403', async () => {
    const result = await groupServiceHandler({
      headers: {
        authorization: 'Bearer valid_token',
        'x-user-id': 'other_user'
      },
      body: { action: 'get_groups' }
    });

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('用户不匹配');
  });

  it('Bearer 头为空 token 时，应返回 401 缺少认证 token', async () => {
    const result = await groupServiceHandler({
      headers: { authorization: 'Bearer   ' },
      body: { action: 'get_groups' }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('缺少认证 token');
  });
});
