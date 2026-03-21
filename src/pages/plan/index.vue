<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <view class="aurora-bg" />

    <!-- 骨架屏 -->
    <!-- #ifdef APP-PLUS -->
    <PlanSkeleton v-if="isLoading" :is-dark="isDark" />
    <!-- #endif -->
    <!-- #ifndef APP-PLUS -->
    <!-- #ifndef APP-NVUE -->
    <transition name="skeleton-fade">
      <PlanSkeleton v-if="isLoading" :is-dark="isDark" />
    </transition>
    <!-- #endif -->
    <!-- #ifdef APP-NVUE -->
    <PlanSkeleton v-if="isLoading" :is-dark="isDark" />
    <!-- #endif -->
    <!-- #endif -->

    <view v-if="!isLoading" class="header-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content" :style="{ paddingRight: capsuleSafeRight + 'px' }">
        <text class="nav-back" @tap="goBack"> ← </text>
        <text class="nav-title"> 学习计划 </text>
        <view class="nav-add" @tap="createPlan">
          <text class="nav-add-text"> + </text>
        </view>
      </view>
    </view>

    <scroll-view v-if="!isLoading" scroll-y class="main-scroll" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <view class="hero-card">
        <text class="hero-eyebrow"> Planning Center </text>
        <text class="hero-title"> 把备考安排成清晰的一周节奏 </text>
        <text class="hero-subtitle"> 管理每日时长、提醒和任务进度，保持轻盈但持续的推进感。 </text>
        <view class="hero-actions">
          <view class="hero-cta" @tap="createPlan">
            <text class="hero-cta-text"> 新建计划 </text>
          </view>
        </view>
      </view>

      <view v-if="intelligentReminders.length > 0" class="reminder-card">
        <view class="section-heading">
          <text class="section-eyebrow"> Smart Reminders </text>
          <view class="section-title-row">
            <BaseIcon name="robot" :size="30" class="reminder-icon" />
            <text class="section-title"> 智能提醒 </text>
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
              {{ reminder.message }}
            </text>
            <text class="reminder-time">
              {{ reminder.time }}
            </text>
          </view>
        </view>
      </view>

      <BaseEmpty
        v-if="plans.length === 0"
        icon="calendar"
        title="还没有学习计划"
        desc="创建一个学习计划，让备考更有条理！"
        :show-button="true"
        button-text="创建学习计划"
        :is-dark="isDark"
        @action="createPlan"
      />

      <view v-if="plans.length > 0" class="section-heading plans-heading">
        <text class="section-eyebrow"> Your Plans </text>
        <text class="section-title"> 当前进行中的计划 </text>
      </view>

      <view v-for="(plan, index) in plans" :key="plan.id || index" class="plan-card">
        <view class="plan-header">
          <text class="plan-name">
            {{ plan.name }}
          </text>
          <view class="plan-badge" :class="plan.status">
            <text class="plan-badge-text">
              {{ getStatusText(plan.status) }}
            </text>
          </view>
        </view>

        <text class="plan-goal">
          {{ plan.goal }}
        </text>

        <view v-if="plan.analytics" class="plan-analytics">
          <view class="analytics-row">
            <view class="analytics-item">
              <text class="analytics-label"> 完成率 </text>
              <text class="analytics-value"> {{ plan.analytics.completionRate }}% </text>
            </view>
            <view class="analytics-item">
              <text class="analytics-label"> 趋势 </text>
              <text class="analytics-value" :class="getTrendClass(plan.analytics.progressTrend.trend)">
                {{ plan.analytics.progressTrend.trend > 0 ? '+' : '' }}{{ plan.analytics.progressTrend.trend }}%
              </text>
            </view>
            <view class="analytics-item">
              <text class="analytics-label"> 预计完成 </text>
              <text class="analytics-value"> {{ plan.analytics.progressTrend.projected }}% </text>
            </view>
          </view>

          <view
            v-if="plan.analytics.recommendedAdjustments && plan.analytics.recommendedAdjustments.length > 0"
            class="adjustments-section"
          >
            <text class="adjustments-title"> 智能建议 </text>
            <view
              v-for="(adjustment, adjIndex) in plan.analytics.recommendedAdjustments"
              :key="adjIndex"
              class="adjustment-item"
              :class="adjustment.priority"
            >
              <text class="adjustment-message">
                {{ adjustment.message }}
              </text>
            </view>
          </view>
        </view>

        <view class="plan-meta-grid">
          <view class="meta-item">
            <text class="meta-label"> 开始日期 </text>
            <text class="meta-value">
              {{ plan.startDate }}
            </text>
          </view>
          <view class="meta-item">
            <text class="meta-label"> 结束日期 </text>
            <text class="meta-value">
              {{ plan.endDate }}
            </text>
          </view>
          <view class="meta-item">
            <text class="meta-label"> 每日时长 </text>
            <text class="meta-value">
              {{ plan.dailyDuration }}
            </text>
          </view>
          <view class="meta-item">
            <text class="meta-label"> 提醒时间 </text>
            <text class="meta-value">
              {{ plan.reminderTime }}
            </text>
          </view>
        </view>

        <view v-if="plan.tasks && plan.tasks.length > 0" class="task-stats">
          <text class="ta<REDACTED_SECRET>"> 任务进度 </text>
          <view class="ta<REDACTED_SECRET>">
            <view class="ta<REDACTED_SECRET>" :style="{ width: (plan.progress || 0) + '%' }" />
          </view>
          <text class="ta<REDACTED_SECRET>">
            {{ plan.tasks.filter((t) => t.completed).length }}/{{ plan.tasks.length }} 个任务
          </text>
        </view>

        <view class="plan-footer">
          <view class="category-tag" :class="plan.category">
            <text class="tag-text">
              {{ plan.category }}
            </text>
          </view>
          <view class="priority-tag" :class="plan.priority">
            <text class="tag-text">
              {{ getPriorityText(plan.priority) }}
            </text>
          </view>
        </view>

        <view class="plan-actions">
          <text class="action-btn cta" @tap="viewPlanDetail(plan)"> 查看详情 </text>
          <text class="action-btn" @tap="adjustPlan(plan.id)"> 智能调整 </text>
          <text class="action-btn danger" @tap="deletePlan(plan.id || index)"> 删除 </text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { storageService } from '@/services/storageService.js';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import PlanSkeleton from './components/plan-skeleton/plan-skeleton.vue';
