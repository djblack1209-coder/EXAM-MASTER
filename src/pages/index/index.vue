<template>
  <view class="page" :class="{ 'dark-mode': isDark }">
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
      <view v-if="isPageLoading || pageError" class="section shell-state-section">
        <view class="shell-state-card" :class="{ error: pageError }">
          <view class="shell-state-copy">
            <text class="shell-state-title">{{ pageError ? '学习数据暂未同步' : '正在同步学习轨迹' }}</text>
            <text class="shell-state-desc">
              {{ pageError ? '已保留本地默认视图，可以重试或直接继续刷题。' : '正在读取今日进度、题库资产和最近训练记录。' }}
            </text>
          </view>
          <view v-if="pageError" class="shell-state-action" hover-class="btn-hover" @tap="retryLoadData">
            <text>重试</text>
          </view>
          <view v-else class="shell-state-meter">
            <view class="shell-state-meter-fill" />
          </view>
        </view>
      </view>

      <!-- 品牌冲击首屏 -->
      <view class="section hero-section">
        <view class="hero-panel">
          <view class="hero-topline">
            <text class="hero-kicker">公共课训练台</text>
            <text class="hero-state">{{ masteryStateText }}</text>
          </view>
          <text class="hero-title">{{ greeting }}，进入今天的备考主线</text>
          <text class="hero-subtitle">把真题、错题和复习节奏压缩成一条可执行路径。</text>

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

          <view class="paper-stage">
            <view class="paper-stage-head">
              <view>
                <text class="paper-kicker">真题资产</text>
                <text class="paper-title">近年真题整卷进度</text>
              </view>
              <view class="paper-score">
                <text class="paper-score-value">{{ totalQuestions }}</text>
                <text class="paper-score-label">已练题</text>
              </view>
            </view>

            <view class="paper-lane">
              <view v-for="paper in paperProgressCards" :key="paper.label" class="paper-pill" :class="paper.state">
                <text class="paper-pill-label">{{ paper.label }}</text>
                <text class="paper-pill-value">{{ paper.value }}</text>
              </view>
            </view>

            <view class="paper-foot">
              <text>{{ paperStageCaption }}</text>
              <text>{{ loadedPaperCount }} 套已加载</text>
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
              <text>设置</text>
            </view>
          </view>

          <view class="hero-action-row">
            <view class="hero-primary" hover-class="btn-hover" @tap="goToPractice">
              <text class="hero-primary-text">{{ isNewUser ? '开始第一次刷题' : '继续刷题' }}</text>
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
          <text class="stat-kicker">正确率</text>
          <text class="stat-value">{{ accuracy }}%</text>
          <text class="stat-label">正确率</text>
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
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { getPracticeNavigationTree } from '@/config/bank-registry.js';

