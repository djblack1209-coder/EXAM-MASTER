<template>
  <view
    id="e2e-home-daily-quote"
    :class="['mode-description', 'apple-glass-card', isDark ? 'glass' : 'desc-light']"
    style="margin-top: 64rpx"
    @tap="$emit('open-poster')"
  >
    <text class="mode-text">
      <text class="mode-highlight"> <BaseIcon name="bulb" :size="28" /> 每日金句： </text>
      {{ quote }}
    </text>
    <text class="quote-hint"> 轻触查看海报 </text>
  </view>
</template>

<script>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
export default {
  name: 'DailyQuoteCard',
  components: { BaseIcon },
  props: {
    isDark: { type: Boolean, default: false },
    quote: { type: String, default: '' }
  },
  emits: ['open-poster']
};
</script>

<style lang="scss" scoped>
.mode-description {
  padding: 48rpx;
  border-radius: 32rpx;
  text-align: center;
  border: 1rpx solid var(--apple-glass-border-strong);
  margin-bottom: 32rpx;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  box-shadow: var(--apple-shadow-card);
}

.mode-description:active {
  transform: scale(0.98);
  opacity: 0.9;
}

.glass {
  background: linear-gradient(160deg, rgba(16, 20, 28, 0.92) 0%, rgba(12, 15, 22, 0.98) 100%);
  backdrop-filter: blur(20px) saturate(150%);
  -webkit-backdrop-filter: blur(20px) saturate(150%);
}

.desc-light {
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
}

.desc-light .mode-text {
  color: var(--text-sub);
}

.desc-light .mode-highlight {
  color: #047857;
}

.mode-text {
  font-size: 32rpx;
  color: var(--text-sub);
  line-height: 1.8;
  display: block;
  margin-bottom: 16rpx;
}

.mode-highlight {
  color: var(--primary);
  font-weight: 700;
  font-size: 34rpx;
}

.quote-hint {
  font-size: 24rpx;
  color: var(--text-sub);
  opacity: 0.6;
  display: block;
  margin-top: 16rpx;
}
</style>
