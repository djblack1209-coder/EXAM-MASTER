<template>
  <view class="region-form">
    <!-- 标题 -->
    <view class="region-form__title">
      Step 2: 目标地区
    </view>
    
    <!-- 表单内容 -->
    <view class="region-form__content">
      <!-- 意向报考城市 -->
      <view class="form-section">
        <view class="form-section__label">
          意向报考城市
        </view>
        <view class="form-section__hint">
          可多选
        </view>
        
        <!-- 城市标签组 -->
        <view class="city-tags">
          <view 
            v-for="city in cityOptions" 
            :key="city"
            class="city-tag"
            :class="{
              'city-tag--selected': formData.cities.includes(city)
            }"
            @click="toggleCity(city)"
          >
            <text class="city-tag__text">{{ city }}</text>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 按钮组 -->
    <view class="region-form__footer">
      <button 
        class="prev-button"
        @click="handlePrev"
      >
        上一步
      </button>
      <button 
        class="next-button"
        :class="{
          'next-button--disabled': !isFormValid
        }"
        :disabled="!isFormValid"
        @click="handleNext"
      >
        下一步
      </button>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['prev', 'next'])

// 表单数据
const formData = ref({
  cities: []
})

// 城市选项
const cityOptions = [
  '北京', '上海', '广州', '深圳',
  '武汉', '成都', '西安', '南京'
]

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

.form-section {
  &__label {
    font-size: 28rpx;
    color: #333333;
    margin-bottom: 8rpx;
    font-weight: 500;
  }
  
  &__hint {
    font-size: 24rpx;
    color: #999999;
    margin-bottom: 24rpx;
  }
}

.city-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.city-tag {
  padding: 20rpx 40rpx;
  background-color: #F5F7FA;
  border-radius: 48rpx;
  border: 2rpx solid #E5E5E5;
  transition: all 0.3s ease;
  
  &--selected {
    background: linear-gradient(135deg, #E8F8F0 0%, #F0FCF5 100%);
    border-color: #07C160;
  }
  
  &__text {
    font-size: 28rpx;
    color: #666666;
  }
  
  &--selected &__text {
    color: #07C160;
    font-weight: 500;
  }
  
  &:active {
    transform: scale(0.95);
  }
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
  
  &:active:not(.next-button--disabled) {
    transform: scale(0.98);
    box-shadow: 0 4rpx 16rpx rgba(7, 193, 96, 0.2);
  }
  
  &--disabled {
    background: #E5E5E5;
    color: #CCCCCC;
    box-shadow: none;
  }
}
</style>
