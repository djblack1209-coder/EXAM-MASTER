/**
 * 邀请机制状态管理
 * 管理邀请码、邀请计数、邀请奖励
 *
 * @module stores/invite
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { storageService } from '../../services/storageService.js';
import { lafService } from '../../services/lafService.js';
import { logger } from '@/utils/logger.js';

export const useInviteStore = defineStore('invite', () => {
  const inviteCode = ref('');
  const inviteCount = ref(0);
  const inviteRewards = ref([]);

  const totalInviteRewards = computed(() => {
    return inviteRewards.value.reduce((total, reward) => total + (reward.amount || 0), 0);
  });

  /**
   * 设置邀请信息
   */
  const setInviteInfo = (code, count = 0, rewards = []) => {
    inviteCode.value = code;
    inviteCount.value = count;
    inviteRewards.value = rewards;
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
      const res = await lafService.claimInviteReward(rewardId);
      if (res.success) {
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
   * 重置（登出时调用）
   */
  const $reset = () => {
    inviteCode.value = '';
    inviteCount.value = 0;
    inviteRewards.value = [];
  };

  // 监听登出事件
  uni.$on('user:logout', $reset);

  // 监听恢复缓存
  uni.$on('invite:restore', () => {
    const cachedInviteInfo = storageService.get('invite_info', null);
    if (cachedInviteInfo) {
      inviteCode.value = cachedInviteInfo.code || '';
      inviteCount.value = cachedInviteInfo.count || 0;
      inviteRewards.value = cachedInviteInfo.rewards || [];
    }
  });

  return {
    inviteCode,
    inviteCount,
    inviteRewards,
    totalInviteRewards,
    setInviteInfo,
    handleNewInvite,
    claimInviteReward,
    $reset
  };
});
