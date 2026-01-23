<template>
	<view class="tabbar-container" :class="{ 'dark-mode': isDark }">
		<!-- 磨砂玻璃背景层 -->
		<view class="tabbar-blur-bg"></view>
		<!-- 导航栏内容 -->
		<view class="tabbar-bar">
			<view 
				v-for="(item, index) in tabList" 
				:key="index" 
				:class="['tab-item', { 'active': activeIndex === index }]"
				@tap="switchTab(item.path, index)"
			>
				<view class="icon-wrapper">
					<!-- SVG Icon - 图1风格图标 -->
					<image v-if="activeIndex === index" :src="item.selectedIcon" class="tab-icon" mode="aspectFit"></image>
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
		// 选中颜色: #9FE870 (Lime) or #163300 (Dark Green) depending on mode?
		// Wise app usually uses bold black/dark icons for active state on light mode.
		// Let's use the Accent Green (#9FE870) for active state in Dark Mode, and Dark Green (#163300) for active in Light Mode?
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
	created() {
		// Replace paths with Data URIs to ensure they work without static files
		this.initIcons();
	},
	mounted() {
		this.checkMistakeStatus();
	},
	methods: {
		initIcons() {
			// Wise Style Icons (Simplified strokes)
			// Inactive: Grey stroke
			// Active: Filled or Bold stroke
			
			// Define colors based on theme? No, data is init once. 
			// We can use CSS filters or just fixed colors.
			
			const activeColor = '#9FE870'; // Wise Lime
			const inactiveColor = '#A0AEC0';
			
			// Helper to generate SVG Data URI
			const svg = (path, color) => `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'>${path}</svg>`;
			const svgFill = (path, color) => `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='${encodeURIComponent(color)}' stroke='none'>${path}</svg>`;
			
			// 图1风格图标：简洁轮廓线，激活状态变粗/填充
			const icons = {
				home: "<path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'></path><polyline points='9 22 9 12 15 12 15 22'></polyline>",
				practice: "<path d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'></path><path d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'></path>",
				school: "<path d='M22 10v6M2 10l10-5 10 5-10 5z'></path><path d='M6 12v5c3 3 9 3 12 0v-5'></path>",
				settings: "<circle cx='12' cy='12' r='3'></circle><path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.09 1.41 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z'></path>",
				universe: "<circle cx='12' cy='12' r='10'></circle><path d='M2 12h20'></path><path d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'></path>"
			};
			
			// 图1风格：未激活使用细线灰色，激活使用粗线/填充黑色（深色模式为白色）
			// 未激活：stroke-width='2', 灰色
			// 激活：stroke-width='2.5' 或 fill，黑色/白色
			const svgBold = (path, color) => `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(color)}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'>${path}</svg>`;
			
			// 更新图标
			this.tabList[0].icon = svg(icons.home, inactiveColor);
			this.tabList[0].selectedIcon = svgBold(icons.home, '#1A1A1A'); // 激活：粗线黑色
			
			this.tabList[1].icon = svg(icons.practice, inactiveColor);
			this.tabList[1].selectedIcon = svgBold(icons.practice, '#1A1A1A');
			
			this.tabList[2].icon = svg(icons.school, inactiveColor);
			this.tabList[2].selectedIcon = svgBold(icons.school, '#1A1A1A');
			
			this.tabList[3].icon = svg(icons.settings, inactiveColor);
			this.tabList[3].selectedIcon = svgBold(icons.settings, '#1A1A1A');
			
			this.tabList[4].icon = svg(icons.universe, inactiveColor);
			this.tabList[4].selectedIcon = svgBold(icons.universe, '#1A1A1A');
		},
		checkMistakeStatus() {
			// 使用 storageService 获取错题数量（兼容云端和本地）
			// 优先从本地缓存读取（性能考虑），如果需要实时数据可以调用 getMistakes
			const mistakes = storageService.get('mistake_book', []);
			this.tabList[1].showDot = mistakes.length > 0;
		},
		switchTab(path, index) {
			if (this.activeIndex === index) return;
			try { if (typeof uni.vibrateShort === 'function') uni.vibrateShort(); } catch(e) {}
			
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
	bottom: 10px; /* 往上提升10px，避免贴底 */
	left: 0;
	width: 100%;
	z-index: 999;
	/* 参考图2：苹果磨砂质感透明导航栏（pill形状） */
	background: transparent;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 5px); /* 优化底部间距 */
}

/* 磨砂玻璃背景层 - 图2质感 */
.tabbar-blur-bg {
	position: absolute;
	bottom: 0;
	left: 50%;
	transform: translateX(-50%);
	width: calc(100% - 40px);
	height: 70px;
	background: rgba(255, 255, 255, 0.75);
	backdrop-filter: blur(30px) saturate(180%);
	-webkit-backdrop-filter: blur(30px) saturate(180%);
	border-radius: 35px;
	border: 0.5px solid rgba(0, 0, 0, 0.08);
	box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.08),
	            0 2px 10px rgba(0, 0, 0, 0.05);
	z-index: 0;
}

.tabbar-bar {
	display: flex;
	height: 70px;
	align-items: center;
	justify-content: space-around;
	width: calc(100% - 40px);
	position: relative;
	z-index: 1;
	padding: 0 20px;
}

.tab-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	position: relative;
}

.icon-wrapper {
	position: relative;
	width: 28px;
	height: 28px;
	margin-bottom: 4px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.tab-icon {
	width: 100%;
	height: 100%;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.tab-item.active .icon-wrapper {
	/* 激活状态：图标变粗，白色高亮 */
}

.tab-item.active .tab-icon {
	transform: scale(1.15);
	/* 激活状态：图标变粗，颜色变深（通过SVG stroke-width实现） */
}

.tab-label {
	font-size: 10px;
	color: #6B7280; /* 图1风格：未激活灰色 */
	font-weight: 500;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	letter-spacing: 0.3px;
	margin-top: 2px;
}

.tab-item.active .tab-label {
	color: #1A1A1A; /* 图1风格：激活黑色（深色模式为白色） */
	font-weight: 600;
}

/* Dark Mode Adjustments */
.dark-mode .tabbar-blur-bg {
	background: rgba(0, 0, 0, 0.6);
	backdrop-filter: blur(30px) saturate(180%);
	-webkit-backdrop-filter: blur(30px) saturate(180%);
	border: 0.5px solid rgba(255, 255, 255, 0.1);
	box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.4),
	            0 2px 10px rgba(0, 0, 0, 0.2);
}

.dark-mode .tab-item.active .tab-label {
	color: #FFFFFF; /* 深色模式：激活白色 */
}

.dark-mode .tab-label {
	color: rgba(255, 255, 255, 0.6); /* 深色模式：未激活半透明白色 */
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
