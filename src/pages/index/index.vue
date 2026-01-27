<template>
	<!-- 最外层：页面容器 -->
	<view :class="['page-wrapper', { 'page-dark': isDark }]">
		<!-- 主容器：带背景色 -->
		<view :class="['dashboard-container', { 'dark': isDark }]">
			<!-- 顶部导航栏：外层定位容器完全透明 -->
			<view
				class="header-position-wrapper"
				style="position: fixed; top: 0; left: 0; right: 0; z-index: 100; background-color: transparent !important; background: transparent !important; pointer-events: none;"
			>
				<!-- 状态栏占位：透明 -->
				<view class="status-bar-placeholder" style="background: transparent !important;"></view>
				<!-- 内容区域：恢复点击，背景透明（滚动后才显示毛玻璃） -->
				<view
					:class="['header-content-area', scrollY > 50 && 'header-scrolled']"
					style="pointer-events: auto;"
				>
					<view class="header-left">
						<!-- 品牌Logo -->
						<view class="app-logo-wrapper">
							<image class="app-logo-img" src="/static/images/logo.png" mode="aspectFit"></image>
						</view>
						<text class="app-title">Exam-Master</text>
					</view>
					<view class="header-right">
						<view class="theme-toggle" @tap="toggleTheme">
							<text class="theme-icon">{{ isDark ? '🌙' : '☀️' }}</text>
						</view>
						<view :class="['user-avatar', isDark ? 'avatar-dark' : 'avatar-light']" @tap="handleUserClick">
							<text class="avatar-text" :class="{ 'avatar-icon': !userInitials }">{{ userInitials || '👤' }}</text>
						</view>
					</view>
				</view>
			</view>

			<!-- 主内容区域：全屏 scroll-view -->
			<scroll-view scroll-y class="main-content-fullscreen" @scroll="handleScroll">
				<!-- 顶部占位：为导航栏留空 -->
				<view :style="{ height: layoutInfo.navBarHeight + 'px' }"></view>

				<!-- 内容包装器 -->
				<view class="content-wrapper">
			<!-- 欢迎横幅 - 带装饰气泡 -->
			<view :class="['welcome-banner', isDark ? 'banner-dark' : 'banner-light']">
				<!-- 深色模式装饰气泡 -->
				<view v-if="isDark" class="bubble-decoration bubble-1"></view>
				<view v-if="isDark" class="bubble-decoration bubble-2"></view>
				
				<view class="banner-content">
					<view class="banner-text">
						<text class="welcome-title">欢迎回来，{{ userName }}！</text>
						<text class="welcome-subtitle">
							你有 <text class="highlight-text">{{ finishedCount }} 道题目</text> 待复习。继续保持学习势头！
						</text>
					</view>
				<view class="banner-actions">
					<view :class="['action-btn', 'btn-primary', isDark && 'animate-pulse-glow']" @tap="navToPractice">
						<text class="btn-icon">⚡</text>
						<text class="btn-text">快速练习</text>
					</view>
					<view class="action-btn btn-outline" @tap="navToMockExam">
						<text class="btn-icon">⏰</text>
						<text class="btn-text">模拟考试</text>
					</view>
				</view>
				</view>
			</view>

			<!-- ✅ P0-1: 新用户空状态引导 - 增强版 -->
			<empty-state-home
				v-if="isNewUser"
				title="开启你的学习之旅"
				subtitle="上传学习资料，AI 将为你智能生成专属题库，让备考更高效！"
				hint="支持 PDF、Word、图片等多种格式"
				:is-dark="isDark"
				@upload="handleEmptyGuideAction({ type: 'new_user_onboarding' })"
				@quickStart="handleQuickStart"
				@tutorial="handleTutorial"
			></empty-state-home>

			<!-- 统计卡片网格 -->
			<view class="stats-grid">
				<view :class="['stat-card', isDark ? 'glass' : 'card-light', 'card-hover']" @tap="handleStatClick('questions')">
					<view class="stat-icon-wrapper icon-primary">
						<text class="stat-icon">✓</text>
					</view>
					<view class="stat-content">
						<text class="stat-title">题目总数</text>
						<text class="stat-value">{{ realTotalQuestions }}</text>
						<text class="stat-change neutral">题库容量</text>
					</view>
				</view>

				<view :class="['stat-card', isDark ? 'glass' : 'card-light', 'card-hover']" @tap="handleStatClick('accuracy')">
					<view class="stat-icon-wrapper icon-success">
						<text class="stat-icon">📈</text>
					</view>
					<view class="stat-content">
						<text class="stat-title">正确率</text>
						<text class="stat-value">{{ realAccuracy }}%</text>
						<text class="stat-change" :class="realAccuracy >= 60 ? 'positive' : 'neutral'">{{ realAccuracy >= 60 ? '表现优秀' : '继续加油' }}</text>
					</view>
				</view>

				<view :class="['stat-card', isDark ? 'glass' : 'card-light', 'card-hover']" @tap="handleStatClick('streak')">
					<view class="stat-icon-wrapper icon-warning">
						<text class="stat-icon">⚡</text>
					</view>
					<view class="stat-content">
						<text class="stat-title">学习天数</text>
						<text class="stat-value">{{ realStudyDays }} 天</text>
						<text class="stat-change" :class="realStudyDays > 0 ? 'positive' : 'neutral'">{{ realStudyDays > 0 ? '坚持学习' : '开始学习' }}</text>
					</view>
				</view>

				<view :class="['stat-card', isDark ? 'glass' : 'card-light', 'card-hover']" @tap="handleStatClick('achievements')">
					<view class="stat-icon-wrapper icon-neutral">
						<text class="stat-icon">🏆</text>
					</view>
					<view class="stat-content">
						<text class="stat-title">成就徽章</text>
						<text class="stat-value">{{ achievementCount }}</text>
						<text class="stat-change neutral">{{ achievementCount > 0 ? '已解锁' : '待解锁' }}</text>
					</view>
				</view>
			</view>
			
			<!-- ✅ 检查点1.5: 今日学习时长卡片 -->
			<view :class="['study-time-card', isDark ? 'glass' : 'card-light']">
				<view class="time-icon-wrapper">
					<text class="time-icon">⏱️</text>
				</view>
				<view class="time-content">
					<text class="time-label">今日学习</text>
					<text class="time-value">{{ formatStudyTime(todayStudyTime) }}</text>
				</view>
				<view class="time-indicator" :class="{ 'indicator-active': studyTimerInterval }">
					<view class="indicator-dot"></view>
					<text class="indicator-text">{{ studyTimerInterval ? '计时中' : '已暂停' }}</text>
				</view>
			</view>

			<!-- 概况气泡场 -->
			<view class="section-header">
				<text class="section-title">概况</text>
			</view>
			<view :class="['knowledge-field', 'field-floating']">
				<view 
					v-for="(point, index) in sortedKnowledgePoints" 
					:key="point.id"
					:class="[
						'bubble-card',
						isDark ? 'bubble-card-dark' : 'bubble-card-light',
						'bubble-size-' + getBubbleSize(point.mastery),
						'bubble-float',
						animatingBubbleId === point.id && 'bubble-animating'
					]"
					:style="getBubbleCardStyle(point, index)"
					@tap="handleKnowledgeClick(point)"
				>
					<!-- 光晕层（两种模式都有） -->
					<view class="bubble-glow animate-breathe" :style="{ background: `radial-gradient(circle at center, ${point.color}33 0%, transparent 70%)` }"></view>
					
					<!-- 内容层 -->
					<view class="bubble-content">
						<view class="bubble-icon-wrapper" :style="{ color: point.color }">
							<text class="bubble-icon">{{ point.icon }}</text>
						</view>
						<text class="bubble-title" :style="{ color: point.color }">{{ point.title }}</text>
						<text class="bubble-count">{{ point.count }} 项</text>
						<view class="bubble-progress-wrapper">
							<view class="bubble-progress-bar">
								<view class="bubble-progress-fill" :style="{ width: point.mastery + '%', backgroundColor: point.color }"></view>
							</view>
						</view>
					</view>
				</view>
			</view>

			<!-- 学习轨迹 -->
			<view class="section-header">
				<text class="section-title">学习轨迹</text>
				<text class="section-action" @tap="navToStudyDetail">查看全部</text>
			</view>
			<view class="activity-list">
				<view 
					v-for="(activity, index) in recentActivities" 
					:key="index"
					:class="['activity-item', isDark ? 'glass' : 'card-light', 'card-hover']"
				>
					<view :class="['activity-icon-wrapper', 'status-' + activity.status]">
						<text class="activity-icon">{{ activity.icon }}</text>
					</view>
					<view class="activity-content">
						<text class="activity-title">{{ activity.title }}</text>
						<text class="activity-subtitle">{{ activity.subtitle }}</text>
					</view>
					<view class="activity-meta">
						<text class="activity-time">{{ activity.time }}</text>
						<view :class="['activity-badge', 'badge-' + activity.status]">
							<text class="badge-text">{{ getStatusText(activity.status) }}</text>
						</view>
					</view>
				</view>
			</view>

			<!-- 待办事项清单 -->
			<view class="section-header">
				<text class="section-title">待办事项</text>
				<view class="edit-plan-btn" @tap="handleEditPlan">
					<text class="edit-icon">✏️</text>
					<text class="edit-text">编辑计划</text>
				</view>
			</view>
			<todo-list :todos="todos" :is-dark="isDark" @toggleTodo="handleToggleTodo" @editTodo="openTodoEditor"></todo-list>

			<!-- 每日金句 -->
			<view :class="['mode-description', isDark ? 'glass' : 'desc-light']" style="margin-top: 64rpx;" @tap="openQuotePoster">
				<text class="mode-text">
					<text class="mode-highlight">💡 每日金句：</text>
					{{ dailyQuote }}
				</text>
				<text class="quote-hint">轻触查看海报</text>
			</view>
				</view>
				<!-- 内容包装器结束 -->

				<!-- 底部占位：为 TabBar 留空 -->
				<view :style="{ height: (layoutInfo.tabBarHeight + 20) + 'px', background: 'transparent' }"></view>
		</scroll-view>

		<!-- 骨架屏 -->
		<base-skeleton v-if="isLoading" :is-dark="isDark"></base-skeleton>
		</view>

		<!-- 底部导航栏：放在 dashboard-container 外部，避免继承绿色背景 -->
		<custom-tabbar :activeIndex="0" :isDark="isDark"></custom-tabbar>
		
		<!-- 公式定理弹窗 -->
		<view class="formula-modal" v-if="showFormulaModal" @tap="showFormulaModal = false">
			<view class="formula-content" @tap.stop>
				<view class="formula-header">
					<text class="formula-title">🧮 公式定理速查</text>
					<view class="formula-close" @tap="showFormulaModal = false">
						<text>×</text>
					</view>
				</view>
				<scroll-view scroll-y class="formula-scroll">
					<view 
						v-for="(item, index) in formulaList" 
						:key="index" 
						class="formula-item"
					>
						<view class="formula-category">{{ item.category }}</view>
						<text class="formula-name">{{ item.name }}</text>
						<text class="formula-text">{{ item.formula }}</text>
					</view>
				</scroll-view>
				<view class="formula-footer">
					<text class="formula-tip">💡 更多公式正在整理中...</text>
				</view>
			</view>
		</view>
		
		<!-- 每日金句海报弹窗 -->
		<view class="quote-poster-modal" v-if="showQuotePoster" @tap="showQuotePoster = false">
			<view class="quote-poster-content" @tap.stop>
				<view class="poster-card" :class="{ 'poster-dark': isDark }">
					<view class="poster-decoration">
						<view class="poster-circle poster-circle-1"></view>
						<view class="poster-circle poster-circle-2"></view>
					</view>
					<view class="poster-body">
						<text class="poster-quote">"{{ dailyQuote }}"</text>
						<text class="poster-author">—— {{ quoteAuthor }}</text>
						<view class="poster-date">
							<text>{{ getCurrentDate() }}</text>
						</view>
						<view class="poster-brand">
							<text class="brand-name">Exam-Master</text>
							<text class="brand-slogan">考研路上，与你同行</text>
						</view>
					</view>
				</view>
				<view class="poster-actions">
					<view class="poster-btn poster-btn-secondary" @tap="showQuotePoster = false">
						<text>关闭</text>
					</view>
					<view class="poster-btn poster-btn-primary" @tap="saveQuotePoster">
						<text>保存图片</text>
					</view>
				</view>
			</view>
		</view>
		
		<!-- ✅ 自定义弹窗：题库为空 -->
		<custom-modal
			:visible="showEmptyBankModal"
			type="upload"
			title="📚 题库空空如也"
			content="上传学习资料，AI 将为您智能生成专属题库，开启高效刷题之旅！"
			confirm-text="去上传"
			cancel-text="稍后再说"
			:show-cancel="true"
			:is-dark="isDark"
			@confirm="handleEmptyBankConfirm"
			@cancel="showEmptyBankModal = false"
		/>
		
		<!-- ✅ 自定义弹窗：登录引导 -->
		<custom-modal
			:visible="showLoginModal"
			type="study"
			title="🎓 开启学霸之旅"
			content="登录后可同步学习进度、错题本等数据，享受完整功能体验！"
			confirm-text="微信登录"
			cancel-text="暂不登录"
			:show-cancel="true"
			:is-dark="isDark"
			@confirm="handleLoginConfirm"
			@cancel="showLoginModal = false"
		/>
		
		
		<!-- ✅ 检查点1.2: 每日金句分享弹窗 -->
		<share-modal
			:visible="showShareModal"
			:quote="dailyQuote"
			:author="quoteAuthor"
			:is-dark="isDark"
			@close="showShareModal = false"
			@favorite="handleQuoteFavorite"
			@share="handleQuoteShare"
		/>
		
		<!-- ✅ 检查点1.3: 待办事项编辑器 -->
		<todo-editor
			:visible="showTodoEditor"
			:todo-data="editingTodo"
			:is-dark="isDark"
			@close="showTodoEditor = false"
			@save="handleTodoSave"
			@delete="handleTodoDelete"
			@toggle="handleToggleTodo"
		/>
		
		<!-- ✅ P3: 离线状态指示器 -->
		<offline-indicator :auto-show="true" position="top" :auto-hide-delay="5000" />
	</view>
