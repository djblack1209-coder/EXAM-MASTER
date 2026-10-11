import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loginDesktopOAuth } from '@/services/desktop/oauth.js';
import { desktopOAuth } from '@/services/api/domains/auth.api.js';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), request: vi.fn(), normalize: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('@/services/api/domains/_request-core.js', () => ({ request: mocks.request, normalizeError: mocks.normalize }));

const verifier = 'ab'.repeat(32);
const challenge = 'cd'.repeat(32);
const sessionId = 'ef'.repeat(32);
const authorizationUrl = 'https://open.weixin.qq.com/connect/qrconnect?isolated-unit-test';
const start = { code: 0, data: { sessionId, authorizationUrl, expiresIn: 9, interval: 3 } };
const ready = { code: 0, data: { userId: 'isolated-desktop-user', token: 'isolated-desktop-session' } };

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.stubGlobal('__WENLI_DESKTOP__', true);
  window.__TAURI_INTERNALS__ = { invoke: vi.fn() };
  mocks.invoke.mockImplementation(async (command) =>
    command === 'create_desktop_oauth_proof' ? { verifier, challenge } : undefined
  );
  uni.clearStorageSync();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete window.__TAURI_INTERNALS__;
});

function exchangeWith(...replies) {
  const exchange = vi.fn(async (params) => (params.action === 'cancel' ? { code: 0 } : undefined));
  exchange.mockResolvedValueOnce(structuredClone(start));
  replies.forEach((reply) => exchange.mockResolvedValueOnce(reply));
  return exchange;
}
function pendingResult(exchange, current) {
  return loginDesktopOAuth('wechat', exchange, current).then(
    (value) => ({ value }),
    (error) => ({ error })
  );
}

