<template>
	<view :class="['container', { 'dark-mode': isDark }]">
		<view class="aurora-bg"></view>

		<!-- 骨架屏 -->
		<base-skeleton v-if="isLoading" :is-dark="isDark"></base-skeleton>

		<!-- 实际内容 -->
		<view v-else class="content-container">
			<!-- 顶部时间和设置区 -->
			<view class="top-bar">
				<!-- 移除时间显示，避免与原生时间重叠 -->
			</view>

			<!-- 用户信息卡片 -->
			<view class="user-greeting-card">
				<view class="avatar-box" @tap="handleUserClick">
					<image :src="isLoggedIn ? (userInfo.avatarUrl || defaultAvatar) : defaultAvatar" class="user-avatar"
						mode="aspectFill" @error="onAvatarError"></image>
				</view>
				<view class="greeting-text">
					<text class="user-name">{{ isLoggedIn ? userInfo.nickName : '考研人' }}</text>
				</view>
			</view>

			<!-- Exam-Master 横幅 -->
			<view class="app-logo-section">
				<view class="graphic-logo-container">
					<image class="graphic-logo-icon"
						src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMjQwIDI1NmgtNDhjLTI2LjUgMC00OCAyMS41LTQ4IDQ4djUxMmMwIDI2LjUgMjEuNSA0OCA0OCA0OGg0OGMyNi41IDAgNDgtMjEuNSA0OC00OFYzMDRjMC0yNi41LTIxLjUtNDgtNDgtNDh6IG0yNTYgMGgtNDhjLTI2LjUgMC00OCAyMS41LTQ4IDQ4djUxMmMwIDI2LjUgMjEuNSA0OCA0OCA0OGg0OGMyNi41IDAgNDgtMjEuNSA0OC00OFYzMDRjMC0yNi41LTIxLjUtNDgtNDgtNDh6IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iNjAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjxwYXRoIGQ9Ik0xOTIgODE2aDMwNE01NDQgODE2aDMwNE0xOTIgMzA0aDMwNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjYwIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz48cGF0aCBkPSJNNzIwIDU1MFYyNTBNNjIwIDM1MGwxMDAtMTAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2ZmZmZmZiIgc3Ryb2tlLXdpZHRoPSI3MCIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+PHBhdGggZD0iTTg0OCA4MTZWNTAwIiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iNjAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg=="
						mode="aspectFit"></image>
					<text class="logo-icon">📢</text>
					<text class="graphic-logo-text">Exam-Master</text>
				</view>
			</view>

			<!-- Fix #4: Calculate scroll height properly accounting for header and bottom nav -->
			<scroll-view scroll-y="true" class="main-scroll" :style="{ height: calculatedScrollHeight + 'px' }">
				<view class="scroll-content-padding" :style="{ paddingTop: '0px' }">

					<!-- 每日金句卡片 -->
					<view class="glass-card quote-card card-hover-effect" v-if="dailyQuote" @tap="fetchDailyQuote">
						<view class="quote-header">
							<view class="quote-tag">每日金句</view>
							<text class="quote-date">{{ todayDate }}</text>
						</view>
						<text class="quote-text">{{ dailyQuote }}</text>
					</view>

					<!-- 数据可视化统计卡片组 -->
					<view class="stats-container">
						<view class="section-header">
							<text class="st">学习概览</text>
							<text class="total">数据可视化</text>
						</view>
						<scroll-view scroll-x="true" class="stats-scroll" :show-scrollbar="false">
							<view class="stats-grid">
								<!-- 刷题正确率卡片 -->
								<view class="glass-card stats-card card-3d" :style="cardStyle">
									<text class="stats-title">刷题正确率</text>
									<view class="circle-progress">
										<svg width="80" height="80" viewBox="0 0 100 100">
											<circle cx="50" cy="50" r="40" stroke="#e9ecef" stroke-width="10"
												fill="none" />
											<circle cx="50" cy="50" r="40" stroke="#2ECC71" stroke-width="10"
												fill="none" stroke-dasharray="251.2"
												:stroke-dashoffset="251.2 * (1 - accuracy / 100)" stroke-linecap="round"
												transform="rotate(-90 50 50)" />
										</svg>
										<text class="progress-text">{{ accuracy }}%</text>
									</view>
									<text class="stats-sub">超越 {{ beatPercentage }}% 用户</text>
								</view>

								<!-- 本周学习时长卡片 -->
								<view class="glass-card stats-card card-3d" :style="cardStyle">
									<text class="stats-title">本周学习时长</text>
									<view class="time-stat">
										<text class="time-val">{{ totalWeekTime }}</text>
										<text class="time-unit">分钟</text>
									</view>
									<view class="mini-bar-chart">
										<view v-for="(day, index) in weekStudyTime" :key="index" class="mini-bar"
											:style="{ height: (day.value / 60 * 100) + '%', opacity: day.value > 0 ? 1 : 0.3 }">
										</view>
									</view>
								</view>

								<!-- 能力评级卡片 -->
								<view class="glass-card stats-card card-3d" :style="cardStyle">
									<text class="stats-title">综合能力</text>
									<view class="ability-badge">
										<text class="rank-text">{{ abilityRank }}</text>
										<view class="radar-icon">
											<view class="radar-line" style="transform: rotate(0deg)"></view>
											<view class="radar-line" style="transform: rotate(60deg)"></view>
											<view class="radar-line" style="transform: rotate(120deg)"></view>
										</view>
									</view>
									<text class="stats-sub">{{ abilityTitle }}</text>
								</view>
							</view>
						</scroll-view>
					</view>

					<!-- 功能区域 -->
					<view class="feature-container">
						<view class="glass-card invite-banner card-hover-effect" @tap="handleShare">
							<view class="banner-left">
								<text class="b-title">邀请好友，共赴研途</text>
								<text class="b-desc">解锁 Pro 题库与解析权限</text>
							</view>
							<view class="b-arrow">➔</view>
						</view>

						<view class="feature-grid">
							<view class="glass-card countdown-box card-hover-effect">
								<text class="label">距 2026 考研仅剩</text>
								<view class="days">{{ countdownDays }}<text class="unit">天</text></view>
								<view class="date-tag">2026.12.19</view>
							</view>
							<view class="glass-card practice-entry card-hover-effect" @tap="navToPractice">
								<view class="practice-content">
									<text class="title">智能刷题</text>
									<text class="desc">AI 深度解析</text>
								</view>
								<view class="play-circle">▶</view>
							</view>
						</view>

						<!-- 更多功能入口 -->
						<view class="more-features">
							<view class="glass-card feature-item card-hover-effect" @tap="navToPlan">
								<view class="feature-icon">📅</view>
								<view class="feature-content">
									<text class="feature-title">学习计划</text>
									<text class="feature-desc">制定每日学习目标</text>
								</view>
								<view class="feature-arrow">➔</view>
							</view>
							<view class="glass-card feature-item card-hover-effect" @tap="navToAI">
								<view class="feature-icon">🤖</view>
								<view class="feature-content">
									<text class="feature-title">AI 助教</text>
									<text class="feature-desc">智能答疑辅导</text>
								</view>
								<view class="feature-arrow">➔</view>
							</view>
							<view class="glass-card feature-item card-hover-effect" @tap="navToMistake">
								<view class="feature-icon">❌</view>
								<view class="feature-content">
									<text class="feature-title">错题本</text>
									<text class="feature-desc">巩固薄弱知识点</text>
								</view>
								<view class="feature-arrow">➔</view>
							</view>
							<view class="glass-card feature-item card-hover-effect" @tap="navToUniverse">
								<view class="feature-icon">🌌</view>
								<view class="feature-content">
									<text class="feature-title">探索宇宙</text>
									<text class="feature-desc">知识星空漫游</text>
								</view>
								<view class="feature-arrow">➔</view>
							</view>
						</view>
					</view>

					<!-- 学习热力图 -->
					<view class="section-header">
						<text class="st">学习热力图</text>
						<text class="total">累计学习 {{ totalStudyDays }} 天</text>
					</view>
					<view class="glass-card heatmap-box card-hover-effect">
						<scroll-view scroll-x class="heatmap-scroll" :show-scrollbar="false">
							<view class="heatmap-grid">
								<view v-for="(col, cIdx) in heatmapData" :key="cIdx" class="hm-col">
									<view v-for="(dayData, rIdx) in col" :key="rIdx" class="hm-cell"
										:class="'level-' + dayData.level" @tap="showHeatmapDetail(dayData)">
									</view>
								</view>
							</view>
						</scroll-view>
					</view>

					<!-- 热力图详情弹窗 -->
					<view class="heatmap-popup" v-if="showHeatmapPopup">
						<view class="popup-content" @tap.stop>
							<view class="popup-header">
								<text class="popup-title">学习详情</text>
								<view class="close-btn" @tap="closeHeatmapPopup">✕</view>
							</view>
							<view class="popup-body">
								<view class="detail-item">
									<text class="detail-label">日期：</text>
									<text class="detail-value">{{ currentHeatmapDay.date }}</text>
								</view>
								<view class="detail-item">
									<text class="detail-label">学习时长：</text>
									<text class="detail-value">{{ currentHeatmapDay.studyTime }} 分钟</text>
								</view>
								<view class="detail-item">
									<text class="detail-label">学习强度：</text>
									<text class="detail-value level-text" :class="'level-' + currentHeatmapDay.level">
										{{ getLevelText(currentHeatmapDay.level) }}
									</text>
								</view>
							</view>
						</view>
						<view class="popup-overlay" @tap="closeHeatmapPopup"></view>
					</view>

					<!-- 今日计划 -->
					<view class="section-header">
						<text class="st">今日计划</text>
						<text class="total">{{ todoPercent }}% 完成</text>
					</view>
					<view class="glass-card task-card card-hover-effect">
						<view class="todo-list">
							<view class="todo-item" v-for="(item, index) in tasks" :key="index"
								@click="toggleTask(index)" :class="{ 'item-done': item.done }">
								<view class="checkbox">
									<view class="check-inner" v-if="item.done"></view>
								</view>
								<text class="todo-txt">{{ item.title }}</text>
								<view class="tag" :class="item.tagColor">{{ item.tag }}</view>
							</view>
						</view>
					</view>

					<!-- Bottom spacer to prevent navigation overlap -->
					<view class="bottom-spacer"></view>
				</view>
			</scroll-view>
		</view>

		<!-- 底部导航栏组件 -->
		<custom-tabbar :activeIndex="0" :isDark="isDark"></custom-tabbar>

		<!-- 登录弹窗 -->
		<view class="login-mask" v-if="showLoginModal" @click="showLoginModal = false">
			<view class="login-sheet" @click.stop>
				<text class="sheet-title">登录 Exam Master</text>
				<button class="avatar-chooser" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
					<image :src="tempAvatar || svgIcons.userPlaceholder" class="avatar-preview" />
				</button>
				<input type="nickname" class="nick-input" placeholder="请输入您的昵称" v-model="tempNick" @blur="onNickBlur" />
				<button class="primary-btn" @click="confirmLogin">确认开启</button>
			</view>
		</view>
	</view>
