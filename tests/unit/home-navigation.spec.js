import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentRoute, isHomeRoute, openHomeTab } from '@/utils/home-navigation.js';
import { safeNavigateBack } from '@/utils/safe-navigate.js';

describe('home-navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.getCurrentPages = vi.fn(() => [{ route: 'pages/index/index', options: {} }]);
  });

  const runImmediately = (callback) => callback();

  it('normalizes the current route', () => {
    globalThis.getCurrentPages = vi.fn(() => [{ route: '/pages/index/index?from=splash' }]);
    expect(getCurrentRoute()).toBe('pages/index/index');
    expect(isHomeRoute()).toBe(true);
  });

  it('uses switchTab for the home tab and confirms the target route', () => {
    const onSuccess = vi.fn();

    openHomeTab({ verifyDelays: [10], schedule: runImmediately, onSuccess });

    expect(uni.switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/index/index' }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(uni.reLaunch).not.toHaveBeenCalled();
  });

  it('falls back when switchTab reports success but the route remains on splash', () => {
    const onFail = vi.fn();
    let currentRoute = 'pages/splash/index';
    globalThis.getCurrentPages = vi.fn(() => [{ route: currentRoute }]);
    uni.reLaunch.mockImplementationOnce(({ success }) => {
      currentRoute = 'pages/index/index';
      success?.();
      return Promise.resolve();
    });

    openHomeTab({ verifyDelays: [10], schedule: runImmediately, onFail });

    expect(uni.switchTab).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/index/index' }));
    expect(uni.reLaunch).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/index/index' }));
    expect(onFail).not.toHaveBeenCalled();
  });

  it('falls back to reLaunch when switchTab fails immediately', () => {
    uni.switchTab.mockImplementationOnce(({ fail }) => fail?.({ errMsg: 'switchTab:fail' }));

    openHomeTab({ verifyDelays: [10], schedule: runImmediately });

    expect(uni.reLaunch).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/index/index' }));
  });
});

describe('single-page back recovery', () => {
  let route;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    route = 'pages/settings/privacy';
    globalThis.getCurrentPages = vi.fn(() => [{ route }]);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('refreshing a deep route returns home and only reports success after landing', () => {
    const success = vi.fn();
    const complete = vi.fn();
    uni.switchTab.mockImplementationOnce(({ success: landed }) => {
      route = 'pages/index/index';
      landed?.();
    });
    safeNavigateBack({ success, complete });
    expect(uni.navigateBack).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    vi.advanceTimersByTime(350);
    expect(success).toHaveBeenCalledTimes(1);
    expect(complete).toHaveBeenCalledTimes(1);
    expect(isHomeRoute()).toBe(true);
  });

  it('recovers a switchTab success that left the original route unchanged', () => {
    uni.reLaunch.mockImplementationOnce(({ success }) => {
      route = 'pages/index/index';
      success?.();
    });
    const success = vi.fn();
    safeNavigateBack({ success });
    vi.runAllTimers();
    expect(uni.reLaunch).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledTimes(1);
    expect(isHomeRoute()).toBe(true);
  });

  it('preserves the ordinary back stack', () => {
    globalThis.getCurrentPages = vi.fn(() => [{ route: 'pages/login/index' }, { route }]);
    safeNavigateBack();
    expect(uni.navigateBack).toHaveBeenCalledWith(expect.objectContaining({ delta: 1 }));
    expect(uni.switchTab).not.toHaveBeenCalled();
  });

  it('keeps a caller-owned failure path instead of forcing a home fallback', () => {
    const fail = vi.fn();
    uni.navigateBack.mockImplementationOnce(({ fail: denied }) => denied?.({ errMsg: 'navigateBack:fail' }));
    safeNavigateBack({ fail });
    expect(fail).toHaveBeenCalledTimes(1);
    expect(uni.switchTab).not.toHaveBeenCalled();
  });

  it('does not replace a later page with a delayed fallback', () => {
    const success = vi.fn();
    safeNavigateBack({ success });
    route = 'pages/learning/index';
    vi.runAllTimers();
    expect(uni.reLaunch).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
    expect(getCurrentRoute()).toBe('pages/learning/index');
  });

  it('does not run a stale failure fallback after the user has navigated away', () => {
    let fail;
    uni.switchTab.mockImplementationOnce((options) => {
      fail = options.fail;
    });
    safeNavigateBack();
    route = 'pages/learning/index';
    fail({ errMsg: 'switchTab:fail' });
    vi.runAllTimers();
    expect(uni.reLaunch).not.toHaveBeenCalled();
    expect(getCurrentRoute()).toBe('pages/learning/index');
  });
});
