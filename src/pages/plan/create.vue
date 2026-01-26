<template>
	<view :class="['container', { 'dark-mode': isDark }]">
		<view class="aurora-bg"></view>
		
		<view class="header-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
			<view class="nav-content">
				<text class="nav-back" @tap="goBack">←</text>
				<text class="nav-title">创建学习计划</text>
				<view class="nav-placeholder"></view>
			</view>
		</view>

		<scroll-view scroll-y class="main-scroll" :style="{ paddingTop: (statusBarHeight + 50) + 'px' }">
			<view class="glass-card form-card">
				<view class="form-item">
					<text class="form-label">计划名称</text>
					<input class="form-input" 
						   placeholder="例如：考研数学基础阶段复习" 
						   v-model="plan.name" 
						   @input="onInputChange"/>
				</view>
				
				<view class="form-item">
					<text class="form-label">学习目标</text>
					<textarea class="form-textarea" 
						    placeholder="例如：掌握高等数学第一章知识点，完成100道习题" 
						    v-model="plan.goal" 
						    @input="onInputChange" 
						    :auto-height="true"/>
				</view>
				
				<view class="form-item">
					<text class="form-label">开始日期</text>
					<view class="date-picker" @tap="showStartDatePicker">
						<text class="date-text">{{ plan.startDate }}</text>
						<text class="date-icon">📅</text>
					</view>
				</view>
				
				<view class="form-item">
					<text class="form-label">结束日期</text>
					<view class="date-picker" @tap="showEndDatePicker">
						<text class="date-text">{{ plan.endDate }}</text>
						<text class="date-icon">📅</text>
					</view>
				</view>
				
				<view class="form-item">
					<text class="form-label">每日学习时长</text>
					<view class="duration-selector">
						<text class="duration-btn" 
							   :class="{ active: plan.dailyDuration === '1小时' }" 
							   @tap="plan.dailyDuration = '1小时'">1小时</text>
						<text class="duration-btn" 
							   :class="{ active: plan.dailyDuration === '2小时' }" 
							   @tap="plan.dailyDuration = '2小时'">2小时</text>
						<text class="duration-btn" 
							   :class="{ active: plan.dailyDuration === '3小时' }" 
							   @tap="plan.dailyDuration = '3小时'">3小时</text>
						<text class="duration-btn" 
							   :class="{ active: plan.dailyDuration === '4小时+' }" 
							   @tap="plan.dailyDuration = '4小时+'">4小时+</text>
					</view>
				</view>
				
				<view class="form-item">
					<text class="form-label">提醒时间</text>
					<view class="time-picker" @tap="showReminderTimePicker">
						<text class="time-text">{{ plan.reminderTime }}</text>
						<text class="time-icon">⏰</text>
					</view>
				</view>
				
				<view class="form-item">
					<text class="form-label">计划分类</text>
					<view class="category-selector">
						<text class="category-btn" 
							   :class="{ active: plan.category === '数学' }" 
							   @tap="plan.category = '数学'">数学</text>
						<text class="category-btn" 
							   :class="{ active: plan.category === '英语' }" 
							   @tap="plan.category = '英语'">英语</text>
						<text class="category-btn" 
							   :class="{ active: plan.category === '政治' }" 
							   @tap="plan.category = '政治'">政治</text>
						<text class="category-btn" 
							   :class="{ active: plan.category === '专业课' }" 
							   @tap="plan.category = '专业课'">专业课</text>
						<text class="category-btn" 
							   :class="{ active: plan.category === '综合' }" 
							   @tap="plan.category = '综合'">综合</text>
					</view>
				</view>
				
				<view class="form-item">
					<text class="form-label">优先级</text>
					<view class="priority-selector">
						<text class="priority-btn low" 
							   :class="{ active: plan.priority === 'low' }" 
							   @tap="plan.priority = 'low'">低</text>
						<text class="priority-btn medium" 
							   :class="{ active: plan.priority === 'medium' }" 
							   @tap="plan.priority = 'medium'">中</text>
						<text class="priority-btn high" 
							   :class="{ active: plan.priority === 'high' }" 
							   @tap="plan.priority = 'high'">高</text>
					</view>
				</view>
			</view>
			
			<view class="action-buttons">
				<button class="action-btn primary" 
					        :disabled="!isFormValid" 
					        @tap="savePlan">
					保存计划
				</button>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import { storageService } from '../../services/storageService.js'

