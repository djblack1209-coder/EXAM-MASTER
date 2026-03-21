<template>
  <!-- 最外层：页面容器 -->
  <view id="e2e-home-root" :class="['page-wrapper', { 'page-dark': isDark }]">
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
            <text class="refresher-text"> 正在刷新... </text>
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

          <!-- ✅ 每日目标进度环 — 首页核心 CTA -->
          <DailyGoalRing
            v-if="!isNewUser"
            :today-questions="todayQuestionCount"
            :streak-days="realStudyDays"
            :is-dark="isDark"
            @start-practice="navToPractice"
          />

          <!-- ✅ [零摩擦] 一键续刷 — 记住上次位置，打开app直接继续 -->
          <view v-if="hasUnfinished && !isNewUser" class="resume-banner apple-glass-card" @tap="resumeLastSession">
            <view class="resume-banner-left">
              <text class="resume-banner-icon">▶</text>
              <view class="resume-banner-info">
                <text class="resume-banner-title">继续上次练习</text>
                <text class="resume-banner-sub">{{ resumeSummary }}</text>
              </view>
            </view>
            <text class="resume-banner-arrow">›</text>
          </view>

          <!-- ✅ [P0重构] 今日复习强入口 — FSRS 本地调度驱动 -->
          <view v-if="!isNewUser" class="review-banner apple-glass-card" @tap="goSmartReview">
            <view class="review-banner-left">
              <text class="review-banner-icon">{{ reviewPending > 0 ? '🔥' : '✅' }}</text>
              <view class="review-banner-info">
                <text class="review-banner-title">今日复习</text>
                <text class="review-banner-sub">{{
                  reviewPending > 0
                    ? reviewPending +
                      ' 题待复习' +
                      (reviewStats.overdueCount > 0 ? '，' + reviewStats.overdueCount + ' 题已逾期' : '')
                    : '所有复习已完成！'
                }}</text>
              </view>
            </view>
            <text class="review-banner-arrow">›</text>
          </view>

          <!-- ✅ P0-1: 新用户空状态引导 - 增强版 -->
          <EmptyState
            v-if="isNewUser"
            type="home"
            title="开启你的学习之旅"
            description="上传学习资料，智能将为你智能生成专属题库，让备考更高效！"
            hint="支持 PDF、Word、图片等多种格式"
            :theme="isDark ? 'dark' : 'light'"
            @upload="handleEmptyGuideAction({ type: 'new_user_onboarding' })"
            @quick-start="handleQuickStart"
            @tutorial="handleTutorial"
          />

          <!-- 今日数据一览 -->
          <view v-if="!isNewUser" class="today-dashboard">
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
          </view>

          <!-- ✅ [知识引擎] 智能学习推荐 -->
          <view v-if="recommendedTopic && !isNewUser" class="smart-recommend apple-glass-card" @tap="goSmartReview">
            <view class="smart-recommend-header">
              <text class="smart-recommend-icon">🎯</text>
              <text class="smart-recommend-title">推荐学习</text>
            </view>
            <text class="smart-recommend-name">{{ recommendedTopic.knowledgePoint }}</text>
            <text class="smart-recommend-reason">{{ recommendedTopic.reason }}</text>
          </view>

          <!-- 学习轨迹（限显3条） -->
          <ActivityList :is-dark="isDark" :activities="recentActivities.slice(0, 3)" @view-all="navToStudyDetail" />

          <!-- [首页精简] 个性化推荐 — 已合并到智能推荐卡片，注释隐藏 -->
          <!-- <RecommendationsList
            :is-dark="isDark"
            :recommendations="personalizedRecommendations"
            @recommendation-click="handleRecommendationClick"
          /> -->

          <!-- [首页精简] 拍照搜题快捷入口 — 可从工具页访问，注释隐藏 -->
          <!-- <view class="quick-tool-row">
            <view
              id="e2e-home-tool-photo-search"
              :class="['quick-tool-entry', 'apple-glass-card', isDark ? 'glass' : 'card-light']"
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
                <text class="tool-name"> 拍照搜题 </text>
                <text class="tool-desc"> 拍一拍，AI 秒解 </text>
              </view>
              <text class="tool-arrow"> › </text>
            </view>
          </view> -->

          <!-- [首页精简] 待办事项清单 — 可从个人中心访问，注释隐藏 -->
          <!-- <view class="section-header section-header-apple">
            <text class="section-title"> 待办事项 </text>
            <view id="e2e-home-edit-plan" class="edit-plan-btn apple-glass-pill" @tap="handleEditPlan">
              <view class="edit-icon">
                <BaseIcon name="edit" :size="24" />
              </view>
              <text class="edit-text"> 编辑计划 </text>
            </view>
          </view>
          <TodoList :todos="todos" :is-dark="isDark" @toggle-todo="handleToggleTodo" @edit-todo="openTodoEditor" /> -->

          <!-- ✅ [P0重构] DailyQuoteCard 已移除，首页精简 -->
        </view>
        <!-- 内容包装器结束 -->

        <!-- 底部占位：为 TabBar 留空 -->
        <view :style="{ height: layoutInfo.tabBarHeight + 20 + 'px', background: 'transparent' }" />
      </scroll-view>

      <!-- 骨架屏：✅ 问题清单修复 - 添加淡出过渡动画 -->
      <!-- #ifdef APP-PLUS -->
      <BaseSkeleton v-if="isLoading" :is-dark="isDark" />
      <!-- #endif -->
      <!-- #ifndef APP-PLUS -->
      <!-- #ifndef APP-NVUE -->
      <transition name="skeleton-fade">
        <BaseSkeleton v-if="isLoading" :is-dark="isDark" />
      </transition>
      <!-- #endif -->
      <!-- #ifdef APP-NVUE -->
      <BaseSkeleton v-if="isLoading" :is-dark="isDark" />
      <!-- #endif -->
      <!-- #endif -->
    </view>

    <!-- 底部导航栏：放在 dashboard-container 外部，避免继承绿色背景 -->
    <CustomTabbar :is-dark="isDark" />

    <!-- 弹窗容器：需要继承 dark 类以获取暗色 CSS 变量 -->
    <view :class="{ dark: isDark }">
      <!-- 公式定理弹窗 -->
      <FormulaModal :visible="showFormulaModal" :formula-list="formulaList" @close="showFormulaModal = false" />

      <!-- ✅ [P0重构] QuotePosterModal 已移除，首页精简 -->

      <!-- ✅ 自定义弹窗：题库为空 -->
      <CustomModal
        :visible="showEmptyBankModal"
        type="upload"
        title="题库空空如也"
        content="上传学习资料，智能将为您智能生成专属题库，开启高效刷题之旅！"
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

      <!-- ✅ [差异化壁垒] 学习风格Onboarding — 首次使用3步配置 -->
      <view v-if="showStyleOnboarding" class="onboarding-overlay">
        <view class="onboarding-card" :class="{ 'dark-mode': isDark }">
          <!-- Step指示器 -->
          <view class="onboarding-steps">
            <view
              v-for="i in 3"
              :key="i"
              :class="['step-dot', { active: onboardingStep === i, done: onboardingStep > i }]"
            />
          </view>

          <!-- Step 1: 目标分数 -->
          <view v-if="onboardingStep === 1" class="onboarding-content">
            <text class="onboarding-title">你的目标分数是？</text>
            <text class="onboarding-desc">帮助AI调整解析深度</text>
            <view class="onboarding-options">
              <view
                v-for="s in [300, 350, 400, 450]"
                :key="s"
                :class="['ob-option', { selected: obTargetScore === s }]"
                @tap="obTargetScore = s"
              >
                <text>{{ s }}+</text>
              </view>
            </view>
          </view>

          <!-- Step 2: 学习深度 -->
          <view v-if="onboardingStep === 2" class="onboarding-content">
            <text class="onboarding-title">你目前的水平？</text>
            <text class="onboarding-desc">AI会匹配你的节奏</text>
            <view class="onboarding-options vertical">
              <view
                v-for="d in styleDepths"
                :key="d.id"
                :class="['ob-option-row', { selected: obDepth === d.id }]"
                @tap="obDepth = d.id"
              >
                <text class="ob-option-label">{{ d.label }}</text>
                <text class="ob-option-desc">{{ d.desc }}</text>
              </view>
            </view>
          </view>

          <!-- Step 3: AI语气 -->
          <view v-if="onboardingStep === 3" class="onboarding-content">
            <text class="onboarding-title">你喜欢什么风格的AI？</text>
            <text class="onboarding-desc">答错时AI怎么跟你说</text>
            <view class="onboarding-options">
              <view
                v-for="t in styleTones"
                :key="t.id"
                :class="['ob-option', { selected: obTone === t.id }]"
                @tap="obTone = t.id"
              >
                <text>{{ t.label }}</text>
              </view>
            </view>
          </view>

          <view class="onboarding-actions">
            <button v-if="onboardingStep > 1" class="ob-btn-skip" @tap="onboardingStep--">上一步</button>
            <button class="ob-btn-next" @tap="nextOnboardingStep">
              {{ onboardingStep === 3 ? '开始学习' : '下一步' }}
            </button>
          </view>
        </view>
      </view>

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

      <!-- [首页精简] 待办事项编辑器 — 随 TodoList 一起隐藏 -->
      <!-- <TodoEditor
        :visible="showTodoEditor"
        :todo-data="editingTodo"
        :is-dark="isDark"
        @close="showTodoEditor = false"
        @save="handleTodoSave"
        @delete="handleTodoDelete"
        @toggle="handleToggleTodo"
      /> -->
    </view>

    <!-- ✅ P3: 离线状态指示器 -->
    <OfflineIndicator :auto-show="true" position="top" :auto-hide-delay="5000" />
  </view>
