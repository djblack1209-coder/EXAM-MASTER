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
          <image
            class="icon-image"
            src="/static/icons/practice/icon-library.png"
            alt=""
            mode="aspectFit"
            :style="isDark ? 'filter: brightness(0) invert(1) opacity(0.9);' : ''"
          />
        </view>
        <view class="status-info">
          <view class="status-title"> 题库就绪 </view>
          <view class="status-desc"> 当前已收录 {{ totalQuestions }} 道真题 </view>
        </view>
        <view class="status-actions">
          <view class="manage-btn apple-glass-pill" @tap="showQuizManage">
            <image
              class="manage-icon-img"
              src="/static/icons/practice/icon-settings.png"
              alt=""
              mode="aspectFit"
              lazy-load
            />
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
        <image v-else class="btn-icon-img" src="/static/icons/practice/icon-book.png" alt="" mode="aspectFit" />
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
        <image v-else class="btn-icon-img" src="/static/icons/practice/icon-battle.png" alt="" mode="aspectFit" />
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
          <text v-if="!isUploadingFile" class="arrow"> › </text>
        </view>
      </view>
    </view>

    <PauseBanner :visible="isPaused" @resume="resumeGeneration" />

    <!-- 功能菜单 -->
    <view v-if="!isPageLoading" class="feature-menu apple-group-card">
      <!-- 文件管理 -->
      <view id="e2e-practice-menu-file-manager" class="menu-item" @tap="goFileManager">
        <view class="menu-icon">
          <image class="menu-icon-img" src="/static/icons/practice/icon-folder.png" alt="" mode="aspectFit" lazy-load />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 文件管理 </view>
        </view>
        <view class="menu-arrow">
          <text class="arrow"> › </text>
        </view>
      </view>

      <!-- 智能导师 -->
      <view id="e2e-practice-menu-ai-tutor" class="menu-item" @tap="goAITutor">
        <view class="menu-icon">
          <image
            class="menu-icon-img"
            src="/static/icons/practice/icon-robot.png"
            alt=""
            mode="aspectFit"
            :style="isDark ? 'filter: brightness(0) invert(1) opacity(0.9);' : ''"
          />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 智能导师 </view>
        </view>
        <view class="menu-arrow">
          <text class="arrow"> › </text>
        </view>
      </view>

      <!-- 错题本 -->
      <view id="e2e-practice-menu-mistake" class="menu-item" @tap="goMistake">
        <view class="menu-icon">
          <image class="menu-icon-img" src="/static/icons/practice/icon-error.png" alt="" mode="aspectFit" lazy-load />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 错题本 </view>
        </view>
        <view class="menu-arrow">
          <text class="arrow"> › </text>
        </view>
      </view>

      <!-- ✅ P1: 错题重练入口 -->
      <view v-if="mistakeCount > 0" class="menu-item mistake-review" @tap="goMistakeReview">
        <view class="menu-icon">
          <BaseIcon name="star" :size="36" />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 错题重练 </view>
          <view class="menu-subtitle"> {{ mistakeCount }} 道错题待巩固 </view>
        </view>
        <view class="menu-arrow">
          <text class="arrow"> › </text>
        </view>
      </view>

      <!-- 排行榜 -->
      <view id="e2e-practice-menu-rank" class="menu-item" @tap="goRank">
        <view class="menu-icon">
          <image
            class="menu-icon-img"
            src="/static/icons/practice/icon-ranking.png"
            alt=""
            mode="aspectFit"
            lazy-load
          />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 学霸排行榜 </view>
        </view>
        <view class="menu-arrow">
          <text class="arrow"> › </text>
        </view>
      </view>

      <!-- 学习进度 -->
      <view id="e2e-practice-menu-study-detail" class="menu-item" @tap="goToStudyDetail">
        <view class="menu-icon">
          <image class="menu-icon-img" src="/static/icons/practice/icon-check.png" alt="" mode="aspectFit" lazy-load />
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
          <BaseIcon name="star" :size="36" />
        </view>
        <view class="menu-info">
          <view class="menu-title"> 我的收藏 </view>
          <view class="menu-subtitle-normal"> {{ favoriteCount }} 道题目 </view>
        </view>
        <view class="menu-arrow">
          <text class="arrow"> › </text>
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
          <text class="arrow"> › </text>
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
          <text class="arrow"> › </text>
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
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
import ResumePracticeModal from '@/components/common/ResumePracticeModal.vue';
import GoalSettingModal from '@/components/business/practice/GoalSettingModal.vue';
import AchievementModal from '@/components/business/practice/AchievementModal.vue';
import PracticeModesModal from '@/components/business/practice/PracticeModesModal.vue';
import QuizManageModal from '@/components/business/practice/QuizManageModal.vue';
import LearningStatsCard from '@/components/business/practice/LearningStatsCard.vue';
import GenerationProgressBar from '@/components/business/practice/GenerationProgressBar.vue';
import AiGenerationOverlay from '@/components/business/practice/AiGenerationOverlay.vue';
import SpeedReadyModal from '@/components/business/practice/SpeedReadyModal.vue';
import PauseBanner from '@/components/business/practice/PauseBanner.vue';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { storageService } from '@/services/storageService.js';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
import { QUOTE_LIBRARY } from '@/config/home-data.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';
import { getFavorites } from '@/utils/favorite/question-favorite.js';
import { getLearningStats, getWeakKnowledgePoints } from '@/utils/learning/adaptive-learning-engine.js';
import { getStreakData as getLearningStreakData } from '@/utils/analytics/learning-analytics.js';
// ✅ 检查点2.2：导入草稿检测器
import { detectUnfinishedPractice, clearDraft } from '@/utils/practice/draft-detector.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
// ✅ 2.1: 导航逻辑提取到 mixin，减少主组件方法数量
import { practiceNavigationMixin } from '@/mixins/practiceNavigationMixin.js';

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
  // ✅ 2.1: 导航逻辑提取到 mixin
  mixins: [practiceNavigationMixin],
  data() {
    return {
      // 页面状态
      hasBank: false,
      totalQuestions: 0,
      progressPercent: 0,
      isDark: false,
      isPageLoading: true, // 页面初始加载状态

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
      bankSizeAtGenStart: 0, // ✅ 1.6: 生成开始时题库大小，用于精确计算进度
      isUploadingFile: false, // ✅ F026: 文件读取中状态

      // 题库生成进度
      isGeneratingQuestions: false,
      generationProgress: 0,
      progressTimer: null,
      showQuizManageModal: false,

      // ✅ 检查点2.2：断点恢复弹窗状态
      showResumeModal: false,
      draftInfo: null,

      // 防重复点击: isNavigating 由 practiceNavigationMixin 提供

      // Phase 3-7: AI推题加载状态
      isLoadingRecommend: false,

      // ✅ P0-2: 学习数据统计
      todayQuestions: 0, // 今日刷题数
      todayGoal: 20, // 今日目标（从学习目标模块读取）
      currentStreak: 0, // 连续学习天数
      weeklyAccuracy: 0, // 本周正确率
      weakPointsCount: 0, // 薄弱知识点数量

      // ✅ P1: 学习目标设置弹窗
      showGoalSettingModal: false,

      // ✅ P1: 错题数量
      mistakeCount: 0,

      // ✅ P2: 成就系统
      unlockedAchievements: [], // 已解锁的成就
      allAchievements: [], // 所有成就
      showAchievementModal: false, // 成就弹窗

      // ✅ P2: 收藏数量
      favoriteCount: 0,

      // ✅ P1: 练习模式
      showPracticeModesModal: false,
      practiceModes: [],

      // 励志语录（从配置文件加载）
      currentSoup: '',
      soupList: QUOTE_LIBRARY.map((q) => q.text),
      soupTimer: null,

      // 分包动态方法缓存（避免“功能加载中”占位方法长期生效）
      dynamicMethodsCache: {},
      subPackageLoaded: false
    };
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
    this._checkGenerationWithData(importedFiles);

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
          Promise.resolve().then(() => this.loadFavoriteCount())
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
      path: '/pages/practice/index'
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
        uni.showToast({ title: '功能初始化失败，请稍后重试', icon: 'none' });
      }
      return undefined;
    },

    async _ensurePracticeSubPackageLoaded() {
      if (this.subPackageLoaded) return;

      // #ifdef MP-WEIXIN
      if (typeof uni.loadSubPackage === 'function') {
        await new Promise((resolve, reject) => {
          uni.loadSubPackage({
            root: 'pages/practice-sub',
            success: () => resolve(true),
            fail: (err) => reject(err)
          });
        });
      }
      // #endif

      this.subPackageLoaded = true;
    },

    _requirePracticeSubpackageModule(modulePath) {
      // #ifdef APP-PLUS
      // App 端所有模块已打包在一起，直接动态 import
      const moduleMap = {
        '../practice-sub/composables/ai-generation-mixin.js': () =>
          import('../practice-sub/composables/ai-generation-mixin.js'),
        '../practice-sub/composables/learning-stats-mixin.js': () =>
          import('../practice-sub/composables/learning-stats-mixin.js')
      };
      const loader = moduleMap[modulePath];
      if (loader) {
        return loader();
      }
      return Promise.reject(new Error(`未知的模块路径: ${modulePath}`));
      // #endif

      // #ifndef APP-PLUS
      return new Promise((resolve, reject) => {
        try {
          if (typeof require !== 'function') {
            reject(new Error('当前环境不支持 require 加载分包模块'));
            return;
          }

          require(modulePath, (moduleExports) => {
            if (!moduleExports) {
              reject(new Error(`分包模块为空: ${modulePath}`));
              return;
            }
            resolve(moduleExports);
          });
        } catch (error) {
          reject(error);
        }
      });
      // #endif
    },

    hydrateMainPackageStats() {
      try {
        const favorites = getFavorites();
        this.favoriteCount = Array.isArray(favorites) ? favorites.length : 0;
      } catch (e) {
        logger.warn('[practice] 预加载收藏统计失败:', e);
      }

      try {
        const stats = getLearningStats();
        const weakPoints = getWeakKnowledgePoints();
        const todayQuestions = Number(stats.todayQuestions || 0);
        const weeklyAccuracy = Number(stats.overallAccuracy || 0);

        this.todayQuestions = Number.isFinite(todayQuestions) ? todayQuestions : this.todayQuestions;
        this.weeklyAccuracy = Number.isFinite(weeklyAccuracy) ? weeklyAccuracy : this.weeklyAccuracy;
        this.weakPointsCount = Array.isArray(weakPoints) ? weakPoints.length : this.weakPointsCount;

        const streakData = getLearningStreakData();
        const currentStreak = Number(streakData?.currentStreak || 0);
        this.currentStreak = Number.isFinite(currentStreak) ? currentStreak : this.currentStreak;
      } catch (e) {
        logger.warn('[practice] 预加载学习统计失败:', e);
      }
    },

    // ==================== 题库状态管理 ====================
    refreshBankStatus() {
      // E005: 委托给带数据参数的版本，兼容外部直接调用
      const bankData = storageService.get('v30_bank', []);
      const userAnswers = storageService.get('v30_user_answers', {});
      this._refreshBankWithData(bankData, userAnswers);
    },

    // E005: 仅首次加载显示骨架屏，后续 onShow 不闪烁
    _refreshBankWithData(bankFromService, userAnswers) {
      if (!this._hasLoadedOnce) {
        this.isPageLoading = true;
      }
      logger.log('[刷题中心] 开始刷新题库状态');

      try {
        let bank = bankFromService;

        // 仅在数据为空时才尝试备份恢复（避免每次 onShow 都执行恢复逻辑）
        if (!bank || bank.length === 0) {
          // 同时检查 storageService 作为兜底
          const bankFromUni = storageService.get('v30_bank', []);
          if (bankFromUni.length > 0) {
            bank = bankFromUni;
          } else {
            logger.warn('[刷题中心] 题库数据为空，尝试从备份恢复...');
            bank = this._tryRestoreFromBackup() || [];
          }
        }

        this.hasBank = bank.length > 0;
        this.totalQuestions = bank.length;

        logger.log('[刷题中心] 题库状态更新:', {
          hasBank: this.hasBank,
          totalQuestions: this.totalQuestions
        });

        // 计算学习进度
        const doneCount = Object.keys(userAnswers || {}).length;
        this.progressPercent = bank.length > 0 ? Math.round((doneCount / bank.length) * 100) : 0;
      } catch (err) {
        logger.error('[刷题中心] 刷新题库状态异常:', err);
      } finally {
        this.isPageLoading = false;
      }
      this._hasLoadedOnce = true;
    },
    _tryRestoreFromBackup() {
      const backupKeys = ['v30_bank_backup', 'v30_bank_backup_before_clear'];

      for (const backupKey of backupKeys) {
        try {
          // 尝试 uniStorage
          const backupFromUni = storageService.get(backupKey);
          const backupFromService = storageService.get(backupKey, null);

          for (const backup of [backupFromUni, backupFromService]) {
            if (!backup) continue;
            try {
              const restoredData = typeof backup === 'string' ? JSON.parse(backup) : backup;
              if (Array.isArray(restoredData) && restoredData.length > 0) {
                logger.log(`[刷题中心] 从备份恢复题库 (${backupKey}):`, restoredData.length, '道题');
                storageService.save('v30_bank', restoredData);
                uni.showToast({ title: `已从备份恢复 ${restoredData.length} 道题`, icon: 'success', duration: 2000 });
                return restoredData;
              }
            } catch (parseErr) {
              logger.warn(`[刷题中心] 解析备份失败 (${backupKey}):`, parseErr);
            }
          }
        } catch (restoreErr) {
          logger.warn(`[刷题中心] 恢复备份失败 (${backupKey}):`, restoreErr);
        }
      }

      logger.warn('[刷题中心] 所有备份都不可用');
      return null;
    },

    // E005: 接受预读取的 importedFiles 数据
    _checkGenerationWithData(importedFiles) {
      const generatingFile = (importedFiles || []).find((f) => f.status === 'generating');

      if (generatingFile && this.isLooping) {
        this.isGeneratingQuestions = true;
        this.startProgressTimer();
      } else {
        this.isGeneratingQuestions = false;
        if (this.progressTimer) {
          clearInterval(this.progressTimer);
        }
      }
    },

    /**
     * 在本地题库中搜索匹配关键词的题目
     * 匹配题目的 question/answer/options 字段，找到后跳转到答题页
     */
    _searchBankByKeyword(keyword) {
      if (!keyword || !this.hasBank) {
        uni.showToast({ title: this.hasBank ? '搜索关键词为空' : '请先导入题库', icon: 'none' });
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
        uni.showToast({ title: `未找到与"${keyword.substring(0, 10)}"相关的题目`, icon: 'none', duration: 2000 });
        return;
      }

      // 将搜索结果存入临时存储，答题页读取
      storageService.save('v30_search_result', matched);
      uni.showToast({ title: `找到 ${matched.length} 道相关题目`, icon: 'success', duration: 1500 });

      setTimeout(() => {
        safeNavigateTo('/pages/practice-sub/do-quiz?mode=search');
      }, 800);
    },

    // ==================== 页面导航（由 practiceNavigationMixin 提供）====================
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

    // goBattle 由 practiceNavigationMixin 提供

    // goFileManager, goAITutor, goMistake, goRank, goToStudyDetail 由 practiceNavigationMixin 提供

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

    // ✅ P1: goMistakeReview 由 practiceNavigationMixin 提供

    // ✅ P2: goFavorites 由 practiceNavigationMixin 提供

    // Anki 导出
    async exportAnki() {
      try {
        uni.showLoading({ title: '导出中...', mask: true });
        const res = await lafService.request('/anki-export', { deckName: '我的考研题库' });
        uni.hideLoading();
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
                success: () => uni.showToast({ title: '导出成功', icon: 'success' }),
                fail: () => uni.showToast({ title: '已保存', icon: 'success' })
              });
            },
            fail: () => uni.showToast({ title: '保存失败', icon: 'none' })
          });
          // #endif
          // #ifndef MP-WEIXIN
          uni.showToast({ title: '导出成功', icon: 'success' });
          // #endif
        } else {
          uni.showToast({ title: res.message || '导出失败', icon: 'none' });
        }
      } catch (_e) {
        uni.hideLoading();
        uni.showToast({ title: '导出失败', icon: 'none' });
      }
    },

    // Phase 3-3: 考研题库入口
    goQuestionBank() {
      safeNavigateTo('/pages/practice-sub/question-bank');
    },

    // Phase 3-7: AI智能推题
    async goSmartRecommend() {
      if (this.isLoadingRecommend) return;
      this.isLoadingRecommend = true;
      try {
        const { lafService } = await import('@/services/lafService');
        const res = await lafService.getSmartRecommendations(10);
        if (res?.code === 0 && res.data?.questions?.length > 0) {
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
          const storageService = (await import('@/services/storageService.js')).default;
          storageService.save('v30_temp_practice', formatted);
          safeNavigateTo('/pages/practice-sub/do-quiz?source=ai-recommend&mode=normal');
        } else {
          uni.showToast({ title: res?.data?.ai_advice || '暂无推荐，请多做几道题', icon: 'none' });
        }
      } catch (_e) {
        uni.showToast({ title: '推题失败，请稍后重试', icon: 'none' });
      } finally {
        this.isLoadingRecommend = false;
      }
    },

    // ==================== 动态注入 Mixin 方法 ====================
    async _loadAIGenerationMixin(retryCount = 0) {
      const MAX_RETRIES = 2;
      try {
        await this._ensurePracticeSubPackageLoaded();

        const [aiModule, statsModule] = await Promise.all([
          this._requirePracticeSubpackageModule('../practice-sub/composables/ai-generation-mixin.js'),
          this._requirePracticeSubpackageModule('../practice-sub/composables/learning-stats-mixin.js')
        ]);

        const resolveExport = (mod, name) => mod[name] || (mod.default && mod.default[name]) || mod.default || mod;
        const aiMixin = resolveExport(aiModule, 'aiGenerationMixin');
        const statsMixin = resolveExport(statsModule, 'learningStatsMixin');
        if (!aiMixin || !statsMixin) {
          throw new Error('分包模块导出为空');
        }

        // 将 mixin 的方法混入当前实例
        const mixins = [aiMixin, statsMixin];
        let injectedCount = 0;
        for (const mixin of mixins) {
          const methods = mixin.methods || mixin;
          if (!methods || typeof methods !== 'object') {
            continue;
          }
          for (const key of Object.keys(methods)) {
            if (typeof methods[key] === 'function') {
              const bound = methods[key].bind(this);
              this.dynamicMethodsCache[key] = bound;
              // 保留主包 chooseImportSource 的兜底行为，避免点击导入无响应
              if (key !== 'chooseImportSource') {
                this[key] = bound;
              }
              injectedCount++;
            }
          }
        }

        if (injectedCount === 0) {
          throw new Error('分包模块方法注入失败');
        }

        this._mixinLoaded = true;
        logger.log('[practice] 分包模块加载完成');
      } catch (e) {
        logger.error('[practice] 分包模块加载失败 (尝试 ' + (retryCount + 1) + '):', e);
        if (retryCount < MAX_RETRIES) {
          // ✅ P1-3: 用 await 延迟替代 setTimeout，保持 promise 链完整
          const delay = 500 * Math.pow(2, retryCount);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this._loadAIGenerationMixin(retryCount + 1);
        } else {
          // 重试耗尽，提示用户
          this._mixinLoaded = false;
          uni.showToast({
            title: '部分功能加载失败，请检查网络后重新进入',
            icon: 'none',
            duration: 3000
          });
        }
      }
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
   Wise-Style 刷题页面样式 - Phase 3 页面级重构
   ============================================ */

/* 基础容器 - 使用设计系统变量 */
.practice-container {
  min-height: 100%;
  min-height: 100vh;
  background: linear-gradient(
    180deg,
    var(--page-gradient-top, var(--bg-page)) 0%,
    var(--page-gradient-mid, var(--bg-page)) 52%,
    var(--page-gradient-bottom, var(--bg-page)) 100%
  );
  padding: 22rpx;
  /* E008: 使用 safe-area-inset-bottom 适配刘海屏/底部指示条 */
  padding-bottom: calc(140px + constant(safe-area-inset-bottom, 0px));
  padding-bottom: calc(140px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  color: var(--text-sub);
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'SF Pro Text', 'Noto Sans SC', 'Roboto', sans-serif;
  transition: background 0.3s ease;
}

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
  background: radial-gradient(circle, var(--brand-tint-strong) 0%, transparent 70%);
  filter: blur(10rpx);
}

.practice-container::after {
  width: 360rpx;
  height: 360rpx;
  left: -120rpx;
  top: 520rpx;
  background: radial-gradient(circle, var(--brand-tint) 0%, transparent 72%);
  filter: blur(10rpx);
}

/* ============================================
   顶部导航 - 优化文字间距和对齐
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
  font-weight: 680;
  letter-spacing: -0.5rpx;
  color: var(--text-primary);
  line-height: 1.2;
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

/* 状态卡片 */
.status-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 28px;
  padding: 24px;
  margin-bottom: 18px;
  box-shadow: var(--apple-shadow-card);
  transition: all 0.3s ease;
  backdrop-filter: blur(14rpx) saturate(120%);
  -webkit-backdrop-filter: blur(14rpx) saturate(120%);
}

