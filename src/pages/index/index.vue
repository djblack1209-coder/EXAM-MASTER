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
          <!-- 网络错误重试卡片 -->
          <view v-if="loadError && !isLoading" class="load-error-card" @tap="loadData">
            <BaseIcon name="warning" :size="48" />
            <view class="load-error-text">
              <text class="load-error-title">加载失败</text>
              <text class="load-error-hint">点击重试</text>
            </view>
            <BaseIcon name="refresh" :size="36" />
          </view>

          <!-- 欢迎横幅 -->
          <WelcomeBanner
            :is-dark="isDark"
            :user-name="userName"
            :finished-count="finishedCount"
            @nav-to-practice="navToPractice"
            @nav-to-mock-exam="navToMockExam"
          />

          <!-- AI 每日学习助手 — 首页核心 AI 入口 -->
          <AIDailyBriefing
            :is-dark="isDark"
            :is-new-user="isNewUser"
            :review-pending="reviewPending"
            :overdue-count="reviewStats.overdueCount || 0"
            :today-done="todayQuestionCount"
            :accuracy="realAccuracy"
            :exam-date="examDate || ''"
            :pending-corrections="0"
            :has-unfinished="hasUnfinished"
            @go-review="goSmartReview"
            @go-practice="navToPractice"
            @go-correction="navToMistakes"
            @go-chat="navToChat"
            @go-weak-training="goSmartReview"
            @resume-session="resumeLastSession"
          />

          <!-- 每日目标进度环（D022） -->
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
              <BaseIcon name="play" :size="36" />
              <view class="resume-banner-info">
                <text class="resume-banner-title">继续上次练习</text>
                <text class="resume-banner-sub">{{ resumeSummary }}</text>
              </view>
            </view>
            <BaseIcon name="arrow-right" :size="32" />
          </view>

          <!-- ✅ [P0重构] 今日复习强入口 — FSRS 本地调度驱动 -->
          <view v-if="!isNewUser" class="review-banner apple-glass-card" @tap="goSmartReview">
            <view class="review-banner-left">
              <BaseIcon :name="reviewPending > 0 ? 'clock' : 'check'" :size="36" />
              <view class="review-banner-info">
                <text class="review-banner-title">今日复习</text>
                <text class="review-banner-sub">
                  {{
                    reviewPending > 0
                      ? reviewPending +
                        ' 题待复习' +
                        (reviewStats.overdueCount > 0 ? '，' + reviewStats.overdueCount + ' 题已逾期' : '')
                      : '所有复习已完成！'
                  }}
                </text>
              </view>
            </view>
            <BaseIcon name="arrow-right" :size="32" />
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

            <!-- 学习热力图（最近 12 周） -->
            <StudyHeatmap
              v-if="heatmapData && Object.keys(heatmapData).length > 0"
              :study-data="heatmapData"
              :weeks="12"
              class="heatmap-compact"
            />
          </view>

          <!-- ✅ [知识引擎] 智能学习推荐 -->
          <view v-if="recommendedTopic && !isNewUser" class="smart-recommend apple-glass-card" @tap="goSmartReview">
            <view class="smart-recommend-header">
              <BaseIcon name="sparkle" :size="36" />
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

          <!-- 免费实用工具（引流入口） -->
          <view class="free-tools-section">
            <view class="free-tools-header">
              <text class="free-tools-title">备考工具箱</text>
              <text class="free-tools-badge">全部免费</text>
            </view>
            <view class="free-tools-grid">
              <view class="free-tool-card apple-glass-card" hover-class="tool-hover" @tap="navToTool('id-photo')">
                <view class="tool-card-icon-wrap">
                  <!-- 卡通图标替代装饰性 BaseIcon -->
                  <image class="feature-cartoon-icon" src="/static/icons/camera-search.png" mode="aspectFit" />
                </view>
                <text class="tool-card-title">证件照换底色</text>
                <text class="tool-card-desc">报名免裁剪</text>
                <view class="tool-card-tag">
                  <text class="tool-tag-text">考研报名必备</text>
                </view>
              </view>
              <view class="free-tool-card apple-glass-card" hover-class="tool-hover" @tap="navToTool('doc-convert')">
                <view class="tool-card-icon-wrap">
                  <!-- 卡通图标替代装饰性 BaseIcon -->
                  <image class="feature-cartoon-icon" src="/static/icons/doc-convert.png" mode="aspectFit" />
                </view>
                <text class="tool-card-title">文档格式转换</text>
                <text class="tool-card-desc">PDF/Word 互转</text>
                <view class="tool-card-tag">
                  <text class="tool-tag-text">资料整理必备</text>
                </view>
              </view>
              <view class="free-tool-card apple-glass-card" hover-class="tool-hover" @tap="navToTool('photo-search')">
                <view class="tool-card-icon-wrap">
                  <BaseIcon name="search" :size="48" />
                </view>
                <text class="tool-card-title">拍照搜题</text>
                <text class="tool-card-desc">AI 秒出答案</text>
                <view class="tool-card-tag">
                  <text class="tool-tag-text">AI 驱动</text>
                </view>
              </view>
            </view>
          </view>

          <!-- [P0重构] 待办事项、DailyQuoteCard 已移至个人中心，首页精简 -->
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
import { toast } from '@/utils/toast.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { safeImport } from '@/utils/helpers/safe-import.js';

