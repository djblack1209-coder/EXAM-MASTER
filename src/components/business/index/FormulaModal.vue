<template>
  <view v-if="visible" class="formula-modal" @tap="$emit('close')">
    <view class="formula-content" @tap.stop>
      <view class="panel-handle" />
      <view class="formula-header">
        <view>
          <text class="formula-eyebrow"> Quick Reference </text>
          <text class="formula-title">
            <view class="formula-title-icon">
              <BaseIcon name="formula" :size="32" />
            </view>
            <text class="formula-title-text">公式定理速查</text>
          </text>
        </view>
        <view class="formula-close" @tap="$emit('close')">
          <text>
            <BaseIcon name="close" :size="24" />
          </text>
        </view>
      </view>
      <scroll-view scroll-y class="formula-scroll">
        <view v-for="(item, index) in formulaList" :key="index" class="formula-item">
          <view class="formula-category">
            {{ item.category }}
          </view>
          <text class="formula-name">
            {{ item.name }}
          </text>
          <text class="formula-text">
            {{ item.formula }}
          </text>
        </view>
      </scroll-view>
      <view class="formula-footer">
        <text class="formula-tip"> <BaseIcon name="bulb" :size="24" /> 更多公式正在整理中... </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

defineProps({
  visible: { type: Boolean, default: false },
  formulaList: { type: Array, default: () => [] }
});
defineEmits(['close']);
</script>

<style lang="scss" scoped>
.formula-modal {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 30rpx 24rpx calc(24rpx + env(safe-area-inset-bottom, 0px));
  background: rgba(9, 18, 12, 0.32);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.formula-content {
  width: 100%;
  max-width: 720rpx;
  max-height: 78vh;
  padding: 14rpx 22rpx 22rpx;
  border-radius: 36rpx 36rpx 28rpx 28rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-card);
  animation: slideUp 0.26s ease;
}

.panel-handle {
  width: 84rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 6rpx auto 18rpx;
}

.formula-header,
.formula-close,
.formula-title {
  display: flex;
  align-items: center;
}

.formula-header {
  justify-content: space-between;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  padding: 6rpx 6rpx 20rpx;
}

.formula-eyebrow,
.formula-name,
.formula-text,
.formula-tip {
  display: block;
}

.formula-eyebrow {
  margin-bottom: 6rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-secondary);
}

.formula-title {
  /* gap: 10rpx; -- replaced for Android WebView compat */
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-main);
}

.formula-title-icon {
  margin-right: 10rpx;
  display: inline-flex;
  align-items: center;
}

.formula-title-text {
  display: inline-flex;
  align-items: center;
}

.formula-close {
  justify-content: center;
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
  color: var(--text-main);
  font-size: 40rpx;
}

.formula-scroll {
  max-height: 60vh;
  padding-right: 4rpx;
}

.formula-item {
  margin-bottom: 16rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: rgba(255, 255, 255, 0.56);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
}

.formula-category {
  display: inline-flex;
  align-items: center;
  padding: 8rpx 16rpx;
  border-radius: 999rpx;
  background: rgba(52, 199, 89, 0.14);
  color: var(--primary);
  font-size: 20rpx;
  margin-bottom: 12rpx;
}

.formula-name {
  font-size: 28rpx;
  font-weight: 620;
  color: var(--text-main);
  margin-bottom: 10rpx;
}

.formula-text {
  font-size: 32rpx;
  line-height: 1.5;
  font-weight: 700;
  color: var(--text-main);
  font-family: 'Times New Roman', serif;
}

.formula-footer {
  margin-top: 16rpx;
  padding-top: 20rpx;
  border-top: 1px solid var(--apple-divider);
  text-align: center;
}

.formula-tip {
  font-size: 24rpx;
  color: var(--text-sub);
}

.formula-close:active {
  transform: scale(0.97);
}

:global(.dark-mode) .formula-modal {
  background: rgba(3, 8, 14, 0.48);
}

:global(.dark-mode) .panel-handle {
  background: rgba(255, 255, 255, 0.16);
}

:global(.dark-mode) .formula-close {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

:global(.dark-mode) .formula-item {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

:global(.dark-mode) .formula-category {
  background: rgba(10, 132, 255, 0.16);
  color: #7bc0ff;
}

:global(.dark-mode) .formula-title,
:global(.dark-mode) .formula-name,
:global(.dark-mode) .formula-text,
:global(.dark-mode) .formula-tip {
  color: #ffffff;
}

@keyframes slideUp {
  from {
    transform: translateY(100rpx);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}
</style>
