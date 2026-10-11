<template>
  <view ref="root" class="sentence-builder" :aria-label="t('learning.kho')">
    <view class="sentence-frame" :aria-label="t('learning.k1c')" aria-live="polite">
      <text>{{ exercise.prefix }}</text>
      <BaseChip
        v-for="(id, index) in selected"
        :key="id"
        :aria-label="t('learning.krq', { v0: index + 1, v1: tileText(id) })"
        :class="{ chosen: activeIndex === index }"
        :disabled="locked"
        :aria-disabled="locked"
        :model-value="activeIndex === index"
        @update:model-value="activate(index)"
      >
        {{ learningText(tileText(id)) }}
      </BaseChip>
      <text v-for="index in exercise.slots - selected.length" :key="`blank-${index}`" class="empty-slot">_____</text>
      <text>{{ exercise.suffix }}</text>
    </view>
    <view class="tile-bank" :aria-label="t('learning.k6f')">
      <BaseButton
        v-for="tile in exercise.tiles"
        :key="tile.id"
        :disabled="locked || selected.includes(tile.id) || selected.length === exercise.slots"
        :aria-disabled="locked || selected.includes(tile.id) || selected.length === exercise.slots"
        variant="quiet"
        @tap="choose(tile.id)"
      >
        {{ tile.text }}
      </BaseButton>
    </view>
    <view class="sentence-actions" :aria-label="t('learning.ko9')">
      <BaseButton
        :disabled="locked || activeIndex <= 0"
        :aria-disabled="locked || activeIndex <= 0"
        :aria-label="t('learning.ki')"
        variant="quiet"
        @tap="move(-1)"
      >
        <BaseIcon name="arrow-left" tone="ink-3" />
      </BaseButton>
      <BaseButton
        :disabled="locked || activeIndex < 0 || activeIndex >= selected.length - 1"
        :aria-disabled="locked || activeIndex < 0 || activeIndex >= selected.length - 1"
        :aria-label="t('learning.ki7')"
        variant="quiet"
        @tap="move(1)"
      >
        <BaseIcon name="arrow-right" tone="ink-3" />
      </BaseButton>
      <BaseButton
        :disabled="locked || activeIndex < 0"
        :aria-disabled="locked || activeIndex < 0"
        variant="quiet"
        @tap="remove"
        >{{ t('learning.k3f') }}</BaseButton
      >
      <BaseButton
        :disabled="locked || !selected.length"
        :aria-disabled="locked || !selected.length"
        variant="quiet"
        @tap="clear"
        >{{ t('learning.khm') }}</BaseButton
      >
    </view>
    <view class="sentence-actions">
      <BaseButton
        class="primary"
        :disabled="locked || !ready || !complete || unchanged"
        :aria-disabled="locked || !ready || !complete || unchanged"
        variant="primary"
        @tap="save"
        >{{ t('learning.kbf') }}</BaseButton
      >
      <BaseButton :disabled="locked" :aria-disabled="locked" variant="quiet" @tap="showHelp">{{
        t('learning.km7')
      }}</BaseButton>
      <BaseButton
        v-if="attempt || hint"
        :disabled="locked"
        :aria-disabled="locked"
        variant="quiet"
        @tap="run(() => nextTask(context))"
        >{{ t('learning.k6y') }}</BaseButton
      >
      <BaseButton
        v-if="attempt"
        :disabled="locked || !!retest"
        :aria-disabled="locked || !!retest"
        variant="quiet"
        @tap="run(() => scheduleRetest(context))"
      >
        {{ retest ? t('learning.kf0', { v0: retest.day.slice(5).replace('-', '/') }) : t('learning.k2m') }}
      </BaseButton>
    </view>
    <text v-if="stopped" class="sentence-note">{{ t('learning.keb') }}</text>
    <text v-else-if="!ready && exercise.dueDay" class="sentence-note"
      >{{ exercise.dueDay.slice(5).replace('-', '/') }}{{ t('learning.kd5') }}</text
    >
    <text v-if="hint" class="sentence-note" role="status">{{ hint }}</text>
    <text v-if="result" class="sentence-note" role="status">{{ result }}</text>
    <BaseEmpty v-if="error" state="error" :title="learningText(error)" mascot-size="small" />
    <text class="sentence-note">{{ t('learning.kon') }}</text>
    <!-- #ifdef H5 -->
    <a class="sentence-source" :href="SENTENCE_BASIS.teachingUrl" target="_blank" rel="noopener noreferrer">{{
      t('learning.kn3')
    }}</a>
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <text class="sentence-note" selectable>{{ SENTENCE_BASIS.teachingUrl }}</text>
    <!-- #endif -->
  </view>
</template>

<script setup>
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import { learningText } from '@/i18n/learning.js';
import { t } from '@/i18n/index.js';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';

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
  padding: var(--s-5);
  margin: var(--s-5) 0;
  border: var(--border-thin) solid var(--line);
  border-radius: var(--s-6);
  background: var(--paper);
  color: var(--ink);
  overflow-wrap: anywhere;
}
.sentence-frame,
.tile-bank,
.sentence-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--s-3);
  margin-bottom: var(--s-4);
}
.sentence-frame {
  min-height: var(--s-14);
  font-size: var(--size-title-3);
  line-height: 1.6;
}
.sentence-note {
  display: block;
  margin: var(--s-3) 0;
  line-height: 1.6;
}
.empty-slot {
  min-width: var(--touch-min);
  color: var(--ink-3);
}
.sentence-source {
  display: inline-flex;
  align-items: center;
  min-height: var(--touch-min);
  color: inherit;
}
@media (max-width: 480px) {
  .sentence-builder {
    padding: var(--s-4);
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
