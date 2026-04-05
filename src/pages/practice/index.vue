<template>
  <view id="e2e-practice-root" class="practice-container" :class="{ 'dark-mode': isDark }">
    <!-- 微信隐私保护弹窗 -->
    <PrivacyPopup />
    <!-- 顶部导航 -->
    <view class="top-nav apple-glass">
      <text class="nav-title"> 刷题中心 </text>
      <view class="nav-actions">
        <!-- 移除垃圾桶图标，避免与微信原生胶囊按钮重叠 -->
      </view>
    </view>

    <!-- 骨架屏加载状态 -->
    <!-- #ifdef APP-PLUS -->
    <view v-if="isPageLoading" class="skeleton-container">
      <view class="skeleton-status-card skeleton-animate" />
      <view class="skeleton-actions">
        <view class="skeleton-btn skeleton-animate" />
        <view class="skeleton-btn skeleton-animate" />
      </view>
      <view class="skeleton-import-card skeleton-animate" />
      <view class="skeleton-menu">
        <view v-for="i in 5" :key="i" class="skeleton-menu-item skeleton-animate" />
      </view>
    </view>
    <!-- #endif -->
    <!-- #ifndef APP-PLUS -->
    <!-- #ifndef APP-NVUE -->
    <transition name="skeleton-fade">
      <view v-if="isPageLoading" class="skeleton-container">
        <view class="skeleton-status-card skeleton-animate" />
        <view class="skeleton-actions">
          <view class="skeleton-btn skeleton-animate" />
          <view class="skeleton-btn skeleton-animate" />
        </view>
        <view class="skeleton-import-card skeleton-animate" />
        <view class="skeleton-menu">
          <view v-for="i in 5" :key="i" class="skeleton-menu-item skeleton-animate" />
        </view>
      </view>
    </transition>
    <!-- #endif -->
    <!-- #ifdef APP-NVUE -->
    <view v-if="isPageLoading" class="skeleton-container">
      <view class="skeleton-status-card skeleton-animate" />
      <view class="skeleton-actions">
        <view class="skeleton-btn skeleton-animate" />
        <view class="skeleton-btn skeleton-animate" />
      </view>
      <view class="skeleton-import-card skeleton-animate" />
      <view class="skeleton-menu">
        <view v-for="i in 5" :key="i" class="skeleton-menu-item skeleton-animate" />
      </view>
    </view>
    <!-- #endif -->
    <!-- #endif -->

    <!-- 状态卡片 -->
    <view v-if="!isPageLoading" class="status-card apple-glass-card" :class="{ 'empty-state': !hasBank }">
      <!-- 有题库状态 -->
      <view v-if="hasBank" class="status-content">
        <view class="status-icon">
          <BaseIcon name="books" :size="48" class="icon-image" />
        </view>
        <view class="status-info">
          <view class="status-title"> 题库就绪 </view>
          <view class="status-desc"> 当前已收录 {{ totalQuestions }} 道真题 </view>
        </view>
        <view class="status-actions">
          <view class="manage-btn apple-glass-pill" @tap="showQuizManage">
            <BaseIcon name="settings" :size="28" class="manage-icon-img" />
            <text class="manage-text"> 题库管理 </text>
          </view>
        </view>
      </view>

      <!-- 空状态 - 居中显示 -->
      <view v-else class="empty-state-content" @tap="chooseImportSource">
        <view class="empty-icon">
          <BaseIcon name="books" :size="64" />
        </view>
        <view class="empty-title"> 题库空空如也 </view>
        <view class="empty-desc"> 导入学习资料，智能为您智能生成专属题库 </view>
        <view class="empty-action apple-cta">
          <BaseIcon name="upload" :size="18" />
          <text class="action-text"> 点击导入资料 </text>
        </view>
      </view>
    </view>

    <!-- 学习数据统计卡片 -->
    <LearningStatsCard
      v-if="hasBank && !isPageLoading"
      :today-questions="todayQuestions"
      :today-goal="todayGoal"
      :current-streak="currentStreak"
      :weekly-accuracy="weeklyAccuracy"
      :weak-points-count="weakPointsCount"
      :unlocked-achievements="unlockedAchievements"
      @open-goal-setting="openGoalSetting"
      @go-mistake="goMistake"
      @show-achievement="showAchievementModal = true"
    />

    <!-- AI 今日推荐训练 — 零决策一键开始 -->
    <view v-if="hasBank && !isPageLoading && aiRecommendTopic" class="ai-recommend-card" @tap="startAIRecommend">
      <view class="ai-recommend-badge">
        <text class="ai-recommend-badge-text">AI 推荐</text>
      </view>
      <view class="ai-recommend-body">
        <text class="ai-recommend-title">{{ aiRecommendTopic.title }}</text>
        <text class="ai-recommend-reason">{{ aiRecommendTopic.reason }}</text>
      </view>
      <view class="ai-recommend-action">
        <text class="ai-recommend-btn-text">一键开始</text>
      </view>
    </view>

    <!-- 题库生成进度条 -->
    <GenerationProgressBar
      v-if="isGeneratingQuestions && !isPageLoading"
      :progress="generationProgress"
      :file-name="fileName"
      :generated-question-count="getGeneratedQuestionCount()"
      @pause="pauseGeneration"
    />

    <!-- 主要操作区 -->
    <view v-if="!isPageLoading" class="main-actions">
      <!-- 开始刷题按钮 - ✅ F022: 添加加载状态和点击反馈 -->
      <button
        v-if="hasBank"
        id="e2e-practice-start-btn"
        class="primary-btn apple-cta"
        :class="{ 'btn-loading': isNavigating }"
        :disabled="isNavigating"
        @tap="goPractice"
      >
        <view v-if="isNavigating" class="btn-spinner" />
        <!-- 卡通火箭图标替代装饰性 BaseIcon -->
        <image
          v-else
          class="feature-cartoon-icon btn-icon-img"
          src="/static/icons/rocket-launch.png"
          mode="aspectFit"
        />
        <text class="btn-text">
          {{ isNavigating ? '加载中...' : '开始刷题' }}
        </text>
      </button>

      <!-- PK对战入口 - ✅ F022: 添加加载状态和点击反馈 -->
      <button
        v-if="hasBank"
        id="e2e-practice-battle-btn"
        class="secondary-btn apple-glass-pill"
        :class="{ 'btn-loading': isNavigating }"
        :disabled="isNavigating"
        @tap="goBattle"
      >
        <view v-if="isNavigating" class="btn-spinner" />
        <!-- 卡通图标替代装饰性 BaseIcon -->
        <image
          v-else
          class="feature-cartoon-icon btn-icon-img"
          src="/static/icons/crossed-swords.png"
          mode="aspectFit"
        />
        <text class="btn-text"> PK 对战 </text>
      </button>

      <!-- Phase 3-7: AI智能推题入口 -->
      <button
        v-if="hasBank"
        class="secondary-btn apple-glass-pill"
        :class="{ 'btn-loading': isLoadingRecommend }"
        :disabled="isLoadingRecommend"
        @tap="goSmartRecommend"
      >
        <view v-if="isLoadingRecommend" class="btn-spinner" />
        <text class="btn-text">{{ isLoadingRecommend ? '分析中...' : 'AI 推题' }}</text>
      </button>

      <!-- Phase 3-3: 考研题库入口 -->
      <button class="secondary-btn apple-glass-pill" @tap="goQuestionBank">
        <text class="btn-text"> 考研题库 </text>
      </button>

      <!-- 导入资料卡片 -->
      <view
        id="e2e-practice-import-card"
        class="import-card apple-glass-card"
        :class="{ 'import-loading': isUploadingFile }"
        @tap="chooseImportSource"
      >
        <view class="import-icon">
          <BaseIcon v-if="!isUploadingFile" name="upload" :size="32" />
          <view v-else class="import-spinner" />
        </view>
        <view class="import-info">
          <view class="import-title">
            {{ isUploadingFile ? '正在读取文件...' : '导入学习资料' }}
          </view>
          <view class="import-desc">
            {{ isUploadingFile ? fileName : '智能分析 · 即刻出题' }}
          </view>
        </view>
        <view class="import-arrow">
          <BaseIcon v-if="!isUploadingFile" name="chevron-right" :size="24" class="arrow" />
        </view>
      </view>
    </view>

    <PauseBanner :visible="isPaused" @resume="resumeGeneration" />

    <!-- 功能菜单 -->
    <view v-if="!isPageLoading" class="feature-menu apple-group-card">
      <!-- 文件管理 -->
      <view id="e2e-practice-menu-file-manager" class="menu-item" @tap="goFileManager">
        <view class="menu-icon">
          <BaseIcon name="folder" :size="44" class="menu-icon-img" />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 文件管理 </view>
        </view>
        <view class="menu-arrow">
          <BaseIcon name="chevron-right" :size="24" class="arrow" />
        </view>
      </view>

      <!-- 智能导师 -->
      <view id="e2e-practice-menu-ai-tutor" class="menu-item" @tap="goAITutor">
        <view class="menu-icon">
          <!-- 卡通图标替代装饰性 BaseIcon -->
          <image class="feature-cartoon-icon" src="/static/icons/ai-chat.png" mode="aspectFit" />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 智能导师 </view>
        </view>
        <view class="menu-arrow">
          <BaseIcon name="chevron-right" :size="24" class="arrow" />
        </view>
      </view>

      <!-- 错题本 -->
      <view id="e2e-practice-menu-mistake" class="menu-item" @tap="goMistake">
        <view class="menu-icon">
          <BaseIcon name="error" :size="44" class="menu-icon-img" />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 错题本 </view>
        </view>
        <view class="menu-arrow">
          <BaseIcon name="chevron-right" :size="24" class="arrow" />
        </view>
      </view>

      <!-- ✅ P1: 错题重练入口 -->
      <view v-if="mistakeCount > 0" class="menu-item mistake-review" @tap="goMistakeReview">
        <view class="menu-icon">
          <!-- 卡通星标图标替代装饰性 BaseIcon -->
          <image class="feature-cartoon-icon" src="/static/icons/star-badge.png" mode="aspectFit" />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 错题重练 </view>
          <view class="menu-subtitle"> {{ mistakeCount }} 道错题待巩固 </view>
        </view>
        <view class="menu-arrow">
          <BaseIcon name="chevron-right" :size="24" class="arrow" />
        </view>
      </view>

      <!-- 排行榜 -->
      <view id="e2e-practice-menu-rank" class="menu-item" @tap="goRank">
        <view class="menu-icon">
          <!-- 卡通图标替代装饰性 BaseIcon -->
          <image class="feature-cartoon-icon" src="/static/icons/trophy-cup.png" mode="aspectFit" />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 学霸排行榜 </view>
        </view>
        <view class="menu-arrow">
          <BaseIcon name="chevron-right" :size="24" class="arrow" />
        </view>
      </view>

      <!-- 学习进度 -->
      <view id="e2e-practice-menu-study-detail" class="menu-item" @tap="goToStudyDetail">
        <view class="menu-icon">
          <BaseIcon name="check" :size="44" class="menu-icon-img" />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 总学习进度 </view>
        </view>
        <view class="progress-info">
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: progressPercent + '%' }" />
          </view>
          <text class="progress-text"> {{ progressPercent }}% </text>
        </view>
      </view>

      <!-- ✅ P2: 收藏夹管理入口 -->
      <view v-if="favoriteCount > 0" class="menu-item" @tap="goFavorites">
        <view class="menu-icon">
          <!-- 卡通书签图标替代装饰性 BaseIcon -->
          <image class="feature-cartoon-icon" src="/static/icons/bookmark-save.png" mode="aspectFit" />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 我的收藏 </view>
          <view class="menu-subtitle-normal"> {{ favoriteCount }} 道题目 </view>
        </view>
        <view class="menu-arrow">
          <BaseIcon name="chevron-right" :size="24" class="arrow" />
        </view>
      </view>

      <!-- Anki 导出 -->
      <view class="menu-item" @tap="exportAnki">
        <view class="menu-icon">
          <BaseIcon name="download" :size="36" />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 导出 Anki 牌组 </view>
          <view class="menu-subtitle-normal"> 导出为 .apkg 文件 </view>
        </view>
        <view class="menu-arrow">
          <BaseIcon name="chevron-right" :size="24" class="arrow" />
        </view>
      </view>

      <!-- ✅ P1: 练习模式入口 -->
      <view id="e2e-practice-menu-modes" class="menu-item" @tap="showPracticeModes">
        <view class="menu-icon">
          <BaseIcon name="target" :size="36" />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 练习模式 </view>
          <view class="menu-subtitle-normal"> 专项突破 · 限时训练 </view>
        </view>
        <view class="menu-arrow">
          <BaseIcon name="chevron-right" :size="24" class="arrow" />
        </view>
      </view>
    </view>

    <!-- 智能加载遮罩 -->
    <AiGenerationOverlay
      :visible="showMask"
      :file-name="fileName"
      :generated-count="generatedCount"
      :total-questions-limit="totalQuestionsLimit"
      :batch-question-count="batchQuestionCount"
      :current-soup="currentSoup"
      @pause="pauseGeneration"
    />

    <!-- 极速体验弹窗 -->
    <SpeedReadyModal :visible="showSpeedModal" @start="closeSpeedModalAndPlay" />

    <!-- 题库管理弹窗 -->
    <QuizManageModal
      :visible="showQuizManageModal"
      :total-questions="totalQuestions"
      @close="closeQuizManage"
      @clear="clearQuizBank"
    />

    <!-- ✅ 检查点2.2：断点恢复弹窗 -->
    <ResumePracticeModal
      :visible="showResumeModal"
      :draft-info="draftInfo"
      type="quiz"
      @resume="handleResumePractice"
      @restart="handleRestartPractice"
    />

    <!-- 学习目标设置弹窗 -->
    <GoalSettingModal
      :visible="showGoalSettingModal"
      :current-goal="todayGoal"
      @close="showGoalSettingModal = false"
      @saved="onGoalSaved"
    />

    <!-- 成就展示弹窗 -->
    <AchievementModal
      :visible="showAchievementModal"
      :unlocked-achievements="unlockedAchievements"
      :all-achievements="allAchievements"
      @close="showAchievementModal = false"
    />

    <!-- 练习模式选择弹窗 -->
    <PracticeModesModal
      :visible="showPracticeModesModal"
      :modes="practiceModes"
      @close="showPracticeModesModal = false"
      @select="selectPracticeMode"
    />

    <!-- 底部导航栏 -->
    <CustomTabbar :is-dark="isDark" />
  </view>
