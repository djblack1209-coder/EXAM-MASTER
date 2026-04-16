<template>
  <view class="base-chart" :style="{ height: heightPx + 'px' }">
    <!-- 图表标题 -->
    <view v-if="title" class="base-chart__header">
      <text class="base-chart__title">{{ title }}</text>
      <text v-if="subtitle" class="base-chart__subtitle">{{ subtitle }}</text>
    </view>

    <!-- Canvas 画布 -->
    <canvas
      :id="canvasId"
      :canvas-id="canvasId"
      class="base-chart__canvas"
      :style="{ width: '100%', height: canvasHeightPx + 'px' }"
      @touchstart="onTouch"
      @touchmove="onTouch"
      @touchend="onTouch"
      @tap="onTap"
    ></canvas>

    <!-- 无数据占位 -->
    <view v-if="isEmpty" class="base-chart__empty">
      <text class="base-chart__empty-text">{{ emptyText }}</text>
    </view>
  </view>
</template>

<script setup>
/**
 * BaseChart - uCharts 通用封装组件
 *
 * 封装 @qiun/ucharts 原生 JS 库，提供统一的 props API。
 * 支持图表类型: line / column / area / pie / ring / radar / bar
 * 自动适配深色/浅色主题，自动获取容器宽度，响应式数据更新。
 *
 * 用法:
 *   <base-chart
 *     type="line"
 *     :categories="['周一','周二','周三']"
 *     :series="[{ name: '学习', data: [30, 40, 50] }]"
 *     height="250"
 *   />
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, getCurrentInstance, nextTick } from 'vue';
import uCharts from '@qiun/ucharts';
import { useThemeStore } from '@/stores/modules/theme';

const props = defineProps({
  /** 图表类型 */
  type: {
    type: String,
    default: 'line',
    validator: (v) => ['line', 'column', 'area', 'pie', 'ring', 'radar', 'bar'].includes(v)
  },
  /** X 轴分类标签（饼图/环形图不需要） */
  categories: {
    type: Array,
    default: () => []
  },
  /** 数据系列 [{ name: '系列1', data: [1,2,3], color?: '#ff0000' }] */
  series: {
    type: Array,
    default: () => []
  },
  /** 图表标题 */
  title: {
    type: String,
    default: ''
  },
  /** 图表副标题 */
  subtitle: {
    type: String,
    default: ''
  },
  /** 组件总高度（px），包含标题 */
  height: {
    type: [Number, String],
    default: 250
  },
  /** 是否显示图例 */
  legend: {
    type: Boolean,
    default: true
  },
  /** 是否显示数据标签 */
  dataLabel: {
    type: Boolean,
    default: false
  },
  /** 是否显示数据点形状（折线图） */
  dataPointShape: {
    type: Boolean,
    default: true
  },
  /** 是否开启动画 */
  animation: {
    type: Boolean,
    default: true
  },
  /** 是否开启横向滚动（数据多时） */
  enableScroll: {
    type: Boolean,
    default: false
  },
  /** X 轴每屏显示数量（enableScroll 为 true 时生效） */
  itemCount: {
    type: Number,
    default: 5
  },
  /** 自定义颜色数组 */
  colors: {
    type: Array,
    default: () => []
  },
  /** 无数据时提示文字 */
  emptyText: {
    type: String,
    default: '暂无数据'
  },
  /** 画布内边距 [上, 右, 下, 左] */
  padding: {
    type: Array,
    default: () => [15, 15, 0, 5]
  },
  /** 额外配置（会深度合并到 uCharts 构造参数） */
  extra: {
    type: Object,
    default: () => ({})
  },
  /** X 轴额外配置 */
  xAxisConfig: {
    type: Object,
    default: () => ({})
  },
  /** Y 轴额外配置 */
  yAxisConfig: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['bindtap', 'bindscroll']);

// ---------- 内部状态 ----------
const instance = getCurrentInstance();
const themeStore = useThemeStore();

