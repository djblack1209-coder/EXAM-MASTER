<template>
  <view class="practice-container" :class="{ 'dark-mode': isDark }">
    <!-- 顶部导航 -->
    <view class="top-nav">
      <text class="nav-title"> 刷题中心 </text>
      <view class="nav-actions">
        <!-- 移除垃圾桶图标，避免与微信原生胶囊按钮重叠 -->
      </view>
    </view>

    <!-- 骨架屏加载状态 -->
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

    <!-- 状态卡片 -->
    <view v-if="!isPageLoading" class="status-card" :class="{ 'empty-state': !hasBank }">
      <!-- 有题库状态 -->
      <div v-if="hasBank" class="status-content">
        <div class="status-icon">
          <image
            class="icon-image"
            src="/static/icons/practice/icon-library.png"
            mode="aspectFit"
            :style="isDark ? 'filter: brightness(0) invert(1) opacity(0.9);' : ''"
          />
        </div>
        <div class="status-info">
          <h3 class="status-title">题库就绪</h3>
          <p class="status-desc">当前已收录 {{ totalQuestions }} 道真题</p>
        </div>
        <view class="status-actions">
          <view class="manage-btn" @tap="showQuizManage">
            <image class="manage-icon-img" src="/static/icons/practice/icon-settings.png" mode="aspectFit" lazy-load />
            <text class="manage-text"> 题库管理 </text>
          </view>
        </view>
      </div>

      <!-- 空状态 - 居中显示 -->
      <div v-else class="empty-state-content" @tap="chooseImportSource">
        <div class="empty-icon">
          <text class="empty-icon-emoji"> 📚 </text>
        </div>
        <h3 class="empty-title">题库空空如也</h3>
        <p class="empty-desc">导入学习资料，AI 为您智能生成专属题库</p>
        <view class="empty-action">
          <text class="action-icon-emoji"> 📤 </text>
          <text class="action-text"> 点击导入资料 </text>
        </view>
      </div>
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
    <div v-if="!isPageLoading" class="main-actions">
      <!-- 开始刷题按钮 - ✅ F022: 添加加载状态和点击反馈 -->
      <button
        v-if="hasBank"
        class="primary-btn"
        :class="{ 'btn-loading': isNavigating }"
        :disabled="isNavigating"
        @tap="goPractice"
      >
        <view v-if="isNavigating" class="btn-spinner" />
        <image v-else class="btn-icon-img" src="/static/icons/practice/icon-book.png" mode="aspectFit" />
        <text class="btn-text">
          {{ isNavigating ? '加载中...' : '开始刷题' }}
        </text>
      </button>

      <!-- PK对战入口 - ✅ F022: 添加加载状态和点击反馈 -->
      <button
        v-if="hasBank"
        class="secondary-btn"
        :class="{ 'btn-loading': isNavigating }"
        :disabled="isNavigating"
        @tap="goBattle"
      >
        <view v-if="isNavigating" class="btn-spinner" />
        <image v-else class="btn-icon-img" src="/static/icons/practice/icon-battle.png" mode="aspectFit" />
        <text class="btn-text"> PK 对战 </text>
      </button>

      <!-- 导入资料卡片 -->
      <div class="import-card" :class="{ 'import-loading': isUploadingFile }" @tap="chooseImportSource">
        <div class="import-icon">
          <text v-if="!isUploadingFile" class="import-icon-emoji"> 📤 </text>
          <view v-else class="import-spinner" />
        </div>
        <div class="import-info">
          <h3 class="import-title">
            {{ isUploadingFile ? '正在读取文件...' : '导入学习资料' }}
          </h3>
          <p class="import-desc">
            {{ isUploadingFile ? fileName : 'AI 智能分析 · 即刻出题' }}
          </p>
        </div>
        <div class="import-arrow">
          <text v-if="!isUploadingFile" class="arrow"> › </text>
        </div>
      </div>
    </div>

    <PauseBanner :visible="isPaused" @resume="resumeGeneration" />

    <!-- 功能菜单 -->
    <div v-if="!isPageLoading" class="feature-menu">
      <!-- 文件管理 -->
      <div class="menu-item" @tap="goFileManager">
        <div class="menu-icon">
          <image class="menu-icon-img" src="/static/icons/practice/icon-folder.png" mode="aspectFit" lazy-load />
        </div>
        <div class="menu-info">
          <h3 class="menu-title">文件管理</h3>
        </div>
        <div class="menu-arrow">
          <text class="arrow"> › </text>
        </div>
      </div>

      <!-- AI导师 -->
      <div class="menu-item" @tap="goAITutor">
        <div class="menu-icon">
          <image
            class="menu-icon-img"
            src="/static/icons/practice/icon-robot.png"
            mode="aspectFit"
            :style="isDark ? 'filter: brightness(0) invert(1) opacity(0.9);' : ''"
          />
        </div>
        <div class="menu-info">
          <h3 class="menu-title">AI导师</h3>
        </div>
        <div class="menu-arrow">
          <text class="arrow"> › </text>
        </div>
      </div>

      <!-- 错题本 -->
      <div class="menu-item" @tap="goMistake">
        <div class="menu-icon">
          <image class="menu-icon-img" src="/static/icons/practice/icon-error.png" mode="aspectFit" lazy-load />
        </div>
        <div class="menu-info">
          <h3 class="menu-title">错题本</h3>
        </div>
        <div class="menu-arrow">
          <text class="arrow"> › </text>
        </div>
      </div>

      <!-- ✅ P1: 错题重练入口 -->
      <div v-if="mistakeCount > 0" class="menu-item mistake-review" @tap="goMistakeReview">
        <div class="menu-icon">
          <text class="menu-icon-emoji"> 🔄 </text>
        </div>
        <div class="menu-info">
          <h3 class="menu-title">错题重练</h3>
          <p class="menu-subtitle">{{ mistakeCount }} 道错题待巩固</p>
        </div>
        <div class="menu-arrow">
          <text class="arrow"> › </text>
        </div>
      </div>

      <!-- 排行榜 -->
      <div class="menu-item" @tap="goRank">
        <div class="menu-icon">
          <image class="menu-icon-img" src="/static/icons/practice/icon-ranking.png" mode="aspectFit" lazy-load />
        </div>
        <div class="menu-info">
          <h3 class="menu-title">学霸排行榜</h3>
        </div>
        <div class="menu-arrow">
          <text class="arrow"> › </text>
        </div>
      </div>

      <!-- 学习进度 -->
      <div class="menu-item" @tap="goToStudyDetail">
        <div class="menu-icon">
          <image class="menu-icon-img" src="/static/icons/practice/icon-check.png" mode="aspectFit" lazy-load />
        </div>
        <div class="menu-info">
          <h3 class="menu-title">总学习进度</h3>
        </div>
        <div class="progress-info">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <text class="progress-text"> {{ progressPercent }}% </text>
        </div>
      </div>

      <!-- ✅ P2: 收藏夹管理入口 -->
      <div v-if="favoriteCount > 0" class="menu-item" @tap="goFavorites">
        <div class="menu-icon">
          <text class="menu-icon-emoji"> ⭐ </text>
        </div>
        <div class="menu-info">
          <h3 class="menu-title">我的收藏</h3>
          <p class="menu-subtitle-normal">{{ favoriteCount }} 道题目</p>
        </div>
        <div class="menu-arrow">
          <text class="arrow"> › </text>
        </div>
      </div>

      <!-- ✅ P1: 练习模式入口 -->
      <div class="menu-item" @tap="showPracticeModes">
        <div class="menu-icon">
          <text class="menu-icon-emoji"> 🎮 </text>
        </div>
        <div class="menu-info">
          <h3 class="menu-title">练习模式</h3>
          <p class="menu-subtitle-normal">专项突破 · 限时训练</p>
        </div>
        <div class="menu-arrow">
          <text class="arrow"> › </text>
        </div>
      </div>
    </div>

    <!-- AI 加载遮罩 -->
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
import { QUOTE_LIBRARY } from '@/config/home-data.js';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';
// ✅ 检查点2.2：导入草稿检测器
import { detectUnfinishedPractice, clearDraft } from '@/utils/practice/draft-detector.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
// ✅ 2.1: 导航逻辑提取到 mixin，减少主组件方法数量
import { practiceNavigationMixin } from '@/mixins/practiceNavigationMixin.js';
// ✅ AI 生成逻辑已抽离到分包 composable，通过 onLoad 动态加载
// 详见 pages/practice-sub/composables/ai-generation-mixin.js