</template>

<script>
import { toast } from '@/utils/toast.js';
import { safeImport } from '@/utils/helpers/safe-import.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
// ✅ [BUG-FIX] defineAsyncComponent 在微信小程序中不生成 usingComponents 注册，
// 导致组件无法渲染。全部改为静态 import。
import ResumePracticeModal from '@/components/common/ResumePracticeModal.vue';
import GoalSettingModal from '@/components/business/practice/GoalSettingModal.vue';
import AchievementModal from '@/components/business/practice/AchievementModal.vue';
import PracticeModesModal from '@/components/business/practice/PracticeModesModal.vue';
import QuizManageModal from '@/components/business/practice/QuizManageModal.vue';
import SpeedReadyModal from '@/components/business/practice/SpeedReadyModal.vue';
import LearningStatsCard from '@/components/business/practice/LearningStatsCard.vue';
import GenerationProgressBar from '@/components/business/practice/GenerationProgressBar.vue';
import AiGenerationOverlay from '@/components/business/practice/AiGenerationOverlay.vue';
import PauseBanner from '@/components/business/practice/PauseBanner.vue';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { storageService } from '@/services/storageService.js';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import { QUOTE_LIBRARY } from '@/config/home-data.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';
import { getFavorites } from '@/utils/favorite/question-favorite.js';
// adaptive-learning-engine.js — 动态导入减小主包体积（18KB）
// study.api.js 动态导入 — 避免拖进主包
// learning-analytics 动态导入 — 避免 16KB 拖进主包
// ✅ 检查点2.2：导入草稿检测器
import { detectUnfinishedPractice, clearDraft } from '@/utils/practice/draft-detector.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
// ✅ 2.1: 导航逻辑提取为 composable，减少主组件方法数量
import { ref } from 'vue';
import { usePracticeNavigation } from '@/composables/usePracticeNavigation.js';
// useReviewStore — 仅在用户点击时需要，改为动态导入减小主包体积
// ✅ [D002重构] 题库状态管理和动态 mixin 加载
import { useBankStatus } from '@/composables/useBankStatus.js';
import { useDynamicMixin } from '@/composables/useDynamicMixin.js';

