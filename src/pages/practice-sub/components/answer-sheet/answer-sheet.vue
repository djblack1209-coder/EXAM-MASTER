<template>
  <view v-if="visible" class="answer-sheet-overlay" @tap="$emit('close')">
    <view class="answer-sheet" :class="{ 'slide-up': visible }" @tap.stop>
      <!-- 拖拽指示条 -->
      <view class="sheet-handle">
        <view class="handle-bar" />
      </view>

      <!-- 统计摘要 -->
      <view class="sheet-summary">
        <text class="summary-text">已答 {{ answeredCount }}/{{ questions.length }}</text>
        <text class="summary-divider">·</text>
        <text
          class="summary-text"
          :class="{ 'accuracy-good': accuracy >= 60, 'accuracy-bad': accuracy < 60 && gradedCount > 0 }"
        >
          正确率 {{ accuracy }}%
        </text>
        <text class="summary-divider">·</text>
        <text class="summary-text summary-muted">剩 {{ remainingCount }}</text>
      </view>

      <view class="sheet-insight-row">
        <view class="insight-pill correct">
          <text class="insight-value">{{ correctCount }}</text>
          <text class="insight-label">正确</text>
        </view>
        <view class="insight-pill wrong">
          <text class="insight-value">{{ wrongCount }}</text>
          <text class="insight-label">错误</text>
        </view>
        <view class="insight-pill reviewed">
          <text class="insight-value">{{ reviewedCount }}</text>
          <text class="insight-label">已复习</text>
        </view>
      </view>

      <!-- 题号网格 -->
      <scroll-view scroll-y class="sheet-grid-scroll">
        <view class="sheet-grid">
          <view
            v-for="(q, idx) in questions"
            :key="idx"
            class="grid-cell"
            :class="cellClass(idx)"
            hover-class="cell-hover"
            @tap="handleJump(idx)"
          >
            <text class="cell-num">{{ idx + 1 }}</text>
          </view>
        </view>
      </scroll-view>

      <!-- 图例 -->
      <view class="sheet-legend">
        <view class="legend-item">
          <view class="legend-dot dot-current" />
          <text class="legend-label">当前</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot dot-correct" />
          <text class="legend-label">正确</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot dot-wrong" />
          <text class="legend-label">错误</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot dot-reviewed" />
          <text class="legend-label">已复习</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot dot-unanswered" />
          <text class="legend-label">未答</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  questions: { type: Array, default: () => [] },
  currentIndex: { type: Number, default: 0 },
  answeredQuestions: { type: Array, default: () => [] }
});

const emit = defineEmits(['jump', 'close']);

const answeredMap = computed(() => {
  const map = {};
  props.answeredQuestions.forEach((item) => {
    const index = Number(item?.index);
    if (!Number.isFinite(index) || index < 0 || index >= props.questions.length) return;
    map[index] = item.isCorrect === true ? 'correct' : item.isCorrect === false ? 'wrong' : 'reviewed';
  });
  return map;
});

const answeredCount = computed(() => Object.keys(answeredMap.value).length);
const correctCount = computed(() => Object.values(answeredMap.value).filter((status) => status === 'correct').length);
const wrongCount = computed(() => Object.values(answeredMap.value).filter((status) => status === 'wrong').length);
const reviewedCount = computed(() => Object.values(answeredMap.value).filter((status) => status === 'reviewed').length);
const gradedCount = computed(() => correctCount.value + wrongCount.value);
const remainingCount = computed(() => Math.max(0, props.questions.length - answeredCount.value));

const accuracy = computed(() => {
  if (gradedCount.value === 0) return 0;
  return Math.round((correctCount.value / gradedCount.value) * 100);
});

function cellClass(idx) {
  if (idx === props.currentIndex) return 'cell-current';
  const status = answeredMap.value[idx];
  if (status) return `cell-${status}`;
  return 'cell-unanswered';
}

function handleJump(idx) {
  emit('jump', idx);
}
</script>

<style scoped lang="scss">
.answer-sheet-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 900;
  background: var(--overlay, rgba(15, 23, 42, 0.36));
  display: flex;
  align-items: flex-end;
}

