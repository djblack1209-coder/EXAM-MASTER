import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const state = {
    existing: null,
    throwOnGet: false,
    addCalls: [],
    updateCalls: []
  };

  const docRef = {
    async get() {
      if (state.throwOnGet) {
        throw new Error('db-down');
      }
      return { data: state.existing };
    },
    async update(payload) {
      state.updateCalls.push(payload);
      return { updated: 1 };
    }
  };

  const collection = {
    doc() {
      return docRef;
    },
    async add(payload) {
      state.addCalls.push(payload);
      return { id: payload?._id || 'rate_id' };
    }
  };

  return {
    state,
    reset() {
      state.existing = null;
      state.throwOnGet = false;
      state.addCalls = [];
      state.updateCalls = [];
    },
    mockCloud: {
      database: () => ({
        command: {
          inc: (n) => ({ $inc: n })
        },
        collection: () => collection
      })
    }
  };
});

vi.mock('@lafjs/cloud', () => ({
  default: mocked.mockCloud
}));

vi.mock('../../laf-backend/node_modules/@lafjs/cloud/dist/index.js', () => ({
  default: mocked.mockCloud
}));

describe('[安全审计] distributed rate limit', () => {
  beforeEach(() => {
    mocked.reset();
    vi.resetModules();
  });

  it('数据库窗口首次请求应放行并标记 source=db', async () => {
    const { checkRateLimitDistributed } = await import('../../laf-backend/functions/_shared/api-response');

    const result = await checkRateLimitDistributed('user:login', 3, 60 * 1000);

    expect(result.allowed).toBe(true);
    expect(result.source).toBe('db');
    expect(mocked.state.addCalls.length).toBe(1);
  });

  it('数据库计数达到上限时应拒绝', async () => {
    mocked.state.existing = {
      count: 3,
      resetAt: Date.now() + 30 * 1000
    };
    const { checkRateLimitDistributed } = await import('../../laf-backend/functions/_shared/api-response');

    const result = await checkRateLimitDistributed('user:login', 3, 60 * 1000);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.source).toBe('db');
  });

  it('数据库异常时应降级到 fallback 内存策略', async () => {
    mocked.state.throwOnGet = true;
    const { checkRateLimitDistributed } = await import('../../laf-backend/functions/_shared/api-response');

    const result = await checkRateLimitDistributed('user:login', 3, 60 * 1000, () => ({
      allowed: true,
      remaining: 2,
      resetAt: Date.now() + 60 * 1000
    }));

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.source).toBe('memory');
  });
});
