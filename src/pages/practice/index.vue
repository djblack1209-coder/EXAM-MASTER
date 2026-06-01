<template>
  <view class="page" :class="{ 'dark-mode': isDark }">
    <!-- 自定义导航栏 -->
    <view class="nav-bar" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <text class="nav-title">刷题中心</text>
      </view>
    </view>

    <!-- 主内容 -->
    <scroll-view scroll-y class="main-scroll" :style="{ paddingTop: statusBarHeight + 44 + 'px' }">
      <!-- 可用题库列表 -->
      <view class="section practice-hero-section">
        <view class="practice-hero">
          <text class="practice-kicker">{{ practiceHeroKicker }}</text>
          <text class="practice-title">{{ practiceHeroTitle }}</text>
          <text class="practice-subtitle">{{ practiceHeroSubtitle }}</text>
          <view class="practice-signal-row">
            <view class="practice-signal">
              <text class="signal-value">{{ loadedBankCount }}</text>
              <text class="signal-label">已载入</text>
            </view>
            <view class="practice-signal">
              <text class="signal-value">{{ totalQuestions }}</text>
              <text class="signal-label">题目</text>
            </view>
            <view class="practice-signal">
              <text class="signal-value">{{ trackCount }}</text>
              <text class="signal-label">轨道</text>
            </view>
          </view>

          <view class="practice-command-row">
            <view
              class="practice-command primary"
              hover-class="btn-hover"
              @tap="hasBank ? goDoQuiz() : chooseImportSource()"
            >
              <text>{{ hasBank ? '继续训练' : '历年真题' }}</text>
            </view>
            <view class="practice-command secondary" hover-class="btn-hover" @tap="chooseImportSource">
              <text>真题库</text>
            </view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-head navigator-head">
          <view>
            <text class="section-title">题库</text>
            <text class="section-hint">科目、年份与训练方式</text>
          </view>
          <text class="section-meta">{{ bankAvailabilityText }}</text>
        </view>

        <view class="subject-tabs">
          <view
            v-for="subject in navigationTree"
            :key="subject.id"
            class="subject-tab"
            :class="{ active: selectedSubject?.id === subject.id }"
            @tap="selectSubject(subject.id)"
          >
            <text>{{ subject.label }}</text>
          </view>
        </view>

        <view class="track-rail">
          <view
            v-for="track in selectedSubject?.tracks || []"
            :key="track.id"
            class="track-pill"
            :class="{ active: selectedTrack?.id === track.id }"
            @tap="selectTrack(track.id)"
          >
            <text class="track-code">{{ track.code }}</text>
            <text class="track-label">{{ track.label }}</text>
            <text class="track-count">{{ track.banks.length }}</text>
          </view>
        </view>

        <view class="mode-row">
          <view
            v-for="mode in selectedModes"
            :key="mode.id"
            class="mode-chip"
            :class="{ active: selectedModeId === mode.id }"
            @tap="selectMode(mode.id)"
          >
            <text>{{ mode.label }}</text>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <view>
            <text class="section-title">{{ selectedTrack?.label || '公共课' }}</text>
            <text class="section-hint">{{ selectedModeLabel }}</text>
          </view>
          <text class="section-meta">{{ selectedTrackReleaseLabel }}</text>
        </view>

        <view v-if="selectedBanks.length > 0" class="bank-list">
          <view v-for="bank in selectedBanks" :key="bank.id" class="card bank-card">
            <view class="bank-info">
              <text class="bank-track">{{ bank.year }} 真题</text>
              <text class="bank-name">{{ bank.name }}</text>
              <text v-if="bank.releaseLabel" class="bank-release-label">{{ bank.releaseLabel }}</text>
              <text class="bank-desc">{{ bank.description }}</text>
              <text v-if="bank.caution" class="bank-caution">{{ bank.caution }}</text>
            </view>
            <view
              v-if="!isBankLoaded(bank.id)"
              class="bank-btn load-btn"
              :class="{ disabled: loadingBankId === bank.id }"
              hover-class="btn-hover"
              @tap="handleLoadBank(bank.id)"
            >
              <text class="bank-btn-text">{{ loadingBankId === bank.id ? '加载中' : '加载' }}</text>
            </view>
            <view v-else class="bank-loaded">
              <text class="bank-loaded-text">已加载</text>
            </view>
          </view>
        </view>

        <view v-else class="empty-track-card">
          <text class="empty-track-title">{{ emptyTrackTitle }}</text>
          <text class="empty-track-desc">{{ emptyTrackDesc }}</text>
          <view class="empty-track-action" hover-class="btn-hover" @tap="chooseImportSource">
            <text>查看真题目录</text>
          </view>
        </view>
      </view>

      <!-- 已加载统计 + 操作按钮 -->
      <view class="section">
        <view class="training-plan-card">
          <view class="training-plan-head">
            <view>
              <text class="training-kicker">公共课训练</text>
              <text class="training-title">{{ todayTraining.trackLabel }} · {{ todayTraining.focus }}</text>
            </view>
            <text class="training-minutes">{{ todayTraining.minutes }}min</text>
          </view>
          <view class="training-status-row">
            <text class="training-status" :class="`status-${todayTraining.status}`">
              {{ trainingStatusLabel(todayTraining.status) }}
            </text>
            <text class="training-meta">{{ trainingCoverageText }}</text>
          </view>
          <view class="training-week-row">
            <view
              v-for="task in weeklyTrainingTasks"
              :key="task.day"
              class="training-day"
              :class="[{ active: task.day === todayTraining.day }, `status-${task.status}`]"
            >
              <text class="training-day-label">{{ task.label }}</text>
              <text class="training-day-track">{{ task.trackLabel }}</text>
            </view>
          </view>
        </view>

        <view v-if="hasBank" class="card status-card">
          <text class="status-text">已加载 {{ totalQuestions }} 题</text>
          <view class="progress-mini">
            <view class="progress-bar-sm">
              <view class="progress-fill-sm" :style="{ width: progressPercent + '%' }" />
            </view>
            <text class="progress-label">已做 {{ progressPercent }}%</text>
          </view>
        </view>

        <!-- 开始刷题 -->
        <view v-if="hasBank" class="action-btn primary-btn" hover-class="btn-hover" @tap="goDoQuiz">
          <text class="action-btn-text">开始刷题</text>
        </view>

        <!-- 智能复习 -->
        <view v-if="hasBank" class="action-btn secondary-btn" hover-class="btn-hover" @tap="goSmartReview">
          <text class="action-btn-text secondary-text">智能复习</text>
        </view>
      </view>

      <!-- 底部占位 -->
      <view :style="{ height: tabBarHeight + 96 + 'px' }" />
    </scroll-view>

    <!-- 底部导航栏 -->
    <CustomTabbar :active-index="1" />
  </view>
