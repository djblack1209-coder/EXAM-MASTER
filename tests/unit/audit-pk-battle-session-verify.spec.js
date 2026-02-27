import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  let jwtPayload = { userId: 'user_1' };

  const scenario = {
    whereCalls: [],
    addCalls: [],
    updateCalls: [],
    docUpdateCalls: [],
    getOne: {},
    get: {},
    count: {},
    add: {},
    update: {},
    docUpdate: {}
  };

  function resetScenario() {
    scenario.whereCalls = [];
    scenario.addCalls = [];
    scenario.updateCalls = [];
    scenario.docUpdateCalls = [];
    scenario.getOne = {};
    scenario.get = {};
    scenario.count = {};
    scenario.add = {};
    scenario.update = {};
    scenario.docUpdate = {};
  }

  function resolve(store, name, state, fallback) {
    const resolver = store[name];
    if (typeof resolver === 'function') return resolver(state);
    if (resolver !== undefined) return resolver;
    return fallback;
  }

  function createCollection(name) {
    const state = { query: null, orderBy: null, skip: 0, limit: 0 };

    const collection = {
      where(query) {
        state.query = query;
        scenario.whereCalls.push({ name, query });
        return collection;
      },
      orderBy(field, direction) {
        state.orderBy = { field, direction };
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
      field() {
        return collection;
      },
      async getOne() {
        return resolve(scenario.getOne, name, state, { data: null });
      },
      async get() {
        return resolve(scenario.get, name, state, { data: [] });
      },
      async count() {
        return resolve(scenario.count, name, state, { total: 0 });
      },
      async add(payload) {
        scenario.addCalls.push({ name, payload });
        return resolve(scenario.add, name, state, { id: `${name}_id` });
      },
      async update(payload) {
        scenario.updateCalls.push({ name, payload, query: state.query });
        return resolve(scenario.update, name, state, { updated: 1 });
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
      gt: (value) => ({ $gt: value }),
      inc: (value) => ({ $inc: value }),
      or: (arr) => ({ $or: arr })
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

vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  },
  validateUserId: (value) => typeof value === 'string' && value.length > 0,
  success: (data, message = 'success') => ({ code: 0, success: true, message, data }),
  badRequest: (message = 'bad request') => ({ code: 400, success: false, message }),
  unauthorized: (message = 'unauthorized') => ({ code: 401, success: false, message }),
  serverError: (message = 'server error') => ({ code: 500, success: false, message }),
  generateRequestId: () => 'pk_test_req'
}));

import pkBattleHandler from '../../laf-backend/functions/pk-battle';

describe('[安全审计] pk-battle 参与者校验链路', () => {
  beforeEach(() => {
    mocked.resetScenario();
    mocked.setJwtPayload({ userId: 'user_1' });
  });

  it('非参战者提交结果应被拒绝', async () => {
    mocked.setJwtPayload({ userId: 'intruder_user' });

    const result = await pkBattleHandler({
      body: {
        action: 'submit_result',
        battleId: 'battle_001',
        idempotencyKey: 'idem_001',
        questionCount: 5,
        player1: { uid: 'user_1', score: 40, correctCount: 2, totalTime: 12000 },
        player2: { uid: 'user_2', score: 20, correctCount: 1, totalTime: 12000 },
        clientInfo: { ip: '1.1.1.1', deviceId: 'dev_1' }
      },
      headers: {
        authorization: 'Bearer valid_token'
      }
    });

    expect(result.code).toBe(403);
    expect(result.message).toContain('无权提交此对战结果');
  });

  it('仅 body.token 不应通过鉴权（应要求 Header Token）', async () => {
    const result = await pkBattleHandler({
      body: {
        action: 'get_records',
        token: 'body_token_only'
      },
      headers: {}
    });

    expect(result.code).toBe(401);
  });

  it('伪造双方 UID 且与服务端会话不匹配应被拒绝', async () => {
    mocked.setJwtPayload({ userId: 'user_1' });
    mocked.scenario.getOne.pk_battles = {
      data: {
        battle_id: 'battle_human_1',
        players: [{ uid: 'user_1' }, { uid: 'user_2' }],
        status: 'active'
      }
    };

    const result = await pkBattleHandler({
      body: {
        action: 'submit_result',
        battleId: 'battle_human_1',
        idempotencyKey: 'idem_human_1',
        questionCount: 5,
        player1: { uid: 'user_1', score: 60, correctCount: 3, totalTime: 18000 },
        player2: { uid: 'attacker_user', score: 40, correctCount: 2, totalTime: 18000 },
        clientInfo: { ip: '2.2.2.2', deviceId: 'dev_2' }
      },
      headers: {
        authorization: 'Bearer valid_token'
      }
    });

    expect(result.code).toBe(403);
    expect(result.message).toContain('对战参与者与会话不匹配');

    const sessionQuery = mocked.scenario.whereCalls.find((item) => item.name === 'pk_battles');
    expect(sessionQuery).toBeTruthy();
  });

  it('幂等处理中重复提交应返回 429 且 success=false', async () => {
    mocked.setJwtPayload({ userId: 'user_1' });
    mocked.scenario.getOne.user_bans = { data: null };
    mocked.scenario.getOne.idempotency_records = {
      data: {
        _id: 'idem_processing_1',
        status: 'processing',
        created_at: Date.now()
      }
    };

    const result = await pkBattleHandler({
      body: {
        action: 'submit_result',
        battleId: 'battle_processing_1',
        idempotencyKey: 'idem_processing_1',
        questionCount: 5,
        player1: { uid: 'user_1', score: 40, correctCount: 2, totalTime: 15000 },
        player2: { uid: 'bot_001', score: 0, correctCount: 0, totalTime: 0 },
        clientInfo: { ip: '3.3.3.3', deviceId: 'dev_3' }
      },
      headers: {
        authorization: 'Bearer valid_token'
      }
    });

    expect(result.code).toBe(429);
    expect(result.success).toBe(false);
    expect(result.message).toContain('请求正在处理中');
    expect(result.isDuplicate).toBe(true);
    expect(result.requestId).toBe('pk_test_req');
  });

  it('真人 + bot 对战应允许提交并完成入库', async () => {
    mocked.setJwtPayload({ userId: 'user_1' });
    mocked.scenario.getOne.user_bans = { data: null };
    mocked.scenario.getOne.idempotency_records = { data: null };
    mocked.scenario.getOne.rankings = { data: null };
    mocked.scenario.add.idempotency_records = { id: 'idem_record_1' };
    mocked.scenario.add.pk_records = { id: 'pk_record_1' };
    mocked.scenario.add.rankings = { id: 'ranking_1' };

    const result = await pkBattleHandler({
      body: {
        action: 'submit_result',
        battleId: 'battle_bot_1',
        idempotencyKey: 'idem_bot_1',
        questionCount: 5,
        player1: { uid: 'user_1', score: 40, correctCount: 2, totalTime: 15000 },
        player2: { uid: 'bot_001', score: 0, correctCount: 0, totalTime: 0 },
        clientInfo: { ip: '3.3.3.3', deviceId: 'dev_3' }
      },
      headers: {
        authorization: 'Bearer valid_token'
      }
    });

    expect(result.code).toBe(0);
    expect(result.success).toBe(true);

    const recordInsert = mocked.scenario.addCalls.find((item) => item.name === 'pk_records');
    expect(recordInsert).toBeTruthy();

    const sessionQuery = mocked.scenario.whereCalls.find((item) => item.name === 'pk_battles');
    expect(sessionQuery).toBeUndefined();
  });
});
