/**
 * 权限处理工具 - 处理微信小程序各种权限请求
 *
 * 功能：
 * 1. 相册写入权限检查与引导
 * 2. 相机权限检查与引导
 * 3. 位置权限检查与引导
 * 4. 用户拒绝后的设置页引导
 *
 * @version 1.0.0
 * @author Frontend Team
 */

import { logger } from '@/utils/logger.js';

// 权限类型枚举
const PERMISSION_TYPES = {
  WRITE_PHOTOS_ALBUM: 'scope.writePhotosAlbum',
  CAMERA: 'scope.camera',
  USER_LOCATION: 'scope.userLocation',
  USER_INFO: 'scope.userInfo',
  RECORD: 'scope.record'
};

// 权限描述映射
const PERMISSION_DESCRIPTIONS = {
  [PERMISSION_TYPES.WRITE_PHOTOS_ALBUM]: {
    name: '相册',
    title: '需要相册权限',
    content: '保存图片到相册需要您的授权，请在设置中开启相册权限',
    usage: '用于保存海报、截图等图片到您的相册'
  },
  [PERMISSION_TYPES.CAMERA]: {
    name: '相机',
    title: '需要相机权限',
    content: '拍照功能需要您的授权，请在设置中开启相机权限',
    usage: '用于拍照搜题、扫描二维码等功能'
  },
  [PERMISSION_TYPES.USER_LOCATION]: {
    name: '位置',
    title: '需要位置权限',
    content: '获取位置信息需要您的授权，请在设置中开启位置权限',
    usage: '用于显示附近的学习伙伴、考点信息等'
  },
  [PERMISSION_TYPES.RECORD]: {
    name: '麦克风',
    title: '需要麦克风权限',
    content: '录音功能需要您的授权，请在设置中开启麦克风权限',
    usage: '用于语音输入、语音搜题等功能'
  }
};

/**
 * 权限处理类
 */
class PermissionHandler {
  constructor() {
    this.permissionCache = {};
  }

  /**
   * 检查权限状态
   * @param {string} scope - 权限类型
   * @returns {Promise<'authorized'|'denied'|'not_determined'>}
   */
  async checkPermission(scope) {
    return new Promise((resolve) => {
      uni.getSetting({
        success: (res) => {
          const authSetting = res.authSetting || {};

          if (authSetting[scope] === true) {
            resolve('authorized');
          } else if (authSetting[scope] === false) {
            resolve('denied');
          } else {
            resolve('not_determined');
          }
        },
        fail: () => {
          resolve('not_determined');
        }
      });
    });
  }

  /**
   * 请求权限
   * @param {string} scope - 权限类型
   * @returns {Promise<boolean>}
   */
  async requestPermission(scope) {
    return new Promise((resolve) => {
      uni.authorize({
        scope: scope,
        success: () => {
          logger.log('[PermissionHandler] 权限授权成功:', scope);
          this.permissionCache[scope] = 'authorized';
          resolve(true);
        },
        fail: (err) => {
          logger.warn('[PermissionHandler] 权限授权失败:', scope, err);
          this.permissionCache[scope] = 'denied';
          resolve(false);
        }
      });
    });
  }

