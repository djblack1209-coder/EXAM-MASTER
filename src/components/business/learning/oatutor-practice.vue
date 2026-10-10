<template>
  <view ref="root" class="oatutor-practice" aria-label="函数运算分步带练">
    <text class="title">函数运算带练</text>
    <view class="actions" aria-label="选择函数任务">
      <button
        v-for="task in OATUTOR_TASKS"
        :key="task.id"
        role="button"
        tabindex="0"
        :aria-pressed="selected === task.id"
        :class="{ selected: selected === task.id }"
        :disabled="locked"
        :aria-disabled="locked"
        @tap="selected = task.id"
      >
        {{ task.label }}
      </button>
      <button
        role="button"
        tabindex="0"
        :disabled="locked || selected === exercise.itemId"
        :aria-disabled="locked || selected === exercise.itemId"
        @tap="openTask"
      >
        打开这题
      </button>
    </view>
    <text class="note">分步作答保留为待核对；阅读提示会记为本题帮助。</text>
    <view v-for="node in progress" :key="node.id" class="step">
      <button
        role="button"
        tabindex="0"
        :aria-expanded="node.opened"
        :aria-controls="`oatutor-step-${node.id}`"
        :disabled="locked || !node.available"
        :aria-disabled="locked || !node.available"
        @tap="act('open', node.id)"
      >
        {{ `第${node.id}步 · ${node.title}`
        }}{{ node.complete ? (node.type === 'hint' ? ' · 已读' : ' · 已作答') : '' }}
      </button>
      <text v-if="!node.available" class="note">完成前一步后打开</text>
      <view v-if="node.opened" :id="`oatutor-step-${node.id}`" class="step-body">
        <text class="prompt">{{ node.prompt }}</text>
        <template v-if="node.type === 'scaffold'">
          <text v-if="node.attempts.length" class="note" role="status"
            >已保存 · 待核对：{{ node.attempts.at(-1).answer }}</text
          >
          <textarea
            :value="drafts[node.id] || ''"
            :maxlength="1000"
            :disabled="locked"
            :aria-label="`第${node.id}步作答`"
            placeholder="写下这一步"
            @input="edit(node.id, $event)"
          ></textarea>
          <view class="actions">
            <button
              role="button"
              tabindex="0"
              :disabled="locked || !canSubmit(node)"
              :aria-disabled="locked || !canSubmit(node)"
              @tap="save(node)"
            >
              提交第{{ node.id }}步
            </button>
            <button
              v-if="node.attempts.length"
              role="button"
              tabindex="0"
              :disabled="locked"
              :aria-disabled="locked"
              @tap="act('reference', node.id)"
            >
              读第{{ node.id }}步参考
            </button>
          </view>
          <text v-if="node.referenceRead" class="reference">本步参考：{{ node.reference }}</text>
        </template>
      </view>
    </view>
    <button
      role="button"
      tabindex="0"
      :disabled="locked || !mainAttempt"
      :aria-disabled="locked || !mainAttempt"
      @tap="act('final')"
    >
      读本题参考
    </button>
    <text v-if="!mainAttempt" class="note">先在下方提交本题原答</text>
    <text v-if="finalReference" class="reference">{{ finalReference }}</text>
    <text v-if="stopped" class="note">已停止</text>
    <text v-if="error" class="note" role="alert">{{ error }}</text>
    <button role="button" tabindex="0" :aria-expanded="showSource" @tap="showSource = !showSource">来源与改动</button>
    <view v-if="showSource" class="source">
      <text>{{ attribution }}</text>
      <text>内容版本 {{ exercise.packVersion }} · 上游 {{ question.source.revision.slice(0, 8) }}</text>
      <text v-for="(change, i) in question.source.exerciseSnapshot.changes" :key="i">{{ change }}</text>
      <text v-for="file in question.source.files" :key="file.path">{{ file.url }}</text>
    </view>
  </view>
</template>
<script setup>
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
    error.value = e.message;
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
  padding: 20px;
  margin: 20px 0;
  border: 1px solid var(--space-line);
  border-radius: 24px;
  background: var(--yozi-solid);
  color: var(--space-text);
  overflow-wrap: anywhere;
}
.title {
  display: block;
  font-size: 20px;
  font-weight: 650;
  margin-bottom: 12px;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 12px 0;
}
button {
  min-width: 44px;
  min-height: 44px;
  max-width: 100%;
  margin: 0;
  padding: 8px 14px;
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
button.selected {
  background: var(--space-user, var(--yozi-solid));
}
button[disabled] {
  opacity: 0.5;
}
button:focus-visible,
textarea:focus-visible {
  outline: 2px solid var(--space-primary, #7050b0);
  outline-offset: 3px;
}
.step {
  margin: 16px 0;
  padding-top: 12px;
  border-top: 1px solid var(--space-line);
}
.step-body {
  margin-top: 12px;
}
.prompt,
.note,
.reference,
.source text {
  display: block;
  white-space: pre-wrap;
  line-height: 1.65;
  margin: 10px 0;
}
.note,
.source {
  font-size: 14px;
  color: var(--space-muted);
}
.reference {
  padding: 12px;
  border-left: 3px solid var(--space-primary, #7050b0);
}
textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  min-height: 90px;
  max-height: 180px;
  padding: 12px;
  border: 1px solid var(--space-line);
  border-radius: 14px;
  background: var(--yozi-solid);
  color: inherit;
  font: inherit;
}
@media (max-width: 520px) {
  .oatutor-practice {
    padding: 14px;
  }
}
</style>
