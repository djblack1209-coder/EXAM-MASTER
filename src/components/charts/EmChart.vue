<template>
  <canvas
    class="em-chart"
    :id="canvasId"
    :canvas-id="canvasId"
    :style="{ width: width + 'px', height: height + 'px' }"
    @init="onCanvasInit"
  />
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { useF2Chart } from '@/composables/useF2Chart.js';
import { Chart, Line, Interval, Point, Area, Axis, Legend, Tooltip } from '@antv/f2';

const props = defineProps({
  type: { type: String, default: 'line', validator: (v) => ['line', 'bar', 'pie', 'ring', 'area'].includes(v) },
  data: { type: Array, default: () => [] },
  width: { type: Number, default: 300 },
  height: { type: Number, default: 200 },
  colors: { type: Array, default: null }
});

const emit = defineEmits(['ready']);

const canvasId = ref(`em-chart-${Date.now()}`);
const canvasRef = ref(null);

const defaultColors = ['var(--em-brand)', 'var(--em-success)', 'var(--em-error)', 'var(--em-warning)'];
const chartColors = computed(() => props.colors || defaultColors);

/** Resolve CSS variable to actual color value for canvas rendering */
function resolveCSSColor(val) {
  if (typeof val !== 'string' || !val.startsWith('var(')) return val;
  // #ifdef H5
  const name = val.slice(4, -1).trim();
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#333';
  // #endif
  // #ifndef H5
  return '#333';
  // #endif
}

function resolvedColors() {
  return chartColors.value.map(resolveCSSColor);
}

function resolvedTextColor() {
  return resolveCSSColor('var(--em-text)');
}

function buildChartConfig(data) {
  const colors = resolvedColors();
  const textColor = resolvedTextColor();
  const axisStyle = { label: { fill: textColor, fontSize: 10 }, grid: { stroke: '#e8e8e8', lineWidth: 0.5 } };

  const presets = {
    line: (
      <Chart data={data}>
        <Axis field="x" style={axisStyle} />
        <Axis field="y" style={axisStyle} />
        <Line x="x" y="y" color={colors[0]} />
        <Point x="x" y="y" color={colors[0]} />
        <Tooltip />
      </Chart>
    ),
    bar: (
      <Chart data={data}>
        <Axis field="x" style={axisStyle} />
        <Axis field="y" style={axisStyle} />
        <Interval x="x" y="y" color={colors} />
        <Tooltip />
      </Chart>
    ),
    pie: (
      <Chart data={data} coord={{ type: 'polar', transposed: true }}>
        <Interval x="a" y="y" color={{ field: 'x', range: colors }} adjust="stack" />
        <Legend position="bottom" />
      </Chart>
    ),
    ring: (
      <Chart data={data} coord={{ type: 'polar', transposed: true, innerRadius: 0.55 }}>
        <Interval x="a" y="y" color={{ field: 'x', range: colors }} adjust="stack" />
        <Legend position="bottom" />
      </Chart>
    ),
    area: (
      <Chart data={data}>
        <Axis field="x" style={axisStyle} />
        <Axis field="y" style={axisStyle} />
        <Area x="x" y="y" color={colors[0]} />
        <Line x="x" y="y" color={colors[0]} />
        <Tooltip />
      </Chart>
    )
  };

  return presets[props.type] || presets.line;
}

const { isReady, updateData, init } = useF2Chart({
  canvasRef,
  chartConfig: buildChartConfig,
  data: props.data,
  width: props.width,
  height: props.height
});

watch(isReady, (v) => {
  if (v) emit('ready');
});
watch(
  () => props.data,
  (d) => updateData(d),
  { deep: true }
);

function onCanvasInit(e) {
  canvasRef.value = e.detail || e.target;
  init(canvasRef.value);
}

onMounted(() => {
  // #ifdef H5
  const el = document.getElementById(canvasId.value);
  if (el) {
    canvasRef.value = el;
    init(el);
  }
  // #endif
});
</script>

<style scoped>
.em-chart {
  display: block;
}
</style>
