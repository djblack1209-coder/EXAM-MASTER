<template>
  <view class="confirm-form">
    <!-- 标题 -->
    <view class="confirm-form__title">
      Step 4: 信息确认
    </view>
    
    <!-- 表单内容 -->
    <view class="confirm-form__content">
      <view class="info-card">
        <view class="info-section">
          <view class="section-title">
            <text class="title-icon">🎓</text>
            <text class="title-text">教育背景</text>
          </view>
          <view class="info-item">
            <text class="item-label">毕业院校:</text>
            <text class="item-value">{{ educationData.school || '未填写' }}</text>
          </view>
          <view class="info-item">
            <text class="item-label">所学专业:</text>
            <text class="item-value">{{ educationData.major || '未填写' }}</text>
          </view>
          <view class="info-item">
            <text class="item-label">学历层次:</text>
            <text class="item-value">{{ educationData.degree || '未填写' }}</text>
          </view>
        </view>
        
        <view class="divider"></view>
        
        <view class="info-section">
          <view class="section-title">
            <text class="title-icon">📍</text>
            <text class="title-text">目标地区</text>
          </view>
          <view class="info-item">
            <text class="item-label">意向城市:</text>
            <text class="item-value">
              {{ regionData.cities?.join('、') || '未选择' }}
            </text>
          </view>
        </view>
        
        <view class="divider"></view>
        
        <view class="info-section">
          <view class="section-title">
            <text class="title-icon">📊</text>
            <text class="title-text">能力评估</text>
          </view>
          <view class="info-item">
            <text class="item-label">英语水平:</text>
            <text class="item-value">{{ abilityData.english || 0 }} 分</text>
          </view>
          <view class="info-item">
            <text class="item-label">数学基础:</text>
            <text class="item-value">{{ abilityData.math || 0 }} 分</text>
          </view>
        </view>
      </view>
      
      <!-- 提示信息 -->
      <view class="tip-box">
        <text class="tip-icon">💡</text>
        <text class="tip-text">
          我们将根据您的信息,为您推荐最适合的院校和专业
        </text>
      </view>
    </view>
    
    <!-- 按钮组 -->
    <view class="confirm-form__footer">
      <button 
        class="prev-button"
        @click="handlePrev"
      >
        上一步
      </button>
      <button 
        class="submit-button"
        @click="handleSubmit"
      >
        提交生成择校报告
      </button>
    </view>
  </view>
</template>

<script setup>
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
  }
})

const emit = defineEmits(['prev', 'submit'])

// 上一步
const handlePrev = () => {
  emit('prev')
}

// 提交
const handleSubmit = () => {
  emit('submit')
}
</script>

<style lang="scss" scoped>
.confirm-form {
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
    padding: 0 32rpx 32rpx;
  }
  
  &__footer {
    padding: 40rpx 32rpx;
    padding-bottom: 40rpx;
    display: flex;
    gap: 24rpx;
  }
}

.info-card {
  background-color: #FFFFFF;
  border-radius: 16rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  margin-bottom: 32rpx;
}

.info-section {
  margin-bottom: 32rpx;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.title-icon {
  font-size: 32rpx;
}

.title-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #333333;
}

.info-item {
  display: flex;
  margin-bottom: 16rpx;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.item-label {
  font-size: 26rpx;
  color: #999999;
  width: 160rpx;
  flex-shrink: 0;
}

.item-value {
  flex: 1;
  font-size: 26rpx;
  color: #333333;
  line-height: 1.6;
}

.divider {
  height: 2rpx;
  background-color: #F5F5F5;
  margin: 32rpx 0;
}

.tip-box {
  background: linear-gradient(135deg, #FFF7E6 0%, #FFF9ED 100%);
  border-radius: 12rpx;
  padding: 24rpx;
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
}

.tip-icon {
  font-size: 32rpx;
  flex-shrink: 0;
  margin-top: 4rpx;
}

.tip-text {
  flex: 1;
  font-size: 26rpx;
  color: #D48806;
  line-height: 1.6;
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

.submit-button {
  flex: 2;
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
