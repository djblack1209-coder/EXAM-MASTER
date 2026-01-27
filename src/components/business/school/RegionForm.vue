<template>
  <view class="region-form ds-flex ds-flex-col" :class="{ 'dark-mode': isDark }">
    <!-- 标题 -->
    <view class="region-form__title ds-text-display ds-font-semibold">Step 2: 目标地区</view>

    <!-- 表单内容 -->
    <view class="region-form__content">
      <!-- 意向报考城市 -->
      <view class="form-section">
        <view class="form-section__label ds-text-sm ds-font-medium">意向报考城市</view>
        <view class="form-section__hint ds-text-xs ds-text-secondary">可多选</view>

        <!-- 城市标签组 -->
        <view class="city-tags ds-flex">
          <view v-for="city in cityOptions" :key="city" class="city-tag ds-touchable" :class="{
            'city-tag--selected': formData.cities.includes(city)
          }" @click="toggleCity(city)">
            <text class="city-tag__text ds-text-sm">{{ city }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 按钮组 -->
    <view class="region-form__footer ds-flex ds-gap-md">
      <button class="prev-button ds-text-lg ds-font-medium ds-touchable" @click="handlePrev">上一步</button>
      <button class="next-button ds-text-lg ds-font-medium ds-touchable" :class="{
        'next-button--disabled': !isFormValid
      }" :disabled="!isFormValid" @click="handleNext">
        下一步
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

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
  cities: []
})

// 城市选项
const cityOptions = ['北京', '上海', '广州', '深圳', '武汉', '成都', '西安', '南京']

// 表单验证
const isFormValid = computed(() => {
  return formData.value.cities.length > 0
})

// 切换城市选择
const toggleCity = (city) => {
  const index = formData.value.cities.indexOf(city)
  if (index > -1) {
    // 已选中,取消选择
    formData.value.cities.splice(index, 1)
  } else {
    // 未选中,添加选择
    formData.value.cities.push(city)
  }
}

// 上一步
const handlePrev = () => {
  emit('prev')
}

// 下一步
const handleNext = () => {
  if (!isFormValid.value) {
    uni.showToast({
      title: '请至少选择一个城市',
      icon: 'none'
    })
    return
  }

  emit('next', formData.value)
}
</script>

<style lang="scss" scoped>
.region-form {
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

.form-section {
  &__label {
    color: var(--ds-text-primary);
    margin-bottom: 8rpx;
  }

  &__hint {
    color: var(--ds-text-secondary);
    margin-bottom: 24rpx;
  }
}

.city-tags {
  flex-wrap: wrap;
  gap: 20rpx;
}

.city-tag {
  padding: 20rpx 40rpx;
  background-color: var(--ds-bg-secondary);
  border-radius: 48rpx;
  border: 2rpx solid var(--ds-border-color);
  transition: all 150ms ease-out;

  &--selected {
    background: linear-gradient(135deg, #e8f8f0 0%, #f0fcf5 100%);
    border-color: var(--ds-success);
  }

  &__text {
    color: var(--ds-text-secondary);
  }

  &--selected &__text {
    color: var(--ds-success);
    font-weight: 500;
  }

  &:active {
    transform: scale(0.95);
  }
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

  &:active:not(.next-button--disabled) {
    transform: scale(0.98);
    box-shadow: 0 4rpx 16rpx rgba(7, 193, 96, 0.2);
  }

  &--disabled {
    background: var(--ds-border-color);
    color: var(--ds-text-tertiary);
    box-shadow: none;
  }
}

/* 深色模式 */
. {
  .city-tag {
    &--selected {
      background: linear-gradient(135deg, #1a3a2a 0%, #2a4a3a 100%);
    }
  }

  .next-button {
    color: #1c1c1e;
    box-shadow: 0 8rpx 24rpx rgba(159, 232, 112, 0.3);

    &:active:not(.next-button--disabled) {
      box-shadow: 0 4rpx 16rpx rgba(159, 232, 112, 0.2);
    }

    &--disabled {
      color: var(--ds-text-tertiary);
    }
  }
}
</style>