export default {
  components: {
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

      // AI 引擎状态
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
      soupTimer: null
    };
  },
  computed: {},
  onShow() {
    // 原生 tabBar 已移除，无需隐藏
    // F005: 通知 CustomTabbar 重新检测路由
    uni.$emit('tabbarRouteUpdate');

    // 每次显示页面时重新读取主题状态
    this.isDark = initTheme();
    logger.log('[practice] onShow 刷新主题:', this.isDark);

    // E005: 批量读取 storage，减少重复 I/O
    let bankData = [];
    let userAnswers = {};
    let importedFiles = [];
    try {
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
      const pendingSearch = uni.getStorageSync('_pendingSearch');
      if (pendingSearch && pendingSearch.keyword && Date.now() - pendingSearch.timestamp < 30000) {
        uni.removeStorageSync('_pendingSearch');
        // 延迟执行搜索，等 UI 渲染完成
        setTimeout(() => {
          this._searchBankByKeyword(pendingSearch.keyword);
        }, 300);
      } else if (pendingSearch) {
        uni.removeStorageSync('_pendingSearch'); // 过期清理
      }
    } catch (_e) {
      /* ignore */
    }

    // E005: 延迟非关键读取，让 UI 先渲染
    setTimeout(() => {
      const mistakeBook = storageService.get('mistake_book', []);
      this.mistakeCount = mistakeBook.length;
      this.checkUnfinishedPractice();
      this.loadLearningStats();
      this.loadFavoriteCount();
    }, 50);

    // 恢复后台生成
    if (this.isLooping && this.generatedCount < this.totalQuestionsLimit && !this.isRequestInFlight) {
      setTimeout(() => {
        this.generateNextBatch();
      }, 500);
    }
  },
  onLoad() {
    // 初始化主题
    this.isDark = initTheme();
    logger.log('[practice] 🎨 初始化主题:', this.isDark);

    // 监听全局主题更新事件（仅注册一次）
    onThemeUpdate((mode) => {
      this.isDark = mode === 'dark';
      logger.log('[practice] 🎨 主题更新:', mode, 'isDark:', this.isDark);
    });

    // ✅ 动态加载 AI 生成 mixin（从分包按需加载，减小主包体积）
    this._loadAIGenerationMixin();
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
        console.error('[刷题中心] 刷新题库状态异常:', err);
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
      /* 由分包 mixin 注入 */
    },
    async loadFavoriteCount() {
      /* 由分包 mixin 注入 */
    },

    // ✅ P1: goMistakeReview 由 practiceNavigationMixin 提供

    // ✅ P2: goFavorites 由 practiceNavigationMixin 提供

    // ==================== 动态加载分包 Mixin ====================
    async _loadAIGenerationMixin(retryCount = 0) {
      const MAX_RETRIES = 2;
      try {
        // 并行加载两个分包 mixin
        const [aiModule, statsModule] = await Promise.all([
          import('@/pages/practice-sub/composables/ai-generation-mixin.js'),
          import('@/pages/practice-sub/composables/learning-stats-mixin.js')
        ]);
        // 兼容 ESM / CJS / default 包装：取 named export 或 default 中的值
        const resolveExport = (mod, name) => mod[name] || (mod.default && mod.default[name]) || mod.default || mod;
        const aiMixin = resolveExport(aiModule, 'aiGenerationMixin');
        const statsMixin = resolveExport(statsModule, 'learningStatsMixin');
        // 将 mixin 的方法混入当前实例
        const mixins = [aiMixin, statsMixin];
        for (const mixin of mixins) {
          const methods = mixin.methods || mixin;
          for (const key of Object.keys(methods)) {
            if (typeof methods[key] === 'function') {
              this[key] = methods[key].bind(this);
            }
          }
        }
        this._mixinLoaded = true;
        logger.log('[practice] 分包模块加载完成');
      } catch (e) {
        logger.error('[practice] 分包模块加载失败 (尝试 ' + (retryCount + 1) + '):', e);
        if (retryCount < MAX_RETRIES) {
          // 指数退避重试：500ms, 1500ms
          const delay = 500 * Math.pow(2, retryCount);
          setTimeout(() => this._loadAIGenerationMixin(retryCount + 1), delay);
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
      uni.showToast({ title: '功能加载中，请稍候', icon: 'none' });
    },
    showQuizManage() {
      uni.showToast({ title: '功能加载中，请稍候', icon: 'none' });
    },
    closeQuizManage() {
      this.showQuizManageModal = false;
    },
    clearQuizBank() {
      uni.showToast({ title: '功能加载中，请稍候', icon: 'none' });
    },
    clearAll() {
      uni.showToast({ title: '功能加载中，请稍候', icon: 'none' });
    },
    pauseGeneration() {
      /* mixin 占位 */
    },
    resumeGeneration() {
      /* mixin 占位 */
    },
    closeSpeedModalAndPlay() {
      this.showSpeedModal = false;
    },
    startProgressTimer() {
      /* mixin 占位 */
    },
    updateGenerationProgress() {
      /* mixin 占位 */
    },
    startSoupRotation() {
      /* mixin 占位 */
    },
    generateNextBatch() {
      /* mixin 占位 */
    },
    openGoalSetting() {
      uni.showToast({ title: '功能加载中，请稍候', icon: 'none' });
    },
    onGoalSaved(value) {
      this.todayGoal = value;
      this.showGoalSettingModal = false;
    },
    showPracticeModes() {
      uni.showToast({ title: '功能加载中，请稍候', icon: 'none' });
    },
    selectPracticeMode() {
      uni.showToast({ title: '功能加载中，请稍候', icon: 'none' });
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
  min-height: 100vh;
  background-color: var(--bg-page);
  padding: 20px;
  /* E008: 使用 safe-area-inset-bottom 适配刘海屏/底部指示条 */
  padding-bottom: calc(140px + constant(safe-area-inset-bottom, 0px));
  padding-bottom: calc(140px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  color: var(--text-sub);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  transition: background-color 0.3s ease;
}

/* ============================================
   顶部导航 - 优化文字间距和对齐
   ============================================ */
.top-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 40px;
  margin-bottom: 32px;
  padding: 0 4px;
}

.nav-title {
  font-size: 64rpx;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0;
  line-height: 1.2;
}

.nav-actions {
  display: flex;
  gap: 12px;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--primary-light);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  background-color: var(--primary);
  transform: scale(1.05);
}

.icon-btn.danger {
  background-color: var(--danger-light);
}

.icon-btn.danger:hover {
  background-color: var(--danger);
}

/* 状态卡片 */
.status-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
  box-shadow: var(--shadow-md, 0 4px 20px rgba(0, 0, 0, 0.06));
  transition: all 0.3s ease;
}

