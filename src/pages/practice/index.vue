<template>
  <LearningShell
    ref="keyboardRoot"
    class="yozi-page"
    active="practice"
    :title="$t('pages.practice')"
    :style="[tabBarStyle, $yoziInsets]"
    :class="{ 'dark-mode': isDark, 'theme-light': !isDark }"
  >
    <!-- 自定义导航栏 -->
    <!-- 主内容 -->
    <scroll-view scroll-y class="main-scroll">
      <!-- 可用题库列表 -->
      <view class="section practice-hero-section">
        <view class="practice-hero">
          <text class="practice-title">{{ uiText(practiceHeroTitle) }}</text>
          <view class="practice-signal-row">
            <BaseStat :label="t('dashboard.copy55')" :value="Number(loadedBankCount) || 0" />
            <BaseStat :label="t('dashboard.copy56')" :value="Number(totalQuestions) || 0" />
            <BaseStat :label="t('dashboard.copy57')" :value="Number(trackCount) || 0" />
          </view>

          <view class="practice-command-row">
            <BaseButton
              class="practice-command primary"
              data-learning-toggle
              variant="primary"
              @tap="
                hasBank || hasQuizResume || selectedModeId === 'weakness'
                  ? goDoQuiz({ resume: true })
                  : chooseImportSource()
              "
              ><text>{{
                hasQuizResume
                  ? t('dashboard.copy58')
                  : hasBank || selectedModeId === 'weakness'
                    ? uiText(selectedModeLabel)
                    : t('dashboard.copy60')
              }}</text></BaseButton
            >
            <BaseButton
              class="practice-command secondary"
              data-learning-toggle
              variant="secondary"
              @tap="chooseImportSource"
              ><text>{{ t('dashboard.copy61') }}</text></BaseButton
            >
          </view>
        </view>
      </view>

      <!-- #ifdef H5 -->
      <view v-if="guestDemoEnabled && !hasBank" class="section">
        <view class="card demo-entry">
          <text class="section-title">{{ t('dashboard.copy62') }}</text>
          <BaseButton
            class="demo-start"
            :loading="startingDemo"
            :disabled="startingDemo"
            variant="primary"
            @tap="startDemo"
            >{{ t('dashboard.copy63') }}</BaseButton
          >
        </view>
      </view>
      <!-- #endif -->

      <view class="section">
        <view class="section-head navigator-head">
          <view>
            <text class="section-title">{{ t('dashboard.copy16') }}</text>
          </view>
          <text class="section-meta">{{ uiText(bankAvailabilityText) }}</text>
        </view>

        <view class="readiness-card">
          <view class="readiness-head">
            <view>
              <text class="readiness-title">{{ uiText(readinessTitle) }}</text>
            </view>
            <BaseStat
              :label="t('dashboard.copy64')"
              :value="readinessSummary.publishedSlots"
              :denominator="
                readinessSummary.publishedSlots + readinessSummary.pendingSlots + readinessSummary.missingSlots
              "
            />
          </view>
          <view class="readiness-progress">
            <view class="readiness-progress-fill" :style="{ width: readinessPercent + '%' }" />
          </view>
          <view class="readiness-metrics">
            <BaseStat :label="t('dashboard.copy64')" :value="Number(readinessSummary.publishedSlots) || 0" />
            <BaseStat :label="t('dashboard.copy65')" :value="Number(readinessSummary.pendingSlots) || 0" />
            <BaseStat :label="t('dashboard.copy66')" :value="Number(readinessSummary.missingSlots) || 0" />
          </view>
          <view class="readiness-track-line">
            <text>{{ uiText(selectedTrackReadinessText) }}</text>
          </view>
        </view>

        <view class="subject-tabs">
          <BaseChip
            v-for="subject in navigationTree"
            :key="subject.id"
            data-learning-toggle
            :model-value="selectedSubject?.id === subject.id"
            @update:model-value="selectSubject(subject.id)"
            ><text>{{ uiText(subject.label) }}</text></BaseChip
          >
        </view>

        <view class="track-rail">
          <BaseChip
            v-for="track in selectedSubject?.tracks || []"
            :key="track.id"
            data-learning-toggle
            :model-value="selectedTrack?.id === track.id"
            @update:model-value="selectTrack(track.id)"
            ><text class="track-code">{{ track.code }}</text
            ><text class="track-label">{{ uiText(track.label) }}</text
            ><text class="track-count">{{ track.banks.length }}</text></BaseChip
          >
        </view>

        <view class="mode-row">
          <BaseChip
            v-for="mode in selectedModes"
            :key="mode.id"
            data-learning-toggle
            :model-value="selectedModeId === mode.id"
            @update:model-value="selectMode(mode.id)"
            ><text>{{ uiText(mode.label) }}</text></BaseChip
          >
        </view>
      </view>

      <view class="section">
        <view class="section-head">
          <view>
            <text class="section-title">{{ uiText(selectedTrack?.label || t('dashboard.copy67')) }}</text>
            <text class="section-hint">{{ uiText(selectedModeLabel) }}</text>
          </view>
          <text class="section-meta">{{ uiText(selectedTrackReleaseLabel) }}</text>
        </view>

        <view v-if="selectedBanks.length > 0" class="bank-list">
          <view v-for="bank in selectedBanks" :key="bank.id" class="card bank-card">
            <view class="bank-info">
              <text class="bank-track">{{ t('dashboard.copy68', { v0: bank.year }) }}</text>
              <text class="bank-name">{{ uiText(bank.name) }}</text>
              <text v-if="bank.releaseLabel" class="bank-release-label">{{ uiText(bank.releaseLabel) }}</text>
            </view>
            <BaseButton
              v-if="!isBankLoaded(bank.id)"
              class="bank-btn detail-btn"
              :disabled="loadingBankId === bank.id"
              data-learning-toggle
              variant="secondary"
              @tap="openBankDetail(bank.id)"
              ><text class="bank-btn-text">{{
                loadingBankId === bank.id ? t('dashboard.copy69') : t('dashboard.copy70')
              }}</text></BaseButton
            >
            <BaseButton
              v-else
              class="bank-btn continue-btn"
              :disabled="loadingBankId === bank.id"
              data-learning-toggle
              variant="secondary"
              @tap="openBankDetail(bank.id)"
              ><text class="bank-btn-text">{{ t('dashboard.copy71') }}</text></BaseButton
            >
          </view>
        </view>

        <BaseEmpty
          v-else
          :title="emptyTrackTitle"
          :desc="emptyTrackDesc"
          show-button
          :button-text="t('dashboard.directory')"
          @action="chooseImportSource"
        />
      </view>

      <!-- 已加载统计 + 操作按钮 -->
      <view class="section">
        <view class="training-plan-card">
          <view class="training-plan-head">
            <view>
              <text class="training-title"
                >{{ uiText(todayTraining.trackLabel) }} · {{ uiText(todayTraining.focus) }}</text
              >
            </view>
            <text class="training-minutes">{{ todayTraining.minutes }}min</text>
          </view>
          <view class="training-status-row">
            <text class="training-status" :class="`status-${todayTraining.status}`">
              {{ uiText(trainingStatusLabel(todayTraining.status)) }}
            </text>
            <text class="training-meta">{{ uiText(trainingCoverageText) }}</text>
          </view>
          <view class="training-week-row">
            <view
              v-for="task in weeklyTrainingTasks"
              :key="task.day"
              class="training-day"
              :class="[{ active: task.day === todayTraining.day }, `status-${task.status}`]"
            >
              <text class="training-day-label">{{ uiText(task.label) }}</text>
              <text class="training-day-track">{{ uiText(task.trackLabel) }}</text>
            </view>
          </view>
        </view>

        <view v-if="hasBank" class="card status-card">
          <text class="status-text">{{ t('dashboard.copy72', { v0: totalQuestions }) }}</text>
          <view class="progress-mini">
            <view class="progress-bar-sm">
              <view class="progress-fill-sm" :style="{ width: progressPercent + '%' }" />
            </view>
            <text class="progress-label">{{ t('dashboard.copy73', { v0: progressPercent }) }}</text>
          </view>
        </view>

        <!-- 开始刷题 -->
        <BaseButton
          v-if="hasBank || selectedModeId === 'weakness'"
          class="action-btn primary-btn"
          variant="primary"
          @tap="goDoQuiz"
          ><text class="action-btn-text">{{ uiText(selectedModeLabel) }}</text></BaseButton
        >

        <!-- 智能复习 -->
        <BaseButton class="action-btn secondary-btn" variant="secondary" @tap="goSmartReview"
          ><text class="action-btn-text secondary-text">{{ t('dashboard.copy75') }}</text></BaseButton
        >
      </view>

      <!-- 底部占位 -->
      <view class="yozi-tabbar-space" aria-hidden="true" />
    </scroll-view>

    <!-- 底部导航栏 -->
  </LearningShell>
