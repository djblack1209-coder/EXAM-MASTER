import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocked = vi.hoisted(() => {
  const scenario = {
    jwtPayload: { userId: 'voice_user_1' }
  };

  const verifyJWT = vi.fn(() => scenario.jwtPayload);
  const checkRateLimitDistributed = vi.fn(async () => ({
    allowed: true,
    remaining: 14,
    resetAt: Date.now() + 60 * 1000,
    source: 'memory'
  }));
  const generateRequestId = vi.fn(() => 'voice_req_test');
  const wrapResponse = vi.fn((response, requestId) => ({ ...response, requestId, duration: 0 }));

  function resetScenario() {
    scenario.jwtPayload = { userId: 'voice_user_1' };
    verifyJWT.mockClear();
    checkRateLimitDistributed.mockClear();
    generateRequestId.mockClear();
    wrapResponse.mockClear();
  }

  return {
    scenario,
    verifyJWT,
    checkRateLimitDistributed,
    generateRequestId,
    wrapResponse,
    resetScenario
  };
});

vi.mock('../../laf-backend/functions/login', () => ({
  verifyJWT: mocked.verifyJWT
}));

vi.mock('../../laf-backend/functions/_shared/api-response', () => ({
  success: (data, message = 'ok') => ({ code: 0, success: true, message, data }),
  badRequest: (message = 'bad request') => ({ code: 400, success: false, message }),
  unauthorized: (message = '请先登录') => ({ code: 401, success: false, message }),
  serverError: (message = 'server error') => ({ code: 500, success: false, message }),
  generateRequestId: mocked.generateRequestId,
  wrapResponse: mocked.wrapResponse,
  checkRateLimitDistributed: mocked.checkRateLimitDistributed,
  tooManyRequests: (message = 'too many requests') => ({ code: 429, success: false, message }),
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

vi.mock('@lafjs/cloud', () => ({
  default: {
    fetch: vi.fn()
  }
}));

vi.mock('../../laf-backend/node_modules/@lafjs/cloud/dist/index.js', () => ({
  default: {
    fetch: vi.fn()
  }
}));

import voiceServiceHandler from '../../laf-backend/functions/voice-service';

describe('[安全审计] voice-service 鉴权返回码一致性', () => {
  beforeEach(() => {
    mocked.resetScenario();
  });

  it('缺少 Authorization 时应返回 401，而不是 400', async () => {
    const result = await voiceServiceHandler({
      headers: {},
      body: { action: 'get_voices' }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('请先登录');
    expect(mocked.verifyJWT).not.toHaveBeenCalled();
    expect(mocked.checkRateLimitDistributed).not.toHaveBeenCalled();
  });

  it('JWT 无效时应返回 401，而不是 400', async () => {
    mocked.scenario.jwtPayload = null;

    const result = await voiceServiceHandler({
      headers: { authorization: 'Bearer invalid_token' },
      body: { action: 'get_voices' }
    });

    expect(result.code).toBe(401);
    expect(result.success).toBe(false);
    expect(result.message).toContain('token 无效或已过期');
    expect(mocked.verifyJWT).toHaveBeenCalledTimes(1);
    expect(mocked.checkRateLimitDistributed).not.toHaveBeenCalled();
  });

  it('鉴权通过后应进入后续流程（至少触发速率限制检查）', async () => {
    await voiceServiceHandler({
      headers: { authorization: 'Bearer valid_token' },
      body: { action: 'get_voices' }
    });

    expect(mocked.checkRateLimitDistributed).toHaveBeenCalledTimes(1);
  });
});