</template>

<script>
import CustomTabbar from '../../components/custom-tabbar/custom-tabbar.vue';
import BaseSkeleton from '../../components/base-skeleton/base-skeleton.vue';
import { getGreetingTime } from '../../utils/core/date';
import { useTodoStore } from '../../stores';
import { getPixelRatio } from '../../utils/core/system';
import { getApiKey } from '../../../common/config.js';
import { lafService } from '../../services/lafService.js';

export default {
	components: {
		CustomTabbar,
		BaseSkeleton
	},

	created() {
		// 初始化 todo store
		this.todoStore = useTodoStore();

		// 初始化任务列表
		this.todoStore.initTasks();
	},
	data() {
		return {
			// 加载状态
			isLoading: true,

			statusBarHeight: 44,
			scrollHeight: 800,
			isDark: false,
			isLoggedIn: false,
			userInfo: { nickName: 'Guest', avatarUrl: '' },
			defaultAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest',
			showLoginModal: false,
			tempAvatar: '', tempNick: '',
			isChoosingAvatar: false, // 头像选择防抖锁

			dailyQuote: 'Loading motivation...',
			isRefreshing: false,
			todayDate: '',

			heatmapData: [],
			totalStudyDays: 0,

			// 任务管理相关
			showAddTaskModal: false,
			newTaskTitle: '',
			newTaskPriority: 'medium',

			// 核心统计数据
			totalQuestions: 0,      // 题库总数
			finishedCount: 0,       // 已做题目数
			accuracy: 0,            // 正确率（百分比）
			todayTime: 0,           // 今日学习时长（分钟）

			// 动态统计
			beatPercentage: 0,
			abilityRank: 'B',
			abilityTitle: '潜力新星',

			// 陀螺仪光影效果
			cardStyle: {},

			// 热力图弹窗相关
			showHeatmapPopup: false,
			currentHeatmapDay: {},

			// 顶部统计卡片数据
			stats: {
				totalQuestions: 0,
				finishedCount: 0,
				accuracy: 0,
				todayTime: 0
			},

			// 本周学习时长数据
			weekStudyTime: [],
			// 真实学习数据缓存
			realStudyData: {},
			// 能力雷达图数据
			abilityData: [
				{ name: '英语', value: 85 },
				{ name: '政治', value: 75 },
				{ name: '数学', value: 90 },
				{ name: '专业课', value: 80 },
				{ name: '逻辑', value: 70 }
			],

			svgIcons: {
				userPlaceholder: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23E0E0E0'%3E%3Ccircle cx='12' cy='8' r='4'/%3E%3Cpath d='M20 21a8 8 0 1 0-16 0'/%3E%3C/svg%3E",
				homeFilled: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%232ECC71'%3E%3Cpath d='M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z'/%3E%3C/svg%3E",
				practice: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='9 11 12 14 22 4'/%3E%3Cpath d='M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'/%3E%3C/svg%3E",
				school: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpath d='M22 10v6M2 10l10-5 10 5-10 5z'/%3E%3Cpath d='M6 12v5c3 3 9 3 12 0v-5'/%3E%3C/svg%3E",
				settings: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3Cpath d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.09 1.41 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'/%3E%3C/svg%3E"
			}
		};
	},
	onLoad(options) {
		// 处理邀请码
		if (options && options.inviteCode) {
			this.handleInviteCode(options.inviteCode);
		}

		// 开启陀螺仪监听
		this.startGyroscope();

		// 使用工具函数获取系统信息，避免废弃警告
		// #ifdef MP-WECHAT
		try {
			const windowInfo = uni.getWindowInfo();
			this.statusBarHeight = windowInfo.statusBarHeight || 44;
			this.scrollHeight = windowInfo.windowHeight || 800;
		} catch (e) {
			// 降级方案
			const sys = uni.getSystemInfoSync();
			this.statusBarHeight = sys.statusBarHeight || sys.safeAreaInsets?.top || 44;
			this.scrollHeight = sys.windowHeight || sys.screenHeight || 800;
		}
		// #endif
		// #ifndef MP-WECHAT
		const sys = uni.getSystemInfoSync();
		this.statusBarHeight = sys.statusBarHeight || sys.safeAreaInsets?.top || 44;
		this.scrollHeight = sys.windowHeight || sys.screenHeight || 800;
		// #endif

		// 初始化深色模式
		const savedTheme = uni.getStorageSync('theme_mode') || 'light';
		this.isDark = savedTheme === 'dark';

		// 监听全局主题更新事件
		uni.$on('themeUpdate', (mode) => {
			this.isDark = mode === 'dark';
		});

		const now = new Date();
		this.todayDate = `${now.getMonth() + 1}月${now.getDate()}日`;

		// 初始化数据
		this.loadData();
		this.fetchDailyQuote();
	},

	/**
	 * 处理邀请码
	 */
	async handleInviteCode(inviteCode) {
		// 获取当前用户ID
		const newUserId = uni.getStorageSync('EXAM_USER_ID') || this.userInfo.id || uni.getStorageSync('user_id') || 'guest';

		// 调用 Laf 接口验证邀请码并发放奖励
		try {
			const res = await lafService.request('/invite-manager', {
				action: 'verify',
				inviteCode: inviteCode,
				newUserId: newUserId,
				userId: newUserId
			});

			if (res && res.code === 0) {
				// 邀请成功，显示奖励提示
				uni.showToast({
					title: '邀请成功，获得50积分奖励！',
					icon: 'success',
					duration: 2000
				});
			}
		} catch (err) {
			console.error('验证邀请码失败:', err);
		}
	},
	onShow() {
		// 【核心修复】隐藏系统原生 TabBar，只显示自定义 TabBar
		uni.hideTabBar({
			animation: false // 无动画直接隐藏，避免闪烁
		});

		// 每次显示时刷新数据，确保显示最新状态
		this.checkLogin();
		this.refreshData();
	},
	onUnload() {
		// 清理事件监听
		uni.$off('themeUpdate');
	},
	computed: {
		greetingTime() {
			// 使用新的时间工具函数，返回带星期的时间格式
			const timeInfo = getGreetingTime();
			return timeInfo.timeDisplay;
		},
		greetingText() {
			// 保留原greetingText以兼容其他地方的调用，返回问候语
			const timeInfo = getGreetingTime();
			return timeInfo.greetingText;
		},
		countdownDays() {
			// Fix date parsing for cross-platform compatibility
			const target = new Date('2026/12/19').getTime();
			const now = new Date().getTime();
			const diff = target - now;
			return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
		},
		// 使用 todo store 的计算属性
		tasks() {
			return this.todoStore.sortedTasks;
		},
		todoPercent() {
			return this.todoStore.completionRate;
		},
		// Fix #4: Calculate scroll height properly accounting for header and bottom nav
		calculatedScrollHeight() {
			// Header height: statusBar + navBar (~60px) + userCard (~70px) + logoSection (~50px) = ~180px
			// Bottom nav height: ~110rpx (~55px) + safe area
			const headerHeight = 180;
			const bottomNavHeight = 55;
			const safeAreaBottom = 0; // Will be handled by CSS env()

			return Math.max(400, this.scrollHeight - headerHeight - bottomNavHeight);
		},

		// 计算本周总学习时长
		totalWeekTime() {
			return this.weekStudyTime.reduce((sum, day) => sum + day.value, 0);
		},
	},
	methods: {
		/**
		 * 开启陀螺仪监听
		 */
		startGyroscope() {
			// 开启加速度计监听
			uni.startAccelerometer({
				interval: 'game', // 适用于游戏或交互动画
				success: () => {
					this.accelerometerHandler = true;
					uni.onAccelerometerChange((res) => {
						// 限制旋转角度
						let x = res.x * 20; // 左右倾斜 -> rotateY
						let y = res.y * 20; // 前后倾斜 -> rotateX

						// 限制最大角度
						if (x > 15) x = 15;
						if (x < -15) x = -15;
						if (y > 15) y = 15;
						if (y < -15) y = -15;

						// 更新样式
						this.cardStyle = {
							transform: `perspective(1000px) rotateX(${-y}deg) rotateY(${x}deg)`,
							boxShadow: `${-x}px ${y + 10}px 20px rgba(0,0,0,0.2)`
						};
					});
				},
				fail: (err) => {
					console.log('陀螺仪开启失败', err);
				}
			});
		},

		/**
		 * 刷新所有数据（核心方法）
		 * 在 onShow 中调用，确保每次回到首页都显示最新数据
		 */
		refreshData() {
			this.isRefreshing = true;

			// 计算核心统计数据
			this.calculateStats();

			// 更新热力图
			this.loadHeatmap();

			// 刷新任务列表
			this.todoStore.initTasks();

			// 更新图表 (已移除 uCharts，改用 CSS/SVG 实现)
			// this.initCharts();

			// 如果题库为空，显示"待导入"状态
			if (this.totalQuestions === 0) {
				console.log('题库为空，显示待导入状态');
			}

			setTimeout(() => {
				this.isRefreshing = false;
				// 只在手动点击刷新时显示提示
				// uni.showToast({ title: '刷新完成', icon: 'success' });
			}, 300);
		},

		/**
		 * 计算核心统计数据
		 * 从本地缓存读取 v30_bank 和 v30_user_answers
		 */
		calculateStats() {
			// 1. 获取数据源
			const questionBank = uni.getStorageSync('v30_bank') || [];
			const userAnswers = uni.getStorageSync('v30_user_answers') || {};
			const studyStats = uni.getStorageSync('study_stats') || {};
			const v30StudyTime = uni.getStorageSync('v30_study_time') || {};

			// 2. 计算 totalQuestions（题库总数）
			this.totalQuestions = Array.isArray(questionBank) ? questionBank.length : 0;

			// 3. 计算 finishedCount（已做题目数）
			// userAnswers 结构为 { "questionId": "A" }
			this.finishedCount = Object.keys(userAnswers).length;

			// 4. 计算 accuracy（正确率）
			if (this.finishedCount === 0 || this.totalQuestions === 0) {
				this.accuracy = 0;
			} else {
				let correctCount = 0;

				// 遍历已做题目，对比正确答案
				Object.keys(userAnswers).forEach(questionId => {
					// 查找题目
					const question = questionBank.find(q => {
						// 支持多种 ID 格式
						const qId = q.id || q._id || '';
						return qId.toString() === questionId.toString();
					});

					if (question) {
						const userAnswer = userAnswers[questionId];
						const correctAnswer = question.answer || '';

						// 比较答案（不区分大小写）
						if (userAnswer.toString().toUpperCase() === correctAnswer.toString().toUpperCase()) {
							correctCount++;
						}
					}
				});

				// 计算正确率百分比
				this.accuracy = this.finishedCount > 0
					? Math.round((correctCount / this.finishedCount) * 100)
					: 0;
			}

			// 5. 计算 todayTime（今日学习时长，单位：分钟）
			const todayDateKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
			this.todayTime = studyStats[todayDateKey] || 0;
			// 兼容旧格式的学习时长数据
			if (!this.todayTime && v30StudyTime) {
				this.todayTime = v30StudyTime[todayDateKey] || 0;
			}

			// 6. 计算 beatPercentage（击败用户数）
			// 逻辑优化：只有当有正确率时才计算击败率，避免 0% 击败 80% 的情况
			if (this.finishedCount > 0) {
				// 简单的模拟算法：正确率 * 0.8 + 基础分
				// 真实场景应该从后端获取
				this.beatPercentage = Math.floor(this.accuracy * 0.8 + (this.finishedCount > 10 ? 15 : 5));
				if (this.beatPercentage > 99) this.beatPercentage = 99;
			} else {
				this.beatPercentage = 0;
			}

			// 7. 计算能力值 (Ability Analysis)
			if (this.finishedCount > 0) {
				const accuracy = this.accuracy;
				const count = this.finishedCount;

				const abilityScores = {
					memory: Math.min(100, Math.floor(accuracy * 0.6 + count * 0.5) || 40),
					logic: Math.min(100, Math.floor(accuracy * 0.7 + 20) || 40),
					calc: Math.min(100, Math.floor(accuracy * 0.5 + 40) || 40),
					focus: Math.min(100, Math.floor(count * 2 + 30) || 40),
					create: Math.min(100, Math.floor(accuracy * 0.4 + 50) || 40)
				};

				const totalScore = Object.values(abilityScores).reduce((a, b) => a + b, 0) / 5;

				if (totalScore >= 90) this.abilityRank = 'S';
				else if (totalScore >= 80) this.abilityRank = 'A';
				else if (totalScore >= 70) this.abilityRank = 'B';
				else if (totalScore >= 60) this.abilityRank = 'C';
				else this.abilityRank = 'D';

				// 更新雷达图数据
				this.radarChartData = {
					categories: ['记忆', '逻辑', '计算', '专注', '创造'],
					series: [{
						name: '能力值',
						data: [
							abilityScores.memory,
							abilityScores.logic,
							abilityScores.calc,
							abilityScores.focus,
							abilityScores.create
						]
					}]
				};
			} else {
				// 无数据状态
				this.abilityRank = '-';
				this.abilityTitle = '待评估';
				this.radarChartData = {
					categories: ['记忆', '逻辑', '计算', '专注', '创造'],
					series: [{
						name: '能力值',
						data: [0, 0, 0, 0, 0]
					}]
				};
			}
			if (this.todayTime === 0) {
				const today = new Date().toDateString(); // 获取今天的日期字符串
				this.todayTime = v30StudyTime[today] || 0;
			}

			// 6. 生成本周学习时长数据
			this.generateWeeklyStudyData(studyStats, v30StudyTime);

			// 7. 更新 stats 对象（用于顶部卡片展示）
			this.stats = {
				totalQuestions: this.totalQuestions,
				finishedCount: this.finishedCount,
				accuracy: this.accuracy,
				todayTime: this.todayTime
			};

			// 8. 更新 chartData（用于雷达图展示）
			// 将数据标准化到 0-100 的范围
			const maxQuestions = 100; // 假设最大题目数为 100
			const maxTime = 120; // 假设最大学习时长为 120 分钟

			this.chartData = {
				labels: ['题目数', '完成度', '正确率', '学习时长', '连续天数'],
				datasets: [{
					data: [
						Math.min((this.totalQuestions / maxQuestions) * 100, 100), // 题目数（标准化）
						this.totalQuestions > 0 ? (this.finishedCount / this.totalQuestions) * 100 : 0, // 完成度
						this.accuracy, // 正确率
						Math.min((this.todayTime / maxTime) * 100, 100), // 学习时长（标准化）
						Math.min((this.totalStudyDays / 30) * 100, 100) // 连续天数（标准化，假设最大30天）
					],
					backgroundColor: 'rgba(46, 204, 113, 0.2)',
					borderColor: '#2ECC71',
					borderWidth: 2
				}]
			};

			// 9. 计算超越用户比例和能力评级
			// 简单的算法：综合正确率和学习时长
			// 修复：0%正确率不应超越80%用户
			if (this.accuracy === 0) {
				// 如果正确率为0，超越比例由做题数量决定，但上限很低
				this.beatPercentage = Math.min(5, Math.floor(this.finishedCount * 0.1));
				this.abilityRank = 'C';
				this.abilityTitle = this.finishedCount > 0 ? '还需努力' : '考研萌新';
			} else {
				// 基础分：正确率 * 0.7 + (完成题目数/50 * 40)
				let score = this.accuracy * 0.7 + Math.min(this.finishedCount, 50) * 0.6;
				this.beatPercentage = Math.min(99, Math.floor(score));

				if (score >= 85) {
					this.abilityRank = 'S';
					this.abilityTitle = '学神附体';
				} else if (score >= 70) {
					this.abilityRank = 'A';
					this.abilityTitle = '六边形战士';
				} else if (score >= 50) {
					this.abilityRank = 'B';
					this.abilityTitle = '潜力新星';
				} else {
					this.abilityRank = 'C';
					this.abilityTitle = '还需努力';
				}
			}

			console.log('统计数据已更新:', {
				totalQuestions: this.totalQuestions,
				finishedCount: this.finishedCount,
				accuracy: this.accuracy + '%',
				todayTime: this.todayTime + '分钟',
				weekStudyTime: this.weekStudyTime
			});
		},

		/**
		 * 生成本周学习时长数据
		 */
		generateWeeklyStudyData(studyStats, v30StudyTime) {
			const now = new Date();
			const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
			const weekData = [];

			// 生成过去7天的数据
			for (let i = 6; i >= 0; i--) {
				const date = new Date(now);
				date.setDate(now.getDate() - i);

				const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
				const dateString = date.toDateString();

				// 从两种数据源获取学习时长，使用真实数据，不使用随机值
				const studyTime = studyStats[dateKey] || v30StudyTime[dateString] || 0;

				weekData.push({
					name: weekDays[date.getDay()],
					value: studyTime
				});
			}

			this.weekStudyTime = weekData;
		},

		loadData() {
			this.checkLogin();
			this.calculateStats();
			this.loadHeatmap();

			// 数据加载完成，隐藏骨架屏
			setTimeout(() => {
				this.isLoading = false;
			}, 500);
		},

		async fetchDailyQuote() {
			this.isRefreshing = true;
			const prompt = "请生成一句简短的、充满力量的考研励志语录，或者一句通用的英语作文金句，或者一条政治哲学原理。不要局限于某个专业。不超过25个字。";

			try {
				// ✅ 使用后端代理调用（安全）
				const response = await lafService.proxyAI('chat', {
					content: prompt
				});

				let quoteText = "星光不问赶路人，时光不负有心人。";

				if (response.code === 0 && response.data) {
					// 后端返回格式：{ code: 0, data: "AI回复内容" }
					quoteText = response.data.replace(/['"""]/g, '').trim();
				} else {
					console.warn('[index] AI响应异常:', response.message);
				}

				console.log('[index] AI回复内容:', quoteText);

				// 1. Vue 层赋值
				this.dailyQuote = quoteText;
				this.isRefreshing = false;

				// 2. 【核心修复】强制调用微信原生 setData
				// #ifdef MP-WEIXIN
				try {
					if (this.$scope && typeof this.$scope.setData === 'function') {
						this.$scope.setData({
							dailyQuote: quoteText,
							isRefreshing: false
						});
						console.log('[index] 已通过 $scope.setData 更新');
					} else {
						const pages = getCurrentPages();
						const currentPage = pages[pages.length - 1];
						if (currentPage && typeof currentPage.setData === 'function') {
							currentPage.setData({
								dailyQuote: quoteText,
								isRefreshing: false
							});
							console.log('[index] 已通过 getCurrentPages().setData 更新');
						}
					}
				} catch (e) {
					console.error('[index] setData 调用失败:', e);
					this.$nextTick(() => {
						this.$forceUpdate();
					});
				}
				// #endif

				// #ifndef MP-WEIXIN
				this.$nextTick(() => {
					this.$forceUpdate();
				});
				// #endif

				console.log('[index] 每日金句已更新:', quoteText);

			} catch (error) {
				console.error('[index] AI请求失败:', error);

				const defaultQuote = "星光不问赶路人，时光不负有心人。";
				this.dailyQuote = defaultQuote;
				this.isRefreshing = false;

				// 失败时也要调用原生 setData
				// #ifdef MP-WEIXIN
				try {
					if (this.$scope && typeof this.$scope.setData === 'function') {
						this.$scope.setData({
							dailyQuote: defaultQuote,
							isRefreshing: false
						});
					} else {
						const pages = getCurrentPages();
						const currentPage = pages[pages.length - 1];
						if (currentPage && typeof currentPage.setData === 'function') {
							currentPage.setData({
								dailyQuote: defaultQuote,
								isRefreshing: false
							});
						}
					}
				} catch (e) {
					console.error('[index] setData 调用失败:', e);
					this.$nextTick(() => {
						this.$forceUpdate();
					});
				}
				// #endif

				// #ifndef MP-WEIXIN
				this.$nextTick(() => {
					this.$forceUpdate();
				});
				// #endif
			} finally {
				setTimeout(() => {
					this.isRefreshing = false;
					this.$forceUpdate();
				}, 500);
			}
		},

		loadHeatmap() {
			// 使用真实用户数据生成热力图，包含日期、学习时长和强度等级
			const today = new Date();
			const grid = [];
			const studyStats = uni.getStorageSync('study_stats') || {};
			const v30StudyTime = uni.getStorageSync('v30_study_time') || {};
			let realStudyDays = 0;

			// 生成 14 个列（周），每列 5 个单元格（天）
			for (let col = 0; col < 14; col++) {
				const colData = [];
				for (let row = 0; row < 5; row++) {
					// 计算日期
					const daysAgo = col * 5 + (4 - row);
					const cellDate = new Date(today);
					cellDate.setDate(today.getDate() - daysAgo);

					// 格式化日期
					const formattedDate = `${cellDate.getMonth() + 1}月${cellDate.getDate()}日`;

					// 生成标准日期格式作为key（YYYY-MM-DD）
					const dateKey = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;
					const dateString = cellDate.toDateString();

					// 使用真实数据，优先使用最新格式的数据
					const studyTime = studyStats[dateKey] || v30StudyTime[dateString] || 0;
					if (studyTime > 0) {
						realStudyDays++;
					}

					// 计算强度等级
					let level = 0;
					if (studyTime > 180) level = 3;
					else if (studyTime > 120) level = 2;
					else if (studyTime > 60) level = 1;

					colData.push({
						date: formattedDate,
						studyTime: studyTime,
						level: level
					});
				}
				grid.push(colData);
			}

			this.heatmapData = grid;
			this.totalStudyDays = realStudyDays;
		},

		/**
		 * 显示热力图详情弹窗
		 */
		showHeatmapDetail(dayData) {
			this.currentHeatmapDay = dayData;
			this.showHeatmapPopup = true;
		},

		/**
		 * 关闭热力图详情弹窗
		 */
		closeHeatmapPopup() {
			this.showHeatmapPopup = false;
		},

		/**
		 * 获取强度等级文本
		 */
		getLevelText(level) {
			const levelMap = {
				0: '未学习',
				1: '轻度',
				2: '中度',
				3: '重度'
			};
			return levelMap[level] || '未学习';
		},

		/**
		 * 切换任务完成状态
		 * @param {number} index - 任务索引
		 */
		toggleTask(index) {
			const task = this.tasks[index];
			if (task) {
				this.todoStore.toggleTask(task.id);
				try {
					if (typeof uni.vibrateShort === 'function') {
						uni.vibrateShort();
					}
				} catch (e) { }
			}
		},

		/**
		 * 添加新任务
		 */
		addTask() {
			if (!this.newTaskTitle || this.newTaskTitle.trim() === '') {
				uni.showToast({ title: '任务标题不能为空', icon: 'none' });
				return;
			}

			// 添加任务
			this.todoStore.addTask(
				this.newTaskTitle,
				this.newTaskPriority
			);

			// 重置表单
			this.newTaskTitle = '';
			this.newTaskPriority = 'medium';
			this.showAddTaskModal = false;

			// 显示成功提示
			uni.showToast({ title: '任务添加成功', icon: 'success' });
		},

		/**
		 * 删除任务
		 * @param {number} index - 任务索引
		 */
		deleteTask(index) {
			const task = this.tasks[index];
			if (task) {
				// 显示确认对话框
				uni.showModal({
					title: '确认删除',
					content: `确定要删除任务 "${task.title}" 吗？`,
					confirmText: '删除',
					cancelText: '取消',
					confirmColor: '#FF5722',
					success: (res) => {
						if (res.confirm) {
							this.todoStore.removeTask(task.id);
							uni.showToast({ title: '任务已删除', icon: 'success' });
						}
					}
				});
			}
		},

		checkLogin() {
			const u = uni.getStorageSync('userInfo');
			if (u && u.nickName) {
				this.isLoggedIn = true;
				this.userInfo = u;
			} else {
				this.isLoggedIn = false;
				this.userInfo = {};
			}
		},

		/**
		 * Fix #7: 修复首页头像点击跳转逻辑
		 * 已登录：跳转到设置页面
		 * 未登录：显示登录弹窗
		 */
		handleUserClick() {
			// 先检查是否已登录
			this.checkLogin();

			if (this.isLoggedIn && this.userInfo.nickName && this.userInfo.avatarUrl) {
				// 已登录，跳转到设置页面
				uni.navigateTo({
					url: '/src/pages/settings/index',
					success: () => {
						console.log('[index] ✅ 已跳转到设置页面');
					},
					fail: (err) => {
						console.error('[index] ❌ 跳转设置页面失败:', err);
						uni.showToast({ title: '跳转失败', icon: 'none' });
					}
				});
				return;
			}

			// 未登录或信息不完整，检查是否有缓存的用户信息
			const cachedUserInfo = uni.getStorageSync('userInfo');
			if (cachedUserInfo && cachedUserInfo.nickName && cachedUserInfo.avatarUrl) {
				// 有缓存信息，直接使用
				this.userInfo = cachedUserInfo;
				this.isLoggedIn = true;
				uni.showToast({
					title: '欢迎回来',
					icon: 'success',
					duration: 1500
				});
				// 跳转到设置页面
				setTimeout(() => {
					uni.navigateTo({ url: '/src/pages/settings/index' });
				}, 1500);
				return;
			}

			// 没有缓存信息，需要登录
			// #ifdef MP-WECHAT
			uni.getUserProfile({
				desc: '用于完善会员资料',
				success: (res) => {
					const userInfo = res.userInfo;

					// Save user info
					this.userInfo = userInfo;
					this.isLoggedIn = true;

					uni.setStorageSync('userInfo', userInfo);

					// Show success message
					uni.showToast({
						title: '登录成功',
						icon: 'success',
						duration: 2000
					});

					// Optional: Send to backend for session management
					this.syncUserInfoToBackend(userInfo);
				},
				fail: (err) => {
					console.error('Login failed:', err);
					// 如果授权失败，显示登录弹窗
					this.showLoginModal = true;
				}
			});
			// #endif

			// #ifndef MP-WECHAT
			// For non-WeChat platforms, show login modal
			this.showLoginModal = true;
			// #endif
		},

		/**
		 * Sync user info to backend
		 */
		syncUserInfoToBackend(userInfo) {
			// Optional: Implement backend sync
			console.log('User info synced:', userInfo);
		},

		handleUserInteraction() {
			if (!this.isLoggedIn) {
				this.showLoginModal = true;
			} else {
				uni.navigateTo({ url: '/src/pages/settings/index' });
			}
		},

		onChooseAvatar(e) {
			// 【核心修复】防抖：如果正在选择，直接返回
			if (this.isChoosingAvatar) {
				console.log('头像选择进行中，忽略重复点击');
				return;
			}

			// 加锁
			this.isChoosingAvatar = true;

			try {
				this.tempAvatar = e.detail.avatarUrl;
			} catch (error) {
				console.error('头像选择失败', error);
			} finally {
				// 1秒后解锁，防止重复点击
				setTimeout(() => {
					this.isChoosingAvatar = false;
				}, 1000);
			}
		},

		onNickBlur(e) {
			this.tempNick = e.detail.value;
		},

		confirmLogin() {
			if (!this.tempAvatar || !this.tempNick) {
				return uni.showToast({ title: '请完善信息', icon: 'none' });
			}
			// 生成用户ID（如果还没有）
			const uid = 'USER_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
			this.userInfo = {
				avatarUrl: this.tempAvatar,
				nickName: this.tempNick,
				uid: uid
			};
			this.isLoggedIn = true;
			this.showLoginModal = false;
			uni.setStorageSync('userInfo', this.userInfo);
			uni.showToast({ title: '登录成功', icon: 'success' });
			// 清空临时数据
			this.tempAvatar = '';
			this.tempNick = '';
		},

		/**
		 * Fix #4: Navigate to practice page
		 * Practice page is a tabBar page, so use switchTab instead of navigateTo
		 */
		navToPractice() {
			// Use switchTab for tabBar pages
			uni.switchTab({
				url: '/src/pages/practice/index',
				success: () => {
					console.log('Navigate to practice page successfully');
				},
				fail: (err) => {
					console.error('Navigation failed:', err);
					// Fallback to navigateTo if switchTab fails
					uni.navigateTo({
						url: '/src/pages/practice/index',
						fail: () => {
							uni.showToast({
								title: '页面跳转失败',
								icon: 'none',
								duration: 2000
							});
						}
					});
				}
			});
		},

		navToPage(url) {
			uni.navigateTo({
				url,
				fail: () => {
					uni.showToast({ title: '页面开发中', icon: 'none' });
				}
			});
		},

		/**
		 * 跳转到学习计划页面
		 */
		navToPlan() {
			this.navToPage('/pages/plan/index');
		},

		/**
		 * 跳转到AI助教页面
		 */
		navToAI() {
			this.navToPage('/pages/chat/index');
		},

		/**
		 * 跳转到错题本页面
		 */
		navToMistake() {
			this.navToPage('/pages/mistake/index');
		},

		/**
		 * 跳转到探索宇宙页面
		 */
		navToUniverse() {
			this.navToPage('/pages/universe/index');
		},

		onAvatarError(e) {
			console.log('头像加载失败，使用默认头像', e);
			if (!this.userInfo.avatarUrl) {
				this.userInfo.avatarUrl = this.defaultAvatar;
			}
		},

		/**
		 * 切换主题模式
		 */
		toggleTheme() {
			// 切换主题状态
			this.isDark = !this.isDark;

			// 保存到本地存储
			uni.setStorageSync('theme_mode', this.isDark ? 'dark' : 'light');

			// 发送全局主题更新事件
			uni.$emit('themeUpdate', this.isDark ? 'dark' : 'light');

			// 显示切换成功提示
			uni.showToast({
				title: this.isDark ? '已切换到深色模式' : '已切换到浅色模式',
				icon: 'success',
				duration: 1500
			});
		},

		async handleShare() {
			// 获取当前用户ID
			const userId = uni.getStorageSync('EXAM_USER_ID') || this.userInfo.id || uni.getStorageSync('user_id') || 'guest';

			try {
				// 调用 Laf 接口生成邀请码
				const res = await lafService.request('/invite-manager', {
					action: 'generate',
					userId: userId
				});

				if (res && res.code === 0 && res.data) {
					const inviteCode = res.data.inviteCode || res.data.code;
					uni.setStorageSync('invite_code', inviteCode);

					// 微信小程序分享功能
					// #ifdef MP-WECHAT
					uni.showShareMenu({
						withShareTicket: true,
						menus: ['shareAppMessage', 'shareTimeline']
					});
					uni.showToast({
						title: '请点击右上角分享',
						icon: 'none',
						duration: 2000
					});
					// #endif
				} else {
					// 降级方案：使用本地模拟
					const mockInviteCode = 'EXAM' + Math.floor(Math.random() * 9000 + 1000);
					uni.setStorageSync('invite_code', mockInviteCode);
					// #ifdef MP-WECHAT
					uni.showShareMenu({
						withShareTicket: true,
						menus: ['shareAppMessage', 'shareTimeline']
					});
					uni.showToast({
						title: '请点击右上角分享',
						icon: 'none',
						duration: 2000
					});
					// #endif
				}
			} catch (err) {
				console.error('生成邀请码失败:', err);
				// 降级方案：使用本地模拟
				const mockInviteCode = 'EXAM' + Math.floor(Math.random() * 9000 + 1000);
				uni.setStorageSync('invite_code', mockInviteCode);
				// #ifdef MP-WECHAT
				uni.showShareMenu({
					withShareTicket: true,
					menus: ['shareAppMessage', 'shareTimeline']
				});
				uni.showToast({
					title: '请点击右上角分享',
					icon: 'none',
					duration: 2000
				});
				// #endif
			}
		}
	},
	// 微信小程序分享配置
	onShareAppMessage() {
		const userInfo = uni.getStorageSync('userInfo') || {};
		// 获取本地存储的邀请码
		const inviteCode = uni.getStorageSync('invite_code') || '';
		return {
			title: `${userInfo.nickName || '考研人'} 邀请你一起备考！Exam Master - AI 智能备考助手`,
			path: `/pages/index/index?inviteCode=${inviteCode}`,
			imageUrl: 'https://img.icons8.com/color/96/open-book.png' // 分享图片
		};
	},
	onShareTimeline() {
		const userInfo = uni.getStorageSync('userInfo') || {};
		// 获取本地存储的邀请码
		const inviteCode = uni.getStorageSync('invite_code') || '';
		return {
			title: `${userInfo.nickName || '考研人'} 邀请你一起备考！Exam Master - AI 智能备考助手`,
			query: `inviteCode=${inviteCode}`,
			imageUrl: 'https://img.icons8.com/color/96/open-book.png'
		};
	}
};
</script>

<style>
/* 核心布局修复 - 基于wise.com设计风格 - 使用 CSS 变量 */
.container {
	/* 基于wise.com的配色方案 */
	--bg-main: #ffffff;
	--bg-secondary: #f8f9fa;
	--text-title: #000000;
	--text-body: #495057;
	--text-light: #6c757d;
	--accent-green: #00a96d;
	--accent-green-light: #e8f5e9;
	--accent-green-dark: #008055;
	--card-bg: #ffffff;
	--card-border: #e9ecef;
	--card-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	--card-radius: 12px;
	--transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	--font-main: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

	height: 100vh;
	background: var(--bg-main);
	overflow: hidden;
	position: relative;
	transition: background-color 0.3s ease;
	font-family: var(--font-main);
}

/* 深色模式适配 */
.container.dark-mode {
	--bg-main: #163300;
	--bg-secondary: #1a2e05;
	--text-title: #ffffff;
	--text-body: #b0b0b0;
	--text-light: #6c757d;
	--card-bg: #1e3a0f;
	--card-border: #2d4e1f;
	--card-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

/* 页面加载动画 */
@keyframes fadeInUp {
	from {
		opacity: 0;
		transform: translateY(20px);
	}

	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes pulse {

	0%,
	100% {
		opacity: 1;
	}

	50% {
		opacity: 0.5;
	}
}

/* 为所有卡片添加加载动画 */
.glass-card {
	animation: fadeInUp 0.5s ease-out forwards;
	opacity: 0;
}

/* 为不同卡片添加不同的延迟 */
.glass-card:nth-child(1) {
	animation-delay: 0.1s;
}

.glass-card:nth-child(2) {
	animation-delay: 0.2s;
}

.glass-card:nth-child(3) {
	animation-delay: 0.3s;
}

.glass-card:nth-child(4) {
	animation-delay: 0.4s;
}

/* 顶部元素动画 */
.top-bar,
.user-greeting-card,
.app-logo-section {
	animation: fadeInUp 0.5s ease-out forwards;
	opacity: 0;
}

.top-bar {
	animation-delay: 0.1s;
}

.user-greeting-card {
	animation-delay: 0.2s;
}

.app-logo-section {
	animation-delay: 0.3s;
}

/* 主滚动区域动画 */
.main-scroll {
	animation: fadeInUp 0.5s ease-out forwards;
	opacity: 0;
	animation-delay: 0.4s;
}

/* 为滚动内容中的各个元素添加动画 */
.scroll-content-padding {
	/* 重置动画，避免继承父元素的动画 */
	opacity: 1 !important;
	animation: none !important;
}

/* 为滚动内容中的各个卡片添加动画 */
.scroll-content-padding .glass-card {
	opacity: 0;
	animation: fadeInUp 0.5s ease-out forwards;
}

/* 每日金句卡片 */
.quote-card {
	animation-delay: 0.4s !important;
}

/* 邀请好友横幅 */
.invite-banner {
	animation-delay: 0.5s !important;
}

/* 功能网格卡片 */
.countdown-box {
	animation-delay: 0.6s !important;
}

.practice-entry {
	animation-delay: 0.7s !important;
}

/* 热力图 */
.heatmap-box {
	animation-delay: 0.8s !important;
}

/* 任务列表 */
.task-card {
	animation-delay: 0.9s !important;
}

/* 为任务列表项添加动画 */
.todo-item {
	opacity: 0;
	animation: fadeInUp 0.3s ease-out forwards;
}

.todo-item:nth-child(1) {
	animation-delay: 1.0s;
}

.todo-item:nth-child(2) {
	animation-delay: 1.1s;
}

.todo-item:nth-child(3) {
	animation-delay: 1.2s;
}

/* 为热力图单元格添加动画 */
.hm-cell {
	opacity: 0;
	animation: fadeInUp 0.2s ease-out forwards;
}

.hm-col:nth-child(1) .hm-cell {
	animation-delay: 0.8s;
}

.hm-col:nth-child(2) .hm-cell {
	animation-delay: 0.85s;
}

.hm-col:nth-child(3) .hm-cell {
	animation-delay: 0.9s;
}

.hm-col:nth-child(4) .hm-cell {
	animation-delay: 0.95s;
}

.hm-col:nth-child(5) .hm-cell {
	animation-delay: 1.0s;
}

/* 底部导航栏动画 */
.custom-tabbar {
	animation: fadeInUp 0.5s ease-out forwards;
	opacity: 0;
	animation-delay: 0.5s;
}

/* 数据可视化统计卡片样式 */
.stats-container {
	margin: 16px 0;
}

.stats-scroll {
	white-space: nowrap;
	margin: 0 -30rpx;
}

.stats-grid {
	display: inline-flex;
	gap: 12px;
	padding: 0 30rpx;
}

.stats-card {
	width: 150px;
	min-width: 150px;
	text-align: center;
	padding: 10px;
	animation: fadeInUp 0.5s ease-out forwards;
	opacity: 0;
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
}

.stats-card:nth-child(1) {
	animation-delay: 0.4s;
}

.stats-card:nth-child(2) {
	animation-delay: 0.5s;
}

.stats-card:nth-child(3) {
	animation-delay: 0.6s;
}

.stats-title {
	display: block;
	font-size: 14px;
	font-weight: 600;
	color: var(--text-title);
	margin-bottom: 12px;
	font-family: var(--font-main);
}

.chart-container {
	width: 100%;
	height: 120px;
	margin: 0 auto 8px;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	/* 防止内容溢出 */
	position: relative;
	/* 确保定位上下文 */
}

.chart-canvas {
	width: 100%;
	height: 100%;
	display: block;
	/* 确保canvas是块级元素 */
}

.stats-value {
	display: block;
	font-size: 20px;
	font-weight: 700;
	color: var(--accent-green);
	font-family: var(--font-main);
}

/* 深色模式下的统计卡片样式 */
.container.dark-mode .stats-card {
	background: var(--card-bg);
	border-color: var(--card-border);
}

.container.dark-mode .stats-title {
	color: var(--text-title);
}

.container.dark-mode .stats-value {
	color: var(--accent-green);
}

/* 热力图详情弹窗样式 */
.heatmap-popup {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1000;
	display: flex;
	align-items: center;
	justify-content: center;
}

.popup-overlay {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: rgba(0, 0, 0, 0.5);
	backdrop-filter: blur(5px);
}

.popup-content {
	position: relative;
	background: var(--card-bg);
	border: 1px solid var(--card-border);
	border-radius: var(--card-radius);
	padding: 24px;
	width: 80%;
	max-width: 320px;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
	animation: slideUp 0.3s ease-out forwards;
	z-index: 1001;
}

.popup-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16px;
	padding-bottom: 16px;
	border-bottom: 1px solid var(--card-border);
}

.popup-title {
	font-size: 18px;
	font-weight: 700;
	color: var(--text-title);
	font-family: var(--font-main);
}

.close-btn {
	font-size: 24px;
	color: var(--text-light);
	cursor: pointer;
	transition: var(--transition);
}

.close-btn:hover {
	color: var(--text-title);
	transform: scale(1.1);
}

.popup-body {
	padding: 8px 0;
}

.detail-item {
	display: flex;
	align-items: center;
	margin-bottom: 16px;
}

.detail-item:last-child {
	margin-bottom: 0;
}

.detail-label {
	font-size: 16px;
	color: var(--text-light);
	font-family: var(--font-main);
	margin-right: 12px;
	width: 80px;
}

.detail-value {
	font-size: 16px;
	font-weight: 600;
	color: var(--text-title);
	font-family: var(--font-main);
	flex: 1;
}

.level-text {
	padding: 6px 12px;
	border-radius: 20px;
	font-size: 14px;
	font-weight: 600;
}

.level-text.level-0 {
	background: rgba(158, 158, 158, 0.1);
	color: #9E9E9E;
}

.level-text.level-1 {
	background: var(--accent-green-light);
	color: var(--accent-green);
}

.level-text.level-2 {
	background: rgba(46, 204, 113, 0.25);
	color: var(--accent-green);
}

.level-text.level-3 {
	background: rgba(46, 204, 113, 0.4);
	color: var(--accent-green-dark);
}

/* 深色模式下的弹窗样式 */
.container.dark-mode .popup-content {
	background: var(--card-bg);
	border-color: var(--card-border);
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.container.dark-mode .popup-header {
	border-bottom-color: var(--card-border);
}

.container.dark-mode .detail-label {
	color: var(--text-body);
}

.container.dark-mode .detail-value {
	color: var(--text-title);
}

.container.dark-mode .level-text.level-0 {
	background: rgba(158, 158, 158, 0.2);
	color: #BDBDBD;
}

/* 内容容器样式 */
.content-container {
	animation: fadeIn 0.5s ease-out forwards;
	opacity: 0;
}

@keyframes fadeIn {
	from {
		opacity: 0;
	}

	to {
		opacity: 1;
	}
}

/* 确保深色模式下的动画效果正常工作 */
.container.dark-mode .glass-card {
	/* 确保卡片在深色模式下的动画效果正常 */
	animation: fadeInUp 0.5s ease-out forwards;
}

/* 确保深色模式下的热力图单元格动画正常 */
.container.dark-mode .hm-cell {
	animation: fadeInUp 0.2s ease-out forwards;
}

/* 确保深色模式下的任务列表项动画正常 */
.container.dark-mode .todo-item {
	animation: fadeInUp 0.3s ease-out forwards;
}

/* 确保深色模式下的图标颜色正确 */
.container.dark-mode .icon-txt {
	color: var(--text-body);
}

.container.dark-mode .glass-icon:hover .icon-txt {
	color: var(--accent-green);
}

/* 确保深色模式下的任务标签颜色正确 */
.container.dark-mode .tag.red {
	background: rgba(255, 87, 34, 0.15);
	color: #FF5722;
}

.container.dark-mode .tag.orange {
	background: rgba(255, 193, 7, 0.15);
	color: #FFC107;
}

.container.dark-mode .tag.blue {
	background: rgba(33, 150, 243, 0.15);
	color: #2196F3;
}

/* 确保深色模式下的滚动条样式正确 */
.container.dark-mode ::-webkit-scrollbar {
	width: 6px;
	height: 6px;
}

.container.dark-mode ::-webkit-scrollbar-track {
	background: var(--card-bg);
	border-radius: 3px;
}

.container.dark-mode ::-webkit-scrollbar-thumb {
	background: var(--card-border);
	border-radius: 3px;
}

.container.dark-mode ::-webkit-scrollbar-thumb:hover {
	background: var(--text-light);
}

.aurora-bg {
	position: absolute;
	top: -200rpx;
	left: -200rpx;
	width: 200%;
	height: 800rpx;
	background: linear-gradient(135deg, var(--accent-green-light) 0%, rgba(255, 255, 255, 0) 70%);
	filter: blur(120px);
	z-index: 0;
	opacity: 0.6;
}

/* --- 顶部时间和设置区 --- */
.top-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 20px;
	/* 增加顶部内边距，整体下移，避免与原生时间重叠 */
	padding-top: calc(env(safe-area-inset-top, 0px) + 20px);
	padding-bottom: 8px;
	margin-bottom: 16px;
	/* 增加与用户信息卡片的间距 */
	/* 移除胶囊按钮相关样式，避免遮挡 */
	position: relative;
	z-index: 10;
}

.current-time {
	font-size: 14px;
	color: var(--text-light);
	font-weight: 500;
	font-family: var(--font-main);
}

.top-right-icons {
	display: flex;
	align-items: center;
	gap: 16px;
}

/* --- 顶部导航栏 --- */
.custom-nav-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 20px;
	/* 适配刘海屏，给顶部留出空间 */
	padding-top: calc(env(safe-area-inset-top) + 10px);
	padding-bottom: 10px;
	margin-bottom: 10px;
}

/* 品牌锁定区 */
.brand-lockup {
	display: flex;
	align-items: center;
}

/* 顶部 Logo 行：图形 Logo + 文本 Logo 横向排列（像素级对齐） */
.logo-row {
	display: flex;
	flex-direction: row;
	/* 强制横向布局 */
	align-items: center;
	/* 图标和文字中轴线完全对齐 */
	justify-content: flex-start;
	gap: 10px;
	/* 图标与文字间距 */
}

/* 小 Logo 图标，呼应启动页风格 */
.mini-logo {
	width: 24px;
	height: 24px;
	border-radius: 6px;
	/* 给 Logo 加一点微发光，呼应整体风格 */
	filter: drop-shadow(0 0 8px rgba(0, 229, 255, 0.3));
	/* 确保图标垂直居中，与文字中轴线对齐 */
	object-fit: contain;
}

.logo-text-main {
	font-size: 16px;
	/* 字号下调至 16px */
	font-weight: 600;
	/* 使用 font-weight: 600 */
	color: var(--text-main, var(--text-title));
	/* 使用 var(--text-main) */
	letter-spacing: 0.5px;
	line-height: var(--line-height-normal);
	/* 确保行高为1，与图标高度对齐 */
	-webkit-font-smoothing: antialiased;
}

/* 文字列 */
.brand-text-col {
	display: flex;
	flex-direction: column;
}

.app-name {
	font-size: 20px;
	font-weight: 900;
	/* 特粗字体，更有品牌感 */
	color: #fff;
	line-height: 1.1;
	letter-spacing: 0.5px;
	/* 增加一点极光渐变感，但这行可选，纯白也可以 */
	background: linear-gradient(90deg, #FFFFFF, #E0E0E0);
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
	background-clip: text;
}

.app-slogan {
	font-size: 10px;
	color: #8E8E93;
	margin-top: 2px;
	letter-spacing: 2px;
	/* 增加字间距，显得更高级 */
	text-transform: uppercase;
}

/* Fix #1: Graphic Logo repositioned below "考研人" header, above "每日金句" card */
/* Ensure Logo has proper z-index and spacing to prevent being obscured by cards below */
.app-logo-section {
	padding: 0 20px;
	margin-bottom: 24px;
}

.graphic-logo-container {
	display: flex;
	flex-direction: row;
	align-items: center;
	background: var(--accent-green);
	border-radius: 12px;
	padding: 16px 24px;
	box-shadow: var(--card-shadow);
	width: 100%;
	justify-content: center;
	transition: var(--transition);
}

.graphic-logo-container:hover {
	box-shadow: 0 4px 16px rgba(7, 193, 96, 0.4);
	transform: translateY(-1px);
}

.graphic-logo-icon {
	width: 36px;
	height: 36px;
	margin-right: 8px;
	filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15));
	transition: var(--transition);
}

.graphic-logo-container:hover .graphic-logo-icon {
	transform: scale(1.05);
}

.logo-icon {
	font-size: 20px;
	margin-right: 8px;
	transition: var(--transition);
	transform: scale(1.1);
}

.graphic-logo-container:hover .logo-icon {
	transform: scale(1.2);
}

.graphic-logo-text {
	font-size: 20px;
	font-weight: 700;
	color: white;
	letter-spacing: 0.5px;
	font-family: var(--font-main);
	-webkit-font-smoothing: antialiased;
	transition: var(--transition);
}

.nav-right-placeholder {
	width: 36px;
	/* 与左侧Logo宽度对齐 */
}

/* --- 用户信息卡片 --- */
.user-greeting-card {
	display: flex;
	align-items: center;
	padding: 0 20px;
	margin-bottom: 24px;
	/* 增加底部间距，与Logo区域保持距离 */
	margin-top: 8px;
	/* 增加顶部间距，与top-bar保持距离 */
	transition: var(--transition);
}

.avatar-box {
	margin-right: 16px;
	cursor: pointer;
	transition: var(--transition);
}

.avatar-box:hover {
	transform: scale(1.05);
}

.user-avatar {
	width: 48px;
	height: 48px;
	border-radius: 50%;
	object-fit: cover;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	transition: var(--transition);
	border: 2px solid var(--accent-green-light);
}

.dark-mode .user-avatar {
	border: 2px solid var(--accent-green-dark);
}

.avatar-box:hover .user-avatar {
	box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
	transform: scale(1.05);
}

.avatar-box:hover .user-avatar {
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.16);
}