</template>

<script>
import LearningShell from '@/components/business/learning/learning-shell.vue';
import { getTabbarSafeAreaStyle } from '@/utils/core/system.js';
import BaseStat from '@/components/base/base-stat/base-stat.vue';
import '@/i18n/messages/dashboard.js';
import { t, translateRegisteredText } from '@/i18n/index.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import '@/styles/yozi-pages.scss';

import { BRAND } from '@/config/brand.js';

import { useFlashcardBank } from '@/composables/useFlashcardBank.js';
import { useBankStatus } from '@/composables/useBankStatus.js';
import { useDynamicMixin } from '@/composables/useDynamicMixin.js';
import { buildPublicCourseCoverage, getPracticeNavigationTree } from '@/config/bank-registry.js';
import { buildPublicCourseTrainingPlan } from '@/config/public-course-training-plan.js';
import { storageService } from '@/services/storageService.js';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { logger } from '@/utils/logger.js';
import { toast } from '@/utils/toast.js';
import { isGuestDemoEnabled, startGuestDemoPractice } from '@/utils/practice/demo-bank.js';
import { getRecoverableQuizProgress } from '@/composables/useQuizAutoSave.js';

export default {
  components: { LearningShell, BaseStat, BaseButton, BaseChip, BaseEmpty },

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
      hasQuizResume: false,
      statusBarHeight: 44,
      tabBarStyle: {},
      loadingBankId: null,
      guestDemoEnabled: isGuestDemoEnabled(),
      startingDemo: false,

      selectedSubjectKey: '',
      selectedTrackId: '',
      selectedModeId: 'past_exam'
    };
  },

  computed: {
    isDark() {
      return useThemeStore().isDark;
    },
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
      return BRAND.name;
    },

    practiceHeroTitle() {
      return t('dashboard.copy76');
    },

    practiceHeroSubtitle() {
      return t('dashboard.copy77');
    },

    bankAvailabilityText() {
      return this.availableBankCount > 0
        ? t('dashboard.copy78', { v0: this.availableBankCount })
        : t('dashboard.copy79');
    },

    publicCourseCoverage() {
      const selectedTracks = this.navigationTree.flatMap((subject) => subject.tracks.map((track) => track.id));
      return buildPublicCourseCoverage({ tracks: selectedTracks });
    },

    readinessSummary() {
      return (
        this.publicCourseCoverage?.summary || {
          publishedSlots: 0,
          pendingSlots: 0,
          missingSlots: 0,
          requiredSlots: 0,
          coverageRate: 0
        }
      );
    },

    readinessPercent() {
      return Math.round(Number(this.readinessSummary.coverageRate || 0) * 100);
    },

    readinessTitle() {
      if (this.readinessPercent >= 80) return t('dashboard.copy80');
      if (this.readinessPercent > 0) return t('dashboard.copy81');
      return t('dashboard.copy82');
    },

    selectedTrackReadinessText() {
      const coverage = this.selectedTrackCoverage;
      const label = this.uiText(this.selectedTrack?.label || t('dashboard.direction'));
      if (!coverage) return t('dashboard.copy83', { v0: label });
      if (coverage.publishedCount > 0) {
        return t('dashboard.copy84', { v0: label, v1: coverage.publishedCount, v2: coverage.requiredCount });
      }
      if (coverage.pendingCount > 0) {
        return t('dashboard.copy85', { v0: label, v1: coverage.pendingCount });
      }
      return t('dashboard.copy86', { v0: label });
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
      return this.selectedModes.find((mode) => mode.id === this.selectedModeId)?.label || t('dashboard.copy60');
    },

    selectedTrackReleaseLabel() {
      const coverage = this.selectedTrackCoverage;
      if (!coverage) return this.selectedModeLabel;
      if (coverage.publishedCount > 0) {
        return t('dashboard.copy87', { v0: coverage.publishedCount });
      }
      return this.selectedModeLabel;
    },

    emptyTrackTitle() {
      return t('dashboard.copy88');
    },

    emptyTrackDesc() {
      return t('dashboard.copy89');
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
      return t('dashboard.copy90', { v0: summary.publishedSlots || 0, v1: summary.requiredSlots || 0 });
    }
  },

  mounted() {
    this.unbindKeyboard = bindLearningKeyboard(this.$refs.keyboardRoot);
  },
  beforeUnmount() {
    this.unbindKeyboard?.();
  },

  onLoad() {
    this.syncTheme();
    this.initLayout();
    this.refreshBankStatus();
    this.hasQuizResume = Boolean(getRecoverableQuizProgress());
    this.ensureNavigationSelection();
    this.preloadPracticeSubPackage();
    uni.$on('themeUpdate', this.syncTheme);
    uni.$on('updateTheme', this.syncTheme);
  },

  onShow() {
    this.syncTheme();
    // 每次切回刷新题库状态（可能在do-quiz中答了题）
    this.syncLoadedBankIds?.();
    this.refreshBankStatus();
    this.hasQuizResume = Boolean(getRecoverableQuizProgress());
    this.ensureNavigationSelection();
  },

  onUnload() {
    uni.$off('themeUpdate', this.syncTheme);
    uni.$off('updateTheme', this.syncTheme);
  },

  onShareAppMessage() {
    return {
      title: t('dashboard.copy91', { v0: BRAND.name }),
      path: '/pages/practice/index'
    };
  },

  methods: {
    t,
    uiText(value) {
      return translateRegisteredText('dashboard', value);
    },
    async startDemo() {
      if (this.startingDemo || this.hasBank || !this.guestDemoEnabled) return;
      this.startingDemo = true;
      try {
        await startGuestDemoPractice();
      } finally {
        this.startingDemo = false;
      }
    },

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
        uni.showToast({ title: t('dashboard.copy92'), icon: 'none' });
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
        this.tabBarStyle = getTabbarSafeAreaStyle();
      } catch (_e) {
        logger.warn('[Practice] layout init failed');
      }
    },

    syncTheme(mode) {
      const resolved = mode || storageService.get('theme_mode', 'light');
      void resolved;
    },

    async openBankDetail(bankId) {
      if (!bankId || this.loadingBankId === bankId) {
        return;
      }

      this.loadingBankId = bankId;
      this.openQuestionBank?.(bankId);
      this.loadingBankId = null;
    },

    goDoQuiz(options = {}) {
      if (options.resume === true && getRecoverableQuizProgress()) {
        safeNavigateTo('/pages/practice-sub/do-quiz?resume=true');
        return;
      }
      if (this.selectedModeId === 'weakness') {
        safeNavigateTo('/pages/mistake/index?mode=review');
        return;
      }
      this.refreshBankStatus?.();
      if (!this.hasBank) {
        toast.info(t('dashboard.copy93'));
        return;
      }
      const query = this.selectedModeId === 'timed_sprint' ? '?mode=timed_sprint' : '';
      safeNavigateTo(`/pages/practice-sub/do-quiz${query}`);
    },

    goSmartReview() {
      // 现行复习由可靠错题与到期任务选择，不用旧自评推断复习队列。
      safeNavigateTo('/pages/mistake/index?mode=review');
    },

    trainingStatusLabel(status) {
      if (status === 'ready') return t('dashboard.copy94');
      if (status === 'pending') return t('dashboard.copy65');
      if (status === 'review') return t('dashboard.copy95');
      return t('dashboard.copy96');
    }
  }
};
</script>