import { intelligentPlanManager } from './intelligent-plan-manager.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight, getCapsuleSafeRight } from '@/utils/core/system.js';
import { safeNavigateTo, safeNavigateBack } from '@/utils/safe-navigate';
import { requireLogin, isUserLoggedIn } from '@/utils/auth/loginGuard.js';

export default {
  components: {
    BaseEmpty,
    BaseIcon,
    PlanSkeleton
  },
  data() {
    return {
      statusBarHeight: 44,
      capsuleSafeRight: 20,
      isDark: false,
      isLoading: true,
      plans: [],
      intelligentReminders: []
    };
  },
  onLoad() {
    this.statusBarHeight = getStatusBarHeight();
    this.capsuleSafeRight = getCapsuleSafeRight();

    const savedTheme = storageService.get('theme_mode', 'light');
    this.isDark = savedTheme === 'dark';

    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);
  },
  onUnload() {
    uni.$off('themeUpdate', this._themeHandler);
  },
  onShow() {
    this.loadPlans();
    this.loadIntelligentReminders();
  },
  methods: {
    loadPlans() {
      try {
        this.plans = intelligentPlanManager.getPlans();
      } catch (e) {
        logger.error('[plan] 加载计划失败:', e);
        this.plans = [];
      } finally {
        setTimeout(() => {
          this.isLoading = false;
        }, 300);
      }
    },
    async loadIntelligentReminders() {
      this.intelligentReminders = await intelligentPlanManager.getIntelligentReminders();
    },
    createPlan() {
      requireLogin(() => safeNavigateTo('/pages/plan/create'), { message: '请先登录后创建计划' });
    },
    goBack() {
      safeNavigateBack();
    },
    getStatusText(status) {
      switch (status) {
        case 'not_started':
          return '未开始';
        case 'in_progress':
          return '进行中';
        case 'completed':
          return '已完成';
        default:
          return '未知';
      }
    },
    getPriorityText(priority) {
      switch (priority) {
        case 'low':
          return '低优先级';
        case 'medium':
          return '中优先级';
        case 'high':
          return '高优先级';
        default:
          return '未知';
      }
    },
    getTrendClass(trend) {
      if (trend > 0) return 'positive';
      if (trend < 0) return 'negative';
      return 'neutral';
    },
    viewPlanDetail(plan) {
      logger.log('[Plan] 查看计划详情:', plan.id);
      const tasksDone = plan.tasks ? plan.tasks.filter((t) => t.completed).length : 0;
      const tasksTotal = plan.tasks ? plan.tasks.length : 0;
      const lines = [
        `📌 ${plan.name}`,
        `🎯 目标：${plan.goal || '未设置'}`,
        `📅 ${plan.startDate} → ${plan.endDate}`,
        `⏱ 每日 ${plan.dailyDuration || '未设置'}`,
        tasksTotal > 0 ? `✅ 任务进度：${tasksDone}/${tasksTotal}` : null,
        plan.analytics ? `📈 完成率：${plan.analytics.completionRate}%` : null
      ]
        .filter(Boolean)
        .join('\n');
      uni.showModal({
        title: '计划详情',
        content: lines,
        showCancel: false,
        confirmText: '关闭'
      });
    },
    adjustPlan(planId) {
      if (!isUserLoggedIn()) {
        uni.showToast({ title: '请先登录后调整计划', icon: 'none' });
        return;
      }
      logger.log('[Plan] 智能调整计划:', planId);

      const studyStats = storageService.get('study_stats', {});
      const learningProgress = studyStats.completionRate || studyStats.progress || 0;
      const adjustedPlan = intelligentPlanManager.adjustPlan(planId, learningProgress);

      if (adjustedPlan) {
        uni.showToast({
          title: '计划已智能调整',
          icon: 'success'
        });
        this.loadPlans();
      } else {
        uni.showToast({
          title: '调整失败',
          icon: 'none'
        });
      }
    },
    deletePlan(planId) {
      if (!isUserLoggedIn()) {
        uni.showToast({ title: '请先登录后删除计划', icon: 'none' });
        return;
      }
      uni.showModal({
        title: '删除计划',
        content: '确定要删除这个学习计划吗？',
        confirmColor: '#FF3B30',
        success: (res) => {
          if (res.confirm) {
            const success = intelligentPlanManager.deletePlan(planId);
            if (success) {
              uni.showToast({
                title: '计划已删除',
                icon: 'success'
              });
              this.loadPlans();
            } else {
              uni.showToast({
                title: '删除失败',
                icon: 'none'
              });
            }
          }
        }
      });
    }
  }
};
</script>

