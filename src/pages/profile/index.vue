<template>
	<!-- 全屏强制接管：fixed 定位铺满整个屏幕 -->
	<view
		class="fixed inset-0 w-full h-full z-0"
		:style="{
			backgroundColor: 'var(--bg-page)',
			transition: 'background-color 0.3s ease'
		}"
	>
		<scroll-view
			scroll-y
			class="w-full h-full"
			:scroll-top="0"
			@scroll="onScroll"
		>
			<!-- 内容区：顶部留出状态栏+导航栏空间，底部留出 TabBar 空间 -->
			<view
				class="content-wrapper"
				:style="{
					paddingTop: (layoutInfo.statusBarHeight + 56) + 'px',
					paddingBottom: (layoutInfo.tabBarHeight + 40) + 'px'
				}"
			>
				<!-- ========== 用户信息卡片 ========== -->
				<view
					class="card user-card"
					hover-class="card-hover"
				>
					<view class="user-section">
						<!-- 头像 -->
						<view class="avatar-box">
							<text class="avatar-emoji">👤</text>
						</view>
						<!-- 用户信息 -->
						<view class="user-info">
							<text class="user-name">{{ userName }}</text>
							<text class="user-id">ID: {{ userId }}</text>
						</view>
						<!-- 编辑按钮 -->
						<view
							class="edit-btn"
							hover-class="btn-hover"
							@tap="handleEditProfile"
						>
							<text class="edit-icon">✏️</text>
						</view>
					</view>
				</view>

				<!-- ========== 数据统计卡片 ========== -->
				<view class="card stats-card">
					<view class="stats-grid">
						<!-- 学习天数 -->
						<view
							class="stat-item"
							hover-class="stat-hover"
							@tap="handleStatTap('days')"
						>
							<view class="stat-icon-box">
								<text class="stat-emoji">📅</text>
							</view>
							<text class="stat-value">{{ studyDays }}</text>
							<text class="stat-label">学习天数</text>
						</view>

						<!-- 分隔线 -->
						<view class="stat-divider"></view>

						<!-- 获得勋章 -->
						<view
							class="stat-item"
							hover-class="stat-hover"
							@tap="handleStatTap('badges')"
						>
							<view class="stat-icon-box">
								<text class="stat-emoji">🏆</text>
							</view>
							<text class="stat-value">{{ badgeCount }}</text>
							<text class="stat-label">获得勋章</text>
						</view>

						<!-- 分隔线 -->
						<view class="stat-divider"></view>

						<!-- 正确率 -->
						<view
							class="stat-item"
							hover-class="stat-hover"
							@tap="handleStatTap('accuracy')"
						>
							<view class="stat-icon-box">
								<text class="stat-emoji">🎯</text>
							</view>
							<text class="stat-value">{{ accuracyRate }}%</text>
							<text class="stat-label">正确率</text>
						</view>
					</view>
				</view>

				<!-- ========== 功能菜单卡片（分组） ========== -->
				<view class="card menu-card">
					<!-- 我的错题 -->
					<view
						class="menu-item"
						hover-class="menu-hover"
						@tap="navToMistake"
					>
						<view class="menu-icon-box">
							<text class="menu-emoji">📚</text>
						</view>
						<text class="menu-text">我的错题</text>
						<text class="menu-arrow">›</text>
					</view>

					<!-- 分隔线 -->
					<view class="menu-divider"></view>

					<!-- 学习统计 -->
					<view
						class="menu-item"
						hover-class="menu-hover"
						@tap="navToStudyDetail"
					>
						<view class="menu-icon-box">
							<text class="menu-emoji">📊</text>
						</view>
						<text class="menu-text">学习统计</text>
						<text class="menu-arrow">›</text>
					</view>

					<!-- 分隔线 -->
					<view class="menu-divider"></view>

					<!-- 系统设置 -->
					<view
						class="menu-item"
						hover-class="menu-hover"
						@tap="navToSettings"
					>
						<view class="menu-icon-box">
							<text class="menu-emoji">⚙️</text>
						</view>
						<text class="menu-text">系统设置</text>
						<text class="menu-arrow">›</text>
					</view>

					<!-- 分隔线 -->
					<view class="menu-divider"></view>

					<!-- 意见反馈 -->
					<view
						class="menu-item"
						hover-class="menu-hover"
						@tap="handleFeedback"
					>
						<view class="menu-icon-box">
							<text class="menu-emoji">💬</text>
						</view>
						<text class="menu-text">意见反馈</text>
						<text class="menu-arrow">›</text>
					</view>
				</view>

				<!-- ========== 关于卡片 ========== -->
				<view class="card about-card">
					<view class="about-row">
						<text class="about-label">版本</text>
						<text class="about-value">v1.0.0</text>
					</view>
					<view class="about-divider"></view>
					<view class="about-row">
						<text class="about-label">开发者</text>
						<text class="about-value">Exam-Master Team</text>
					</view>
				</view>

				<!-- ========== 主题切换按钮 ========== -->
				<view
					class="theme-btn"
					hover-class="btn-hover"
					@tap="toggleTheme"
				>
					<text class="theme-emoji">{{ isDark ? '🌙' : '☀️' }}</text>
					<text class="theme-text">{{ isDark ? '深色模式' : '浅色模式' }}</text>
				</view>

				<!-- ========== 退出登录按钮 ========== -->
				<view
					class="logout-btn"
					hover-class="logout-hover"
					@tap="handleLogout"
				>
					<text class="logout-text">退出登录</text>
				</view>
			</view>
		</scroll-view>

		<!-- 固定顶部导航栏 -->
		<view
			class="fixed-nav"
			:class="{ 'nav-scrolled': scrollY > 20 }"
			:style="{
				paddingTop: layoutInfo.statusBarHeight + 'px'
			}"
		>
			<view class="nav-content">
				<text class="nav-title">个人中心</text>
			</view>
		</view>

		<!-- 底部 TabBar -->
		<custom-tabbar :activeIndex="4" :isDark="isDark"></custom-tabbar>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { onShow, onHide } from '@dcloudio/uni-app';
