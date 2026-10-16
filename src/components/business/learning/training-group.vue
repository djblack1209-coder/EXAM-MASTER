<template>
  <BaseCard
    v-if="report"
    id="learning-training-panel"
    ref="root"
    class="training-panel"
    data-test="training-group"
    tabindex="-1"
    role="region"
    :aria-label="learningText(report.module.label)"
  >
    <view class="training-heading">
      <view
        ><text class="training-title"
          >{{ learningText(report.module.label) }} · {{ report.questionKeys.length }}{{ t('learning.ko0') }}</text
        >
        <text class="training-meta"
          >{{ report.day }} · {{ report.mode === 'timed' ? t('learning.kgj') : t('learning.k4r') }}{{ t('learning.k4d')
          }}{{ report.minutes }}{{ t('learning.k4n') }}</text
        ></view
      >
      <text v-if="report.mode === 'timed' && !report.submittedBy" class="training-clock" role="timer">{{
        remaining
      }}</text>
    </view>
    <template v-if="!report.submittedBy">
      <view class="answer-sheet" :aria-label="t('learning.kjt')">
        <text class="training-meta">{{ t('learning.kv') }}{{ answered }} / {{ report.questionKeys.length }}</text>
        <view class="answer-sheet-grid">
          <BaseButton
            v-for="(row, index) in report.rows"
            :key="row.questionKey"
            :aria-label="
              t('learning.kp7', {
                v0: index + 1,
                v1: answers[index]?.trim() ? t('learning.draftFilled') : t('learning.unanswered')
              })
            "
            :class="{ chosen: answers[index]?.trim() }"
            variant="quiet"
            @tap="locate(index)"
          >
            {{ index + 1 }}
          </BaseButton>
        </view>
      </view>
      <BaseCard
        v-for="(row, index) in report.rows"
        :id="`training-question-${index}`"
        :key="row.questionKey"
        class="training-question"
        padding="none"
      >
        <text class="training-question-label">{{
          t('learning.trainingQuestionLabel', {
            index: index + 1,
            topic: learningText(row.question.knowledgePoint || report.module.label)
          })
        }}</text>
        <text class="training-prompt" selectable>{{ row.question.prompt }}</text>
        <BaseButton :disabled="locked" :aria-disabled="locked" variant="quiet" @tap="discuss(row.questionKey)">{{
          t('learning.k9a')
        }}</BaseButton>
        <BaseOptions
          v-if="row.question.options?.length"
          :options="
            row.question.options.map((option, i) => ({
              value: choiceValue(option, i),
              label: option.replace(/^[A-H][.、．]\s*/i, ''),
              key: choiceValue(option, i)
            }))
          "
          :model-value="answers[index] || ''"
          :label="t('learning.answerOptions')"
          :disabled="locked"
          @update:model-value="setAnswer(index, $event)"
        />
        <label v-else class="training-answer">
          <text>{{ row.question.answerType === 'subjective' ? t('learning.klu') : t('learning.kob') }}</text>
          <BaseInput
            :model-value="answers[index] || ''"
            :maxlength="answerLimit(row.question)"
            :disabled="locked"
            :aria-disabled="locked"
            :class="{ 'writing-answer': row.question.answerType === 'subjective' }"
            :label="t('learning.kow', { v0: index + 1 })"
            multiline
            @input="setAnswer(index, inputValue($event))"
          />
        </label>
      </BaseCard>
      <view class="training-submit-row">
        <text class="training-meta">{{ report.questionKeys.length - answered }}{{ t('learning.k2s') }}</text>
        <BaseButton
          class="primary"
          data-test="training-submit"
          :disabled="locked || answered !== report.questionKeys.length || !due"
          :aria-disabled="locked || answered !== report.questionKeys.length || !due"
          variant="primary"
          @tap="submit"
          >{{ t('learning.kf9') }}</BaseButton
        >
      </view>
      <text v-if="!due" class="training-meta">{{ report.day }}{{ t('learning.kqy') }}</text>
    </template>
    <template v-else>
      <view class="training-results" :aria-label="t('learning.batchResults')">
        <BaseStat
          :label="t('learning.reliableCorrect')"
          :value="report.correct"
          :denominator="report.submitted - report.pending"
        />
        <BaseStat :label="t('learning.partial')" :value="report.partial" />
        <BaseStat :label="t('learning.pending')" :value="report.pending" />
      </view>
      <text class="training-meta"
        >{{ t('learning.kjm') }}{{ report.independentCorrect }}{{ t('learning.kmi') }}{{ report.helped
        }}{{ t('learning.ks6') }}</text
      >
      <view v-for="row in report.rows" :key="row.questionKey" class="training-result-row">
        <view class="training-result-heading"
          ><text>{{
            t('learning.trainingQuestionLabel', {
              index: row.index + 1,
              topic: learningText(row.question.knowledgePoint || report.module.label)
            })
          }}</text>
          <BaseTag
            :tone="row.grade.status !== 'reliable' ? 'apricot' : row.grade.outcome === 'correct' ? 'mint' : 'coral'"
            >{{ learningText(outcomeLabel(row.grade)) }}</BaseTag
          ></view
        >
        <text class="training-prompt" selectable>{{ row.question.prompt }}</text>
        <text class="training-original" selectable>{{ t('learning.kcd') }}{{ row.attempt.answer }}</text>
        <text v-if="row.grade.status !== 'reliable'" class="training-meta">{{ t('learning.kpv') }}</text>
        <view class="button-row">
          <BaseButton :disabled="locked" :aria-disabled="locked" variant="quiet" @tap="explain(row.questionKey)">{{
            t('learning.kdu')
          }}</BaseButton>
          <BaseButton variant="quiet" @tap="openQuestion(row.questionKey)">{{ t('learning.kd9') }}</BaseButton>
          <BaseButton
            v-if="row.grade.status === 'reliable'"
            variant="quiet"
            :aria-expanded="!!bases[row.questionKey]"
            @tap="bases[row.questionKey] = !bases[row.questionKey]"
            >{{ t('learning.viewGradingBasis') }}</BaseButton
          >
        </view>
        <text v-if="bases[row.questionKey]" class="training-meta" selectable>{{
          t('learning.k3n', { v0: row.grade.basis })
        }}</text>
        <text v-if="explanations[row.questionKey]" class="training-explanation" selectable>{{
          explanations[row.questionKey]
        }}</text>
      </view>
    </template>
    <view v-if="message" class="training-message"
      ><BaseEmpty v-if="failed" state="error" :title="learningText(message)" mascot-size="small" /><text v-else>{{
        learningText(message)
      }}</text></view
    >
  </BaseCard>
