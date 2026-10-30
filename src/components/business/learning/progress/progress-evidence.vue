<template>
  <view class="progress-evidence" role="list" aria-label="学习记录">
    <view v-for="event in events" :key="event.id" class="progress-event" role="listitem" :data-event-id="event.id">
      <view class="event-meta"
        ><text>{{ event.day }}</text
        ><text>{{ event.kind === 'writing-feedback' ? 'AI 评估' : '核对' }}</text></view
      >
      <text class="event-prompt">{{ event.prompt || event.goal }}</text>
      <text class="event-conclusion">{{ event.conclusion }}</text>
      <text class="event-source"
        >{{ event.model.source === 'byok' ? 'BYOK' : event.model.source === 'unknown' ? '待核对' : '核对'
        }}<template v-if="event.model.modelId"> · {{ event.model.modelId }}</template></text
      >
      <text class="event-id" selectable>{{ event.id }}</text>
      <BaseButton v-if="openable && event.recordId" variant="quiet" icon="arrow-right" @tap="emit('open', event)"
        >查看原答</BaseButton
      >
    </view>
    <text v-if="!events.length" class="event-meta" role="status">数据不足</text>
  </view>
</template>
<script setup>
import BaseButton from '@/components/base/base-button/base-button.vue';
defineProps({ events: { type: Array, default: () => [] }, openable: { type: Boolean, default: true } });
const emit = defineEmits(['open']);
</script>
<style scoped>
.progress-evidence {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.progress-event {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 14px 0;
  border-top: 1px solid var(--line);
  overflow-wrap: anywhere;
}
.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  color: var(--ink-3);
  font-size: 12px;
}
.event-prompt {
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
}
.event-conclusion {
  font-size: 13px;
  line-height: 1.7;
  font-weight: 600;
}
.event-source,
.event-id {
  color: var(--ink-3);
  font-size: 11px;
}
.progress-event .base-button {
  align-self: flex-start;
  font-size: 13px;
}
</style>