export default {
  components: {
    PrivacyPopup,
    BaseIcon,
    CustomTabbar,
    ResumePracticeModal,
    GoalSettingModal,
    AchievementModal,
    PracticeModesModal,
    QuizManageModal,
    LearningStatsCard,
    GenerationProgressBar,
    AiGenerationOverlay,
    SpeedReadyModal,
    PauseBanner
  },
  // ✅ 2.1: 导航逻辑提取为 composable
  setup() {
    // ✅ [D002重构] 题库状态管理由 composable 提供
    const bankStatus = useBankStatus();
    const { hasBank, totalQuestions, progressPercent, isPageLoading, isGeneratingQuestions } = bankStatus;
    const mistakeCount = ref(0);

    const {
      isNavigating,
      goPractice,
      goBattle,
      goMistakeReview,
      goFileManager,
      goAITutor,
      goMistake,
      goRank,
      goToStudyDetail,
      goFavorites
    } = usePracticeNavigation({ hasBank, totalQuestions, mistakeCount });

    // ✅ [D002重构] 分包动态加载由 composable 提供
    const dynamicMixin = useDynamicMixin();

    return {
      hasBank,
      totalQuestions,
      progressPercent,
      isPageLoading,
      isGeneratingQuestions,
      mistakeCount,
      isNavigating,
      goPractice,
      goBattle,
      goMistakeReview,
      goFileManager,
      goAITutor,
      goMistake,
      goRank,
      goToStudyDetail,
      goFavorites,
      // ✅ [D002重构] 题库状态方法
      refreshBankStatus: bankStatus.refreshBankStatus,
      _refreshBankWithData: bankStatus.refreshBankWithData,
      _checkGenerationWithData: bankStatus.checkGenerationWithData,
      // ✅ [D002重构] 动态 mixin 方法
      _dynamicMixin: dynamicMixin,
      dynamicMethodsCache: dynamicMixin.dynamicMethodsCache
    };
  },
  data() {
    return {
      // 页面状态（hasBank, totalQuestions, mistakeCount, progressPercent,
      //   isPageLoading, isGeneratingQuestions 已由 setup() composable 提供）
      isDark: false,

      // 智能引擎状态
      fileName: '',
      fullFileContent: '',
      readOffset: 0,
      chunkSize: 1000,
      generatedCount: 0,
      totalQuestionsLimit: 10,
      isLooping: false,
      isPaused: false,
      showMask: false,
      showSpeedModal: false,
      isRequestInFlight: false,
      batchQuestionCount: 5,
      uploadHistoryKey: 'imported_files',
      currentUploadSource: '',
      currentUploadId: '',
      bankSizeAtGenStart: 0,
      isUploadingFile: false,

      // 题库生成进度
      generationProgress: 0,
      progressTimer: null,
      showQuizManageModal: false,

      // ✅ 检查点2.2：断点恢复弹窗状态
      showResumeModal: false,
      draftInfo: null,

      // Phase 3-7: AI推题加载状态
      isLoadingRecommend: false,
      // AI 推荐今日训练的知识点
      aiRecommendTopic: null,

      // ✅ P0-2: 学习数据统计
      todayQuestions: 0,
      todayGoal: 20,
      currentStreak: 0,
      weeklyAccuracy: 0,
      weakPointsCount: 0,

      // ✅ P1: 学习目标设置弹窗
      showGoalSettingModal: false,

      // ✅ P2: 成就系统
      unlockedAchievements: [],
      allAchievements: [],
      showAchievementModal: false,

      // ✅ P2: 收藏数量
      favoriteCount: 0,

      // ✅ P1: 练习模式
      showPracticeModesModal: false,
      practiceModes: [],

      // 励志语录（从配置文件加载）
      currentSoup: '',
      soupList: QUOTE_LIBRARY.map((q) => q.text),
      soupTimer: null,

      // ✅ [D002重构] dynamicMethodsCache 已由 useDynamicMixin composable 提供
      subPackageLoaded: false
    };
  },
  // 错误边界：捕获子组件运行时错误，防止整个页面白屏
  errorCaptured(err, instance, info) {
    logger.error('[刷题] 子组件运行时错误:', err?.message || err, '| 来源:', info);
    return false;
  },
  async onShow() {
    // 原生 tabBar 已移除，无需隐藏
    // F005: 通知 CustomTabbar 重新检测路由
    uni.$emit('tabbarRouteUpdate');

    // 每次显示页面时重新读取主题状态
    this.isDark = initTheme();
    logger.log('[practice] onShow 刷新主题:', this.isDark);

    // E005: 批量读取 storage，使用 nextTick 释放主线程让 UI 先渲染
    let bankData = [];
    let userAnswers = {};
    let importedFiles = [];
    try {
      // 先让 UI 骨架屏渲染出来，再读取大数据
      await new Promise((resolve) => setTimeout(resolve, 0));
      bankData = storageService.get('v30_bank', []);
      userAnswers = storageService.get('v30_user_answers', {});
      importedFiles = storageService.get('imported_files', []);
    } catch (e) {
      logger.error('[practice] onShow 读取存储失败:', e);
    }

    // 关键路径：题库状态（UI 需要立即展示）
    this._refreshBankWithData(bankData, userAnswers);
    this._checkGenerationWithData(importedFiles, {
      isLooping: this.isLooping,
      startProgressTimer: () => this.startProgressTimer(),
      progressTimer: this.progressTimer
    });

    // 检查是否有来自其他页面的待处理搜索（tabBar 页面无法通过 query 传参）
    try {
      const pendingSearch = storageService.get('_pendingSearch');
      if (pendingSearch && pendingSearch.keyword && Date.now() - pendingSearch.timestamp < 30000) {
        storageService.remove('_pendingSearch');
        // 延迟执行搜索，等 UI 渲染完成
        setTimeout(() => {
          this._searchBankByKeyword(pendingSearch.keyword);
        }, 300);
      } else if (pendingSearch) {
        storageService.remove('_pendingSearch'); // 过期清理
      }
    } catch (e) {
      logger.warn('[practice] 读取待处理搜索失败:', e);
    }

    // E005: 延迟非关键读取，让 UI 先渲染
    this.hydrateMainPackageStats();

    // ✅ P1-3: 等待 mixin 加载完成后再调用 mixin 方法，避免竞态
    setTimeout(async () => {
      try {
        const mistakeBook = storageService.get('mistake_book', []);
        this.mistakeCount = mistakeBook.length;
        this.checkUnfinishedPractice();
        // 等待 mixin 就绪后再调用其方法
        if (this._mixinReady) {
          await this._mixinReady.catch(() => undefined);
        }

        const settled = await Promise.allSettled([
          Promise.resolve().then(() => this.loadLearningStats()),
          Promise.resolve().then(() => this.loadFavoriteCount()),
          Promise.resolve().then(() => this.loadAIRecommend())
        ]);
        const failedTasks = settled.filter((item) => item.status === 'rejected');
        if (failedTasks.length > 0) {
          logger.warn(
            '[practice] 页面恢复时部分统计加载失败:',
            failedTasks.map((item) => item.reason)
          );
        }
      } catch (e) {
        logger.error('[practice] onShow 恢复统计失败:', e);
      }
    }, 50);

    // 恢复后台生成
    if (this.isLooping && this.generatedCount < this.totalQuestionsLimit && !this.isRequestInFlight) {
      setTimeout(async () => {
        try {
          if (this._mixinReady) {
            await this._mixinReady.catch(() => undefined);
          }
          await Promise.resolve(this.generateNextBatch());
        } catch (e) {
          logger.error('[practice] 恢复后台生成失败:', e);
        }
      }, 500);
    }
  },

  // [F2-FIX] 微信分享配置
  onShareAppMessage() {
    return {
      title: '智能刷题 - Exam-Master 考研备考',
      path: '/pages/practice/index',
      imageUrl: '/static/images/app-share-cover.png'
    };
  },

  onLoad() {
    // 初始化主题
    this.isDark = initTheme();
    logger.log('[practice] 🎨 初始化主题:', this.isDark);

    // 初始化动态方法容器
    this.dynamicMethodsCache = Object.create(null);

    // 监听全局主题更新事件（仅注册一次）
    onThemeUpdate((mode) => {
      this.isDark = mode === 'dark';
      logger.log('[practice] 🎨 主题更新:', mode, 'isDark:', this.isDark);
    });

    // ✅ 注入智能生成与学习统计 mixin 方法
    // ✅ P1-3: 保存 Promise，onShow 可等待加载完成后再调用 mixin 方法
    this._mixinReady = this._loadAIGenerationMixin();
  },
  onUnload() {
    // 刷新所有防抖待写入数据，确保不丢失
    storageService.flushPendingWrites();
    // 清理定时器和事件监听
    if (this.soupTimer) {
      clearInterval(this.soupTimer);
      this.soupTimer = null;
    }
    offThemeUpdate();
  },
  methods: {
    async _invokeDynamicMethod(methodName, args = [], options = {}) {
      const { silent = false } = options;

      const cached = this.dynamicMethodsCache?.[methodName];
      if (typeof cached === 'function') {
        return cached(...args);
      }

      if (this._mixinReady) {
        try {
          await this._mixinReady;
        } catch (e) {
          logger.warn(`[practice] 等待动态方法 ${methodName} 加载失败:`, e);
        }
      }

      const loaded = this.dynamicMethodsCache?.[methodName];
      if (typeof loaded === 'function') {
        return loaded(...args);
      }

      if (!silent) {
        toast.info('功能初始化失败，请稍后重试');
      }
      return undefined;
    },

    // ✅ [D002重构] refreshBankStatus, _refreshBankWithData, _checkGenerationWithData
    // 已由 useBankStatus composable 提供（setup 返回）

    async hydrateMainPackageStats() {
      try {
        const favorites = getFavorites();
        this.favoriteCount = Array.isArray(favorites) ? favorites.length : 0;
      } catch (e) {
        logger.warn('[practice] 预加载收藏统计失败:', e);
      }

      try {
        const { getLearningStats, getWeakKnowledgePoints } = await safeImport(
          import('@/utils/learning/adaptive-learning-engine.js')
        );
        const stats = getLearningStats();
        const weakPoints = getWeakKnowledgePoints();
        const todayQuestions = Number(stats.todayQuestions || 0);
        const weeklyAccuracy = Number(stats.overallAccuracy || 0);

        this.todayQuestions = Number.isFinite(todayQuestions) ? todayQuestions : this.todayQuestions;
        this.weeklyAccuracy = Number.isFinite(weeklyAccuracy) ? weeklyAccuracy : this.weeklyAccuracy;
        this.weakPointsCount = Array.isArray(weakPoints) ? weakPoints.length : this.weakPointsCount;

        const mod = await safeImport(import('../practice-sub/utils/learning-analytics.js'));
        const getStreakData = mod.getStreakData || mod.default?.getStreakData;
        const streakData = getStreakData();
        const currentStreak = Number(streakData?.currentStreak || 0);
        this.currentStreak = Number.isFinite(currentStreak) ? currentStreak : this.currentStreak;
      } catch (e) {
        logger.warn('[practice] 预加载学习统计失败:', e);
      }
    },

    // ✅ [D002重构] 题库状态管理已由 useBankStatus composable 提供

    /**
     * 在本地题库中搜索匹配关键词的题目
     * 匹配题目的 question/answer/options 字段，找到后跳转到答题页
     */
    _searchBankByKeyword(keyword) {
      if (!keyword || !this.hasBank) {
        toast.info(this.hasBank ? '搜索关键词为空' : '请先导入题库');
        return;
      }

      const bank = storageService.get('v30_bank', []);
      const kw = keyword.toLowerCase().substring(0, 50);

      // 在题目、选项、解析中搜索关键词
      const matched = bank.filter((q) => {
        const text = [
          q.question || q.title || '',
          q.answer || '',
          q.analysis || q.explanation || '',
          ...(Array.isArray(q.options)
            ? q.options.map((o) => (typeof o === 'string' ? o : o.text || o.label || ''))
            : [])
        ]
          .join(' ')
          .toLowerCase();
        return text.includes(kw);
      });

      if (matched.length === 0) {
        toast.info(`未找到与"${keyword.substring(0, 10)}"相关的题目`);
        return;
      }

      // 将搜索结果存入临时存储，答题页读取
      storageService.save('v30_search_result', matched);
      toast.success(`找到 ${matched.length} 道相关题目`);

      setTimeout(() => {
        safeNavigateTo('/pages/practice-sub/do-quiz?mode=search');
      }, 800);
    },

    // ==================== 页面导航（由 usePracticeNavigation composable 提供）====================
    // goPractice, goBattle, goMistakeReview, goFileManager, goAITutor,
    // goMistake, goRank, goToStudyDetail, goFavorites, isNavigating

    // ✅ 检查点2.2：检测未完成的练习
    checkUnfinishedPractice() {
      const draft = detectUnfinishedPractice();
      if (draft && draft.currentIndex > 0) {
        this.draftInfo = draft;
        this.showResumeModal = true;
        logger.log('[practice] 📝 检测到未完成的练习:', draft);
      }
    },

    // ✅ 检查点2.2：处理恢复练习
    handleResumePractice(draftInfo) {
      this.showResumeModal = false;
      logger.log('[practice] ▶️ 恢复练习:', draftInfo);
      // 跳转到答题页面，答题页面会自动恢复进度
      safeNavigateTo('/pages/practice-sub/do-quiz');
    },

    // ✅ 检查点2.2：处理重新开始
    handleRestartPractice() {
      this.showResumeModal = false;
      clearDraft('quiz');
      logger.log('[practice] 🔄 重新开始练习');
      safeNavigateTo('/pages/practice-sub/do-quiz');
    },

    // goBattle 由 usePracticeNavigation composable 提供

    // goFileManager, goAITutor, goMistake, goRank, goToStudyDetail 由 usePracticeNavigation composable 提供

    // ==================== 学习数据与统计（由分包 mixin 动态注入）====================
    // loadLearningStats, loadTodayGoal, loadAchievements, openGoalSetting,
    // onGoalSaved, loadFavoriteCount, showPracticeModes, selectPracticeMode
    // 在 _loadLearningStatsMixin 加载前提供占位
    async loadLearningStats() {
      return this._invokeDynamicMethod('loadLearningStats', [], { silent: true });
    },
    async loadFavoriteCount() {
      return this._invokeDynamicMethod('loadFavoriteCount', [], { silent: true });
    },

    // ✅ P1: goMistakeReview 由 usePracticeNavigation composable 提供

    // ✅ P2: goFavorites 由 usePracticeNavigation composable 提供

    // Anki 导出（使用 practice.api.js 的封装函数）
    async exportAnki() {
      try {
        toast.loading('导出中...');
        const ankiMod = await safeImport(import('@/services/api/domains/practice.api.js'));
        const ankiExport = ankiMod.exportAnki || ankiMod.default?.exportAnki;
        const res = await ankiExport('我的考研题库');
        toast.hide();
        if (res.code === 0 && res.data?.fileData) {
          // #ifdef MP-WEIXIN
          const fs = uni.getFileSystemManager();
          const filePath = `${wx.env.USER_DATA_PATH}/${res.data.fileName || 'export.apkg'}`;
          fs.writeFile({
            filePath,
            data: res.data.fileData,
            encoding: 'base64',
            success: () => {
              uni.shareFileMessage({
                filePath,
                success: () => toast.success('导出成功'),
                fail: () => toast.success('已保存')
              });
            },
            fail: () => toast.info('保存失败')
          });
          // #endif
          // #ifndef MP-WEIXIN
          toast.success('导出成功');
          // #endif
        } else {
          toast.info(res.message || '导出失败');
        }
      } catch (_e) {
        toast.hide();
        toast.info('导出失败');
      }
    },

    // Phase 3-3: 考研题库入口
    goQuestionBank() {
      safeNavigateTo('/pages/practice-sub/question-bank');
    },

    // AI 今日推荐训练 — 异步加载薄弱知识点
    async loadAIRecommend() {
      try {
        const smartStudyMod = await safeImport(import('@/services/api/domains/smart-study.api.js'));
        const analyzeMastery = smartStudyMod.analyzeMastery || smartStudyMod.default?.analyzeMastery;
        if (typeof analyzeMastery !== 'function') throw new Error('analyzeMastery 未正确加载');
        const result = await analyzeMastery();
        if (result?.data?.mastery?.length > 0) {
          // 找到最薄弱且先修条件已满足的知识点
          const weak = result.data.mastery.find((k) => k.isWeak && k.prerequisitesMet);
          if (weak) {
            this.aiRecommendTopic = {
              title: `今日重点：${weak.knowledgePoint}`,
              reason: `掌握度${weak.mastery}%，${weak.recentTrend === 'declining' ? '且近期在下滑' : '需要重点突破'}`,
              knowledgePoint: weak.knowledgePoint,
              subject: weak.subject
            };
          } else if (result?.data?.summary?.weakestPoint) {
            this.aiRecommendTopic = {
              title: `今日重点：${result.data.summary.weakestPoint}`,
              reason: `${result.data.summary.weakCount}个薄弱点待攻克`,
              knowledgePoint: result.data.summary.weakestPoint
            };
          }
        }
      } catch (err) {
        // 静默降级，不显示推荐卡片
        logger.warn('[practice] AI 推荐加载失败:', err);
      }
    },

    // AI 推荐卡片的一键开始
    startAIRecommend() {
      // 复用已有的 AI 推题逻辑
      this.goSmartRecommend();
    },

    // Phase 3-7: AI智能推题
    async goSmartRecommend() {
      if (this.isLoadingRecommend) return;
      this.isLoadingRecommend = true;
      try {
        const reviewMod = await safeImport(import('@/stores/modules/review.js'));
        const useReviewStore = reviewMod.useReviewStore || reviewMod.default?.useReviewStore;
        const reviewStore = useReviewStore();
        const res = await reviewStore.fetchSmartRecommendations({ count: 10 });
        if (res?.success && res.data?.questions?.length > 0) {
          const formatted = res.data.questions.map((q, i) => ({
            id: q._id || `ai_${i}`,
            question: q.question || q.content || '',
            options: q.options || [],
            answer: q.answer || 'A',
            desc: q.analysis || '',
            category: q.category || '综合',
            type: q.type || '单选',
            difficulty: q.difficulty || 'medium',
            _recommend_reason: q._recommend_reason || '',
            _fromAI: true
          }));
          const storageMod = await safeImport(import('@/services/storageService.js'));
          const storageService = storageMod.default || storageMod.storageService || storageMod;
          storageService.save('v30_temp_practice', formatted);
          safeNavigateTo('/pages/practice-sub/do-quiz?source=ai-recommend&mode=normal');
        } else {
          toast.info(res?.data?.ai_advice || '暂无推荐，请多做几道题');
        }
      } catch (_e) {
        toast.info('推题失败，请稍后重试');
      } finally {
        this.isLoadingRecommend = false;
      }
    },

    // ==================== 动态注入 Mixin 方法（由 useDynamicMixin composable 驱动）====================
    async _loadAIGenerationMixin(retryCount = 0) {
      return this._dynamicMixin.loadAIGenerationMixin(this, retryCount);
    },

    // ==================== 以下方法由分包 mixin 动态注入 ====================
    // chooseImportSource, chooseLocalFile, importFromChat, importFromBaidu,
    // handleUpload, startAI, generateNextBatch, pauseGeneration, resumeGeneration,
    // finishGeneration, clearAll, clearQuizBank, showQuizManage, closeQuizManage,
    // closeSpeedModndPlay, getGeneratedQuestionCount, startProgressTimer,
    // updateGenerationProgress, startSoupRotation, 等

    // 占位方法：在 mixin 加载前提供默认行为
    chooseImportSource() {
      const dynamicMethod = this.dynamicMethodsCache?.chooseImportSource;
      if (typeof dynamicMethod === 'function') {
        return dynamicMethod();
      }

      // 分包方法未就绪时，直接进入导入页，确保点击必有反馈
      safeNavigateTo('/pages/practice-sub/import-data');
      return undefined;
    },
    showQuizManage() {
      return this._invokeDynamicMethod('showQuizManage');
    },
    closeQuizManage() {
      this.showQuizManageModal = false;
    },
    clearQuizBank() {
      return this._invokeDynamicMethod('clearQuizBank');
    },
    clearAll() {
      return this._invokeDynamicMethod('clearAll');
    },
    pauseGeneration() {
      return this._invokeDynamicMethod('pauseGeneration', [], { silent: false });
    },
    resumeGeneration() {
      return this._invokeDynamicMethod('resumeGeneration', [], { silent: false });
    },
    closeSpeedModalAndPlay() {
      const method = this.dynamicMethodsCache?.closeSpeedModalAndPlay;
      if (typeof method === 'function') {
        return method();
      }
      this.showSpeedModal = false;
      this.goPractice();
    },
    startProgressTimer() {
      return this._invokeDynamicMethod('startProgressTimer', [], { silent: true });
    },
    updateGenerationProgress() {
      return this._invokeDynamicMethod('updateGenerationProgress', [], { silent: true });
    },
    startSoupRotation() {
      return this._invokeDynamicMethod('startSoupRotation', [], { silent: true });
    },
    generateNextBatch() {
      return this._invokeDynamicMethod('generateNextBatch', [], { silent: true });
    },
    getGeneratedQuestionCount() {
      const method = this.dynamicMethodsCache?.getGeneratedQuestionCount;
      if (typeof method === 'function') {
        return method();
      }
      return Math.max(0, this.totalQuestions - (this.bankSizeAtGenStart || 0));
    },
    openGoalSetting() {
      return this._invokeDynamicMethod('openGoalSetting');
    },
    onGoalSaved(value) {
      this.todayGoal = value;
      this.showGoalSettingModal = false;
    },
    showPracticeModes() {
      return this._invokeDynamicMethod('showPracticeModes');
    },
    selectPracticeMode(mode) {
      return this._invokeDynamicMethod('selectPracticeMode', [mode]);
    }
  }
};
</script>

