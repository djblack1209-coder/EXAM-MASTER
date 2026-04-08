<template>
  <view class="error-page">
    <!-- 吉祥物猫头鹰 -->
    <image
      class="error-illustration"
      src="/static/illustrations/mascot-owl.png"
      mode="aspectFit"
      alt="页面未找到插画"
    />

    <text class="error-code">404</text>
    <text class="error-title">页面走丢了</text>
    <text class="error-desc">你要找的页面可能已被移除或暂时不可用</text>

    <view class="error-actions">
      <view class="action-btn primary" @tap="goHome">
        <text class="btn-text">回到首页</text>
      </view>
      <view class="action-btn secondary" @tap="goBack">
        <text class="btn-text">返回上页</text>
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 404 错误页面 - 页面未找到
 */

/** 返回首页 */
function goHome() {
  uni.switchTab({ url: '/pages/index/index' });
}

/** 返回上一页 */
function goBack() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
  } else {
    goHome();
  }
}
</script>

<style scoped>
.error-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 40rpx;
  background: var(--bg-page, #f5f7fa);
}

.error-illustration {
  width: 320rpx;
  height: 320rpx;
  margin-bottom: 40rpx;
}

.error-code {
  font-size: 120rpx;
  font-weight: 900;
  color: var(--text-tertiary, #c0c0c0);
  line-height: 1;
  margin-bottom: 16rpx;
}

.error-title {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
  margin-bottom: 12rpx;
}

.error-desc {
  font-size: 28rpx;
  color: var(--text-secondary, #666);
  text-align: center;
  margin-bottom: 60rpx;
}

.error-actions {
  display: flex;
  gap: 24rpx;
}

.action-btn {
  padding: 20rpx 48rpx;
  border-radius: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn.primary {
  background: var(--primary, #0f5f34);
}

.action-btn.primary .btn-text {
  color: var(--text-inverse, #fff);
  font-size: 30rpx;
  font-weight: 600;
}

.action-btn.secondary {
  background: var(--bg-secondary, #f0f0f0);
}

.action-btn.secondary .btn-text {
  color: var(--text-primary, #1a1a1a);
  font-size: 30rpx;
  font-weight: 600;
}
</style>
