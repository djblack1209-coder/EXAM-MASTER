<template>
  <view class="page">
    <!-- 微信隐私保护弹窗 -->
    <PrivacyPopup />

    <!-- 自定义导航栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <text class="nav-title">EXAM-MASTER</text>
        <text class="nav-status">{{ navStatusText }}</text>
      </view>
    </view>

    <!-- 主内容 -->
    <scroll-view
      scroll-y
      class="main-scroll"
      :style="{ paddingTop: statusBarHeight + 44 + 'px' }"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- 品牌冲击首屏 -->
      <view class="section hero-section">
        <view class="hero-panel">
          <view class="hero-topline">
            <text class="hero-kicker">今日计划</text>
            <text class="hero-state">{{ masteryStateText }}</text>
          </view>
          <text class="hero-title">{{ greeting }}，进入今天的备考主线</text>
          <text class="hero-subtitle">{{ heroSubtitle }}</text>

          <view class="dashboard-tabs">
            <view
              v-for="tab in dashboardTabs"
              :key="tab.id"
              class="dashboard-tab"
              :class="{ active: activeDashboardTab === tab.id }"
              hover-class="btn-hover"
              @tap="selectDashboardTab(tab.id)"
            >
              <text>{{ tab.label }}</text>
            </view>
          </view>

          <view class="today-focus-panel">
            <view class="today-focus-copy">
              <text class="today-focus-kicker">今日重点</text>
              <text class="today-focus-title">{{ focusPanelTitle }}</text>
              <text class="today-focus-desc">{{ todayMomentumText }}</text>
            </view>
            <view class="mastery-orb">
              <text class="mastery-orb-value">{{ todayProgressPercent }}%</text>
              <text class="mastery-orb-label">今日</text>
            </view>
          </view>

          <view class="focus-chip-row">
            <view v-for="card in todayFocusCards" :key="card.label" class="focus-chip">
              <text class="focus-chip-value">{{ card.value }}</text>
              <text class="focus-chip-label">{{ card.label }}</text>
            </view>
          </view>

          <view class="knowledge-stage">
            <view class="knowledge-stage-head">
              <view>
                <text class="knowledge-kicker">知识图谱</text>
                <text class="knowledge-title">从题目点亮知识体系</text>
              </view>
              <view class="knowledge-score">
                <text class="knowledge-score-value">{{ knowledgeSummary.mastery }}%</text>
                <text class="knowledge-score-label">掌握</text>
              </view>
            </view>

            <view class="knowledge-map">
              <view v-for="line in knowledgeLines" :key="line.id" class="knowledge-line" :style="line.style" />
              <view
                v-for="node in knowledgePreviewNodes"
                :key="node.id"
                class="knowledge-node"
                :class="[`state-${node.state}`, { hot: node.hot }]"
                :style="node.style"
              />
            </view>

            <view class="knowledge-foot">
              <text>{{ knowledgeMapCaption }}</text>
              <text>{{ knowledgeSummary.strong }} 强 / {{ knowledgeSummary.weak }} 弱</text>
            </view>
          </view>

          <view class="hero-metric-strip">
            <view class="hero-metric">
              <text class="metric-label">今日完成</text>
              <text class="metric-value">{{ todayProgressPercent }}%</text>
            </view>
            <view class="hero-metric">
              <text class="metric-label">今日剩余</text>
              <text class="metric-value">{{ remainingToday }}</text>
            </view>
            <view class="hero-metric">
              <text class="metric-label">连续学习</text>
              <text class="metric-value">{{ streakDays }} 天</text>
            </view>
          </view>

          <view class="onboarding-entry" hover-class="btn-hover" @tap="goOnboarding">
            <view class="onboarding-entry-copy">
              <text class="onboarding-entry-title">重新校准备考路径</text>
              <text class="onboarding-entry-desc">选择英语/数学版本、每日目标和训练节奏</text>
            </view>
            <view class="onboarding-entry-mark">
              <text>调整</text>
            </view>
          </view>

          <view class="hero-action-row">
            <view class="hero-primary" hover-class="btn-hover" @tap="goToPractice">
              <text class="hero-primary-text">{{ primaryActionText }}</text>
            </view>
            <text class="hero-note">{{ todayMomentumText }}</text>
          </view>
        </view>
      </view>

      <!-- 今日进度卡片 -->
      <view class="section">
        <view class="card progress-card">
          <view class="card-header">
            <text class="card-title">今日进度</text>
            <text class="streak-badge">{{ streakDays }} 天连续学习</text>
          </view>
          <view class="progress-bar-wrap">
            <view class="progress-bar">
              <view class="progress-fill" :style="{ width: todayProgressPercent + '%' }" />
            </view>
            <text class="progress-text">{{ todayCount }} / {{ dailyGoal }}</text>
          </view>
        </view>
      </view>

      <!-- 统计网格 -->
      <view class="section stats-row">
        <view class="stat-card">
          <text class="stat-kicker">累计</text>
          <text class="stat-value">{{ totalQuestions }}</text>
          <text class="stat-label">累计做题</text>
        </view>
        <view class="stat-card">
          <text class="stat-kicker">正确</text>
          <text class="stat-value">{{ accuracy }}%</text>
          <text class="stat-label">正确率</text>
        </view>
      </view>

      <view class="section">
        <view class="next-actions-panel">
          <view class="next-actions-head">
            <text class="next-actions-title">下一步</text>
            <text class="next-actions-status">{{ nextActionStatusText }}</text>
          </view>
          <view class="next-actions-list">
            <view
              v-for="card in nextActionCards"
              :key="card.id"
              class="next-action-card"
              hover-class="btn-hover"
              @tap="handleNextAction(card.action)"
            >
              <view class="next-action-dot" :class="`tone-${card.tone}`" />
              <view class="next-action-copy">
                <text class="next-action-title">{{ card.title }}</text>
                <text class="next-action-desc">{{ card.desc }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 最近学习 -->
      <view v-if="recentActivities.length > 0" class="section">
        <text class="section-title">最近学习</text>
        <view class="card">
          <view
            v-for="(item, idx) in recentActivities"
            :key="idx"
            class="activity-item"
            :class="{ 'activity-border': idx < recentActivities.length - 1 }"
          >
            <view class="activity-left">
              <text class="activity-name">{{ item.name }}</text>
              <text class="activity-time">{{ item.time }}</text>
            </view>
            <text class="activity-progress">{{ item.progress }}</text>
          </view>
        </view>
      </view>

      <!-- 底部占位 -->
      <view :style="{ height: tabBarHeight + 96 + 'px' }" />
    </scroll-view>

    <!-- 底部导航栏 -->
    <CustomTabbar :active-index="0" />
  </view>
</template>

<script>
import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import { useStudyStore } from '@/stores/modules/study';
import { useUserStore } from '@/stores/modules/user';
import { useLearningTrajectoryStore } from '@/stores/modules/learning-trajectory-store.js';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { startGuestDemoPractice } from '@/utils/practice/demo-bank.js';

const KNOWLEDGE_NODE_LAYOUT = [
  { x: 10, y: 48, size: 74 },
  { x: 28, y: 24, size: 58 },
  { x: 48, y: 52, size: 88 },
  { x: 70, y: 28, size: 64 },
  { x: 82, y: 62, size: 52 },
  { x: 22, y: 72, size: 46 },
  { x: 58, y: 78, size: 42 },
  { x: 39, y: 10, size: 38 },
  { x: 76, y: 8, size: 36 }
];

const KNOWLEDGE_LINE_LAYOUT = [
  { id: 'l1', left: '18%', top: '44%', width: '180rpx', rotate: '-24deg' },
  { id: 'l2', left: '35%', top: '40%', width: '150rpx', rotate: '20deg' },
  { id: 'l3', left: '55%', top: '43%', width: '154rpx', rotate: '-24deg' },
  { id: 'l4', left: '60%', top: '64%', width: '150rpx', rotate: '23deg' },
  { id: 'l5', left: '20%', top: '62%', width: '162rpx', rotate: '17deg' },
  { id: 'l6', left: '42%', top: '25%', width: '128rpx', rotate: '-22deg' }
];

export default {
  components: { CustomTabbar, PrivacyPopup },

  setup() {
    const learningTrajectoryStore = useLearningTrajectoryStore();
    return { learningTrajectoryStore };
  },

  data() {
    return {
      // 布局
      statusBarHeight: 44,
      tabBarHeight: 90,
      isRefreshing: false,

      // 数据
      dailyGoal: 25,
      todayCount: 0,
      streakDays: 0,
      totalQuestions: 0,
      bankQuestionCount: 0,
      bankSource: null,
      accuracy: 0,
      recentActivities: [],
      activeDashboardTab: 'today',
      dashboardTabs: [
        { id: 'today', label: '今日' },
        { id: 'bank', label: '题库' },
        { id: 'review', label: '复习' }
      ],
      nextActionSeed: 'home'
    };
  },

  computed: {
    greeting() {
      const h = new Date().getHours();
      if (h < 6) return '夜深了';
      if (h < 12) return '上午好';
      if (h < 14) return '中午好';
      if (h < 18) return '下午好';
      return '晚上好';
    },

    todayProgressPercent() {
      if (this.dailyGoal <= 0) return 0;
      return Math.min(100, Math.round((this.todayCount / this.dailyGoal) * 100));
    },

    isNewUser() {
      return this.totalQuestions === 0 && this.streakDays === 0;
    },

    hasPracticeBank() {
      return this.bankQuestionCount > 0;
    },

    isGuestDemoBank() {
      return this.hasPracticeBank && this.bankSource?.type === 'guest_demo';
    },

    hasOfficialPracticeBank() {
      return this.hasPracticeBank && this.bankSource?.type === 'published_registry';
    },

    hasUnverifiedPracticeBank() {
      return this.hasPracticeBank && !this.isGuestDemoBank && !this.hasOfficialPracticeBank;
    },

    heroSubtitle() {
      if (this.hasOfficialPracticeBank) return '把题库、错题和复习节奏压缩成一条可执行路径。';
      return '先用示例题熟悉节奏，再围绕知识图谱推进复习。';
    },

    navStatusText() {
      if (this.isGuestDemoBank) return '示例中';
      if (this.hasOfficialPracticeBank && this.todayProgressPercent >= 100) return '已完成';
      if (this.hasOfficialPracticeBank) return '训练中';
      return '备考版';
    },

    remainingToday() {
      return Math.max(0, this.dailyGoal - this.todayCount);
    },

    masteryStateText() {
      if (this.isNewUser) return '今日';
      if (this.todayProgressPercent >= 100) return '已完成';
      if (this.todayProgressPercent >= 60) return '进行中';
      return '热身';
    },

    todayMomentumText() {
      if (!this.hasPracticeBank) return '先用示例题熟悉答题流程';
      if (this.isGuestDemoBank) return `示例题 ${this.bankQuestionCount} 题，仅用于熟悉答题流程`;
      if (this.hasUnverifiedPracticeBank) return `本地题库 ${this.bankQuestionCount} 题，暂不可练`;
      if (this.isNewUser) return `可训练题库 ${this.bankQuestionCount} 题，从第一轮训练开始`;
      if (this.todayProgressPercent >= 100) return '今天目标已达成，可以进入错题巩固';
      return `再完成 ${this.remainingToday} 题，形成今天的记忆闭环`;
    },

    focusPanelTitle() {
      if (!this.hasPracticeBank) {
        if (this.activeDashboardTab === 'bank') return '查看题库状态';
        return '先体验示例题，确认答题节奏';
      }
      if (this.activeDashboardTab === 'bank') return '查看可练题库';
      if (this.activeDashboardTab === 'review') return '先处理错题与间隔复习队列';
      if (this.isGuestDemoBank) return '继续示例题，熟悉答题节奏';
      if (this.hasUnverifiedPracticeBank) return '查看题库';
      if (this.isNewUser) return '从可训练题库开始第一轮训练';
      return '继续推进今日训练窗口';
    },

    primaryActionText() {
      if (!this.hasPracticeBank) return '体验示例题';
      if (this.isGuestDemoBank) return '继续示例题';
      if (this.hasUnverifiedPracticeBank) return '查看题库';
      if (this.isNewUser) return '开始训练';
      return '继续刷题';
    },

    todayFocusCards() {
      return [
        { label: '剩余题量', value: this.remainingToday },
        { label: '连续天数', value: `${this.streakDays}天` },
        { label: '正确率', value: `${this.accuracy}%` }
      ];
    },

    knowledgeSummary() {
      return (
        this.learningTrajectoryStore?.masterySummary || {
          attempted: 0,
          strong: 0,
          weak: 0,
          mastery: 0
        }
      );
    },

    knowledgeMapCaption() {
      if (!this.knowledgeSummary.attempted) return '完成第一组题后，薄弱知识点会自动变色。';
      return `已定位 ${this.knowledgeSummary.attempted} 个知识节点`;
    },

    knowledgePreviewNodes() {
      const source = this.learningTrajectoryStore?.knowledgeNodesWithState || [];
      const preferred = source.filter((item) => ['track', 'module', 'topic'].includes(item.type)).slice(0, 9);
      return preferred.map((item, index) => {
        const layout = KNOWLEDGE_NODE_LAYOUT[index % KNOWLEDGE_NODE_LAYOUT.length];
        const state = item.visual?.state || 'unknown';
        const color = item.visual?.color || '#DDE8DD';
        return {
          id: item.id,
          state,
          hot: state === 'strong' || state === 'weak',
          style: {
            left: `${layout.x}%`,
            top: `${layout.y}%`,
            width: `${layout.size}rpx`,
            height: `${layout.size}rpx`,
            background: color
          }
        };
      });
    },

    knowledgeLines() {
      return KNOWLEDGE_LINE_LAYOUT.map((item) => ({
        id: item.id,
        style: {
          left: item.left,
          top: item.top,
          width: item.width,
          transform: `rotate(${item.rotate})`
        }
      }));
    },

    nextActionStatusText() {
      if (this.hasOfficialPracticeBank) return '按今天状态推荐';
      return '先熟悉，再训练';
    },

    nextActionCards() {
      if (!this.hasOfficialPracticeBank) {
        return [
          { id: 'demo', title: '体验示例题', desc: '先熟悉做题和复习入口', action: 'practice', tone: 'green' },
          { id: 'map', title: '查看知识图谱', desc: '了解科目、章节和知识点层级', action: 'map', tone: 'blue' },
          { id: 'path', title: '调整备考路径', desc: '选择英语、数学和每日目标', action: 'path', tone: 'amber' }
        ];
      }
      return [
        { id: 'practice', title: '继续训练', desc: `今天还剩 ${this.remainingToday} 题`, action: 'practice', tone: 'green' },
        { id: 'review', title: '错题复习', desc: '优先处理最近薄弱点', action: 'review', tone: 'amber' },
        { id: 'map', title: '知识图谱', desc: '定位章节与原子知识点', action: 'map', tone: 'blue' }
      ];
    }
  },

  onLoad() {
    this.initLayout();
    this.loadData();
  },

  onShow() {
    // 每次切回首页刷新统计
    if (this._loaded) {
      this.loadData();
    }
  },

  // 微信分享
  onShareAppMessage() {
    return {
      title: 'EXAM-MASTER — 智能助力，一战成硕',
      path: '/pages/index/index'
    };
  },

  methods: {
    initLayout() {
      try {
        const info = uni.getWindowInfo();
        const statusBarHeight = Number(info.statusBarHeight || 0);
        this.statusBarHeight = statusBarHeight > 0 ? statusBarHeight : 16;
        const safeBottom = info.safeAreaInsets?.bottom || 0;
        this.tabBarHeight = 60 + 12 + safeBottom;
      } catch (_e) {
        logger.warn('[Index] layout init failed, using defaults');
      }
    },

    loadData() {
      try {
        // 恢复 store 数据
        const studyStore = useStudyStore();
        const userStore = useUserStore();
        studyStore.restoreProgress();
        userStore.restoreUserInfo();
        this.learningTrajectoryStore?.restoreTrajectory?.();
        const examProfile = storageService.get('exam_profile', null);
        if (examProfile) this.learningTrajectoryStore?.setExamProfile?.(examProfile);

        const progress = studyStore.studyProgress;
        this.totalQuestions = progress.completedQuestions || 0;
        this.accuracy = studyStore.accuracy || 0;
        this.streakDays = progress.studyDays || 0;
        this.dailyGoal = storageService.get('daily_goal', 25);
        const bank = storageService.get('v30_bank', []);
        this.bankQuestionCount = Array.isArray(bank) ? bank.length : 0;
        this.bankSource = storageService.get('v30_bank_source', null);

        // 今日做题数：从 questionHistory 中统计今天的记录
        const today = new Date().toDateString();
        const history = studyStore.questionHistory || [];
        this.todayCount = history.filter((h) => {
          try {
            return new Date(h.timestamp || h.date).toDateString() === today;
          } catch {
            return false;
          }
        }).length;

        // 最近学习活动（最多3条）
        this.loadRecentActivities(history);
      } catch (e) {
        logger.error('[Index] loadData failed:', e);
      } finally {
        this._loaded = true;
      }
    },

    loadRecentActivities(history) {
      if (!history || history.length === 0) {
        this.recentActivities = [];
        return;
      }

      // 按题库分组，取最近3个题库的统计
      const bankMap = {};
      for (const h of history) {
        const bank = h.bankName || h.category || '未分类';
        if (!bankMap[bank]) {
          bankMap[bank] = { total: 0, correct: 0, lastTime: 0 };
        }
        bankMap[bank].total++;
        if (h.isCorrect || h.correct) bankMap[bank].correct++;
        const t = new Date(h.timestamp || h.date || 0).getTime();
        if (t > bankMap[bank].lastTime) bankMap[bank].lastTime = t;
      }

      this.recentActivities = Object.entries(bankMap)
        .sort((a, b) => b[1].lastTime - a[1].lastTime)
        .slice(0, 3)
        .map(([name, data]) => ({
          name,
          time: this.formatRelativeTime(data.lastTime),
          progress: data.total > 0 ? Math.round((data.correct / data.total) * 100) + '%' : '0%'
        }));
    },

    formatRelativeTime(ts) {
      if (!ts) return '';
      const diff = Date.now() - ts;
      const min = Math.floor(diff / 60000);
      if (min < 1) return '刚刚';
      if (min < 60) return min + '分钟前';
      const hr = Math.floor(min / 60);
      if (hr < 24) return hr + '小时前';
      const day = Math.floor(hr / 24);
      if (day < 7) return day + '天前';
      return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    },

    async onRefresh() {
      this.isRefreshing = true;
      try {
        this.loadData();
      } finally {
        setTimeout(() => {
          this.isRefreshing = false;
        }, 500);
      }
    },

    goToPractice() {
      if (!this.hasPracticeBank) {
        startGuestDemoPractice({ destination: 'quiz' });
        return;
      }
      if (this.isGuestDemoBank) {
        safeNavigateTo('/pages/practice-sub/do-quiz');
        return;
      }
      if (!this.hasOfficialPracticeBank) {
        safeNavigateTo('/pages/practice-sub/question-bank');
        return;
      }
      uni.switchTab({ url: '/pages/practice/index' });
    },

    goOnboarding() {
      uni.navigateTo({ url: '/pages/login/onboarding?source=home' });
    },

    openKnowledgeMap() {
      storageService.save('practice_preferred_mode', 'knowledge_graph');
      uni.switchTab({ url: '/pages/practice/index' });
    },

    handleNextAction(action) {
      if (action === 'map') {
        this.openKnowledgeMap();
        return;
      }
      if (action === 'path') {
        this.goOnboarding();
        return;
      }
      if (action === 'review') {
        safeNavigateTo('/pages/mistake/index?mode=review');
        return;
      }
      this.goToPractice();
    },

    selectDashboardTab(tabId) {
      this.activeDashboardTab = tabId;
    }
  }
};
</script>

<style lang="scss" scoped>
/* ==================== 设计规范变量 ==================== */
$primary: #9fe870;
$primary-light: #eafbe2;
$primary-dark: #122512;
$action-green: #18a957;
$bg: #f5f7f1;
$card-bg: #ffffff;
$text-main: #1a1d26;
$text-sub: #5f6672;
$text-weak: #9ca3af;

$radius-lg: 24rpx;
$radius-md: 16rpx;
$radius-sm: 12rpx;
$spacing-page: 32rpx;
$spacing-card: 32rpx;
$spacing-section: 24rpx;

/* ==================== 页面 ==================== */
.page {
  @include em-mobile-canvas;
}

/* ==================== 导航栏 ==================== */
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  @include em-mobile-topbar;
}

