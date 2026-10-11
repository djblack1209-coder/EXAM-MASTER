<template>
  <view v-if="learning.journey" ref="root" class="journey-review" data-test="journey-review">
    <view class="review-heading"
      ><text class="section-title">学习复盘</text>
      <view class="button-row" aria-label="复盘范围">
        <button
          v-for="item in ranges"
          :key="item.id"
          role="button"
          tabindex="0"
          :aria-pressed="range === item.id"
          :class="{ chosen: range === item.id }"
          @tap="range = item.id"
        >
          {{ item.label }}
        </button>
      </view>
    </view>
    <template v-if="recap?.submitted">
      <text class="review-summary"
        >已提交 {{ recap.submitted }} 题 · 可靠正确 {{ recap.correct }} · 部分正确 {{ recap.partial }} · 待核对
        {{ recap.pending }}</text
      >
      <text class="review-meta"
        >独立正确 {{ recap.independentCorrect }} · {{ recap.day }} · {{ learning.journey.timezone }}</text
      >
      <view v-for="module in recap.modules" :key="module.id" class="review-module">
        <view
          ><text class="review-module-title">{{ module.label }}</text
          ><text class="review-meta">{{ module.next }}</text></view
        >
        <text class="review-module-state">{{ module.completed ? '已提交' : '待完成' }}</text>
      </view>
      <view class="button-row">
        <button
          class="primary"
          role="button"
          tabindex="0"
          data-test="recap-confirm"
          :disabled="locked || !!recap.confirmed"
          :aria-disabled="locked || !!recap.confirmed"
          @tap="confirm"
        >
          {{ recap.confirmed ? '复盘已保存' : '完成本次复盘' }}
        </button>
        <text v-if="range === 'day'" class="review-meta">{{
          recap.complete ? '今日模块已全部提交' : '未完成模块仍保留在今日路线'
        }}</text>
      </view>
      <view v-if="recap.confirmed" class="review-next">
        <text class="section-title">下一批训练</text>
        <view v-for="module in recap.modules.filter((m) => m.completed)" :key="module.id" class="review-module">
          <view
            ><text class="review-module-title"
              >{{ module.label }} · {{ nextSizes[module.id] || module.suggestedSize }}题</text
            >
            <text class="review-meta">{{ module.next }} · 依据 {{ module.evidenceIds.length }} 份原答</text>
            <label class="review-size"
              ><text>题量</text
              ><input
                :value="nextSizes[module.id] || module.suggestedSize"
                type="number"
                :aria-label="`${module.label}下一批题量`"
                @input="nextSizes[module.id] = Number(inputValue($event))"
            /></label>
          </view>
          <button
            role="button"
            tabindex="0"
            :disabled="locked || !!planned(module.id)"
            :aria-disabled="locked || !!planned(module.id)"
            @tap="plan(module)"
          >
            {{ planned(module.id) ? '已安排明日' : '安排明日训练' }}
          </button>
        </view>
      </view>
    </template>
    <text v-else class="review-meta">提交训练后即可复盘</text>
    <view v-if="learning.journeyInsights.comparisons.length" class="review-calendar" data-test="journey-comparison">
      <text class="section-title">前后训练对比</text>
      <view v-for="row in learning.journeyInsights.comparisons" :key="row.moduleId" class="comparison-row">
        <text class="review-module-title">{{ row.label }}</text>
        <view class="comparison-columns">
          <view
            ><text class="review-meta">{{ row.previousDay }}</text
            ><text class="comparison-number">{{ row.previous.correct }} / {{ row.previous.reliable }}</text>
            <text class="review-meta"
              >{{ row.previous.questions }}题 · 待核对 {{ row.previous.pending }} · 提示 {{ row.previous.helped }}</text
            ></view
          >
          <view
            ><text class="review-meta">{{ row.currentDay }}</text
            ><text class="comparison-number">{{ row.current.correct }} / {{ row.current.reliable }}</text>
            <text class="review-meta"
              >{{ row.current.questions }}题 · 待核对 {{ row.current.pending }} · 提示 {{ row.current.helped }}</text
            ></view
          >
        </view>
        <text v-if="row.percentagePointDelta !== null" class="review-meta"
          >训练正确率差异 {{ row.percentagePointDelta > 0 ? '+' : ''
          }}{{ row.percentagePointDelta.toFixed(1) }} 个百分点</text
        >
        <text class="review-meta">{{ row.conditions }}。记录差异不等同能力变化。</text>
      </view>
    </view>
    <view
      v-if="learning.journeyInsights.consolidation.length"
      class="review-calendar"
      data-test="journey-consolidation"
    >
      <text class="section-title">集中巩固</text>
      <view v-for="row in learning.journeyInsights.consolidation" :key="row.id" class="review-module">
        <view
          ><text class="review-module-title">{{ row.name }}</text
          ><text class="review-meta">{{ row.label }} · 依据 {{ row.evidenceIds.length }} 份原答</text>
          <text v-if="row.kind === 'reliable'" class="review-meta"
            >可靠错答 {{ row.wrong }} · 部分正确 {{ row.partial }}</text
          ></view
        >
        <button role="button" tabindex="0" :disabled="locked" :aria-disabled="locked" @tap="consolidate(row)">
          {{ row.kind === 'pending' ? '查看原答' : '开始巩固检验' }}
        </button>
      </view>
    </view>
    <view class="review-calendar">
      <button role="button" tabindex="0" :aria-expanded="handoffVisible" @tap="handoffVisible = !handoffVisible">
        {{ handoffVisible ? '收起接续摘要' : '生成接续摘要' }}
      </button>
      <textarea
        v-if="handoffVisible"
        :value="learning.journeyInsights.handoff"
        readonly
        aria-label="当前目标接续摘要"
        class="handoff-text"
      ></textarea>
    </view>
    <view class="review-calendar">
      <text class="section-title">近7天学习活动</text>
      <view class="calendar-days" aria-label="近7天学习活动">
        <view v-for="day in activity" :key="day.day" class="calendar-day">
          <text>{{ day.day.slice(5) }}</text
          ><text>{{ day.answers }} 份原答</text><text>{{ day.completed ? '复盘完成' : '—' }}</text>
        </view>
      </view>
    </view>
    <view class="review-calendar">
      <text class="section-title">复习与后续安排</text>
      <view v-for="group in future" :key="group.id" class="review-module">
        <view
          ><text class="review-module-title">{{ moduleName(group.moduleId) }} · {{ group.day }}</text>
          <text class="review-meta"
            >{{ group.questionKeys.length }}题 · {{ group.submittedBy ? '已提交' : '待提交' }}</text
          ></view
        >
        <button role="button" tabindex="0" @tap="learning.selectTraining(group.id)">查看题组</button>
      </view>
      <view v-for="review in reviews" :key="review.id" class="review-module">
        <view
          ><text class="review-module-title">{{ questionPrompt(review.questionKey) }}</text>
          <text class="review-meta"
            >{{ dateLabel(review.due) }} · {{ review.due <= Date.now() ? '到期复测' : '未来复测' }}</text
          ></view
        >
        <button role="button" tabindex="0" @tap="openReview(review)">回到复测题</button>
      </view>
      <text v-if="!reviews.length && !future.length" class="review-meta">暂无复习安排</text>
    </view>
    <text v-if="message" class="review-feedback" :class="{ warning: failed }" :role="failed ? 'alert' : 'status'">{{
      message
    }}</text>
  </view>
