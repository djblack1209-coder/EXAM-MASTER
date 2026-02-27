<template>
  <view>
    <view class="section-header">
      <text class="section-title">
        为你推荐
      </text>
    </view>
    <view class="recommendations-grid">
      <view
        v-for="recommendation in recommendations"
        :key="recommendation.id"
        :class="['recommendation-card', isDark ? 'glass' : 'card-light', 'card-hover']"
        @tap="$emit('recommendation-click', recommendation)"
      >
        <view class="recommendation-icon-wrapper">
          <view class="recommendation-icon">
            <BaseIcon :name="recommendation.icon" :size="34" />
          </view>
        </view>
        <view class="recommendation-content">
          <text class="recommendation-title">
            {{ recommendation.title }}
          </text>
          <text class="recommendation-subtitle">
            {{ recommendation.subtitle }}
          </text>
        </view>
        <view class="recommendation-arrow">
          <BaseIcon name="arrow-right" :size="28" />
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  name: 'RecommendationsList',
  components: {
    BaseIcon
  },
  props: {
    isDark: { type: Boolean, default: false },
    recommendations: { type: Array, default: () => [] }
  },
  emits: ['recommendation-click']
};
</script>

<style lang="scss" scoped>
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32rpx;
}

.section-title {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1rpx solid var(--border);
}

.card-light {
  background: var(--card);
}

.card-hover:active {
  transform: translateY(-4rpx);
  box-shadow: var(--shadow-lg);
}

.recommendations-grid {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-bottom: 64rpx;
}

.recommendation-card {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 32rpx;
  border-radius: 24rpx;
  border: 1rpx solid var(--border);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.recommendation-icon-wrapper {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-light);
  flex-shrink: 0;
}

.recommendation-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.recommendation-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.recommendation-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommendation-subtitle {
  font-size: 24rpx;
  color: var(--text-sub);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommendation-arrow {
  flex-shrink: 0;
}

.arrow-icon {
  font-size: 32rpx;
  color: var(--text-sub);
}
</style>
