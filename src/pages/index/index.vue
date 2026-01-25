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
						<!-- Wise/Bitget风格Logo -->
						<view :class="['app-logo-new', isDark ? 'logo-bitget' : 'logo-wise']">
							<view class="logo-icon">
								<view class="logo-shape logo-shape-1"></view>
								<view class="logo-shape logo-shape-2"></view>
								<view class="logo-shape logo-shape-3"></view>
							</view>
						</view>
						<text class="app-title">Exam-Master</text>
					</view>
					<view class="header-right">
						<view class="theme-toggle" @tap="toggleTheme">
							<text class="theme-icon">{{ isDark ? '🌙' : '☀️' }}</text>
						</view>
						<view :class="['user-avatar', isDark ? 'avatar-dark' : 'avatar-light']" @tap="handleUserClick">
							<text class="avatar-text">{{ userInitials }}</text>
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

			<!-- 统计卡片网格 -->
			<view class="stats-grid">
				<view :class="['stat-card', isDark ? 'glass' : 'card-light', 'card-hover']" @tap="handleStatClick('questions')">
					<view class="stat-icon-wrapper icon-primary">
						<text class="stat-icon">✓</text>
					</view>
					<view class="stat-content">
						<text class="stat-title">题目总数</text>
						<text class="stat-value">{{ totalQuestions }}</text>
						<text class="stat-change positive">本周 +12%</text>
					</view>
				</view>

				<view :class="['stat-card', isDark ? 'glass' : 'card-light', 'card-hover']" @tap="handleStatClick('accuracy')">
					<view class="stat-icon-wrapper icon-success">
						<text class="stat-icon">📈</text>
					</view>
					<view class="stat-content">
						<text class="stat-title">正确率</text>
						<text class="stat-value">{{ accuracy }}%</text>
						<text class="stat-change positive">提升 +3.2%</text>
					</view>
				</view>

				<view :class="['stat-card', isDark ? 'glass' : 'card-light', 'card-hover']" @tap="handleStatClick('streak')">
					<view class="stat-icon-wrapper icon-warning">
						<text class="stat-icon">⚡</text>
					</view>
					<view class="stat-content">
						<text class="stat-title">学习天数</text>
						<text class="stat-value">{{ totalStudyDays }} 天</text>
						<text class="stat-change positive">个人最佳！</text>
					</view>
				</view>

				<view :class="['stat-card', isDark ? 'glass' : 'card-light', 'card-hover']" @tap="handleStatClick('achievements')">
					<view class="stat-icon-wrapper icon-neutral">
						<text class="stat-icon">🏆</text>
					</view>
					<view class="stat-content">
						<text class="stat-title">成就徽章</text>
						<text class="stat-value">{{ achievementCount }}</text>
						<text class="stat-change neutral">新解锁 2 个</text>
					</view>
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
						'bubble-float'
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
			<todo-list :todos="todos" :is-dark="isDark" @toggleTodo="handleToggleTodo"></todo-list>

			<!-- 每日金句 -->
			<view :class="['mode-description', isDark ? 'glass' : 'desc-light']" style="margin-top: 64rpx;">
				<text class="mode-text">
					<text class="mode-highlight">💡 每日金句：</text>
					{{ dailyQuote }}
				</text>
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
	</view>
</template>

<script>
import CustomTabbar from '../../components/layout/custom-tabbar/custom-tabbar.vue';
import BaseSkeleton from '../../components/base/base-skeleton/base-skeleton.vue';
import TodoList from '../../components/common/TodoList.vue';
import { getGreetingTime } from '../../utils/core/date';
import { useStudyStore } from '../../stores/modules/study';
import { useTodoStore } from '../../stores/modules/todo';
import { useUserStore } from '../../stores/modules/user';
import { lafService } from '../../services/lafService.js';
import { storageService } from '../../services/storageService.js';

