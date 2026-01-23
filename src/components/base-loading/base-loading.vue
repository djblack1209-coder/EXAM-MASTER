<template>
  <view v-if="visible" class="loading-container" :class="{ 'dark-mode': isDark }">
    <view class="loading-content">
      <view class="loading-spinner">
        <view class="spinner-dot"></view>
        <view class="spinner-dot"></view>
        <view class="spinner-dot"></view>
      </view>
      <text class="loading-text">{{ text || '加载中...' }}</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'BaseLoading',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    text: {
      type: String,
      default: '加载中...'
    },
    isDark: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style lang="scss" scoped>
.loading-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  z-index: 9999;
  
  &.dark-mode {
    background: rgba(22, 51, 0, 0.9);
  }
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.loading-spinner {
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: center;
}

.spinner-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: var(--accent-green, #9FE870);
  animation: bounce 1.4s infinite ease-in-out both;
  
  &:nth-child(1) {
    animation-delay: -0.32s;
  }
  
  &:nth-child(2) {
    animation-delay: -0.16s;
  }
  
  &:nth-child(3) {
    animation-delay: 0s;
  }
}

.loading-text {
  font-size: 28rpx;
  color: var(--text-body, #454545);
  font-weight: 500;
}

.dark-mode .loading-text {
  color: var(--text-body, #E2E8F0);
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
