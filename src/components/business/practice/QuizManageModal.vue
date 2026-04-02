<template>
  <view v-if="visible" class="quiz-manage-modal">
    <view class="modal-bg" @tap="$emit('close')" />
    <view class="modal-content apple-glass-card">
      <view class="modal-header">
        <text class="modal-title"> 题库管理 </text>
        <view class="modal-close apple-glass-pill" @tap="$emit('close')">
          <text class="modal-close-icon">
            <BaseIcon name="close" :size="24" />
          </text>
        </view>
      </view>
      <view class="modal-body">
        <view class="manage-info">
          <text class="info-text"> 当前题库共有 {{ totalQuestions }} 道题目 </text>
          <text class="info-sub"> 清空后需重新导入资料生成 </text>
        </view>
      </view>
      <view class="modal-footer">
        <button class="modal-btn secondary apple-glass-pill" @tap="$emit('close')">取消</button>
        <button class="modal-btn danger" @tap="$emit('clear')">清空题库</button>
      </view>
    </view>
  </view>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  totalQuestions: { type: Number, default: 0 }
});
defineEmits(['close', 'clear']);
</script>

<style lang="scss" scoped>
.quiz-manage-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--overlay);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.modal-content {
  position: relative;
  width: 85%;
  max-width: 400px;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border-radius: 28px;
  padding: 32px;
  border: 1px solid var(--apple-glass-border-strong);
  box-shadow: var(--apple-shadow-floating);
  animation: fadeInUp 0.3s ease-out;
  z-index: 1;
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}
.modal-title {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--text-primary);
}
.modal-close {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.66);
  cursor: pointer;
}
.modal-close-icon {
  font-size: 44rpx;
  color: var(--text-sub);
  font-weight: 300;
}
.modal-body {
  margin-bottom: 28px;
}
.manage-info {
  text-align: center;
}
.info-text {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  margin-bottom: 8px;
}
.info-sub {
  font-size: 26rpx;
  color: var(--text-sub);
  display: block;
}
.modal-footer {
  display: flex;
  /* gap: 16px; -- replaced for Android WebView compat */
}
.modal-btn {
  flex: 1;
  height: 48px;
  border-radius: 16px;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-btn.secondary {
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-primary);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
}
.modal-btn.danger {
  background: linear-gradient(135deg, rgba(255, 94, 87, 0.94) 0%, rgba(255, 59, 48, 1) 100%);
  color: #fff;
  border: 1rpx solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 10rpx 24rpx rgba(255, 59, 48, 0.24);
}
.modal-btn::after {
  border: none;
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
