<template>
  <view class="error-clusters-container" :class="{ 'dark-mode': isDark }">
    <view class="aurora-bg" />

    <view class="top-nav apple-glass" :style="{ paddingTop: statusBarHeight + 'px' }">
      <text class="nav-back-arrow" @tap="goBack">
        <BaseIcon name="arrow-left" :size="36" />
      </text>
      <text class="nav-title">错题聚类分析</text>
      <view class="nav-right" />
    </view>

    <scroll-view
      class="main-scroll"
      scroll-y
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- 加载骨架 -->
      <view v-if="loading" class="loading-state">
        <view class="skeleton-card" />
        <view class="skeleton-card short" />
        <view class="skeleton-card short" />
      </view>

      <view v-else>
        <!-- Hero 总览 -->
        <view class="hero-card apple-glass-card">
          <view class="hero-left">
            <text class="hero-num">{{ totalMistakes }}</text>
            <text class="hero-label">累计错题</text>
          </view>
          <view class="hero-right">
            <text class="hero-title">错题模式分析</text>
            <text class="hero-sub">AI 识别出 {{ clusters.length }} 种错误聚类</text>
            <view v-if="topErrorType" class="hero-tag">
              <view class="tag-dot dot-red" />
              <text class="tag-text">Top: {{ topErrorType }}</text>
            </view>
          </view>
        </view>

        <!-- 按严重度分组 -->
        <view v-for="group in severityGroups" :key="group.key" class="section">
          <view class="section-header">
            <view class="section-dot" :class="'dot-' + group.key" />
            <text class="section-title">{{ group.label }}</text>
            <text class="section-badge" :class="'badge-' + group.key">{{ group.items.length }}</text>
          </view>

          <view
            v-for="(cluster, idx) in group.items"
            :key="cluster.errorType + idx"
            class="cluster-card apple-glass-card"
            :class="'accent-' + group.key"
            :style="{ animationDelay: idx * 0.08 + 's' }"
          >
            <view class="cluster-header">
              <text class="cluster-name">{{ cluster.errorTypeName }}</text>
              <text class="cluster-trend" :class="'trend-' + trendDir(cluster.trend)">
                <BaseIcon :name="trendArrow(cluster.trend)" :size="28" />
              </text>
            </view>
            <view class="cluster-meta">
              <text class="cluster-count">{{ cluster.questionCount }} 题</text>
            </view>
            <view v-if="cluster.knowledgePoints && cluster.knowledgePoints.length" class="kp-tags">
              <text v-for="kp in cluster.knowledgePoints.slice(0, 4)" :key="kp" class="kp-tag">{{ kp }}</text>
            </view>
            <text v-if="cluster.suggestion" class="cluster-suggestion">{{ cluster.suggestion }}</text>
            <WdButton
              size="small"
              plain
              custom-style="margin-top: 20rpx; border-radius: 999rpx;"
              @click="goQuiz(cluster)"
            >
              查看同类题
            </WdButton>
          </view>
        </view>

        <!-- 空状态 -->
        <view v-if="clusters.length === 0" class="empty-state">
          <BaseIcon name="sparkle" :size="96" />
          <text class="empty-title">暂无错题聚类</text>
          <text class="empty-sub">多做几套题后，AI 会自动分析错题模式</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
// wot-design-uni 组件（显式导入，分包优化）
import WdButton from 'wot-design-uni/components/wd-button/wd-button.vue';

import { ref, computed, onMounted } from 'vue';
import { toast } from '@/utils/toast.js';
import { safeNavigateBack, safeNavigateTo } from '@/utils/safe-navigate';
import { useStudyEngineStore } from '@/stores/modules/study-engine';
import { initTheme } from '@/composables/useTheme.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

const isDark = ref(initTheme());
const studyEngineStore = useStudyEngineStore();
const loading = ref(true);
const isRefreshing = ref(false);
const statusBarHeight = ref(0);
const clusters = ref([]);
const totalMistakes = ref(0);

