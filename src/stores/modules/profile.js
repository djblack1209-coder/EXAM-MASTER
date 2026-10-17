/**
 * 用户资料状态管理
 * 管理用户信息、计划进度
 *
 * @module stores/profile
 */

import { defineStore } from 'pinia';
import { ref, onScopeDispose } from 'vue';
import {
  captureSession,
  checkSession,
  assertSession,
  isSessionFormatMigration,
  readSessionSnapshot
} from '@/services/auth-storage.js';
import config from '@/config/index.js';
const APP_CONFIG = { cacheKeys: config.storage.cacheKeys };
import { storageService } from '../../services/storageService.js';
import {
  requestAccountDeletion as apiRequestAccountDeletion,
  getAccountDeletionStatus as apiGetAccountDeletionStatus,
  cancelAccountDeletion as apiCancelAccountDeletion,
  updateProfile as apiUpdateProfile
} from '../../services/api/domains/user.api.js';
// [AUDIT R432] 移除 _request-core 直接导入，改用 user.api.js 的 updateProfile
import { logger } from '@/utils/logger.js';

export const useProfileStore = defineStore('profile', () => {
  let session = captureSession();
  const userInfo = ref(null);
  const planProgress = ref(0);

  /**
   * 设置用户信息
   */
  const setUserInfo = (info, origin = captureSession(), mergeProfile = false) => {
    assertSession(origin);
    const owner = info?.uid || info?.userId || info?._id || info?.id;
    if (owner && origin.owner !== 'guest' && owner !== origin.owner) return false;
    const finish = (saved) => {
      if (saved !== true || checkSession(origin) !== 'current') return false;
      session = origin;
      userInfo.value = mergeProfile
        ? storageService.get(APP_CONFIG.cacheKeys.userInfo, null, {
            migrateLegacy: false,
            throwOnError: true,
            session: origin
          })
        : info;
      return true;
    };
    const saved = storageService.save(APP_CONFIG.cacheKeys.userInfo, info, true, origin, { mergeProfile });
    return saved?.then ? saved.then(finish) : finish(saved);
  };

  /**
   * 更新用户信息（合并）
   */
  const updateUserInfo = (info) => {
    return setUserInfo(info, captureSession(), true);
  };

  /**
   * 重置（登出时调用）
   */
  const $reset = () => {
    userInfo.value = null;
    planProgress.value = 0;
  };

  const stopIdentity = storageService.onIdentityChange(() => {
    if (isSessionFormatMigration(session)) {
      session = captureSession();
      return;
    }
    if (checkSession(session) !== 'changed') return;
    const snapshot = readSessionSnapshot();
    if (snapshot.status === 'unavailable') return;
    $reset();
    if (snapshot.status !== 'current') {
      session = null;
      return;
    }
    session = snapshot.session;
    try {
      const info = snapshot.record
        ? snapshot.record.userInfo
        : storageService.get(APP_CONFIG.cacheKeys.userInfo, null, { session, migrateLegacy: false });
      if (checkSession(session) === 'current') userInfo.value = info;
    } catch {
      // Keep the old binding so the next identity notification can retry restoration.
      session = null;
    }
  });
  onScopeDispose(stopIdentity);

  const onUserData = (userData, origin) => {
    if (!origin || checkSession(origin) !== 'current') return;
    session = origin;
    userInfo.value = userData;
  };
  const onRestore = ({ cachedUserInfo, cachedUserId, session: origin }) => {
    const current = origin || captureSession();
    if (!origin && current?.epoch) return;
    if (checkSession(current) !== 'current' || (current.owner !== 'guest' && cachedUserId !== current.owner)) return;
    session = current;
    if (cachedUserInfo) {
      userInfo.value = { ...cachedUserInfo };
      if (!cachedUserInfo._id && cachedUserId)
        Object.assign(userInfo.value, { _id: cachedUserId, id: cachedUserId, userId: cachedUserId });
    } else if (cachedUserId) userInfo.value = { _id: cachedUserId, id: cachedUserId, userId: cachedUserId };
  };
  uni.$on('user:logout', $reset);
  uni.$on('auth:userdata', onUserData);
  uni.$on('auth:restore', onRestore);
  onScopeDispose(() => {
    uni.$off('user:logout', $reset);
    uni.$off('auth:userdata', onUserData);
    uni.$off('auth:restore', onRestore);
  });

  /**
   * 申请注销账号
   */
  const requestAccountDeletion = async () => {
    try {
      return await apiRequestAccountDeletion();
    } catch (err) {
      logger.error('[ProfileStore] requestAccountDeletion 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * 查询注销状态
   */
  const getAccountDeletionStatus = async () => {
    try {
      return await apiGetAccountDeletionStatus();
    } catch (err) {
      logger.error('[ProfileStore] getAccountDeletionStatus 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * 撤销注销申请
   */
  const cancelAccountDeletion = async () => {
    try {
      return await apiCancelAccountDeletion();
    } catch (err) {
      logger.error('[ProfileStore] cancelAccountDeletion 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  /**
   * 更新用户资料（通用，支持头像上传等）
   * @param {Object} data - 请求参数（action, userId, 等）
   */
  const updateProfile = async (data) => {
    try {
      return await apiUpdateProfile(data);
    } catch (err) {
      logger.error('[ProfileStore] updateProfile 失败:', err);
      throw err; // 重新抛出让调用方处理
    }
  };

  return {
    userInfo,
    planProgress,
    setUserInfo,
    updateUserInfo,
    $reset,
    // B3: 新增账号管理 action
    requestAccountDeletion,
    getAccountDeletionStatus,
    cancelAccountDeletion,
    updateProfile
  };
});
