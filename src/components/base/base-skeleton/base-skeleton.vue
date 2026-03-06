<!-- REFACTOR: Modern skeleton screen with design system utilities -->
<template>
  <view class="skeleton-container ds-container" :class="{ 'dark-mode': isDark }">
    <!-- VISUAL: Header skeleton with avatar and greeting -->
    <view class="skeleton-header ds-flex ds-gap-sm">
      <view class="skeleton-avatar" />
      <view class="skeleton-greeting ds-flex-col ds-gap-xs">
        <view class="skeleton-greeting-text" />
        <view class="skeleton-time" />
      </view>
    </view>

    <!-- VISUAL: Exam-Master banner skeleton -->
    <view class="skeleton-banner ds-flex-center ds-gap-sm ds-rounded-lg ds-p-md">
      <view class="skeleton-banner-icon ds-rounded-md" />
      <view class="skeleton-banner-text ds-rounded-md" />
    </view>

    <!-- VISUAL: Daily quote skeleton -->
    <view class="skeleton-card ds-card ds-p-md ds-m-md">
      <view class="skeleton-quote-header ds-flex-between ds-gap-sm">
        <view class="skeleton-quote-tag ds-rounded-full" />
        <view class="skeleton-quote-date ds-rounded-md" />
      </view>
      <view class="skeleton-quote-text ds-rounded-md" />
    </view>

    <!-- VISUAL: Feature area skeleton -->
    <view class="skeleton-feature">
      <!-- Invite banner skeleton -->
      <view class="skeleton-card skeleton-invite-banner ds-card ds-flex-between ds-p-md ds-m-md">
        <view class="skeleton-banner-content ds-flex-col ds-gap-xs">
          <view class="skeleton-banner-title ds-rounded-md" />
          <view class="skeleton-banner-desc ds-rounded-md" />
        </view>
        <view class="skeleton-banner-arrow ds-rounded-full" />
      </view>

      <!-- VISUAL: Feature grid skeleton (countdown + practice) -->
      <view class="skeleton-feature-grid ds-flex ds-gap-sm">
        <!-- Countdown skeleton -->
        <view class="skeleton-card skeleton-countdown ds-card ds-flex-col ds-flex-center ds-p-md">
          <view class="skeleton-countdown-label ds-rounded-md" />
          <view class="skeleton-countdown-value ds-rounded-md" />
          <view class="skeleton-countdown-date ds-rounded-full" />
        </view>

        <!-- Smart practice skeleton -->
        <view class="skeleton-card skeleton-practice ds-card ds-flex-col ds-flex-center ds-p-md">
          <view class="skeleton-practice-content ds-flex-col ds-gap-xs">
            <view class="skeleton-practice-title ds-rounded-md" />
            <view class="skeleton-practice-desc ds-rounded-md" />
          </view>
          <view class="skeleton-practice-play ds-rounded-full" />
        </view>
      </view>
    </view>

    <!-- VISUAL: Study heatmap skeleton -->
    <view class="skeleton-section">
      <view class="skeleton-section-header ds-flex-between ds-gap-sm">
        <view class="skeleton-section-title ds-rounded-md" />
        <view class="skeleton-section-total ds-rounded-md" />
      </view>
      <view class="skeleton-card skeleton-heatmap ds-card ds-p-md">
        <view class="skeleton-heatmap-grid ds-flex ds-gap-xs">
          <view v-for="i in 14" :key="i" class="skeleton-heatmap-col ds-flex-col ds-gap-xs">
            <view v-for="j in 5" :key="j" class="skeleton-heatmap-cell" />
          </view>
        </view>
      </view>
    </view>

    <!-- VISUAL: Today's plan skeleton -->
    <view class="skeleton-section">
      <view class="skeleton-section-header ds-flex-between ds-gap-sm">
        <view class="skeleton-section-title ds-rounded-md" />
        <view class="skeleton-section-total ds-rounded-md" />
      </view>
      <view class="skeleton-card skeleton-task ds-card ds-p-md">
        <view v-for="i in 3" :key="i" class="skeleton-task-item ds-flex ds-gap-sm">
          <view class="skeleton-ta<REDACTED_SECRET> ds-rounded-sm" />
          <view class="skeleton-task-text ds-rounded-md" />
          <view class="skeleton-task-tag ds-rounded-full" />
        </view>
      </view>
    </view>
  </view>
</template>

<script>
/**
 * BaseSkeleton Component
 *
 * REFACTOR: Added design system utilities for consistent spacing and styling
 * - Preserved all template structure and v-for loops
 * - Enhanced with ds-* utility classes
 * - Maintained dark mode support
 * - Added smooth pulse animations
 *
 * @component
 * @example
 * <base-skeleton :isDark="isDarkMode" />
 */
