<template>
  <MuseLibrary v-if="view === 'materials'" @view="$emit('view', $event)" />
  <MuseUsageBoard v-else-if="view === 'usage'" @close="$emit('view', 'materials')" />
  <view v-else class="muse-page">
    <view class="muse-page-head">
      <text class="muse-page-title" role="heading" aria-level="1">{{
        t(view === 'plan' ? 'muse.goals' : 'muse.activity')
      }}</text>
      <view v-if="view === 'all'" class="workspace-filters" role="group" aria-label="学习动态筛选">
        <BaseButton
          v-for="filter in filters"
          :key="filter.value"
          variant="quiet"
          :selected="feedFilter === filter.value"
          @tap="feedFilter = filter.value"
          >{{ filter.label }}</BaseButton
        >
      </view>
      <BaseButton v-else variant="primary" icon="plus" :disabled="learning.busy" @tap="start">新建目标</BaseButton>
    </view>
    <view class="muse-page-scroll">
      <view class="muse-page-body" :class="{ 'muse-page-body--wide': view === 'all' }">
        <MuseConversationFilter />
        <template v-if="view === 'all'">
          <view class="workspace-filters subject-filters" role="group" aria-label="历史学科筛选">
            <BaseButton
              v-for="option in subjectOptions"
              :key="option.id"
              variant="quiet"
              :selected="subject === option.id"
              @tap="subject = option.id"
              >{{ option.label }} ({{ option.count }})</BaseButton
            >
          </view>
          <view v-for="group in historyGroups" :key="group.day" class="history-edition">
            <view class="history-date-row"
              ><text class="history-date" role="heading" aria-level="2">{{ group.day }}</text>
              <BaseButton
                variant="quiet"
                icon="download"
                icon-only
                :label="`保存 ${group.day} 学习图片`"
                v-if="shareableDay(group.day)"
                @tap="shareDay = group.day"
              />
            </view>
            <view class="feed-list">
              <view v-for="item in group.items" :key="item.id" class="feed-card">
                <view class="feed-icon"><BaseIcon :name="item.icon" size="18px" /></view>
                <view class="feed-main"
                  ><view class="feed-meta"
                    ><text>{{ item.subjects.join('、') }} · {{ kindLabel(item.kind) }}</text
                    ><text>{{ timeLabel(item.at) }}</text></view
                  ><text class="feed-title">{{ item.title }}</text
                  ><text v-if="item.body" class="feed-copy" selectable>{{ item.body }}</text
                  ><view class="feed-tags"
                    ><text class="workspace-tag">{{ item.goal }}</text></view
                  ></view
                >
                <BaseButton
                  class="feed-cta"
                  variant="quiet"
                  icon="arrow-right"
                  icon-only
                  label="打开原对话"
                  @tap="open(item.conversationId, group.day)"
                />
              </view>
            </view>
          </view>
          <BaseButton v-if="feed.length > limit" variant="quiet" @tap="limit += 30">查看更多</BaseButton>
          <view v-if="!feed.length" class="workspace-empty"
            ><BaseIcon name="list" size="34px" /><text>{{ subject === 'all' ? '暂无成果' : '该学科暂无记录' }}</text
            ><BaseButton variant="quiet" :disabled="learning.busy" @tap="start">开始学习</BaseButton></view
          >
        </template>
        <template v-else-if="view === 'plan'">
          <ConversationEntries />
          <view v-if="current" class="goals-hero"
            ><view class="goal-hero-main"
              ><text class="workspace-eyebrow">当前目标</text
              ><text class="goal-hero-title">{{ goalTitle(current) }}</text
              ><text class="hero-copy">{{ goalMeta(current) }}</text
              ><text v-if="current.coach.profile?.foundation" class="hero-copy goal-foundation"
                >困难：{{ current.coach.profile.foundation }}</text
              ><view class="goal-hero-foot"
                ><text class="hero-copy">{{ current.next }}</text
                ><BaseButton variant="quiet" @tap="open(current.id)">{{
                  current.stopped ? '查看记录' : '继续训练'
                }}</BaseButton></view
              ></view
            ><view
              v-if="current.percent !== null"
              class="goal-ring"
              :style="{ '--goal-percent': `${current.percent}%` }"
              ><text>{{ current.percent }}%</text></view
            ><view v-else class="goal-days"
              ><text>{{ current.completedDays }}</text
              ><text>已完成天数</text></view
            ></view
          >
          <view v-if="goals.length > 1" class="goal-list"
            ><view v-for="goal in goals.slice(1)" :key="goal.id" class="goal-card"
              ><view class="goal-card-top"
                ><text class="goal-name">{{ goalTitle(goal) }}</text
                ><text>{{ goal.completedDays }}{{ goal.totalDays ? ` / ${goal.totalDays}` : '' }} 天</text></view
              ><view
                v-if="goal.percent !== null"
                class="goal-track"
                role="progressbar"
                aria-label="已完成训练天数"
                :aria-valuenow="goal.completedDays"
                :aria-valuemax="goal.totalDays"
                aria-valuemin="0"
                ><view :style="{ width: `${goal.percent}%` }" /></view
              ><view class="goal-card-foot"
                ><text>{{ goal.next }}</text
                ><BaseButton variant="quiet" @tap="open(goal.id)">{{
                  goal.stopped ? '查看记录' : '继续训练'
                }}</BaseButton></view
              ></view
            ></view
          >
          <view v-if="current?.tasks.length" class="goal-tasks"
            ><text class="task-heading">今天的完成标准</text
            ><BaseButton
              v-for="task in current.tasks"
              :key="task.id"
              class="goal-task"
              variant="quiet"
              align="start"
              @tap="open(current.id)"
              ><BaseIcon :name="task.done ? 'checkbox-on' : 'checkbox-off'" size="18px" /><text>{{ task.title }}</text
              ><text class="task-count">{{ task.count }} / {{ task.total }}</text></BaseButton
            ></view
          >
          <view v-if="!goals.length && !context.state.value.conversations.length" class="workspace-empty"
            ><BaseIcon name="target" size="34px" /><text>还没有学习目标</text
            ><BaseButton variant="quiet" :disabled="learning.busy" @tap="start">新建目标</BaseButton></view
          >
        </template>
      </view>
    </view>
    <MuseShareSheet
      :category="context.id.value"
      :visible="Boolean(shareDay)"
      :day="shareDay"
      @close="shareDay = null"
    />
  </view>