.answer-sheet {
  width: 100%;
  max-height: 70vh;
  background: var(--bg-glass, rgba(247, 255, 239, 0.66));
  border: 1px solid var(--border, #98cd6f);
  border-bottom: none;
  border-radius: 40rpx 40rpx 0 0;
  padding: 20rpx 40rpx;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  animation: sheetSlideUp 0.35s cubic-bezier(0.22, 0.68, 0, 1.1);
}

@keyframes sheetSlideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.sheet-handle {
  display: flex;
  justify-content: center;
  padding: 12rpx 0 20rpx;
}

.handle-bar {
  width: 64rpx;
  height: 8rpx;
  border-radius: 4rpx;
  background: var(--muted, #d0ecad);
  opacity: 0.6;
}

/* 统计摘要 */
.sheet-summary {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16rpx 0 18rpx;
}

.summary-text {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary, #10281a);
}

.summary-divider {
  margin: 0 16rpx;
  color: var(--text-sub, #35533f);
  opacity: 0.4;
}

.summary-muted {
  color: var(--text-sub, #35533f);
}

.accuracy-good {
  color: var(--success, #10b981);
}

.accuracy-bad {
  color: var(--danger, #ef4444);
}

.sheet-insight-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding-bottom: 22rpx;
}

.insight-pill {
  min-width: 124rpx;
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.52);
  border: 1rpx solid rgba(15, 23, 42, 0.08);
}

.insight-value {
  font-size: 26rpx;
  font-weight: 850;
  font-variant-numeric: tabular-nums;
}

.insight-label {
  margin-left: 6rpx;
  font-size: 20rpx;
  font-weight: 650;
  color: var(--text-sub, #35533f);
}

.insight-pill.correct .insight-value {
  color: var(--success, #10b981);
}

.insight-pill.wrong .insight-value {
  color: var(--danger, #ef4444);
}

.insight-pill.reviewed .insight-value {
  color: var(--primary, #0f5f34);
}

/* 网格滚动区 */
.sheet-grid-scroll {
  flex: 1;
  max-height: 50vh;
  min-height: 200rpx;
}

.sheet-grid {
  display: flex;
  flex-wrap: wrap;
  padding: 10rpx 0;
}

.grid-cell {
  width: calc(100% / 6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14rpx 0;
}

.cell-num {
  width: 72rpx;
  height: 72rpx;
  line-height: 72rpx;
  text-align: center;
  border-radius: 50%;
  font-size: 26rpx;
  font-weight: 600;
  transition: all 0.2s ease;
}

/* 状态色 */
.cell-current .cell-num {
  background: var(--primary, #0f5f34);
  color: var(--primary-foreground, #ffffff);
  box-shadow: 0 4rpx 16rpx var(--brand-glow, rgba(15, 95, 52, 0.28));
  transform: scale(1.1);
}

.cell-correct .cell-num {
  background: var(--success, #10b981);
  color: var(--text-inverse);
}

.cell-wrong .cell-num {
  background: var(--danger, #ef4444);
  color: var(--text-inverse);
}

.cell-reviewed .cell-num {
  background: rgba(15, 95, 52, 0.14);
  color: var(--primary, #0f5f34);
  border: 1rpx solid rgba(15, 95, 52, 0.22);
}

.cell-unanswered .cell-num {
  background: var(--bg-secondary, #d4f2b4);
  color: var(--text-sub, #35533f);
}

.cell-hover .cell-num {
  opacity: 0.75;
  transform: scale(0.92);
}

/* 图例 */
.sheet-legend {
  display: flex;
  justify-content: center;
  padding: 24rpx 0 8rpx;
  border-top: 1px solid var(--border, #98cd6f);
  margin-top: 16rpx;
}

.legend-item {
  display: flex;
  align-items: center;
  margin: 0 20rpx;
}

.legend-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  margin-right: 8rpx;
}

.dot-current {
  background: var(--primary, #0f5f34);
}

.dot-correct {
  background: var(--success, #10b981);
}

.dot-wrong {
  background: var(--danger, #ef4444);
}

.dot-reviewed {
  background: var(--primary, #0f5f34);
  opacity: 0.72;
}

.dot-unanswered {
  background: var(--bg-secondary, #d4f2b4);
  border: 1px solid var(--border, #98cd6f);
}

.legend-label {
  font-size: 22rpx;
  color: var(--text-sub, #35533f);
}

/* 暗色模式 */
.dark-mode .answer-sheet {
  background: rgba(30, 30, 30, 0.85);
  border-color: rgba(255, 255, 255, 0.08);
}

.dark-mode .handle-bar {
  background: rgba(255, 255, 255, 0.2);
}

.dark-mode .summary-text {
  color: var(--text-primary, #f5f5f7);
}

.dark-mode .summary-muted,
.dark-mode .insight-label {
  color: rgba(255, 255, 255, 0.56);
}

.dark-mode .insight-pill {
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.08);
}

.dark-mode .insight-pill.reviewed .insight-value {
  color: rgba(117, 221, 255, 0.86);
}

.dark-mode .cell-reviewed .cell-num {
  background: rgba(117, 221, 255, 0.12);
  color: rgba(117, 221, 255, 0.92);
  border-color: rgba(117, 221, 255, 0.2);
}

.dark-mode .cell-unanswered .cell-num {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.4);
}

.dark-mode .sheet-legend {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.dark-mode .dot-unanswered {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.15);
}

.dark-mode .dot-reviewed {
  background: rgba(117, 221, 255, 0.78);
}

.dark-mode .legend-label {
  color: rgba(255, 255, 255, 0.5);
}
</style>
