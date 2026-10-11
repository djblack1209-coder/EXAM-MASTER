<template>
  <view v-if="learning.journey" ref="root" class="journey-review" data-test="journey-review">
    <view class="review-heading"
      ><text class="section-title">{{ t('learning.ksb') }}</text>
      <BaseSegmented
        v-model="range"
        :label="t('learning.recapRange')"
        :options="ranges.map((item) => ({ value: item.id, label: learningText(item.label) }))"
      />
    </view>
    <template v-if="recap?.submitted"
      ><YoziMascot
        v-if="range === 'day' && recap.confirmed && recap.complete"
        :key="recap.confirmed"
        pose="celebrate"
        play="once"
        size="state"
      />
      <text class="review-summary"
        >{{ t('learning.kbr') }}{{ recap.submitted }}{{ t('learning.kv0') }}{{ recap.correct }}{{ t('learning.ko3')
        }}{{ recap.partial }}{{ t('learning.kbs') }}{{ recap.pending }}</text
      >
      <text class="review-meta"
        >{{ t('learning.kjm') }}{{ recap.independentCorrect }} · {{ recap.day }} · {{ learning.journey.timezone }}</text
      >
      <view v-for="module in recap.modules" :key="module.id" class="review-module">
        <view
          ><text class="review-module-title">{{ learningText(module.label) }}</text
          ><text class="review-meta">{{ learningText(module.next) }}</text></view
        >
        <text class="review-module-state">{{ module.completed ? t('learning.kbr') : t('learning.kuu') }}</text>
      </view>
      <view class="button-row">
        <BaseButton
          class="primary"
          data-test="recap-confirm"
          :disabled="locked || !!recap.confirmed"
          :aria-disabled="locked || !!recap.confirmed"
          variant="primary"
          @tap="confirm"
        >
          {{ recap.confirmed ? t('learning.koh') : t('learning.k88') }}
        </BaseButton>
        <text v-if="range === 'day'" class="review-meta">{{
          recap.complete ? t('learning.kql') : t('learning.kei')
        }}</text>
      </view>
      <view v-if="recap.confirmed" class="review-next">
        <text class="section-title">{{ t('learning.kuv') }}</text>
        <view v-for="module in recap.modules.filter((m) => m.completed)" :key="module.id" class="review-module">
          <view
            ><text class="review-module-title"
              >{{ learningText(module.label) }} · {{ nextSizes[module.id] || module.suggestedSize
              }}{{ t('learning.ko0') }}</text
            >
            <text class="review-meta"
              >{{ learningText(module.next) }}{{ t('learning.k38') }}{{ module.evidenceIds.length
              }}{{ t('learning.ki5') }}</text
            >
            <label class="review-size"
              ><text>{{ t('learning.k4t') }}</text
              ><BaseInput
                :model-value="nextSizes[module.id] || module.suggestedSize"
                type="number"
                :label="t('learning.kpa', { v0: learningText(module.label) })"
                @input="nextSizes[module.id] = Number(inputValue($event))"
            /></label>
          </view>
          <BaseButton
            :disabled="locked || !!planned(module.id)"
            :aria-disabled="locked || !!planned(module.id)"
            variant="quiet"
            @tap="plan(module)"
          >
            {{ planned(module.id) ? t('learning.kjg') : t('learning.k53') }}
          </BaseButton>
        </view>
      </view>
    </template>
    <BaseEmpty v-else state="empty" :title="t('learning.kgu')" mascot-size="small" pose="sleep" />
    <BaseCard
      v-if="learning.journeyInsights.comparisons.length"
      class="review-calendar"
      data-test="journey-comparison"
      padding="none"
    >
      <text class="section-title">{{ t('learning.kcy') }}</text>
      <view v-for="row in learning.journeyInsights.comparisons" :key="row.moduleId" class="comparison-row">
        <text class="review-module-title">{{ learningText(row.label) }}</text>
        <view class="comparison-columns">
          <view
            ><text class="review-meta">{{ row.previousDay }}</text
            ><text class="comparison-number">{{ row.previous.correct }} / {{ row.previous.reliable }}</text>
            <text class="review-meta"
              >{{ row.previous.questions }}{{ t('learning.k1v') }}{{ row.previous.pending }}{{ t('learning.km')
              }}{{ row.previous.helped }}</text
            ></view
          >
          <view
            ><text class="review-meta">{{ row.currentDay }}</text
            ><text class="comparison-number">{{ row.current.correct }} / {{ row.current.reliable }}</text>
            <text class="review-meta"
              >{{ row.current.questions }}{{ t('learning.k1v') }}{{ row.current.pending }}{{ t('learning.km')
              }}{{ row.current.helped }}</text
            ></view
          >
        </view>
        <text v-if="row.percentagePointDelta !== null" class="review-meta"
          >{{ t('learning.km1') }}{{ row.percentagePointDelta > 0 ? '+' : '' }}{{ row.percentagePointDelta.toFixed(1)
          }}{{ t('learning.ksl') }}</text
        >
        <text class="review-meta">{{ learningText(row.conditions) }}{{ t('learning.k7t') }}</text>
      </view>
    </BaseCard>
    <BaseCard
      v-if="learning.journeyInsights.consolidation.length"
      class="review-calendar"
      data-test="journey-consolidation"
      padding="none"
    >
      <text class="section-title">{{ t('learning.k7e') }}</text>
      <view v-for="row in learning.journeyInsights.consolidation" :key="row.id" class="review-module">
        <view
          ><text class="review-module-title">{{ row.name }}</text
          ><text class="review-meta"
            >{{ learningText(row.label) }}{{ t('learning.k38') }}{{ row.evidenceIds.length
            }}{{ t('learning.ki5') }}</text
          >
          <text v-if="row.kind === 'reliable'" class="review-meta"
            >{{ t('learning.kti') }}{{ row.wrong }}{{ t('learning.ko3') }}{{ row.partial }}</text
          ></view
        >
        <BaseButton :disabled="locked" :aria-disabled="locked" variant="quiet" @tap="consolidate(row)">
          {{ row.kind === 'pending' ? t('learning.kml') : t('learning.ku6') }}
        </BaseButton>
      </view>
    </BaseCard>
    <BaseCard class="review-calendar" padding="none">
      <BaseButton :aria-expanded="handoffVisible" variant="quiet" @tap="handoffVisible = !handoffVisible">
        {{ handoffVisible ? t('learning.kuc') : t('learning.ksc') }}
      </BaseButton>
      <BaseInput
        v-if="handoffVisible"
        :model-value="learning.journeyInsights.handoff"
        readonly
        class="handoff-text"
        :label="t('learning.khb')"
        multiline
      />
    </BaseCard>
    <BaseCard class="review-calendar" padding="none">
      <text class="section-title">{{ t('learning.krm') }}</text>
      <view class="calendar-days" :aria-label="t('learning.krm')">
        <view v-for="day in activity" :key="day.day" class="calendar-day">
          <text>{{ day.day.slice(5) }}</text
          ><text>{{ day.answers }}{{ t('learning.ki5') }}</text
          ><text>{{ day.completed ? t('learning.knz') : '—' }}</text>
        </view>
      </view>
    </BaseCard>
    <BaseCard class="review-calendar" padding="none">
      <text class="section-title">{{ t('learning.ka2') }}</text>
      <view v-for="group in future" :key="group.id" class="review-module">
        <view
          ><text class="review-module-title">{{ learningText(moduleName(group.moduleId)) }} · {{ group.day }}</text>
          <text class="review-meta"
            >{{ group.questionKeys.length }}{{ t('learning.kg5')
            }}{{ group.submittedBy ? t('learning.kbr') : t('learning.k8j') }}</text
          ></view
        >
        <BaseButton variant="quiet" @tap="learning.selectTraining(group.id)">{{ t('learning.kg7') }}</BaseButton>
      </view>
      <view v-for="review in reviews" :key="review.id" class="review-module">
        <view
          ><text class="review-module-title">{{ questionPrompt(review.questionKey) }}</text>
          <text class="review-meta"
            >{{ learningText(dateLabel(review.due)) }} ·
            {{ review.due <= Date.now() ? t('learning.k7j') : t('learning.kbq') }}</text
          ></view
        >
        <BaseButton variant="quiet" @tap="openReview(review)">{{ t('learning.k5w') }}</BaseButton>
      </view>
      <BaseEmpty
        v-if="!reviews.length && !future.length"
        state="empty"
        :title="t('learning.kjf')"
        mascot-size="small"
        pose="sleep"
      />
    </BaseCard>
    <view v-if="message" class="review-feedback"
      ><BaseEmpty v-if="failed" state="error" :title="learningText(message)" mascot-size="small" /><text v-else>{{
        learningText(message)
      }}</text></view
    >
  </view>