</template>

<script>
import CustomTabbar from '../../components/layout/custom-tabbar/custom-tabbar.vue';
import BaseSkeleton from '../../components/base/base-skeleton/base-skeleton.vue';
import TodoList from '../../components/common/TodoList.vue';
import EmptyGuide from '../../components/common/EmptyGuide.vue';
import EmptyStateHome from '../../components/common/empty-state-home.vue';
import ShareModal from '../../components/common/share-modal.vue';
import TodoEditor from '../../components/common/todo-editor.vue';
import CustomModal from '../../components/common/CustomModal.vue';
// ✅ P3: 离线状态指示器
import OfflineIndicator from '../../components/common/offline-indicator.vue';
import { getGreetingTime } from '../../utils/core/date';
import { useStudyStore } from '../../stores/modules/study';
import { useTodoStore } from '../../stores/modules/todo';
import { useUserStore } from '../../stores/modules/user';
import { useLearningTrajectoryStore } from '../../stores/modules/learning-trajectory-store';
import { lafService } from '../../services/lafService.js';
import { storageService } from '../../services/storageService.js';
import { quoteHandler } from '../../utils/quote-interaction-handler.js';
import { bubbleInteraction } from '../../utils/bubble-interaction.js';
import { todoStorePatch } from '../../utils/todo-store-patch.js';
// ✅ 检查点 5.1: 导入分析服务和页面追踪 Mixin
import { analytics } from '../../utils/analytics/event-bus-analytics.js';
import { trackingMixin } from '../../utils/analytics/tracking-mixin.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '../../utils/logger.js';

