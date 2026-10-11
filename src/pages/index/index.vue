<template>
  <LearningLanding v-if="!showLegacyDashboard" @legacy="openLegacyDashboard">
    <PrivacyPopup />
  </LearningLanding>
  <view
    v-else
    class="yozi-page page has-tabbar"
    :style="tabBarStyle"
    :class="{ 'dark-mode': isDark, 'theme-light': !isDark }"
  >
    <!-- 微信隐私保护弹窗 -->
    <PrivacyPopup />

    <!-- 自定义导航栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <text class="nav-title">{{ uiText(BRAND.name) }}</text>
      </view>
    </view>

    <!-- 主内容 -->
    <scroll-view
      scroll-y
      class="main-scroll"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <BaseEmpty
        v-if="isPageLoading || pageError"
        :state="pageError ? 'error' : 'loading'"
        :title="pageError ? t('dashboard.copy0') : t('dashboard.copy1')"
        :show-button="Boolean(pageError)"
        @action="retryLoadData"
      />

      <BaseButton class="dashboard-return" variant="secondary" @tap="showLegacyDashboard = false">{{
        t('dashboard.copy2')
      }}</BaseButton>
      <LearningOverview />
      <!-- 品牌冲击首屏 -->
      <view class="section hero-section">
        <view class="hero-panel">
          <text class="hero-title">{{ t('dashboard.copy3') }}</text>

          <BaseSegmented
            :model-value="activeDashboardTab"
            :options="dashboardTabs.map((tab) => ({ value: tab.id, label: uiText(tab.label) }))"
            :label="t('dashboard.copy3')"
            @update:model-value="selectDashboardTab"
          />

          <view v-if="!hasSharedLearning" class="today-focus-panel">
            <view class="today-focus-copy">
              <text class="today-focus-title">{{ uiText(focusPanelTitle) }}</text>
            </view>
            <BaseStat :label="t('dashboard.copy4')" :value="displayTodayCount" :denominator="displayDailyGoal" />
          </view>

          <view class="paper-stage">
            <view class="paper-stage-head">
              <view>
                <text class="paper-title">{{ t('dashboard.copy5') }}</text>
              </view>
              <view v-if="!hasSharedLearning" class="paper-score">
                <text class="paper-score-value">{{ displayTotalQuestions }}</text>
                <text class="paper-score-label">{{ t('dashboard.copy6') }}</text>
              </view>
            </view>

            <view class="paper-lane">
              <view v-for="paper in paperProgressCards" :key="paper.label" class="paper-pill" :class="paper.state">
                <text class="paper-pill-label">{{ uiText(paper.label) }}</text>
                <text class="paper-pill-value">{{ paper.value }}</text>
              </view>
            </view>

            <view class="paper-foot">
              <text>{{ t('dashboard.copy7', { v0: loadedPaperCount }) }}</text>
            </view>
          </view>

          <BaseButton class="onboarding-entry" variant="secondary" @tap="goOnboarding">{{
            t('dashboard.copy8')
          }}</BaseButton>

          <view class="hero-action-row">
            <BaseButton class="hero-primary" variant="primary" @tap="goLearning"
              ><text class="hero-primary-text">{{ t('dashboard.copy10') }}</text></BaseButton
            >
          </view>
        </view>
      </view>

      <!-- 今日进度卡片 -->
      <view v-if="!hasSharedLearning" class="section">
        <view class="card progress-card">
          <view class="card-header">
            <text class="card-title">{{ t('dashboard.copy11') }}</text>
            <text class="streak-badge">{{ t('dashboard.copy12', { v0: streakDays }) }}</text>
          </view>
          <BaseStat :label="t('dashboard.copy11')" :value="displayTodayCount" :denominator="displayDailyGoal" />
        </view>
      </view>

      <!-- 统计网格 -->
      <view v-if="!hasSharedLearning" class="section stats-row"
        ><BaseStat :label="t('dashboard.copy13')" :value="displayTotalQuestions" /><BaseListRow
          :label="t('dashboard.copy14')"
          :value="String(displayAccuracy)"
          :actionable="false"
      /></view>

      <!-- 最近学习 -->
      <view v-if="recentActivities.length > 0" class="section">
        <text class="section-title">{{ t('dashboard.copy15') }}</text>
        <view class="card">
          <view
            v-for="(item, idx) in recentActivities"
            :key="idx"
            class="activity-item"
            :class="{ 'activity-border': idx < recentActivities.length - 1 }"
          >
            <view class="activity-left">
              <text class="activity-name">{{ item.name }}</text>
              <text class="activity-time">{{ uiText(item.time) }}</text>
            </view>
            <text class="activity-progress">{{ item.progress }}</text>
          </view>
        </view>
      </view>

      <!-- 底部占位 -->
      <view class="yozi-tabbar-space" aria-hidden="true" />
    </scroll-view>

    <!-- 底部导航栏 -->
    <CustomTabbar :active-index="0" />
  </view>