// 为每个实例生成唯一 canvas id，避免多图表冲突
const canvasId = `base-chart-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const containerWidth = ref(0);
let chartInstance = null;
let resizeTimer = null;

// ---------- 计算属性 ----------
const heightPx = computed(() => Number(props.height));
// canvas 高度 = 总高度 - 标题区域（有标题时减去 50px）
const canvasHeightPx = computed(() => (props.title ? heightPx.value - 50 : heightPx.value));
const isDark = computed(() => themeStore.isDark);

/** 判断是否无数据 */
const isEmpty = computed(() => {
  if (!props.series || props.series.length === 0) return true;
  // 饼图/环形图检查 data 是否有值
  if (['pie', 'ring'].includes(props.type)) {
    return props.series.every((s) => !s.data || s.data === 0);
  }
  // 其他图表检查 data 数组是否全空
  return props.series.every((s) => !s.data || s.data.length === 0);
});

// ---------- 主题色 ----------
/** 根据深色/浅色模式生成 uCharts 需要的颜色配置 */
function getThemeColors() {
  const dark = isDark.value;
  return {
    // 背景色（透明，由外部容器控制）
    background: 'rgba(0,0,0,0)',
    // 文字颜色
    fontColor: dark ? '#94A3B8' : '#6b7280',
    // 网格线颜色
    gridColor: dark ? 'rgba(148,163,184,0.15)' : 'rgba(0,0,0,0.08)',
    // 图例文字颜色
    legendFontColor: dark ? '#CBD5E1' : '#374151',
    // 默认系列颜色
    colors:
      props.colors.length > 0
        ? props.colors
        : dark
          ? ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#FB923C', '#2DD4BF', '#E879F9']
          : ['#4A90E2', '#34D399', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#14B8A6', '#D946EF']
  };
}

// ---------- 核心方法 ----------
/** 获取容器宽度并初始化图表 */
function initChart() {
  const query = uni.createSelectorQuery().in(instance.proxy);
  query
    .select('.base-chart')
    .boundingClientRect((rect) => {
      if (rect && rect.width > 0) {
        containerWidth.value = rect.width;
        nextTick(() => {
          // 延迟一帧确保 canvas DOM 已就绪
          setTimeout(() => renderChart(), 50);
        });
      }
    })
    .exec();
}

/** 创建/更新 uCharts 实例 */
function renderChart() {
  if (containerWidth.value <= 0 || isEmpty.value) return;

  // 销毁旧实例
  destroyChart();

  const theme = getThemeColors();
  const pixelRatio = uni.getSystemInfoSync().pixelRatio || 1;

  // 构建 uCharts 配置
  const opts = {
    $this: instance.proxy,
    canvasId: canvasId,
    type: props.type,
    fontSize: 11,
    fontColor: theme.fontColor,
    background: theme.background,
    pixelRatio: pixelRatio,
    animation: props.animation,
    padding: props.padding,
    legend: {
      show: props.legend,
      fontColor: theme.legendFontColor,
      lineHeight: 11,
      margin: 5
    },
    dataLabel: props.dataLabel,
    dataPointShape: props.dataPointShape,
    enableScroll: props.enableScroll,
    colors: theme.colors,
    categories: props.categories,
    series: formatSeries(props.series),
    width: containerWidth.value * pixelRatio,
    height: canvasHeightPx.value * pixelRatio,
    // X 轴配置
    xAxis: {
      disableGrid: false,
      gridColor: theme.gridColor,
      fontColor: theme.fontColor,
      scrollShow: props.enableScroll,
      itemCount: props.enableScroll ? props.itemCount : undefined,
      ...props.xAxisConfig
    },
    // Y 轴配置
    yAxis: {
      gridColor: theme.gridColor,
      fontColor: theme.fontColor,
      showTitle: false,
      ...props.yAxisConfig
    },
    // 额外图表类型特定配置
    extra: buildExtraConfig()
  };

  try {
    chartInstance = new uCharts(opts);
  } catch (err) {
    console.warn('[BaseChart] uCharts 渲染失败:', err);
  }
}

/** 根据图表类型构建 extra 配置 */
function buildExtraConfig() {
  const base = { ...props.extra };
  const dark = isDark.value;

  switch (props.type) {
    case 'line':
    case 'area':
      return {
        line: {
          type: 'curve',
          width: 2,
          activeType: 'hollow',
          ...base.line
        },
        area:
          props.type === 'area'
            ? { type: 'gradient', opacity: 0.3, addLine: true, width: 2, gradient: true, ...base.area }
            : base.area,
        tooltip: {
          showBox: true,
          bgColor: dark ? '#1E293B' : '#FFFFFF',
          fontColor: dark ? '#E2E8F0' : '#1A1D1F',
          borderColor: dark ? '#334155' : '#E2E8F0',
          borderWidth: 1,
          borderRadius: 6,
          ...base.tooltip
        },
        ...base
      };

    case 'column':
    case 'bar':
      return {
        column: {
          type: 'group',
          width: 20,
          activeBgColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
          activeBgOpacity: 0.08,
          ...base.column
        },
        tooltip: {
          showBox: true,
          bgColor: dark ? '#1E293B' : '#FFFFFF',
          fontColor: dark ? '#E2E8F0' : '#1A1D1F',
          ...base.tooltip
        },
        ...base
      };

    case 'pie':
    case 'ring':
      return {
        pie: {
          activeOpacity: 0.7,
          activeRadius: 5,
          offsetAngle: 0,
          labelWidth: 15,
          border: true,
          borderWidth: 2,
          borderColor: dark ? '#0F172A' : '#FFFFFF',
          ...base.pie
        },
        ring:
          props.type === 'ring'
            ? { ringWidth: 30, centerColor: dark ? '#0F172A' : '#FFFFFF', ...base.ring }
            : undefined,
        ...base
      };

    case 'radar':
      return {
        radar: {
          gridType: 'radar',
          gridColor: dark ? 'rgba(148,163,184,0.2)' : 'rgba(0,0,0,0.1)',
          labelColor: dark ? '#94A3B8' : '#6b7280',
          opacity: 0.3,
          border: true,
          borderWidth: 2,
          ...base.radar
        },
        ...base
      };

    default:
      return base;
  }
}

/** 格式化 series 数据，适配 uCharts 要求 */
function formatSeries(rawSeries) {
  if (!rawSeries) return [];

  // 饼图/环形图的 series 格式不同
  if (['pie', 'ring'].includes(props.type)) {
    return rawSeries.map((item) => ({
      name: item.name || '',
      data: item.data || 0,
      color: item.color || undefined
    }));
  }

  return rawSeries.map((item) => ({
    name: item.name || '',
    data: item.data || [],
    color: item.color || undefined,
    type: item.type || undefined,
    pointShape: item.pointShape || undefined
  }));
}

/** 销毁图表实例 */
function destroyChart() {
  if (chartInstance) {
    // uCharts 无 destroy 方法，置空引用即可
    chartInstance = null;
  }
}

// ---------- 事件处理 ----------
/** 触摸事件（用于 tooltip 和滚动） */
function onTouch(e) {
  if (!chartInstance) return;
  chartInstance.scrollStart ? chartInstance.scroll(e) : chartInstance.showToolTip(e, { format: tooltipFormat });
}

/** 点击事件 */
function onTap(e) {
  if (!chartInstance) return;
  chartInstance.touchLegend(e);
  const idx = chartInstance.getCurrentDataIndex(e);
  emit('bindtap', { index: idx, event: e });
}

/** tooltip 文本格式化 */
function tooltipFormat(item) {
  return `${item.name || ''}: ${item.data}`;
}

// ---------- 监听数据和主题变化 ----------
watch(
  [() => props.series, () => props.categories, () => props.type],
  () => {
    nextTick(() => renderChart());
  },
  { deep: true }
);

// 主题切换时重绘
watch(isDark, () => {
  nextTick(() => renderChart());
});

// ---------- 生命周期 ----------
onMounted(() => {
  initChart();
});

onBeforeUnmount(() => {
  if (resizeTimer) {
    clearTimeout(resizeTimer);
    resizeTimer = null;
  }
  destroyChart();
});

// 暴露方法供父组件调用
defineExpose({
  /** 手动刷新图表 */
  refresh: () => initChart(),
  /** 获取 uCharts 原始实例（高级用法） */
  getChartInstance: () => chartInstance
});
</script>

<style lang="scss" scoped>
.base-chart {
  position: relative;
  width: 100%;

  &__header {
    padding: 0 0 16rpx 0;
  }

  &__title {
    font-size: 28rpx;
    font-weight: 600;
    color: var(--text-primary, #1a1d1f);
  }

  &__subtitle {
    font-size: 22rpx;
    color: var(--text-sub, #6b7280);
    margin-top: 4rpx;
    display: block;
  }

  &__canvas {
    width: 100%;
  }

  &__empty {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    pointer-events: none;
  }

  &__empty-text {
    font-size: 24rpx;
    color: var(--text-tertiary, #9ca3af);
  }
}
</style>
