<!-- 择校分析页骨架屏组件 -->
<template>
  <view class="skeleton-container" :class="{ 'dark-mode': isDark }">
    <!-- 步骤进度条骨架 -->
    <view class="skeleton-step-bar glass-card">
      <view class="skeleton-step">
        <view class="skeleton-dot" />
        <view class="skeleton-step-text" />
      </view>
      <view class="skeleton-line" />
      <view class="skeleton-step">
        <view class="skeleton-dot" />
        <view class="skeleton-step-text" />
      </view>
    </view>

    <!-- 表单骨架 (step 1) -->
    <view v-if="step === 1" class="skeleton-form glass-card">
      <view class="skeleton-form-header">
        <view class="skeleton-title" />
        <view class="skeleton-subtitle" />
      </view>
      <view v-for="i in 5" :key="i" class="skeleton-input-group">
        <view class="skeleton-label" />
        <view class="skeleton-input" />
      </view>
      <view class="skeleton-btn" />
    </view>

    <!-- 结果列表骨架 (step 2) -->
    <view v-if="step === 2" class="skeleton-result">
      <view class="skeleton-result-header">
        <view class="skeleton-result-title" />
        <view class="skeleton-filter-btn" />
      </view>

      <!-- 院校卡片骨架 -->
      <view v-for="i in 3" :key="i" class="skeleton-school-card glass-card">
        <view class="skeleton-card-header">
          <view class="skeleton-school-info">
            <view class="skeleton-school-name" />
            <view class="skeleton-school-loc" />
            <view class="skeleton-tags">
              <view v-for="j in 3" :key="j" class="skeleton-tag" />
            </view>
          </view>
          <view class="skeleton-match-rate" />
        </view>

        <view class="skeleton-major">
          <view class="skeleton-major-title" />
          <view class="skeleton-scores">
            <view v-for="k in 4" :key="k" class="skeleton-score-col">
              <view class="skeleton-score-year" />
              <view class="skeleton-score-num" />
            </view>
          </view>
        </view>

        <view class="skeleton-card-footer">
          <view class="skeleton-footer-btn" />
          <view class="skeleton-footer-btn primary" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  isDark: {
    type: Boolean,
    default: false
  },
  step: {
    type: Number,
    default: 1
  }
});
</script>

<style lang="scss" scoped>
.skeleton-container {
  --skeleton-bg: #e5e7eb;
  --skeleton-highlight: #d1d5db;
  --card-bg: rgba(255, 255, 255, 0.8);
  --card-border: rgba(0, 0, 0, 0.05);

  padding: 30rpx;
}

.skeleton-container.dark-mode {
  --skeleton-bg: #2c2c2e;
  --skeleton-highlight: #3a3a3c;
  --card-bg: var(--bg-card);
  --card-border: var(--border-color);
}

.glass-card {
  background: var(--card-bg);
  border: 2rpx solid var(--card-border);
  border-radius: 40rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
}

/* 脉冲动画 */
@keyframes skeleton-pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

.skeleton-step-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
  /* gap: 20rpx; -- replaced for Android WebView compat */
}

.skeleton-step-bar .skeleton-step + .skeleton-line,
.skeleton-step-bar .skeleton-line + .skeleton-step {
  margin-left: 20rpx;
}

.skeleton-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 10rpx; -- replaced for Android WebView compat */
}

.skeleton-step .skeleton-step-text {
  margin-top: 10rpx;
}

