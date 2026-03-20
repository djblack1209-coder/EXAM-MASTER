/**
 * 用户资料状态管理
 * 管理用户信息、计划进度
 *
 * @module stores/profile
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { APP_CONFIG } from '../../../common/config';
import { storageService } from '../../services/storageService.js';

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

  // 监听登出事件
  uni.$on('user:logout', $reset);

  // 监听登录时设置用户数据
  uni.$on('auth:userdata', (userData) => {
    setUserInfo(userData);
  });

  // 监听恢复缓存
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

  return {
    userInfo,
    planProgress,
    setUserInfo,
    updateUserInfo,
    $reset
  };
});
