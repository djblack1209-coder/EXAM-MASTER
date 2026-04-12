<template>
  <!-- 3D 立体复选框组件 — uiverse.io 风格 -->
  <view
    class="em3d-checkbox"
    :class="{
      'em3d-checkbox--checked': modelValue,
      'em3d-checkbox--disabled': disabled
    }"
    @tap="handleTap"
  >
    <view class="em3d-checkbox__box">
      <!-- 勾号 SVG -->
      <view v-if="modelValue" class="em3d-checkbox__check">
        <text class="em3d-checkbox__icon">✓</text>
      </view>
    </view>
    <text v-if="label" class="em3d-checkbox__label">{{ label }}</text>
  </view>
</template>

<script setup>
/**
 * Em3dCheckbox — 3D 立体复选框（带弹跳动画）
 *
 * 用法：<Em3dCheckbox v-model="agreed" label="我已阅读协议" />
 *
 * @module components/base/em3d-checkbox
 */

const props = defineProps({
  /** 绑定值 */
  modelValue: { type: Boolean, default: false },
  /** 标签文字 */
  label: { type: String, default: '' },
  /** 是否禁用 */
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'change']);

function handleTap() {
  if (props.disabled) return;
  const newVal = !props.modelValue;
  emit('update:modelValue', newVal);
  emit('change', newVal);
}
</script>

<style lang="scss" scoped>
.em3d-checkbox {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.em3d-checkbox__box {
  width: 44rpx;
  height: 44rpx;
  border-radius: 10rpx;
  border: 2rpx solid var(--em3d-border, #e5e5e5);
  background-color: var(--em3d-card-bg, #ffffff);
  box-shadow: 0 3rpx 0 var(--em3d-border-shadow, #d0d0d0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  position: relative;
  flex-shrink: 0;
}

.em3d-checkbox__check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  animation: em3d-check-bounce 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.em3d-checkbox__icon {
  font-size: 28rpx;
  font-weight: 900;
  color: var(--em3d-text-inv, #ffffff);
  line-height: 1;
}

.em3d-checkbox__label {
  margin-left: 16rpx;
  font-size: 28rpx;
  color: var(--em3d-text-1, #3c3c3c);
  font-weight: 500;
  user-select: none;
}

// 选中状态
.em3d-checkbox--checked {
  .em3d-checkbox__box {
    background-color: var(--em3d-primary, #58cc02);
    border-color: var(--em3d-primary-shadow, #46a302);
    box-shadow: 0 3rpx 0 var(--em3d-primary-shadow, #46a302);
  }
}

// 禁用状态
.em3d-checkbox--disabled {
  opacity: 0.5;
  pointer-events: none;
}

@keyframes em3d-check-bounce {
  0% {
    transform: scale(0);
  }
  60% {
    transform: scale(1.3);
  }
  100% {
    transform: scale(1);
  }
}
</style>
