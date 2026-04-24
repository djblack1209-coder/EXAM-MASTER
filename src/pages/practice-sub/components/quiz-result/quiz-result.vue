<template>
  <view v-if="visible" class="result-overlay" :class="{ 'dark-mode': isDark }" @tap.stop>
    <view class="result-container">
      <!-- 完美得分庆祝：confetti-burst + star-sparkle 叠加动画（100%正确率触发，2.5s后淡出） -->
      <view v-if="showCelebration && accuracy >= 100" class="celebration-overlay" @animationend="onCelebrationEnd">
        <image class="celebration-confetti" src="../../static/effects/confetti-burst.png" mode="aspectFit" lazy-load />
        <image class="celebration-sparkle" :src="getAssetUrl('effects', 'star-sparkle')" mode="aspectFit" lazy-load />
      </view>

      <!-- 顶部关闭 -->
      <view class="result-top-bar">
        <text class="result-title">练习报告</text>
        <view class="close-btn" hover-class="item-hover" @tap="emit('close')">
          <text>
            <BaseIcon name="close" :size="24" />
          </text>
        </view>
      </view>

      <scroll-view scroll-y class="result-scroll">
        <!-- 高分庆祝：star-sparkle 闪烁（80%~99% 正确率） -->
        <view
          v-if="showHighScore && accuracy >= 80 && accuracy < 100"
          class="highscore-celebration"
          @animationend="onHighScoreEnd"
        >
          <image class="highscore-sparkle" :src="getAssetUrl('effects', 'star-sparkle')" mode="aspectFit" lazy-load />
          <text class="celebration-emoji">🎉</text>
        </view>

        <!-- 正确率圆环 -->
        <view class="accuracy-section">
          <view class="ring-wrap">
            <view class="ring-bg" />
            <view class="ring-progress" :style="ringStyle" />
            <view class="ring-center">
              <text class="ring-number">{{ displayAccuracy }}</text>
              <text class="ring-unit">%</text>
            </view>
          </view>
          <text class="accuracy-label">正确率</text>
        </view>

        <!-- 统计行 -->
        <view class="stats-row">
          <view class="stat-item">
            <text class="stat-value">{{ totalCount }}</text>
            <text class="stat-label">总题数</text>
          </view>
          <view class="stat-divider" />
          <view class="stat-item">
            <text class="stat-value correct-text">{{ correctCount }}</text>
            <text class="stat-label">正确</text>
          </view>
          <view class="stat-divider" />
          <view class="stat-item">
            <text class="stat-value wrong-text">{{ wrongCount }}</text>
            <text class="stat-label">错误</text>
          </view>
          <view class="stat-divider" />
          <view class="stat-item">
            <text class="stat-value">{{ avgTimeDisplay }}</text>
            <text class="stat-label">平均用时</text>
          </view>
        </view>

        <!-- 分类正确率 -->
        <view v-if="categoryBreakdown.length > 0" class="category-section glass-card">
          <text class="section-title">分类正确率</text>
          <view v-for="cat in categoryBreakdown" :key="cat.name" class="cat-row">
            <text class="cat-name">{{ cat.name }}</text>
            <view class="cat-bar-bg">
              <view class="cat-bar-fill" :style="{ width: cat.accuracy + '%' }" />
            </view>
            <text class="cat-pct">{{ cat.accuracy }}%</text>
          </view>
        </view>

        <!-- 激励文案 -->
        <view class="motivational glass-card">
          <text class="motivational-text">{{ motivationalText }}</text>
        </view>

        <!-- AI 推荐下一步 -->
        <view v-if="nextSteps.length > 0 || loadingNextSteps" class="next-steps glass-card">
          <text class="section-title">AI 推荐下一步</text>
          <view v-if="loadingNextSteps" class="next-steps-loading">
            <text class="loading-text">分析中...</text>
          </view>
          <view v-else>
            <view
              v-for="(step, idx) in nextSteps"
              :key="idx"
              class="next-step-item"
              hover-class="item-hover"
              @tap="handleNextStep(step)"
            >
              <view class="step-indicator" :class="[step.priority]" />
              <view class="step-content">
                <text class="step-title">{{ step.title }}</text>
                <text class="step-subtitle">{{ step.subtitle }}</text>
              </view>
              <text class="step-arrow">
                <BaseIcon name="chevron-right" :size="24" />
              </text>
            </view>
          </view>
        </view>

        <!-- 卡通勾选图标装饰（答题完成标志）— [AUDIT R432] checkmark-circle.png 不存在，改用 emoji -->
        <view v-if="accuracy >= 60" style="text-align: center; margin-bottom: 16rpx">
          <text class="feature-cartoon-icon" style="font-size: 60rpx">✅</text>
        </view>

        <!-- 操作按钮 -->
        <view class="action-row">
          <button
            v-if="hasNextRecommendation"
            class="action-btn primary-btn"
            hover-class="btn-hover"
            @tap="emit('continueNext')"
          >
            继续刷下一组
          </button>
          <button
            :class="['action-btn', hasNextRecommendation ? 'secondary-btn' : 'primary-btn']"
            hover-class="btn-hover"
            @tap="emit('viewReport')"
          >
            查看诊断报告
          </button>
          <button class="action-btn secondary-btn" hover-class="btn-hover" @tap="emit('close')">返回</button>
        </view>

        <!-- XP 金币飞出动画 -->
        <view v-if="showXpCoins && accuracy > 0" class="xp-coins-flyout" @animationend="onXpCoinsEnd">
          <image class="xp-coins-img" src="../../static/effects/xp-coins.png" mode="aspectFit" lazy-load />
          <text class="xp-coins-label">+XP</text>
        </view>

        <view class="bottom-safe" />
      </scroll-view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { animateNumber } from '../../utils/micro-interactions.js';
