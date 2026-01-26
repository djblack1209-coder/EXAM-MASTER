<template>
	<view :class="['container', { 'dark-mode': isDark }]">
		<view class="aurora-bg"></view>

		<!-- 骨架屏 -->
		<plan-skeleton v-if="isLoading" :isDark="isDark" />

		<!-- 导航栏 - 添加设计系统工具类 -->
		<view class="header-nav" :style="{ paddingTop: statusBarHeight + 'px' }" v-show="!isLoading">
			<view class="nav-content ds-flex ds-flex-between">
				<text class="nav-back ds-touchable" @tap="goBack">←</text>
				<text class="nav-title ds-text-lg ds-font-semibold">我的学习计划</text>
				<text class="nav-add ds-touchable" @tap="createPlan">+</text>
			</view>
		</view>

		<scroll-view scroll-y class="main-scroll" :style="{ paddingTop: (statusBarHeight + 50) + 'px' }" v-show="!isLoading">
			<!-- 空状态 -->
			<base-empty v-if="plans.length === 0" icon="📅" title="还没有学习计划" desc="创建一个学习计划，让备考更有条理！" :show-button="true"
				button-text="创建学习计划" :is-dark="isDark" @action="createPlan" />

			<!-- 计划列表 - 优化布局 -->
			<view v-for="(plan, index) in plans" :key="index" class="glass-card plan-card">
				<view class="plan-header ds-flex ds-flex-between">
					<text class="plan-name ds-text-base ds-font-semibold">{{ plan.name }}</text>
					<view class="plan-badge" :class="plan.status">
						<text class="ds-text-xs ds-font-bold">{{ getStatusText(plan.status) }}</text>
					</view>
				</view>

				<text class="plan-goal ds-text-sm">{{ plan.goal }}</text>

				<view class="plan-meta ds-flex ds-gap-sm">
					<view class="meta-item ds-flex-col">
						<text class="meta-label ds-text-xs">开始日期</text>
						<text class="meta-value ds-text-sm ds-font-semibold">{{ plan.startDate }}</text>
					</view>
					<view class="meta-item ds-flex-col">
						<text class="meta-label ds-text-xs">结束日期</text>
						<text class="meta-value ds-text-sm ds-font-semibold">{{ plan.endDate }}</text>
					</view>
				</view>

				<view class="plan-meta ds-flex ds-gap-sm">
					<view class="meta-item ds-flex-col">
						<text class="meta-label ds-text-xs">每日时长</text>
						<text class="meta-value ds-text-sm ds-font-semibold">{{ plan.dailyDuration }}</text>
					</view>
					<view class="meta-item ds-flex-col">
						<text class="meta-label ds-text-xs">提醒时间</text>
						<text class="meta-value ds-text-sm ds-font-semibold">{{ plan.reminderTime }}</text>
					</view>
				</view>

				<view class="plan-footer ds-flex ds-flex-between">
					<view class="category-tag" :class="plan.priority">
						<text class="ds-text-xs ds-font-bold">{{ plan.category }}</text>
					</view>
					<view class="priority-tag" :class="plan.priority">
						<text class="ds-text-xs ds-font-bold">{{ getPriorityText(plan.priority) }}</text>
					</view>
				</view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import { storageService } from '../../services/storageService.js'
import BaseEmpty from '../../components/base/base-empty/base-empty.vue'
import PlanSkeleton from '../../components/base/plan-skeleton/plan-skeleton.vue'

export default {
	components: {
		BaseEmpty,
		PlanSkeleton
	},
	data() {
		return {
			statusBarHeight: 44,
			isDark: false,
			isLoading: true,
			plans: []
		};
	},
	onLoad() {
		const sys = uni.getSystemInfoSync();
		this.statusBarHeight = sys.statusBarHeight || sys.safeAreaInsets?.top || 44;

		// 初始化主题
		const savedTheme = storageService.get('theme_mode', 'light');
		this.isDark = savedTheme === 'dark';

		// 监听全局主题更新事件
		uni.$on('themeUpdate', (mode) => {
			this.isDark = mode === 'dark';
		});
	},
	onUnload() {
		// 移除事件监听
		uni.$off('themeUpdate');
	},
	onShow() {
		this.loadPlans();
	},
	methods: {
		loadPlans() {
			// 从本地存储加载学习计划
			this.plans = storageService.get('study_plans', []);
			// 隐藏骨架屏
			setTimeout(() => {
				this.isLoading = false;
			}, 300);
		},
		createPlan() {
			// 跳转到创建计划页面
			uni.navigateTo({
				url: '/src/pages/plan/create'
			});
		},
		goBack() {
			uni.navigateBack();
		},
		getStatusText(status) {
			switch (status) {
				case 'not_started':
					return '未开始';
				case 'in_progress':
					return '进行中';
				case 'completed':
					return '已完成';
				default:
					return '未知';
			}
		},
		getPriorityText(priority) {
			switch (priority) {
				case 'low':
					return '低优先级';
				case 'medium':
					return '中优先级';
				case 'high':
					return '高优先级';
				default:
					return '未知';
			}
		}
	}
};
</script>

