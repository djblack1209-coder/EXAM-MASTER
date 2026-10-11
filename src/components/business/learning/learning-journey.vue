<template>
  <view
    v-if="learning.active"
    ref="root"
    class="journey-panel"
    :class="{ 'journey-inline': inline }"
    data-test="learning-journey"
  >
    <view class="journey-heading">
      <view>
        <text v-if="!inline" class="journey-title">{{ program?.title || learning.active.goal }}</text>
        <text v-if="program" class="journey-meta">
          {{ program.startsLater ? `${program.startDay} 开始` : `第 ${program.dayIndex} / ${program.durationDays} 天` }}
          · 已完成 {{ program.completedDays }} 天 · {{ modeName }}
        </text>
      </view>
      <button role="button" tabindex="0" :aria-expanded="editing" @tap="edit">
        {{ editing ? '收起目标' : program ? '调整目标' : '设置学习路线' }}
      </button>
    </view>
    <view v-if="editing" class="journey-form">
      <label><text>学习目标</text><input v-model="form.title" aria-label="路线学习目标" maxlength="160" /></label>
      <view class="journey-fields">
        <label
          ><text>开始日期</text><input v-model="form.startDay" aria-label="路线开始日期" placeholder="YYYY-MM-DD"
        /></label>
        <label
          ><text>计划天数</text><input v-model.number="form.durationDays" type="number" aria-label="路线计划天数"
        /></label>
        <label
          ><text>每日分钟</text><input v-model.number="form.minutes" type="number" aria-label="路线每日分钟"
        /></label>
      </view>
      <view class="button-row" aria-label="训练节奏">
        <button
          v-for="mode in TRAINING_MODES"
          :key="mode.id"
          role="button"
          tabindex="0"
          :aria-pressed="form.mode === mode.id"
          :class="{ chosen: form.mode === mode.id }"
          @tap="form.mode = mode.id"
        >
          {{ mode.label }}
        </button>
      </view>
      <text class="journey-field-label">训练模块 · {{ form.moduleIds.length }} / 8</text>
      <view class="journey-module-options">
        <button
          v-for="module in JOURNEY_MODULES"
          :key="module.id"
          role="button"
          tabindex="0"
          :aria-pressed="form.moduleIds.includes(module.id)"
          :class="{ chosen: form.moduleIds.includes(module.id) }"
          @tap="toggleModule(module.id)"
        >
          {{ module.subject }} · {{ module.label }}
        </button>
      </view>
      <view class="button-row">
        <button
          class="primary"
          role="button"
          tabindex="0"
          :disabled="busy"
          :aria-disabled="busy"
          data-test="journey-save"
          @tap="save"
        >
          保存学习路线
        </button>
        <button role="button" tabindex="0" @tap="editing = false">取消</button>
      </view>
    </view>
    <template v-if="program">
      <view class="journey-route-heading">
        <text class="section-title">今日路线</text>
        <text>{{ program.completed }} / {{ program.modules.length }} 模块已提交</text>
      </view>
      <view class="button-row" aria-label="每组题量">
        <text class="journey-meta">客观题每组</text>
        <button
          v-for="size in [1, 2, 5, 10, 20]"
          :key="size"
          role="button"
          tabindex="0"
          :aria-pressed="groupSize === size"
          :class="{ chosen: groupSize === size }"
          @tap="groupSize = size"
        >
          {{ size }}题
        </button>
      </view>
      <view
        v-if="program.modules.some((m) => m.id.startsWith('writing-'))"
        class="button-row"
        aria-label="写作每组题量"
      >
        <text class="journey-meta">写作每组</text>
        <button
          v-for="size in [1, 2]"
          :key="size"
          role="button"
          tabindex="0"
          :aria-pressed="writingSize === size"
          :class="{ chosen: writingSize === size }"
          @tap="writingSize = size"
        >
          {{ size }}篇
        </button>
      </view>
      <view class="journey-route" aria-label="今日模块路线">
        <view
          v-for="(module, index) in program.modules"
          :key="module.id"
          class="journey-step"
          :class="{ 'is-current': program.current?.id === module.id }"
        >
          <text class="journey-step-number">{{ index + 1 }}</text>
          <view class="journey-step-copy">
            <text class="journey-step-title">{{ module.label }}</text>
            <text class="journey-meta">{{ module.goal }}</text>
            <text v-if="module.group?.submittedBy" class="journey-meta"
              >本组可靠正确 {{ module.correct }} / {{ module.reliable }} · 待核对 {{ module.pending }}</text
            >
          </view>
          <text class="journey-step-state">{{ module.status }}</text>
          <button
            role="button"
            tabindex="0"
            :disabled="busy || learning.active.stopped"
            :aria-disabled="busy || learning.active.stopped"
            :data-test="`journey-module-${module.id}`"
            @tap="startModule(module)"
          >
            {{ module.group ? (module.group.submittedBy ? '查看结果' : '继续训练') : '开始训练' }}
          </button>
        </view>
      </view>
      <view v-if="!inline" class="journey-score" aria-label="今日当前目标成绩">
        <view
          ><text>可靠判分</text
          ><text class="journey-score-value"
            >{{ stats.reliableCorrectAnswers }} / {{ stats.totalReliableAnswers }}</text
          ></view
        >
        <view
          ><text>待核对</text><text class="journey-score-value">{{ stats.pending }}</text></view
        >
        <view
          ><text>可靠错答</text><text class="journey-score-value">{{ stats.mistakes.length }}</text></view
        >
      </view>
      <text class="journey-meta">{{ program.day }} · 当前目标 · {{ program.timezone }}</text>
      <slot></slot>
      <TrainingGroup v-if="learning.batchTrainingActive" />
      <JourneyReview />
      <JourneyReminders />
    </template>
    <text v-if="message" class="journey-feedback" :class="{ warning: failed }" :role="failed ? 'alert' : 'status'">{{
      message
    }}</text>
  </view>
