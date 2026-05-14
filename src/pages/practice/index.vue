<template>
  <view class="page">
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
              <text class="signal-label">已加载</text>
            </view>
            <view class="practice-signal">
              <text class="signal-value">{{ totalQuestions }}</text>
              <text class="signal-label">可训练题</text>
            </view>
            <view class="practice-signal">
              <text class="signal-value">{{ trackCount }}</text>
              <text class="signal-label">公共课轨道</text>
            </view>
          </view>

          <view class="practice-command-row">
            <view
              class="practice-command primary"
              hover-class="btn-hover"
              @tap="hasBank ? goDoQuiz() : chooseImportSource()"
            >
              <text>{{ hasBank ? '进入限时训练' : '导入资料解析' }}</text>
            </view>
            <view class="practice-command secondary" hover-class="btn-hover" @tap="chooseImportSource">
              <text>资料导入</text>
            </view>
          </view>
        </view>
      </view>

      <view class="section">
        <view class="section-head navigator-head">
          <view>
            <text class="section-title">公共课导航</text>
            <text class="section-hint">科目 / 版本 / 训练模式</text>
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
              <text class="bank-track">{{ bank.year }} PAST EXAM</text>
              <text class="bank-name">{{ bank.name }}</text>
              <text class="bank-desc">{{ bank.description }}</text>
            </view>
            <view
              v-if="!isBankLoaded(bank.id)"
              class="bank-btn load-btn"
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
import { storageService } from '@/services/storageService.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { logger } from '@/utils/logger.js';

export default {
  components: { CustomTabbar },

  setup() {
    const dynamicMixinHelper = useDynamicMixin();
    const { loading, availableBanks, loadedBankIds: loadedIds, loadFlashcardBank } = useFlashcardBank();

    const { hasBank, totalQuestions, progressPercent, isPageLoading, refreshBankStatus } = useBankStatus();

    return {
      loading,
      availableBanks,
      loadedIds,
      loadFlashcardBank,
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
      return '训练控制台';
    },

    practiceHeroTitle() {
      return '真题训练中枢';
    },

    practiceHeroSubtitle() {
      return '按科目和年份加载整套真题，错题和复习间隔会自动记录。';
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
    }
  },

  onLoad() {
    this.initLayout();
    this.refreshBankStatus();
    this.ensureNavigationSelection();
    this.preloadPracticeSubPackage();
  },

  onShow() {
    // 每次切回刷新题库状态（可能在do-quiz中答了题）
    this.refreshBankStatus();
    this.ensureNavigationSelection();
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

    async handleLoadBank(bankId) {
      try {
        this.loadingBankId = bankId;
        await this.loadFlashcardBank(bankId);
        this.refreshBankStatus();
      } catch (e) {
        logger.error('[Practice] load bank failed:', e);
        uni.showToast({ title: '加载失败，请重试', icon: 'none' });
      } finally {
        this.loadingBankId = null;
      }
    },

    goDoQuiz() {
      safeNavigateTo('/pages/practice-sub/do-quiz');
    },

    goSmartReview() {
      // 智能复习：跳转到 do-quiz 的复习模式
      safeNavigateTo('/pages/practice-sub/do-quiz?mode=smart_review');
    }
  }
};
</script>

<style lang="scss" scoped>
$primary: #9fe870;
$primary-light: #eafbe2;
$primary-deep: #142017;
$action-green: #18a957;
$bg: #f5f7f1;
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
}

/* 导航栏 */
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
  @include em-mobile-deep-panel(38rpx, 36rpx);
}

.practice-hero::after {
  content: '';
  position: absolute;
  right: -72rpx;
  top: -88rpx;
  width: 300rpx;
  height: 300rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(117, 221, 255, 0.2) 0%, rgba(117, 221, 255, 0) 68%);
}

.practice-kicker {
  position: relative;
  z-index: 1;
  display: block;
  color: rgba(255, 255, 255, 0.48);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 2.2rpx;
}

.practice-title {
  position: relative;
  z-index: 1;
  display: block;
  margin-top: 14rpx;
  color: rgba(255, 255, 255, 0.94);
  font-size: 52rpx;
  font-weight: 900;
  line-height: 1.08;
}

.practice-subtitle {
  position: relative;
  z-index: 1;
  display: block;
  max-width: 590rpx;
  margin-top: 18rpx;
  color: rgba(255, 255, 255, 0.66);
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
  background: rgba(255, 255, 255, 0.09);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.12);
}

.practice-signal + .practice-signal {
  margin-left: 12rpx;
}

.signal-value {
  @include em-mobile-number;
  display: block;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1;
}

.signal-label {
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.56);
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
  @include em-mobile-primary-action;
}

.practice-command.secondary {
  margin-left: 14rpx;
  background: rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.86);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.12);
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
  background: rgba(255, 255, 255, 0.38);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.54);
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
  background: rgba(255, 255, 255, 0.9);
  color: $primary-deep;
  box-shadow: 0 10rpx 24rpx rgba(20, 32, 23, 0.08);
}

.track-rail {
  display: flex;
  margin-top: 18rpx;
  overflow-x: auto;
  white-space: nowrap;
}

.track-pill {
  @include em-mobile-glass-surface(26rpx, 18rpx 20rpx);
  display: inline-flex;
  align-items: center;
  min-width: 212rpx;
  margin-right: 14rpx;
}

.track-pill.active {
  background: $primary-deep;
  box-shadow: 0 14rpx 32rpx rgba(20, 32, 23, 0.16);
}

.track-code {
  color: rgba(20, 32, 23, 0.42);
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
  background: rgba(159, 232, 112, 0.2);
  color: $primary-deep;
  font-size: 20rpx;
  font-weight: 900;
}

.track-pill.active .track-code,
.track-pill.active .track-label {
  color: #f8fff2;
}

.track-pill.active .track-count {
  background: $primary;
  color: $primary-deep;
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
  background: rgba(159, 232, 112, 0.3);
  color: $primary-deep;
}

.card {
  @include em-mobile-glass-surface($radius-lg, $spacing-card);
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

.bank-track {
  color: rgba(22, 51, 0, 0.38);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 1.4rpx;
  margin-bottom: 8rpx;
}

.bank-desc {
  font-size: 24rpx;
  color: $text-sub;
  margin-top: 6rpx;
}

.bank-btn {
  @include em-mobile-pressable;
  padding: 12rpx 28rpx;
  border-radius: $radius-sm;
  flex-shrink: 0;
}

.load-btn {
  background: $primary-deep;
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
  @include em-mobile-glass-surface($radius-lg, 32rpx);
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
  @include em-mobile-primary-action;
  @include em-mobile-pressable;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72rpx;
  margin-top: 22rpx;
  border-radius: 20rpx;
  font-size: 25rpx;
  font-weight: 850;
}

.empty-track-action text {
  color: $primary-deep;
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
  background: rgba($primary, 0.12);
  border-radius: 99rpx;
  overflow: hidden;
}

.progress-fill-sm {
  height: 100%;
  background: $action-green;
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
  @include em-mobile-primary-action;
}

.secondary-btn {
  background: rgba(255, 255, 255, 0.56);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.68);
}

.action-btn-text {
  font-size: 32rpx;
  font-weight: 600;
  color: $primary-deep;
}

.secondary-text {
  color: $primary-deep;
}

.btn-hover {
  opacity: 0.85;
  transform: scale(0.98);
}
</style>
