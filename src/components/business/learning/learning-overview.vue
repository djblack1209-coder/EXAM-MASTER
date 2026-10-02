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
        <BaseIcon :name="expanded ? 'chevron-up' : 'chevron-down'" :size="26" color="#e1ddd2" />
      </view>
      <text v-if="stats.first.partial" class="subtle"
        >首答部分正确 {{ stats.first.partial }} 次（单独列示，计入可靠首答分母）</text
      >
    </view>
    <view v-if="expanded" class="learning-details">
      <text class="subtle">{{ stats.timezone }} · {{ stats.day }} · 计划版本 {{ stats.tasks.version }}</text>
      <template v-if="showTasks">
        <view class="detail-heading">
          <text class="learning-label">今天的任务</text>
          <button role="button" tabindex="0" size="mini" @tap="editPlan">编辑计划</button>
        </view>
        <view v-if="!learning.currentPlan?.tasks.length" class="record-empty">
          <BaseIcon name="calendar" :size="48" color="#d9dfbe" />
          <text>留一点空间，给今天想学的事。</text>
          <text class="subtle">开始练习会自动形成任务，也可以自己安排。</text>
          <button role="button" tabindex="0" size="mini" @tap="openView('learning')">从对话开始</button>
        </view>
        <view v-for="task in learning.currentPlan?.tasks || []" :key="task.id" class="learning-row task-row">
          <view class="task-indicator" :class="{ completed: task.completedBy }">
            <BaseIcon v-if="task.completedBy" name="check" :size="28" color="#d9dfbe" />
          </view>
          <view class="row-content">
            <text>{{ task.title }}</text>
            <text v-if="task.privacyRemoved" class="subtle">不再执行 · 保留在原计划分母</text>
            <text v-else class="subtle">
              {{ task.completedBy ? '已完成' : '待完成' }} ·
              {{ task.condition === 'manual' ? '手动确认完成' : '以实际作答完成' }}
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
          调整前版本 {{ plan.version }}：{{ plan.tasks.filter((t) => t.completedBy).length }}/{{ plan.tasks.length }} ·
          {{ plan.reason }}（原分母保留）
        </text>
      </template>
      <template v-if="showMistakes">
        <text class="learning-label detail-heading">可靠判分的错题经历</text>
        <view v-if="!stats.mistakes.length" class="record-empty">
          <BaseIcon name="book-open" :size="48" color="#d9dfbe" />
          <text>还没有可靠判分的错题。</text>
          <text class="subtle">对话作答后会自动归档；待核对内容不会被直接记错。</text>
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
              <BaseIcon name="arrow-right" :size="28" color="#f8f5ee" />
            </button>
            <button role="button" tabindex="0" size="mini" @tap="dispute(attempt.id)">这次判分有误</button>
          </view>
        </view>
        <text class="learning-label detail-heading">到期复测</text>
        <text v-if="!stats.due.length" class="subtle">当前没有到期题目。安排会随有效作答更新。</text>
        <view v-for="review in stats.due" :key="review.id" class="learning-row">
          <text>{{ questionPrompt(review.questionKey) }}</text>
          <button role="button" tabindex="0" size="mini" @tap="openQuestion(review.questionKey, null, 'review')">
            开始独立复测
          </button>
        </view>
        <text class="subtle">复测日期是学习安排，没有发送站外提醒。</text>
      </template>
      <template v-if="showKnowledge">
        <text class="learning-label detail-heading">理解到哪一步了</text>
        <view v-if="!Object.keys(stats.knowledge).length" class="record-empty">
          <BaseIcon name="target" :size="48" color="#d9dfbe" />
          <text>尚未检验，先从一次独立作答开始。</text>
          <text class="subtle">状态依据提示、变式和复测更新，不展示虚构的掌握百分比。</text>
        </view>
        <view v-for="(entry, key) in stats.knowledge" :key="key" class="learning-row knowledge-row">
          <view class="row-content">
            <text>{{ key }}</text>
            <text class="subtle">依据 {{ entry.evidenceIds.length }} 次作答</text>
          </view>
          <text class="knowledge-state">{{ entry.status }}</text>
        </view>
        <text v-if="stats.first.smallSample" class="subtle">
          样本较少，只描述已可靠判分的首次作答；不据此判断整科学习能力。
        </text>
        <template v-if="learning.teachingProgress.rows.length">
          <text class="learning-label detail-heading">教学后的作答观察</text>
          <text class="subtle"
            >仅描述实际教学后的表现，不证明某种教法有效；提示后正确与独立变式、到期复测分别保留。</text
          >
          <view
            v-for="entry in learning.teachingProgress.rows.slice(-6).reverse()"
            :key="entry.id"
            class="learning-row"
          >
            <text>{{ entry.scope }} · {{ methodNames[entry.method] || entry.method }}</text>
            <text class="subtle"
              >{{ observationNames[entry.status] }}{{ entry.historyOnly ? ' · 恢复的历史交付' : '' }}</text
            >
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
        <text class="learning-label detail-heading">待核对作答与辅助评估</text>
        <view v-for="attempt in pendingAttempts" :key="attempt.id" class="learning-row">
          <text>{{ questionPrompt(attempt.questionKey) }} · 原答 {{ attempt.answer }}</text>
          <view v-for="assessment in attempt.assistance || []" :key="assessment.id">
            <text class="subtle">AI 辅助评估（待核对）：{{ assessment.feedback }}</text>
            <template v-if="['subjective-rubric-v1', 'subjective-rubric-v2'].includes(assessment.contract)">
              <text class="subtle"
                >辅助总分 {{ assessment.score === null ? '未定分' : assessment.score }} /
                {{ assessment.maxScore }}；不进入可靠错题统计。</text
              >
              <view v-for="dimension in assessment.dimensions" :key="dimension.id">
                <text class="subtle"
                  >{{ dimension.name }}：{{ dimension.score === null ? '待核对' : dimension.score }} /
                  {{ dimension.maxScore }} · {{ dimension.feedback }}</text
                >
                <view v-for="(quote, index) in dimension.evidence" :key="index">
                  <text class="subtle" selectable>原答引用：{{ quote }}</text>
                  <template v-if="dimension.evidenceLocations?.[index]">
                    <text class="subtle"
                      >原答第{{ dimension.evidenceLocations[index].startCharacter }}至{{
                        dimension.evidenceLocations[index].endCharacter
                      }}字 · 同文第{{ dimension.evidenceLocations[index].occurrence }}/{{
                        dimension.evidenceLocations[index].occurrences
                      }}处</text
                    >
                    <text class="subtle" selectable
                      >附近原文：{{ dimension.evidenceLocations[index].before }}【{{ quote }}】{{
                        dimension.evidenceLocations[index].after
                      }}</text
                    >
                  </template>
                  <text v-else class="subtle">旧记录未定位，引用仍待核对。</text>
                </view>
              </view>
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
      <text class="subtle calculation-note">
        任务完成不等于掌握。聊天闲谈、重复消息和未判定项不计入首答错题率。原题重做、提示和变式分别记录。
      </text>
      <text v-if="message" class="subtle" role="status">{{ message }}</text>
    </view>
  </view>