.status-card::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}

.status-card:active {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.dark-mode .status-card {
  background: linear-gradient(160deg, #1f1f24 0%, #17171b 100%);
}

/* 空状态样式 - 居中显示 */
.status-card.empty-state {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.status-card.empty-state:active {
  background: rgba(255, 255, 255, 0.92);
  border-color: var(--primary);
}

.dark-mode .status-card.empty-state {
  background: linear-gradient(160deg, #1d1d22 0%, #151518 100%);
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
  animation: float 3s ease-in-out infinite;
}

.dark-mode .empty-icon,
.dark-mode .import-icon,
.dark-mode .menu-icon {
  width: 84rpx;
  height: 84rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background:
    linear-gradient(180deg, rgba(10, 132, 255, 0.12) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border: 1rpx solid rgba(10, 132, 255, 0.18);
  box-shadow: var(--apple-shadow-surface);
}

.dark-mode .empty-icon {
  width: 132rpx;
  height: 132rpx;
  margin: 0 auto 20px;
  border-radius: 36rpx;
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
  font-weight: 680;
  color: var(--text-primary);
  margin: 0 0 24rpx 0;
  letter-spacing: 0;
}

.empty-desc {
  font-size: 30rpx;
  color: var(--text-sub);
  margin: 0 0 48rpx 0;
  line-height: 1.6;
  max-width: 280px;
}

.empty-action {
  display: flex;
  align-items: center;
  /* gap: 10px; -- replaced for Android WebView compat */
  padding: 12px 28px;
  min-height: 88rpx;
  background: var(--cta-primary-bg);
  border-radius: 999px;
  transition: all 0.3s ease;
  box-shadow: var(--cta-primary-shadow);
  border: 1px solid var(--cta-primary-border);
}

.empty-action:active {
  transform: scale(0.95);
  box-shadow: var(--shadow-sm);
}

.action-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
  /* 按钮背景是主色（绿色），图标需要深色以保持对比度 */
  filter: brightness(0) opacity(0.8);
}

.action-text {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--cta-primary-text);
  letter-spacing: 0.3px;
}

.dark-mode .empty-action {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
}

.dark-mode .action-text {
  color: var(--primary-foreground);
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
  background-color: rgba(255, 255, 255, 0.66);
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.52);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.72);
}

.manage-btn:active {
  background-color: rgba(255, 255, 255, 0.88);
  transform: scale(0.95);
}

.manage-icon {
  font-size: 32rpx;
}

.manage-text {
  font-size: 28rpx;
  color: var(--primary);
  font-weight: 600;
}

.status-icon {
  margin-right: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
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
  font-weight: 680;
  color: var(--text-primary);
  margin: 0 0 8px 0;
}

.status-desc {
  font-size: 28rpx;
  color: var(--text-sub);
  margin: 0;
}

/* 主要操作区 */
.main-actions {
  display: flex;
  flex-direction: column;
  /* gap: 12px; -- replaced for Android WebView compat */
  margin-bottom: 22px;
}

/* 主要按钮 */
.primary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 12px; -- replaced for Android WebView compat */
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1px solid var(--cta-primary-border);
  border-radius: 999px;
  padding: 20px 40px;
  font-size: 40rpx;
  font-weight: 680;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--cta-primary-shadow);
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  min-height: 96rpx;
}

