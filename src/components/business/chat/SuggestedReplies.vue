<template>
  <view v-if="visible && replies.length" class="suggested-replies" :class="{ 'dark-mode': isDark }">
    <view
      v-for="(reply, idx) in replies"
      :key="idx"
      class="reply-pill"
      hover-class="pill-hover"
      @tap="$emit('select', reply)"
    >
      <text class="pill-text">{{ reply }}</text>
    </view>
  </view>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import { storageService } from '@/services/storageService.js';

defineProps({
  replies: { type: Array, default: () => [] },
  visible: { type: Boolean, default: false }
});

defineEmits(['select']);

const isDark = ref(false);
onMounted(() => {
  isDark.value = storageService.get('theme_mode', 'light') === 'dark';
  uni.$on('themeUpdate', (mode) => {
    isDark.value = mode === 'dark';
  });
});
</script>

<style lang="scss" scoped>
.suggested-replies {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  padding: 20rpx 32rpx;
  animation: fadeUp 0.35s ease-out;
}
.reply-pill {
  padding: 14rpx 28rpx;
  border-radius: 999rpx;
  background: rgba(120, 120, 128, 0.08);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1rpx solid rgba(120, 120, 128, 0.15);
  transition: all 0.2s;
}
.pill-text {
  font-size: 26rpx;
  color: var(--text-secondary, #666);
  line-height: 1.4;
}
.pill-hover {
  opacity: 0.65;
  transform: scale(0.97);
}
.dark-mode {
  .reply-pill {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
  }
  .pill-text {
    color: var(--text-tertiary, #aaa);
  }
}
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(12rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