import { useStudyEngineStore } from '@/stores/modules/study-engine.js';
// 静态资源 CDN 映射（大图已迁出主包）
import { getAssetUrl } from '@/config/static-assets.js';

const studyEngineStore = useStudyEngineStore();

const props = defineProps({
  visible: { type: Boolean, default: false },
  questions: { type: Array, default: () => [] },
  answeredQuestions: { type: Array, default: () => [] },
  totalTime: { type: Number, default: 0 },
  isDark: { type: Boolean, default: false },
  // AI诊断摘要（由do-quiz传入，替代假激励文案）
  diagnosisSummary: { type: String, default: '' },
  // 是否有AI推荐的下一组题
  hasNextRecommendation: { type: Boolean, default: false }
});

const emit = defineEmits([
  'viewReport',
  'close',
  'goMistakes',
  'goWeakTraining',
  'goNewPractice',
  'goAIPlan',
  'continueNext'
]);

// --- 基础统计 ---
const totalCount = computed(() => props.questions.length);
const correctCount = computed(() => props.answeredQuestions.filter((a) => a.isCorrect).length);
const wrongCount = computed(() => totalCount.value - correctCount.value);
const accuracy = computed(() => {
  if (totalCount.value === 0) return 0;
  return Math.round((correctCount.value / totalCount.value) * 100);
});

const avgTimeDisplay = computed(() => {
  if (props.answeredQuestions.length === 0) return '0s';
  const totalMs = props.answeredQuestions.reduce((sum, a) => sum + (a.timeSpent || 0), 0);
  const avgSec = Math.round(totalMs / props.answeredQuestions.length / 1000);
  return avgSec >= 60 ? `${Math.floor(avgSec / 60)}m${avgSec % 60}s` : `${avgSec}s`;
});

// --- 动画数字 ---
const displayAccuracy = ref(0);
let animHandle = null;

// --- 特效动画状态（animationend 后从 DOM 移除） ---
const showCelebration = ref(true);
const showHighScore = ref(true);
const showXpCoins = ref(true);

/** 完美得分庆祝动画结束 — 从 DOM 移除 */
function onCelebrationEnd() {
  showCelebration.value = false;
}

/** 高分庆祝动画结束 — 从 DOM 移除 */
function onHighScoreEnd() {
  showHighScore.value = false;
}

/** XP 金币飞出动画结束 — 从 DOM 移除 */
function onXpCoinsEnd() {
  showXpCoins.value = false;
}

// --- AI 推荐下一步 ---
const nextSteps = ref([]);
const loadingNextSteps = ref(false);

