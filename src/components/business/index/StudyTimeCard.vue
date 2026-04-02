<template>
  <view
    id="e2e-home-study-time-card"
    :class="['study-time-card', 'apple-glass-card', isDark ? 'glass' : 'card-light']"
    @tap="$emit('click')"
  >
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

<script setup>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

defineProps({
  isDark: { type: Boolean, default: false },
  formattedTime: { type: String, default: '0分钟' },
  isTimerActive: { type: Boolean, default: false }
});
defineEmits(['click']);
</script>

<style lang="scss" scoped>
.study-time-card {
  display: flex;
  align-items: center;
  /* gap: 24rpx; -- replaced for Android WebView compat */
  padding: 26rpx 30rpx;
  min-height: 120rpx;
  border-radius: 30rpx;
  margin-bottom: 52rpx;
  border: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-card);
  position: relative;
  overflow: hidden;
}

.study-time-card > .time-icon-wrapper {
  margin-right: 24rpx;
}

.study-time-card > .time-content {
  margin-right: 24rpx;
}

.study-time-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 22rpx;
  right: 22rpx;
  height: 1rpx;
  background: var(--apple-specular-soft);
}

.glass {
  background: var(--bg-card-alpha);
  backdrop-filter: blur(16rpx) saturate(130%);
  -webkit-backdrop-filter: blur(16rpx) saturate(130%);
  border: 1rpx solid var(--border);
}

.card-light {
  background: linear-gradient(150deg, var(--bg-card) 0%, var(--bg-secondary) 48%, var(--muted) 100%);
  border-color: var(--border);
}

.time-icon-wrapper {
  width: 70rpx;
  height: 70rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light);
  border: 1rpx solid var(--border);
}

.time-icon {
  font-size: 32rpx;
}

.time-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* gap: 4rpx; -- replaced for Android WebView compat */
}

.time-content > .time-label {
  margin-bottom: 4rpx;
}

.time-label {
  font-size: 24rpx;
  color: var(--text-sub);
}

.time-value {
  font-size: 34rpx;
  font-weight: 680;
  letter-spacing: -0.2rpx;
  color: var(--text-primary);
}

.time-indicator {
  display: flex;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: var(--muted);
  border: 1rpx solid var(--border);
}

.time-indicator > .indicator-dot {
  margin-right: 8rpx;
}

.time-indicator.indicator-active {
  background: var(--primary-light);
}

.card-light .time-indicator {
  border-color: var(--border);
}

.card-light .time-indicator.indicator-active {
  background: var(--primary-light);
  border-color: var(--border);
  box-shadow: var(--shadow-sm);
}

.indicator-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--text-tertiary);
}

.indicator-active .indicator-dot {
  background: var(--primary);
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
  color: var(--primary);
}

.glass .time-indicator {
  background: var(--muted);
  border-color: var(--border);
  box-shadow: none;
}

.glass .time-icon-wrapper {
  background: var(--primary-light);
  border-color: var(--border);
  box-shadow: var(--apple-shadow-surface);
}

.glass .time-indicator.indicator-active {
  background: var(--primary-light);
}

@media screen and (max-width: 375px) {
  .study-time-card {
    padding: 20rpx 24rpx;
    min-height: 104rpx;
    border-radius: 24rpx;
    margin-bottom: 36rpx;
  }

  .time-icon-wrapper {
    width: 60rpx;
    height: 60rpx;
  }

  .time-label {
    font-size: 22rpx;
  }

  .time-value {
    font-size: 30rpx;
  }

  .time-indicator {
    padding: 10rpx 14rpx;
  }

  .indicator-text {
    font-size: 20rpx;
  }
}
</style>
