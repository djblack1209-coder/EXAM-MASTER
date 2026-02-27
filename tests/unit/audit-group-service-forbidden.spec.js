import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    jwtPayload: { userId: 'group_user_1' },
    groupsDocData: { _id: 'group_1', name: 'Group 1' },
    groupMembersData: []
  };

  const verifyJWT = vi.fn(() => scenario.jwtPayload);

  function createCollection(name) {
    const collection = {
      where: () => collection,
      async get() {
        if (name === 'group_members') {
          return { data: scenario.groupMembersData };
        }
        return { data: [] };
      },
      async count() {
        return { total: 0 };
      },
      orderBy: () => ({
        skip: () => ({
          limit: () => ({
            get: async () => ({ data: [] })
          })
        })
      }),
      doc: () => ({
        async get() {
          if (name === 'groups') {
            return { data: scenario.groupsDocData };
          }
          return { data: null };
        },
        async update() {
          return { updated: 1 };
        }
      }),
      async add() {
        return { id: 'mock_id' };
      },
      async update() {
        return { updated: 1 };
      }
    };

    return collection;
  }

  const mockDb = {
    command: {
      lt: (value) => ({ $lt: value }),
      in: (value) => ({ $in: value }),
      inc: (value) => ({ $inc: value }),
      or: (arr) => ({ $or: arr })
    },
    collection: (name) => createCollection(name)
  };

  function resetScenario() {
    scenario.jwtPayload = { userId: 'group_user_1' };
    scenario.groupsDocData = { _id: 'group_1', name: 'Group 1' };
    scenario.groupMembersData = [];
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

describe('[安全审计] group-service 权限语义一致性', () => {
  beforeEach(() => {
    mocked.resetScenario();
  });

  it('leave_group 非成员应返回 403', async () => {
    mocked.scenario.groupMembersData = [];

    const result = await groupServiceHandler({
      headers: { authorization: 'Bearer valid_token' },
      body: { action: 'leave_group', groupId: 'group_1' }
    });

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('不是该小组成员');
  });

  it('leave_group 群主退出应返回 403', async () => {
    mocked.scenario.groupMembersData = [{ _id: 'member_1', role: 'owner', user_id: 'group_user_1', status: 'active' }];

    const result = await groupServiceHandler({
      headers: { authorization: 'Bearer valid_token' },
      body: { action: 'leave_group', groupId: 'group_1' }
    });

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('群主不能离开小组');
  });

  it('share_resource 非成员应返回 403', async () => {
    mocked.scenario.groupMembersData = [];

    const result = await groupServiceHandler({
      headers: { authorization: 'Bearer valid_token' },
      body: {
        action: 'share_resource',
        groupId: 'group_1',
        title: 'resource title',
        content: 'resource content'
      }
    });

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('不是该小组成员');
  });

  it('get_resources 非成员应返回 403', async () => {
    mocked.scenario.groupMembersData = [];

    const result = await groupServiceHandler({
      headers: { authorization: 'Bearer valid_token' },
      body: {
        action: 'get_resources',
        groupId: 'group_1'
      }
    });

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('不是该小组成员');
  });
});
