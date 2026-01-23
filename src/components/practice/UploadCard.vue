<template>
  <view class="upload-card" @tap="handleUpload">
    <view class="upload-icon">
      <view class="cloud-icon">☁️</view>
      <view class="arrow-icon">↑</view>
    </view>
    <text class="upload-title">上传题库</text>
    <text class="upload-tip">支持 .txt/.docx/.pdf 格式</text>
  </view>
</template>

<script setup>
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
  background-color: #FFFFFF;
  border-radius: 24rpx;
  padding: 60rpx 40rpx;
  margin-bottom: 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.upload-icon {
  position: relative;
  width: 120rpx;
  height: 120rpx;
  background: linear-gradient(135deg, #07C160 0%, #05A850 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 30rpx;
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
  font-size: 36rpx;
  font-weight: 600;
  color: #333333;
  margin-bottom: 16rpx;
}

.upload-tip {
  font-size: 24rpx;
  color: #999999;
}
</style>