</template>

<script>
import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
import { useFlashcardBank } from '@/composables/useFlashcardBank.js';
import { useBankStatus } from '@/composables/useBankStatus.js';
import { useDynamicMixin } from '@/composables/useDynamicMixin.js';
import { getPracticeNavigationTree } from '@/config/bank-registry.js';
import { buildPublicCourseTrainingPlan } from '@/config/public-course-training-plan.js';
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';

export default {
  components: { CustomTabbar },

  setup() {
    const dynamicMixinHelper = useDynamicMixin();
    const {
      loading,
      availableBanks,
      loadedBankIds: loadedIds,
      syncLoadedBankIds,
      openQuestionBank
    } = useFlashcardBank();

    const { hasBank, totalQuestions, progressPercent, isPageLoading, refreshBankStatus } = useBankStatus();

    return {
      loading,
      availableBanks,
      loadedIds,
      syncLoadedBankIds,
      openQuestionBank,
      hasBank,
      totalQuestions,
      progressPercent,
      isPageLoading,
      refreshBankStatus,
      dynamicMixinHelper,
      dynamicMethodsCache: dynamicMixinHelper.dynamicMethodsCache
    };
  },

  data() {
    return {
      statusBarHeight: 44,
      tabBarHeight: 90,
      loadingBankId: null,
      isDark: false,
      selectedSubjectKey: '',
      selectedTrackId: '',
      selectedModeId: 'past_exam'
    };
  },

  computed: {
    navigationTree() {
      const profile = storageService.get('exam_profile', null) || {};
      return getPracticeNavigationTree(profile);
    },

    availableBankCount() {
      return this.navigationTree.reduce((sum, subject) => {
        return sum + subject.tracks.reduce((trackSum, track) => trackSum + track.banks.length, 0);
      }, 0);
    },

    loadedBankCount() {
      return this.loadedIds?.size || 0;
    },

    trackCount() {
      return this.navigationTree.reduce((sum, subject) => sum + subject.tracks.length, 0);
    },

    practiceHeroKicker() {
      return 'Exam Master';
    },

    practiceHeroTitle() {
      return '今日刷题';
    },

    practiceHeroSubtitle() {
      return '选择一套真题，直接进入训练。英语卷优先显示完整文章，再做选择。';
    },

    bankAvailabilityText() {
      return this.availableBankCount > 0 ? `${this.availableBankCount} 个可用题库` : '暂无可用题库';
    },

    selectedSubject() {
      return (
        this.navigationTree.find((subject) => subject.id === this.selectedSubjectKey) || this.navigationTree[0] || null
      );
    },

    selectedTrack() {
      const tracks = this.selectedSubject?.tracks || [];
      return tracks.find((track) => track.id === this.selectedTrackId) || tracks[0] || null;
    },

    selectedBanks() {
      return this.selectedTrack?.banks || [];
    },

    selectedTrackCoverage() {
      return this.selectedTrack?.coverage || null;
    },

    selectedModes() {
      return this.selectedTrack?.modes || [];
    },

    selectedModeLabel() {
      return this.selectedModes.find((mode) => mode.id === this.selectedModeId)?.label || '历年真题';
    },

    selectedTrackReleaseLabel() {
      const coverage = this.selectedTrackCoverage;
      if (!coverage) return this.selectedModeLabel;
      if (coverage.publishedCount > 0) {
        return `${coverage.publishedCount} 套可练`;
      }
      return this.selectedModeLabel;
    },

    emptyTrackTitle() {
      return '该方向暂无可练题库';
    },

    emptyTrackDesc() {
      return '该方向的真题会按年份整理为整卷练习，材料和答案说明完善后开放。';
    },

    publicCoursePlan() {
      return buildPublicCourseTrainingPlan();
    },

    todayTraining() {
      return this.publicCoursePlan.today || {};
    },

    weeklyTrainingTasks() {
      return this.publicCoursePlan.weeklyTasks || [];
    },

    trainingCoverageText() {
      const summary = this.publicCoursePlan.summary || {};
      return `${summary.publishedSlots || 0}/${summary.requiredSlots || 0} 槽位已开放`;
    }
  },

  onLoad() {
    this.syncTheme();
    this.initLayout();
    this.refreshBankStatus();
    this.ensureNavigationSelection();
    this.preloadPracticeSubPackage();
    uni.$on('themeUpdate', this.syncTheme);
  },

  onShow() {
    this.syncTheme();
    // 每次切回刷新题库状态（可能在do-quiz中答了题）
    this.syncLoadedBankIds?.();
    this.refreshBankStatus();
    this.ensureNavigationSelection();
  },

  onUnload() {
    uni.$off('themeUpdate', this.syncTheme);
  },

  onShareAppMessage() {
    return {
      title: 'EXAM-MASTER — 刷题中心',
      path: '/pages/practice/index'
    };
  },

  methods: {
    async _invokeDynamicMethod(methodName, args = [], options = {}) {
      const { silent = false } = options;
      let cached = this.dynamicMethodsCache?.[methodName];

      if (typeof cached !== 'function' && this._mixinReady) {
        await this._mixinReady;
        cached = this.dynamicMethodsCache?.[methodName];
      }

      if (typeof cached === 'function') {
        return cached(...args);
      }

      if (!silent) {
        uni.showToast({ title: '功能初始化失败，请稍后重试', icon: 'none' });
      }

      return undefined;
    },

    async _loadAIGenerationMixin() {
      this.dynamicMethodsCache = this.dynamicMethodsCache || {};
      const helper = this.dynamicMixinHelper || useDynamicMixin();
      await helper.loadAIGenerationMixin(this);
      this._mixinLoaded = true;
    },

    preloadPracticeSubPackage() {
      const helper = this.dynamicMixinHelper;
      if (!helper || typeof helper.ensurePracticeSubPackageLoaded !== 'function') return;

      helper.ensurePracticeSubPackageLoaded().catch((e) => {
        logger.warn('[Practice] preload practice subpackage failed:', e);
      });
    },

    chooseImportSource() {
      const cached = this.dynamicMethodsCache?.chooseImportSource;
      if (typeof cached === 'function') {
        return cached();
      }
      safeNavigateTo('/pages/practice-sub/question-bank');
      return undefined;
    },

    ensureNavigationSelection() {
      const tree = this.navigationTree;
      if (!tree.length) return;

      const preferredSubject =
        tree.find((subject) => subject.tracks.some((track) => track.banks.length > 0)) || tree[0];
      if (!this.selectedSubjectKey || !tree.some((subject) => subject.id === this.selectedSubjectKey)) {
        this.selectedSubjectKey = preferredSubject.id;
      }

      const subject = tree.find((item) => item.id === this.selectedSubjectKey) || preferredSubject;
      const preferredTrack = subject.tracks.find((track) => track.banks.length > 0) || subject.tracks[0];
      if (!this.selectedTrackId || !subject.tracks.some((track) => track.id === this.selectedTrackId)) {
        this.selectedTrackId = preferredTrack?.id || '';
      }

      const modes = preferredTrack?.modes || [];
      if (modes.length && !modes.some((mode) => mode.id === this.selectedModeId)) {
        this.selectedModeId = modes[0].id;
      }
    },

    selectSubject(subjectId) {
      this.selectedSubjectKey = subjectId;
      const subject = this.navigationTree.find((item) => item.id === subjectId);
      const track = subject?.tracks?.find((item) => item.banks.length > 0) || subject?.tracks?.[0];
      this.selectedTrackId = track?.id || '';
      this.selectedModeId = track?.modes?.[0]?.id || 'past_exam';
    },

    selectTrack(trackId) {
      this.selectedTrackId = trackId;
      const track = this.selectedSubject?.tracks?.find((item) => item.id === trackId);
      this.selectedModeId = track?.modes?.[0]?.id || 'past_exam';
    },

    selectMode(modeId) {
      this.selectedModeId = modeId;
    },

    isBankLoaded(bankId) {
      return Boolean(this.loadedIds?.has?.(bankId));
    },

    initLayout() {
      try {
        const info = uni.getWindowInfo();
        const statusBarHeight = Number(info.statusBarHeight || 0);
        this.statusBarHeight = statusBarHeight > 0 ? statusBarHeight : 16;
        const safeBottom = info.safeAreaInsets?.bottom || 0;
        this.tabBarHeight = 60 + 12 + safeBottom;
      } catch (_e) {
        logger.warn('[Practice] layout init failed');
      }
    },

    syncTheme(mode) {
      const resolved = mode || storageService.get('theme_mode', 'light');
      this.isDark = resolved === 'dark';
    },

    async handleLoadBank(bankId) {
      if (!bankId || this.loadingBankId === bankId) {
        return;
      }

      this.loadingBankId = bankId;
      this.openQuestionBank?.(bankId);
      this.loadingBankId = null;
    },

    goDoQuiz() {
      this.refreshBankStatus?.();
      if (!this.hasBank) {
        toast.info('请先加载题库');
        return;
      }
      safeNavigateTo('/pages/practice-sub/do-quiz');
    },

    goSmartReview() {
      this.refreshBankStatus?.();
      if (!this.hasBank) {
        toast.info('请先加载题库');
        return;
      }
      // 智能复习：跳转到 do-quiz 的复习模式
      safeNavigateTo('/pages/practice-sub/do-quiz?mode=smart_review');
    },

    trainingStatusLabel(status) {
      if (status === 'ready') return '今日可练';
      if (status === 'pending') return '整理中';
      if (status === 'review') return '复盘';
      return '待补齐';
    }
  }
};
</script>

