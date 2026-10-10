<template>
  <view ref="root" class="sentence-builder" aria-label="英文句子组织">
    <view class="sentence-frame" aria-label="我的句子" aria-live="polite">
      <text>{{ exercise.prefix }}</text>
      <button
        v-for="(id, index) in selected"
        :key="id"
        role="button"
        tabindex="0"
        :aria-label="`第${index + 1}个词块：${tileText(id)}`"
        :aria-pressed="activeIndex === index"
        :class="{ chosen: activeIndex === index }"
        :disabled="locked"
        :aria-disabled="locked"
        @tap="activate(index)"
      >
        {{ tileText(id) }}
      </button>
      <text v-for="index in exercise.slots - selected.length" :key="`blank-${index}`" class="empty-slot">_____</text>
      <text>{{ exercise.suffix }}</text>
    </view>
    <view class="tile-bank" aria-label="可选词块">
      <button
        v-for="tile in exercise.tiles"
        :key="tile.id"
        role="button"
        tabindex="0"
        :disabled="locked || selected.includes(tile.id) || selected.length === exercise.slots"
        :aria-disabled="locked || selected.includes(tile.id) || selected.length === exercise.slots"
        @tap="choose(tile.id)"
      >
        {{ tile.text }}
      </button>
    </view>
    <view class="sentence-actions" aria-label="调整词块">
      <button
        role="button"
        tabindex="0"
        :disabled="locked || activeIndex <= 0"
        :aria-disabled="locked || activeIndex <= 0"
        aria-label="词块向左移"
        @tap="move(-1)"
      >
        <BaseIcon name="arrow-left" :size="24" />
      </button>
      <button
        role="button"
        tabindex="0"
        :disabled="locked || activeIndex < 0 || activeIndex >= selected.length - 1"
        :aria-disabled="locked || activeIndex < 0 || activeIndex >= selected.length - 1"
        aria-label="词块向右移"
        @tap="move(1)"
      >
        <BaseIcon name="arrow-right" :size="24" />
      </button>
      <button
        role="button"
        tabindex="0"
        :disabled="locked || activeIndex < 0"
        :aria-disabled="locked || activeIndex < 0"
        @tap="remove"
      >
        撤回词块
      </button>
      <button
        role="button"
        tabindex="0"
        :disabled="locked || !selected.length"
        :aria-disabled="locked || !selected.length"
        @tap="clear"
      >
        重新排列
      </button>
    </view>
    <view class="sentence-actions">
      <button
        class="primary"
        role="button"
        tabindex="0"
        :disabled="locked || !ready || !complete || unchanged"
        :aria-disabled="locked || !ready || !complete || unchanged"
        @tap="save"
      >
        提交句子
      </button>
      <button role="button" tabindex="0" :disabled="locked" :aria-disabled="locked" @tap="showHelp">看句子提示</button>
      <button
        v-if="attempt || hint"
        role="button"
        tabindex="0"
        :disabled="locked"
        :aria-disabled="locked"
        @tap="run(() => nextTask(context))"
      >
        独立新句子
      </button>
      <button
        v-if="attempt"
        role="button"
        tabindex="0"
        :disabled="locked || !!retest"
        :aria-disabled="locked || !!retest"
        @tap="run(() => scheduleRetest(context))"
      >
        {{ retest ? `已安排 ${retest.day.slice(5).replace('-', '/')}` : '明日复测' }}
      </button>
    </view>
    <text v-if="stopped" class="sentence-note">已停止</text>
    <text v-else-if="!ready && exercise.dueDay" class="sentence-note"
      >{{ exercise.dueDay.slice(5).replace('-', '/') }}复测</text
    >
    <text v-if="hint" class="sentence-note" role="status">{{ hint }}</text>
    <text v-if="result" class="sentence-note" role="status">{{ result }}</text>
    <text v-if="error" class="sentence-note" role="alert">{{ error }}</text>
    <text class="sentence-note">原创练习 · 只核对本题组合</text>
    <!-- #ifdef H5 -->
    <a class="sentence-source" :href="SENTENCE_BASIS.teachingUrl" target="_blank" rel="noopener noreferrer"
      >官方任务形式 · 2026</a
    >
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <text class="sentence-note" selectable>{{ SENTENCE_BASIS.teachingUrl }}</text>
    <!-- #endif -->
  </view>
</template>

<script setup>
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { SENTENCE_BASIS, sentenceAnswer } from '../../../../laf-backend/functions/_shared/learning-sentence.js';
const props = defineProps({
  question: { type: Object, required: true },
  state: { type: Object, required: true },
  context: { type: String, required: true },
  visible: { type: Boolean, default: true },
  stopped: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  ready: { type: Boolean, default: true },
  retest: { type: Object, default: null },
  submitOrder: { type: Function, required: true },
  recordHelp: { type: Function, required: true },
  nextTask: { type: Function, required: true },
  scheduleRetest: { type: Function, required: true }
});
const root = ref(null),
  selected = ref([]),
  activeIndex = ref(-1),
  hint = ref(''),
  error = ref('');
