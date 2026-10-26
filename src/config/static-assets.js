/**
 * 静态资源 CDN 映射模块
 *
 * 将大体积图片资源从本地 /static/ 路径迁移到 CDN，
 * 减小微信小程序主包体积（从 3.46MB 降至 2MB 以下）。
 *
 * 工作原理：
 * - 配置了 VITE_CDN_URL 时：返回 CDN 地址（如 https://xxx.sealosbja.site/static/badges/xxx.png）
 * - 未配置 VITE_CDN_URL 时：返回本地 /static/ 路径（兼容 H5 和开发环境）
 *
 * 品牌与分享图始终引用当前本地 Logo；动态教学图片继续沿用既有 CDN / 本地规则。
 *
 * @module config/static-assets
 */

import config from '@/config';
import { logger } from '@/utils/logger.js';

/**
 * CDN 基础地址（末尾不含斜杠）
 * 例如：https://nf98ia8qnt.sealosbja.site/static
 */
const configuredCdnBase = config?.cdn?.url ? config.cdn.url.replace(/\/+$/, '') : '';
const isH5Runtime = typeof window !== 'undefined' && typeof document !== 'undefined';

function isSafeCdnBase(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(parsed.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

const CDN_BASE = isSafeCdnBase(configuredCdnBase) && !isH5Runtime ? configuredCdnBase : '';

/**
 * 是否启用 CDN（配置了 CDN 地址则启用）
 */
const useCdn = !!CDN_BASE;

// Brand assets are always bundled locally; retired registry entries must not resurrect old artwork.
const MINI_PROGRAM_LOCAL_ASSETS = new Set(['images/logo.png']);
const ASSET_REGISTRY = Object.freeze({
  images: Object.freeze({ logo: 'images/logo.png', 'app-share-cover': 'images/logo.png' })
});
const LOCAL_ONLY_CATEGORIES = ['images'];

/**
 * 获取静态资源的完整 URL
 *
 * @param {string} category - 当前静态注册分类 images
 * @param {string} name - 当前名称 logo / app-share-cover
 * @returns {string} 完整的资源路径（CDN 地址或本地 /static/ 路径）
 *
 * @example
 * // 品牌不随 CDN 配置改变
 * getAssetUrl('images', 'logo')
 * // => '/static/images/logo.png'
 *
 * // CDN 未配置时
 * getAssetUrl('images', 'logo')
 * // => '/static/images/logo.png'
 *
 */
export function getAssetUrl(category, name) {
  const categoryMap = ASSET_REGISTRY[category];
  if (!categoryMap) {
    logger.warn('[static-assets] 未知的资源分类: [省略]');
    return '';
  }

  const relativePath = categoryMap[name];
  if (!relativePath) {
    logger.warn('[static-assets] 未找到资源: [省略]/[省略]');
    return '';
  }

  // 当前品牌始终使用本地包内素材
  if (LOCAL_ONLY_CATEGORIES.includes(category)) {
    return `/static/${relativePath}`;
  }

  // 配置了 CDN 则使用 CDN 地址，否则使用本地路径
  if (useCdn) {
    return `${CDN_BASE}/${relativePath}`;
  }

  if (!isH5Runtime && !MINI_PROGRAM_LOCAL_ASSETS.has(relativePath)) {
    return '';
  }

  return `/static/${relativePath}`;
}

/**
 * Resolve a dynamic static asset path from generated question-bank data.
 *
 * Question-bank JSON stores stable relative paths such as
 * `question-bank/math1-2025/paper-page-01.jpg`. H5 can load them from the
 * copied `/static` directory, while mini-program/App production builds should
 * use the configured CDN base to avoid packaging large PDF page images.
 */
export function getStaticAssetUrl(relativePath) {
  const rawPath = String(relativePath || '').trim();
  if (!rawPath) return '';
  if (/^(https?:|data:|blob:)/i.test(rawPath)) return rawPath;

  const normalizedPath = rawPath
    .replace(/^\/+/, '')
    .replace(/^static\//, '')
    .replace(/\\/g, '/');
  if (!normalizedPath || normalizedPath.includes('..')) return '';

  if (useCdn) {
    return `${CDN_BASE}/${normalizedPath}`;
  }

  if (isH5Runtime || MINI_PROGRAM_LOCAL_ASSETS.has(normalizedPath)) {
    return `/static/${normalizedPath}`;
  }

  return '';
}

/**
 * 批量获取某个分类下所有资源的 URL 映射
 *
 * @param {string} category - 资源分类
 * @returns {Object} { 资源名: 完整URL } 的映射对象
 *
 * @example
 * const images = getAssetUrls('images');
 */
export function getAssetUrls(category) {
  const categoryMap = ASSET_REGISTRY[category];
  if (!categoryMap) {
    logger.warn('[static-assets] 未知的资源分类: [省略]');
    return {};
  }

  const result = {};
  for (const name of Object.keys(categoryMap)) {
    result[name] = getAssetUrl(category, name);
  }
  return result;
}

/**
 * 预定义的常用资源路径（方便直接引用，避免每次调用 getAssetUrl）
 */
export const ASSETS = Object.freeze({
  logo: getAssetUrl('images', 'logo'),
  appShareCover: getAssetUrl('images', 'app-share-cover')
});

export default {
  getAssetUrl,
  getStaticAssetUrl,
  getAssetUrls,
  ASSETS,
  /** 暴露 CDN 状态，方便调试 */
  useCdn,
  cdnBase: CDN_BASE
};