export default {
	components: {
		CustomTabbar,
		BaseSkeleton,
		TodoList
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
			
			// 成就徽章数量（从本地存储获取）
			achievementCount: 0,

			// 按钮防重复点击状态
			isNavigating: false,
			
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
			dailyQuote: '成功不是终点，失败也不是终结，唯有勇气才是永恒。'
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

		// 初始化每日金句
		this.initDailyQuote();

		this.loadData();
	},

	onShow() {
		uni.hideTabBar({ animation: false });
		this.refreshData();
	},

	onUnload() {
		uni.$off('themeUpdate');
	},

	computed: {
		// 两种模式都按mastery排序（低到高）
		sortedKnowledgePoints() {
			return [...this.knowledgePoints].sort((a, b) => a.mastery - b.mastery);
		},
		
		// 用户信息
		userName() {
			return this.userStore?.userInfo?.nickName || '学习者';
		},
		
		userInitials() {
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
		
		// 待办事项数据
		todos() {
			if (!this.todoStore?.tasks) return [];
			return this.todoStore.tasks.map(task => ({
				id: task.id,
				text: task.title,
				completed: task.done,
				priority: task.tag || task.priority
			}));
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

				console.log('[Index] 布局信息初始化:', this.layoutInfo);
			} catch (e) {
				console.warn('[Index] 布局信息初始化失败，使用默认值:', e);
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
				console.error('[Index] 数据加载失败:', error);
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
				console.error('[Index] 加载知识点失败:', error);
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
			if (!name) return 'JD';
			const parts = name.split(' ');
			if (parts.length >= 2) {
				return (parts[0][0] + parts[1][0]).toUpperCase();
			}
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
			const positions = [
				{ top: '5%', left: '5%' },
				{ top: '10%', right: '15%' },
				{ top: '35%', left: '25%' },
				{ bottom: '10%', right: '5%' },
				{ top: '20%', left: '55%' },
				{ bottom: '25%', left: '10%' }
			];
			const pos = positions[index % positions.length];
			
			if (this.isDark) {
				// 深色模式：光晕效果
				return {
					...pos,
					zIndex: point.mastery,
					animationDelay: `${index * 200}ms`,
					boxShadow: `0 0 40rpx ${point.color}4D, 0 0 80rpx ${point.color}33`
				};
			} else {
				// 浅色模式：白色阴影
				return {
					...pos,
					zIndex: point.mastery,
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
			} catch (e) {}
		},

		handleUserClick() {
			uni.navigateTo({ url: '/src/pages/settings/index' });
		},

		navToPractice() {
			// 防止重复点击
			if (this.isNavigating) return;
			this.isNavigating = true;

			// 检查题库是否存在
			const questionBank = uni.getStorageSync('v30_bank') || [];
			if (questionBank.length === 0) {
				this.isNavigating = false;
				uni.showModal({
					title: '提示',
					content: '题库为空，请先导入题目',
					confirmText: '去导入',
					success: (res) => {
						if (res.confirm) {
							uni.navigateTo({ url: '/src/pages/practice/import-data' });
						}
					}
				});
			} else {
				uni.switchTab({
					url: '/src/pages/practice/index',
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

			uni.showModal({
				title: '模拟考试',
				content: '模拟考试功能正在开发中，敬请期待！\n\n将提供：\n• 真实考试环境模拟\n• 智能组卷\n• 详细成绩分析',
				showCancel: false,
				confirmText: '知道了',
				complete: () => {
					this.isNavigating = false;
				}
			});
		},

		navToStudyDetail() {
			uni.navigateTo({ url: '/src/pages/study-detail/index' });
		},

		handleStatClick(type) {
			console.log('[Index] Stat clicked:', type);
			
			const routes = {
				'questions': '/src/pages/practice/index',
				'accuracy': '/src/pages/mistake/index',
				'streak': '/src/pages/study-detail/index',
				'achievements': '/src/pages/profile/index'
			};
			
			if (routes[type]) {
				if (type === 'questions' || type === 'accuracy') {
					uni.switchTab({ url: routes[type] });
				} else {
					uni.navigateTo({ url: routes[type] });
				}
			}
		},

		handleKnowledgeClick(point) {
			console.log('[Index] Knowledge point clicked:', point.title);
			
			if (point.title === '错题集') {
				uni.switchTab({ url: '/src/pages/mistake/index' });
			} else if (point.title === '练习题') {
				uni.switchTab({ url: '/src/pages/practice/index' });
			} else {
				uni.showToast({ 
					title: `${point.title} - 掌握度${point.mastery}%`, 
					icon: 'none',
					duration: 2000
				});
			}
		},

		handleEditPlan() {
			uni.showToast({ 
				title: '编辑计划功能开发中', 
				icon: 'none',
				duration: 2000
			});
		},

		// 处理待办事项切换 - 调用Store方法
		handleToggleTodo(todoId) {
			console.log('[Index] Toggle todo ID:', todoId);
			
			try {
				const success = this.todoStore.toggleTask(todoId);
				if (success) {
					console.log(`[Index] Todo ${todoId} toggled successfully`);
					// 震动反馈
					try {
						if (typeof uni.vibrateShort === 'function') {
							uni.vibrateShort();
						}
					} catch (e) {}
				} else {
					console.error('[Index] Todo not found:', todoId);
				}
			} catch (error) {
				console.error('[Index] Toggle todo failed:', error);
			}
		},

		// 滚动监听
		handleScroll(e) {
			this.scrollY = e.detail.scrollTop;
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
				console.log('[Index] 使用缓存的每日金句');
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
			
			console.log('[Index] 生成新的每日金句:', this.dailyQuote);
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
			} catch (e) {}
			
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
				
				console.log('[Index] 刷新每日金句:', this.dailyQuote);
			}, 300);
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

/* ==================== CSS变量定义 ==================== */
.dashboard-container {
	/* Light Mode - Wise Style (绿色背景) */
	--background: #9FE870;
	--foreground: #1A1D1F;
	--card: #FFFFFF;
	--card-foreground: #1A1D1F;
	--primary: #FFFFFF;
	--primary-foreground: #1A1D1F;
	--muted: rgba(255, 255, 255, 0.3);
	--muted-foreground: #2D3748;
	--border: rgba(255, 255, 255, 0.3);
	--brand: #FFFFFF;
	--brand-glow: rgba(255, 255, 255, 0.3);
	--glass-bg: rgba(255, 255, 255, 0.2);
	--glass-border: rgba(255, 255, 255, 0.4);
	
	min-height: 100vh;
	background-color: var(--background);
	position: relative;
	font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.dashboard-container.dark {
	/* Dark Mode - Bitget Style */
	--background: #080808;
	--foreground: #FFFFFF;
	--card: #0D1117;
	--card-foreground: #FFFFFF;
	--primary: #00F2FF;
	--primary-foreground: #080808;
	--muted: #1A1C1E;
	--muted-foreground: #9CA3AF;
	--border: #2D2D2D;
	--brand: #00F2FF;
	--brand-glow: rgba(0, 242, 255, 0.3);
	--glass-bg: rgba(255, 255, 255, 0.05);
	--glass-border: rgba(255, 255, 255, 0.1);
}

/* ==================== 毛玻璃效果 ==================== */
.glass {
	background: var(--glass-bg);
	backdrop-filter: blur(24rpx);
	-webkit-backdrop-filter: blur(24rpx);
	border: 1rpx solid var(--glass-border);
}

/* ==================== 动画定义 ==================== */
@keyframes float {
	0%, 100% { transform: translateY(0rpx); }
	50% { transform: translateY(-16rpx); }
}

@keyframes pulse-glow {
	0%, 100% {
		box-shadow: 0 0 40rpx var(--brand-glow), 0 0 80rpx var(--brand-glow);
	}
	50% {
		box-shadow: 0 0 60rpx var(--brand-glow), 0 0 120rpx var(--brand-glow);
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

/* 滚动后才显示毛玻璃效果 */
.header-content-area.header-scrolled {
	background: rgba(255, 255, 255, 0.85);
	backdrop-filter: blur(20rpx);
	-webkit-backdrop-filter: blur(20rpx);
}

.dashboard-container.dark .header-content-area.header-scrolled {
	background: rgba(8, 8, 8, 0.85);
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
	color: var(--foreground);
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
	background: var(--primary);
	color: var(--primary-foreground);
}

.avatar-dark {
	background: linear-gradient(135deg, rgba(0, 242, 255, 0.8), var(--primary));
	color: var(--primary-foreground);
}

.avatar-text {
	font-size: 28rpx;
	font-weight: 500;
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

.app-logo-new:active {
	transform: scale(0.95);
}

/* Wise风格：绿色渐变 + 几何图形 */
.logo-wise {
	background: linear-gradient(135deg, #9FE870 0%, #7BC950 100%);
	box-shadow: 0 4rpx 12rpx rgba(159, 232, 112, 0.3);
}

/* Bitget风格：青色渐变 + 科技感 */
.logo-bitget {
	background: linear-gradient(135deg, #00F2FF 0%, #00B8D4 100%);
	box-shadow: 0 4rpx 12rpx rgba(0, 242, 255, 0.3);
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
	padding: 48rpx 32rpx;
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
	background: linear-gradient(135deg, rgba(159, 232, 112, 0.1) 0%, rgba(159, 232, 112, 0.05) 50%, transparent 100%);
}

.banner-dark {
	background: linear-gradient(135deg, #1A1C1E 0%, #0D0E10 100%);
	border-color: var(--glass-border);
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
	background: rgba(0, 242, 255, 0.1);
	filter: blur(120rpx);
}

.bubble-2 {
	bottom: -80rpx;
	left: -80rpx;
	width: 384rpx;
	height: 384rpx;
	background: rgba(159, 232, 112, 0.1);
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
	color: var(--foreground);
	line-height: 1.2;
}

.welcome-subtitle {
	font-size: 28rpx;
	color: var(--muted-foreground);
	line-height: 1.6;
}

.highlight-text {
	color: var(--primary);
	font-weight: 600;
}

.banner-actions {
	display: flex;
	gap: 24rpx;
	flex-wrap: wrap;
}

.action-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 16rpx;
	padding: 24rpx 48rpx;
	border-radius: 24rpx;
	font-size: 28rpx;
	font-weight: 600;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-primary {
	background: var(--primary);
	color: var(--primary-foreground);
}

.btn-outline {
	background: transparent;
	border: 2rpx solid var(--border);
	color: var(--foreground);
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
	gap: 24rpx;
	margin-bottom: 64rpx;
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
	box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.12);
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
	background: rgba(159, 232, 112, 0.1);
}

.icon-success {
	background: rgba(52, 211, 153, 0.1);
}

.icon-warning {
	background: rgba(245, 158, 11, 0.1);
}

.icon-neutral {
	background: rgba(156, 163, 175, 0.1);
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
	color: var(--muted-foreground);
	font-weight: 500;
}

.stat-value {
	font-size: 48rpx;
	font-weight: 700;
	color: var(--foreground);
	line-height: 1.2;
}

.stat-change {
	font-size: 24rpx;
	font-weight: 500;
}

.stat-change.positive {
	color: #10B981;
}

.stat-change.neutral {
	color: var(--muted-foreground);
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
	color: var(--foreground);
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

/* 浅色模式：白色背景 + 毛玻璃 */
.bubble-card-light {
	background: rgba(255, 255, 255, 0.9);
	backdrop-filter: blur(24rpx);
	-webkit-backdrop-filter: blur(24rpx);
	border: 1rpx solid var(--border);
}

.bubble-card-light:active {
	transform: scale(1.05);
}

/* 深色模式：深色背景 + 毛玻璃 + 光晕 */
.bubble-card-dark {
	background: linear-gradient(135deg, #1A1C1E 0%, #0D0E10 100%);
	backdrop-filter: blur(24rpx);
	-webkit-backdrop-filter: blur(24rpx);
	border: 1rpx solid var(--glass-border);
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
	background: var(--muted);
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
}

.bubble-count {
	font-size: 20rpx;
	color: var(--muted-foreground);
}

.bubble-progress-wrapper {
	width: 100%;
	padding: 0 16rpx;
	margin-top: 8rpx;
}

.bubble-progress-bar {
	width: 100%;
	height: 4rpx;
	background: var(--muted);
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
	background: rgba(16, 185, 129, 0.1);
	color: #10B981;
}

.status-in-progress {
	background: rgba(0, 242, 255, 0.1);
	color: #00F2FF;
}

.status-pending {
	background: rgba(156, 163, 175, 0.1);
	color: #9CA3AF;
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
	color: var(--foreground);
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.activity-subtitle {
	font-size: 24rpx;
	color: var(--muted-foreground);
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
	color: var(--muted-foreground);
}

.activity-badge {
	padding: 4rpx 16rpx;
	border-radius: 20rpx;
	font-size: 20rpx;
}

.badge-completed {
	background: rgba(16, 185, 129, 0.1);
	color: #10B981;
}

.badge-in-progress {
	background: rgba(0, 242, 255, 0.1);
	color: #00F2FF;
}

.badge-pending {
	background: rgba(156, 163, 175, 0.1);
	color: #9CA3AF;
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
}

.desc-light {
	background: rgba(243, 244, 246, 0.5);
}

.mode-text {
	font-size: 32rpx;
	color: var(--muted-foreground);
	line-height: 1.8;
}

.mode-highlight {
	color: var(--primary);
	font-weight: 700;
	font-size: 34rpx;
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
</style>
