import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  let jwtPayload = { userId: 'user_1' };

  const scenario = {
    whereCalls: [],
    docUpdateCalls: [],
    removeCalls: [],
    getOne: {},
    docUpdate: {},
    remove: {}
  };

  function resetScenario() {
    scenario.whereCalls = [];
    scenario.docUpdateCalls = [];
    scenario.removeCalls = [];
    scenario.getOne = {};
    scenario.docUpdate = {};
    scenario.remove = {};
  }

  function resolve(store, name, state, fallback) {
    const resolver = store[name];
    if (typeof resolver === 'function') return resolver(state);
    if (resolver !== undefined) return resolver;
    return fallback;
  }

  function createCollection(name) {
    const state = { query: null, field: null };

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
      async getOne() {
        return resolve(scenario.getOne, name, state, { data: null });
      },
      async remove(options) {
        scenario.removeCalls.push({ name, options, query: state.query });
        return resolve(scenario.remove, name, state, { deleted: 0 });
      },
      doc(id) {
        return {
          async update(payload) {
            scenario.docUpdateCalls.push({ name, id, payload });
            return resolve(scenario.docUpdate, name, { ...state, id }, { updated: 1 });
          }
        };
      }
    };

    return collection;
  }

  const mockDb = {
    command: {
      inc: (value) => ({ $inc: value }),
      in: (value) => ({ $in: value }),
      gt: (value) => ({ $gt: value })
    },
    collection(name) {
      return createCollection(name);
    }
  };

  return {
    scenario,
    resetScenario,
    mockDb,
    setJwtPayload(value) {
      jwtPayload = value;
    },
    getJwtPayload() {
      return jwtPayload;
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

vi.mock('../../laf-backend/functions/_shared/fsrs-scheduler', () => ({
  scheduleReviewFSRS: vi.fn(),
  createNewCard: vi.fn(() => ({})),
  hasFSRSState: vi.fn(() => false),
  extractFSRSState: vi.fn(() => null),
  migrateToFSRS: vi.fn(() => ({}))
}));

import mistakeManagerHandler from '../../laf-backend/functions/mistake-manager';

describe('[安全审计] mistake-manager updateFields 行为', () => {
  beforeEach(() => {
    mocked.resetScenario();
    mocked.setJwtPayload({ userId: 'user_1' });
  });

  it('应拒绝更新非本人错题', async () => {
    mocked.scenario.getOne.mistake_book = { data: null };

    const result = await mistakeManagerHandler({
      body: {
        action: 'updateFields',
        userId: 'user_1',
        data: {
          id: 'm_404',
          fields: {
            notes: 'new note text'
          }
        }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(result.code).toBe(404);
    expect(result.success).toBe(false);
    expect(result.message).toContain('错题不存在');
    expect(mocked.scenario.docUpdateCalls.length).toBe(0);
  });

  it('仅 body.token 时应拒绝（要求 Header Token）', async () => {
    const result = await mistakeManagerHandler({
      body: {
        action: 'updateFields',
        userId: 'user_1',
        token: 'Bearer body_token_only',
        data: {
          id: 'm_1',
          fields: {
            notes: 'new note'
          }
        }
      },
      headers: {}
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
  });

  it('body 缺少 userId 时，JWT 有效则正常执行（H-01 安全加固：userId 从 JWT 派生）', async () => {
    mocked.scenario.getOne.mistake_book = { data: { _id: 'm_1' } };

    const result = await mistakeManagerHandler({
      body: {
        action: 'updateFields',
        data: {
          id: 'm_1',
          fields: {
            notes: 'new note'
          }
        }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

    // H-01 修复后 userId 始终从 JWT payload 派生，body 中无需提供
    // JWT mock 返回 { userId: 'user_1' }，所以函数正常执行
    expect(result.code).not.toBe(401);
  });

  it('应按白名单更新字段并自动维护 hash/mastered_at', async () => {
    mocked.scenario.getOne.mistake_book = { data: { _id: 'm_1' } };

    const result = await mistakeManagerHandler({
      body: {
        action: 'updateFields',
        userId: 'user_1',
        data: {
          id: 'm_1',
          fields: {
            question_content: '新的题目内容ABCDE',
            wrong_count: 7,
            notes: 'note_payload',
            is_mastered: true,
            evil_field: 'should_be_ignored'
          }
        }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(result.code).toBe(0);
    expect(result.success).toBe(true);

    const updateCall = mocked.scenario.docUpdateCalls.find((item) => item.name === 'mistake_book');
    expect(updateCall).toBeTruthy();
    expect(updateCall.id).toBe('m_1');
    expect(updateCall.payload.question_content).toBe('新的题目内容ABCDE');
    expect(updateCall.payload.wrong_count).toBe(7);
    expect(updateCall.payload.notes).toBe('note_payload');
    expect(updateCall.payload.is_mastered).toBe(true);
    expect(updateCall.payload.evil_field).toBeUndefined();
    expect(updateCall.payload.updated_at).toEqual(expect.any(Number));
    expect(updateCall.payload.mastered_at).toEqual(expect.any(Number));
    expect(updateCall.payload._content_hash).toMatch(/^h_/);
  });

  it('fields 无白名单字段时应返回 400', async () => {
    const result = await mistakeManagerHandler({
      body: {
        action: 'updateFields',
        userId: 'user_1',
        data: {
          id: 'm_2',
          fields: {
            only_unknown_field: 'x'
          }
        }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('没有可更新字段');
    expect(mocked.scenario.docUpdateCalls.length).toBe(0);
  });

  it('batchRemove 应保留 ids 参数并执行批量删除', async () => {
    mocked.scenario.remove.mistake_book = { deleted: 2 };

    const result = await mistakeManagerHandler({
      body: {
        action: 'batchRemove',
        userId: 'user_1',
        data: {
          ids: ['m_1', 'm_2']
        }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(result.code).toBe(0);
    expect(result.deleted).toBe(2);

    const removeCall = mocked.scenario.removeCalls.find((item) => item.name === 'mistake_book');
    expect(removeCall).toBeTruthy();
    expect(removeCall.query.user_id).toBe('user_1');
    expect(removeCall.query._id).toEqual({ $in: ['m_1', 'm_2'] });
  });
});