.primary-btn:hover {
  opacity: 0.92;
  box-shadow: var(--cta-primary-shadow);
  transform: translateY(-2px);
}

.primary-btn:active {
  transform: translateY(0);
  box-shadow: 0 8rpx 20rpx rgba(16, 40, 26, 0.16);
}

.dark-mode .primary-btn {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border-color: var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

/* ✅ F022: 按钮加载状态 */
.primary-btn.btn-loading,
.secondary-btn.btn-loading {
  opacity: 0.7;
  pointer-events: none;
}

.btn-spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
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
}

.menu-icon-img {
  width: 72rpx;
  height: 72rpx;
  object-fit: contain;
}

/* 次要按钮（PK对战） */
.secondary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 12px; -- replaced for Android WebView compat */
  background-color: rgba(255, 255, 255, 0.68);
  color: var(--text-primary);
  border: 1px solid rgba(255, 255, 255, 0.52);
  border-radius: 999px;
  padding: 20px 40px;
  font-size: 40rpx;
  font-weight: 620;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--apple-shadow-surface);
  width: 100%;
  max-width: 360px;
  margin: 0 auto;
  min-height: 96rpx;
}

.secondary-btn:hover {
  opacity: 0.94;
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.secondary-btn:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}

.dark-mode .secondary-btn {
  background-color: rgba(16, 20, 28, 0.72);
  border-color: rgba(124, 176, 255, 0.2);
}

