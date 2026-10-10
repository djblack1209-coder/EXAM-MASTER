<template>
  <view v-if="visible" class="result-overlay" :class="{ 'dark-mode': isDark }" @tap.stop>
    <view class="result-container">
      <!-- 完美得分庆祝：纯CSS动画（100%正确率触发，2.5s后淡出） -->
      <view v-if="showCelebration && accuracy >= 100" class="celebration-overlay" @animationend="onCelebrationEnd">
        <view class="celebration-mark">
          <BaseIcon name="award" :size="56" />
        </view>
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
          <view class="celebration-mark small">
            <BaseIcon name="sparkle" :size="44" />
          </view>
        </view>

        <!-- 正确率圆环 -->
        <view class="accuracy-section">
          <view class="ring-wrap">
            <view class="ring-bg" />
            <view v-if="gradedCount > 0" class="ring-progress" :style="ringStyle" />
            <view class="ring-center">
              <text class="ring-number">{{ gradedCount > 0 ? displayAccuracy : neutralCount }}</text>
              <text v-if="gradedCount > 0" class="ring-unit">%</text>
            </view>
          </view>
          <text class="accuracy-label">{{
            pendingCount > 0
              ? '已记录，待核对'
              : reviewedCount === answeredCount && answeredCount > 0
                ? '已查看/自评'
                : legacyCount > 0
                  ? '历史记录'
                  : '暂未判分'
          }}</text>
        </view>

        <!-- 统计行 -->
        <view class="stats-row">
          <view class="stat-item">
            <text class="stat-value">{{ answeredCount }}</text>
            <text class="stat-label">已完成</text>
          </view>
          <view class="stat-divider" />
          <view class="stat-item">
            <text class="stat-value">{{ progressSummary.legacyCorrectCount }}</text>
            <text class="stat-label">旧判对</text>
          </view>
          <view class="stat-divider" />
          <view class="stat-item">
            <text class="stat-value">{{ progressSummary.legacyWrongCount }}</text>
            <text class="stat-label">旧判错</text>
          </view>
          <view class="stat-divider" />
          <view class="stat-item">
            <text class="stat-value">{{ neutralCount > 0 ? neutralCount : avgTimeDisplay }}</text>
            <text class="stat-label">{{
              pendingCount > 0
                ? '未判分'
                : reviewedCount === answeredCount && answeredCount > 0
                  ? '已查看/自评'
                  : '已记录'
            }}</text>
          </view>
        </view>

        <view v-if="legacyCount" class="motivational glass-card">
          <text
            >旧判对比例 {{ progressSummary.legacyAccuracy }}%（{{ progressSummary.legacyCorrectCount }}/{{
              legacyCount
            }}），不代表可靠判分。</text
          >
        </view>

        <!-- 分类正确率 -->
        <view v-if="categoryBreakdown.length > 0" class="category-section glass-card">
          <text class="section-title">分类记录</text>
          <view v-for="cat in categoryBreakdown" :key="cat.name" class="cat-row">
            <text class="cat-name">{{ cat.name }}</text>
            <view class="cat-bar-bg">
              <view
                class="cat-bar-fill"
                :class="{ reviewed: cat.graded === 0 }"
                :style="{ width: (cat.graded > 0 ? cat.accuracy : 100) + '%' }"
              />
            </view>
            <text class="cat-pct">{{ cat.label }}</text>
          </view>
        </view>

        <!-- 激励文案 -->
        <view class="motivational glass-card">
          <text class="motivational-text">{{ motivationalText }}</text>
        </view>

        <!-- 本地学习记录生成的建议 -->
        <view v-if="nextSteps.length > 0 || loadingNextSteps" class="next-steps glass-card">
          <text class="section-title">下一步学习建议</text>
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

        <view v-if="accuracy >= 60" class="completion-mark">
          <BaseIcon name="check-circle" :size="48" />
        </view>

        <!-- XP 金币飞出动画 -->
        <view v-if="showXpCoins && accuracy > 0" class="xp-coins-flyout" @animationend="onXpCoinsEnd">
          <image class="xp-coins-img" src="../../static/effects/xp-coins.png" mode="aspectFit" lazy-load />
          <text class="xp-coins-label">+XP</text>
        </view>

        <view class="bottom-safe" />
      </scroll-view>

      <!-- 操作按钮 -->
      <view class="action-dock">
        <button
          v-if="hasNextRecommendation && gradedCount > 0"
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
          {{ gradedCount > 0 ? '查看诊断报告' : '查看学习记录' }}
        </button>
        <button class="action-btn tertiary-btn" hover-class="btn-hover" @tap="emit('close')">返回</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { animateNumber } from '../../utils/micro-interactions.js';