export default {
  name: 'BaseSkeleton',
  props: {
    /**
     * Dark mode flag for skeleton appearance
     */
    isDark: {
      type: Boolean,
      default: false
    }
  }
};
</script>

<style lang="scss" scoped>
/* REFACTOR: Modern skeleton screen with design system integration */

/* VISUAL: Skeleton container with responsive padding */
.skeleton-container {
  width: 100%;
  box-sizing: border-box;
  /* Padding handled by ds-container utility */
}

/* VISUAL: CSS variables for skeleton colors */
.skeleton-container {
  /* Light mode skeleton colors */
  --skeleton-bg: var(--ds-color-surface, var(--bg-card));
  --skeleton-line: #e5e7eb;
  --skeleton-highlight: #d1d5db;
}

/* VISUAL: Dark mode skeleton colors - 优化对比度 */
.skeleton-container.dark-mode {
  --skeleton-bg: var(--ds-color-surface-secondary, #1c1c1e);
  --skeleton-line: #2c2c2e;
  --skeleton-highlight: #3a3a3c;
}

/* VISUAL: Base skeleton card with pulse animation */
.skeleton-card {
  /* Card styling handled by ds-card utility */
  /* #ifndef APP-NVUE */
  animation: skeleton-pulse 1.5s infinite ease-in-out;
  /* #endif */
}

/* VISUAL: Smooth pulse animation */
@keyframes skeleton-pulse {
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.6;
  }

  100% {
    opacity: 1;
  }
}

/* VISUAL: Header skeleton */
.skeleton-header {
  margin-bottom: var(--ds-spacing-md, 24rpx);
  /* Flex layout handled by ds-flex and ds-gap-sm utilities */
}

.skeleton-avatar {
  width: 96rpx;
  /* 48px */
  height: 96rpx;
  border-radius: var(--ds-radius-full, 9999rpx);
  background: var(--skeleton-line);

  /* #ifndef APP-NVUE */
  animation: skeleton-pulse 1.5s infinite ease-in-out;
  /* #endif */
}

.skeleton-greeting {
  flex: 1;
  /* Flex layout handled by ds-flex-col and ds-gap-xs utilities */
}

.skeleton-greeting-text {
  width: 240rpx;
  /* 120px */
  height: 40rpx;
  /* 20px */
  background: var(--skeleton-line);
  border-radius: var(--ds-radius-md, 16rpx);

  /* #ifndef APP-NVUE */
  animation: skeleton-pulse 1.5s infinite ease-in-out;
  /* #endif */
}

.skeleton-time {
  width: 160rpx;
  /* 80px */
  height: 32rpx;
  /* 16px */
  background: var(--skeleton-line);
  border-radius: var(--ds-radius-sm, 12rpx);

  /* #ifndef APP-NVUE */
  animation: skeleton-pulse 1.5s infinite ease-in-out;
  /* #endif */
}

/* VISUAL: Banner skeleton */
.skeleton-banner {
  background: var(--skeleton-line);
  margin-bottom: var(--ds-spacing-md, 24rpx);

  /* #ifndef APP-NVUE */
  animation: skeleton-pulse 1.5s infinite ease-in-out;
  /* #endif */

  /* Flex layout and spacing handled by utility classes */
}

.skeleton-banner-icon {
  width: 80rpx;
  /* 40px */
  height: 80rpx;
  background: var(--skeleton-highlight);
}

.skeleton-banner-text {
  width: 300rpx;
  /* 150px */
  height: 48rpx;
  /* 24px */
  background: var(--skeleton-highlight);
}

/* VISUAL: Quote skeleton */
.skeleton-quote-header {
  margin-bottom: var(--ds-spacing-sm, 16rpx);
  /* Flex layout handled by ds-flex-between utility */
}

.skeleton-quote-tag {
  width: 160rpx;
  /* 80px */
  height: 48rpx;
  /* 24px */
  background: var(--skeleton-line);
}

.skeleton-quote-date {
  width: 200rpx;
  /* 100px */
  height: 40rpx;
  /* 20px */
  background: var(--skeleton-line);
}

.skeleton-quote-text {
  width: 100%;
  height: 160rpx;
  /* 80px */
  background: var(--skeleton-line);
}

/* VISUAL: Feature area skeleton */
.skeleton-feature {
  margin-bottom: var(--ds-spacing-md, 24rpx);
}

/* VISUAL: Invite banner skeleton */
.skeleton-invite-banner {
  /* Flex layout handled by ds-flex-between utility */
}