export default {
	// ✅ 检查点 5.1: 使用页面追踪 Mixin
	mixins: [trackingMixin],
	
	components: {
		CustomTabbar,
		BaseSkeleton,
		TodoList,
		EmptyGuide,
		EmptyStateHome,
		ShareModal,
		TodoEditor,
		CustomModal,
		OfflineIndicator
	},

	data() {
		return {
			isLoading: true,
			scrollY: 0,
			isDark: false,

			// 沉浸式布局信息
			layoutInfo: {
				statusBarHeight: 44,
				navBarHeight: 88,
				tabBarHeight: 90,
				safeAreaBottom: 0,
			},
			
			// Store实例
			studyStore: null,
			todoStore: null,
			userStore: null,
			trajectoryStore: null,
			
			// 成就徽章数量（从本地存储获取）
			achievementCount: 0,

			// 按钮防重复点击状态
			isNavigating: false,
			
			// ✅ 自定义弹窗状态
			showEmptyBankModal: false,
			showLoginModal: false,
			showShareModal: false,
			showTodoEditor: false,
			editingTodo: null,
			modalConfig: {
				type: 'info',
				title: '',
				content: '',
				confirmText: '确定',
				cancelText: '取消',
				showCancel: true
			},
			
			// 每日金句相关
			isRefreshingQuote: false,
			quoteDate: '',
			
			// 励志金句库（30条精选）
			quoteLibrary: [
				'成功不是终点，失败也不是终结，唯有勇气才是永恒。',
				'天才是1%的灵感加上99%的汗水。',
				'不积跬步，无以至千里；不积小流，无以成江海。',
				'宝剑锋从磨砺出，梅花香自苦寒来。',
				'书山有路勤为径，学海无涯苦作舟。',
				'业精于勤，荒于嬉；行成于思，毁于随。',
				'黑发不知勤学早，白首方悔读书迟。',
				'少壮不努力，老大徒伤悲。',
				'读书破万卷，下笔如有神。',
				'学而不思则罔，思而不学则殆。',
				'知之者不如好之者，好之者不如乐之者。',
				'三人行，必有我师焉。',
				'温故而知新，可以为师矣。',
				'学如逆水行舟，不进则退。',
				'千里之行，始于足下。',
				'路漫漫其修远兮，吾将上下而求索。',
				'天行健，君子以自强不息。',
				'有志者事竟成，破釜沉舟，百二秦关终属楚。',
				'苦心人天不负，卧薪尝胆，三千越甲可吞吴。',
				'世上无难事，只怕有心人。',
				'只要功夫深，铁杵磨成针。',
				'精诚所至，金石为开。',
				'锲而不舍，金石可镂。',
				'绳锯木断，水滴石穿。',
				'不经一番寒彻骨，怎得梅花扑鼻香。',
				'吃得苦中苦，方为人上人。',
				'今日事今日毕，莫将今事待明日。',
				'一寸光阴一寸金，寸金难买寸光阴。',
				'勤能补拙是良训，一分辛苦一分才。',
				'书籍是人类进步的阶梯。'
			],

			// 知识点数据
			knowledgePoints: [
				{ id: 1, title: '错题集', count: 156, icon: '🎯', mastery: 35, color: '#EF4444' },
				{ id: 2, title: '热门考点', count: 89, icon: '🔥', mastery: 45, color: '#F59E0B' },
				{ id: 3, title: '练习题', count: 234, icon: '📝', mastery: 72, color: '#00F2FF' },
				{ id: 4, title: '核心概念', count: 312, icon: '🧠', mastery: 88, color: '#9FE870' },
				{ id: 5, title: '公式定理', count: 67, icon: '🧮', mastery: 60, color: '#A855F7' },
				{ id: 6, title: '阅读理解', count: 45, icon: '📖', mastery: 50, color: '#EC4899' }
			],

			// 最近活动
			recentActivities: [
				{ title: '模拟考试：数学', subtitle: '完成，得分 85%', time: '2小时前', icon: '✓', status: 'completed' },
				{ title: '错题复习：物理', subtitle: '已复习 12 道题', time: '5小时前', icon: '✓', status: 'completed' },
				{ title: '每日练习：化学', subtitle: '已完成 15/30 题', time: '进行中', icon: '▶', status: 'in-progress' },
				{ title: '计划：生物复习', subtitle: '明天上午 9:00', time: '即将开始', icon: '📅', status: 'pending' }
			],

			// 每日金句
			dailyQuote: '成功不是终点，失败也不是终结，唯有勇气才是永恒。',
			
			// 公式定理弹窗
			showFormulaModal: false,
			formulaList: [
				{ name: '勾股定理', formula: 'a² + b² = c²', category: '几何' },
				{ name: '求根公式', formula: 'x = (-b ± √(b²-4ac)) / 2a', category: '代数' },
				{ name: '三角函数', formula: 'sin²θ + cos²θ = 1', category: '三角' },
				{ name: '导数公式', formula: "(xⁿ)' = nxⁿ⁻¹", category: '微积分' },
				{ name: '积分公式', formula: '∫xⁿdx = xⁿ⁺¹/(n+1) + C', category: '微积分' },
				{ name: '等差数列', formula: 'aₙ = a₁ + (n-1)d', category: '数列' },
				{ name: '等比数列', formula: 'aₙ = a₁ · qⁿ⁻¹', category: '数列' },
				{ name: '排列公式', formula: 'Aₙᵐ = n!/(n-m)!', category: '排列组合' },
				{ name: '组合公式', formula: 'Cₙᵐ = n!/[m!(n-m)!]', category: '排列组合' },
				{ name: '二项式定理', formula: '(a+b)ⁿ = Σ Cₙᵏ aⁿ⁻ᵏbᵏ', category: '代数' }
			],
			
			// 每日金句海报弹窗
			showQuotePoster: false,
			quoteAuthor: '古人云',
			
			// ✅ 检查点1.5: 学习时长相关
			todayStudyTime: 0,
			studyTimerInterval: null,
			sessionStartTime: null,
			
			// ✅ 检查点1.4: 气泡动画状态
			animatingBubbleId: null
		};
	},

	onLoad() {
		// 初始化沉浸式布局信息
		this.initLayoutInfo();

		const savedTheme = uni.getStorageSync('theme_mode') || 'light';
		this.isDark = savedTheme === 'dark';

		uni.$on('themeUpdate', (mode) => {
			this.isDark = mode === 'dark';
		});

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

		this.loadData();
	},

	onShow() {
		uni.hideTabBar({ animation: false });
		this.refreshData();
		
		// ✅ 检查点1.5: 恢复计时
		this.startStudyTimer();
	},

	onUnload() {
		uni.$off('themeUpdate');
		
		// ✅ 检查点1.5: 停止计时
		this.stopStudyTimer();
	},

	computed: {
		// 两种模式都按mastery排序（低到高）
		sortedKnowledgePoints() {
			return [...this.knowledgePoints].sort((a, b) => a.mastery - b.mastery);
		},
		
		// 用户信息
		userName() {
			return this.userStore?.userInfo?.nickName || '小伙伴';
		},
		
		// 判断是否已登录
		isLoggedIn() {
			return !!(this.userStore?.isLogin || uni.getStorageSync('EXAM_USER_ID') || uni.getStorageSync('user_id'));
		},
		
		userInitials() {
			// 未登录时返回空（使用图标显示）
			if (!this.isLoggedIn) return '';
			// 默认用户名时也返回空
			if (this.userName === '小伙伴') return '';
			return this.getInitials(this.userName);
		},
		
		// 学习统计数据
		totalQuestions() {
			return this.studyStore?.studyProgress?.totalQuestions || 0;
		},
		
		finishedCount() {
			return this.studyStore?.studyProgress?.completedQuestions || 0;
		},
		
		accuracy() {
			return parseFloat(this.studyStore?.accuracy || 0);
		},
		
		totalStudyDays() {
			return this.studyStore?.studyProgress?.studyDays || 0;
		},
		
		// 真实统计数据（从题库和学习记录获取）
		realTotalQuestions() {
			const questionBank = uni.getStorageSync('v30_bank') || [];
			return questionBank.length;
		},
		
		realAccuracy() {
			// 优先使用 store 中的正确率
			const storeAccuracy = parseFloat(this.studyStore?.accuracy || 0);
			if (storeAccuracy > 0) return storeAccuracy;
			
			// 从学习记录计算
			const studyRecord = uni.getStorageSync('study_record') || {};
			const correct = studyRecord.correctCount || 0;
			const total = studyRecord.totalAnswered || 0;
			if (total === 0) return 0;
			return Math.round((correct / total) * 100);
		},
		
		realStudyDays() {
			// 优先使用 store 中的学习天数
			const storeDays = this.studyStore?.studyProgress?.studyDays || 0;
			if (storeDays > 0) return storeDays;
			
			// 从学习记录计算
			const studyDates = uni.getStorageSync('study_dates') || [];
			return studyDates.length;
		},
		
		// 待办事项数据
		todos() {
			if (!this.todoStore?.tasks) return [];
			return this.todoStore.tasks.map(task => ({
				id: task.id,
				text: task.title,
				completed: task.done,
				priority: task.tag || task.priority
			}));
		},
		
		// ✅ P0-1: 空状态判断
		isQuestionBankEmpty() {
			const questionBank = uni.getStorageSync('v30_bank') || [];
			return questionBank.length === 0;
		},
		
		isNewUser() {
			// 新用户判断：题库为空 且 学习天数为0
			return this.isQuestionBankEmpty && this.totalStudyDays === 0;
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
					safeAreaBottom,
				};

				logger.log('[Index] 布局信息初始化:', this.layoutInfo);
			} catch (e) {
				logger.warn('[Index] 布局信息初始化失败，使用默认值:', e);
				// 使用默认值
				this.layoutInfo = {
					statusBarHeight: 44,
					navBarHeight: 88,
					tabBarHeight: 90,
					safeAreaBottom: 34,
				};
			}
		},

		async loadData() {
			try {
				// 1. 恢复用户信息
				this.userStore.restoreUserInfo();
				
				// 2. 恢复学习进度
				this.studyStore.restoreProgress();
				
				// 3. 加载待办事项
				this.todoStore.initTasks();
				
				// 4. 加载成就徽章数量
				this.loadAchievements();
				
				// 5. 加载知识点数据
				await this.loadKnowledgePoints();
				
				// 6. 加载学习轨迹
				this.loadRecentActivities();
				
			} catch (error) {
				logger.error('[Index] 数据加载失败:', error);
				uni.showToast({
					title: '数据加载失败',
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
			this.studyStore.restoreProgress();
			this.todoStore.initTasks();
			this.userStore.restoreUserInfo();
			this.loadAchievements();
			this.loadKnowledgePoints();
			this.loadRecentActivities();
		},
		
		loadAchievements() {
			// 从本地存储获取成就数量
			const achievements = uni.getStorageSync('user_achievements') || [];
			this.achievementCount = Array.isArray(achievements) ? achievements.length : 0;
		},
		
		async loadKnowledgePoints() {
			uni.showLoading({ title: '加载中...', mask: false });
			try {
				// 从错题本获取数据
				const mistakes = await storageService.getMistakes(1, 999);
				const mistakeCount = mistakes?.data?.length || 0;
				
				// 从题库获取数据
				const questionBank = uni.getStorageSync('v30_bank') || [];
				const totalQuestions = questionBank.length;
				
				// 计算各类知识点
				this.knowledgePoints = [
					{ 
						id: 1, 
						title: '错题集', 
						count: mistakeCount, 
						icon: '🎯', 
						mastery: mistakeCount > 0 ? Math.max(10, 100 - mistakeCount * 2) : 100, 
						color: '#EF4444' 
					},
					{ 
						id: 2, 
						title: '热门考点', 
						count: Math.floor(totalQuestions * 0.3), 
						icon: '🔥', 
						mastery: 45, 
						color: '#F59E0B' 
					},
					{ 
						id: 3, 
						title: '练习题', 
						count: totalQuestions, 
						icon: '📝', 
						mastery: this.finishedCount > 0 ? Math.min(95, (this.finishedCount / totalQuestions) * 100) : 0, 
						color: '#00F2FF' 
					},
					{ 
						id: 4, 
						title: '核心概念', 
						count: Math.floor(totalQuestions * 0.4), 
						icon: '🧠', 
						mastery: this.accuracy > 0 ? Math.min(95, this.accuracy) : 0, 
						color: '#9FE870' 
					},
					{ 
						id: 5, 
						title: '公式定理', 
						count: Math.floor(totalQuestions * 0.2), 
						icon: '🧮', 
						mastery: 60, 
						color: '#A855F7' 
					},
					{ 
						id: 6, 
						title: '阅读理解', 
						count: Math.floor(totalQuestions * 0.15), 
						icon: '📖', 
						mastery: 50, 
						color: '#EC4899' 
					}
				];
			} catch (error) {
				logger.error('[Index] 加载知识点失败:', error);
			} finally {
				uni.hideLoading();
			}
		},
		
		loadRecentActivities() {
			// 从学习历史获取最近活动
			const history = this.studyStore?.questionHistory || [];
			
			if (history.length > 0) {
				this.recentActivities = history.slice(0, 4).map(record => ({
					title: `练习：${record.questionType || '综合题'}`,
					subtitle: record.isCorrect ? '答对，继续保持' : '答错，已加入错题本',
					time: this.formatTime(record.timestamp),
					icon: record.isCorrect ? '✓' : '✗',
					status: record.isCorrect ? 'completed' : 'in-progress'
				}));
			} else {
				// 默认活动
				this.recentActivities = [
					{ title: '开始学习', subtitle: '欢迎使用Exam-Master', time: '刚刚', icon: '🎉', status: 'completed' }
				];
			}
		},
		
		formatTime(timestamp) {
			if (!timestamp) return '刚刚';
			
			const now = Date.now();
			const diff = now - timestamp;
			
			const minute = 60 * 1000;
			const hour = 60 * minute;
			const day = 24 * hour;
			
			if (diff < minute) {
				return '刚刚';
			} else if (diff < hour) {
				return `${Math.floor(diff / minute)}分钟前`;
			} else if (diff < day) {
				return `${Math.floor(diff / hour)}小时前`;
			} else {
				return `${Math.floor(diff / day)}天前`;
			}
		},

		getInitials(name) {
			if (!name) return '';
			// 如果是默认名称"小伙伴"，返回空（使用图标）
			if (name === '小伙伴') return '';
			const parts = name.split(' ');
			if (parts.length >= 2) {
				return (parts[0][0] + parts[1][0]).toUpperCase();
			}
			// 中文名取前两个字符
			return name.substring(0, 2).toUpperCase();
		},

		getStatusText(status) {
			const map = {
				'completed': '已完成',
				'in-progress': '进行中',
				'pending': '待开始'
			};
			return map[status] || status;
		},

		// 根据mastery值确定气泡大小
		getBubbleSize(mastery) {
			if (mastery >= 80) return 'xl';
			if (mastery >= 60) return 'lg';
			if (mastery >= 40) return 'md';
			return 'sm';
		},

		// 获取气泡卡片样式（两种模式都使用绝对定位）
		getBubbleCardStyle(point, index) {
			// 调整位置避免气泡重叠，确保文字完全显示
			const positions = [
				{ top: '2%', left: '3%' },       // 错题集 - 左上
				{ top: '2%', right: '3%' },      // 热门考点 - 右上
				{ top: '32%', left: '3%' },      // 练习题 - 左中
				{ top: '32%', right: '3%' },     // 核心概念 - 右中
				{ bottom: '15%', left: '3%' },   // 公式定理 - 左下
				{ bottom: '15%', right: '3%' }   // 阅读理解 - 右下
			];
			const pos = positions[index % positions.length];
			
			if (this.isDark) {
				// 深色模式：光晕效果
				return {
					...pos,
					zIndex: 10 + index,  // 使用固定的 z-index 顺序
					animationDelay: `${index * 200}ms`,
					boxShadow: `0 0 40rpx ${point.color}4D, 0 0 80rpx ${point.color}33`
				};
			} else {
				// 浅色模式：白色阴影
				return {
					...pos,
					zIndex: 10 + index,  // 使用固定的 z-index 顺序
					animationDelay: `${index * 200}ms`,
					boxShadow: `0 4rpx 16rpx rgba(255, 255, 255, 0.3)`
				};
			}
		},

		toggleTheme() {
			this.isDark = !this.isDark;
			uni.setStorageSync('theme_mode', this.isDark ? 'dark' : 'light');
			uni.$emit('themeUpdate', this.isDark ? 'dark' : 'light');
			
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch (e) { logger.warn('[Index] toggleTheme vibrate failed', e); }
		},

		handleUserClick() {
			// 震动反馈
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch (e) { logger.warn('[Index] handleUserClick vibrate failed', e); }

			// 检查登录状态
			const isLoggedIn = this.userStore?.isLogin || false;
			const hasUserId = uni.getStorageSync('EXAM_USER_ID') || uni.getStorageSync('user_id');
			
			if (!isLoggedIn && !hasUserId) {
				// 未登录：显示微信一键登录弹窗
				this.openLoginModal();
			} else {
				// 已登录：直接跳转到设置页
				uni.navigateTo({ url: '/pages/settings/index' });
			}
		},
		
		// 显示登录引导弹窗
		openLoginModal() {
			// ✅ 使用自定义弹窗替换原生弹窗
			this.showLoginModal = true;
		},

		navToPractice() {
			// 防止重复点击
			if (this.isNavigating) return;
			this.isNavigating = true;

			// 震动反馈
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch (e) { logger.warn('[Index] navToPractice vibrate failed', e); }

			// 检查题库是否存在
			const questionBank = uni.getStorageSync('v30_bank') || [];
			if (questionBank.length === 0) {
				this.isNavigating = false;
				
				// ✅ 使用自定义弹窗替换原生弹窗
				this.showEmptyBankModal = true;
			} else {
				// 跳转到刷题页面
				uni.switchTab({
					url: '/pages/practice/index',
					success: () => {
						logger.log('[Index] 成功跳转到刷题页面');
					},
					fail: (err) => {
						logger.error('[Index] switchTab 失败:', err);
						// 尝试使用 reLaunch 作为备选
						uni.reLaunch({
							url: '/pages/practice/index',
							fail: (relaunchErr) => {
								logger.error('[Index] reLaunch 也失败:', relaunchErr);
								uni.showToast({
									title: '页面跳转失败',
									icon: 'none'
								});
							}
						});
					},
					complete: () => {
						setTimeout(() => {
							this.isNavigating = false;
						}, 500);
					}
				});
			}
		},

		navToMockExam() {
			// 防止重复点击
			if (this.isNavigating) return;
			this.isNavigating = true;

			// 震动反馈
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch (e) { logger.warn('[Index] navToMockExam vibrate failed', e); }

			// 检查题库是否存在
			const questionBank = uni.getStorageSync('v30_bank') || [];
			if (questionBank.length === 0) {
				this.isNavigating = false;
				
				// ✅ 使用自定义弹窗替换原生弹窗
				this.showEmptyBankModal = true;
			} else if (questionBank.length < 10) {
				this.isNavigating = false;
				
				// 题目太少 - 提示用户
				uni.showModal({
					title: '⚠️ 题目数量不足',
					content: `当前题库仅有 ${questionBank.length} 道题，建议至少 10 道题目后再进行模拟考试。`,
					confirmText: '继续上传',
					cancelText: '先刷题',
					success: (res) => {
						if (res.confirm) {
							uni.navigateTo({ url: '/pages/practice/import-data' });
						} else {
							uni.switchTab({ 
								url: '/pages/practice/index',
								fail: () => uni.reLaunch({ url: '/pages/practice/index' })
							});
						}
					}
				});
			} else {
				// ✅ 跳转到模拟考试页面
				uni.navigateTo({
					url: '/pages/practice/mock-exam',
					success: () => {
						logger.log('[Index] 成功跳转到模拟考试页面');
					},
					fail: (err) => {
						logger.error('[Index] 跳转模拟考试失败:', err);
						uni.showToast({ title: '页面跳转失败', icon: 'none' });
					},
					complete: () => {
						this.isNavigating = false;
					}
				});
			}
		},

		navToStudyDetail() {
			uni.navigateTo({ url: '/pages/study-detail/index' });
		},

		handleStatClick(type) {
			logger.log('[Index] Stat clicked:', type);
			
			const routes = {
				'questions': '/pages/practice/index',
				'accuracy': '/pages/mistake/index',
				'streak': '/pages/study-detail/index',
				'achievements': '/pages/profile/index'
			};
			
			if (routes[type]) {
				if (type === 'questions') {
					// practice/index 是 tabBar 页面
					uni.switchTab({ 
						url: routes[type],
						fail: () => uni.reLaunch({ url: routes[type] })
					});
				} else if (type === 'achievements') {
					// profile/index 是 tabBar 页面
					uni.switchTab({ 
						url: routes[type],
						fail: () => uni.reLaunch({ url: routes[type] })
					});
				} else {
					// 其他页面使用 navigateTo
					uni.navigateTo({ url: routes[type] });
				}
			}
		},

		async handleKnowledgeClick(point) {
			logger.log('[Index] Knowledge point clicked:', point.title);
			
			// ✅ 检查点1.4: 防止重复点击
			if (this.animatingBubbleId === point.id) return;
			
			// ✅ 检查点1.4: 播放缩放动画
			this.animatingBubbleId = point.id;
			
			// 震动反馈
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch (e) { logger.warn('[Index] handleKnowledgeClick vibrate failed', e); }
			
			// ✅ 检查点1.4: 记录轨迹
			await bubbleInteraction.handleClick(point, {
				enableAnimation: true,
				enableTracking: true,
				onAnimationEnd: () => {
					this.animatingBubbleId = null;
				}
			});
			
			// 根据气泡类型跳转到对应页面
			const routeMap = {
				'错题集': () => uni.navigateTo({ url: '/pages/mistake/index' }),
				'练习题': () => uni.switchTab({ 
					url: '/pages/practice/index',
					fail: () => uni.reLaunch({ url: '/pages/practice/index' })
				}),
				'热门考点': () => this.navToHotTopics(point),
				'核心概念': () => this.navToConcepts(point),
				'公式定理': () => this.navToFormulas(point),
				'阅读理解': () => this.navToReading(point)
			};
			
			// 延迟执行跳转，等待动画完成
			setTimeout(() => {
				const handler = routeMap[point.title];
				if (handler) {
					handler();
				} else {
					// 兜底：显示功能预告
					uni.showToast({ 
						title: `${point.icon} ${point.title}\n\n掌握度：${point.mastery}%\n题目数：${point.count} 项`, 
						icon: 'none',
						duration: 2000,
						mask: true
					});
				}
			}, 300);
		},
		
		// 热门考点 - 跳转到练习页并筛选
		navToHotTopics(point) {
			uni.switchTab({ 
				url: '/pages/practice/index',
				success: () => {
					uni.showToast({
						title: `${point.icon} 热门考点\n\n共 ${point.count} 个考点\n正确率目标：${point.mastery}%`,
						icon: 'none',
						duration: 2000
					});
				},
				fail: () => uni.reLaunch({ url: '/pages/practice/index' })
			});
		},
		
		// 核心概念 - 显示概念列表
		navToConcepts(point) {
			uni.switchTab({ 
				url: '/pages/practice/index',
				success: () => {
					uni.showToast({
						title: `${point.icon} 核心概念\n\n共 ${point.count} 个概念\n掌握度：${point.mastery}%`,
						icon: 'none',
						duration: 2000
					});
				},
				fail: () => uni.reLaunch({ url: '/pages/practice/index' })
			});
		},
		
		// 公式定理 - 显示公式列表弹窗
		navToFormulas(point) {
			this.showFormulaModal = true;
		},
		
		// 阅读理解 - 跳转到练习页
		navToReading(point) {
			uni.switchTab({ 
				url: '/pages/practice/index',
				success: () => {
					uni.showToast({
						title: `${point.icon} 阅读理解\n\n共 ${point.count} 篇\n正确率：${point.mastery}%`,
						icon: 'none',
						duration: 2000
					});
				},
				fail: () => uni.reLaunch({ url: '/pages/practice/index' })
			});
		},

		handleEditPlan() {
			// 震动反馈
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch (e) { logger.warn('[Index] handleEditPlan vibrate failed', e); }

			// ✅ 检查点1.3: 打开待办编辑器（新建模式）
			this.editingTodo = null;
			this.showTodoEditor = true;
		},

		// 处理待办事项切换 - 调用Store方法
		handleToggleTodo(todoId) {
			logger.log('[Index] Toggle todo ID:', todoId);
			
			try {
				const success = this.todoStore.toggleTask(todoId);
				if (success) {
					logger.log(`[Index] Todo ${todoId} toggled successfully`);
					// 震动反馈
					try {
						if (typeof uni.vibrateShort === 'function') {
							uni.vibrateShort();
						}
					} catch (e) { logger.warn('[Index] handleToggleTodo vibrate failed', e); }
				} else {
					logger.error('[Index] Todo not found:', todoId);
				}
			} catch (error) {
				logger.error('[Index] Toggle todo failed:', error);
				uni.showToast({
					title: '操作失败，请重试',
					icon: 'none'
				});
			}
		},

		// 滚动监听
		handleScroll(e) {
			this.scrollY = e.detail.scrollTop;
		},

		// ✅ P0-1: 处理空状态引导点击
		handleEmptyGuideAction(event) {
			logger.log('[Index] Empty guide action:', event.type);
			
			// 根据引导类型执行不同操作
			switch (event.type) {
				case 'new_user_onboarding':
					// 新用户引导 - 跳转到资料导入页
					uni.navigateTo({ url: '/pages/practice/import-data' });
					break;
				case 'empty_question_bank':
					// 题库为空 - 跳转到资料导入页
					uni.navigateTo({ url: '/pages/practice/import-data' });
					break;
				case 'empty_todo':
					// 待办为空 - 跳转到创建计划页
					uni.navigateTo({ url: '/pages/plan/create' });
					break;
				default:
					// 默认跳转到资料导入页
					uni.navigateTo({ url: '/pages/practice/import-data' });
			}
		},
		
		// ✅ 处理题库为空弹窗确认
		handleEmptyBankConfirm() {
			this.showEmptyBankModal = false;
			uni.navigateTo({ url: '/pages/practice/import-data' });
		},
		
		// ✅ 处理登录弹窗确认
		handleLoginConfirm() {
			this.showLoginModal = false;
			uni.navigateTo({ 
				url: '/pages/settings/index',
				success: () => {
					uni.showToast({
						title: '请点击头像完成登录',
						icon: 'none',
						duration: 2000
					});
				}
			});
		},

		// ==================== 每日金句功能 ====================
		
		/**
		 * 初始化每日金句
		 * 基于日期自动切换，每天显示不同的金句
		 */
		initDailyQuote() {
			const today = new Date();
			const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
			this.quoteDate = dateStr;
			
			// 检查是否有缓存的今日金句
			const cachedQuote = uni.getStorageSync('daily_quote_cache');
			const cachedDate = uni.getStorageSync('daily_quote_date');
			
			if (cachedDate === dateStr && cachedQuote) {
				// 使用缓存的金句
				this.dailyQuote = cachedQuote;
				logger.log('[Index] 使用缓存的每日金句');
			} else {
				// 生成新的每日金句
				this.generateDailyQuote();
			}
		},
		
		/**
		 * 生成每日金句
		 * 使用日期作为种子，确保每天的金句固定但每天不同
		 */
		generateDailyQuote() {
			const today = new Date();
			const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
			
			// 使用日期作为索引，确保每天固定
			const index = dayOfYear % this.quoteLibrary.length;
			this.dailyQuote = this.quoteLibrary[index];
			
			// 缓存到本地
			const dateStr = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
			uni.setStorageSync('daily_quote_cache', this.dailyQuote);
			uni.setStorageSync('daily_quote_date', dateStr);
			
			logger.log('[Index] 生成新的每日金句:', this.dailyQuote);
		},
		
		/**
		 * 刷新每日金句
		 * 点击金句卡片时触发，随机显示一条新金句
		 */
		refreshDailyQuote() {
			if (this.isRefreshingQuote) return; // 防止重复点击
			
			this.isRefreshingQuote = true;
			
			// 震动反馈
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch (e) { logger.warn('[Index] refreshDailyQuote vibrate failed', e); }
			
			// 随机选择一条不同的金句
			let newIndex;
			const currentQuote = this.dailyQuote;
			do {
				newIndex = Math.floor(Math.random() * this.quoteLibrary.length);
			} while (this.quoteLibrary[newIndex] === currentQuote && this.quoteLibrary.length > 1);
			
			// 延迟显示新金句（模拟加载效果）
			setTimeout(() => {
				this.dailyQuote = this.quoteLibrary[newIndex];
				this.isRefreshingQuote = false;
				
				// 更新缓存
				uni.setStorageSync('daily_quote_cache', this.dailyQuote);
				
				logger.log('[Index] 刷新每日金句:', this.dailyQuote);
			}, 300);
		},
		
		/**
		 * 打开每日金句海报弹窗
		 */
		openQuotePoster() {
			// 震动反馈
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch (e) { logger.warn('[Index] openQuotePoster vibrate failed', e); }
			
			// ✅ 检查点1.2: 打开分享弹窗
			this.showShareModal = true;
		},
		
		/**
		 * 获取当前日期
		 */
		getCurrentDate() {
			const now = new Date();
			const year = now.getFullYear();
			const month = now.getMonth() + 1;
			const day = now.getDate();
			const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
			const weekDay = weekDays[now.getDay()];
			return `${year}年${month}月${day}日 星期${weekDay}`;
		},
		
		/**
		 * 保存金句海报到相册
		 */
		saveQuotePoster() {
			// 震动反馈
			try {
				if (typeof uni.vibrateShort === 'function') {
					uni.vibrateShort();
				}
			} catch (e) { logger.warn('[Index] saveQuotePoster vibrate failed', e); }
			
			// ✅ 检查点1.2: 调用 quoteHandler 保存海报
			quoteHandler.generatePoster(this.dailyQuote, this.quoteAuthor)
				.then(result => {
					if (result.success) {
						quoteHandler.savePosterToAlbum(result.tempFilePath);
					}
				})
				.catch(err => {
					logger.error('[Index] 生成海报失败:', err);
					uni.showToast({
						title: '生成失败，请重试',
						icon: 'none'
					});
				});
		},
		
		// ✅ 检查点1.2: 处理金句收藏
		handleQuoteFavorite(data) {
			logger.log('[Index] Quote favorite:', data);
		},
		
		// ✅ 检查点1.2: 处理金句分享
		handleQuoteShare(data) {
			logger.log('[Index] Quote share:', data);
		},
		
		// ✅ 检查点1.3: 处理待办保存
		handleTodoSave(todo) {
			logger.log('[Index] Todo save:', todo);
			
			if (this.editingTodo) {
				// 编辑模式
				todoStorePatch.updateTodo(this.todoStore, todo);
			} else {
				// 新建模式
				todoStorePatch.addTodo(this.todoStore, todo);
			}
			
			this.showTodoEditor = false;
			this.editingTodo = null;
		},
		
		// ✅ 检查点1.3: 处理待办删除
		handleTodoDelete(todoId) {
			logger.log('[Index] Todo delete:', todoId);
			todoStorePatch.deleteTodo(this.todoStore, todoId);
			this.showTodoEditor = false;
			this.editingTodo = null;
		},
		
		// ✅ 检查点1.3: 打开待办编辑（编辑模式）
		openTodoEditor(todo) {
			this.editingTodo = {
				id: todo.id,
				text: todo.text,
				priority: todo.priority,
				completed: todo.completed
			};
			this.showTodoEditor = true;
		},
		
		// ✅ 检查点1.1: 快速开始（加载示例题库）
		handleQuickStart() {
			uni.showLoading({ title: '加载示例题库...' });
			
			const demoQuestions = [
				{
					id: 'demo_1',
					question: '以下哪个是 JavaScript 的基本数据类型？',
					options: ['Array', 'Object', 'String', 'Function'],
					answer: 2,
					explanation: 'String 是 JavaScript 的基本数据类型之一。'
				},
				{
					id: 'demo_2',
					question: 'Vue 3 中，以下哪个是组合式 API？',
					options: ['data()', 'methods', 'setup()', 'computed'],
					answer: 2,
					explanation: 'setup() 是 Vue 3 组合式 API 的入口函数。'
				},
				{
					id: 'demo_3',
					question: 'HTTP 状态码 404 表示什么？',
					options: ['服务器错误', '请求成功', '资源未找到', '重定向'],
					answer: 2,
					explanation: '404 Not Found 表示请求的资源不存在。'
				}
			];
			
			uni.setStorageSync('v30_bank', demoQuestions);
			
			setTimeout(() => {
				uni.hideLoading();
				uni.showToast({ title: '示例题库已加载', icon: 'success' });
				
				setTimeout(() => {
					// 使用正确的 tabBar 页面路径格式
					uni.switchTab({ 
						url: '/pages/practice/index',
						fail: (err) => {
							logger.error('[Index] switchTab 失败:', err);
							// 备选方案：使用 reLaunch
							uni.reLaunch({ url: '/pages/practice/index' });
						}
					});
				}, 1500);
			}, 800);
		},
		
		// ✅ 检查点1.1: 查看教程
		handleTutorial() {
			uni.showModal({
				title: '📖 快速上手教程',
				content: '1. 上传学习资料（PDF/Word/图片）\n2. AI 自动提取知识点生成题目\n3. 开始刷题，错题自动收录\n4. 查看学习报告，持续进步',
				confirmText: '开始上传',
				cancelText: '稍后再说',
				success: (res) => {
					if (res.confirm) {
						uni.navigateTo({ url: '/pages/practice/import-data' });
					}
				}
			});
		},
		
		// ✅ 检查点1.5: 初始化学习计时器
		initStudyTimer() {
			// 检查日期是否变化
			const savedDate = uni.getStorageSync('study_date');
			const today = new Date().toISOString().split('T')[0];
			
			if (savedDate !== today) {
				// 新的一天，重置今日时长
				this.todayStudyTime = 0;
				uni.setStorageSync('study_date', today);
				uni.setStorageSync('today_study_time', 0);
				// 清除旧的会话开始时间
				uni.removeStorageSync('session_start_time');
			} else {
				// 恢复今日时长（确保是数字类型）
				const savedTime = uni.getStorageSync('today_study_time');
				this.todayStudyTime = typeof savedTime === 'number' ? savedTime : 0;
			}
			
			// 不再自动补偿断线时间，避免虚假数据
			// 只有在用户实际使用应用时才计时
			
			logger.log('[Index] 学习计时器初始化，今日:', this.todayStudyTime, '分钟');
		},
		
		// ✅ 检查点1.5: 开始计时（仅在刷题时调用）
		startStudyTimer() {
			// 首页不自动开始计时，只有在刷题页面才计时
			// 这里只是恢复之前的状态显示
			logger.log('[Index] 学习计时器状态检查，今日:', this.todayStudyTime, '分钟');
		},
		
		// ✅ 检查点1.5: 停止计时
		stopStudyTimer() {
			if (this.studyTimerInterval) {
				clearInterval(this.studyTimerInterval);
				this.studyTimerInterval = null;
			}
			uni.removeStorageSync('session_start_time');
		},
		
		// ✅ 检查点1.5: 保存学习时长
		saveStudyTime() {
			uni.setStorageSync('today_study_time', this.todayStudyTime);
			uni.setStorageSync('study_date', new Date().toISOString().split('T')[0]);
		},
		
		// ✅ 检查点1.5: 格式化学习时长
		formatStudyTime(minutes) {
			// 确保 minutes 是有效数字
			if (!minutes || minutes <= 0) {
				return '0 分钟';
			}
			const hours = Math.floor(minutes / 60);
			const mins = minutes % 60;
			if (hours > 0) {
				return `${hours}小时${mins}分钟`;
			}
			return `${mins}分钟`;
		}
	}
};
</script>

<style lang="scss" scoped>
/* ==================== 页面最外层容器 ==================== */
.page-wrapper {
	min-height: 100vh;
	position: relative;
	/* 关键：最外层背景白色，这样 TabBar 下方不会显示绿色 */
	background-color: #FFFFFF;
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
	backdrop-filter: blur(24rpx);
	-webkit-backdrop-filter: blur(24rpx);
	border: 1rpx solid var(--border);
}

/* ==================== 动画定义 ==================== */
@keyframes float {
	0%, 100% { transform: translateY(0rpx); }
	50% { transform: translateY(-16rpx); }
}

@keyframes pulse-glow {
	0%, 100% {
		box-shadow: 0 0 40rpx var(--primary-light), 0 0 80rpx var(--primary-light);
	}
	50% {
		box-shadow: 0 0 60rpx var(--primary-light), 0 0 120rpx var(--primary-light);
	}
}

.animate-pulse-glow {
	animation: pulse-glow 3s ease-in-out infinite;
}

.bubble-float {
	animation: float 4s ease-in-out infinite;
}

/* ==================== 顶部导航栏 ==================== */
/* 外层定位容器：绝对不能有任何背景色 */
.header-position-wrapper {
	/* 所有背景相关属性都在 inline style 中用 !important 强制透明 */
}

/* 状态栏占位 */
.status-bar-placeholder {
	height: var(--status-bar-height, 44px);
}

/* 内容区域：默认透明背景 */
.header-content-area {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 100rpx;
	padding: 0 32rpx;
	background: transparent;
	transition: background 0.3s ease, backdrop-filter 0.3s ease;
}

.header-content-area.header-scrolled {
	background: var(--bg-glass);
	backdrop-filter: blur(20rpx);
	-webkit-backdrop-filter: blur(20rpx);
}

/* 旧样式保留兼容 */
.dashboard-header {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 100;
	width: 100%;
	background: none !important;
	background-color: transparent !important;
	border: none !important;
	box-shadow: none !important;
}

.header-light {
	background: none !important;
	background-color: transparent !important;
}

.header-transparent {
	background: none !important;
	background-color: transparent !important;
	backdrop-filter: none !important;
	-webkit-backdrop-filter: none !important;
	box-shadow: none !important;
	border: none !important;
}

.header-content {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 128rpx;
	padding: 0 32rpx;
}

.header-left {
	display: flex;
	align-items: center;
	gap: 24rpx;
}

.app-logo {
	width: 72rpx;
	height: 72rpx;
	border-radius: 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 700;
}

.logo-light {
	background: var(--primary);
	color: var(--primary-foreground);
}

.logo-dark {
	background: var(--primary);
	color: var(--primary-foreground);
}

.logo-text {
	font-size: 32rpx;
	font-weight: 700;
}

.app-title {
	font-size: 36rpx;
	font-weight: 600;
	color: var(--text-primary);
}

.header-right {
	display: flex;
	align-items: center;
	gap: 24rpx;
}

.theme-toggle {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.3s ease;
}

.theme-toggle:active {
	transform: scale(0.9);
}

.theme-icon {
	font-size: 40rpx;
}

.user-avatar {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: 500;
}

.avatar-light {
	background: var(--bg-card);
	color: var(--text-primary);
	border: 2rpx solid var(--border);
}

.avatar-dark {
	background: var(--gradient-primary);
	color: var(--primary-foreground);
}

.avatar-text {
	font-size: 28rpx;
	font-weight: 500;
}

/* 未登录时的图标样式 */
.avatar-icon {
	font-size: 36rpx;
}

/* ==================== Wise/Bitget风格Logo ==================== */
.app-logo-new {
	width: 72rpx;
	height: 72rpx;
	border-radius: 20rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	overflow: hidden;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 品牌Logo样式 */
.app-logo-wrapper {
	width: 72rpx;
	height: 72rpx;
	border-radius: 16rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.app-logo-wrapper:active {
	transform: scale(0.95);
}

.app-logo-img {
	width: 100%;
	height: 100%;
	object-fit: contain;
}

.app-logo-new:active {
	transform: scale(0.95);
}

.logo-wise {
	background: var(--gradient-primary);
	box-shadow: var(--shadow-md);
}

.logo-bitget {
	background: var(--gradient-primary);
	box-shadow: var(--shadow-md);
}

.logo-icon {
	position: relative;
	width: 48rpx;
	height: 48rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

/* 三个几何形状组成Logo */
.logo-shape {
	position: absolute;
	border-radius: 4rpx;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Wise风格：三个矩形条 */
.logo-wise .logo-shape-1 {
	width: 8rpx;
	height: 32rpx;
	background: rgba(255, 255, 255, 0.9);
	left: 8rpx;
	top: 8rpx;
	transform: rotate(-15deg);
}

.logo-wise .logo-shape-2 {
	width: 8rpx;
	height: 40rpx;
	background: rgba(255, 255, 255, 1);
	left: 20rpx;
	top: 4rpx;
}

.logo-wise .logo-shape-3 {
	width: 8rpx;
	height: 28rpx;
	background: rgba(255, 255, 255, 0.85);
	right: 8rpx;
	top: 10rpx;
	transform: rotate(15deg);
}

/* Bitget风格：三个菱形/方块 */
.logo-bitget .logo-shape-1 {
	width: 16rpx;
	height: 16rpx;
	background: rgba(255, 255, 255, 0.9);
	left: 4rpx;
	top: 16rpx;
	transform: rotate(45deg);
	border-radius: 2rpx;
}

.logo-bitget .logo-shape-2 {
	width: 20rpx;
	height: 20rpx;
	background: rgba(255, 255, 255, 1);
	left: 14rpx;
	top: 14rpx;
	transform: rotate(45deg);
	border-radius: 3rpx;
}

.logo-bitget .logo-shape-3 {
	width: 14rpx;
	height: 14rpx;
	background: rgba(255, 255, 255, 0.85);
	right: 6rpx;
	top: 18rpx;
	transform: rotate(45deg);
	border-radius: 2rpx;
}

/* Logo悬停动画 */
.app-logo-new:active .logo-shape {
	transform: scale(1.1) rotate(0deg);
}

.logo-wise:active .logo-shape-1 {
	transform: scale(1.1) rotate(-15deg);
}

.logo-wise:active .logo-shape-3 {
	transform: scale(1.1) rotate(15deg);
}

.logo-bitget:active .logo-shape {
	transform: scale(1.1) rotate(45deg);
}

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

/* 内容包装器 */
.content-wrapper {
	padding: var(--ds-spacing-xl, 48rpx) var(--ds-spacing-lg, 32rpx);
}

/* ==================== 欢迎横幅 ==================== */
.welcome-banner {
	position: relative;
	overflow: hidden;
	border-radius: 48rpx;
	padding: 48rpx;
	margin-bottom: 64rpx;
	border: 1rpx solid var(--border);
}

.banner-light {
	background: var(--bg-secondary);
}

.banner-dark {
	background: var(--bg-card);
	border-color: var(--border);
}

.bubble-decoration {
	position: absolute;
	border-radius: 50%;
	pointer-events: none;
}

.bubble-1 {
	right: -160rpx;
	top: -160rpx;
	width: 512rpx;
	height: 512rpx;
	background: var(--primary-light);
	filter: blur(120rpx);
}

.bubble-2 {
	bottom: -80rpx;
	left: -80rpx;
	width: 384rpx;
	height: 384rpx;
	background: var(--primary-light);
	filter: blur(120rpx);
}

.banner-content {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: column;
	gap: 32rpx;
}

.banner-text {
	display: flex;
	flex-direction: column;
	gap: 16rpx;
}

.welcome-title {
	font-size: 56rpx;
	font-weight: 700;
	color: var(--text-primary);
	line-height: 1.2;
}

.welcome-subtitle {
	font-size: 28rpx;
	color: var(--text-sub);
	line-height: 1.6;
}

/* 浅色模式下增强待复习文字对比度 */
.banner-light .welcome-subtitle {
	color: var(--text-sub);
}

.highlight-text {
	color: var(--primary);
	font-weight: 600;
}

/* 浅色模式下高亮文字使用深色 */
.banner-light .highlight-text {
	color: #059669;
}

.banner-actions {
	display: flex;
	gap: var(--ds-spacing-md, 24rpx);
	flex-wrap: wrap;
}

.action-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: var(--ds-spacing-sm, 16rpx);
	padding: var(--ds-spacing-md, 24rpx) var(--ds-spacing-xl, 48rpx);
	border-radius: var(--ds-radius-lg, 24rpx);
	font-size: var(--ds-font-size-base, 28rpx);
	font-weight: 600;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	/* 确保按钮点击区域足够大 */
	min-height: 88rpx;
}

.btn-primary {
	background: var(--primary);
	color: var(--primary-foreground);
}

.btn-outline {
	background: rgba(255, 255, 255, 0.6);
	border: 2rpx solid var(--border);
	color: var(--text-primary);
	backdrop-filter: blur(8rpx);
	-webkit-backdrop-filter: blur(8rpx);
}

/* 深色模式下的模拟考试按钮 */
.banner-dark .btn-outline {
	background: rgba(255, 255, 255, 0.15);
	border-color: rgba(255, 255, 255, 0.2);
}

.action-btn:active {
	transform: scale(0.95);
}

.btn-icon {
	font-size: 32rpx;
}

.btn-text {
	font-size: 28rpx;
}

/* ==================== 统计卡片网格 ==================== */
.stats-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: var(--ds-spacing-md, 24rpx);
	margin-bottom: var(--ds-spacing-lg, 32rpx);
}

/* ==================== 检查点1.5: 今日学习时长卡片 ==================== */
.study-time-card {
	display: flex;
	align-items: center;
	gap: 24rpx;
	padding: 24rpx 32rpx;
	border-radius: 24rpx;
	margin-bottom: 64rpx;
	border: 1rpx solid var(--border);
}

.time-icon-wrapper {
	width: 64rpx;
	height: 64rpx;
	border-radius: 16rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--primary-light);
}

.time-icon {
	font-size: 32rpx;
}

.time-content {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 4rpx;
}

.time-label {
	font-size: 24rpx;
	color: var(--text-sub);
}

.time-value {
	font-size: 32rpx;
	font-weight: 700;
	color: var(--text-primary);
}

.time-indicator {
	display: flex;
	align-items: center;
	gap: 8rpx;
	padding: 8rpx 16rpx;
	border-radius: 20rpx;
	background: rgba(156, 163, 175, 0.1);
}

.time-indicator.indicator-active {
	background: rgba(16, 185, 129, 0.1);
}

.indicator-dot {
	width: 12rpx;
	height: 12rpx;
	border-radius: 50%;
	background: #9CA3AF;
}

.indicator-active .indicator-dot {
	background: #10B981;
	animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
	0%, 100% { opacity: 1; transform: scale(1); }
	50% { opacity: 0.5; transform: scale(1.2); }
}

.indicator-text {
	font-size: 22rpx;
	color: var(--text-sub);
}

.indicator-active .indicator-text {
	color: #10B981;
}

.stat-card {
	border-radius: 32rpx;
	padding: 32rpx;
	display: flex;
	flex-direction: column;
	gap: 16rpx;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	border: 1rpx solid var(--border);
}

.card-light {
	background: var(--card);
}

.card-hover:active {
	transform: translateY(-4rpx);
	box-shadow: var(--shadow-lg);
}

.stat-icon-wrapper {
	width: 96rpx;
	height: 96rpx;
	border-radius: 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.icon-primary {
	background: var(--primary-light);
}

.icon-success {
	background: var(--success-light);
}

.icon-warning {
	background: var(--warning-light);
}

.icon-neutral {
	background: var(--bg-secondary);
}

.stat-icon {
	font-size: 48rpx;
}

.stat-content {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.stat-title {
	font-size: 24rpx;
	color: var(--text-sub);
	font-weight: 500;
}

.stat-value {
	font-size: 48rpx;
	font-weight: 700;
	color: var(--text-primary);
	line-height: 1.2;
}

.stat-change {
	font-size: 24rpx;
	font-weight: 500;
}

.stat-change.positive {
	color: var(--success);
}

.stat-change.neutral {
	color: var(--text-sub);
}

/* ==================== 章节标题 ==================== */
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

/* ==================== 知识点气泡场 ==================== */
.knowledge-field {
	margin-bottom: 64rpx;
}

/* 两种模式都使用浮动布局 */
.field-floating {
	position: relative;
	min-height: 800rpx;
}

/* 气泡卡片 - 两种模式统一为圆形 + 绝对定位 */
.bubble-card {
	position: absolute;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	border-radius: 50%;
}

/* ✅ 检查点1.4: 气泡点击动画 */
.bubble-animating {
	animation: bubbleClick 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

@keyframes bubbleClick {
	0% { transform: scale(1); opacity: 1; }
	30% { transform: scale(1.15); opacity: 0.9; }
	60% { transform: scale(0.95); opacity: 1; }
	100% { transform: scale(1); opacity: 1; }
}

.bubble-card-light {
	background: var(--bg-card);
	backdrop-filter: blur(24rpx);
	-webkit-backdrop-filter: blur(24rpx);
	border: 1rpx solid var(--border);
	box-shadow: var(--shadow-sm);
}

.bubble-card-light:active {
	transform: scale(1.05);
}

.bubble-card-dark {
	background: var(--bg-card);
	backdrop-filter: blur(24rpx);
	-webkit-backdrop-filter: blur(24rpx);
	border: 1rpx solid var(--border);
}

.bubble-card-dark:active {
	transform: scale(1.05);
}

/* 气泡尺寸 - 根据mastery动态调整 */
.bubble-size-sm {
	width: 192rpx;
	height: 192rpx;
}

.bubble-size-md {
	width: 256rpx;
	height: 256rpx;
}

.bubble-size-lg {
	width: 320rpx;
	height: 320rpx;
}

.bubble-size-xl {
	width: 384rpx;
	height: 384rpx;
}

/* 光晕层 - 呼吸动画 */
.bubble-glow {
	position: absolute;
	inset: 0;
	border-radius: 50%;
	opacity: 0.5;
	pointer-events: none;
}

@keyframes breathe {
	0%, 100% { opacity: 0.6; }
	50% { opacity: 1; }
}

.animate-breathe {
	animation: breathe 2s ease-in-out infinite;
}

/* 内容层 */
.bubble-content {
	position: relative;
	z-index: 10;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8rpx;
	padding: 24rpx;
	text-align: center;
}

.bubble-icon-wrapper {
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	padding: 16rpx;
}

.bubble-card-light .bubble-icon-wrapper {
	background: var(--bg-secondary);
}

.bubble-card-dark .bubble-icon-wrapper {
	background: transparent;
}

.bubble-icon {
	font-size: 40rpx;
	line-height: 1;
}

.bubble-title {
	font-size: 24rpx;
	font-weight: 600;
	line-height: 1.2;
	word-break: break-all;
	max-width: 100%;
}

.bubble-count {
	font-size: 20rpx;
	color: var(--text-sub);
}

.bubble-progress-wrapper {
	width: 100%;
	padding: 0 16rpx;
	margin-top: 8rpx;
}

.bubble-progress-bar {
	width: 100%;
	height: 4rpx;
	background: var(--bg-secondary);
	border-radius: 2rpx;
	overflow: hidden;
}

.bubble-progress-fill {
	height: 100%;
	border-radius: 2rpx;
	transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ==================== 学习轨迹 ==================== */
.activity-list {
	display: flex;
	flex-direction: column;
	gap: 24rpx;
	margin-bottom: 64rpx;
}

.activity-item {
	display: flex;
	align-items: center;
	gap: 32rpx;
	padding: 32rpx;
	border-radius: 24rpx;
	border: 1rpx solid var(--border);
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.activity-icon-wrapper {
	width: 80rpx;
	height: 80rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.status-completed {
	background: var(--success-light);
	color: var(--success);
}

.status-in-progress {
	background: var(--primary-light);
	color: var(--primary);
}

.status-pending {
	background: var(--bg-secondary);
	color: var(--text-sub);
}

.activity-icon {
	font-size: 40rpx;
}

.activity-content {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
	min-width: 0;
}

.activity-title {
	font-size: 28rpx;
	font-weight: 600;
	color: var(--text-primary);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.activity-subtitle {
	font-size: 24rpx;
	color: var(--text-sub);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.activity-meta {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 8rpx;
	flex-shrink: 0;
}

.activity-time {
	font-size: 20rpx;
	color: var(--text-sub);
}

.activity-badge {
	padding: 4rpx 16rpx;
	border-radius: 20rpx;
	font-size: 20rpx;
}

.badge-completed {
	background: var(--success-light);
	color: var(--success);
}

.badge-in-progress {
	background: var(--primary-light);
	color: var(--primary);
}

.badge-pending {
	background: var(--bg-secondary);
	color: var(--text-sub);
}

.badge-text {
	font-size: 20rpx;
	font-weight: 500;
}

/* ==================== 模式说明 ==================== */
.mode-description {
	padding: 48rpx;
	border-radius: 32rpx;
	text-align: center;
	border: 1rpx solid var(--border);
	margin-bottom: 32rpx;
	cursor: pointer;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	position: relative;
}

.mode-description:active {
	transform: scale(0.98);
	opacity: 0.9;
}

.desc-light {
	background: var(--bg-secondary);
}

/* 浅色模式下每日金句文字颜色 */
.desc-light .mode-text {
	color: var(--text-sub);
}

.desc-light .mode-highlight {
	color: #059669;
}

.mode-text {
	font-size: 32rpx;
	color: var(--text-sub);
	line-height: 1.8;
	display: block;
	margin-bottom: 16rpx;
}

.mode-highlight {
	color: var(--primary);
	font-weight: 700;
	font-size: 34rpx;
}

.quote-hint {
	font-size: 24rpx;
	color: var(--text-sub);
	opacity: 0.6;
	display: block;
	margin-top: 16rpx;
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
	font-size: 24rpx;
}

.edit-text {
	font-size: 24rpx;
	font-weight: 600;
}

/* ==================== 公式定理弹窗 ==================== */
.formula-modal {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.6);
	backdrop-filter: blur(10rpx);
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
	animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
	from { opacity: 0; }
	to { opacity: 1; }
}

.formula-content {
	width: 90%;
	max-width: 680rpx;
	max-height: 80vh;
	background: var(--bg-card);
	border-radius: 32rpx;
	overflow: hidden;
	box-shadow: var(--shadow-xl);
	animation: slideUp 0.3s ease;
}

@keyframes slideUp {
	from { transform: translateY(100rpx); opacity: 0; }
	to { transform: translateY(0); opacity: 1; }
}

.formula-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 32rpx;
	border-bottom: 1rpx solid var(--border);
	background: var(--bg-secondary);
}

.formula-title {
	font-size: 36rpx;
	font-weight: 700;
	color: var(--text-primary);
}

.formula-close {
	width: 60rpx;
	height: 60rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	background: var(--bg-card);
	color: var(--text-sub);
	font-size: 40rpx;
}

.formula-scroll {
	max-height: 60vh;
	padding: 24rpx;
}

.formula-item {
	background: var(--bg-secondary);
	border-radius: 20rpx;
	padding: 24rpx;
	margin-bottom: 20rpx;
	border: 1rpx solid var(--border);
}

.formula-category {
	display: inline-block;
	background: var(--primary-light);
	color: var(--primary);
	font-size: 20rpx;
	padding: 4rpx 16rpx;
	border-radius: 10rpx;
	margin-bottom: 12rpx;
}

.formula-name {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: var(--text-primary);
	margin-bottom: 8rpx;
}

.formula-text {
	display: block;
	font-size: 32rpx;
	font-weight: 700;
	color: var(--primary);
	font-family: 'Times New Roman', serif;
}

.formula-footer {
	padding: 24rpx 32rpx;
	border-top: 1rpx solid var(--border);
	text-align: center;
}

.formula-tip {
	font-size: 24rpx;
	color: var(--text-sub);
}

/* ==================== 每日金句海报弹窗 ==================== */
.quote-poster-modal {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.7);
	backdrop-filter: blur(20rpx);
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
	animation: fadeIn 0.3s ease;
}

.quote-poster-content {
	width: 90%;
	max-width: 640rpx;
	animation: slideUp 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28);
}

.poster-card {
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	border-radius: 32rpx;
	padding: 64rpx 48rpx;
	position: relative;
	overflow: hidden;
	box-shadow: 0 40rpx 80rpx rgba(102, 126, 234, 0.4);
}

.poster-card.poster-dark {
	background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
	box-shadow: 0 40rpx 80rpx rgba(0, 0, 0, 0.5);
}

.poster-decoration {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	pointer-events: none;
}

.poster-circle {
	position: absolute;
	border-radius: 50%;
	opacity: 0.2;
}

.poster-circle-1 {
	width: 300rpx;
	height: 300rpx;
	background: var(--bg-card);
	top: -100rpx;
	right: -100rpx;
}

.poster-circle-2 {
	width: 200rpx;
	height: 200rpx;
	background: var(--bg-card);
	bottom: -50rpx;
	left: -50rpx;
}

.poster-body {
	position: relative;
	z-index: 1;
	text-align: center;
}

.poster-quote {
	display: block;
	font-size: 36rpx;
	font-weight: 600;
	color: white;
	line-height: 1.8;
	margin-bottom: 32rpx;
	text-shadow: 0 4rpx 8rpx rgba(0, 0, 0, 0.2);
}

.poster-author {
	display: block;
	font-size: 26rpx;
	color: rgba(255, 255, 255, 0.8);
	margin-bottom: 48rpx;
}

.poster-date {
	margin-bottom: 48rpx;
}

.poster-date text {
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.7);
	background: rgba(255, 255, 255, 0.15);
	padding: 8rpx 24rpx;
	border-radius: 20rpx;
}

.poster-brand {
	border-top: 1rpx solid rgba(255, 255, 255, 0.2);
	padding-top: 32rpx;
}

.brand-name {
	display: block;
	font-size: 28rpx;
	font-weight: 700;
	color: white;
	margin-bottom: 8rpx;
}

.brand-slogan {
	display: block;
	font-size: 22rpx;
	color: rgba(255, 255, 255, 0.7);
}

.poster-actions {
	display: flex;
	gap: 24rpx;
	margin-top: 32rpx;
}

.poster-btn {
	flex: 1;
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 44rpx;
	font-size: 28rpx;
	font-weight: 600;
	transition: all 0.3s ease;
}

.poster-btn:active {
	transform: scale(0.95);
}

.poster-btn-secondary {
	background: rgba(255, 255, 255, 0.2);
	color: white;
	backdrop-filter: blur(10rpx);
}

.poster-btn-primary {
	background: var(--bg-card);
	color: #667eea;
}
</style>