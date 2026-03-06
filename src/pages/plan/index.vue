<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <view class="aurora-bg" />

    <!-- 骨架屏 -->
    <!-- #ifndef APP-NVUE -->
    <transition name="skeleton-fade">
      <PlanSkeleton v-if="isLoading" :is-dark="isDark" />
    </transition>
    <!-- #endif -->
    <!-- #ifdef APP-NVUE -->
    <PlanSkeleton v-if="isLoading" :is-dark="isDark" />
    <!-- #endif -->

    <!-- 导航栏 - 添加设计系统工具类 -->
    <view v-if="!isLoading" class="header-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content ds-flex ds-flex-between">
        <text class="nav-back ds-touchable" @tap="goBack"> ← </text>
        <text class="nav-title ds-text-lg ds-font-semibold"> 我的学习计划 </text>
        <text class="nav-add ds-touchable" @tap="createPlan"> + </text>
      </view>
    </view>

    <scroll-view v-if="!isLoading" scroll-y class="main-scroll" :style="{ paddingTop: statusBarHeight + 50 + 'px' }">
      <!-- 智能提醒卡片 -->
      <view v-if="intelligentReminders.length > 0" class="glass-card reminder-card">
        <view class="reminder-header">
          <BaseIcon name="robot" :size="32" class="reminder-icon" />
          <text class="reminder-title"> 智能提醒 </text>
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

      <!-- 空状态 -->
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

      <!-- 计划列表 - 优化布局 -->
      <view v-for="(plan, index) in plans" :key="plan.id || index" class="glass-card plan-card">
        <view class="plan-header ds-flex ds-flex-between">
          <text class="plan-name ds-text-base ds-font-semibold">
            {{ plan.name }}
          </text>
          <view class="plan-badge" :class="plan.status">
            <text class="ds-text-xs ds-font-bold">
              {{ getStatusText(plan.status) }}
            </text>
          </view>
        </view>

        <text class="plan-goal ds-text-sm">
          {{ plan.goal }}
        </text>

        <!-- 智能分析数据 -->
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

          <!-- 推荐调整 -->
          <view
            v-if="plan.analytics.recommendedAdjustments && plan.analytics.recommendedAdjustments.length > 0"
            class="adjustments-section"
          >
            <text class="adjustments-title"> <BaseIcon name="bulb" :size="24" /> 智能建议 </text>
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

        <view class="plan-meta ds-flex ds-gap-sm">
          <view class="meta-item ds-flex-col">
            <text class="meta-label ds-text-xs"> 开始日期 </text>
            <text class="meta-value ds-text-sm ds-font-semibold">
              {{ plan.startDate }}
            </text>
          </view>
          <view class="meta-item ds-flex-col">
            <text class="meta-label ds-text-xs"> 结束日期 </text>
            <text class="meta-value ds-text-sm ds-font-semibold">
              {{ plan.endDate }}
            </text>
          </view>
        </view>

        <view class="plan-meta ds-flex ds-gap-sm">
          <view class="meta-item ds-flex-col">
            <text class="meta-label ds-text-xs"> 每日时长 </text>
            <text class="meta-value ds-text-sm ds-font-semibold">
              {{ plan.dailyDuration }}
            </text>
          </view>
          <view class="meta-item ds-flex-col">
            <text class="meta-label ds-text-xs"> 提醒时间 </text>
            <text class="meta-value ds-text-sm ds-font-semibold">
              {{ plan.reminderTime }}
            </text>
          </view>
        </view>

        <!-- 任务统计 -->
        <view v-if="plan.tasks && plan.tasks.length > 0" class="task-stats">
          <text class="task-stats-label"> 任务进度 </text>
          <view class="task-progress-bar">
            <view class="task-progress-fill" :style="{ width: (plan.progress || 0) + '%' }" />
          </view>
          <text class="task-stats-text">
            {{ plan.tasks.filter((t) => t.completed).length }}/{{ plan.tasks.length }} 个任务
          </text>
        </view>

        <view class="plan-footer ds-flex ds-flex-between">
          <view class="category-tag" :class="plan.category">
            <text class="ds-text-xs ds-font-bold">
              {{ plan.category }}
            </text>
          </view>
          <view class="priority-tag" :class="plan.priority">
            <text class="ds-text-xs ds-font-bold">
              {{ getPriorityText(plan.priority) }}
            </text>
          </view>
        </view>

        <!-- 计划操作 -->
        <view class="plan-actions">
          <text class="action-btn" @tap="viewPlanDetail(plan)"> 查看详情 </text>
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
import { getStatusBarHeight } from '@/utils/core/system.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
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
      isDark: false,
      isLoading: true,
      plans: [],
      intelligentReminders: []
    };
  },
  onLoad() {
    this.statusBarHeight = getStatusBarHeight();

    // 初始化主题
    const savedTheme = storageService.get('theme_mode', 'light');
    this.isDark = savedTheme === 'dark';

    // 监听全局主题更新事件
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);
  },
  onUnload() {
    // 移除事件监听
    uni.$off('themeUpdate', this._themeHandler);
  },
  onShow() {
    this.loadPlans();
    this.loadIntelligentReminders();
  },
  methods: {
    loadPlans() {
      try {
        // 使用智能计划管理器加载学习计划
        this.plans = intelligentPlanManager.getPlans();
      } catch (e) {
        logger.error('[plan] 加载计划失败:', e);
        this.plans = [];
      } finally {
        // 隐藏骨架屏
        setTimeout(() => {
          this.isLoading = false;
        }, 300);
      }
    },
    async loadIntelligentReminders() {
      // 加载智能提醒
      this.intelligentReminders = await intelligentPlanManager.getIntelligentReminders();
    },
    createPlan() {
      requireLogin(() => safeNavigateTo('/pages/plan/create'), { message: '请先登录后创建计划' });
    },
    goBack() {
      uni.navigateBack();
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
      // 构建详情文本展示
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
      // 智能调整计划
      logger.log('[Plan] 智能调整计划:', planId);

      // 获取真实学习进度（从本地存储的学习统计中计算）
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
      // 删除计划
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
  min-height: 100vh;
  background: var(--bg-page);
  position: relative;
  overflow: hidden;
  transition: background-color 0.3s;
}

.aurora-bg {
  position: absolute;
  top: 0;
  width: 100%;
  height: 500rpx;
  background: linear-gradient(135deg, #a8e6cf 0%, #dcedc1 100%);
  filter: blur(80px);
  opacity: 0.6;
  z-index: 0;
}

.header-nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-color);

  .nav-content {
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 30rpx;

    .nav-back {
      font-size: 36rpx;
      color: var(--text-main);
      font-weight: bold;
    }

    .nav-title {
      font-size: 34rpx;
      font-weight: 600;
      color: var(--text-main);
    }

    .nav-add {
      font-size: 40rpx;
      color: var(--text-main);
      font-weight: bold;
    }
  }
}

