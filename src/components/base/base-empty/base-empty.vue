<template>
  <!-- REFACTOR: Wrapped in design system container, preserved all original directives -->
  <view class="empty-container ds-flex-center ds-p-lg" :class="{ 'dark-mode': isDark }">
    <view class="empty-content ds-flex-col ds-flex-center ds-gap-md">
      <text class="empty-icon">{{ icon || '📭' }}</text>
      <text class="empty-title ds-text-lg ds-font-semibold ds-text-primary">{{ title || '暂无数据' }}</text>
      <text class="empty-desc ds-text-base ds-text-secondary" v-if="desc">{{ desc }}</text>
      <button v-if="showButton" class="empty-button ds-btn ds-touchable ds-touch-target" @tap="handleAction">
        {{ buttonText || '去添加' }}
      </button>
    </view>
  </view>
</template>

<script>
// REFACTOR: Script unchanged - API contract preserved
export default {
  name: 'BaseEmpty',
  props: {
    icon: {
      type: String,
      default: '📭'
    },
    title: {
      type: String,
      default: '暂无数据'
    },
    desc: {
      type: String,
      default: ''
    },
    showButton: {
      type: Boolean,
      default: false
    },
    buttonText: {
      type: String,
      default: '去添加'
    },
    isDark: {
      type: Boolean,
      default: false
    }
  },
  methods: {
    handleAction() {
      this.$emit('action')
    }
  }
}
</script>

<style lang="scss" scoped>
/* REFACTOR: Design system applied, legacy CSS commented for reference */

.empty-container {
  /* VISUAL: Using ds-flex-center utility */
  /* Legacy: display: flex; align-items: center; justify-content: center; */
  min-height: 400rpx;
  /* VISUAL: Using ds-p-lg utility for padding */
  /* Legacy: padding: 60rpx 40rpx; */
}

.empty-content {
  /* VISUAL: Using ds-flex-col, ds-flex-center, ds-gap-md utilities */
  /* Legacy: display: flex; flex-direction: column; align-items: center; gap: 20rpx; */
  text-align: center;
}

.empty-icon {
  font-size: 120rpx;
  opacity: 0.6;
  margin-bottom: var(--ds-spacing-md);
  transition: opacity var(--ds-transition-base, 250ms ease-out);
}

/* VISUAL: Dark mode icon opacity adjustment */
.dark-mode .empty-icon {
  opacity: 0.5;
}

.empty-title {
  /* VISUAL: Using ds-text-lg, ds-font-semibold, ds-text-primary utilities */
  /* Legacy: font-size: 32rpx; font-weight: 600; color: var(--text-primary, var(--bg-body)); */
  margin-bottom: var(--ds-spacing-sm);
  /* Legacy: margin-bottom: 10rpx; */
}

/* VISUAL: Dark mode handled by ds-text-primary utility */
/* Legacy dark mode override removed - handled by design system */

.empty-desc {
  /* VISUAL: Using ds-text-base, ds-text-secondary utilities */
  /* Legacy: font-size: 28rpx; color: var(--text-tertiary, #767676); */
  line-height: var(--ds-line-height-relaxed);
  /* Legacy: line-height: 1.6; */
  max-width: 500rpx;
}

/* VISUAL: Dark mode handled by ds-text-secondary utility */
/* Legacy dark mode override removed - handled by design system */

.empty-button {
  /* VISUAL: Using ds-btn, ds-touchable, ds-touch-target utilities */
  margin-top: var(--ds-spacing-lg);
  /* Legacy: margin-top: 30rpx; */
  padding: var(--ds-spacing-sm) var(--ds-spacing-xl);
  /* Legacy: padding: 20rpx 60rpx; */
  background: var(--ds-color-accent-green) !important;
  /* Legacy: background: var(--brand-color, var(--brand-color)); */
  color: var(--ds-color-text-inverse, #1A1A1A) !important;
  border-radius: var(--ds-radius-full) !important;
  /* Legacy: border-radius: 50rpx; */
  font-size: var(--ds-font-size-base) !important;
  /* Legacy: font-size: 28rpx; */
  font-weight: var(--ds-font-weight-semibold) !important;
  /* Legacy: font-weight: 600; */
  border: none !important;

  /* VISUAL: Tap feedback handled by ds-touchable utility */
  /* ds-touch-target ensures 44px minimum touch area */
}

.empty-button::after {
  border: none;
}
</style>
