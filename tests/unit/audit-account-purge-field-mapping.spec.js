import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    whereCalls: [],
    removeCalls: [],
    updateCalls: [],
    docUpdateCalls: [],
    docRemoveCalls: [],
    getData: {},
    removeData: {},
    updateData: {}
  };

  function resetScenario() {
    scenario.whereCalls = [];
    scenario.removeCalls = [];
    scenario.updateCalls = [];
    scenario.docUpdateCalls = [];
    scenario.docRemoveCalls = [];
    scenario.getData = {};
    scenario.removeData = {};
    scenario.updateData = {};
  }

  function resolve(store, name, state, fallback) {
    const resolver = store[name];
    if (typeof resolver === 'function') return resolver(state);
    if (resolver !== undefined) return resolver;
    return fallback;
  }

  function createCollection(name) {
    const state = { query: null, limit: 0, field: null };

    const collection = {
      where(query) {
        state.query = query;
        scenario.whereCalls.push({ name, query });
        return collection;
      },
      field(value) {
        state.field = value;
        return collection;
      },
      limit(value) {
        state.limit = value;
        return collection;
      },
      async get() {
        return resolve(scenario.getData, name, state, { data: [] });
      },
      async remove() {
        scenario.removeCalls.push({ name, query: state.query });
        return resolve(scenario.removeData, name, state, { deleted: 1 });
      },
      async update(payload) {
        scenario.updateCalls.push({ name, query: state.query, payload });
        return resolve(scenario.updateData, name, state, { updated: 1 });
      },
      doc(id) {
        return {
          async update(payload) {
            scenario.docUpdateCalls.push({ name, id, payload });
            return { updated: 1 };
          },
          async remove() {
            scenario.docRemoveCalls.push({ name, id });
            return { deleted: 1 };
          }
        };
      }
    };

    return collection;
  }

  const mockDb = {
    command: {
      lte: (value) => ({ $lte: value }),
      or: (arr) => ({ $or: arr })
    },
    collection(name) {
      return createCollection(name);
    }
  };

  return {
    scenario,
    resetScenario,
    mockDb
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

vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

import accountPurgeHandler, { purgeUserData } from '../../laf-backend/functions/account-purge';

describe('[安全审计] account-purge 字段映射与脱敏', () => {
  beforeEach(() => {
    mocked.resetScenario();
    delete process.env.ADMIN_PURGE_TOKEN;
  });

  it('HTTP 手动触发缺少管理员令牌时应拒绝', async () => {
    const result = await accountPurgeHandler({
      method: 'POST',
      headers: {},
      body: { action: 'execute_purge' }
    });

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
  });

  it('定时触发上下文不应被误判为 HTTP 请求', async () => {
    const result = await accountPurgeHandler({
      headers: {},
      body: {}
    });

    expect(result.code).toBe(0);
    expect(result.success).toBe(true);
    expect(result.message).toContain('无待清除用户');
  });

  it('purgeUserData 应使用修正后的关键字段清理用户数据', async () => {
    await purgeUserData('user_abc');

    const rankingsQuery = mocked.scenario.whereCalls.find((item) => item.name === 'rankings');
    expect(rankingsQuery.query).toEqual({ uid: 'user_abc' });

    const materialsQuery = mocked.scenario.whereCalls.find((item) => item.name === 'user_materials');
    expect(materialsQuery.query).toEqual({ userId: 'user_abc' });

    const questionsQuery = mocked.scenario.whereCalls.find((item) => item.name === 'user_questions');
    expect(questionsQuery.query).toEqual({ userId: 'user_abc' });

    const schoolFavQuery = mocked.scenario.whereCalls.find((item) => item.name === 'user_school_favorites');
    expect(schoolFavQuery.query).toEqual({ userId: 'user_abc' });

    const usageLogQuery = mocked.scenario.whereCalls.find((item) => item.name === 'ai_usage_logs');
    expect(usageLogQuery.query).toEqual({ userId: 'user_abc' });

    const bansQuery = mocked.scenario.whereCalls.find((item) => item.name === 'user_bans');
    expect(bansQuery.query).toEqual({ uid: 'user_abc' });

    const invitesQuery = mocked.scenario.whereCalls.find(
      (item) => item.name === 'invites' && item.query && Array.isArray(item.query.$or)
    );
    expect(invitesQuery).toBeTruthy();
    expect(invitesQuery.query.$or).toEqual(
      expect.arrayContaining([{ inviterId: 'user_abc' }, { inviteeId: 'user_abc' }])
    );
  });

  it('审计日志脱敏应对 uid/context.userId 字段生效', async () => {
    await purgeUserData('user_xyz');

    const suspiciousUpdate = mocked.scenario.updateCalls.find((item) => item.name === 'suspicious_behaviors');
    expect(suspiciousUpdate.query).toEqual({ uid: 'user_xyz' });
    expect(suspiciousUpdate.payload.uid).toBe('[已注销]');

    const auditUpdate = mocked.scenario.updateCalls.find((item) => item.name === 'security_audit_logs');
    expect(auditUpdate.query).toEqual({ 'context.userId': 'user_xyz' });
    expect(auditUpdate.payload['context.userId']).toBe('[已注销]');
  });

  it('部分集合删除失败时应保留 users 主记录并写入重试信息', async () => {
    mocked.scenario.removeData.practice_records = () => {
      throw new Error('network timeout');
    };

    const result = await purgeUserData('retry_user_1');

    expect(result.errors.some((msg) => msg.includes('practice_records'))).toBe(true);

    const usersDelete = mocked.scenario.docRemoveCalls.find(
      (item) => item.name === 'users' && item.id === 'retry_user_1'
    );
    expect(usersDelete).toBeFalsy();

    const usersRetryMark = mocked.scenario.docUpdateCalls.find(
      (item) => item.name === 'users' && item.id === 'retry_user_1'
    );
    expect(usersRetryMark).toBeTruthy();
    expect(usersRetryMark.payload).toEqual(
      expect.objectContaining({
        purge_last_error_at: expect.any(Number),
        purge_last_errors: expect.any(Array),
        updated_at: expect.any(Number)
      })
    );
  });

  it('集合不存在错误应视为可忽略，不阻断 users 主记录删除', async () => {
    mocked.scenario.removeData.practice_records = () => {
      throw new Error('Collection not exist');
    };

    const result = await purgeUserData('ignore_user_1');

    expect(result.errors.some((msg) => msg.includes('practice_records'))).toBe(false);

    const usersDelete = mocked.scenario.docRemoveCalls.find(
      (item) => item.name === 'users' && item.id === 'ignore_user_1'
    );
    expect(usersDelete).toBeTruthy();
  });
});
