import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentRoute, isHomeRoute, openHomeTab } from '@/utils/home-navigation.js';

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
