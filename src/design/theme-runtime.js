/** 主题运行时只切换标识；色值与组件动画全部来自 yozi-tokens.scss。 */
import { storageService } from '@/services/storageService.js';

export function applyTheme(theme = 'light') {
  // #ifdef H5
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
  }
  // #endif
}

export function getCurrentTheme() {
  const preference = storageService.get('theme_mode', null);
  if (preference === 'dark' || preference === 'light') return preference;
  try {
    const saved = uni.getStorageSync('theme_mode');
    if (saved === 'dark' || saved === 'light') return saved;
    const info = uni.getAppBaseInfo?.();
    if (info?.theme === 'dark' || info?.theme === 'light') return info.theme;
  } catch {
    /* 继续使用媒体偏好。 */
  }
  // #ifdef H5
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  // #endif
  return 'light';
}

export function watchTheme(callback) {
  if (typeof callback !== 'function') return () => undefined;
  if (typeof uni !== 'undefined' && typeof uni.onThemeChange === 'function') {
    const handler = (result) => callback(result?.theme === 'dark' ? 'dark' : 'light');
    uni.onThemeChange(handler);
    return () => uni.offThemeChange?.(handler);
  }
  // #ifdef H5
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => callback(media.matches ? 'dark' : 'light');
    if (media.addEventListener) media.addEventListener('change', handler);
    else media.addListener?.(handler);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', handler);
      else media.removeListener?.(handler);
    };
  }
  // #endif
  return () => undefined;
}

export default { applyTheme, getCurrentTheme, watchTheme };