.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 $spacing-page;
}

.nav-title {
  font-size: 30rpx;
  font-weight: 900;
  color: $primary-dark;
  letter-spacing: 1.6rpx;
}

.nav-status {
  padding: 6rpx 14rpx;
  border: 1rpx solid rgba(22, 51, 0, 0.12);
  border-radius: 999rpx;
  background: rgba(159, 232, 112, 0.22);
  color: $primary-dark;
  font-size: 18rpx;
  font-weight: 800;
  letter-spacing: 1.2rpx;
}

/* ==================== 滚动区域 ==================== */
.main-scroll {
  height: 100vh;
  box-sizing: border-box;
}

/* ==================== 通用 ==================== */
.section {
  padding: 0 $spacing-page;
  margin-bottom: $spacing-section;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $text-main;
  margin-bottom: 16rpx;
  display: block;
}

.card {
  @include em-mobile-glass-surface($radius-lg, $spacing-card);
}

/* ==================== 品牌冲击首屏 ==================== */
.hero-section {
  padding-top: 28rpx;
}

.hero-panel {
  @include em-mobile-deep-panel(38rpx, 34rpx);
}

.hero-panel::before {
  content: '';
  position: absolute;
  right: -90rpx;
  top: -110rpx;
  width: 360rpx;
  height: 360rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(178, 255, 106, 0.26) 0%, rgba(178, 255, 106, 0) 68%);
}

