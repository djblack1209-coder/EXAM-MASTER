<template>
  <!-- F002: 好友入口卡片 — 从 settings/index.vue 提取 -->
  <view class="section">
    <view
      id="e2e-settings-friends-entry"
      class="friend-entry-card ds-flex ds-flex-between ds-touchable"
      @tap="navigateToFriends"
    >
      <view class="entry-left ds-flex">
        <view class="entry-icon ds-flex-center"> 👥 </view>
        <view class="entry-info">
          <text class="entry-title ds-text-lg ds-font-semibold"> 我的好友 </text>
          <text class="entry-desc ds-text-xs"> 添加好友，一起刷题 </text>
        </view>
      </view>
      <text class="entry-arrow"> › </text>
    </view>
  </view>
</template>

<script>
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { requireLogin } from '@/utils/auth/loginGuard.js';

export default {
  name: 'FriendsEntryCard',
  methods: {
    navigateToFriends() {
      requireLogin(
        () => {
          logger.log('[FriendsEntryCard] 跳转到好友列表');
          safeNavigateTo('/pages/social/friend-list');
        },
        { message: '请先登录后查看好友列表' }
      );
    }
  }
};
</script>

<style lang="scss" scoped>
.friend-entry-card {
  background-color: var(--card-bg, var(--bg-card));
  border: 1px solid var(--card-border, #e9ecef);
  border-radius: 16px;
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
  background: linear-gradient(135deg, var(--brand-color), var(--success-green));
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 56rpx;
  box-shadow: var(--shadow-success);
}

.entry-info {
  display: flex;
  flex-direction: column;
  /* gap: 4px; -- replaced for Android WebView compat */
}

.entry-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-primary, var(--text-primary));
}

.entry-desc {
  font-size: 26rpx;
  color: var(--text-secondary, #495057);
  opacity: 0.8;
}

.entry-arrow {
  font-size: 64rpx;
  color: var(--text-secondary, #495057);
  opacity: 0.4;
  font-weight: 300;
}
</style>