const topErrorType = computed(() => {
  if (!clusters.value.length) return '';
  return clusters.value.reduce((a, b) => (a.questionCount > b.questionCount ? a : b)).errorTypeName;
});

const severityGroups = computed(() => {
  const groups = [
    { key: 'high', label: '高频错误', items: [] },
    { key: 'medium', label: '中频错误', items: [] },
    { key: 'low', label: '低频错误', items: [] }
  ];
  const map = { high: 0, medium: 1, low: 2 };
  clusters.value.forEach((c) => {
    const idx = map[c.severity] ?? 2;
    groups[idx].items.push(c);
  });
  return groups.filter((g) => g.items.length > 0);
});

function trendDir(trend) {
  if (trend === 'up') return 'up';
  if (trend === 'down') return 'down';
  return 'flat';
}
function trendArrow(trend) {
  return trend === 'up' ? 'trend-up' : trend === 'down' ? 'trend-down' : 'arrow-right';
}

async function loadData() {
  loading.value = true;
  try {
    const result = await studyEngineStore.getErrorClusters();
    if (result.success && result.data) {
      clusters.value = result.data.clusters || [];
      totalMistakes.value = result.data.totalMistakes || 0;
    }
  } catch (e) {
    logger.warn('[ErrorClusters] 加载失败:', e);
    toast.info('加载失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}

async function onRefresh() {
  isRefreshing.value = true;
  await loadData();
  isRefreshing.value = false;
}

function goQuiz(cluster) {
  safeNavigateTo('/pages/practice-sub/do-quiz', {
    mode: 'error_cluster',
    errorType: cluster.errorType || cluster.errorTypeName
  });
}

function goBack() {
  safeNavigateBack();
}

onMounted(() => {
  statusBarHeight.value = getStatusBarHeight();
  loadData();
});
</script>

<style scoped>
.error-clusters-container {
  min-height: 100vh;
  background: var(--bg-page, linear-gradient(180deg, #f5f5f7 0%, #eeeef0 50%, #f5f5f7 100%));
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  position: relative;
  --red: var(--danger, #ff453a);
  --orange: var(--warning, #ff9f0a);
  --blue: var(--em-info, #32ade6);
  --green: var(--success, #34c759);
}
.error-clusters-container.dark-mode {
  background: linear-gradient(180deg, var(--background) 0%, var(--page-gradient-mid) 50%, var(--background) 100%);
}
.aurora-bg {
  position: absolute;
  top: -120rpx;
  left: -80rpx;
  width: 100%;
  height: 620rpx;
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 69, 58, 0.2) 0%, transparent 40%),
    radial-gradient(circle at 80% 10%, rgba(255, 255, 255, 0.3) 0%, transparent 28%);
  filter: blur(70px);
  opacity: 0.9;
  z-index: 0;
}
.dark-mode .aurora-bg {
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 69, 58, 0.12) 0%, transparent 42%),
    radial-gradient(circle at 80% 10%, rgba(100, 160, 255, 0.1) 0%, transparent 30%);
}
.top-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 16rpx 32rpx;
  -webkit-backdrop-filter: saturate(180%) blur(40rpx);
  backdrop-filter: saturate(180%) blur(40rpx);
  background: var(--apple-glass-nav-bg, rgba(245, 245, 247, 0.72));
  border-bottom: 1rpx solid var(--apple-glass-border-strong, rgba(0, 0, 0, 0.06));
}
.dark-mode .top-nav {
  background: rgba(10, 10, 15, 0.72);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
.nav-back-arrow {
  font-size: 36rpx;
  color: var(--text-main, #1a1a1a);
  padding: 20rpx;
}
.nav-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary, #1c1c1e);
}
.nav-right {
  width: 48rpx;
}
.main-scroll {
  padding: 160rpx 32rpx 80rpx;
  position: relative;
  z-index: 1;
}

/* 骨架 */
.loading-state {
  padding-top: 40rpx;
}
.skeleton-card {
  height: 200rpx;
  border-radius: 32rpx;
  margin-bottom: 24rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
  animation: pulse 1.5s ease-in-out infinite;
}
.skeleton-card.short {
  height: 140rpx;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.8;
  }
}

/* Hero */
.apple-glass-card {
  background: var(--apple-glass-card-bg, rgba(255, 255, 255, 0.72));
  border-radius: 32rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border: 1rpx solid var(--apple-glass-border-strong, rgba(0, 0, 0, 0.06));
  -webkit-backdrop-filter: blur(20rpx);
  backdrop-filter: blur(20rpx);
}
.dark-mode .apple-glass-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}
.hero-card {
  display: flex;
  align-items: center;
  /* gap: 32rpx; -- replaced for MP WebView compat */
  padding: 40rpx;
}
.hero-left {
  flex-shrink: 0;
  text-align: center;
}
.hero-num {
  font-size: 64rpx;
  font-weight: 700;
  color: var(--red);
  font-variant-numeric: tabular-nums;
  display: block;
}
.hero-label {
  font-size: 22rpx;
  color: var(--text-secondary, #8e8e93);
  display: block;
  margin-top: 4rpx;
}
.hero-right {
  flex: 1;
}
.hero-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary, #1c1c1e);
  display: block;
}
.hero-sub {
  font-size: 24rpx;
  color: var(--text-secondary);
  display: block;
  margin-top: 8rpx;
}
.hero-tag {
  display: inline-flex;
  align-items: center;
  /* gap: 8rpx; -- replaced for MP WebView compat */
  margin-top: 16rpx;
  padding: 6rpx 16rpx;
  border-radius: 16rpx;
  background: rgba(255, 69, 58, 0.1);
}
.tag-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}
.dot-red {
  background: var(--red);
}
.tag-text {
  font-size: 22rpx;
  color: var(--red);
}

/* 分组 */
.section {
  margin-top: 40rpx;
}
.section-header {
  display: flex;
  align-items: center;
  /* gap: 16rpx; -- replaced for MP WebView compat */
  margin-bottom: 16rpx;
}
.section-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
}
.dot-high {
  background: var(--red);
  box-shadow: 0 0 12rpx rgba(255, 69, 58, 0.4);
}
.dot-medium {
  background: var(--orange);
}
.dot-low {
  background: var(--blue);
}
.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}
.section-badge {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
  font-weight: 600;
}
.badge-high {
  background: rgba(255, 69, 58, 0.12);
  color: var(--red);
}
.badge-medium {
  background: rgba(255, 159, 10, 0.12);
  color: var(--orange);
}
.badge-low {
  background: rgba(50, 173, 230, 0.12);
  color: var(--blue);
}

