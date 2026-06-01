<template>
  <view class="quiz-progress" :class="{ 'dark-mode': isDark }">
    <view class="progress-meter-wrap">
      <view class="progress-meter" :aria-label="progressAriaLabel">
        <view class="progress-meter-fill" :style="{ width: progressPercent + '%' }" />
        <view class="progress-meter-thumb" :style="{ left: progressPercent + '%' }" />
      </view>
      <text class="progress-percent">{{ progressPercent }}%</text>
    </view>
    <view class="progress-meta">
      <text class="progress-count">第 {{ safeCurrent }} / {{ safeTotal }} 题</text>
      <text class="progress-state">{{ progressStateLabel }}</text>
    </view>
    <scroll-view :id="scrollId" scroll-x :scroll-left="scrollLeft" scroll-with-animation class="progress-scroll">
      <view class="dot-track">
        <view v-for="idx in safeTotal" :key="idx - 1" class="dot-wrapper" @tap="$emit('tap', idx - 1)">
          <view class="dot" :class="dotClass(idx - 1)" />
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { computed, watch, ref, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { storageService } from '@/services/storageService.js';

const props = defineProps({
  total: { type: Number, default: 0 },
  current: { type: Number, default: 0 },
  answered: { type: Array, default: () => [] }
});

defineEmits(['tap']);

const scrollId = 'quiz-progress-scroll';
const scrollLeft = ref(0);
const isDark = ref(storageService.get('theme_mode', 'light') === 'dark');
let themeHandler;

onMounted(() => {
  themeHandler = (mode) => {
    isDark.value = mode === 'dark';
  };
  uni.$on('themeUpdate', themeHandler);
  uni.$on('updateTheme', themeHandler);
});

onBeforeUnmount(() => {
  if (!themeHandler) return;
  uni.$off('themeUpdate', themeHandler);
  uni.$off('updateTheme', themeHandler);
});

// 每个 dot-wrapper 宽度约 40rpx = 20px（在 750rpx 设计稿下）
const DOT_UNIT = 20;

const answeredMap = computed(() => {
  const map = {};
  props.answered.forEach((item) => {
    const index = Number(item?.index);
    if (!Number.isFinite(index) || index < 0 || index >= safeTotal.value) return;
    map[index] = item.isCorrect === true ? 'correct' : item.isCorrect === false ? 'wrong' : 'reviewed';
  });
  return map;
});

const safeTotal = computed(() => Math.max(0, Number(props.total) || 0));
const safeCurrent = computed(() => {
  if (safeTotal.value <= 0) return 0;
  return Math.min(safeTotal.value, Math.max(1, (Number(props.current) || 0) + 1));
});
const answeredCount = computed(() => {
  return Object.keys(answeredMap.value).length;
});
const correctCount = computed(() => {
  return Object.values(answeredMap.value).filter((status) => status === 'correct').length;
});
const wrongCount = computed(() => {
  return Object.values(answeredMap.value).filter((status) => status === 'wrong').length;
});
const remainingCount = computed(() => {
  return Math.max(0, safeTotal.value - answeredCount.value);
});
const progressPercent = computed(() => {
  if (safeTotal.value <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((safeCurrent.value / safeTotal.value) * 100)));
});
const progressStateLabel = computed(() => {
  if (safeTotal.value <= 0) return '等待题目';
  if (wrongCount.value > 0) return `${answeredCount.value} 已答 · ${correctCount.value} 对 ${wrongCount.value} 错`;
  return `${answeredCount.value} 已答 · 剩 ${remainingCount.value}`;
});
const progressAriaLabel = computed(() => {
  return `练习进度 第 ${safeCurrent.value} / ${safeTotal.value} 题，${progressStateLabel.value}`;
});

function dotClass(idx) {
  const status = answeredMap.value[idx];
  if (idx === props.current) return status ? `dot-active dot-${status}` : 'dot-active';
  if (status) return `dot-${status}`;
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

.progress-meter-wrap {
  display: flex;
  align-items: center;
}

.progress-meter {
  position: relative;
  flex: 1;
  height: 16rpx;
  overflow: hidden;
  border-radius: 999rpx;
  background: rgba(148, 163, 184, 0.2);
  box-shadow: inset 0 1rpx 2rpx rgba(15, 23, 42, 0.08);
}

.progress-meter-fill {
  height: 100%;
  min-width: 14rpx;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--success, #34d399), var(--primary, #00e0ff));
  box-shadow: 0 0 18rpx var(--brand-glow, rgba(0, 224, 255, 0.22));
  transition: width 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.progress-meter-thumb {
  position: absolute;
  top: 50%;
  width: 20rpx;
  height: 20rpx;
  border: 3rpx solid rgba(255, 255, 255, 0.92);
  border-radius: 999rpx;
  background: var(--primary, #0f5f34);
  box-shadow: 0 0 18rpx var(--brand-glow, rgba(15, 95, 52, 0.24));
  transform: translate(-50%, -50%);
  transition: left 280ms cubic-bezier(0.16, 1, 0.3, 1);
}

.progress-percent {
  min-width: 58rpx;
  margin-left: 10rpx;
  color: var(--text-primary, #111827);
  font-size: 19rpx;
  font-weight: 850;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8rpx;
  padding: 0 2rpx;
}

.progress-count {
  font-size: 22rpx;
  font-weight: 800;
  color: var(--text-primary, #111827);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.progress-state {
  min-width: 0;
  margin-left: 12rpx;
  overflow: hidden;
  font-size: 20rpx;
  font-weight: 600;
  color: var(--text-secondary, #64748b);
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-scroll {
  white-space: nowrap;
  height: 48rpx;
  margin-top: 2rpx;
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
  transition:
    width 220ms cubic-bezier(0.16, 1, 0.3, 1),
    height 220ms cubic-bezier(0.16, 1, 0.3, 1),
    background-color 180ms ease,
    box-shadow 180ms ease;
}

/* 当前题 */
.dot-active {
  width: 30rpx;
  height: 18rpx;
  background: var(--primary, #0f5f34);
  border-radius: 999rpx;
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

/* 已复习但不判断正误，例如经典闪卡 */
.dot-reviewed {
  background: var(--primary, #0f5f34);
  opacity: 0.72;
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

.dark-mode .progress-meter {
  background: rgba(255, 255, 255, 0.12);
}

.dark-mode .progress-meter-thumb {
  border-color: rgba(16, 19, 26, 0.92);
  background: var(--primary, #00e0ff);
}

.dark-mode .progress-percent,
.dark-mode .progress-count {
  color: #f5f7fb;
}

.dark-mode .progress-state {
  color: rgba(245, 247, 251, 0.64);
}

.dark-mode .dot-reviewed {
  background: rgba(117, 221, 255, 0.78);
}
</style>
