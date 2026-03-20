/**
 * VIP 会员状态管理
 * 管理 VIP 状态、等级、到期时间、权益
 *
 * @module stores/vip
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { storageService } from '../../services/storageService.js';

export const useVipStore = defineStore('vip', () => {
  const vipStatus = ref(false);
  const vipLevel = ref(0);
  const vipExpiry = ref(null);
  const vipBenefits = ref([]);

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

  /**
   * 设置VIP状态
   */
  const setVipStatus = (status, level = 0, expiry = null, benefits = []) => {
    vipStatus.value = status;
    vipLevel.value = level;
    vipExpiry.value = expiry;
    vipBenefits.value = benefits;
    storageService.save('vip_status', { status, level, expiry, benefits }, true);
  };

  /**
   * 重置（登出时调用）
   */
  const $reset = () => {
    vipStatus.value = false;
    vipLevel.value = 0;
    vipExpiry.value = null;
    vipBenefits.value = [];
  };

  // 监听登出事件
  uni.$on('user:logout', $reset);

  // 监听恢复缓存
  uni.$on('vip:restore', () => {
    const cachedVipInfo = storageService.get('vip_status', null);
    if (cachedVipInfo) {
      vipStatus.value = cachedVipInfo.status || false;
      vipLevel.value = cachedVipInfo.level || 0;
      vipExpiry.value = cachedVipInfo.expiry || null;
      vipBenefits.value = cachedVipInfo.benefits || [];
    }
  });

  return {
    vipStatus,
    vipLevel,
    vipExpiry,
    vipBenefits,
    isVip,
    vipDaysLeft,
    vipLevelName,
    setVipStatus,
    $reset
  };
});
