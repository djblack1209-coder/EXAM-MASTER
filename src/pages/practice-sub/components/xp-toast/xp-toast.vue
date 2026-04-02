<template>
  <view v-if="visible" class="xp-toast" :style="positionStyle">
    <view class="xp-toast-inner" :class="{ 'xp-toast-animate': animating }">
      <text class="xp-amount">+{{ amount }} XP</text>
      <text v-if="multiplier > 1" class="xp-multiplier">x{{ multiplier }}</text>
    </view>
  </view>
</template>

<script setup>
/**
 * XP 浮动文字组件（跨平台，兼容小程序/H5/App）
 *
 * 用法：通过 uni.$on('gamification:show-xp') 触发显示
 * 或直接调用 ref.show({ amount, x, y, multiplier })
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const visible = ref(false);
const animating = ref(false);
const amount = ref(0);
const multiplier = ref(1);
const x = ref(0);
const y = ref(0);
let timerId = null;

const positionStyle = computed(() => {
  return {
    left: x.value ? `${x.value}px` : '50%',
    top: y.value ? `${y.value}px` : '45%'
  };
});

function show({ amount: amt = 10, x: posX = 0, y: posY = 0, multiplier: mult = 1 } = {}) {
  if (timerId) clearTimeout(timerId);
  amount.value = amt;
  multiplier.value = mult;
  x.value = posX;
  y.value = posY;
  visible.value = true;
  animating.value = false;

  // 触发动画（下一帧）
  setTimeout(() => {
    animating.value = true;
  }, 16);

  // 1.2秒后隐藏
  timerId = setTimeout(() => {
    visible.value = false;
    animating.value = false;
  }, 1200);
}

onMounted(() => {
  uni.$on('gamification:show-xp', show);
});

onBeforeUnmount(() => {
  uni.$off('gamification:show-xp', show);
  if (timerId) clearTimeout(timerId);
});

// 暴露 show 方法，供父组件通过 ref 调用
defineExpose({ show });
</script>

<style scoped lang="scss">
.xp-toast {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  transform: translateX(-50%);
}

.xp-toast-inner {
  display: flex;
  align-items: center;
  /* gap: 4rpx; */
  opacity: 1;
  transform: translateY(0);
  transition: all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.xp-toast-inner > view + view {
  margin-left: 4rpx;
}

.xp-toast-inner.xp-toast-animate {
  opacity: 0;
  transform: translateY(-80rpx);
}

.xp-amount {
  font-size: 36rpx;
  font-weight: 700;
  color: #ffd700;
  text-shadow: 0 2rpx 8rpx rgba(255, 215, 0, 0.5);
}

.xp-multiplier {
  font-size: 24rpx;
  font-weight: 600;
  color: #ff6b35;
  margin-left: 4rpx;
}
</style>
