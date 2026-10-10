<template>
  <view ref="learningRoot" class="learning-overview">
    <view v-if="showNavigation" class="learning-links">
      <button
        v-for="item in ['对话', '错题', '计划', '统计']"
        :key="item"
        role="button"
        tabindex="0"
        size="mini"
        @tap="openView({ 对话: 'learning', 错题: 'mistake', 计划: 'plan', 统计: 'study-detail' }[item])"
      >
        {{ item }}
      </button>
    </view>
    <view class="overview-heading">
      <text class="overview-title">今日学习</text>
      <text class="overview-date">{{ stats.day.slice(5).replace('-', ' / ') }}</text>
    </view>
    <view
      class="learning-summary"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      aria-label="展开或收起学习记录依据"
      data-learning-toggle="true"
      @tap="expanded = !expanded"
    >
      <view class="summary-line">
        <text>今日任务</text>
        <view>
          <text class="summary-count">{{ stats.tasks.numerator }} / {{ stats.tasks.denominator }}</text>
          <text class="summary-rate">{{ percent(stats.tasks.rate) }}</text>
        </view>
      </view>
      <view
        v-if="stats.tasks.denominator"
        class="task-progress"
        role="progressbar"
        :aria-valuenow="stats.tasks.numerator"
        :aria-valuemax="stats.tasks.denominator"
        aria-valuemin="0"
        aria-label="今日任务进度"
      >
        <view :style="{ width: `${stats.tasks.rate * 100}%` }" />
      </view>
      <view class="summary-line">
        <text>有效作答</text>
        <text class="summary-count">{{ stats.validAnswers }} 次</text>
      </view>
      <view class="summary-line">
        <text>首答错题</text>
        <view>
          <text class="summary-count">{{ stats.first.numerator }} / {{ stats.first.denominator }}</text>
          <text class="summary-rate">{{ percent(stats.first.rate) }}</text>
        </view>
      </view>
      <view class="summary-foot">
        <text>待核对 {{ stats.pending }} 次</text>
        <text>{{ expanded ? '收起依据' : '查看依据' }}</text>
        <BaseIcon
          :name="expanded ? 'chevron-up' : 'chevron-down'"
          :size="26"
          :color="theme.isDark ? '#d2c8e5' : '#62576d'"
        />
      </view>
      <text v-if="stats.first.partial" class="subtle">首答部分正确 {{ stats.first.partial }} 次</text>
    </view>
    <view v-if="expanded" class="learning-details">
      <text class="subtle">{{ stats.day }} · {{ timezoneLabel }}</text>
      <template v-if="showTasks">
        <view class="detail-heading">
          <text class="learning-label">今天的任务</text>
          <button role="button" tabindex="0" size="mini" @tap="editPlan">编辑计划</button>
        </view>
        <view v-if="!learning.currentPlan?.tasks.length" class="record-empty">
          <BaseIcon name="calendar" :size="48" :color="theme.isDark ? '#c5a8ec' : '#7658ad'" />
          <text>暂无任务</text>
          <button role="button" tabindex="0" size="mini" @tap="openView('learning')">从对话开始</button>
        </view>
        <view v-for="task in learning.currentPlan?.tasks || []" :key="task.id" class="learning-row task-row">
          <view class="task-indicator" :class="{ completed: task.completedBy }">
            <BaseIcon v-if="task.completedBy" name="check" :size="28" :color="theme.isDark ? '#c5a8ec' : '#7658ad'" />
          </view>
          <view class="row-content">
            <text>{{ task.title }}</text>
            <text v-if="task.privacyRemoved" class="subtle">已移除</text>
            <text v-else class="subtle">
              {{
                task.condition === 'manual'
                  ? task.completedBy
                    ? '已确认'
                    : '待确认'
                  : task.condition === 'independent_correct'
                    ? task.completedBy
                      ? '已通过'
                      : '待检验'
                    : task.completedBy
                      ? '已提交'
                      : '待提交'
              }}
            </text>
          </view>
          <button
            v-if="!task.privacyRemoved && task.questionKey"
            role="button"
            tabindex="0"
            size="mini"
            @tap="openQuestion(task.questionKey)"
          >
            继续此题
          </button>
          <button
            v-else-if="!task.privacyRemoved && task.condition === 'manual' && !task.completedBy"
            role="button"
            tabindex="0"
            size="mini"
            @tap="complete(task.id)"
          >
            记录完成
          </button>
        </view>
        <text v-for="plan in priorPlans" :key="plan.id" class="subtle">
          历史计划 {{ plan.version }} · {{ plan.tasks.filter((t) => t.completedBy).length }}/{{ plan.tasks.length }}
        </text>
        <view v-for="task in upcomingRetests" :key="task.id" class="learning-row">
          <view class="learning-row-main">
            <text>{{ task.label }} · {{ task.day.slice(5).replace('-', '/') }}</text>
            <text class="subtle">{{ task.title }}</text>
          </view>
          <button
            role="button"
            tabindex="0"
            size="mini"
            @tap="openQuestion(task.questionKey, task.conversationId, 'review')"
          >
            回到复测题
          </button>
        </view>
      </template>
      <template v-if="showMistakes">
        <text class="learning-label detail-heading">错题</text>
        <view v-if="!stats.mistakes.length" class="record-empty">
          <BaseIcon name="book-open" :size="48" :color="theme.isDark ? '#c5a8ec' : '#7658ad'" />
          <text>暂无已校验的错题</text>
        </view>
        <view v-for="attempt in stats.mistakes" :key="attempt.id" class="learning-row">
          <text class="record-question">{{ questionPrompt(attempt.questionKey) }}</text>
          <text class="subtle">
            原答：{{ attempt.answer }} · {{ attempt.kind }} · 提示 {{ attempt.hints.length }} 次
          </text>
          <text class="subtle">判分依据：{{ effectiveGrade(attempt).basis }}</text>
          <view class="record-actions">
            <button
              role="button"
              tabindex="0"
              size="mini"
              @tap="openQuestion(attempt.questionKey, attempt.conversationId)"
            >
              返回原题与对话
              <BaseIcon name="arrow-right" :size="28" :color="theme.isDark ? '#c5a8ec' : '#7658ad'" />
            </button>
            <button role="button" tabindex="0" size="mini" @tap="dispute(attempt.id)">这次判分有误</button>
          </view>
        </view>
        <text class="learning-label detail-heading">到期复测</text>
        <text v-if="!stats.due.length" class="subtle">暂无到期题目</text>
        <view v-for="review in stats.due" :key="review.id" class="learning-row">
          <text>{{ questionPrompt(review.questionKey) }}</text>
          <button role="button" tabindex="0" size="mini" @tap="openQuestion(review.questionKey, null, 'review')">
            开始独立复测
          </button>
        </view>
      </template>
      <template v-if="showKnowledge">
        <text class="learning-label detail-heading">理解到哪一步了</text>
        <view v-if="!Object.keys(stats.knowledge).length" class="record-empty">
          <BaseIcon name="target" :size="48" :color="theme.isDark ? '#c5a8ec' : '#7658ad'" />
          <text>尚未检验</text>
        </view>
        <view v-for="(entry, key) in stats.knowledge" :key="key" class="learning-row knowledge-row">
          <view class="row-content">
            <text>{{ knowledgeLabel(key) }}</text>
            <text class="subtle">依据 {{ entry.evidenceIds.length }} 次作答</text>
          </view>
          <text class="knowledge-state">{{ entry.status }}</text>
        </view>
        <template v-if="learning.teachingProgress.rows.length">
          <text class="learning-label detail-heading">练习表现</text>
          <view
            v-for="entry in learning.teachingProgress.rows.slice(-6).reverse()"
            :key="entry.id"
            class="learning-row"
          >
            <text>{{ entry.scope }} · {{ methodNames[entry.method] || entry.method }}</text>
            <text class="subtle">{{ observationNames[entry.status] }}{{ entry.historyOnly ? ' · 历史记录' : '' }}</text>
            <text class="subtle"
              >可靠后续 {{ entry.followups.reliable }} 次 · 待核对 {{ entry.followups.pending }} 次 · 提示后正确
              {{ entry.followups.helpedCorrect }} 次 · 独立变式 {{ entry.followups.independentTransfer }} 次 · 到期复测
              {{ entry.followups.dueReview }} 次</text
            >
            <button role="button" tabindex="0" size="mini" @tap="openQuestion(entry.questionKey, entry.conversationId)">
              回看教学与作答
            </button>
          </view>
        </template>
      </template>
      <template v-if="showPending && stats.pending">
        <text class="learning-label detail-heading">待核对作答</text>
        <view v-for="attempt in pendingAttempts" :key="attempt.id" class="learning-row">
          <text>{{ questionPrompt(attempt.questionKey) }} · 原答 {{ attempt.answer }}</text>
          <view v-for="assessment in attempt.assistance || []" :key="assessment.id">
            <text class="subtle">AI 反馈 · 待核对：{{ assessment.feedback }}</text>
            <template v-if="['subjective-rubric-v1', 'subjective-rubric-v2'].includes(assessment.contract)">
              <text class="subtle"
                >AI 评分 · 待核对 {{ assessment.score === null ? '未定分' : assessment.score }} /
                {{ assessment.maxScore }}</text
              >
              <RubricEvidence :attempt="attempt" :assessment="assessment" :context-key="learning.recordContext()" />
            </template>
          </view>
          <button
            role="button"
            tabindex="0"
            size="mini"
            @tap="openQuestion(attempt.questionKey, attempt.conversationId)"
          >
            回看作答和依据
          </button>
        </view>
      </template>
    </view>
    <text
      v-if="message"
      class="subtle overview-feedback"
      :class="{ 'is-error': messageError }"
      :role="messageError ? 'alert' : 'status'"
      data-test="assessment-feedback"
    >
      {{ message }}
    </text>
    <CustomModal
      :key="dialogState.id"
      :visible="dialogState.visible"
      :title="dialogState.title"
      :content="dialogState.content"
      :editable="dialogState.editable"
      :placeholder-text="dialogState.placeholderText"
      :confirm-text="dialogState.confirmText"
      :cancel-text="dialogState.cancelText"
      :type="dialogState.type"
      :is-dark="theme.isDark"
      @confirm="dialogState.confirm"
      @cancel="dialogState.cancel"
      @closed="dialogState.closed"
    />
  </view>
