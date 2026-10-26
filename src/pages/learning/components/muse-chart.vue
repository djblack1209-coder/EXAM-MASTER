<template>
  <view class="muse-chart" role="figure" :aria-label="chart.caption || chart.title">
    <text v-if="chart.title" class="chart-title">{{ chart.title }}</text>
    <view class="chart-body" :class="{ 'is-donut': chart.type === 'donut' }">
      <!-- #ifdef H5 -->
      <img
        v-if="source"
        class="donut-image"
        :src="source"
        :alt="chart.caption || chart.title || ''"
        draggable="false"
      />
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <image
        v-if="source"
        class="donut-image"
        :src="source"
        mode="aspectFit"
        :aria-label="chart.caption || chart.title"
      />
      <!-- #endif -->
      <view class="chart-series">
        <view
          v-for="(item, index) in chart.series"
          :key="index"
          class="chart-row"
          :class="`tone-${item.tone || 'default'}`"
        >
          <text class="chart-label">{{ item.label }}</text>
          <view
            v-if="chart.type !== 'donut'"
            class="chart-track"
            :role="chart.type === 'progress' ? 'progressbar' : undefined"
            :aria-label="item.label"
            :aria-valuenow="item.value"
            :aria-valuemin="0"
            :aria-valuemax="maximum"
          >
            <view
              class="chart-fill"
              :style="{ width: `${maximum > 0 ? Math.min(100, (item.value / maximum) * 100) : 0}%` }"
            />
          </view>
          <view v-else class="chart-dot" aria-hidden="true" />
          <text class="chart-value">{{ item.value }}{{ chart.unit || '' }}</text>
        </view>
      </view>
    </view>
    <text v-if="chart.caption" class="chart-caption">{{ chart.caption }}</text>
  </view>
</template>
<script setup>
import { computed } from 'vue';
import { useThemeStore } from '@/stores/modules/theme.js';
import { museTokens } from '@/design/tokens.js';
import { chartSvg } from '../../../../laf-backend/functions/_shared/learning-figures.js';
const props = defineProps({ chart: { type: Object, required: true } });
const theme = useThemeStore();
const maximum = computed(() =>
  props.chart.type === 'progress'
    ? (props.chart.total ?? 100)
    : Math.max(0, ...props.chart.series.map((item) => item.value))
);
const source = computed(() => {
  if (props.chart.type !== 'donut') return '';
  const colors = museTokens[theme.isDark ? 'dark' : 'light'];
  return (
    'data:image/svg+xml,' +
    encodeURIComponent(
      chartSvg(props.chart, {
        default: colors['--violet'],
        track: colors['--line-strong'],
        success: colors['--muse-rich-success'],
        warning: colors['--muse-rich-warning'],
        danger: colors['--muse-rich-danger']
      })
    )
  );
});
</script>
<style scoped>
.muse-chart {
  min-width: 0;
}
.chart-title {
  display: block;
  margin-bottom: 12px;
  font-weight: 600;
}
.chart-series {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.chart-row {
  display: flex;
  align-items: center;
  gap: 8px;
  --chart-color: var(--violet);
}
.tone-success {
  --chart-color: var(--muse-rich-success);
}
.tone-warning {
  --chart-color: var(--muse-rich-warning);
}
.tone-danger {
  --chart-color: var(--muse-rich-danger);
}
.chart-label {
  width: 88px;
  flex: none;
  overflow-wrap: anywhere;
  font-size: 13px;
}
.chart-track {
  flex: 1;
  min-width: 0;
  height: 8px;
  border-radius: 8px;
  overflow: hidden;
  background: var(--line-strong);
}
.chart-fill {
  height: 100%;
  background: var(--chart-color);
  border-radius: inherit;
}
.chart-value {
  width: 52px;
  flex: none;
  text-align: right;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.chart-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--chart-color);
  flex: none;
}
.is-donut {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.is-donut .chart-label {
  width: auto;
  flex: 1;
}
.donut-image {
  width: 140px;
  height: 140px;
  flex: none;
}
.chart-caption {
  display: block;
  color: var(--ink-3);
  font-size: 12px;
  margin-top: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
</style>
