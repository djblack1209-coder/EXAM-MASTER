<template>
  <view
    id="e2e-home-study-time-card"
    :class="['study-time-card', isDark ? 'card-dark' : 'card-light']"
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
/* ── Duolingo Design System 2.0 · 学习时长卡片 ── */
/* 模块色: #2DC9C4 (teal/mint) */

/* 入场动画 */
@keyframes fadeSlideIn {
  0% {
    opacity: 0;
    transform: translateY(16rpx);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 指示灯脉冲 */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(1.25);
  }
}

/* ── 卡片主体 ── */
.study-time-card {
  display: flex;
  align-items: center;
  padding: 28rpx 32rpx;
  min-height: 120rpx;
  border-radius: 24rpx;
  margin-bottom: 24rpx;
  position: relative;
  overflow: hidden;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
  animation: fadeSlideIn 0.35s ease-out both;

  /* 按下时从凸起变凹陷（新拟物化交互） */
  &:active {
    box-shadow: var(--neu-shadow-inset);
  }
}

/* 子元素间距（替代 gap） */
.study-time-card > .time-icon-wrapper {
  margin-right: 24rpx;
}

.study-time-card > .time-content {
  margin-right: 24rpx;
}

/* 浅色模式：新拟物化凸起卡片 */
.card-light {
  background: var(--em3d-bg);
  border: none;
  box-shadow: var(--neu-shadow-md);
}

/* 暗色模式：同样使用新拟物化凸起效果 */
.card-dark {
  background: var(--em3d-bg);
  border: none;
  box-shadow: var(--neu-shadow-md);
}

/* ── 图标容器 ── */
.time-icon-wrapper {
  width: 72rpx;
  height: 72rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.card-light .time-icon-wrapper {
  background: rgba(45, 201, 196, 0.12);
}

.card-dark .time-icon-wrapper {
  background: rgba(45, 201, 196, 0.18);
}

/* ── 文本区域 ── */
.time-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.time-content > .time-label {
  margin-bottom: 6rpx;
}

.time-label {
  font-size: 24rpx;
  font-weight: 600;
  letter-spacing: 0.5rpx;
}

.card-light .time-label {
  color: var(--text-secondary);
}

.card-dark .time-label {
  color: var(--text-sub, #8a8f98);
}

.time-value {
  font-size: 36rpx;
  font-weight: 800;
  letter-spacing: -0.3rpx;
}

.card-light .time-value {
  color: var(--text-primary);
}

.card-dark .time-value {
  color: var(--text-primary, #e8eaed);
}

/* ── 状态指示器 ── */
.time-indicator {
  display: flex;
  align-items: center;
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
}

.time-indicator > .indicator-dot {
  margin-right: 10rpx;
}

/* 指示器区域使用新拟物化凹陷效果 */
.card-light .time-indicator {
  background: var(--em3d-bg);
  box-shadow: var(--neu-shadow-inset-sm);
}

.card-dark .time-indicator {
  background: var(--em3d-bg);
  box-shadow: var(--neu-shadow-inset-sm);
}

/* 指示器激活态 */
.card-light .time-indicator.indicator-active {
  background: rgba(45, 201, 196, 0.12);
}

.card-dark .time-indicator.indicator-active {
  background: rgba(45, 201, 196, 0.18);
}

/* 指示灯圆点 */
.indicator-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}

.card-light .indicator-dot {
  background: var(--border);
}

.card-dark .indicator-dot {
  background: rgba(255, 255, 255, 0.25);
}

.indicator-active .indicator-dot {
  background: var(--primary);
  animation: pulse 1.5s ease-in-out infinite;
}

/* 指示器文字 */
.indicator-text {
  font-size: 22rpx;
  font-weight: 600;
}

.card-light .indicator-text {
  color: var(--text-secondary);
}

.card-dark .indicator-text {
  color: var(--text-sub, #8a8f98);
}

.indicator-active .indicator-text {
  color: var(--primary);
  font-weight: 700;
}

/* ── 小屏适配 ── */
@media screen and (max-width: 375px) {
  .study-time-card {
    padding: 22rpx 24rpx;
    min-height: 104rpx;
    border-radius: 20rpx;
    margin-bottom: 20rpx;
  }

  .time-icon-wrapper {
    width: 60rpx;
    height: 60rpx;
    border-radius: 16rpx;
  }

  .time-label {
    font-size: 22rpx;
  }

  .time-value {
    font-size: 32rpx;
  }

  .time-indicator {
    padding: 8rpx 16rpx;
  }

  .indicator-text {
    font-size: 20rpx;
  }
}
</style>
