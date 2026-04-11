/**
 * Invite Store — 邀请系统状态中心
 *
 * 架构：Page → Store(本文件) → API(invite.api.js) → 后端(invite-service)
 *
 * 功能：
 *   - 获取用户专属邀请码（后端基于 userId 生成）
 *   - 查询已邀请人数和奖励领取状态
 *   - 领取 VIP 试用奖励（1人→3天, 3人→7天, 5人→15天, 10人→30天）
 *   - 处理被邀请（新用户通过邀请链接注册后绑定关系）
 *
 * @module stores/invite
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  getInviteInfo as apiGetInfo,
  handleInvite as apiHandle,
  claimInviteReward as apiClaim
} from '@/services/api/domains/invite.api.js';
import { getToken } from '@/services/auth-storage.js';
import { logger } from '@/utils/logger.js';

export const useInviteStore = defineStore('invite', () => {
  // ==================== State ====================

  /** 用户专属邀请码 */
  const inviteCode = ref('');
  /** 已邀请人数 */
  const inviteCount = ref(0);
  /** 奖励列表（含领取状态） */
  const rewards = ref([]);
  /** 加载状态 */
  const loading = ref(false);
  /** 是否已加载过 */
  const loaded = ref(false);

  // ==================== 内部工具 ====================

  function _isLoggedIn() {
    return !!getToken();
  }

  // ==================== Actions ====================

  /**
   * 获取邀请信息（邀请码 + 人数 + 奖励状态）
   * @param {boolean} [force=false] - 强制刷新
   * @returns {Promise<boolean>} 是否成功
   */
  async function fetchInviteInfo(force = false) {
    if (!_isLoggedIn()) return false;
    if (loaded.value && !force) return true;

    loading.value = true;
    try {
      const res = await apiGetInfo();
      if (res?.code === 0 && res.data) {
        inviteCode.value = res.data.inviteCode || '';
        inviteCount.value = res.data.count || 0;
        rewards.value = res.data.rewards || [];
        loaded.value = true;
        return true;
      }
      return false;
    } catch (err) {
      logger.warn('[InviteStore] fetchInviteInfo 失败:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  /**
   * 处理被邀请（新用户注册后调用，绑定邀请关系）
   * @param {string} inviterId - 邀请人ID
   * @returns {Promise<{success:boolean, message:string}>}
   */
  async function acceptInvite(inviterId) {
    if (!_isLoggedIn() || !inviterId) {
      return { success: false, message: '参数不完整' };
    }

    try {
      const res = await apiHandle(inviterId);
      if (res?.code === 0) {
        return { success: true, message: res.message || '邀请绑定成功' };
      }
      return { success: false, message: res?.message || '邀请处理失败' };
    } catch (err) {
      logger.warn('[InviteStore] acceptInvite 失败:', err);
      return { success: false, message: '网络异常，请稍后重试' };
    }
  }

  /**
   * 领取邀请奖励
   * @param {number} threshold - 奖励阈值（1/3/5/10）
   * @returns {Promise<{success:boolean, reward?:Object, message:string}>}
   */
  async function claimReward(threshold) {
    if (!_isLoggedIn()) {
      return { success: false, message: '请先登录' };
    }

    try {
      const res = await apiClaim(threshold);
      if (res?.code === 0 && res.data?.reward) {
        // 更新本地奖励状态
        const idx = rewards.value.findIndex((r) => r.threshold === threshold);
        if (idx >= 0) {
          rewards.value[idx].claimed = true;
        }
        return {
          success: true,
          reward: res.data.reward,
          message: res.message || '领取成功'
        };
      }
      return { success: false, message: res?.message || '领取失败' };
    } catch (err) {
      logger.warn('[InviteStore] claimReward 失败:', err);
      return { success: false, message: '网络异常，请稍后重试' };
    }
  }

  // ==================== Computed ====================

  /** 可领取的奖励数量（已解锁但未领取） */
  const claimableCount = computed(() => {
    return rewards.value.filter((r) => r.unlocked && !r.claimed).length;
  });

  /** 下一个奖励的目标人数 */
  const nextThreshold = computed(() => {
    const unclaimed = rewards.value.find((r) => !r.unlocked);
    return unclaimed ? unclaimed.threshold : null;
  });

  /** 距离下一个奖励还差几人 */
  const remainingToNext = computed(() => {
    if (!nextThreshold.value) return 0;
    return Math.max(0, nextThreshold.value - inviteCount.value);
  });

  return {
    // 状态
    inviteCode,
    inviteCount,
    rewards,
    loading,
    loaded,
    // 计算属性
    claimableCount,
    nextThreshold,
    remainingToNext,
    // 操作
    fetchInviteInfo,
    acceptInvite,
    claimReward
  };
});
