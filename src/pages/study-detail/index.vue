<template>
    <view :class="['study-detail-page', themeStore.themeClass]">
        <!-- 透明导航栏 -->
        <view class="transparent-navbar" :class="{ 'navbar-solid': scrolled }">
            <view class="navbar-content">
                <view class="navbar-left" @tap="goBack">
                    <text class="back-icon">←</text>
                </view>
                <text class="navbar-title" :class="{ 'title-visible': scrolled }">学习详情</text>
                <view class="navbar-right">
                    <!-- 主题切换按钮 -->
                    <view class="theme-toggle" @tap="toggleTheme">
                        <text class="theme-icon">{{ isDark ? '☀️' : '🌙' }}</text>
                    </view>
                </view>
            </view>
        </view>

        <!-- 滚动容器 -->
        <scroll-view class="scroll-container" scroll-y @scroll="handleScroll"
            :style="{ paddingTop: navbarHeight + 'px' }">
            <!-- 页面标题 -->
            <view class="page-header">
                <text class="page-title">学习详情</text>
                <text class="page-subtitle">查看您的学习数据和进度</text>
            </view>

            <!-- 学习概况卡片 -->
            <view class="overview-cards">
                <!-- 学习时长卡片 -->
                <view class="stat-card">
                    <image class="stat-icon" src="/icon/study.png" mode="aspectFit"></image>
                    <view class="stat-content">
                        <text class="stat-value">{{ studyTime }}</text>
                        <text class="stat-label">学习时长（分钟）</text>
                    </view>
                </view>

                <!-- 完成率卡片 -->
                <view class="stat-card">
                    <image class="stat-icon" src="/icon/stack-of-books.png" mode="aspectFit"></image>
                    <view class="stat-content">
                        <text class="stat-value">{{ completionRate }}%</text>
                        <text class="stat-label">完成率</text>
                    </view>
                </view>

                <!-- 能力评级卡片 -->
                <view class="stat-card">
                    <image class="stat-icon" src="/ranking.png" mode="aspectFit"></image>
                    <view class="stat-content">
                        <text class="stat-value">{{ abilityRank }}</text>
                        <text class="stat-label">能力评级</text>
                    </view>
                </view>
            </view>

            <!-- 学习热力图 -->
            <view class="heatmap-section">
                <view class="section-header">
                    <text class="section-title">学习热力图</text>
                    <text class="section-subtitle">过去一年的学习活跃度</text>
                </view>

                <view class="heatmap-container">
                    <!-- 这里可以集成热力图组件 -->
                    <view class="heatmap-placeholder">
                        <text class="placeholder-text">热力图组件</text>
                        <text class="placeholder-hint">显示每日学习活跃度</text>
                    </view>
                </view>
            </view>

            <!-- 学习趋势图表 -->
            <view class="chart-section">
                <view class="section-header">
                    <text class="section-title">学习趋势</text>
                    <text class="section-subtitle">最近7天的学习时长变化</text>
                </view>

                <view class="chart-container">
                    <!-- 这里可以集成图表组件 -->
                    <view class="chart-placeholder">
                        <text class="placeholder-text">趋势图表</text>
                        <text class="placeholder-hint">显示学习时长变化</text>
                    </view>
                </view>
            </view>

            <!-- 底部间距 -->
            <view class="bottom-spacer"></view>
        </scroll-view>
    </view>
</template>

<script>
import { useThemeStore } from '../../stores'

export default {
    name: 'StudyDetail',
    data() {
        return {
            themeStore: null,
            isDark: false,
            scrolled: false,
            navbarHeight: 44,

            // 学习数据
            studyTime: 0,
            completionRate: 0,
            abilityRank: '-'
        }
    },
    onLoad() {
        this.themeStore = useThemeStore()
        this.isDark = this.themeStore.isDark

        // 监听主题变化
        uni.$on('themeUpdate', (mode) => {
            this.isDark = mode === 'dark'
        })

        // 获取导航栏高度
        this.getNavbarHeight()

        // 加载学习数据
        this.loadStudyData()
    },
    onUnload() {
        // 清理事件监听
        uni.$off('themeUpdate')
    },
    methods: {
        /**
         * 获取导航栏高度
         */
        getNavbarHeight() {
            const systemInfo = uni.getSystemInfoSync()
            const statusBarHeight = systemInfo.statusBarHeight || 0
            this.navbarHeight = statusBarHeight + 44
        },

        /**
         * 处理滚动事件
         */
        handleScroll(e) {
            const scrollTop = e.detail.scrollTop
            this.scrolled = scrollTop > 50
        },

        /**
         * 返回上一页
         */
        goBack() {
            uni.navigateBack({
                fail: () => {
                    uni.switchTab({
                        url: '/src/pages/index/index'
                    })
                }
            })
        },

        /**
         * 切换主题
         */
        toggleTheme() {
            this.themeStore.toggleTheme()
        },

        /**
         * 加载学习数据
         */
        loadStudyData() {
            // TODO: 从后端或本地存储加载真实数据
            // 这里使用模拟数据
            this.studyTime = 120
            this.completionRate = 75
            this.abilityRank = 'A'
        }
    }
}
</script>

<style lang="scss" scoped>
@import '../../styles/theme-wise.scss';
@import '../../styles/theme-bitget.scss';

