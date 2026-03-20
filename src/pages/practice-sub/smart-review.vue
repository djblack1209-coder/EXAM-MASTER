<template>
  <view class="smart-review-container" :class="{ 'dark-mode': isDark }">
    <view class="top-nav apple-glass" :style="{ paddingTop: statusBarHeight + 'px' }">
      <image src="/static/icons/chevron-left.png" class="back-icon" mode="aspectFit" @tap="goBack" />
      <text class="nav-title">智能复习</text>
      <view class="nav-right" />
    </view>

    <scroll-view class="review-scroll" scroll-y>
      <!-- 加载中 -->
      <view v-if="loading" class="loading-state">
        <view class="loading-brain">
          <view class="brain-ring r1" />
          <view class="brain-ring r2" />
          <text class="brain-emoji">📋</text>
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
            <text class="hero-sub">基于 AI 诊断 + SM-2 遗忘曲线</text>
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
              <text class="streak-fire">🔥</text>
              <text class="streak-text">已连续复习 {{ streakDays }} 天</text>
            </view>
          </view>
        </view>

        <!-- 一键开始（置顶强CTA） -->
        <view v-if="totalPending > 0" class="start-section">
          <wd-button type="primary" block size="large" @click="startBatchReview"
            >开始今日复习（{{ Math.min(totalPending, 20) }} 题）</wd-button
          >
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
            <view class="card-mastery">
              <view class="mastery-track">
                <view class="mastery-fill" :style="{ width: (item.mastery || 10) + '%' }" />
              </view>
              <text class="mastery-text">{{ item.mastery || 10 }}%</text>
            </view>
          </view>
        </view>

        <!-- 需要巩固 -->
        <view v-if="normalItems.length > 0" class="section animate-in">
          <view class="section-header">
            <view class="section-dot normal-dot" />
            <text class="section-title">需要巩固</text>
            <text class="section-badge badge-orange">{{ normalCount }}</text>
          </view>
          <view
            v-for="(item, idx) in normalItems"
            :key="item._id"
            class="review-card apple-glass-card"
            :style="{ animationDelay: idx * 0.08 + 's' }"
            @tap="reviewItem(item)"
          >
            <view class="card-header">
              <text class="card-kp">{{ item.knowledge_point || item.category }}</text>
              <text class="card-count">错 {{ item.error_count }} 次</text>
            </view>
            <text class="card-question">{{ truncate(item.question_content, 60) }}</text>
          </view>
        </view>

        <!-- 常规复习 -->
        <view v-if="lightItems.length > 0" class="section animate-in">
          <view class="section-header">
            <view class="section-dot light-dot" />
            <text class="section-title">常规复习</text>
            <text class="section-badge badge-blue">{{ lightCount }}</text>
          </view>
          <view
            v-for="(item, idx) in lightItems"
            :key="item._id"
            class="review-card apple-glass-card light-card"
            :style="{ animationDelay: idx * 0.08 + 's' }"
            @tap="reviewItem(item)"
          >
            <text class="card-question">{{ truncate(item.question_content, 60) }}</text>
          </view>
        </view>

        <!-- 空状态 -->
        <view v-if="totalPending === 0" class="empty-state">
          <text class="empty-icon">🎉</text>
          <text class="empty-title">今日复习已完成</text>
          <text class="empty-sub">保持这个节奏，考研稳了</text>
          <view v-if="streakDays > 0" class="streak-celebrate">
            <text class="streak-big">🔥 {{ streakDays }}</text>
            <text class="streak-desc">天连续复习</text>
          </view>
          <wd-button type="primary" block size="large" @click="goPractice" custom-style="margin-top: 16rpx"
            >继续刷题</wd-button
          >
        </view>

        <!-- 最近诊断建议 -->
        <view v-if="latestDiagnosis" class="diagnosis-hint apple-glass-card">
          <text class="hint-title">📊 最近诊断建议</text>
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
import { ref, computed, onMounted, nextTick } from 'vue';
import { lafService } from '@/services/lafService.js';
import { initTheme } from '@/composables/useTheme.js';
import { logger } from '@/utils/logger.js';
import { storageService } from '@/services/storageService.js';
import { getMistakesDueForReview, getMistakeReviewPriority } from '@/utils/practice/mistake-fsrs-scheduler.js';

const isDark = ref(initTheme());

const loading = ref(true);
const reviewPlan = ref({ urgent: { items: [] }, normal: { items: [] }, light: { items: [] }, totalPending: 0 });
const latestDiagnosis = ref(null);
const statusBarHeight = ref(0);
const streakDays = ref(0);

