<template>
  <view class="diagnosis-container" :class="{ 'dark-mode': isDark, 'wot-theme-dark': isDark }">
    <!-- 顶部导航 -->
    <view class="top-nav apple-glass" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="back-icon" @tap="goBack">
        <BaseIcon name="arrow-left" :size="36" />
      </view>
      <text class="nav-title">学习诊断</text>
      <text class="nav-action" @tap="shareReport">分享</text>
    </view>

    <!-- 沉浸式加载状态 -->
    <view v-if="loading" class="loading-state">
      <view class="loading-brain">
        <view class="brain-ring ring-1" />
        <view class="brain-ring ring-2" />
        <view class="brain-ring ring-3" />
        <text class="brain-icon">智能分析</text>
      </view>
      <text class="loading-title">{{ loadingText }}</text>
      <view class="loading-steps">
        <view v-for="(step, i) in loadingSteps" :key="i" class="step-item" :class="{ active: loadingStep >= i }">
          <view class="step-dot" />
          <text class="step-text">{{ step }}</text>
        </view>
      </view>
    </view>

    <!-- [AUDIT FIX R135] 加载失败状态 — 给用户明确反馈和重试入口 -->
    <view v-else-if="loadFailed" class="fail-state">
      <text class="fail-icon">加载失败</text>
      <text class="fail-title">报告加载失败</text>
      <text class="fail-desc">网络不太给力，请稍后重试</text>
      <view class="fail-retry" @tap="retryLoad">
        <text class="fail-retry-text">点击重试</text>
      </view>
    </view>

    <scroll-view v-else class="report-scroll" scroll-y>
      <!-- 总览卡片：动画环形图 -->
      <view class="overview-card apple-glass-card" :class="{ 'animate-in': showOverview }">
        <view class="score-section">
          <view class="ring-container">
            <canvas canvas-id="scoreRing" class="score-canvas"></canvas>
            <view class="ring-center">
              <text class="score-number">{{ animatedAccuracy }}</text>
              <text class="score-unit">%</text>
            </view>
          </view>
          <text class="score-label">正确率</text>
        </view>
        <view class="overview-right">
          <view class="level-badge" :class="'level-' + levelClass">
            <text class="level-text">{{ diagnosis.overallLevel || '分析中' }}</text>
          </view>
          <view class="mini-stats">
            <view class="mini-stat">
              <text class="mini-value">{{ stats.total || 0 }}</text>
              <text class="mini-label">总题</text>
            </view>
            <view class="mini-stat">
              <text class="mini-value correct">{{ stats.correct || 0 }}</text>
              <text class="mini-label">正确</text>
            </view>
            <view class="mini-stat">
              <text class="mini-value wrong">{{ (stats.total || 0) - (stats.correct || 0) }}</text>
              <text class="mini-label">错误</text>
            </view>
            <view class="mini-stat">
              <text class="mini-value">{{ stats.avgDuration || 0 }}s</text>
              <text class="mini-label">均时</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 错误模式洞察（核心差异化） -->
      <view
        v-if="diagnosis.errorPatterns && diagnosis.errorPatterns.length > 0"
        class="section"
        :class="{ 'animate-in': showPatterns }"
      >
        <text class="section-title">错误模式洞察</text>
        <text class="section-sub">AI 识别出你的典型错误规律</text>
        <view v-for="(ep, i) in diagnosis.errorPatterns" :key="i" class="pattern-card apple-glass-card">
          <view class="pattern-header">
            <text class="pattern-icon">{{ patternIcon(ep.type) }}</text>
            <text class="pattern-type">{{ ep.type }}</text>
            <text class="pattern-count">出现 {{ ep.count || 0 }} 次</text>
          </view>
          <text class="pattern-desc">{{ ep.description }}</text>
          <text class="pattern-fix">建议: {{ ep.fix }}</text>
        </view>
      </view>

      <!-- 薄弱知识点（带动画进度条） -->
      <view v-if="weakPoints.length > 0" class="section" :class="{ 'animate-in': showWeak }">
        <text class="section-title">薄弱知识点</text>
        <text class="section-sub">按严重程度排序，优先攻克红色标记</text>
        <view
          v-for="(wp, i) in weakPoints"
          :key="i"
          class="weak-card apple-glass-card"
          :class="'severity-' + wp.severity"
          :style="{ animationDelay: i * 0.1 + 's' }"
        >
          <view class="weak-header">
            <view class="severity-indicator">
              <view class="severity-dot" />
              <view class="severity-pulse" />
            </view>
            <text class="weak-name">{{ wp.knowledgePoint }}</text>
            <text class="severity-tag" :class="'tag-' + wp.severity">{{ severityText(wp.severity) }}</text>
          </view>
          <view class="weak-mastery">
            <view class="mastery-track">
              <view class="mastery-fill" :style="{ width: (wp.mastery || 20) + '%' }" />
            </view>
            <text class="mastery-text">掌握度 {{ wp.mastery || 20 }}%</text>
          </view>
          <text class="weak-pattern">{{ wp.errorPattern }}</text>
          <view class="weak-suggestion">
            <BaseIcon name="arrow-right" :size="24" style="margin-right: 8rpx; vertical-align: middle" />
            {{ wp.suggestion }}
          </view>
        </view>
      </view>

      <!-- 掌握较好 -->
      <view v-if="strongPoints.length > 0" class="section" :class="{ 'animate-in': showStrong }">
        <text class="section-title">掌握较好</text>
        <view class="strong-list">
          <view v-for="(sp, i) in strongPoints" :key="i" class="strong-tag" :style="{ animationDelay: i * 0.05 + 's' }">
            <BaseIcon name="check" :size="24" class="strong-check" />
            <text class="strong-text">{{ sp }}</text>
          </view>
        </view>
      </view>

      <!-- 各科正确率（动画条形图） -->
      <view v-if="categoryStats.length > 0" class="section" :class="{ 'animate-in': showCategory }">
        <text class="section-title">各科表现</text>
        <view v-for="(cat, i) in categoryStats" :key="i" class="bar-item">
          <view class="bar-label">
            <text class="bar-name">{{ cat.name }}</text>
            <text
              class="bar-percent"
              :class="cat.accuracy >= 80 ? 'text-good' : cat.accuracy >= 60 ? 'text-mid' : 'text-bad'"
            >
              {{ cat.accuracy }}%
            </text>
          </view>
          <view class="bar-track">
            <view
              class="bar-fill"
              :class="cat.accuracy >= 80 ? 'fill-good' : cat.accuracy >= 60 ? 'fill-mid' : 'fill-bad'"
              :style="{ width: showCategory ? cat.accuracy + '%' : '0%', transitionDelay: i * 0.15 + 's' }"
            />
          </view>
        </view>
      </view>

      <!-- AI学习建议 -->
      <view v-if="studyPlan" class="section" :class="{ 'animate-in': showPlan }">
        <text class="section-title">AI 学习建议</text>
        <view class="plan-card apple-glass-card">
          <view v-if="studyPlan.immediate" class="plan-row">
            <text class="plan-icon">紧急</text>
            <view class="plan-content">
              <text class="plan-label">立即复习</text>
              <text class="plan-text">{{ studyPlan.immediate }}</text>
            </view>
          </view>
          <view v-if="studyPlan.thisWeek" class="plan-row">
            <text class="plan-icon">周计划</text>
            <view class="plan-content">
              <text class="plan-label">本周重点</text>
              <text class="plan-text">{{ studyPlan.thisWeek }}</text>
            </view>
          </view>
          <view v-if="studyPlan.suggestion" class="plan-row">
            <text class="plan-icon">建议</text>
            <view class="plan-content">
              <text class="plan-label">整体建议</text>
              <text class="plan-text">{{ studyPlan.suggestion }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 鼓励语 -->
      <view v-if="diagnosis.encouragement" class="encouragement" :class="{ 'animate-in': showPlan }">
        <text class="encourage-text">{{ diagnosis.encouragement }}</text>
      </view>

      <!-- 底部操作 -->
      <view class="bottom-actions">
        <wd-button type="primary" block size="large" @click="startSmartReview">
          开始智能复习 ({{ reviewCount }} 题待复习)
        </wd-button>
        <wd-button
          v-if="weakPoints.length > 0"
          plain
          block
          size="large"
          custom-style="margin-top: 16rpx"
          @click="startTargetedLesson"
        >
          针对薄弱点生成课程
        </wd-button>
        <wd-button
          plain
          block
          size="large"
          custom-class="custom-ghost-btn"
          custom-style="margin-top: 16rpx; border: none; background: transparent;"
          @click="goBack"
        >
          返回刷题
        </wd-button>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { toast } from '@/utils/toast.js';
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { useReviewStore } from '@/stores/modules/review.js';
import { initTheme } from '@/composables/useTheme.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';

const reviewStore = useReviewStore();

const isDark = ref(initTheme());

const loading = ref(true);
const loadFailed = ref(false); // [AUDIT FIX R135] 加载失败状态
const diagnosis = ref({});
const stats = ref({});
const statusBarHeight = ref(0);
const reviewCount = ref(0);
const animatedAccuracy = ref(0);

// 渐进式加载状态
const loadingStep = ref(0);
const loadingText = ref('正在收集答题数据...');
const loadingSteps = ['收集答题数据', '分析错误模式', '识别薄弱知识点', '生成学习建议'];

// 渐进式展示动画控制
const showOverview = ref(false);
const showPatterns = ref(false);
const showWeak = ref(false);
const showStrong = ref(false);
const showCategory = ref(false);
const showPlan = ref(false);

// [AUDIT FIX R135] 收集所有 setTimeout id，页面卸载时统一清理，防止内存泄漏
const pendingTimers = [];

const weakPoints = computed(() => diagnosis.value.weakPoints || []);
const strongPoints = computed(() => diagnosis.value.strongPoints || []);
const categoryStats = computed(() => stats.value.categoryStats || []);
const studyPlan = computed(() => diagnosis.value.studyPlan || null);

const levelClass = computed(() => {
  const map = { 优秀: 'excellent', 良好: 'good', 一般: 'average', 薄弱: 'weak' };
  return map[diagnosis.value.overallLevel] || 'average';
});

function severityText(s) {
  const map = { high: '急需加强', medium: '需要巩固', low: '稍加注意' };
  return map[s] || s;
}

function patternIcon(type) {
  if (!type) return '?';
  if (type.includes('概念')) return '概念';
  if (type.includes('计算')) return '计算';
  if (type.includes('审题')) return '审题';
  if (type.includes('记忆')) return '记忆';
  if (type.includes('理解')) return '理解';
  return '其他';
}

// 数字递增动画
function animateNumber(target, duration = 1200) {
  const start = 0;
  const startTime = Date.now();
  const tick = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // easeOutExpo
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    animatedAccuracy.value = Math.round(start + (target - start) * eased);
    if (progress < 1) {
      // [AUDIT FIX R135] 追踪定时器，防止页面卸载后继续执行
      const id = setTimeout(tick, 16);
      pendingTimers.push(id);
    }
  };
  tick();
}