import { useStudyEngineStore } from '@/stores/modules/study-engine.js';
import { summarizeQuizProgress } from '@/services/quiz-session-contract.js';
// 静态资源 CDN 映射（大图已迁出主包）
import { getAssetUrl } from '@/config/static-assets.js';
import { logger } from '@/utils/logger.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

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
const progressSummary = computed(() =>
  summarizeQuizProgress({
    questions: props.questions,
    answeredQuestions: props.answeredQuestions
  })
);
const answeredCount = computed(() => progressSummary.value.answeredCount);
const wrongCount = computed(() => progressSummary.value.wrongCount);
const neutralCount = computed(() => progressSummary.value.neutralCount);
const pendingCount = computed(() => progressSummary.value.pendingCount);
const reviewedCount = computed(() => progressSummary.value.reviewedCount);
const legacyCount = computed(() => progressSummary.value.legacyGradedCount);
const gradedCount = computed(() => progressSummary.value.gradedCount);
const accuracy = computed(() => {
  return progressSummary.value.accuracy;
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

// --- 分类统计 ---
const categoryBreakdown = computed(() => {
  const map = new Map();
  for (const answer of props.answeredQuestions) {
    const name = props.questions[answer.index]?.category || '未分类';
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(answer);
  }
  return [...map].map(([name, answers]) => {
    const summary = summarizeQuizProgress({ answeredQuestions: answers });
    const parts = [];
    if (summary.pendingCount) parts.push(`${summary.pendingCount} 待核对`);
    if (summary.reviewedCount) parts.push(`${summary.reviewedCount} 已查看/自评`);
    if (summary.legacyGradedCount) parts.push(`${summary.legacyGradedCount} 旧记录`);
    if (summary.unclassifiedCount) parts.push(`${summary.unclassifiedCount} 依据不明`);
    return { name, graded: 0, accuracy: null, label: parts.join(' · ') };
  });
});

// --- 基于本地记录的学习建议 ---
const nextSteps = ref([]);
const loadingNextSteps = ref(false);

/** 根据本次做题表现生成推荐列表 */
async function loadNextSteps() {
  loadingNextSteps.value = true;
  try {
    if (gradedCount.value === 0) {
      nextSteps.value = [];
      return;
    }
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
    if (gradedCount.value > 0 && accuracy.value < 60) {
      const gradedCategories = categoryBreakdown.value.filter((cat) => cat.graded > 0);
      const weakest = gradedCategories.length > 0 ? gradedCategories[gradedCategories.length - 1] : null;
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

    // 规则4：从本地学习引擎读取掌握度，不调用模型。
    try {
      const result = await studyEngineStore.analyzeMastery();
      if (result?.data?.summary?.weakestPoint) {
        const weak = result.data.summary;
        steps.unshift({
          icon: 'sparkle',
          title: `薄弱点: 攻克${weak.weakestPoint}`,
          subtitle: `${weak.weakCount}个薄弱点待突破，平均掌握度${weak.avgMastery}%`,
          action: 'ai-plan',
          priority: 'urgent'
        });
      }
    } catch (_e) {
      // 后端调用失败，静默降级（只用本地规则）
      logger.warn('[QuizResult] AI掌握度分析请求失败，使用本地推荐规则');
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
      if (gradedCount.value > 0)
        _animDelayTimer = setTimeout(() => {
          _animDelayTimer = null;
          if (animHandle) animHandle.cancel();
          animHandle = animateNumber(0, accuracy.value, 1200, (v) => {
            displayAccuracy.value = v;
          });
        }, 300);
      // 异步加载本地学习建议
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

// --- 激励文案 — 优先使用真实AI诊断，降级到本地规则 ---
const motivationalText = computed(() => {
  // 有真实 AI 诊断数据时使用（由 do-quiz.vue 的 autoDiagnose 传入）
  if (pendingCount.value > 0 && gradedCount.value === 0) return '原答已记录，参考匹配不计入正确率。';
  if (legacyCount.value > 0) return '旧记录保留，当前学习状态以可追溯作答依据为准。';
  if (progressSummary.value.unclassifiedCount > 0) return '原记录保留，判分依据不明。';
  if (gradedCount.value > 0 && props.diagnosisSummary) return props.diagnosisSummary;
  if (gradedCount.value === 0) return '已记录查看与自评，请继续作答。';

  // 降级：基于本次表现的本地规则文案
  if (accuracy.value >= 90) {
    const weakCat = categoryBreakdown.value.find((c) => c.graded > 0 && c.accuracy < 80);
    return weakCat
      ? `整体表现很棒！「${weakCat.name}」还可以再提升，建议针对训练。`
      : '全面发挥出色，继续保持这个节奏！';
  }
  if (accuracy.value >= 70) {
    const gradedCategories = categoryBreakdown.value.filter((c) => c.graded > 0);
    const worst = gradedCategories.length > 0 ? gradedCategories[gradedCategories.length - 1] : null;
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
  overflow: hidden;
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
.celebration-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 108rpx;
  height: 108rpx;
  margin: 120rpx auto 0;
  border-radius: 999rpx;
  color: #10281a;
  background: linear-gradient(135deg, #9fe870 0%, #75ddff 100%);
  box-shadow: 0 20rpx 60rpx rgba(52, 211, 153, 0.28);
  animation: celebration-bounce 0.8s ease-out;
}

.celebration-mark.small {
  width: 82rpx;
  height: 82rpx;
  margin-top: -16rpx;
  color: #10281a;
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
  min-height: 0;
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
.cat-bar-fill.reviewed {
  background: linear-gradient(90deg, rgba(31, 122, 77, 0.28), rgba(117, 221, 255, 0.36));
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
.action-dock {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 22rpx 40rpx;
  padding-bottom: calc(22rpx + env(safe-area-inset-bottom, 0px));
  background: var(--bg-card);
  border-top: 1rpx solid rgba(15, 23, 42, 0.08);
  box-shadow: 0 -12rpx 36rpx rgba(15, 23, 42, 0.08);
}
.action-btn {
  width: 100%;
  border-radius: 24rpx;
  min-height: 88rpx;
  padding: 0;
  font-size: 29rpx;
  font-weight: 750;
  border: none;
  margin: 0;
  transition:
    transform 0.18s ease,
    opacity 0.18s ease,
    box-shadow 0.18s ease;
}
.primary-btn {
  background: linear-gradient(135deg, #9fe870 0%, #75ddff 100%);
  color: #10281a;
  box-shadow: 0 12rpx 28rpx rgba(31, 122, 77, 0.16);
  border-radius: 20rpx;
}
.secondary-btn {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 2rpx solid rgba(0, 0, 0, 0.08);
  box-shadow: none;
  border-radius: 20rpx;
}
.tertiary-btn {
  background: transparent;
  color: var(--text-tertiary);
  border: none;
  box-shadow: none;
  border-radius: 20rpx;
}
.btn-hover {
  transform: scale(0.98);
  opacity: 0.9;
  box-shadow: none;
}

.dark-mode .action-dock {
  background: rgba(18, 21, 29, 0.96);
  border-top-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 -12rpx 40rpx rgba(0, 0, 0, 0.32);
}

.dark-mode .secondary-btn {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #f5f7fb;
}

.dark-mode .tertiary-btn {
  color: rgba(245, 247, 251, 0.62);
}
.item-hover {
  opacity: 0.7;
}
.completion-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 86rpx;
  height: 86rpx;
  margin: 0 auto 16rpx;
  border-radius: 999rpx;
  color: var(--success, #34d399);
  background: color-mix(in srgb, var(--success, #34d399) 12%, transparent);
}
.bottom-safe {
  height: 60rpx;
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
</style>