const urgentItems = computed(() => reviewPlan.value.urgent?.items || []);
const normalItems = computed(() => reviewPlan.value.normal?.items || []);
const lightItems = computed(() => reviewPlan.value.light?.items || []);
const urgentCount = computed(() => reviewPlan.value.urgent?.count || 0);
const normalCount = computed(() => reviewPlan.value.normal?.count || 0);
const lightCount = computed(() => reviewPlan.value.light?.count || 0);
const totalPending = computed(() => reviewPlan.value.totalPending || 0);

// ✅ [P1修复] 连续复习天数 — 只读取显示，不在页面访问时自增
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

// ✅ [P1修复] 完成复习后才记录streak（由startBatchReview返回后调用）
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
    const res = await lafService.getReviewPlan();
    if (res.code === 0 && res.data) {
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

// ✅ [P2] 离线FSRS兜底 — 从本地错题本用FSRS调度生成复习计划
function loadOfflineFallback() {
  try {
    const mistakeBook = storageService.get('mistake_book', []);
    if (!mistakeBook || mistakeBook.length === 0) return;

    const dueItems = getMistakesDueForReview(mistakeBook);
    const sorted = getMistakeReviewPriority(dueItems);

    // 按逾期程度分三档
    const now = Date.now();
    const urgent = [];
    const normal = [];
    const light = [];

    sorted.forEach((m) => {
      const overdueDays = (now - (m.fsrs_due || 0)) / 86400000;
      const item = {
        _id: m.id || m._id || m.question_id,
        question_id: m.question_id || m.id || m._id,
        question_content: m.question || m.question_content || '',
        knowledge_point: m.knowledge_point || m.category || '',
        category: m.category || '',
        error_count: m.error_count || m.wrong_count || 1,
        mastery: m.mastery || Math.round(((m.fsrs_stability || 0) / 1.8) * 10),
        next_review_at: m.fsrs_due || now
      };

      if (overdueDays > 3 || m.error_count >= 3) {
        urgent.push(item);
      } else if (overdueDays > 1) {
        normal.push(item);
      } else {
        light.push(item);
      }
    });

    reviewPlan.value = {
      urgent: { items: urgent.slice(0, 10), count: urgent.length },
      normal: { items: normal.slice(0, 10), count: normal.length },
      light: { items: light.slice(0, 10), count: light.length },
      totalPending: urgent.length + normal.length + light.length
    };

    logger.log('[SmartReview] 离线FSRS兜底已加载:', reviewPlan.value.totalPending, '题');
  } catch (e) {
    logger.warn('[SmartReview] 离线兜底也失败:', e);
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
    uni.showToast({ title: '暂无可复习的题目', icon: 'none' });
    return;
  }
  // ✅ [P1修复] 开始批量复习时记录streak（而非页面访问时）
  recordStreakCompletion();
  uni.setStorageSync('smart_review_ids', ids);
  uni.navigateTo({ url: '/pages/practice-sub/do-quiz?mode=smart_review' });
}

function goPractice() {
  uni.navigateBack();
}
function goBack() {
  uni.navigateBack();
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
  const sysInfo = uni.getSystemInfoSync();
  statusBarHeight.value = sysInfo.statusBarHeight || 0;
  loadStreak();
  loadReviewPlan();
});
</script>