<style lang="scss" scoped>
$primary: #1f7a4d;
$primary-light: #e8f4ee;
$primary-deep: #1d1d1f;
$action-green: #1d9a52;
$bg: #f5f5f7;
$card-bg: #ffffff;
$text-main: #1a1d26;
$text-sub: #5f6672;
$text-weak: #9ca3af;
$radius-lg: 24rpx;
$radius-sm: 12rpx;
$spacing-page: 32rpx;
$spacing-card: 32rpx;
$spacing-section: 24rpx;

.page {
  @include em-mobile-canvas;
  background: $bg;
  color: $text-main;
}

/* 导航栏 */
.nav-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  @include em-mobile-topbar;
  background: rgba(245, 245, 247, 0.86);
  box-shadow: 0 1rpx 0 rgba(0, 0, 0, 0.06);
}
.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  padding: 0 $spacing-page;
}
.nav-title {
  font-size: 36rpx;
  font-weight: 700;
  color: $primary-deep;
}

.main-scroll {
  height: 100vh;
  box-sizing: border-box;
}

.section {
  padding: 0 $spacing-page;
  margin-bottom: $spacing-section;
}
.section:first-child {
  padding-top: 28rpx;
}

.practice-hero {
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  padding: 38rpx 36rpx;
  border-radius: 34rpx;
  background: $card-bg;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 18rpx 48rpx rgba(15, 23, 42, 0.08);
}

