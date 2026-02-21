/**
 * 系统信息工具函数
 * 使用 uni.getWindowInfo / uni.getDeviceInfo / uni.getAppBaseInfo
 */

import { logger } from '../logger.js';

/**
 * 获取状态栏高度
 * @returns {number} 状态栏高度（px）
 */
export function getStatusBarHeight() {
  try {
    const windowInfo = uni.getWindowInfo();
    return windowInfo.statusBarHeight || 44;
  } catch (e) {
    logger.warn('获取状态栏高度失败，使用默认值', e);
    return 44;
  }
}

/**
 * 获取标准导航栏高度（统一计算公式）
 * @returns {number} 导航栏高度（px）= 状态栏高度 + 44px
 */
export function getNavBarHeight() {
  try {
    return getStatusBarHeight() + 44;
  } catch (e) {
    logger.warn('获取导航栏高度失败，使用默认值', e);
    return 88;
  }
}

/**
 * 获取窗口高度
 * @returns {number} 窗口高度（px）
 */
export function getWindowHeight() {
  try {
    const windowInfo = uni.getWindowInfo();
    return windowInfo.windowHeight || 800;
  } catch (e) {
    logger.warn('获取窗口高度失败，使用默认值', e);
    return 800;
  }
}

/**
 * 获取胶囊按钮信息（仅微信小程序）
 * @returns {Object|null} 胶囊按钮信息
 */
export function getMenuButtonBoundingClientRect() {
  // #ifdef MP-WEIXIN
  try {
    return uni.getMenuButtonBoundingClientRect();
  } catch (e) {
    logger.warn('获取胶囊按钮信息失败', e);
    return null;
  }
  // #endif

  // #ifndef MP-WEIXIN
  return null;
  // #endif
}

/**
 * 获取设备像素比
 * @returns {number} 设备像素比
 */
export function getPixelRatio() {
  try {
    const windowInfo = uni.getWindowInfo();
    return windowInfo.pixelRatio || 1;
  } catch (e) {
    logger.warn('获取设备像素比失败，使用默认值', e);
    return 1;
  }
}

/**
 * 获取设备信息
 * @returns {Object} 设备信息
 */
export function getDeviceInfo() {
  try {
    const deviceInfo = uni.getDeviceInfo();
    const windowInfo = uni.getWindowInfo();
    return {
      brand: deviceInfo.brand || 'unknown',
      model: deviceInfo.model || 'unknown',
      system: deviceInfo.system || 'unknown',
      platform: deviceInfo.platform || 'unknown',
      pixelRatio: windowInfo.pixelRatio || 1
    };
  } catch (e) {
    logger.warn('获取设备信息失败', e);
    return {
      brand: 'unknown',
      model: 'unknown',
      system: 'unknown',
      platform: 'unknown',
      pixelRatio: 1
    };
  }
}

/**
 * 获取窗口信息
 * @returns {Object} 窗口信息
 */
export function getWindowInfo() {
  try {
    const windowInfo = uni.getWindowInfo();
    return {
      windowWidth: windowInfo.windowWidth || 375,
      windowHeight: windowInfo.windowHeight || 667,
      screenWidth: windowInfo.screenWidth || 375,
      screenHeight: windowInfo.screenHeight || 667,
      statusBarHeight: windowInfo.statusBarHeight || 44,
      safeArea: windowInfo.safeArea || {}
    };
  } catch (e) {
    logger.warn('获取窗口信息失败', e);
    return {
      windowWidth: 375,
      windowHeight: 667,
      screenWidth: 375,
      screenHeight: 667,
      statusBarHeight: 44,
      safeArea: {}
    };
  }
}

/**
 * 获取应用基础信息
 * @returns {Object} 应用基础信息
 */
export function getAppBaseInfo() {
  try {
    const appBaseInfo = uni.getAppBaseInfo();
    return {
      SDKVersion: appBaseInfo.SDKVersion || 'unknown',
      version: appBaseInfo.version || 'unknown',
      language: appBaseInfo.language || 'zh_CN',
      theme: appBaseInfo.theme || 'light'
    };
  } catch (e) {
    logger.warn('获取应用基础信息失败', e);
    return {
      SDKVersion: 'unknown',
      version: 'unknown',
      language: 'zh_CN',
      theme: 'light'
    };
  }
}

/**
 * 获取系统主题
 * @returns {string} 'light' | 'dark'
 */
export function getSystemTheme() {
  try {
    const appBaseInfo = uni.getAppBaseInfo();
    return appBaseInfo.theme === 'dark' ? 'dark' : 'light';
  } catch (e) {
    logger.warn('获取系统主题失败', e);
    return 'light';
  }
}

/**
 * 获取完整的平台信息（用于分析和错误上报）
 * @returns {Object} 平台信息
 */
export function getPlatformInfo() {
  try {
    const deviceInfo = uni.getDeviceInfo();
    const windowInfo = uni.getWindowInfo();
    const appBaseInfo = uni.getAppBaseInfo();
    return {
      platform: deviceInfo.platform || 'unknown',
      system: deviceInfo.system || 'unknown',
      version: appBaseInfo.version || 'unknown',
      model: deviceInfo.model || 'unknown',
      brand: deviceInfo.brand || 'unknown',
      screenWidth: windowInfo.screenWidth || 375,
      screenHeight: windowInfo.screenHeight || 667,
      language: appBaseInfo.language || 'zh_CN',
      pixelRatio: windowInfo.pixelRatio || 1
    };
  } catch (e) {
    logger.warn('获取平台信息失败', e);
    return {
      platform: 'unknown',
      system: 'unknown',
      version: 'unknown',
      model: 'unknown',
      brand: 'unknown',
      screenWidth: 375,
      screenHeight: 667,
      language: 'zh_CN',
      pixelRatio: 1
    };
  }
}

/**
 * 获取用户代理字符串（用于错误上报）
 * @returns {string} 用户代理字符串
 */
export function getUserAgent() {
  try {
    const info = getPlatformInfo();
    return `${info.platform}/${info.system}/${info.version}`;
  } catch (_e) {
    return 'unknown';
  }
}
