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

describe('theme.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isNightTime', () => {
    it('23:00 应返回 true', async () => {
      vi.setSystemTime(new Date(2026, 0, 1, 23, 0));
      const { isNightTime } = await import('@/pages/settings/theme.js');
      expect(isNightTime()).toBe(true);
    });

    it('03:00 应返回 true', async () => {
      vi.setSystemTime(new Date(2026, 0, 1, 3, 0));
      const { isNightTime } = await import('@/pages/settings/theme.js');
      expect(isNightTime()).toBe(true);
    });

    it('12:00 应返回 false', async () => {
      vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
      const { isNightTime } = await import('@/pages/settings/theme.js');
      expect(isNightTime()).toBe(false);
    });

    it('05:00 边界应返回 false', async () => {
      vi.setSystemTime(new Date(2026, 0, 1, 5, 0));
      const { isNightTime } = await import('@/pages/settings/theme.js');
      expect(isNightTime()).toBe(false);
    });
  });

  describe('getCurrentTheme', () => {
    it('默认返回 light', async () => {
      const { getCurrentTheme } = await import('@/pages/settings/theme.js');
      expect(getCurrentTheme()).toBe('light');
    });
  });

  describe('setTheme', () => {
    it('保存主题并触发事件和导航栏更新', async () => {
      const storageService = (await import('@/services/storageService.js')).default;
      uni.setNavigationBarColor = vi.fn(() => Promise.resolve());
      const { setTheme } = await import('@/pages/settings/theme.js');

      setTheme('dark');

      expect(storageService.save).toHaveBeenCalledWith('theme_mode', 'dark');
      expect(uni.$emit).toHaveBeenCalledWith('updateTheme', 'dark');
      expect(uni.setNavigationBarColor).toHaveBeenCalledWith(
        expect.objectContaining({
          frontColor: '#ffffff',
          backgroundColor: '#163300'
        })
      );
    });
  });

  describe('updateNavigationBarColor', () => {
    it('light 模式设置黑色前景', async () => {
      uni.setNavigationBarColor = vi.fn(() => Promise.resolve());
      const { updateNavigationBarColor } = await import('@/pages/settings/theme.js');

      updateNavigationBarColor('light');

      expect(uni.setNavigationBarColor).toHaveBeenCalledWith(
        expect.objectContaining({
          frontColor: '#000000',
          backgroundColor: '#F8FAFC'
        })
      );
    });
  });
});
