<template>
  <view v-if="hasError" class="error-boundary">
    <view class="error-boundary__icon"><BaseIcon name="warning" :size="48" /></view>
    <text class="error-boundary__title">页面遇到问题</text>
    <text class="error-boundary__message">{{ errorMessage }}</text>
    <button class="error-boundary__btn" @tap="recover">重新加载</button>
  </view>
  <slot v-else></slot>
</template>

<script setup>
/**
 * ErrorBoundary 错误边界组件
 *
 * 捕获子组件树的渲染错误，展示 fallback UI 而非白屏。
 * 用户可点击"重新加载"重置组件状态。
 *
 * 用法：
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 *
 * @version 1.0.0
 */
import { ref, onErrorCaptured } from 'vue';
import { logger } from '@/utils/logger.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const hasError = ref(false);
const errorMessage = ref('');

onErrorCaptured((err, instance, info) => {
  hasError.value = true;
  errorMessage.value = err?.message || '未知错误';
  logger.error('[ErrorBoundary] 捕获渲染错误:', err?.message, '\n组件:', info);
  // 返回 false 阻止错误继续向上传播
  return false;
});

function recover() {
  hasError.value = false;
  errorMessage.value = '';
}
</script>

<style scoped>
.error-boundary {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400rpx;
  padding: 60rpx 40rpx;
}

.error-boundary__icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.error-boundary__title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary, #333);
  margin-bottom: 12rpx;
}

.error-boundary__message {
  font-size: 24rpx;
  color: var(--text-secondary, #999);
  margin-bottom: 40rpx;
  max-width: 500rpx;
  text-align: center;
  word-break: break-all;
}

.error-boundary__btn {
  background: var(--color-primary, #4f7cf7);
  color: #fff;
  border: none;
  border-radius: 16rpx;
  padding: 16rpx 48rpx;
  font-size: 28rpx;
}

.error-boundary__btn:active {
  opacity: 0.85;
  transform: scale(0.97);
}
</style>
