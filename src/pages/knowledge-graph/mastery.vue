<template>
  <view class="mastery-container" :class="{ 'dark-mode': isDark }">
    <view class="aurora-bg" />

    <view class="top-nav apple-glass" :style="{ paddingTop: statusBarHeight + 'px' }">
      <text class="nav-back-arrow" @tap="goBack">
        <BaseIcon name="arrow-left" :size="36" />
      </text>
      <text class="nav-title">掌握度总览</text>
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
            <view class="ring-wrap">
              <WdCircle
                :model-value="avgMastery"
                :size="90"
                :stroke-width="7"
                :color="masteryColor(avgMastery)"
                layer-color="rgba(255,255,255,0.06)"
                :speed="80"
              >
                <view class="ring-inner">
                  <text class="ring-num">{{ avgMastery }}</text>
                  <text class="ring-label">%</text>
                </view>
              </WdCircle>
            </view>
          </view>
          <view class="hero-right">
            <text class="hero-title">平均掌握度</text>
            <view class="hero-stats">
              <view class="stat-item">
                <text class="stat-num danger-text">{{ weakCount }}</text>
                <text class="stat-label">薄弱</text>
              </view>
              <view class="stat-divider" />
              <view class="stat-item">
                <text class="stat-num success-text">{{ masteredCount }}</text>
                <text class="stat-label">已掌握</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 按学科分组 -->
        <view v-for="group in subjectGroups" :key="group.subject" class="section">
          <view class="section-header">
            <text class="section-title">{{ group.subject }}</text>
            <text class="section-avg">均值 {{ group.avgMastery }}%</text>
          </view>

          <view
            v-for="(kp, idx) in group.items"
            :key="kp.name + idx"
            class="kp-card apple-glass-card"
            :style="{ animationDelay: idx * 0.06 + 's' }"
          >
            <view class="kp-header">
              <view class="kp-info">
                <text class="kp-name">{{ kp.name }}</text>
                <view class="kp-indicators">
                  <view v-if="kp.trend" class="trend-badge" :class="'trend-' + kp.trend">
                    <text class="trend-text">{{ trendLabel(kp.trend) }}</text>
                  </view>
                  <view v-if="kp.prerequisitesMet === false" class="prereq-badge">
                    <text class="prereq-text">前置未达标</text>
                  </view>
                </view>
              </view>
              <view class="kp-ring">
                <WdCircle
                  :model-value="kp.mastery || 0"
                  :size="48"
                  :stroke-width="4"
                  :color="masteryColor(kp.mastery || 0)"
                  layer-color="rgba(255,255,255,0.06)"
                  :speed="60"
                >
                  <text class="kp-ring-num">{{ kp.mastery || 0 }}</text>
                </WdCircle>
              </view>
            </view>

            <view class="kp-meta">
              <text v-if="kp.accuracy != null" class="meta-text">正确率 {{ kp.accuracy }}%</text>
              <text v-if="kp.retrievability != null" class="meta-text">可检索性 {{ kp.retrievability }}%</text>
            </view>

            <WdButton
              v-if="(kp.mastery || 0) < 60"
              size="small"
              type="primary"
              custom-style="margin-top: 16rpx; border-radius: 999rpx;"
              @click="targetDrill(kp)"
            >
              定向突破
            </WdButton>
          </view>
        </view>

        <!-- 空状态 -->
        <view v-if="knowledgePoints.length === 0" class="empty-state">
          <BaseIcon name="chart-bar" :size="96" />
          <text class="empty-title">暂无掌握度数据</text>
          <text class="empty-sub">开始做题后 AI 将自动分析各知识点掌握度</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
// wot-design-uni 组件（显式导入，分包优化）
import WdCircle from 'wot-design-uni/components/wd-circle/wd-circle.vue';
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

const avgMastery = ref(0);
const weakCount = ref(0);
const masteredCount = ref(0);
const knowledgePoints = ref([]);

const subjectGroups = computed(() => {
  const map = {};
  knowledgePoints.value.forEach((kp) => {
    const subject = kp.subject || '其他';
    if (!map[subject]) map[subject] = { subject, items: [], totalMastery: 0 };
    map[subject].items.push(kp);
    map[subject].totalMastery += kp.mastery || 0;
  });
  return Object.values(map).map((g) => ({
    ...g,
    avgMastery: g.items.length ? Math.round(g.totalMastery / g.items.length) : 0
  }));
});

function masteryColor(val) {
  if (val >= 80) return '#34c759';
  if (val >= 50) return '#ff9f0a';
  return '#ff453a';
}

function trendLabel(trend) {
  const map = { up: '上升', down: '下降', stable: '稳定' };
  return map[trend] || trend;
}

