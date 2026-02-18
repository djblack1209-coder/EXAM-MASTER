/**
 * 主题状态管理
 * 支持 Wise 和 Bitget Wallet 两套主题
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

export const useThemeStore = defineStore('theme', () => {
  // 主题类型：'wise' | 'bitget'
  const themeType = ref('wise');

  // 深色模式：true | false
  const isDark = ref(false);

  /**
     * 切换主题类型
     * @param {string} type - 'wise' 或 'bitget'
     */
  const setThemeType = (type) => {
    if (type !== 'wise' && type !== 'bitget') {
      console.warn('[ThemeStore] 无效的主题类型:', type);
      return;
    }

    themeType.value = type;
    storageService.save('theme_type', type);

    // 触发全局主题更新事件
    uni.$emit('themeTypeUpdate', type);

    logger.log('[ThemeStore] 主题已切换至:', type);
  };

  /**
     * 切换深色模式
     * @param {boolean} dark - true 为深色模式，false 为浅色模式
     */
  const setDarkMode = (dark) => {
    isDark.value = dark;
    // 深色模式自动切换到 Bitget，浅色模式自动切换到 Wise
    themeType.value = dark ? 'bitget' : 'wise';

    storageService.save('theme_mode', dark ? 'dark' : 'light');
    storageService.save('theme_type', themeType.value);

    // 触发全局深色模式更新事件
    uni.$emit('themeUpdate', dark ? 'dark' : 'light');
    uni.$emit('themeTypeUpdate', themeType.value);

    logger.log('[ThemeStore] 深色模式:', dark ? '开启 (Bitget)' : '关闭 (Wise)');
  };

  /**
     * 切换深色模式（toggle）
     */
  const toggleDarkMode = () => {
    setDarkMode(!isDark.value);
  };

  /**
     * 从缓存恢复主题设置
     * 优先使用系统深色模式设置
     */
  const restoreTheme = () => {
    // 获取系统深色模式状态（使用新API避免废弃警告）
    let systemTheme = 'light';

    // #ifdef MP-WEIXIN
    try {
      const appBaseInfo = uni.getAppBaseInfo();
      systemTheme = appBaseInfo.theme || 'light';
    } catch (_e) {
      // 降级方案：使用 getAppBaseInfo 失败时尝试 getSystemSetting
      try {
        const systemSetting = uni.getSystemSetting();
        systemTheme = systemSetting.theme || 'light';
      } catch (_e2) {
        systemTheme = 'light';
      }
    }
    // #endif

    // #ifndef MP-WEIXIN
    if (typeof window !== 'undefined' && window.matchMedia) {
      systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    // #endif

    // 检查是否有用户手动设置
    const savedMode = storageService.get('theme_mode');

    // 如果用户没有手动设置，使用系统设置
    if (!savedMode) {
      isDark.value = systemTheme === 'dark';
      themeType.value = isDark.value ? 'bitget' : 'wise';
    } else {
      // 使用用户手动设置
      isDark.value = savedMode === 'dark';
      themeType.value = isDark.value ? 'bitget' : 'wise';
    }

    // ✅ 2.2: 仅在用户未手动设置时才写入（避免每次启动都写 storage）
    if (!savedMode) {
      storageService.save('theme_type', themeType.value);
      storageService.save('theme_mode', isDark.value ? 'dark' : 'light');
    }

    logger.log('[ThemeStore] 主题已恢复:', {
      type: themeType.value,
      dark: isDark.value,
      source: savedMode ? 'user' : 'system'
    });
  };

  /**
     * 切换主题（深色模式和主题类型联动）
     * 深色模式 = Bitget Wallet
     * 浅色模式 = Wise
     * ✅ 2.2: 消除与 setDarkMode 的重复逻辑，直接委托
     */
  const toggleTheme = () => {
    setDarkMode(!isDark.value);
  };

  /**
     * 监听系统深色模式变化
     */
  const watchSystemTheme = () => {
    // 微信小程序支持监听系统主题变化
    // #ifdef MP-WEIXIN
    uni.onThemeChange((res) => {
      logger.log('[ThemeStore] 系统主题变化:', res.theme);

      // 检查用户是否手动设置过
      const savedMode = storageService.get('theme_mode');

      // 如果用户没有手动设置，跟随系统
      if (!savedMode) {
        isDark.value = res.theme === 'dark';
        themeType.value = isDark.value ? 'bitget' : 'wise';

        uni.$emit('themeUpdate', isDark.value ? 'dark' : 'light');
        uni.$emit('themeTypeUpdate', themeType.value);
      }
    });
    // #endif
  };

  /**
     * 获取当前主题的完整配置
     */
  const currentThemeConfig = computed(() => {
    const isWise = themeType.value === 'wise';
    const dark = isDark.value;

    if (isWise) {
      // Wise 主题配置
      return {
        name: 'Wise',
        type: 'wise',
        colors: {
          primary: dark ? '#9FE870' : '#00a96d',
          primaryLight: dark ? '#F2F9EE' : '#e8f5e9',
          primaryDark: dark ? '#7BC653' : '#008055',
          background: dark ? '#163300' : '#FFFFFF',
          backgroundSecondary: dark ? '#1a2e05' : '#F5F5F7',
          surface: dark ? '#1e3a0f' : '#FFFFFF',
          surfaceElevated: dark ? '#2d4e1f' : '#FFFFFF',
          text: dark ? '#FFFFFF' : '#111111',
          textSecondary: dark ? '#b0b0b0' : '#666666',
          textTertiary: dark ? '#8E8E93' : '#8E8E93',
          border: dark ? '#2d4e1f' : '#E5E5E5',
          buttonBg: dark ? '#9FE870' : '#00a96d',
          buttonText: dark ? '#111111' : '#FFFFFF',
          cardBg: dark ? '#1e3a0f' : '#FFFFFF',
          cardText: dark ? '#FFFFFF' : '#111111'
        },
        tabbar: {
          background: dark ? 'rgba(30, 58, 15, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          blur: '20px',
          borderTop: dark ? '1px solid rgba(45, 78, 31, 0.5)' : '1px solid rgba(229, 229, 229, 0.5)'
        },
        layout: {
          // Wise 布局：上白下绿（浅色模式）或全深色（深色模式）
          topBg: dark ? '#163300' : '#FFFFFF',
          middleBg: dark ? '#1a2e05' : '#00a96d',
          bottomBg: dark ? '#163300' : '#FFFFFF'
        }
      };
    } else {
      // Bitget Wallet 主题配置
      return {
        name: 'Bitget Wallet',
        type: 'bitget',
        colors: {
          primary: dark ? '#409CFF' : '#0A84FF',
          primaryLight: dark ? 'rgba(64, 156, 255, 0.2)' : 'rgba(10, 132, 255, 0.2)',
          primaryDark: dark ? '#0A84FF' : '#007AFF',
          background: dark ? '#000000' : '#000000', // Bitget 始终黑色背景
          backgroundSecondary: dark ? '#1C1C1E' : '#1C1C1E',
          surface: dark ? '#2C2C2E' : '#2C2C2E',
          surfaceElevated: dark ? '#3A3A3C' : '#3A3A3C',
          text: dark ? '#FFFFFF' : '#FFFFFF',
          textSecondary: dark ? '#E2E8F0' : '#E2E8F0',
          textTertiary: dark ? '#A0AEC0' : '#A0AEC0',
          border: dark ? '#2C2C2E' : '#2C2C2E',
          buttonBg: dark ? '#0A84FF' : '#0A84FF',
          buttonText: dark ? '#111111' : '#111111',
          cardBg: dark ? 'linear-gradient(135deg, #1a2332 0%, #2d3e50 100%)' : 'linear-gradient(135deg, #1a2332 0%, #2d3e50 100%)',
          cardText: dark ? '#FFFFFF' : '#FFFFFF'
        },
        tabbar: {
          background: dark ? 'rgba(44, 44, 46, 0.8)' : 'rgba(44, 44, 46, 0.8)',
          blur: '20px',
          borderTop: dark ? '1px solid rgba(58, 58, 60, 0.5)' : '1px solid rgba(58, 58, 60, 0.5)'
        },
        layout: {
          // Bitget 布局：纯黑色背景
          topBg: '#000000',
          middleBg: '#000000',
          bottomBg: '#000000'
        }
      };
    }
  });

  /**
     * 获取当前主题的 CSS 类名
     */
  const themeClass = computed(() => {
    const classes = [];
    classes.push(`theme-${themeType.value}`);
    if (isDark.value) {
      classes.push('dark-mode');
    }
    return classes.join(' ');
  });

  return {
    // 状态
    themeType,
    isDark,

    // 计算属性
    currentThemeConfig,
    themeClass,

    // 方法
    setThemeType,
    setDarkMode,
    toggleDarkMode,
    toggleTheme,
    restoreTheme,
    watchSystemTheme
  };
});
