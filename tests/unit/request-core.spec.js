import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));

vi.mock('@/utils/core/performance.js', () => ({
  perfMonitor: { trackApi: vi.fn(), trackRender: vi.fn(), getReport: vi.fn(() => ({})) }
}));

describe('request core', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    const listeners = new Map();
    uni.$on.mockImplementation((name, callback) => listeners.set(name, callback));
    uni.$emit.mockImplementation((name, ...args) => listeners.get(name)?.(...args));
    global.__mockStorage = {
      EXAM_USER_ID: 'user_123'
    };

    global.uni.getNetworkType = vi.fn(({ success }) => {
      success?.({ networkType: 'wifi' });
    });

    global.uni.request = vi.fn(({ data, success }) => {
      success?.({
        statusCode: 200,
        data: {
          code: 0,
          success: true,
          data: { receivedUserId: data.userId }
        }
      });
      return { abort: vi.fn() };
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('legacy list reads after confirmed import see current records instead of the pre-write cache', async () => {
    let saved = false;
    uni.request.mockImplementation(({ data, success }) => {
      if (data.action === 'batchSync') saved = true;
      success({
        statusCode: 200,
        data: {
          code: 0,
          success: true,
          data:
            data.action === 'get'
              ? saved
                ? [{ id: 'old' }, { id: 'new-full-original' }]
                : [{ id: 'old' }]
              : { results: [] }
        }
      });
      return { abort: vi.fn() };
    });
    const api = await import('@/services/api/domains/practice.api.js');
    expect((await api.getMistakes('user_123', { page: 1, limit: 20 })).data).toHaveLength(1);
    await api.batchSyncMistakes('user_123', [{ id: 'local-new', question_content: '完整原件' }]);
    expect((await api.getMistakes('user_123', { page: 1, limit: 20 })).data).toEqual([
      { id: 'old' },
      { id: 'new-full-original' }
    ]);
    expect(uni.request).toHaveBeenCalledTimes(3);
  });

  it('adds fallback userId to the outbound request without mutating caller payload', async () => {
    const { request } = await import('@/services/api/domains/_request-core.js');
    const payload = { action: 'submit', answer: 'A' };

    const result = await request('/answer-submit', payload, { skipRateLimit: true, skipCache: true });

    expect(result.success).toBe(true);
    expect(payload).toEqual({ action: 'submit', answer: 'A' });
    expect(global.uni.request).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { action: 'submit', answer: 'A', userId: 'user_123' }
      })
    );
  });

  it('isolates identical in-flight writes across accounts and refuses the old result', async () => {
    const callbacks = [];
    uni.request.mockImplementation((options) => {
      callbacks.push(options);
      return { abort: vi.fn() };
    });
    const { request } = await import('@/services/api/domains/_request-core.js');
    const options = { skipNetworkCheck: true, skipRateLimit: true };
    const first = request('/answer-submit', { action: 'submit' }, options).catch((error) => error);
    global.__mockStorage.EXAM_USER_ID = 'user_456';
    const second = request('/answer-submit', { action: 'submit' }, options);
    expect(callbacks).toHaveLength(2);
    callbacks[0].success({ statusCode: 200, data: { code: 0, data: { owner: 'user_123' } } });
    callbacks[1].success({ statusCode: 200, data: { code: 0, data: { owner: 'user_456' } } });
    expect(await first).toMatchObject({ success: false, error: { errorType: 'account_changed' } });
    expect((await second).data.owner).toBe('user_456');
  });

  it('does not send after account changes during network preflight or emit stale auth failures', async () => {
    let network;
    uni.getNetworkType.mockImplementation((options) => {
      network = options;
    });
    const { request } = await import('@/services/api/domains/_request-core.js');
    const first = request('/user-profile', {}, { skipRateLimit: true }).catch((error) => error);
    global.__mockStorage.EXAM_USER_ID = 'user_456';
    network.success({ networkType: 'wifi' });
    expect(await first).toMatchObject({ success: false });
    expect(uni.request).not.toHaveBeenCalled();
    let callback;
    uni.request.mockImplementation((options) => {
      callback = options;
      return { abort: vi.fn() };
    });
    const second = request('/user-profile', {}, { skipRateLimit: true, skipNetworkCheck: true }).catch(
      (error) => error
    );
    global.__mockStorage.EXAM_USER_ID = 'user_789';
    uni.$emit.mockClear();
    callback.success({ statusCode: 401, data: {} });
    expect(await second).toMatchObject({ success: false });
    expect(uni.$emit).not.toHaveBeenCalledWith('authFailure', expect.anything());
  });

  it('aborts the actual task without retry and preserves replacement in-flight deduplication', async () => {
    const callbacks = [],
      tasks = [];
    uni.request.mockImplementation((options) => {
      callbacks.push(options);
      const task = { abort: vi.fn() };
      tasks.push(task);
      return task;
    });
    const { request, getRequestKey, abortRequest } = await import('@/services/api/domains/_request-core.js');
    const body = { action: 'get' },
      options = { skipNetworkCheck: true, skipRateLimit: true };
    const first = request('/user-profile', body, options).catch((error) => error);
    expect(abortRequest(getRequestKey('/user-profile', body))).toBe(true);
    expect(tasks[0].abort).toHaveBeenCalledOnce();
    const second = request('/user-profile', body, options);
    expect(await first).toMatchObject({ success: false });
    const third = request('/user-profile', body, options);
    expect(callbacks).toHaveLength(2);
    callbacks[0].success({ statusCode: 200, data: { code: 0, data: { stale: true } } });
    callbacks[1].success({ statusCode: 200, data: { code: 0, data: { fresh: true } } });
    expect((await second).data).toEqual({ fresh: true });
    expect((await third).data).toEqual({ fresh: true });
  });

  it('rejects late responses even after logout and returning to the original account', async () => {
    let callback;
    uni.request.mockImplementation((options) => {
      callback = options;
      return { abort: vi.fn() };
    });
    const { request } = await import('@/services/api/domains/_request-core.js');
    const result = request('/user-profile', { action: 'get' }, { skipNetworkCheck: true, skipRateLimit: true }).catch(
      (error) => error
    );
    uni.$emit('user:logout');
    callback.success({ statusCode: 200, data: { code: 0, data: { stale: true } } });
    expect(await result).toMatchObject({ success: false });
  });

  it('does not retry with old credentials after the account changes', async () => {
    let callback;
    uni.request.mockImplementation((options) => {
      callback = options;
      return { abort: vi.fn() };
    });
    const { request } = await import('@/services/api/domains/_request-core.js');
    const result = request('/user-profile', {}, { skipNetworkCheck: true, skipRateLimit: true }).catch(
      (error) => error
    );
    callback.fail({ errMsg: 'request:fail network' });
    await Promise.resolve();
    global.__mockStorage.EXAM_USER_ID = 'user_456';
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toMatchObject({ success: false });
    expect(uni.request).toHaveBeenCalledOnce();
  });
});