.skeleton-dot {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-step-text {
  width: 80rpx;
  height: 24rpx;
  border-radius: 12rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-line {
  flex: 1;
  height: 4rpx;
  background: var(--skeleton-bg);
  margin: 0 20rpx;
  margin-top: -30rpx;
  animation: skeleton-pulse 1.5s infinite;
}

/* 表单骨架 */
.skeleton-form {
  padding: 50rpx 40rpx;
}

.skeleton-form-header {
  margin-bottom: 50rpx;
}

.skeleton-title {
  width: 280rpx;
  height: 48rpx;
  border-radius: 12rpx;
  background: var(--skeleton-bg);
  margin-bottom: 16rpx;
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-subtitle {
  width: 400rpx;
  height: 28rpx;
  border-radius: 8rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-input-group {
  margin-bottom: 40rpx;
}

.skeleton-label {
  width: 160rpx;
  height: 28rpx;
  border-radius: 8rpx;
  background: var(--skeleton-bg);
  margin-bottom: 20rpx;
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-input {
  width: 100%;
  height: 100rpx;
  border-radius: 24rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-btn {
  width: 100%;
  height: 110rpx;
  border-radius: 30rpx;
  background: var(--skeleton-highlight);
  margin-top: 60rpx;
  animation: skeleton-pulse 1.5s infinite;
}

/* 结果骨架 */
.skeleton-result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30rpx;
  padding: 0 10rpx;
}

.skeleton-result-title {
  width: 200rpx;
  height: 36rpx;
  border-radius: 8rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-filter-btn {
  width: 100rpx;
  height: 48rpx;
  border-radius: 20rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

/* 院校卡片骨架 */
.skeleton-school-card {
  padding: 30rpx;
}

.skeleton-card-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 24rpx;
  padding-bottom: 24rpx;
  border-bottom: 1rpx solid var(--card-border);
}

.skeleton-school-info {
  flex: 1;
}

.skeleton-school-name {
  width: 200rpx;
  height: 36rpx;
  border-radius: 8rpx;
  background: var(--skeleton-bg);
  margin-bottom: 12rpx;
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-school-loc {
  width: 120rpx;
  height: 24rpx;
  border-radius: 6rpx;
  background: var(--skeleton-bg);
  margin-bottom: 16rpx;
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-tags {
  display: flex;
  /* gap: 12rpx; -- replaced for Android WebView compat */
}

.skeleton-tag + .skeleton-tag {
  margin-left: 12rpx;
}

.skeleton-tag {
  width: 80rpx;
  height: 32rpx;
  border-radius: 8rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-match-rate {
  width: 100rpx;
  height: 80rpx;
  border-radius: 16rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-major {
  margin-bottom: 24rpx;
}

.skeleton-major-title {
  width: 300rpx;
  height: 28rpx;
  border-radius: 8rpx;
  background: var(--skeleton-bg);
  margin-bottom: 16rpx;
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-scores {
  display: flex;
  justify-content: space-between;
  background: var(--skeleton-highlight);
  padding: 16rpx 24rpx;
  border-radius: 16rpx;
}

.skeleton-score-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
}

.skeleton-score-col .skeleton-score-num {
  margin-top: 8rpx;
}

.skeleton-score-year {
  width: 60rpx;
  height: 20rpx;
  border-radius: 4rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-score-num {
  width: 80rpx;
  height: 32rpx;
  border-radius: 6rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;
}

.skeleton-card-footer {
  display: flex;
  /* gap: 24rpx; -- replaced for Android WebView compat */
  margin-top: 24rpx;
}

.skeleton-footer-btn + .skeleton-footer-btn {
  margin-left: 24rpx;
}

.skeleton-footer-btn {
  flex: 1;
  height: 72rpx;
  border-radius: 36rpx;
  background: var(--skeleton-bg);
  animation: skeleton-pulse 1.5s infinite;

  &.primary {
    background: var(--skeleton-highlight);
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton-dot,
  .skeleton-step-text,
  .skeleton-line,
  .skeleton-title,
  .skeleton-subtitle,
  .skeleton-label,
  .skeleton-input,
  .skeleton-btn,
  .skeleton-result-title,
  .skeleton-filter-btn,
  .skeleton-school-name,
  .skeleton-school-loc,
  .skeleton-tag,
  .skeleton-match-rate,
  .skeleton-major-title,
  .skeleton-score-year,
  .skeleton-score-num,
  .skeleton-footer-btn {
    animation: none;
  }
}
</style>
