<template>
  <view class="smart-review-container" :class="{ 'dark-mode': isDark, 'wot-theme-dark': isDark }">
    <view class="top-nav apple-glass" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="back-icon" @tap="goBack">
        <BaseIcon name="arrow-left" :size="36" />
      </view>
      <text class="nav-title">智能复习</text>
      <view class="nav-right" />
    </view>

    <scroll-view
      class="review-scroll"
      scroll-y
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- 加载中 -->
      <view v-if="loading" class="loading-state">
        <view class="loading-brain">
          <view class="brain-ring r1" />
          <view class="brain-ring r2" />
          <text class="brain-emoji">复习</text>
        </view>
        <text class="loading-text">AI 正在安排今日复习...</text>
      </view>

      <view v-else>
        <!-- 今日进度卡片（核心视觉） -->
        <view class="progress-hero apple-glass-card">
          <view class="hero-left">
            <view class="ring-wrap">
              <canvas canvas-id="reviewRing" class="review-canvas"></canvas>
              <view class="ring-inner">
                <text class="ring-num">{{ totalPending }}</text>
                <text class="ring-label">待复习</text>
              </view>
            </view>
          </view>
          <view class="hero-right">
            <view class="hero-title-row">
              <text class="hero-title">今日复习计划</text>
            </view>
            <text class="hero-sub">基于 FSRS-5 最优间隔重复算法</text>
            <view class="hero-tags">
              <view class="hero-tag tag-urgent">
                <view class="tag-dot dot-red" />
                <text class="tag-text">急需 {{ urgentCount }}</text>
              </view>
              <view class="hero-tag tag-normal">
                <view class="tag-dot dot-orange" />
                <text class="tag-text">巩固 {{ normalCount }}</text>
              </view>
              <view class="hero-tag tag-light">
                <view class="tag-dot dot-blue" />
                <text class="tag-text">复习 {{ lightCount }}</text>
              </view>
            </view>
            <!-- 连续复习天数 -->
            <view v-if="streakDays > 0" class="streak-row">
              <text class="streak-fire">连续</text>
              <text class="streak-text">已连续复习 {{ streakDays }} 天</text>
            </view>
          </view>
        </view>

        <!-- 一键开始（置顶强CTA） -->
        <view v-if="totalPending > 0" class="start-section">
          <wd-button type="primary" block size="large" @click="startBatchReview">
            开始今日复习（{{ Math.min(totalPending, 20) }} 题）
          </wd-button>
        </view>

        <!-- 急需加强 -->
        <view v-if="urgentItems.length > 0" class="section animate-in">
          <view class="section-header">
            <view class="section-dot urgent-dot" />
            <text class="section-title">急需加强</text>
            <text class="section-badge badge-red">{{ urgentCount }}</text>
          </view>
          <text class="section-hint">AI 诊断标记的高频错误知识点</text>
          <view
            v-for="(item, idx) in urgentItems"
            :key="item._id"
            class="review-card apple-glass-card urgent-card"
            :style="{ animationDelay: idx * 0.08 + 's' }"
            @tap="reviewItem(item)"
          >
            <view class="card-header">
              <text class="card-kp">{{ item.knowledge_point || item.category }}</text>
              <view class="error-badge">
                <text class="error-num">{{ item.error_count }}</text>
                <text class="error-label">次错</text>
              </view>
            </view>
            <text class="card-question">{{ truncate(item.question_content, 60) }}</text>
            <view class="card-footer">
              <text class="card-category">{{ item.category }}</text>
              <text class="card-time">{{ formatNextReview(item.next_review_at) }}</text>
            </view>
            <!-- 掌握度进度条 -->
            <view class="mastery-bar-container">
              <view
                class="mastery-bar"
                :style="{ width: (item.mastery || 10) + '%', backgroundColor: getMasteryColor(item.mastery || 10) }"
              />
            </view>
            <text class="mastery-label">记忆强度 {{ item.mastery || 10 }}%</text>
          </view>
        </view>

        <!-- 需要巩固 -->
        <view v-if="normalItems.length > 0" class="section animate-in">
          <view class="section-header">
            <view class="section-dot normal-dot" />
            <text class="section-title">需要巩固</text>
            <text class="section-badge badge-orange">{{ normalCount }}</text>
          </view>
          <text class="section-hint">记忆正在衰退，及时巩固效果最佳</text>
          <view
            v-for="(item, idx) in normalItems"
            :key="item._id"
            class="review-card apple-glass-card normal-card"
            :style="{ animationDelay: idx * 0.08 + 's' }"
            @tap="reviewItem(item)"
          >
            <view class="card-header">
              <text class="card-kp">{{ item.knowledge_point || item.category }}</text>
              <text class="card-count">错 {{ item.error_count }} 次</text>
            </view>
            <text class="card-question">{{ truncate(item.question_content, 60) }}</text>
            <view class="mastery-bar-container">
              <view
                class="mastery-bar"
                :style="{ width: (item.mastery || 30) + '%', backgroundColor: getMasteryColor(item.mastery || 30) }"
              />
            </view>
            <text class="mastery-label">记忆强度 {{ item.mastery || 30 }}%</text>
          </view>
        </view>

        <!-- 常规复习 -->
        <view v-if="lightItems.length > 0" class="section animate-in">
          <view class="section-header">
            <view class="section-dot light-dot" />
            <text class="section-title">常规复习</text>
            <text class="section-badge badge-blue">{{ lightCount }}</text>
          </view>
          <text class="section-hint">记忆状态良好，轻松回顾即可</text>
          <view
            v-for="(item, idx) in lightItems"
            :key="item._id"
            class="review-card apple-glass-card light-card"
            :style="{ animationDelay: idx * 0.08 + 's' }"
            @tap="reviewItem(item)"
          >
            <text class="card-question">{{ truncate(item.question_content, 60) }}</text>
            <view class="mastery-bar-container">
              <view
                class="mastery-bar"
                :style="{ width: (item.mastery || 70) + '%', backgroundColor: getMasteryColor(item.mastery || 70) }"
              />
            </view>
            <text class="mastery-label">记忆强度 {{ item.mastery || 70 }}%</text>
          </view>
        </view>

        <!-- 空状态 -->
        <view v-if="totalPending === 0" class="empty-state">
          <text class="empty-icon">已完成</text>
          <text class="empty-title">今日复习已完成</text>
          <text class="empty-sub">保持这个节奏，考研稳了</text>
          <view v-if="streakDays > 0" class="streak-celebrate">
            <text class="streak-big">连续 {{ streakDays }}</text>
            <text class="streak-desc">天连续复习</text>
          </view>
          <wd-button type="primary" block size="large" custom-style="margin-top: 16rpx" @click="goPractice">
            继续刷题
          </wd-button>
        </view>

        <!-- 最近诊断建议 -->
        <view v-if="latestDiagnosis" class="diagnosis-hint apple-glass-card">
          <!-- 卡通脑电图标装饰 -->
          <image
            class="feature-cartoon-icon"
            src="./static/icons/brain-bolt.png"
            mode="aspectFit"
            style="margin-bottom: 12rpx"
          />
          <text class="hint-title">最近诊断建议</text>
          <text class="hint-text">{{ latestDiagnosis.studyPlan?.immediate || '' }}</text>
          <text v-if="latestDiagnosis.weakPoints?.length" class="hint-weak">
            薄弱点：{{
              latestDiagnosis.weakPoints
                .slice(0, 3)
                .map((w) => w.knowledgePoint)
                .join('、')
            }}
          </text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { toast } from '@/utils/toast.js';