describe('QQ 登录错误保留固定提示并隐藏上游详情', () => {
  it.each([
    [401, 'QQ 登录校验失败，请重新登录', 'QQ 登录校验失败，请重新登录'],
    [409, 'QQ 账户关联冲突，请联系管理员', 'QQ 账户关联冲突，请联系管理员'],
    [401, 'QQ 登录校验失败，请重新登录 TEST_ONLY_private_token', '登录验证失败，请重新登录']
  ])('%s 错误仅匹配完整业务文案', async (code, message, expected) => {
    uni.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { code, message, error: { token: 'TEST_ONLY_private_token' } } });
      return { abort: vi.fn() };
    });
    const { login } = await import('@/services/api/domains/auth.api.js');
    const result = await login({ type: 'qq', platform: 'app', accessToken: 'TEST_ONLY_native_token' });
    expect(result.message).toBe(expected);
    expect(result.data).toBeNull();
    expect(JSON.stringify(result)).not.toContain('TEST_ONLY_private_token');
    expect(result).not.toHaveProperty('error');
    expect(uni.request).toHaveBeenCalledOnce();
    expect(uni.$emit).not.toHaveBeenCalledWith('authFailure', expect.anything());
  });
});

describe('桌面授权只保留完整固定错误文案', () => {
  it.each([
    [503, '桌面授权未配置，请使用邮箱登录', '桌面授权未配置，请使用邮箱登录'],
    [401, '桌面授权已过期，请重新登录', '桌面授权已过期，请重新登录'],
    [409, '本次桌面授权已领取，请重新登录', '本次桌面授权已领取，请重新登录'],
    [401, '用户取消授权', '用户取消授权'],
    [403, '桌面授权校验失败', '桌面授权校验失败'],
    [401, '用户取消授权 TEST_ONLY_private_proof', '登录验证失败，请重新登录']
  ])('%s 经过实际请求脱敏后仍可采取对应操作', async (code, message, expected) => {
    uni.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { code, message, error: { verifier: 'TEST_ONLY_private_proof' } } });
      return { abort: vi.fn() };
    });
    const { desktopOAuth } = await import('@/services/api/domains/auth.api.js');
    const result = await desktopOAuth({ action: 'poll', sessionId: 'ab'.repeat(32), verifier: 'cd'.repeat(32) });
    expect(result.message).toBe(expected);
    expect(JSON.stringify(result)).not.toContain('TEST_ONLY_private_proof');
    expect(uni.request).toHaveBeenCalledOnce();
    expect(uni.$emit).not.toHaveBeenCalledWith('authFailure', expect.anything());
  });
});

