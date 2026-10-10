<template>
  <LearningShell v-if="!showLegacy" active="study-detail" title="学习足迹">
    <LearningOverview :initial-expanded="true" :show-navigation="false" view="study-detail" />
    <view class="legacy-entry">
      <button class="quiet-button" role="button" tabindex="0" @tap="toggleLegacy">历史题库记录</button>
    </view>
  </LearningShell>
  <view v-else :class="['study-detail-page', themeClass]">
    <!-- 透明导航栏 -->
    <view class="transparent-navbar" :class="{ 'navbar-solid': scrolled }">
      <view class="navbar-content">
        <view class="navbar-left" @tap="goBack">
          <text class="back-icon">
            <BaseIcon name="arrow-left" :size="36" />
          </text>
        </view>
        <text class="navbar-title" :class="{ 'title-visible': scrolled }"> 学习详情 </text>
        <view class="navbar-right">
          <!-- 主题切换按钮 -->
          <view class="theme-toggle" @tap="toggleTheme">
            <BaseIcon :name="isDark ? 'sun' : 'moon'" :size="36" />
          </view>
        </view>
      </view>
    </view>

    <!-- 滚动容器 -->
    <scroll-view
      class="scroll-container"
      scroll-y
      :style="{ paddingTop: navbarHeight + 'px' }"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @scroll="handleScroll"
      @refresherrefresh="onPullRefresh"
    >
      <LearningOverview :initial-expanded="true" />
      <button size="mini" @tap="toggleLegacy">
        {{ showLegacy ? '收起历史视图' : '历史题库记录' }}
      </button>
      <template v-if="showLegacy">
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
          <!-- 空状态：新用户无学习记录 -->
          <view
            v-if="studyTime === 0 && historicalCount === 0 && legacySummary.answeredCount === 0"
            class="empty-state-container"
          >
            <view class="page-header">
              <text class="page-title"> 学习详情 </text>
            </view>
            <view class="empty-state-card">
              <!-- 学习旅程空状态插图 -->
              <BaseIcon class="empty-illustration" name="book" :size="100" />
              <text class="empty-title">还没有学习记录</text>
              <text class="empty-desc">这里保留历史题库记录；当前学习依据在上方查看。</text>
              <button class="empty-action-btn" @tap="goToPractice">开始学习</button>
            </view>
          </view>

          <!-- 有数据时展示完整内容 -->
          <template v-else>
            <!-- 页面标题 -->
            <view class="page-header">
              <text class="page-title"> 学习详情 </text>
            </view>

            <view class="ai-insight-card">
              <text>历史题库记录不代表当前能力。</text>
              <text v-if="legacySummary.legacyGradedCount"
                >本机逐题旧判对 {{ legacySummary.legacyCorrectCount }} / {{ legacySummary.legacyGradedCount }}（{{
                  legacySummary.legacyAccuracy
                }}%）</text
              >
              <text v-else>暂无可分类的旧判定</text>
              <text v-if="legacySummary.pendingCount">待核对 {{ legacySummary.pendingCount }}</text>
              <text v-if="legacySummary.unclassifiedCount">依据不明 {{ legacySummary.unclassifiedCount }}</text>
            </view>

            <!-- 学习概况卡片 -->
            <view class="overview-cards">
              <!-- 学习时长卡片 -->
              <view class="stat-card">
                <BaseIcon class="stat-icon" name="calendar" :size="40" />
                <view class="stat-content">
                  <text class="stat-value">
                    {{ studyTime }}
                  </text>
                  <text class="stat-label"> 历史学习时长（分钟） </text>
                </view>
              </view>

              <!-- 已记录的自评复习 -->
              <view class="stat-card">
                <BaseIcon class="stat-icon" name="book" :size="40" />
                <view class="stat-content">
                  <text class="stat-value"> {{ legacySummary.reviewedCount }} </text>
                  <text class="stat-label"> 本机自评复习 </text>
                </view>
              </view>

              <!-- 历史累计数量 -->
              <view class="stat-card">
                <BaseIcon name="chart-bar" :size="52" class="stat-icon" />
                <view class="stat-content">
                  <text class="stat-value">
                    {{ historicalCount }}
                  </text>
                  <text class="stat-label"> 历史累计作答 </text>
                </view>
              </view>
            </view>

            <!-- 学习热力图 -->
            <view class="heatmap-section">
              <view class="section-header">
                <text class="section-title"> 学习热力图 </text>
              </view>

              <view class="heatmap-container">
                <StudyHeatmap :study-data="studyRecordData" :weeks="26" @day-tap="handleDayTap" />
              </view>
            </view>

            <!-- FSRS 记忆模型优化 -->
            <view class="fsrs-section">
              <view class="section-header">
                <text class="section-title"> 智能记忆 </text>
              </view>
              <FSRSOptimizer />
            </view>

            <!-- 学习趋势图表 -->
            <view class="chart-section">
              <view class="section-header">
                <text class="section-title"> 学习趋势 </text>
              </view>

              <view class="chart-container">
                <StudyTrendChart :study-data="studyRecordData" @range-change="handleRangeChange" />
              </view>
            </view>

            <!-- 底部间距 -->
            <view class="bottom-spacer" />
          </template>
        </template>
      </template>
    </scroll-view>
  </view>
