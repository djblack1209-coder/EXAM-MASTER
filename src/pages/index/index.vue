<template>
  <!-- 最外层：页面容器 -->
  <view :class="['page-wrapper', { 'page-dark': isDark }]">
    <!-- 微信隐私保护弹窗 -->
    <PrivacyPopup />
    <!-- 主容器：带背景色 -->
    <view :class="['dashboard-container', { dark: isDark }]">
      <!-- F002-I1b: 顶部导航栏（已提取为独立组件） -->
      <IndexHeaderBar
        :scroll-y="scrollY"
        :avatar-url="userAvatarUrl"
        :is-logged-in="!!(userStore?.isLogin || false)"
        @open-login-modal="openLoginModal"
      />

      <!-- 主内容区域：全屏 scroll-view，支持下拉刷新 - ✅ F023: 优化滚动体验 -->
      <scroll-view
        scroll-y
        class="main-content-fullscreen"
        refresher-enabled
        :refresher-triggered="isRefreshing"
        refresher-default-style="none"
        scroll-with-animation
        :enhanced="true"
        :bounces="true"
        :show-scrollbar="false"
        :fast-deceleration="false"
        @scroll="handleScroll"
        @refresherrefresh="onPullDownRefresh"
      >
        <!-- 自定义下拉刷新指示器 -->
        <view v-if="isRefreshing" class="custom-refresher">
          <view class="refresher-content">
            <view class="refresher-spinner" />
            <text class="refresher-text">
              正在刷新...
            </text>
          </view>
        </view>
        <!-- 顶部占位：为导航栏留空 -->
        <view :style="{ height: layoutInfo.navBarHeight + 50 + 'px' }" />

        <!-- 内容包装器 -->
        <view class="content-wrapper">
          <!-- 欢迎横幅 -->
          <WelcomeBanner
            :is-dark="isDark"
            :user-name="userName"
            :finished-count="finishedCount"
            @nav-to-practice="navToPractice"
            @nav-to-mock-exam="navToMockExam"
          />

          <!-- ✅ P0-1: 新用户空状态引导 - 增强版 -->
          <EmptyState
            v-if="isNewUser"
            type="home"
            title="开启你的学习之旅"
            description="上传学习资料，AI 将为你智能生成专属题库，让备考更高效！"
            hint="支持 PDF、Word、图片等多种格式"
            :theme="isDark ? 'dark' : 'light'"
            @upload="handleEmptyGuideAction({ type: 'new_user_onboarding' })"
            @quick-start="handleQuickStart"
            @tutorial="handleTutorial"
          />

          <!-- 统计卡片网格 -->
          <StatsGrid
            :is-dark="isDark"
            :total-questions="realTotalQuestions"
            :accuracy="realAccuracy"
            :study-days="realStudyDays"
            :achievement-count="achievementCount"
            @stat-click="handleStatClick"
          />

          <!-- 今日学习时长卡片 -->
          <StudyTimeCard
            :is-dark="isDark"
            :formatted-time="formatStudyTime(todayStudyTime)"
            :is-timer-active="!!studyTimerInterval"
            @click="handleStudyTimeClick"
          />

          <!-- 概况气泡场 -->
          <KnowledgeBubbleField
            :is-dark="isDark"
            :knowledge-points="knowledgePoints"
            :animating-bubble-id="animatingBubbleId"
            @knowledge-click="handleKnowledgeClick"
          />

          <!-- 学习轨迹 -->
          <ActivityList :is-dark="isDark" :activities="recentActivities" @view-all="navToStudyDetail" />

          <!-- 个性化推荐 -->
          <RecommendationsList
            :is-dark="isDark"
            :recommendations="personalizedRecommendations"
            @recommendation-click="handleRecommendationClick"
          />

          <!-- 实用工具入口 -->
          <view class="section-header">
            <text class="section-title">
              实用工具
            </text>
          </view>
          <view class="tools-grid">
            <view
              :class="['tool-entry', isDark ? 'glass' : 'card-light']"
              hover-class="tool-entry-hover"
              @tap="navToTool('doc-convert')"
            >
              <view class="tool-icon-wrapper tool-icon-doc">
                <view class="tool-icon-glow tool-glow-doc" />
                <view class="tool-icon-glyph">
                  <BaseIcon name="file" :size="40" />
                </view>
              </view>
              <view class="tool-info">
                <text class="tool-name">
                  文档转换
                </text>
                <text class="tool-desc">
                  PDF/Word/Excel 互转
                </text>
              </view>
              <text class="tool-arrow">
                ›
              </text>
            </view>
            <view
              :class="['tool-entry', isDark ? 'glass' : 'card-light']"
              hover-class="tool-entry-hover"
              @tap="navToTool('id-photo')"
            >
              <view class="tool-icon-wrapper tool-icon-photo">
                <view class="tool-icon-glow tool-glow-photo" />
                <view class="tool-icon-glyph">
                  <BaseIcon name="camera" :size="40" />
                </view>
              </view>
              <view class="tool-info">
                <text class="tool-name">
                  证件照制作
                </text>
                <text class="tool-desc">
                  智能抠图换背景
                </text>
              </view>
              <text class="tool-arrow">
                ›
              </text>
            </view>
            <view
              :class="['tool-entry', isDark ? 'glass' : 'card-light']"
              hover-class="tool-entry-hover"
              @tap="navToTool('photo-search')"
            >
              <view class="tool-icon-wrapper tool-icon-search">
                <view class="tool-icon-glow tool-glow-search" />
                <view class="tool-icon-glyph">
                  <BaseIcon name="search" :size="40" />
                </view>
              </view>
              <view class="tool-info">
                <text class="tool-name">
                  拍照搜题
                </text>
                <text class="tool-desc">
                  AI 智能识别解答
                </text>
              </view>
              <text class="tool-arrow">
                ›
              </text>
            </view>
          </view>

          <!-- 待办事项清单 -->
          <view class="section-header">
            <text class="section-title">
              待办事项
            </text>
            <view class="edit-plan-btn" @tap="handleEditPlan">
              <view class="edit-icon">
                <BaseIcon name="edit" :size="24" />
              </view>
              <text class="edit-text">
                编辑计划
              </text>
            </view>
          </view>
          <TodoList
            :todos="todos"
            :is-dark="isDark"
            @toggle-todo="handleToggleTodo"
            @edit-todo="openTodoEditor"
          />

          <!-- 每日金句 -->
          <DailyQuoteCard :is-dark="isDark" :quote="dailyQuote" @open-poster="openQuotePoster" />
        </view>
        <!-- 内容包装器结束 -->

        <!-- 底部占位：为 TabBar 留空 -->
        <view :style="{ height: layoutInfo.tabBarHeight + 20 + 'px', background: 'transparent' }" />
      </scroll-view>

      <!-- 骨架屏：✅ 问题清单修复 - 添加淡出过渡动画 -->
      <!-- #ifndef APP-NVUE -->
      <transition name="skeleton-fade">
        <BaseSkeleton v-if="isLoading" :is-dark="isDark" />
      </transition>
      <!-- #endif -->
      <!-- #ifdef APP-NVUE -->
      <BaseSkeleton v-if="isLoading" :is-dark="isDark" />
      <!-- #endif -->
    </view>

    <!-- 底部导航栏：放在 dashboard-container 外部，避免继承绿色背景 -->
    <CustomTabbar :is-dark="isDark" />

    <!-- 弹窗容器：需要继承 dark 类以获取暗色 CSS 变量 -->
    <view :class="{ dark: isDark }">
      <!-- 公式定理弹窗 -->
      <FormulaModal :visible="showFormulaModal" :formula-list="formulaList" @close="showFormulaModal = false" />

      <!-- 每日金句海报弹窗 -->
      <QuotePosterModal
        :visible="showQuotePoster"
        :quote="dailyQuote"
        :author="quoteAuthor"
        :is-dark="isDark"
        @close="showQuotePoster = false"
        @save="saveQuotePoster"
      />

      <!-- ✅ 自定义弹窗：题库为空 -->
      <CustomModal
        :visible="showEmptyBankModal"
        type="upload"
        title="题库空空如也"
        content="上传学习资料，AI 将为您智能生成专属题库，开启高效刷题之旅！"
        confirm-text="去上传"
        cancel-text="稍后再说"
        :show-cancel="true"
        :is-dark="isDark"
        @confirm="handleEmptyBankConfirm"
        @cancel="showEmptyBankModal = false"
      />

      <!-- ✅ 自定义弹窗：登录引导 -->
      <CustomModal
        :visible="showLoginModal"
        type="study"
        title="开启学霸之旅"
        content="登录后可同步学习进度、错题本等数据，享受完整功能体验！"
        confirm-text="立即登录"
        cancel-text="暂不登录"
        :show-cancel="true"
        :is-dark="isDark"
        @confirm="handleLoginConfirm"
        @cancel="showLoginModal = false"
      />

      <!-- ✅ 检查点1.2: 每日金句分享弹窗 -->
      <ShareModal
        :visible="showShareModal"
        :quote="dailyQuote"
        :author="quoteAuthor"
        :is-dark="isDark"
        @close="showShareModal = false"
        @favorite="handleQuoteFavorite"
        @share="handleQuoteShare"
      />

      <!-- ✅ 检查点1.3: 待办事项编辑器 -->
      <TodoEditor
        :visible="showTodoEditor"
        :todo-data="editingTodo"
        :is-dark="isDark"
        @close="showTodoEditor = false"
        @save="handleTodoSave"
        @delete="handleTodoDelete"
        @toggle="handleToggleTodo"
      />
    </view>

    <!-- ✅ P3: 离线状态指示器 -->
    <OfflineIndicator :auto-show="true" position="top" :auto-hide-delay="5000" />
  </view>
