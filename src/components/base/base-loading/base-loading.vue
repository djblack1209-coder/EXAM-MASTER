<!-- REFACTOR: Modern loading component with design system utilities -->
<template>
  <view v-if="visible" class="loading-container ds-flex-center" :class="{ 'dark-mode': isDark }">
    <view class="loading-content ds-flex-col ds-flex-center ds-gap-sm">
      <!-- VISUAL: Three-dot bounce animation -->
      <view class="loading-spinner ds-flex ds-gap-xs ds-flex-center">
        <view class="spinner-dot"></view>
        <view class="spinner-dot"></view>
        <view class="spinner-dot"></view>
      </view>

      <!-- VISUAL: Loading text with design system typography -->
      <text class="loading-text ds-text-base ds-font-medium">
        {{ text || '加载中...' }}
      </text>
    </view>
  </view>
</template>

<script>
/**
 * BaseLoading Component
 * 
 * REFACTOR: Added design system utilities for consistent spacing and typography
 * - Preserved all props and functionality
 * - Enhanced with ds-* utility classes
 * - Maintained dark mode support
 * 
 * @component
 * @example
 * <base-loading :visible="isLoading" text="正在加载数据..." :isDark="isDarkMode" />
 */
export default {
  name: 'BaseLoading',
  props: {
    /**
     * Controls visibility of loading overlay
     */
    visible: {
      type: Boolean,
      default: false
    },
    /**
     * Custom loading text
     */
    text: {
      type: String,
      default: '加载中...'
    },
    /**
     * Dark mode flag
     */
    isDark: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style lang="scss" scoped>
/* REFACTOR: Modern loading overlay with design system integration */

.loading-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;

  /* VISUAL: Semi-transparent backdrop with blur effect */
  background: rgba(255, 255, 255, 0.85);

  /* #ifndef APP-NVUE */
  backdrop-filter: blur(20rpx);
  -webkit-backdrop-filter: blur(20rpx);
  /* #endif */

  z-index: var(--ds-z-modal, 9999);

  /* VISUAL: Dark mode backdrop - 使用中性深色 */
  &.dark-mode {
    background: rgba(28, 28, 30, 0.85);

    /* #ifndef APP-NVUE */
    backdrop-filter: blur(20rpx);
    -webkit-backdrop-filter: blur(20rpx);
    /* #endif */
  }
}

.loading-content {
  /* Spacing handled by ds-gap-sm utility class */
}

.loading-spinner {
  /* Spacing handled by ds-gap-xs utility class */
}

/* VISUAL: Animated spinner dots with Wise green accent */
.spinner-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: var(--ds-radius-full, 9999rpx);
  background: var(--ds-color-accent-green, var(--brand-color));

  /* VISUAL: Smooth bounce animation */
  animation: bounce 1.4s infinite ease-in-out both;

  &:nth-child(1) {
    animation-delay: -0.32s;
  }

  &:nth-child(2) {
    animation-delay: -0.16s;
  }

  &:nth-child(3) {
    animation-delay: 0s;
  }
}

.loading-text {
  /* Typography handled by ds-text-base and ds-font-medium utility classes */
  color: var(--ds-color-text-primary, #454545);

  /* VISUAL: Smooth color transition */
  transition: color var(--ds-transition-fast, 150ms ease-out);
}

/* VISUAL: Dark mode text color */
.dark-mode .loading-text {
  color: var(--ds-color-text-primary, #E2E8F0);
}

/* VISUAL: Bounce animation keyframes */
@keyframes bounce {

  0%,
  80%,
  100% {
    transform: scale(0);
    opacity: 0.5;
  }

  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* VISUAL: Reduced motion support for accessibility */
@media (prefers-reduced-motion: reduce) {
  .spinner-dot {
    animation: none;
    opacity: 1;
    transform: scale(1);
  }
}
</style>
