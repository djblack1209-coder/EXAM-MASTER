<template>
  <view v-if="visible" class="pause-banner">
    <view class="pause-info">
      <text class="pause-title"> 上传任务已暂停 </text>
      <text class="pause-desc"> 可随时继续生成题库 </text>
    </view>
    <button class="pause-resume-btn" @tap="$emit('resume')">继续生成</button>
  </view>
</template>

<script>
export default {
  name: 'PauseBanner',
  props: {
    visible: { type: Boolean, default: false }
  },
  emits: ['resume']
};
</script>

<style lang="scss" scoped>
.pause-banner {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 16px;
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.pause-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  background: var(--primary);
  color: var(--primary-foreground);
  border: none;
  border-radius: 16px;
  padding: 8px 14px;
  font-size: 24rpx;
}
</style>