<style scoped>
.smart-review-container {
  min-height: 100vh;
  background: var(--bg-page, linear-gradient(180deg, #f5f5f7 0%, #eeeef0 50%, #f5f5f7 100%));
  padding-bottom: env(safe-area-inset-bottom);
  --text-primary: var(--text-main, #1c1c1e);
  --text-secondary: var(--text-sub, #8e8e93);
  --bg-card: var(--bg-card-alpha, rgba(0, 0, 0, 0.03));
  --red: #ff453a;
  --orange: #ff9f0a;
  --blue: #32ade6;
  --green: #34c759;
}

/* ✅ [P1重构] 暗色模式适配 — 不再硬编码，跟随主题系统 */
.smart-review-container.dark-mode {
  background: linear-gradient(180deg, #0a0a0f 0%, #111118 50%, #0d0d14 100%);
  --text-primary: #f5f5f7;
  --text-secondary: #8e8e93;
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
  padding: 8px 16px;
  backdrop-filter: saturate(180%) blur(20px);
  background: rgba(245, 245, 247, 0.72);
  border-bottom: 0.5px solid rgba(0, 0, 0, 0.06);
}
/* ✅ 暗色模式导航栏 */
.dark-mode .top-nav {
  background: rgba(10, 10, 15, 0.72);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
.back-icon {
  width: 24px;
  height: 24px;
  opacity: 0.7;
}
.nav-title {
  flex: 1;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}
.nav-right {
  width: 24px;
}
.review-scroll {
  padding: 80px 16px 40px;
}

/* 加载 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 180px;
}
.loading-brain {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.brain-ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid transparent;
}
.r1 {
  width: 70px;
  height: 70px;
  border-top-color: var(--green);
  animation: spin 2s linear infinite;
}
.r2 {
  width: 50px;
  height: 50px;
  border-bottom-color: var(--blue);
  animation: spin 1.5s linear infinite reverse;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.brain-emoji {
  font-size: 24px;
  z-index: 1;
}
.loading-text {
  margin-top: 20px;
  font-size: 14px;
  color: var(--text-secondary);
}

/* 玻璃卡片 */
.apple-glass-card {
  background: var(--bg-card);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 12px;
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(10px);
}
.dark-mode .apple-glass-card {
  border-color: rgba(255, 255, 255, 0.08);
}

/* 进度英雄卡 */
.progress-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
}
.hero-left {
  flex-shrink: 0;
}
.ring-wrap {
  position: relative;
  width: 90px;
  height: 90px;
}
.review-canvas {
  width: 90px;
  height: 90px;
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
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.ring-label {
  font-size: 10px;
  color: var(--text-secondary);
  margin-top: 1px;
}
.hero-right {
  flex: 1;
}
.hero-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hero-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}
.hero-sub {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 4px;
  display: block;
}
.hero-tags {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.hero-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
}
.tag-dot {
  width: 6px;
  height: 6px;
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
  font-size: 11px;
  color: var(--text-secondary);
}
.streak-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}
.streak-fire {
  font-size: 14px;
}
.streak-text {
  font-size: 12px;
  color: var(--orange);
  font-weight: 500;
}

/* 一键开始 */
.start-section {
  padding: 4px 0 8px;
}
.btn-start-review {
  background: linear-gradient(135deg, #34c759, #30d158);
  color: #fff;
  border: none;
  border-radius: 14px;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  width: 100%;
  box-shadow: 0 4px 16px rgba(52, 199, 89, 0.3);
}

/* 区块 */
.section {
  margin-top: 20px;
}
.animate-in {
  animation: slideUp 0.4s ease-out both;
}
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.section-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.urgent-dot {
  background: var(--red);
  box-shadow: 0 0 6px rgba(255, 69, 58, 0.5);
}
.normal-dot {
  background: var(--orange);
}
.light-dot {
  background: var(--blue);
}
.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}
.section-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  font-weight: 600;
}
.badge-red {
  background: rgba(255, 69, 58, 0.15);
  color: var(--red);
}
.badge-orange {
  background: rgba(255, 159, 10, 0.15);
  color: var(--orange);
}
.badge-blue {
  background: rgba(50, 173, 230, 0.15);
  color: var(--blue);
}
.section-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 10px;
  display: block;
  margin-left: 18px;
}

/* 复习卡片 */
.review-card {
  padding: 14px;
  animation: fadeSlideIn 0.3s ease-out both;
}
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.urgent-card {
  border-left: 3px solid var(--red);
}
.light-card {
  border-left: 3px solid var(--blue);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.card-kp {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}
.error-badge {
  display: flex;
  align-items: baseline;
  gap: 2px;
  background: rgba(255, 69, 58, 0.12);
  padding: 2px 8px;
  border-radius: 8px;
}
.error-num {
  font-size: 14px;
  font-weight: 700;
  color: var(--red);
}
.error-label {
  font-size: 10px;
  color: var(--red);
  opacity: 0.8;
}
.card-count {
  font-size: 12px;
  color: var(--red);
}
.card-question {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.card-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
}
.card-category {
  font-size: 11px;
  color: var(--text-secondary);
  padding: 2px 8px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
}
.card-time {
  font-size: 11px;
  color: var(--orange);
}
.card-mastery {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.mastery-track {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.mastery-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--orange);
  transition: width 0.6s ease;
}
.mastery-text {
  font-size: 10px;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 0;
}
.empty-icon {
  font-size: 48px;
}
.empty-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 16px;
}
.empty-sub {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 8px;
}
.streak-celebrate {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-top: 16px;
}
.streak-big {
  font-size: 32px;
  font-weight: 700;
  color: var(--orange);
}
.streak-desc {
  font-size: 14px;
  color: var(--text-secondary);
}
.btn-practice {
  margin-top: 20px;
  background: rgba(52, 199, 89, 0.12);
  color: var(--green);
  border: 0.5px solid rgba(52, 199, 89, 0.2);
  border-radius: 12px;
  padding: 10px 24px;
  font-size: 14px;
}

/* 诊断建议 */
.diagnosis-hint {
  margin-top: 16px;
}
.hint-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  margin-bottom: 8px;
}
.hint-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: block;
}
.hint-weak {
  font-size: 12px;
  color: var(--orange);
  margin-top: 6px;
  display: block;
}
</style>
