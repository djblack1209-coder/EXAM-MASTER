<template>
  <LearningShell v-if="!showLegacy" class="yozi-page" active="plan" :title="$t('pages.plan')">
    <template #controls>
      <BaseButton class="quiet-button" variant="secondary" @tap="toggleLegacy">{{ t('plan.copy0') }}</BaseButton>
    </template>
    <LearningOverview :initial-expanded="true" :show-navigation="false" view="plan" />
  </LearningShell>
  <view v-else class="yozi-page" :class="['container', { 'dark-mode': isDark, 'theme-light': !isDark }]">
    <view class="aurora-bg" />

    <!-- 骨架屏 -->
    <!-- #ifdef APP-PLUS -->
    <BaseEmpty v-if="isLoading" :is-dark="isDark" state="loading" />
    <!-- #endif -->
    <!-- #ifndef APP-PLUS -->
    <!-- #ifndef APP-NVUE -->
    <transition name="skeleton-fade">
      <BaseEmpty v-if="isLoading" :is-dark="isDark" state="loading" />
    </transition>
    <!-- #endif -->
    <!-- #ifdef APP-NVUE -->
    <BaseEmpty v-if="isLoading" :is-dark="isDark" state="loading" />
    <!-- #endif -->
    <!-- #endif -->

    <view v-if="!isLoading" class="header-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content" :style="{ paddingRight: capsuleSafeRight + 'px' }">
        <BaseButton class="nav-back" :label="$t('ui.back')" variant="secondary" @tap="goBack"
          ><BaseIcon name="arrow-left"
        /></BaseButton>
        <text class="nav-title">{{ $t('pages.plan') }}</text>
        <BaseButton
          class="nav-add"
          variant="secondary"
          icon="plus"
          icon-only
          :label="t('plan.copy1')"
          @tap="showLegacy ? createPlan() : safeNavigateTo('/pages/learning/index')"
        />
      </view>
    </view>

    <scroll-view
      v-if="!isLoading"
      scroll-y
      class="main-scroll"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onPullRefresh"
    >
      <LearningOverview :initial-expanded="true" />
      <BaseButton class="quiet-button" variant="secondary" @tap="toggleLegacy">{{
        showLegacy ? t('plan.copy2') : t('plan.copy0')
      }}</BaseButton>
      <template v-if="showLegacy">
        <view class="hero-card">
          <text class="hero-title">{{ t('plan.copy3') }}</text>
          <view class="hero-actions">
            <BaseButton class="hero-cta" variant="primary" @tap="createPlan"
              ><text class="hero-cta-text">{{ t('plan.copy4') }}</text></BaseButton
            >
          </view>
        </view>

        <view v-if="intelligentReminders.length > 0" class="reminder-card">
          <view class="section-heading">
            <view class="section-title-row yozi-icon-row">
              <BaseIcon name="robot" class="reminder-icon" />
              <text class="section-title">{{ t('plan.copy5') }}</text>
            </view>
          </view>
          <view class="reminder-list">
            <view
              v-for="(reminder, index) in intelligentReminders"
              :key="index"
              class="reminder-item"
              :class="reminder.priority"
            >
              <text class="reminder-message">
                {{ uiText(reminder.message) }}
              </text>
              <text class="reminder-time">
                {{ uiText(reminder.time) }}
              </text>
            </view>
          </view>
        </view>

        <!-- AI 自适应学习计划 -->
        <view v-if="aiPlan || aiPlanLoading" class="ai-plan-section">
          <view class="section-heading">
            <view class="section-title-row">
              <text class="section-title">{{ t('plan.copy6') }}</text>
            </view>
          </view>

          <BaseEmpty v-if="aiPlanLoading" state="loading" :title="t('plan.copy7')" pose="sleep" />

          <view v-else-if="aiPlan && aiPlan.days" class="ai-plan-days">
            <view v-if="aiPlan.phase" class="ai-plan-phase">
              <text class="phase-text">{{ t('plan.copy8', { v0: aiPlan.phase }) }}</text>
            </view>
            <BaseButton
              v-for="(day, idx) in aiPlan.days"
              :key="idx"
              class="ai-day-card"
              variant="secondary"
              @tap="startAIPlanDay(day)"
              ><view class="day-header">
                <text class="day-label">{{ idx === 0 ? t('plan.copy9') : t('plan.copy10', { v0: idx + 1 }) }}</text>
                <text v-if="day.focusSubject" class="day-focus">{{ day.focusSubject }}</text> </view
              ><view v-if="day.tasks" class="day-tasks">
                <view v-for="(task, ti) in day.tasks.slice(0, 3)" :key="ti" class="day-task-item">
                  <text class="task-dot" :class="[task.type === 'review' ? 'review' : 'practice']" />
                  <text class="task-name">{{ task.name || task.knowledgePoint }}</text>
                  <text v-if="task.minutes" class="task-time">{{ t('plan.copy11', { v0: task.minutes }) }}</text>
                </view> </view
              ><view v-if="idx === 0" class="day-cta">
                <text class="day-cta-text">{{ t('plan.copy12') }}</text>
              </view></BaseButton
            >
          </view>
        </view>

        <BaseEmpty
          v-if="plans.length === 0"
          pose="sleep"
          icon="calendar"
          :title="t('plan.copy13')"
          :desc="t('plan.copy14')"
          :show-button="true"
          :button-text="t('plan.copy15')"
          :is-dark="isDark"
          @action="createPlan"
        />

        <view v-if="plans.length > 0" class="section-heading plans-heading">
          <text class="section-title">{{ t('plan.copy16') }}</text>
        </view>

        <view v-for="(plan, index) in plans" :key="plan.id || index" class="plan-card">
          <view class="plan-header">
            <text class="plan-name">
              {{ plan.name }}
            </text>
            <view class="plan-badge" :class="plan.status">
              <text class="plan-badge-text">
                {{ uiText(getStatusText(plan.status)) }}
              </text>
            </view>
          </view>

          <text class="plan-goal">
            {{ plan.goal }}
          </text>

          <view v-if="plan.analytics" class="plan-analytics"
            ><view class="analytics-row"
              ><BaseStat
                v-if="plan.tasks?.length"
                :label="t('plan.copy25')"
                :value="plan.tasks.filter((task) => task.completed).length"
                :denominator="plan.tasks.length" /><BaseListRow
                v-else
                :label="t('plan.completionNote')"
                :value="plan.analytics.completionRate + '%'"
                :actionable="false" /><BaseListRow
                :label="t('plan.trendNote')"
                :value="plan.analytics.progressTrend.trend + '%'"
                :actionable="false" /><BaseListRow
                :label="t('plan.projectedNote')"
                :value="plan.analytics.progressTrend.projected + '%'"
                :actionable="false"
            /></view>
            <view
              v-if="plan.analytics.recommendedAdjustments && plan.analytics.recommendedAdjustments.length > 0"
              class="adjustments-section"
            >
              <text class="adjustments-title">{{ t('plan.copy20') }}</text>
              <view
                v-for="(adjustment, adjIndex) in plan.analytics.recommendedAdjustments"
                :key="adjIndex"
                class="adjustment-item"
                :class="adjustment.priority"
              >
                <text class="adjustment-message">
                  {{ uiText(adjustment.message) }}
                </text>
              </view>
            </view>
          </view>

          <view class="plan-meta-grid">
            <view class="meta-item">
              <text class="meta-label">{{ t('plan.copy21') }}</text>
              <text class="meta-value">
                {{ plan.startDate }}
              </text>
            </view>
            <view class="meta-item">
              <text class="meta-label">{{ t('plan.copy22') }}</text>
              <text class="meta-value">
                {{ plan.endDate }}
              </text>
            </view>
            <view class="meta-item">
              <text class="meta-label">{{ t('plan.copy23') }}</text>
              <text class="meta-value">
                {{ plan.dailyDuration }}
              </text>
            </view>
            <view class="meta-item">
              <text class="meta-label">{{ t('plan.copy24') }}</text>
              <text class="meta-value">
                {{ plan.reminderTime }}
              </text>
            </view>
          </view>

          <view v-if="plan.tasks && plan.tasks.length > 0" class="task-stats">
            <text class="task-stats-label">{{ t('plan.copy25') }}</text>
            <view class="task-progress-bar">
              <view class="task-progress-fill" :style="{ width: (plan.progress || 0) + '%' }" />
            </view>
            <text class="task-stats-text">
              {{
                t('plan.copy26', {
                  v0: plan.tasks ? plan.tasks.reduce((n, t) => n + (t.completed ? 1 : 0), 0) : 0,
                  v1: plan.tasks ? plan.tasks.length : 0
                })
              }}</text
            >
          </view>

          <view class="plan-footer">
            <view class="category-tag" :class="plan.category">
              <text class="tag-text">
                {{ plan.category }}
              </text>
            </view>
            <view class="priority-tag" :class="plan.priority">
              <text class="tag-text">
                {{ uiText(getPriorityText(plan.priority)) }}
              </text>
            </view>
          </view>

          <view class="plan-actions">
            <BaseButton class="action-btn cta" variant="secondary" @tap="viewPlanDetail(plan)">{{
              t('plan.copy27')
            }}</BaseButton>
            <BaseButton class="action-btn" variant="secondary" @tap="adjustPlan(plan.id)">{{
              t('plan.copy28')
            }}</BaseButton>
            <BaseButton class="action-btn danger" variant="secondary" @tap="deletePlan(plan.id || index)">{{
              t('plan.copy29')
            }}</BaseButton>
          </view>
        </view>
      </template>
    </scroll-view>
  </view>
  <CustomModal
    v-if="pageDialog"
    :visible="true"
    :title="pageDialog.title"
    :content="pageDialog.content"
    :editable="pageDialog.editable"
    :placeholder-text="pageDialog.placeholderText"
    :confirm-text="pageDialog.confirmText"
    :cancel-text="pageDialog.cancelText"
    :show-cancel="pageDialog.showCancel !== false"
    :type="pageDialog.confirmColor ? 'error' : 'info'"
    escape-closable
    @confirm="settleDialog(true, $event)"
    @cancel="settleDialog(false)"
  />