</template>
<script setup>
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
  margin: 18px 0 24px;
  padding: 24px;
  background: var(--yozi-solid);
  border-radius: 24px;
  color: var(--space-ink);
}
.journey-panel.journey-inline {
  padding: 0;
  margin: 16px 0 28px;
  background: transparent;
  border-radius: 0;
}
.journey-heading,
.journey-route-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.journey-title {
  display: block;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.journey-meta {
  display: block;
  color: var(--space-muted);
  font-size: 12px;
  line-height: 1.7;
  margin-top: 6px;
  overflow-wrap: anywhere;
}
.journey-form {
  display: grid;
  gap: 16px;
  margin-top: 24px;
}
.journey-form label {
  display: grid;
  gap: 8px;
  font-size: 14px;
}
.journey-form input {
  min-height: 44px;
  padding: 10px 12px;
  border: 1px solid var(--space-line);
  border-radius: 12px;
  color: var(--space-ink);
  box-sizing: border-box;
  width: 100%;
}
.journey-fields {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 12px;
}
.journey-module-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.journey-route-heading {
  margin: 24px 0 12px;
  font-size: 12px;
}
.journey-route {
  display: grid;
}
.journey-step {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--space-line);
}
.journey-step-number {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--space-muted);
  width: 24px;
  flex-shrink: 0;
}
.journey-step-copy {
  flex: 1;
  min-width: 0;
}
.journey-step-title {
  font-size: 16px;
  font-weight: 500;
}
.journey-step-state {
  font-size: 12px;
  flex-shrink: 0;
}
.is-current .journey-step-title {
  font-weight: 700;
}
.journey-score {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin: 24px 0 12px;
}
.journey-score > view {
  display: grid;
  gap: 8px;
  font-size: 12px;
  color: var(--space-muted);
}
.journey-score-value {
  font-size: 24px;
  line-height: 1.4;
  color: var(--space-ink);
  font-variant-numeric: tabular-nums;
}
.journey-feedback {
  display: block;
  margin-top: 12px;
  font-size: 14px;
  line-height: 1.7;
}
@media (max-width: 520px) {
  .journey-panel {
    padding: 16px;
  }
  .journey-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .journey-title {
    font-size: 20px;
  }
  .journey-fields {
    grid-template-columns: 1fr;
  }
  .journey-score {
    gap: 8px;
  }
  .journey-score-value {
    font-size: 20px;
  }
}
</style>
