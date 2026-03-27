<template>
  <view v-if="particles.length" class="confetti-container">
    <view
      v-for="(p, i) in particles"
      :key="i"
      class="confetti-particle"
      :style="{
        left: p.x + '%',
        top: p.startY + '%',
        backgroundColor: p.color,
        width: p.size + 'rpx',
        height: p.size * 1.5 + 'rpx',
        animationDuration: p.duration + 's',
        animationDelay: p.delay + 's',
        transform: 'rotate(' + p.rotation + 'deg)'
      }"
    />
  </view>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const particles = ref([]);
let clearTimer = null;

function onConfetti(data) {
  const { count = 30, colors, origin = { x: 0.5, y: 0.6 } } = data;
  const newParticles = [];

  for (let i = 0; i < count; i++) {
    newParticles.push({
      x: origin.x * 100 + (Math.random() - 0.5) * 60,
      startY: origin.y * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 8 + Math.random() * 12,
      duration: 1.5 + Math.random() * 1.5,
      delay: Math.random() * 0.3,
      rotation: Math.random() * 360
    });
  }

  particles.value = newParticles;

  // Clean up after animation
  if (clearTimer) clearTimeout(clearTimer);
  clearTimer = setTimeout(() => {
    particles.value = [];
  }, 3500);
}

onMounted(() => {
  uni.$on('mp-confetti', onConfetti);
});

onUnmounted(() => {
  uni.$off('mp-confetti', onConfetti);
  if (clearTimer) clearTimeout(clearTimer);
});
</script>

<style lang="scss" scoped>
.confetti-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 9998;
  overflow: hidden;
}

.confetti-particle {
  position: absolute;
  border-radius: 4rpx;
  animation: confetti-fall linear forwards;
  opacity: 1;
}

@keyframes confetti-fall {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
  25% {
    transform: translateY(25vh) rotate(180deg) translateX(30rpx) scale(0.9);
    opacity: 0.9;
  }
  50% {
    transform: translateY(50vh) rotate(360deg) translateX(-20rpx) scale(0.8);
    opacity: 0.7;
  }
  75% {
    transform: translateY(75vh) rotate(540deg) translateX(15rpx) scale(0.6);
    opacity: 0.4;
  }
  100% {
    transform: translateY(100vh) rotate(720deg) translateX(-10rpx) scale(0.3);
    opacity: 0;
  }
}
</style>