</template>

<script setup>
import CustomModal from '@/components/common/CustomModal.vue';
const uiText = (value) => translateRegisteredText('plan', value);
import '@/pages/plan/messages.js';
import { t, translateRegisteredText } from '@/i18n/index.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import BaseStat from '@/components/base/base-stat/base-stat.vue';
import BaseListRow from '@/components/base/base-list-row/base-list-row.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import '@/styles/yozi-pages.scss';

import LearningOverview from '@/components/business/learning/learning-overview.vue';
import LearningShell from '@/components/business/learning/learning-shell.vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';

import { ref, computed } from 'vue';
const learning = useConversationLearningStore();
const showLegacy = ref(false);
function toggleLegacy() {
  showLegacy.value = !showLegacy.value;
  if (showLegacy.value) loadPlans(true);
}
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app';
import { usePageDialog } from '@/composables/usePageDialog.js';
const { pageDialog, settleDialog, modal } = usePageDialog();
import { toast } from '@/utils/toast.js';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { intelligentPlanManager } from './intelligent-plan-manager.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight, getCapsuleSafeRight } from '@/utils/core/system.js';
import { safeNavigateTo, safeNavigateBack } from '@/utils/safe-navigate';
import { requireLogin, isUserLoggedIn } from '@/utils/auth/loginGuard.js';
import { storageService } from '@/services/storageService.js';
import { useStudyEngineStore } from '@/stores/modules/study-engine.js';