import { ref, computed, onMounted, nextTick } from 'vue';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { useReviewStore } from '@/stores/modules/review.js';
import { initTheme } from '@/composables/useTheme.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';

const reviewStore = useReviewStore();
import { storageService } from '@/services/storageService.js';
import { getDueCards } from '@/services/fsrs-service.js';

const isDark = ref(initTheme());

const loading = ref(true);
const reviewPlan = ref({ urgent: { items: [] }, normal: { items: [] }, light: { items: [] }, totalPending: 0 });
const latestDiagnosis = ref(null);
const statusBarHeight = ref(0);
const streakDays = ref(0);
const isRefreshing = ref(false);

async function onRefresh() {
  isRefreshing.value = true;
  await loadReviewPlan();
  isRefreshing.value = false;
}

const urgentItems = computed(() => reviewPlan.value.urgent?.items || []);
const normalItems = computed(() => reviewPlan.value.normal?.items || []);
const lightItems = computed(() => reviewPlan.value.light?.items || []);
const urgentCount = computed(() => reviewPlan.value.urgent?.count || 0);
const normalCount = computed(() => reviewPlan.value.normal?.count || 0);
const lightCount = computed(() => reviewPlan.value.light?.count || 0);
const totalPending = computed(() => reviewPlan.value.totalPending || 0);