// 绘制环形进度图
function drawScoreRing(accuracy) {
  const ctx = uni.createCanvasContext('scoreRing');
  const size = 100;
  const center = size / 2;
  const radius = 38;
  const lineWidth = 8;

  // 背景环
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.setStrokeStyle('rgba(255,255,255,0.08)');
  ctx.setLineWidth(lineWidth);
  ctx.setLineCap('round');
  ctx.stroke();

  // 进度环（渐变色）
  const percent = accuracy / 100;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2 * percent;

  let color;
  if (accuracy >= 80) color = '#34c759';
  else if (accuracy >= 60) color = '#ff9f0a';
  else color = '#ff453a';

  ctx.beginPath();
  ctx.arc(center, center, radius, startAngle, endAngle);
  ctx.setStrokeStyle(color);
  ctx.setLineWidth(lineWidth);
  ctx.setLineCap('round');
  ctx.stroke();

  ctx.draw();
}

// 渐进式展示各区块
// [AUDIT FIX R135] 追踪所有 setTimeout id，防止页面卸载后继续执行
function staggerReveal() {
  pendingTimers.push(
    setTimeout(() => {
      showOverview.value = true;
    }, 100)
  );
  pendingTimers.push(
    setTimeout(() => {
      showPatterns.value = true;
    }, 400)
  );
  pendingTimers.push(
    setTimeout(() => {
      showWeak.value = true;
    }, 600)
  );
  pendingTimers.push(
    setTimeout(() => {
      showStrong.value = true;
    }, 800)
  );
  pendingTimers.push(
    setTimeout(() => {
      showCategory.value = true;
    }, 1000)
  );
  pendingTimers.push(
    setTimeout(() => {
      showPlan.value = true;
    }, 1200)
  );
}