  /**
   * 引导用户去设置页开启权限
   * @param {string} scope - 权限类型
   * @returns {Promise<boolean>}
   */
  async guideToSettings(scope) {
    const description = PERMISSION_DESCRIPTIONS[scope] || {
      title: '需要权限',
      content: '请在设置中开启相关权限'
    };

    return new Promise((resolve) => {
      uni.showModal({
        title: description.title,
        content: description.content,
        confirmText: '去设置',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            uni.openSetting({
              success: (settingRes) => {
                const authSetting = settingRes.authSetting || {};
                const granted = authSetting[scope] === true;

                if (granted) {
                  logger.log('[PermissionHandler] 用户在设置中开启了权限:', scope);
                  this.permissionCache[scope] = 'authorized';
                  uni.showToast({ title: '权限已开启', icon: 'success' });
                }

                resolve(granted);
              },
              fail: () => {
                resolve(false);
              }
            });
          } else {
            resolve(false);
          }
        },
        fail: () => {
          resolve(false);
        }
      });
    });
  }

  /**
   * 确保拥有权限（检查 -> 请求 -> 引导）
   * @param {string} scope - 权限类型
   * @param {Object} options - 配置项
   * @returns {Promise<boolean>}
   */
  async ensurePermission(scope, options = {}) {
    const {
      showTip = true, // 是否显示提示
      autoGuide = true // 是否自动引导去设置
    } = options;

    // 1. 检查当前权限状态
    const status = await this.checkPermission(scope);
    logger.log('[PermissionHandler] 权限状态:', scope, status);

    // 2. 已授权，直接返回
    if (status === 'authorized') {
      return true;
    }

    // 3. 未决定，尝试请求
    if (status === 'not_determined') {
      const granted = await this.requestPermission(scope);
      if (granted) {
        return true;
      }
    }

    // 4. 已拒绝或请求失败，引导去设置
    if (autoGuide) {
      return await this.guideToSettings(scope);
    }

    // 5. 不自动引导，显示提示
    if (showTip) {
      const description = PERMISSION_DESCRIPTIONS[scope];
      uni.showToast({
        title: `请开启${description?.name || ''}权限`,
        icon: 'none',
        duration: 2000
      });
    }

    return false;
  }

  /**
   * 保存图片到相册（带权限检查）
   * @param {string} filePath - 图片路径
   * @param {Object} options - 配置项
   * @returns {Promise<{success: boolean, error?: any}>}
   */
  async saveImageToAlbum(filePath, options = {}) {
    const {
      showLoading = true,
      loadingText = '保存中...',
      successText = '已保存到相册',
      failText = '保存失败'
    } = options;

    // 1. 检查权限
    const hasPermission = await this.ensurePermission(PERMISSION_TYPES.WRITE_PHOTOS_ALBUM);

    if (!hasPermission) {
      return { success: false, error: { errMsg: 'permission denied' } };
    }

    // 2. 显示 Loading
    if (showLoading) {
      uni.showLoading({ title: loadingText, mask: true });
    }

    // 3. 保存图片
    return new Promise((resolve) => {
      uni.saveImageToPhotosAlbum({
        filePath: filePath,
        success: () => {
          if (showLoading) {
            uni.hideLoading();
          }
          uni.showToast({ title: successText, icon: 'success' });
          logger.log('[PermissionHandler] 图片保存成功:', filePath);
          resolve({ success: true });
        },
        fail: (err) => {
          if (showLoading) {
            uni.hideLoading();
          }

          logger.error('[PermissionHandler] 图片保存失败:', err);

          // 检查是否是权限问题
          if (err.errMsg && (err.errMsg.includes('auth') || err.errMsg.includes('deny'))) {
            // 权限被拒绝，引导去设置
            this.guideToSettings(PERMISSION_TYPES.WRITE_PHOTOS_ALBUM);
          } else if (err.errMsg && err.errMsg.includes('cancel')) {
            // 用户取消，不显示错误
            resolve({ success: false, cancelled: true });
            return;
          } else {
            uni.showToast({ title: failText, icon: 'none' });
          }

          resolve({ success: false, error: err });
        }
      });
    });
  }

  /**
   * 批量检查多个权限
   * @param {Array<string>} scopes - 权限类型数组
   * @returns {Promise<Object>} - 权限状态映射
   */
  async checkMultiplePermissions(scopes) {
    const results = {};

    for (const scope of scopes) {
      results[scope] = await this.checkPermission(scope);
    }

    return results;
  }

  /**
   * 获取权限描述
   * @param {string} scope - 权限类型
   * @returns {Object}
   */
  getPermissionDescription(scope) {
    return PERMISSION_DESCRIPTIONS[scope] || null;
  }
}

// 导出单例
export const permissionHandler = new PermissionHandler();

// 导出权限类型常量
export { PERMISSION_TYPES };

export default permissionHandler;