<style lang="scss" scoped>
.container {
  min-height: 100%;
  min-height: 100vh;
  background: linear-gradient(
    180deg,
    var(--page-gradient-top) 0%,
    var(--page-gradient-mid) 52%,
    var(--page-gradient-bottom) 100%
  );
  position: relative;
  overflow: hidden;
  transition: background 0.3s;
}

.aurora-bg {
  position: absolute;
  top: -120rpx;
  left: -80rpx;
  width: 100%;
  height: 620rpx;
  background:
    radial-gradient(circle at 18% 24%, rgba(107, 208, 150, 0.34) 0%, transparent 40%),
    radial-gradient(circle at 82% 10%, rgba(255, 255, 255, 0.42) 0%, transparent 28%);
  filter: blur(70px);
  opacity: 0.95;
  z-index: 0;
}

.header-nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 38%),
    linear-gradient(160deg, var(--apple-glass-nav-bg) 0%, var(--apple-glass-card-bg) 100%);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border-bottom: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-surface);
}

.nav-content {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30rpx;
}

.nav-back,
.nav-add {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-surface);
}

.nav-back {
  font-size: 36rpx;
  color: var(--text-main);
  font-weight: 700;
}

.nav-title {
  font-size: 32rpx;
  font-weight: 620;
  color: var(--text-main);
}

