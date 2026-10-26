import { captureSession } from '@/services/auth-storage.js';
/**
 * 主题状态管理
 * 支持 Wise 和 Bitget Wallet 两套主题
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { applyTheme, getCurrentTheme } from '@/design/theme-runtime.js';
import { syncDesktopAppearance } from '@/services/desktop/windows.js';
import { isDesktopRuntime } from '@/services/desktop/runtime.js';

export const useThemeStore = defineStore('theme', () => {
  // 主题类型：'wise' | 'bitget'
  const themeType = ref('wise');

  // 深色模式：true | false
  const isDark = ref(false);
  const appearance = ref(storageService.get('theme_mode', 'system') || 'system');
  const defaultStyle = isDesktopRuntime() ? 'future' : 'playful';
  const visualStyle = ref(defaultStyle);
  let preferencesPending = true;
  function restorePreferences() {
    if (!preferencesPending) return true;
    const result = storageService.read('learning_visual_style', defaultStyle);
    if (result.status !== 'ready') return false;
    visualStyle.value = result.value === 'future' ? 'future' : 'playful';
    preferencesPending = false;
    return true;
  }
  restorePreferences();
  // #ifndef H5
  if (import.meta.env.MODE !== 'test') visualStyle.value = 'future';
  // #endif
  const setVisualStyle = (style) => {
    if (!['playful', 'future'].includes(style)) return;
    if (!restorePreferences()) return false;
    if (!storageService.save('learning_visual_style', style, true, captureSession())) return false;
    visualStyle.value = style;
    return true;
  };

  /**
   * 切换主题类型
   * @param {string} type - 'wise' 或 'bitget'
   */
  const setThemeType = (type) => {
    if (type !== 'wise' && type !== 'bitget') {
      logger.warn('[ThemeStore] 无效的主题类型:', type);
      return;
    }

    themeType.value = type;
    storageService.save('theme_type', type);

    logger.log('[ThemeStore] 主题已切换至:', type);
  };

  /**
   * 切换深色模式 — 唯一的主题写入入口
   * 职责：更新 store 状态 → 持久化 → 渲染 DOM CSS 变量 → 通知订阅者
   * @param {boolean} dark - true 为深色模式，false 为浅色模式
   */
  const setDarkMode = (dark, { persist = true } = {}) => {
    const changed = isDark.value !== dark;
    if (persist && !storageService.save('theme_mode', dark ? 'dark' : 'light')) return false;
    if (persist) appearance.value = dark ? 'dark' : 'light';
    isDark.value = dark;
    // 深色模式自动切换到 Bitget，浅色模式自动切换到 Wise
    themeType.value = dark ? 'bitget' : 'wise';

    const mode = dark ? 'dark' : 'light';

    // 1. 持久化
    if (persist) {
      storageService.save('theme_type', themeType.value);
    }

    // 2. 渲染 DOM CSS 变量（委托 theme-engine 的纯渲染函数）
    applyTheme(mode);
    if (changed || persist) syncDesktopAppearance(dark);

    // 3. 通知所有订阅者（页面通过 uni.$on('themeUpdate') 监听）
    uni.$emit('themeUpdate', mode);

    logger.log('[ThemeStore] 深色模式:', dark ? '开启 (Bitget)' : '关闭 (Wise)');
    return true;
  };

  function setAppearance(mode) {
    if (!['light', 'dark', 'system'].includes(mode) || !storageService.save('theme_mode', mode)) return false;
    appearance.value = mode;
    return setDarkMode((mode === 'system' ? getCurrentTheme() : mode) === 'dark', { persist: false });
  }
  function refreshAppearance() {
    appearance.value = storageService.get('theme_mode', 'system') || 'system';
    setDarkMode(getCurrentTheme() === 'dark', { persist: false });
  }
  function resetDevicePreferences() {
    visualStyle.value = defaultStyle;
    preferencesPending = false;
    refreshAppearance();
  }
  /**
   * 切换主题（深色模式和主题类型联动）
   * 深色模式 = Bitget Wallet
   * 浅色模式 = Wise
   */
  const toggleTheme = () => {
    setDarkMode(!isDark.value);
  };

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

  /**
   * 重置 store 状态到初始值（Setup Store 手动实现）
   * 注：主题为设备偏好，通常不随登出重置，但提供方法以备不时之需
   */
  const $reset = () => {
    themeType.value = 'wise';
    isDark.value = false;
  };

  return {
    // 状态
    themeType,
    isDark,
    appearance,
    visualStyle,

    // 计算属性
    themeClass,

    // 方法
    setThemeType,
    setDarkMode,
    setAppearance,
    refreshAppearance,
    resetDevicePreferences,
    toggleTheme,
    setVisualStyle,
    restorePreferences,
    $reset
  };
});