.greeting-text {
	display: flex;
	flex-direction: column;
	flex: 1;
}

.user-name {
	font-size: 20px;
	font-weight: 700;
	color: var(--text-title);
	font-family: var(--font-main);
	line-height: 1.2;
}

.glass-icon {
	width: 36px;
	height: 36px;
	background: transparent;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
	border: 1px solid transparent;
}

.glass-icon:hover {
	background: rgba(0, 0, 0, 0.05);
	transform: translateY(-1px);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.container.dark-mode .glass-icon {
	background: transparent;
	border: 1px solid transparent;
}

.container.dark-mode .glass-icon:hover {
	background: rgba(255, 255, 255, 0.1);
}

.glass-icon:active {
	transform: scale(0.95);
	background: rgba(0, 0, 0, 0.1);
	box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}

.container.dark-mode .glass-icon:active {
	background: rgba(255, 255, 255, 0.15);
}

/* 深色模式下的用户信息卡片 */
.container.dark-mode .user-greeting-card {
	background: transparent;
}

.icon-txt {
	font-size: 18px;
	color: var(--text-body);
	transition: var(--transition);
}

.glass-icon:hover .icon-txt {
	color: var(--accent-green);
}

.icon-txt.rotating {
	animation: rotate 1s linear infinite;
}

@keyframes rotate {
	from {
		transform: rotate(0deg);
	}

	to {
		transform: rotate(360deg);
	}
}

/* 主内容滚动区域 - 修复高度计算 */
.main-scroll {
	width: 100%;
	position: relative;
	z-index: 1;
	/* Fix #4: Scroll-view height will be set dynamically via :style binding */
	box-sizing: border-box;
}

.scroll-content-padding {
	padding: 0 30rpx;
	/* Fix #3 P0: Significantly increased bottom padding to ensure all plan items are fully visible above navigation */
	/* Bottom nav height (110rpx) + safe area + extra spacing (80rpx for last item visibility) */
	padding-bottom: calc(190rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
	min-height: 100%;
	/* Ensure content can scroll properly */
}


/* 通用卡片样式 - 基于wise.com设计风格 */
.glass-card {
	background: var(--card-bg);
	border: 1px solid var(--card-border);
	border-radius: var(--card-radius);
	padding: 24rpx;
	margin-bottom: 24rpx;
	box-shadow: var(--card-shadow);
	transition: var(--transition);
}

.glass-card:hover {
	box-shadow: var(--shadow-glow-brand);
	transform: translateY(-2px);
}

/* 确保所有卡片样式统一 */
.quote-card,
.invite-banner,
.countdown-box,
.practice-entry,
.heatmap-box,
.task-card {
	/* 确保所有卡片使用相同的圆角和阴影 */
	border-radius: var(--card-radius) !important;
	box-shadow: var(--card-shadow) !important;
	/* 确保所有卡片有相同的过渡效果 */
	transition: var(--transition) !important;
}

.quote-card .quote-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12px;
}

.quote-header .quote-tag {
	background: var(--accent-green-light);
	color: var(--accent-green);
	font-size: 12px;
	padding: 6px 12px;
	border-radius: 20px;
	font-weight: 600;
	font-family: var(--font-main);
}

.quote-header .quote-date {
	color: var(--text-light);
	font-size: 14px;
	font-family: var(--font-main);
}

.quote-text {
	font-size: 18px;
	font-weight: 600;
	color: var(--text-title);
	line-height: 1.6;
	font-family: var(--font-main);
}

/* 功能区域 */
.feature-container {
	margin-bottom: 24px;
}

/* 邀请好友横幅 */
.invite-banner {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16px 20px;
	cursor: pointer;
	transition: var(--transition);
}

.invite-banner:hover {
	transform: translateY(-1px);
	box-shadow: var(--shadow-glow-brand);
}

.banner-left {
	flex: 1;
}

.b-title {
	display: block;
	font-size: 16px;
	font-weight: 700;
	color: var(--text-title);
	margin-bottom: 4px;
	font-family: var(--font-main);
}

.b-desc {
	display: block;
	font-size: 14px;
	color: var(--text-light);
	font-family: var(--font-main);
}

.b-arrow {
	font-size: 20px;
	color: var(--accent-green);
	font-weight: bold;
	transition: var(--transition);
}

.invite-banner:hover .b-arrow {
	transform: translateX(4px);
}

/* 功能网格 */
.feature-grid {
	display: flex;
	gap: 16px;
	margin-top: 16px;
}

.countdown-box,
.practice-entry {
	flex: 1;
	height: 180rpx;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	text-align: center;
	cursor: pointer;
	transition: var(--transition);
}

.countdown-box:hover,
.practice-entry:hover {
	transform: translateY(-2px);
	box-shadow: var(--shadow-glow-brand);
}

/* 倒计时样式 */
.countdown-box .label {
	font-size: 14px;
	color: var(--text-light);
	margin-bottom: 8px;
	font-family: var(--font-main);
}

.countdown-box .days {
	font-size: 40px;
	font-weight: 900;
	color: var(--text-title);
	line-height: var(--line-height-normal);
	font-family: var(--font-main);
}

.countdown-box .days .unit {
	font-size: 16px;
	margin-left: 4px;
	color: var(--text-light);
}

.countdown-box .date-tag {
	font-size: 12px;
	color: var(--accent-green);
	background: var(--accent-green-light);
	padding: 6px 12px;
	border-radius: 16px;
	margin-top: 8px;
	font-weight: 600;
	font-family: var(--font-main);
}

/* 智能刷题样式 */
.practice-entry {
	background: var(--accent-green);
	color: white;
	border: none;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0;
	overflow: hidden;
}

.practice-entry:hover {
	background: var(--accent-green-dark);
}

.practice-content {
	padding: 20px;
	flex: 1;
}

.practice-entry .title {
	font-size: 18px;
	font-weight: 700;
	margin-bottom: 6px;
	font-family: var(--font-main);
	color: white;
}

.practice-entry .desc {
	font-size: 14px;
	opacity: 0.9;
	margin-bottom: 0;
	font-family: var(--font-main);
	color: white;
}

.practice-entry .play-circle {
	width: 40px;
	height: 40px;
	background: rgba(255, 255, 255, 0.2);
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 16px;
	color: white;
	margin-right: 20px;
	transition: var(--transition);
	border: 2px solid white;
}

.practice-entry:hover .play-circle {
	background: rgba(255, 255, 255, 0.3);
	transform: scale(1.1);
}

/* 功能区域样式已更新，旧样式已移除 */

/* 章节标题 */
.section-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin: 24px 0 16px 0;
	padding: 0 10rpx;
}