.nav-add-text {
  font-size: 40rpx;
  line-height: 1;
  color: var(--text-main);
  font-weight: 600;
}

.main-scroll {
  height: 100%;
  height: 100vh;
  padding: 30rpx 30rpx 96rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

.hero-card,
.reminder-card,
.plan-card {
  margin-bottom: 30rpx;
  padding: 30rpx;
  border-radius: 32rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-card);
}

.hero-card {
  padding: 36rpx 32rpx;
}

.hero-eyebrow,
.section-eyebrow {
  display: block;
  margin-bottom: 10rpx;
  font-size: 22rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.hero-title {
  display: block;
  font-size: 44rpx;
  line-height: 1.2;
  font-weight: 700;
  color: var(--text-main);
}

.hero-subtitle {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--text-sub);
}

.hero-actions {
  margin-top: 28rpx;
}

.hero-cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 200rpx;
  padding: 22rpx 34rpx;
  border-radius: 999rpx;
  background: var(--cta-primary-bg);
  border: 1px solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.hero-cta-text {
  font-size: 26rpx;
  font-weight: 620;
  color: var(--cta-primary-text);
}

.section-heading {
  margin-bottom: 18rpx;
}

.section-title-row {
  display: flex;
  align-items: center;
  /* gap: 10rpx; -- replaced for Android WebView compat */
}

.section-title {
  font-size: 34rpx;
  font-weight: 680;
  color: var(--text-main);
}

.plans-heading {
  margin-top: 6rpx;
}

.reminder-icon {
  color: var(--text-main);
}

.reminder-item {
  padding: 18rpx 20rpx;
  border-radius: 22rpx;
  margin-bottom: 12rpx;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.44);
}

.reminder-item.high {
  background: rgba(255, 99, 90, 0.12);
}

.reminder-item.medium {
  background: rgba(255, 204, 0, 0.12);
}

.reminder-message {
  display: block;
  margin-bottom: 8rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: var(--text-main);
}

.reminder-time {
  font-size: 20rpx;
  color: var(--text-sub);
}