.skeleton-banner-content {
  flex: 1;
  /* Flex layout handled by ds-flex-col and ds-gap-xs utilities */
}

.skeleton-banner-title {
  width: 400rpx;
  /* 200px */
  height: 56rpx;
  /* 28px */
  background: var(--skeleton-line);
}

.skeleton-banner-desc {
  width: 500rpx;
  /* 250px */
  height: 48rpx;
  /* 24px */
  background: var(--skeleton-line);
}

.skeleton-banner-arrow {
  width: 60rpx;
  /* 30px */
  height: 60rpx;
  background: var(--skeleton-line);
}

/* VISUAL: Feature grid skeleton */
.skeleton-feature-grid {
  margin-top: var(--ds-spacing-sm, 16rpx);
  /* Flex layout and gap handled by ds-flex and ds-gap-sm utilities */
}

.skeleton-countdown,
.skeleton-practice {
  flex: 1;
  min-height: 360rpx;
  /* 180px */
  /* Flex layout handled by ds-flex-col and ds-flex-center utilities */
}

.skeleton-countdown-label {
  width: 240rpx;
  /* 120px */
  height: 40rpx;
  /* 20px */
  background: var(--skeleton-line);
  margin-bottom: var(--ds-spacing-sm, 16rpx);
}

.skeleton-countdown-value {
  width: 320rpx;
  /* 160px */
  height: 96rpx;
  /* 48px */
  background: var(--skeleton-line);
  margin-bottom: var(--ds-spacing-xs, 12rpx);
}

.skeleton-countdown-date {
  width: 160rpx;
  /* 80px */
  height: 40rpx;
  /* 20px */
  background: var(--skeleton-line);
}

.skeleton-practice-content {
  text-align: center;
  margin-bottom: var(--ds-spacing-sm, 16rpx);
  /* Flex layout handled by ds-flex-col and ds-gap-xs utilities */
}

.skeleton-practice-title {
  width: 240rpx;
  /* 120px */
  height: 56rpx;
  /* 28px */
  background: var(--skeleton-line);
  margin: 0 auto;
}

.skeleton-practice-desc {
  width: 200rpx;
  /* 100px */
  height: 40rpx;
  /* 20px */
  background: var(--skeleton-line);
  margin: 0 auto;
}

.skeleton-practice-play {
  width: 96rpx;
  /* 48px */
  height: 96rpx;
  background: var(--skeleton-line);
}

/* VISUAL: Section skeleton */
.skeleton-section {
  margin-bottom: var(--ds-spacing-md, 24rpx);
}

.skeleton-section-header {
  margin-bottom: var(--ds-spacing-sm, 16rpx);
  /* Flex layout handled by ds-flex-between utility */
}

.skeleton-section-title {
  width: 240rpx;
  /* 120px */
  height: 48rpx;
  /* 24px */
  background: var(--skeleton-line);
}

.skeleton-section-total {
  width: 200rpx;
  /* 100px */
  height: 40rpx;
  /* 20px */
  background: var(--skeleton-line);
}

/* VISUAL: Heatmap skeleton */
.skeleton-heatmap {
  /* Padding handled by ds-p-md utility */
}

.skeleton-heatmap-grid {
  /* Flex layout and gap handled by ds-flex and ds-gap-xs utilities */
}

.skeleton-heatmap-col {
  /* Flex layout and gap handled by ds-flex-col and ds-gap-xs utilities */
}

.skeleton-heatmap-cell {
  width: 24rpx;
  /* 12px */
  height: 24rpx;
  background: var(--skeleton-line);
  border-radius: 6rpx;
  /* 3px */
}

/* VISUAL: Task skeleton */
.skeleton-task-item {
  padding: var(--ds-spacing-sm, 16rpx) 0;
  border-bottom: 1rpx solid var(--skeleton-line);
  /* Flex layout and gap handled by ds-flex and ds-gap-sm utilities */

  &:last-child {
    border-bottom: none;
  }
}

.skeleton-ta<REDACTED_SECRET> {
  width: 48rpx;
  /* 24px */
  height: 48rpx;
  background: var(--skeleton-line);
}

.skeleton-task-text {
  flex: 1;
  height: 48rpx;
  /* 24px */
  background: var(--skeleton-line);
}

.skeleton-task-tag {
  width: 120rpx;
  /* 60px */
  height: 40rpx;
  /* 20px */
  background: var(--skeleton-line);
}

/* VISUAL: Reduced motion support for accessibility */
@media (prefers-reduced-motion: reduce) {
  .skeleton-card,
  .skeleton-avatar,
  .skeleton-greeting-text,
  .skeleton-time,
  .skeleton-banner {
    animation: none;
  }
}
</style>
