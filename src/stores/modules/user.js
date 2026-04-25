/**
 * 用户信息状态管理（Facade）
 * 组合 auth / profile 子 store，提供向后兼容的统一 API
 *
 * @module stores/user
 */

import { defineStore, storeToRefs } from 'pinia';
import { ref } from 'vue';
import { logger } from '@/utils/logger.js';

import { useAuthStore } from './auth';
import { useProfileStore } from './profile';

// 同时导出子 store，允许直接使用
export { useAuthStore } from './auth';
export { useProfileStore } from './profile';

export const useUserStore = defineStore('user', () => {
  // ---- 初始化子 store ----
  const authStore = useAuthStore();
  const profileStore = useProfileStore();

  // 将 profile 的 userInfo ref 注入 auth store，用于 syncLoginStatus
  const { userInfo } = storeToRefs(profileStore);
  authStore._setUserInfoRef(userInfo);

  // ---- 解构子 store 的 refs ----
  const { token, isLogin } = storeToRefs(authStore);
  const { planProgress } = storeToRefs(profileStore);

  // ---- 社交功能（已移除，保留空方法兼容） ----
  const friendsList = ref([]);

  const fetchFriends = async () => {
    friendsList.value = [];
    return [];
  };

  // ---- 排行榜功能（已移除，保留空方法兼容） ----

  /**
   * 排行榜操作（社交API已移除，返回空结果）
   * @param {Object} _data - 排行榜请求参数
   */
  const fetchRankCenter = async (_data) => {
    logger.warn('[UserStore] fetchRankCenter: social.api 已移除');
    return { code: -1, message: '功能已下线' };
  };

  // 监听登出事件重置社交数据（避免重复注册）
  if (!uni.__userStoreLogoutBound__) {
    uni.$on('user:logout', () => {
      friendsList.value = [];
    });
    uni.__userStoreLogoutBound__ = true;
  }

  // ---- 代理方法（保持向后兼容） ----
  const setToken = authStore.setToken;
  const login = authStore.login;
  const logout = authStore.logout;
  const restoreUserInfo = authStore.restoreUserInfo;
  const silentLogin = authStore.silentLogin;

  const setUserInfo = (info) => {
    profileStore.setUserInfo(info);
    authStore.syncLoginStatus();
  };
  const updateUserInfo = profileStore.updateUserInfo;

  /**
   * 重置 store 自有状态到初始值（Setup Store 手动实现）
   * 注：token/userInfo/isLogin/planProgress 由子 store 各自重置
   */
  const $reset = () => {
    friendsList.value = [];
  };

  return {
    // 状态
    token,
    userInfo,
    isLogin,
    planProgress,
    friendsList,

    // 方法
    setToken,
    setUserInfo,
    updateUserInfo,
    login,
    logout,
    fetchFriends,
    fetchRankCenter,
    restoreUserInfo,
    silentLogin,
    $reset
  };
});