import CustomTabbar from '../../components/layout/custom-tabbar/custom-tabbar.vue';
import { useStudyStore } from '../../stores/modules/study';
import { useUserStore } from '../../stores/modules/user';
// 检查点4.4: 每日打卡 - 连续天数统计和补签卡
import { checkinStreak, useCheckinStreak } from '../../services/checkin-streak.js';
import { streakRecovery, useStreakRecovery } from '../../services/streak-recovery.js';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '../../utils/logger.js';

// ========== 响应式状态 ==========
const isDark = ref(false);
const scrollY = ref(0);
const badgeCount = ref(0);
// 检查点4.4: 打卡相关状态
const checkInStreak = ref(0); // 连续打卡天数
const todayChecked = ref(false); // 今日是否已打卡
const recoveryCards = ref(0); // 补签卡数量
const showCheckinModal = ref(false); // 是否显示打卡弹窗

const layoutInfo = ref({
	statusBarHeight: 44,
	navBarHeight: 88,
	tabBarHeight: 90,
	safeAreaBottom: 0
});

// ========== Store ==========
const studyStore = useStudyStore();
const userStore = useUserStore();

// ========== 计算属性 ==========
const userName = computed(() => userStore.userInfo?.nickName || '学习者');
const userId = computed(() => userStore.userInfo?.userId || '100001');
const studyDays = computed(() => studyStore.studyProgress?.studyDays || 0);
const accuracyRate = computed(() => {
	const progress = studyStore.studyProgress;
	if (!progress || !progress.totalQuestions || progress.totalQuestions === 0) {
		return 0;
	}
	return Math.round((progress.correctCount / progress.totalQuestions) * 100);
});

// ========== 初始化方法 ==========
function initLayoutInfo() {
	try {
		const windowInfo = uni.getWindowInfo();
		const statusBarHeight = windowInfo.statusBarHeight || 44;
		const safeAreaBottom = windowInfo.safeAreaInsets?.bottom || 0;

		layoutInfo.value = {
			statusBarHeight,
			navBarHeight: statusBarHeight + 44,
			tabBarHeight: 60 + 12 + safeAreaBottom,
			safeAreaBottom
		};
	} catch (e) {
		layoutInfo.value = {
			statusBarHeight: 44,
			navBarHeight: 88,
			tabBarHeight: 90,
			safeAreaBottom: 34
		};
	}
}

