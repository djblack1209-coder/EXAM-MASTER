<template>
  <view class="education-form">
    <!-- 标题 -->
    <view class="education-form__title">
      Step 1: 教育背景
    </view>
    
    <!-- 表单内容 -->
    <view class="education-form__content">
      <!-- 毕业院校 -->
      <view class="form-item">
        <view class="form-item__label">
          毕业院校
        </view>
        <view class="form-item__input">
          <input 
            v-model="formData.school"
            class="input-field"
            type="text"
            placeholder="输入学校名称 (支持模糊搜索)"
            placeholder-class="input-placeholder"
          />
        </view>
      </view>
      
      <!-- 所学专业 -->
      <view class="form-item">
        <view class="form-item__label">
          所学专业
        </view>
        <view 
          class="form-item__select"
          @click="showMajorPicker"
        >
          <text 
            :class="formData.major ? 'select-text' : 'select-placeholder'"
          >
            {{ formData.major || '选择专业类别' }}
          </text>
          <text class="select-arrow">›</text>
        </view>
      </view>
      
      <!-- 学历层次 -->
      <view class="form-item">
        <view class="form-item__label">
          学历层次
        </view>
        <view class="form-item__radio-group">
          <view 
            v-for="degree in degreeOptions" 
            :key="degree.value"
            class="radio-item"
            @click="selectDegree(degree.value)"
          >
            <view 
              class="radio-button"
              :class="{
                'radio-button--checked': formData.degree === degree.value
              }"
            >
              <view 
                v-if="formData.degree === degree.value"
                class="radio-button__inner"
              ></view>
            </view>
            <text class="radio-label">{{ degree.label }}</text>
          </view>
        </view>
      </view>
    </view>
    
    <!-- 下一步按钮 -->
    <view class="education-form__footer">
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
    
    <!-- 专业选择器 (模拟) -->
    <picker 
      v-if="showPicker"
      mode="selector"
      :range="majorOptions"
      @change="onMajorChange"
      @cancel="showPicker = false"
    >
      <view></view>
    </picker>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue'

const emit = defineEmits(['next'])

// 表单数据
const formData = ref({
  school: '',
  major: '',
  degree: '本科'
})

// 学历选项
const degreeOptions = [
  { label: '本科', value: '本科' },
  { label: '专科', value: '专科' }
]

// 专业选项 (示例数据)
const majorOptions = [
  '计算机科学与技术',
  '软件工程',
  '信息管理与信息系统',
  '电子信息工程',
  '通信工程',
  '自动化',
  '机械工程',
  '土木工程',
  '建筑学',
  '工商管理',
  '会计学',
  '金融学',
  '国际经济与贸易',
  '市场营销',
  '人力资源管理',
  '法学',
  '汉语言文学',
  '英语',
  '新闻学',
  '临床医学',
  '护理学',
  '药学',
  '其他'
]

const showPicker = ref(false)

// 表单验证
const isFormValid = computed(() => {
  return formData.value.school.trim() !== '' && 
         formData.value.major !== '' && 
         formData.value.degree !== ''
})

// 选择学历
const selectDegree = (value) => {
  formData.value.degree = value
}

// 显示专业选择器
const showMajorPicker = () => {
  uni.showActionSheet({
    itemList: majorOptions,
    success: (res) => {
      formData.value.major = majorOptions[res.tapIndex]
    }
  })
}

// 专业选择变化
const onMajorChange = (e) => {
  formData.value.major = majorOptions[e.detail.value]
  showPicker.value = false
}

// 下一步
const handleNext = () => {
  if (!isFormValid.value) {
    uni.showToast({
      title: '请完整填写表单',
      icon: 'none'
    })
    return
  }
  
  emit('next', formData.value)
}

</script>

<style lang="scss" scoped>
.education-form {
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
  }
}

.form-item {
  margin-bottom: 40rpx;
  
  &__label {
    font-size: 28rpx;
    color: #333333;
    margin-bottom: 16rpx;
    font-weight: 500;
  }
  
  &__input {
    background-color: #F5F7FA;
    border-radius: 16rpx;
    border: 2rpx solid #E8E8E8;
    overflow: visible;
    display: flex;
    align-items: center;
    height: 88rpx;
  }
  
  &__select {
    background-color: #F5F7FA;
    border-radius: 16rpx;
    border: 2rpx solid #E8E8E8;
    padding: 24rpx 32rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  &__radio-group {
    display: flex;
    gap: 32rpx;
  }
}

.input-field {
  width: 100%;
  height: 88rpx;
  padding: 0 32rpx;
  line-height: 88rpx;
  box-sizing: border-box;
  font-size: 28rpx;
  color: #333333;
  background-color: transparent;
}

.input-placeholder {
  color: #CCCCCC;
  font-size: 28rpx;
}

.select-text {
  font-size: 28rpx;
  color: #333333;
}

.select-placeholder {
  font-size: 28rpx;
  color: #CCCCCC;
}

.select-arrow {
  font-size: 40rpx;
  color: #CCCCCC;
  transform: rotate(90deg);
  font-weight: 300;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.radio-button {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  border: 4rpx solid #CCCCCC;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  
  &--checked {
    border-color: #07C160;
  }
  
  &__inner {
    width: 20rpx;
    height: 20rpx;
    border-radius: 50%;
    background-color: #07C160;
  }
}

.radio-label {
  font-size: 28rpx;
  color: #333333;
}

.next-button {
  width: 100%;
  height: 96rpx;
  background: #07C160;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  font-size: 34rpx;
  font-weight: 600;
  border: none;
  transition: all 0.3s ease;
  
  &::after {
    border: none;
  }
  
  &:active:not(.next-button--disabled) {
    background: #05A850;
    transform: scale(0.98);
  }
  
  &--disabled {
    background: #E5E5E5;
    color: #CCCCCC;
  }
}
</style>
