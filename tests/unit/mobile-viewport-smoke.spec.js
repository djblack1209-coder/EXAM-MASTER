import { describe, expect, it } from 'vitest';

import {
  BLOCKING_TOAST_TEXTS,
  MOBILE_SMOKE_ROUTES,
  MOBILE_VIEWPORTS,
  findBlockingToastText
} from '../../scripts/build/mobile-viewport-smoke.mjs';

describe('mobile viewport smoke config', () => {
  it('covers the mobile shell critical path', () => {
    expect(MOBILE_SMOKE_ROUTES).toEqual([
      '/pages/splash/index',
      '/pages/login/onboarding',
      '/pages/index/index',
      '/pages/practice/index',
      '/pages/practice-sub/question-bank',
      '/pages/practice-sub/do-quiz',
      '/pages/mistake/index',
      '/pages/profile/index'
    ]);
  });

  it('covers narrow and large phone viewports', () => {
    expect(MOBILE_VIEWPORTS).toEqual([
      { width: 360, height: 800, name: 'android-compact' },
      { width: 375, height: 812, name: 'iphone-x' },
      { width: 390, height: 844, name: 'iphone-regular' },
      { width: 430, height: 932, name: 'iphone-large' }
    ]);
  });

  it('fails on blocking startup toasts that hide first-screen content', () => {
    expect(BLOCKING_TOAST_TEXTS).toContain('保存失败，请检查存储空间');
    expect(findBlockingToastText('首页\n保存失败，请检查存储空间\n今日任务')).toBe('保存失败，请检查存储空间');
    expect(findBlockingToastText('首页\n今日任务')).toBeNull();
  });
});
