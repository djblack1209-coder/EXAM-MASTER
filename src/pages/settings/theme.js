/**
 * 主题管理工具函数
 * 提供深色模式、智能护眼模式等功能
 */

/**
 * 检查当前时间是否处于深夜时段（23:00 - 05:00）
 * @returns {boolean} 是否处于深夜时段
 */
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
export function isNightTime() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= 23 || hour < 5;
}

/**
 * 应用智能护眼模式
 * 在深色模式 + 深夜时段时，自动添加暖色调滤镜
 * @param {string} mode - 主题模式 'light' | 'dark'
 * @param {HTMLElement|string} container - 容器元素或选择器
 */
export function applyNightMode(mode, container) {
  // #ifdef H5
  if (mode === 'dark' && isNightTime()) {
    // 在深色模式且处于深夜时，添加护眼模式类
    if (typeof container === 'string') {
      const el = document.querySelector(container);
      if (el) el.classList.add('night-mode');
    } else if (container) {
      container.classList.add('night-mode');
    }
  } else {
    // 移除护眼模式类
    if (typeof container === 'string') {
      const el = document.querySelector(container);
      if (el) el.classList.remove('night-mode');
    } else if (container) {
      container.classList.remove('night-mode');
    }
  }
  // #endif
  // #ifndef H5
  // 非H5平台：通过CSS变量或class切换实现，不依赖DOM API
  if (mode === 'dark' && isNightTime()) {
    logger.log('[Theme] 护眼模式已启用（非H5平台）');
  }
  // #endif
}

/**
 * 更新导航栏颜色
 * @param {string} mode - 主题模式 'light' | 'dark'
 */
export function updateNavigationBarColor(mode) {
  const isDark = mode === 'dark';
  uni
    .setNavigationBarColor({
      frontColor: isDark ? '#ffffff' : '#000000',
      backgroundColor: isDark ? '#0b0b0f' : '#b8eb89',
      animation: {
        duration: 300,
        timingFunc: 'easeInOut'
      }
    })
    .catch((err) => {
      logger.log('设置导航栏颜色失败', err);
    });
}

/**
 * 获取当前主题模式
 * @returns {string} 'light' | 'dark'
 */
export function getCurrentTheme() {
  return storageService.get('theme_mode', 'light');
}

/**
 * @deprecated 请使用 useThemeStore().setDarkMode() 代替
 * 设置主题模式 — 已废弃，保留仅为向后兼容
 * @param {string} mode - 主题模式 'light' | 'dark'
 */
export function setTheme(mode) {
  storageService.save('theme_mode', mode);
  // 统一使用 themeUpdate 事件名（兼容旧的 updateTheme）
  uni.$emit('themeUpdate', mode);
  uni.$emit('updateTheme', mode);
  updateNavigationBarColor(mode);
}