// ---- 响应式状态 ----
const isRefreshing = ref(false);
const statusBarHeight = ref(44);
const capsuleSafeRight = ref(20);
const isDark = computed(() => useThemeStore().isDark);
const isLoading = ref(true);
const plans = ref([]);
const intelligentReminders = ref([]);
// AI 自适应计划
const aiPlan = ref(null);
const aiPlanLoading = ref(false);

// ---- 非响应式变量 ----
let studyEngineStore = null;
let _themeHandler = null;
let loadDelayTimer = null;

// ---- 页面生命周期 ----

onLoad(() => {
  statusBarHeight.value = getStatusBarHeight();
  capsuleSafeRight.value = getCapsuleSafeRight();
  studyEngineStore = useStudyEngineStore();

  void 0;

  _themeHandler = (_mode) => {
    void 0;
  };
  uni.$on('themeUpdate', _themeHandler);
});

onUnload(() => {
  uni.$off('themeUpdate', _themeHandler);
  // 清理加载延迟定时器，防止页面卸载后仍修改状态
  if (loadDelayTimer) clearTimeout(loadDelayTimer);
});

onShow(() => {
  learning.refresh();
  if (!showLegacy.value) {
    isLoading.value = false;
    return;
  }
  loadPlans();
  loadIntelligentReminders();
  loadAIPlan();
});

// ---- 数据加载 ----

/** 下拉刷新 */
async function onPullRefresh() {
  isRefreshing.value = true;
  try {
    await loadPlans();
  } catch (_e) {
    /* 静默处理 */
  }
  isRefreshing.value = false;
}

/** 加载计划列表 */
function loadPlans() {
  try {
    plans.value = intelligentPlanManager.getPlans();
  } catch (e) {
    logger.error('[plan] 加载计划失败:', e);
    plans.value = [];
  } finally {
    // 追踪定时器，在 onUnload 中清理
    loadDelayTimer = setTimeout(() => {
      isLoading.value = false;
    }, 300);
  }
}

/** 加载智能提醒 */
async function loadIntelligentReminders() {
  try {
    intelligentReminders.value = await intelligentPlanManager.getIntelligentReminders();
  } catch {
    // 智能提醒加载失败不影响主流程，静默降级
    intelligentReminders.value = [];
  }
}

