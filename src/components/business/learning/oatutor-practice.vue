<template>
  <view ref="root" class="oatutor-practice" :aria-label="t('learning.kqp')">
    <text class="title">{{ t('learning.kh8') }}</text>
    <view class="actions" :aria-label="t('learning.kva')">
      <BaseChip
        v-for="task in OATUTOR_TASKS"
        :key="task.id"
        :class="{ selected: selected === task.id }"
        :disabled="locked"
        :aria-disabled="locked"
        :model-value="selected === task.id"
        @update:model-value="selected = task.id"
      >
        {{ learningText(task.label) }}
      </BaseChip>
      <BaseButton
        :disabled="locked || selected === exercise.itemId"
        :aria-disabled="locked || selected === exercise.itemId"
        variant="quiet"
        @tap="openTask"
        >{{ t('learning.kc6') }}</BaseButton
      >
    </view>
    <text class="note">{{ t('learning.k8x') }}</text>
    <view v-for="node in progress" :key="node.id" class="step">
      <BaseButton
        :aria-expanded="node.opened"
        :aria-controls="`oatutor-step-${node.id}`"
        :disabled="locked || !node.available"
        :aria-disabled="locked || !node.available"
        variant="quiet"
        @tap="act('open', node.id)"
      >
        {{ t('learning.kbb', { v0: node.id, v1: node.title })
        }}{{ node.complete ? (node.type === 'hint' ? t('learning.kir') : t('learning.kj1')) : '' }}
      </BaseButton>
      <text v-if="!node.available" class="note">{{ t('learning.kn7') }}</text>
      <view v-if="node.opened" :id="`oatutor-step-${node.id}`" class="step-body">
        <text class="prompt">{{ node.prompt }}</text>
        <template v-if="node.type === 'scaffold'">
          <text v-if="node.attempts.length" class="note" role="status"
            >{{ t('learning.k5h') }}{{ node.attempts.at(-1).answer }}</text
          >
          <BaseInput
            :model-value="drafts[node.id] || ''"
            :maxlength="1000"
            :disabled="locked"
            :placeholder="t('learning.kiw')"
            :label="t('learning.kqu', { v0: node.id })"
            multiline
            @input="edit(node.id, $event)"
          />
          <view class="actions">
            <BaseButton
              :disabled="locked || !canSubmit(node)"
              :aria-disabled="locked || !canSubmit(node)"
              variant="quiet"
              @tap="save(node)"
              >{{ t('learning.kuw') }}{{ node.id }}{{ t('learning.k9k') }}</BaseButton
            >
            <BaseButton
              v-if="node.attempts.length"
              :disabled="locked"
              :aria-disabled="locked"
              variant="quiet"
              @tap="act('reference', node.id)"
              >{{ t('learning.ke7') }}{{ node.id }}{{ t('learning.k30') }}</BaseButton
            >
          </view>
          <text v-if="node.referenceRead" class="reference">{{ t('learning.kt7') }}{{ node.reference }}</text>
        </template>
      </view>
    </view>
    <BaseButton
      :disabled="locked || !mainAttempt"
      :aria-disabled="locked || !mainAttempt"
      variant="quiet"
      @tap="act('final')"
      >{{ t('learning.kau') }}</BaseButton
    >
    <text v-if="!mainAttempt" class="note">{{ t('learning.kie') }}</text>
    <text v-if="finalReference" class="reference">{{ finalReference }}</text>
    <text v-if="stopped" class="note">{{ t('learning.keb') }}</text>
    <BaseEmpty v-if="error" state="error" :title="learningText(error)" mascot-size="small" />
    <BaseButton :aria-expanded="showSource" variant="quiet" @tap="showSource = !showSource">{{
      t('learning.kfb')
    }}</BaseButton>
    <view v-if="showSource" class="source">
      <text>{{ attribution }}</text>
      <text
        >{{ t('learning.k7w') }}{{ exercise.packVersion }}{{ t('learning.kee')
        }}{{ question.source.revision.slice(0, 8) }}</text
      >
      <text v-for="(change, i) in question.source.exerciseSnapshot.changes" :key="i">{{ change }}</text>
      <text v-for="file in question.source.files" :key="file.path">{{ file.url }}</text>
    </view>
  </view>