.btn-icon {
  font-size: 56rpx;
}

/* 导入资料卡片 */
.import-card {
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 26px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--apple-shadow-card);
  backdrop-filter: blur(14rpx) saturate(120%);
  -webkit-backdrop-filter: blur(14rpx) saturate(120%);
}

.import-card::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}

.dark-mode .import-card {
  background: linear-gradient(160deg, #1f1f24 0%, #17171b 100%);
}

/* ✅ F026: 文件读取中状态 */
.import-card.import-loading {
  opacity: 0.8;
  pointer-events: none;
  border-color: var(--primary);
}

.import-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid var(--border, #e5e5e5);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: importSpin 0.8s linear infinite;
}

@keyframes importSpin {
  to {
    transform: rotate(360deg);
  }
}

.import-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.import-icon {
  margin-right: 16px;
}

.import-icon .emoji {
  font-size: 64rpx;
}

.import-info {
  flex: 1;
}

.import-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.import-desc {
  font-size: 28rpx;
  color: var(--text-sub);
  margin: 0;
}

.import-arrow {
  color: var(--text-sub);
}

.arrow {
  font-size: 48rpx;
  font-weight: 600;
}

/* 功能菜单 */
.feature-menu {
  background: linear-gradient(180deg, var(--apple-group-bg) 0%, var(--apple-glass-card-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 28px;
  overflow: hidden;
  box-shadow: var(--apple-shadow-surface);
  backdrop-filter: blur(14rpx) saturate(120%);
  -webkit-backdrop-filter: blur(14rpx) saturate(120%);
}

.dark-mode .feature-menu {
  background: linear-gradient(160deg, #1f1f24 0%, #17171b 100%);
}

.menu-item {
  display: flex;
  align-items: center;
  min-height: 96rpx;
  padding: 18px 20px;
  border-bottom: 1px solid var(--apple-divider);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background-color: rgba(255, 255, 255, 0.26);
}

.menu-icon {
  margin-right: 16px;
}

.menu-icon .emoji {
  font-size: 56rpx;
}

.menu-info {
  flex: 1;
}

.menu-title {
  font-size: 31rpx;
  font-weight: 620;
  color: var(--text-primary);
  margin: 0;
}

.menu-arrow {
  color: var(--text-sub);
}

/* 进度条 */
.progress-info {
  display: flex;
  align-items: center;
  /* gap: 12px; -- replaced for Android WebView compat */
}

.progress-bar {
  width: 120px;
  height: 8px;
  background-color: var(--primary-light);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--gradient-primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--primary);
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
  background: linear-gradient(90deg, var(--bg-secondary) 25%, var(--bg-card) 50%, var(--bg-secondary) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
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
</style>