function initTheme() {
	// 优先读取用户保存的主题设置
	const savedTheme = uni.getStorageSync('theme_mode');
	if (savedTheme) {
		isDark.value = savedTheme === 'dark';
	} else {
		// 跟随系统
		try {
			const systemInfo = uni.getSystemInfoSync();
			isDark.value = systemInfo.theme === 'dark';
		} catch (e) {
			isDark.value = false;
		}
	}
}

function loadData() {
	try {
		userStore.restoreUserInfo?.();
		studyStore.restoreProgress?.();
		loadBadges();
		// 检查点4.4: 加载打卡数据
		loadCheckinData();
	} catch (error) {
		logger.error('[Profile] loadData error:', error);
	}
}

function loadBadges() {
	const achievements = uni.getStorageSync('user_achievements') || [];
	badgeCount.value = Array.isArray(achievements) ? achievements.length : 0;
}

// 检查点4.4: 加载打卡数据
async function loadCheckinData() {
	try {
		const userId = uni.getStorageSync('EXAM_USER_ID') || 'default';
		await checkinStreak.init(userId);
		await streakRecovery.init(userId);
		
		const checkinInfo = checkinStreak.getCheckinInfo();
		checkInStreak.value = checkinInfo.currentStreak;
		todayChecked.value = checkinInfo.todayChecked;
		recoveryCards.value = streakRecovery.getRecoveryCards();
		
		logger.log('[Profile] 打卡数据加载完成:', {
			streak: checkInStreak.value,
			todayChecked: todayChecked.value,
			recoveryCards: recoveryCards.value
		});
	} catch (error) {
		logger.error('[Profile] loadCheckinData error:', error);
	}
}

// 检查点4.4: 执行打卡
async function handleCheckIn() {
	if (todayChecked.value) {
		uni.showToast({ title: '今日已打卡', icon: 'none' });
		return;
	}
	
	try {
		const result = await checkinStreak.checkIn();
		
		if (result.success) {
			todayChecked.value = true;
			checkInStreak.value = result.data.streak;
			
			// 显示打卡成功提示
			uni.showToast({
				title: `打卡成功！连续${result.data.streak}天`,
				icon: 'success',
				duration: 2000
			});
			
			// 如果有里程碑奖励
			if (result.data.milestone) {
				setTimeout(() => {
					uni.showModal({
						title: '🎉 里程碑达成！',
						content: `恭喜连续打卡${result.data.streak}天！\n获得 ${result.data.milestone.exp} 经验 + ${result.data.milestone.coins} 金币`,
						showCancel: false,
						confirmText: '太棒了'
					});
				}, 1500);
			}
		} else {
			uni.showToast({ title: result.message, icon: 'none' });
		}
	} catch (error) {
		logger.error('[Profile] handleCheckIn error:', error);
		uni.showToast({ title: '打卡失败，请稍后重试', icon: 'none' });
	}
}

// 检查点4.4: 使用补签卡
async function handleRecovery(date) {
	const checkResult = streakRecovery.canRecover(date);
	
	if (!checkResult.canRecover) {
		uni.showToast({ title: checkResult.reason, icon: 'none' });
		return;
	}
	
	// 显示补签选项
	const options = checkResult.options.filter(o => o.available);
	if (options.length === 0) {
		uni.showToast({ title: '没有可用的补签方式', icon: 'none' });
		return;
	}
	
	// 优先使用免费补签
	const freeOption = options.find(o => o.type === 'free');
	const cardOption = options.find(o => o.type === 'card');
	
	let method = null;
	if (freeOption) {
		method = { type: 'free' };
	} else if (cardOption) {
		method = { type: 'card', cardType: cardOption.cardType };
	}
	
	if (!method) {
		uni.showToast({ title: '请先获取补签卡', icon: 'none' });
		return;
	}
	
	try {
		const result = await streakRecovery.recover(date, method);
		
		if (result.success) {
			// 刷新打卡数据
			await loadCheckinData();
			
			uni.showToast({
				title: `补签成功！连续${result.data.streak}天`,
				icon: 'success'
			});
		} else {
			uni.showToast({ title: result.message, icon: 'none' });
		}
	} catch (error) {
		logger.error('[Profile] handleRecovery error:', error);
		uni.showToast({ title: '补签失败，请稍后重试', icon: 'none' });
	}
}

