<template>
  <view class="base-bubble" :class="`base-bubble--${author}`" role="group" :aria-label="t(`ui.author.${author}`)">
    <view v-if="author === 'assistant'" class="base-bubble__avatar" aria-hidden="true"
      ><YoziMascot size="small" play="none" /></view
    ><view class="base-bubble__content"><slot></slot></view>
  </view>
</template>
<script setup>
import { t } from '@/i18n/index.js';
import YoziMascot from '../yozi-mascot/yozi-mascot.vue';
defineProps({
  author: { type: String, default: 'assistant', validator: (value) => ['user', 'assistant'].includes(value) }
});
</script>
<style scoped>
.base-bubble {
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
  color: var(--ink);
  font: var(--weight-regular) var(--size-body)/var(--leading-body) var(--font-ui);
}
.base-bubble__content {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.base-bubble__avatar {
  display: flex;
  flex: none;
  width: var(--avatar-size);
  height: var(--avatar-size);
  overflow: hidden;
  background: var(--violet-soft);
  border-radius: var(--r-pill);
}
.base-bubble--user {
  align-self: flex-end;
  max-width: var(--bubble-width);
  padding: var(--s-3) var(--s-4);
  border-radius: var(--bubble-radius) var(--bubble-radius) var(--bubble-tail) var(--bubble-radius);
  background: var(--violet-soft);
}
</style>
