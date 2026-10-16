import { captureSession, assertSession, checkSession, sessionForRequest } from '@/services/auth-storage.js';
/**
 * 认证状态管理
 * 管理 token、登录状态、登录/登出流程
 *
 * @module stores/auth
 */

import { publicError } from '@/i18n/index.js';
import { readLoginRegion } from '@/services/auth-region.js';
import { defineStore, getActivePinia } from 'pinia';
import { ref } from 'vue';
import config from '@/config/index.js';
const APP_CONFIG = { cacheKeys: config.storage.cacheKeys };
import { storageService } from '../../services/storageService.js';
import {
  sendEmailCode as apiSendEmailCode,
  login as apiLogin,
  desktopOAuth as apiDesktopOAuth
} from '../../services/api/domains/auth.api.js';
// [AUDIT R432] 移除 _request-core 直接导入，login() 改用 auth.api.js 的 apiLogin
import tokenRefreshPlugin from '@/utils/auth/token-refresh-plugin.js';
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';

export const useAuthStore = defineStore('auth', () => {
  const token = ref('');
  const isLogin = ref(false);
  let authLifecycle = 0;

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
  const setToken = (newToken, session = captureSession()) => {
    assertSession(session);
    const finish = (saved) => {
      if (saved !== true || checkSession(session) !== 'current') return false;
      authLifecycle++;
      token.value = newToken;
      syncLoginStatus();
      return true;
    };
    const saved = storageService.save(APP_CONFIG.cacheKeys.token, newToken, true, session);
    return saved?.then ? saved.then(finish) : finish(saved);
  };

  /**
   * 微信小程序静默登录（使用 Laf 后端）
   * @param {boolean} silent - 是否静默登录（不显示错误提示）
   * @returns {Promise<Object>} 返回登录结果 { success: boolean, userInfo?: Object, error?: Error }
   */
  const login = async (silent = true) => {
    try {
      const attempt = storageService.beginLoginAttempt();
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
        const res = await apiLogin({ region: readLoginRegion(), type: 'wechat', code });

        if (res.code === 0 && res.data && res.data.userId && res.data.token) {
          const userId = res.data.userId;

          const userData = {
            _id: userId,
            id: userId,
            userId: userId,
            ...res.data
          };
          const session = await storageService.saveLoginSession(
            { userId, token: res.data.token, userInfo: userData },
            attempt
          );
          assertSession(session);

          // 通过事件通知 profile store 设置用户信息
          uni.$emit('auth:userdata', userData, session);
          isLogin.value = true;

          if (res.data.token) {
            if (!(await setToken(res.data.token, session))) throw new Error('登录状态未保存，请重试');
          }

          logger.log('✅ Laf 登录成功');

          // ✅ 用户隔离：登录后迁移无前缀的旧数据到 u_${userId}_ 前缀
          storageService.migrateUserKeys(session);

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
          toast.info(publicError(error), 3000);
        }

        return { success: false, error };
      }
    } catch (error) {
      logger.error('[AuthStore] 登录异常：', error);

      if (!silent) {
        toast.info(publicError(error), 3000);
      }

      return { success: false, error };
    }
  };

  /**
   * 登出
   */
  const logout = () => {
    const cleanupLifecycle = ++authLifecycle;
    const pinia = getActivePinia();
    // 清理会话缓存，学习事实留在账户隔离键中；删除由用户另行确认。
    storageService.clearUserData(undefined, { preserveLearning: true });
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
        const [{ useStatsStore }, { useFavoriteStore }] = await Promise.all([
          import('./stats.js'),
          import('./favorite.js')
        ]);
        if (
          cleanupLifecycle !== authLifecycle ||
          token.value ||
          _userInfoRef?.value ||
          storageService.get('EXAM_USER_ID', null) ||
          storageService.get(APP_CONFIG.cacheKeys.token, null)
        )
          return;
        useStatsStore(pinia).clearCache();
        useFavoriteStore(pinia).$reset();
        // invite store 已移除
      } catch (_e) {
        // 清理失败不影响登出流程
      }
    })();
  };

  /**
   * 从缓存恢复用户信息
   */
  const restoreUserInfo = () => {
    const session = captureSession();
    if (!session) return false;
    const snapshot = sessionForRequest(session);
    const cachedUserInfo = storageService.get(APP_CONFIG.cacheKeys.userInfo, null, { session });
    const cachedUserId = session.owner === 'guest' ? null : session.owner;
    assertSession(session);
    token.value = snapshot.token || '';

    // 通知 profile store 恢复用户信息
    if (cachedUserInfo || cachedUserId) {
      uni.$emit('auth:restore', { cachedUserInfo, cachedUserId, session });
    }

    syncLoginStatus();
    return true;
  };

  /**
   * 静默登录（应用启动时自动调用）
   */
  // [AUDIT R432] 移除多余 async（函数体内无 await）
  const silentLogin = () => {
    storageService.getSessionEpoch();
    if (!storageService.captureSession()) return { success: false, error: new Error('登录状态暂不可用，请重试') };
    restoreUserInfo();

    if (isLogin.value) {
      try {
        storageService.getSessionEpoch();
        if (!storageService.captureSession()) return { success: false, error: new Error('登录状态暂不可用，请重试') };
      } catch (error) {
        return { success: false, error };
      }
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
   * @param {Object} params - 一次性 code；App 必须同时指定 platform: 'app'
   */
  const loginByWechat = async (params) => {
    try {
      return await apiLogin({ region: readLoginRegion(), type: 'wechat', ...params });
    } catch (err) {
      logger.warn('[AuthStore] loginByWechat 未完成');
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * 微信 H5 网页授权登录
   * @param {string} code - OAuth 授权码
   */
  const loginByWechatH5 = async (code) => {
    try {
      return await apiLogin({ region: readLoginRegion(), type: 'wechat_h5', code });
    } catch (err) {
      logger.warn('[AuthStore] loginByWechatH5 未完成');
      throw err; // 重新抛出让调用方处理
    }
  };

  const loginByWechatWeb = async (code) => {
    try {
      return await apiLogin({ region: readLoginRegion(), type: 'wechat_web', code });
    } catch (err) {
      logger.warn('[AuthStore] loginByWechatWeb 未完成');
      throw err;
    }
  };

  /**
   * 邮箱登录 / 注册
   * @param {Object} params - { email, password, verifyCode?, isRegister? }
   */
  const loginByEmail = async (params) => {
    try {
      return await apiLogin({ region: readLoginRegion(), type: 'email', ...params });
    } catch (err) {
      logger.error('[AuthStore] loginByEmail 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * 重置 store 状态到初始值（Setup Store 手动实现）
   */
  const $reset = () => {
    authLifecycle++;
    token.value = '';
    isLogin.value = false;
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
    $reset,
    regionalLogin: apiLogin,
    // B1: 新增登录/认证 action
    sendEmailCode,
    loginByWechat,
    loginByWechatH5,
    loginByWechatWeb,
    loginByEmail,
    desktopOAuth: (params) => apiDesktopOAuth(params)
  };
});
