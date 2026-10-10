<template>
  <view class="velocity-graph" :class="{ 'graph-dark': theme.isDark }">
    <text class="graph-title">速度—时间图 · 向右为正</text>
    <canvas
      v-if="recipe"
      :id="canvasId"
      :canvas-id="canvasId"
      class="velocity-canvas"
      :style="{ height: `${height}px` }"
      role="img"
      :aria-label="description"
    ></canvas>
    <text v-else class="graph-error" role="status">图形条件待核对</text>
    <text v-if="unavailable && recipe" class="graph-error" role="status">图形暂不可用，折点数据保留</text>
    <view v-if="recipe" class="graph-points" aria-label="速度图折点数据">
      <text v-for="(point, i) in recipe.points" :key="i">{{ point.time }} s · {{ point.velocity }} m/s</text>
    </view>
    <text v-if="observed" class="graph-note">零线上方为正，下方为负</text>
  </view>
</template>
<script setup>
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
  height = 210;
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
    ? `速度—时间图，向右为正，横轴时间秒，纵轴速度米每秒，相邻折点之间为直线。${recipe.value.points.map((p) => `${p.time}秒时速度${p.velocity}米每秒`).join('；')}`
    : '图形条件待核对'
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
  ctx.font = '12px "DM Sans", "PingFang SC", sans-serif';
  const dark = theme.isDark,
    ink = dark ? '#f8f4ff' : '#272039',
    line = dark ? '#c9b1ee' : '#7050b0';
  const left = 44,
    right = width - 18,
    top = 25,
    bottom = height - 35;
  const minimum = Math.min(-1, ...points.map((p) => p.velocity)),
    maximum = Math.max(1, ...points.map((p) => p.velocity));
  const x = (t) => left + ((right - left) * t) / recipe.value.physicalSeconds;
  const y = (v) => bottom - ((bottom - top) * (v - minimum)) / (maximum - minimum);
  ctx.clearRect(0, 0, width, height);
  ctx.setFillStyle(dark ? '#30283f' : '#f0edfc');
  ctx.fillRect(0, 0, width, height);
  if (observed.value) {
    const frame = visualFrame(recipe.value, props.step);
    for (const part of frame.areas) {
      if (!part.sign) continue;
      ctx.setFillStyle(
        part.sign > 0
          ? dark
            ? 'rgba(133,173,255,0.3)'
            : 'rgba(94,135,220,0.23)'
          : dark
            ? 'rgba(205,164,242,0.3)'
            : 'rgba(160,108,200,0.25)'
      );
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
  ctx.setStrokeStyle(dark ? '#817292' : '#b6a8cd');
  ctx.setLineWidth(1);
  for (const value of [minimum, 0, maximum]) {
    ctx.beginPath();
    ctx.moveTo(left, y(value));
    ctx.lineTo(right, y(value));
    ctx.stroke();
    ctx.setFillStyle(ink);
    ctx.setFontSize(12);
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
  ctx.setFontSize(12);
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
  padding: 12px;
  border-radius: 18px;
  color: #272039;
  background: #f0edfc;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.graph-dark {
  color: #f8f4ff;
  background: #30283f;
}
.velocity-canvas {
  display: block;
  width: 100%;
}
.graph-title {
  font-weight: 700;
  font-size: 14px;
}
.graph-points {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 14px;
  line-height: 1.6;
}
.graph-note,
.graph-error {
  font-size: 14px;
  line-height: 1.6;
}
</style>
