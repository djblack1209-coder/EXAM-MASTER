<template>
  <view :class="['study-detail-page', themeClass]">
    <!-- 透明导航栏 -->
    <view class="transparent-navbar" :class="{ 'navbar-solid': scrolled }">
      <view class="navbar-content">
        <view class="navbar-left" @tap="goBack">
          <text class="back-icon">
            ←
          </text>
        </view>
        <text class="navbar-title" :class="{ 'title-visible': scrolled }">
          学习详情
        </text>
        <view class="navbar-right">
          <!-- 主题切换按钮 -->
          <view class="theme-toggle" @tap="toggleTheme">
            <text class="theme-icon">
              {{ isDark ? '☀️' : '🌙' }}
            </text>
          </view>
        </view>
      </view>
    </view>

    <!-- 滚动容器 -->
    <scroll-view
      class="scroll-container"
      scroll-y
      :style="{ paddingTop: navbarHeight + 'px' }"
      @scroll="handleScroll"
    >
      <!-- 骨架屏加载状态 -->
      <view v-if="isLoading" class="skeleton-container">
        <view class="skeleton-header">
          <view class="skeleton-title skeleton-animate" />
          <view class="skeleton-subtitle skeleton-animate" />
        </view>
        <view class="skeleton-cards">
          <view v-for="i in 3" :key="i" class="skeleton-card skeleton-animate" />
        </view>
        <view class="skeleton-section">
          <view class="skeleton-section-title skeleton-animate" />
          <view class="skeleton-chart skeleton-animate" />
        </view>
      </view>

      <!-- 实际内容 -->
      <template v-else>
        <!-- 页面标题 -->
        <view class="page-header">
          <text class="page-title">
            学习详情
          </text>
          <text class="page-subtitle">
            查看您的学习数据和进度
          </text>
        </view>

        <!-- 学习概况卡片 -->
        <view class="overview-cards">
          <!-- 学习时长卡片 -->
          <view class="stat-card">
            <image class="stat-icon" src="./static/study.png" mode="aspectFit" />
            <view class="stat-content">
              <text class="stat-value">
                {{ studyTime }}
              </text>
              <text class="stat-label">
                学习时长（分钟）
              </text>
            </view>
          </view>

          <!-- 完成率卡片 -->
          <view class="stat-card">
            <image class="stat-icon" src="./static/stack-of-books.png" mode="aspectFit" />
            <view class="stat-content">
              <text class="stat-value">
                {{ completionRate }}%
              </text>
              <text class="stat-label">
                完成率
              </text>
            </view>
          </view>

          <!-- 能力评级卡片 -->
          <view class="stat-card">
            <image class="stat-icon" src="./static/loading-bar.png" mode="aspectFit" />
            <view class="stat-content">
              <text class="stat-value">
                {{ abilityRank }}
              </text>
              <text class="stat-label">
                能力评级
              </text>
            </view>
          </view>
        </view>

        <!-- 学习热力图 -->
        <view class="heatmap-section">
          <view class="section-header">
            <text class="section-title">
              学习热力图
            </text>
            <text class="section-subtitle">
              过去一年的学习活跃度
            </text>
          </view>

          <view class="heatmap-container">
            <StudyHeatmap :study-data="studyRecordData" :weeks="26" @day-tap="handleDayTap" />
          </view>
        </view>

        <!-- 学习趋势图表 -->
        <view class="chart-section">
          <view class="section-header">
            <text class="section-title">
              学习趋势
            </text>
            <text class="section-subtitle">
              最近学习时长变化
            </text>
          </view>

          <view class="chart-container">
            <StudyTrendChart :study-data="studyRecordData" @range-change="handleRangeChange" />
          </view>
        </view>

        <!-- 底部间距 -->
        <view class="bottom-spacer" />
      </template>
    </scroll-view>
  </view>
</template>

<script>
import { useThemeStore } from '@/stores';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
// 图表组件
import StudyHeatmap from './StudyHeatmap.vue';
import StudyTrendChart from './StudyTrendChart.vue';
// ✅ F019: 统一使用 storageService
import storageService from '@/services/storageService.js';
import { getNavBarHeight } from '@/utils/core/system.js';