</template>

<script>
import { safeNavigateTo } from '@/utils/safe-navigate';
import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
import BaseSkeleton from '@/components/base/base-skeleton/base-skeleton.vue';
import TodoList from '@/components/common/TodoList.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import ShareModal from '@/components/common/share-modal.vue';
import TodoEditor from '@/components/common/todo-editor.vue';
import CustomModal from '@/components/common/CustomModal.vue';
import OfflineIndicator from '@/components/common/offline-indicator.vue';
import FormulaModal from '@/components/business/index/FormulaModal.vue';
import QuotePosterModal from '@/components/business/index/QuotePosterModal.vue';
import DailyQuoteCard from '@/components/business/index/DailyQuoteCard.vue';
import WelcomeBanner from '@/components/business/index/WelcomeBanner.vue';
import StatsGrid from '@/components/business/index/StatsGrid.vue';
import StudyTimeCard from '@/components/business/index/StudyTimeCard.vue';
import KnowledgeBubbleField from '@/components/business/index/KnowledgeBubbleField.vue';
import ActivityList from '@/components/business/index/ActivityList.vue';
import RecommendationsList from '@/components/business/index/RecommendationsList.vue';
import IndexHeaderBar from '@/components/business/index/IndexHeaderBar.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { useStudyStore } from '@/stores/modules/study';
import { useTodoStore } from '@/stores/modules/todo';
import { useUserStore } from '@/stores/modules/user';
import { useLearningTrajectoryStore } from '@/stores/modules/learning-trajectory-store';
import { storageService } from '@/services/storageService.js';
import { initTheme, toggleTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';
// F002-I2: bubbleInteraction moved to knowledgePointMixin
// ✅ 检查点 5.1: 导入页面追踪 Mixin
import { trackingMixin } from '@/utils/analytics/tracking-mixin.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { throttle } from '@/utils/throttle.js';
// ✅ F002: 提取的 Mixins
import { studyTimerMixin } from '@/mixins/studyTimerMixin.js';
import { dailyQuoteMixin } from '@/mixins/dailyQuoteMixin.js';
import { todoMixin } from '@/mixins/todoMixin.js';
// F002-I2: 知识点气泡交互 Mixin
import { knowledgePointMixin } from '@/mixins/knowledgePointMixin.js';
// F002-I3/I5: 推荐内容 & 导航跳转 Mixins
import { recommendationMixin } from '@/mixins/recommendationMixin.js';
import { navigationMixin } from '@/mixins/navigationMixin.js';
// ✅ P0-3: 从配置文件导入静态数据（消除硬编码）
import { QUOTE_LIBRARY, FORMULA_LIST, DEFAULT_KNOWLEDGE_POINTS, DEFAULT_USER_PREFERENCES } from '@/config/home-data.js';
// F002-I1a: 共享格式化工具
import { formatRelativeTime, getInitials as _getInitials } from '@/utils/formatters.js';
import PrivacyPopup from '@/components/common/privacy-popup.vue';

export default {
  components: {
    PrivacyPopup,
    CustomTabbar,
    BaseSkeleton,
    TodoList,
    EmptyState,
    ShareModal,
    TodoEditor,
    CustomModal,
    OfflineIndicator,
    FormulaModal,
    QuotePosterModal,
    DailyQuoteCard,
    WelcomeBanner,
    StatsGrid,
    StudyTimeCard,
    KnowledgeBubbleField,
    ActivityList,
    RecommendationsList,
    IndexHeaderBar,
    BaseIcon
  },
  // ✅ 检查点 5.1: 使用页面追踪 Mixin + F002 提取的 Mixins
  mixins: [
    trackingMixin,
    studyTimerMixin,
    dailyQuoteMixin,
    todoMixin,
    knowledgePointMixin,
    recommendationMixin,
    navigationMixin
  ],

  data() {
    return {
      isLoading: true,
      scrollY: 0,
      isDark: false,
      isRefreshing: false, // 下拉刷新状态

      // 沉浸式布局信息
      layoutInfo: {
        statusBarHeight: 44,
        navBarHeight: 88,
        tabBarHeight: 90,
        safeAreaBottom: 0
      },

      // Store实例
      studyStore: null,
      todoStore: null,
      userStore: null,
      trajectoryStore: null,

      // 成就徽章数量（从本地存储获取）
      achievementCount: 0,

      // ✅ 2.3: 统计数据从 computed 移到 data，避免每次渲染重复读取 storageService
      realTotalQuestions: 0,
      realAccuracy: 0,
      realStudyDays: 0,

      // 按钮防重复点击状态
      isNavigating: false,

      // ✅ 自定义弹窗状态
      showEmptyBankModal: false,
      showLoginModal: false,
      // 注意: showShareModal, showTodoEditor, editingTodo 由 dailyQuoteMixin/todoMixin 提供
      // 注意: isRefreshingQuote, quoteDate, dailyQuote, quoteAuthor, showQuotePoster 由 dailyQuoteMixin 提供
      // 注意: todayStudyTime, studyTimerInterval, sessionStartTime 由 studyTimerMixin 提供

      // ✅ 2.3: 静态数据移到 created/beforeCreate 避免 Vue 深度响应式开销
      // quoteLibrary, quoteAuthors, formulaList 在 created() 中赋值为非响应式属性

      // 知识点数据 - ✅ P0-3: 初始值从配置导入，后续由 loadKnowledgePoints() 动态计算
      knowledgePoints: DEFAULT_KNOWLEDGE_POINTS.map((p) => ({ ...p, count: 0, mastery: 0 })),

      // 个性化推荐内容
      personalizedRecommendations: [],

      // 用户学习偏好 - ✅ P0-3: 默认值从配置导入
      userPreferences: { ...DEFAULT_USER_PREFERENCES },

      // 最近活动 - ✅ P0-3: 默认空数组，由 loadRecentActivities() 动态填充
      recentActivities: [],

      // 公式定理弹窗
      showFormulaModal: false,

      // ✅ 检查点1.4: 气泡动画状态
      animatingBubbleId: null
      // F002-I1b: searchKeyword moved to IndexHeaderBar
    };
  },

  computed: {
    // 用户信息
    userName() {
      return this.userStore?.userInfo?.nickName || '小伙伴';
    },

    // 判断是否已登录
    isLoggedIn() {
      return !!(this.userStore?.isLogin || storageService.get('EXAM_USER_ID'));
    },

    // 学习统计数据
    finishedCount() {
      return this.studyStore?.studyProgress?.completedQuestions || 0;
    },

    totalStudyDays() {
      return this.studyStore?.studyProgress?.studyDays || 0;
    },

    // 真实统计数据：✅ 2.3 已移到 data()，由 loadData/refreshData 更新
    // realTotalQuestions, realAccuracy, realStudyDays 不再从 storageService 读取

    // 待办事项数据
    todos() {
      if (!this.todoStore?.tasks) return [];
      return this.todoStore.tasks.map((task) => ({
        id: task.id,
        text: task.title,
        completed: task.done,
        priority: task.tag || task.priority
      }));
    },

    // ✅ P0-1: 空状态判断 — 2.3: 基于 data 属性而非重复读 storage
    isQuestionBankEmpty() {
      return this.realTotalQuestions === 0;
    },

    // 用户头像URL
    userAvatarUrl() {
      return this.userStore?.userInfo?.avatarUrl || '/static/images/default-avatar.png';
    },

    isNewUser() {
      // 新用户判断：题库为空 且 学习天数为0
      return this.isQuestionBankEmpty && this.totalStudyDays === 0;
    }
  },

  created() {
    // ✅ 2.3: 静态配置数据作为非响应式实例属性，避免 Vue 递归观察大数组
    this.quoteLibrary = Object.freeze(QUOTE_LIBRARY.map((q) => q.text));
    this.quoteAuthors = Object.freeze(
      QUOTE_LIBRARY.reduce((map, q) => {
        map[q.text] = q.author;
        return map;
      }, {})
    );
    this.formulaList = Object.freeze(FORMULA_LIST);
  },

  // [F2-FIX] 微信分享配置
  onShareAppMessage() {
    return {
      title: 'Exam-Master — AI助力，一战成硕',
      path: '/pages/index/index'
    };
  },

  onLoad() {
    // 标记首次加载，避免 onShow 重复调用 refreshData
    this._skipFirstShow = true;

    // 初始化沉浸式布局信息
    this.initLayoutInfo();

    const savedTheme = initTheme();
    this.isDark = savedTheme;

    onThemeUpdate((mode) => {
      this.isDark = mode === 'dark';
    });

    // 监听登录状态变化
    this._loginHandler = (isLoggedIn) => {
      logger.log('[Index] 登录状态变化:', isLoggedIn);
      this.refreshData();
    };
    uni.$on('loginStatusChanged', this._loginHandler);

    // 初始化Store
    this.studyStore = useStudyStore();
    this.todoStore = useTodoStore();
    this.userStore = useUserStore();
    this.trajectoryStore = useLearningTrajectoryStore();

    // 初始化学习轨迹Store
    this.trajectoryStore.init();

    // 初始化每日金句
    this.initDailyQuote();

    // ✅ 检查点1.5: 初始化学习计时器
    this.initStudyTimer();

    // ✅ [Phase5] 静默登录已由 App.vue onLaunch 统一执行，此处不再重复调用
    // this.tryAutoLogin();

    this.loadData();
  },

  onShow() {
    // 原生 tabBar 已移除，无需隐藏
    // uni.hideTabBar({ animation: false });
    // F005: 通知 CustomTabbar 重新检测路由
    uni.$emit('tabbarRouteUpdate');

    // 首次 onShow 跳过 refreshData，因为 onLoad 已调用 loadData()
    if (this._skipFirstShow) {
      this._skipFirstShow = false;
    } else {
      this.refreshData();
    }

    // ✅ 检查点1.5: 恢复计时
    this.startStudyTimer();
  },

  onUnload() {
    offThemeUpdate();
    uni.$off('loginStatusChanged', this._loginHandler);

    // ✅ 检查点1.5: 停止计时
    this.stopStudyTimer();
  },

  methods: {
    // 初始化沉浸式布局信息
    initLayoutInfo() {
      try {
        const windowInfo = uni.getWindowInfo();
        const statusBarHeight = windowInfo.statusBarHeight || 44;
        const safeAreaBottom = windowInfo.safeAreaInsets?.bottom || 0;

        // 导航栏高度 = 状态栏 + 44px（标准导航栏高度）
        const navBarHeight = statusBarHeight + 44;

        // TabBar 高度 = 胶囊(60px) + margin(12px) + 安全区域
        const tabBarHeight = 60 + 12 + safeAreaBottom;

        this.layoutInfo = {
          statusBarHeight,
          navBarHeight,
          tabBarHeight,
          safeAreaBottom
        };

        logger.log('[Index] 布局信息初始化:', this.layoutInfo);
      } catch (_e) {
        logger.warn('[Index] 布局信息初始化失败，使用默认值:', _e);
        // 使用默认值
        this.layoutInfo = {
          statusBarHeight: 44,
          navBarHeight: 88,
          tabBarHeight: 90,
          safeAreaBottom: 34
        };
      }
    },

    async loadData() {
      try {
        // 1. 恢复用户信息（同步操作，立即执行）
        this.userStore.restoreUserInfo();

        // 2. 恢复学习进度（同步操作）
        this.studyStore.restoreProgress();

        // 3. 加载待办事项（同步操作）
        this.todoStore.initTasks();

        // ✅ 2.3: 同步更新统计数据（避免 computed 重复读 storage）
        this._refreshStats();

        // 4-8: 并行加载所有异步/独立数据，提升首屏速度
        // ✅ F011: 使用 allSettled 替代 all，单个模块失败不影响其他模块加载
        const results = await Promise.allSettled([
          this.loadAchievements(),
          this.loadKnowledgePoints(),
          this.loadRecentActivities(),
          this.loadPersonalizedRecommendations(),
          this.loadUserPreferences()
        ]);

        // 记录失败的模块（不阻断页面展示）
        const failed = results.filter((r) => r.status === 'rejected');
        if (failed.length > 0) {
          logger.warn(
            `[Index] ${failed.length} 个模块加载失败:`,
            failed.map((r) => r.reason?.message || r.reason)
          );
        }
      } catch (error) {
        logger.error('[Index] 数据加载失败:', error);
        uni.showToast({
          title: '部分数据加载失败',
          icon: 'none'
        });
      } finally {
        setTimeout(() => {
          this.isLoading = false;
        }, 300);
      }
    },

    refreshData() {
      // 刷新所有数据
      try {
        this.studyStore.restoreProgress();
        this.todoStore.initTasks();
        this.userStore.restoreUserInfo();
        // ✅ 2.3: 统一更新统计数据（从 computed 移到此处，避免重复读 storage）
        this._refreshStats();
        this.loadAchievements();
        this.loadKnowledgePoints();
        this.loadRecentActivities();
      } catch (e) {
        logger.error('[Index] refreshData 异常:', e);
        // P007: 刷新失败时提供用户反馈
        uni.showToast({ title: '数据刷新失败，请稍后重试', icon: 'none', duration: 1500 });
      }
    },

    // ✅ 2.3: 集中更新统计数据，避免 computed 中重复读取 storageService
    _refreshStats() {
      try {
        const questionBank = storageService.get('v30_bank', []);
        this.realTotalQuestions = Array.isArray(questionBank) ? questionBank.length : 0;
      } catch (_e) {
        this.realTotalQuestions = 0;
      }

      try {
        const storeAccuracy = parseFloat(this.studyStore?.accuracy || 0);
        if (storeAccuracy > 0) {
          this.realAccuracy = storeAccuracy;
        } else {
          const studyRecord = storageService.get('study_record', {});
          const correct = studyRecord.correctCount || 0;
          const total = studyRecord.totalAnswered || 0;
          this.realAccuracy = total === 0 ? 0 : Math.round((correct / total) * 100);
        }
      } catch (_e) {
        this.realAccuracy = 0;
      }

      try {
        const storeDays = this.studyStore?.studyProgress?.studyDays || 0;
        if (storeDays > 0) {
          this.realStudyDays = storeDays;
        } else {
          const studyDates = storageService.get('study_dates', []);
          this.realStudyDays = Array.isArray(studyDates) ? studyDates.length : 0;
        }
      } catch (_e) {
        this.realStudyDays = 0;
      }
    },

    // 下拉刷新处理
    async onPullDownRefresh() {
      logger.log('[Index] 触发下拉刷新');
      this.isRefreshing = true;

      try {
        // 刷新所有数据
        await this.loadData();

        // 刷新每日金句
        this.refreshDailyQuote();

        uni.showToast({
          title: '刷新成功',
          icon: 'success',
          duration: 1500
        });
      } catch (error) {
        logger.error('[Index] 下拉刷新失败:', error);
        uni.showToast({
          title: '刷新失败',
          icon: 'none'
        });
      } finally {
        // 延迟关闭刷新状态，确保动画完成
        setTimeout(() => {
          this.isRefreshing = false;
        }, 500);
      }
    },

    loadAchievements() {
      // 从本地存储获取成就数量
      const achievements = storageService.get('learning_achievements', []);
      this.achievementCount = Array.isArray(achievements) ? achievements.length : 0;
    },

    // F002-I2: loadKnowledgePoints moved to knowledgePointMixin

    loadRecentActivities() {
      // 从学习历史获取最近活动
      const history = this.studyStore?.questionHistory || [];

      if (history.length > 0) {
        this.recentActivities = history.slice(0, 4).map((record) => ({
          title: `练习：${record.questionType || '综合题'}`,
          subtitle: record.isCorrect ? '答对，继续保持' : '答错，已加入错题本',
          time: this.formatTime(record.timestamp),
          icon: record.isCorrect ? 'check' : 'cross',
          status: record.isCorrect ? 'completed' : 'in-progress'
        }));
      } else {
        // 默认活动
        this.recentActivities = [
          { title: '开始学习', subtitle: '欢迎使用Exam-Master', time: '刚刚', icon: 'celebrate', status: 'completed' }
        ];
      }
    },

    // F002-I3: loadPersonalizedRecommendations, loadUserPreferences moved to recommendationMixin

    // F002-I1a: 委托给共享工具函数
    formatTime(timestamp) {
      return formatRelativeTime(timestamp);
    },

    // F002-I1a: 委托给共享工具函数
    getInitials(name) {
      return _getInitials(name);
    },

    toggleTheme() {
      this.isDark = toggleTheme(this.isDark);
      vibrateLight();
    },

    // F002-I1b: onAvatarError, handleSearchTap, onSearchFocus, doSearch, goToLogin
    // moved to IndexHeaderBar component

    // F002-I5: openLoginModal, navToPractice, navToMockExam, navToStudyDetail, handleStatClick
    // moved to navigationMixin

    // F002-I2: handleKnowledgeClick, navToHotTopics, navToConcepts, navToFormulas, navToReading
    // moved to knowledgePointMixin

    // ✅ F002: handleEditPlan, handleToggleTodo 由 todoMixin 提供

    // 实用工具导航
    navToTool(name) {
      safeNavigateTo(`/pages/tools/${name}`);
    },

    // ✅ F023: 节流滚动监听，减少重渲染
    handleScroll(e) {
      if (!this._throttledScroll) {
        this._throttledScroll = throttle((scrollTop) => {
          this.scrollY = scrollTop;
        }, 16); // ~60fps
      }
      this._throttledScroll(e.detail.scrollTop);
    },

    // ✅ P0-1: 处理空状态引导点击
    handleEmptyGuideAction(event) {
      logger.log('[Index] Empty guide action:', event.type);

      // 根据引导类型执行不同操作
      switch (event.type) {
        case 'new_user_onboarding':
          // 新用户引导 - 跳转到资料导入页
          safeNavigateTo('/pages/practice-sub/import-data');
          break;
        case 'empty_question_bank':
          // 题库为空 - 跳转到资料导入页
          safeNavigateTo('/pages/practice-sub/import-data');
          break;
        case 'empty_todo':
          // 待办为空 - 跳转到创建计划页
          safeNavigateTo('/pages/plan/create');
          break;
        default:
          // 默认跳转到资料导入页
          safeNavigateTo('/pages/practice-sub/import-data');
      }
    },

    // ✅ 处理题库为空弹窗确认
    handleEmptyBankConfirm() {
      this.showEmptyBankModal = false;
      safeNavigateTo('/pages/practice-sub/import-data');
    },

    // ✅ 处理登录弹窗确认 - 跳转到统一登录页面
    handleLoginConfirm() {
      this.showLoginModal = false;

      // 所有平台统一跳转登录页，确保用户必须同意隐私协议后才能登录
      safeNavigateTo('/pages/login/index', {
        fail: (err) => {
          logger.error('[Index] 跳转登录页失败:', err);
          // 备选方案：跳转到设置页
          safeNavigateTo('/pages/settings/index', {
            success: () => {
              uni.showToast({
                title: '请点击头像完成登录',
                icon: 'none',
                duration: 2000
              });
            }
          });
        }
      });
    },

    // ✅ 微信小程序静默登录
    async doSilentLogin() {
      try {
        uni.showLoading({ title: '登录中...' });

        const result = await this.userStore.login(false); // 非静默模式，显示错误

        uni.hideLoading();

        if (result.success) {
          uni.showToast({ title: '登录成功', icon: 'success' });
          // 刷新页面数据
          this.refreshData();
        } else {
          // 静默登录失败，跳转到登录页让用户手动操作
          safeNavigateTo('/pages/login/index');
        }
      } catch (error) {
        uni.hideLoading();
        logger.error('[Index] 静默登录失败:', error);
        uni.showToast({ title: '登录失败，请重试', icon: 'none' });
      }
    }

    // ✅ F002: 每日金句功能由 dailyQuoteMixin 提供
    // (initDailyQuote, generateDailyQuote, refreshDailyQuote, openQuotePoster,
    //  getCurrentDate, saveQuotePoster, handleQuoteFavorite, handleQuoteShare)

    // ✅ F002: 待办事项功能由 todoMixin 提供
    // (handleTodoSave, handleTodoDelete, openTodoEditor)

    // F002-I3: handleRecommendationClick moved to recommendationMixin

    // ✅ F002: 学习计时器功能由 studyTimerMixin 提供
    // (initStudyTimer, startStudyTimer, stopStudyTimer, saveStudyTime, formatStudyTime, handleStudyTimeClick)
  }
};
</script>

<style lang="scss" scoped>
/* ==================== 页面最外层容器 ==================== */
.page-wrapper {
  min-height: 100vh;
  position: relative;
  /* 关键：最外层背景白色，这样 TabBar 下方不会显示绿色 */
  background-color: #ffffff;
}

/* 深色模式下的页面背景 */
.page-wrapper.page-dark {
  background-color: #080808;
}

.dashboard-container {
  min-height: 100vh;
  background-color: var(--bg-page);
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1rpx solid var(--border);
}

.card-light {
  background: var(--card);
}

/* F002-I1b: 顶部导航栏样式已移至 IndexHeaderBar.vue */

/* ==================== 主内容区域：沉浸式全屏布局 ==================== */
.main-content-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100vh;
  width: 100%;
  z-index: 1;
  box-sizing: border-box;
  -webkit-overflow-scrolling: touch;
}