/** 根据本次做题表现生成推荐列表 */
async function loadNextSteps() {
  loadingNextSteps.value = true;
  try {
    const steps = [];

    // 规则1：有错题 → 推荐去错题本
    if (wrongCount.value > 0) {
      steps.push({
        icon: 'note',
        title: '复习错题',
        subtitle: `本次答错 ${wrongCount.value} 题，趁热打铁`,
        action: 'mistakes',
        priority: 'high'
      });
    }

    // 规则2：正确率低于60% → 推荐薄弱点训练
    if (accuracy.value < 60) {
      const weakest =
        categoryBreakdown.value.length > 0 ? categoryBreakdown.value[categoryBreakdown.value.length - 1] : null;
      steps.push({
        icon: 'target',
        title: weakest ? `强化: ${weakest.name}` : '薄弱点专练',
        subtitle: weakest ? `正确率仅${weakest.accuracy}%，建议针对训练` : '集中突破薄弱知识点',
        action: 'weak-training',
        priority: 'high'
      });
    }

    // 规则3：正确率高于80% → 推荐挑战更难的
    if (accuracy.value >= 80) {
      steps.push({
        icon: 'award',
        title: '挑战新题',
        subtitle: '正确率不错！试试更高难度',
        action: 'new-practice',
        priority: 'normal'
      });
    }

    // 规则4：尝试调用后端获取更智能的推荐（静默降级）
    try {
      const result = await studyEngineStore.analyzeMastery();
      if (result?.data?.summary?.weakestPoint) {
        const weak = result.data.summary;
        steps.unshift({
          icon: 'sparkle',
          title: `AI建议: 攻克${weak.weakestPoint}`,
          subtitle: `${weak.weakCount}个薄弱点待突破，平均掌握度${weak.avgMastery}%`,
          action: 'ai-plan',
          priority: 'urgent'
        });
      }
    } catch {
      // 后端调用失败，静默降级（只用本地规则）
    }

    // 最多显示3条
    nextSteps.value = steps.slice(0, 3);
  } finally {
    loadingNextSteps.value = false;
  }
}

/** 点击推荐项，触发对应事件 */
function handleNextStep(step) {
  switch (step.action) {
    case 'mistakes':
      emit('goMistakes');
      break;
    case 'weak-training':
      emit('goWeakTraining');
      break;
    case 'new-practice':
      emit('goNewPractice');
      break;
    case 'ai-plan':
      emit('goAIPlan');
      break;
  }
}

// --- 动画延迟定时器 ---
let _animDelayTimer = null;

watch(
  () => props.visible,
  (val) => {
    // 清理上一次的延迟定时器（防止快速切换导致泄漏）
    if (_animDelayTimer) {
      clearTimeout(_animDelayTimer);
      _animDelayTimer = null;
    }
    if (val) {
      // 重置特效动画状态（允许重新触发）
      showCelebration.value = true;
      showHighScore.value = true;
      showXpCoins.value = true;
      displayAccuracy.value = 0;
      _animDelayTimer = setTimeout(() => {
        _animDelayTimer = null;
        if (animHandle) animHandle.cancel();
        animHandle = animateNumber(0, accuracy.value, 1200, (v) => {
          displayAccuracy.value = v;
        });
      }, 300);
      // 异步加载 AI 推荐下一步
      loadNextSteps();
    }
  },
  { immediate: true }
);

onUnmounted(() => {
  if (_animDelayTimer) {
    clearTimeout(_animDelayTimer);
    _animDelayTimer = null;
  }
  if (animHandle) animHandle.cancel();
});

// --- 圆环样式 ---
const ringStyle = computed(() => {
  const deg = (displayAccuracy.value / 100) * 360;
  const color = accuracy.value >= 60 ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)';
  return {
    background: `conic-gradient(${color} ${deg}deg, transparent ${deg}deg)`
  };
});

// --- 分类统计 ---
const categoryBreakdown = computed(() => {
  const map = {};
  props.answeredQuestions.forEach((a, idx) => {
    const q = props.questions[a.index ?? idx];
    if (!q) return;
    const cat = q.category || '未分类';
    if (!map[cat]) map[cat] = { total: 0, correct: 0 };
    map[cat].total++;
    if (a.isCorrect) map[cat].correct++;
  });
  return Object.entries(map)
    .map(([name, d]) => ({
      name,
      accuracy: d.total > 0 ? Math.round((d.correct / d.total) * 100) : 0
    }))
    .sort((a, b) => b.accuracy - a.accuracy);
});