export default {
  name: 'StudyDetail',
  components: {
    StudyHeatmap,
    StudyTrendChart
  },
  data() {
    return {
      themeStore: null,
      isDark: false,
      scrolled: false,
      navbarHeight: 44,

      // 页面加载状态
      isLoading: true,

      // 学习数据
      studyTime: 0,
      completionRate: 0,
      abilityRank: '-',

      // 热力图和趋势图数据
      studyRecordData: {} // { 'YYYY-MM-DD': minutes }
    };
  },
  computed: {
    // 安全获取主题类名
    themeClass() {
      return this.themeStore?.themeClass || (this.isDark ? 'dark' : 'light');
    }
  },
  onLoad() {
    this.themeStore = useThemeStore();
    this.isDark = this.themeStore.isDark;

    // 监听主题变化
    this._themeHandler = (mode) => {
      this.isDark = mode === 'dark';
    };
    uni.$on('themeUpdate', this._themeHandler);

    // 获取导航栏高度
    this.getNavbarHeight();

    // 加载学习数据
    this.loadStudyData();
  },
  onUnload() {
    // 清理事件监听
    uni.$off('themeUpdate', this._themeHandler);
  },
  methods: {
    /**
     * 获取导航栏高度
     */
    getNavbarHeight() {
      this.navbarHeight = getNavBarHeight();
    },

    /**
     * 处理滚动事件
     */
    handleScroll(e) {
      const scrollTop = e.detail.scrollTop;
      this.scrolled = scrollTop > 50;
    },

    /**
     * 返回上一页
     */
    goBack() {
      uni.navigateBack({
        fail: () => {
          uni.switchTab({
            url: '/pages/index/index'
          });
        }
      });
    },

    /**
     * 切换主题
     */
    toggleTheme() {
      this.themeStore.toggleTheme();
    },

    /**
     * 加载学习数据
     */
    loadStudyData() {
      this.isLoading = true;
      // 从本地存储加载真实数据
      try {
        // 获取今日学习时长
        const savedDate = storageService.get('study_date');
        const today = new Date().toISOString().split('T')[0];
        if (savedDate === today) {
          this.studyTime = storageService.get('today_study_time', 0);
        } else {
          this.studyTime = 0;
        }

        // 获取完成率（从题库和学习记录计算）
        const questionBank = storageService.get('v30_bank', []);
        const studyRecord = storageService.get('study_record', {});
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

        // 加载每日学习记录数据（用于热力图和趋势图）
        this.loadDailyStudyRecords();

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
        this.studyRecordData = {};
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * 加载每日学习记录
     */
    loadDailyStudyRecords() {
      try {
        // 尝试从本地存储获取每日学习记录
        const dailyRecords = storageService.get('daily_study_records', {});

        // 如果没有历史记录，仅显示今日数据（不注入虚假历史）
        if (Object.keys(dailyRecords).length === 0) {
          // 添加今日数据
          const today = new Date().toISOString().split('T')[0];
          if (this.studyTime > 0) {
            dailyRecords[today] = this.studyTime;
          }
        }

        // 确保今日数据是最新的
        const today = new Date().toISOString().split('T')[0];
        if (this.studyTime > 0) {
          dailyRecords[today] = this.studyTime;
        }

        this.studyRecordData = dailyRecords;

        logger.log('[StudyDetail] 加载每日学习记录:', Object.keys(dailyRecords).length + '天');
      } catch (error) {
        logger.error('[StudyDetail] 加载每日学习记录失败:', error);
        this.studyRecordData = {};
      }
    },

    /**
     * 生成演示数据
     */
    generateDemoData() {
      const data = {};
      const today = new Date();

      // 生成过去90天的随机数据
      for (let i = 1; i <= 90; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        // 随机决定是否有学习记录（约60%的天数有记录）
        if (Math.random() > 0.4) {
          // 随机学习时长 5-120 分钟
          data[dateStr] = Math.floor(Math.random() * 115) + 5;
        }
      }

      return data;
    },

    /**
     * 处理热力图日期点击
     */
    handleDayTap(day) {
      logger.log('[StudyDetail] 点击日期:', day);
      if (day.minutes > 0) {
        uni.showToast({
          title: `${day.dateStr} 学习 ${day.minutes} 分钟`,
          icon: 'none',
          duration: 2000
        });
      }
    },

    /**
     * 处理趋势图时间范围变化
     */
    handleRangeChange(range) {
      logger.log('[StudyDetail] 切换时间范围:', range + '天');
    }
  }
};
</script>

<style lang="scss" scoped>
/* 页面容器 */
.study-detail-page {
  min-height: 100vh;
  background: var(--bg-secondary, #f5f5f7);
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
  box-shadow: var(--shadow-sm);
}

/* 底部间距 */
.bottom-spacer {
  height: 48rpx;
}

/* 骨架屏样式 */
.skeleton-container {
  padding: 48rpx 32rpx;
}

.skeleton-header {
  margin-bottom: 32rpx;
}

.skeleton-title {
  width: 200rpx;
  height: 48rpx;
  border-radius: 8rpx;
  margin-bottom: 16rpx;
}

.skeleton-subtitle {
  width: 280rpx;
  height: 28rpx;
  border-radius: 6rpx;
}

.skeleton-cards {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-bottom: 32rpx;
}

.skeleton-card {
  height: 128rpx;
  border-radius: 24rpx;
}

.skeleton-section {
  margin-bottom: 32rpx;
}

.skeleton-section-title {
  width: 160rpx;
  height: 32rpx;
  border-radius: 6rpx;
  margin-bottom: 24rpx;
}

.skeleton-chart {
  height: 300rpx;
  border-radius: 24rpx;
}

.skeleton-animate {
  background: linear-gradient(90deg, var(--muted) 25%, var(--bg-card) 50%, var(--muted) 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