/** AI 自适应7天计划 — 调用后端 generate_plan API */
async function loadAIPlan() {
  // 检查缓存（1小时内有效）
  const cached = storageService.get('ai_adaptive_plan', null);
  if (cached && Date.now() - (cached._ts || 0) < 3600000) {
    aiPlan.value = cached;
    return;
  }

  aiPlanLoading.value = true;
  try {
    const examDate = storageService.get('exam_date', '');
    const dailyHours = storageService.get('daily_study_hours', 4);
    const result = await studyEngineStore.generateStudyPlan(examDate, dailyHours);
    if (result?.data?.plan) {
      const plan = result.data.plan;
      plan._ts = Date.now();
      aiPlan.value = plan;
      storageService.save('ai_adaptive_plan', plan);
    }
  } catch (err) {
    logger.warn('[plan] AI 计划加载失败:', err);
  } finally {
    aiPlanLoading.value = false;
  }
}

// ---- 用户交互 ----

/** 开始AI计划中的某一天任务 */
function startAIPlanDay(day) {
  if (day.tasks && day.tasks.length > 0) {
    const firstTask = day.tasks[0];
    if (firstTask.type === 'review') {
      safeNavigateTo('/pages/practice-sub/do-quiz?mode=smart_review');
    } else {
      safeNavigateTo('/pages/practice-sub/do-quiz');
    }
  }
}

/** 创建计划 */
function createPlan() {
  if (learning.state.plans.length || learning.state.attempts.length) return safeNavigateTo('/pages/learning/index');
  requireLogin(() => safeNavigateTo('/pages/practice/index'), { message: t('plan.copy30') });
}

/** 返回上一页 */
function goBack() {
  safeNavigateBack();
}

// ---- 辅助函数 ----

/** 获取状态文本 */
function getStatusText(status) {
  switch (status) {
    case 'not_started':
      return t('plan.copy31');
    case 'in_progress':
      return t('plan.copy32');
    case 'completed':
      return t('plan.copy33');
    default:
      return t('plan.copy34');
  }
}

/** 获取优先级文本 */
function getPriorityText(priority) {
  switch (priority) {
    case 'low':
      return t('plan.copy35');
    case 'medium':
      return t('plan.copy36');
    case 'high':
      return t('plan.copy37');
    default:
      return t('plan.copy34');
  }
}

/** 查看计划详情 */
function viewPlanDetail(plan) {
  logger.log('[Plan] 查看计划详情:', plan.id);
  const tasksDone = plan.tasks ? plan.tasks.filter((t) => t.completed).length : 0;
  const tasksTotal = plan.tasks ? plan.tasks.length : 0;
  const lines = [
    plan.name,
    t('plan.goalLine', { value: plan.goal || t('plan.notSet') }),
    `${plan.startDate} → ${plan.endDate}`,
    t('plan.dailyLine', { value: plan.dailyDuration || t('plan.notSet') }),
    tasksTotal > 0 ? t('plan.taskLine', { done: tasksDone, total: tasksTotal }) : null,
    plan.analytics ? t('plan.completionLine', { value: plan.analytics.completionRate }) : null
  ]
    .filter(Boolean)
    .join('\n');
  modal.show({
    title: t('plan.copy38'),
    content: lines,
    showCancel: false,
    confirmText: t('plan.copy39')
  });
}

/** 智能调整计划 */
function adjustPlan(planId) {
  if (!isUserLoggedIn()) {
    toast.info(t('plan.copy40'));
    return;
  }
  logger.log('[Plan] 智能调整计划:', planId);

  const studyStats = storageService.get('study_stats', {});
  const learningProgress = studyStats.completionRate || studyStats.progress || 0;
  const adjustedPlan = intelligentPlanManager.adjustPlan(planId, learningProgress);

  if (adjustedPlan) {
    toast.success(t('plan.copy41'));
    loadPlans();
  } else {
    toast.info(t('plan.copy42'));
  }
}

/** 删除计划 */
function deletePlan(planId) {
  if (!isUserLoggedIn()) {
    toast.info(t('plan.copy43'));
    return;
  }
  modal.show({
    title: t('plan.copy44'),
    content: t('plan.copy45'),
    confirmColor: 'var(--danger)',
    success: (res) => {
      if (res.confirm) {
        const success = intelligentPlanManager.deletePlan(planId);
        if (success) {
          toast.success(t('plan.copy46'));
          loadPlans();
        } else {
          toast.info(t('plan.copy47'));
        }
      }
    }
  });
}
</script>
