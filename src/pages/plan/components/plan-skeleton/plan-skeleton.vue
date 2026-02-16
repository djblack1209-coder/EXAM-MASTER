<!-- 学习计划页骨架屏组件 -->
<template>
  <view class="skeleton-container" :class="{ 'dark-mode': isDark }">
    <!-- 计划卡片骨架 -->
    <view v-for="i in 3" :key="i" class="skeleton-plan-card glass-card">
      <view class="skeleton-plan-header">
        <view class="skeleton-plan-name" />
        <view class="skeleton-plan-badge" />
      </view>

      <view class="skeleton-plan-goal" />

      <view class="skeleton-plan-meta">
        <view v-for="j in 2" :key="j" class="skeleton-meta-item">
          <view class="skeleton-meta-label" />
          <view class="skeleton-meta-value" />
        </view>
      </view>

      <view class="skeleton-plan-meta">
        <view v-for="k in 2" :key="k" class="skeleton-meta-item">
          <view class="skeleton-meta-label" />
          <view class="skeleton-meta-value" />
        </view>
      </view>

      <view class="skeleton-plan-footer">
        <view class="skeleton-tag" />
        <view class="skeleton-tag" />
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'PlanSkeleton',
  props: {
    isDark: {
      type: Boolean,
      default: false
    }
  }
};
</script>

<style lang="scss" scoped>
.skeleton-container {
  --skeleton-bg: #e5e7eb;
  --skeleton-highlight: #d1d5db;
  --card-bg: rgba(255, 255, 255, 0.75);
  --card-border: rgba(255, 255, 255, 0.5);

  padding: 30rpx;
}

.skeleton-container.dark-mode {
  --skeleton-bg: #2c2c2e;
  --skeleton-highlight: #3a3a3c;
  --card-bg: #1e3a0f;
  --card-border: #2d4e1f;
}

.glass-card {
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  border: 1px solid var(--card-border);
  border-radius: 40rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.05);
}

@keyframes skeleton-pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}

.skeleton-plan-card {
  padding: 30rpx;
}

.skeleton-plan-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}

.skeleton-plan-name {
  width: 240rpx;
  height: 36rpx;
  border-radius: 8rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-plan-badge {
  width: 100rpx;
  height: 32rpx;
  border-radius: 16rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-plan-goal {
  width: 100%;
  height: 48rpx;
  border-radius: 8rpx;
  background: var(--skeleton-bg);
  margin-bottom: 30rpx;
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-plan-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.skeleton-meta-item {
  flex: 1;
  margin-right: 20rpx;

  &:last-child {
    margin-right: 0;
  }
}

.skeleton-meta-label {
  width: 80rpx;
  height: 22rpx;
  border-radius: 4rpx;
  background: var(--skeleton-bg);
  margin-bottom: 8rpx;
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-meta-value {
  width: 140rpx;
  height: 28rpx;
  border-radius: 6rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-plan-footer {
  display: flex;
  justify-content: space-between;
  padding-top: 20rpx;
  border-top: 1px solid var(--card-border);
}

.skeleton-tag {
  width: 120rpx;
  height: 36rpx;
  border-radius: 16rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-plan-name,
  .skeleton-plan-badge,
  .skeleton-plan-goal,
  .skeleton-meta-label,
  .skeleton-meta-value,
  .skeleton-tag {
    animation: none;
  }
}
</style>
