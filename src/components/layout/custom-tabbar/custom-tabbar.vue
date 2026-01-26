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
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '../../../utils/logger.js'
// ✅ 导入配置（用于审核模式判断）
import config from '../../../config/index.js'

export default {
	name: 'CustomTabbar',
	props: {
		activeIndex: { type: Number, default: 0 },
		isDark: { type: Boolean, default: false }
	},
	watch: {
		isDark(newVal) {
			logger.log('[CustomTabbar] 主题变化:', newVal ? '深色模式' : '浅色模式');
		}
	},
	computed: {
		// ✅ 审核模式下过滤掉宇宙页入口
		tabList() {
			const allTabs = [
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
					showDot: this.mistakeDot
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
					showDot: false,
					// ✅ 标记为高风险功能
					featureKey: 'universe'
				}
			];
			
			// ✅ 审核模式下过滤掉隐藏的功能
			if (config.audit.isAuditMode) {
				return allTabs.filter(tab => {
					if (!tab.featureKey) return true;
					return !config.audit.hiddenFeatures.includes(tab.featureKey);
				});
			}
			
			return allTabs;
		}
	},
	data() {
		return {
			mistakeDot: false
		};
	},
	mounted() {
		this.checkMistakeStatus();
	},
	methods: {
		checkMistakeStatus() {
			const mistakes = storageService.get('mistake_book', []);
			this.mistakeDot = mistakes.length > 0;
		},
		switchTab(path, index) {
			if (this.activeIndex === index) return;
			try { if (typeof uni.vibrateShort === 'function') uni.vibrateShort(); } catch (_) { }

			const currentItem = this.tabList[index];

			if (currentItem.text === '设置' || currentItem.text === '探索宇宙' || currentItem.text === '宇宙') {
				uni.navigateTo({
					url: path,
					fail: (err) => logger.warn(err)
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
	/* 浅色模式：白色玻璃质感 */
	background-color: rgba(255, 255, 255, 0.95);
	backdrop-filter: blur(40rpx) saturate(180%);
	-webkit-backdrop-filter: blur(40rpx) saturate(180%);
	border-radius: 60rpx;
	box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.1);
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 深色模式：灰色玻璃质感悬浮导航栏 */
.tabbar-capsule.dark-mode {
	/* 深灰色半透明背景 - 更深的颜色 */
	background: linear-gradient(180deg, 
		rgba(30, 30, 30, 0.95) 0%, 
		rgba(20, 20, 20, 0.98) 100%);
	/* 增强毛玻璃效果 */
	backdrop-filter: blur(80rpx) saturate(180%);
	-webkit-backdrop-filter: blur(80rpx) saturate(180%);
	/* 深色模式下的强烈阴影 + 内光晕 */
	box-shadow: 0 12rpx 48rpx rgba(0, 0, 0, 0.6), 
	            0 0 0 1rpx rgba(255, 255, 255, 0.12) inset,
	            0 2rpx 8rpx rgba(255, 255, 255, 0.05) inset;
	/* 添加明显的边框光晕 */
	border: 1rpx solid rgba(255, 255, 255, 0.15);
}

.tab-item {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	padding: 12rpx 4rpx;
	transition: transform 0.2s ease;
}

.tab-item:active {
	transform: scale(0.95);
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
	transition: transform 0.2s ease, filter 0.3s ease;
}

/* 深色模式下图标亮度调整 - 反转颜色使其变白 */
.dark-mode .tab-icon {
	filter: brightness(0) invert(1) opacity(0.7);
}

.tab-item.active .tab-icon {
	transform: scale(1.1);
}

/* 深色模式下激活图标 - 完全白色 */
.dark-mode .tab-item.active .tab-icon {
	filter: brightness(0) invert(1) opacity(1);
}

.tab-label {
	font-size: 22rpx;
	color: #888888;
	font-weight: 500;
	line-height: 1.2;
	white-space: nowrap;
	transition: color 0.3s ease;
}

/* 深色模式下的文字颜色 - 提高亮度 */
.dark-mode .tab-label {
	color: rgba(255, 255, 255, 0.7);
}

.tab-item.active .tab-label {
	color: #1A1A1A;
	font-weight: 600;
}

/* 深色模式下激活文字颜色 - 纯白 */
.dark-mode .tab-item.active .tab-label {
	color: rgba(255, 255, 255, 1);
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
	transition: border-color 0.3s ease;
}

/* 深色模式下红点边框颜色 */
.dark-mode .red-dot {
	border-color: rgba(45, 45, 45, 0.9);
}
</style>