// useReviewStore — 动态导入减小主包体积，通过 shallowRef 延迟注入
import CustomTabbar from '@/components/layout/custom-tabbar/custom-tabbar.vue';
import BaseSkeleton from '@/components/base/base-skeleton/base-skeleton.vue';
// TodoList, TodoEditor — 已从首页模板移除，通过 profile 页访问
// ✅ [BUG-FIX] defineAsyncComponent 在微信小程序中不受支持，
// 异步组件不会注册到 usingComponents，导致组件无法渲染（快速练习点击无反应的根因）。
// 全部改为静态 import。
import EmptyState from '@/components/common/EmptyState.vue';
import ShareModal from '@/components/common/share-modal.vue';
import CustomModal from '@/components/common/CustomModal.vue';
import OfflineIndicator from '@/components/common/offline-indicator.vue';
import FormulaModal from '@/components/business/index/FormulaModal.vue';
// ✅ [P0重构] QuotePosterModal, DailyQuoteCard 已移除（首页精简）
import WelcomeBanner from '@/components/business/index/WelcomeBanner.vue';
import StatsGrid from '@/components/business/index/StatsGrid.vue';
import StudyTimeCard from '@/components/business/index/StudyTimeCard.vue';
import StudyHeatmap from '@/components/business/index/StudyHeatmap.vue';
// ✅ [P0重构] KnowledgeBubbleField 已移除（首页精简）
import ActivityList from '@/components/business/index/ActivityList.vue';
// RecommendationsList — 已从首页移除（smart-recommend 替代）
import IndexHeaderBar from '@/components/business/index/IndexHeaderBar.vue';
import AIDailyBriefing from '@/components/business/index/AIDailyBriefing.vue';
import DailyGoalRing from '@/components/business/index/DailyGoalRing.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { useStudyStore } from '@/stores/modules/study';
import { useTodoStore } from '@/stores/modules/todo';
import { useUserStore } from '@/stores/modules/user';
// useLearningTrajectoryStore — 动态导入减小主包体积
import { storageService } from '@/services/storageService.js';
import { initTheme, toggleTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme.js';
// ✅ 检查点 5.1: 页面追踪已迁移为 composable
import { useTracking } from '@/composables/useTracking.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { vibrateLight } from '@/utils/helpers/haptic.js';
import { throttle } from '@/utils/throttle.js';
// ✅ F002: Mixin 已全部迁移为 Composables
import { useStudyTimer } from '@/composables/useStudyTimer.js';
import { useDailyQuote } from '@/composables/useDailyQuote.js';
// ✅ [P0重构] 迁移为Composables的模块
import { useRecommendations } from '@/composables/useRecommendations.js';
import { useNavigation } from '@/composables/useNavigation.js';
import { useTodo } from '@/composables/useTodo.js';
// ✅ [D002重构] 提取的 Composables
import { useHomeStats } from '@/composables/useHomeStats.js';
import { useHomeReview } from '@/composables/useHomeReview.js';
import { useStyleOnboarding } from '@/composables/useStyleOnboarding.js';
// ✅ P0-3: 从配置文件导入静态数据（消除硬编码）
import { QUOTE_LIBRARY, FORMULA_LIST, DEFAULT_KNOWLEDGE_POINTS } from '@/config/home-data.js';
// F002-I1a: 共享格式化工具
import { formatRelativeTime, getInitials as _getInitials } from '@/utils/formatters.js';
import PrivacyPopup from '@/components/common/privacy-popup.vue';
// syncFSRSParams, smartRequestSubscription — 动态导入减小主包体积

export default {
  components: {
    PrivacyPopup,
    BaseIcon,
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
    StudyHeatmap,
    ActivityList,
    IndexHeaderBar,
    AIDailyBriefing,
    DailyGoalRing
  },

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

    // ✅ 页面追踪（自动注册 onLoad/onShow/onHide/onUnload 钩子）
    useTracking();

    // ✅ 学习计时器
    const {
      todayStudyTime,
      studyTimerInterval,
      sessionStartTime,
      initStudyTimer,
      startStudyTimer,
      stopStudyTimer,
      saveStudyTime,
      formatStudyTime,
      handleStudyTimeClick
    } = useStudyTimer();

    // ✅ 每日金句（静态配置数据作为参数传入）
    const quoteLibrary = Object.freeze(QUOTE_LIBRARY.map((q) => q.text));
    const quoteAuthors = Object.freeze(
      QUOTE_LIBRARY.reduce((map, q) => {
        map[q.text] = q.author;
        return map;
      }, {})
    );
    const {
      isRefreshingQuote,
      quoteDate,
      dailyQuote,
      quoteAuthor,
      showQuotePoster,
      showShareModal,
      initDailyQuote,
      generateDailyQuote,
      refreshDailyQuote,
      openQuotePoster,
      getCurrentDate,
      saveQuotePoster,
      handleQuoteFavorite,
      handleQuoteShare
    } = useDailyQuote({ quoteLibrary, quoteAuthors });

    // ✅ [D002重构] 首页统计数据
    // reviewStore 延迟加载（动态导入减小主包体积），useHomeReview 内部已有 null 保护
    const reviewStore = null;
    const studyStoreInstance = useStudyStore();
    const homeStats = useHomeStats({ studyStore: studyStoreInstance });
    const homeReview = useHomeReview({ reviewStore });
    const styleOnboarding = useStyleOnboarding();

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
      openTodoEditor,
      // studyTimer
      todayStudyTime,
      studyTimerInterval,
      sessionStartTime,
      initStudyTimer,
      startStudyTimer,
      stopStudyTimer,
      saveStudyTime,
      formatStudyTime,
      handleStudyTimeClick,
      // dailyQuote
      quoteLibrary,
      quoteAuthors,
      isRefreshingQuote,
      quoteDate,
      dailyQuote,
      quoteAuthor,
      showQuotePoster,
      showShareModal,
      initDailyQuote,
      generateDailyQuote,
      refreshDailyQuote,
      openQuotePoster,
      getCurrentDate,
      saveQuotePoster,
      handleQuoteFavorite,
      handleQuoteShare,
      // ✅ reviewStore
      reviewStore,
      // ✅ [D002重构] 首页统计 composable
      realTotalQuestions: homeStats.realTotalQuestions,
      realAccuracy: homeStats.realAccuracy,
      realStudyDays: homeStats.realStudyDays,
      todayQuestionCount: homeStats.todayQuestionCount,
      achievementCount: homeStats.achievementCount,
      recentActivities: homeStats.recentActivities,
      heatmapData: homeStats.heatmapData,
      refreshStats: homeStats.refreshStats,
      loadAchievements: homeStats.loadAchievements,
      loadRecentActivities: homeStats.loadRecentActivities,
      loadHeatmapData: homeStats.loadHeatmapData,
      // ✅ [D002重构] 首页复习 composable
      reviewPending: homeReview.reviewPending,
      reviewStats: homeReview.reviewStats,
      recommendedTopic: homeReview.recommendedTopic,
      hasUnfinished: homeReview.hasUnfinished,
      resumeSummary: homeReview.resumeSummary,
      loadReviewPending: homeReview.loadReviewPending,
      loadRecommendedTopic: homeReview.loadRecommendedTopic,
      checkUnfinishedProgress: homeReview.checkUnfinishedProgress,
      goSmartReview: homeReview.goSmartReview,
      resumeLastSession: homeReview.resumeLastSession,
      // ✅ [D002重构] 学习风格引导 composable
      showStyleOnboarding: styleOnboarding.showStyleOnboarding,
      onboardingStep: styleOnboarding.onboardingStep,
      obTargetScore: styleOnboarding.obTargetScore,
      obDepth: styleOnboarding.obDepth,
      obTone: styleOnboarding.obTone,
      styleDepths: styleOnboarding.styleDepths,
      styleTones: styleOnboarding.styleTones,
      checkShowOnboarding: styleOnboarding.checkShowOnboarding,
      nextOnboardingStep: styleOnboarding.nextOnboardingStep
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

      // 用户考试类型（来自 onboarding）
      examType: '',
      examDate: '', // 考试日期（用于 AI 简报倒计时）
      dailyGoal: 20,

      // ✅ [D002重构] realTotalQuestions, realAccuracy, realStudyDays, todayQuestionCount,
      //    achievementCount, recentActivities, heatmapData 已由 useHomeStats composable 提供
      loadError: false,

      // ✅ [D002重构] reviewPending, reviewStats, recommendedTopic,
      //    hasUnfinished, resumeSummary 已由 useHomeReview composable 提供

      // ✅ [D002重构] showStyleOnboarding, onboardingStep, obTargetScore, obDepth, obTone,
      //    styleDepths, styleTones 已由 useStyleOnboarding composable 提供

      // 知识点数据 - ✅ P0-3: 初始值从配置导入
      knowledgePoints: DEFAULT_KNOWLEDGE_POINTS.map((p) => ({ ...p, count: 0, mastery: 0 })),

      // 公式定理弹窗
      showFormulaModal: false,

      // ✅ 检查点1.4: 气泡动画状态
      animatingBubbleId: null
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
  // ✅ [P0重构] 所有 Mixin 已迁移为 Composables

  // 错误边界：捕获子组件运行时错误，防止整个页面白屏
  errorCaptured(err, instance, info) {
    logger.error('[首页] 子组件运行时错误:', err?.message || err, '| 来源:', info);
    // 返回 false 阻止错误继续向上传播（页面不会崩溃）
    return false;
  },

  created() {
    // ✅ 2.3: 静态配置数据作为非响应式实例属性，避免 Vue 递归观察大数组
    // quoteLibrary, quoteAuthors 已由 setup() 中的 useDailyQuote composable 管理
    this.formulaList = Object.freeze(FORMULA_LIST);
  },

  // #ifdef APP-PLUS
  onBackPress() {
    if (this._backPressTime && Date.now() - this._backPressTime < 2000) {
      return false; // 允许退出
    }
    this._backPressTime = Date.now();
    toast.info('再按一次退出应用');
    return true; // 阻止默认退出
  },
  // #endif

  // [F2-FIX] 微信分享配置
  onShareAppMessage() {
    return {
      title: 'Exam-Master — 智能助力，一战成硕',
      path: '/pages/index/index',
      imageUrl: '/static/images/app-share-cover.png'
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

    // 初始化Store（studyStore 在 setup() 中已作为 studyStoreInstance 创建）
    this.studyStore = useStudyStore();
    // todoStore 已在 setup() 中通过 useTodo 初始化
    this.userStore = useUserStore();

    // 初始化学习轨迹Store（动态导入，减小主包体积）
    safeImport(import('@/stores/modules/learning-trajectory-store'))
      .then(({ useLearningTrajectoryStore }) => {
        this.trajectoryStore = useLearningTrajectoryStore();
        this.trajectoryStore.init();
      })
      .catch(() => {
        /* 静默降级 */
      });

    // 动态加载 reviewStore（减小主包体积）
    safeImport(import('@/stores/modules/review.js'))
      .then(({ useReviewStore }) => {
        this.reviewStore = useReviewStore();
      })
      .catch(() => {
        /* 静默降级 */
      });

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
    this.loadRecommendedTopic();

    // [FSRS] 参数同步（非阻塞，动态导入）
    safeImport(import('@/pages/practice-sub/services/fsrs-optimizer-client.js'))
      .then(({ syncFSRSParams }) => syncFSRSParams())
      .catch(() => {
        /* 静默降级 */
      });

    // 微信订阅消息：智能请求授权（每天最多一次，动态导入）
    safeImport(import('@/services/subscribe-message.js'))
      .then(({ smartRequestSubscription }) => smartRequestSubscription())
      .catch(() => {
        /* 静默降级 */
      });

    // 加载学习热力图
    this.loadHeatmapData();
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
      this.loadError = false;
      try {
        // 0. 读取用户考试偏好
        this.examType = storageService.get('exam_type', 'kaoyan');
        this.examDate = storageService.get('exam_date', '');
        this.dailyGoal = storageService.get('daily_goal', 20);

        // 1. 恢复用户信息（同步操作，立即执行）
        this.userStore.restoreUserInfo();

        // 2. 恢复学习进度（同步操作）
        this.studyStore.restoreProgress();

        // 3. 加载待办事项（同步操作）
        this.todoStore.initTasks();

        // ✅ [D002重构] 统计数据由 composable 管理
        this.refreshStats();

        // ✅ [零摩擦] 检测未完成的答题进度
        this.checkUnfinishedProgress();

        // 4-8: 并行加载所有异步/独立数据
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
        this.loadError = true;
        toast.info('部分数据加载失败');
      } finally {
        this.isLoading = false;
      }
    },

    async refreshData() {
      try {
        this.studyStore.restoreProgress();
        this.todoStore.initTasks();
        this.userStore.restoreUserInfo();
        // ✅ [D002重构] 统计数据由 composable 管理
        this.refreshStats();

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
        toast.info('数据刷新失败，请稍后重试', 1500);
      }
    },

    // ✅ [D002重构] _refreshStats 已由 useHomeStats.refreshStats composable 提供

    // 下拉刷新处理
    async onPullDownRefresh() {
      logger.log('[Index] 触发下拉刷新');
      this.isRefreshing = true;

      try {
        // 刷新所有数据
        await this.loadData();

        // 刷新每日金句
        this.refreshDailyQuote();

        toast.success('刷新成功');
      } catch (error) {
        logger.error('[Index] 下拉刷新失败:', error);
        toast.info('刷新失败');
      } finally {
        // 延迟关闭刷新状态，确保动画完成
        setTimeout(() => {
          this.isRefreshing = false;
        }, 500);
      }
    },

    // ✅ [D002重构] loadAchievements 已由 useHomeStats composable 提供（setup 返回）

    // F002-I2: loadKnowledgePoints moved to knowledgePointMixin

    // ✅ [D002重构] loadRecentActivities 已由 useHomeStats composable 提供

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

    // AI 简报导航：错题本
    navToMistakes() {
      safeNavigateTo('/pages/mistake/index');
    },

    // AI 简报导航：AI 聊天
    navToChat() {
      safeNavigateTo('/pages/chat/chat');
    },

    // ✅ [D002重构] loadReviewPending, loadHeatmapData, goSmartReview, resumeLastSession,
    // checkUnfinishedProgress 已由 useHomeReview composable 提供（setup 返回）

    // ✅ [D002重构] checkShowOnboarding, nextOnboardingStep 已由 useStyleOnboarding composable 提供（setup 返回）

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
              toast.info('请点击头像完成登录');
            }
          });
        }
      });
    }

    // ✅ F002: 每日金句功能由 useDailyQuote composable 提供
    // (initDailyQuote, generateDailyQuote, refreshDailyQuote, openQuotePoster,
    //  getCurrentDate, saveQuotePoster, handleQuoteFavorite, handleQuoteShare)

    // ✅ F002: 待办事项功能由 todoMixin 提供
    // (handleTodoSave, handleTodoDelete, openTodoEditor)

    // F002-I3: handleRecommendationClick moved to recommendationMixin

    // ✅ F002: 学习计时器功能由 useStudyTimer composable 提供
    // (initStudyTimer, startStudyTimer, stopStudyTimer, saveStudyTime, formatStudyTime, handleStudyTimeClick)
  }
};
</script>

