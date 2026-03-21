/**
 * 用户信息状态管理（Facade）
 * 组合 auth / profile / vip / invite 子 store，提供向后兼容的统一 API
 * 社交（好友）功能因体量小直接保留在此处
 *
 * @module stores/user
 */

import { defineStore, storeToRefs } from 'pinia';
import { ref } from 'vue';
import { getUserId } from '../../services/storageService.js';
import { lafService } from '../../services/lafService.js';
import { logger } from '@/utils/logger.js';

import { useAuthStore } from './auth';
import { useProfileStore } from './profile';
import { useVipStore } from './vip';
import { useInviteStore } from './invite';

// 同时导出子 store，允许直接使用
export { useAuthStore } from './auth';
export { useProfileStore } from './profile';
export { useVipStore } from './vip';
export { useInviteStore } from './invite';

export const useUserStore = defineStore('user', () => {
  // ---- 初始化子 store ----
  const authStore = useAuthStore();
  const profileStore = useProfileStore();
  const vipStore = useVipStore();
  const inviteStore = useInviteStore();

  // 将 profile 的 userInfo ref 注入 auth store，用于 syncLoginStatus
  const { userInfo } = storeToRefs(profileStore);
  authStore._setUserInfoRef(userInfo);

  // ---- 解构子 store 的 refs ----
  const { token, isLogin } = storeToRefs(authStore);
  const { planProgress } = storeToRefs(profileStore);
  const { vipStatus, vipLevel, vipExpiry, vipBenefits } = storeToRefs(vipStore);
  const { inviteCode, inviteCount, inviteRewards } = storeToRefs(inviteStore);

  // ---- 解构子 store 的 computed ----
  const { isVip, vipDaysLeft, vipLevelName } = storeToRefs(vipStore);
  const { totalInviteRewards } = storeToRefs(inviteStore);

  // ---- 社交功能（直接保留） ----
  const friendsList = ref([]);

  const fetchFriends = async () => {
    if (!isLogin.value) {
      friendsList.value = [];
      return [];
    }

    try {
      const userId = getUserId();
      if (!userId) {
        friendsList.value = [];
        return [];
      }

      const res = await lafService.socialService({
        action: 'get_friend_list',
        userId
      });

      if (res.code === 0 && res.success !== false && Array.isArray(res.data)) {
        friendsList.value = res.data;
        return res.data;
      } else {
        logger.warn('[UserStore] 获取好友列表失败:', res.message || '未知错误');
        friendsList.value = [];
        return [];
      }
    } catch (error) {
      logger.error('[UserStore] 获取好友列表异常:', error);
      friendsList.value = [];
      return [];
    }
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

  const setVipStatus = vipStore.setVipStatus;

  const setInviteInfo = inviteStore.setInviteInfo;
  const handleNewInvite = inviteStore.handleNewInvite;
  const claimInviteReward = inviteStore.claimInviteReward;

  return {
    // 状态
    token,
    userInfo,
    isLogin,
    planProgress,
    friendsList,

    // VIP相关状态
    vipStatus,
    vipLevel,
    vipExpiry,
    vipBenefits,

    // 邀请相关状态
    inviteCode,
    inviteCount,
    inviteRewards,

    // 计算属性
    isVip,
    vipDaysLeft,
    vipLevelName,
    totalInviteRewards,

    // 方法
    setToken,
    setUserInfo,
    updateUserInfo,
    login,
    logout,
    fetchFriends,
    restoreUserInfo,
    silentLogin,

    // VIP相关方法
    setVipStatus,

    // 邀请相关方法
    setInviteInfo,
    handleNewInvite,
    claimInviteReward
  };
});