.main-scroll {
  height: 100vh;
  padding: 30rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

/* 智能提醒卡片 */
.reminder-card {
  margin-bottom: 30rpx;
  padding: 24rpx;

  .reminder-header {
    display: flex;
    align-items: center;
    margin-bottom: 16rpx;

    .reminder-icon {
      font-size: 32rpx;
      margin-right: 12rpx;
    }

    .reminder-title {
      font-size: 28rpx;
      font-weight: 600;
      color: var(--text-main);
    }
  }

  .reminder-list {
    .reminder-item {
      padding: 16rpx;
      border-radius: 16rpx;
      margin-bottom: 12rpx;
      background: rgba(46, 204, 113, 0.05);

      &.high {
        background: rgba(231, 76, 60, 0.1);
      }

      &.medium {
        background: rgba(241, 196, 15, 0.1);
      }

      .reminder-message {
        font-size: 24rpx;
        color: var(--text-main);
        display: block;
        margin-bottom: 8rpx;
      }

      .reminder-time {
        font-size: 20rpx;
        color: var(--text-sub);
      }
    }
  }
}

/* 空状态 */
.empty-box {
  text-align: center;
  padding-top: 200rpx;

  .empty-icon {
    font-size: 120rpx;
    display: block;
    margin-bottom: 30rpx;
  }

  .empty-text {
    color: var(--text-sub);
    font-size: 28rpx;
    margin-bottom: 60rpx;
    display: block;
  }

  .create-btn {
    background: var(--success);
    color: white;
    border: none;
    border-radius: 50rpx;
    padding: 20rpx 60rpx;
    font-size: 28rpx;
    font-weight: bold;

    &::after {
      border: none;
    }
  }
}

/* 通用玻璃卡片 */
.glass-card {
  background: var(--bg-card);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-color);
  border-radius: 40rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: var(--shadow-md);
  transition: all 0.3s;
}

.plan-card {
  padding: 30rpx;
}

.plan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.plan-name {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-main);
  flex: 1;
  margin-right: 20rpx;
}

