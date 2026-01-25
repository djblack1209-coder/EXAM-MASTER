<!-- 错题本页骨架屏组件 -->
<template>
  <view class="skeleton-container" :class="{ 'dark-mode': isDark }">
    <!-- 模式切换骨架 -->
    <view class="skeleton-mode-switch glass-card">
      <view class="skeleton-mode-item" v-for="i in 2" :key="i"></view>
    </view>

    <!-- 错题卡片骨架 -->
    <view class="skeleton-mistake-card glass-card" v-for="i in 3" :key="i">
      <view class="skeleton-card-tag"></view>
      <view class="skeleton-question">
        <view class="skeleton-question-line" v-for="j in 2" :key="j"></view>
      </view>

      <!-- 选项骨架 -->
      <view class="skeleton-options">
        <view class="skeleton-option" v-for="k in 4" :key="k">
          <view class="skeleton-option-idx"></view>
          <view class="skeleton-option-text"></view>
        </view>
      </view>

      <!-- 底部骨架 -->
      <view class="skeleton-card-footer">
        <view class="skeleton-time"></view>
        <view class="skeleton-actions">
          <view class="skeleton-action-btn" v-for="l in 3" :key="l"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'MistakeSkeleton',
  props: {
    isDark: {
      type: Boolean,
      default: false
    }
  }
}
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

/* 模式切换骨架 */
.skeleton-mode-switch {
  display: flex;
  gap: 16rpx;
  padding: 16rpx;
}

.skeleton-mode-item {
  flex: 1;
  height: 72rpx;
  border-radius: 36rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

/* 错题卡片骨架 */
.skeleton-mistake-card {
  padding: 30rpx;
}

.skeleton-card-tag {
  width: 100rpx;
  height: 32rpx;
  border-radius: 16rpx;
  background: var(--skeleton-bg);
  margin-bottom: 20rpx;
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-question {
  margin-bottom: 30rpx;
}

.skeleton-question-line {
  width: 100%;
  height: 32rpx;
  border-radius: 8rpx;
  background: var(--skeleton-bg);
  margin-bottom: 12rpx;
  animation: skeleton-pulse 1.5s infinite;

  &:last-child {
    width: 70%;
  }
}

/* 选项骨架 */
.skeleton-options {
  margin-bottom: 30rpx;
}

.skeleton-option {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid var(--card-border);

  &:last-child {
    border-bottom: none;
  }
}

.skeleton-option-idx {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: var(--skeleton-bg);
  flex-shrink: 0;
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-option-text {
  flex: 1;
  height: 28rpx;
  border-radius: 6rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

/* 底部骨架 */
.skeleton-card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 20rpx;
  border-top: 1rpx solid var(--card-border);
}

.skeleton-time {
  width: 140rpx;
  height: 24rpx;
  border-radius: 6rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-actions {
  display: flex;
  gap: 16rpx;
}

.skeleton-action-btn {
  width: 100rpx;
  height: 48rpx;
  border-radius: 24rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-mode-item,
  .skeleton-card-tag,
  .skeleton-question-line,
  .skeleton-option-idx,
  .skeleton-option-text,
  .skeleton-time,
  .skeleton-action-btn {
    animation: none;
  }
}
</style>