</template>

<script>
import { getTabbarSafeAreaStyle } from '@/utils/core/system.js';
import '@/i18n/messages/dashboard.js';
import { t, translateRegisteredText } from '@/i18n/index.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import BaseListRow from '@/components/base/base-list-row/base-list-row.vue';
import BaseStat from '@/components/base/base-stat/base-stat.vue';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseSegmented from '@/components/base/base-segmented/base-segmented.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import '@/styles/yozi-pages.scss';

import { BRAND } from '@/config/brand.js';
import LearningOverview from '@/components/business/learning/learning-overview.vue';
import LearningLanding from '@/components/business/learning/learning-landing.vue';

import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import { useStudyStore } from '@/stores/modules/study';
import { useUserStore } from '@/stores/modules/user';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { getPracticeNavigationTree } from '@/config/bank-registry.js';

export default {
  components: {
    BaseButton,
    BaseSegmented,
    BaseEmpty,
    BaseStat,
    BaseListRow,
    LearningOverview,
    LearningLanding,
    CustomTabbar,
    PrivacyPopup
  },

  data() {
    return {
      BRAND,
      showLegacyDashboard: false,
      // 布局
      statusBarHeight: 44,
      tabBarStyle: {},
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

      activeDashboardTab: 'today',
      dashboardTabs: [
        { id: 'today', label: t('dashboard.copy4') },
        { id: 'bank', label: t('dashboard.copy16') },
        { id: 'review', label: t('dashboard.copy17') }
      ],
      paperProgressCards: []
    };
  },

  computed: {
    isDark() {
      return useThemeStore().isDark;
    },
    sharedLearning() {
      return useConversationLearningStore();
    },
    hasSharedLearning() {
      const { conversations, attempts, plans } = this.sharedLearning.state;
      return Boolean(conversations.length || attempts.length || plans.length);
    },
    displayTodayCount() {
      return this.hasSharedLearning ? this.sharedLearning.summary.tasks.numerator : this.todayCount;
    },
    displayDailyGoal() {
      return this.hasSharedLearning ? this.sharedLearning.summary.tasks.denominator : this.dailyGoal;
    },
    displayTotalQuestions() {
      return this.hasSharedLearning ? this.sharedLearning.summary.totalReliableAnswers : this.totalQuestions;
    },
    displayAccuracy() {
      const s = this.sharedLearning.summary;
      const legacyAccuracy = Number(this.accuracy);
      return this.hasSharedLearning
        ? s.totalReliableAnswers
          ? `${((100 * s.reliableCorrectAnswers) / s.totalReliableAnswers).toFixed(1)}%`
          : '—'
        : this.totalQuestions > 0 &&
            this.accuracy !== null &&
            this.accuracy !== '' &&
            Number.isFinite(legacyAccuracy) &&
            legacyAccuracy >= 0 &&
            legacyAccuracy <= 100
          ? `${legacyAccuracy}%`
          : '—';
    },
    greeting() {
      const h = new Date().getHours();
      if (h < 6) return t('dashboard.copy18');
      if (h < 12) return t('dashboard.copy19');
      if (h < 14) return t('dashboard.copy20');
      if (h < 18) return t('dashboard.copy21');
      return t('dashboard.copy22');
    },

    todayProgressPercent() {
      if (this.displayDailyGoal <= 0) return 0;
      return Math.min(100, Math.round((this.displayTodayCount / this.displayDailyGoal) * 100));
    },

    isNewUser() {
      return this.totalQuestions === 0 && this.streakDays === 0;
    },

    navStatusText() {
      if (this.todayProgressPercent >= 100) return t('dashboard.copy23');
      if (this.totalQuestions > 0) return t('dashboard.copy24');
      return t('dashboard.copy25');
    },

    remainingToday() {
      return Math.max(0, this.displayDailyGoal - this.displayTodayCount);
    },

    masteryStateText() {
      if (this.isNewUser) return t('dashboard.copy26');
      if (this.todayProgressPercent >= 100) return t('dashboard.copy27');
      if (this.todayProgressPercent >= 60) return t('dashboard.copy28');
      return t('dashboard.copy29');
    },

    todayMomentumText() {
      if (this.isNewUser) return t('dashboard.copy30');
      if (this.todayProgressPercent >= 100) return t('dashboard.copy31');
      return t('dashboard.copy32', { v0: this.remainingToday });
    },

    focusPanelTitle() {
      if (this.activeDashboardTab === 'bank') return t('dashboard.copy33');
      if (this.activeDashboardTab === 'review') return t('dashboard.copy34');
      return t('dashboard.copy35');
    },

    todayFocusCards() {
      return [
        { label: t('dashboard.copy36'), value: this.remainingToday },
        { label: t('dashboard.copy37'), value: `${this.streakDays}d` },
        { label: this.hasSharedLearning ? t('dashboard.copy38') : t('dashboard.copy39'), value: this.displayAccuracy }
      ];
    },

    paperStageCaption() {
      if (this.loadedPaperCount > 0) return t('dashboard.copy40');
      return t('dashboard.copy41');
    }
  },

  onLoad() {
    this.syncTheme();
    this.initLayout();
    if (this.showLegacyDashboard) this.loadData();
    uni.$on('themeUpdate', this.syncTheme);
    uni.$on('updateTheme', this.syncTheme);
  },

  onShow() {
    uni.setNavigationBarTitle({ title: BRAND.title });
    this.syncTheme();
    this.sharedLearning.refresh();
    // 每次切回首页刷新统计
    if (this.showLegacyDashboard && this._loaded) {
      this.loadData();
    }
  },

  onUnload() {
    uni.$off('themeUpdate', this.syncTheme);
    uni.$off('updateTheme', this.syncTheme);
  },

  // 微信分享
  onShareAppMessage() {
    return {
      title: BRAND.title,
      path: '/pages/index/index'
    };
  },

  methods: {
    t,
    uiText(value) {
      return translateRegisteredText('dashboard', value);
    },
    openLegacyDashboard() {
      this.showLegacyDashboard = true;
      this.loadData();
    },
    goLearning() {
      safeNavigateTo('/pages/learning/index');
    },
    initLayout() {
      try {
        const info = uni.getWindowInfo();
        const statusBarHeight = Number(info.statusBarHeight || 0);
        this.statusBarHeight = statusBarHeight > 0 ? statusBarHeight : 16;
        this.tabBarStyle = getTabbarSafeAreaStyle();
      } catch (_e) {
        logger.warn('[Index] layout init failed, using defaults');
      }
    },

    syncTheme(mode) {
      const resolved = mode || storageService.get('theme_mode', 'light');
      void resolved;
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
        this.accuracy = studyStore.accuracy ?? null;
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
        { id: 'english1', label: t('dashboard.copy42'), keys: ['english1', 'english-'] },
        { id: 'english2', label: t('dashboard.copy43'), keys: ['english2'] },
        { id: 'politics', label: t('dashboard.copy44'), keys: ['politics'] },
        { id: 'math1', label: t('dashboard.copy45'), keys: ['math1', 'math-'] },
        { id: 'math2', label: t('dashboard.copy46'), keys: ['math2'] },
        { id: 'math3', label: t('dashboard.copy47'), keys: ['math3'] }
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
          value:
            state === 'ready'
              ? t('dashboard.copy48')
              : state === 'available'
                ? t('dashboard.copy49')
                : t('dashboard.copy50'),
          state
        };
      });
    },

    formatRelativeTime(ts) {
      if (!ts) return '';
      const diff = Date.now() - ts;
      const min = Math.floor(diff / 60000);
      if (min < 1) return t('dashboard.copy51');
      if (min < 60) return min + t('dashboard.copy52');
      const hr = Math.floor(min / 60);
      if (hr < 24) return hr + t('dashboard.copy53');
      const day = Math.floor(hr / 24);
      if (day < 7) return day + t('dashboard.copy54');
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
