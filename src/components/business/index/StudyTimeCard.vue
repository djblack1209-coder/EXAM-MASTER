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
  border: 1rpx solid rgba(255, 255, 255, 0.14);
}

.card-light {
  background: linear-gradient(
    150deg,
    rgba(255, 255, 255, 0.82) 0%,
    rgba(244, 250, 246, 0.9) 48%,
    rgba(232, 245, 223, 0.92) 100%
  );
  border-color: var(--apple-glass-border-strong);
}

.time-icon-wrapper {
  width: 70rpx;
  height: 70rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--apple-glass-pill-bg);
  border: 1rpx solid rgba(255, 255, 255, 0.48);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.7);
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
  background: rgba(255, 255, 255, 0.56);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.72);
}

.time-indicator.indicator-active {
  background: rgba(255, 255, 255, 0.9);
}

.card-light .time-indicator {
  border-color: rgba(16, 40, 26, 0.04);
}

.card-light .time-indicator.indicator-active {
  background: #ffffff;
  border-color: rgba(15, 95, 52, 0.12);
  box-shadow: 0 10rpx 24rpx rgba(16, 40, 26, 0.14);
}

.indicator-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: #8e8e93;
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
  background: rgba(20, 26, 36, 0.44);
  border-color: rgba(124, 176, 255, 0.18);
  box-shadow: none;
}

.glass .time-icon-wrapper {
  background:
    linear-gradient(180deg, rgba(10, 132, 255, 0.12) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(10, 132, 255, 0.18);
  box-shadow: var(--apple-shadow-surface);
}

.glass .time-indicator.indicator-active {
  background: rgba(36, 82, 170, 0.24);
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