</template>
<script setup>
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseOptions from '@/components/base/base-options/base-options.vue';
import BaseStat from '@/components/base/base-stat/base-stat.vue';
import BaseTag from '@/components/base/base-tag/base-tag.vue';
import { learningText } from '@/i18n/learning.js';
import { publicError, t } from '@/i18n/index.js';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { dayKey } from '@/services/learning/learning-domain.js';
import { writingAnswerLimit } from '../../../../laf-backend/functions/_shared/learning-writing.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
const learning = useConversationLearningStore();
const report = computed(() => learning.trainingResult),
  root = ref(null),
  answers = ref([]),
  explanations = ref({}),
  bases = ref({});
const message = ref(''),
  failed = ref(false),
  time = ref(Date.now());
const locked = computed(
  () =>
    !!learning.active?.stopped || learning.busy || learning.syncBusy || learning.historyBusy || learning.materialBusy
);
const answered = computed(() => answers.value.filter((a) => a?.trim()).length);
const due = computed(() => report.value && dayKey(time.value, report.value.timezone) >= report.value.day);
const remaining = computed(() => {
  const seconds = Math.max(
    0,
    Math.ceil(((report.value?.at || 0) + (report.value?.minutes || 0) * 60000 - time.value) / 1000)
  );
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
});
let unbind = () => undefined,
  timer = null;
