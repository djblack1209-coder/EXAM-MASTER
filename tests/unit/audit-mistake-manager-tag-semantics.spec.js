import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    getOneResult: { data: null }
  };

  function createCollection() {
    const collection = {
      where() {
        return collection;
      },
      async getOne() {
        return scenario.getOneResult;
      },
      doc() {
        return {
          async update() {
            return { updated: 1 };
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
    collection() {
      return createCollection();
    }
  };

  return {
    scenario,
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

vi.mock('../../laf-backend/functions/login', () => ({
  verifyJWT: vi.fn(() => ({ userId: 'user_1' }))
}));

vi.mock('../../laf-backend/functions/_shared/api-response', async () => {
  const { createApiResponseMock } = await import('../../tests/__mocks__/api-response-mock.js');
  return createApiResponseMock();
});

vi.mock('../../laf-backend/functions/_shared/auth-middleware', () => ({
  requireAuth: (ctx) => {
    const token = ctx?.headers?.authorization?.replace('Bearer ', '') || '';
    if (!token) return { code: 401, success: false, message: '请先登录' };
    return { userId: 'test_user' };
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

describe('[语义审计] mistake-manager manageTags 返回码一致性', () => {
  beforeEach(() => {
    mocked.scenario.getOneResult = { data: null };
  });

  it('add 标签时不存在记录返回 404 且文案不混用无权限语义', async () => {
    const result = await mistakeManagerHandler({
      body: {
        action: 'manageTags',
        userId: 'user_1',
        data: {
          action: 'add',
          mistakeId: 'm_missing',
          tags: ['t1']
        }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(result.code).toBe(404);
    expect(result.success).toBe(false);
    expect(result.message).toBe('错题不存在');
  });

  it('remove 标签时不存在记录返回 404 且文案不混用无权限语义', async () => {
    const result = await mistakeManagerHandler({
      body: {
        action: 'manageTags',
        userId: 'user_1',
        data: {
          action: 'remove',
          mistakeId: 'm_missing',
          tags: ['t1']
        }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

    expect(result.code).toBe(404);
    expect(result.success).toBe(false);
    expect(result.message).toBe('错题不存在');
  });
});