</template>
<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { dayKey } from '@/services/learning/learning-domain.js';
import { JOURNEY_MODULES, journeyDate } from '../../../../laf-backend/functions/_shared/learning-journey.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
const learning = useConversationLearningStore();
const root = ref(null),
  range = ref('day'),
  nextSizes = ref({}),
  message = ref(''),
  failed = ref(false);
const handoffVisible = ref(false);
const ranges = [
  { id: 'module', label: '本模块' },
  { id: 'day', label: '今天' },
  { id: 'week', label: '近7天' }
];
const recap = computed(() =>
  range.value === 'module' ? learning.moduleRecap : range.value === 'week' ? learning.weeklyRecap : learning.dailyRecap
);
const locked = computed(
  () =>
    !!learning.active?.stopped || learning.busy || learning.syncBusy || learning.materialBusy || learning.historyBusy
);
const future = computed(() => (learning.active?.trainingGroups || []).filter((g) => g.day > learning.journey.day));
const reviews = computed(() => {
  const keys = new Set(
    learning.state.attempts.filter((a) => a.conversationId === learning.active.id).map((a) => a.questionKey)
  );
  return learning.state.reviews
    .filter((r) => !r.cancelled && keys.has(r.questionKey))
    .sort((a, b) => a.due - b.due)
    .slice(0, 20);
});
const activity = computed(() => {
  const ordinal = journeyDate(learning.journey.day);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date((ordinal - 6 + index) * 86400000).toISOString().slice(0, 10);
    return {
      day,
      answers: learning.state.attempts.filter(
        (a) => a.conversationId === learning.active.id && dayKey(a.at, learning.journey.timezone) === day
      ).length,
      completed: learning.active.recaps?.some((r) => r.kind === 'day' && r.day === day && r.complete)
    };
  });
});
let unbind = () => undefined;
const inputValue = (event) => event.detail?.value ?? event.target?.value ?? '';
const moduleName = (id) => JOURNEY_MODULES.find((m) => m.id === id)?.label || '训练';
const planned = (id) => future.value.find((g) => g.moduleId === id);
const questionPrompt = (key) => learning.state.questions.find((q) => `${q.id}@${q.version}` === key)?.prompt || '原题';
const dateLabel = (at) => dayKey(at, learning.journey.timezone);
function action(callback) {
  try {
    callback();
    message.value = '';
    failed.value = false;
  } catch (error) {
    message.value = error.message;
    failed.value = true;
  }
}
function confirm() {
  if (!locked.value) action(() => learning.confirmRecap(learning.journeyContext(), range.value));
}
function consolidate(row) {
  if (!locked.value) action(() => learning.startWeakness(learning.journeyContext(), row.evidenceIds[0]));
}
function plan(module) {
  if (!locked.value)
    action(() =>
      learning.planNextTraining(
        learning.journeyContext(),
        module.id,
        nextSizes.value[module.id] || module.suggestedSize
      )
    );
}
function openReview(review) {
  action(() => {
    learning.focus(review.questionKey, learning.active.id, 'review');
    learning.selectTraining(null);
  });
}
watch(
  () => learning.selectedConversationId,
  () => {
    nextSizes.value = {};
    message.value = '';
    range.value = 'day';
  }
);
onMounted(() => {
  unbind = bindLearningKeyboard(root.value);
});
onUnmounted(() => unbind());
</script>
<style scoped>
.journey-review {
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--space-line);
}
.review-heading,
.review-module {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.review-summary {
  display: block;
  font-size: 16px;
  line-height: 1.75;
  margin-top: 16px;
}
.review-meta {
  display: block;
  font-size: 12px;
  color: var(--space-muted);
  line-height: 1.7;
  margin-top: 6px;
  overflow-wrap: anywhere;
}
.review-module {
  margin: 16px 0;
  padding: 12px 0;
  border-bottom: 1px solid var(--space-line);
}
.review-module > view {
  min-width: 0;
  flex: 1;
}
.review-module-title {
  font-size: 16px;
  line-height: 1.75;
  overflow-wrap: anywhere;
}
.review-module-state {
  font-size: 12px;
  flex-shrink: 0;
}
.review-next,
.review-calendar {
  margin-top: 28px;
}
.review-size {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  margin-top: 8px;
}
.review-size input {
  width: 72px;
  min-height: 44px;
  padding: 8px;
  border: 1px solid var(--space-line);
  border-radius: 12px;
}
.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
  margin-top: 16px;
}
.calendar-day {
  display: grid;
  gap: 8px;
  font-size: 12px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.comparison-row {
  padding: 16px 0;
  border-bottom: 1px solid var(--space-line);
}
.comparison-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  margin: 12px 0;
}
.comparison-number {
  display: block;
  font-size: 24px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.handoff-text {
  width: 100%;
  min-height: 220px;
  box-sizing: border-box;
  font-size: 14px;
  line-height: 1.75;
  margin-top: 16px;
  padding: 12px;
  color: inherit;
}
.review-feedback {
  display: block;
  font-size: 14px;
  line-height: 1.7;
  margin-top: 16px;
}
@media (max-width: 520px) {
  .review-heading {
    flex-direction: column;
    align-items: flex-start;
  }
  .calendar-days {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
  }
  .review-module {
    flex-wrap: wrap;
  }
}
</style>
