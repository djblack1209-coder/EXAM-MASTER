/**
 * 登录鉴权中间件
 * 用于保护需要登录才能访问的功能
 */

import { useUserStore } from '../../stores';
import { safeNavigateTo } from '../safe-navigate';
import { storageService, getUserId } from '../../services/storageService.js';
import { logger } from '@/utils/logger.js';

/**
 * 检查用户是否已登录
 * @returns {boolean} 是否已登录
 */
export function isUserLoggedIn() {
  const userStore = useUserStore();

  // 优先检查 Pinia store 状态（单一数据源）
  if (userStore.isLogin && userStore.userInfo) {
    return true;
  }

  // ✅ F019: 使用 getUserId() 统一读取（支持加密存储）
  const cachedUserId = getUserId();
  if (cachedUserId) {
    // 如果本地有缓存但 store 没有，触发恢复
    if (!userStore.isLogin) {
      try {
        userStore.restoreUserInfo();
      } catch (_e) {
        logger.warn('[LoginGuard] 恢复用户信息失败:', _e?.message);
      }
    }
    return !!userStore.isLogin || !!cachedUserId;
  }

  return false;
}

/**
 * 获取当前用户ID
 * @returns {string|null} 用户ID或null
 */
export function getCurrentUserId() {
  const userStore = useUserStore();

  return userStore.userInfo?._id || userStore.userInfo?.userId || getUserId() || null;
}

/**
 * 获取当前用户信息
 * @returns {Object|null} 用户信息或null
 */
export function getCurrentUserInfo() {
  const userStore = useUserStore();

  return userStore.userInfo || storageService.get('userInfo', null);
}

/**
 * 登录保护中间件 - 检查登录状态，未登录则显示友好引导
 * @param {Function} callback - 登录后执行的回调函数
 * @param {Object} options - 配置选项
 * @param {string} options.loginUrl - 登录页面路径，默认 '/pages/login/index'
 * @param {string} options.message - 未登录提示消息
 * @param {boolean} options.showToast - 是否显示提示，默认 true
 * @param {boolean} options.useModal - 是否使用Modal弹窗，默认 true
 * @returns {boolean} 是否已登录
 */
export function requireLogin(callback, options = {}) {
  const {
    loginUrl = '/pages/login/index',
    message = '请先登录后使用此功能',
    showToast = true,
    useModal = true
  } = options;

  if (isUserLoggedIn()) {
    // 已登录，执行回调
    if (typeof callback === 'function') {
      callback();
    }
    return true;
  } else {
    // 未登录，显示友好引导
    if (useModal) {
      uni.showModal({
        title: '🎓 登录提示',
        content: message + '\n\n登录后可同步学习进度、错题本等数据！',
        confirmText: '去登录',
        cancelText: '暂不登录',
        success: (res) => {
          if (res.confirm) {
            // 保存当前页面路径，登录后返回
            saveCurrentPageForRedirect();

            safeNavigateTo(loginUrl);
          }
        }
      });
    } else if (showToast) {
      uni.showToast({
        title: message,
        icon: 'none',
        duration: 2000
      });

      // 延迟跳转，让用户看到提示
      setTimeout(() => {
        // 保存当前页面路径，登录后返回
        saveCurrentPageForRedirect();

        safeNavigateTo(loginUrl);
      }, 1500);
    }

    return false;
  }
}

/**
 * 保存当前页面路径用于登录后重定向
 */
function saveCurrentPageForRedirect() {
  try {
    const pages = getCurrentPages();
    if (pages.length > 0) {
      const currentPage = pages[pages.length - 1];
      const currentRoute = currentPage.route;
      const currentOptions = currentPage.options || {};

      // 构建完整路径
      let fullPath = '/' + currentRoute;
      if (Object.keys(currentOptions).length > 0) {
        const query = Object.keys(currentOptions)
          .map((key) => `${key}=${currentOptions[key]}`)
          .join('&');
        fullPath += '?' + query;
      }

      storageService.save('redirect_after_login', fullPath);
      logger.log('[LoginGuard] 保存重定向路径:', fullPath);
    }
  } catch (e) {
    logger.error('[LoginGuard] 保存重定向路径失败:', e);
  }
}

/**
 * 异步登录保护 - 返回 Promise
 * @param {Object} options - 配置选项
 * @returns {Promise<boolean>} 是否已登录
 */
export function requireLoginAsync(options = {}) {
  return new Promise((resolve, reject) => {
    const isLoggedIn = requireLogin(
      () => {
        resolve(true);
      },
      {
        ...options,
        showToast: options.showToast !== false
      }
    );

    if (!isLoggedIn) {
      reject(new Error('用户未登录'));
    }
  });
}

/**
 * 页面级登录保护 - 在页面 onLoad 中使用
 * @param {Object} pageInstance - 页面实例（this）
 * @param {Object} options - 配置选项
 * @returns {boolean} 是否已登录
 */
