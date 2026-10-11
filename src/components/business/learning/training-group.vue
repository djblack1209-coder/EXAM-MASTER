<template>
  <view v-if="report" ref="root" class="training-panel" data-test="training-group">
    <view class="training-heading">
      <view
        ><text class="training-title">{{ report.module.label }} · {{ report.questionKeys.length }}题</text>
        <text class="training-meta"
          >{{ report.day }} · {{ report.mode === 'timed' ? '限时训练' : '整批训练' }} · 建议
          {{ report.minutes }} 分钟</text
        ></view
      >
      <text v-if="report.mode === 'timed' && !report.submittedBy" class="training-clock" role="timer">{{
        remaining
      }}</text>
    </view>
    <template v-if="!report.submittedBy">
      <view class="answer-sheet" aria-label="整批答题卡">
        <text class="training-meta">已答 {{ answered }} / {{ report.questionKeys.length }}</text>
        <view class="answer-sheet-grid">
          <button
            v-for="(row, index) in report.rows"
            :key="row.questionKey"
            role="button"
            tabindex="0"
            :aria-label="`定位第${index + 1}题${answers[index]?.trim() ? '，已填草稿' : '，未答'}`"
            :class="{ chosen: answers[index]?.trim() }"
            @tap="locate(index)"
          >
            {{ index + 1 }}
          </button>
        </view>
      </view>
      <view
        v-for="(row, index) in report.rows"
        :id="`training-question-${index}`"
        :key="row.questionKey"
        class="training-question"
      >
        <text class="training-question-label"
          >第 {{ index + 1 }} 题 · {{ row.question.knowledgePoint || report.module.label }}</text
        >
        <text class="training-prompt" selectable>{{ row.question.prompt }}</text>
        <button role="button" tabindex="0" :disabled="locked" :aria-disabled="locked" @tap="discuss(row.questionKey)">
          问这题
        </button>
        <view v-if="row.question.options?.length" class="training-options">
          <button
            v-for="(option, optionIndex) in row.question.options"
            :key="optionIndex"
            role="button"
            tabindex="0"
            :aria-pressed="answers[index] === choiceValue(option, optionIndex)"
            :disabled="locked"
            :aria-disabled="locked"
            :class="{ chosen: answers[index] === choiceValue(option, optionIndex) }"
            @tap="setAnswer(index, choiceValue(option, optionIndex))"
          >
            {{ option }}
          </button>
        </view>
        <label v-else class="training-answer">
          <text>{{ row.question.answerType === 'subjective' ? '写作草稿' : '作答草稿' }}</text>
          <textarea
            :value="answers[index] || ''"
            :aria-label="`训练第${index + 1}题作答`"
            :maxlength="answerLimit(row.question)"
            :disabled="locked"
            :aria-disabled="locked"
            :class="{ 'writing-answer': row.question.answerType === 'subjective' }"
            @input="setAnswer(index, inputValue($event))"
          ></textarea>
        </label>
      </view>
      <view class="training-submit-row">
        <text class="training-meta">{{ report.questionKeys.length - answered }} 题未答</text>
        <button
          class="primary"
          role="button"
          tabindex="0"
          data-test="training-submit"
          :disabled="locked || answered !== report.questionKeys.length || !due"
          :aria-disabled="locked || answered !== report.questionKeys.length || !due"
          @tap="submit"
        >
          统一交卷并批改
        </button>
      </view>
      <text v-if="!due" class="training-meta">{{ report.day }} 到期后可提交</text>
    </template>
    <template v-else>
      <view class="training-results" aria-label="整批作答结果">
        <view
          ><text>可靠正确</text
          ><text class="training-result-number"
            >{{ report.correct }} / {{ report.submitted - report.pending }}</text
          ></view
        >
        <view
          ><text>部分正确</text><text class="training-result-number">{{ report.partial }}</text></view
        >
        <view
          ><text>待核对</text><text class="training-result-number">{{ report.pending }}</text></view
        >
      </view>
      <text class="training-meta"
        >独立正确 {{ report.independentCorrect }} · 提示后作答 {{ report.helped }} · 本组已提交</text
      >
      <view v-for="row in report.rows" :key="row.questionKey" class="training-result-row">
        <view class="training-result-heading"
          ><text>第 {{ row.index + 1 }} 题 · {{ row.question.knowledgePoint || report.module.label }}</text>
          <text>{{ outcomeLabel(row.grade) }}</text></view
        >
        <text class="training-prompt" selectable>{{ row.question.prompt }}</text>
        <text class="training-original" selectable>原答：{{ row.attempt.answer }}</text>
        <text class="training-meta">{{
          row.grade.status === 'reliable' ? `判分依据：${row.grade.basis}` : '原答已保存，反馈待核对'
        }}</text>
        <view class="button-row">
          <button role="button" tabindex="0" :disabled="locked" :aria-disabled="locked" @tap="explain(row.questionKey)">
            查看解析
          </button>
          <button role="button" tabindex="0" @tap="openQuestion(row.questionKey)">回到原题</button>
        </view>
        <text v-if="explanations[row.questionKey]" class="training-explanation" selectable>{{
          explanations[row.questionKey]
        }}</text>
      </view>
    </template>
    <text v-if="message" :class="{ warning: failed }" :role="failed ? 'alert' : 'status'" class="training-message">{{
      message
    }}</text>
  </view>