// 模拟加载步骤进度
// [AUDIT FIX R135] 追踪 setTimeout id
function simulateLoadingSteps() {
  const texts = ['正在收集答题数据...', '分析错误模式中...', '识别薄弱知识点...', '生成个性化学习建议...'];
  texts.forEach((text, i) => {
    pendingTimers.push(
      setTimeout(() => {
        loadingStep.value = i;
        loadingText.value = text;
      }, i * 800)
    );
  });
}

async function loadReport() {
  loading.value = true;
  simulateLoadingSteps();
  try {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const options = currentPage?.$page?.options || currentPage?.options || {};
    const diagnosisId = options.diagnosisId;
    const sessionId = options.sessionId;

    let res;
    if (diagnosisId) {
      res = await reviewStore.fetchDiagnosis({ diagnosisId });
    } else if (sessionId) {
      res = await reviewStore.fetchDiagnosis({ sessionId });
    }

    if (res && res.success && res.data) {
      diagnosis.value = res.data.diagnosis || {};
      stats.value = res.data.stats || {};
    }

    // 获取待复习数量
    const planRes = await reviewStore.fetchReviewPlan();
    if (planRes && planRes.success && planRes.data) {
      reviewCount.value = planRes.data.reviewPlan?.totalPending || 0;
    }
  } catch (e) {
    logger.warn('[DiagnosisReport] 加载失败:', e);
    // [AUDIT FIX R135] 加载失败时给用户明确提示，而不是展示空白页面
    loadFailed.value = true;
    toast.error('诊断报告加载失败，请返回重试');
  } finally {
    loading.value = false;
    // 数据加载完成后触发动画
    await nextTick();
    const accuracy = diagnosis.value.accuracy || 0;
    animateNumber(accuracy);
    drawScoreRing(accuracy);
    staggerReveal();
  }
}