</template>
<script setup>
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseSegmented from '@/components/base/base-segmented/base-segmented.vue';
import YoziMascot from '@/components/base/yozi-mascot/yozi-mascot.vue';
import { learningText } from '@/i18n/learning.js';
import { t } from '@/i18n/index.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseCard from '@/components/base/base-card/base-card.vue';

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
  margin-top: var(--s-8);
  padding-top: var(--s-6);
  border-top: var(--border-thin) solid var(--line);
}
.review-heading,
.review-module {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--s-4);
}
.review-summary {
  display: block;
  font-size: var(--size-body);
  line-height: 1.75;
  margin-top: var(--s-4);
}
.review-meta {
  display: block;
  font-size: var(--size-caption);
  color: var(--ink-3);
  line-height: 1.7;
  margin-top: var(--s-2);
  overflow-wrap: anywhere;
}
.review-module {
  margin: var(--s-4) 0;
  padding: var(--s-3) 0;
  border-bottom: var(--border-thin) solid var(--line);
}
.review-module > view {
  min-width: 0;
  flex: 1;
}
.review-module-title {
  font-size: var(--size-body);
  line-height: 1.75;
  overflow-wrap: anywhere;
}
.review-module-state {
  font-size: var(--size-caption);
  flex-shrink: 0;
}
.review-next,
.review-calendar {
  margin-top: var(--s-8);
}
.review-size {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  font-size: var(--size-caption);
  margin-top: var(--s-2);
}
.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--s-2);
  margin-top: var(--s-4);
}
.calendar-day {
  display: grid;
  gap: var(--s-2);
  font-size: var(--size-caption);
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.comparison-row {
  padding: var(--s-4) 0;
  border-bottom: var(--border-thin) solid var(--line);
}
.comparison-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--s-4);
  margin: var(--s-3) 0;
}
.comparison-number {
  display: block;
  font-size: var(--size-title-2);
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.handoff-text {
  width: 100%;
  margin-top: var(--s-4);
}
.review-feedback {
  display: block;
  font-size: var(--size-small);
  line-height: 1.7;
  margin-top: var(--s-4);
}
@media (max-width: 520px) {
  .review-heading {
    flex-direction: column;
    align-items: flex-start;
  }
  .calendar-days {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--s-4);
  }
  .review-module {
    flex-wrap: wrap;
  }
}
</style>