export default {
		data() {
			return {
				statusBarHeight: 44,
				isDark: false,
				isFormValid: false,
				plan: {
					name: '',
					goal: '',
					startDate: this.formatDate(new Date()),
					endDate: this.formatDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
					dailyDuration: '2小时',
					reminderTime: '08:00',
					category: '综合',
					priority: 'medium',
					progress: 0,
					status: 'not_started', // not_started, in_progress, completed
					tasks: [],
					timestamp: Date.now()
				}
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
		methods: {
			formatDate(date) {
				const year = date.getFullYear();
				const month = (date.getMonth() + 1).toString().padStart(2, '0');
				const day = date.getDate().toString().padStart(2, '0');
				return `${year}-${month}-${day}`;
			},
			showStartDatePicker() {
				uni.showDatePicker({
					startYear: 2024,
					endYear: 2026,
					success: (res) => {
						this.plan.startDate = `${res.year}-${res.month.toString().padStart(2, '0')}-${res.day.toString().padStart(2, '0')}`;
						this.onInputChange();
					}
				});
			},
			showEndDatePicker() {
				uni.showDatePicker({
					startYear: 2024,
					endYear: 2026,
					success: (res) => {
						this.plan.endDate = `${res.year}-${res.month.toString().padStart(2, '0')}-${res.day.toString().padStart(2, '0')}`;
						this.onInputChange();
					}
				});
			},
			showReminderTimePicker() {
				uni.showTimePicker({
					success: (res) => {
						this.plan.reminderTime = `${res.hour.toString().padStart(2, '0')}:${res.minute.toString().padStart(2, '0')}`;
						this.onInputChange();
					}
				});
			},
			onInputChange() {
				// 简单的表单验证
				this.isFormValid = this.plan.name.trim() !== '' && this.plan.goal.trim() !== '';
			},
			savePlan() {
				if (!this.isFormValid) return;
				
				// 保存到本地存储
				const plans = storageService.get('study_plans', []);
				plans.unshift(this.plan);
				storageService.save('study_plans', plans);
				
				// 返回上一页
				uni.showToast({
					title: '计划创建成功',
					icon: 'success',
					duration: 1500,
					success: () => {
						uni.navigateBack();
					}
				});
			},
			goBack() {
				uni.navigateBack();
			}
		}
	};
</script>

<style lang="scss" scoped>
.container {
	min-height: 100vh;
	background: var(--bg-secondary);
	position: relative;
	overflow: hidden;
}

.aurora-bg {
	position: absolute;
	top: 0;
	width: 100%;
	height: 500rpx;
	background: linear-gradient(135deg, var(--success-light) 0%, var(--bg-success-light) 100%);
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
	background: var(--bg-glass);
	backdrop-filter: blur(20px);
	.nav-content {
		height: 50px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 30rpx;
		.nav-back {
			font-size: 36rpx;
			color: var(--text-primary);
			font-weight: bold;
		}
		.nav-title {
			font-size: 34rpx;
			font-weight: 600;
			color: var(--text-primary);
		}
		.nav-placeholder {
			width: 36rpx;
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

/* 通用玻璃卡片 */
.glass-card {
	background: var(--bg-card-glass);
	backdrop-filter: blur(20px);
	border: 1px solid var(--border-glass);
	border-radius: 40rpx;
	padding: 30rpx;
	margin-bottom: 30rpx;
	box-shadow: var(--shadow-lg);
}

.form-card {
	padding: 40rpx;
}

.form-item {
	margin-bottom: 40rpx;
}

.form-label {
	display: block;
	font-size: 28rpx;
	font-weight: 600;
	color: var(--text-primary);
	margin-bottom: 16rpx;
}

.form-input,
.form-textarea {
	width: 100%;
	padding: 24rpx;
	border-radius: 16rpx;
	background: var(--bg-card);
	border: 2rpx solid var(--border-light);
	font-size: 28rpx;
	color: var(--text-primary);
	box-sizing: border-box;
	box-shadow: var(--shadow-sm);
	transition: all 0.3s;
}

.form-input:focus,
.form-textarea:focus {
	border-color: var(--success-green);
	box-shadow: var(--shadow-success);
}

.date-picker,
.time-picker {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 24rpx;
	border-radius: 16rpx;
	background: var(--bg-card);
	border: 2rpx solid var(--border-light);
	cursor: pointer;
	transition: all 0.2s;
	box-shadow: var(--shadow-sm);
}

.date-text,
.time-text {
	font-size: 28rpx;
	color: var(--text-primary);
	font-weight: 500;
}

.date-icon,
.time-icon {
	font-size: 28rpx;
}

.duration-selector,
.category-selector {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
}

.duration-btn,
.category-btn {
	padding: 16rpx 28rpx;
	border-radius: 24rpx;
	background: var(--bg-tag);
	border: 1px solid var(--border-light);
	font-size: 26rpx;
	color: var(--text-secondary);
	transition: all 0.2s;
	cursor: pointer;
	&.active {
		background: var(--success-green);
		color: var(--text-inverse);
		font-weight: bold;
		border-color: var(--success-green);
	}
	&:active {
		transform: scale(0.95);
	}
}

.priority-selector {
	display: flex;
	gap: 16rpx;
}

.priority-btn {
	flex: 1;
	padding: 20rpx;
	border-radius: 16rpx;
	text-align: center;
	font-size: 28rpx;
	font-weight: bold;
	transition: all 0.2s;
	cursor: pointer;
	&.low {
		background: var(--bg-success-light);
		color: var(--success-green);
	}
	&.medium {
		background: var(--bg-warning-light);
		color: var(--warning);
	}
	&.high {
		background: var(--bg-danger-light);
		color: var(--danger-red);
	}
	&.active {
		color: var(--text-inverse);
		&.low {
			background: var(--success-green);
		}
		&.medium {
			background: var(--warning);
		}
		&.high {
			background: var(--danger-red);
		}
	}
	&:active {
		transform: scale(0.95);
	}
}

.action-buttons {
	margin-top: 60rpx;
	margin-bottom: 100rpx;
}

.action-btn {
	width: 100%;
	padding: 24rpx;
	border-radius: 50rpx;
	font-size: 32rpx;
	font-weight: bold;
	border: none;
	transition: all 0.2s;
	&.primary {
		background: var(--success-green);
		color: var(--text-inverse);
		box-shadow: var(--shadow-success);
	}
	&[disabled] {
		opacity: 0.5;
	}
	&::after {
		border: none;
	}
	&:active {
		transform: scale(0.98);
	}
}

/* 深色模式适配 */
.container.dark-mode {
	background-color: var(--bg-color);
}

.container.dark-mode .nav-title {
	color: var(--text-primary);
}

.container.dark-mode .nav-back {
	color: var(--text-primary);
}

.container.dark-mode .glass-card {
	background: var(--card-bg);
	border-color: var(--card-border);
}

.container.dark-mode .form-label {
	color: var(--text-primary);
}

.container.dark-mode .form-input,
.container.dark-mode .form-textarea {
	background: var(--bg-input-dark);
	border-color: var(--border-dark);
	color: var(--text-primary);
}

.container.dark-mode .date-picker,
.container.dark-mode .time-picker {
	background: var(--bg-input-dark);
	border-color: var(--border-dark);
}

.container.dark-mode .date-text,
.container.dark-mode .time-text {
	color: var(--text-primary);
}

.container.dark-mode .duration-btn,
.container.dark-mode .category-btn {
	background: var(--bg-input-dark);
	border-color: var(--border-dark);
	color: var(--text-primary);
}

.container.dark-mode .aurora-bg {
	background: linear-gradient(135deg, var(--bg-body) 0%, var(--bg-dark-gradient-1) 50%, var(--bg-glass) 100%) !important;
}
</style>