<template>
  <view class="coach-records">
    <view v-if="view === 'mistake'" class="record-subjects" role="group" aria-label="带练薄弱点学科筛选">
      <BaseButton
        v-for="option in subjects"
        :key="option.id"
        variant="quiet"
        :selected="subject === option.id"
        @tap="subject = option.id"
        >{{ option.label }} ({{ option.count }})</BaseButton
      >
    </view>
    <text v-if="view === 'mistake' && !filteredRecords.length" class="record-meta">{{
      subject === 'all' ? '暂无薄弱点记录' : '该学科暂无记录'
    }}</text>
    <BaseCard v-for="item in filteredRecords" :key="item.id" class="coach-record">
      <view class="record-heading"
        ><BaseIcon :name="view === 'plan' ? 'calendar' : 'file-text'" tone="ink-3" /><text>{{ item.goal }}</text
        ><BaseButton variant="quiet" icon="arrow-right" :label="t('muse.chat')" @tap="open(item.id)">{{
          t('muse.chat')
        }}</BaseButton></view
      >
      <text class="record-meta"
        >{{ item.subjects.join('、') }} · {{ view === 'mistake' ? '薄弱点 · AI 评估' : '学习记录' }}</text
      >
      <view v-if="item.board" class="record-metrics"
        ><BaseStat label="本周学习" :value="item.board.weekDays" unit="天" /><BaseStat
          label="完成写作"
          :value="item.board.essays"
          unit="篇" /><BaseStat label="学习中" :value="item.board.learning"
      /></view>
      <template v-if="view === 'plan'">
        <text v-if="item.coach.profile" class="record-meta"
          >{{
            item.coach.profile.exam === 'cs408'
              ? '计算机专业课'
              : item.coach.profile.exam === 'english2'
                ? '英语二'
                : item.coach.profile.exam === 'english1'
                  ? '英语一'
                  : '通用应用文'
          }}
          · {{ item.coach.profile.minutes ? `${item.coach.profile.minutes} 分钟` : '每日时长未设置' }}</text
        >
        <view v-for="day in item.coach.days" :key="day.day" class="record-day"
          ><text>{{ day.day }}</text
          ><text>{{ day.completed ? '已完成' : '待继续' }}</text></view
        >
      </template>
      <template v-else-if="view === 'mistake'"
        ><text v-for="weakness in item.board?.weaknesses || []" :key="weakness" class="record-line"
          >{{ item.subjects.join('、') }} · {{ weakness }}</text
        ></template
      >
      <template v-else
        ><view v-for="day in item.coach.days.slice(-5).reverse()" :key="day.day" class="record-day"
          ><text>{{ day.day }}</text
          ><text v-if="day.summary">{{ day.summary.learned.join('；') }}</text
          ><text v-else>{{ day.completed ? '已完成' : '待继续' }}</text></view
        ></template
      >
    </BaseCard>
  </view>
</template>
<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { t } from '@/i18n/index.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { writingCoachDashboard } from '../../../../laf-backend/functions/_shared/learning-writing-coach.js';
import { dayKey } from '@/services/learning/learning-domain.js';
import { museRecordSubjects, museSubjectOptions } from '@/services/learning/muse-workspace-data.js';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseStat from '@/components/base/base-stat/base-stat.vue';
const props = defineProps({ view: { type: String, default: 'all' } });
const subject = ref('all');
const learning = useConversationLearningStore();
const records = computed(() =>
  [...learning.state.conversations]
    .reverse()
    .filter((item) => item.coach)
    .map((item) => ({
      ...item,
      subjects: museRecordSubjects(item),
      board: writingCoachDashboard(
        item.coach,
        dayKey(learning.calendarTime, learning.state.timezone),
        learning.state.timezone
      )
    }))
);
const subjectRecords = computed(() =>
  props.view === 'mistake' ? records.value.filter((item) => item.board?.weaknesses.length) : records.value
);
const subjects = computed(() => museSubjectOptions(learning.state, subjectRecords.value));
const filteredRecords = computed(() =>
  subjectRecords.value.filter((item) => subject.value === 'all' || item.subjects.includes(subject.value.slice(8)))
);
watch(
  () => learning.recordContext(),
  () => {
    subject.value = 'all';
  }
);
const calendar = learning.observeCalendar();
onMounted(() => calendar.show());
onUnmounted(() => calendar.dispose());
function open(id) {
  learning.locateConversation(id);
  safeNavigateTo('/pages/learning/index');
}
</script>
<style scoped>
.record-subjects {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.coach-records {
  display: grid;
  gap: 16px;
  max-width: 768px;
  margin: auto;
  width: 100%;
}
.coach-record :deep(.base-card__body) {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.record-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.record-heading > text {
  flex: 1;
  min-width: 0;
  font-size: 18px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.record-heading .base-button {
  flex: none;
}
.record-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  padding: 12px 0;
}
.record-meta,
.record-day {
  color: var(--ink-3);
  font-size: 14px;
}
.record-day {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  border-top: 1px solid var(--line);
  padding-top: 12px;
}
.record-day > text:last-child {
  text-align: right;
  min-width: 0;
  overflow-wrap: anywhere;
}
.record-line {
  padding: 11px 15px;
  border-radius: 16px;
  background: var(--muse-raised);
}
</style>
