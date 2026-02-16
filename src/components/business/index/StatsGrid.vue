<template>
  <view class="stats-grid">
    <view :class="['stat-card', isDark ? 'glass' : 'card-light', 'card-hover']" @tap="$emit('stat-click', 'questions')">
      <view class="stat-icon-wrapper icon-primary">
        <text class="stat-icon">
          ✓
        </text>
      </view>
      <view class="stat-content">
        <text class="stat-title">
          题目总数
        </text>
        <text class="stat-value">
          {{ totalQuestions }}
        </text>
        <text class="stat-change neutral">
          题库容量
        </text>
      </view>
    </view>

    <view :class="['stat-card', isDark ? 'glass' : 'card-light', 'card-hover']" @tap="$emit('stat-click', 'accuracy')">
      <view class="stat-icon-wrapper icon-success">
        <text class="stat-icon">
          📈
        </text>
      </view>
      <view class="stat-content">
        <text class="stat-title">
          正确率
        </text>
        <text class="stat-value">
          {{ accuracy }}%
        </text>
        <text class="stat-change" :class="accuracy >= 60 ? 'positive' : 'neutral'">
          {{ accuracy >= 60 ? '表现优秀' : '继续加油' }}
        </text>
      </view>
    </view>

    <view :class="['stat-card', isDark ? 'glass' : 'card-light', 'card-hover']" @tap="$emit('stat-click', 'streak')">
      <view class="stat-icon-wrapper icon-warning">
        <text class="stat-icon">
          ⚡
        </text>
      </view>
      <view class="stat-content">
        <text class="stat-title">
          学习天数
        </text>
        <text class="stat-value">
          {{ studyDays }} 天
        </text>
        <text class="stat-change" :class="studyDays > 0 ? 'positive' : 'neutral'">
          {{ studyDays > 0 ? '坚持学习' : '开始学习' }}
        </text>
      </view>
    </view>

    <view
      :class="['stat-card', isDark ? 'glass' : 'card-light', 'card-hover']"
      @tap="$emit('stat-click', 'achievements')"
    >
      <view class="stat-icon-wrapper icon-neutral">
        <text class="stat-icon">
          🏆
        </text>
      </view>
      <view class="stat-content">
        <text class="stat-title">
          成就徽章
        </text>
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
export default {
  name: 'StatsGrid',
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
	gap: var(--ds-spacing-md, 24rpx);
	margin-bottom: var(--ds-spacing-lg, 32rpx);
}

.glass {
	background: var(--bg-glass);
	backdrop-filter: blur(24rpx);
	-webkit-backdrop-filter: blur(24rpx);
	border: 1rpx solid var(--border);
}

.card-light {
	background: var(--card);
}

.card-hover:active {
	transform: translateY(-4rpx);
	box-shadow: var(--shadow-lg);
}

.stat-card {
	border-radius: 32rpx;
	padding: 32rpx;
	display: flex;
	flex-direction: column;
	gap: 16rpx;
	transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	border: 1rpx solid var(--border);
}

.stat-icon-wrapper {
	width: 96rpx;
	height: 96rpx;
	border-radius: 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.icon-primary {
	background: var(--primary-light);
}

.icon-success {
	background: var(--success-light);
}

.icon-warning {
	background: var(--warning-light);
}

.icon-neutral {
	background: var(--bg-secondary);
}

.stat-icon {
	font-size: 48rpx;
}

.stat-content {
	display: flex;
	flex-direction: column;
	gap: 8rpx;
}

.stat-title {
	font-size: 24rpx;
	color: var(--text-sub);
	font-weight: 500;
}

.stat-value {
	font-size: 48rpx;
	font-weight: 700;
	color: var(--text-primary);
	line-height: 1.2;
}

.stat-change {
	font-size: 24rpx;
	font-weight: 500;
}

.stat-change.positive {
	color: var(--success);
}

.stat-change.neutral {
	color: var(--text-sub);
}
</style>
