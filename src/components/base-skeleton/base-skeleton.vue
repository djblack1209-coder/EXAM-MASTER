<template>
  <view class="skeleton-container" :class="{ 'dark-mode': isDark }">
    <!-- Header 骨架 -->
    <view class="skeleton-header">
      <view class="skeleton-avatar"></view>
      <view class="skeleton-greeting">
        <view class="skeleton-greeting-text"></view>
        <view class="skeleton-time"></view>
      </view>
    </view>
    
    <!-- Exam-Master 横幅骨架 -->
    <view class="skeleton-banner">
      <view class="skeleton-banner-icon"></view>
      <view class="skeleton-banner-text"></view>
    </view>
    
    <!-- 每日金句骨架 -->
    <view class="skeleton-card">
      <view class="skeleton-quote-header">
        <view class="skeleton-quote-tag"></view>
        <view class="skeleton-quote-date"></view>
      </view>
      <view class="skeleton-quote-text"></view>
    </view>
    
    <!-- 功能区域骨架 -->
    <view class="skeleton-feature">
      <!-- 邀请横幅骨架 -->
      <view class="skeleton-card skeleton-invite-banner">
        <view class="skeleton-banner-content">
          <view class="skeleton-banner-title"></view>
          <view class="skeleton-banner-desc"></view>
        </view>
        <view class="skeleton-banner-arrow"></view>
      </view>
      
      <!-- 功能网格骨架 -->
      <view class="skeleton-feature-grid">
        <!-- 倒计时骨架 -->
        <view class="skeleton-card skeleton-countdown">
          <view class="skeleton-countdown-label"></view>
          <view class="skeleton-countdown-value"></view>
          <view class="skeleton-countdown-date"></view>
        </view>
        
        <!-- 智能刷题骨架 -->
        <view class="skeleton-card skeleton-practice">
          <view class="skeleton-practice-content">
            <view class="skeleton-practice-title"></view>
            <view class="skeleton-practice-desc"></view>
          </view>
          <view class="skeleton-practice-play"></view>
        </view>
      </view>
    </view>
    
    <!-- 学习热力图骨架 -->
    <view class="skeleton-section">
      <view class="skeleton-section-header">
        <view class="skeleton-section-title"></view>
        <view class="skeleton-section-total"></view>
      </view>
      <view class="skeleton-card skeleton-heatmap">
        <view class="skeleton-heatmap-grid">
          <view class="skeleton-heatmap-col" v-for="i in 14" :key="i">
            <view class="skeleton-heatmap-cell" v-for="j in 5" :key="j"></view>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 今日计划骨架 -->
    <view class="skeleton-section">
      <view class="skeleton-section-header">
        <view class="skeleton-section-title"></view>
        <view class="skeleton-section-total"></view>
      </view>
      <view class="skeleton-card skeleton-task">
        <view class="skeleton-task-item" v-for="i in 3" :key="i">
          <view class="skeleton-ta<REDACTED_SECRET>"></view>
          <view class="skeleton-task-text"></view>
          <view class="skeleton-task-tag"></view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'BaseSkeleton',
  props: {
    // 深色模式状态
    isDark: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style scoped>
/* 骨架屏容器 */
.skeleton-container {
  padding: 0 20px;
  width: 100%;
  box-sizing: border-box;
}

/* 深色模式 */
.skeleton-container.dark-mode {
  --skeleton-bg: #2d3748;
  --skeleton-line: #4a5568;
  --skeleton-highlight: #718096;
}

/* 浅色模式 */
.skeleton-container {
  --skeleton-bg: #ffffff;
  --skeleton-line: #e2e8f0;
  --skeleton-highlight: #cbd5e0;
}

/* 骨架屏基础样式 */
.skeleton-card {
  background: var(--skeleton-bg);
  border-radius: 12px;
  padding: 24rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4px 24px 0 rgba(0, 0, 0, 0.05);
  animation: skeleton-pulse 1.5s infinite ease-in-out;
}

/* 骨架屏动画 */
@keyframes skeleton-pulse {
  0% {
    background-color: var(--skeleton-line);
  }
  50% {
    background-color: var(--skeleton-highlight);
  }
  100% {
    background-color: var(--skeleton-line);
  }
}

/* Header 骨架 */
.skeleton-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  padding: 0;
}

.skeleton-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--skeleton-line);
  margin-right: 16px;
  animation: skeleton-pulse 1.5s infinite ease-in-out;
}

.skeleton-greeting {
  flex: 1;
}

.skeleton-greeting-text {
  width: 120px;
  height: 20px;
  background: var(--skeleton-line);
  border-radius: 8px;
  margin-bottom: 8px;
  animation: skeleton-pulse 1.5s infinite ease-in-out;
}

