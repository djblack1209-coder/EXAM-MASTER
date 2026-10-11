<template>
  <view v-if="memoryState" class="memory-stats-row apple-glass-pill">
    <BaseListRow :label="t('quiz.copy198')" :value="formatDate(memoryState.last_review)" :actionable="false" />
    <view class="stat-divider" />
    <BaseStat :label="t('quiz.copy199')" :value="Math.max(1, memoryState.scheduled_days)" :unit="t('quiz.days')" />
    <view class="stat-divider" />
    <BaseStat :label="t('quiz.copy201')" :value="Number(memoryState.stability?.toFixed(1) || 0) || 0" />
  </view>
</template>

<script setup>
import BaseListRow from '@/components/base/base-list-row/base-list-row.vue';
import BaseStat from '@/components/base/base-stat/base-stat.vue';
import '@/pages/practice-sub/messages.js';
import { t } from '@/i18n/index.js';
import '@/styles/yozi-pages.scss';

defineProps({
  memoryState: { type: Object, default: () => null }
});

const formatDate = (dateStr) => {
  if (!dateStr) return t('quiz.copy202');
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};
</script>