export function pageRequireLogin(pageInstance, options = {}) {
  const isLoggedIn = isUserLoggedIn();

  if (!isLoggedIn) {
    const {
      loginUrl = '/pages/login/index',
      message = '请先登录后使用此功能',
      showToast = true,
      redirectBack = true
    } = options;

    if (showToast) {
      uni.showToast({
        title: message,
        icon: 'none',
        duration: 2000
      });
    }

    // 保存当前页面路径，登录后可以返回
    if (redirectBack && pageInstance) {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];
      if (currentPage) {
        const currentRoute = currentPage.route;
        const currentOptions = currentPage.options;

        // 构建完整路径
        let fullPath = '/' + currentRoute;
        if (currentOptions && Object.keys(currentOptions).length > 0) {
          const query = Object.keys(currentOptions)
            .map((key) => `${key}=${currentOptions[key]}`)
            .join('&');
          fullPath += '?' + query;
        }

        storageService.save('redirect_after_login', fullPath);
      }
    }

    // 跳转到登录页
    setTimeout(
      () => {
        safeNavigateTo(loginUrl);
      },
      showToast ? 1500 : 0
    );
  }

  return isLoggedIn;
}

/**
 * 登录后重定向到之前的页面
 */
export function redirectAfterLogin() {
  const redirectUrl = storageService.get('redirect_after_login');

  if (redirectUrl) {
    // 清除重定向记录
    storageService.remove('redirect_after_login');

    // 跳转回原页面
    uni.redirectTo({
      url: redirectUrl,
      fail: (err) => {
        logger.error('[LoginGuard] 重定向失败:', err);
        // 如果重定向失败，跳转到首页
        uni.switchTab({
          url: '/pages/index/index'
        });
      }
    });
  } else {
    // 没有重定向记录，跳转到首页
    uni.switchTab({
      url: '/pages/index/index'
    });
  }
}

/**
 * 功能级登录保护装饰器（用于 methods）
 * @param {string} message - 未登录提示消息
 * @returns {Function} 装饰器函数
 */
export function loginRequired(message = '请先登录') {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args) {
      if (isUserLoggedIn()) {
        return originalMethod.apply(this, args);
      } else {
        uni.showToast({
          title: message,
          icon: 'none',
          duration: 2000
        });

        setTimeout(() => {
          safeNavigateTo('/pages/login/index');
        }, 1500);

        return false;
      }
    };

    return descriptor;
  };
}

/**
 * 批量检查功能权限（基于角色的权限控制）
 * @param {Array<string>} features - 功能列表
 * @returns {Object} 权限映射对象
 */
export function checkFeaturePermissions(features = []) {
  const isLoggedIn = isUserLoggedIn();
  const userStore = useUserStore();
  const userRole = userStore.userInfo?.role || 'guest';
  const permissions = {};

  // 基于角色的功能权限映射
  const rolePermissions = {
    guest: ['view_questions', 'view_school'],
    user: [
      'view_questions',
      'view_school',
      'practice',
      'ai_chat',
      'friend_list',
      'study_stats',
      'mistake_book',
      'upload_avatar'
    ],
    vip: [
      'view_questions',
      'view_school',
      'practice',
      'ai_chat',
      'friend_list',
      'study_stats',
      'mistake_book',
      'upload_avatar',
      'ai_photo_search',
      'trend_predict',
      'adaptive_pick',
      'material_understand'
    ],
    admin: ['*'] // 管理员拥有所有权限
  };

  const allowedFeatures = rolePermissions[userRole] || rolePermissions.guest;

  features.forEach((feature) => {
    if (!isLoggedIn) {
      // 未登录：只允许 guest 级别功能
      permissions[feature] = rolePermissions.guest.includes(feature);
    } else if (allowedFeatures.includes('*')) {
      permissions[feature] = true;
    } else {
      permissions[feature] = allowedFeatures.includes(feature);
    }
  });

  return permissions;
}

/**
 * 静默登录检查 - 不显示任何提示
 * @returns {boolean} 是否已登录
 */
export function silentLoginCheck() {
  return isUserLoggedIn();
}

/**
 * 登录状态监听器（使用 store 订阅替代轮询）
 * @param {Function} callback - 登录状态变化时的回调
 * @returns {Function} 取消监听的函数
 */
export function watchLoginStatus(callback) {
  let lastStatus = isUserLoggedIn();

  // 使用较长间隔的轮询作为兜底（5秒），减少性能开销
  const checkInterval = setInterval(() => {
    const currentStatus = isUserLoggedIn();
    if (currentStatus !== lastStatus) {
      lastStatus = currentStatus;
      callback(currentStatus);
    }
  }, 5000);

  // 返回取消监听的函数
  return () => {
    clearInterval(checkInterval);
  };
}

/**
 * 导出默认对象
 */
export default {
  isUserLoggedIn,
  getCurrentUserId,
  getCurrentUserInfo,
  requireLogin,
  requireLoginAsync,
  pageRequireLogin,
  redirectAfterLogin,
  loginRequired,
  checkFeaturePermissions,
  silentLoginCheck,
  watchLoginStatus
};