// --- 激励文案 — 优先使用真实AI诊断，降级到本地规则 ---
const motivationalText = computed(() => {
  // 有真实 AI 诊断数据时使用（由 do-quiz.vue 的 autoDiagnose 传入）
  if (props.diagnosisSummary) return props.diagnosisSummary;

  // 降级：基于本次表现的本地规则文案
  if (accuracy.value >= 90) {
    const weakCat = categoryBreakdown.value.find((c) => c.accuracy < 80);
    return weakCat
      ? `整体表现很棒！「${weakCat.name}」还可以再提升，建议针对训练。`
      : '全面发挥出色，继续保持这个节奏！';
  }
  if (accuracy.value >= 70) {
    const worst =
      categoryBreakdown.value.length > 0 ? categoryBreakdown.value[categoryBreakdown.value.length - 1] : null;
    return worst
      ? `不错的表现！「${worst.name}」正确率${worst.accuracy}%是主要失分点，建议重点复习。`
      : `正确率${accuracy.value}%，基础不错，继续巩固！`;
  }
  if (accuracy.value >= 50) {
    return `正确率${accuracy.value}%，还有提升空间。建议先复习错题，再做针对性练习。`;
  }
  return `这组题有挑战性，正确率${accuracy.value}%。别灰心，重点攻克薄弱知识点后会有明显进步！`;
});
</script>

<style lang="scss" scoped>
.result-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  background: var(--bg-secondary);
  animation: resultSlideUp 0.45s cubic-bezier(0.22, 0.68, 0, 1.1);
}
@keyframes resultSlideUp {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}
.result-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

/* ==================== 完美得分庆祝叠加动画 ==================== */
.celebration-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 400rpx;
  z-index: 0;
  pointer-events: none;
  animation: celebration-fadeout 2.5s ease-out forwards;
}
.celebration-confetti {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 360rpx;
  height: 360rpx;
  animation: confetti-pop 2.5s ease-out forwards;
}
.celebration-sparkle {
  position: absolute;
  top: 40rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 240rpx;
  height: 240rpx;
  animation: sparkle-twinkle 2.5s ease-in-out forwards;
}
@keyframes celebration-fadeout {
  0% {
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  75% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
@keyframes confetti-pop {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0.2) rotate(-15deg);
  }
  20% {
    opacity: 1;
    transform: translateX(-50%) scale(1.3) rotate(5deg);
  }
  50% {
    transform: translateX(-50%) scale(1) rotate(-2deg);
  }
  75% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) scale(0.9) translateY(40rpx);
  }
}
@keyframes sparkle-twinkle {
  0% {
    opacity: 0;
    transform: translateX(-50%) scale(0.4) rotate(0deg);
  }
  20% {
    opacity: 1;
    transform: translateX(-50%) scale(1.2) rotate(30deg);
  }
  40% {
    transform: translateX(-50%) scale(0.95) rotate(60deg);
  }
  60% {
    opacity: 1;
    transform: translateX(-50%) scale(1.1) rotate(120deg);
  }
  80% {
    opacity: 0.8;
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) scale(0.8) rotate(180deg);
  }
}

