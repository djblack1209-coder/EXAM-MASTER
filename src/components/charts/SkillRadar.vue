<template>
  <view class="chart-container">
    <view v-if="!chartReady" class="chart-placeholder">
      <text class="placeholder-text">加载中...</text>
    </view>
    <uni-echarts
      v-else
      ref="chartRef"
      :option="chartOption"
      :style="{ width: width + 'px', height: height + 'px' }"
      @bindinit="onChartReady"
    />
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  // Array of { name: '政治', value: 85, max: 100 }
  data: { type: Array, default: () => [] },
  width: { type: Number, default: 300 },
  height: { type: Number, default: 300 },
  isDark: { type: Boolean, default: false }
});

const chartRef = ref(null);
const chartReady = ref(true); // uni-echarts handles loading

const chartOption = computed(() => {
  if (!props.data.length) return {};

  const indicators = props.data.map((d) => ({
    name: d.name,
    max: d.max || 100
  }));

  const values = props.data.map((d) => d.value);
  const textColor = props.isDark ? '#e0e0e0' : '#333';
  const lineColor = props.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)';

  return {
    radar: {
      indicator: indicators,
      shape: 'polygon',
      splitNumber: 4,
      axisName: {
        color: textColor,
        fontSize: 12,
        fontWeight: 500
      },
      splitLine: {
        lineStyle: { color: lineColor }
      },
      splitArea: {
        areaStyle: {
          color: props.isDark
            ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)']
            : ['rgba(15,95,52,0.02)', 'rgba(15,95,52,0.04)']
        }
      },
      axisLine: {
        lineStyle: { color: lineColor }
      }
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: values,
            name: '掌握度',
            areaStyle: {
              color: props.isDark ? 'rgba(64,200,160,0.25)' : 'rgba(15,95,52,0.18)'
            },
            lineStyle: {
              color: props.isDark ? '#40c8a0' : '#0f5f34',
              width: 2
            },
            itemStyle: {
              color: props.isDark ? '#40c8a0' : '#0f5f34'
            },
            // v2: hover 放大 + 高亮
            emphasis: {
              lineStyle: { width: 3 },
              areaStyle: {
                color: props.isDark ? 'rgba(64,200,160,0.35)' : 'rgba(15,95,52,0.28)'
              },
              itemStyle: {
                borderWidth: 3,
                borderColor: '#fff'
              }
            },
            symbol: 'circle',
            symbolSize: 6
          }
        ],
        animationType: 'scale',
        animationEasing: 'elasticOut'
      }
    ],
    // v2: 增强 tooltip（显示各科掌握度百分比 + 评级）
    tooltip: {
      trigger: 'item',
      backgroundColor: props.isDark ? 'rgba(30,30,40,0.92)' : 'rgba(255,255,255,0.96)',
      borderColor: props.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      borderRadius: 8,
      padding: [8, 12],
      textStyle: { color: props.isDark ? '#e0e0e0' : '#333', fontSize: 12 },
      formatter: (params) => {
        if (!params || !params.value) return '';
        const vals = params.value;
        let html = '<div style="font-weight:600;margin-bottom:4px">能力画像</div>';
        for (let i = 0; i < indicators.length && i < vals.length; i++) {
          const v = vals[i];
          const level = v >= 80 ? '优秀' : v >= 60 ? '良好' : v >= 40 ? '一般' : '待提升';
          const color = v >= 80 ? '#34d399' : v >= 60 ? '#fbbf24' : v >= 40 ? '#fb923c' : '#f87171';
          html += `<div style="display:flex;justify-content:space-between;gap:12px;margin:2px 0">${indicators[i].name} <span style="font-weight:600;color:${color}">${v}% ${level}</span></div>`;
        }
        return html;
      }
    }
  };
});

function onChartReady() {
  chartReady.value = true;
}
</script>

<style lang="scss" scoped>
.chart-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.chart-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 300rpx;
}

.placeholder-text {
  color: var(--text-sub);
  font-size: 26rpx;
}
</style>
