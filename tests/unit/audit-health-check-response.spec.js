import { describe, expect, it, vi } from 'vitest';

async function loadHealthHandler({ adminSecret = 'unit_admin_secret', countThrows = false } = {}) {
  vi.resetModules();

  const originalAdminSecret = process.env.ADMIN_SECRET;
  process.env.ADMIN_SECRET = adminSecret;

  const count = vi.fn(async () => {
    if (countThrows) {
      throw new Error('db unavailable');
    }
    return { total: 1 };
  });

  const cloudMock = {
    default: {
      database: () => ({
        collection: () => ({ count })
      })
    }
  };

  vi.doMock('@lafjs/cloud', () => cloudMock);
  vi.doMock('../../laf-backend/node_modules/@lafjs/cloud/dist/index.js', () => cloudMock);

  const mod = await import('../../laf-backend/functions/health-check');

  const restoreEnv = () => {
    if (originalAdminSecret === undefined) {
      delete process.env.ADMIN_SECRET;
    } else {
      process.env.ADMIN_SECRET = originalAdminSecret;
    }
  };

  return { handler: mod.default, count, restoreEnv };
}

describe('[安全审计] health-check 错误响应形态一致性', () => {
  it('管理员模式健康状态应返回 success=true', async () => {
    const { handler, restoreEnv } = await loadHealthHandler({ countThrows: false });

    try {
      const result = await handler({
        headers: { 'x-admin-secret': 'unit_admin_secret' },
        body: {}
      });

      expect(result.code).toBe(0);
      expect(result.success).toBe(true);
      expect(result.status).toBe('healthy');
      expect(typeof result.requestId).toBe('string');
      expect(result.requestId.length).toBeGreaterThan(0);
    } finally {
      restoreEnv();
    }
  });

  it('管理员模式数据库异常时应返回 500 且 success=false', async () => {
    const { handler, restoreEnv } = await loadHealthHandler({ countThrows: true });

    try {
      const result = await handler({
        headers: { 'x-admin-secret': 'unit_admin_secret' },
        body: {}
      });

      expect(result.code).toBe(500);
      expect(result.success).toBe(false);
      expect(result.status).toBe('degraded');
      expect(typeof result.requestId).toBe('string');
      expect(result.requestId.length).toBeGreaterThan(0);
    } finally {
      restoreEnv();
    }
  });

  it('处理异常兜底应返回 500 且 success=false', async () => {
    const { handler, restoreEnv } = await loadHealthHandler({ countThrows: false });

    try {
      const result = await handler(null);

      expect(result.code).toBe(500);
      expect(result.success).toBe(false);
      expect(result.status).toBe('error');
      expect(typeof result.requestId).toBe('string');
      expect(result.requestId.length).toBeGreaterThan(0);
    } finally {
      restoreEnv();
    }
  });
});
