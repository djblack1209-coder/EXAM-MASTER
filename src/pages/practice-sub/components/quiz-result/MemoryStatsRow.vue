<template>
  <view v-if="memoryState" class="memory-stats-row apple-glass-pill">
    <view class="stat-item">
      <text class="stat-label">上次复习</text>
      <text class="stat-value">{{ formatDate(memoryState.last_review) }}</text>
    </view>
    <view class="stat-divider" />
    <view class="stat-item">
      <text class="stat-label">下次复习</text>
      <text class="stat-value highlight">+{{ Math.max(1, memoryState.scheduled_days) }}天</text>
    </view>
    <view class="stat-divider" />
    <view class="stat-item">
      <text class="stat-label">稳定性</text>
      <text class="stat-value success">{{ memoryState.stability?.toFixed(1) || 0 }}</text>
    </view>
  </view>
</template>

<script setup>
defineProps({
  memoryState: { type: Object, default: () => null }
});

const formatDate = (dateStr) => {
  if (!dateStr) return '从未';
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
</script>

<style lang="scss" scoped>
.memory-stats-row {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 16rpx 24rpx;
  margin: 20rpx 0;

  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4rpx;
  }

  .stat-label {
    font-size: 20rpx;
    color: var(--text-sub);
  }

  .stat-value {
    font-size: 24rpx;
    font-weight: bold;
    color: var(--text-primary);

    &.highlight {
      color: var(--em-brand);
    }

    &.success {
      color: var(--em-success);
    }
  }

  .stat-divider {
    width: 2rpx;
    height: 30rpx;
    background: var(--border-color);
    opacity: 0.5;
  }
}
</style>