.plan-header {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.plan-name {
  flex: 1;
  margin-right: 20rpx;
  font-size: 32rpx;
  font-weight: 650;
  color: var(--text-main);
}

.plan-badge,
.category-tag,
.priority-tag {
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  border: 1px solid rgba(255, 255, 255, 0.44);
  background: rgba(255, 255, 255, 0.62);
}

.plan-badge-text,
.tag-text {
  font-size: 20rpx;
  font-weight: 700;
}

.plan-badge {
  color: var(--text-sub);
}

.plan-badge.in_progress {
  background: rgba(52, 199, 89, 0.14);
  color: var(--success, #34c759);
}

.plan-badge.completed {
  background: rgba(10, 132, 255, 0.12);
  color: var(--info, #0a84ff);
}

.plan-goal {
  display: block;
  margin-bottom: 24rpx;
  font-size: 25rpx;
  line-height: 1.7;
  color: var(--text-sub);
}

.plan-analytics {
  margin-bottom: 30rpx;
  padding: 20rpx;
  background: rgba(255, 255, 255, 0.54);
  border-radius: 24rpx;
  border: 1px solid rgba(255, 255, 255, 0.42);
}

.analytics-row {
  display: flex;
  justify-content: space-between;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  margin-bottom: 20rpx;
}

.analytics-item {
  flex: 1;
  text-align: center;
}

.analytics-label {
  display: block;
  margin-bottom: 8rpx;
  font-size: 22rpx;
  color: var(--text-sub);
}

.analytics-value {
  font-size: 28rpx;
  font-weight: 650;
  color: var(--text-main);
}

.analytics-value.positive {
  color: var(--success, #34c759);
}

.analytics-value.negative {
  color: var(--danger, #ff3b30);
}

.analytics-value.neutral {
  color: var(--warning, #ff9f0a);
}

.adjustments-title {
  display: block;
  margin-bottom: 12rpx;
  font-size: 24rpx;
  font-weight: 620;
  color: var(--text-main);
}

.adjustment-item {
  padding: 14rpx 16rpx;
  border-radius: 16rpx;
  margin-bottom: 8rpx;
  background: rgba(255, 255, 255, 0.48);
}

.adjustment-item.high {
  background: rgba(255, 99, 90, 0.12);
}

.adjustment-item.medium {
  background: rgba(255, 204, 0, 0.12);
}

.adjustment-message {
  font-size: 22rpx;
  line-height: 1.5;
  color: var(--text-main);
}

.plan-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-bottom: 22rpx;
}

.meta-item,
.task-stats,
.action-btn {
  background: rgba(255, 255, 255, 0.52);
  border: 1px solid rgba(255, 255, 255, 0.42);
}

.meta-item {
  padding: 18rpx 20rpx;
  border-radius: 22rpx;
}

.meta-label {
  display: block;
  margin-bottom: 8rpx;
  font-size: 22rpx;
  color: var(--text-sub);
  letter-spacing: 1rpx;
}

.meta-value {
  display: block;
  font-size: 26rpx;
  font-weight: 620;
  color: var(--text-main);
}

.task-stats {
  margin-bottom: 24rpx;
  padding: 20rpx 22rpx;
  border-radius: 24rpx;
}

.ta<REDACTED_SECRET> {
  display: block;
  margin-bottom: 12rpx;
  font-size: 24rpx;
  font-weight: 620;
  color: var(--text-main);
}

.ta<REDACTED_SECRET> {
  height: 10rpx;
  margin-bottom: 10rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.5);
  overflow: hidden;
}

.ta<REDACTED_SECRET> {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, rgba(52, 199, 89, 0.88) 0%, rgba(101, 219, 138, 0.96) 100%);
  transition: width 0.3s ease;
}

.ta<REDACTED_SECRET> {
  font-size: 22rpx;
  color: var(--text-sub);
}

.plan-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  padding-top: 20rpx;
  margin-bottom: 20rpx;
  border-top: 1px solid var(--apple-divider);
}

.category-tag {
  color: var(--text-main);
}

.priority-tag.low {
  color: var(--success, #34c759);
}

.priority-tag.medium {
  background: rgba(255, 204, 0, 0.12);
  color: var(--warning, #ff9f0a);
}

.priority-tag.high {
  background: rgba(255, 99, 90, 0.12);
  color: var(--danger, #ff3b30);
}

.plan-actions {
  display: flex;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  padding-top: 20rpx;
  border-top: 1px solid var(--apple-divider);
}

.action-btn {
  flex: 1;
  text-align: center;
  padding: 16rpx 20rpx;
  border-radius: 999rpx;
  font-size: 24rpx;
  color: var(--text-main);
}

.action-btn.cta {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border-color: var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.action-btn.danger {
  background: rgba(255, 99, 90, 0.12);
  color: var(--danger, #ff3b30);
}

.action-btn:active,
.nav-back:active,
.nav-add:active,
.hero-cta:active {
  transform: scale(0.97);
  opacity: 0.88;
}

.container.dark-mode .aurora-bg {
  background:
    radial-gradient(circle at 18% 24%, rgba(10, 132, 255, 0.18) 0%, transparent 42%),
    radial-gradient(circle at 82% 10%, rgba(95, 170, 255, 0.14) 0%, transparent 30%) !important;
  opacity: 0.9;
  filter: blur(110px);
}

.container.dark-mode .nav-back,
.container.dark-mode .nav-add,
.container.dark-mode .reminder-item,
.container.dark-mode .plan-analytics,
.container.dark-mode .meta-item,
.container.dark-mode .task-stats,
.container.dark-mode .category-tag,
.container.dark-mode .priority-tag,
.container.dark-mode .action-btn {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

.container.dark-mode .action-btn.cta {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
}

.container.dark-mode .hero-card,
.container.dark-mode .reminder-card,
.container.dark-mode .plan-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.92) 0%, rgba(10, 12, 18, 0.88) 100%);
}

.skeleton-fade-leave-active {
  transition: opacity 0.35s ease-out;
}

.skeleton-fade-leave-to {
  opacity: 0;
}
</style>