export default {
  components: { CustomTabbar, PrivacyPopup },

  data() {
    return {
      // 布局
      statusBarHeight: 44,
      tabBarHeight: 90,
      isRefreshing: false,
      isPageLoading: true,
      pageError: '',

      // 数据
      dailyGoal: 25,
      todayCount: 0,
      streakDays: 0,
      totalQuestions: 0,
      loadedPaperCount: 0,
      accuracy: 0,
      recentActivities: [],
      isDark: false,
      activeDashboardTab: 'today',
      dashboardTabs: [
        { id: 'today', label: '今日' },
        { id: 'bank', label: '题库' },
        { id: 'review', label: '复习' }
      ],
      paperProgressCards: []
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

    navStatusText() {
      if (this.todayProgressPercent >= 100) return '今日完成';
      if (this.totalQuestions > 0) return '训练可用';
      return '待导入题库';
    },

    remainingToday() {
      return Math.max(0, this.dailyGoal - this.todayCount);
    },

    masteryStateText() {
      if (this.isNewUser) return '准备开始';
      if (this.todayProgressPercent >= 100) return '已完成';
      if (this.todayProgressPercent >= 60) return '推进中';
      return '待启动';
    },

    todayMomentumText() {
      if (this.isNewUser) return '先导入正式题库，完成第一轮训练';
      if (this.todayProgressPercent >= 100) return '今天目标已达成，可以进入错题巩固';
      return `再完成 ${this.remainingToday} 题，形成今天的记忆闭环`;
    },

    focusPanelTitle() {
      if (this.activeDashboardTab === 'bank') return '先确认可训练真题年份';
      if (this.activeDashboardTab === 'review') return '先处理错题与间隔复习队列';
      if (this.isNewUser) return '从第一组公共课真题开始';
      return '继续推进今日训练窗口';
    },

    todayFocusCards() {
      return [
        { label: '剩余题量', value: this.remainingToday },
        { label: '连续天数', value: `${this.streakDays}d` },
        { label: '正确率', value: `${this.accuracy}%` }
      ];
    },

    paperStageCaption() {
      if (this.loadedPaperCount > 0) return '继续按年份完成整卷训练。';
      return '先选择一套可练真题，建立第一条训练记录。';
    }
  },

  onLoad() {
    this.syncTheme();
    this.initLayout();
    this.loadData();
    uni.$on('themeUpdate', this.syncTheme);
  },

  onShow() {
    this.syncTheme();
    // 每次切回首页刷新统计
    if (this._loaded) {
      this.loadData();
    }
  },

  onUnload() {
    uni.$off('themeUpdate', this.syncTheme);
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

    syncTheme(mode) {
      const resolved = mode || storageService.get('theme_mode', 'light');
      this.isDark = resolved === 'dark';
    },

    loadData() {
      this.isPageLoading = true;
      this.pageError = '';
      try {
        // 恢复 store 数据
        const studyStore = useStudyStore();
        const userStore = useUserStore();
        studyStore.restoreProgress();
        userStore.restoreUserInfo();
        const progress = studyStore.studyProgress;
        this.totalQuestions = progress.completedQuestions || 0;
        this.accuracy = studyStore.accuracy || 0;
        this.streakDays = progress.studyDays || 0;
        this.dailyGoal = storageService.get('daily_goal', 25);
        const loadedPapers = storageService.get('loaded_flashcard_banks', []) || [];
        this.loadedPaperCount = loadedPapers.length;
        this.paperProgressCards = this.buildPaperProgressCards(loadedPapers);

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
        this.pageError = 'load_failed';
      } finally {
        this.isPageLoading = false;
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

    buildPaperProgressCards(loadedPapers = []) {
      const tracks = [
        { id: 'english1', label: '英语一', keys: ['english1', 'english-'] },
        { id: 'english2', label: '英语二', keys: ['english2'] },
        { id: 'politics', label: '政治', keys: ['politics'] },
        { id: 'math1', label: '数学一', keys: ['math1', 'math-'] },
        { id: 'math2', label: '数学二', keys: ['math2'] },
        { id: 'math3', label: '数学三', keys: ['math3'] }
      ];
      const loadedText = loadedPapers.join(' ').toLowerCase();
      const profile = storageService.get('exam_profile', null) || {};
      const readyTrackIds = new Set(
        getPracticeNavigationTree(profile)
          .flatMap((subject) => subject.tracks || [])
          .filter((track) => track.banks?.length > 0)
          .map((track) => track.id)
      );
      return tracks.map((track) => {
        const isLoaded = track.keys.some((key) => loadedText.includes(key));
        const state = isLoaded ? 'ready' : readyTrackIds.has(track.id) ? 'available' : 'pending';
        return {
          label: track.label,
          value: state === 'ready' ? '已加载' : state === 'available' ? '可练' : '即将开放',
          state
        };
      });
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

    retryLoadData() {
      this.loadData();
    },

    goToPractice() {
      safeNavigateTo('/pages/practice/index');
    },

    goOnboarding() {
      safeNavigateTo('/pages/login/onboarding?source=home');
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

.shell-state-section {
  padding-top: 22rpx;
  margin-bottom: 18rpx;
}

.shell-state-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 24rpx;
  border: 1rpx solid rgba(22, 51, 0, 0.08);
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 14rpx 36rpx rgba(24, 169, 87, 0.08);
}

.shell-state-card.error {
  border-color: rgba(239, 68, 68, 0.14);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 14rpx 36rpx rgba(239, 68, 68, 0.08);
}

.shell-state-copy {
  flex: 1;
  min-width: 0;
  padding-right: 18rpx;
}

.shell-state-title {
  display: block;
  color: $text-main;
  font-size: 25rpx;
  font-weight: 850;
  line-height: 1.25;
}

.shell-state-desc {
  display: block;
  margin-top: 6rpx;
  color: $text-sub;
  font-size: 21rpx;
  line-height: 1.42;
}

.shell-state-action {
  @include em-mobile-pressable;
  flex-shrink: 0;
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(22, 51, 0, 0.08);
}

.shell-state-action text {
  color: $primary-dark;
  font-size: 21rpx;
  font-weight: 850;
}

.shell-state-meter {
  position: relative;
  flex-shrink: 0;
  width: 96rpx;
  height: 10rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: rgba(22, 51, 0, 0.08);
}

.shell-state-meter-fill {
  width: 42rpx;
  height: 100%;
  border-radius: inherit;
  background: $action-green;
  animation: shellStateMeter 1.1s ease-in-out infinite;
}

@keyframes shellStateMeter {
  0% {
    transform: translateX(-48rpx);
  }
  50% {
    transform: translateX(38rpx);
  }
  100% {
    transform: translateX(104rpx);
  }
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
.paper-stage,
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

.paper-stage {
  margin-top: 28rpx;
  padding: 24rpx;
  border-radius: 30rpx;
  background: rgba(255, 255, 255, 0.075);
  box-shadow:
    inset 0 1rpx 0 rgba(255, 255, 255, 0.12),
    0 18rpx 44rpx rgba(0, 0, 0, 0.08);
}

.paper-stage-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.paper-kicker {
  display: block;
  color: rgba(255, 255, 255, 0.42);
  font-size: 17rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
}

.paper-title {
  display: block;
  margin-top: 6rpx;
  color: rgba(255, 255, 255, 0.9);
  font-size: 27rpx;
  font-weight: 850;
}

.paper-score {
  min-width: 104rpx;
  padding: 10rpx 14rpx;
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.1);
  text-align: center;
}

.paper-score-value {
  display: block;
  color: $primary;
  font-size: 30rpx;
  font-weight: 900;
  line-height: 1;
}

.paper-score-label {
  display: block;
  margin-top: 4rpx;
  color: rgba(255, 255, 255, 0.55);
  font-size: 18rpx;
}

.paper-lane {
  display: flex;
  flex-wrap: wrap;
  margin-top: 18rpx;
  gap: 12rpx;
}

.paper-pill {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 138rpx;
  min-height: 76rpx;
  padding: 12rpx 16rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.1);
}

.paper-pill.ready {
  background: rgba(159, 232, 112, 0.16);
}

.paper-pill.available {
  background: rgba(117, 221, 255, 0.14);
}

.paper-pill-label {
  color: rgba(255, 255, 255, 0.9);
  font-size: 22rpx;
  font-weight: 850;
}

.paper-pill-value {
  margin-top: 5rpx;
  color: rgba(255, 255, 255, 0.54);
  font-size: 18rpx;
  font-weight: 700;
}

.paper-foot {
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
    linear-gradient(135deg, rgba(255, 255, 255, 0.86) 0%, rgba(234, 251, 226, 0.78) 100%), rgba(255, 255, 255, 0.72);
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

/* ==================== Dark Theme Guardrail ==================== */
.page.dark-mode {
  color: #f5f7fb;
  background:
    radial-gradient(circle at 16% 8%, rgba(0, 224, 255, 0.1) 0, rgba(0, 224, 255, 0) 32%),
    radial-gradient(circle at 82% 16%, rgba(155, 81, 224, 0.12) 0, rgba(155, 81, 224, 0) 34%),
    linear-gradient(180deg, #11141c 0%, #1a1c23 58%, #12151d 100%);
}

.dark-mode .nav-bar {
  background: rgba(17, 20, 28, 0.82);
  box-shadow: 0 1rpx 0 rgba(255, 255, 255, 0.08);
}

.dark-mode .nav-title,
.dark-mode .section-title,
.dark-mode .card-title,
.dark-mode .stat-value,
.dark-mode .activity-name,
.dark-mode .progress-text {
  color: #f5f7fb;
}

.dark-mode .nav-status {
  border-color: rgba(0, 224, 255, 0.18);
  background: rgba(0, 224, 255, 0.12);
  color: #75ddff;
}

.dark-mode .card,
.dark-mode .stat-card,
.dark-mode .shell-state-card {
  background: rgba(34, 37, 45, 0.82);
  border: 1rpx solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 18rpx 48rpx rgba(0, 0, 0, 0.32);
}

.dark-mode .shell-state-card.error {
  border-color: rgba(255, 120, 120, 0.18);
  background: rgba(42, 35, 39, 0.82);
}

.dark-mode .shell-state-title {
  color: #f5f7fb;
}

.dark-mode .shell-state-desc {
  color: rgba(245, 247, 251, 0.58);
}

.dark-mode .shell-state-action {
  background: rgba(159, 232, 112, 0.14);
}

.dark-mode .shell-state-action text {
  color: #9fe870;
}

.dark-mode .shell-state-meter {
  background: rgba(255, 255, 255, 0.1);
}

.dark-mode .progress-card {
  background: rgba(34, 37, 45, 0.82);
}

.dark-mode .progress-bar {
  background: rgba(255, 255, 255, 0.1);
}

.dark-mode .stat-kicker,
.dark-mode .stat-label,
.dark-mode .activity-time {
  color: rgba(245, 247, 251, 0.58);
}
</style>