async function loadData() {
  loading.value = true;
  try {
    const result = await studyEngineStore.analyzeMastery();
    if (result.success && result.data) {
      avgMastery.value = result.data.avgMastery || 0;
      weakCount.value = result.data.weakCount || 0;
      masteredCount.value = result.data.masteredCount || 0;
      knowledgePoints.value = result.data.knowledgePoints || [];
    }
  } catch (e) {
    logger.warn('[Mastery] 加载失败:', e);
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

function targetDrill(kp) {
  safeNavigateTo('/pages/practice-sub/do-quiz', {
    mode: 'target_drill',
    knowledgePoint: kp.name
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
.mastery-container {
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
.mastery-container.dark-mode {
  background: linear-gradient(180deg, var(--background) 0%, var(--page-gradient-mid) 50%, var(--background) 100%);
}
.aurora-bg {
  position: absolute;
  top: -120rpx;
  left: -80rpx;
  width: 100%;
  height: 620rpx;
  background:
    radial-gradient(circle at 18% 24%, rgba(52, 199, 89, 0.22) 0%, transparent 40%),
    radial-gradient(circle at 82% 10%, rgba(255, 255, 255, 0.32) 0%, transparent 28%);
  filter: blur(70px);
  opacity: 0.9;
  z-index: 0;
}
.dark-mode .aurora-bg {
  background:
    radial-gradient(circle at 18% 24%, rgba(52, 199, 89, 0.12) 0%, transparent 42%),
    radial-gradient(circle at 82% 10%, rgba(100, 160, 255, 0.1) 0%, transparent 30%);
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

/* 玻璃卡片 */
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

/* Hero */
.hero-card {
  display: flex;
  align-items: center;
  /* gap: 32rpx; -- replaced for MP WebView compat */
  padding: 40rpx;
}
.hero-left {
  flex-shrink: 0;
}
.ring-wrap {
  position: relative;
  width: 180rpx;
  height: 180rpx;
}
.ring-inner {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.ring-num {
  font-size: 52rpx;
  font-weight: 700;
  color: var(--text-primary, #1c1c1e);
  font-variant-numeric: tabular-nums;
}
.ring-label {
  font-size: 20rpx;
  color: var(--text-secondary, #8e8e93);
  margin-top: 2rpx;
}
.hero-right {
  flex: 1;
}
.hero-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  margin-bottom: 16rpx;
}
.hero-stats {
  display: flex;
  align-items: center;
  /* gap: 24rpx; -- replaced for MP WebView compat */
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.stat-num {
  font-size: 40rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.danger-text {
  color: var(--red);
}
.success-text {
  color: var(--green);
}
.stat-label {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}
.stat-divider {
  width: 1rpx;
  height: 48rpx;
  background: var(--apple-glass-border-strong, rgba(0, 0, 0, 0.08));
}
.dark-mode .stat-divider {
  background: rgba(255, 255, 255, 0.08);
}

/* Section */
.section {
  margin-top: 40rpx;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}
.section-avg {
  font-size: 24rpx;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

/* KP Cards */
.kp-card {
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
.kp-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  /* gap: 16rpx; -- replaced for MP WebView compat */
}
.kp-info {
  flex: 1;
}
.kp-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
}
.kp-indicators {
  display: flex;
  /* gap: 12rpx; -- replaced for MP WebView compat */
  margin-top: 8rpx;
  flex-wrap: wrap;
}
.trend-badge {
  padding: 2rpx 12rpx;
  border-radius: 10rpx;
}
.trend-up {
  background: rgba(52, 199, 89, 0.12);
}
.trend-down {
  background: rgba(255, 69, 58, 0.12);
}
.trend-stable {
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
}
.dark-mode .trend-stable {
  background: rgba(255, 255, 255, 0.06);
}
.trend-text {
  font-size: 20rpx;
  font-weight: 600;
}
.trend-up .trend-text {
  color: var(--green);
}
.trend-down .trend-text {
  color: var(--red);
}
.trend-stable .trend-text {
  color: var(--text-secondary);
}
.prereq-badge {
  padding: 2rpx 12rpx;
  border-radius: 10rpx;
  background: rgba(255, 69, 58, 0.08);
}
.prereq-text {
  font-size: 20rpx;
  color: var(--red);
}

.kp-ring {
  flex-shrink: 0;
  width: 100rpx;
  height: 100rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.kp-ring-num {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.kp-meta {
  display: flex;
  /* gap: 20rpx; -- replaced for MP WebView compat */
  margin-top: 12rpx;
}
.meta-text {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
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
  text-align: center;
}
</style>
