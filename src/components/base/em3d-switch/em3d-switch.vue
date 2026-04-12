<template>
  <!-- 3D 立体开关组件 — uiverse.io 风格 -->
  <view
    class="em3d-switch"
    :class="{
      'em3d-switch--on': modelValue,
      'em3d-switch--disabled': disabled
    }"
    @tap="handleTap"
  >
    <view class="em3d-switch__track">
      <view class="em3d-switch__thumb" />
    </view>
  </view>
</template>

<script setup>
/**
 * Em3dSwitch — 3D 立体拨动开关
 *
 * 用法：<Em3dSwitch v-model="isEnabled" />
 *
 * @module components/base/em3d-switch
 */

const props = defineProps({
  /** 绑定值 */
  modelValue: { type: Boolean, default: false },
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
.em3d-switch {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.em3d-switch__track {
  position: relative;
  width: 104rpx;
  height: 56rpx;
  border-radius: 28rpx;
  background-color: #e5e5e5;
  border: 2rpx solid #d0d0d0;
  box-shadow: inset 0 2rpx 4rpx rgba(0, 0, 0, 0.1);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.em3d-switch__thumb {
  position: absolute;
  top: 2rpx;
  left: 2rpx;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background-color: #ffffff;
  box-shadow:
    0 2rpx 4rpx rgba(0, 0, 0, 0.15),
    0 4rpx 0 rgba(0, 0, 0, 0.06);
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

// 开启状态
.em3d-switch--on {
  .em3d-switch__track {
    background-color: var(--em3d-primary, #58cc02);
    border-color: var(--em3d-primary-shadow, #46a302);
    box-shadow: inset 0 2rpx 4rpx rgba(0, 0, 0, 0.08);
  }
  .em3d-switch__thumb {
    left: 50rpx;
  }
}

// 禁用状态
.em3d-switch--disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
