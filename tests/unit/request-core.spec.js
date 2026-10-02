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
