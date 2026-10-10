<template>
  <view class="sprint-container" :class="{ 'dark-mode': isDark }">
    <view class="top-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <button class="nav-back" aria-label="返回" @tap="goBack"><BaseIcon name="arrow-left" :size="28" /></button>
      <text class="nav-title">原题组</text>
    </view>
    <scroll-view
      scroll-y
      class="main-scroll"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <text v-if="loading" class="empty-title">读取中</text>
      <text v-else-if="readError" class="empty-title">原题暂不可读取，请重试</text>
      <template v-else>
        <view v-for="item in sprintItems" :key="item.name" class="sprint-card glass-card">
          <text class="card-kp">{{ item.name }}</text>
          <text class="stat-lbl">{{ item.totalQuestions }} 道原题 · 作答后待核对</text>
          <WdButton
            size="small"
            type="primary"
            custom-style="margin-top:20rpx;border-radius:999rpx"
            @click="startSprint(item)"
            >练习本组</WdButton
          >
        </view>
        <text v-if="!sprintItems.length" class="empty-title">暂无原题</text>
      </template>
    </scroll-view>
  </view>
</template>
<script setup>
import WdButton from 'wot-design-uni/components/wd-button/wd-button.vue';
import { ref, onMounted } from 'vue';
import { toast } from '@/utils/toast.js';
import { safeNavigateBack, safeNavigateTo } from '@/utils/safe-navigate';
import { initTheme } from '@/composables/useTheme.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import { storageService } from '@/services/storageService.js';
import { getUserId } from '@/services/auth-storage.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
const pageOwner = getUserId() || '';
const isDark = ref(initTheme()),
  loading = ref(true),
  isRefreshing = ref(false),
  readError = ref(false);
const statusBarHeight = ref(0),
  sprintItems = ref([]);
const category = (q) => {
  const value = q?.category ?? q?.subject;
  return typeof value === 'string' && value.trim() ? value.trim() : '未分类';
};
function loadData() {
  loading.value = true;
  readError.value = false;
  try {
    if ((getUserId() || '') !== pageOwner) throw new Error('OWNER_CHANGED');
    const bank = storageService.get('v30_bank', [], { migrateLegacy: false, throwOnError: true });
    if (!Array.isArray(bank)) throw new Error('BANK_UNAVAILABLE');
    const groups = new Map();
    for (const q of bank) {
      if (!q || typeof q !== 'object' || Array.isArray(q)) continue;
      const name = category(q);
      groups.set(name, (groups.get(name) || 0) + 1);
    }
    sprintItems.value = [...groups].map(([name, totalQuestions]) => ({ name, totalQuestions }));
  } catch {
    readError.value = true;
    sprintItems.value = [];
  } finally {
    loading.value = false;
  }
}
function startSprint(item) {
  try {
    if ((getUserId() || '') !== pageOwner) return toast.info('账户已变化，请返回重新选择');
    const bank = storageService.get('v30_bank', [], { migrateLegacy: false, throwOnError: true });
    const matched = Array.isArray(bank) ? bank.filter((q) => category(q) === item.name) : [];
    if (!matched.length) return toast.info('本组暂无原题');
    const result = storageService.prepareQuizReview({
      ids: matched.map((q) => q.id ?? q._id),
      expectedOwner: pageOwner
    });
    if (!result.success) return toast.info('本组原题未确认保存，请返回重新选择');
    safeNavigateTo(result.url);
  } catch {
    toast.info('本组原题暂不可读取，请重试');
  }
}
function onRefresh() {
  isRefreshing.value = true;
  loadData();
  isRefreshing.value = false;
}
function goBack() {
  safeNavigateBack();
}
onMounted(() => {
  statusBarHeight.value = getStatusBarHeight();
  loadData();
});
</script>
<style scoped>
.sprint-container {
  min-height: 100vh;
  background: var(--yozi-background);
  color: var(--yozi-text, #24203c);
}
.top-nav {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 24rpx 32rpx;
}
.nav-back {
  margin: 0;
  padding: 10rpx;
  background: transparent;
  border: 0;
}
.nav-title {
  font-size: 36rpx;
  font-weight: 650;
}
.main-scroll {
  height: calc(100vh - 120rpx);
  padding: 20rpx 32rpx;
  box-sizing: border-box;
}
.sprint-card {
  padding: 32rpx;
  margin-bottom: 24rpx;
  border-radius: 28rpx;
  background: var(--yozi-surface, rgba(245, 241, 255, 0.85));
  border: 1px solid rgba(130, 105, 195, 0.2);
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.card-kp {
  font-size: 32rpx;
  font-weight: 650;
}
.stat-lbl,
.empty-title {
  font-size: 28rpx;
}
</style>