.practice-hero::after {
  content: '';
  position: absolute;
  right: 30rpx;
  top: 28rpx;
  width: 108rpx;
  height: 108rpx;
  border-radius: 30rpx;
  background: linear-gradient(145deg, rgba(31, 122, 77, 0.16), rgba(52, 199, 89, 0.12));
}

.practice-kicker {
  position: relative;
  z-index: 1;
  display: block;
  color: #8e8e93;
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 0;
}

.practice-title {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 14rpx;
  color: $text-main;
  font-size: 48rpx;
  font-weight: 760;
  line-height: 1.12;
}

.practice-subtitle {
  position: relative;
  z-index: 1;
  display: block;
  max-width: 590rpx;
  margin-top: 18rpx;
  color: $text-sub;
  font-size: 26rpx;
  line-height: 1.55;
}

.practice-signal-row {
  position: relative;
  z-index: 1;
  display: flex;
  margin-top: 30rpx;
}

.practice-signal {
  flex: 1;
  padding: 18rpx 14rpx;
  border-radius: 22rpx;
  background: #f6f7f9;
  border: 1rpx solid rgba(0, 0, 0, 0.04);
}

.practice-signal + .practice-signal {
  margin-left: 12rpx;
}

.signal-value {
  @include em-mobile-number;
  display: block;
  color: $text-main;
  font-size: 34rpx;
  font-weight: 760;
  line-height: 1;
}

