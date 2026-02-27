/**
 * 用户信息状态管理（God Store）
 * 管理认证、用户资料、VIP 会员、邀请机制、社交好友等状态
 *
 * 职责较重，后续可考虑拆分为 auth / profile / vip / invite / social 子模块
 *
 * @module stores/user
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { APP_CONFIG } from '../../../common/config';
import { storageService, getUserId } from '../../services/storageService.js';
import { lafService } from '../../services/lafService.js';
import tokenRefreshPlugin from '@/utils/auth/token-refresh-plugin.js';
import { logger } from '@/utils/logger.js';
import { useStudyStore } from './study';
import { useTodoStore } from './todo';
import { useLearningTrajectoryStore } from './learning-trajectory-store';

export const useUserStore = defineStore('user', () => {
  // 状态定义
  const token = ref('');
  const userInfo = ref(null);
  const isLogin = ref(false);
  const planProgress = ref(0); // 计划进度百分比，由实际数据计算
  const friendsList = ref([]);

  // VIP会员相关状态
  const vipStatus = ref(false);
  const vipLevel = ref(0);
  const vipExpiry = ref(null);
  const vipBenefits = ref([]);

  // 邀请机制相关状态
  const inviteCode = ref('');
  const inviteCount = ref(0);
  const inviteRewards = ref([]);

  const syncLoginStatus = () => {
    isLogin.value = !!token.value && !!userInfo.value;
  };

  // VIP相关计算属性
  const isVip = computed(() => {
    if (!vipStatus.value) return false;
    if (!vipExpiry.value) return true;
    return new Date() < new Date(vipExpiry.value);
  });

  const vipDaysLeft = computed(() => {
    if (!isVip.value) return 0;
    if (!vipExpiry.value) return Infinity;
    const now = new Date();
    const expiry = new Date(vipExpiry.value);
    const diffTime = expiry - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  });

  const vipLevelName = computed(() => {
    const levelNames = {
      0: '普通用户',
      1: '青铜会员',
      2: '白银会员',
      3: '黄金会员',
      4: '钻石会员'
    };
    return levelNames[vipLevel.value] || levelNames[0];
  });

  // 邀请相关计算属性
  const totalInviteRewards = computed(() => {
    return inviteRewards.value.reduce((total, reward) => total + (reward.amount || 0), 0);
  });

  /**
   * 设置 Token
   */
  const setToken = (newToken) => {
    token.value = newToken;
    syncLoginStatus();
    // 持久化存储
    storageService.save(APP_CONFIG.cacheKeys.token, newToken, true);
  };

  /**
   * 设置用户信息
   */
  const setUserInfo = (info) => {
    userInfo.value = info;
    syncLoginStatus();
    // 持久化存储
    storageService.save(APP_CONFIG.cacheKeys.userInfo, info, true);
  };

  /**
   * 微信小程序静默登录（使用 Laf 后端）
   * @param {boolean} silent - 是否静默登录（不显示错误提示）
   * @returns {Promise<Object>} 返回登录结果 { success: boolean, userInfo?: Object, error?: Error }
   */
  const login = async (silent = true) => {
    try {
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
        const res = await lafService.request('/login', { type: 'weixin', code }, { skipAuth: true });

        if (res.code === 0 && res.data && res.data.userId) {
          const userId = res.data.userId;

          // 保存 userId（统一使用加密存储）
          storageService.save('EXAM_USER_ID', userId, true);

          // 构建用户信息对象（兼容现有代码）
          const userData = {
            _id: userId,
            id: userId,
            userId: userId,
            ...res.data // 保留后端返回的其他字段
          };

          setUserInfo(userData);
          isLogin.value = true;

          // 如果后端返回了 token，也保存
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
          uni.showToast({
            title: error.message,
            icon: 'none',
            duration: 3000
          });
        }

        return { success: false, error };
      }
    } catch (error) {
      logger.error('[UserStore] 登录异常：', error);

      if (!silent) {
        uni.showToast({
          title: error.message || '登录失败',
          icon: 'none',
          duration: 3000
        });
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
    userInfo.value = null;
    isLogin.value = false;
    planProgress.value = 0;
    friendsList.value = [];
    vipStatus.value = false;
    vipLevel.value = 0;
    vipExpiry.value = null;
    vipBenefits.value = [];
    inviteCode.value = '';
    inviteCount.value = 0;
    inviteRewards.value = [];
    // 清除缓存
    storageService.remove(APP_CONFIG.cacheKeys.token, true);
    storageService.remove(APP_CONFIG.cacheKeys.userInfo, true);
    // 清除统一的用户ID存储
    storageService.remove('EXAM_USER_ID');
    // ✅ B021-3: 不再存储明文 user_id，无需清理
    storageService.remove('EXAM_TOKEN');
    storageService.remove('userInfo');
    tokenRefreshPlugin.stopPreCheckTimer();

    // [R2-P1] 重置其他包含用户数据的 store，防止切换账号后数据残留
    try {
      const studyStore = useStudyStore();
      studyStore.resetProgress();

      const todoStore = useTodoStore();
      todoStore.$reset();

      const trajectoryStore = useLearningTrajectoryStore();
      trajectoryStore.destroy();
      trajectoryStore.clearAll();
    } catch (e) {
      logger.warn('[UserStore] 重置关联 store 失败（可能未初始化）:', e);
    }
  };

  /**
   * 更新用户信息
   */
  const updateUserInfo = (info) => {
    if (!userInfo.value) {
      userInfo.value = {};
    }
    userInfo.value = { ...userInfo.value, ...info };
    // 持久化存储
    storageService.save(APP_CONFIG.cacheKeys.userInfo, userInfo.value, true);
  };

  /**
   * 获取好友列表（从后端API获取真实数据）
   */
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

  /**
   * 设置VIP状态
   */
  const setVipStatus = (status, level = 0, expiry = null, benefits = []) => {
    vipStatus.value = status;
    vipLevel.value = level;
    vipExpiry.value = expiry;
    vipBenefits.value = benefits;

    // 持久化存储
    storageService.save('vip_status', { status, level, expiry, benefits }, true);
  };

  /**
   * 设置邀请信息
   */
  const setInviteInfo = (code, count = 0, rewards = []) => {
    inviteCode.value = code;
    inviteCount.value = count;
    inviteRewards.value = rewards;

    // 持久化存储
    storageService.save('invite_info', { code, count, rewards }, true);
  };

  /**
   * 处理新邀请
   * ✅ 1.3: 已对接后端 API，数据持久化到数据库
   */
  const handleNewInvite = async (inviterId) => {
    try {
      const res = await lafService.handleInvite(inviterId);
      if (res.success) {
        inviteCount.value++;
        // 同步更新本地缓存
        storageService.save(
          'invite_info',
          {
            code: inviteCode.value,
            count: inviteCount.value,
            rewards: inviteRewards.value
          },
          true
        );
      }
      return res;
    } catch (error) {
      logger.error('[invite] handleNewInvite 失败:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * 领取邀请奖励
   * ✅ 1.3: 已对接后端 API，奖励数据持久化到数据库
   */
  const claimInviteReward = async (rewardId) => {
    try {
      // rewardId 对应奖励阈值
      const res = await lafService.claimInviteReward(rewardId);
      if (res.success) {
        // 同步更新本地状态
        const rewardIndex = inviteRewards.value.findIndex((r) => r.id === rewardId);
        if (rewardIndex !== -1) {
          inviteRewards.value[rewardIndex].claimed = true;
          inviteRewards.value[rewardIndex].claimedAt = new Date().toISOString();
        }
        storageService.save(
          'invite_info',
          {
            code: inviteCode.value,
            count: inviteCount.value,
            rewards: inviteRewards.value
          },
          true
        );
        return { success: true, reward: res.data?.reward };
      }
      return { success: false, error: res.message };
    } catch (error) {
      logger.error('领取奖励失败:', error);
      return { success: false, error: error.message };
    }
  };

  /**
   * 从缓存恢复用户信息
   */
  const restoreUserInfo = () => {
    const cachedToken = storageService.get(APP_CONFIG.cacheKeys.token, null);
    const cachedUserInfo = storageService.get(APP_CONFIG.cacheKeys.userInfo, null);
    // ✅ B021-3: 统一使用加密的 EXAM_USER_ID
    const cachedUserId = storageService.get('EXAM_USER_ID', null);

    if (cachedToken) {
      token.value = cachedToken;
    }
    if (cachedUserInfo) {
      userInfo.value = cachedUserInfo;
      // 确保 user_id 存在
      if (!cachedUserInfo._id && cachedUserId) {
        userInfo.value._id = cachedUserId;
        userInfo.value.id = cachedUserId;
        userInfo.value.userId = cachedUserId;
      }
    } else if (cachedUserId) {
      // 如果只有 userId，也尝试恢复基本用户信息
      userInfo.value = {
        _id: cachedUserId,
        id: cachedUserId,
        userId: cachedUserId
      };
    }

    // 恢复VIP信息
    const cachedVipInfo = storageService.get('vip_status', null);
    if (cachedVipInfo) {
      vipStatus.value = cachedVipInfo.status || false;
      vipLevel.value = cachedVipInfo.level || 0;
      vipExpiry.value = cachedVipInfo.expiry || null;
      vipBenefits.value = cachedVipInfo.benefits || [];
    }

    // 恢复邀请信息
    const cachedInviteInfo = storageService.get('invite_info', null);
    if (cachedInviteInfo) {
      inviteCode.value = cachedInviteInfo.code || '';
      inviteCount.value = cachedInviteInfo.count || 0;
      inviteRewards.value = cachedInviteInfo.rewards || [];
    }

    syncLoginStatus();
  };

  /**
   * 静默登录（应用启动时自动调用）
   * 如果已有 token，先尝试恢复；如果没有，则执行登录
   */
  const silentLogin = async () => {
    // 只从本地缓存恢复已有会话，不自动发起新登录
    // 新用户必须通过登录页手动操作（确保同意隐私协议后才能登录）
    restoreUserInfo();

    if (isLogin.value) {
      return { success: true, userInfo: userInfo.value };
    }

    return { success: false, error: new Error('无缓存会话') };
  };

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
