<template>
  <view v-if="visible" class="practice-modes-modal-overlay" @tap="$emit('close')">
    <view class="practice-modes-modal apple-glass-card" @tap.stop>
      <view class="practice-modes-handle" />
      <view class="practice-modes-modal-header">
        <view>
          <text class="practice-modes-eyebrow"> Practice Modes </text>
          <text class="practice-modes-modal-title"> 选择练习模式 </text>
        </view>
        <view class="practice-modes-modal-close apple-glass-pill" @tap="$emit('close')">
          <BaseIcon name="close" :size="24" />
        </view>
      </view>
      <view class="practice-modes-modal-body">
        <view class="practice-modes-grid">
          <view
            v-for="mode in modes"
            :id="`e2e-practice-mode-${mode.id}`"
            :key="mode.id"
            class="practice-mode-item apple-group-card"
            @tap="$emit('select', mode)"
          >
            <view class="practice-mode-icon">
              <BaseIcon :name="mode.iconName || 'bookmark'" :size="40" />
            </view>
            <text class="practice-mode-name">
              {{ mode.name }}
            </text>
            <text class="practice-mode-desc">
              {{ mode.description }}
            </text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

defineProps({
  visible: { type: Boolean, default: false },
  modes: { type: Array, default: () => [] }
});
defineEmits(['close', 'select']);
</script>

<style lang="scss" scoped>
.practice-modes-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(9, 18, 12, 0.32);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 40rpx 24rpx calc(24rpx + env(safe-area-inset-bottom, 0px));
}
.practice-modes-modal {
  width: 100%;
  max-width: 720rpx;
  background:
    linear-gradient(180deg, var(--apple-specular-soft) 0%, transparent 42%),
    linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 36rpx 36rpx 28rpx 28rpx;
  padding: 18rpx 22rpx 24rpx;
  border: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-floating);
  animation: fadeInUp 0.3s ease-out;
}
.practice-modes-handle {
  width: 84rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: rgba(0, 0, 0, 0.12);
  margin: 6rpx auto 18rpx;
}
.practice-modes-eyebrow {
  display: block;
  margin-bottom: 8rpx;
  font-size: 20rpx;
  letter-spacing: 3rpx;
  text-transform: uppercase;
  color: var(--text-sub);
}
.practice-modes-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding: 0 8rpx;
}
.practice-modes-modal-title {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--text-main);
}
.practice-modes-modal-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  color: var(--text-sub);
  cursor: pointer;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(255, 255, 255, 0.42);
  box-shadow: var(--apple-shadow-surface);
}
.practice-modes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  /* gap: 14rpx; */
}
.practice-modes-grid > view {
  margin-right: 14rpx;
  margin-bottom: 14rpx;
}
.practice-modes-grid > view:nth-child(2n) {
  margin-right: 0;
}
.practice-mode-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 224rpx;
  padding: 28rpx 18rpx;
  border-radius: 28rpx;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28) 0%, transparent 42%),
    linear-gradient(160deg, rgba(255, 255, 255, 0.74) 0%, rgba(241, 248, 243, 0.52) 100%);
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.46);
  box-shadow: var(--apple-shadow-surface);
  transition: all 0.2s ease;
  cursor: pointer;
}
.practice-mode-item:active {
  transform: scale(0.97);
  box-shadow: var(--apple-shadow-card);
}
.practice-mode-icon {
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 42rpx;
  margin-bottom: 16rpx;
  border-radius: 999rpx;
  background: rgba(52, 199, 89, 0.12);
  border: 1px solid rgba(52, 199, 89, 0.18);
}
.practice-mode-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 8rpx;
}
.practice-mode-desc {
  font-size: 22rpx;
  color: var(--text-sub);
  line-height: 1.5;
}

:global(.dark-mode) .practice-modes-modal-overlay {
  background: rgba(3, 8, 14, 0.52);
}

:global(.dark-mode) .practice-modes-modal {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

:global(.dark-mode) .practice-modes-handle {
  background: rgba(255, 255, 255, 0.16);
}

:global(.dark-mode) .practice-modes-eyebrow,
:global(.dark-mode) .practice-mode-desc {
  color: rgba(255, 255, 255, 0.68);
}

:global(.dark-mode) .practice-modes-modal-title,
:global(.dark-mode) .practice-mode-name,
:global(.dark-mode) .practice-modes-modal-close {
  color: #ffffff;
}

:global(.dark-mode) .practice-modes-modal-close,
:global(.dark-mode) .practice-mode-item {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, transparent 42%),
    linear-gradient(160deg, rgba(18, 20, 28, 0.94) 0%, rgba(10, 12, 18, 0.9) 100%);
  border-color: rgba(255, 255, 255, 0.1);
}

:global(.dark-mode) .practice-mode-icon {
  background: rgba(10, 132, 255, 0.14);
  border-color: rgba(10, 132, 255, 0.18);
}
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
