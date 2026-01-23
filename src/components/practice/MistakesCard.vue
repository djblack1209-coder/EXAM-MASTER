<template>
  <view class="mistakes-card">
    <view class="card-header">
      <text class="title">错题</text>
    </view>
    
    <view class="card-content">
      <!-- 左侧：猫咪插画 + 电池图标 -->
      <view class="left-section">
        <view class="cat-wrapper">
          <image
            class="cat-icon"
            src="https://img.icons8.com/color/96/cat.png"
            mode="aspectFit"
          />
        </view>
        <view class="battery-wrapper">
          <view class="battery">
            <view class="battery-level" :style="{ width: batteryPercent + '%' }"></view>
          </view>
          <text class="battery-text">{{ batteryPercent }}%</text>
        </view>
      </view>
      
      <!-- 右侧：按钮和统计 -->
      <view class="right-section">
        <view class="action-btn" @tap="handleReview">
          <text class="btn-text">再刷错题</text>
          <text class="btn-arrow">›</text>
        </view>
        <text class="stats-text">共 {{ mistakeCount }} 道错题</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { storageService } from '../../../services/storageService.js'

const batteryPercent = ref(75)
const mistakeCount = ref(0)

// 加载错题数量
const loadMistakeCount = async () => {
  try {
    const result = await storageService.getMistakes(1, 1)
    if (result && result.total !== undefined) {
      mistakeCount.value = result.total
    } else {
      // 降级到本地读取
      const localMistakes = storageService.get('mistake_book', [])
      mistakeCount.value = localMistakes.length
    }
  } catch (error) {
    console.error('加载错题数量失败:', error)
    // 降级到本地读取
    const localMistakes = storageService.get('mistake_book', [])
    mistakeCount.value = localMistakes.length
  }
}

onMounted(() => {
  loadMistakeCount()
})

const handleReview = () => {
  uni.navigateTo({
    url: '/src/pages/mistake/index'
  })
}
</script>

<style lang="scss" scoped>
.mistakes-card {
  background-color: #FFFFFF;
  border-radius: 24rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}

.card-header {
  margin-bottom: 20rpx;
}

.title {
  font-size: 32rpx;
  font-weight: 600;
  color: #333333;
}

.card-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.left-section {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.cat-wrapper {
  width: 100rpx;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cat-icon {
  width: 80rpx;
  height: 80rpx;
}

.battery-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}

.battery {
  width: 60rpx;
  height: 100rpx;
  border: 4rpx solid #07C160;
  border-radius: 8rpx;
  position: relative;
  padding: 4rpx;
  
  &::before {
    content: '';
    position: absolute;
    top: -12rpx;
    left: 50%;
    transform: translateX(-50%);
    width: 30rpx;
    height: 8rpx;
    background-color: #07C160;
    border-radius: 4rpx 4rpx 0 0;
  }
}

.battery-level {
  height: 100%;
  background: linear-gradient(180deg, #07C160 0%, #05A850 100%);
  border-radius: 4rpx;
  transition: width 0.3s ease;
}

.battery-text {
  font-size: 24rpx;
  color: #07C160;
  font-weight: 600;
}

.right-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 15rpx;
}

.action-btn {
  background: linear-gradient(135deg, #07C160 0%, #05A850 100%);
  padding: 20rpx 40rpx;
  border-radius: 50rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.3);
}

.btn-text {
  font-size: 28rpx;
  color: #FFFFFF;
  font-weight: 600;
}

.btn-arrow {
  font-size: 36rpx;
  color: #FFFFFF;
  font-weight: bold;
}

.stats-text {
  font-size: 24rpx;
  color: #999999;
}
</style>