</template>
<script setup>
import ConversationEntries from '@/pages/archive/components/conversation-entries.vue';
import MuseConversationFilter from './muse-conversation-filter.vue';
import { workspaceConversationContext } from '@/services/learning/workspace-context.js';
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import '@/i18n/muse.js';
import { t } from '@/i18n/index.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { dayKey } from '@/services/learning/learning-domain.js';
import { museGoals, museHistory, museSubjectOptions } from '@/services/learning/muse-workspace-data.js';
import { safeNavigateTo } from '@/utils/safe-navigate.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
import MuseLibrary from './muse-library.vue';
import MuseUsageBoard from './muse-usage-board.vue';
import MuseShareSheet from './muse-share-sheet.vue';
defineProps({ view: { type: String, default: 'all' } });
defineEmits(['view']);
const learning = useConversationLearningStore();
const context = workspaceConversationContext(learning);
const subject = ref('all');
const feedFilter = ref('all'),
  shareDay = ref(null),
  limit = ref(30);
const filters = [
  { value: 'all', label: '全部' },
  { value: 'practice', label: '训练' },
  { value: 'feedback', label: '反馈' },
  { value: 'material', label: '资料' }
];
const goals = computed(() => museGoals(context.state.value, learning.calendarTime));
const current = computed(() => goals.value[0]);
const EXAM_NAMES = { english1: '英语一', english2: '英语二' };
// 短标题由已保存的档案派生；未建档时才回落到用户原话。
function goalTitle(goal) {
  const exam = goal.coach.profile?.exam;
  if (!goal.coach.profile) return goal.goal;
  return exam === 'cs408' ? '计算机专业课带练' : `${EXAM_NAMES[exam] || '应用文'}写作带练`;
}
function goalMeta(goal) {
  const profile = goal.coach.profile || {};
  const [year, month] = (profile.deadline || '').split('-');
  const exam =
    year && month
      ? `${year} 年 ${Number(month)} 月考试`
      : { this: '今年 12 月考试', next: '明年 12 月考试' }[profile.deadlineBucket] || '考试时间未定';
  return `${exam} · ${profile.minutes ? `${profile.minutes} 分钟 / 天` : '每日时长未设置'}`;
}
const history = computed(() => museHistory(context.state.value));
const subjectOptions = computed(() => museSubjectOptions(learning.state, history.value));
const feed = computed(() =>
  history.value.filter(
    (item) =>
      (feedFilter.value === 'all' || item.kind === feedFilter.value) &&
      (subject.value === 'all' || item.subjects.includes(subject.value.slice(8)))
  )
);
watch(
  () => learning.recordContext(),
  () => {
    subject.value = 'all';
    feedFilter.value = 'all';
    limit.value = 30;
    shareDay.value = null;
  }
);
watch(
  () => context.id.value,
  () => {
    limit.value = 30;
    shareDay.value = null;
  }
);
watch([subject, feedFilter], () => {
  limit.value = 30;
});
const historyGroups = computed(() => {
  const groups = new Map();
  for (const item of feed.value.slice(0, limit.value)) {
    const day = dayKey(item.at, learning.state.timezone);
    if (!groups.has(day)) groups.set(day, { day, items: [] });
    groups.get(day).items.push(item);
  }
  return [...groups.values()];
});
function timeLabel(at) {
  return new Date(at).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: learning.state.timezone
  });
}
function shareableDay(day) {
  return context.state.value.conversations.some(
    (item) => item.coach?.startedDay === day || item.coach?.days.some((value) => value.day === day)
  );
}
const reader = learning.observeCalendar();
onMounted(() => reader.show());
onUnmounted(() => reader.dispose());
function kindLabel(kind) {
  return { practice: '练习', feedback: '反馈', material: '资料', writing: '写作', summary: '小结' }[kind] || kind;
}
function open(id, day) {
  if (learning.busy) return;
  learning.locateConversation(id, day);
  safeNavigateTo('/pages/learning/index');
}
function start() {
  if (learning.busy) return;
  learning.selectedConversationId = null;
  safeNavigateTo('/pages/learning/index');
}
</script>
<style src="./muse-pages.css"></style>
<style scoped>
.history-date-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.history-date-row .history-date {
  margin-bottom: 0;
}
</style>