// [OK] [P1修复] 连续复习天数 — 只读取显示，不在页面访问时自增
function loadStreak() {
  try {
    const data = uni.getStorageSync('review_streak') || {};
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (data.lastDate === today) {
      streakDays.value = data.days || 1;
    } else if (data.lastDate === yesterday) {
      // 昨天有记录，但今天还没完成复习，显示昨天的天数（不自增）
      streakDays.value = data.days || 0;
    } else {
      // 断了，显示0
      streakDays.value = 0;
    }
  } catch (_e) {
    streakDays.value = 0;
  }
}

// [OK] [P1修复] 完成复习后才记录streak（由startBatchReview返回后调用）
function recordStreakCompletion() {
  try {
    const today = new Date().toDateString();
    const data = uni.getStorageSync('review_streak') || {};
    if (data.lastDate === today) return; // 今天已记录
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const newDays = data.lastDate === yesterday ? (data.days || 0) + 1 : 1;
    uni.setStorageSync('review_streak', { lastDate: today, days: newDays });
    streakDays.value = newDays;
  } catch (_e) {
    /* silent */
  }
}

// 绘制复习进度环
function drawReviewRing() {
  const total = totalPending.value;
  const max = Math.max(total, 1);
  const _percent = total > 0 ? 1 : 0; // 满环表示全部待复习

  const ctx = uni.createCanvasContext('reviewRing');
  const size = 90;
  const center = size / 2;
  const radius = 34;
  const lineWidth = 7;

  // 背景环
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.setStrokeStyle('rgba(255,255,255,0.06)');
  ctx.setLineWidth(lineWidth);
  ctx.setLineCap('round');
  ctx.stroke();

  // 进度环（三色分段）
  const urgentRatio = urgentCount.value / max;
  const normalRatio = normalCount.value / max;
  const lightRatio = lightCount.value / max;
  const startAngle = -Math.PI / 2;

  // 急需（红）
  if (urgentRatio > 0) {
    ctx.beginPath();
    ctx.arc(center, center, radius, startAngle, startAngle + Math.PI * 2 * urgentRatio);
    ctx.setStrokeStyle('#ff453a');
    ctx.setLineWidth(lineWidth);
    ctx.setLineCap('round');
    ctx.stroke();
  }
  // 巩固（橙）
  if (normalRatio > 0) {
    const nStart = startAngle + Math.PI * 2 * urgentRatio;
    ctx.beginPath();
    ctx.arc(center, center, radius, nStart, nStart + Math.PI * 2 * normalRatio);
    ctx.setStrokeStyle('#ff9f0a');
    ctx.setLineWidth(lineWidth);
    ctx.setLineCap('round');
    ctx.stroke();
  }
  // 复习（蓝）
  if (lightRatio > 0) {
    const lStart = startAngle + Math.PI * 2 * (urgentRatio + normalRatio);
    ctx.beginPath();
    ctx.arc(center, center, radius, lStart, lStart + Math.PI * 2 * lightRatio);
    ctx.setStrokeStyle('#32ade6');
    ctx.setLineWidth(lineWidth);
    ctx.setLineCap('round');
    ctx.stroke();
  }

  ctx.draw();
}

