<template>
	<view class="tabbar-container" :class="{ 'dark-mode': isDark }">
		<!-- 磨砂玻璃背景层 -->
		<view class="tabbar-blur-bg"></view>
		<!-- 导航栏内容 -->
		<view class="tabbar-bar">
			<view v-for="(item, index) in tabList" :key="index"
				:class="['tab-item', { 'active': activeIndex === index }]" @tap="switchTab(item.path, index)">
				<view class="icon-wrapper">
					<!-- SVG Icon - 图1风格图标 -->
					<image v-if="activeIndex === index" :src="item.selectedIcon" class="tab-icon" mode="aspectFit">
					</image>
					<image v-else :src="item.icon" class="tab-icon" mode="aspectFit"></image>

					<view class="red-dot" v-if="item.showDot"></view>
				</view>
				<text class="tab-label">{{ item.text }}</text>
			</view>
		</view>
		<view class="safe-area-bottom"></view>
	</view>
</template>

<script>
import { storageService } from '../../services/storageService.js'

export default {
	name: 'CustomTabbar',
	props: {
		activeIndex: { type: Number, default: 0 },
		isDark: { type: Boolean, default: false }
	},
	data() {
		// Wise 风格图标 (使用 Base64 SVG)
		// 选中颜色: var(--brand-color) (Lime) or var(--bg-body) (Dark Green) depending on mode?
		// Wise app usually uses bold black/dark icons for active state on light mode.
		// Let's use the Accent Green (var(--brand-color)) for active state in Dark Mode, and Dark Green (var(--bg-body)) for active in Light Mode?
		// Actually, let's stick to a consistent accent color.

		const colorActive = '#2ECC71'; // Fallback
		const colorInactive = '#999999';

		return {
			tabList: [
				{
					text: '首页',
					path: '/src/pages/index/index',
					icon: '/static/tabbar/home.png',
					selectedIcon: '/static/tabbar/home-active.png',
					showDot: false
				},
				{
					text: '刷题',
					path: '/src/pages/practice/index',
					icon: '/static/tabbar/practice.png',
					selectedIcon: '/static/tabbar/practice-active.png',
					showDot: false
				},
				{
					text: '择校',
					path: '/src/pages/school/index',
					icon: '/static/tabbar/school.png',
					selectedIcon: '/static/tabbar/school-active.png',
					showDot: false
				},
				{
					text: '设置',
					path: '/src/pages/settings/index',
					icon: '/static/tabbar/profile.png', // Reusing profile icon for settings as placeholder if needed, or use specific settings icon
					selectedIcon: '/static/tabbar/profile-active.png',
					showDot: false
				},
				{
					text: '宇宙',
					path: '/src/pages/universe/index',
					icon: '/static/tabbar/universe.png',
					selectedIcon: '/static/tabbar/universe-active.png',
					showDot: false
				}
			]
		};
	},
	mounted() {
		this.checkMistakeStatus();
	},
	methods: {
		checkMistakeStatus() {
			// 使用 storageService 获取错题数量（兼容云端和本地）
			// 优先从本地缓存读取（性能考虑），如果需要实时数据可以调用 getMistakes
			const mistakes = storageService.get('mistake_book', []);
			this.tabList[1].showDot = mistakes.length > 0;
		},
		switchTab(path, index) {
			if (this.activeIndex === index) return;
			try { if (typeof uni.vibrateShort === 'function') uni.vibrateShort(); } catch (e) { }

			const currentItem = this.tabList[index];

			// Handle non-tabbar pages manually
			if (currentItem.text === '设置' || currentItem.text === '探索宇宙' || currentItem.text === '宇宙') {
				uni.navigateTo({
					url: path,
					fail: (err) => console.warn(err)
				});
				return;
			}

			setTimeout(() => {
				uni.switchTab({
					url: path,
					fail: (err) => {
						uni.reLaunch({ url: path });
					}
				});
			}, 50);
		}
	}
};
</script>

<style scoped>
.tabbar-container {
	position: fixed;
	bottom: 0;
	left: 0;
	width: 100%;
	z-index: 999;
	background: transparent;
	padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 20rpx);
}

/* 磨砂玻璃背景层 - 确保容纳图标+文字 */
.tabbar-blur-bg {
	position: absolute;
	bottom: 20rpx;
	left: 50%;
	transform: translateX(-50%);
	width: calc(100% - 48rpx);
	height: 160rpx;
	background: rgba(255, 255, 255, 0.8);
	backdrop-filter: blur(40rpx) saturate(180%);
	-webkit-backdrop-filter: blur(40rpx) saturate(180%);
	border-radius: 80rpx;
	border: 1rpx solid rgba(0, 0, 0, 0.06);
	box-shadow: 0 -4rpx 32rpx rgba(0, 0, 0, 0.06),
		0 2rpx 12rpx rgba(0, 0, 0, 0.04);
	z-index: 0;
}

.tabbar-bar {
	position: absolute;
	bottom: 20rpx;
	left: 50%;
	transform: translateX(-50%);
	display: flex;
	height: 160rpx;
	align-items: center;
	justify-content: space-around;
	width: calc(100% - 48rpx);
	z-index: 1;
	padding: 0 16rpx;
}

.tab-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	position: relative;
	padding: 20rpx 4rpx;
}

.icon-wrapper {
	position: relative;
	width: 52rpx;
	height: 52rpx;
	margin-bottom: 8rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.tab-icon {
	width: 100%;
	height: 100%;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-item.active .icon-wrapper {
	/* 激活状态 */
}

.tab-item.active .tab-icon {
	transform: scale(1.08);
}

.tab-label {
	font-size: 24rpx;
	color: #666666;
	font-weight: 500;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	letter-spacing: 0.4rpx;
	line-height: 1.2;
	white-space: nowrap;
	flex-shrink: 0;
}

.tab-item.active .tab-label {
	color: #1A1A1A;
	/* 图1风格：激活黑色（深色模式为白色） */
	font-weight: 600;
}

/* Dark Mode Adjustments - 磨砂玻璃白色背景 */
.dark-mode .tabbar-blur-bg {
	background: rgba(255, 255, 255, 0.85);
	backdrop-filter: blur(40rpx) saturate(180%);
	-webkit-backdrop-filter: blur(40rpx) saturate(180%);
	border: 1rpx solid rgba(255, 255, 255, 0.2);
	box-shadow: 0 -4rpx 32rpx rgba(0, 0, 0, 0.15),
		0 2rpx 12rpx rgba(0, 0, 0, 0.08);
}

.dark-mode .tab-item.active .tab-label {
	color: #1A1A1A;
	/* 深色模式：激活深色（白色背景上） */
}

.dark-mode .tab-label {
	color: #666666;
	/* 深色模式：未激活灰色（白色背景上） */
}

/* Red Dot */
.red-dot {
	position: absolute;
	top: -4rpx;
	right: -4rpx;
	width: 16rpx;
	height: 16rpx;
	background-color: #FF3B30;
	border-radius: 50%;
	border: 2rpx solid #FFF;
}
</style>
