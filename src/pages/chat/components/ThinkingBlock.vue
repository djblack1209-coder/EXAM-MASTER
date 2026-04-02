<!-- ThinkingBlock：AI 思考过程展示（可折叠） -->
<template>
  <view class="thinking-block" :class="{ expanded: isExpanded, done: !isThinking }">
    <view class="thinking-header" @tap="toggleExpand">
      <view class="thinking-indicator">
        <view v-if="isThinking" class="thinking-dots">
          <view v-for="i in 3" :key="i" class="dot" />
        </view>
        <BaseIcon v-else name="bulb" :size="28" class="thinking-icon" />
      </view>
      <text class="thinking-label">
        {{ isThinking ? '思考中...' : `思考完成 · ${thinkingDuration}s` }}
      </text>
      <text class="expand-arrow">
        <BaseIcon :name="isExpanded ? 'chevron-up' : 'chevron-down'" :size="24" />
      </text>
    </view>
    <view v-if="isExpanded && content" class="thinking-content">
      <text class="thinking-text">{{ content }}</text>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const props = defineProps({
  content: { type: String, default: '' },
  isThinking: { type: Boolean, default: true },
  thinkingDuration: { type: Number, default: 0 }
});

const isExpanded = ref(false);

function toggleExpand() {
  if (props.content) {
    isExpanded.value = !isExpanded.value;
  }
}
</script>

<style lang="scss" scoped>
.thinking-block {
  margin: 12rpx 0;
  border-radius: 16rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.03));
  overflow: hidden;
  border: 1rpx solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.thinking-header {
  display: flex;
  align-items: center;
  padding: 16rpx 20rpx;
}

.thinking-indicator {
  width: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12rpx;
}

.thinking-dots {
  display: flex;
}

.thinking-dots .dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  background: var(--primary, #0f5f34);
  animation: thinking-pulse 1.4s ease-in-out infinite;
  margin-right: 6rpx;
}

.thinking-dots .dot:last-child {
  margin-right: 0;
}

.thinking-dots .dot:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-dots .dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes thinking-pulse {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.thinking-icon {
  font-size: 28rpx;
}

.thinking-label {
  flex: 1;
  font-size: 24rpx;
  color: var(--text-sub, var(--text-secondary));
  font-weight: 500;
}

.expand-arrow {
  font-size: 20rpx;
  color: var(--text-sub, var(--text-secondary));
  transition: transform 0.2s;
}

.thinking-content {
  padding: 0 20rpx 16rpx;
  border-top: 1rpx solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.thinking-text {
  font-size: 24rpx;
  color: var(--text-sub, var(--text-secondary));
  line-height: 1.6;
}

.done {
  opacity: 0.8;
}
</style>
