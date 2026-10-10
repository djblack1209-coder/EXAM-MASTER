<template>
  <view v-if="visible" class="density-practice">
    <text class="density-heading">{{ heading }}</text>
    <view class="density-actions">
      <button
        role="button"
        :tabindex="unavailable ? -1 : 0"
        :disabled="unavailable"
        :aria-disabled="unavailable"
        @tap="readMethod"
      >
        看计算方法
      </button>
      <button
        role="button"
        :tabindex="unavailable ? -1 : 0"
        :disabled="unavailable"
        :aria-disabled="unavailable"
        @tap="independent"
      >
        换条件独立作答
      </button>
    </view>
    <text v-if="methodVisible" class="density-method" role="status">{{ method }}</text>
    <text v-if="error" role="alert">{{ error }}</text>
    <text v-if="!input" role="alert">本题计算条件无法读取。</text>
    <view v-if="methodVisible" class="density-source">
      <!-- #ifdef H5 -->
      <a :href="basis.url" target="_blank" rel="noopener noreferrer">{{ sourceLabel }}</a>
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <text selectable>{{ sourceLabel }}：{{ basis.url }}</text>
      <!-- #endif -->
    </view>
  </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import {
  densityInput,
  densityHelpContent,
  DENSITY_BASIS
} from '../../../../laf-backend/functions/_shared/learning-density.js';
import {
  PRESSURE_BASIS,
  pressureInput,
  pressureHelpContent
} from '../../../../laf-backend/functions/_shared/learning-pressure.js';
import {
  DENSITY_TRANSFER_CONTRACT,
  PRESSURE_TRANSFER_CONTRACT
} from '../../../../laf-backend/functions/_shared/learning-science.js';
const props = defineProps({
  question: { type: Object, default: null },
  context: { type: String, default: '' },
  visible: { type: Boolean, default: true },
  stopped: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  recordHelp: { type: Function, default: null }
});
const emit = defineEmits(['science']);
const methodVisible = ref(false),
  error = ref('');
const isPressure = computed(() => props.question?.scienceExercise?.contract === PRESSURE_TRANSFER_CONTRACT);
const heading = computed(() => (isPressure.value ? '压强、压力与接触面积' : '密度、质量与体积'));
const basis = computed(() => (isPressure.value ? PRESSURE_BASIS : DENSITY_BASIS));
const sourceLabel = computed(() => (isPressure.value ? '单位出处 · NIST' : '公式出处 · NIST'));
const input = computed(() => {
  try {
    if (isPressure.value) return pressureInput(props.question.scienceExercise.input);
    if (props.question?.scienceExercise?.contract !== DENSITY_TRANSFER_CONTRACT) return null;
    return densityInput(props.question.scienceExercise.input);
  } catch {
    return null;
  }
});
const unavailable = computed(() => !props.visible || props.stopped || props.busy || !input.value);
const method = computed(() =>
  input.value ? (isPressure.value ? pressureHelpContent(input.value) : densityHelpContent(input.value)) : ''
);
function readMethod() {
  if (unavailable.value) return;
  try {
    if (props.recordHelp?.(props.context, input.value) !== true) throw new Error('not_saved');
    methodVisible.value = true;
    error.value = '';
  } catch {
    methodVisible.value = false;
    error.value = '方法未保存，请重试。';
  }
}
function independent() {
  if (!unavailable.value) emit('science', props.context, input.value);
}
watch(
  [
    () => props.context,
    () => props.question?.id,
    () => props.question?.version,
    () => props.visible,
    () => props.stopped,
    () => props.busy,
    () => JSON.stringify(props.question?.scienceExercise)
  ],
  () => {
    methodVisible.value = false;
    error.value = '';
  }
);
</script>
<style scoped>
.density-practice {
  padding: 16px;
}
.density-heading {
  display: block;
  font-weight: 700;
}
.density-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0;
}
.density-actions button {
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  font: inherit;
}
.density-actions button:focus-visible {
  outline: 2px solid var(--primary-color, #7659d9);
  outline-offset: 2px;
}
.density-method {
  display: block;
  line-height: 1.7;
}
.density-source {
  margin-top: 8px;
  overflow-wrap: anywhere;
}
</style>
