<template>
  <view class="step-progress">
    <view class="step-progress__container">
      <view 
        v-for="(step, index) in steps" 
        :key="index" 
        class="step-progress__item"
      >
        <!-- 圆点 -->
        <view class="step-progress__dot-wrapper">
          <view 
            class="step-progress__dot" 
            :class="{
              'step-progress__dot--active': index <= currentStep,
              'step-progress__dot--current': index === currentStep
            }"
          >
            <view 
              v-if="index < currentStep" 
              class="step-progress__dot-check"
            >
              ✓
            </view>
          </view>
          
          <!-- 连接线 (最后一个不显示) -->
          <view 
            v-if="index < steps.length - 1" 
            class="step-progress__line"
            :class="{
              'step-progress__line--active': index < currentStep
            }"
          ></view>
        </view>
        
        <!-- 步骤文字 -->
        <view 
          class="step-progress__label"
          :class="{
            'step-progress__label--active': index === currentStep
          }"
        >
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
  }
})
</script>

<style lang="scss" scoped>
.step-progress {
  padding: 40rpx 32rpx;
  background-color: #FFFFFF;
  
  &__container {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  
  &__item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
  }
  
  &__dot-wrapper {
    width: 100%;
    display: flex;
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
    border: 3rpx solid #D9D9D9;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
    z-index: 2;
    
    &--active {
      background-color: #07C160;
      border-color: #07C160;
    }
    
    &--current {
      width: 36rpx;
      height: 36rpx;
      background-color: #07C160;
      border: 3rpx solid #07C160;
      box-shadow: 0 0 0 6rpx rgba(7, 193, 96, 0.18);
    }
  }
  
  &__dot-check {
    color: #FFFFFF;
    font-size: 24rpx;
    font-weight: bold;
  }
  
  &__line {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translateY(-50%);
    width: 100%;
    height: 4rpx;
    background-color: #E5E5E5;
    transition: background-color 0.3s ease;
    z-index: 1;
    
    &--active {
      background-color: #07C160;
    }
  }
  
  &__label {
    font-size: 24rpx;
    color: #999999;
    text-align: center;
    transition: all 0.3s ease;
    white-space: nowrap;
    
    &--active {
      color: #333333;
      font-weight: 500;
      font-size: 26rpx;
    }
  }
}
</style>