/* 聚类卡片 */
.cluster-card {
  padding: 28rpx;
  animation: fadeSlideIn 0.3s ease-out both;
}
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateX(-16rpx);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.accent-high {
  border-left: 6rpx solid var(--red);
}
.accent-medium {
  border-left: 6rpx solid var(--orange);
}
.accent-low {
  border-left: 6rpx solid var(--blue);
}
.cluster-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.cluster-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}
.cluster-trend {
  font-size: 28rpx;
  font-weight: 700;
}
.trend-up {
  color: var(--red);
}
.trend-down {
  color: var(--green);
}
.trend-flat {
  color: var(--text-secondary);
}
.cluster-meta {
  margin-bottom: 12rpx;
}
.cluster-count {
  font-size: 24rpx;
  color: var(--text-secondary);
}
.kp-tags {
  display: flex;
  flex-wrap: wrap;
  /* gap: 12rpx; -- replaced for MP WebView compat */
  margin-bottom: 12rpx;
}
.kp-tag {
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 12rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
  color: var(--text-secondary);
}
.dark-mode .kp-tag {
  background: rgba(255, 255, 255, 0.06);
}
.cluster-suggestion {
  font-size: 24rpx;
  color: var(--green);
  line-height: 1.5;
  display: block;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}
.empty-icon {
  font-size: 96rpx;
}
.empty-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 32rpx;
}
.empty-sub {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-top: 16rpx;
}
</style>