</template>
<script setup>
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import { learningText } from '@/i18n/learning.js';
import { publicError, t } from '@/i18n/index.js';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseInput from '@/components/base/base-input/base-input.vue';

import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import {
  OATUTOR_TASKS,
  oatutorProgress,
  oatutorFinalReference,
  oatutorAttribution
} from '../../../../laf-backend/functions/_shared/learning-oatutor.js';
const props = defineProps({
  state: { type: Object, required: true },
  question: { type: Object, required: true },
  context: { type: String, required: true },
  visible: { type: Boolean, default: true },
  stopped: Boolean,
  busy: Boolean,
  action: { type: Function, required: true },
  startTask: { type: Function, required: true }
});
const root = ref(null),
  drafts = ref({}),
  pending = ref({}),
  error = ref(''),
  showSource = ref(false);
const exercise = computed(() => props.question.oatutorExercise);
const selected = ref(exercise.value.itemId);
const locked = computed(() => props.stopped || props.busy || !props.visible);
const progress = computed(() => oatutorProgress(props.state, props.question));
const mainAttempt = computed(() =>
  props.state.attempts
    .filter(
      (a) =>
        a.questionKey === `${props.question.id}@${props.question.version}` &&
        a.conversationId === exercise.value.conversationId
    )
    .at(-1)
);
const finalReference = computed(() => oatutorFinalReference(props.state, props.question));
const attribution = oatutorAttribution();
function run(fn) {
  if (locked.value) return;
  error.value = '';
  try {
    return fn();
  } catch (e) {
    error.value = publicError(e);
  }
}
function edit(id, event) {
  if (locked.value) return;
  drafts.value[id] = event.detail?.value ?? event.target?.value ?? '';
}
function canSubmit(node) {
  const answer = drafts.value[node.id] || '';
  return answer.trim() && answer !== node.attempts.at(-1)?.answer;
}
function act(action, nodeId) {
  return run(() => props.action(props.context, action, nodeId));
}
function save(node) {
  if (!canSubmit(node)) return;
  const answer = drafts.value[node.id];
  if (pending.value[node.id]?.answer !== answer)
    pending.value[node.id] = {
      answer,
      id: `oatutor_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
    };
  run(() => props.action(props.context, 'submit', node.id, answer, pending.value[node.id].id));
}
function openTask() {
  run(() => props.startTask(props.context, selected.value));
}
watch(
  [() => props.question.id, () => props.question.version, () => props.state.owner, () => props.visible],
  () => {
    drafts.value = {};
    pending.value = {};
    error.value = '';
    showSource.value = false;
    selected.value = exercise.value.itemId;
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
.oatutor-practice {
  padding: var(--s-5);
  margin: var(--s-5) 0;
  border: var(--border-thin) solid var(--line);
  border-radius: var(--s-6);
  background: var(--paper);
  color: var(--ink);
  overflow-wrap: anywhere;
}
.title {
  display: block;
  font-size: var(--size-title-3);
  font-weight: 650;
  margin-bottom: var(--s-3);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-3);
  margin: var(--s-3) 0;
}
.step {
  margin: var(--s-4) 0;
  padding-top: var(--s-3);
  border-top: var(--border-thin) solid var(--line);
}
.step-body {
  margin-top: var(--s-3);
}
.prompt,
.note,
.reference,
.source text {
  display: block;
  white-space: pre-wrap;
  line-height: 1.65;
  margin: var(--s-3) 0;
}
.note,
.source {
  font-size: var(--size-small);
  color: var(--ink-3);
}
.reference {
  padding: var(--s-3);
  border-left: var(--s-1) solid var(--violet);
}
@media (max-width: 520px) {
  .oatutor-practice {
    padding: var(--s-4);
  }
}
</style>
