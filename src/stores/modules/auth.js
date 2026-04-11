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
// [AUDIT R432] 移除 _request-core 直接导入，login() 改用 auth.api.js 的 apiLogin
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
      // [AUDIT R432] 改用 auth.api.js 的 apiLogin，消除 _request-core 直接依赖
      try {
        const res = await apiLogin({ type: 'weixin', code });

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

          // 登录成功后，将本地收藏同步到云端
          try {
            const { useFavoriteStore } = await import('./favorite.js');
            const favoriteStore = useFavoriteStore();
            favoriteStore.syncLocalToCloud();
          } catch (_e) {
            // 同步失败不影响登录流程
          }

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

    // 清理新增 Store 缓存，防止用户切换时数据泄露
    (async () => {
      try {
        const [{ useStatsStore }, { useFavoriteStore }, { useInviteStore }] = await Promise.all([
          import('./stats.js'),
          import('./favorite.js'),
          import('./invite.js')
        ]);
        useStatsStore().clearCache();
        // favorite store 没有 clearCache，手动重置
        const favStore = useFavoriteStore();
        favStore.favorites = [];
        favStore.total = 0;
        favStore.stats = { totalCount: 0, reviewedCount: 0, needReviewCount: 0, withNoteCount: 0 };
        // invite store 重置
        const invStore = useInviteStore();
        invStore.inviteCode = '';
        invStore.inviteCount = 0;
        invStore.rewards = [];
        invStore.loaded = false;
      } catch (_e) {
        // 清理失败不影响登出流程
      }
    })();
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

    syncLoginStatus();
  };

  /**
   * 静默登录（应用启动时自动调用）
   */
  // [AUDIT R432] 移除多余 async（函数体内无 await）
  const silentLogin = () => {
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
    try {
      return await apiSendEmailCode(email);
    } catch (err) {
      logger.error('[AuthStore] sendEmailCode 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * 微信登录（小程序 / App）
   * @param {Object} params - 登录参数（code, accessToken, openid, userInfo, platform 等）
   */
  const loginByWechat = async (params) => {
    try {
      return await apiLogin({ type: 'wechat', ...params });
    } catch (err) {
      logger.error('[AuthStore] loginByWechat 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * 微信 H5 网页授权登录
   * @param {string} code - OAuth 授权码
   */
  const loginByWechatH5 = async (code) => {
    try {
      return await apiLogin({ type: 'wechat_h5', code });
    } catch (err) {
      logger.error('[AuthStore] loginByWechatH5 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * QQ 登录（小程序 / App / H5）
   * @param {Object} params - 登录参数（code, platform, accessToken, openid, userInfo, redirectUri 等）
   */
  const loginByQQ = async (params) => {
    try {
      return await apiLogin({ type: 'qq', ...params });
    } catch (err) {
      logger.error('[AuthStore] loginByQQ 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * QQ H5 网页授权登录
   * @param {Object} params - { code, redirectUri }
   */
  const loginByQQH5 = async (params) => {
    try {
      return await apiLogin({ type: 'qq', ...params });
    } catch (err) {
      logger.error('[AuthStore] loginByQQH5 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * 邮箱登录 / 注册
   * @param {Object} params - { email, password, verifyCode?, isRegister? }
   */
  const loginByEmail = async (params) => {
    try {
      return await apiLogin({ type: 'email', ...params });
    } catch (err) {
      logger.error('[AuthStore] loginByEmail 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
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