// [AUDIT FIX R135] 重试加载
function retryLoad() {
  loadFailed.value = false;
  loadReport();
}

function startSmartReview() {
  uni.navigateTo({ url: '/pages/practice-sub/smart-review' });
}

function startTargetedLesson() {
  const topWeak = weakPoints.value[0];
  if (topWeak) {
    uni.navigateTo({
      url: `/pages/ai-classroom/index?autoCreate=true&topic=${encodeURIComponent(topWeak.knowledgePoint)}&subject=professional`
    });
  }
}

function shareReport() {
  toast.info('长按页面可截图分享');
}

function goBack() {
  safeNavigateBack({ delta: 2 });
}

onMounted(() => {
  // [AUDIT FIX R135] 使用统一工具函数获取状态栏高度
  statusBarHeight.value = getStatusBarHeight();
  loadReport();
});

// [AUDIT FIX R135] 页面卸载时清理所有待执行的定时器，防止内存泄漏
onBeforeUnmount(() => {
  pendingTimers.forEach(clearTimeout);
  pendingTimers.length = 0;
});
</script>

<style scoped>
/* [AUDIT FIX R135] px→rpx 响应式适配 */
.diagnosis-container {
  min-height: 100vh;
  background: linear-gradient(180deg, var(--background) 0%, var(--page-gradient-mid) 50%, var(--background) 100%);
  padding-bottom: env(safe-area-inset-bottom);
  --bg-card: rgba(255, 255, 255, 0.06);
  --green: var(--success);
  --orange: var(--warning);
  --red: var(--danger);
  --blue: var(--primary);
}