.signal-label {
  display: block;
  margin-top: 8rpx;
  color: $text-weak;
  font-size: 21rpx;
  font-weight: 600;
}

.practice-command-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  margin-top: 30rpx;
}

.practice-command {
  @include em-mobile-pressable;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72rpx;
  padding: 22rpx 32rpx;
  border-radius: 999rpx;
  font-size: 27rpx;
  font-weight: 900;
}

.practice-command.primary {
  background: #1d1d1f;
  color: #ffffff;
  box-shadow: 0 12rpx 28rpx rgba(17, 24, 39, 0.16);
}

.practice-command.secondary {
  margin-left: 14rpx;
  background: #f2f3f5;
  color: $text-main;
  box-shadow: none;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.navigator-head {
  align-items: flex-start;
}

.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: $text-main;
  margin-bottom: 16rpx;
  display: block;
}

.section-head .section-title {
  margin-bottom: 0;
}

.section-meta {
  color: $text-weak;
  font-size: 23rpx;
}

.section-hint {
  display: block;
  margin-top: 6rpx;
  color: $text-weak;
  font-size: 22rpx;
}

.subject-tabs {
  display: flex;
  padding: 8rpx;
  border-radius: 28rpx;
  background: #e9eaee;
  box-shadow: none;
}

.subject-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72rpx;
  border-radius: 22rpx;
  color: $text-sub;
  font-size: 26rpx;
  font-weight: 750;
}

.subject-tab.active {
  background: #ffffff;
  color: $text-main;
  box-shadow: 0 8rpx 18rpx rgba(15, 23, 42, 0.08);
}