/* 页面容器 */
.study-detail-page {
    min-height: 100vh;
    background: var(--theme-bg-primary);
    transition: background-color 0.3s ease;
}

/* Wise 主题背景 */
.theme-wise .study-detail-page {
    background: #FFFFFF;
}

.theme-wise.dark-mode .study-detail-page {
    background: #163300;
}

/* Bitget 主题背景 */
.theme-bitget .study-detail-page {
    background: #000000;
}

/* 透明导航栏 */
.transparent-navbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    background: transparent;
    transition: all 0.3s ease;
}

.navbar-solid {
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.theme-wise.dark-mode .navbar-solid {
    background: rgba(30, 58, 15, 0.8);
}

.theme-bitget .navbar-solid {
    background: rgba(28, 28, 30, 0.8);
}

.navbar-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 44px;
    padding: 0 32rpx;
    margin-top: var(--status-bar-height, 0);
}

.navbar-left,
.navbar-right {
    width: 80rpx;
}

.back-icon {
    font-size: 40rpx;
    color: #111111;
}

.theme-wise.dark-mode .back-icon,
.theme-bitget .back-icon {
    color: #FFFFFF;
}

.navbar-title {
    font-size: 32rpx;
    font-weight: 600;
    color: #111111;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.title-visible {
    opacity: 1;
}

.theme-wise.dark-mode .navbar-title,
.theme-bitget .navbar-title {
    color: #FFFFFF;
}

.theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;
}

.theme-toggle:active {
    transform: scale(0.9);
    background: rgba(0, 0, 0, 0.1);
}

.theme-wise.dark-mode .theme-toggle,
.theme-bitget .theme-toggle {
    background: rgba(255, 255, 255, 0.1);
}

.theme-icon {
    font-size: 32rpx;
}

/* 滚动容器 */
.scroll-container {
    height: 100vh;
}

/* 页面标题 */
.page-header {
    padding: 48rpx 32rpx 32rpx;
}

.page-title {
    display: block;
    font-size: 48rpx;
    font-weight: 700;
    color: #111111;
    margin-bottom: 16rpx;
}

.theme-wise.dark-mode .page-title,
.theme-bitget .page-title {
    color: #FFFFFF;
}

.page-subtitle {
    display: block;
    font-size: 28rpx;
    color: #666666;
}

.theme-wise.dark-mode .page-subtitle,
.theme-bitget .page-subtitle {
    color: #8E8E93;
}

/* 概况卡片 */
.overview-cards {
    display: flex;
    flex-direction: column;
    gap: 24rpx;
    padding: 0 32rpx 32rpx;
}

.stat-card {
    display: flex;
    align-items: center;
    padding: 32rpx;
    background: #F5F5F7;
    border-radius: 24rpx;
    transition: all 0.3s ease;
}

.theme-wise.dark-mode .stat-card {
    background: #1e3a0f;
}

.theme-bitget .stat-card {
    background: linear-gradient(135deg, #1a2332 0%, #2d3e50 100%);
}

.stat-card:active {
    transform: scale(0.98);
}

.stat-icon {
    width: 64rpx;
    height: 64rpx;
    margin-right: 24rpx;
}

.stat-content {
    flex: 1;
}

.stat-value {
    display: block;
    font-size: 40rpx;
    font-weight: 700;
    color: #111111;
    margin-bottom: 8rpx;
}

.theme-wise.dark-mode .stat-value,
.theme-bitget .stat-value {
    color: #FFFFFF;
}

.stat-label {
    display: block;
    font-size: 24rpx;
    color: #666666;
}

.theme-wise.dark-mode .stat-label,
.theme-bitget .stat-label {
    color: #8E8E93;
}

/* 热力图区域 */
.heatmap-section,
.chart-section {
    padding: 32rpx;
}

.section-header {
    margin-bottom: 24rpx;
}

.section-title {
    display: block;
    font-size: 32rpx;
    font-weight: 600;
    color: #111111;
    margin-bottom: 8rpx;
}

.theme-wise.dark-mode .section-title,
.theme-bitget .section-title {
    color: #FFFFFF;
}

.section-subtitle {
    display: block;
    font-size: 24rpx;
    color: #666666;
}

.theme-wise.dark-mode .section-subtitle,
.theme-bitget .section-subtitle {
    color: #8E8E93;
}

.heatmap-container,
.chart-container {
    background: #F5F5F7;
    border-radius: 24rpx;
    padding: 32rpx;
    min-height: 400rpx;
}

.theme-wise.dark-mode .heatmap-container,
.theme-wise.dark-mode .chart-container {
    background: #1e3a0f;
}

.theme-bitget .heatmap-container,
.theme-bitget .chart-container {
    background: linear-gradient(135deg, #1a2332 0%, #2d3e50 100%);
}

.heatmap-placeholder,
.chart-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300rpx;
}

.placeholder-text {
    font-size: 32rpx;
    font-weight: 600;
    color: #111111;
    margin-bottom: 16rpx;
}

.theme-wise.dark-mode .placeholder-text,
.theme-bitget .placeholder-text {
    color: #FFFFFF;
}

.placeholder-hint {
    font-size: 24rpx;
    color: #666666;
}

.theme-wise.dark-mode .placeholder-hint,
.theme-bitget .placeholder-hint {
    color: #8E8E93;
}

/* 底部间距 */
.bottom-spacer {
    height: 48rpx;
}
</style>
