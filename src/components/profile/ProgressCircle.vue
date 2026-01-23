<template>
  <view class="progress-card" @click="handleViewDetail">
    <view class="progress-circle">
      <!-- 外层圆环 - 使用 conic-gradient 实现 -->
      <view class="circle-outer" :style="circleStyle">
        <!-- 内层白色圆 -->
        <view class="circle-inner">
          <view class="progress-content">
            <text class="progress-number">{{ progress }}%</text>
            <text class="progress-label">总计划完成度</text>
          </view>
        </view>
      </view>
    </view>
    
    <view class="detail-hint">
      <text class="hint-text">点击查看详细进度</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  progress: {
    type: Number,
    default: 0
  }
})

// 计算圆锥渐变样式
const circleStyle = computed(() => {
  const percent = Math.max(0, Math.min(100, props.progress || 75))
  return {
    background: `conic-gradient(#07C160 ${percent}%, #eee 0)`
  }
})

const handleViewDetail = () => {
  uni.showToast({
    title: '查看详细进度',
    icon: 'none'
  })
}
</script>

<style lang="scss" scoped>
.progress-card {
  background: #FFFFFF;
  border-radius: 24rpx;
  margin: 24rpx;
  padding: 48rpx 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.progress-circle {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 24rpx;
}

.circle-outer {
  width: 340rpx;
  height: 340rpx;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  /* conic-gradient 通过 style 动态注入 */
  /* 添加轻微阴影增加立体感 */
  box-shadow: 0 4rpx 24rpx rgba(7, 193, 96, 0.15);
}

.circle-inner {
  /* 内圆更大，让圆环更细 (360-300)/2 = 30rpx 环宽 */
  width: 280rpx;
  height: 280rpx;
  border-radius: 50%;
  background: #FFFFFF;
  display: flex;
  justify-content: center;
  align-items: center;
  box-shadow: inset 0 2rpx 10rpx rgba(0, 0, 0, 0.03);
}

.progress-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.progress-number {
  font-size: 112rpx;
  font-weight: 700;
  color: #333333;
  line-height: 1;
  margin-bottom: 12rpx;
  font-family: -apple-system, 'Helvetica Neue', sans-serif;
}

.progress-label {
  font-size: 28rpx;
  color: #666666;
  font-weight: 500;
}

.detail-hint {
  margin-top: 16rpx;
}

.hint-text {
  font-size: 24rpx;
  color: #999999;
}
</style>