.hero-panel::after {
  content: '';
  position: absolute;
  left: 42rpx;
  right: 42rpx;
  bottom: 38rpx;
  height: 1rpx;
  background: linear-gradient(90deg, transparent, rgba(159, 232, 112, 0.7), transparent);
}

.hero-topline,
.dashboard-tabs,
.today-focus-panel,
.focus-chip-row,
.knowledge-stage,
.hero-metric-strip,
.onboarding-entry,
.hero-action-row,
.hero-title,
.hero-subtitle {
  position: relative;
  z-index: 1;
}

.hero-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 34rpx;
}

.hero-kicker {
  color: rgba(255, 255, 255, 0.62);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 2.4rpx;
}

.hero-state {
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(159, 232, 112, 0.18);
  color: $primary;
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
}

.hero-title {
  display: block;
  max-width: 560rpx;
  color: #ffffff;
  font-size: 48rpx;
  font-weight: 900;
  line-height: 1.16;
}

.hero-subtitle {
  display: block;
  max-width: 560rpx;
  margin-top: 18rpx;
  color: rgba(255, 255, 255, 0.68);
  font-size: 26rpx;
  line-height: 1.55;
}

.dashboard-tabs {
  display: flex;
  margin-top: 26rpx;
  padding: 7rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.1);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.1);
}