async function loadReviewPlan() {
  loading.value = true;
  try {
    const res = await reviewStore.fetchReviewPlan();
    if (res.success && res.data) {
      reviewPlan.value = res.data.reviewPlan || reviewPlan.value;
      latestDiagnosis.value = res.data.latestDiagnosis;
    } else {
      // 服务端返回异常，尝试离线兜底
      loadOfflineFallback();
    }
  } catch (e) {
    logger.warn('[SmartReview] 服务端加载失败，启用离线FSRS兜底:', e);
    loadOfflineFallback();
  } finally {
    loading.value = false;
    await nextTick();
    drawReviewRing();
  }
}

// [OK] [P2] 离线FSRS兜底 — 使用集中式 FSRS 服务生成复习计划
function loadOfflineFallback() {
  try {
    // 从本地存储获取所有题目
    const allQuestions = storageService.get('v30_bank', []);
    const mistakeBook = storageService.get('mistake_book', []);

    // 合并题库和错题本
    const allCards = [
      ...allQuestions,
      ...mistakeBook.map((m) => ({
        id: m.question_id || m.id || m._id,
        content: m.question || m.question_content || '',
        tags: m.tags || [],
        category: m.category || '',
        error_count: m.error_count || m.wrong_count || 1
      }))
    ];

    if (allCards.length === 0) return;

    // 使用 FSRS 服务获取待复习卡片（按可检索性排序）
    const dueItems = getDueCards(allCards);

    // 按紧急程度分三档
    const urgent = [];
    const normal = [];
    const light = [];

    dueItems.forEach((item) => {
      const mapped = {
        _id: item.id,
        question_id: item.id,
        question_content: item.content || '',
        knowledge_point: item.tags?.[0] || item.category || '',
        category: item.category || '',
        error_count: item.error_count || 1,
        mastery: Math.round((item.retrievability || 0) * 100),
        next_review_at: item.due ? new Date(item.due).getTime() : Date.now()
      };

      if (item.overdueDays > 3 || item.isNew) {
        urgent.push(mapped);
      } else if (item.overdueDays > 1) {
        normal.push(mapped);
      } else {
        light.push(mapped);
      }
    });

    reviewPlan.value = {
      urgent: { items: urgent.slice(0, 10), count: urgent.length },
      normal: { items: normal.slice(0, 10), count: normal.length },
      light: { items: light.slice(0, 10), count: light.length },
      totalPending: urgent.length + normal.length + light.length
    };

    logger.log('[SmartReview] FSRS服务离线兜底已加载:', reviewPlan.value.totalPending, '题');
  } catch (e) {
    logger.warn('[SmartReview] FSRS 离线计算失败:', e);
  }
}

function reviewItem(item) {
  uni.navigateTo({
    url: `/pages/mistake/index?questionId=${item.question_id}&reviewMode=true`
  });
}

function startBatchReview() {
  const allItems = [...urgentItems.value, ...normalItems.value, ...lightItems.value].slice(0, 20);
  const ids = allItems.map((i) => i.question_id).filter(Boolean);
  if (ids.length === 0) {
    toast.info('暂无可复习的题目');
    return;
  }
  // [OK] [P1修复] 开始批量复习时记录streak（而非页面访问时）
  recordStreakCompletion();
  uni.setStorageSync('smart_review_ids', ids);
  uni.navigateTo({ url: '/pages/practice-sub/do-quiz?mode=smart_review' });
}

function goPractice() {
  safeNavigateBack();
}
function goBack() {
  safeNavigateBack();
}

function getMasteryColor(mastery) {
  if (mastery >= 80) return 'var(--success, #34C759)';
  if (mastery >= 50) return 'var(--warning, #FF9500)';
  return 'var(--danger, var(--danger))';
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}