<style lang="scss" scoped>
/* ============================================
   多邻国风格刷题页面样式 - Design System 2.0
   模块色: var(--info) 天蓝
   ============================================ */

/* 基础容器 — 暖白背景 */
.practice-container {
  min-height: 100%;
  min-height: 100vh;
  background: var(--background);
  padding: 22rpx;
  /* E008: 使用 safe-area-inset-bottom 适配刘海屏/底部指示条 */
  padding-bottom: calc(140px + constant(safe-area-inset-bottom, 0px));
  padding-bottom: calc(140px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  color: var(--text-secondary);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'SF Pro Text', 'Noto Sans SC', 'Roboto', sans-serif;
}
.practice-container.dark-mode {
  background: var(--bg-page);
  color: var(--text-sub);
}

/* 装饰光斑 */
.practice-container::before,
.practice-container::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  z-index: -1;
  pointer-events: none;
}
.practice-container::before {
  width: 420rpx;
  height: 420rpx;
  right: -150rpx;
  top: 80rpx;
  background: radial-gradient(circle, rgba(28, 176, 246, 0.08) 0%, transparent 70%);
  filter: blur(10rpx);
}
.practice-container::after {
  width: 360rpx;
  height: 360rpx;
  left: -120rpx;
  top: 520rpx;
  background: radial-gradient(circle, rgba(88, 204, 2, 0.06) 0%, transparent 72%);
  filter: blur(10rpx);
}