.dashboard-tab {
  @include em-mobile-pressable;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-height: 58rpx;
  border-radius: 999rpx;
  color: rgba(255, 255, 255, 0.58);
  font-size: 23rpx;
  font-weight: 850;
}

.dashboard-tab.active {
  background: rgba(255, 255, 255, 0.9);
  color: $primary-dark;
  box-shadow: 0 12rpx 28rpx rgba(0, 0, 0, 0.12);
}

.today-focus-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
  padding: 24rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.11);
  box-shadow:
    inset 0 1rpx 0 rgba(255, 255, 255, 0.12),
    0 18rpx 44rpx rgba(0, 0, 0, 0.08);
}

.today-focus-copy {
  flex: 1;
  min-width: 0;
  padding-right: 22rpx;
}

.today-focus-kicker {
  display: block;
  color: rgba(255, 255, 255, 0.44);
  font-size: 17rpx;
  font-weight: 900;
  letter-spacing: 1.9rpx;
}

.today-focus-title {
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.94);
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1.18;
}

.today-focus-desc {
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.62);
  font-size: 22rpx;
  line-height: 1.45;
}

.mastery-orb {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 136rpx;
  height: 136rpx;
  border-radius: 999rpx;
  background:
    radial-gradient(
      circle at 34% 26%,
      rgba(255, 255, 255, 0.88) 0,
      rgba(255, 255, 255, 0.18) 34%,
      rgba(178, 255, 106, 0.18) 100%
    ),
    rgba(255, 255, 255, 0.08);
  box-shadow:
    0 16rpx 34rpx rgba(0, 0, 0, 0.16),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.32);
}

