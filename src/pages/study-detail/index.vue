<template>
    <view :class="['study-detail-page', themeClass]">
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
                    <image class="stat-icon" src="/icon/loading-bar.png" mode="aspectFit"></image>
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
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '../../utils/logger.js'

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
    computed: {
        // 安全获取主题类名
        themeClass() {
            return this.themeStore?.themeClass || (this.isDark ? 'dark' : 'light')
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
            // 从本地存储加载真实数据
            try {
                // 获取今日学习时长
                const savedDate = uni.getStorageSync('study_date');
                const today = new Date().toISOString().split('T')[0];
                if (savedDate === today) {
                    this.studyTime = uni.getStorageSync('today_study_time') || 0;
                } else {
                    this.studyTime = 0;
                }
                
                // 获取完成率（从题库和学习记录计算）
                const questionBank = uni.getStorageSync('v30_bank') || [];
                const studyRecord = uni.getStorageSync('study_record') || {};
                const totalQuestions = questionBank.length;
                const completedQuestions = studyRecord.totalAnswered || 0;
                
                if (totalQuestions > 0) {
                    this.completionRate = Math.round((completedQuestions / totalQuestions) * 100);
                } else {
                    this.completionRate = 0;
                }
                
                // 获取能力评级（基于正确率）
                const correctCount = studyRecord.correctCount || 0;
                const totalAnswered = studyRecord.totalAnswered || 0;
                if (totalAnswered > 0) {
                    const accuracy = (correctCount / totalAnswered) * 100;
                    if (accuracy >= 90) {
                        this.abilityRank = 'S';
                    } else if (accuracy >= 80) {
                        this.abilityRank = 'A';
                    } else if (accuracy >= 70) {
                        this.abilityRank = 'B';
                    } else if (accuracy >= 60) {
                        this.abilityRank = 'C';
                    } else {
                        this.abilityRank = 'D';
                    }
                } else {
                    this.abilityRank = '-';
                }
                
                logger.log('[StudyDetail] 加载学习数据:', {
                    studyTime: this.studyTime,
                    completionRate: this.completionRate,
                    abilityRank: this.abilityRank
                });
            } catch (error) {
                logger.error('[StudyDetail] 加载学习数据失败:', error);
                // 使用默认值
                this.studyTime = 0;
                this.completionRate = 0;
                this.abilityRank = '-';
            }
        }
    }
}
</script>

<style lang="scss" scoped>
/* 页面容器 */
.study-detail-page {
    min-height: 100vh;
    background: var(--bg-page);
    transition: background-color 0.3s ease;
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
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: var(--shadow-sm);
    border-bottom: 1px solid var(--border-color);
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
    color: var(--text-main);
}

.navbar-title {
    font-size: 32rpx;
    font-weight: 600;
    color: var(--text-main);
    opacity: 0;
    transition: opacity 0.3s ease;
}

.title-visible {
    opacity: 1;
}

.theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64rpx;
    height: 64rpx;
    border-radius: 50%;
    background: var(--muted);
    transition: all 0.3s ease;
}

.theme-toggle:active {
    transform: scale(0.9);
    opacity: 0.8;
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
    color: var(--text-main);
    margin-bottom: 16rpx;
}

.page-subtitle {
    display: block;
    font-size: 28rpx;
    color: var(--text-sub);
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
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 24rpx;
    box-shadow: var(--shadow-sm);
    transition: all 0.3s ease;
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
    color: var(--text-main);
    margin-bottom: 8rpx;
}

.stat-label {
    display: block;
    font-size: 24rpx;
    color: var(--text-sub);
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
    color: var(--text-main);
    margin-bottom: 8rpx;
}

.section-subtitle {
    display: block;
    font-size: 24rpx;
    color: var(--text-sub);
}

.heatmap-container,
.chart-container {
    background: var(--bg-card);
    border: 1px solid var(--border-color);
    border-radius: 24rpx;
    padding: 32rpx;
    min-height: 400rpx;
    box-shadow: var(--shadow-sm);
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
    color: var(--text-main);
    margin-bottom: 16rpx;
}

.placeholder-hint {
    font-size: 24rpx;
    color: var(--text-sub);
}

/* 底部间距 */
.bottom-spacer {
    height: 48rpx;
}
</style>