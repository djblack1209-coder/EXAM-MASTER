<!-- MessageActions：消息操作浮层（复制/重试/删除） -->
<template>
  <view v-if="visible" class="message-actions" :class="{ 'actions-top': position === 'top' }">
    <view class="action-item" hover-class="hover-scale" @tap="handleCopy">
      <view class="action-icon"><BaseIcon name="note" :size="28" /></view>
      <text class="action-text">复制</text>
    </view>
    <view class="action-divider" />
    <view v-if="isAI" class="action-item" hover-class="hover-scale" @tap="handleRetry">
      <view class="action-icon"><BaseIcon name="refresh" :size="28" /></view>
      <text class="action-text">重试</text>
    </view>
    <view v-if="isAI" class="action-divider" />
    <view class="action-item" hover-class="hover-scale" @tap="handleDelete">
      <view class="action-icon"><BaseIcon name="delete" :size="28" /></view>
      <text class="action-text">删除</text>
    </view>
  </view>
</template>

<script setup>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const _props = defineProps({
  visible: { type: Boolean, default: false },
  isAI: { type: Boolean, default: false },
  position: { type: String, default: 'bottom' }
});

const emit = defineEmits(['copy', 'retry', 'delete', 'close']);

function handleCopy() {
  emit('copy');
  emit('close');
}

function handleRetry() {
  emit('retry');
  emit('close');
}

function handleDelete() {
  emit('delete');
  emit('close');
}
</script>

<style lang="scss" scoped>
.message-actions {
  display: flex;
  align-items: center;
  background: var(--bg-card, #fff);
  border-radius: 16rpx;
  padding: 8rpx 4rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.12);
  border: 1rpx solid var(--border-color, rgba(0, 0, 0, 0.08));
  position: absolute;
  bottom: -80rpx;
  right: 0;
  z-index: 100;
  animation: actions-pop 0.15s ease-out;
}

.actions-top {
  bottom: auto;
  top: -80rpx;
}

@keyframes actions-pop {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.action-item {
  display: flex;
  align-items: center;
  padding: 12rpx 20rpx;
  border-radius: 12rpx;
}

.action-icon {
  font-size: 28rpx;
  margin-right: 6rpx;
}

.action-text {
  font-size: 24rpx;
  color: var(--text-primary);
  font-weight: 500;
}

.action-divider {
  width: 1rpx;
  height: 28rpx;
  background: var(--border-color, rgba(0, 0, 0, 0.1));
}

.hover-scale {
  opacity: 0.7;
  transform: scale(0.96);
}
</style>