.mastery-orb-value {
  @include em-mobile-number;
  color: #f8fff2;
  font-size: 34rpx;
  font-weight: 950;
  line-height: 1;
}

.mastery-orb-label {
  margin-top: 6rpx;
  color: rgba(255, 255, 255, 0.54);
  font-size: 18rpx;
  font-weight: 800;
}

.focus-chip-row {
  display: flex;
  margin-top: 14rpx;
}

.focus-chip {
  flex: 1;
  padding: 14rpx 12rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.08);
}

.focus-chip + .focus-chip {
  margin-left: 12rpx;
}

.focus-chip-value {
  @include em-mobile-number;
  display: block;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 900;
}

.focus-chip-label {
  display: block;
  margin-top: 5rpx;
  color: rgba(255, 255, 255, 0.52);
  font-size: 19rpx;
  font-weight: 650;
}

.knowledge-stage {
  margin-top: 28rpx;
  padding: 24rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.075);
  box-shadow:
    inset 0 1rpx 0 rgba(255, 255, 255, 0.12),
    0 18rpx 44rpx rgba(0, 0, 0, 0.08);
}

.knowledge-stage-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.knowledge-kicker {
  display: block;
  color: rgba(255, 255, 255, 0.42);
  font-size: 17rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
}

.knowledge-title {
  display: block;
  margin-top: 6rpx;
  color: rgba(255, 255, 255, 0.9);
  font-size: 27rpx;
  font-weight: 850;
}