.plan-badge {
  padding: 6rpx 16rpx;
  border-radius: 16rpx;
  font-size: 20rpx;
  font-weight: bold;

  &.not_started {
    background: var(--muted);
    color: var(--text-sub);
  }

  &.in_progress {
    background: rgba(46, 204, 113, 0.1);
    color: var(--success);
  }

  &.completed {
    background: rgba(74, 144, 226, 0.1);
    color: var(--info);
  }
}

.plan-goal {
  font-size: 26rpx;
  color: var(--text-sub);
  line-height: 1.5;
  margin-bottom: 30rpx;
  display: block;
}

/* 智能分析数据 */
.plan-analytics {
  margin-bottom: 30rpx;
  padding: 20rpx;
  background: rgba(46, 204, 113, 0.05);
  border-radius: 24rpx;

  .analytics-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 20rpx;

    .analytics-item {
      flex: 1;
      text-align: center;

      .analytics-label {
        font-size: 22rpx;
        color: var(--text-sub);
        display: block;
        margin-bottom: 8rpx;
      }

      .analytics-value {
        font-size: 28rpx;
        font-weight: 600;
        color: var(--text-main);

        &.positive {
          color: var(--success);
        }

        &.negative {
          color: var(--danger);
        }

        &.neutral {
          color: var(--warning);
        }
      }
    }
  }

  .adjustments-section {
    .adjustments-title {
      font-size: 24rpx;
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 12rpx;
      display: block;
    }

    .adjustment-item {
      padding: 12rpx;
      border-radius: 12rpx;
      margin-bottom: 8rpx;
      background: rgba(46, 204, 113, 0.05);

      &.high {
        background: rgba(231, 76, 60, 0.1);
      }

      &.medium {
        background: rgba(241, 196, 15, 0.1);
      }

      .adjustment-message {
        font-size: 22rpx;
        color: var(--text-main);
      }
    }
  }
}

.plan-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.meta-item {
  flex: 1;

  &:first-child {
    margin-right: 20rpx;
  }
}

.meta-label {
  display: block;
  font-size: 22rpx;
  color: var(--text-sub);
  margin-bottom: 8rpx;
  opacity: 0.8;
}

.meta-value {
  display: block;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-main);
}

/* 任务统计 */
.task-stats {
  margin-bottom: 24rpx;

  .task-stats-label {
    font-size: 24rpx;
    font-weight: 600;
    color: var(--text-main);
    margin-bottom: 12rpx;
    display: block;
  }

  .task-progress-bar {
    height: 8rpx;
    background: var(--muted);
    border-radius: 4rpx;
    margin-bottom: 8rpx;

    .task-progress-fill {
      height: 100%;
      background: var(--success);
      border-radius: 4rpx;
      transition: width 0.3s ease;
    }
  }

  .task-stats-text {
    font-size: 22rpx;
    color: var(--text-sub);
  }
}

.plan-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 20rpx;
  border-top: 1px solid var(--border-color);
  margin-bottom: 20rpx;
}

.category-tag {
  padding: 8rpx 16rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
  font-weight: bold;

  &.low {
    background: rgba(46, 204, 113, 0.1);
    color: var(--success);
  }

  &.medium {
    background: rgba(241, 196, 15, 0.1);
    color: var(--warning);
  }

  &.high {
    background: rgba(231, 76, 60, 0.1);
    color: var(--danger);
  }
}

.priority-tag {
  padding: 8rpx 16rpx;
  border-radius: 16rpx;
  font-size: 22rpx;
  font-weight: bold;

  &.low {
    background: rgba(46, 204, 113, 0.1);
    color: var(--success);
  }

  &.medium {
    background: rgba(241, 196, 15, 0.1);
    color: var(--warning);
  }

  &.high {
    background: rgba(231, 76, 60, 0.1);
    color: var(--danger);
  }
}

/* 计划操作 */
.plan-actions {
  display: flex;
  justify-content: space-around;
  padding-top: 20rpx;
  border-top: 1px solid var(--border-color);

  .action-btn {
    font-size: 24rpx;
    color: var(--text-main);
    padding: 12rpx 24rpx;
    border-radius: 16rpx;
    background: rgba(46, 204, 113, 0.05);
    transition: all 0.2s;

    &:active {
      transform: scale(0.95);
      opacity: 0.8;
    }

    &.danger {
      color: var(--danger);
      background: rgba(231, 76, 60, 0.1);
    }
  }
}

/* 深色模式适配 - 极光背景 */
.container.dark-mode .aurora-bg {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%) !important;
  opacity: 0.4;
  filter: blur(120px);
}

/* 骨架屏淡出过渡 */
.skeleton-fade-leave-active {
  transition: opacity 0.35s ease-out;
}
.skeleton-fade-leave-to {
  opacity: 0;
}
</style>
