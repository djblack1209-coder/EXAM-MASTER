<template>
  <view class="confirm-form ds-flex ds-flex-col" :class="{ 'dark-mode': isDark }">
    <!-- 标题 -->
    <view class="confirm-form__title ds-text-display ds-font-semibold">Step 4: 信息确认</view>

    <!-- 表单内容 -->
    <view class="confirm-form__content">
      <view class="info-card ds-card">
        <view class="info-section">
          <view class="section-title ds-flex ds-gap-xs">
            <text class="title-icon">🎓</text>
            <text class="title-text ds-text-base ds-font-semibold">教育背景</text>
          </view>
          <view class="info-item ds-flex">
            <text class="item-label ds-text-sm ds-text-secondary">毕业院校:</text>
            <text class="item-value ds-text-sm">{{ educationData.school || '未填写' }}</text>
          </view>
          <view class="info-item ds-flex">
            <text class="item-label ds-text-sm ds-text-secondary">所学专业:</text>
            <text class="item-value ds-text-sm">{{ educationData.major || '未填写' }}</text>
          </view>
          <view class="info-item ds-flex">
            <text class="item-label ds-text-sm ds-text-secondary">学历层次:</text>
            <text class="item-value ds-text-sm">{{ educationData.degree || '未填写' }}</text>
          </view>
        </view>

        <view class="divider"></view>

        <view class="info-section">
          <view class="section-title ds-flex ds-gap-xs">
            <text class="title-icon">📍</text>
            <text class="title-text ds-text-base ds-font-semibold">目标地区</text>
          </view>
          <view class="info-item ds-flex">
            <text class="item-label ds-text-sm ds-text-secondary">意向城市:</text>
            <text class="item-value ds-text-sm">
              {{ regionData.cities?.join('、') || '未选择' }}
            </text>
          </view>
        </view>

        <view class="divider"></view>

        <view class="info-section">
          <view class="section-title ds-flex ds-gap-xs">
            <text class="title-icon">📊</text>
            <text class="title-text ds-text-base ds-font-semibold">能力评估</text>
          </view>
          <view class="info-item ds-flex">
            <text class="item-label ds-text-sm ds-text-secondary">英语水平:</text>
            <text class="item-value ds-text-sm">{{ abilityData.english || 0 }} 分</text>
          </view>
          <view class="info-item ds-flex">
            <text class="item-label ds-text-sm ds-text-secondary">数学基础:</text>
            <text class="item-value ds-text-sm">{{ abilityData.math || 0 }} 分</text>
          </view>
        </view>
      </view>

      <!-- 提示信息 -->
      <view class="tip-box ds-flex ds-gap-xs">
        <text class="tip-icon">💡</text>
        <text class="tip-text ds-text-sm">我们将根据您的信息,为您推荐最适合的院校和专业</text>
      </view>
    </view>

    <!-- 按钮组 -->
    <view class="confirm-form__footer ds-flex ds-gap-md">
      <button class="prev-button ds-text-lg ds-font-medium ds-touchable" @click="handlePrev">上一步</button>
      <button class="submit-button ds-text-lg ds-font-medium ds-touchable" :disabled="isSubmitting" @click="handleSubmit">{{ isSubmitting ? '提交中...' : '提交生成择校报告' }}</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

// defineProps 和 defineEmits 是编译器宏，无需手动导入
const props = defineProps({
  educationData: {
    type: Object,
    default: () => ({})
  },
  regionData: {
    type: Object,
    default: () => ({})
  },
  abilityData: {
    type: Object,
    default: () => ({})
  },
  isDark: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['prev', 'submit'])

// 防重复点击
const isSubmitting = ref(false)

// 上一步
const handlePrev = () => {
  emit('prev')
}

// 提交
const handleSubmit = () => {
  if (isSubmitting.value) return
  isSubmitting.value = true
  emit('submit')
  // 3秒后解锁（防止提交失败后无法重试）
  setTimeout(() => {
    isSubmitting.value = false
  }, 3000)
}
</script>

<style lang="scss" scoped>
.confirm-form {
  min-height: 100vh;

  &__title {
    padding: 40rpx 32rpx 32rpx;
    color: var(--ds-text-primary);
  }

  &__content {
    flex: 1;
    padding: 0 32rpx 32rpx;
  }

  &__footer {
    padding: 40rpx 32rpx;
    padding-bottom: 40rpx;
  }
}

.info-card {
  background-color: var(--ds-bg-primary);
  border-radius: 16rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  margin-bottom: 32rpx;
  transition: all 150ms ease-out;
}

.info-section {
  margin-bottom: 32rpx;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  align-items: center;
  margin-bottom: 24rpx;
}

.title-icon {
  font-size: 32rpx;
}

.title-text {
  color: var(--ds-text-primary);
}

.info-item {
  margin-bottom: 16rpx;

  &:last-child {
    margin-bottom: 0;
  }
}

.item-label {
  color: var(--ds-text-secondary);
  width: 160rpx;
  flex-shrink: 0;
}

.item-value {
  flex: 1;
  color: var(--ds-text-primary);
  line-height: 1.6;
}

.divider {
  height: 2rpx;
  background-color: var(--ds-border-color);
  margin: 32rpx 0;
}

.tip-box {
  background: linear-gradient(135deg, #fff7e6 0%, #fff9ed 100%);
  border-radius: 12rpx;
  padding: 24rpx;
  align-items: flex-start;
}

.tip-icon {
  font-size: 32rpx;
  flex-shrink: 0;
  margin-top: 4rpx;
}

.tip-text {
  flex: 1;
  color: #d48806;
  line-height: 1.6;
}

.prev-button {
  flex: 1;
  height: 88rpx;
  background-color: var(--ds-bg-secondary);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ds-text-secondary);
  border: none;
  transition: all 150ms ease-out;

  &::after {
    border: none;
  }

  &:active {
    background-color: var(--ds-border-color);
    transform: scale(0.98);
  }
}

.submit-button {
  flex: 2;
  height: 88rpx;
  background: linear-gradient(135deg, var(--ds-success) 0%, var(--ds-success-dark) 100%);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--bg-card);
  border: none;
  box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.3);
  transition: all 150ms ease-out;

  &::after {
    border: none;
  }

  &:active {
    transform: scale(0.98);
    box-shadow: 0 4rpx 16rpx rgba(7, 193, 96, 0.2);
  }
}

/* 深色模式 */
. {
  .info-card {
    box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.2);
  }

  .tip-box {
    background: linear-gradient(135deg, #3a2f1a 0%, #4a3a2a 100%);
  }

  .tip-text {
    color: #ffc53d;
  }

  .submit-button {
    color: #1c1c1e;
    box-shadow: 0 8rpx 24rpx rgba(159, 232, 112, 0.3);

    &:active {
      box-shadow: 0 4rpx 16rpx rgba(159, 232, 112, 0.2);
    }
  }
}
</style>