.knowledge-score {
  min-width: 104rpx;
  padding: 10rpx 14rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.1);
  text-align: center;
}

.knowledge-score-value {
  display: block;
  color: $primary;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1;
}

.knowledge-score-label {
  display: block;
  margin-top: 4rpx;
  color: rgba(255, 255, 255, 0.55);
  font-size: 18rpx;
}

.knowledge-map {
  position: relative;
  height: 230rpx;
  margin-top: 14rpx;
  overflow: hidden;
}

.knowledge-line {
  position: absolute;
  height: 2rpx;
  border-radius: 999rpx;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transform-origin: left center;
}

.knowledge-node {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  box-shadow:
    0 10rpx 26rpx rgba(0, 0, 0, 0.18),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.44);
  transform: translate3d(-50%, -50%, 0);
}

.knowledge-node.hot {
  box-shadow:
    0 14rpx 34rpx rgba(159, 232, 112, 0.18),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.52);
}

.knowledge-node.state-unknown {
  opacity: 0.72;
}

.knowledge-node.state-weak {
  box-shadow:
    0 14rpx 34rpx rgba(255, 90, 95, 0.28),
    inset 0 1rpx 0 rgba(255, 255, 255, 0.38);
}

.knowledge-foot {
  display: flex;
  justify-content: space-between;
  padding-top: 8rpx;
  color: rgba(255, 255, 255, 0.55);
  font-size: 20rpx;
  line-height: 1.4;
}

