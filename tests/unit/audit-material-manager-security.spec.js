import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  let jwtPayload = { userId: 'token_user' };

  const scenario = {
    addCalls: [],
    get: {},
    getOne: {},
    count: {}
  };

  function resetScenario() {
    scenario.addCalls = [];
    scenario.get = {};
    scenario.getOne = {};
    scenario.count = {};
  }

  function resolveResult(store, name, payload, fallback) {
    const handler = store[name];
    if (typeof handler === 'function') return handler(payload);
    if (handler !== undefined) return handler;
    return fallback;
  }

  function createCollection(name) {
    const state = { query: null, skip: 0, limit: 0 };

    const collection = {
      where(query) {
        state.query = query;
        return collection;
      },
      orderBy() {
        return collection;
      },
      skip(value) {
        state.skip = value;
        return collection;
      },
      limit(value) {
        state.limit = value;
        return collection;
      },
      async get() {
        return resolveResult(scenario.get, name, state, { data: [] });
      },
      async getOne() {
        return resolveResult(scenario.getOne, name, state, { data: null });
      },
      async count() {
        return resolveResult(scenario.count, name, state, { total: 0 });
      },
      async add(payload) {
        scenario.addCalls.push({ name, payload });
        return { id: 'mock_id', ids: ['mock_id'] };
      },
      async remove() {
        return { deleted: 1 };
      },
      doc() {
        return {
          async update() {
            return { updated: 1 };
          },
          async remove() {
            return { deleted: 1 };
          }
        };
      },
      aggregate() {
        return {
          match() {
            return {
              group() {
                return {
                  async end() {
                    return { data: [] };
                  }
                };
              },
              sample() {
                return {
                  async end() {
                    return { data: [] };
                  }
                };
              }
            };
          }
        };
      }
    };

    return collection;
  }

  const mockDb = {
    collection(name) {
      return createCollection(name);
    }
  };

  return {
    scenario,
    resetScenario,
    mockDb,
    getJwtPayload: () => jwtPayload,
    setJwtPayload: (value) => {
      jwtPayload = value;
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

import materialManagerHandler from '../../laf-backend/functions/material-manager';

describe('[安全审计] material-manager 关键防护', () => {
  beforeEach(() => {
    mocked.setJwtPayload({ userId: 'token_user' });
    mocked.resetScenario();
  });

  it('缺少 action 时应返回 400 且 success=false', async () => {
    const result = await materialManagerHandler({
      body: {
        userId: 'spoof_user',
        data: { name: '资料.pdf' }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('缺少 action');
  });

  it('缺少 token 时应拒绝请求', async () => {
    const result = await materialManagerHandler({
      body: {
        action: 'save_upload_record',
        userId: 'spoof_user',
        data: { name: '资料.pdf' }
      },
      headers: {}
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
  });

  it('仅 body.token 时应拒绝请求（要求 Header Token）', async () => {
    const result = await materialManagerHandler({
      body: {
        action: 'save_upload_record',
        token: 'body_token_only',
        userId: 'spoof_user',
        data: { name: '资料.pdf' }
      },
      headers: {}
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
  });

  it('应使用 token 用户ID，忽略请求体伪造 userId', async () => {
    mocked.setJwtPayload({ userId: 'real_user' });

    const result = await materialManagerHandler({
      body: {
        action: 'save_upload_record',
        userId: 'spoof_user',
        data: { name: '资料.pdf', size: 12 }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(result.code).toBe(0);
    const addCall = mocked.scenario.addCalls.find((item) => item.name === 'user_materials');
    expect(addCall).toBeTruthy();
    expect(addCall.payload.userId).toBe('real_user');
  });

  it('sync_questions 不应允许 localQuestions 覆盖用户ID', async () => {
    mocked.setJwtPayload({ userId: 'owner_user' });
    mocked.scenario.get.user_questions = () => ({ data: [] });

    const result = await materialManagerHandler({
      body: {
        action: 'sync_questions',
        userId: 'spoof_user',
        data: {
          localQuestions: [
            {
              userId: 'attacker_user',
              question: '测试题目',
              options: ['A', 'B'],
              answer: 'A'
            }
          ]
        }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(result.code).toBe(0);
    const syncAdd = mocked.scenario.addCalls.find((item) => item.name === 'user_questions');
    expect(syncAdd).toBeTruthy();
    expect(Array.isArray(syncAdd.payload)).toBe(true);
    expect(syncAdd.payload[0].userId).toBe('owner_user');
    expect(syncAdd.payload[0].userId).not.toBe('attacker_user');
  });
});
