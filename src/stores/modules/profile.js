/**
 * 用户资料状态管理
 * 管理用户信息、计划进度
 *
 * @module stores/profile
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import config from '@/config/index.js';
const APP_CONFIG = { cacheKeys: config.storage.cacheKeys };
import { storageService } from '../../services/storageService.js';
import {
  requestAccountDeletion as apiRequestAccountDeletion,
  getAccountDeletionStatus as apiGetAccountDeletionStatus,
  cancelAccountDeletion as apiCancelAccountDeletion
} from '../../services/api/domains/user.api.js';
import { request } from '../../services/api/domains/_request-core.js';

export const useProfileStore = defineStore('profile', () => {
  const userInfo = ref(null);
  const planProgress = ref(0);

  /**
   * 设置用户信息
   */
  const setUserInfo = (info) => {
    userInfo.value = info;
    storageService.save(APP_CONFIG.cacheKeys.userInfo, info, true);
  };

  /**
   * 更新用户信息（合并）
   */
  const updateUserInfo = (info) => {
    if (!userInfo.value) {
      userInfo.value = {};
    }
    userInfo.value = { ...userInfo.value, ...info };
    storageService.save(APP_CONFIG.cacheKeys.userInfo, userInfo.value, true);
  };

  /**
   * 重置（登出时调用）
   */
  const $reset = () => {
    userInfo.value = null;
    planProgress.value = 0;
  };

  // 监听登出事件（避免重复注册）
  if (!uni.__profileStoreLogoutBound__) {
    uni.$on('user:logout', $reset);
    uni.__profileStoreLogoutBound__ = true;
  }

  // 监听登录时设置用户数据（避免重复注册）
  if (!uni.__profileStoreUserdataBound__) {
    uni.$on('auth:userdata', (userData) => {
      setUserInfo(userData);
    });
    uni.__profileStoreUserdataBound__ = true;
  }

  // 监听恢复缓存（避免重复注册）
  if (!uni.__profileStoreRestoreBound__) {
    uni.$on('auth:restore', ({ cachedUserInfo, cachedUserId }) => {
      if (cachedUserInfo) {
        userInfo.value = cachedUserInfo;
        if (!cachedUserInfo._id && cachedUserId) {
          userInfo.value._id = cachedUserId;
          userInfo.value.id = cachedUserId;
          userInfo.value.userId = cachedUserId;
        }
      } else if (cachedUserId) {
        userInfo.value = {
          _id: cachedUserId,
          id: cachedUserId,
          userId: cachedUserId
        };
      }
    });
    uni.__profileStoreRestoreBound__ = true;
  }

  /**
   * 申请注销账号
   */
  const requestAccountDeletion = async () => {
    return await apiRequestAccountDeletion();
  };

  /**
   * 查询注销状态
   */
  const getAccountDeletionStatus = async () => {
    return await apiGetAccountDeletionStatus();
  };

  /**
   * 撤销注销申请
   */
  const cancelAccountDeletion = async () => {
    return await apiCancelAccountDeletion();
  };

  /**
   * 更新用户资料（通用，支持头像上传等）
   * @param {Object} data - 请求参数（action, userId, 等）
   */
  const updateProfile = async (data) => {
    return await request('/user-profile', data);
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