.status-card:hover {
  box-shadow: var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.08));
  transform: translateY(-2px);
}

/* 空状态样式 - 居中显示 */
.status-card.empty-state {
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: var(--bg-secondary);
}

.status-card.empty-state:hover {
  background: var(--bg-card);
  border-color: var(--primary);
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
  font-size: 44rpx;
  font-weight: 600;
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
  gap: 10px;
  padding: 14px 28px;
  background-color: var(--primary);
  border-radius: 24px;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-md);
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
  color: var(--primary-foreground);
  letter-spacing: 0.3px;
}

.status-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status-actions {
  flex-shrink: 0;
  margin-left: 16px;
}

.manage-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background-color: var(--primary-light);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.manage-btn:active {
  background-color: var(--primary);
  transform: scale(0.95);
}

.manage-icon {
  font-size: 32rpx;
}

.manage-text {
  font-size: 28rpx;
  color: var(--primary);
  font-weight: 500;
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
  font-size: 40rpx;
  font-weight: 600;
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
  gap: 16px;
  margin-bottom: 32px;
}

/* 主要按钮 */
.primary-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background-color: var(--primary);
  color: var(--primary-foreground);
  border: none;
  border-radius: 20px;
  padding: 20px 40px;
  font-size: 40rpx;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
}

.primary-btn:hover {
  opacity: 0.85;
  box-shadow: var(--shadow-xl);
  transform: translateY(-2px);
}