<style lang="scss" scoped>
/* [AUDIT FIX R135] */
/* ==================== 首页精简：今日数据一览容器 ==================== */
.today-dashboard {
  margin: 0 30rpx;
  display: flex;
  flex-direction: column;
  /* gap: 16rpx; -- replaced for Android WebView compat */
}
.today-dashboard > view + view {
  margin-top: 16rpx;
}

/* ==================== 页面最外层容器 ==================== */
.page-wrapper {
  min-height: 100%;
  min-height: 100vh;
  position: relative;
  background-color: var(--background);
}

/* 深色模式下的页面背景 */
.page-wrapper.page-dark {
  background-color: var(--bg-page);
}

.dashboard-container {
  min-height: 100%;
  min-height: 100vh;
  background: var(--background);
  position: relative;
  overflow: hidden;
  isolation: isolate;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'SF Pro Text', 'Noto Sans SC', 'Roboto', sans-serif;
}
.page-dark .dashboard-container {
  background: var(--bg-page);
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
  background: radial-gradient(circle, rgba(88, 204, 2, 0.08) 0%, transparent 72%);
  filter: blur(12rpx);
}

.dashboard-container::after {
  width: 480rpx;
  height: 480rpx;
  left: -170rpx;
  top: 420rpx;
  background: radial-gradient(circle, rgba(28, 176, 246, 0.06) 0%, transparent 74%);
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
  border: 1rpx solid var(--glass-border, rgba(255, 255, 255, 0.16));
}

