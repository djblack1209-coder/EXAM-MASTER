<template>
  <view class="swipe-card-stack" role="region" aria-label="滑动卡片区域">
    <view v-if="currentIndex < cards.length" class="stack-container">
      <view
        v-for="(card, i) in visibleCards"
        :key="card._id || i"
        class="card-wrapper"
        :style="cardStyle(i)"
        :aria-hidden="i !== 0"
        :tabindex="i === 0 ? 0 : -1"
        :role="i === 0 ? 'group' : undefined"
        :aria-label="i === 0 ? '当前卡片，左滑再练，右滑掌握，上滑收藏' : undefined"
        @touchstart.prevent="i === 0 && onTouchStart($event)"
        @touchmove.prevent="i === 0 && onTouchMove($event)"
        @touchend.prevent="i === 0 && onTouchEnd($event)"
        @keydown="i === 0 && onKeyDown($event)"
      >
        <!-- Directional overlays (top card only) -->
        <view v-if="i === 0 && isDragging" class="overlay-container">
          <view class="overlay overlay-right" :style="{ opacity: rightOpacity }">
            <text class="overlay-text">✓ 掌握</text>
          </view>
          <view class="overlay overlay-left" :style="{ opacity: leftOpacity }">
            <text class="overlay-text">✗ 再练</text>
          </view>
          <view class="overlay overlay-up" :style="{ opacity: upOpacity }">
            <text class="overlay-text">⭐ 收藏</text>
          </view>
        </view>
        <slot name="card" :card="card" :index="currentIndex + i">
          <view class="card-default">
            <text>{{ card.title || '卡片 ' + (currentIndex + i + 1) }}</text>
          </view>
        </slot>
      </view>
    </view>
    <view v-else class="empty-container">
      <slot name="empty">
        <view class="empty-default">
          <text class="empty-text">已完成全部卡片</text>
        </view>
      </slot>
    </view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  cards: { type: Array, default: () => [] },
  threshold: { type: Number, default: 100 },
  maxRotation: { type: Number, default: 15 },
  stackSize: { type: Number, default: 3 },
  stackScale: { type: Number, default: 0.05 }
});

const emit = defineEmits(['swipe-right', 'swipe-left', 'swipe-up', 'stack-empty']);

const currentIndex = ref(0);
const isDragging = ref(false);
const deltaX = ref(0);
const deltaY = ref(0);
const isAnimatingOut = ref(false);
const animOutStyle = ref(null);

// Touch tracking state (borrowed from vue-card-stack pattern)
let startX = 0;
let startY = 0;
let startTime = 0;
let lastX = 0;
let lastTime = 0;
let velocityX = 0;

const visibleCards = computed(() => {
  const end = Math.min(currentIndex.value + props.stackSize, props.cards.length);
  return props.cards.slice(currentIndex.value, end);
});

// Overlay opacity based on drag distance
const rightOpacity = computed(() => Math.min(Math.max(deltaX.value / props.threshold, 0), 1));
const leftOpacity = computed(() => Math.min(Math.max(-deltaX.value / props.threshold, 0), 1));
const upOpacity = computed(() => Math.min(Math.max(-deltaY.value / (props.threshold * 0.8), 0), 1));

function cardStyle(i) {
  const base = {
    zIndex: props.stackSize - i,
    transition:
      isDragging.value && i === 0 ? 'none' : 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.35s ease',
    transform: stackTransform(i),
    opacity: i === 0 && isAnimatingOut.value ? 0 : 1
  };
  if (i === 0 && isAnimatingOut.value && animOutStyle.value) {
    return {
      ...base,
      ...animOutStyle.value,
      opacity: 1,
      transition: 'transform 0.35s ease-out, opacity 0.35s ease-out'
    };
  }
  return base;
}

function stackTransform(i) {
  if (i === 0) {
    // Top card follows touch — physics from vue-card-stack: translate + rotation proportional to deltaX
    const dx = deltaX.value;
    const dy = deltaY.value * 0.3;
    const rotate = Math.min(Math.max(dx * 0.1, -props.maxRotation), props.maxRotation);
    return `translate(${dx}px, ${dy}px) rotate(${rotate}deg) scale(1)`;
  }
  // Stack cards: progressively smaller and offset downward
  const effectiveI = i - (isDragging.value ? Math.min(Math.abs(deltaX.value) / props.threshold, 1) * 0.3 : 0);
  const scale = 1 - effectiveI * props.stackScale;
  const translateY = effectiveI * 12;
  return `translate(0, ${translateY}px) scale(${scale})`;
}

// --- Touch handlers (adapted from vue-card-stack drag pattern) ---
function onTouchStart(e) {
  if (isAnimatingOut.value) return;
  const touch = e.touches[0];
  startX = touch.clientX;
  startY = touch.clientY;
  startTime = Date.now();
  lastX = startX;
  lastTime = startTime;
  velocityX = 0;
  isDragging.value = true;
  deltaX.value = 0;
  deltaY.value = 0;
}

