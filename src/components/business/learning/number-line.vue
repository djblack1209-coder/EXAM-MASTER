<template>
  <view v-if="geometry" class="number-line" role="img" :aria-label="description">
    <text>{{ description }}</text>
    <view class="axis">
      <view class="movement" :style="{ left: geometry.left + '%', width: geometry.width + '%' }">
        <text>{{ geometry.b >= 0 ? '→' : '←' }}</text>
      </view>
      <view class="mark" :style="{ left: geometry.start + '%' }">
        <text>{{ geometry.a }} 起点</text>
      </view>
      <view class="mark finish" :style="{ left: geometry.end + '%' }">
        <text>{{ geometry.answer }} 终点</text>
      </view>
    </view>
    <text>位置按数值比例展示；提示经历会保留，之后需要独立检验。</text>
  </view>
  <view v-else-if="solution" class="number-line solution-line" role="img" :aria-label="solution.description">
    <text>{{ solution.description }}</text>
    <view v-if="solution.kind !== 'empty'" class="axis">
      <template v-if="solution.kind === 'intervals'">
        <view
          v-for="(segment, index) in solution.segments"
          :key="'segment-' + index"
          class="movement"
          :style="{ left: segment.left + '%', width: segment.width + '%' }"
        >
          <text>{{ segment.direction }}</text>
        </view>
        <view
          v-for="boundary in solution.boundaries"
          :key="boundary.value"
          class="boundary"
          :class="{ closed: boundary.closed }"
          :style="{ left: boundary.position + '%' }"
        >
          <text>{{ boundary.value }}</text>
        </view>
      </template>
      <template v-else>
        <view
          class="movement"
          :style="{
            left: solution.kind === 'all' ? '10%' : solution.right ? '50%' : '10%',
            width: solution.kind === 'all' ? '80%' : '40%'
          }"
        >
          <text>{{ solution.kind === 'all' ? '← 全部实数 →' : solution.right ? '→' : '←' }}</text>
        </view>
        <view v-if="solution.kind === 'half_line'" class="boundary" :class="{ closed: solution.closed }">
          <text>{{ solution.boundary }}</text>
        </view>
      </template>
    </view>
    <text>箭头表示延伸到无穷；边界位置是示意，标签值精确。帮助保留，随后需要独立检验。</text>
  </view>
</template>
<script setup>
import { computed } from 'vue';
import { inequalityDiagram } from '../../../../laf-backend/functions/_shared/learning-algebra.js';
const props = defineProps({ question: { type: Object, required: true } });
const geometry = computed(() => {
  if (props.question.source?.kind !== 'executable') return null;
  const m = /^计算 ([+-]?\d{1,5}) \+ ([+-]?\d{1,5})。$/.exec(props.question.prompt);
  if (!m) return null;
  const a = Number(m[1]),
    b = Number(m[2]),
    answer = a + b;
  const low = Math.min(a, answer),
    span = Math.max(1, Math.abs(b));
  const position = (n) => 10 + (80 * (n - low)) / span;
  const start = position(a),
    end = position(answer);
  return { a, b, answer, start, end, left: Math.min(start, end), width: Math.abs(end - start) };
});
const description = computed(() =>
  geometry.value
    ? `从 ${geometry.value.a} ${geometry.value.b >= 0 ? '向右' : '向左'}移动 ${Math.abs(geometry.value.b)}，得到 ${geometry.value.answer}。`
    : ''
);
const solution = computed(() => inequalityDiagram(props.question));
</script>
<style scoped>
.number-line {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 20rpx;
  color: var(--space-ink, var(--text-primary, #202a36));
  background: var(--space-composer, var(--bg-card, #fff));
  border: 1rpx solid var(--space-line, var(--border, #c5ccd5));
  border-radius: 12px;
}
.axis {
  position: relative;
  height: 108rpx;
  margin: 20rpx 10rpx;
  border-top: 2rpx solid currentColor;
}
.movement {
  position: absolute;
  top: -40rpx;
  border-bottom: 4rpx solid var(--space-paper, var(--primary));
  text-align: center;
}
.mark {
  position: absolute;
  top: 0;
  border-left: 2rpx solid currentColor;
  padding-top: 20rpx;
}
.mark text {
  display: block;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: 22rpx;
}
.finish {
  top: 34rpx;
  border: none;
}
.boundary {
  position: absolute;
  left: 50%;
  top: -10rpx;
  width: 16rpx;
  height: 16rpx;
  border: 2rpx solid currentColor;
  border-radius: 50%;
  background: var(--space-composer, var(--bg-card, #fff));
  transform: translateX(-50%);
}
.boundary.closed {
  background: currentColor;
}
.boundary text {
  position: absolute;
  top: 26rpx;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}
</style>