/* ============================================
   顶部导航 — 加粗标题
   ============================================ */
.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: calc(var(--status-bar-height, 44px) + 6px);
  margin-bottom: 22px;
  padding: 14rpx 18rpx;
  border-radius: 32rpx;
}

.nav-title {
  font-size: 58rpx;
  font-weight: 800;
  letter-spacing: -0.5rpx;
  color: var(--text-primary);
  line-height: 1.2;
}
.dark-mode .nav-title {
  color: var(--text-primary);
}

.nav-actions {
  display: flex;
  /* gap: 12px; -- replaced for Android WebView compat */
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

/* 小程序不支持 :hover，使用 active 替代 */
.icon-btn:active {
  background-color: var(--primary);
  transform: scale(1.05);
}

.icon-btn.danger {
  background-color: var(--danger-light);
}

.icon-btn.danger:active {
  background-color: var(--danger);
}

/* 状态卡片 — 白底卡片 + clean阴影 */
.status-card {
  position: relative;
  overflow: hidden;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 28px;
  padding: 24px;
  margin-bottom: 18px;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  transition: transform 0.15s ease;
}
.status-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6rpx;
  background: linear-gradient(90deg, var(--info), #58cc02);
  border-radius: 0 0 4rpx 4rpx;
}
.status-card:active {
  transform: scale(0.98);
}
.dark-mode .status-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}