.card-light {
  background: linear-gradient(165deg, var(--bg-card) 0%, var(--bg-secondary) 100%);
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
  border: 4rpx solid rgba(88, 204, 2, 0.2);
  border-top-color: #58cc02;
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
  color: var(--text-secondary);
  margin-top: 12rpx;
}

/* 内容包装器 */
.content-wrapper {
  padding: 40rpx 30rpx;
  /* 为底部悬浮胶囊tabbar留出空间 — 需与 practice 页保持一致 */
  padding-bottom: calc(140px + constant(safe-area-inset-bottom, 0px));
  padding-bottom: calc(140px + env(safe-area-inset-bottom, 0px));
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

/* ==================== 章节标题 — 多邻国风格 ==================== */
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
  font-weight: 800;
  letter-spacing: -0.2rpx;
  color: var(--text-primary);
}
.page-dark .section-title {
  color: var(--text-primary);
}

.section-header-apple .section-title {
  font-size: 24rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--text-secondary);
}

.section-action {
  font-size: 26rpx;
  color: #58cc02;
  font-weight: 700;
  padding: 6rpx 16rpx;
  background: rgba(88, 204, 2, 0.1);
  border-radius: 20rpx;
}

/* ==================== 编辑计划按钮 ==================== */
.edit-plan-btn {
  display: flex;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  padding: 14rpx 24rpx;
  border-radius: 999rpx;
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1rpx solid var(--border);
  box-shadow: var(--shadow-sm);
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
  background: linear-gradient(145deg, var(--bg-card), var(--bg-secondary));
}

