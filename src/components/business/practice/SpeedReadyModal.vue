<template>
  <view v-if="visible" class="speed-modal-mask">
    <view class="speed-card">
      <view class="speed-content">
        <view class="speed-icon">
          <BaseIcon name="lightning" :size="64" />
        </view>
        <view class="speed-title"> 极速体验就绪 </view>
        <view class="speed-desc"> 前 5 道题已生成！您可以立即开始，智能将在后台静默为您补充剩余题目。 </view>
        <button class="primary-btn" @tap="$emit('start')">立即开始</button>
      </view>
    </view>
  </view>
</template>

<script setup>
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

defineProps({
  visible: { type: Boolean, default: false }
});
defineEmits(['start']);
</script>

<style lang="scss" scoped>
.speed-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}
.speed-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  box-shadow: var(--shadow-xl);
  max-width: 400px;
  width: 90%;
  animation: fadeInUp 0.3s ease-out;
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
.speed-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.speed-icon {
  font-size: 128rpx;
  margin-bottom: 20px;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}
.speed-title {
  font-size: 48rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
}
.speed-desc {
  font-size: 28rpx;
  color: var(--text-sub);
  margin: 0 0 24px 0;
  line-height: 1.6;
}
.primary-btn {
  width: 100%;
  padding: 14px 0;
  border-radius: 28px;
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  font-size: 36rpx;
  font-weight: 600;
  border: 1px solid var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
  transition: all 0.3s ease;
}
.primary-btn::after {
  border: none;
}
</style>