/* 顶部导航 */
.top-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 16rpx 32rpx;
  backdrop-filter: saturate(180%) blur(20px);
  background: rgba(10, 10, 15, 0.72);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.back-icon {
  width: 48rpx;
  height: 48rpx;
  opacity: 0.7;
}
.nav-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
}
.nav-action {
  font-size: 28rpx;
  color: var(--green);
}

/* 沉浸式加载 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 360rpx;
}
.loading-brain {
  position: relative;
  width: 200rpx;
  height: 200rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.brain-ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid transparent;
}
.ring-1 {
  width: 160rpx;
  height: 160rpx;
  border-top-color: var(--green);
  border-right-color: rgba(52, 199, 89, 0.3);
  animation: spin 2s linear infinite;
}
.ring-2 {
  width: 120rpx;
  height: 120rpx;
  border-bottom-color: var(--blue);
  border-left-color: rgba(50, 173, 230, 0.3);
  animation: spin 1.5s linear infinite reverse;
}
.ring-3 {
  width: 80rpx;
  height: 80rpx;
  border-top-color: var(--orange);
  border-right-color: rgba(255, 159, 10, 0.3);
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.brain-icon {
  font-size: 56rpx;
  z-index: 1;
}
.loading-title {
  margin-top: 56rpx;
  font-size: 32rpx;
  font-weight: 500;
  color: var(--text-primary);
  transition: opacity 0.3s;
}
.loading-steps {
  margin-top: 64rpx;
  display: flex;
  flex-direction: column;
  /* gap: 24rpx; */
}
.loading-steps > view + view {
  margin-top: 24rpx;
}
.step-item {
  display: flex;
  align-items: center;
  /* gap: 20rpx; */
  opacity: 0.3;
  transition: opacity 0.4s ease;
}
.step-item > view + view {
  margin-left: 20rpx;
}
.step-item.active {
  opacity: 1;
}
.step-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  transition: background 0.4s;
}
.step-item.active .step-dot {
  background: var(--green);
  box-shadow: 0 0 8px rgba(52, 199, 89, 0.5);
}
.step-text {
  font-size: 26rpx;
  color: var(--text-secondary);
}

/* 报告滚动区 */
.report-scroll {
  padding: 160rpx 32rpx 80rpx;
}

/* 渐进式展示动画 */
.animate-in {
  animation: slideUp 0.5s ease-out both;
}
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 玻璃卡片 */
.apple-glass-card {
  background: var(--bg-card);
  border-radius: 32rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border: 0.5px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
}

