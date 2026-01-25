<template>
	<!-- 外层定位容器：完全透明，不阻挡点击 -->
	<view
		class="tabbar-position-wrapper"
		style="position: fixed; bottom: 0; left: 0; right: 0; z-index: 999; background-color: transparent !important; background: transparent !important; pointer-events: none;"
	>
		<!-- 内层胶囊：唯一可见实体，恢复点击 -->
		<view
			class="tabbar-capsule"
			style="pointer-events: auto;"
			:class="{ 'dark-mode': isDark }"
		>
			<view
				v-for="(item, index) in tabList"
				:key="index"
				class="tab-item"
				:class="{ 'active': activeIndex === index }"
				@tap="switchTab(item.path, index)"
			>
				<view class="icon-wrapper">
					<image
						v-if="activeIndex === index"
						:src="item.selectedIcon"
						class="tab-icon"
						mode="aspectFit"
					></image>
					<image
						v-else
						:src="item.icon"
						class="tab-icon"
						mode="aspectFit"
					></image>
					<view class="red-dot" v-if="item.showDot"></view>
				</view>
				<text class="tab-label">{{ item.text }}</text>
			</view>
		</view>
	</view>
</template>

<script>
import { storageService } from '../../../services/storageService.js'

export default {
	name: 'CustomTabbar',
	props: {
		activeIndex: { type: Number, default: 0 },
		isDark: { type: Boolean, default: false }
	},
	data() {
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
					icon: '/static/tabbar/profile.png',
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
			const mistakes = storageService.get('mistake_book', []);
			this.tabList[1].showDot = mistakes.length > 0;
		},
		switchTab(path, index) {
			if (this.activeIndex === index) return;
			try { if (typeof uni.vibrateShort === 'function') uni.vibrateShort(); } catch (_) { }

			const currentItem = this.tabList[index];

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
					fail: () => {
						uni.reLaunch({ url: path });
					}
				});
			}, 50);
		}
	}
};
</script>

<style scoped>
/* 外层定位容器：绝对不能有任何背景色 */
.tabbar-position-wrapper {
	/* 所有背景相关属性都在 inline style 中用 !important 强制透明 */
}

/* 内层胶囊：唯一可见的实体元素 */
.tabbar-capsule {
	margin-left: 24rpx;
	margin-right: 24rpx;
	margin-bottom: calc(24rpx + env(safe-area-inset-bottom, 0px));
	height: 120rpx;
	display: flex;
	align-items: center;
	justify-content: space-around;
	background-color: rgba(255, 255, 255, 0.95);
	backdrop-filter: blur(40rpx) saturate(180%);
	-webkit-backdrop-filter: blur(40rpx) saturate(180%);
	border-radius: 60rpx;
	box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.1);
}

.tabbar-capsule.dark-mode {
	background-color: rgba(255, 255, 255, 0.98);
	box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.15);
}

.tab-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	padding: 12rpx 4rpx;
}

.icon-wrapper {
	position: relative;
	width: 48rpx;
	height: 48rpx;
	margin-bottom: 6rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.tab-icon {
	width: 100%;
	height: 100%;
	transition: transform 0.2s ease;
}

.tab-item.active .tab-icon {
	transform: scale(1.1);
}

.tab-label {
	font-size: 22rpx;
	color: #888888;
	font-weight: 500;
	line-height: 1.2;
	white-space: nowrap;
}

.tab-item.active .tab-label {
	color: #1A1A1A;
	font-weight: 600;
}

.red-dot {
	position: absolute;
	top: -4rpx;
	right: -4rpx;
	width: 16rpx;
	height: 16rpx;
	background-color: #FF3B30;
	border-radius: 50%;
	border: 2rpx solid #FFFFFF;
}
</style>
