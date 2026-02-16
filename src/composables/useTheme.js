/**
 * 主题管理组合式函数
 * ✅ 5.4: 提取 index 和 practice 页面重复的主题逻辑
 *
 * 使用方式（Options API）：
 *   import { initTheme, toggleTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme'
 *
 *   onLoad/onShow 中调用 initTheme() 获取 isDark
 *   onLoad 中调用 onThemeUpdate(cb) 监听主题变化
 *   onUnload 中调用 offThemeUpdate() 清理监听
 *   toggleTheme(isDark) 切换主题
 */

import { storageService } from '@/services/storageService.js';

const THEME_KEY = 'theme_mode';
const THEME_EVENT = 'themeUpdate';

/**
 * 从本地存储读取当前主题
 * @returns {boolean} 是否为深色模式
 */
export function initTheme() {
  const saved = storageService.get(THEME_KEY, 'light');
  return saved === 'dark';
}

/**
 * 切换主题并持久化 + 广播事件
 * @param {boolean} currentIsDark - 当前是否深色（切换前）
 * @returns {boolean} 切换后的 isDark
 */
export function toggleTheme(currentIsDark) {
  const newIsDark = !currentIsDark;
  const mode = newIsDark ? 'dark' : 'light';
  storageService.save(THEME_KEY, mode);
  uni.$emit(THEME_EVENT, mode);
  return newIsDark;
}

/**
 * 监听主题变化事件
 * @param {Function} callback - 回调 (mode: 'dark'|'light') => void
 */
export function onThemeUpdate(callback) {
  uni.$on(THEME_EVENT, callback);
}

/**
 * 取消主题变化事件监听
 */
export function offThemeUpdate() {
  uni.$off(THEME_EVENT);
}
