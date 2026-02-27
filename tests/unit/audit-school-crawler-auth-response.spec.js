import { describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const mockCloud = {
    database: () => ({
      command: {}
    }),
    fetch: vi.fn()
  };

  return {
    mockCloud,
    checkRateLimit: vi.fn(() => ({ allowed: true }))
  };
});

vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }),
  checkRateLimit: mocked.checkRateLimit
}));

vi.mock('@lafjs/cloud', () => ({
  default: mocked.mockCloud
}));

vi.mock('../../laf-backend/node_modules/@lafjs/cloud/dist/index.js', () => ({
  default: mocked.mockCloud
}));

import schoolCrawlerHandler from '../../laf-backend/functions/school-crawler-api';

describe('[安全审计] school-crawler-api 管理鉴权响应形态', () => {
  it('refresh 缺少管理员凭据时返回 403 + success=false + requestId', async () => {
    const result = /** @type {any} */ (
      await schoolCrawlerHandler({
        headers: {},
        body: { action: 'refresh', data: {} }
      })
    );

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('无权执行');
    expect(result.requestId).toMatch(/^crawler_/);
  });

  it('crawl_all 错误管理员凭据时返回 403 + success=false + requestId', async () => {
    process.env.SECRET_PLACEHOLDER

    const result = /** @type {any} */ (
      await schoolCrawlerHandler({
        headers: { 'x-admin-secret': 'wrong_secret' },
        body: { action: 'crawl_all', data: {} }
      })
    );

    expect(result.code).toBe(403);
    expect(result.success).toBe(false);
    expect(result.message).toContain('无权执行');
    expect(result.requestId).toMatch(/^crawler_/);
  });
});