.tool-glow-doc {
  background: radial-gradient(circle, var(--brand-glow), transparent 70%);
}

.tool-icon-photo {
  background: linear-gradient(145deg, var(--bg-card), var(--bg-secondary));
}

.tool-glow-photo {
  background: radial-gradient(circle, var(--brand-glow), transparent 70%);
}

.tool-icon-search {
  background: linear-gradient(145deg, var(--bg-card), var(--bg-secondary));
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
  font-size: 24rpx;
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

/* ==================== [差异化壁垒] 学习风格 Onboarding Overlay ==================== */
.onboarding-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 40rpx;
  animation: overlayFadeIn 0.3s ease both;
}
@keyframes overlayFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
.onboarding-card {
  width: 100%;
  max-width: 620rpx;
  background: var(--bg-card);
  border-radius: 32rpx;
  padding: 48rpx 40rpx 40rpx;
  box-shadow: 0 24rpx 80rpx rgba(0, 0, 0, 0.18);
  animation: cardPopIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: 0.1s;
}
.onboarding-card.dark-mode {
  background: var(--bg-card);
  box-shadow: 0 24rpx 80rpx rgba(0, 0, 0, 0.5);
}

/* Step指示器 — 三个圆点 */
.onboarding-steps {
  display: flex;
  justify-content: center;
  margin-bottom: 40rpx;
}
.step-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: var(--border);
  margin: 0 8rpx;
  transition: all 0.3s ease;
}
.step-dot.active {
  width: 40rpx;
  border-radius: 8rpx;
  background: #58cc02;
}
.step-dot.done {
  background: rgba(88, 204, 2, 0.4);
}
.dark-mode .step-dot {
  background: rgba(255, 255, 255, 0.15);
}
.dark-mode .step-dot.active {
  background: #58cc02;
}
.dark-mode .step-dot.done {
  background: rgba(88, 204, 2, 0.3);
}

