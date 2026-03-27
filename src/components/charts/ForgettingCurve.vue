<template>
  <view class="chart-container">
    <uni-echarts ref="chartRef" :option="chartOption" :style="{ width: width + 'px', height: height + 'px' }" />
  </view>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  // Array of { day: 1, retention: 95 }, { day: 2, retention: 88 }, ...
  data: { type: Array, default: () => [] },
  // Target retention rate (e.g., 90)
  targetRetention: { type: Number, default: 90 },
  width: { type: Number, default: 300 },
  height: { type: Number, default: 220 },
  isDark: { type: Boolean, default: false }
});

const chartOption = computed(() => {
  if (!props.data.length) return {};

  const days = props.data.map((d) => `D${d.day}`);
  const retentions = props.data.map((d) => d.retention);
  const textColor = props.isDark ? '#b0b0b0' : '#666';
  const gridLineColor = props.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  return {
    grid: {
      top: 30,
      right: 20,
      bottom: 30,
      left: 45
    },
    xAxis: {
      type: 'category',
      data: days,
      axisLabel: { color: textColor, fontSize: 11 },
      axisLine: { lineStyle: { color: gridLineColor } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: {
        color: textColor,
        fontSize: 11,
        formatter: '{value}%'
      },
      splitLine: { lineStyle: { color: gridLineColor } },
      axisLine: { show: false }
    },
    series: [
      {
        name: '记忆保持率',
        type: 'line',
        data: retentions,
        smooth: true,
        lineStyle: {
          color: props.isDark ? '#40c8a0' : '#0f5f34',
          width: 2.5
        },
        itemStyle: {
          color: props.isDark ? '#40c8a0' : '#0f5f34'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: props.isDark ? 'rgba(64,200,160,0.3)' : 'rgba(15,95,52,0.2)' },
              { offset: 1, color: props.isDark ? 'rgba(64,200,160,0.02)' : 'rgba(15,95,52,0.01)' }
            ]
          }
        },
        symbol: 'circle',
        symbolSize: 5,
        animationDuration: 1200,
        animationEasing: 'cubicOut'
      },
      {
        name: '目标保持率',
        type: 'line',
        data: new Array(days.length).fill(props.targetRetention),
        lineStyle: {
          color: props.isDark ? 'rgba(255,159,10,0.6)' : 'rgba(245,158,11,0.5)',
          width: 1.5,
          type: 'dashed'
        },
        itemStyle: { opacity: 0 },
        symbol: 'none',
        tooltip: { show: false }
      }
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: props.isDark ? 'rgba(30,30,40,0.92)' : 'rgba(255,255,255,0.96)',
      borderColor: props.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      borderRadius: 8,
      padding: [8, 12],
      textStyle: { color: props.isDark ? '#e0e0e0' : '#333' },
      formatter: (params) => {
        const point = params.find((p) => p.seriesName === '记忆保持率');
        if (!point) return '';
        const v = point.value;
        const status = v >= props.targetRetention ? '✓ 达标' : `↓ 低于目标 ${props.targetRetention}%`;
        const color = v >= props.targetRetention ? '#34d399' : '#fb923c';
        return (
          `<div style="font-weight:600;margin-bottom:4px">${point.name}</div>` +
          `<div>保持率: <span style="font-weight:700">${v}%</span></div>` +
          `<div style="color:${color};font-size:11px;margin-top:2px">${status}</div>`
        );
      }
    }
  };
});
</script>

<style lang="scss" scoped>
.chart-container {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