/* 空状态样式 */
.status-card.empty-state {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.status-card.empty-state:active {
  transform: scale(0.98);
}
.dark-mode .status-card.empty-state {
  background: rgba(255, 255, 255, 0.06);
}

.empty-state-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 20px;
  width: 100%;
}

.empty-icon {
  margin-bottom: 20px;
  width: 120rpx;
  height: 120rpx;
  border-radius: 30rpx;
  background: rgba(28, 176, 246, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: float 3s ease-in-out infinite;
}

.dark-mode .empty-icon,
.dark-mode .import-icon,
.dark-mode .menu-icon {
  background: rgba(28, 176, 246, 0.15) !important;
}

.dark-mode .empty-icon {
  width: 120rpx;
  height: 120rpx;
  margin: 0 auto 20px;
  border-radius: 30rpx;
  background: rgba(28, 176, 246, 0.15) !important;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0px);
  }

  50% {
    transform: translateY(-10px);
  }
}

.empty-icon-img {
  width: 80px;
  height: 80px;
  object-fit: contain;
  opacity: 0.8;
}

/* Emoji图标样式 - 深色模式自动适配 */
/* ✅ F028: font-size 使用 rpx 相对单位 */
.empty-icon-emoji {
  font-size: 128rpx;
  display: block;
  line-height: 1;
}