function stopClock() {
  if (timer !== null) clearInterval(timer);
  timer = null;
}
function startClock() {
  stopClock();
  time.value = Date.now();
  if (typeof document !== 'undefined' && document.hidden) return;
  timer = setInterval(() => {
    time.value = Date.now();
  }, 1000);
}
function inputValue(event) {
  return event.detail?.value ?? event.target?.value ?? '';
}
function setAnswer(index, value) {
  if (!locked.value && !report.value.submittedBy) answers.value[index] = value;
}
function choiceValue(option, index) {
  return /^([A-H])\s*[.、．：:]/u.exec(option)?.[1] || String.fromCharCode(65 + index);
}
function answerLimit(question) {
  return question.writingExercise ? writingAnswerLimit(question) : 8000;
}
function reveal(id = 'learning-training-panel') {
  // #ifdef H5
  const element = document.getElementById(id);
  element?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
  element?.focus?.({ preventScroll: true });
  // #endif
  // #ifndef H5
  uni.pageScrollTo?.({ selector: `#${id}`, duration: 0 });
  // #endif
}
defineExpose({ reveal });
function locate(index) {
  uni.pageScrollTo?.({ selector: `#training-question-${index}`, duration: 0 });
}
function discuss(key) {
  if (!locked.value) {
    learning.focus(key);
    uni.pageScrollTo?.({ selector: '#learning-composer', duration: 0 });
  }
}
function submit() {
  if (locked.value || !due.value) return;
  try {
    learning.submitTraining(learning.journeyContext(), report.value.id, [...answers.value]);
    answers.value = [];
    message.value = '整批原答已保存';
    failed.value = false;
  } catch (error) {
    message.value = publicError(error);
    failed.value = true;
  }
}
function explain(key) {
  if (locked.value) return;
  try {
    explanations.value[key] = learning.openTrainingFeedback(learning.journeyContext(), report.value.id, key);
  } catch (error) {
    message.value = publicError(error);
    failed.value = true;
  }
}
async function openQuestion(key) {
  learning.focus(key);
  learning.selectTraining(null);
  await nextTick();
  reveal('active-learning-question');
}
function outcomeLabel(grade) {
  return grade?.status !== 'reliable'
    ? '待核对'
    : { correct: '本题正确', wrong: '本题需调整', partial: '部分正确' }[grade.outcome];
}
watch(
  () => `${learning.recordContext()}:${learning.selectedConversationId}:${report.value?.id || ''}`,
  () => {
    answers.value = [];
    explanations.value = {};
    bases.value = {};
    message.value = '';
    time.value = Date.now();
  }
);
onShow(startClock);
onHide(stopClock);
onMounted(() => {
  unbind = bindLearningKeyboard(root.value);
  startClock();
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', startClock);
});
onUnmounted(() => {
  stopClock();
  unbind();
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', startClock);
});
</script>
<style scoped>
.training-panel {
  margin-top: var(--s-8);
  scroll-margin-top: var(--s-5);
  scroll-margin-bottom: calc(var(--learning-composer-height, var(--control-height)) + var(--s-6));
}
.training-panel:focus-visible {
  outline: var(--border-selected) solid var(--focus);
  outline-offset: var(--s-1);
}
.training-heading,
.training-result-heading,
.training-submit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
}
.training-title {
  display: block;
  font-size: var(--size-title-2);
  font-weight: var(--weight-ui-emphasis);
  line-height: 1.4;
}
.training-meta {
  display: block;
  font-size: var(--size-caption);
  line-height: 1.7;
  color: var(--ink-3);
  margin: var(--s-2) 0;
  overflow-wrap: anywhere;
}
.answer-sheet {
  margin: var(--s-5) 0 var(--s-6);
}
.answer-sheet-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}
.training-question,
.training-result-row {
  margin-top: var(--s-6);
  padding-top: var(--s-5);
  border-top: var(--border-thin) solid var(--line);
}
.training-question-label {
  display: block;
  font-size: var(--size-small);
  font-weight: var(--weight-ui-emphasis);
  margin-bottom: var(--s-3);
}
.training-prompt,
.training-original,
.training-explanation {
  display: block;
  font-size: var(--size-body);
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-width: 70ch;
}
.training-original {
  margin-top: var(--s-3);
}
.training-explanation {
  margin-top: var(--s-4);
}
.training-answer {
  display: grid;
  gap: var(--s-2);
  font-size: var(--size-small);
  margin-top: var(--s-4);
}
.training-answer .writing-answer {
  min-height: var(--mascot-large);
}
.training-options {
  display: grid;
  gap: var(--s-2);
  margin-top: var(--s-4);
}
.training-submit-row {
  margin-top: var(--s-6);
}
.training-results {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--s-3);
  margin: var(--s-5) 0;
}
.training-results > view {
  display: grid;
  gap: var(--s-2);
  font-size: var(--size-caption);
}
.training-result-heading {
  font-size: var(--size-small);
  font-weight: var(--weight-ui-emphasis);
  margin-bottom: var(--s-3);
  flex-wrap: wrap;
}
.training-message {
  display: block;
  margin-top: var(--s-4);
  font-size: var(--size-small);
  line-height: 1.7;
}
@media (max-width: 520px) {
  .training-title {
    font-size: var(--size-title-3);
  }
  .training-heading,
  .training-submit-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
