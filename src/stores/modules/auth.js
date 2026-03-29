/**
 * 认证状态管理
 * 管理 token、登录状态、登录/登出流程
 *
 * @module stores/auth
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import config from '@/config/index.js';
const APP_CONFIG = { cacheKeys: config.storage.cacheKeys };
import { storageService } from '../../services/storageService.js';
import { sendEmailCode as apiSendEmailCode, login as apiLogin } from '../../services/api/domains/auth.api.js';
import { request } from '../../services/api/domains/_request-core.js';
import tokenRefreshPlugin from '@/utils/auth/token-refresh-plugin.js';
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';

export const useAuthStore = defineStore('auth', () => {
  const token = ref('');
  const isLogin = ref(false);

  // 需要 userInfo 引用来判断登录状态，由 facade 注入
  let _userInfoRef = null;

  /**
   * 注入 userInfo ref（由 facade 调用，避免循环依赖）
   */
  const _setUserInfoRef = (userInfoRef) => {
    _userInfoRef = userInfoRef;
  };

  const syncLoginStatus = () => {
    isLogin.value = !!token.value && !!(_userInfoRef ? _userInfoRef.value : null);
  };

  /**
   * 设置 Token
   */
  const setToken = (newToken) => {
    token.value = newToken;
    syncLoginStatus();
    storageService.save(APP_CONFIG.cacheKeys.token, newToken, true);
  };

  /**
   * 微信小程序静默登录（使用 Laf 后端）
   * @param {boolean} silent - 是否静默登录（不显示错误提示）
   * @returns {Promise<Object>} 返回登录结果 { success: boolean, userInfo?: Object, error?: Error }
   */
  const login = async (silent = true) => {
    try {
      // #ifdef APP-PLUS
      logger.warn('[AuthStore] App 端不支持微信静默登录，请使用登录页面');
      return { success: false, error: new Error('请通过登录页面登录') };
      // #endif

      // 1. 调用 uni.login 获取 code
      const loginRes = await new Promise((resolve, reject) => {
        uni.login({
          provider: 'weixin',
          success: resolve,
          fail: reject
        });
      });

      const code = loginRes?.code;
      if (!code) {
        throw new Error('获取登录凭证失败');
      }

      // 2. 调用 Laf 登录接口（skipAuth: true 避免登录请求携带过期 token）
      try {
        const res = await request('/login', { type: 'weixin', code }, { skipAuth: true });

        if (res.code === 0 && res.data && res.data.userId) {
          const userId = res.data.userId;

          storageService.save('EXAM_USER_ID', userId, true);

          const userData = {
            _id: userId,
            id: userId,
            userId: userId,
            ...res.data
          };

          // 通过事件通知 profile store 设置用户信息
          uni.$emit('auth:userdata', userData);
          isLogin.value = true;

          if (res.data.token) {
            setToken(res.data.token);
          }

          logger.log('✅ Laf 登录成功:', userId);

          // ✅ 用户隔离：登录后迁移无前缀的旧数据到 u_${userId}_ 前缀
          storageService.migrateUserKeys();

          return {
            success: true,
            userInfo: userData
          };
        } else {
          throw new Error(res.message || '登录失败');
        }
      } catch (lafError) {
        logger.error('❌ 迁移后的登录失败:', lafError);
        const error = new Error(lafError.message || '登录服务不可用');

        if (!silent) {
          toast.info(error.message, 3000);
        }

        return { success: false, error };
      }
    } catch (error) {
      logger.error('[AuthStore] 登录异常：', error);

      if (!silent) {
        toast.info(error.message || '登录失败', 3000);
      }

      return { success: false, error };
    }
  };

  /**
   * 登出
   */
  const logout = () => {
    // ✅ 用户隔离：清理当前用户的隔离数据（必须在清除 userId 之前调用）
    storageService.clearUserData();
    token.value = '';
    isLogin.value = false;

    // 清除缓存
    storageService.remove(APP_CONFIG.cacheKeys.token, true);
    storageService.remove(APP_CONFIG.cacheKeys.userInfo, true);
    storageService.remove('EXAM_USER_ID');
    storageService.remove('EXAM_TOKEN');
    storageService.remove('userInfo');
    tokenRefreshPlugin.stopPreCheckTimer();

    // 通知所有子 store 重置
    uni.$emit('user:logout');
  };

  /**
   * 从缓存恢复用户信息
   */
  const restoreUserInfo = () => {
    const cachedToken = storageService.get(APP_CONFIG.cacheKeys.token, null);
    const cachedUserInfo = storageService.get(APP_CONFIG.cacheKeys.userInfo, null);
    const cachedUserId = storageService.get('EXAM_USER_ID', null);

    if (cachedToken) {
      token.value = cachedToken;
    }

    // 通知 profile store 恢复用户信息
    if (cachedUserInfo || cachedUserId) {
      uni.$emit('auth:restore', { cachedUserInfo, cachedUserId });
    }

    // 恢复 VIP 和邀请信息
    uni.$emit('vip:restore');
    uni.$emit('invite:restore');

    syncLoginStatus();
  };

  /**
   * 静默登录（应用启动时自动调用）
   */
  const silentLogin = async () => {
    restoreUserInfo();

    if (isLogin.value) {
      return { success: true, userInfo: _userInfoRef ? _userInfoRef.value : null };
    }

    return { success: false, error: new Error('无缓存会话') };
  };

  /**
   * 发送邮箱验证码
   * @param {string} email - 邮箱地址
   */
  const sendEmailCode = async (email) => {
    return await apiSendEmailCode(email);
  };

  /**
   * 微信登录（小程序 / App）
   * @param {Object} params - 登录参数（code, accessToken, openid, userInfo, platform 等）
   */
  const loginByWechat = async (params) => {
    return await apiLogin({ type: 'wechat', ...params });
  };

  /**
   * 微信 H5 网页授权登录
   * @param {string} code - OAuth 授权码
   */
  const loginByWechatH5 = async (code) => {
    return await apiLogin({ type: 'wechat_h5', code });
  };

  /**
   * QQ 登录（小程序 / App / H5）
   * @param {Object} params - 登录参数（code, platform, accessToken, openid, userInfo, redirectUri 等）
   */
  const loginByQQ = async (params) => {
    return await apiLogin({ type: 'qq', ...params });
  };

  /**
   * QQ H5 网页授权登录
   * @param {Object} params - { code, redirectUri }
   */
  const loginByQQH5 = async (params) => {
    return await apiLogin({ type: 'qq', ...params });
  };

  /**
   * 邮箱登录 / 注册
   * @param {Object} params - { email, password, verifyCode?, isRegister? }
   */
  const loginByEmail = async (params) => {
    return await apiLogin({ type: 'email', ...params });
  };

  return {
    token,
    isLogin,
    setToken,
    login,
    logout,
    restoreUserInfo,
    silentLogin,
    syncLoginStatus,
    _setUserInfoRef,
    // B1: 新增登录/认证 action
    sendEmailCode,
    loginByWechat,
    loginByWechatH5,
    loginByQQ,
    loginByQQH5,
    loginByEmail
  };
});