.hero-metric-strip {
  display: flex;
  margin-top: 20rpx;
}

.hero-metric {
  flex: 1;
  padding: 16rpx 12rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.075);
}

.hero-metric + .hero-metric {
  margin-left: 12rpx;
}

.metric-label {
  display: block;
  color: rgba(255, 255, 255, 0.58);
  font-size: 22rpx;
}

.metric-value {
  @include em-mobile-number;
  display: block;
  margin-top: 6rpx;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 900;
}

.onboarding-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.08);
}

.onboarding-entry-copy {
  display: flex;
  flex-direction: column;
}

.onboarding-entry-title {
  color: rgba(255, 255, 255, 0.9);
  font-size: 24rpx;
  font-weight: 800;
}

.onboarding-entry-desc {
  margin-top: 5rpx;
  color: rgba(255, 255, 255, 0.5);
  font-size: 20rpx;
}

.onboarding-entry-mark {
  padding: 9rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(159, 232, 112, 0.16);
}

.onboarding-entry-mark text {
  color: $primary;
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
}

.hero-action-row {
  display: flex;
  align-items: center;
  margin-top: 34rpx;
}

.hero-primary {
  @include em-mobile-primary-action;
  @include em-mobile-pressable;
  padding: 22rpx 30rpx;
}

.hero-primary-text {
  color: $primary-dark;
  font-size: 28rpx;
  font-weight: 900;
}

