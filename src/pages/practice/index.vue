<template>
  <LearningShell ref="keyboardRoot" class="yozi-page" active="practice" :title="$t('pages.practice')">
    <scroll-view scroll-y class="main-scroll">
      <view class="practice-hero">
        <view class="practice-intro">
          <text class="practice-title">{{ t('ui.todayPractice') }}</text>
          <text class="section-hint">{{ t('ui.practicePrompt') }}</text>
          <view class="practice-command-row">
            <BaseButton
              class="practice-command primary"
              variant="primary"
              icon="arrow-right"
              @tap="
                hasBank || hasQuizResume || selectedModeId === 'weakness'
                  ? goDoQuiz({ resume: true })
                  : chooseImportSource()
              "
              >{{
                hasQuizResume
                  ? t('ui.resumePractice')
                  : selectedModeId === 'weakness'
                    ? uiText(selectedModeLabel)
                    : t('ui.startPractice')
              }}</BaseButton
            >
            <BaseButton
              v-if="hasQuizResume && (hasBank || selectedModeId === 'weakness')"
              class="practice-new"
              variant="secondary"
              @tap="goDoQuiz"
              >{{ t('ui.newPractice') }}</BaseButton
            >
            <BaseButton variant="secondary" icon="books" @tap="chooseImportSource">{{
              t('dashboard.copy61')
            }}</BaseButton>
          </view>
        </view>
        <YoziMascot pose="point" play="auto" size="medium" />
      </view>
      <view class="section">
        <view class="subject-tabs">
          <BaseChip
            v-for="subject in navigationTree"
            :key="subject.id"
            :model-value="selectedSubject?.id === subject.id"
            @update:model-value="selectSubject(subject.id)"
            >{{ uiText(subject.label) }}</BaseChip
          >
        </view>
        <view v-if="(selectedSubject?.tracks?.length || 0) > 1" class="track-rail">
          <BaseChip
            v-for="track in selectedSubject?.tracks || []"
            :key="track.id"
            :model-value="selectedTrack?.id === track.id"
            @update:model-value="selectTrack(track.id)"
            >{{ uiText(track.label) }}</BaseChip
          >
        </view>
        <text v-if="selectedTrack" class="bank-availability">{{
          t('ui.bankAvailability', {
            name: uiText(selectedTrack.label),
            ready: selectedTrack.slotSummary?.ready || 0,
            total: selectedTrack.yearSlots?.length || 0
          })
        }}</text>
        <view class="mode-row">
          <BaseChip
            v-for="mode in selectedModes"
            :key="mode.id"
            :model-value="selectedModeId === mode.id"
            @update:model-value="selectMode(mode.id)"
            >{{ uiText(mode.label) }}</BaseChip
          >
        </view>
      </view>
      <view v-if="selectedBanks.length" class="bank-list">
        <view v-for="bank in selectedBanks" :key="bank.id" class="card bank-card">
          <view class="bank-info"
            ><text class="bank-name">{{ uiText(bank.name) }}</text></view
          >
          <BaseButton
            :loading="loadingBankId === bank.id"
            :disabled="!!loadingBankId"
            variant="secondary"
            @tap="openBankDetail(bank.id)"
            >{{ t('ui.startPractice') }}</BaseButton
          >
        </view>
      </view>
      <BaseEmpty
        v-else
        :title="emptyTrackTitle"
        show-button
        :button-text="t('ui.choosePaper')"
        @action="chooseImportSource"
      />
      <view class="hero-actions"
        ><BaseButton class="practice-review" variant="quiet" @tap="goSmartReview">{{
          t('dashboard.copy75')
        }}</BaseButton></view
      >
    </scroll-view>
  </LearningShell>
</template>

<script>
import LearningShell from '@/components/business/learning/learning-shell.vue';
import { getTabbarSafeAreaStyle } from '@/utils/core/system.js';
import YoziMascot from '@/components/base/yozi-mascot/yozi-mascot.vue';
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
import { getRecoverableQuizProgress } from '@/composables/useQuizAutoSave.js';

export default {
  components: { LearningShell, YoziMascot, BaseButton, BaseChip, BaseEmpty },

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

<style scoped>
.practice-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--s-5);
  padding: var(--s-8);
}
.practice-intro {
  display: grid;
  gap: var(--s-3);
}
.practice-command-row {
  margin-bottom: 0;
}
.bank-availability {
  display: block;
  margin-block: var(--s-5);
  color: var(--ink-2);
}
.bank-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--s-4);
}
.bank-card .bank-info {
  min-width: 0;
}
@media (max-width: 767px) {
  .practice-hero {
    padding: var(--s-5);
    align-items: flex-start;
  }
  .practice-hero .yozi-mascot {
    width: 80px;
    height: 80px;
  }
  .practice-title {
    font-size: var(--size-title-2);
  }
  .bank-card {
    flex-wrap: wrap;
  }
}
</style>
