<template>
  <view v-if="visible" class="pause-banner apple-glass-card">
    <view class="pause-info">
      <text class="pause-title"> 上传任务已暂停 </text>
      <text class="pause-desc"> 可随时继续生成题库 </text>
    </view>
    <button class="pause-resume-btn apple-cta" @tap="$emit('resume')">继续生成</button>
  </view>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false }
});
defineEmits(['resume']);
</script>

<style lang="scss" scoped>
.pause-banner {
  position: relative;
  overflow: hidden;
  background: linear-gradient(160deg, var(--apple-glass-card-bg) 0%, var(--apple-group-bg) 100%);
  border: 1px solid var(--apple-glass-border-strong);
  border-radius: 24px;
  padding: 16px;
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* gap: 12px; -- replaced for Android WebView compat */
  box-shadow: var(--apple-shadow-card);
}

.pause-banner::before {
  content: '';
  position: absolute;
  left: 24rpx;
  right: 24rpx;
  top: 0;
  height: 1rpx;
  background: var(--apple-specular-soft);
}
.pause-info {
  display: flex;
  flex-direction: column;
  /* gap: 4px; -- replaced for Android WebView compat */
}
.pause-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
}
.pause-desc {
  font-size: 24rpx;
  color: var(--text-sub);
}
.pause-resume-btn {
  background: var(--cta-primary-bg);
  color: var(--cta-primary-text);
  border: 1rpx solid var(--cta-primary-border);
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 24rpx;
  box-shadow: var(--cta-primary-shadow);
}

.pause-resume-btn::after {
  border: none;
}
</style>