.primary-btn:active {
  transform: translateY(0);
  box-shadow: var(--shadow-md);
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
  gap: 12px;
  background-color: var(--primary);
  color: var(--primary-foreground);
  border: none;
  border-radius: 20px;
  padding: 20px 40px;
  font-size: 40rpx;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
}

.secondary-btn:hover {
  opacity: 0.85;
  box-shadow: var(--shadow-xl);
  transform: translateY(-2px);
}

.secondary-btn:active {
  transform: translateY(0);
  box-shadow: var(--shadow-md);
}

.btn-icon {
  font-size: 56rpx;
}

/* 导入资料卡片 */
.import-card {
  display: flex;
  align-items: center;
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--shadow-md);
}

/* ✅ F026: 文件读取中状态 */
.import-card.import-loading {
  opacity: 0.8;
  pointer-events: none;
  border-color: var(--brand-primary, #007aff);
}

.import-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid var(--border, #e5e5e5);
  border-top-color: var(--brand-primary, #007aff);
  border-radius: 50%;
  animation: importSpin 0.8s linear infinite;
}

@keyframes importSpin {
  to {
    transform: rotate(360deg);
  }
}

.import-card:hover {
  box-shadow: var(--shadow-lg);
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
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
  box-shadow: var(--shadow-md, 0 4px 20px rgba(0, 0, 0, 0.06));
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-item:hover {
  background-color: var(--bg-secondary);
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
  font-size: 32rpx;
  font-weight: 500;
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
  gap: 12px;
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
  background-color: var(--primary);
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

.skeleton-menu {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
