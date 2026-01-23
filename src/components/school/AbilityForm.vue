<template>
  <view class="ability-form">
    <!-- 标题 -->
    <view class="ability-form__title">
      Step 3: 能力评估
    </view>
    
    <!-- 表单内容 -->
    <view class="ability-form__content">
      <!-- 英语水平 -->
      <view class="form-item">
        <view class="form-item__label">
          英语水平
        </view>
        <view class="form-item__value">
          <text class="value-text">{{ formData.english }}</text>
          <text class="value-unit">分</text>
        </view>
        <view class="slider-container">
          <slider 
            :value="formData.english"
            :min="0"
            :max="100"
            :step="1"
            activeColor="#07C160"
            backgroundColor="#E5E5E5"
            block-size="20"
            @change="onEnglishChange"
          />
        </view>
        <view class="slider-labels">
          <text class="label-text">0</text>
          <text class="label-text">100</text>
        </view>
      </view>
      
      <!-- 数学基础 -->
      <view class="form-item">
        <view class="form-item__label">
          数学基础
        </view>
        <view class="form-item__value">
          <text class="value-text">{{ formData.math }}</text>
          <text class="value-unit">分</text>
        </view>
        <view class="slider-container">
          <slider 
            :value="formData.math"
            :min="0"
            :max="100"
            :step="1"
            activeColor="#07C160"
            backgroundColor="#E5E5E5"
            block-size="20"
            @change="onMathChange"
          />
        </view>
        <view class="slider-labels">
          <text class="label-text">0</text>
          <text class="label-text">100</text>
        </view>
      </view>
    </view>
    
    <!-- 按钮组 -->
    <view class="ability-form__footer">
      <button 
        class="prev-button"
        @click="handlePrev"
      >
        上一步
      </button>
      <button 
        class="next-button"
        @click="handleNext"
      >
        下一步
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue'

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
  display: flex;
  flex-direction: column;
  
  &__title {
    padding: 40rpx 32rpx 32rpx;
    font-size: 40rpx;
    font-weight: 600;
    color: #333333;
  }
  
  &__content {
    flex: 1;
    padding: 0 32rpx;
  }
  
  &__footer {
    padding: 40rpx 32rpx;
    padding-bottom: 40rpx;
    display: flex;
    gap: 24rpx;
  }
}

.form-item {
  margin-bottom: 60rpx;
  
  &__label {
    font-size: 28rpx;
    color: #333333;
    margin-bottom: 16rpx;
    font-weight: 500;
  }
  
  &__value {
    display: flex;
    align-items: baseline;
    justify-content: center;
    margin-bottom: 32rpx;
  }
}

.value-text {
  font-size: 80rpx;
  font-weight: bold;
  color: #07C160;
  line-height: 1;
}

.value-unit {
  font-size: 32rpx;
  color: #07C160;
  margin-left: 8rpx;
}

.slider-container {
  padding: 0 12rpx;
  margin-bottom: 16rpx;
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  padding: 0 12rpx;
}

.label-text {
  font-size: 24rpx;
  color: #999999;
}

.prev-button {
  flex: 1;
  height: 88rpx;
  background-color: #F5F5F5;
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666666;
  font-size: 32rpx;
  font-weight: 500;
  border: none;
  
  &::after {
    border: none;
  }
  
  &:active {
    background-color: #E8E8E8;
  }
}

.next-button {
  flex: 1;
  height: 88rpx;
  background: linear-gradient(135deg, #07C160 0%, #05A850 100%);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  font-size: 32rpx;
  font-weight: 500;
  border: none;
  box-shadow: 0 8rpx 24rpx rgba(7, 193, 96, 0.3);
  transition: all 0.3s ease;
  
  &::after {
    border: none;
  }
  
  &:active {
    transform: scale(0.98);
    box-shadow: 0 4rpx 16rpx rgba(7, 193, 96, 0.2);
  }
}
</style>
