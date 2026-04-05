/**
 * 图标注册表 — 合并完整图标库，确保所有 84 个图标可用
 * 优先使用 INLINE（主包核心图标），兜底查找 SVG_DATA（完整图标库）
 */

import { SVG_DATA } from './svg-data.js';

// 主包页面使用的核心图标（内联 data URI，消除文件依赖）
const INLINE = {
  check:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M20 6 9 17l-5-5"/%3E%3C/svg%3E',
  cross:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M18 6 6 18M6 6l12 12"/%3E%3C/svg%3E',
  close:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M18 6 6 18M6 6l12 12"/%3E%3C/svg%3E',
  star: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/%3E%3C/svg%3E',
  sparkle:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="m12 2 2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/%3E%3C/svg%3E',
  folder:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/%3E%3C/svg%3E',
  info: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3Cpath d="M12 16v-4M12 8h.01"/%3E%3C/svg%3E',
  robot:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Crect x="3" y="8" width="18" height="12" rx="2"/%3E%3Cpath d="M12 2v6M7 14h.01M17 14h.01"/%3E%3C/svg%3E',
  book: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/%3E%3Cpath d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/%3E%3C/svg%3E',
  sun: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Ccircle cx="12" cy="12" r="5"/%3E%3Cpath d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/%3E%3C/svg%3E',
  moon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/%3E%3C/svg%3E',
  refresh:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M23 4v6h-6M1 20v-6h6"/%3E%3Cpath d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/%3E%3C/svg%3E',
  calendar:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Crect x="3" y="4" width="18" height="18" rx="2"/%3E%3Cpath d="M16 2v4M8 2v4M3 10h18"/%3E%3C/svg%3E',
  upload:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/%3E%3C/svg%3E',
  books:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/%3E%3Cpath d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2zM8 7h8M8 11h6"/%3E%3C/svg%3E',
  target:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Ccircle cx="12" cy="12" r="10"/%3E%3Ccircle cx="12" cy="12" r="6"/%3E%3Ccircle cx="12" cy="12" r="2"/%3E%3C/svg%3E',
  search:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Ccircle cx="11" cy="11" r="8"/%3E%3Cpath d="m21 21-4.35-4.35"/%3E%3C/svg%3E',
  empty:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"/%3E%3Cpath d="M12 8v4M12 16h.01"/%3E%3C/svg%3E',
  bulb: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/%3E%3Cpath d="M9 18h6M10 22h4"/%3E%3C/svg%3E',
  'trend-up':
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="m23 6-9.5 9.5-5-5L1 18"/%3E%3Cpath d="M17 6h6v6"/%3E%3C/svg%3E',
  trophy:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/%3E%3Cpath d="M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22h10c0-2-1-3.25-2.03-3.79A1.07 1.07 0 0 1 14 17v-2.34"/%3E%3Cpath d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/%3E%3C/svg%3E',
  download:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/%3E%3C/svg%3E',
  'file-text':
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/%3E%3Cpath d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/%3E%3C/svg%3E',
  graduate:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="m2 10 10-5 10 5-10 5z"/%3E%3Cpath d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5"/%3E%3C/svg%3E',
  'book-open':
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/%3E%3Cpath d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/%3E%3C/svg%3E',
  briefcase:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Crect x="2" y="7" width="20" height="14" rx="2"/%3E%3Cpath d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/%3E%3C/svg%3E',
  gavel:
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Cpath d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1zM7 21h10M12 3v18M12 3 8 8M12 3l4 5"/%3E%3C/svg%3E'
};

// 别名映射
const ALIASES = {
  'category-mistakes': 'target',
  'category-hot': 'target',
  'category-practice': 'book',
  'category-concept': 'info',
  'achieve-accuracy': 'sparkle',
  'mood-celebrate': 'star'
};

/**
 * 获取图标路径 — 优先 INLINE，兜底 SVG_DATA 完整库
 * @param {string} name - 图标名称
 * @param {string} [fallback] - 找不到时的兜底图标
 * @param {string} [theme='light'] - 主题模式 'light' | 'dark'
 * @param {string} [color] - 自定义颜色（如 '#1CB0F6'），会替换 SVG 中的 currentColor
 */
export function getIconPath(name, fallback, theme, color) {
  const realName = ALIASES[name] || name;
  let uri = INLINE[realName] || INLINE[name] || SVG_DATA[realName] || SVG_DATA[name] || fallback || INLINE['info'];
  if (!uri) return uri;
  // 优先级：显式传入的 color > 深色模式白色 > 默认 currentColor（黑色）
  if (color) {
    // 将 '#' 转为 URL 编码 '%23'，确保 data URI 合法
    const encoded = color.startsWith('#') ? '%23' + color.slice(1) : color;
    uri = uri.replace(/currentColor/g, encoded);
  } else if (theme === 'dark') {
    // 深色模式：将 SVG 中的 currentColor（默认黑色）替换为白色
    uri = uri.replace(/currentColor/g, '%23ffffff');
  }
  return uri;
}

// 导出合并后的完整图标集（动态更新：SVG_DATA 异步加载完成后 ICON_MAP 自动包含）
export function getIconMap() {
  return { ...SVG_DATA, ...INLINE };
}
export const ICON_MAP = INLINE; // 初始仅包含内联图标，SVG_DATA 加载后通过 getIconPath 兜底
export const ICON_MAP_DARK = ICON_MAP;