</template>
<script setup>
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { computed, ref, shallowRef, watch, onMounted, onUnmounted } from 'vue';
import { onShow, onHide, onBackPress } from '@dcloudio/uni-app';
import CustomModal from '@/components/common/CustomModal.vue';
import RubricEvidence from '@/components/business/learning/rubric-evidence.vue';
import { createLearningDialog } from '@/services/learning/learning-dialog.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { effectiveGrade, questionKey, knowledgeScope } from '@/services/learning/learning-domain.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
const learning = useConversationLearningStore();
const calendarReader = learning.observeCalendar();
const theme = useThemeStore();
const learningRoot = ref(null);
let unbindKeyboard = () => undefined;
const props = defineProps({
  initialExpanded: Boolean,
  showNavigation: { type: Boolean, default: true },
  view: { type: String, default: 'all' }
});
const expanded = ref(props.initialExpanded);
const message = ref('');
const messageError = ref(false);
let overviewAlive = true,
  overviewVisible = true,
  assessmentDraft = null,
  feedbackContext = learning.recordContext();
function setMessage(content, isError = false) {
  message.value = content;
  messageError.value = isError;
}
const dialogState = shallowRef({ id: 0, visible: false });
const dialogs = createLearningDialog({
  getContext: () => (overviewAlive && overviewVisible ? learning.recordContext() : null),
  onChange: (state) => {
    dialogState.value = state;
  },
  onError: (error) => setMessage(error.message, true)
});
watch(
  () => learning.state,
  () => {
    const context = learning.recordContext();
    if (context !== feedbackContext) {
      feedbackContext = context;
      assessmentDraft = null;
      setMessage('');
    }
    dialogs.invalidate();
    if (assessmentDraft && !stats.value.mistakes.some((attempt) => attempt.id === assessmentDraft.attemptId))
      assessmentDraft = null;
  },
  { flush: 'sync' }
);
onShow(() => {
  overviewVisible = true;
  calendarReader.show();
  refresh();
});
onHide(() => {
  overviewVisible = false;
  calendarReader.hide();
  dialogs.dismiss();
});
onBackPress(() => {
  if (!dialogState.value.visible) return false;
  dialogs.dismiss();
  return true;
});
const showTasks = computed(() => ['all', 'plan'].includes(props.view));
const showMistakes = computed(() => ['all', 'mistake'].includes(props.view));
const showKnowledge = computed(() => ['all', 'study-detail'].includes(props.view));
const showPending = computed(() => ['all', 'mistake', 'study-detail'].includes(props.view));
const stats = computed(() => learning.summary);
const methodNames = {
  explain: '直接讲解',
  question: '引导提问',
  hint: '分层提示',
  example: '例题示范',
  analogy: '类比',
  diagram: '图形辅助',
  steps: '拆分步骤',
  prerequisite: '先修补充',
  variant: '变式',
  challenge: '综合挑战',
  check: '独立检验',
  review: '到期复习'
};
const observationNames = {
  waiting: '尚无后续作答',
  pending: '后续作答待核对',
  blocked: '后续仍受阻',
  helped_correct: '提示后正确，仍需独立检验',
  independent_transfer: '独立变式正确，仍待复测',
  due_review: '到期独立复测正确',
  original_redo: '原题再次正确，不等同长期掌握'
};
const pendingAttempts = computed(() => learning.state.attempts.filter((a) => effectiveGrade(a).status !== 'reliable'));
const priorPlans = computed(() =>
  learning.state.plans.filter((p) => p.day === stats.value.day && p.id !== stats.value.tasks.planId)
);
const upcomingRetests = computed(() => {
  const latest = new Map(learning.state.plans.map((p) => [p.day, p]));
  const tasks = [];
  for (const [day, plan] of latest) {
    if (day <= stats.value.day) continue;
    for (const task of plan.tasks) {
      const question = learning.state.questions.find((q) => questionKey(q) === task.questionKey);
      const exercise =
        question?.writingExercise ||
        question?.scienceExercise ||
        question?.vocabularyReview ||
        question?.sentenceExercise;
      if (exercise?.phase === 'retest' && exercise.dueDay === day && !task.privacyRemoved)
        tasks.push({
          ...task,
          day,
          conversationId: exercise.conversationId,
          label: question.vocabularyReview
            ? '词义复测'
            : question.scienceExercise
              ? '科学复测'
              : question.sentenceExercise
                ? '句子复测'
                : '写作复测'
        });
    }
  }
  return tasks.sort((a, b) => a.day.localeCompare(b.day));
});
const percent = (rate) => (rate === null ? '尚无样本' : `${(rate * 100).toFixed(1)}%`);
const questionPrompt = (key) => learning.state.questions.find((q) => questionKey(q) === key)?.prompt || key;
const knowledgeLabel = (scope) => {
  const question = learning.state.questions.find((q) => !q.knowledgePoint && knowledgeScope(q) === scope);
  return question?.prompt ? [question.subject, question.prompt].filter(Boolean).join(' / ') : scope;
};
const timezoneLabel = computed(
  () =>
    ({
      'Asia/Shanghai': '北京',
      'America/Los_Angeles': '洛杉矶',
      'America/New_York': '纽约',
      'Europe/London': '伦敦',
      'Asia/Tokyo': '东京',
      UTC: 'UTC'
    })[stats.value.timezone] || stats.value.timezone
);
function editPlan() {
  safeNavigateTo('/pages/learning/index?panel=profile');
}
function openView(view) {
  const path = `/pages/${view}/index`;
  const current = getCurrentPages().at(-1);
  if (current?.route === path.slice(1)) return;
  safeNavigateTo(path);
}
function refresh() {
  try {
    learning.refresh();
  } catch (e) {
    setMessage(e.message, true);
  }
}
function openQuestion(key, conversationId, kind = null) {
  try {
    learning.focus(key, conversationId || undefined, kind);
    safeNavigateTo('/pages/learning/index');
  } catch (e) {
    setMessage(e.message, true);
  }
}
function complete(taskId) {
  try {
    learning.commit('task.complete', { planId: learning.currentPlan.id, taskId });
  } catch (e) {
    setMessage(e.message, true);
  }
}
function dispute(attemptId) {
  const context = learning.recordContext();
  const currentAttempt = () => stats.value.mistakes.some((attempt) => attempt.id === attemptId);
  const id = dialogs.show({
    title: '纠正判分',
    editable: true,
    type: 'warning',
    content:
      assessmentDraft?.context === context && assessmentDraft.attemptId === attemptId ? assessmentDraft.content : '',
    placeholderText: '说明争议点或提供核对依据',
    isCurrent: currentAttempt,
    success: (result) => {
      if (result.confirm && result.content?.trim()) {
        try {
          learning.correctAssessment(attemptId, result.content);
          assessmentDraft = null;
          setMessage('已撤销可靠结论并保留争议，等待有依据的核对。');
        } catch (e) {
          const canRetry = learning.recordContext() === context && currentAttempt();
          if (canRetry) assessmentDraft = { context, attemptId, content: result.content };
          setMessage(
            canRetry ? `${e.message.replace(/。$/, '')}。说明尚未保存，重新打开可继续编辑。` : e.message,
            true
          );
        }
      } else assessmentDraft = null;
    }
  });
  if (id !== null) setMessage('');
}
onMounted(() => {
  calendarReader.show();
  unbindKeyboard = bindLearningKeyboard(learningRoot.value);
  refresh();
  uni.$on('conversationLearningUpdated', refresh);
});
onUnmounted(() => {
  calendarReader.dispose();
  overviewAlive = false;
  assessmentDraft = null;
  dialogs.destroy();
  unbindKeyboard();
  uni.$off('conversationLearningUpdated', refresh);
});
</script>
<style scoped>
.learning-overview {
  margin: 0;
  padding: 20px;
  border-radius: 24px;
  background: var(--space-glass, #ffffff);
  color: var(--space-ink, #080909);
  font-size: 14px;
}
.learning-overview button {
  min-height: 44px;
  margin: 0;
  padding: 8px 14px;
  border: 1px solid var(--space-line, #dbd5e6);
  border-radius: 12px;
  background: var(--yozi-glass);
  box-shadow: var(--yozi-control-shadow);
  font-family: inherit;
  line-height: 1.65;
  color: inherit;
  transition:
    background-color 180ms ease,
    color 180ms ease;
}
.learning-overview button::after {
  border: 0;
}
.learning-overview button:active:not([disabled]) {
  background: var(--space-notice, #eee7f7);
  transition-duration: 100ms;
}
.learning-overview button:focus-visible,
.learning-summary:focus-visible {
  outline: 2px solid var(--space-sage, #7658ad);
  outline-offset: 2px;
}
.learning-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.learning-links button {
  background: var(--space-notice, #eee7f7);
  font-size: 12px;
  border-radius: 12px;
  min-height: 44px;
}
.overview-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.overview-title {
  font-size: 16px;
  font-weight: 500;
}
.overview-date {
  font-size: 10px;
  color: var(--space-muted, #62576d);
}
.learning-summary {
  cursor: pointer;
  border-radius: 10px;
}
.summary-line {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  font-size: 12px;
}
.summary-line > view {
  display: flex;
  align-items: center;
  gap: 12px;
}
.summary-count {
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}
.summary-rate {
  font-size: 10px;
  color: var(--space-muted, #62576d);
}
.task-progress {
  height: 3px;
  background: rgba(238, 231, 247, 0.2);
  border-radius: 3px;
  overflow: hidden;
}
.task-progress > view {
  height: 100%;
  background: var(--space-sage, #7658ad);
  border-radius: 3px;
}
.summary-foot {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 10px;
  font-size: 10px;
  color: var(--space-muted, #62576d);
}
.summary-foot > text:nth-child(2) {
  margin-left: auto;
}
.learning-details {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--space-line, #dbd5e6);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.detail-heading {
  margin-top: 24px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.learning-label {
  font-size: 16px;
  font-weight: 500;
}
.learning-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px 0;
  border-bottom: 1px solid var(--space-line, #dbd5e6);
}
.learning-row button {
  margin: 0;
  align-self: flex-start;
  font-size: 12px;
}
.record-question {
  font-size: 18px;
  line-height: 1.7;
}
.record-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.subtle {
  color: var(--space-muted, #62576d);
  font-size: 12px;
  line-height: 1.8;
}
.record-empty {
  display: flex;
  align-items: flex-start;
  flex-direction: column;
  gap: 10px;
  padding: 24px 0;
}
.record-empty > text:not(.subtle) {
  font-size: 15px;
}
.task-row,
.knowledge-row {
  flex-direction: row;
  align-items: center;
  gap: 14px;
}
.task-indicator {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px var(--space-line, #7658ad);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.task-indicator.completed {
  background: rgba(201, 177, 238, 0.15);
}
.row-content {
  min-width: 0;
  flex: 1;
}
.row-content text {
  display: block;
  overflow-wrap: anywhere;
}
.knowledge-state {
  border-radius: 24px;
  padding: 8px 12px;
  font-size: 12px;
  background: rgba(229, 217, 245, 0.16);
  white-space: nowrap;
}
.overview-feedback {
  display: block;
  margin-top: 16px;
}
.overview-feedback.is-error {
  padding: 12px;
  border: 1px solid var(--space-line, #dbd5e6);
  border-radius: 12px;
  background: var(--space-notice, #eee7f7);
  color: var(--space-ink, #080909);
}
@media (hover: hover) {
  .learning-overview button:hover:not([disabled]) {
    background: var(--space-notice, #eee7f7);
  }
}
@media (prefers-reduced-motion: reduce) {
  .learning-overview button {
    animation: none !important;
    transition: none !important;
  }
}
@media (max-width: 520px) {
  .task-row {
    flex-wrap: wrap;
  }
  .task-row .row-content {
    flex-basis: calc(100% - 42px);
  }
  .task-row button {
    margin-left: 38px;
  }
  .record-question {
    font-size: 16px;
  }
  .knowledge-state {
    max-width: 50%;
    white-space: normal;
  }
}
</style>