</template>

<script>
import { safeNavigateTo } from '@/utils/safe-navigate';
import { lafService } from '@/services/lafService.js';
import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
import BaseSkeleton from '@/components/base/base-skeleton/base-skeleton.vue';
// TodoList, TodoEditor — 已从首页模板移除，通过 profile 页访问
import EmptyState from '@/components/common/EmptyState.vue';
import ShareModal from '@/components/common/share-modal.vue';
// TodoEditor — 已从首页移除
import CustomModal from '@/components/common/CustomModal.vue';
import OfflineIndicator from '@/components/common/offline-indicator.vue';
import FormulaModal from '@/components/business/index/FormulaModal.vue';
// ✅ [P0重构] QuotePosterModal, DailyQuoteCard 已移除（首页精简）
import WelcomeBanner from '@/components/business/index/WelcomeBanner.vue';
import StatsGrid from '@/components/business/index/StatsGrid.vue';
import StudyTimeCard from '@/components/business/index/StudyTimeCard.vue';
// ✅ [P0重构] KnowledgeBubbleField 已移除（首页精简）
import ActivityList from '@/components/business/index/ActivityList.vue';
// RecommendationsList — 已从首页移除（smart-recommend 替代）
import IndexHeaderBar from '@/components/business/index/IndexHeaderBar.vue';
// BaseIcon — 首页不再直接使用
import { useStudyStore } from '@/stores/modules/study';
import { useTodoStore } from '@/stores/modules/todo';
import { useUserStore } from '@/stores/modules/user';
import { useLearningTrajectoryStore } from '@/stores/modules/learning-trajectory-store';
import { storageService } from '@/services/storageService.js';
import { initTheme, toggleTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';
// F002-I2: bubbleInteraction moved to knowledgePointMixin
// ✅ 检查点 5.1: 导入页面追踪 Mixin（保留：lifecycle hooks依赖Options API）
import { trackingMixin } from '@/utils/analytics/tracking-mixin.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { throttle } from '@/utils/throttle.js';
// ✅ F002: 保留需要lifecycle hooks的Mixins
import { studyTimerMixin } from '@/mixins/studyTimerMixin.js';
import { dailyQuoteMixin } from '@/mixins/dailyQuoteMixin.js';
// F002-I2: 知识点气泡交互 Mixin（保留：复杂DOM交互）
// F002-I2: knowledgePointMixin 已移除（KnowledgeBubbleField 已移除）
// ✅ [P0重构] 迁移为Composables的模块
import { useRecommendations } from '@/composables/useRecommendations.js';
import { useNavigation } from '@/composables/useNavigation.js';
import { useTodo } from '@/composables/useTodo.js';
// ✅ P0-3: 从配置文件导入静态数据（消除硬编码）
import { QUOTE_LIBRARY, FORMULA_LIST, DEFAULT_KNOWLEDGE_POINTS } from '@/config/home-data.js';
// ✅ [零摩擦] 检测未完成的答题进度
import { hasUnfinishedProgress, getProgressSummary } from '@/composables/useQuizAutoSave.js';
// ✅ [差异化壁垒] 学习风格onboarding配置项
import { DEPTH_LEVELS, TONE_OPTIONS } from '@/composables/useLearningStyle.js';
// F002-I1a: 共享格式化工具
import { formatRelativeTime, getInitials as _getInitials } from '@/utils/formatters.js';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
// ✅ [FSRS] 本地间隔重复调度统计
import { getReviewStats } from '@/services/fsrs-service.js';
// ✅ [知识引擎] 智能学习推荐
import { getNextRecommendedTopic } from '@/services/knowledge-engine.js';
import { syncFSRSParams } from '@/services/fsrs-optimizer-client.js';

export default {
  components: {
    PrivacyPopup,
    CustomTabbar,
    BaseSkeleton,
    EmptyState,
    ShareModal,
    CustomModal,
    OfflineIndicator,
    FormulaModal,
    WelcomeBanner,
    StatsGrid,
    StudyTimeCard,
    ActivityList,
    IndexHeaderBar
  },
  // ✅ [P0重构] 保留需要lifecycle hooks的Mixins，其余已迁移为Composables
  mixins: [trackingMixin, studyTimerMixin, dailyQuoteMixin],

  // ✅ [P0重构] Composables桥接到Options API
  setup() {
    const {
      personalizedRecommendations,
      userPreferences,
      loadPersonalizedRecommendations,
      loadUserPreferences,
      handleRecommendationClick
    } = useRecommendations();
    const {
      isNavigating,
      showEmptyBankModal,
      showLoginModal,
      openLoginModal,
      navToPractice,
      navToMockExam,
      navToStudyDetail,
      handleStatClick,
      handleQuickStart,
      handleTutorial,
      tryAutoLogin
    } = useNavigation();
    const todoStore = useTodoStore();
    const {
      showTodoEditor,
      editingTodo,
      handleEditPlan,
      handleToggleTodo,
      handleTodoSave,
      handleTodoDelete,
      openTodoEditor
    } = useTodo(todoStore);

    return {
      // recommendations
      personalizedRecommendations,
      userPreferences,
      loadPersonalizedRecommendations,
      loadUserPreferences,
      handleRecommendationClick,
      // navigation
      isNavigating,
      showEmptyBankModal,
      showLoginModal,
      openLoginModal,
      navToPractice,
      navToMockExam,
      navToStudyDetail,
      handleStatClick,
      handleQuickStart,
      handleTutorial,
      tryAutoLogin,
      // todo
      todoStore,
      showTodoEditor,
      editingTodo,
      handleEditPlan,
      handleToggleTodo,
      handleTodoSave,
      handleTodoDelete,
      openTodoEditor
    };
  },

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

      // Store实例（todoStore 已由 setup() 中的 useTodo 提供）
      studyStore: null,
      userStore: null,
      trajectoryStore: null,

      // 成就徽章数量（从本地存储获取）
      achievementCount: 0,

      // ✅ 2.3: 统计数据从 computed 移到 data，避免每次渲染重复读取 storageService
      realTotalQuestions: 0,
      realAccuracy: 0,
      realStudyDays: 0,
      todayQuestionCount: 0,

      // ✅ [P0重构] isNavigating, showEmptyBankModal, showLoginModal 已由 useNavigation composable 提供
      // ✅ [P0重构] personalizedRecommendations, userPreferences 已由 useRecommendations composable 提供
      // ✅ [P0重构] showTodoEditor, editingTodo 已由 useTodo composable 提供

      // ✅ 自定义弹窗状态（登录弹窗已移至composable）
      // 注意: showShareModal, showTodoEditor, editingTodo 由 composable/mixin 提供

      // ✅ 2.3: 静态数据移到 created/beforeCreate 避免 Vue 深度响应式开销
      // quoteLibrary, quoteAuthors, formulaList 在 created() 中赋值为非响应式属性

      // 知识点数据 - ✅ P0-3: 初始值从配置导入，后续由 loadKnowledgePoints() 动态计算
      knowledgePoints: DEFAULT_KNOWLEDGE_POINTS.map((p) => ({ ...p, count: 0, mastery: 0 })),

      // ✅ [P0重构] personalizedRecommendations 已由 useRecommendations composable 提供

      // ✅ [闭环核心] 今日复习待复习数量
      reviewPending: 0,
      // ✅ [FSRS] 本地调度统计详情
      reviewStats: { dueCount: 0, newCount: 0, learningCount: 0, overdueCount: 0 },

      // ✅ [知识引擎] 推荐学习主题
      recommendedTopic: null,

      // ✅ [零摩擦] 一键续刷状态
      hasUnfinished: false,
      resumeSummary: '',

      // ✅ [差异化壁垒] 学习风格Onboarding
      showStyleOnboarding: false,
      onboardingStep: 1,
      obTargetScore: 350,
      obDepth: 'standard',
      obTone: 'encouraging',
      styleDepths: DEPTH_LEVELS,
      styleTones: TONE_OPTIONS,

      // ✅ [P0重构] userPreferences 已由 useRecommendations composable 提供

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

  // #ifdef APP-PLUS
  onBackPress() {
    if (this._backPressTime && Date.now() - this._backPressTime < 2000) {
      return false; // 允许退出
    }
    this._backPressTime = Date.now();
    uni.showToast({ title: '再按一次退出应用', icon: 'none', duration: 2000 });
    return true; // 阻止默认退出
  },
  // #endif

  // [F2-FIX] 微信分享配置
  onShareAppMessage() {
    return {
      title: 'Exam-Master — 智能助力，一战成硕',
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

    // 监听登录状态变化（防止重复注册）
    if (this._loginHandler) {
      uni.$off('loginStatusChanged', this._loginHandler);
    }
    this._loginHandler = (isLoggedIn) => {
      logger.log('[Index] 登录状态变化:', isLoggedIn);
      this.refreshData().catch((e) => {
        logger.error('[Index] 登录状态刷新失败:', e);
      });
    };
    uni.$on('loginStatusChanged', this._loginHandler);

    // 初始化Store
    this.studyStore = useStudyStore();
    // todoStore 已在 setup() 中通过 useTodo 初始化
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

    // 重新注册登录状态监听（onHide 中已清理，防止累积）
    if (!this._loginHandler) {
      this._loginHandler = (isLoggedIn) => {
        logger.log('[Index] 登录状态变化:', isLoggedIn);
        this.refreshData().catch((e) => {
          logger.error('[Index] 登录状态刷新失败:', e);
        });
      };
    }
    uni.$on('loginStatusChanged', this._loginHandler);

    // 首次 onShow 跳过 refreshData，因为 onLoad 已调用 loadData()
    if (this._skipFirstShow) {
      this._skipFirstShow = false;
    } else {
      this.refreshData().catch((e) => {
        logger.error('[Index] onShow 刷新失败:', e);
      });
    }

    // ✅ 检查点1.5: 恢复计时
    this.startStudyTimer();

    // ✅ [闭环核心] 加载今日复习数量
    this.loadReviewPending();

    // ✅ [零摩擦] 每次回到首页检测未完成进度
    this.checkUnfinishedProgress();

    // ✅ [知识引擎] 加载推荐学习主题
    try {
      const allQuestions = storageService.get('v30_bank', []);
      if (allQuestions.length > 0) {
        this.recommendedTopic = getNextRecommendedTopic(allQuestions);
      }
    } catch (_e) {
      /* silent */
    }

    // ✅ [FSRS] 参数同步（非阻塞）
    syncFSRSParams().catch(() => {});
  },

  onUnload() {
    offThemeUpdate();
    uni.$off('loginStatusChanged', this._loginHandler);

    // ✅ 检查点1.5: 停止计时
    this.stopStudyTimer();
  },

  // ✅ P0-FIX: tabBar页面onUnload永不触发，必须在onHide中清理资源
  onHide() {
    this.stopStudyTimer();

    // 清理登录状态监听（tabBar 页面 onUnload 不触发，onShow 会重新注册）
    if (this._loginHandler) {
      uni.$off('loginStatusChanged', this._loginHandler);
      this._loginHandler = null;
    }
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

        // ✅ [零摩擦] 检测未完成的答题进度
        this.checkUnfinishedProgress();

        // 4-8: 并行加载所有异步/独立数据，提升首屏速度
        // ✅ F011: 使用 allSettled 替代 all，单个模块失败不影响其他模块加载
        const results = await Promise.allSettled([
          this.loadAchievements(),
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
        // 确保骨架屏至少显示 300ms（避免闪烁），但不超过实际加载时间
        this.isLoading = false;
      }
    },

    async refreshData() {
      // 刷新所有数据
      try {
        this.studyStore.restoreProgress();
        this.todoStore.initTasks();
        this.userStore.restoreUserInfo();
        // ✅ 2.3: 统一更新统计数据（从 computed 移到此处，避免重复读 storage）
        this._refreshStats();

        const settled = await Promise.allSettled([
          Promise.resolve().then(() => this.loadAchievements()),
          Promise.resolve().then(() => this.loadRecentActivities())
        ]);
        const failed = settled.filter((item) => item.status === 'rejected');
        if (failed.length > 0) {
          logger.warn(
            '[Index] refreshData 部分模块刷新失败:',
            failed.map((item) => item.reason)
          );
        }
      } catch (e) {
        logger.error('[Index] refreshData 异常:', e);
        // P007: 刷新失败时提供用户反馈
        uni.showToast({ title: '数据刷新失败，请稍后重试', icon: 'none', duration: 1500 });
      }
    },

    // ✅ [P0重构] 集中更新统计数据 — 使用 count 元数据，不再反序列化整个题库
    _refreshStats() {
      try {
        // 优先读取轻量 count 元数据，避免反序列化整个题库数组
        const cachedCount = storageService.get('v30_bank_count', -1);
        if (cachedCount >= 0) {
          this.realTotalQuestions = cachedCount;
        } else {
          // 首次或元数据丢失时回退到完整读取，并缓存 count
          const questionBank = storageService.get('v30_bank', []);
          this.realTotalQuestions = Array.isArray(questionBank) ? questionBank.length : 0;
          storageService.save('v30_bank_count', this.realTotalQuestions);
        }
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

      // 今日答题数（用于每日目标进度环）
      try {
        const today = new Date().toISOString().split('T')[0];
        const todayRecord = storageService.get('today_answer_count', { date: '', count: 0 });
        this.todayQuestionCount = todayRecord.date === today ? todayRecord.count || 0 : 0;
      } catch (_e) {
        this.todayQuestionCount = 0;
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

    // ✅ [闭环核心] 加载今日待复习数量（FSRS 本地优先 + 服务端增量同步）
    async loadReviewPending() {
      try {
        // 本地 FSRS 优先：从本地存储的题目计算待复习数量
        const allQuestions = storageService.get('v30_bank', []);
        if (allQuestions.length > 0) {
          const stats = getReviewStats(allQuestions);
          this.reviewStats = stats;
          this.reviewPending = stats.dueCount + stats.overdueCount;
        }

        // 服务端增量同步（不阻塞 UI）
        lafService
          .getReviewPlan()
          .then((res) => {
            if (res.code === 0 && res.data) {
              const serverPending = res.data.reviewPlan?.totalPending || 0;
              // 取本地和服务端的最大值，确保不遗漏
              if (serverPending > this.reviewPending) {
                this.reviewPending = serverPending;
              }
            }
          })
          .catch(() => {
            /* 静默失败，服务端不可用时依赖本地 FSRS */
          });
      } catch (_e) {
        // 静默失败，不影响首页
      }
    },

    // ✅ [闭环核心] 跳转智能复习
    goSmartReview() {
      safeNavigateTo('/pages/practice-sub/smart-review');
    },

    // ✅ [零摩擦] 一键续刷 — 直接跳转到上次未完成的答题
    resumeLastSession() {
      safeNavigateTo('/pages/practice-sub/do-quiz?resume=true');
    },

    // ✅ [零摩擦] 检测是否有未完成的答题进度
    checkUnfinishedProgress() {
      try {
        if (hasUnfinishedProgress()) {
          this.hasUnfinished = true;
          const summary = getProgressSummary();
          if (summary) {
            const answered = summary.answeredCount || 0;
            const total = summary.totalQuestions || 0;
            this.resumeSummary = `已答 ${answered}/${total} 题，点击继续`;
          } else {
            this.resumeSummary = '有未完成的练习，点击继续';
          }
        } else {
          this.hasUnfinished = false;
        }
      } catch (_e) {
        this.hasUnfinished = false;
      }
    },

    // ✅ [差异化壁垒] 学习风格Onboarding
    checkShowOnboarding() {
      try {
        const config = storageService.get('learning_style_config');
        if (!config && !this.isNewUser) {
          this.showStyleOnboarding = true;
        }
      } catch (_e) {
        /* silent */
      }
    },

    nextOnboardingStep() {
      if (this.onboardingStep < 3) {
        this.onboardingStep++;
        return;
      }
      // 完成：保存配置
      storageService.save('learning_style_config', {
        depth: this.obDepth,
        style: 'example',
        tone: this.obTone,
        targetScore: this.obTargetScore,
        weakSubjects: []
      });
      this.showStyleOnboarding = false;
      uni.showToast({ title: 'AI已为你个性化配置', icon: 'none' });
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
/* ==================== 首页精简：今日数据一览容器 ==================== */
.today-dashboard {
  margin: 0 30rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

/* ==================== 页面最外层容器 ==================== */
.page-wrapper {
  min-height: 100%;
  min-height: 100vh;
  position: relative;
  background-color: var(--bg-page);
}

/* 深色模式下的页面背景 */
.page-wrapper.page-dark {
  background-color: var(--bg-page);
}

.dashboard-container {
  min-height: 100%;
  min-height: 100vh;
  background: linear-gradient(
    180deg,
    var(--page-gradient-top, var(--bg-page)) 0%,
    var(--page-gradient-mid, var(--bg-page)) 56%,
    var(--page-gradient-bottom, var(--bg-page)) 100%
  );
  position: relative;
  overflow: hidden;
  isolation: isolate;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'SF Pro Text', 'Noto Sans SC', 'Roboto', sans-serif;
}

.dashboard-container::before,
.dashboard-container::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

.dashboard-container::before {
  width: 520rpx;
  height: 520rpx;
  right: -200rpx;
  top: -170rpx;
  background: radial-gradient(circle, var(--brand-tint-strong) 0%, transparent 72%);
  filter: blur(12rpx);
}

.dashboard-container::after {
  width: 480rpx;
  height: 480rpx;
  left: -170rpx;
  top: 420rpx;
  background: radial-gradient(circle, var(--brand-tint) 0%, transparent 74%);
  filter: blur(10rpx);
}

.page-dark .dashboard-container::before,
.page-dark .dashboard-container::after {
  opacity: 0.82;
}

.glass {
  background: var(--bg-card-alpha);
  backdrop-filter: blur(16rpx) saturate(130%);
  -webkit-backdrop-filter: blur(16rpx) saturate(130%);
  border: 1rpx solid rgba(255, 255, 255, 0.16);
}

.card-light {
  background: linear-gradient(165deg, #ffffff 0%, #f4faf6 100%);
}

/* F002-I1b: 顶部导航栏样式已移至 IndexHeaderBar.vue */

/* ==================== 主内容区域：沉浸式全屏布局 ==================== */
.main-content-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100%;
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
  /* gap: 16rpx; -- replaced for Android WebView compat */
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
  padding: 40rpx 30rpx;
}

@media screen and (max-width: 375px) {
  .content-wrapper {
    padding: 32rpx 22rpx;
  }

  .section-header {
    margin-bottom: 18rpx;
  }

  .section-title {
    font-size: 30rpx;
  }

  .section-header-apple .section-title {
    font-size: 22rpx;
    letter-spacing: 2rpx;
  }

  .edit-plan-btn {
    padding: 12rpx 18rpx;
  }

  .edit-text {
    font-size: 22rpx;
  }

  .tools-grid {
    margin-bottom: 32rpx;
  }

  .tool-entry {
    padding: 22rpx 18rpx;
    min-height: 104rpx;
  }

  .tool-icon-wrapper {
    width: 72rpx;
    height: 72rpx;
  }

  .tool-info {
    margin-left: 18rpx;
  }

  .tool-name {
    font-size: 26rpx;
  }

  .tool-desc {
    font-size: 22rpx;
  }

  .tool-arrow {
    font-size: 28rpx;
  }
}

/* ==================== 章节标题（保留：待办事项区域仍在父组件） ==================== */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 22rpx;
}

.section-header-apple {
  margin-bottom: 26rpx;
}

.section-title {
  font-size: 36rpx;
  font-weight: 680;
  letter-spacing: -0.2rpx;
  color: var(--text-primary);
}

.section-header-apple .section-title {
  font-size: 24rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
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
  /* gap: 8rpx; -- replaced for Android WebView compat */
  padding: 14rpx 24rpx;
  border-radius: 999rpx;
  background: #ffffff;
  color: #10281a;
  border: 1rpx solid rgba(16, 40, 26, 0.08);
  box-shadow: 0 10rpx 24rpx rgba(16, 40, 26, 0.16);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.edit-plan-btn:active {
  transform: scale(0.95);
  opacity: 0.8;
}

.page-dark .edit-plan-btn {
  background: var(--gradient-primary);
  color: var(--primary-foreground);
  border-color: transparent;
  box-shadow: var(--shadow-brand-sm);
}

.section-header-apple .edit-plan-btn {
  min-height: 88rpx;
  background: rgba(255, 255, 255, 0.78);
  border-color: rgba(255, 255, 255, 0.56);
  box-shadow: var(--apple-shadow-surface);
}

.page-dark .section-header-apple .edit-plan-btn {
  background: rgba(16, 20, 28, 0.72);
  border-color: rgba(124, 176, 255, 0.2);
  box-shadow: var(--apple-shadow-surface);
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

/* ==================== [P0重构] 拍照搜题快捷入口 ==================== */
.quick-tool-row {
  margin-bottom: 32rpx;
}

.quick-tool-entry {
  display: flex;
  align-items: center;
  padding: 26rpx 22rpx;
  min-height: 112rpx;
  border-radius: 28rpx;
  border: 1rpx solid var(--border);
  box-shadow: var(--apple-shadow-card);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.quick-tool-entry::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
  pointer-events: none;
}

/* ==================== 实用工具入口（已降级，保留样式兼容） ==================== */
.tools-grid {
  display: flex;
  flex-direction: column;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  margin-bottom: 42rpx;
}

.tool-entry {
  display: flex;
  align-items: center;
  padding: 26rpx 22rpx;
  min-height: 112rpx;
  border-radius: 28rpx;
  border: 1rpx solid var(--border);
  box-shadow: var(--apple-shadow-card);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.tool-entry-hover {
  transform: translateY(-2rpx);
  opacity: 0.92;
}

.tool-entry::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
  pointer-events: none;
}

.tool-icon-wrapper {
  position: relative;
  width: 82rpx;
  height: 82rpx;
  border-radius: 20rpx;
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
  opacity: 0.42;
  filter: blur(10rpx);
}

.tool-icon-doc {
  background: linear-gradient(145deg, #eaf8ef, #dff4e6);
}

.tool-glow-doc {
  background: radial-gradient(circle, var(--brand-glow), transparent 70%);
}

.tool-icon-photo {
  background: linear-gradient(145deg, #f1fbf5, #e7f7ee);
}

.tool-glow-photo {
  background: radial-gradient(circle, var(--brand-glow), transparent 70%);
}

.tool-icon-search {
  background: linear-gradient(145deg, #f3fbf6, #e9f8ef);
}

.tool-glow-search {
  background: radial-gradient(circle, var(--brand-glow), transparent 70%);
}

.page-dark .tool-icon-doc {
  background: linear-gradient(145deg, var(--brand-tint-strong), var(--brand-tint));
}

.page-dark .tool-icon-photo {
  background: linear-gradient(145deg, var(--brand-tint-strong), var(--brand-tint));
}

.page-dark .tool-icon-search {
  background: linear-gradient(145deg, var(--brand-tint-strong), var(--brand-tint));
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
  /* gap: 4rpx; -- replaced for Android WebView compat */
}

.tool-name {
  font-size: 28rpx;
  font-weight: 640;
  color: var(--text-primary);
}

.tool-desc {
  font-size: 23rpx;
  color: var(--text-secondary);
}

.tool-arrow {
  font-size: 32rpx;
  color: var(--text-secondary);
  opacity: 0.54;
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

/* ✅ [闭环核心] 今日复习入口 */
/* ==================== [零摩擦] 一键续刷入口 ==================== */
.resume-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  margin: 20rpx 32rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12), rgba(79, 70, 229, 0.08));
  border: 1rpx solid rgba(99, 102, 241, 0.25);
  animation: resumePulse 2s ease-in-out infinite;
}
.page-dark .resume-banner {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(79, 70, 229, 0.06));
  border-color: rgba(99, 102, 241, 0.2);
}
@keyframes resumePulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.15);
  }
  50% {
    box-shadow: 0 0 0 8rpx rgba(99, 102, 241, 0);
  }
}
.resume-banner-left {
  display: flex;
  align-items: center;
  flex: 1;
}
.resume-banner-icon {
  font-size: 40rpx;
  margin-right: 20rpx;
  color: #6366f1;
}
.resume-banner-info {
  display: flex;
  flex-direction: column;
}
.resume-banner-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-main);
}
.resume-banner-sub {
  font-size: 24rpx;
  color: var(--text-sub);
  margin-top: 4rpx;
}
.resume-banner-arrow {
  font-size: 36rpx;
  color: #6366f1;
  font-weight: 300;
}

/* ==================== [知识引擎] 智能学习推荐 ==================== */
.smart-recommend {
  margin: 20rpx 30rpx;
  padding: 24rpx 30rpx;
  cursor: pointer;
}
.smart-recommend:active {
  opacity: 0.85;
  transform: scale(0.98);
}
.smart-recommend-header {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-bottom: 12rpx;
}
.smart-recommend-icon {
  font-size: 32rpx;
}
.smart-recommend-title {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-secondary);
}
.smart-recommend-name {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary);
  display: block;
}
.smart-recommend-reason {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 6rpx;
  display: block;
}

/* ==================== [闭环核心] 今日复习入口 ==================== */
.review-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  margin: 20rpx 32rpx;
  border-radius: 20rpx;
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.12), rgba(16, 185, 129, 0.08));
  border: 1rpx solid rgba(52, 211, 153, 0.2);
}
.page-dark .review-banner {
  background: linear-gradient(135deg, rgba(52, 211, 153, 0.1), rgba(16, 185, 129, 0.06));
  border-color: rgba(52, 211, 153, 0.15);
}
.review-banner-left {
  display: flex;
  align-items: center;
  flex: 1;
}
.review-banner-icon {
  font-size: 44rpx;
  margin-right: 20rpx;
}
.review-banner-info {
  display: flex;
  flex-direction: column;
}
.review-banner-title {
  font-size: 30rpx;
  font-weight: 640;
  color: #10b981;
}
.page-dark .review-banner-title {
  color: #34d399;
}
.review-banner-sub {
  font-size: 24rpx;
  color: #6b7280;
  margin-top: 4rpx;
}
.page-dark .review-banner-sub {
  color: #8b949e;
}
.review-banner-arrow {
  font-size: 36rpx;
  color: #10b981;
  opacity: 0.6;
  margin-left: 12rpx;
}
</style>