// ========== 事件处理 ==========
function onScroll(e) {
	scrollY.value = e.detail.scrollTop;
}

function toggleTheme() {
	isDark.value = !isDark.value;
	uni.setStorageSync('theme_mode', isDark.value ? 'dark' : 'light');
	uni.$emit('themeUpdate', isDark.value ? 'dark' : 'light');

	try {
		uni.vibrateShort?.();
	} catch (e) {}
}

function handleEditProfile() {
	uni.showModal({
		title: '编辑昵称',
		editable: true,
		placeholderText: '请输入新昵称',
		success: (res) => {
			if (res.confirm && res.content) {
				userStore.updateUserInfo?.({ nickName: res.content });
				uni.showToast({ title: '更新成功', icon: 'success' });
			}
		}
	});
}

function handleStatTap(type) {
	const messages = {
		days: `累计学习 ${studyDays.value} 天`,
		badges: `已获得 ${badgeCount.value} 个勋章`,
		accuracy: `答题正确率 ${accuracyRate.value}%`
	};
	uni.showToast({ title: messages[type] || '', icon: 'none', duration: 2000 });
}

function navToMistake() {
	uni.switchTab({ url: '/src/pages/mistake/index' });
}

function navToStudyDetail() {
	uni.navigateTo({ url: '/src/pages/study-detail/index' });
}

function navToSettings() {
	uni.navigateTo({ url: '/src/pages/settings/index' });
}

function handleFeedback() {
	uni.showModal({
		title: '意见反馈',
		content: '如有问题或建议，请联系：\nfeedback@exam-master.com',
		showCancel: false,
		confirmText: '知道了'
	});
}

function handleLogout() {
	uni.showModal({
		title: '确认退出',
		content: '确定要退出登录吗？',
		success: (res) => {
			if (res.confirm) {
				userStore.clearUserInfo?.();
				uni.showToast({ title: '已退出登录', icon: 'success' });
				setTimeout(() => {
					uni.switchTab({ url: '/src/pages/index/index' });
				}, 1000);
			}
		}
	});
}

// ========== 生命周期 ==========
onMounted(() => {
	initLayoutInfo();
	initTheme();
	loadData();

	// 监听主题更新事件
	uni.$on('themeUpdate', (mode) => {
		isDark.value = mode === 'dark';
	});

	// 监听系统主题变化
	try {
		uni.onThemeChange?.((res) => {
			const savedTheme = uni.getStorageSync('theme_mode');
			if (!savedTheme) {
				isDark.value = res.theme === 'dark';
			}
		});
	} catch (e) {}
});

onShow(() => {
	uni.hideTabBar({ animation: false });
	// 每次进入页面强制刷新主题状态
	initTheme();
	// 刷新数据
	loadData();
});

onHide(() => {
	// 清理
});
</script>

<style lang="scss" scoped>
// ========== 基础布局 ==========
.fixed {
	position: fixed;
}

.inset-0 {
	top: 0;
	right: 0;
	bottom: 0;
	left: 0;
}

.w-full {
	width: 100%;
}

.h-full {
	height: 100%;
}

.z-0 {
	z-index: 0;
}

// ========== 内容区 ==========
.content-wrapper {
	padding-left: 32rpx;
	padding-right: 32rpx;
}

// ========== 通用卡片 ==========
.card {
	background-color: var(--bg-card);
	border: 1px solid var(--border-color);
	border-radius: 24rpx;
	margin-bottom: 24rpx;
	transition: all 0.2s ease;
}

.card-hover {
	opacity: 0.9;
	transform: scale(0.99);
}

// ========== 用户卡片 ==========
.user-card {
	padding: 32rpx;
}

.user-section {
	display: flex;
	align-items: center;
}

.avatar-box {
	width: 120rpx;
	height: 120rpx;
	border-radius: 50%;
	background-color: var(--muted);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 28rpx;
	flex-shrink: 0;
}

