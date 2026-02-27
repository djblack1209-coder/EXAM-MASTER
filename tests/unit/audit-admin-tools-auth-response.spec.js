import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const mockDb = {
    collection: () => ({
      createIndex: async () => undefined,
      count: async () => ({ total: 0 }),
      where: () => ({ count: async () => ({ total: 0 }), limit: () => ({ get: async () => ({ data: [] }) }) })
    }),
    command: {
      exists: () => ({})
    }
  };

  const mockCloud = {
    database: () => mockDb
  };

  return { mockCloud };
});

vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

vi.mock('@lafjs/cloud', () => ({
  default: mocked.mockCloud
}));

vi.mock('../../laf-backend/node_modules/@lafjs/cloud/dist/index.js', () => ({
  default: mocked.mockCloud
}));

import dbCreateIndexesHandler from '../../laf-backend/functions/db-create-indexes';
import dbMigrateTimestampsHandler from '../../laf-backend/functions/db-migrate-timestamps';

describe('[安全审计] 管理工具函数响应形态一致性', () => {
  beforeEach(() => {
    process.env.SECRET_PLACEHOLDER
  });

  it('db-create-indexes 缺少管理员凭据时返回 403 + success=false + requestId', async () => {
    const result = await dbCreateIndexesHandler({ headers: {}, body: {} });

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('管理员权限');
    expect(result.requestId).toMatch(/^db_idx_/);
  });

  it('db-migrate-timestamps 缺少管理员凭据时返回 403 + success=false + requestId', async () => {
    const result = await dbMigrateTimestampsHandler({ headers: {}, body: {} });

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('管理员权限');
    expect(result.requestId).toMatch(/^db_ts_/);
  });

  it('db-migrate-timestamps action 非法时返回 400 + success=false + requestId', async () => {
    const result = await dbMigrateTimestampsHandler({
      headers: { 'x-admin-secret': 'admin_test_secret' },
      body: { action: 'unknown' }
    });

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('无效的 action');
    expect(result.requestId).toMatch(/^db_ts_/);
  });
});
