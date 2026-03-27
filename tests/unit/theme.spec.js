/**
 * theme.js 单元测试
 * 测试主题管理工具函数（含 5.3 跨平台修复验证）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/services/storageService.js', () => ({
  default: {
    get: vi.fn((key, defaultVal) => defaultVal),
    save: vi.fn()
  }
}));

vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import { isNightTime, getCurrentTheme, setTheme, updateNavigationBarColor } from '@/pages/settings/theme.js';

describe('theme.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 只 fake Date，不 fake setTimeout/setInterval，避免 happy-dom 内部定时器冲突导致 afterEach 超时
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isNightTime', () => {
    it('23:00 应返回 true', () => {
      vi.setSystemTime(new Date(2026, 0, 1, 23, 0));
      expect(isNightTime()).toBe(true);
    });

    it('03:00 应返回 true', () => {
      vi.setSystemTime(new Date(2026, 0, 1, 3, 0));
      expect(isNightTime()).toBe(true);
    });

    it('12:00 应返回 false', () => {
      vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
      expect(isNightTime()).toBe(false);
    });

    it('05:00 边界应返回 false', () => {
      vi.setSystemTime(new Date(2026, 0, 1, 5, 0));
      expect(isNightTime()).toBe(false);
    });
  });

  describe('getCurrentTheme', () => {
    it('默认返回 light', () => {
      expect(getCurrentTheme()).toBe('light');
    });
  });

  describe('setTheme', () => {
    it('保存主题并触发事件和导航栏更新', async () => {
      const storageService = (await import('@/services/storageService.js')).default;
      uni.setNavigationBarColor = vi.fn(() => Promise.resolve());

      setTheme('dark');

      expect(storageService.save).toHaveBeenCalledWith('theme_mode', 'dark');
      expect(uni.$emit).toHaveBeenCalledWith('updateTheme', 'dark');
      expect(uni.setNavigationBarColor).toHaveBeenCalledWith(
        expect.objectContaining({
          frontColor: '#ffffff',
          backgroundColor: '#0b0b0f'
        })
      );
    });
  });

  describe('updateNavigationBarColor', () => {
    it('light 模式设置黑色前景', () => {
      uni.setNavigationBarColor = vi.fn(() => Promise.resolve());

      updateNavigationBarColor('light');

      expect(uni.setNavigationBarColor).toHaveBeenCalledWith(
        expect.objectContaining({
          frontColor: '#000000',
          backgroundColor: '#b8eb89'
        })
      );
    });
  });
});