/* Onboarding 内容区 */
.onboarding-content {
  text-align: center;
}
.onboarding-title {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
  margin-bottom: 12rpx;
}
.dark-mode .onboarding-title {
  color: var(--text-primary);
}
.onboarding-desc {
  font-size: 28rpx;
  color: var(--text-secondary);
  display: block;
  margin-bottom: 36rpx;
}

/* 横向选项（Step 1 & 3） */
.onboarding-options {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
}
.onboarding-options > view {
  margin: 8rpx;
}
.ob-option {
  padding: 20rpx 32rpx;
  border-radius: 20rpx;
  background: var(--bg-secondary);
  border: 2rpx solid transparent;
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-primary);
  transition: all 0.2s ease;
  min-width: 120rpx;
  text-align: center;
}
.ob-option.selected {
  background: rgba(88, 204, 2, 0.12);
  border-color: #58cc02;
  color: #58cc02;
  box-shadow: 0 4rpx 12rpx rgba(88, 204, 2, 0.2);
}
.ob-option:active {
  transform: scale(0.95);
}
.dark-mode .ob-option {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.8);
}
.dark-mode .ob-option.selected {
  background: rgba(88, 204, 2, 0.15);
  border-color: #58cc02;
  color: #58cc02;
}

/* 竖向选项（Step 2） */
.onboarding-options.vertical {
  flex-direction: column;
}
.onboarding-options.vertical > view {
  margin: 6rpx 0;
}
.ob-option-row {
  padding: 24rpx 28rpx;
  border-radius: 20rpx;
  background: var(--bg-secondary);
  border: 2rpx solid transparent;
  transition: all 0.2s ease;
  text-align: left;
}
.ob-option-row.selected {
  background: rgba(88, 204, 2, 0.12);
  border-color: #58cc02;
  box-shadow: 0 4rpx 12rpx rgba(88, 204, 2, 0.2);
}
.ob-option-row:active {
  transform: scale(0.98);
}
.dark-mode .ob-option-row {
  background: rgba(255, 255, 255, 0.08);
}
.dark-mode .ob-option-row.selected {
  background: rgba(88, 204, 2, 0.15);
  border-color: #58cc02;
}
.ob-option-label {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-primary);
  display: block;
}
.ob-option-row.selected .ob-option-label {
  color: #58cc02;
}
.dark-mode .ob-option-label {
  color: rgba(255, 255, 255, 0.85);
}
.dark-mode .ob-option-row.selected .ob-option-label {
  color: #58cc02;
}
.ob-option-desc {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
  display: block;
}

