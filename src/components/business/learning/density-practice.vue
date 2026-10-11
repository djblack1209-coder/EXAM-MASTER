<template>
  <view v-if="visible" class="density-practice">
    <text class="density-heading">{{ heading }}</text>
    <view class="density-actions">
      <BaseButton
        :tabindex="unavailable ? -1 : 0"
        :disabled="unavailable"
        :aria-disabled="unavailable"
        variant="quiet"
        @tap="readMethod"
        >{{ t('learning.kcg') }}</BaseButton
      >
      <BaseButton
        :tabindex="unavailable ? -1 : 0"
        :disabled="unavailable"
        :aria-disabled="unavailable"
        variant="quiet"
        @tap="independent"
        >{{ t('learning.k2a') }}</BaseButton
      >
    </view>
    <text v-if="methodVisible" class="density-method" role="status">{{ method }}</text>
    <BaseEmpty v-if="error" state="error" :title="learningText(error)" mascot-size="small" />
    <BaseEmpty v-if="!input" state="error" :title="t('learning.kd4')" mascot-size="small" />
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
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import { learningText } from '@/i18n/learning.js';
import { t } from '@/i18n/index.js';
import BaseButton from '@/components/base/base-button/base-button.vue';

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
  padding: var(--s-4);
}
.density-heading {
  display: block;
  font-weight: var(--weight-bold);
}
.density-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
  margin: var(--s-3) 0;
}
.density-method {
  display: block;
  line-height: 1.7;
}
.density-source {
  margin-top: var(--s-2);
  overflow-wrap: anywhere;
}
</style>
