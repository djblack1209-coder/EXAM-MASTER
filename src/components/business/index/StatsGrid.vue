<template>
  <view class="stats-grid">
    <view
      id="e2e-home-stat-questions"
      :class="['stat-card', 'apple-glass-card', isDark ? 'glass' : 'card-light', 'card-hover']"
      style="--card-accent: #58cc02"
      @tap="$emit('stat-click', 'questions')"
    >
      <view class="stat-icon-wrapper">
        <BaseIcon name="check" :size="48" />
      </view>
      <view class="stat-content">
        <text class="stat-title"> 题目总数 </text>
        <text class="stat-value">
          {{ totalQuestions }}
        </text>
        <text class="stat-change neutral"> 题库容量 </text>
      </view>
    </view>

    <view
      id="e2e-home-stat-accuracy"
      :class="['stat-card', 'apple-glass-card', isDark ? 'glass' : 'card-light', 'card-hover']"
      style="--card-accent: var(--info)"
      @tap="$emit('stat-click', 'accuracy')"
    >
      <view class="stat-icon-wrapper">
        <BaseIcon name="chart-up" :size="48" />
      </view>
      <view class="stat-content">
        <text class="stat-title"> 正确率 </text>
        <text class="stat-value"> {{ accuracy }}% </text>
        <text class="stat-change" :class="accuracy >= 60 ? 'positive' : 'neutral'">
          {{ accuracy >= 60 ? '表现优秀' : '继续加油' }}
        </text>
      </view>
    </view>

    <view
      id="e2e-home-stat-streak"
      :class="['stat-card', 'apple-glass-card', isDark ? 'glass' : 'card-light', 'card-hover']"
      style="--card-accent: var(--warning)"
      @tap="$emit('stat-click', 'streak')"
    >
      <view class="stat-icon-wrapper">
        <BaseIcon name="lightning" :size="48" />
      </view>
      <view class="stat-content">
        <text class="stat-title"> 学习天数 </text>
        <text class="stat-value"> {{ studyDays }} 天 </text>
        <text class="stat-change" :class="studyDays > 0 ? 'positive' : 'neutral'">
          {{ studyDays > 0 ? '坚持学习' : '开始学习' }}
        </text>
      </view>
    </view>

    <view
      id="e2e-home-stat-achievements"
      :class="['stat-card', 'apple-glass-card', isDark ? 'glass' : 'card-light', 'card-hover']"
      style="--card-accent: var(--purple-light, #ce82ff)"
      @tap="$emit('stat-click', 'achievements')"
    >
      <view class="stat-icon-wrapper">
        <BaseIcon name="trophy" :size="48" />
      </view>
      <view class="stat-content">
        <text class="stat-title"> 成就徽章 </text>
        <text class="stat-value">
          {{ achievementCount }}
        </text>
        <text class="stat-change neutral">
          {{ achievementCount > 0 ? '已解锁' : '待解锁' }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

defineProps({
  isDark: { type: Boolean, default: false },
  totalQuestions: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 },
  studyDays: { type: Number, default: 0 },
  achievementCount: { type: Number, default: 0 }
});
defineEmits(['stat-click']);
</script>

<style lang="scss" scoped>
/* ── 入场动画 ── */
@keyframes cardFadeIn {
  from {
    opacity: 0;
    transform: translateY(20rpx) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.stats-grid {
  display: flex;
  flex-wrap: wrap;
  margin: 0 -9rpx;
  margin-bottom: 44rpx;
}

/* 暗色模式也使用新拟物化背景 */
.glass {
  background: var(--em3d-bg);
  border: none;
}

/* 浅色模式使用新拟物化背景 */
.card-light {
  background: var(--em3d-bg);
}

/* 按下时从凸起变凹陷（新拟物化交互） */
.card-hover:active {
  box-shadow: var(--neu-shadow-inset);
}

.stat-card {
  position: relative;
  overflow: hidden;
  width: calc(50% - 18rpx);
  margin: 9rpx;
  border-radius: 24rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  /* gap: 16rpx; -- 微信 WXSS 不支持 */
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 220rpx;
  /* 新拟物化：无边框，靠阴影区分层次 */
  border: none;
  box-shadow: var(--neu-shadow-md);

  /* 交错入场动画 */
  opacity: 0;
  animation: cardFadeIn 0.4s ease-out both;
}

.stat-card:nth-child(1) {
  animation-delay: 0.05s;
}

.stat-card:nth-child(2) {
  animation-delay: 0.1s;
}

.stat-card:nth-child(3) {
  animation-delay: 0.15s;
}

.stat-card:nth-child(4) {
  animation-delay: 0.2s;
}

.stat-icon-wrapper {
  width: 88rpx;
  height: 88rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16rpx;
  background: color-mix(in srgb, var(--card-accent) 12%, transparent);
}

.glass .stat-icon-wrapper {
  border: none;
  box-shadow: none;
  background: color-mix(in srgb, var(--card-accent) 12%, transparent);
}

.stat-icon {
  font-size: 48rpx;
}

.stat-content {
  display: flex;
  flex-direction: column;
  /* gap: 8rpx; -- 微信 WXSS 不支持 */
}

.stat-content > .stat-title {
  margin-bottom: 4rpx;
}

.stat-content > .stat-value {
  margin-bottom: 4rpx;
}

.stat-title {
  font-size: 24rpx;
  color: var(--text-sub);
  font-weight: 520;
  letter-spacing: 1rpx;
}

.stat-value {
  font-size: 48rpx;
  font-weight: 800;
  letter-spacing: -0.3rpx;
  color: var(--text-primary);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.stat-change {
  font-size: 24rpx;
  font-weight: 520;
}

.stat-change.positive {
  color: var(--success);
}

.stat-change.neutral {
  color: var(--text-sub);
}

/* ── 暗黑模式下数值颜色回退 ── */
.glass .stat-value {
  color: var(--text-primary);
}

@media screen and (max-width: 375px) {
  .stats-grid {
    margin: 0 -7rpx;
    margin-bottom: 36rpx;
  }

  .stat-card {
    width: calc(50% - 14rpx);
    margin: 7rpx;
    padding: 24rpx;
    border-radius: 20rpx;
    min-height: 200rpx;
  }

  .stat-icon-wrapper {
    width: 72rpx;
    height: 72rpx;
  }

  .stat-title {
    font-size: 22rpx;
  }

  .stat-value {
    font-size: 38rpx;
  }

  .stat-change {
    font-size: 22rpx;
  }
}
</style>