describe('desktop browser handover', () => {
  it('opens once, polls only after the supplied interval, focuses the existing window and leaves identity storage to the page', async () => {
    const exchange = exchangeWith({ code: 0, data: { status: 'pending', interval: 3 } }, ready);
    const onOpened = vi.fn();
    const pending = loginDesktopOAuth('wechat', exchange, () => true, onOpened).then(
      (value) => ({ value }),
      (error) => ({ error })
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(exchange).toHaveBeenCalledExactlyOnceWith({ action: 'begin', provider: 'wechat', challenge });
    expect(mocks.invoke).toHaveBeenNthCalledWith(2, 'open_desktop_oauth', {
      provider: 'wechat',
      url: authorizationUrl
    });
    expect(onOpened).toHaveBeenCalledOnce();
    expect(JSON.stringify(exchange.mock.calls[0])).not.toContain(verifier);
    await vi.advanceTimersByTimeAsync(2999);
    expect(exchange).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3001);
    expect(await pending).toEqual({ value: ready });
    expect(exchange.mock.calls.slice(1).map(([params]) => params)).toEqual([
      { action: 'poll', sessionId, verifier },
      { action: 'poll', sessionId, verifier }
    ]);
    expect(mocks.invoke).toHaveBeenLastCalledWith('focus_desktop_after_oauth');
    expect(uni.getStorageSync('EXAM_TOKEN')).toBeFalsy();
    expect(localStorage.length).toBe(0);
  });
  it.each([401, 409, 429, 503])(
    'terminal reply %s stops polling, cancels once and never reopens the browser',
    async (code) => {
      const exchange = exchangeWith({ code, message: '固定失败提示' });
      const pending = pendingResult(exchange);
      await vi.advanceTimersByTimeAsync(3000);
      expect((await pending).error.message).toBe('固定失败提示');
      expect(exchange.mock.calls.map(([params]) => params.action)).toEqual(['begin', 'poll', 'cancel']);
      expect(mocks.invoke.mock.calls.filter(([command]) => command === 'open_desktop_oauth')).toHaveLength(1);
      await vi.advanceTimersByTimeAsync(600000);
      expect(exchange).toHaveBeenCalledTimes(3);
    }
  );
  it('page/account changes during the wait cancel within a bounded check and never poll', async () => {
    let current = true;
    const exchange = exchangeWith();
    const pending = pendingResult(exchange, () => current);
    await vi.advanceTimersByTimeAsync(0);
    current = false;
    await vi.advanceTimersByTimeAsync(200);
    expect((await pending).error.message).toContain('账户或页面已变化');
    expect(exchange.mock.calls.map(([params]) => params.action)).toEqual(['begin', 'cancel']);
  });
  it('account changes during a request reject a late successful identity', async () => {
    let current = true,
      resolve;
    const exchange = vi
      .fn()
      .mockResolvedValueOnce(start)
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      )
      .mockResolvedValue({ code: 0 });
    const pending = pendingResult(exchange, () => current);
    await vi.advanceTimersByTimeAsync(3000);
    current = false;
    resolve(ready);
    expect((await pending).error.message).toContain('账户或页面已变化');
    expect(mocks.invoke).not.toHaveBeenCalledWith('focus_desktop_after_oauth');
    expect(exchange.mock.calls.map(([params]) => params.action)).toEqual(['begin', 'poll', 'cancel']);
  });
  it('expires without a poll at the deadline or an automatic restart', async () => {
    const exchange = exchangeWith();
    exchange.mockImplementation(async (params) =>
      params.action === 'poll' ? { code: 0, data: { status: 'pending', interval: 3 } } : { code: 0 }
    );
    const pending = pendingResult(exchange);
    await vi.advanceTimersByTimeAsync(9000);
    expect((await pending).error.message).toContain('超时');
    expect(exchange.mock.calls.map(([params]) => params.action)).toEqual(['begin', 'poll', 'poll', 'cancel']);
  });
  it('a delayed response after expiry cannot become a login', async () => {
    let resolve;
    const exchange = vi
      .fn()
      .mockResolvedValueOnce(start)
      .mockImplementationOnce(
        () =>
          new Promise((done) => {
            resolve = done;
          })
      )
      .mockResolvedValue({ code: 0 });
    const pending = pendingResult(exchange);
    await vi.advanceTimersByTimeAsync(10000);
    resolve(ready);
    expect((await pending).error.message).toContain('超时');
    expect(mocks.invoke).not.toHaveBeenCalledWith('focus_desktop_after_oauth');
  });
  it.each([{ sessionId: 'bad' }, { expiresIn: 601 }, { interval: 1 }, { authorizationUrl: null }])(
    'rejects malformed begin data before opening and cancels only a valid session %j',
    async (patch) => {
      const exchange = vi
        .fn()
        .mockResolvedValueOnce({ code: 0, data: { ...start.data, ...patch } })
        .mockResolvedValue({ code: 0 });
      const result = await pendingResult(exchange);
      expect(result.error.message).toContain('结果无效');
      expect(mocks.invoke).not.toHaveBeenCalledWith('open_desktop_oauth', expect.anything());
      expect(exchange.mock.calls.map(([params]) => params.action)).toEqual(
        patch.sessionId ? ['begin'] : ['begin', 'cancel']
      );
    }
  );
  it('native browser opening failure has a fixed message and cancels without retrying', async () => {
    mocks.invoke.mockImplementation(async (command) => {
      if (command === 'create_desktop_oauth_proof') return { verifier, challenge };
      throw new Error('private-native-diagnostic');
    });
    const exchange = exchangeWith();
    expect((await pendingResult(exchange)).error.message).toBe('无法打开系统浏览器，请重新登录');
    expect(exchange.mock.calls.map(([params]) => params.action)).toEqual(['begin', 'cancel']);
  });
  it('a browser compile flag alone cannot request a native proof or exchange a credential', async () => {
    delete window.__TAURI_INTERNALS__;
    const exchange = exchangeWith();
    expect((await pendingResult(exchange)).error.message).toContain('桌面应用');
    expect(exchange).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('failure to create a proof is fixed and makes no backend request', async () => {
    mocks.invoke.mockRejectedValue('private-native-diagnostic');
    const exchange = exchangeWith();
    expect((await pendingResult(exchange)).error.message).toContain('不支持安全授权');
    expect(exchange).not.toHaveBeenCalled();
  });
});

describe('desktop auth API transport', () => {
  it('uses the existing login endpoint, no replay or credential logs, and overrides a caller-supplied type', async () => {
    mocks.request.mockResolvedValueOnce(ready);
    expect(await desktopOAuth({ action: 'poll', sessionId, verifier, type: 'email' })).toEqual(ready);
    expect(mocks.request).toHaveBeenCalledExactlyOnceWith(
      '/login',
      { action: 'poll', sessionId, verifier, type: 'desktop_oauth' },
      {
        skipAuth: true,
        maxRetries: 0,
        coldStartRetries: 0,
        redactErrors: true,
        suppressAuthFailure: true,
        timeout: 10000
      }
    );
  });
  it('redacts transport failures rather than exposing the proof or raw body', async () => {
    const error = new Error('private-transport-diagnostic');
    mocks.request.mockRejectedValueOnce(error);
    mocks.normalize.mockReturnValueOnce({ code: -1, message: '网络请求失败' });
    expect(await desktopOAuth({ action: 'poll', sessionId, verifier })).toEqual({ code: -1, message: '网络请求失败' });
    expect(mocks.normalize).toHaveBeenCalledExactlyOnceWith(error, '桌面授权', { redact: true });
  });
});