.hero-note {
  flex: 1;
  margin-left: 22rpx;
  color: rgba(255, 255, 255, 0.62);
  font-size: 22rpx;
  line-height: 1.45;
}

/* ==================== 今日进度卡片 ==================== */
.progress-card {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.86) 0%, rgba(234, 251, 226, 0.78) 100%),
    rgba(255, 255, 255, 0.72);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: $text-main;
}

.streak-badge {
  font-size: 24rpx;
  color: $primary-dark;
  background: rgba($primary, 0.12);
  padding: 6rpx 16rpx;
  border-radius: 99rpx;
  font-weight: 500;
}

.progress-bar-wrap {
  display: flex;
  align-items: center;
}

.progress-bar {
  flex: 1;
  height: 16rpx;
  background: rgba($primary, 0.12);
  border-radius: 99rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: $action-green;
  border-radius: 99rpx;
  transition: width 0.3s ease;
  min-width: 0;
}

.progress-text {
  margin-left: 20rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: $text-main;
  white-space: nowrap;
}

/* ==================== 统计网格 ==================== */
.stats-row {
  display: flex;
}

.stat-card {
  @include em-mobile-glass-surface($radius-lg, $spacing-card);
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-card + .stat-card {
  margin-left: 20rpx;
}

.stat-value {
  @include em-mobile-number;
  font-size: 48rpx;
  font-weight: 700;
  color: $text-main;
  line-height: 1.2;
}

.stat-kicker {
  margin-bottom: 8rpx;
  color: rgba(22, 51, 0, 0.42);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 1.4rpx;
}

.next-actions-panel {
  @include em-mobile-glass-surface(32rpx, 30rpx);
}

.next-actions-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.next-actions-title {
  display: block;
  color: $primary-dark;
  font-size: 31rpx;
  font-weight: 900;
  line-height: 1.18;
}

.next-actions-status {
  flex-shrink: 0;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(159, 232, 112, 0.22);
  color: $primary-dark;
  font-size: 20rpx;
  font-weight: 900;
}

.next-actions-list {
  margin-top: 22rpx;
}

.next-action-card {
  @include em-mobile-pressable;
  display: flex;
  align-items: center;
  min-height: 88rpx;
  padding: 18rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.76);
  border: 1rpx solid rgba(22, 51, 0, 0.06);
}

.next-action-card + .next-action-card {
  margin-top: 14rpx;
}

.next-action-dot {
  flex-shrink: 0;
  width: 24rpx;
  height: 24rpx;
  margin-right: 18rpx;
  border-radius: 999rpx;
  background: $action-green;
  box-shadow: 0 0 0 8rpx rgba(24, 169, 87, 0.1);
}

.next-action-dot.tone-green {
  background: $action-green;
  box-shadow: 0 0 0 8rpx rgba(24, 169, 87, 0.11);
}

.next-action-dot.tone-blue {
  background: #42bde8;
  box-shadow: 0 0 0 8rpx rgba(66, 189, 232, 0.13);
}

.next-action-dot.tone-amber {
  background: #ffd166;
  box-shadow: 0 0 0 8rpx rgba(255, 209, 102, 0.14);
}

.next-action-copy {
  flex: 1;
  min-width: 0;
}

.next-action-title {
  display: block;
  color: $text-main;
  font-size: 27rpx;
  font-weight: 850;
}

.next-action-desc {
  display: block;
  margin-top: 4rpx;
  color: rgba(22, 51, 0, 0.56);
  font-size: 22rpx;
  line-height: 1.35;
}

.stat-label {
  font-size: 24rpx;
  color: $text-sub;
  margin-top: 8rpx;
}

/* ==================== 最近学习 ==================== */
.activity-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20rpx 0;
}

.activity-border {
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);
}

.activity-left {
  display: flex;
  flex-direction: column;
}

.activity-name {
  font-size: 28rpx;
  font-weight: 500;
  color: $text-main;
}

.activity-time {
  font-size: 22rpx;
  color: $text-weak;
  margin-top: 4rpx;
}

.activity-progress {
  font-size: 30rpx;
  font-weight: 600;
  color: $action-green;
}

.btn-hover {
  opacity: 0.85;
  transform: scale(0.98);
}
</style>
