<template>
  <view v-if="feedback" class="tutor-feedback-card">
    <BaseCard padding="medium">
      <template #header>
        <view class="tutor-header yozi-icon-row">
          <view class="tutor-avatar">
            <BaseIcon name="robot" color="var(--em-brand)" />
          </view>
          <text class="tutor-title">{{ t('quiz.copy203') }}</text>
        </view>
      </template>
      <view class="tutor-body">
        <text class="tutor-text">{{ uiText(displayText) }}</text>
        <view v-if="isTyping" class="typing-cursor" />
      </view>
    </BaseCard>
  </view>
</template>

<script setup>
const uiText = (value) => translateRegisteredText('quiz', value);
import '@/pages/practice-sub/messages.js';
import { t, translateRegisteredText } from '@/i18n/index.js';
import '@/styles/yozi-pages.scss';

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
