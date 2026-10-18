<template>
  <view class="insights" data-test="learning-insights">
    <BaseCard padding="large">
      <view class="insight-heading"
        ><BaseIcon name="target" /><text>{{ t('tutor.insights.goal') }}</text></view
      >
      <text class="goal-copy">{{
        all
          ? t('tutor.insights.allGoals', { count: learning.state.conversations.length })
          : data.profile.goal?.value || learning.active?.goal || t('tutor.insights.noGoal')
      }}</text>
      <view v-for="field in ['foundation', 'minutes', 'preference']" :key="field" class="profile-line">
        <template v-if="data.profile[field]"
          ><text>{{ t(`tutor.profile.${field}`) }}</text
          ><text>{{ data.profile[field].value }}</text></template
        >
      </view>
      <text v-if="data.deadline" class="muted"
        >{{ data.deadline }} · {{ t('tutor.insights.days', { count: data.daysLeft }) }}</text
      >
      <view v-if="data.progress.total" class="progress-line"
        ><text>{{ t('tutor.insights.modules') }} {{ data.progress.completed }} / {{ data.progress.total }}</text
        ><view
          class="insight-track"
          role="progressbar"
          :aria-label="t('tutor.insights.modules')"
          :aria-valuenow="data.progress.completed"
          :aria-valuemax="data.progress.total"
          aria-valuemin="0"
          ><view :style="{ width: `${(data.progress.completed / data.progress.total) * 100}%` }" /></view
      ></view>
      <text v-else class="muted">{{ t('tutor.insights.unknown') }}</text>
    </BaseCard>
    <BaseCard padding="large">
      <view class="insight-heading"
        ><BaseIcon name="chart" /><text>{{ t('tutor.insights.weakness') }}</text></view
      >
      <text class="muted">{{ t('tutor.insights.basis') }}</text>
      <text v-if="!data.units.length" class="muted">{{ t('tutor.archive.empty') }}</text>
      <view v-for="unit in data.units.slice(0, 12)" :key="unit.scope" class="insight-unit">
        <view class="profile-line"
          ><text>{{ unit.label }}</text
          ><text>{{ unit.independent }} / {{ unit.reliable }}</text></view
        >
        <view class="insight-track" role="img" :aria-label="`${unit.label}: ${unit.independent}/${unit.reliable}`"
          ><view :style="{ width: `${unit.reliable ? (unit.independent / unit.reliable) * 100 : 0}%` }"
        /></view>
        <text v-if="unit.pending" class="muted">{{ t('tutor.insights.pending', { count: unit.pending }) }}</text>
      </view>
    </BaseCard>
    <BaseCard v-if="!compact" padding="large">
      <view class="insight-heading"
        ><BaseIcon name="calendar" /><text>{{ t('tutor.insights.calendar') }}</text></view
      >
      <text class="muted">{{ data.timezone }}</text>
      <BaseEmpty v-if="!data.days.length" :title="t('tutor.archive.empty')" mascot-size="small" />
      <view v-for="day in data.days.slice(0, 31)" :key="day.day" class="calendar-day">
        <text>{{ day.day }}</text
        ><view class="calendar-counts"
          ><text>{{ t('tutor.insights.answers', { count: day.answers }) }}</text
          ><text v-if="day.reviews">{{ t('tutor.insights.reviewed', { count: day.reviews }) }}</text
          ><text v-if="day.due">{{ t('tutor.insights.due', { count: day.due }) }}</text
          ><text v-if="day.pending">{{ t('tutor.insights.pending', { count: day.pending }) }}</text></view
        >
      </view>
    </BaseCard>
  </view>
</template>
<script setup>
import '@/i18n/tutor.js';
import { computed, onMounted, onUnmounted } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import { t } from '@/i18n/index.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningInsights } from '@/services/learning/learning-insights.js';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
const props = defineProps({ compact: Boolean, all: Boolean });
const learning = useConversationLearningStore(),
  calendar = learning.observeCalendar();
const data = computed(() =>
  learningInsights(learning.state, learning.calendarTime, props.all ? null : learning.selectedConversationId)
);
onMounted(() => calendar.show());
onShow(() => calendar.show());
onHide(() => calendar.hide());
onUnmounted(() => calendar.dispose());
</script>
<style scoped>
.insights {
  display: grid;
  gap: var(--s-4);
}
.insight-heading {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  font-size: var(--size-title-3);
  margin-bottom: var(--s-4);
}
.goal-copy {
  display: block;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.muted {
  display: block;
  color: var(--ink-3);
  font-size: var(--size-caption);
  line-height: 1.7;
  margin-top: var(--s-2);
}
.profile-line {
  display: flex;
  justify-content: space-between;
  gap: var(--s-4);
  padding-block: var(--s-2);
  overflow-wrap: anywhere;
}
.insight-unit,
.progress-line {
  margin-top: var(--s-4);
}
.insight-track {
  height: 8px;
  background: var(--line);
  border-radius: var(--r-pill);
  overflow: hidden;
}
.insight-track > view {
  height: 100%;
  background: var(--brand);
  border-radius: inherit;
}
.calendar-day {
  display: flex;
  justify-content: space-between;
  gap: var(--s-4);
  padding-block: var(--s-3);
  border-bottom: 1px solid var(--line);
}
.calendar-counts {
  display: flex;
  gap: var(--s-3);
  flex-wrap: wrap;
  justify-content: flex-end;
  font-size: var(--size-caption);
}
</style>
