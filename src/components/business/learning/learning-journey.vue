<template>
  <BaseCard
    v-if="learning.active"
    ref="root"
    class="journey-panel"
    :class="{ 'journey-inline': inline }"
    data-test="learning-journey"
    padding="none"
  >
    <view class="journey-heading">
      <view>
        <text v-if="!inline" class="journey-title">{{ program?.title || learning.active.goal }}</text>
        <text v-if="program" class="journey-meta">
          {{
            program.startsLater
              ? t('learning.krk', { v0: program.startDay })
              : t('learning.km0', { v0: program.dayIndex, v1: program.durationDays })
          }}{{ t('learning.ksv') }}{{ program.completedDays }}{{ t('learning.kqh') }}{{ learningText(modeName) }}
        </text>
      </view>
      <BaseButton :aria-expanded="editing" variant="quiet" @tap="edit">
        {{ editing ? t('learning.kcz') : program ? t('learning.k1m') : t('learning.klc') }}
      </BaseButton>
    </view>
    <view v-if="editing" class="journey-form">
      <label
        ><text>{{ t('learning.kfl') }}</text
        ><BaseInput v-model="form.title" maxlength="160" :label="t('learning.kr3')"
      /></label>
      <view class="journey-fields">
        <label
          ><text>{{ t('learning.k3g') }}</text
          ><BaseInput v-model="form.startDay" placeholder="YYYY-MM-DD" :label="t('learning.ko5')"
        /></label>
        <label
          ><text>{{ t('learning.ktc') }}</text
          ><BaseInput v-model.number="form.durationDays" type="number" :label="t('learning.kpd')"
        /></label>
        <label
          ><text>{{ t('learning.kf8') }}</text
          ><BaseInput v-model.number="form.minutes" type="number" :label="t('learning.k8r')"
        /></label>
      </view>
      <view class="button-row" :aria-label="t('learning.k6c')">
        <BaseChip
          v-for="mode in TRAINING_MODES"
          :key="mode.id"
          :class="{ chosen: form.mode === mode.id }"
          :model-value="form.mode === mode.id"
          @update:model-value="form.mode = mode.id"
        >
          {{ learningText(mode.label) }}
        </BaseChip>
      </view>
      <text class="journey-field-label">{{ t('learning.koj') }}{{ form.moduleIds.length }} / 8</text>
      <view class="journey-module-options">
        <BaseChip
          v-for="module in JOURNEY_MODULES"
          :key="module.id"
          :class="{ chosen: form.moduleIds.includes(module.id) }"
          :model-value="form.moduleIds.includes(module.id)"
          @update:model-value="toggleModule(module.id)"
        >
          {{ learningText(module.subject) }} · {{ learningText(module.label) }}
        </BaseChip>
      </view>
      <view class="button-row">
        <BaseButton
          class="primary"
          :disabled="busy"
          :aria-disabled="busy"
          data-test="journey-save"
          variant="primary"
          @tap="save"
          >{{ t('learning.kni') }}</BaseButton
        >
        <BaseButton variant="quiet" @tap="editing = false">{{ t('learning.k8s') }}</BaseButton>
      </view>
    </view>
    <template v-if="program">
      <view class="journey-route-heading">
        <text class="section-title">{{ t('learning.kfu') }}</text>
        <text>{{ program.completed }} / {{ program.modules.length }}{{ t('learning.kcf') }}</text>
      </view>
      <view class="button-row" :aria-label="t('learning.kmh')">
        <text class="journey-meta">{{ t('learning.k5v') }}</text>
        <BaseChip
          v-for="size in [1, 2, 5, 10, 20]"
          :key="size"
          :class="{ chosen: groupSize === size }"
          :model-value="groupSize === size"
          @update:model-value="groupSize = size"
        >
          {{ size }}{{ t('learning.ko0') }}</BaseChip
        >
      </view>
      <view
        v-if="program.modules.some((m) => m.id.startsWith('writing-'))"
        class="button-row"
        :aria-label="t('learning.kdz')"
      >
        <text class="journey-meta">{{ t('learning.kg9') }}</text>
        <BaseChip
          v-for="size in [1, 2]"
          :key="size"
          :class="{ chosen: writingSize === size }"
          :model-value="writingSize === size"
          @update:model-value="writingSize = size"
        >
          {{ size }}{{ t('learning.kcp') }}</BaseChip
        >
      </view>
      <view class="journey-route" :aria-label="t('learning.ko')">
        <view
          v-for="(module, index) in program.modules"
          :key="module.id"
          class="journey-step"
          :class="{ 'is-current': program.current?.id === module.id }"
        >
          <text class="journey-step-number">{{ index + 1 }}</text>
          <view class="journey-step-copy">
            <text class="journey-step-title">{{ learningText(module.label) }}</text>
            <text class="journey-meta">{{ learningText(module.goal) }}</text>
            <text v-if="module.group?.submittedBy" class="journey-meta"
              >{{ t('learning.kj3') }}{{ module.correct }} / {{ module.reliable }}{{ t('learning.kbs')
              }}{{ module.pending }}</text
            >
          </view>
          <text class="journey-step-state">{{ learningText(module.status) }}</text>
          <BaseButton
            :disabled="busy || learning.active.stopped"
            :aria-disabled="busy || learning.active.stopped"
            :data-test="`journey-module-${module.id}`"
            variant="quiet"
            @tap="startModule(module)"
          >
            {{ module.group ? (module.group.submittedBy ? t('learning.k1g') : t('learning.k5l')) : t('learning.kmt') }}
          </BaseButton>
        </view>
      </view>
      <view v-if="!inline" class="journey-score" :aria-label="t('learning.kbn')">
        <BaseStat
          :label="t('learning.reliableCorrect')"
          :value="stats.reliableCorrectAnswers"
          :denominator="stats.totalReliableAnswers"
        />
        <BaseStat :label="t('learning.pending')" :value="stats.pending" />
        <BaseStat :label="t('learning.kti')" :value="stats.mistakes.length" />
      </view>
      <text class="journey-meta">{{ program.day }}{{ t('learning.kps') }}{{ program.timezone }}</text>
      <slot></slot>
      <TrainingGroup v-if="learning.batchTrainingActive" />
      <JourneyReview />
      <JourneyReminders />
    </template>
    <view v-if="message" class="journey-feedback"
      ><BaseEmpty v-if="failed" state="error" :title="learningText(message)" mascot-size="small" /><text v-else>{{
        learningText(message)
      }}</text></view
    >
  </BaseCard>
