<template>
  <view class="quiz-progress">
    <scroll-view :id="scrollId" scroll-x :scroll-left="scrollLeft" scroll-with-animation class="progress-scroll">
      <view class="dot-track">
        <view v-for="idx in total" :key="idx - 1" class="dot-wrapper" @tap="$emit('tap', idx - 1)">
          <view class="dot" :class="dotClass(idx - 1)" />
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { computed, watch, ref, nextTick } from 'vue';

const props = defineProps({
  total: { type: Number, default: 0 },
  current: { type: Number, default: 0 },
  answered: { type: Array, default: () => [] }
});

defineEmits(['tap']);

const scrollId = 'quiz-progress-scroll';
const scrollLeft = ref(0);

// 每个 dot-wrapper 宽度约 40rpx = 20px（在 750rpx 设计稿下）
const DOT_UNIT = 20;

const answeredMap = computed(() => {
  const map = {};
  props.answered.forEach((item) => {
    map[item.index] = item.isCorrect;
  });
  return map;
});

function dotClass(idx) {
  if (idx === props.current) return 'dot-active';
  if (idx in answeredMap.value) {
    return answeredMap.value[idx] ? 'dot-correct' : 'dot-wrong';
  }
  return 'dot-default';
}

// 自动滚动让当前 dot 居中
watch(
  () => props.current,
  (val) => {
    nextTick(() => {
      // 视口大约能显示 ~9 个 dot，居中偏移 = current * unit - 4 * unit
      const offset = Math.max(0, (val - 4) * DOT_UNIT);
      scrollLeft.value = offset;
    });
  },
  { immediate: true }
);
</script>

<style scoped lang="scss">
.quiz-progress {
  width: 100%;
  overflow: hidden;
}

.progress-scroll {
  white-space: nowrap;
  height: 48rpx;
}

.dot-track {
  display: inline-flex;
  align-items: center;
  height: 48rpx;
  padding: 0 16rpx;
}

.dot-wrapper {
  width: 40rpx;
  height: 48rpx;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  transition: all 0.25s ease;
}

/* 当前题 */
.dot-active {
  width: 24rpx;
  height: 24rpx;
  background: var(--primary, #0f5f34);
  box-shadow: 0 0 12rpx var(--brand-glow, rgba(15, 95, 52, 0.28));
}

/* 答对 */
.dot-correct {
  background: var(--success, #10b981);
}

/* 答错 */
.dot-wrong {
  background: var(--danger, #ef4444);
}

/* 未答 */
.dot-default {
  background: var(--bg-secondary, #d4f2b4);
  border: 1px solid var(--border, #98cd6f);
  opacity: 0.6;
}

/* 暗色模式 */
.dark-mode .dot-default {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.15);
}
</style>
