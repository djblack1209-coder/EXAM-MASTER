/**
 * theme.js store 单元测试
 *
 * 覆盖目标：所有 actions / computed 的关键分支
 * - setThemeType: 有效类型 / 无效类型
 * - toggleTheme: 切换深色/浅色模式
 * - themeClass: 各组合
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

// Mock storageService
vi.mock('../../src/services/storageService.js', () => ({
  default: {
    get: vi.fn(),
    save: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import storageService from '../../src/services/storageService.js';
import { logger } from '../../src/utils/logger.js';

// uni mock
const mockEmit = vi.fn();

globalThis.uni = {
  $emit: mockEmit
};

describe('useThemeStore', () => {
  let useThemeStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    setActivePinia(createPinia());

    // 动态导入以获取新鲜模块
    const mod = await import('../../src/stores/modules/theme.js');
    useThemeStore = mod.useThemeStore;
  });

  // ==================== 初始状态 ====================
  describe('初始状态', () => {
    it('默认 wise 主题 + 浅色模式', () => {
      const store = useThemeStore();
      expect(store.themeType).toBe('wise');
      expect(store.isDark).toBe(false);
    });
  });

  // ==================== setThemeType ====================
  describe('setThemeType', () => {
    it('设置有效类型 wise', () => {
      const store = useThemeStore();
      store.setThemeType('wise');

      expect(store.themeType).toBe('wise');
      expect(storageService.save).toHaveBeenCalledWith('theme_type', 'wise');
      // themeTypeUpdate 事件已移除（无监听器，属死代码）
    });

    it('设置有效类型 bitget', () => {
      const store = useThemeStore();
      store.setThemeType('bitget');

      expect(store.themeType).toBe('bitget');
      expect(storageService.save).toHaveBeenCalledWith('theme_type', 'bitget');
    });

    it('无效类型 → 不修改 + 警告', () => {
      const store = useThemeStore();
      store.setThemeType('invalid');

      expect(store.themeType).toBe('wise'); // 保持默认
      expect(storageService.save).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('undefined → 不修改', () => {
      const store = useThemeStore();
      store.setThemeType(undefined);
      expect(store.themeType).toBe('wise');
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  // ==================== toggleTheme ====================
  describe('toggleTheme', () => {
    it('从浅色切换到深色', () => {
      const store = useThemeStore();
      expect(store.isDark).toBe(false);

      store.toggleTheme();
      expect(store.isDark).toBe(true);
      expect(store.themeType).toBe('bitget');
      expect(storageService.save).toHaveBeenCalledWith('theme_mode', 'dark');
      expect(storageService.save).toHaveBeenCalledWith('theme_type', 'bitget');
      expect(mockEmit).toHaveBeenCalledWith('themeUpdate', 'dark');
      // themeTypeUpdate 事件已移除（无监听器，属死代码）
    });

    it('从深色切换到浅色', () => {
      const store = useThemeStore();
      store.toggleTheme(); // → dark
      vi.clearAllMocks();

      store.toggleTheme(); // → light
      expect(store.isDark).toBe(false);
      expect(store.themeType).toBe('wise');
      expect(storageService.save).toHaveBeenCalledWith('theme_mode', 'light');
      expect(storageService.save).toHaveBeenCalledWith('theme_type', 'wise');
      expect(mockEmit).toHaveBeenCalledWith('themeUpdate', 'light');
    });

    it('连续切换两次回到初始状态', () => {
      const store = useThemeStore();
      store.toggleTheme();
      expect(store.isDark).toBe(true);

      store.toggleTheme();
      expect(store.isDark).toBe(false);
    });
  });

  // ==================== themeClass ====================
  describe('themeClass', () => {
    it('wise + 浅色 → "theme-wise"', () => {
      const store = useThemeStore();
      expect(store.themeClass).toBe('theme-wise');
    });

    it('wise + 深色 → "theme-wise dark-mode"', () => {
      const store = useThemeStore();
      store.isDark = true;
      expect(store.themeClass).toBe('theme-wise dark-mode');
    });

    it('bitget + 浅色 → "theme-bitget"', () => {
      const store = useThemeStore();
      store.themeType = 'bitget';
      expect(store.themeClass).toBe('theme-bitget');
    });

    it('bitget + 深色 → "theme-bitget dark-mode"', () => {
      const store = useThemeStore();
      store.themeType = 'bitget';
      store.isDark = true;
      expect(store.themeClass).toBe('theme-bitget dark-mode');
    });
  });
});