const exercise = computed(() => props.question.sentenceExercise);
const locked = computed(() => props.stopped || props.busy || !props.visible);
const complete = computed(() => selected.value.length === exercise.value.slots);
const attempt = computed(() =>
  props.state.attempts.filter((a) => a.questionKey === `${props.question.id}@${props.question.version}`).at(-1)
);
const unchanged = computed(
  () => complete.value && attempt.value?.answer === sentenceAnswer(props.question, selected.value)
);
const result = computed(() =>
  !attempt.value
    ? ''
    : attempt.value.grade.status !== 'reliable' || attempt.value.corrections?.length
      ? '本次作答待核对。'
      : attempt.value.grade.outcome === 'correct'
        ? '本题组合正确。'
        : '本题组合需调整。'
);
const tileText = (id) => exercise.value.tiles.find((tile) => tile.id === id).text;
function activate(index) {
  if (!locked.value) activeIndex.value = index;
}
function choose(id) {
  if (locked.value || selected.value.includes(id) || selected.value.length === exercise.value.slots) return;
  selected.value.push(id);
  activeIndex.value = selected.value.length - 1;
  error.value = '';
}
function move(direction) {
  const i = activeIndex.value,
    next = i + direction;
  if (locked.value || i < 0 || next < 0 || next >= selected.value.length) return;
  [selected.value[i], selected.value[next]] = [selected.value[next], selected.value[i]];
  activeIndex.value = next;
  error.value = '';
}
function remove() {
  if (locked.value || activeIndex.value < 0) return;
  selected.value.splice(activeIndex.value, 1);
  activeIndex.value = Math.min(activeIndex.value, selected.value.length - 1);
  error.value = '';
}
function resetDraft() {
  selected.value = [];
  activeIndex.value = -1;
  error.value = '';
}
function clear() {
  if (!locked.value) resetDraft();
}
function run(action) {
  if (locked.value) return;
  error.value = '';
  try {
    return action();
  } catch (failure) {
    error.value = failure.message || '未保存，请重试。';
  }
}
function save() {
  if (!props.ready || !complete.value || unchanged.value) return;
  run(() => props.submitOrder(props.context, [...selected.value]));
}
function showHelp() {
  const saved = run(() => props.recordHelp(props.context));
  if (typeof saved === 'string') hint.value = saved;
}
watch(
  [() => props.context, () => props.state.owner, () => props.question.id, () => props.question.version],
  () => {
    resetDraft();
    hint.value = '';
  },
  { flush: 'sync' }
);
watch(
  () => props.visible,
  (value) => {
    if (!value) {
      resetDraft();
      hint.value = '';
    }
  },
  { flush: 'sync' }
);
watch(
  () => attempt.value?.id,
  () => {
    hint.value = '';
  },
  { flush: 'sync' }
);
let unbind = () => undefined;
onMounted(() => {
  unbind = bindLearningKeyboard(root.value);
});
onUnmounted(() => unbind());
</script>

<style scoped>
.sentence-builder {
  padding: 20px;
  margin: 20px 0;
  border: 1px solid var(--space-line);
  border-radius: 24px;
  background: var(--yozi-solid);
  color: var(--space-text);
  overflow-wrap: anywhere;
}
.sentence-frame,
.tile-bank,
.sentence-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.sentence-frame {
  min-height: 64px;
  font-size: 18px;
  line-height: 1.6;
}
.sentence-builder button {
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  padding: 8px 14px;
  max-width: 100%;
  color: inherit;
  background: var(--space-button, var(--yozi-solid));
  border: 1px solid var(--space-line);
  border-radius: 16px;
  box-shadow: 0 4px 0 var(--space-line);
  font: inherit;
  line-height: 1.5;
  white-space: normal;
  overflow-wrap: anywhere;
}
.sentence-builder button.chosen {
  background: var(--space-user, var(--yozi-solid));
}
.sentence-builder button.primary {
  background: var(--space-primary, #7050b0);
  color: var(--space-primary-text, #fff);
}
.sentence-builder button[disabled] {
  opacity: 0.5;
}
.sentence-builder button:focus-visible,
.sentence-source:focus-visible {
  outline: 2px solid var(--space-focus, #7050b0);
  outline-offset: 4px;
}
.sentence-note {
  display: block;
  margin: 12px 0;
  line-height: 1.6;
}
.empty-slot {
  min-width: 44px;
  color: var(--space-muted);
}
.sentence-source {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: inherit;
}
@media (max-width: 480px) {
  .sentence-builder {
    padding: 16px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sentence-builder *,
  .sentence-builder *::before {
    transition: none !important;
    animation: none !important;
  }
}
</style>
