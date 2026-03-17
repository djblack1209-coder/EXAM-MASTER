<template>
  <view class="stats-grid">
    <view
      id="e2e-home-stat-questions"
      :class="['stat-card', 'apple-glass-card', isDark ? 'glass' : 'card-light', 'card-hover']"
      @tap="$emit('stat-click', 'questions')"
    >
      <view class="stat-icon-wrapper icon-primary">
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
      @tap="$emit('stat-click', 'accuracy')"
    >
      <view class="stat-icon-wrapper icon-success">
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
      @tap="$emit('stat-click', 'streak')"
    >
      <view class="stat-icon-wrapper icon-warning">
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
      @tap="$emit('stat-click', 'achievements')"
    >
      <view class="stat-icon-wrapper icon-neutral">
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

<script>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
export default {
  name: 'StatsGrid',
  components: { BaseIcon },
  props: {
    isDark: { type: Boolean, default: false },
    totalQuestions: { type: Number, default: 0 },
    accuracy: { type: Number, default: 0 },
    studyDays: { type: Number, default: 0 },
    achievementCount: { type: Number, default: 0 }
  },
  emits: ['stat-click']
};
</script>

<style lang="scss" scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 18rpx;
  margin-bottom: 44rpx;
}

.glass {
  background: var(--bg-card-alpha);
  backdrop-filter: blur(16rpx) saturate(130%);
  -webkit-backdrop-filter: blur(16rpx) saturate(130%);
  border: 1rpx solid rgba(255, 255, 255, 0.14);
}

.card-light {
  background: linear-gradient(160deg, #ffffff 0%, #f4faf6 100%);
}

.card-hover:active {
  transform: translateY(-2rpx) scale(0.99);
  box-shadow: var(--shadow-md);
}

.stat-card {
  position: relative;
  overflow: hidden;
  border-radius: 28rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-top: 16rpx;
  }
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 220rpx;
  border: 1rpx solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-card);
}

.stat-card::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}

.stat-icon-wrapper {
  width: 88rpx;
  height: 88rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.72);
}

.icon-primary {
  background: var(--brand-tint);
}

.icon-success {
  background: rgba(52, 199, 89, 0.14);
}

.icon-warning {
  background: rgba(255, 159, 10, 0.16);
}

.icon-neutral {
  background: rgba(142, 142, 147, 0.12);
}

.glass .stat-icon-wrapper {
  border-color: rgba(124, 176, 255, 0.18);
  box-shadow: none;
}

.glass .icon-primary {
  background: rgba(10, 132, 255, 0.16);
}

.glass .icon-success {
  background: rgba(64, 200, 160, 0.16);
}

.glass .icon-warning {
  background: rgba(95, 170, 255, 0.18);
}

.glass .icon-neutral {
  background: rgba(58, 108, 190, 0.16);
}

.stat-icon {
  font-size: 48rpx;
}

.stat-content {
  display: flex;
  flex-direction: column;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-top: 8rpx;
  }
}

.stat-title {
  font-size: 24rpx;
  color: var(--text-sub);
  font-weight: 520;
  letter-spacing: 1rpx;
}

.stat-value {
  font-size: 46rpx;
  font-weight: 680;
  letter-spacing: -0.3rpx;
  color: var(--text-primary);
  line-height: 1.2;
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

@media screen and (max-width: 375px) {
  .stats-grid {
    gap: 14rpx;
    margin-bottom: 36rpx;
  }

  .stat-card {
    padding: 24rpx;
    border-radius: 24rpx;
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
