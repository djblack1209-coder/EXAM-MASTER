<template>
  <view class="upload-card ds-card ds-flex ds-flex-col ds-touchable" :class="{ 'dark-mode': isDark }"
    @tap="handleUpload">
    <view class="upload-icon ds-touch-target">
      <view class="cloud-icon">☁️</view>
      <view class="arrow-icon">↑</view>
    </view>
    <text class="upload-title ds-text-xl ds-font-semibold">上传题库</text>
    <text class="upload-tip ds-text-xs ds-text-secondary">支持 .txt/.docx/.pdf 格式</text>
  </view>
</template>

<script setup>
// Props
defineProps({
  isDark: {
    type: Boolean,
    default: false
  }
})

const handleUpload = () => {
  console.log('点击上传题库')
  uni.showToast({
    title: '上传功能开发中',
    icon: 'none'
  })
}
</script>

<style lang="scss" scoped>
.upload-card {
  background-color: var(--ds-bg-primary);
  border-radius: 24rpx;
  padding: 60rpx 40rpx;
  margin-bottom: 30rpx;
  align-items: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
  transition: all 150ms ease-out;

  &:active {
    transform: scale(0.98);
  }
}

.upload-icon {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(135deg, var(--ds-success) 0%, var(--ds-success-dark) 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 30rpx;
  transition: all 150ms ease-out;
}

.cloud-icon {
  font-size: 60rpx;
  position: absolute;
  top: 20rpx;
}

.arrow-icon {
  font-size: 50rpx;
  color: #FFFFFF;
  font-weight: bold;
  margin-top: 10rpx;
}

.upload-title {
  color: var(--ds-text-primary);
  margin-bottom: 16rpx;
}

.upload-tip {
  color: var(--ds-text-secondary);
}

/* 深色模式 */
.dark-mode {
  .upload-card {
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.2);
  }

  .arrow-icon {
    color: #1c1c1e;
  }
}
</style>