</template>

<script setup>
import LearningOverview from '@/components/business/learning/learning-overview.vue';
import LearningShell from '@/components/business/learning/learning-shell.vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';

import { ref, computed } from 'vue';
const learning = useConversationLearningStore();
const showLegacy = ref(false);
function toggleLegacy() {
  showLegacy.value = !showLegacy.value;
  if (showLegacy.value) loadStudyData(true);
}
import { onLoad, onUnload } from '@dcloudio/uni-app';
import { toast } from '@/utils/toast.js';
import { useThemeStore } from '@/stores';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { useStudyStore } from '@/stores/modules/study';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
// 图表组件
import StudyHeatmap from '@/components/business/index/StudyHeatmap.vue';
import StudyTrendChart from './StudyTrendChart.vue';
import FSRSOptimizer from './FSRSOptimizer.vue';
// ✅ F019: 统一使用 storageService
import storageService from '@/services/storageService.js';
import { getNavBarHeight } from '@/utils/core/system.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { summarizeQuizProgress } from '@/services/quiz-session-contract.js';
import { useStatsStore } from '@/stores/modules/stats.js';

defineOptions({ name: 'StudyDetail' });

// Store 实例
const themeStore = useThemeStore();
const studyStore = useStudyStore();
const statsStore = useStatsStore();

// 非响应式实例属性（事件回调引用，用于解绑）
let _themeHandler = null;

// === 响应式状态 ===
const isRefreshing = ref(false);
const isDark = ref(false);
const scrolled = ref(false);
const navbarHeight = ref(44);

// 页面加载状态
const isLoading = ref(true);

// 学习数据
const studyTime = ref(0);
const historicalCount = ref(0);
const legacySummary = ref(summarizeQuizProgress());

// 热力图和趋势图数据
const studyRecordData = ref({}); // { 'YYYY-MM-DD': minutes }

// === 计算属性 ===

/** 安全获取主题类名 */
const themeClass = computed(() => {
  return themeStore?.themeClass || (isDark.value ? 'dark' : 'light');
});

// === 生命周期 ===

onLoad(() => {
  isDark.value = themeStore.isDark;

  // 监听主题变化
  _themeHandler = (mode) => {
    isDark.value = mode === 'dark';
  };
  uni.$on('themeUpdate', _themeHandler);

  // 获取导航栏高度
  navbarHeight.value = getNavBarHeight();

  // 加载学习数据
  loadStudyData();
});

onUnload(() => {
  // 清理事件监听
  uni.$off('themeUpdate', _themeHandler);
});

// === 方法 ===

/** 下拉刷新 */
async function onPullRefresh() {
  isRefreshing.value = true;
  try {
    await loadStudyData();
  } catch (_e) {
    /* 静默处理 */
  }
  isRefreshing.value = false;
}

/** 处理滚动事件 */
function handleScroll(e) {
  const scrollTop = e.detail.scrollTop;
  scrolled.value = scrollTop > 50;
}

