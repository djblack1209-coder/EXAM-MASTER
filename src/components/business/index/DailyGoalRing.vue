<template>
  <view class="goal-ring-card" @tap="$emit('start-practice')">
    <view class="goal-ring-left">
      <!-- SVG 进度环 -->
      <view class="ring-container">
        <!-- #ifdef H5 -->
        <svg class="ring-svg" viewBox="0 0 120 120">
          <circle class="ring-bg" cx="60" cy="60" r="52" />
          <circle
            class="ring-fill"
            cx="60"
            cy="60"
            r="52"
            :stroke-dasharray="circumference"
            :stroke-dashoffset="dashOffset"
          />
        </svg>
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <view class="ring-fallback">
          <view class="ring-fallback-bg" />
          <view
            class="ring-fallback-fill"
            :style="{ background: `conic-gradient(var(--primary, #37b24d) ${progressPercent}%, transparent 0)` }"
          />
          <view class="ring-fallback-inner" />
        </view>
        <!-- #endif -->
        <view class="ring-center">
          <text class="ring-count">{{ todayDone }}</text>
          <text class="ring-total">/{{ dailyGoal }}</text>
        </view>
      </view>
    </view>

    <view class="goal-ring-right">
      <text class="goal-title">{{ goalMessage }}</text>
      <text class="goal-subtitle">{{ streakText }}</text>
      <view class="goal-cta">
        <text class="cta-text">{{ ctaText }}</text>
        <text class="cta-arrow">→</text>
      </view>
    </view>
  </view>
</template>

<script>
import { storageService } from '@/services/storageService.js';

export default {
  name: 'DailyGoalRing',
  props: {
    todayQuestions: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 },
    isDark: { type: Boolean, default: false }
  },
  emits: ['start-practice'],
  computed: {
    dailyGoal() {
      return storageService.get('daily_goal', 20);
    },
    todayDone() {
      return Math.min(this.todayQuestions, this.dailyGoal);
    },
    progressPercent() {
      if (this.dailyGoal <= 0) return 0;
      return Math.min(100, Math.round((this.todayDone / this.dailyGoal) * 100));
    },
    isComplete() {
      return this.todayDone >= this.dailyGoal;
    },
    circumference() {
      return 2 * Math.PI * 52;
    },
    dashOffset() {
      return this.circumference * (1 - this.progressPercent / 100);
    },
    goalMessage() {
      if (this.isComplete) return '今日目标已完成 🎉';
      if (this.todayDone === 0) return '今天还没开始练习';
      return `还差 ${this.dailyGoal - this.todayDone} 题完成目标`;
    },
    streakText() {
      if (this.streakDays > 0) return `🔥 已连续学习 ${this.streakDays} 天`;
      return '开始你的第一天';
    },
    ctaText() {
      if (this.isComplete) return '继续挑战';
      if (this.todayDone > 0) return '继续学习';
      return '开始今日练习';
    }
  }
};
</script>

<style lang="scss" scoped>
.goal-ring-card {
  display: flex;
  align-items: center;
  padding: 32rpx;
  margin-bottom: 24rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft, rgba(255, 255, 255, 0.1)) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-group-bg, #fff) 0%, var(--apple-glass-card-bg, #f8f8f8) 100%);
  border: 1px solid var(--apple-glass-border-strong, rgba(0, 0, 0, 0.06));
  border-radius: 28rpx;
  box-shadow: var(--apple-shadow-card, 0 2rpx 12rpx rgba(0, 0, 0, 0.06));
}

.goal-ring-left {
  margin-right: 28rpx;
  flex-shrink: 0;
}

.ring-container {
  width: 120px;
  height: 120px;
  position: relative;
}

.ring-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-bg {
  fill: none;
  stroke: rgba(0, 0, 0, 0.06);
  stroke-width: 8;
}

.ring-fill {
  fill: none;
  stroke: var(--primary, #37b24d);
  stroke-width: 8;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s ease;
}

/* 小程序 fallback（conic-gradient） */
.ring-fallback {
  width: 100%;
  height: 100%;
  position: relative;
  border-radius: 50%;
  overflow: hidden;
}

.ring-fallback-bg {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.06);
}

.ring-fallback-fill {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  transition: background 0.6s ease;
}

.ring-fallback-inner {
  position: absolute;
  inset: 8px;
  border-radius: 50%;
  background: var(--apple-group-bg, #fff);
}

.ring-center {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring-count {
  font-size: 44rpx;
  font-weight: 800;
  color: var(--primary, #37b24d);
}

.ring-total {
  font-size: 24rpx;
  color: var(--text-sub, #999);
  margin-top: 4rpx;
}

.goal-ring-right {
  flex: 1;
  min-width: 0;
}

.goal-title {
  display: block;
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-main, #1a1a1a);
  margin-bottom: 8rpx;
}

.goal-subtitle {
  display: block;
  font-size: 24rpx;
  color: var(--text-sub, #999);
  margin-bottom: 20rpx;
}

.goal-cta {
  display: inline-flex;
  align-items: center;
  padding: 12rpx 28rpx;
  background: var(--primary, #37b24d);
  border-radius: 32rpx;
}

.cta-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
}

.cta-arrow {
  font-size: 26rpx;
  color: #fff;
  margin-left: 8rpx;
}
</style>
