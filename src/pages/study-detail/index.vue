<template>
  <LearningShell v-if="!showLegacy" class="yozi-page" active="study-detail" :title="$t('pages.stats')">
    <template #controls>
      <BaseButton class="quiet-button" variant="secondary" @tap="toggleLegacy">{{ t('study.copy0') }}</BaseButton>
    </template>
    <LearningOverview :initial-expanded="true" :show-navigation="false" view="study-detail" />
  </LearningShell>
  <view v-else class="yozi-page" :style="$yoziInsets" :class="['study-detail-page', themeClass]">
    <!-- 透明导航栏 -->
    <view class="transparent-navbar" :class="{ 'navbar-solid': scrolled }">
      <view class="navbar-content">
        <BaseButton class="navbar-left" variant="secondary" @tap="goBack"
          ><text class="back-icon"> <BaseIcon name="arrow-left" /> </text
        ></BaseButton>
        <text class="navbar-title" :class="{ 'title-visible': scrolled }">{{ $t('pages.stats') }}</text>
        <view class="navbar-right">
          <!-- 主题切换按钮 -->
          <BaseButton class="theme-toggle" :label="$t('ui.toggleTheme')" variant="secondary" @tap="toggleTheme"
            ><BaseIcon :name="isDark ? 'sun' : 'moon'"
          /></BaseButton>
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
      <BaseButton class="quiet-button" variant="secondary" @tap="toggleLegacy">{{
        showLegacy ? t('study.copy1') : t('study.copy0')
      }}</BaseButton>
      <template v-if="showLegacy">
        <!-- 骨架屏加载状态 -->
        <BaseEmpty v-if="isLoading" state="loading" :is-dark="isDark" />

        <!-- 实际内容 -->
        <template v-else>
          <!-- 空状态：新用户无学习记录 -->
          <view
            v-if="studyTime === 0 && historicalCount === 0 && legacySummary.answeredCount === 0"
            class="empty-state-container"
          >
            <view class="page-header">
              <text class="page-title">{{ $t('pages.stats') }}</text>
            </view>
            <BaseEmpty
              state="empty"
              :title="t('study.copy2')"
              show-button
              :button-text="t('pages.practice')"
              @action="goToPractice"
            />
          </view>

          <!-- 有数据时展示完整内容 -->
          <template v-else>
            <!-- 页面标题 -->
            <view class="page-header">
              <text class="page-title">{{ $t('pages.stats') }}</text>
            </view>

            <view class="ai-insight-card">
              <text>{{ t('study.copy3') }}</text>
              <text v-if="legacySummary.legacyGradedCount">{{
                t('study.copy4', {
                  v0: legacySummary.legacyCorrectCount,
                  v1: legacySummary.legacyGradedCount,
                  v2: legacySummary.legacyAccuracy
                })
              }}</text>
              <text v-else>{{ t('study.copy5') }}</text>
              <text v-if="legacySummary.pendingCount">{{ t('study.copy6', { v0: legacySummary.pendingCount }) }}</text>
              <text v-if="legacySummary.unclassifiedCount">{{
                t('study.copy7', { v0: legacySummary.unclassifiedCount })
              }}</text>
            </view>

            <!-- 学习概况卡片 -->
            <view class="overview-cards">
              <!-- 学习时长卡片 -->
              <BaseStat :label="t('study.copy8')" :value="Number(studyTime) || 0" />

              <!-- 已记录的自评复习 -->
              <BaseStat :label="t('study.copy9')" :value="Number(legacySummary.reviewedCount) || 0" />

              <!-- 历史累计数量 -->
              <BaseStat :label="t('study.copy10')" :value="Number(historicalCount) || 0" />
            </view>

            <!-- 学习热力图 -->
            <view class="heatmap-section">
              <view class="section-header">
                <text class="section-title">{{ t('study.copy11') }}</text>
              </view>

              <view class="heatmap-container">
                <StudyHeatmap :study-data="studyRecordData" :weeks="26" @day-tap="handleDayTap" />
              </view>
            </view>

            <!-- FSRS 记忆模型优化 -->
            <view class="fsrs-section">
              <view class="section-header">
                <text class="section-title">{{ t('study.copy12') }}</text>
              </view>
              <FSRSOptimizer />
            </view>

            <!-- 学习趋势图表 -->
            <view class="chart-section">
              <view class="section-header">
                <text class="section-title">{{ t('study.copy13') }}</text>
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
import BaseStat from '@/components/base/base-stat/base-stat.vue';
import '@/pages/study-detail/messages.js';
import { t } from '@/i18n/index.js';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import '@/styles/yozi-pages.scss';

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
const isDark = computed(() => useThemeStore().isDark);
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
  void 0;

  // 监听主题变化
  _themeHandler = (_mode) => {
    void 0;
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
    toast.error(t('study.copy14'));
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
    toast.info(t('study.copy15', { v0: day.dateStr, v1: day.minutes }));
  }
}

/** 处理趋势图时间范围变化 */
function handleRangeChange(range) {
  logger.log('[StudyDetail] 切换时间范围:', range + '天');
}
</script>
