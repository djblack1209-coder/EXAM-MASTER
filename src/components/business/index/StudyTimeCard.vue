<template>
  <view :class="['study-time-card', isDark ? 'glass' : 'card-light']" @tap="$emit('click')">
    <view class="time-icon-wrapper">
      <BaseIcon name="timer" :size="48" />
    </view>
    <view class="time-content">
      <text class="time-label"> 今日学习 </text>
      <text class="time-value">
        {{ formattedTime }}
      </text>
    </view>
    <view class="time-indicator" :class="{ 'indicator-active': isTimerActive }">
      <view class="indicator-dot" />
      <text class="indicator-text">
        {{ isTimerActive ? '计时中' : '已暂停' }}
      </text>
    </view>
  </view>
</template>

<script>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
export default {
  name: 'StudyTimeCard',
  components: { BaseIcon },
  props: {
    isDark: { type: Boolean, default: false },
    formattedTime: { type: String, default: '0分钟' },
    isTimerActive: { type: Boolean, default: false }
  },
  emits: ['click']
};
</script>

<style lang="scss" scoped>
.study-time-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 24rpx 32rpx;
  border-radius: 24rpx;
  margin-bottom: 64rpx;
  border: 1rpx solid var(--border);
}

.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1rpx solid var(--border);
}

.card-light {
  background: var(--card);
}

.time-icon-wrapper {
  width: 64rpx;
  height: 64rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light);
}

.time-icon {
  font-size: 32rpx;
}

.time-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.time-label {
  font-size: 24rpx;
  color: var(--text-sub);
}

.time-value {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.time-indicator {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  background: rgba(156, 163, 175, 0.1);
}

.time-indicator.indicator-active {
  background: rgba(16, 185, 129, 0.1);
}

.indicator-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #9ca3af;
}

.indicator-active .indicator-dot {
  background: #10b981;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(1.2);
  }
}

.indicator-text {
  font-size: 22rpx;
  color: var(--text-sub);
}

.indicator-active .indicator-text {
  color: #10b981;
}
</style>
