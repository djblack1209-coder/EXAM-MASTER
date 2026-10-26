<template>
  <view class="chat-hero">
    <BaseButton
      class="chat-hero-status"
      variant="quiet"
      :label="action ? `${status} · ${action}` : status"
      @tap="$emit('connect')"
      >{{ status }}<text v-if="action" class="chat-hero-action"> · {{ action }}</text></BaseButton
    >
  </view>
</template>
<script setup>
import BaseButton from '@/components/base/base-button/base-button.vue';
defineProps({ status: { type: String, default: '未连接' }, action: { type: String, default: '' } });
defineEmits(['connect']);
</script>
<style scoped>
.chat-hero {
  display: flex;
  justify-content: center;
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