/* ==================== 高分庆祝（80%~99%） ==================== */
.highscore-celebration {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16rpx;
  animation: highscore-appear 2s ease-out forwards;
}
.highscore-sparkle {
  width: 120rpx;
  height: 120rpx;
  animation: sparkle-twinkle 2s ease-in-out forwards;
}
.celebration-emoji {
  font-size: 80rpx;
  animation: celebration-bounce 0.8s ease-out;
}
@keyframes highscore-appear {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  30% {
    opacity: 1;
    transform: scale(1.1);
  }
  60% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.9) translateY(-10rpx);
  }
}
.result-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 40rpx;
  padding-top: calc(24rpx + env(safe-area-inset-top, 44px));
  background: var(--bg-card);
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);
}
.result-title {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.close-btn {
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-tertiary, #f5f5f5);
  font-size: 28rpx;
  color: var(--text-tertiary);
}
.result-scroll {
  flex: 1;
  padding: 0 40rpx;
}

/* 高分庆祝弹跳 */
@keyframes celebration-bounce {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  50% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* ==================== XP 金币飞出动画 ==================== */
.xp-coins-flyout {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16rpx auto;
  pointer-events: none;
  animation: xp-coins-fly 1.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
.xp-coins-img {
  width: 56rpx;
  height: 56rpx;
  margin-right: 8rpx;
}
.xp-coins-label {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--warning, #ff9600);
  text-shadow: 0 2rpx 8rpx rgba(255, 215, 0, 0.5);
}
@keyframes xp-coins-fly {
  0% {
    opacity: 0;
    transform: translateY(40rpx) scale(0.5);
  }
  25% {
    opacity: 1;
    transform: translateY(0) scale(1.2);
  }
  50% {
    transform: translateY(-20rpx) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateY(-80rpx) scale(0.8);
  }
}

/* ==================== 暗色模式特效降低亮度 ==================== */
.dark-mode .celebration-overlay,
.dark-mode .highscore-celebration,
.dark-mode .xp-coins-flyout {
  opacity: 0.85;
}

/* 圆环 */
.accuracy-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 0 40rpx;
}
.ring-wrap {
  width: 280rpx;
  height: 280rpx;
  position: relative;
  border-radius: 50%;
}
.ring-bg {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--bg-secondary, #e5e7eb);
}
.ring-progress {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  mask: radial-gradient(transparent 55%, black 56%);
  -webkit-mask: radial-gradient(transparent 55%, black 56%);
  transition: background 0.1s;
}
.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.ring-number {
  font-size: 80rpx;
  font-weight: 900;
  color: var(--text-primary);
  line-height: 1;
}
.ring-unit {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-tertiary);
  margin-top: 16rpx;
}
.accuracy-label {
  font-size: 28rpx;
  color: var(--text-tertiary);
  margin-top: 16rpx;
}

/* 统计行 */
.stats-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 32rpx;
  padding: 32rpx 20rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}
.stat-value {
  font-size: 40rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.stat-label {
  font-size: 22rpx;
  color: var(--text-tertiary);
  margin-top: 8rpx;
}
.stat-divider {
  width: 1px;
  height: 48rpx;
  background: var(--border);
}
.correct-text {
  color: #58cc02;
}
.wrong-text {
  color: var(--danger);
}

/* 分类 */
.glass-card {
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 32rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.section-title {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 24rpx;
  display: block;
}
.cat-row {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}
.cat-row:last-child {
  margin-bottom: 0;
}
.cat-name {
  font-size: 24rpx;
  color: var(--text-tertiary);
  width: 120rpx;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cat-bar-bg {
  flex: 1;
  height: 20rpx;
  background: var(--bg-secondary);
  border-radius: 10rpx;
  margin: 0 16rpx;
  overflow: hidden;
}
.cat-bar-fill {
  height: 100%;
  border-radius: 10rpx;
  transition: width 0.8s ease-out;
  background: linear-gradient(90deg, #1cb0f6, #58cc02);
}
.cat-pct {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-primary);
  width: 80rpx;
  text-align: right;
}

/* 激励 */
.motivational {
  text-align: center;
}
.motivational-text {
  font-size: 28rpx;
  color: var(--text-primary);
  line-height: 1.6;
}

/* 按钮 */
.action-row {
  display: flex;
  flex-direction: column;
  padding: 16rpx 0;
}
.action-btn {
  width: 100%;
  border-radius: 24rpx;
  padding: 28rpx 0;
  font-size: 30rpx;
  font-weight: bold;
  border: none;
  margin-bottom: 20rpx;
}
.primary-btn {
  background: #1cb0f6;
  color: var(--text-inverse);
  box-shadow: 0 6rpx 0 #1899d6;
  border-radius: 20rpx;
}
.secondary-btn {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 2rpx solid rgba(0, 0, 0, 0.08);
  box-shadow: 0 4rpx 0 #e0e0e0;
  border-radius: 20rpx;
}
.btn-hover {
  transform: translateY(4rpx);
  opacity: 0.9;
  box-shadow: none;
}
.item-hover {
  opacity: 0.7;
}
/* 卡通图标通用样式 */
.feature-cartoon-icon {
  width: 80rpx;
  height: 80rpx;
}
.bottom-safe {
  height: 60rpx;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
