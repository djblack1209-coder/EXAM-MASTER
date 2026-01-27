<template>
  <view class="ability-form ds-flex ds-flex-col" :class="{ 'dark-mode': isDark }">
    <!-- 标题 -->
    <view class="ability-form__title ds-text-display ds-font-semibold">Step 3: 能力评估</view>

    <!-- 表单内容 -->
    <view class="ability-form__content">
      <!-- 英语水平 -->
      <view class="form-item">
        <view class="form-item__label ds-text-sm ds-font-medium">英语水平</view>
        <view class="form-item__value ds-flex">
          <text class="value-text ds-font-bold">{{ formData.english }}</text>
          <text class="value-unit ds-text-lg">分</text>
        </view>
        <view class="slider-container">
          <slider :value="formData.english" :min="0" :max="100" :step="1" activeColor="#07C160"
            backgroundColor="#E5E5E5" block-size="20" @change="onEnglishChange" />
        </view>
        <view class="slider-labels ds-flex ds-flex-between">
          <text class="label-text ds-text-xs ds-text-secondary">0</text>
          <text class="label-text ds-text-xs ds-text-secondary">100</text>
        </view>
      </view>

      <!-- 数学基础 -->
      <view class="form-item">
        <view class="form-item__label ds-text-sm ds-font-medium">数学基础</view>
        <view class="form-item__value ds-flex">
          <text class="value-text ds-font-bold">{{ formData.math }}</text>
          <text class="value-unit ds-text-lg">分</text>
        </view>
        <view class="slider-container">
          <slider :value="formData.math" :min="0" :max="100" :step="1" activeColor="#07C160" backgroundColor="#E5E5E5"
            block-size="20" @change="onMathChange" />
        </view>
        <view class="slider-labels ds-flex ds-flex-between">
          <text class="label-text ds-text-xs ds-text-secondary">0</text>
          <text class="label-text ds-text-xs ds-text-secondary">100</text>
        </view>
      </view>
    </view>

    <!-- 按钮组 -->
    <view class="ability-form__footer ds-flex ds-gap-md">
      <button class="prev-button ds-text-lg ds-font-medium ds-touchable" @click="handlePrev">上一步</button>
      <button class="next-button ds-text-lg ds-font-medium ds-touchable" @click="handleNext">下一步</button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

// Props
defineProps({
  isDark: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['prev', 'next'])

// 表单数据
const formData = ref({
  english: 50,
  math: 50
})

// 英语水平改变
const onEnglishChange = (e) => {
  formData.value.english = e.detail.value
}

// 数学基础改变
const onMathChange = (e) => {
  formData.value.math = e.detail.value
}

// 上一步
const handlePrev = () => {
  emit('prev')
}

// 下一步
const handleNext = () => {
  emit('next', formData.value)
}
</script>

<style lang="scss" scoped>
.ability-form {
  min-height: 100vh;

  &__title {
    padding: 40rpx 32rpx 32rpx;
    color: var(--ds-text-primary);
  }

  &__content {
    flex: 1;
    padding: 0 32rpx;
  }

  &__footer {
    padding: 40rpx 32rpx;
    padding-bottom: 40rpx;
  }
}

.form-item {
  margin-bottom: 60rpx;

  &__label {
    color: var(--ds-text-primary);
    margin-bottom: 16rpx;
  }

  &__value {
    align-items: baseline;
    justify-content: center;
    margin-bottom: 32rpx;
  }
}

.value-text {
  font-size: 80rpx;
  color: var(--ds-success);
  line-height: 1;
}

.value-unit {
  color: var(--ds-success);
  margin-left: 8rpx;
}

.slider-container {
  padding: 0 12rpx;
  margin-bottom: 16rpx;
}

.slider-labels {
  padding: 0 12rpx;
}

.label-text {
  color: var(--ds-text-secondary);
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

.next-button {
  flex: 1;
  height: 88rpx;
  background: linear-gradient(135deg, var(--ds-success) 0%, var(--ds-success-dark) 100%);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
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
  .next-button {
    color: #1c1c1e;
    box-shadow: 0 8rpx 24rpx rgba(159, 232, 112, 0.3);

    &:active {
      box-shadow: 0 4rpx 16rpx rgba(159, 232, 112, 0.2);
    }
  }
}
</style>
