<template>
  <view class="progress-card ds-card ds-flex ds-flex-col ds-touchable" :class="{ 'dark-mode': isDark }"
    @click="handleViewDetail">
    <view class="progress-circle ds-flex">
      <!-- 外层圆环 - 使用 conic-gradient 实现 -->
      <view class="circle-outer ds-flex" :style="circleStyle">
        <!-- 内层白色圆 -->
        <view class="circle-inner ds-flex">
          <view class="progress-content ds-flex ds-flex-col">
            <text class="progress-number ds-font-bold">{{ progress }}%</text>
            <text class="progress-label ds-text-sm ds-font-medium">总计划完成度</text>
          </view>
        </view>
      </view>
    </view>

    <view class="detail-hint">
      <text class="hint-text ds-text-xs ds-text-secondary">点击查看详细进度</text>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  progress: {
    type: Number,
    default: 0
  },
  isDark: {
    type: Boolean,
    default: false
  }
})

// 计算圆锥渐变样式
const circleStyle = computed(() => {
  const percent = Math.max(0, Math.min(100, props.progress || 75))
  const progressColor = props.isDark ? 'var(--ds-success)' : '#07C160'
  const bgColor = props.isDark ? '#3a3a3c' : '#eee'
  return {
    background: `conic-gradient(${progressColor} ${percent}%, ${bgColor} 0)`
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
  background: var(--ds-bg-primary);
  border-radius: 24rpx;
  margin: 24rpx;
  padding: 48rpx 32rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.05);
  align-items: center;
  transition: all 150ms ease-out;

  &:active {
    transform: scale(0.98);
  }
}

.progress-circle {
  justify-content: center;
  align-items: center;
  margin-bottom: 24rpx;
}

.circle-outer {
  width: 340rpx;
  height: 340rpx;
  border-radius: 50%;
  justify-content: center;
  align-items: center;
  position: relative;
  /* conic-gradient 通过 style 动态注入 */
  /* 添加轻微阴影增加立体感 */
  box-shadow: 0 4rpx 24rpx rgba(7, 193, 96, 0.15);
  transition: box-shadow 150ms ease-out;
}

.circle-inner {
  /* 内圆更大，让圆环更细 (360-300)/2 = 30rpx 环宽 */
  width: 280rpx;
  height: 280rpx;
  border-radius: 50%;
  background: var(--ds-bg-primary);
  justify-content: center;
  align-items: center;
  box-shadow: inset 0 2rpx 10rpx rgba(0, 0, 0, 0.03);
  transition: all 150ms ease-out;
}

.progress-content {
  align-items: center;
}

.progress-number {
  font-size: 112rpx;
  color: var(--ds-text-primary);
  line-height: 1;
  margin-bottom: 12rpx;
  font-family: -apple-system, 'Helvetica Neue', sans-serif;
}

.progress-label {
  color: var(--ds-text-secondary);
}

.detail-hint {
  margin-top: 16rpx;
}

.hint-text {
  color: var(--ds-text-secondary);
}

/* 深色模式 */
. {
  .progress-card {
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.2);
  }

  .circle-outer {
    box-shadow: 0 4rpx 24rpx rgba(159, 232, 112, 0.15);
  }

  .circle-inner {
    box-shadow: inset 0 2rpx 10rpx rgba(0, 0, 0, 0.1);
  }
}
</style>