.section-header .st {
	font-size: 18px;
	font-weight: 700;
	color: var(--text-title);
	font-family: var(--font-main);
}

.section-header .total {
	font-size: 14px;
	color: var(--accent-green);
	font-weight: 600;
	font-family: var(--font-main);
}

/* 热力图 */
.heatmap-box {
	padding: 24rpx;
}

.heatmap-scroll {
	width: 100%;
	white-space: nowrap;
}

.heatmap-grid {
	display: inline-flex;
	gap: 6px;
	padding: 8px 0;
}

.hm-col {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.hm-cell {
	width: 12px;
	height: 12px;
	border-radius: 3px;
	background: var(--card-border);
	transition: var(--transition);
	cursor: pointer;
}

.hm-cell:hover {
	transform: scale(1.2);
}

.level-0 {
	background: var(--card-border);
}

.level-1 {
	background: var(--accent-green-light);
}

.level-2 {
	background: var(--accent-green);
}

.level-3 {
	background: var(--accent-green-dark);
}

/* 任务列表 */
.task-card {
	padding: 24rpx;
}

.todo-list {}

.todo-item {
	display: flex;
	align-items: center;
	padding: 16rpx 0;
	border-bottom: 1px solid var(--card-border);
	transition: var(--transition);
}

.todo-item:last-child {
	border-bottom: none;
}

.todo-item:active {
	opacity: 0.8;
}

.checkbox {
	width: 24px;
	height: 24px;
	border: 2px solid var(--card-border);
	border-radius: 6px;
	margin-right: 16px;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: var(--transition);
	cursor: pointer;
	background: transparent;
}

.checkbox:hover {
	border-color: var(--accent-green);
}

.item-done .checkbox {
	background: var(--accent-green);
	border-color: var(--accent-green);
}

.check-inner {
	width: 16px;
	height: 16px;
	color: white;
	font-size: 12px;
	transform: rotate(45deg);
	opacity: 0;
	transition: var(--transition);
}

.item-done .check-inner {
	opacity: 1;
}

.todo-txt {
	flex: 1;
	font-size: 16px;
	color: var(--text-title);
	transition: var(--transition);
	font-family: var(--font-main);
}

.item-done .todo-txt {
	color: var(--text-light);
	text-decoration: line-through;
}

.tag {
	font-size: 12px;
	padding: 6px 12px;
	border-radius: 20px;
	font-weight: 600;
	flex-shrink: 0;
	font-family: var(--font-main);
}

.tag.red {
	background: rgba(255, 87, 34, 0.1);
	color: #FF5722;
}

.tag.orange {
	background: rgba(255, 193, 7, 0.1);
	color: #FFC107;
}

.tag.blue {
	background: rgba(33, 150, 243, 0.1);
	color: #2196F3;
}

/* Fix #3 P0: Bottom spacer to prevent navigation overlap - Significantly increased height */
.bottom-spacer {
	height: calc(140rpx + env(safe-area-inset-bottom));
	/* Ensure enough space for bottom nav + safe area + last item visibility */
	min-height: 140rpx;
	/* Minimum height fallback */
}

/* 登录弹窗 */
.login-mask {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.4);
	z-index: 2000;
	display: flex;
	align-items: flex-end;
	backdrop-filter: blur(5px);
}