.action-icon-emoji {
  font-size: 36rpx;
  display: inline-block;
  line-height: 1;
}

.import-icon-emoji {
  font-size: 64rpx;
  display: block;
  line-height: 1;
}

.empty-title {
  font-size: 42rpx;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 24rpx 0;
  letter-spacing: 0;
}
.dark-mode .empty-title {
  color: var(--text-primary);
}

.empty-desc {
  font-size: 30rpx;
  color: var(--text-secondary);
  margin: 0 0 48rpx 0;
  line-height: 1.6;
  max-width: 280px;
}

/* 空状态操作按钮 — 3D蓝色按钮 */
.empty-action {
  display: flex;
  align-items: center;
  /* gap: 10px; -- replaced for Android WebView compat */
  padding: 12px 28px;
  min-height: 88rpx;
  background: var(--info);
  border-radius: 20rpx;
  border: none;
  box-shadow: 0 6rpx 0 var(--info-dark, #1899d6);
  transition: all 0.1s ease;
}
.empty-action:active {
  transform: translateY(4rpx);
  box-shadow: 0 2rpx 0 var(--info-dark, #1899d6);
}

.action-text {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-inverse);
  letter-spacing: 0.3px;
  margin-left: 10px;
}

.status-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* gap: 12px; -- replaced for Android WebView compat */
}

.status-actions {
  flex-shrink: 0;
  margin-left: 16px;
}

.manage-btn {
  display: flex;
  align-items: center;
  /* gap: 6px; -- replaced for Android WebView compat */
  padding: 10px 18px;
  background: rgba(28, 176, 246, 0.1);
  border-radius: 20rpx;
  border: none;
  transition: all 0.15s ease;
}
.manage-btn:active {
  transform: scale(0.95);
  background: rgba(28, 176, 246, 0.18);
}
.manage-text {
  font-size: 28rpx;
  color: var(--info);
  font-weight: 700;
  margin-left: 6px;
}

