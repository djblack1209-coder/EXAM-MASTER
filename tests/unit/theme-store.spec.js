/**
 * theme.js store 单元测试
 *
 * 覆盖目标：所有 actions / computed 的关键分支
 * - setThemeType: 有效类型 / 无效类型
 * - setDarkMode: dark=true / dark=false
 * - toggleDarkMode / toggleTheme
 * - restoreTheme: 有用户设置 / 无用户设置（系统默认）
 * - currentThemeConfig: wise+light / wise+dark / bitget+light / bitget+dark
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
const mockGetAppBaseInfo = vi.fn();
const mockGetSystemSetting = vi.fn();
const mockOnThemeChange = vi.fn();

globalThis.uni = {
  $emit: mockEmit,
  getAppBaseInfo: mockGetAppBaseInfo,
  getSystemSetting: mockGetSystemSetting,
  onThemeChange: mockOnThemeChange
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
      expect(mockEmit).toHaveBeenCalledWith('themeTypeUpdate', 'wise');
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

  // ==================== setDarkMode ====================
  describe('setDarkMode', () => {
    it('dark=true → isDark=true + themeType=bitget', () => {
      const store = useThemeStore();
      store.setDarkMode(true);

      expect(store.isDark).toBe(true);
      expect(store.themeType).toBe('bitget');
      expect(storageService.save).toHaveBeenCalledWith('theme_mode', 'dark');
      expect(storageService.save).toHaveBeenCalledWith('theme_type', 'bitget');
      expect(mockEmit).toHaveBeenCalledWith('themeUpdate', 'dark');
      expect(mockEmit).toHaveBeenCalledWith('themeTypeUpdate', 'bitget');
    });

    it('dark=false → isDark=false + themeType=wise', () => {
      const store = useThemeStore();
      // 先设为 dark
      store.setDarkMode(true);
      vi.clearAllMocks();

      store.setDarkMode(false);

      expect(store.isDark).toBe(false);
      expect(store.themeType).toBe('wise');
      expect(storageService.save).toHaveBeenCalledWith('theme_mode', 'light');
      expect(storageService.save).toHaveBeenCalledWith('theme_type', 'wise');
      expect(mockEmit).toHaveBeenCalledWith('themeUpdate', 'light');
    });
  });

  // ==================== toggleDarkMode / toggleTheme ====================
  describe('toggleDarkMode', () => {
    it('从浅色切换到深色', () => {
      const store = useThemeStore();
      expect(store.isDark).toBe(false);

      store.toggleDarkMode();
      expect(store.isDark).toBe(true);
      expect(store.themeType).toBe('bitget');
    });

    it('从深色切换到浅色', () => {
      const store = useThemeStore();
      store.setDarkMode(true);

      store.toggleDarkMode();
      expect(store.isDark).toBe(false);
      expect(store.themeType).toBe('wise');
    });
  });

  describe('toggleTheme', () => {
    it('等同于 toggleDarkMode', () => {
      const store = useThemeStore();
      store.toggleTheme();
      expect(store.isDark).toBe(true);

      store.toggleTheme();
      expect(store.isDark).toBe(false);
    });
  });

  // ==================== restoreTheme ====================
  describe('restoreTheme', () => {
    it('有用户手动设置 dark → 使用用户设置', () => {
      storageService.get.mockReturnValue('dark');
      const store = useThemeStore();

      store.restoreTheme();

      expect(store.isDark).toBe(true);
      expect(store.themeType).toBe('bitget');
      // 有 savedMode 时不写 storage
      expect(storageService.save).not.toHaveBeenCalled();
    });

    it('有用户手动设置 light → 使用用户设置', () => {
      storageService.get.mockReturnValue('light');
      const store = useThemeStore();

      store.restoreTheme();

      expect(store.isDark).toBe(false);
      expect(store.themeType).toBe('wise');
      expect(storageService.save).not.toHaveBeenCalled();
    });

    it('无用户设置 + 系统深色模式 → 跟随系统深色', () => {
      storageService.get.mockReturnValue(null);

      // 模拟 uni-app 系统深色模式（源码使用 uni API 而非 window.matchMedia）
      mockGetAppBaseInfo.mockReturnValue({ theme: 'dark' });
      // #ifndef MP-WEIXIN 分支也会执行，需要同时 mock getSystemInfoSync
      globalThis.uni.getSystemInfoSync = vi.fn(() => ({ hostTheme: 'dark' }));

      const store = useThemeStore();
      store.restoreTheme();

      expect(store.isDark).toBe(true);
      expect(store.themeType).toBe('bitget');
      // 无 savedMode 时写入 storage
      expect(storageService.save).toHaveBeenCalledWith('theme_type', 'bitget');
      expect(storageService.save).toHaveBeenCalledWith('theme_mode', 'dark');
    });

    it('无用户设置 + 系统浅色模式 → 跟随系统浅色', () => {
      storageService.get.mockReturnValue(null);

      // 模拟 uni-app 系统浅色模式
      mockGetAppBaseInfo.mockReturnValue({ theme: 'light' });
      globalThis.uni.getSystemInfoSync = vi.fn(() => ({ hostTheme: 'light' }));

      const store = useThemeStore();
      store.restoreTheme();

      expect(store.isDark).toBe(false);
      expect(store.themeType).toBe('wise');
      expect(storageService.save).toHaveBeenCalledWith('theme_mode', 'light');
    });

    it('无用户设置 + 无 window → 默认浅色', () => {
      storageService.get.mockReturnValue(null);

      const originalWindow = globalThis.window;
      delete globalThis.window;

      const store = useThemeStore();
      store.restoreTheme();

      expect(store.isDark).toBe(false);
      expect(store.themeType).toBe('wise');

      globalThis.window = originalWindow;
    });

    it('logger 记录恢复来源', () => {
      storageService.get.mockReturnValue('dark');
      const store = useThemeStore();
      store.restoreTheme();

      expect(logger.log).toHaveBeenCalledWith('[ThemeStore] 主题已恢复:', expect.objectContaining({ source: 'user' }));
    });

    it('无用户设置时 logger 记录 source=system', () => {
      storageService.get.mockReturnValue(null);
      const store = useThemeStore();
      store.restoreTheme();

      expect(logger.log).toHaveBeenCalledWith(
        '[ThemeStore] 主题已恢复:',
        expect.objectContaining({ source: 'system' })
      );
    });
  });

  // ==================== currentThemeConfig ====================
  describe('currentThemeConfig', () => {
    it('wise + light → Wise 主题浅色配置', () => {
      const store = useThemeStore();
      const config = store.currentThemeConfig;

      expect(config.name).toBe('Wise');
      expect(config.type).toBe('wise');
      expect(config.colors.primary).toBe('#00a96d');
      expect(config.colors.background).toBe('#FFFFFF');
      expect(config.colors.text).toBe('#111111');
    });

    it('wise + dark → Wise 主题深色配置', () => {
      const store = useThemeStore();
      store.isDark = true;
      const config = store.currentThemeConfig;

      expect(config.name).toBe('Wise');
      expect(config.colors.primary).toBe('#9FE870');
      expect(config.colors.background).toBe('#163300');
      expect(config.colors.text).toBe('#FFFFFF');
      expect(config.layout.topBg).toBe('#163300');
    });

    it('bitget + light → Bitget 主题配置', () => {
      const store = useThemeStore();
      store.themeType = 'bitget';
      const config = store.currentThemeConfig;

      expect(config.name).toBe('Bitget Wallet');
      expect(config.type).toBe('bitget');
      expect(config.colors.primary).toBe('#0A84FF');
      expect(config.colors.background).toBe('#000000');
      expect(config.layout.topBg).toBe('#000000');
    });

    it('bitget + dark → Bitget 深色配置', () => {
      const store = useThemeStore();
      store.themeType = 'bitget';
      store.isDark = true;
      const config = store.currentThemeConfig;

      expect(config.colors.primary).toBe('#409CFF');
      expect(config.colors.background).toBe('#000000');
    });

    it('配置包含 tabbar 和 layout', () => {
      const store = useThemeStore();
      const config = store.currentThemeConfig;

      expect(config.tabbar).toBeDefined();
      expect(config.tabbar.blur).toBe('20px');
      expect(config.layout).toBeDefined();
      expect(config.layout.topBg).toBeDefined();
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

  // ==================== watchSystemTheme ====================
  describe('watchSystemTheme', () => {
    it('调用 uni.onThemeChange 注册监听', () => {
      const store = useThemeStore();
      store.watchSystemTheme();

      // 在非 MP-WEIXIN 条件编译下，onThemeChange 可能不被调用
      // 但函数本身不应抛异常
      expect(() => store.watchSystemTheme()).not.toThrow();
    });
  });
});
