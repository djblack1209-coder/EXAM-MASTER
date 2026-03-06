<template>
  <view
    :class="['mode-description', isDark ? 'glass' : 'desc-light']"
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
  border: 1rpx solid var(--border);
  margin-bottom: 32rpx;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.mode-description:active {
  transform: scale(0.98);
  opacity: 0.9;
}

.glass {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1rpx solid var(--border);
}

.desc-light {
  background: var(--bg-secondary);
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
