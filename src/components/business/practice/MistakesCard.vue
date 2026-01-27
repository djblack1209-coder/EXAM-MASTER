<template>
  <view class="mistakes-card ds-card" :class="{ 'dark-mode': isDark }">
    <view class="card-header">
      <text class="title ds-text-lg ds-font-semibold">错题</text>
    </view>

    <view class="card-content ds-flex ds-flex-between">
      <!-- 左侧：猫咪插画 + 电池图标 -->
      <view class="left-section ds-flex ds-gap-md">
        <view class="cat-wrapper">
          <image class="cat-icon" src="https://img.icons8.com/color/96/cat.png" mode="aspectFit" />
        </view>
        <view class="battery-wrapper ds-flex ds-flex-col ds-gap-xs">
          <view class="battery">
            <view class="battery-level" :style="{ width: batteryPercent + '%' }"></view>
          </view>
          <text class="battery-text ds-text-xs ds-font-semibold">{{ batteryPercent }}%</text>
        </view>
      </view>

      <!-- 右侧：按钮和统计 -->
      <view class="right-section ds-flex ds-flex-col ds-gap-sm">
        <view class="action-btn ds-touchable" @tap="handleReview">
          <text class="btn-text ds-text-sm ds-font-semibold">再刷错题</text>
          <text class="btn-arrow">›</text>
        </view>
        <text class="stats-text ds-text-xs ds-text-secondary">共 {{ mistakeCount }} 道错题</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { storageService } from '../../../services/storageService.js'

// Props
defineProps({
  isDark: {
    type: Boolean,
    default: false
  }
})

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
    url: '/pages/mistake/index'
  })
}
</script>

<style lang="scss" scoped>
.mistakes-card {
  background-color: var(--ds-bg-primary);
  border-radius: 24rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
  transition: all 150ms ease-out;
}

.card-header {
  margin-bottom: 20rpx;
}

.title {
  color: var(--ds-text-primary);
}

.card-content {
  align-items: center;
}

.left-section {
  align-items: center;
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
  align-items: center;
}

.battery {
  width: 60rpx;
  height: 100rpx;
  border: 4rpx solid var(--ds-success);
  border-radius: 8rpx;
  position: relative;
  padding: 4rpx;
  transition: border-color 150ms ease-out;

  &::before {
    content: '';
    position: absolute;
    top: -12rpx;
    left: 50%;
    transform: translateX(-50%);
    width: 30rpx;
    height: 8rpx;
    background-color: var(--ds-success);
    border-radius: 4rpx 4rpx 0 0;
    transition: background-color 150ms ease-out;
  }
}

.battery-level {
  height: 100%;
  background: linear-gradient(180deg, var(--ds-success) 0%, var(--ds-success-dark) 100%);
  border-radius: 4rpx;
  transition: width 300ms ease;
}

.battery-text {
  color: var(--ds-success);
  transition: color 150ms ease-out;
}

.right-section {
  align-items: flex-end;
}

.action-btn {
  background: linear-gradient(135deg, var(--ds-success) 0%, var(--ds-success-dark) 100%);
  padding: 20rpx 40rpx;
  border-radius: 50rpx;
  display: flex;
  align-items: center;
  gap: 10rpx;
  box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.3);
  transition: all 150ms ease-out;
  min-height: 44px;
  min-width: 44px;

  &:active {
    transform: scale(0.98);
    box-shadow: 0 4rpx 12rpx rgba(7, 193, 96, 0.2);
  }
}

.btn-text {
  color: #FFFFFF;
}

.btn-arrow {
  font-size: 36rpx;
  color: #FFFFFF;
  font-weight: bold;
}

.stats-text {
  color: var(--ds-text-secondary);
}

/* 深色模式 */
. {
  .mistakes-card {
    box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.2);
  }

  .action-btn {
    background: linear-gradient(135deg, var(--ds-success) 0%, var(--ds-success-dark) 100%);
    box-shadow: 0 8rpx 24rpx rgba(159, 232, 112, 0.3);

    &:active {
      box-shadow: 0 4rpx 12rpx rgba(159, 232, 112, 0.2);
    }
  }

  .btn-text,
  .btn-arrow {
    color: #1c1c1e;
  }
}
</style>