/* Onboarding 底部操作栏 */
.onboarding-actions {
  display: flex;
  justify-content: center;
  margin-top: 40rpx;
}
.onboarding-actions > button {
  margin: 0 8rpx;
}
.ob-btn-skip {
  padding: 20rpx 40rpx !important;
  font-size: 28rpx !important;
  font-weight: 700 !important;
  color: var(--text-secondary) !important;
  background: var(--bg-secondary) !important;
  border-radius: 20rpx !important;
  border: none !important;
  line-height: 1.2 !important;
}
.ob-btn-skip:active {
  background: var(--muted) !important;
}
.dark-mode .ob-btn-skip {
  background: rgba(255, 255, 255, 0.08) !important;
  color: rgba(255, 255, 255, 0.5) !important;
}
.ob-btn-next {
  padding: 20rpx 56rpx !important;
  font-size: 30rpx !important;
  font-weight: 800 !important;
  color: var(--text-inverse) !important;
  background: #58cc02 !important;
  border-radius: 20rpx !important;
  border: none !important;
  box-shadow: 0 6rpx 0 #46a302 !important;
  line-height: 1.2 !important;
  transition: all 0.1s ease !important;
}
.ob-btn-next:active {
  transform: translateY(4rpx) !important;
  box-shadow: 0 2rpx 0 #46a302 !important;
}
.dark-mode .ob-btn-next {
  background: #58cc02 !important;
  box-shadow: 0 6rpx 0 #3d8f02 !important;
}

/* cardPopIn 动画 — 全局复用 */
@keyframes cardPopIn {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20rpx);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
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
  background: linear-gradient(135deg, rgba(28, 176, 246, 0.1), rgba(28, 176, 246, 0.05));
  border: 2rpx solid rgba(28, 176, 246, 0.15);
  animation: resumePulse 2s ease-in-out infinite;
}
.page-dark .resume-banner {
  background: linear-gradient(135deg, rgba(28, 176, 246, 0.08), rgba(28, 176, 246, 0.04));
  border-color: rgba(28, 176, 246, 0.12);
}
@keyframes resumePulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(28, 176, 246, 0.15);
  }
  50% {
    box-shadow: 0 0 0 8rpx transparent;
  }
}
.resume-banner-left {
  display: flex;
  align-items: center;
  flex: 1;
}
.resume-banner-icon {
  margin-right: 20rpx;
  color: var(--info);
  display: flex;
  align-items: center;
}
.resume-banner-info {
  display: flex;
  flex-direction: column;
}
.resume-banner-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-primary);
}
.resume-banner-sub {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}
.resume-banner-arrow {
  color: var(--info);
  display: flex;
  align-items: center;
}

/* ==================== [知识引擎] 智能学习推荐 — 橙色模块 ==================== */
.smart-recommend {
  margin: 20rpx 30rpx;
  padding: 28rpx 30rpx;
  border-radius: 24rpx;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  position: relative;
  overflow: hidden;
  transition: transform 0.15s ease;
  animation: cardPopIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
.smart-recommend::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6rpx;
  background: linear-gradient(90deg, var(--warning), var(--warning-light, #ffb800));
  border-radius: 0 0 4rpx 4rpx;
}
.smart-recommend:active {
  transform: scale(0.97);
}
.page-dark .smart-recommend {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}
.smart-recommend-header {
  display: flex;
  align-items: center;
  /* gap: 10rpx; -- replaced for Android WebView compat */
  margin-bottom: 12rpx;
}
.smart-recommend-header > view + view {
  margin-left: 10rpx;
}
.smart-recommend-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 14rpx;
  background: rgba(255, 150, 0, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--warning);
  margin-right: 10rpx;
}
.smart-recommend-title {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--warning);
}
.smart-recommend-name {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
}
.page-dark .smart-recommend-name {
  color: var(--text-primary);
}
.smart-recommend-reason {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 6rpx;
  display: block;
}

