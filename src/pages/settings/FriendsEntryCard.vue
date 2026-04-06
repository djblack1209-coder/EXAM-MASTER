<template>
  <!-- F002: 好友入口卡片 — 从 settings/index.vue 提取 -->
  <view class="section" :class="{ 'dark-mode': isDark }">
    <view
      id="e2e-settings-friends-entry"
      class="friend-entry-card ds-flex ds-flex-between ds-touchable"
      @tap="navigateToFriends"
    >
      <view class="entry-left ds-flex">
        <view class="entry-icon ds-flex-center"> <BaseIcon name="users" :size="40" /> </view>
        <view class="entry-info">
          <text class="entry-title ds-text-lg ds-font-semibold"> 我的好友 </text>
          <text class="entry-desc ds-text-xs"> 添加好友，一起刷题 </text>
        </view>
      </view>
      <BaseIcon name="chevron-right" :size="24" class="entry-arrow" />
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { requireLogin } from '@/utils/auth/loginGuard.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme';

const isDark = ref(initTheme());
const themeHandler = (mode) => {
  isDark.value = mode === 'dark';
};

onMounted(() => {
  onThemeUpdate(themeHandler);
});

onBeforeUnmount(() => {
  offThemeUpdate(themeHandler);
});

function navigateToFriends() {
  requireLogin(
    () => {
      logger.log('[FriendsEntryCard] 跳转到好友列表');
      safeNavigateTo('/pages/social/friend-list');
    },
    { message: '请先登录后查看好友列表' }
  );
}
</script>

<style lang="scss" scoped>
.friend-entry-card {
  background-color: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 24rpx;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.friend-entry-card:hover {
  background-color: var(--success-light);
  transform: translateY(-2px);
  box-shadow: var(--shadow-glow-brand);
}

.friend-entry-card:active {
  transform: translateY(0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.entry-left {
  display: flex;
  align-items: center;
  /* gap: 16px; -- replaced for Android WebView compat */
}

.entry-icon {
  width: 56px;
  height: 56px;
  background: rgba(28, 176, 246, 0.12);
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56rpx;
  color: var(--info);
  box-shadow: var(--shadow-success);
}

.entry-info {
  display: flex;
  flex-direction: column;
  /* gap: 4px; -- replaced for Android WebView compat */
}

.entry-title {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
}

.entry-desc {
  font-size: 26rpx;
  color: var(--text-secondary);
  opacity: 0.8;
}

.entry-arrow {
  font-size: 64rpx;
  color: var(--text-secondary, #495057);
  opacity: 0.4;
  font-weight: 300;
}

/* 暗色模式覆盖 */
.dark-mode .friend-entry-card {
  background: var(--bg-card, #1c1c1e);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
  box-shadow: none;
}

.dark-mode .entry-title {
  color: var(--text-primary, #f5f5f7);
}

.dark-mode .entry-desc {
  color: var(--text-secondary, #8e8e93);
}

.dark-mode .entry-icon {
  background: var(--bg-secondary, #2c2c2e);
  color: var(--text-primary, #f5f5f7);
}

.dark-mode .entry-arrow {
  color: var(--text-tertiary, #636366);
}
</style>