.status-icon {
  margin-right: 16px;
  width: 88rpx;
  height: 88rpx;
  border-radius: 22rpx;
  background: rgba(28, 176, 246, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* 图标图片样式 */
.icon-image {
  width: 56px;
  height: 56px;
  object-fit: contain;
}

.manage-icon-img {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.status-icon .emoji {
  font-size: 96rpx;
}

.status-info {
  flex: 1;
}

.status-title {
  font-size: 38rpx;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}
.dark-mode .status-title {
  color: var(--text-primary);
}

.status-desc {
  font-size: 28rpx;
  color: var(--text-secondary);
  margin: 0;
}

/* AI 推荐今日训练卡片 — 紫色AI模块 */
.ai-recommend-card {
  margin: 0 16px 16px;
  padding: 20px;
  border-radius: 24rpx;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
  transition: transform 0.15s ease;
}
.ai-recommend-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6rpx;
  background: linear-gradient(90deg, var(--purple-light, #ce82ff), var(--purple-dark, #9b51e0));
  border-radius: 0 0 4rpx 4rpx;
}
.ai-recommend-card:active {
  transform: scale(0.98);
}
.ai-recommend-badge {
  background: linear-gradient(135deg, var(--purple-light, #ce82ff), var(--purple-dark, #9b51e0));
  padding: 4px 12px;
  border-radius: 12px;
  margin-right: 14px;
  flex-shrink: 0;
}
.ai-recommend-badge-text {
  font-size: 12px;
  font-weight: 800;
  color: var(--text-inverse);
}
.ai-recommend-body {
  flex: 1;
  min-width: 0;
}
.ai-recommend-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  display: block;
}
.dark-mode .ai-recommend-title {
  color: var(--text-primary);
}
.ai-recommend-reason {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  display: block;
}
.ai-recommend-action {
  background: var(--purple-light, #ce82ff);
  padding: 8px 18px;
  border-radius: 16rpx;
  flex-shrink: 0;
  margin-left: 12px;
  box-shadow: 0 4rpx 0 var(--purple, #a855c7);
  transition: all 0.1s ease;
}
.ai-recommend-action:active {
  transform: translateY(2rpx);
  box-shadow: 0 2rpx 0 var(--purple, #a855c7);
}
.ai-recommend-btn-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-inverse);
  white-space: nowrap;
}
.dark-mode .ai-recommend-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}

/* 主要操作区 */
.main-actions {
  display: flex;
  flex-direction: column;
  /* gap: 12px; -- replaced for Android WebView compat */
  margin-bottom: 22px;
}
.main-actions > view + view {
  margin-top: 12px;
}

/* 主要按钮 — 3D蓝色刷题按钮 */
.primary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 12px; -- replaced for Android WebView compat */
  background: var(--info);
  color: var(--text-inverse);
  border: none;
  border-radius: 20rpx;
  padding: 20px 40px;
  font-size: 40rpx;
  font-weight: 800;
  box-shadow: 0 8rpx 0 var(--info-dark, #1899d6);
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  min-height: 96rpx;
  transition: all 0.1s ease;
}
.primary-btn:active {
  transform: translateY(6rpx);
  box-shadow: 0 2rpx 0 var(--info-dark, #1899d6);
}

/* [AUDIT FIX R187] 主按钮暗黑覆盖块冗余(已使用CTA变量) → 移除 */

/* ✅ F022: 按钮加载状态 */
.primary-btn.btn-loading,
.secondary-btn.btn-loading {
  opacity: 0.7;
  pointer-events: none;
}

/* [AUDIT FIX R188] 加载spinner → CSS变量 */
.btn-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: var(--text-inverse, #fff);
  border-radius: 50%;
  animation: btn-spin 0.6s linear infinite;
}

@keyframes btn-spin {
  to {
    transform: rotate(360deg);
  }
}

.btn-icon {
  font-size: 56rpx;
}

/* 按钮图标图片样式 */
.btn-icon-img {
  width: 64rpx;
  height: 64rpx;
  object-fit: contain;
  margin-right: 12px;
}

.menu-icon-img {
  width: 72rpx;
  height: 72rpx;
  object-fit: contain;
}

/* 次要按钮 — 白色3D按钮 */
.secondary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 12px; -- replaced for Android WebView compat */
  background: var(--bg-card);
  color: var(--text-primary);
  border: 2rpx solid rgba(0, 0, 0, 0.08);
  border-radius: 20rpx;
  padding: 20px 40px;
  font-size: 40rpx;
  font-weight: 700;
  box-shadow: 0 6rpx 0 var(--border);
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  min-height: 96rpx;
  transition: all 0.1s ease;
}
.secondary-btn:active {
  transform: translateY(4rpx);
  box-shadow: 0 2rpx 0 var(--border);
}
.dark-mode .secondary-btn {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-inverse);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 6rpx 0 rgba(0, 0, 0, 0.3);
}

.btn-icon {
  font-size: 56rpx;
}

/* 导入资料卡片 — 白底clean风格 */
.import-card {
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 24rpx;
  padding: 20px;
  transition: transform 0.15s ease;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.import-card:active {
  transform: scale(0.98);
}
.dark-mode .import-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}

/* ✅ F026: 文件读取中状态 */
.import-card.import-loading {
  opacity: 0.8;
  pointer-events: none;
  border-color: var(--info);
}

.import-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid rgba(28, 176, 246, 0.2);
  border-top-color: var(--info);
  border-radius: 50%;
  animation: importSpin 0.8s linear infinite;
}

@keyframes importSpin {
  to {
    transform: rotate(360deg);
  }
}

.import-card:hover {
  transform: scale(0.98);
}

.import-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  background: rgba(28, 176, 246, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  flex-shrink: 0;
}

.import-icon .emoji {
  font-size: 64rpx;
}

.import-info {
  flex: 1;
}

.import-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}
.dark-mode .import-title {
  color: var(--text-primary);
}

.import-desc {
  font-size: 28rpx;
  color: var(--text-secondary);
  margin: 0;
}

.import-arrow {
  color: var(--text-secondary);
}

.arrow {
  font-size: 48rpx;
  font-weight: 600;
}

/* 功能菜单 — 白底卡片 + 彩色图标 */
.feature-menu {
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.dark-mode .feature-menu {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}

.menu-item {
  display: flex;
  align-items: center;
  min-height: 96rpx;
  padding: 18px 20px;
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.04);
  transition: background-color 0.15s ease;
}
.menu-item:last-child {
  border-bottom: none;
}
.menu-item:active {
  background-color: rgba(0, 0, 0, 0.02);
}
.dark-mode .menu-item {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
.dark-mode .menu-item:active {
  background-color: rgba(255, 255, 255, 0.04);
}

/* 每个菜单项独立图标色 */
.menu-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
  flex-shrink: 0;
}
/* 文件管理 — 蓝色 */
.menu-item:nth-child(1) .menu-icon {
  background: rgba(28, 176, 246, 0.12);
  color: var(--info);
}
/* 智能导师 — 紫色 */
.menu-item:nth-child(2) .menu-icon {
  background: rgba(206, 130, 255, 0.12);
  color: var(--purple-light, #ce82ff);
}
/* 错题本 — 红色 */
.menu-item:nth-child(3) .menu-icon {
  background: rgba(255, 75, 75, 0.12);
  color: var(--danger);
}
/* 错题重练(动态) / 排行榜 — 橙色 */
.menu-item.mistake-review .menu-icon,
.menu-item:nth-child(4) .menu-icon {
  background: rgba(255, 150, 0, 0.12);
  color: var(--warning);
}
/* 排行榜 — 金色 */
.menu-item:nth-child(5) .menu-icon {
  background: rgba(255, 150, 0, 0.12);
  color: var(--warning);
}
/* 学习进度 — 绿色 */
.menu-item:nth-child(6) .menu-icon {
  background: rgba(88, 204, 2, 0.12);
  color: #58cc02;
}
/* 收藏/Anki/练习模式 — 青色 */
.menu-item:nth-child(7) .menu-icon,
.menu-item:nth-child(8) .menu-icon,
.menu-item:nth-child(9) .menu-icon {
  background: rgba(45, 201, 196, 0.12);
  color: var(--teal, #2dc9c4);
}

.menu-icon .emoji {
  font-size: 56rpx;
}

.menu-info {
  flex: 1;
}

.menu-title {
  font-size: 31rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}
.dark-mode .menu-title {
  color: var(--text-primary);
}

.menu-subtitle {
  font-size: 24rpx;
  color: var(--danger);
  font-weight: 600;
  margin-top: 4px;
}

.menu-subtitle-normal {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 4px;
}

.menu-arrow {
  color: var(--text-secondary);
}

/* 进度条 — 绿色 */
.progress-info {
  display: flex;
  align-items: center;
  /* gap: 12px; -- replaced for Android WebView compat */
}

.progress-bar {
  width: 120px;
  height: 12rpx;
  background-color: rgba(88, 204, 2, 0.15);
  border-radius: 6rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #58cc02;
  border-radius: 6rpx;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 28rpx;
  font-weight: 800;
  color: #58cc02;
  margin-left: 12px;
}

.skeleton-import-card {
  height: 80px;
  border-radius: 16px;
  margin-bottom: 20px;
}

.skeleton-status-card {
  height: 120px;
  border-radius: 16px;
  margin-bottom: 20px;
}

.skeleton-actions {
  display: flex;
  /* gap: 12px; -- replaced for Android WebView compat */
  margin-bottom: 20px;
}

.skeleton-btn {
  flex: 1;
  height: 48px;
  border-radius: 12px;
}

.skeleton-menu {
  display: flex;
  flex-direction: column;
  /* gap: 12px; -- replaced for Android WebView compat */
}

.skeleton-menu-item {
  height: 64px;
  border-radius: 16px;
}

.skeleton-animate {
  background: linear-gradient(90deg, var(--muted) 25%, var(--background) 50%, var(--muted) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}
.dark-mode .skeleton-animate {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.04) 25%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.04) 75%
  );
  background-size: 200% 100%;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* 骨架屏淡出过渡 */
.skeleton-fade-leave-active {
  transition: opacity 0.35s ease-out;
}
.skeleton-fade-leave-to {
  opacity: 0;
}

/* 功能级卡通图标（替代 BaseIcon size 36-79） */
.feature-cartoon-icon {
  width: 80rpx;
  height: 80rpx;
}
</style>
