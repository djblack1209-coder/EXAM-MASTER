/**
 * 主题管理组合式函数
 * ✅ 5.4: 提取 index 和 practice 页面重复的主题逻辑
 *
 * 注意：stores/modules/theme.js (useThemeStore) 也管理主题状态，
 * 两者共享同一个 storage key ('theme_mode') 和事件 ('themeUpdate')，
 * 因此数据是兼容的。本模块是轻量级读写工具，store 提供完整主题配置。
 * 后续可考虑让本模块内部委托给 useThemeStore 以消除双源。
 *
 * 使用方式（Options API）：
 *   import { initTheme, toggleTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme'
 *
 *   onLoad/onShow 中调用 initTheme() 获取 isDark
 *   onLoad 中调用 onThemeUpdate(cb) 监听主题变化
 *   onUnload 中调用 offThemeUpdate(cb) 清理监听（传入同一个回调引用）
 *   toggleTheme(isDark) 切换主题
 */

import { storageService } from '@/services/storageService.js';

const THEME_KEY = 'theme_mode';
const THEME_EVENT = 'themeUpdate';

/**
 * 导航栏颜色常量（与 App.vue CSS 变量 --bg-page 对应）
 * 修改主题色时只需改这一处，3 个页面自动同步
 */
export const NAV_BAR_COLORS = {
  light: { frontColor: '#000000', backgroundColor: '#b8eb89' },
  dark: { frontColor: '#ffffff', backgroundColor: '#0b0b0f' }
};

// 跟踪所有已注册的回调，支持多组件并发使用
const _registeredCallbacks = new Set();

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
  _registeredCallbacks.add(callback);
  uni.$on(THEME_EVENT, callback);
}

/**
 * 取消主题变化事件监听
 * @param {Function} [callback] - 要移除的回调。如不传，移除所有已注册的回调
 */
export function offThemeUpdate(callback) {
  if (callback) {
    uni.$off(THEME_EVENT, callback);
    _registeredCallbacks.delete(callback);
  } else {
    // 兼容旧调用方式：无参数时移除所有已注册的回调
    for (const cb of _registeredCallbacks) {
      uni.$off(THEME_EVENT, cb);
    }
    _registeredCallbacks.clear();
  }
}