/* 总览卡片 */
.overview-card {
  display: flex;
  align-items: center;
  /* gap: 40rpx; */
  padding: 40rpx;
}
.overview-card > view + view {
  margin-left: 40rpx;
}
.score-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.ring-container {
  position: relative;
  width: 200rpx;
  height: 200rpx;
}
.score-canvas {
  width: 200rpx;
  height: 200rpx;
}
.ring-center {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.score-number {
  font-size: 60rpx;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.score-unit {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 8rpx;
  margin-left: 2rpx;
}
.score-label {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 12rpx;
}
.overview-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  /* gap: 24rpx; */
}
.overview-right > view + view {
  margin-top: 24rpx;
}
.level-badge {
  align-self: flex-start;
  padding: 8rpx 24rpx;
  border-radius: 24rpx;
}
.level-excellent {
  background: rgba(52, 199, 89, 0.2);
}
.level-good {
  background: rgba(50, 173, 230, 0.2);
}
.level-average {
  background: rgba(255, 159, 10, 0.2);
}
.level-weak {
  background: rgba(255, 69, 58, 0.2);
}
.level-text {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-primary);
}
.mini-stats {
  display: flex;
  gap: 0;
}
.mini-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16rpx 0;
  border-right: 0.5px solid rgba(255, 255, 255, 0.06);
}
.mini-stat:last-child {
  border-right: none;
}
.mini-value {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.mini-value.correct {
  color: var(--green);
}
.mini-value.wrong {
  color: var(--red);
}
.mini-label {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}

/* 区块标题 */
.section {
  margin-top: 48rpx;
}
.section-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
}
.section-sub {
  font-size: 24rpx;
  color: var(--text-secondary);
  display: block;
  margin-top: 8rpx;
  margin-bottom: 24rpx;
}

/* 错误模式洞察 */
.pattern-card {
  margin-top: 16rpx;
}
.pattern-header {
  display: flex;
  align-items: center;
  /* gap: 16rpx; */
  margin-bottom: 16rpx;
}
.pattern-header > view + view {
  margin-left: 16rpx;
}
.pattern-icon {
  font-size: 36rpx;
}
.pattern-type {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}
.pattern-count {
  font-size: 24rpx;
  color: var(--orange);
  background: rgba(255, 159, 10, 0.12);
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
}
.pattern-desc {
  font-size: 26rpx;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 12rpx;
}
.pattern-fix {
  font-size: 26rpx;
  color: var(--green);
  line-height: 1.5;
}

