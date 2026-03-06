<template>
  <view v-if="visible" class="practice-modes-modal-overlay" @tap="$emit('close')">
    <view class="practice-modes-modal" @tap.stop>
      <view class="practice-modes-modal-header">
        <text class="practice-modes-modal-title"> 选择练习模式 </text>
        <view class="practice-modes-modal-close" @tap="$emit('close')">
          <BaseIcon name="close" :size="24" />
        </view>
      </view>
      <view class="practice-modes-modal-body">
        <view class="practice-modes-grid">
          <view v-for="mode in modes" :key="mode.id" class="practice-mode-item" @tap="$emit('select', mode)">
            <view class="practice-mode-icon">
              {{ mode.icon }}
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

<script>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

export default {
  name: 'PracticeModesModal',
  components: { BaseIcon },
  props: {
    visible: { type: Boolean, default: false },
    modes: { type: Array, default: () => [] }
  },
  emits: ['close', 'select']
};
</script>

<style lang="scss" scoped>
.practice-modes-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--overlay);
  backdrop-filter: blur(10px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
.practice-modes-modal {
  width: 100%;
  max-width: 420px;
  background: var(--bg-card);
  border-radius: 24px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  animation: fadeInUp 0.3s ease-out;
}
.practice-modes-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.practice-modes-modal-title {
  font-size: 44rpx;
  font-weight: 700;
  color: var(--text-primary);
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
  background: var(--bg-secondary);
}
.practice-modes-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.practice-mode-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  border-radius: 20px;
  background: var(--bg-secondary);
  text-align: center;
  border: 1px solid var(--border);
  transition: all 0.2s ease;
  cursor: pointer;
}
.practice-mode-item:active {
  transform: scale(0.97);
  background: var(--primary-light);
}
.practice-mode-icon {
  font-size: 48rpx;
  margin-bottom: 12px;
}
.practice-mode-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}
.practice-mode-desc {
  font-size: 22rpx;
  color: var(--text-sub);
  line-height: 1.4;
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