<style lang="scss" scoped>
.container {
	min-height: 100vh;
	background: var(--bg-page);
	position: relative;
	overflow: hidden;
	transition: background-color 0.3s;
}

.aurora-bg {
	position: absolute;
	top: 0;
	width: 100%;
	height: 500rpx;
	background: linear-gradient(135deg, #A8E6CF 0%, #DCEDC1 100%);
	filter: blur(80px);
	opacity: 0.6;
	z-index: 0;
}

.header-nav {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	z-index: 100;
	background: var(--glass-bg);
	backdrop-filter: blur(20px);
	-webkit-backdrop-filter: blur(20px);
	border-bottom: 1px solid var(--border-color);

	.nav-content {
		height: 50px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 30rpx;

		.nav-back {
			font-size: 36rpx;
			color: var(--text-main);
			font-weight: bold;
		}

		.nav-title {
			font-size: 34rpx;
			font-weight: 600;
			color: var(--text-main);
		}

		.nav-add {
			font-size: 40rpx;
			color: var(--text-main);
			font-weight: bold;
		}
	}
}

.main-scroll {
	height: 100vh;
	padding: 30rpx;
	box-sizing: border-box;
	position: relative;
	z-index: 1;
}

/* 空状态 */
.empty-box {
	text-align: center;
	padding-top: 200rpx;

	.empty-icon {
		font-size: 120rpx;
		display: block;
		margin-bottom: 30rpx;
	}

	.empty-text {
		color: var(--text-sub);
		font-size: 28rpx;
		margin-bottom: 60rpx;
		display: block;
	}

	.create-btn {
		background: var(--success);
		color: white;
		border: none;
		border-radius: 50rpx;
		padding: 20rpx 60rpx;
		font-size: 28rpx;
		font-weight: bold;

		&::after {
			border: none;
		}
	}
}

/* 通用玻璃卡片 */
.glass-card {
	background: var(--bg-card);
	backdrop-filter: blur(20px);
	-webkit-backdrop-filter: blur(20px);
	border: 1px solid var(--border-color);
	border-radius: 40rpx;
	padding: 30rpx;
	margin-bottom: 30rpx;
	box-shadow: var(--shadow-md);
	transition: all 0.3s;
}

.plan-card {
	padding: 30rpx;
}

.plan-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 20rpx;
}

.plan-name {
	font-size: 32rpx;
	font-weight: 600;
	color: var(--text-main);
	flex: 1;
	margin-right: 20rpx;
}

.plan-badge {
	padding: 6rpx 16rpx;
	border-radius: 16rpx;
	font-size: 20rpx;
	font-weight: bold;

	&.not_started {
		background: var(--muted);
		color: var(--text-sub);
	}

	&.in_progress {
		background: rgba(46, 204, 113, 0.1);
		color: var(--success);
	}

	&.completed {
		background: rgba(74, 144, 226, 0.1);
		color: var(--info);
	}
}

.plan-goal {
	font-size: 26rpx;
	color: var(--text-sub);
	line-height: 1.5;
	margin-bottom: 30rpx;
	display: block;
}

.plan-meta {
	display: flex;
	justify-content: space-between;
	margin-bottom: 20rpx;
}

.meta-item {
	flex: 1;

	&:first-child {
		margin-right: 20rpx;
	}
}

.meta-label {
	display: block;
	font-size: 22rpx;
	color: var(--text-sub);
	margin-bottom: 8rpx;
	opacity: 0.8;
}

.meta-value {
	display: block;
	font-size: 26rpx;
	font-weight: 600;
	color: var(--text-main);
}

.plan-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-top: 20rpx;
	border-top: 1px solid var(--border-color);
}

.category-tag {
	padding: 8rpx 16rpx;
	border-radius: 16rpx;
	font-size: 22rpx;
	font-weight: bold;

	&.low {
		background: rgba(46, 204, 113, 0.1);
		color: var(--success);
	}

	&.medium {
		background: rgba(241, 196, 15, 0.1);
		color: var(--warning);
	}

	&.high {
		background: rgba(231, 76, 60, 0.1);
		color: var(--danger);
	}
}

.priority-tag {
	padding: 8rpx 16rpx;
	border-radius: 16rpx;
	font-size: 22rpx;
	font-weight: bold;

	&.low {
		background: rgba(46, 204, 113, 0.1);
		color: var(--success);
	}

	&.medium {
		background: rgba(241, 196, 15, 0.1);
		color: var(--warning);
	}

	&.high {
		background: rgba(231, 76, 60, 0.1);
		color: var(--danger);
	}
}

/* 深色模式适配 - 极光背景 */
.container.dark-mode .aurora-bg {
	background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%) !important;
	opacity: 0.4;
	filter: blur(120px);
}
</style>