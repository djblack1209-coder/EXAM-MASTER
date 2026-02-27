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

vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  sanitizeString: (value, max = 2000) => {
    const str = String(value ?? '');
    return str.length > max ? str.slice(0, max) : str;
  },
  validateAction: (action) => typeof action === 'string' && action.length > 0,
  validateUserId: (value) => typeof value === 'string' && value.length > 0,
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }),
  generateRequestId: () => 'mm_tag_req'
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
