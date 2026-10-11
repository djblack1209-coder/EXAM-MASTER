<template>
  <view class="velocity-graph" :class="{ 'graph-dark': theme.isDark }">
    <text class="graph-title">{{ t('learning.kiq') }}</text>
    <canvas
      v-if="recipe"
      :id="canvasId"
      :canvas-id="canvasId"
      class="velocity-canvas"
      :style="{ height: `${height}px` }"
      role="img"
      :aria-label="description"
    ></canvas>
    <text v-else class="graph-error" role="status">{{ t('learning.kc4') }}</text>
    <text v-if="unavailable && recipe" class="graph-error" role="status">{{ t('learning.kno') }}</text>
    <view v-if="recipe" class="graph-points" :aria-label="t('learning.ka9')">
      <text v-for="(point, i) in recipe.points" :key="i">{{ point.time }} s · {{ point.velocity }} m/s</text>
    </view>
    <text v-if="observed" class="graph-note">{{ t('learning.kec') }}</text>
  </view>
</template>
<script setup>
import { tokens } from '@/design/tokens.js';
import { t } from '@/i18n/index.js';

import { computed, ref, getCurrentInstance, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useThemeStore } from '@/stores/modules/theme.js';
import {
  visualRecipe,
  visualFrame,
  VELOCITY_GRAPH_TEMPLATE
} from '../../../../laf-backend/functions/_shared/learning-visual.js';
const props = defineProps({
  points: { type: Array, required: true },
  step: { type: Number, default: null },
  visible: { type: Boolean, default: true }
});
const theme = useThemeStore(),
  instance = getCurrentInstance();
const canvasId = `velocity_graph_${instance.uid}`,
  height = Number.parseFloat(tokens.light['--s-14']) * 4;
const unavailable = ref(false);
let alive = true,
  generation = 0;
const recipe = computed(() => {
  try {
    return visualRecipe({ template: VELOCITY_GRAPH_TEMPLATE, points: props.points });
  } catch {
    return null;
  }
});
const observed = computed(
  () => recipe.value && Number.isInteger(props.step) && props.step > 0 && props.step <= recipe.value.steps
);
const description = computed(() =>
  recipe.value
    ? t('learning.graphDescription', {
        points: recipe.value.points
          .map((p) => t('learning.graphPoint', { time: p.time, velocity: p.velocity }))
          .join('; ')
      })
    : t('learning.graphPending')
);
function draw(width, current) {
  if (
    !recipe.value ||
    typeof uni.createCanvasContext !== 'function' ||
    width < 100 ||
    !alive ||
    !props.visible ||
    current !== generation
  )
    return;
  const points = recipe.value.points,
    ctx = uni.createCanvasContext(canvasId, instance.proxy);
  if (!ctx) {
    unavailable.value = true;
    return;
  }
  unavailable.value = false;
  const palette = tokens[theme.isDark ? 'dark' : 'light'];
  const ink = palette['--ink'],
    line = palette['--violet'];
  const size = Number.parseFloat(palette['--size-caption']);
  ctx.font = `${size}px ${palette['--font-ui']}`;
  const left = 44,
    right = width - 18,
    top = 25,
    bottom = height - 35;
  const minimum = Math.min(-1, ...points.map((p) => p.velocity)),
    maximum = Math.max(1, ...points.map((p) => p.velocity));
  const x = (t) => left + ((right - left) * t) / recipe.value.physicalSeconds;
  const y = (v) => bottom - ((bottom - top) * (v - minimum)) / (maximum - minimum);
  ctx.clearRect(0, 0, width, height);
  ctx.setFillStyle(palette['--paper-sunk']);
  ctx.fillRect(0, 0, width, height);
  if (observed.value) {
    const frame = visualFrame(recipe.value, props.step);
    for (const part of frame.areas) {
      if (!part.sign) continue;
      ctx.setFillStyle(palette[part.sign > 0 ? '--blue-soft' : '--violet-soft']);
      ctx.beginPath();
      ctx.moveTo(x(part.from), y(0));
      ctx.lineTo(x(part.from), y(part.first));
      ctx.lineTo(x(part.to), y(part.last));
      ctx.lineTo(x(part.to), y(0));
      ctx.closePath();
      ctx.fill();
    }
    ctx.setStrokeStyle(ink);
    ctx.setLineWidth(1);
    ctx.beginPath();
    ctx.moveTo(x(frame.time), top);
    ctx.lineTo(x(frame.time), bottom);
    ctx.stroke();
  }
  ctx.setStrokeStyle(palette['--line-strong']);
  ctx.setLineWidth(1);
  for (const value of [minimum, 0, maximum]) {
    ctx.beginPath();
    ctx.moveTo(left, y(value));
    ctx.lineTo(right, y(value));
    ctx.stroke();
    ctx.setFillStyle(ink);
    ctx.setFontSize(size);
    ctx.setTextAlign('right');
    ctx.fillText(String(value), left - 6, y(value) + 4);
  }
  ctx.setStrokeStyle(ink);
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.moveTo(left, y(0));
  ctx.lineTo(right, y(0));
  ctx.stroke();
  ctx.setFillStyle(ink);
  ctx.setFontSize(size);
  ctx.setTextAlign('left');
  ctx.fillText('v (m/s)', 5, 14);
  ctx.fillText('0', left, height - 17);
  ctx.setTextAlign('right');
  ctx.fillText(`${recipe.value.physicalSeconds} s`, right, height - 17);
  ctx.setStrokeStyle(line);
  ctx.setLineWidth(2);
  ctx.beginPath();
  points.forEach((p, i) => (i ? ctx.lineTo(x(p.time), y(p.velocity)) : ctx.moveTo(x(p.time), y(p.velocity))));
  ctx.stroke();
  ctx.setFillStyle(line);
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(x(p.time), y(p.velocity), 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.draw(false);
}
async function redraw() {
  const current = ++generation;
  await nextTick();
  if (!alive || !props.visible || !recipe.value || current !== generation) return;
  if (typeof uni.createSelectorQuery !== 'function' || typeof uni.createCanvasContext !== 'function') {
    unavailable.value = true;
    return;
  }
  uni
    .createSelectorQuery()
    .in(instance.proxy)
    .select(`#${canvasId}`)
    .boundingClientRect((rect) => {
      if (rect && current === generation && alive && props.visible) draw(rect.width, current);
    })
    .exec();
}
watch([recipe, () => props.step, () => props.visible, () => theme.isDark], redraw);
onMounted(() => {
  redraw();
  // #ifdef H5
  window.addEventListener('resize', redraw);
  document.fonts?.ready?.then(() => {
    if (alive && props.visible) redraw();
  });
  // #endif
});
onUnmounted(() => {
  alive = false;
  generation++;
  // #ifdef H5
  window.removeEventListener('resize', redraw);
  // #endif
});
</script>
<style scoped>
.velocity-graph {
  min-width: 0;
  padding: var(--s-3);
  border-radius: var(--s-5);
  color: var(--ink-3);
  background: var(--paper-sunk);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}
.graph-dark {
  color: var(--ink-3);
  background: var(--paper-sunk);
}
.velocity-canvas {
  display: block;
  width: 100%;
}
.graph-title {
  font-weight: var(--weight-bold);
  font-size: var(--size-small);
}
.graph-points {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s-2) var(--s-4);
  font-size: var(--size-small);
  line-height: 1.6;
}
.graph-note,
.graph-error {
  font-size: var(--size-small);
  line-height: 1.6;
}
</style>
