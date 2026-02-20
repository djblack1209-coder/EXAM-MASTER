/**
 * 导航栏适配工具
 * 解决微信小程序胶囊按钮遮挡问题
 */

import { reactive, toRefs } from 'vue';
import { logger } from '../logger.js';

// 缓存胶囊信息，避免重复调用
let menuButtonInfo = null;

/**
 * 获取胶囊按钮信息
 * @returns {Object} 胶囊按钮的位置和尺寸信息
 */
export const getMenuButtonBoundingClientRect = () => {
  if (menuButtonInfo) {
    return menuButtonInfo;
  }

  // #ifdef MP-WEIXIN
  try {
    menuButtonInfo = uni.getMenuButtonBoundingClientRect();
    return menuButtonInfo;
  } catch (error) {
    logger.error('获取胶囊按钮信息失败：', error);
    // 返回默认值（iPhone X为例）
    return {
      top: 32,
      right: 87,
      bottom: 56,
      left: 281,
      width: 87,
      height: 32
    };
  }
  // #endif

  // 非微信小程序返回默认值
  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: 0,
    height: 0
  };
};

/**
 * 获取系统信息
 * @returns {Object} 系统信息
 */
export const getSystemInfo = () => {
  try {
    // #ifdef MP-WEIXIN
    // 微信小程序使用新的 API
    const windowInfo = uni.getWindowInfo();
    const deviceInfo = uni.getDeviceInfo();
    const appBaseInfo = uni.getAppBaseInfo();
    // 合并信息以兼容旧代码
    return {
      ...windowInfo,
      ...deviceInfo,
      ...appBaseInfo
    };
    // #endif

    // #ifndef MP-WEIXIN
    return uni.getSystemInfoSync();
    // #endif
  } catch (error) {
    logger.error('获取系统信息失败：', error);
    return {
      statusBarHeight: 20,
      screenHeight: 667,
      screenWidth: 375
    };
  }
};

/**
 * 计算导航栏高度和相关尺寸
 * @returns {Object} 导航栏相关尺寸信息
 */
export const useNavbar = () => {
  const systemInfo = getSystemInfo();
  const menuButton = getMenuButtonBoundingClientRect();

  const navbarInfo = reactive({
    // 状态栏高度
    statusBarHeight: systemInfo.statusBarHeight || 20,

    // 胶囊按钮信息
    menuButton: {
      top: menuButton.top,
      right: menuButton.right,
      bottom: menuButton.bottom,
      left: menuButton.left,
      width: menuButton.width,
      height: menuButton.height
    },

    // 导航栏高度（状态栏高度 + 胶囊高度 + 胶囊到状态栏的间距*2）
    navbarHeight: 0,

    // 自定义内容区域的安全高度（避开胶囊区域）
    safeTop: 0,

    // 胶囊右侧可用宽度
    rightButtonWidth: 0,

    // 胶囊左侧可用宽度
    leftContentWidth: 0
  });

  // 计算导航栏高度
  // [AUDIT FIX] 非微信平台 menuButton 全为 0，需要 fallback 避免负值
  const gap = menuButton.top > 0 ? menuButton.top - systemInfo.statusBarHeight : 0;
  navbarInfo.navbarHeight =
    menuButton.height > 0 ? menuButton.height + gap * 2 + systemInfo.statusBarHeight : systemInfo.statusBarHeight + 44; // 标准导航栏高度 fallback

  // 计算安全高度（确保内容不被胶囊遮挡）
  navbarInfo.safeTop = menuButton.bottom > 0 ? menuButton.bottom + gap : navbarInfo.navbarHeight;

  // 计算右侧可用宽度（屏幕宽度 - 胶囊右边距）
  navbarInfo.rightButtonWidth = systemInfo.screenWidth - menuButton.right;

  // 计算左侧可用宽度（胶囊左边距）
  navbarInfo.leftContentWidth = menuButton.left;

  return {
    ...toRefs(navbarInfo),
    // 返回原始数据，方便在模板中直接使用
    navbarInfo
  };
};

/**
 * 获取导航栏高度（单独导出，方便直接使用）
 * @returns {Number} 导航栏高度（px）
 */
export const getNavbarHeight = () => {
  const systemInfo = getSystemInfo();
  const menuButton = getMenuButtonBoundingClientRect();
  const gap = menuButton.top - systemInfo.statusBarHeight;
  return menuButton.height + gap * 2 + systemInfo.statusBarHeight;
};

/**
 * 获取安全区域顶部高度（单独导出）
 * @returns {Number} 安全区域顶部高度（px）
 */
export const getSafeTop = () => {
  const systemInfo = getSystemInfo();
  const menuButton = getMenuButtonBoundingClientRect();
  const gap = menuButton.top - systemInfo.statusBarHeight;
  return menuButton.bottom + gap;
};

export default {
  useNavbar,
  getNavbarHeight,
  getSafeTop,
  getMenuButtonBoundingClientRect,
  getSystemInfo
};