</template>
<script setup>
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import { learningText } from '@/i18n/learning.js';
import { t } from '@/i18n/index.js';
import BaseStat from '@/components/base/base-stat/base-stat.vue';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';
import BaseChip from '@/components/base/base-chip/base-chip.vue';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { dayKey } from '@/services/learning/learning-domain.js';
import { JOURNEY_MODULES, TRAINING_MODES } from '../../../../laf-backend/functions/_shared/learning-journey.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import TrainingGroup from './training-group.vue';
import JourneyReview from './journey-review.vue';
import JourneyReminders from './journey-reminders.vue';
const learning = useConversationLearningStore();
defineProps({ inline: Boolean });
const root = ref(null),
  editing = ref(false),
  message = ref(''),
  failed = ref(false);
const program = computed(() => learning.journey);
const stats = computed(() => learning.journeySummary);
const busy = computed(() => learning.busy || learning.syncBusy || learning.materialBusy || learning.historyBusy);
const modeName = computed(() => TRAINING_MODES.find((m) => m.id === program.value?.mode)?.label || '');
const form = ref({}),
  context = ref('');
const groupSize = ref(5),
  writingSize = ref(2);
let unbind = () => undefined;
function reset() {
  const saved = learning.active?.journey;
  form.value = saved
    ? {
        title: saved.title,
        startDay: saved.startDay,
        durationDays: saved.durationDays,
        minutes: saved.minutes,
        mode: saved.mode,
        moduleIds: [...saved.moduleIds]
      }
    : {
        title: learning.active?.goal?.slice(0, 160) || '',
        startDay: dayKey(Date.now(), learning.state.timezone),
        durationDays: 30,
        minutes: 40,
        mode: 'batch',
        moduleIds: ['arithmetic-add']
      };
  context.value = learning.journeyContext();
}
function edit() {
  if (!editing.value) reset();
  editing.value = !editing.value;
  message.value = '';
}
function toggleModule(id) {
  const ids = form.value.moduleIds;
  if (ids.includes(id)) form.value.moduleIds = ids.filter((value) => value !== id);
  else if (ids.length < 8) form.value.moduleIds = [...ids, id];
}
function save() {
  if (busy.value) return;
  try {
    learning.configureJourney(context.value, form.value);
    editing.value = false;
    message.value = '学习路线已保存';
    failed.value = false;
  } catch (error) {
    message.value = error.message;
    failed.value = true;
  }
}
function startModule(module) {
  if (busy.value || learning.active.stopped) return;
  try {
    if (module.group) learning.selectTraining(module.group.id);
    else
      learning.startTraining(
        learning.journeyContext(),
        module.id,
        module.id.startsWith('writing-') ? writingSize.value : groupSize.value
      );
    message.value = '';
    failed.value = false;
  } catch (error) {
    message.value = error.message;
    failed.value = true;
  }
}
watch(
  () => learning.selectedConversationId,
  () => {
    editing.value = false;
    message.value = '';
    reset();
  }
);
onMounted(() => {
  reset();
  unbind = bindLearningKeyboard(root.value);
});
onUnmounted(() => unbind());
</script>
<style scoped>
.journey-panel {
  margin: var(--s-5) 0 var(--s-6);
  padding: var(--s-6);
  color: var(--ink);
}
.journey-panel.journey-inline {
  padding: 0;
  margin: var(--s-4) 0 var(--s-8);
  background: transparent;
  border-radius: 0;
}
.journey-heading,
.journey-route-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--s-4);
}
.journey-title {
  display: block;
  font-size: var(--size-title-2);
  font-weight: var(--weight-semibold);
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.journey-meta {
  display: block;
  color: var(--ink-3);
  font-size: var(--size-caption);
  line-height: 1.7;
  margin-top: var(--s-2);
  overflow-wrap: anywhere;
}
.journey-form {
  display: grid;
  gap: var(--s-4);
  margin-top: var(--s-6);
}
.journey-form label {
  display: grid;
  gap: var(--s-2);
  font-size: var(--size-small);
}
.journey-fields {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: var(--s-3);
}
.journey-module-options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2);
}
.journey-route-heading {
  margin: var(--s-6) 0 var(--s-3);
  font-size: var(--size-caption);
}
.journey-route {
  display: grid;
}
.journey-step {
  display: flex;
  gap: var(--s-3);
  align-items: center;
  padding: var(--s-4) 0;
  border-bottom: var(--border-thin) solid var(--line);
}
.journey-step-number {
  font-size: var(--size-body);
  font-variant-numeric: tabular-nums;
  color: var(--ink-3);
  width: var(--s-6);
  flex-shrink: 0;
}
.journey-step-copy {
  flex: 1;
  min-width: 0;
}
.journey-step-title {
  font-size: var(--size-body);
  font-weight: var(--weight-medium);
}
.journey-step-state {
  font-size: var(--size-caption);
  flex-shrink: 0;
}
.is-current .journey-step-title {
  font-weight: var(--weight-bold);
}
.journey-score {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--s-4);
  margin: var(--s-6) 0 var(--s-3);
}
.journey-score > view {
  display: grid;
  gap: var(--s-2);
  font-size: var(--size-caption);
  color: var(--ink-3);
}
.journey-score-value {
  font-size: var(--size-title-2);
  line-height: 1.4;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.journey-feedback {
  display: block;
  margin-top: var(--s-3);
  font-size: var(--size-small);
  line-height: 1.7;
}
@media (max-width: 520px) {
  .journey-panel {
    padding: var(--s-4);
  }
  .journey-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .journey-title {
    font-size: var(--size-title-3);
  }
  .journey-fields {
    grid-template-columns: 1fr;
  }
  .journey-score {
    gap: var(--s-2);
  }
  .journey-score-value {
    font-size: var(--size-title-3);
  }
}
</style>