/* 自定义下拉刷新指示器 */
.custom-refresher {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 32rpx 0;
}

.refresher-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
}

.refresher-spinner {
  width: 48rpx;
  height: 48rpx;
  border: 4rpx solid var(--border);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.refresher-text {
  font-size: 24rpx;
  color: var(--text-sub);
}

/* 内容包装器 */
.content-wrapper {
  padding: var(--ds-spacing-xl, 48rpx) var(--ds-spacing-lg, 32rpx);
}

/* ==================== 章节标题（保留：待办事项区域仍在父组件） ==================== */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32rpx;
}

.section-title {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.section-action {
  font-size: 28rpx;
  color: var(--primary);
  font-weight: 500;
}

/* ==================== 编辑计划按钮 ==================== */
.edit-plan-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 24rpx;
  border-radius: 20rpx;
  background: var(--primary);
  color: var(--primary-foreground);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.edit-plan-btn:active {
  transform: scale(0.95);
  opacity: 0.8;
}

.edit-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.edit-text {
  font-size: 24rpx;
  font-weight: 600;
}

/* ==================== 实用工具入口 ==================== */
.tools-grid {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-bottom: 48rpx;
}

.tool-entry {
  display: flex;
  align-items: center;
  padding: 28rpx 24rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--border);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tool-entry-hover {
  transform: scale(0.97);
  opacity: 0.85;
}

.tool-icon-wrapper {
  position: relative;
  width: 88rpx;
  height: 88rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.tool-icon-glow {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  border-radius: 50%;
  opacity: 0.25;
  filter: blur(8px);
}

.tool-icon-doc {
  background: linear-gradient(135deg, #36d1dc, #5b86e5);
}

.tool-glow-doc {
  background: radial-gradient(circle, #36d1dc, transparent 70%);
}

.tool-icon-photo {
  background: linear-gradient(135deg, #e84393, #fd79a8);
}

.tool-glow-photo {
  background: radial-gradient(circle, #e84393, transparent 70%);
}

.tool-icon-search {
  background: linear-gradient(135deg, #667eea, #764ba2);
}

.tool-glow-search {
  background: radial-gradient(circle, #667eea, transparent 70%);
}

.tool-icon-glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

.tool-info {
  flex: 1;
  margin-left: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.tool-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.tool-desc {
  font-size: 22rpx;
  color: var(--text-secondary);
}

.tool-arrow {
  font-size: 36rpx;
  color: var(--text-secondary);
  opacity: 0.5;
  margin-left: 12rpx;
}

/* ✅ 问题清单修复：骨架屏淡出过渡动画 */
.skeleton-fade-enter-active {
  transition: opacity 0.2s ease-in;
}
.skeleton-fade-leave-active {
  transition: opacity 0.35s ease-out;
}
.skeleton-fade-enter-from,
.skeleton-fade-leave-to {
  opacity: 0;
}
</style>
