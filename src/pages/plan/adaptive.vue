<template>
  <view class="adaptive-container" :class="{ 'dark-mode': isDark }">
    <view class="aurora-bg" />

    <view class="top-nav apple-glass" :style="{ paddingTop: statusBarHeight + 'px' }">
      <text class="nav-back-arrow" @tap="goBack">
        <BaseIcon name="arrow-left" :size="36" />
      </text>
      <text class="nav-title">自适应计划</text>
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
          <text class="hero-title">{{ planData.summary || '个性化学习计划' }}</text>
          <text class="hero-sub">{{ planData.description || 'AI 根据你的掌握度动态调整' }}</text>
          <view v-if="phases.length" class="phase-badges">
            <view v-for="phase in phases" :key="phase.name" class="phase-badge" :class="'phase-' + phase.type">
              <text class="phase-text">{{ phase.name }}</text>
            </view>
          </view>
        </view>

        <!-- 阶段时间线 -->
        <view v-if="phases.length" class="section">
          <text class="section-title">学习阶段</text>
          <view class="timeline">
            <view v-for="(phase, idx) in phases" :key="phase.name" class="timeline-item">
              <view class="timeline-dot-col">
                <view class="timeline-dot" :class="'dot-phase-' + phase.type" />
                <view v-if="idx < phases.length - 1" class="timeline-line" />
              </view>
              <view class="timeline-content apple-glass-card">
                <view class="timeline-header">
                  <text class="timeline-name">{{ phase.name }}</text>
                  <view class="phase-type-badge" :class="'phase-' + phase.type">
                    <text class="phase-type-text">{{ phaseLabel(phase.type) }}</text>
                  </view>
                </view>
                <text class="timeline-date">{{ phase.startDate }} — {{ phase.endDate }}</text>
                <text v-if="phase.description" class="timeline-desc">{{ phase.description }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 每日计划 -->
        <view v-if="dailyPlans.length" class="section">
          <text class="section-title">每日任务</text>
          <view
            v-for="(day, dIdx) in dailyPlans"
            :key="day.date"
            class="day-card apple-glass-card"
            :style="{ animationDelay: dIdx * 0.06 + 's' }"
          >
            <text class="day-date">{{ day.date }}</text>
            <view v-for="(task, tIdx) in day.tasks" :key="task.knowledgePoint + tIdx" class="task-item">
              <view class="task-header">
                <text class="task-kp">{{ task.knowledgePoint }}</text>
                <view class="action-badge" :class="'action-' + task.action">
                  <text class="action-text">{{ actionLabel(task.action) }}</text>
                </view>
              </view>
              <view class="task-meta">
                <text v-if="task.duration" class="meta-text">{{ task.duration }}分钟</text>
                <text v-if="task.questionCount" class="meta-text">{{ task.questionCount }}题</text>
              </view>
              <WdButton
                size="small"
                type="primary"
                custom-style="margin-top: 16rpx; border-radius: 999rpx;"
                @click="startTask(task)"
              >
                开始学习
              </WdButton>
            </view>
          </view>
        </view>

        <!-- 空状态 -->
        <view v-if="!planData.summary && dailyPlans.length === 0" class="empty-state">
          <!-- 卡通图标替代装饰性 BaseIcon -->
          <image class="hero-cartoon-icon" src="./static/icons/notebook-pen.png" mode="aspectFit" alt="笔记本与笔" />
          <text class="empty-title">暂无自适应计划</text>
          <text class="empty-sub">请先设置考试日期和每日学习时长</text>
          <WdButton type="primary" custom-style="margin-top: 40rpx; border-radius: 999rpx;" @click="generatePlan">
            生成计划
          </WdButton>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
// wot-design-uni 组件（显式导入，分包优化）
import WdButton from 'wot-design-uni/components/wd-button/wd-button.vue';

import { ref, onMounted } from 'vue';
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

const planData = ref({});
const phases = ref([]);
const dailyPlans = ref([]);

function phaseLabel(type) {
  const map = { foundation: '基础', intensive: '强化', sprint: '冲刺' };
  return map[type] || type;
}

function actionLabel(action) {
  const map = { new_learn: '新学', review: '复习', drill: '刷题', mock: '模考' };
  return map[action] || action;
}

function getExamDate() {
  try {
    return uni.getStorageSync('exam_date') || '';
  } catch {
    return '';
  }
}

function getDailyHours() {
  try {
    return Number(uni.getStorageSync('daily_study_hours')) || 4;
  } catch {
    return 4;
  }
}

async function loadData() {
  loading.value = true;
  try {
    const examDate = getExamDate();
    const dailyHours = getDailyHours();
    if (!examDate) {
      loading.value = false;
      return;
    }

    const result = await studyEngineStore.generateStudyPlan(examDate, dailyHours);
    if (result.success && result.data) {
      planData.value = result.data;
      phases.value = result.data.phases || [];
      dailyPlans.value = (result.data.dailyPlans || []).slice(0, 7);
    }
  } catch (e) {
    logger.warn('[AdaptivePlan] 加载失败:', e);
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

function generatePlan() {
  loadData();
}

function startTask(task) {
  safeNavigateTo('/pages/practice-sub/do-quiz', {
    mode: 'adaptive',
    knowledgePoint: task.knowledgePoint,
    action: task.action
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
.adaptive-container {
  min-height: 100vh;
  background: var(--background);
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  position: relative;
  --red: var(--danger, #ff453a);
  --orange: var(--warning, #ff9f0a);
  --blue: var(--em-info, #32ade6);
  --green: #58cc02;
}
.adaptive-container.dark-mode {
  background: linear-gradient(180deg, var(--background) 0%, var(--page-gradient-mid) 50%, var(--background) 100%);
}
.aurora-bg {
  position: absolute;
  top: -120rpx;
  left: -80rpx;
  width: 100%;
  height: 620rpx;
  background:
    radial-gradient(circle at 18% 24%, color-mix(in srgb, var(--success) 22%, transparent) 0%, transparent 40%),
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
  font-weight: 800;
  color: var(--text-primary);
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
  background: var(--bg-card);
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  -webkit-backdrop-filter: blur(20rpx);
  backdrop-filter: blur(20rpx);
}
.dark-mode .apple-glass-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

/* Hero */
.hero-card {
  padding: 40rpx;
}
.hero-title {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
}
.hero-sub {
  font-size: 26rpx;
  color: var(--text-secondary);
  display: block;
  margin-top: 12rpx;
  line-height: 1.5;
}
.phase-badges {
  display: flex;
  /* gap: 12rpx; -- replaced for MP WebView compat */
  margin-top: 24rpx;
  flex-wrap: wrap;
}
.phase-badge {
  padding: 6rpx 18rpx;
  border-radius: 16rpx;
}
.phase-foundation {
  background: rgba(50, 173, 230, 0.12);
}
.phase-intensive {
  background: color-mix(in srgb, var(--warning) 12%, transparent);
}
.phase-sprint {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}
.phase-text {
  font-size: 22rpx;
  font-weight: 600;
}
.phase-foundation .phase-text {
  color: var(--blue);
}
.phase-intensive .phase-text {
  color: var(--orange);
}
.phase-sprint .phase-text {
  color: var(--red);
}

/* Section */
.section {
  margin-top: 40rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
  margin-bottom: 20rpx;
}

/* 时间线 */
.timeline {
  padding-left: 8rpx;
}
.timeline-item {
  display: flex;
  /* gap: 20rpx; -- replaced for MP WebView compat */
  margin-bottom: 0;
}
.timeline-dot-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 24rpx;
  flex-shrink: 0;
}
.timeline-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  margin-top: 36rpx;
}
.dot-phase-foundation {
  background: var(--blue);
}
.dot-phase-intensive {
  background: var(--orange);
}
.dot-phase-sprint {
  background: var(--red);
  box-shadow: 0 0 12rpx rgba(255, 69, 58, 0.4);
}
.timeline-line {
  width: 2rpx;
  flex: 1;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.08));
}
.dark-mode .timeline-line {
  background: rgba(255, 255, 255, 0.08);
}
.timeline-content {
  flex: 1;
  padding: 24rpx;
}
.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.timeline-name {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.phase-type-badge {
  padding: 4rpx 14rpx;
  border-radius: 12rpx;
}
.phase-type-text {
  font-size: 20rpx;
  font-weight: 600;
}
.phase-foundation .phase-type-text {
  color: var(--blue);
}
.phase-intensive .phase-type-text {
  color: var(--orange);
}
.phase-sprint .phase-type-text {
  color: var(--red);
}
.timeline-date {
  font-size: 22rpx;
  color: var(--text-secondary);
  display: block;
}
.timeline-desc {
  font-size: 24rpx;
  color: var(--text-secondary);
  display: block;
  margin-top: 8rpx;
  line-height: 1.5;
}

/* 每日卡片 */
.day-card {
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
.day-date {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-primary);
  display: block;
  margin-bottom: 20rpx;
}
.task-item {
  padding: 20rpx 0;
  border-top: 1rpx solid var(--apple-glass-border-strong, rgba(0, 0, 0, 0.04));
}
.task-item:first-child {
  border-top: none;
  padding-top: 0;
}
.task-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.task-kp {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-primary);
  flex: 1;
}
.action-badge {
  padding: 4rpx 14rpx;
  border-radius: 12rpx;
}
.action-new_learn {
  background: color-mix(in srgb, var(--success) 12%, transparent);
}
.action-review {
  background: rgba(50, 173, 230, 0.12);
}
.action-drill {
  background: color-mix(in srgb, var(--warning) 12%, transparent);
}
.action-mock {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
}
.action-text {
  font-size: 20rpx;
  font-weight: 600;
}
.action-new_learn .action-text {
  color: var(--green);
}
.action-review .action-text {
  color: var(--blue);
}
.action-drill .action-text {
  color: var(--orange);
}
.action-mock .action-text {
  color: var(--red);
}
.task-meta {
  display: flex;
  /* gap: 16rpx; -- replaced for MP WebView compat */
}
.meta-text {
  font-size: 22rpx;
  color: var(--text-secondary);
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}
/* 英雄级卡通图标（替代 BaseIcon size>=80） */
.hero-cartoon-icon {
  width: 160rpx;
  height: 160rpx;
}
.empty-icon {
  font-size: 96rpx;
}
.empty-title {
  font-size: 34rpx;
  font-weight: 800;
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