.avatar-emoji {
	font-size: 56rpx;
}

.user-info {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.user-name {
	font-size: 40rpx;
	font-weight: 700;
	line-height: 1.2;
	color: var(--text-main);
}

.user-id {
	font-size: 26rpx;
	line-height: 1.2;
	color: var(--text-sub);
}

.edit-btn {
	width: 72rpx;
	height: 72rpx;
	border-radius: 50%;
	background-color: var(--muted);
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.edit-icon {
	font-size: 32rpx;
}

// ========== 统计卡片 ==========
.stats-card {
	padding: 32rpx 16rpx;
}

.stats-grid {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.stat-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 12rpx 0;
}

.stat-hover {
	opacity: 0.7;
	transform: scale(0.95);
}

.stat-icon-box {
	width: 80rpx;
	height: 80rpx;
	border-radius: 50%;
	background-color: var(--muted);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 16rpx;
}

.stat-emoji {
	font-size: 40rpx;
}

.stat-value {
	font-size: 48rpx;
	font-weight: 800;
	line-height: 1.1;
	margin-bottom: 8rpx;
	color: var(--text-main);
}

.stat-label {
	font-size: 24rpx;
	line-height: 1.2;
	color: var(--text-sub);
}

.stat-divider {
	width: 2rpx;
	height: 80rpx;
	background-color: var(--border-color);
	flex-shrink: 0;
}

// ========== 菜单卡片 ==========
.menu-card {
	padding: 0;
	overflow: hidden;
}

.menu-item {
	display: flex;
	align-items: center;
	padding: 28rpx 32rpx;
}

.menu-hover {
	background-color: var(--muted);
}

.menu-icon-box {
	width: 76rpx;
	height: 76rpx;
	border-radius: 50%;
	background-color: var(--muted);
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 24rpx;
	flex-shrink: 0;
}

.menu-emoji {
	font-size: 36rpx;
}

.menu-text {
	flex: 1;
	font-size: 32rpx;
	font-weight: 500;
	color: var(--text-main);
}

.menu-arrow {
	font-size: 48rpx;
	font-weight: 300;
	flex-shrink: 0;
	color: var(--text-sub);
}

.menu-divider {
	height: 2rpx;
	background-color: var(--border-color);
	margin-left: 132rpx;
}

// ========== 关于卡片 ==========
.about-card {
	padding: 0;
	overflow: hidden;
}

.about-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 28rpx 32rpx;
}

.about-label {
	font-size: 28rpx;
	color: var(--text-sub);
}

.about-value {
	font-size: 28rpx;
	color: var(--text-main);
}

.about-divider {
	height: 2rpx;
	background-color: var(--border-color);
	margin-left: 32rpx;
	margin-right: 32rpx;
}

// ========== 主题切换按钮 ==========
.theme-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 16rpx;
	padding: 28rpx;
	border-radius: 24rpx;
	margin-bottom: 24rpx;
	background-color: var(--bg-card);
	border: 1px solid var(--border-color);
}

.theme-emoji {
	font-size: 36rpx;
}

.theme-text {
	font-size: 30rpx;
	font-weight: 500;
	color: var(--text-main);
}

// ========== 退出按钮 ==========
.logout-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 28rpx;
	border-radius: 24rpx;
	margin-bottom: 24rpx;
	background-color: transparent;
	border: 1px solid var(--border-color);
}

.logout-text {
	font-size: 30rpx;
	font-weight: 500;
	color: var(--danger);
}

.logout-hover {
	background-color: var(--muted);
}

// ========== 按钮通用 hover ==========
.btn-hover {
	opacity: 0.7;
	transform: scale(0.95);
}

// ========== 固定导航栏 ==========
.fixed-nav {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	z-index: 100;
	background-color: transparent;
	transition: all 0.3s ease;
}

.fixed-nav.nav-scrolled {
	background-color: var(--glass-bg);
	border-bottom: 1px solid var(--border-color);
	backdrop-filter: blur(12px);
	-webkit-backdrop-filter: blur(12px);
}

.nav-content {
	height: 88rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.nav-title {
	font-size: 36rpx;
	font-weight: 600;
	color: var(--text-main);
}
</style>