function onTouchMove(e) {
  if (!isDragging.value) return;
  const touch = e.touches[0];
  const now = Date.now();
  const dt = now - lastTime;
  if (dt > 0) {
    velocityX = ((touch.clientX - lastX) / dt) * 1000; // px/s
  }
  lastX = touch.clientX;
  lastTime = now;
  deltaX.value = touch.clientX - startX;
  deltaY.value = touch.clientY - startY;
}

function onTouchEnd() {
  if (!isDragging.value) return;
  isDragging.value = false;

  const absDx = Math.abs(deltaX.value);
  const absDy = Math.abs(deltaY.value);
  const absVel = Math.abs(velocityX);
  const fastSwipe = absVel > 800; // velocity threshold for fast flick

  // Determine swipe direction
  if (deltaY.value < -props.threshold * 0.8 && absDy > absDx) {
    dismissCard('up');
  } else if (deltaX.value > props.threshold || (fastSwipe && deltaX.value > 30)) {
    dismissCard('right');
  } else if (-deltaX.value > props.threshold || (fastSwipe && deltaX.value < -30)) {
    dismissCard('left');
  } else {
    // Spring back — elastic easing handled by CSS transition
    deltaX.value = 0;
    deltaY.value = 0;
  }
}

function dismissCard(direction) {
  const card = props.cards[currentIndex.value];
  const flyDistance = 600;

  // Animate off-screen
  isAnimatingOut.value = true;
  if (direction === 'right') {
    animOutStyle.value = {
      transform: `translate(${flyDistance}px, ${deltaY.value * 0.3}px) rotate(${props.maxRotation}deg)`
    };
  } else if (direction === 'left') {
    animOutStyle.value = {
      transform: `translate(${-flyDistance}px, ${deltaY.value * 0.3}px) rotate(${-props.maxRotation}deg)`
    };
  } else {
    animOutStyle.value = { transform: `translate(${deltaX.value}px, ${-flyDistance}px) rotate(0deg)`, opacity: 0 };
  }

  deltaX.value = 0;
  deltaY.value = 0;

  setTimeout(() => {
    isAnimatingOut.value = false;
    animOutStyle.value = null;
    currentIndex.value++;

    if (direction === 'right') emit('swipe-right', card);
    else if (direction === 'left') emit('swipe-left', card);
    else emit('swipe-up', card);

    if (currentIndex.value >= props.cards.length) {
      emit('stack-empty');
    }
  }, 350);
}

// --- Keyboard support ---
function onKeyDown(e) {
  if (isAnimatingOut.value) return;
  const map = { ArrowRight: 'right', ArrowLeft: 'left', ArrowUp: 'up' };
  const dir = map[e.key];
  if (dir) {
    e.preventDefault();
    dismissCard(dir);
  }
}
</script>

<style lang="scss" scoped>
.swipe-card-stack {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stack-container {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  max-height: 70vh;
}

.card-wrapper {
  position: absolute;
  inset: 0;
  border-radius: 24rpx;
  overflow: hidden;
  background: var(--apple-glass-card-bg, #fff);
  border: 1px solid var(--apple-glass-border-strong, rgba(0, 0, 0, 0.08));
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
  will-change: transform;
  transform-origin: center center;
  -webkit-user-select: none;
  user-select: none;

  &:focus-visible {
    outline: 4rpx solid var(--primary, #4361ee);
    outline-offset: 4rpx;
  }
}

.overlay-container {
  position: absolute;
  inset: 0;
  z-index: 10;
  pointer-events: none;
}

.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  opacity: 0;
}

.overlay-right {
  background: rgba(52, 199, 89, 0.2);
  border: 4rpx solid rgba(52, 199, 89, 0.6);

  .overlay-text {
    color: #34c759;
  }
}

.overlay-left {
  background: rgba(255, 59, 48, 0.2);
  border: 4rpx solid rgba(255, 59, 48, 0.6);

  .overlay-text {
    color: #ff3b30;
  }
}

.overlay-up {
  background: rgba(0, 122, 255, 0.2);
  border: 4rpx solid rgba(0, 122, 255, 0.6);

  .overlay-text {
    color: #007aff;
  }
}

.overlay-text {
  font-size: 48rpx;
  font-weight: 700;
  letter-spacing: 4rpx;
}

.card-default {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 32rpx;
  font-size: 36rpx;
  color: var(--text-primary, #1d1d1f);
}

.empty-container {
  width: 100%;
  padding: 80rpx 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-default {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.empty-text {
  font-size: 32rpx;
  color: var(--text-sub, #86868b);
}
</style>