/** 返回上一页 */
function goBack() {
  safeNavigateBack();
}

/** 跳转到练习页面（空状态引导按钮） */
function goToPractice() {
  uni.switchTab({ url: '/pages/practice/index' });
}

/** 切换主题 */
function toggleTheme() {
  themeStore.toggleTheme();
}

/** 旧聚合只展示历史数量和时长；可追溯学习状态由上方核心视图提供。 */
async function loadStudyData() {
  learning.refresh();
  if (!showLegacy.value) {
    isLoading.value = false;
    return;
  }
  isLoading.value = true;
  try {
    loadLegacyAnswerSummary();
    const overview = await statsStore.fetchOverview();
    if (overview && overview.totalQuestions > 0) {
      studyTime.value = overview.totalStudyMinutes || overview.today?.studyMinutes || 0;
      historicalCount.value = overview.totalQuestions;
      await _loadDailyFromBackend();
    } else _loadStatsFromLocal();
  } catch (error) {
    logger.error('[StudyDetail] 历史记录加载失败:', error);
    toast.error('历史记录加载失败');
    studyTime.value = 0;
    historicalCount.value = 0;
    studyRecordData.value = {};
  } finally {
    isLoading.value = false;
  }
}

/** 从后端加载每日统计（用于热力图） */
async function _loadDailyFromBackend() {
  try {
    const result = await statsStore.fetchDailyStats(30);
    if (result?.stats?.length > 0) {
      const records = {};
      for (const day of result.stats) {
        if (day.studyMinutes > 0 || day.questions > 0) {
          if (day.studyMinutes > 0) records[day.date] = day.studyMinutes;
        }
      }
      studyRecordData.value = records;
      return;
    }
  } catch (_err) {
    /* 降级到本地 */
  }
  loadDailyStudyRecords();
}

function loadLegacyAnswerSummary() {
  studyStore.restoreProgress();
  const history = Array.isArray(studyStore.questionHistory) ? studyStore.questionHistory : [];
  legacySummary.value = summarizeQuizProgress({
    answeredQuestions: history.map((item, index) => ({ ...item, index }))
  });
}

/** 保留历史统计，次数不折算学习分钟或能力。 */
function _loadStatsFromLocal() {
  const savedDate = storageService.get('study_date');
  const today = new Date().toISOString().split('T')[0];
  studyTime.value = savedDate === today ? storageService.get('today_study_time', 0) : 0;
  const studyRecord = storageService.get('study_record', {});
  historicalCount.value = Number(studyRecord.totalAnswered || 0);
  loadDailyStudyRecords();
}

/** 加载每日学习记录 */
function loadDailyStudyRecords() {
  try {
    // 尝试从本地存储获取每日学习记录
    const dailyRecords = storageService.get('daily_study_records', {});

    // 如果没有历史记录，仅显示今日数据（不注入虚假历史）
    if (Object.keys(dailyRecords).length === 0) {
      // 添加今日数据
      const today = new Date().toISOString().split('T')[0];
      if (studyTime.value > 0) {
        dailyRecords[today] = studyTime.value;
      }
    }

    // 确保今日数据是最新的
    const today = new Date().toISOString().split('T')[0];
    if (studyTime.value > 0) {
      dailyRecords[today] = studyTime.value;
    }

    studyRecordData.value = dailyRecords;

    logger.log('[StudyDetail] 加载每日学习记录:', Object.keys(dailyRecords).length + '天');
  } catch (error) {
    logger.error('[StudyDetail] 加载每日学习记录失败:', error);
    studyRecordData.value = {};
  }
}

/** 处理热力图日期点击 */
function handleDayTap(day) {
  logger.log('[StudyDetail] 点击日期:', day);
  if (day.minutes > 0) {
    toast.info(`${day.dateStr} 学习 ${day.minutes} 分钟`);
  }
}

/** 处理趋势图时间范围变化 */
function handleRangeChange(range) {
  logger.log('[StudyDetail] 切换时间范围:', range + '天');
}
</script>

<style lang="scss" scoped>
/* 页面容器 */
.study-detail-page {
  min-height: 100%;
  min-height: 100vh;
  background: var(--background);
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
  border-bottom: 0;
  @include em-mobile-topbar;
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
  color: var(--text-primary);
}