.track-rail {
  display: flex;
  margin-top: 18rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.track-pill {
  display: inline-flex;
  align-items: center;
  min-width: 212rpx;
  margin-right: 14rpx;
  padding: 18rpx 20rpx;
  border-radius: 24rpx;
  background: #ffffff;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 8rpx 22rpx rgba(15, 23, 42, 0.06);
}

.track-pill.active {
  background: #1d1d1f;
  box-shadow: 0 14rpx 32rpx rgba(17, 24, 39, 0.16);
}

.track-code {
  color: $text-weak;
  font-size: 21rpx;
  font-weight: 900;
}

.track-label {
  margin-left: 10rpx;
  color: $text-main;
  font-size: 25rpx;
  font-weight: 850;
}

.track-count {
  margin-left: 12rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(31, 122, 77, 0.1);
  color: $primary;
  font-size: 20rpx;
  font-weight: 900;
}

.track-pill.active .track-code,
.track-pill.active .track-label {
  color: #f8fff2;
}

.track-pill.active .track-count {
  background: rgba(255, 255, 255, 0.16);
  color: #ffffff;
}

.mode-row {
  display: flex;
  flex-wrap: wrap;
  margin-top: 18rpx;
}

.mode-chip {
  margin-right: 12rpx;
  margin-bottom: 12rpx;
  padding: 13rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(20, 32, 23, 0.06);
  color: $text-sub;
  font-size: 23rpx;
  font-weight: 700;
}

.mode-chip.active {
  background: rgba(31, 122, 77, 0.12);
  color: $primary;
}

.training-plan-card {
  box-sizing: border-box;
  padding: 30rpx 28rpx;
  margin-bottom: 24rpx;
  border-radius: 28rpx;
  background: #ffffff;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.06);
}

.training-plan-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.training-kicker {
  display: block;
  color: $text-weak;
  font-size: 20rpx;
  font-weight: 900;
}

.training-title {
  display: block;
  margin-top: 8rpx;
  color: $text-main;
  font-size: 30rpx;
  font-weight: 850;
  line-height: 1.34;
}

.training-minutes {
  flex-shrink: 0;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(31, 122, 77, 0.1);
  color: $primary;
  font-size: 22rpx;
  font-weight: 900;
}

.training-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 18rpx;
}

.training-status,
.training-meta {
  font-size: 22rpx;
  font-weight: 760;
}

.training-status {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: #f2f3f5;
  color: $text-sub;
}

.training-status.status-ready {
  background: rgba(31, 122, 77, 0.1);
  color: $primary;
}

.training-status.status-pending {
  background: rgba(255, 149, 0, 0.12);
  color: #9a5b00;
}

.training-status.status-review {
  background: rgba(0, 113, 227, 0.1);
  color: #0068d6;
}

.training-meta {
  color: $text-weak;
}

.training-week-row {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8rpx;
  margin-top: 18rpx;
}

.training-day {
  min-height: 78rpx;
  padding: 8rpx 4rpx;
  border-radius: 18rpx;
  background: #f6f7f9;
  text-align: center;
  border: 1rpx solid transparent;
}

.training-day.active {
  border-color: rgba(31, 122, 77, 0.26);
  background: rgba(31, 122, 77, 0.08);
}

.training-day.status-pending {
  background: rgba(255, 149, 0, 0.08);
}

.training-day.status-missing {
  opacity: 0.62;
}

.training-day-label,
.training-day-track {
  display: block;
  white-space: nowrap;
}

.training-day-label {
  color: $text-weak;
  font-size: 18rpx;
  font-weight: 800;
}

.training-day-track {
  margin-top: 5rpx;
  color: $text-main;
  font-size: 19rpx;
  font-weight: 850;
}

.card {
  box-sizing: border-box;
  padding: $spacing-card;
  border-radius: $radius-lg;
  background: $card-bg;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.06);
}

/* 题库列表 */
.bank-list {
  display: flex;
  flex-direction: column;
}

.bank-card {
  @include em-mobile-pressable;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  transition-property: transform, opacity;
  transition-duration: 160ms;
  transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
}

.bank-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-right: 20rpx;
}

.bank-name {
  font-size: 30rpx;
  font-weight: 800;
  color: $text-main;
}

.bank-release-label {
  display: inline-flex;
  align-self: flex-start;
  margin-top: 10rpx;
  padding: 5rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(31, 122, 77, 0.1);
  color: #1f7a4d;
  font-size: 20rpx;
  font-weight: 850;
}

.bank-track {
  color: $text-weak;
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 0;
  margin-bottom: 8rpx;
}

.bank-desc {
  font-size: 24rpx;
  color: $text-sub;
  margin-top: 6rpx;
}

.bank-caution {
  display: block;
  margin-top: 8rpx;
  color: $text-weak;
  font-size: 22rpx;
  line-height: 1.45;
}

.bank-btn {
  @include em-mobile-pressable;
  padding: 12rpx 28rpx;
  border-radius: $radius-sm;
  flex-shrink: 0;
}

.load-btn {
  background: #1d1d1f;
}

.bank-btn-text {
  font-size: 26rpx;
  font-weight: 500;
  color: #ffffff;
}

.bank-loaded {
  padding: 12rpx 28rpx;
}

