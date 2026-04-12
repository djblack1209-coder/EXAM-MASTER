<template>
  <view v-if="visible" class="ai-loading-mask">
    <view class="loading-card apple-glass-card">
      <view class="apple-ai-loading">
        <view class="apple-ai-ring">
          <view class="apple-ai-pulse" />
        </view>
        <view class="apple-ai-icon">
          <BaseIcon name="sparkle" :size="64" />
        </view>
      </view>
      <view class="loading-content">
        <view class="loading-title">
          {{ fileName ? '正在研读资料...' : '智能准备中...' }}
        </view>
        <view class="apple-ai-progress">
          <view class="apple-ai-progress-bar">
            <view class="apple-ai-progress-fill" :style="{ width: progressPercent + '%' }" />
          </view>
          <view class="loading-step">
            {{ generatedCount === 0 ? '分析文档结构' : '已生成 ' + questionCount + ' 题 / 目标 ' + totalTarget }}
          </view>
        </view>
        <view class="inspiration-text"> "{{ currentSoup }}" </view>
        <view class="loading-actions">
          <button class="pause-btn apple-glass-pill" @tap="$emit('pause')">暂停生成</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  fileName: { type: String, default: '' },
  generatedCount: { type: Number, default: 0 },
  totalQuestionsLimit: { type: Number, default: 10 },
  batchQuestionCount: { type: Number, default: 5 },
  currentSoup: { type: String, default: '' }
});
defineEmits(['pause']);

const progressPercent = computed(() => {
  if (props.totalQuestionsLimit === 0) return 0;
  return (props.generatedCount / props.totalQuestionsLimit) * 100;
});

const questionCount = computed(() => {
  return props.generatedCount === 0 ? 0 : props.generatedCount * props.batchQuestionCount;
});

const totalTarget = computed(() => {
  return props.totalQuestionsLimit * props.batchQuestionCount;
});
</script>

<style lang="scss" scoped>
.ai-loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.loading-card {
  background-color: var(--em3d-card-bg);
  border: 2rpx solid var(--em3d-border);
  border-radius: 28px;
  padding: 40px;
  text-align: center;
  box-shadow:
    0 8rpx 0 var(--em3d-border-shadow),
    0 16rpx 40rpx rgba(0, 0, 0, 0.15);
  max-width: 400px;
  width: 90%;
  animation: fadeInUp 0.3s ease-out;
  position: relative;
  overflow: hidden;
}
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.apple-ai-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: 30px;
}
.apple-ai-ring {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0, 229, 255, 0.1) 0%, transparent 70%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.apple-ai-pulse {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid rgba(0, 229, 255, 0.6);
  animation: appleAIPulse 2s ease-out infinite;
  position: absolute;
}
@keyframes appleAIPulse {
  0% {
    transform: scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}
.apple-ai-icon {
  font-size: 128rpx;
  position: relative;
  z-index: 1;
  animation: appleAIFloat 3s ease-in-out infinite;
}
@keyframes appleAIFloat {
  0%,
  100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-10px) rotate(180deg);
  }
}
.loading-title {
  font-size: 48rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
}
.apple-ai-progress {
  width: 100%;
  margin: 16px 0 20px 0;
}
.apple-ai-progress-bar {
  width: 100%;
  height: 4px;
  background-color: var(--bg-secondary);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}
.apple-ai-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--brand-color, #00e5ff), var(--primary, #007aff));
  border-radius: 2px;
  transition: width 0.3s ease;
  animation: appleAIProgress 1s ease-in-out infinite alternate;
}
@keyframes appleAIProgress {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 100% 50%;
  }
}
.loading-step {
  font-size: 28rpx;
  color: var(--text-sub);
  margin: 0;
}
.inspiration-text {
  font-size: 32rpx;
  color: var(--text-sub);
  font-style: italic;
  margin: 0;
  max-width: 300px;
  background: var(--em3d-card-bg);
  padding: 12px 20px;
  border-radius: 999px;
  border: 2rpx solid var(--border);
  animation: fadeIn 0.5s ease;
}
@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.loading-actions {
  margin-top: 18px;
  display: flex;
  justify-content: center;
}
.pause-btn {
  background: var(--em3d-card-bg);
  border: 2rpx solid var(--border);
  color: var(--text-primary);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 24rpx;
}

.pause-btn::after {
  border: none;
}
</style>