function formatNextReview(ts) {
  if (!ts) return '';
  const diff = ts - Date.now();
  if (diff <= 0) return '现在复习';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}分钟后`;
  const hours = Math.round(diff / 3600000);
  if (hours < 24) return `${hours}小时后`;
  return `${Math.round(diff / 86400000)}天后`;
}

onMounted(() => {
  // [AUDIT FIX R135] 使用统一工具函数获取状态栏高度
  statusBarHeight.value = getStatusBarHeight();
  loadStreak();
  loadReviewPlan();
});
</script>

<style scoped>
.smart-review-container {
  min-height: 100vh;
  background: var(--background);
  padding-bottom: env(safe-area-inset-bottom);
  --text-primary: var(--text-primary);
  --text-secondary: var(--text-secondary);
  --bg-card: #ffffff;
  /* 语义色映射：引用全局 design tokens，保持 iOS 色调作为回退值 */
  --red: var(--em-error, #ff453a);
  --orange: var(--em-warning, #ff9f0a);
  --blue: var(--em-info, #32ade6);
  --green: #58cc02;
}

/* [OK] [P1重构] 暗色模式适配 — 不再硬编码，跟随主题系统 */
.smart-review-container.dark-mode {
  background: linear-gradient(180deg, var(--background) 0%, var(--page-gradient-mid) 50%, var(--background) 100%);
  --text-primary: var(--text-main, #f5f5f7);
  --text-secondary: var(--text-sub, #8e8e93);
  --bg-card: rgba(255, 255, 255, 0.06);
}

/* 导航 */
.top-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 16rpx 32rpx;
  background: var(--bg-card);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
/* [OK] 暗色模式导航栏 */
.dark-mode .top-nav {
  background: rgba(10, 10, 15, 0.72);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
.back-icon {
  width: 48rpx;
  height: 48rpx;
  padding: 20rpx;
  opacity: 0.7;
}
.nav-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
}
.nav-right {
  width: 48rpx;
}
.review-scroll {
  padding: 160rpx 32rpx 80rpx;
}

/* 加载 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 360rpx;
}
.loading-brain {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.brain-ring {
  position: absolute;
  border-radius: 50%;
  border: 4rpx solid transparent;
}
.r1 {
  width: 140rpx;
  height: 140rpx;
  border-top-color: var(--green);
  animation: spin 2s linear infinite;
}
.r2 {
  width: 100rpx;
  height: 100rpx;
  border-bottom-color: var(--blue);
  animation: spin 1.5s linear infinite reverse;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.brain-emoji {
  font-size: 48rpx;
  z-index: 1;
}
.loading-text {
  margin-top: 40rpx;
  font-size: 28rpx;
  color: var(--text-secondary);
}

/* 玻璃卡片 */
.apple-glass-card {
  background: var(--bg-card);
  border-radius: 28rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.dark-mode .apple-glass-card {
  border-color: rgba(255, 255, 255, 0.08);
}

/* 进度英雄卡 */
.progress-hero {
  display: flex;
  align-items: center;
  /* gap: 32rpx; */
  padding: 40rpx;
}
.progress-hero > view + view {
  margin-left: 32rpx;
}
.hero-left {
  flex-shrink: 0;
}
.ring-wrap {
  position: relative;
  width: 180rpx;
  height: 180rpx;
}
.review-canvas {
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
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.ring-label {
  font-size: 20rpx;
  color: var(--text-secondary);
  margin-top: 2rpx;
}
.hero-right {
  flex: 1;
}
.hero-title-row {
  display: flex;
  align-items: center;
  /* gap: 16rpx; */
}
.hero-title-row > view + view {
  margin-left: 16rpx;
}
.hero-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.hero-sub {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 8rpx;
  display: block;
}
.hero-tags {
  display: flex;
  /* gap: 16rpx; */
  margin-top: 20rpx;
  flex-wrap: wrap;
}
.hero-tags > view {
  margin-right: 16rpx;
  margin-bottom: 16rpx;
}
.hero-tag {
  display: flex;
  align-items: center;
  /* gap: 8rpx; */
  padding: 6rpx 16rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.04);
}
.hero-tag > view + view {
  margin-left: 8rpx;
}
.tag-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
}
.dot-red {
  background: var(--red);
}
.dot-orange {
  background: var(--orange);
}
.dot-blue {
  background: var(--blue);
}
.tag-text {
  font-size: 22rpx;
  color: var(--text-secondary);
}
.streak-row {
  display: flex;
  align-items: center;
  /* gap: 8rpx; */
  margin-top: 16rpx;
}
.streak-row > view + view {
  margin-left: 8rpx;
}
.streak-fire {
  font-size: 28rpx;
}
.streak-text {
  font-size: 24rpx;
  color: var(--orange);
  font-weight: 500;
}

/* 一键开始 */
.start-section {
  padding: 8rpx 0 16rpx;
}
.btn-start-review {
  background: #58cc02;
  color: var(--text-inverse);
  border: none;
  border-radius: 28rpx;
  height: 96rpx;
  font-size: 32rpx;
  font-weight: 800;
  width: 100%;
  box-shadow: 0 8rpx 0 #46a302;
}
.btn-start-review:active {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 #46a302;
}

/* 区块 */
.section {
  margin-top: 40rpx;
}
.animate-in {
  animation: slideUp 0.4s ease-out both;
}
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(32rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.section-header {
  display: flex;
  align-items: center;
  /* gap: 16rpx; */
  margin-bottom: 8rpx;
}
.section-header > view + view {
  margin-left: 16rpx;
}
.section-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
}
.urgent-dot {
  background: var(--red);
  box-shadow: 0 0 12rpx rgba(255, 69, 58, 0.5);
}
.normal-dot {
  background: var(--orange);
}
.light-dot {
  background: var(--blue);
}
.section-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
  flex: 1;
}
.section-badge {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
  font-weight: 600;
}
.badge-red {
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  color: var(--red);
}
.badge-orange {
  background: color-mix(in srgb, var(--warning) 15%, transparent);
  color: var(--orange);
}
.badge-blue {
  background: color-mix(in srgb, var(--info) 15%, transparent);
  color: var(--blue);
}
.section-hint {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-bottom: 20rpx;
  display: block;
  margin-left: 36rpx;
}

/* 复习卡片 */
.review-card {
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
.urgent-card {
  border-left: 6rpx solid var(--red);
}
.light-card {
  border-left: 6rpx solid var(--blue);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.card-kp {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-primary);
  flex: 1;
}
.error-badge {
  display: flex;
  align-items: baseline;
  /* gap: 4rpx; */
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
}
.error-badge > view + view {
  margin-left: 4rpx;
}
.error-num {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--red);
}
.error-label {
  font-size: 20rpx;
  color: var(--red);
  opacity: 0.8;
}
.card-count {
  font-size: 24rpx;
  color: var(--red);
}
.card-question {
  font-size: 26rpx;
  color: var(--text-secondary);
  line-height: 1.5;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 16rpx;
}
.card-category {
  font-size: 22rpx;
  color: var(--text-secondary);
  padding: 4rpx 16rpx;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 16rpx;
}
.card-time {
  font-size: 22rpx;
  color: var(--orange);
}
/* 记忆强度进度条 */
.mastery-bar-container {
  width: 100%;
  height: 12rpx;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 6rpx;
  overflow: hidden;
  margin-top: 20rpx;
}
.dark-mode .mastery-bar-container {
  background: rgba(255, 255, 255, 0.08);
}
.mastery-bar {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.6s ease;
}
.mastery-label {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 8rpx;
  display: block;
}
.normal-card {
  border-left: 6rpx solid var(--orange);
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
.streak-celebrate {
  display: flex;
  align-items: baseline;
  /* gap: 8rpx; */
  margin-top: 32rpx;
}
.streak-celebrate > view + view {
  margin-left: 8rpx;
}
.streak-big {
  font-size: 64rpx;
  font-weight: 700;
  color: var(--orange);
}
.streak-desc {
  font-size: 28rpx;
  color: var(--text-secondary);
}
.btn-practice {
  margin-top: 40rpx;
  background: color-mix(in srgb, var(--success) 12%, transparent);
  color: var(--green);
  border: 1rpx solid color-mix(in srgb, var(--success) 20%, transparent);
  border-radius: 24rpx;
  padding: 20rpx 48rpx;
  font-size: 28rpx;
}

/* 诊断建议 */
.diagnosis-hint {
  margin-top: 32rpx;
}
.hint-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  margin-bottom: 16rpx;
}
.hint-text {
  font-size: 26rpx;
  color: var(--text-secondary);
  line-height: 1.5;
  display: block;
}
.hint-weak {
  font-size: 24rpx;
  color: var(--orange);
  margin-top: 12rpx;
  display: block;
}
/* 卡通图标通用样式 */
.feature-cartoon-icon {
  width: 80rpx;
  height: 80rpx;
}
</style>
