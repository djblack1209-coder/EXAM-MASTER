<template>
  <view class="education-form ds-flex ds-flex-col" :class="{ 'dark-mode': isDark }">
    <!-- 标题 -->
    <view class="education-form__title ds-text-display ds-font-semibold">Step 1: 教育背景</view>

    <!-- 表单内容 -->
    <view class="education-form__content">
      <!-- 毕业院校 -->
      <view class="form-item">
        <view class="form-item__label ds-text-sm ds-font-medium">毕业院校</view>
        <view class="form-item__input">
          <input v-model="formData.school" class="input-field ds-text-sm" type="text" placeholder="输入学校名称 (支持模糊搜索)"
            placeholder-class="input-placeholder" />
        </view>
      </view>

      <!-- 所学专业 -->
      <view class="form-item">
        <view class="form-item__label ds-text-sm ds-font-medium">所学专业</view>
        <view class="form-item__select ds-flex ds-flex-between ds-touchable" @click="showMajorPicker">
          <text :class="formData.major ? 'select-text ds-text-sm' : 'select-placeholder ds-text-sm'">
            {{ formData.major || '选择专业类别' }}
          </text>
          <text class="select-arrow">›</text>
        </view>
      </view>

      <!-- 学历层次 -->
      <view class="form-item">
        <view class="form-item__label ds-text-sm ds-font-medium">学历层次</view>
        <view class="form-item__radio-group ds-flex ds-gap-lg">
          <view v-for="degree in degreeOptions" :key="degree.value" class="radio-item ds-flex ds-gap-xs ds-touchable"
            @click="selectDegree(degree.value)">
            <view class="radio-button" :class="{
              'radio-button--checked': formData.degree === degree.value
            }">
              <view v-if="formData.degree === degree.value" class="radio-button__inner"></view>
            </view>
            <text class="radio-label ds-text-sm">{{ degree.label }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 下一步按钮 -->
    <view class="education-form__footer">
      <button class="next-button ds-text-lg ds-font-semibold ds-touchable" :class="{
        'next-button--disabled': !isFormValid
      }" :disabled="!isFormValid" @click="handleNext">
        下一步
      </button>
    </view>

    <!-- 专业选择器 (模拟) -->
    <picker v-if="showPicker" mode="selector" :range="majorOptions" @change="onMajorChange"
      @cancel="showPicker = false">
      <view></view>
    </picker>
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
  return formData.value.school.trim() !== '' && formData.value.major !== '' && formData.value.degree !== ''
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
  margin-bottom: 40rpx;

  &__label {
    color: var(--ds-text-primary);
    margin-bottom: 16rpx;
  }

  &__input {
    background-color: var(--ds-bg-secondary);
    border-radius: 16rpx;
    border: 2rpx solid var(--ds-border-color);
    overflow: visible;
    display: flex;
    align-items: center;
    height: 88rpx;
    transition: all 150ms ease-out;

    &:focus-within {
      border-color: var(--ds-primary);
    }
  }

  &__select {
    background-color: var(--ds-bg-secondary);
    border-radius: 16rpx;
    border: 2rpx solid var(--ds-border-color);
    padding: 24rpx 32rpx;
    align-items: center;
    transition: all 150ms ease-out;

    &:active {
      transform: scale(0.98);
    }
  }

  &__radio-group {
    /* ds-flex ds-gap-lg 已应用 */
  }
}

.input-field {
  width: 100%;
  height: 88rpx;
  padding: 0 32rpx;
  line-height: 88rpx;
  box-sizing: border-box;
  color: var(--ds-text-primary);
  background-color: transparent;
}

.input-placeholder {
  color: var(--ds-text-tertiary);
}

.select-text {
  color: var(--ds-text-primary);
}

.select-placeholder {
  color: var(--ds-text-tertiary);
}

.select-arrow {
  font-size: 40rpx;
  color: var(--ds-text-tertiary);
  transform: rotate(90deg);
  font-weight: 300;
}

.radio-item {
  align-items: center;
}

.radio-button {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  border: 4rpx solid var(--ds-border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 150ms ease-out;

  &--checked {
    border-color: var(--ds-success);
  }

  &__inner {
    width: 20rpx;
    height: 20rpx;
    border-radius: 50%;
    background-color: var(--ds-success);
  }
}

.radio-label {
  color: var(--ds-text-primary);
}

.next-button {
  width: 100%;
  height: 96rpx;
  background: var(--ds-success);
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #FFFFFF;
  border: none;
  transition: all 150ms ease-out;

  &::after {
    border: none;
  }

  &:active:not(.next-button--disabled) {
    background: var(--ds-success-dark);
    transform: scale(0.98);
  }

  &--disabled {
    background: var(--ds-border-color);
    color: var(--ds-text-tertiary);
  }
}

/* 深色模式 */
.dark-mode {
  .next-button {
    color: #1c1c1e;

    &:active:not(.next-button--disabled) {
      color: #1c1c1e;
    }

    &--disabled {
      color: var(--ds-text-tertiary);
    }
  }
}
</style>
