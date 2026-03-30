<template>
  <!-- 每日目标进度环卡片 -->
  <view :class="['daily-goal-ring', 'apple-glass-card', isDark ? 'dark' : '']">
    <!-- 上半部分：进度环 + 统计信息 -->
    <view class="goal-top">
      <!-- 左侧：SVG 进度环 -->
      <view class="ring-wrapper">
        <svg viewBox="0 0 100 100" class="ring-svg">
          <!-- 轨道（背景圆环） -->
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            :stroke="isDark ? 'rgba(255,255,255,0.1)' : '#e8e8ed'"
            stroke-width="6"
          />
          <!-- 进度弧线 -->
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            :stroke="progressColor"
            stroke-width="6"
            stroke-linecap="round"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="dashOffset"
            transform="rotate(-90 50 50)"
            class="ring-progress"
          />
        </svg>
        <!-- 百分比数字（叠加在环中心） -->
        <view class="ring-center-text">
          <text class="ring-percent">{{ percentage }}</text>
          <text class="ring-percent-sign">%</text>
        </view>
      </view>

      <!-- 右侧：文字统计 -->
      <view class="goal-info">
        <text class="goal-title">今日目标</text>
        <text class="goal-detail">已练 {{ todayQuestions }} / {{ dailyGoal }} 题</text>
        <view class="streak-row">
          <text class="streak-text">连续学习 {{ streakDays }} 天</text>
        </view>
      </view>
    </view>

    <!-- 下半部分：CTA 按钮 -->
    <view class="goal-cta" hover-class="cta-hover" @tap="handleStartPractice">
      <text class="cta-text">{{ todayQuestions > 0 ? '继续练习' : '开始练习' }}</text>
      <text class="cta-arrow">→</text>
    </view>
  </view>
</template>

<script setup>
/**
 * DailyGoalRing — 每日练习目标进度环
 * 展示今日答题进度、连续学习天数，并提供快速练习入口
 */
import { computed } from 'vue';

const props = defineProps({
  /** 今日已答题数 */
  todayQuestions: { type: Number, default: 0 },
  /** 连续学习天数 */
  streakDays: { type: Number, default: 0 },
  /** 是否深色模式 */
  isDark: { type: Boolean, default: false },
  /** 每日目标题数 */
  dailyGoal: { type: Number, default: 20 }
});

const emit = defineEmits(['start-practice']);

/** 圆环周长：2πr，r=40 */
const circumference = 2 * Math.PI * 40;

/** 完成百分比（0-100），超过目标按 100 封顶 */
const percentage = computed(() => {
  if (props.dailyGoal <= 0) return 0;
  return Math.min(100, Math.round((props.todayQuestions / props.dailyGoal) * 100));
});

/** 是否已达成目标 */
const isComplete = computed(() => percentage.value >= 100);

/** 进度弧线的 dashoffset 值（控制弧长） */
const dashOffset = computed(() => {
  return circumference * (1 - percentage.value / 100);
});

/** 进度弧线颜色：达成目标时变为更鲜明的绿色 */
const progressColor = computed(() => {
  return isComplete.value ? '#34c759' : '#34d399';
});

/** 点击练习按钮 */
function handleStartPractice() {
  emit('start-practice');
}
</script>

<style lang="scss" scoped>
/* ==================== 每日目标进度环卡片 ==================== */
.daily-goal-ring {
  margin: 20rpx 30rpx;
  padding: 32rpx 30rpx 24rpx;
  border-radius: 28rpx;
  border: 1rpx solid var(--apple-glass-border-strong, rgba(0, 0, 0, 0.06));
  box-shadow: var(--apple-shadow-card, 0 4rpx 16rpx rgba(0, 0, 0, 0.06));
  position: relative;
  overflow: hidden;
}

/* 顶部高光线（与其他卡片一致） */
.daily-goal-ring::before {
  content: '';
  position: absolute;
  top: 0;
  left: 22rpx;
  right: 22rpx;
  height: 1rpx;
  background: var(--apple-specular-soft, rgba(255, 255, 255, 0.5));
  pointer-events: none;
}

/* 深色模式 */
.daily-goal-ring.dark {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(30, 30, 40, 0.65);
}

/* ==================== 上半部分：环 + 信息 ==================== */
.goal-top {
  display: flex;
  align-items: center;
  margin-bottom: 24rpx;
}

/* ==================== 左侧：进度环容器 ==================== */
.ring-wrapper {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  flex-shrink: 0;
  margin-right: 28rpx;
}

.ring-svg {
  width: 100%;
  height: 100%;
}

/* 进度弧线过渡动画 */
.ring-progress {
  transition: stroke-dashoffset 0.6s ease;
}

/* 环中心百分比文字 */
.ring-center-text {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-percent {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-primary, #1a1a2e);
  letter-spacing: -1rpx;
}

.ring-percent-sign {
  font-size: 20rpx;
  font-weight: 600;
  color: var(--text-secondary, #8e8e93);
  margin-top: 4rpx;
}

.dark .ring-percent {
  color: var(--text-inverse);
}

.dark .ring-percent-sign {
  color: rgba(255, 255, 255, 0.5);
}

/* ==================== 右侧：文字统计 ==================== */
.goal-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.goal-title {
  font-size: 28rpx;
  font-weight: 650;
  color: var(--text-primary, #1a1a2e);
  margin-bottom: 8rpx;
}

.dark .goal-title {
  color: var(--text-inverse);
}

.goal-detail {
  font-size: 26rpx;
  color: var(--text-secondary, #8e8e93);
  margin-bottom: 12rpx;
}

.dark .goal-detail {
  color: rgba(255, 255, 255, 0.55);
}

.streak-row {
  display: flex;
  align-items: center;
}

.streak-text {
  font-size: 24rpx;
  color: var(--warning);
  font-weight: 500;
}

.dark .streak-text {
  color: var(--warning-light, #fbbf24);
}

/* ==================== 下半部分：CTA 按钮 ==================== */
.goal-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 22rpx 0;
  border-radius: 20rpx;
  background: linear-gradient(135deg, var(--success), var(--success-dark, #059669));
  transition: all 0.25s ease;
}

.cta-hover {
  opacity: 0.85;
  transform: scale(0.98);
}

.cta-text {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-inverse);
  margin-right: 8rpx;
}

.cta-arrow {
  font-size: 30rpx;
  color: rgba(255, 255, 255, 0.85);
}
</style>