/* 薄弱知识点 */
.weak-card {
  position: relative;
  overflow: hidden;
  animation: fadeSlideIn 0.4s ease-out both;
}
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.severity-high {
  border-left: 3px solid var(--red);
}
.severity-medium {
  border-left: 3px solid var(--orange);
}
.severity-low {
  border-left: 3px solid var(--blue);
}
.weak-header {
  display: flex;
  align-items: center;
  /* gap: 16rpx; */
  margin-bottom: 16rpx;
}
.weak-header > view + view {
  margin-left: 16rpx;
}
.severity-indicator {
  position: relative;
  width: 20rpx;
  height: 20rpx;
}
.severity-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  position: absolute;
  top: 2rpx;
  left: 2rpx;
}
.severity-pulse {
  position: absolute;
  top: -4rpx;
  left: -4rpx;
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  opacity: 0;
}
.severity-high .severity-dot {
  background: var(--red);
}
.severity-high .severity-pulse {
  background: var(--red);
  animation: pulseGlow 2s infinite;
}
.severity-medium .severity-dot {
  background: var(--orange);
}
.severity-low .severity-dot {
  background: var(--blue);
}
@keyframes pulseGlow {
  0%,
  100% {
    opacity: 0;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(1.8);
  }
}
.weak-name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}
.severity-tag {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
}
.tag-high {
  background: rgba(255, 69, 58, 0.15);
  color: var(--red);
}
.tag-medium {
  background: rgba(255, 159, 10, 0.15);
  color: var(--orange);
}
.tag-low {
  background: rgba(50, 173, 230, 0.15);
  color: var(--blue);
}
.weak-mastery {
  margin-bottom: 16rpx;
  display: flex;
  align-items: center;
  /* gap: 16rpx; */
}
.weak-mastery > view + view {
  margin-left: 16rpx;
}
.mastery-track {
  flex: 1;
  height: 8rpx;
  border-radius: 4rpx;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.mastery-fill {
  height: 100%;
  border-radius: 4rpx;
  background: var(--orange);
  transition: width 0.8s ease;
}
.mastery-text {
  font-size: 22rpx;
  color: var(--text-secondary);
  white-space: nowrap;
}
.weak-pattern {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-bottom: 12rpx;
  line-height: 1.4;
}
.weak-suggestion {
  font-size: 26rpx;
  color: var(--green);
  line-height: 1.4;
}

/* 掌握较好 */
.strong-list {
  display: flex;
  flex-wrap: wrap;
  /* gap: 16rpx; */
  margin-top: 24rpx;
}
.strong-list > view {
  margin-right: 16rpx;
  margin-bottom: 16rpx;
}
.strong-tag {
  display: flex;
  align-items: center;
  /* gap: 8rpx; */
  padding: 12rpx 24rpx;
  border-radius: 24rpx;
  background: rgba(52, 199, 89, 0.1);
  border: 0.5px solid rgba(52, 199, 89, 0.2);
  animation: fadeSlideIn 0.3s ease-out both;
}
.strong-tag > view + view {
  margin-left: 8rpx;
}
.strong-check {
  font-size: 24rpx;
  color: var(--green);
}
.strong-text {
  font-size: 26rpx;
  color: var(--green);
}

/* 各科表现 */
.bar-item {
  margin-bottom: 28rpx;
}
.bar-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.bar-name {
  font-size: 26rpx;
  color: var(--text-primary);
}
.bar-percent {
  font-size: 26rpx;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.text-good {
  color: var(--green);
}
.text-mid {
  color: var(--orange);
}
.text-bad {
  color: var(--red);
}
.bar-track {
  height: 12rpx;
  border-radius: 6rpx;
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 6rpx;
  transition: width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.fill-good {
  background: linear-gradient(90deg, var(--success), var(--wise-green));
}
.fill-mid {
  background: linear-gradient(90deg, var(--warning), var(--warning-light, #ffb340));
}
.fill-bad {
  background: linear-gradient(90deg, var(--danger), var(--danger-light, #ff6961));
}

/* AI学习建议 */
.plan-card {
  padding: 0;
  overflow: hidden;
}
.plan-row {
  display: flex;
  align-items: flex-start;
  /* gap: 24rpx; */
  padding: 28rpx 32rpx;
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.04);
}
.plan-row > view + view {
  margin-left: 24rpx;
}
.plan-row:last-child {
  border-bottom: none;
}
.plan-icon {
  font-size: 40rpx;
  margin-top: 4rpx;
}
.plan-content {
  flex: 1;
}
.plan-label {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  margin-bottom: 8rpx;
}
.plan-text {
  font-size: 26rpx;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* 鼓励语 */
.encouragement {
  text-align: center;
  padding: 48rpx 0;
}
.encourage-text {
  font-size: 30rpx;
  color: var(--green);
  font-weight: 500;
}

/* 底部操作 */
.bottom-actions {
  padding: 40rpx 0 80rpx;
  display: flex;
  flex-direction: column;
  /* gap: 20rpx; */
}
.bottom-actions > view + view {
  margin-top: 20rpx;
}
.btn-primary {
  background: linear-gradient(135deg, var(--success), var(--wise-green));
  color: var(--text-inverse);
  border: none;
  border-radius: 28rpx;
  height: 96rpx;
  font-size: 32rpx;
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(52, 199, 89, 0.3);
}
.btn-secondary {
  background: rgba(52, 199, 89, 0.12);
  color: var(--green);
  border: 0.5px solid rgba(52, 199, 89, 0.2);
  border-radius: 28rpx;
  height: 88rpx;
  font-size: 30rpx;
}
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: none;
  height: 80rpx;
  font-size: 28rpx;
}

/* [AUDIT FIX R135] 加载失败状态样式 */
.fail-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
  padding: 80rpx 40rpx;
}
.fail-icon {
  font-size: 128rpx;
  margin-bottom: 32rpx;
}
.fail-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16rpx;
}
.fail-desc {
  font-size: 28rpx;
  color: var(--text-secondary);
  margin-bottom: 48rpx;
}
.fail-retry {
  padding: 20rpx 64rpx;
  background: var(--success-dark);
  border-radius: 40rpx;
}
.fail-retry-text {
  color: var(--text-inverse);
  font-size: 30rpx;
  font-weight: 500;
}
</style>
