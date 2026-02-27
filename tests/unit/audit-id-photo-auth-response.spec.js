import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    jwtPayload: { userId: 'id_photo_user_1' },
    rateAllowed: true
  };

  const verifyJWT = vi.fn(() => scenario.jwtPayload);
  const checkRateLimitDistributed = vi.fn(async () => ({
    allowed: scenario.rateAllowed,
    remaining: scenario.rateAllowed ? 9 : 0,
    resetAt: Date.now() + 60 * 1000,
    source: 'memory'
  }));

  function resetScenario() {
    scenario.jwtPayload = { userId: 'id_photo_user_1' };
    scenario.rateAllowed = true;
    verifyJWT.mockClear();
    checkRateLimitDistributed.mockClear();
  }

  return {
    scenario,
    verifyJWT,
    checkRateLimitDistributed,
    resetScenario
  };
});

vi.mock('../../laf-backend/functions/login', () => ({
  verifyJWT: mocked.verifyJWT
}));

vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }),
  checkRateLimitDistributed: mocked.checkRateLimitDistributed
}));

import idPhotoHandler from '../../laf-backend/functions/id-photo-segment-base64';

describe('[安全审计] id-photo-segment-base64 鉴权响应一致性', () => {
  beforeEach(() => {
    mocked.resetScenario();
  });

  it('缺少 Authorization 时应返回 401，并同时包含 msg/message', async () => {
    const result = /** @type {any} */ (
      await idPhotoHandler({
        headers: {},
        body: {}
      })
    );

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.msg).toBe('请先登录');
    expect(result.message).toBe('请先登录');
    expect(mocked.verifyJWT).not.toHaveBeenCalled();
    expect(mocked.checkRateLimitDistributed).not.toHaveBeenCalled();
  });

  it('JWT 无效时应返回 401，并保持 msg/message 一致', async () => {
    mocked.scenario.jwtPayload = null;

    const result = /** @type {any} */ (
      await idPhotoHandler({
        headers: { authorization: 'Bearer invalid_token' },
        body: {}
      })
    );

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.msg).toBe('token 无效或已过期');
    expect(result.message).toBe('token 无效或已过期');
    expect(mocked.verifyJWT).toHaveBeenCalledTimes(1);
    expect(mocked.checkRateLimitDistributed).not.toHaveBeenCalled();
  });

  it('被限流时应返回 429，并保持 msg/message 一致', async () => {
    mocked.scenario.rateAllowed = false;

    const result = /** @type {any} */ (
      await idPhotoHandler({
        headers: { authorization: 'Bearer valid_token' },
        body: {}
      })
    );

    expect(result.code).toBe(429);
    expect(result.success).toBe(false);
    expect(result.msg).toBe('操作过于频繁，请稍后再试');
    expect(result.message).toBe('操作过于频繁，请稍后再试');
    expect(mocked.verifyJWT).toHaveBeenCalledTimes(1);
    expect(mocked.checkRateLimitDistributed).toHaveBeenCalledTimes(1);
  });

  it('缺少腾讯云密钥时应返回 500 且包含 requestId', async () => {
    const oldSecretId = process.env.TENCENT_SECRET_ID;
    const oldSecretKey = process.env.TENCENT_SECRET_KEY;
    delete process.env.TENCENT_SECRET_ID;
    delete process.env.TENCENT_SECRET_KEY;

    try {
      const result = /** @type {any} */ (
        await idPhotoHandler({
          headers: { authorization: 'Bearer valid_token' },
          body: { imageBase64: 'data:image/png;base64,AAA' }
        })
      );

      expect(result.code).toBe(500);
      expect(result.success).toBe(false);
      expect(result.msg).toBe('服务配置错误，请联系管理员');
      expect(result.message).toBe('服务配置错误，请联系管理员');
      expect(result.requestId).toBeTruthy();
    } finally {
      if (oldSecretId === undefined) delete process.env.TENCENT_SECRET_ID;
      else process.env.TENCENT_SECRET_ID = oldSecretId;
      if (oldSecretKey === undefined) delete process.env.TENCENT_SECRET_KEY;
      else process.env.TENCENT_SECRET_KEY = oldSecretKey;
    }
  });
});