describe('登录凭证请求的零自动重放与脱敏', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    uni.getNetworkType.mockImplementation(({ success }) => success({ networkType: 'wifi' }));
    uni.clearStorageSync();
    uni.$on.mockImplementation(() => {});
    uni.$emit.mockImplementation(() => {});
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });
  it.each(['timeout', 'cold-start-404', 'server-503', 'malformed-json', 'business-error', 'auth-401'])(
    '%s 仅发一次，原始凭据不进入日志/回执，也不广播已登录账户失效',
    async (failure) => {
      const privateValue = 'TEST_ONLY_private_oauth_credential';
      uni.request.mockImplementation(({ success, fail }) => {
        if (failure === 'timeout')
          fail({ errMsg: `request:fail timeout ${privateValue}`, request: { code: privateValue } });
        if (failure === 'cold-start-404') success({ statusCode: 404, data: `Function Not Found ${privateValue}` });
        if (failure === 'server-503')
          success({ statusCode: 503, data: { message: privateValue, error: privateValue } });
        if (failure === 'malformed-json') success({ statusCode: 200, data: privateValue });
        if (failure === 'business-error')
          success({
            statusCode: 200,
            data: {
              code: 401,
              message: `授权失败 ${privateValue}`,
              data: { access_token: privateValue },
              error: { privateValue }
            }
          });
        if (failure === 'auth-401') success({ statusCode: 401, data: { error: privateValue } });
        return { abort: vi.fn() };
      });
      const { login } = await import('@/services/api/domains/auth.api.js');
      const { logger } = await import('@/utils/logger.js');
      const result = await login({ type: 'wechat', platform: 'app', code: privateValue });
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
      expect(result).not.toHaveProperty('_rawMessage');
      expect(result).not.toHaveProperty('error');
      expect(uni.request).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(30_000);
      expect(uni.request).toHaveBeenCalledTimes(1);
      expect(uni.$emit).not.toHaveBeenCalledWith('authFailure', expect.anything());
      expect(
        JSON.stringify([result, logger.log.mock.calls, logger.warn.mock.calls, logger.error.mock.calls])
      ).not.toContain(privateValue);
    }
  );
  it('成功回执保留本业务 JWT，额外错误对象与账户标识不进入开发日志', async () => {
    uni.request.mockImplementation(({ success }) => {
      success({
        statusCode: 200,
        data: {
          code: 0,
          data: { token: 'TEST_ONLY_own_jwt', userId: 'TEST_ONLY_own_user' },
          error: { token: 'TEST_ONLY_private_provider' }
        }
      });
      return { abort: vi.fn() };
    });
    const { login } = await import('@/services/api/domains/auth.api.js');
    const { logger } = await import('@/utils/logger.js');
    const result = await login({ type: 'wechat_h5', code: 'TEST_ONLY_code' });
    expect(result.data).toEqual({ token: 'TEST_ONLY_own_jwt', userId: 'TEST_ONLY_own_user' });
    expect(result).not.toHaveProperty('error');
    const logged = JSON.stringify([logger.log.mock.calls, logger.warn.mock.calls, logger.error.mock.calls]);
    for (const value of ['TEST_ONLY_own_jwt', 'TEST_ONLY_own_user', 'TEST_ONLY_private_provider', 'TEST_ONLY_code'])
      expect(logged).not.toContain(value);
    expect(uni.request).toHaveBeenCalledOnce();
  });

  it.each([
    [400, '新用户注册需先完成邮箱验证码校验', '该邮箱未注册，请先注册'],
    [401, '密码错误', '邮箱或密码错误'],
    [401, '该账号未设置密码，请使用验证码登录', '该账号未设置密码，请使用验证码登录'],
    [401, '验证码错误或已过期', '验证码错误或已过期'],
    [400, '密码强度不足: TEST_ONLY_private_description', '密码强度不足，请按要求设置密码'],
    [401, '密码错误 TEST_ONLY_private_description', '登录验证失败，请重新登录'],
    [400, '邮箱格式不正确', '邮箱格式不正确']
  ])('邮箱业务错误 %s/%s 保留固定操作提示且不显示任意原始描述', async (code, message, expected) => {
    uni.request.mockImplementation(({ success }) => {
      success({ statusCode: 200, data: { code, message, error: { secret: 'TEST_ONLY_private_description' } } });
      return { abort: vi.fn() };
    });
    const { login } = await import('@/services/api/domains/auth.api.js');
    const { resolveEmailAuthErrorMessage } = await import('@/pages/login/email-auth-utils.js');
    const result = await login({ type: 'email', email: 'TEST_ONLY_email@example.invalid', password: 'TEST_ONLY' });
    expect(resolveEmailAuthErrorMessage(result.message)).toBe(expected);
    expect(result.data).toBeNull();
    expect(JSON.stringify(result)).not.toContain('TEST_ONLY_private_description');
    expect(result).not.toHaveProperty('error');
    expect(result).not.toHaveProperty('_rawMessage');
    expect(uni.request).toHaveBeenCalledOnce();
    expect(uni.$emit).not.toHaveBeenCalledWith('authFailure', expect.anything());
  });
});