.skeleton-time {
  width: 80px;
  height: 16px;
  background: var(--skeleton-line);
  border-radius: 6px;
  animation: skeleton-pulse 1.5s infinite ease-in-out;
}

/* 横幅骨架 */
.skeleton-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--skeleton-line);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24rpx;
  animation: skeleton-pulse 1.5s infinite ease-in-out;
}

.skeleton-banner-icon {
  width: 40px;
  height: 40px;
  background: var(--skeleton-highlight);
  border-radius: 8px;
  margin-right: 16px;
}

.skeleton-banner-text {
  width: 150px;
  height: 24px;
  background: var(--skeleton-highlight);
  border-radius: 8px;
}

/* 每日金句骨架 */
.skeleton-quote-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.skeleton-quote-tag {
  width: 80px;
  height: 24rpx;
  background: var(--skeleton-line);
  border-radius: 12rpx;
}

.skeleton-quote-date {
  width: 100px;
  height: 20rpx;
  background: var(--skeleton-line);
  border-radius: 8rpx;
}

.skeleton-quote-text {
  width: 100%;
  height: 80rpx;
  background: var(--skeleton-line);
  border-radius: 8rpx;
}

/* 功能区域骨架 */
.skeleton-feature {
  margin-bottom: 24rpx;
}

/* 邀请横幅骨架 */
.skeleton-invite-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.skeleton-banner-content {
  flex: 1;
}

.skeleton-banner-title {
  width: 200rpx;
  height: 28rpx;
  background: var(--skeleton-line);
  border-radius: 8rpx;
  margin-bottom: 12rpx;
}

.skeleton-banner-desc {
  width: 250rpx;
  height: 24rpx;
  background: var(--skeleton-line);
  border-radius: 8rpx;
}

.skeleton-banner-arrow {
  width: 30rpx;
  height: 30rpx;
  background: var(--skeleton-line);
  border-radius: 50%;
}

/* 功能网格骨架 */
.skeleton-feature-grid {
  display: flex;
  gap: 16px;
  margin-top: 16px;
}

.skeleton-countdown, .skeleton-practice {
  flex: 1;
  height: 180rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.skeleton-countdown-label {
  width: 120rpx;
  height: 20rpx;
  background: var(--skeleton-line);
  border-radius: 8rpx;
  margin-bottom: 16rpx;
}

.skeleton-countdown-value {
  width: 160rpx;
  height: 48rpx;
  background: var(--skeleton-line);
  border-radius: 8rpx;
  margin-bottom: 12rpx;
}

.skeleton-countdown-date {
  width: 80rpx;
  height: 20rpx;
  background: var(--skeleton-line);
  border-radius: 12rpx;
}

.skeleton-practice-content {
  text-align: center;
  margin-bottom: 16rpx;
}

.skeleton-practice-title {
  width: 120rpx;
  height: 28rpx;
  background: var(--skeleton-line);
  border-radius: 8rpx;
  margin: 0 auto 12rpx;
}

.skeleton-practice-desc {
  width: 100rpx;
  height: 20rpx;
  background: var(--skeleton-line);
  border-radius: 8rpx;
  margin: 0 auto;
}

.skeleton-practice-play {
  width: 48rpx;
  height: 48rpx;
  background: var(--skeleton-line);
  border-radius: 50%;
}

/* 学习热力图骨架 */
.skeleton-section {
  margin-bottom: 24rpx;
}

.skeleton-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.skeleton-section-title {
  width: 120rpx;
  height: 24rpx;
  background: var(--skeleton-line);
  border-radius: 8rpx;
}

.skeleton-section-total {
  width: 100rpx;
  height: 20rpx;
  background: var(--skeleton-line);
  border-radius: 8rpx;
}

.skeleton-heatmap {
  padding: 24rpx;
}

.skeleton-heatmap-grid {
  display: flex;
  gap: 6rpx;
}

.skeleton-heatmap-col {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.skeleton-heatmap-cell {
  width: 12px;
  height: 12px;
  background: var(--skeleton-line);
  border-radius: 3px;
}

/* 今日计划骨架 */
.skeleton-task-item {
  display: flex;
  align-items: center;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--skeleton-line);
}

.skeleton-task-item:last-child {
  border-bottom: none;
}

.skeleton-ta<REDACTED_SECRET> {
  width: 24rpx;
  height: 24rpx;
  background: var(--skeleton-line);
  border-radius: 6rpx;
  margin-right: 16rpx;
}

.skeleton-task-text {
  flex: 1;
  height: 24rpx;
  background: var(--skeleton-line);
  border-radius: 8rpx;
}

.skeleton-task-tag {
  width: 60rpx;
  height: 20rpx;
  background: var(--skeleton-line);
  border-radius: 10rpx;
}
</style>
