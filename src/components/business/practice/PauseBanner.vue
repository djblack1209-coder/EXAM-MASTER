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
  background-color: var(--em3d-card-bg);
  border: 2rpx solid var(--em3d-border);
  border-radius: 24px;
  padding: 16px;
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* gap: 12px; -- replaced for Android WebView compat */
  box-shadow: 0 var(--em3d-depth-md) 0 var(--em3d-border-shadow);
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
