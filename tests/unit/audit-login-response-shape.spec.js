import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadLoginHandler({ jwtSecret = 'unit_test_jwt', rateLimitAllowed = true } = {}) {
  vi.resetModules();

  const originalEnv = {
    JWT_SECRET_PLACEHOLDER
    WX_APPID: process.env.WX_APPID,
    WX_SECRET_PLACEHOLDER
    WX_GZH_APPID: process.env.WX_GZH_APPID,
    WX_GZH_SECRET: process.env.WX_GZH_SECRET
  };

  if (jwtSecret) {
    process.env.JWT_SECRET_PLACEHOLDER
  } else {
    delete process.env.JWT_SECRET_PLACEHOLDER
  }
  process.env.WX_APPID = process.env.WX_APPID || 'unit_wx_appid';
  process.env.WX_SECRET_PLACEHOLDER
  process.env.WX_GZH_APPID = process.env.WX_GZH_APPID || 'unit_wx_gzh_appid';
  process.env.SECRET_PLACEHOLDER

  const cloudMock = {
    default: {
      database: () => ({
        collection: () => ({
          where: () => ({
            getOne: async () => ({ data: null })
          })
        })
      }),
      fetch: vi.fn()
    }
  };

  vi.doMock('@lafjs/cloud', () => cloudMock);
  vi.doMock('../../laf-backend/node_modules/@lafjs/cloud/dist/index.js', () => cloudMock);

  vi.doMock('../../laf-backend/functions/_shared/perf-monitor', () => ({
    perfMonitor: {
      start: () => () => {}
    }
  }));

  vi.doMock('../../laf-backend/functions/_shared/api-response', () => ({
    createLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }),
    checkRateLimitDistributed: async () => ({
      allowed: rateLimitAllowed,
      remaining: rateLimitAllowed ? 4 : 0,
      resetAt: Date.now() + 60_000,
      source: 'database'
    })
  }));

  const mod = await import('../../laf-backend/functions/login');

  const restoreEnv = () => {
    if (originalEnv.JWT_SECRET_PLACEHOLDER
    else process.env.JWT_SECRET_PLACEHOLDER
    if (originalEnv.WX_APPID === undefined) delete process.env.WX_APPID;
    else process.env.WX_APPID = originalEnv.WX_APPID;
    if (originalEnv.WX_SECRET_PLACEHOLDER
    else process.env.WX_SECRET_PLACEHOLDER
    if (originalEnv.WX_GZH_APPID === undefined) delete process.env.WX_GZH_APPID;
    else process.env.WX_GZH_APPID = originalEnv.WX_GZH_APPID;
    if (originalEnv.SECRET_PLACEHOLDER
    else process.env.SECRET_PLACEHOLDER
  };

  return { handler: mod.default, restoreEnv };
}

describe('[安全审计] login 错误响应形态一致性', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('缺少 JWT_SECRET_PLACEHOLDER
    const { handler, restoreEnv } = await loadLoginHandler({ jwtSecret: '' });

    try {
      const result = await handler({ body: { type: 'wechat', code: 'valid_code_12345' }, headers: {} });

      expect(result.code).toBe(500);
      expect(result.success).toBe(false);
      expect(result.message).toContain('缺少 JWT 签名密钥');
      expect(result.requestId).toBeTruthy();
    } finally {
      restoreEnv();
    }
  });

  it('邮箱登录缺少 email 时应返回 400 且 success=false', async () => {
    const { handler, restoreEnv } = await loadLoginHandler({ jwtSecret: 'unit_test_jwt' });

    try {
      const result = await handler({ body: { type: 'email', verifyCode: '123456' }, headers: {} });

      expect(result.code).toBe(400);
      expect(result.success).toBe(false);
      expect(result.message).toContain('邮箱不能为空');
      expect(result.requestId).toBeTruthy();
    } finally {
      restoreEnv();
    }
  });

  it('登录限流触发时应返回 429 且 success=false', async () => {
    const { handler, restoreEnv } = await loadLoginHandler({
      jwtSecret: 'unit_test_jwt',
      rateLimitAllowed: false
    });

    try {
      const result = await handler({ body: { type: 'wechat', code: 'valid_code_12345' }, headers: {} });

      expect(result.code).toBe(429);
      expect(result.success).toBe(false);
      expect(result.requestId).toBeTruthy();
    } finally {
      restoreEnv();
    }
  });
});
