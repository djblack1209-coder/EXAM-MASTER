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
      logger.warn('[ThemeStore] 无效的主题类型:', type);
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

  return {
    // 状态
    themeType,
    isDark,

    // 计算属性
    themeClass,

    // 方法
    setThemeType,
    toggleTheme
  };
});
