/**
 * 图标注册表 — 内联关键图标 data URI，消除 SVG 文件 404 错误
 * 只内联主包 tabBar 页面使用的图标（约2KB），不拖入完整的 svg-data.js（27KB）
 */

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
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"%3E%3Crect x="3" y="3" width="18" height="18" rx="2"/%3E%3Cpath d="M12 8v4M12 16h.01"/%3E%3C/svg%3E'
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
 * 获取图标路径 — 内联 data URI，零文件依赖
 */
export function getIconPath(name, fallback) {
  const realName = ALIASES[name] || name;
  return INLINE[realName] || INLINE[name] || fallback || INLINE['info'];
}

export const ICON_MAP = INLINE;
export const ICON_MAP_DARK = INLINE;
