<template>
  <!-- 3D 立体单选按钮组件 — uiverse.io 风格 -->
  <view
    class="em3d-radio"
    :class="{
      'em3d-radio--checked': isChecked,
      'em3d-radio--disabled': disabled
    }"
    @tap="handleTap"
  >
    <view class="em3d-radio__circle">
      <view v-if="isChecked" class="em3d-radio__dot" />
    </view>
    <text v-if="label" class="em3d-radio__label">{{ label }}</text>
  </view>
</template>

<script setup>
/**
 * Em3dRadio — 3D 立体单选按钮（带弹性缩放动画）
 *
 * 用法：
 *   <Em3dRadio v-model="selected" value="a" label="选项A" />
 *   <Em3dRadio v-model="selected" value="b" label="选项B" />
 *
 * @module components/base/em3d-radio
 */
import { computed } from 'vue';

const props = defineProps({
  /** 绑定值（组内共享） */
  modelValue: { type: [String, Number, Boolean], default: '' },
  /** 本选项的值 */
  value: { type: [String, Number, Boolean], required: true },
  /** 标签文字 */
  label: { type: String, default: '' },
  /** 是否禁用 */
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue', 'change']);

const isChecked = computed(() => props.modelValue === props.value);

function handleTap() {
  if (props.disabled || isChecked.value) return;
  emit('update:modelValue', props.value);
  emit('change', props.value);
}
</script>

<style lang="scss" scoped>
.em3d-radio {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.em3d-radio__circle {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  border: 2rpx solid var(--em3d-border, #e5e5e5);
  background-color: var(--em3d-card-bg, #ffffff);
  box-shadow: 0 3rpx 0 var(--em3d-border-shadow, #d0d0d0);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.em3d-radio__dot {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  background-color: var(--em3d-primary, #58cc02);
  animation: em3d-radio-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.em3d-radio__label {
  margin-left: 16rpx;
  font-size: 28rpx;
  color: var(--em3d-text-1, #3c3c3c);
  font-weight: 500;
  user-select: none;
}

// 选中状态
.em3d-radio--checked {
  .em3d-radio__circle {
    border-color: var(--em3d-primary, #58cc02);
    box-shadow: 0 3rpx 0 var(--em3d-primary-shadow, #46a302);
  }
}

// 禁用状态
.em3d-radio--disabled {
  opacity: 0.5;
  pointer-events: none;
}

@keyframes em3d-radio-pop {
  0% {
    transform: scale(0);
  }
  60% {
    transform: scale(1.4);
  }
  100% {
    transform: scale(1);
  }
}
</style>