</template>
<script setup>
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { effectiveGrade, questionKey } from '@/services/learning/learning-domain.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
const learning = useConversationLearningStore();
const learningRoot = ref(null);
let unbindKeyboard = () => undefined;
const props = defineProps({
  initialExpanded: Boolean,
  showNavigation: { type: Boolean, default: true },
  view: { type: String, default: 'all' }
});
const expanded = ref(props.initialExpanded);
const message = ref('');
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
const percent = (rate) => (rate === null ? '尚无样本' : `${(rate * 100).toFixed(1)}%`);
const questionPrompt = (key) => learning.state.questions.find((q) => questionKey(q) === key)?.prompt || key;
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
    message.value = e.message;
  }
}
function openQuestion(key, conversationId, kind = null) {
  try {
    learning.focus(key, conversationId || undefined, kind);
    safeNavigateTo('/pages/learning/index');
  } catch (e) {
    message.value = e.message;
  }
}
function complete(taskId) {
  try {
    learning.commit('task.complete', { planId: learning.currentPlan.id, taskId });
  } catch (e) {
    message.value = e.message;
  }
}
function dispute(attemptId) {
  uni.showModal({
    title: '纠正判分',
    editable: true,
    placeholderText: '说明争议点或提供核对依据',
    success: (result) => {
      if (result.confirm && result.content?.trim()) {
        try {
          learning.correctAssessment(attemptId, result.content);
          message.value = '已撤销可靠结论并保留争议，等待有依据的核对。';
        } catch (e) {
          message.value = e.message;
        }
      }
    }
  });
}
onMounted(() => {
  unbindKeyboard = bindLearningKeyboard(learningRoot.value);
  refresh();
  uni.$on('conversationLearningUpdated', refresh);
});
onUnmounted(() => {
  unbindKeyboard();
  uni.$off('conversationLearningUpdated', refresh);
});
</script>
<style scoped>
.learning-overview {
  margin: 0;
  padding: 20px;
  border-radius: 24px;
  background: var(--space-glass, #f0eee5);
  color: var(--space-ink, #343c2c);
  font-size: 14px;
}
.learning-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.learning-links button {
  background: rgba(121, 130, 103, 0.12);
  font-size: 12px;
  border-radius: 24px;
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
  color: var(--space-muted, #515946);
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
  color: var(--space-muted, #515946);
}
.task-progress {
  height: 3px;
  background: rgba(246, 242, 226, 0.2);
  border-radius: 3px;
  overflow: hidden;
}
.task-progress > view {
  height: 100%;
  background: var(--space-sage, #617047);
  border-radius: 3px;
}
.summary-foot {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 10px;
  font-size: 10px;
  color: var(--space-muted, #515946);
}
.summary-foot > text:nth-child(2) {
  margin-left: auto;
}
.learning-details {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--space-line, #d3d6c7);
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
  border-bottom: 1px solid var(--space-line, #d3d6c7);
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
  color: var(--space-muted, #515946);
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
  box-shadow: inset 0 0 0 1px var(--space-line, #617047);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.task-indicator.completed {
  background: rgba(210, 226, 163, 0.15);
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
  background: rgba(223, 228, 200, 0.16);
  white-space: nowrap;
}
.calculation-note {
  margin-top: 20px;
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
