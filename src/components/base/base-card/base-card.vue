<template>
  <view class="base-card apple-glass-card" :class="[paddingClass, { 'is-hoverable': hoverable }]">
    <view v-if="title || $slots.header" class="base-card__header">
      <slot name="header">
        <text v-if="title" class="base-card__title">{{ title }}</text>
        <text v-if="subtitle" class="base-card__subtitle">{{ subtitle }}</text>
      </slot>
    </view>
    <view class="base-card__body">
      <slot />
    </view>
    <view v-if="$slots.footer" class="base-card__footer">
      <slot name="footer" />
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  title: { type: String, default: '' },
  subtitle: { type: String, default: '' },
  padding: { type: String, default: 'medium' }, // none, small, medium, large
  hoverable: { type: Boolean, default: false }
});

const paddingClass = computed(() => `padding-${props.padding}`);
</script>

<style lang="scss" scoped>
.base-card {
  border-radius: var(--ds-radius-xl, 32rpx);
  overflow: hidden;
  
  &.padding-none .base-card__body { padding: 0; }
  &.padding-small .base-card__body { padding: var(--ds-spacing-sm, 16rpx); }
  &.padding-medium .base-card__body { padding: var(--ds-spacing-md, 24rpx); }
  &.padding-large .base-card__body { padding: var(--ds-spacing-lg, 32rpx); }
  
  &__header {
    padding: var(--ds-spacing-md) var(--ds-spacing-md) 0;
  }
  &__title {
    font-size: 32rpx;
    font-weight: bold;
    color: var(--text-primary);
  }
  &__subtitle {
    font-size: 24rpx;
    color: var(--text-sub);
    margin-top: 8rpx;
    display: block;
  }
  &__footer {
    padding: 0 var(--ds-spacing-md) var(--ds-spacing-md);
  }
  
  &.is-hoverable:active {
    transform: scale(0.98);
    transition: transform 0.2s;
  }
}
</style>
