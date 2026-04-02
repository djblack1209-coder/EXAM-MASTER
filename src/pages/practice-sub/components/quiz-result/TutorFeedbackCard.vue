<template>
  <view v-if="feedback" class="tutor-feedback-card">
    <BaseCard padding="medium">
      <template #header>
        <view class="tutor-header">
          <view class="tutor-avatar">
            <BaseIcon name="robot" :size="32" color="var(--em-brand)" />
          </view>
          <text class="tutor-title">AI Tutor 导师点评</text>
        </view>
      </template>
      <view class="tutor-body">
        <text class="tutor-text">{{ displayText }}</text>
        <view v-if="isTyping" class="typing-cursor" />
      </view>
    </BaseCard>
  </view>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const props = defineProps({
  feedback: { type: String, default: '' }
});

const displayText = ref('');
const isTyping = ref(false);
let typingTimer = null;

const startTyping = (text) => {
  if (!text) return;
  displayText.value = '';
  isTyping.value = true;
  let index = 0;

  clearInterval(typingTimer);
  typingTimer = setInterval(() => {
    if (index < text.length) {
      displayText.value += text[index];
      index++;
    } else {
      isTyping.value = false;
      clearInterval(typingTimer);
    }
  }, 30); // 30ms per char
};

watch(
  () => props.feedback,
  (newVal) => {
    if (newVal) {
      startTyping(newVal);
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (typingTimer) clearInterval(typingTimer);
});
</script>

<style lang="scss" scoped>
.tutor-feedback-card {
  margin: 24rpx 0;

  .tutor-header {
    display: flex;
    align-items: center;
    /* gap: 12rpx; */
    padding-bottom: 16rpx;
    border-bottom: 1rpx solid var(--border-color);
  }
  .tutor-header > view + view {
    margin-left: 12rpx;
  }

  .tutor-avatar {
    width: 48rpx;
    height: 48rpx;
    background: var(--primary-light);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tutor-title {
    font-size: 28rpx;
    font-weight: bold;
    color: var(--em-brand);
  }

  .tutor-body {
    margin-top: 16rpx;
    font-size: 28rpx;
    line-height: 1.6;
    color: var(--text-primary);
    position: relative;
  }

  .typing-cursor {
    display: inline-block;
    width: 4rpx;
    height: 28rpx;
    background: var(--em-brand);
    margin-left: 4rpx;
    vertical-align: middle;
    animation: blink 1s step-end infinite;
  }
}

@keyframes blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
</style>