</template>
<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { dayKey } from '@/services/learning/learning-domain.js';
import { writingAnswerLimit } from '../../../../laf-backend/functions/_shared/learning-writing.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
const learning = useConversationLearningStore();
const report = computed(() => learning.trainingResult),
  root = ref(null),
  answers = ref([]),
  explanations = ref({});
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
    message.value = error.message;
    failed.value = true;
  }
}
function explain(key) {
  if (locked.value) return;
  try {
    explanations.value[key] = learning.openTrainingFeedback(learning.journeyContext(), report.value.id, key);
  } catch (error) {
    message.value = error.message;
    failed.value = true;
  }
}
function openQuestion(key) {
  learning.focus(key);
  learning.selectTraining(null);
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
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid var(--space-line);
}
.training-heading,
.training-result-heading,
.training-submit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.training-title {
  display: block;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.4;
}
.training-meta {
  display: block;
  font-size: 12px;
  line-height: 1.7;
  color: var(--space-muted);
  margin: 8px 0;
  overflow-wrap: anywhere;
}
.training-clock,
.training-result-number {
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}
.answer-sheet {
  margin: 20px 0 24px;
}
.answer-sheet-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.answer-sheet-grid button {
  min-width: 44px;
}
.training-question,
.training-result-row {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--space-line);
}
.training-question-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
}
.training-prompt,
.training-original,
.training-explanation {
  display: block;
  font-size: 16px;
  line-height: 1.75;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-width: 70ch;
}
.training-original {
  margin-top: 12px;
}
.training-explanation {
  margin-top: 16px;
}
.training-answer {
  display: grid;
  gap: 8px;
  font-size: 14px;
  margin-top: 16px;
}
.training-answer textarea {
  width: 100%;
  min-height: 88px;
  padding: 12px;
  box-sizing: border-box;
  border: 1px solid var(--space-line);
  border-radius: 12px;
  color: inherit;
  font: inherit;
  line-height: 1.75;
}
.training-answer .writing-answer {
  min-height: 180px;
}
.training-options {
  display: grid;
  gap: 8px;
  margin-top: 16px;
}
.training-options button {
  text-align: left;
  justify-content: flex-start;
  white-space: normal;
}
.training-submit-row {
  margin-top: 24px;
}
.training-results {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 20px 0;
}
.training-results > view {
  display: grid;
  gap: 8px;
  font-size: 12px;
}
.training-result-heading {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.training-message {
  display: block;
  margin-top: 16px;
  font-size: 14px;
  line-height: 1.7;
}
@media (max-width: 520px) {
  .training-title {
    font-size: 20px;
  }
  .training-heading,
  .training-submit-row {
    align-items: flex-start;
    flex-direction: column;
  }
  .training-result-number {
    font-size: 20px;
  }
}
</style>