.navbar-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
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
  background: var(--bg-card);
  transition: all 0.3s ease;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
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
  height: 100%;
  height: 100vh;
}

/* 页面标题 */
.page-header {
  padding: 48rpx 32rpx 32rpx;
}

.page-title {
  display: block;
  font-size: 48rpx;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 16rpx;
}

.page-subtitle {
  display: block;
  font-size: 28rpx;
  color: var(--text-secondary);
}

/* AI 学习洞察卡片 */
.ai-insight-card {
  margin: 0 32rpx 24rpx;
  padding: 28rpx;

  border-radius: 24px;

  background: var(--yozi-reading);

  border: 0;

  box-shadow: var(--yozi-shadow);
  position: relative;
  overflow: hidden;
}

.ai-insight-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4rpx;
  background: linear-gradient(90deg, #58cc02, var(--info), var(--purple-light, #ce82ff));
}

.insight-header {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.insight-icon {
  color: #58cc02;
  margin-right: 8rpx;
}

.insight-label {
  font-size: 24rpx;
  font-weight: 700;
  color: #58cc02;
}

.insight-text {
  font-size: 28rpx;
  line-height: 1.6;
  color: var(--text-primary);
  display: block;
}

.insight-weak {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid var(--border, #e5e7eb);
}

.insight-weak-label {
  font-size: 24rpx;
  color: var(--text-sub, #64748b);
  margin-bottom: 8rpx;
  display: block;
}

.insight-tags {
  display: flex;
  flex-wrap: wrap;
}

.insight-tag {
  font-size: 24rpx;
  padding: 6rpx 16rpx;
  border-radius: 14rpx;
  background: color-mix(in srgb, var(--danger) 10%, transparent);
  color: var(--danger);
  margin-right: 10rpx;
  margin-bottom: 8rpx;
  font-weight: 500;
}

/* 概况卡片 */
.overview-cards {
  display: flex;
  flex-direction: column;
  /* gap: 24rpx; -- replaced for Android WebView compat */
  padding: 0 32rpx 32rpx;
}

.stat-card + .stat-card {
  margin-top: 24rpx;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 32rpx;

  background: var(--yozi-reading);

  border: 0;

  border-radius: 24px;

  box-shadow: var(--yozi-shadow);
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
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
  font-weight: 800;
  color: #58cc02;
  margin-bottom: 8rpx;
}

.stat-label {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  font-weight: 600;
}

/* 热力图区域 */
.heatmap-section,
.chart-section,
.radar-section {
  padding: 32rpx;
}

.section-header {
  margin-bottom: 24rpx;
}

.section-title {
  display: block;
  font-size: 24rpx;
  font-weight: 800;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-primary);
  margin-bottom: 8rpx;
}

.section-subtitle {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
}

.heatmap-container,
.chart-container,
.radar-container {
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 28rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
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
  /* gap: 24rpx; -- replaced for Android WebView compat */
  margin-bottom: 32rpx;
}

.skeleton-card + .skeleton-card {
  margin-top: 24rpx;
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

/* 空状态样式 */
.empty-state-container {
  padding: 0 30rpx;
}

.empty-state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
  margin-top: 40rpx;

  background: var(--yozi-reading);

  border-radius: 24px;

  border: 0;

  box-shadow: var(--yozi-shadow);
}

.empty-state-card .empty-icon {
  font-size: 120rpx;
  margin-bottom: 24rpx;
}

/* 空状态插图 */
.empty-illustration {
  width: 320rpx;
  height: 260rpx;
  margin-bottom: 24rpx;
}

.empty-state-card .empty-title {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 16rpx;
}

.empty-state-card .empty-desc {
  font-size: 28rpx;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.6;
  margin-bottom: 40rpx;
  max-width: 500rpx;
}

.empty-action-btn {
  border: none;

  padding: 20rpx 60rpx;
  font-size: 30rpx;
  font-weight: 700;

  @include em-mobile-primary-action;
}

.empty-action-btn::after {
  border: none;
}
</style>
