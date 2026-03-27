<template>
  <view class="chart-container">
    <uni-echarts ref="chartRef" :option="chartOption" :style="{ width: width + 'px', height: height + 'px' }" />
  </view>
</template>

<script setup>
/**
 * StudyTrend v2 — 学习趋势图（增强版）
 *
 * 搬运参考：
 *   - ECharts 官方 Gallery (GitHub 60k+): dataZoom + areaStyle + 自定义 tooltip
 *   - Apache ECharts 最佳实践: 渐变面积 + 柱状圆角 + 动画延迟
 *
 * v2 升级:
 *   1. 做题量折线新增渐变 areaStyle（数据面积感）
 *   2. dataZoom 滑块支持（>7天数据可横向滚动）
 *   3. 自定义 tooltip 格式（双指标对齐 + emoji 图标）
 *   4. 增强动画（入场 + hover 放大）
 *   5. markLine 标记平均值参考线
 */
import { computed } from 'vue';

const props = defineProps({
  data: { type: Array, default: () => [] },
  width: { type: Number, default: 300 },
  height: { type: Number, default: 220 },
  isDark: { type: Boolean, default: false }
});

const chartOption = computed(() => {
  if (!props.data.length) return {};

  const dates = props.data.map((d) => d.date);
  const minutes = props.data.map((d) => d.studyMinutes);
  const questions = props.data.map((d) => d.questionCount);
  const textColor = props.isDark ? '#b0b0b0' : '#666';
  const gridLineColor = props.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  // 计算平均值（用于 markLine 参考线）
  const avgMinutes = minutes.length ? Math.round(minutes.reduce((a, b) => a + b, 0) / minutes.length) : 0;

  // 是否需要 dataZoom（数据超过 7 天）
  const needsZoom = dates.length > 7;

  return {
    grid: {
      top: 40,
      right: 50,
      bottom: needsZoom ? 55 : 30,
      left: 45
    },
    legend: {
      data: ['学习时长', '做题量'],
      top: 0,
      textStyle: { color: textColor, fontSize: 11 },
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 16
    },
    // v2: 数据量 >7 天时启用横向滑块
    ...(needsZoom
      ? {
          dataZoom: [
            {
              type: 'slider',
              show: true,
              start: Math.max(0, 100 - (7 / dates.length) * 100),
              end: 100,
              height: 18,
              bottom: 5,
              borderColor: 'transparent',
              backgroundColor: props.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              fillerColor: props.isDark ? 'rgba(64,200,160,0.2)' : 'rgba(15,95,52,0.15)',
              handleStyle: {
                color: props.isDark ? '#40c8a0' : '#0f5f34',
                borderColor: props.isDark ? '#40c8a0' : '#0f5f34'
              },
              textStyle: { color: textColor, fontSize: 10 }
            }
          ]
        }
      : {}),
    xAxis: {
      type: 'category',
      data: dates,
      axisLabel: { color: textColor, fontSize: 10 },
      axisLine: { lineStyle: { color: gridLineColor } },
      axisTick: { show: false }
    },
    yAxis: [
      {
        type: 'value',
        name: '分钟',
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: { color: textColor, fontSize: 10 },
        splitLine: { lineStyle: { color: gridLineColor } },
        axisLine: { show: false }
      },
      {
        type: 'value',
        name: '题数',
        nameTextStyle: { color: textColor, fontSize: 10 },
        axisLabel: { color: textColor, fontSize: 10 },
        splitLine: { show: false },
        axisLine: { show: false }
      }
    ],
    series: [
      {
        name: '学习时长',
        type: 'bar',
        data: minutes,
        barWidth: '40%',
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: props.isDark ? '#40c8a0' : '#1a8048' },
              { offset: 1, color: props.isDark ? 'rgba(64,200,160,0.4)' : 'rgba(15,95,52,0.3)' }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        },
        // v2: hover 放大效果
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: props.isDark ? 'rgba(64,200,160,0.4)' : 'rgba(15,95,52,0.3)' }
        },
        // v2: 平均值参考线
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: {
            color: props.isDark ? 'rgba(64,200,160,0.4)' : 'rgba(15,95,52,0.25)',
            type: 'dashed',
            width: 1
          },
          label: {
            color: textColor,
            fontSize: 9,
            formatter: `均 ${avgMinutes}分钟`
          },
          data: [{ type: 'average', name: '平均' }]
        },
        animationDelay: (idx) => idx * 80
      },
      {
        name: '做题量',
        type: 'line',
        yAxisIndex: 1,
        data: questions,
        smooth: true,
        lineStyle: {
          color: props.isDark ? '#5fa8ff' : '#3b82f6',
          width: 2
        },
        itemStyle: {
          color: props.isDark ? '#5fa8ff' : '#3b82f6'
        },
        // v2: 渐变面积填充（数据面积感）
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: props.isDark ? 'rgba(95,168,255,0.25)' : 'rgba(59,130,246,0.18)' },
              { offset: 1, color: props.isDark ? 'rgba(95,168,255,0.02)' : 'rgba(59,130,246,0.01)' }
            ]
          }
        },
        symbol: 'circle',
        symbolSize: 5,
        // v2: hover 放大
        emphasis: {
          scale: true,
          itemStyle: { borderWidth: 3, borderColor: '#fff' }
        },
        animationDuration: 1000
      }
    ],
    // v2: 增强 tooltip — 双指标对齐格式
    tooltip: {
      trigger: 'axis',
      backgroundColor: props.isDark ? 'rgba(30,30,40,0.92)' : 'rgba(255,255,255,0.96)',
      borderColor: props.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      borderRadius: 8,
      padding: [8, 12],
      textStyle: { color: props.isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      formatter: (params) => {
        if (!params || !params.length) return '';
        let html = `<div style="font-weight:600;margin-bottom:4px">${params[0].name}</div>`;
        for (const p of params) {
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>`;
          html += `<div style="display:flex;justify-content:space-between;gap:16px">${dot}${p.seriesName}<span style="font-weight:600;margin-left:auto">${p.value}${p.seriesIndex === 0 ? '分钟' : '题'}</span></div>`;
        }
        return html;
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
