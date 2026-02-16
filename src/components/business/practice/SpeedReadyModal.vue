<template>
  <view v-if="visible" class="speed-modal-mask">
    <div class="speed-card">
      <div class="speed-content">
        <text class="speed-icon">
          ⚡️
        </text>
        <h3 class="speed-title">
          极速体验就绪
        </h3>
        <p class="speed-desc">
          前 5 道题已生成！您可以立即开始，AI 将在后台静默为您补充剩余题目。
        </p>
        <button class="primary-btn" @tap="$emit('start')">
          立即开始
        </button>
      </div>
    </div>
  </view>
</template>

<script>
export default {
  name: 'SpeedReadyModal',
  props: {
    visible: { type: Boolean, default: false }
  },
  emits: ['start']
};
</script>

<style lang="scss" scoped>
.speed-modal-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: var(--overlay); backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center; z-index: 999;
}
.speed-card {
  background-color: var(--bg-card); border: 1px solid var(--border);
  border-radius: 20px; padding: 40px; text-align: center;
  box-shadow: var(--shadow-xl); max-width: 400px; width: 90%;
  animation: fadeInUp 0.3s ease-out;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.speed-content { display: flex; flex-direction: column; align-items: center; }
.speed-icon {
  font-size: 128rpx; margin-bottom: 20px;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
.speed-title {
  font-size: 48rpx; font-weight: 600; color: var(--text-primary); margin: 0 0 12px 0;
}
.speed-desc {
  font-size: 28rpx; color: var(--text-sub); margin: 0 0 24px 0; line-height: 1.6;
}
.primary-btn {
  width: 100%; padding: 14px 0; border-radius: 28px;
  background: var(--gradient-primary); color: var(--primary-foreground);
  font-size: 36rpx; font-weight: 600; border: none;
  box-shadow: var(--shadow-primary); transition: all 0.3s ease;
}
.primary-btn::after { border: none; }
</style>
