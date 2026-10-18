<template>
  <BaseCard class="proposal-card" padding="large" data-test="learning-proposal">
    <view class="proposal-heading"
      ><BaseIcon :name="plan ? 'calendar' : 'user'" /><text>{{
        t(plan ? 'tutor.proposal.plan' : 'tutor.proposal.profile')
      }}</text></view
    >
    <template v-if="plan"
      ><text class="proposal-reason">{{ proposal.data.reason }}</text
      ><view v-for="(task, index) in proposal.data.tasks" :key="index" class="proposal-row"
        ><BaseIcon name="circle" tone="ink-3" /><text>{{ task.title }}</text></view
      ></template
    >
    <view v-else class="proposal-row"
      ><text>{{ t(`tutor.profile.${proposal.data.field}`) }}</text
      ><text>{{ proposal.data.value }}</text></view
    >
    <view v-if="status === 'pending'" class="proposal-actions">
      <BaseButton variant="quiet" :disabled="busy" @tap="$emit('resolve', 'dismiss')">{{
        t('tutor.proposal.keep')
      }}</BaseButton>
      <BaseButton variant="primary" :disabled="busy" @tap="$emit('resolve', 'accept')">{{
        t(plan ? 'tutor.proposal.adopt' : 'tutor.proposal.confirm')
      }}</BaseButton>
    </view>
    <text v-else class="proposal-status" role="status">{{ t(`tutor.proposal.${status}`) }}</text>
  </BaseCard>
</template>
<script setup>
import '@/i18n/tutor.js';
import { computed } from 'vue';
import { t } from '@/i18n/index.js';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
const props = defineProps({
  proposal: { type: Object, required: true },
  status: { type: String, default: 'pending' },
  busy: Boolean
});
defineEmits(['resolve']);
const plan = computed(() => props.proposal.type === 'plan.set');
</script>
<style scoped>
.proposal-card {
  max-width: 680px;
  width: 100%;
}
.proposal-heading,
.proposal-row,
.proposal-actions {
  display: flex;
  align-items: center;
  gap: var(--s-3);
}
.proposal-heading {
  color: var(--violet-ink);
  font-size: var(--size-title-3);
  margin-bottom: var(--s-4);
}
.proposal-row {
  padding-block: var(--s-3);
  justify-content: space-between;
  overflow-wrap: anywhere;
}
.proposal-reason,
.proposal-status {
  display: block;
  color: var(--ink-3);
  line-height: var(--leading-body);
}
.proposal-actions {
  justify-content: flex-end;
  margin-top: var(--s-5);
  flex-wrap: wrap;
}
</style>