.login-sheet {
	width: 100%;
	background: var(--card-bg);
	border-radius: 24px 24px 0 0;
	padding: 24px 24px 50px;
	text-align: center;
	animation: slideUp 0.3s;
}

.sheet-title {
	font-size: 18px;
	font-weight: 700;
	color: var(--text-title);
	display: block;
	margin-bottom: 30px;
}

.avatar-chooser {
	width: 72px;
	height: 72px;
	border-radius: 50%;
	padding: 0;
	margin: 0 auto 24px;
	position: relative;
	background: var(--input-bg);
	border: 1px solid var(--card-border);
	display: flex;
	align-items: center;
	justify-content: center;
}

.avatar-chooser::after {
	border: none;
}

.avatar-preview {
	width: 100%;
	height: 100%;
	border-radius: 50%;
}

.nick-input {
	width: 100%;
	background: var(--input-bg);
	height: 50px;
	border-radius: 12px;
	text-align: center;
	margin-bottom: 24px;
	font-size: 15px;
	color: var(--text-title);
	box-sizing: border-box;
	padding: 0 16px;
	border: 1px solid var(--card-border);
}

.primary-btn {
	width: 100%;
	background: var(--accent-green);
	color: #FFF;
	border-radius: 25px;
	font-weight: 700;
	font-size: 16px;
	height: 50px;
	display: flex;
	align-items: center;
	justify-content: center;
	border: none;
}

.primary-btn::after {
	border: none;
}

@keyframes pulse {
	0% {
		opacity: 0.4;
	}

	50% {
		opacity: 1;
	}

	100% {
		opacity: 0.4;
	}
}

@keyframes slideUp {
	from {
		transform: translateY(100%);
	}

	to {
		transform: translateY(0);
	}
}

/* 深色模式适配 - 极光背景 */
.container.dark-mode .aurora-bg {
	background: linear-gradient(135deg, rgba(0, 212, 126, 0.1) 0%, rgba(0, 0, 0, 0) 70%) !important;
	opacity: 0.4;
	filter: blur(150px);
}
</style>
