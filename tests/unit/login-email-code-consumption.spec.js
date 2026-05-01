import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    codeUpdates: [],
    userAdds: [],
    userUpdates: [],
    usersGetOneResult: { data: null },
    emailCodeGetOneResult: { data: { _id: 'code_1', created_at: Date.now(), used: false } }
  };

  function resetScenario() {
    scenario.codeUpdates = [];
    scenario.userAdds = [];
    scenario.userUpdates = [];
    scenario.usersGetOneResult = { data: null };
    scenario.emailCodeGetOneResult = { data: { _id: 'code_1', created_at: Date.now(), used: false } };
  }

  const usersCollection = {
    where() {
      return usersCollection;
    },
    async getOne() {
      return scenario.usersGetOneResult;
    },
    async add(payload) {
      scenario.userAdds.push(payload);
      return { id: 'user_1' };
    },
    doc(id) {
      return {
        async update(payload) {
          scenario.userUpdates.push({ id, payload });
          return { updated: 1 };
        }
      };
    }
  };

  const emailCodesCollection = {
    where() {
      return emailCodesCollection;
    },
    orderBy() {
      return emailCodesCollection;
    },
    async getOne() {
      return scenario.emailCodeGetOneResult;
    },
    async update(payload) {
      scenario.codeUpdates.push(payload);
      return { updated: 1 };
    },
    doc() {
      return {
        async remove() {
          return { deleted: 1 };
        }
      };
    }
  };

  const mockDb = {
    collection(name) {
      if (name === 'email_codes') return emailCodesCollection;
      if (name === 'users') return usersCollection;
      return usersCollection;
    }
  };

  return { scenario, resetScenario, mockDb };
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

vi.mock('../../laf-backend/functions/_shared/perf-monitor', () => ({
  perfMonitor: {
    start: vi.fn(() => vi.fn())
  }
}));

vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    debug: vi.fn()
  }),
  checkRateLimitDistributed: vi.fn(async () => ({
    allowed: true,
    remaining: 4,
    source: 'db',
    resetAt: Date.now() + 60_000
  }))
}));

vi.mock('../../laf-backend/functions/_shared/auth', () => ({
  verifyJWT: vi.fn(() => null)
}));

describe('邮箱验证码注册安全链路', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    mocked.resetScenario();
    process.env.JWT_SECRET = 'unit_test_secret';
    vi.resetModules();
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalJwtSecret;
  });

  it('弱密码注册失败时不应先消耗验证码', async () => {
    const mod = await import('../../laf-backend/functions/login');

    const result = await mod.default({
      body: {
        type: 'email',
        email: 'user@validmail.com',
        verifyCode: '123456',
        password: 'weakpass'
      },
      headers: {},
      socket: { remoteAddress: '127.0.0.1' }
    });

    expect(result.code).toBe(400);
    expect(result.message).toContain('密码强度不足');
    expect(mocked.scenario.codeUpdates).toHaveLength(0);
    expect(mocked.scenario.userAdds).toHaveLength(0);
  });
});
