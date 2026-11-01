<template>
  <view class="chat-hero">
    <template v-if="connected">
      <text class="chat-hero-title" role="heading" aria-level="2">{{ t('learning.kht') }}</text>
      <view class="chat-hero-examples" :aria-label="t('learning.chatExamples')">
        <BaseButton v-for="example in examples" :key="example" variant="quiet" @tap="$emit('draft', example)">
          {{ example }}
        </BaseButton>
      </view>
    </template>
    <BaseButton
      v-else
      class="chat-hero-status"
      variant="quiet"
      :label="action ? `${status} · ${action}` : status"
      @tap="$emit('connect')"
      >{{ status }}<text v-if="action" class="chat-hero-action"> · {{ action }}</text></BaseButton
    >
  </view>
</template>
<script setup>
import { computed } from 'vue';
import '@/pages/learning/messages.js';
import { t } from '@/i18n/index.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
defineProps({ connected: Boolean, status: { type: String, default: '未连接' }, action: { type: String, default: '' } });
defineEmits(['connect', 'draft']);
// Existing approved learning copy; no Muse private examples or new copy.
const examples = computed(() => [t('learning.topic.englishEmail'), t('learning.kho')]);
</script>
<style scoped>
.chat-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: clamp(48px, 15vh, 104px) 28px 0;
}
.chat-hero-title {
  color: var(--ink);
  font-size: 24px;
  line-height: 29px;
  font-weight: 600;
  margin-bottom: 20px;
}
.chat-hero-examples {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 460px;
}
.chat-hero-examples .base-button {
  min-height: 44px;
  border-radius: 10px;
  background: var(--paper-sunk);
  padding: 0 14px;
  font-size: 13px;
  justify-content: flex-start;
  color: var(--ink-2);
}
.chat-hero .chat-hero-status {
  min-height: 44px;
  max-width: 100%;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--muse-raised);
  color: var(--ink-2);
  font-size: 12px;
  line-height: 20px;
}
.chat-hero-action {
  color: var(--violet-ink);
}
</style>
