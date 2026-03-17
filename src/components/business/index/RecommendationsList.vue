<template>
  <view>
    <view class="section-header section-header-apple">
      <text class="section-title"> 为你推荐 </text>
    </view>
    <view class="recommendations-grid">
      <view
        v-for="recommendation in recommendations"
        :id="`e2e-home-recommendation-${recommendation.type || recommendation.id}`"
        :key="recommendation.id"
        :class="['recommendation-card', 'apple-group-card', isDark ? 'glass' : 'card-light', 'card-hover']"
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
  margin-bottom: 24rpx;
}

.section-header-apple {
  margin-bottom: 26rpx;
}

.section-title {
  font-size: 24rpx;
  font-weight: 620;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.glass {
  background: var(--bg-card-alpha);
  backdrop-filter: blur(14rpx) saturate(130%);
  -webkit-backdrop-filter: blur(14rpx) saturate(130%);
  border: 1rpx solid rgba(255, 255, 255, 0.14);
}

.card-light {
  background: linear-gradient(160deg, #ffffff 0%, #f4faf6 100%);
}

.card-hover:active {
  transform: translateY(-2rpx);
  box-shadow: var(--shadow-md);
}

.recommendations-grid {
  display: flex;
  flex-direction: column;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-top: 16rpx;
  }
  margin-bottom: 48rpx;
}

.recommendation-card {
  position: relative;
  display: flex;
  align-items: center;
  /* gap: 20rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-top: 20rpx;
  }
  padding: 28rpx;
  min-height: 116rpx;
  border-radius: 28rpx;
  border: 1rpx solid var(--apple-glass-border-strong);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--apple-shadow-card);
  overflow: hidden;
}

.recommendation-card::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}

.recommendation-icon-wrapper {
  width: 72rpx;
  height: 72rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand-tint);
  flex-shrink: 0;
  border: 1rpx solid rgba(255, 255, 255, 0.48);
  box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.72);
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
  /* gap: 8rpx; -- replaced for Android WebView compat */
  & > view + view,
  & > text + text,
  & > view + text,
  & > text + view {
    margin-top: 8rpx;
  }
  min-width: 0;
}

.recommendation-title {
  font-size: 28rpx;
  font-weight: 620;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommendation-subtitle {
  font-size: 23rpx;
  color: var(--text-sub);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recommendation-arrow {
  flex-shrink: 0;
  color: var(--text-sub);
  opacity: 0.68;
}

.glass .recommendation-icon-wrapper {
  background:
    linear-gradient(180deg, rgba(10, 132, 255, 0.12) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(10, 132, 255, 0.18);
  box-shadow: var(--apple-shadow-surface);
}

.arrow-icon {
  font-size: 32rpx;
  color: var(--text-sub);
}
</style>