.bank-loaded-text {
  font-size: 26rpx;
  color: $action-green;
  font-weight: 500;
}

.empty-track-card {
  box-sizing: border-box;
  padding: 32rpx;
  border-radius: $radius-lg;
  background: $card-bg;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.06);
}

.empty-track-title {
  display: block;
  color: $text-main;
  font-size: 30rpx;
  font-weight: 850;
}

.empty-track-desc {
  display: block;
  margin-top: 10rpx;
  color: $text-sub;
  font-size: 24rpx;
  line-height: 1.5;
}

.empty-track-action {
  @include em-mobile-pressable;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72rpx;
  margin-top: 22rpx;
  border-radius: 18rpx;
  background: #1d1d1f;
  font-size: 25rpx;
  font-weight: 850;
}

.empty-track-action text {
  color: #ffffff;
}

/* 状态卡片 */
.status-card {
  margin-bottom: 24rpx;
}

.status-text {
  @include em-mobile-number;
  font-size: 30rpx;
  font-weight: 600;
  color: $text-main;
  display: block;
  margin-bottom: 16rpx;
}

.progress-mini {
  display: flex;
  align-items: center;
}

.progress-bar-sm {
  flex: 1;
  height: 12rpx;
  background: rgba(31, 122, 77, 0.1);
  border-radius: 99rpx;
  overflow: hidden;
}

.progress-fill-sm {
  height: 100%;
  background: $primary;
  border-radius: 99rpx;
  transition: width 0.3s ease;
}

.progress-label {
  margin-left: 16rpx;
  font-size: 24rpx;
  color: $text-sub;
  white-space: nowrap;
}

/* 按钮 */
.action-btn {
  @include em-mobile-pressable;
  border-radius: $radius-sm;
  padding: 24rpx;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 16rpx;
}

.primary-btn {
  background: #1d1d1f;
  box-shadow: 0 12rpx 28rpx rgba(17, 24, 39, 0.16);
}

.secondary-btn {
  background: #ffffff;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: none;
}

.action-btn-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #ffffff;
}

.secondary-text {
  color: $text-main;
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
.dark-mode .practice-title,
.dark-mode .section-title,
.dark-mode .signal-value,
.dark-mode .track-label,
.dark-mode .training-title,
.dark-mode .training-day-track,
.dark-mode .bank-name,
.dark-mode .empty-track-title,
.dark-mode .status-text,
.dark-mode .secondary-text {
  color: #f5f7fb;
}

.dark-mode .practice-hero,
.dark-mode .card,
.dark-mode .training-plan-card,
.dark-mode .track-pill,
.dark-mode .empty-track-card,
.dark-mode .secondary-btn {
  background: rgba(34, 37, 45, 0.82);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 18rpx 48rpx rgba(0, 0, 0, 0.32);
}

.dark-mode .subject-tabs,
.dark-mode .practice-signal,
.dark-mode .training-day,
.dark-mode .mode-chip,
.dark-mode .training-status,
.dark-mode .practice-command.secondary {
  background: rgba(255, 255, 255, 0.07);
}

.dark-mode .practice-subtitle,
.dark-mode .section-hint,
.dark-mode .section-meta,
.dark-mode .signal-label,
.dark-mode .training-meta,
.dark-mode .bank-desc,
.dark-mode .bank-caution,
.dark-mode .empty-track-desc,
.dark-mode .progress-label {
  color: rgba(245, 247, 251, 0.62);
}

.dark-mode .subject-tab.active {
  background: rgba(0, 224, 255, 0.12);
  color: #75ddff;
  box-shadow: none;
}

.dark-mode .track-pill.active,
.dark-mode .primary-btn,
.dark-mode .practice-command.primary,
.dark-mode .load-btn,
.dark-mode .empty-track-action {
  background: linear-gradient(135deg, #00e0ff 0%, #3f8cff 100%);
  box-shadow: 0 16rpx 38rpx rgba(0, 224, 255, 0.22);
}

.dark-mode .track-pill.active .track-code,
.dark-mode .track-pill.active .track-label,
.dark-mode .primary-btn .action-btn-text,
.dark-mode .practice-command.primary text,
.dark-mode .load-btn .bank-btn-text,
.dark-mode .empty-track-action text {
  color: #10131a;
}

.dark-mode .progress-bar-sm {
  background: rgba(255, 255, 255, 0.1);
}
</style>