/* 首页热力图紧凑样式 */
.heatmap-compact {
  margin-top: 16rpx;
  border-radius: 24rpx;
  overflow: hidden;
}

/* 加载失败重试卡片 — 多邻国风格 */
.load-error-card {
  display: flex;
  align-items: center;
  /* gap: 20rpx; -- replaced for Android WebView compat */
  margin: 30rpx;
  padding: 32rpx;
  background: var(--bg-card);
  border: 2rpx solid rgba(255, 75, 75, 0.15);
  border-radius: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.load-error-card > view + view {
  margin-left: 20rpx;
}
.load-error-card:active {
  transform: scale(0.98);
}
.load-error-icon {
  color: var(--danger, #ff3b30);
  display: flex;
  align-items: center;
}
.load-error-text {
  flex: 1;
}
.load-error-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-primary);
  display: block;
}
.load-error-hint {
  font-size: 24rpx;
  color: var(--danger);
  margin-top: 4rpx;
  display: block;
  font-weight: 600;
}
.load-error-arrow {
  color: var(--danger);
  display: flex;
  align-items: center;
}

/* 备考工具箱（v0 风格工具卡片） */
.free-tools-section {
  margin: 32rpx 30rpx 0;
}
.free-tools-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.free-tools-title {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.free-tools-badge {
  font-size: 22rpx;
  font-weight: 700;
  color: #58cc02;
  background: rgba(88, 204, 2, 0.12);
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}
.free-tools-grid {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
}
.free-tools-grid > view + view {
  margin-left: 16rpx;
}
.free-tool-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 28rpx 12rpx 20rpx;
  border-radius: 24rpx;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  position: relative;
  overflow: hidden;
  transition: all 0.15s ease;
}
.tool-hover {
  transform: scale(0.96);
}
.tool-card-icon-wrap {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
}
/* 每个工具卡片独立配色 */
.free-tool-card:nth-child(1) .tool-card-icon-wrap {
  background: rgba(28, 176, 246, 0.12);
}
.free-tool-card:nth-child(2) .tool-card-icon-wrap {
  background: rgba(255, 150, 0, 0.12);
}
.free-tool-card:nth-child(3) .tool-card-icon-wrap {
  background: rgba(206, 130, 255, 0.12);
}
.page-dark .tool-card-icon-wrap {
  background: color-mix(in srgb, var(--primary) 18%, transparent);
}
.tool-card-icon {
  color: var(--primary);
}
.tool-card-title {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-primary);
  text-align: center;
}
.tool-card-desc {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
  text-align: center;
}
.tool-card-tag {
  margin-top: 10rpx;
  padding: 2rpx 10rpx;
  border-radius: 8rpx;
  background: rgba(255, 150, 0, 0.1);
}
.tool-tag-text {
  font-size: 22rpx;
  color: var(--warning);
  font-weight: 600;
}

/* ==================== [闭环核心] 今日复习入口 — 多邻国绿色风格 ==================== */
.review-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  margin: 20rpx 32rpx;
  border-radius: 24rpx;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  position: relative;
  overflow: hidden;
  transition: transform 0.15s ease;
  /* 左侧绿色装饰条 */
}
.review-banner::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 8rpx;
  background: #58cc02;
  border-radius: 0 4rpx 4rpx 0;
}
.review-banner:active {
  transform: scale(0.98);
}
.page-dark .review-banner {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}
.page-dark .review-banner::before {
  background: #58cc02;
}
.review-banner-left {
  display: flex;
  align-items: center;
  flex: 1;
}
.review-banner-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  background: rgba(88, 204, 2, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  color: #58cc02;
  flex-shrink: 0;
}
.review-banner-info {
  display: flex;
  flex-direction: column;
}
.review-banner-title {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.page-dark .review-banner-title {
  color: var(--text-primary);
}
.review-banner-sub {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}
.page-dark .review-banner-sub {
  color: rgba(255, 255, 255, 0.5);
}
.review-banner-arrow {
  color: #58cc02;
  margin-left: 12rpx;
  display: flex;
  align-items: center;
}

/* 功能级卡通图标（替代 BaseIcon size 36-79） */
.feature-cartoon-icon {
  width: 80rpx;
  height: 80rpx;
}
</style>
