<template>
  <view v-if="geometry" class="number-line" role="img" :aria-label="description">
    <text>{{ description }}</text>
    <view class="axis">
      <view class="movement" :style="{ left: geometry.left + '%', width: geometry.width + '%' }">
        <text>{{ geometry.b >= 0 ? '→' : '←' }}</text>
      </view>
      <view class="mark" :style="{ left: geometry.start + '%' }">
        <text>{{ geometry.a }}{{ t('learning.kra') }}</text>
      </view>
      <view class="mark finish" :style="{ left: geometry.end + '%' }">
        <text>{{ geometry.answer }}{{ t('learning.kjy') }}</text>
      </view>
    </view>
    <text>{{ t('learning.kgt') }}</text>
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
          <text>{{ solution.kind === 'all' ? t('learning.k9y') : solution.right ? '→' : '←' }}</text>
        </view>
        <view v-if="solution.kind === 'half_line'" class="boundary" :class="{ closed: solution.closed }">
          <text>{{ solution.boundary }}</text>
        </view>
      </template>
    </view>
    <text>{{ t('learning.kmo') }}</text>
  </view>
</template>
<script setup>
import { t } from '@/i18n/index.js';

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
    ? t('learning.numberLine', {
        start: geometry.value.a,
        direction: t(geometry.value.b >= 0 ? 'learning.right' : 'learning.left'),
        distance: Math.abs(geometry.value.b),
        answer: geometry.value.answer
      })
    : ''
);
const solution = computed(() => inequalityDiagram(props.question));
</script>
<style scoped>
.number-line {
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
  padding: var(--s-4);
  color: var(--ink);
  background: var(--paper-sunk);
  border: var(--s-4) solid var(--line);
  border-radius: var(--s-3);
}
.axis {
  position: relative;
  height: var(--s-4);
  margin: var(--s-4) var(--s-4);
  border-top: var(--border-thin) solid currentColor;
}
.movement {
  position: absolute;
  top: calc(var(--s-5) * -1);
  border-bottom: var(--border-selected) solid var(--clay-face);
  text-align: center;
}
.mark {
  position: absolute;
  top: 0;
  border-left: var(--border-thin) solid currentColor;
  padding-top: var(--s-4);
}
.mark text {
  display: block;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: var(--size-title-2);
}
.finish {
  top: var(--s-4);
  border: none;
}
.boundary {
  position: absolute;
  left: 50%;
  top: calc(var(--s-4) * -1);
  width: var(--s-2);
  height: var(--s-2);
  border: var(--border-thin) solid currentColor;
  border-radius: 50%;
  background: var(--paper-sunk);
  transform: translateX(-50%);
}
.boundary.closed {
  background: currentColor;
}
.boundary text {
  position: absolute;
  top: var(--s-4);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
}
</style>
