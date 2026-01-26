<template>
	<view :class="['dashboard-container', { 'dark': isDark }]">
		<!-- 顶部导航栏 - 毛玻璃效果 + 滚动透明 -->
		<view :class="['dashboard-header', isDark ? 'glass' : 'header-light', scrollY > 50 && 'header-scrolled']">
			<view class="header-content">
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

		<!-- 主内容区域 -->
		<scroll-view scroll-y class="main-content" :style="{ height: scrollHeight + 'px' }" @scroll="handleScroll">
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
					<view 
						:class="['action-btn', 'btn-primary', isDark && 'animate-pulse-glow', isNavigating && 'btn-loading']" 
						@tap="navToPractice"
					>
						<text class="btn-icon" v-if="!isNavigating">⚡</text>
						<text class="btn-icon loading-spinner" v-else>⏳</text>
						<text class="btn-text">{{ isNavigating ? '加载中...' : '快速练习' }}</text>
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

			<!-- 每日金句 - 增强版（可点击刷新） -->
			<view 
				:class="['mode-description', 'quote-card', isDark ? 'glass' : 'desc-light', isRefreshingQuote && 'quote-refreshing']" 
				style="margin-top: 64rpx;"
				@tap="refreshDailyQuote"
			>
				<view class="quote-header">
					<text class="mode-highlight">💡 每日金句</text>
					<text class="refresh-hint" v-if="!isRefreshingQuote">点击刷新</text>
					<text class="refresh-hint refreshing" v-else>刷新中...</text>
				</view>
				<text class="mode-text quote-content">
					{{ dailyQuote }}
				</text>
				<text class="quote-date">{{ quoteDate }}</text>
			</view>

			<!-- 底部间距 -->
			<view class="bottom-spacer"></view>
		</scroll-view>

		<!-- 底部导航栏 -->
		<custom-tabbar :activeIndex="0" :isDark="isDark"></custom-tabbar>

		<!-- 骨架屏 -->
		<base-skeleton v-if="isLoading" :is-dark="isDark"></base-skeleton>
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
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '../../utils/logger.js';

export default {
	components: {
		CustomTabbar,
		BaseSkeleton,
		TodoList
	},

	data() {
		return {
			isLoading: true,
			scrollHeight: 800,
			scrollY: 0,
			isDark: false,
			
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
			dailyQuote: '成功不是终点，失败也不是终结，唯有勇气才是永恒。',
			
			// 励志金句库（50条精选）
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
				'明日复明日，明日何其多。我生待明日，万事成蹉跎。',
				'一寸光阴一寸金，寸金难买寸光阴。',
				'少年易老学难成，一寸光阴不可轻。',
				'盛年不重来，一日难再晨。及时当勉励，岁月不待人。',
				'莫等闲，白了少年头，空悲切。',
				'花有重开日，人无再少年。',
				'黑发不知勤学早，白首方悔读书迟。',
				'纸上得来终觉浅，绝知此事要躬行。',
				'问渠那得清如许，为有源头活水来。',
				'读万卷书，行万里路。',
				'书犹药也，善读之可以医愚。',
				'立身以立学为先，立学以读书为本。',
				'鸟欲高飞先振翅，人求上进先读书。',
				'非学无以广才，非志无以成学。',
				'勤能补拙是良训，一分辛苦一分才。',
				'聪明出于勤奋，天才在于积累。',
				'好学而不勤问非真好学者。',
				'书籍是人类进步的阶梯。',
				'读一本好书，就是和许多高尚的人谈话。',
				'理想的书籍是智慧的钥匙。',
				'书是人类进步的阶梯，终生的伴侣，最诚挚的朋友。',
				'书籍是全世界的营养品，生活里没有书籍就好像没有阳光。',
				'一个爱书的人，他必定不致缺少一个忠实的朋友、一个良好的导师、一个可爱的伴侣、一个优婉的安慰者。'
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
			]
		};
	},

	onLoad() {
		try {
			const windowInfo = uni.getWindowInfo();
			this.scrollHeight = (windowInfo.windowHeight || 800) - 120;
		} catch (e) {
			const sys = uni.getSystemInfoSync();
			this.scrollHeight = (sys.windowHeight || 800) - 120;
		}

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
				
				logger.log('[Index] 刷新每日金句:', this.dailyQuote);
			}, 500);
		},
		
		// ==================== 工具方法 ====================
		
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
			if (!name) return
