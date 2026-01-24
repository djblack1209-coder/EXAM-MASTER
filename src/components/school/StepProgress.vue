<template>
  <view class="step-progress" :class="{ ' ': isDark }">
    <view class="step-progress__container ds-flex ds-flex-between">
      <view v-for="(step, index) in steps" :key="index" class="step-progress__item ds-flex ds-flex-col">
        <!-- 圆点 -->
        <view class="step-progress__dot-wrapper ds-flex">
          <view class="step-progress__dot" :class="{
            'step-progress__dot--active': index <= currentStep,
            'step-progress__dot--current': index === currentStep
          }">
            <view v-if="index < currentStep" class="step-progress__dot-check ds-font-bold">✓</view>
          </view>

          <!-- 连接线 (最后一个不显示) -->
          <view v-if="index < steps.length - 1" class="step-progress__line" :class="{
            'step-progress__line--active': index < currentStep
          }"></view>
        </view>

        <!-- 步骤文字 -->
        <view class="step-progress__label ds-text-xs" :class="{
          'step-progress__label--active': index === currentStep
        }">
          {{ step }}
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  currentStep: {
    type: Number,
    default: 0
  },
  steps: {
    type: Array,
    default: () => ['教育背景', '目标地区', '能力评估', '信息确认']
  },
  isDark: {
    type: Boolean,
    default: false
  }
})
</script>

<style lang="scss" scoped>
.step-progress {
  padding: 40rpx 32rpx;
  background-color: var(--ds-bg-primary);
  transition: background-color 150ms ease-out;

  &__container {
    align-items: flex-start;
  }

  &__item {
    flex: 1;
    align-items: center;
    position: relative;
  }

  &__dot-wrapper {
    width: 100%;
    align-items: center;
    justify-content: center;
    position: relative;
    margin-bottom: 16rpx;
  }

  &__dot {
    width: 32rpx;
    height: 32rpx;
    border-radius: 50%;
    background-color: transparent;
    border: 3rpx solid var(--ds-border-color);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 150ms ease-out;
    z-index: 2;

    &--active {
      background-color: var(--ds-success);
      border-color: var(--ds-success);
    }

    &--current {
      width: 36rpx;
      height: 36rpx;
      background-color: var(--ds-success);
      border: 3rpx solid var(--ds-success);
      box-shadow: 0 0 0 6rpx rgba(7, 193, 96, 0.18);
    }
  }

  &__dot-check {
    color: var(--bg-card);
    font-size: 24rpx;
  }

  &__line {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translateY(-50%);
    width: 100%;
    height: 4rpx;
    background-color: var(--ds-border-color);
    transition: background-color 150ms ease-out;
    z-index: 1;

    &--active {
      background-color: var(--ds-success);
    }
  }

  &__label {
    color: var(--ds-text-secondary);
    text-align: center;
    transition: all 150ms ease-out;
    white-space: nowrap;

    &--active {
      color: var(--ds-text-primary);
      font-weight: 500;
      font-size: 26rpx;
    }
  }
}

/* 深色模式 */
. {
  .step-progress__dot {
    &--current {
      box-shadow: 0 0 0 6rpx rgba(159, 232, 112, 0.18);
    }
  }

  .step-progress__dot-check {
    color: #1c1c1e;
  }
}
</style>
