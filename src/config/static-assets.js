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
 * 注意：tabbar 图标不走 CDN，微信小程序要求 tabbar 图标必须是本地文件
 *
 * @module config/static-assets
 */

import config from '@/config';

/**
 * CDN 基础地址（末尾不含斜杠）
 * 例如：https://nf98ia8qnt.sealosbja.site/static
 */
const CDN_BASE = config.cdn.url ? config.cdn.url.replace(/\/+$/, '') : '';

/**
 * 是否启用 CDN（配置了 CDN 地址则启用）
 */
const useCdn = !!CDN_BASE;

/**
 * 静态资源注册表
 * 按分类管理所有大体积静态资源
 * key = 资源名（不含扩展名），value = 相对路径（相对于 /static/ 目录）
 */
const ASSET_REGISTRY = {
  // ==================== 成就徽章 ====================
  badges: {
    'streak-7day': 'badges/streak-7day.png',
    'streak-30day': 'badges/streak-30day.png',
    'accuracy-90': 'badges/accuracy-90.png',
    'first-100': 'badges/first-100.png',
    'master-500': 'badges/master-500.png',
    'pk-victory': 'badges/pk-victory.png',
    scholar: 'badges/scholar.png',
    'speed-demon': 'badges/speed-demon.png',
    'perfect-score': 'badges/perfect-score.png',
    'knowledge-explorer': 'badges/knowledge-explorer.png'
  },

  // ==================== 插画 ====================
  illustrations: {
    'mascot-owl': 'illustrations/mascot-owl.png',
    'ai-welcome': 'illustrations/ai-welcome.png',
    'empty-search': 'illustrations/empty-search.png',
    'empty-journey': 'illustrations/empty-journey.png',
    'school-guide': 'illustrations/school-guide.png',
    // 引导页插画（login 子包本地也有副本，CDN 作为备选）
    'onboard-choose-exam': 'illustrations/onboard-choose-exam.png',
    'onboard-set-goal': 'illustrations/onboard-set-goal.png',
    'onboard-import': 'illustrations/onboard-import.png',
    'onboard-ready': 'illustrations/onboard-ready.png',
    // PK 对战等待插画（practice-sub 子包本地也有副本）
    'pk-waiting': 'illustrations/pk-waiting.png'
  },

  // ==================== 通用图片 ====================
  images: {
    'default-avatar': 'images/default-avatar.png',
    'app-share-cover': 'images/app-share-cover.png',
    logo: 'images/logo.png',
    'logo-full': 'images/logo-full.png'
  },

  // ==================== 特效图片 ====================
  effects: {
    'star-sparkle': 'effects/star-sparkle.png'
  },

  // ==================== 功能图标 ====================
  icons: {
    'ai-chat': 'icons/ai-chat.png',
    'bookmark-save': 'icons/bookmark-save.png',
    'camera-search': 'icons/camera-search.png',
    'clock-timer': 'icons/clock-timer.png',
    'crossed-swords': 'icons/crossed-swords.png',
    'doc-convert': 'icons/doc-convert.png',
    'flame-streak': 'icons/flame-streak.png',
    'rocket-launch': 'icons/rocket-launch.png',
    'star-badge': 'icons/star-badge.png',
    'target-bullseye': 'icons/target-bullseye.png',
    'trophy-cup': 'icons/trophy-cup.png'
  },

  // ==================== 底部导航栏图标（不走 CDN，微信要求本地文件） ====================
  tabbar: {
    home: 'tabbar/home.png',
    'home-active': 'tabbar/home-active.png',
    practice: 'tabbar/practice.png',
    'practice-active': 'tabbar/practice-active.png',
    school: 'tabbar/school.png',
    'school-active': 'tabbar/school-active.png',
    profile: 'tabbar/profile.png',
    'profile-active': 'tabbar/profile-active.png'
  }
};

/**
 * 不走 CDN 的分类列表
 * 微信小程序 tabbar 图标必须是本地文件，所以排除在外
 */
const LOCAL_ONLY_CATEGORIES = ['tabbar'];

/**
 * 获取静态资源的完整 URL
 *
 * @param {string} category - 资源分类：badges / illustrations / images / effects / icons / tabbar
 * @param {string} name - 资源名称（不含扩展名），如 'default-avatar'、'star-sparkle'
 * @returns {string} 完整的资源路径（CDN 地址或本地 /static/ 路径）
 *
 * @example
 * // CDN 已配置时
 * getAssetUrl('images', 'default-avatar')
 * // => 'https://nf98ia8qnt.sealosbja.site/static/images/default-avatar.png'
 *
 * // CDN 未配置时
 * getAssetUrl('images', 'default-avatar')
 * // => '/static/images/default-avatar.png'
 *
 * // tabbar 图标始终返回本地路径
 * getAssetUrl('tabbar', 'home')
 * // => '/static/tabbar/home.png'
 */
export function getAssetUrl(category, name) {
  const categoryMap = ASSET_REGISTRY[category];
  if (!categoryMap) {
    console.warn(`[static-assets] 未知的资源分类: ${category}`);
    return '';
  }

  const relativePath = categoryMap[name];
  if (!relativePath) {
    console.warn(`[static-assets] 未找到资源: ${category}/${name}`);
    return '';
  }

  // tabbar 等特殊分类强制使用本地路径
  if (LOCAL_ONLY_CATEGORIES.includes(category)) {
    return `/static/${relativePath}`;
  }

  // 配置了 CDN 则使用 CDN 地址，否则使用本地路径
  if (useCdn) {
    return `${CDN_BASE}/${relativePath}`;
  }

  return `/static/${relativePath}`;
}

/**
 * 批量获取某个分类下所有资源的 URL 映射
 *
 * @param {string} category - 资源分类
 * @returns {Object} { 资源名: 完整URL } 的映射对象
 *
 * @example
 * const badges = getAssetUrls('badges');
 * // => { 'streak-7day': 'https://cdn.../badges/streak-7day.png', ... }
 */
export function getAssetUrls(category) {
  const categoryMap = ASSET_REGISTRY[category];
  if (!categoryMap) {
    console.warn(`[static-assets] 未知的资源分类: ${category}`);
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
export const ASSETS = {
  /** 默认头像 */
  defaultAvatar: getAssetUrl('images', 'default-avatar'),
  /** 应用分享封面 */
  appShareCover: getAssetUrl('images', 'app-share-cover'),
  /** 应用 Logo */
  logo: getAssetUrl('images', 'logo'),
  /** 应用完整 Logo */
  logoFull: getAssetUrl('images', 'logo-full'),
  /** 星光特效 */
  starSparkle: getAssetUrl('effects', 'star-sparkle')
};

export default {
  getAssetUrl,
  getAssetUrls,
  ASSETS,
  /** 暴露 CDN 状态，方便调试 */
  useCdn,
  cdnBase: CDN_BASE
};
