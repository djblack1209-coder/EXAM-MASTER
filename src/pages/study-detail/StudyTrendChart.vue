<template>
  <view class="study-trend-chart">
    <!-- 时间范围选择 -->
    <view class="range-selector">
      <view
        v-for="range in ranges"
        :key="range.value"
        class="range-item"
        :class="{ active: selectedRange === range.value }"
        @tap="selectRange(range.value)"
      >
        <text class="range-text">
          {{ range.label }}
        </text>
      </view>
    </view>

    <!-- 图表区域 -->
    <view class="chart-wrapper">
      <canvas
        id="trendChart"
        canvas-id="trendChart"
        class="trend-canvas"
        :style="{ width: canvasWidth + 'px', height: canvasHeight + 'px' }"
      ></canvas>
    </view>

    <!-- 数据摘要 -->
    <view class="summary-row">
      <view class="summary-item">
        <text class="summary-value">
          {{ totalMinutes }}
        </text>
        <text class="summary-label"> 总时长(分钟) </text>
      </view>
      <view class="summary-item">
        <text class="summary-value">
          {{ avgMinutes }}
        </text>
        <text class="summary-label"> 日均(分钟) </text>
      </view>
      <view class="summary-item">
        <view class="trend-indicator" :class="trendDirection">
          <text class="trend-arrow">
            <BaseIcon v-if="trendDirection === 'up'" name="trend-up" :size="32" />
            <BaseIcon v-else-if="trendDirection === 'down'" name="trend-down" :size="32" />
            <BaseIcon v-else name="arrow-right" :size="32" />
          </text>
          <text class="trend-percent"> {{ trendPercent }}% </text>
        </view>
        <text class="summary-label"> 趋势 </text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, getCurrentInstance, nextTick } from 'vue';

const props = defineProps({
  // 学习记录数据 { 'YYYY-MM-DD': minutes }
  studyData: {
    type: Object,
    default: () => ({})
  }
});

const emit = defineEmits(['range-change']);

const selectedRange = ref(7);
const ranges = [
  { label: '7天', value: 7 },
  { label: '14天', value: 14 },
  { label: '30天', value: 30 }
];
const canvasWidth = ref(300);
const canvasHeight = ref(200);
const chartData = ref([]);
const totalMinutes = ref(0);
const avgMinutes = ref(0);
const trendDirection = ref('stable');
const trendPercent = ref(0);

const instance = getCurrentInstance();

// [AUDIT FIX R135] 移除 deep: true —— 父组件替换整个 studyData 对象引用时
// 浅引用比较已能捕获变化，无需深度遍历每个属性
watch(
  () => props.studyData,
  () => {
    prepareChartData();
    nextTick(() => {
      drawChart();
    });
  }
);

watch(selectedRange, () => {
  prepareChartData();
  nextTick(() => {
    drawChart();
  });
});

// 定时器追踪，防止组件卸载后执行回调
let _chartTimer = null;

onMounted(() => {
  initCanvas();
});

onBeforeUnmount(() => {
  if (_chartTimer) {
    clearTimeout(_chartTimer);
    _chartTimer = null;
  }
});

/**
 * 初始化 Canvas
 */
function initCanvas() {
  // 获取容器宽度
  const query = uni.createSelectorQuery().in(instance.proxy);
  query
    .select('.chart-wrapper')
    .boundingClientRect((rect) => {
      if (rect) {
        canvasWidth.value = rect.width - 32; // 减去 padding
        canvasHeight.value = 200;
      }
      prepareChartData();
      nextTick(() => {
        _chartTimer = setTimeout(() => {
          _chartTimer = null;
          drawChart();
        }, 100);
      });
    })
    .exec();
}

/**
 * 准备图表数据
 */
function prepareChartData() {
  const data = [];
  const today = new Date();

  for (let i = selectedRange.value - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = formatDate(date);
    const minutes = props.studyData[dateStr] || 0;

    data.push({
      date: date,
      dateStr: dateStr,
      label: getDateLabel(date),
      minutes: minutes
    });
  }

  chartData.value = data;
  calculateSummary();
}

/**
 * 计算摘要数据
 */
function calculateSummary() {
  const minutes = chartData.value.map((d) => d.minutes);
  totalMinutes.value = minutes.reduce((a, b) => a + b, 0);
  avgMinutes.value = chartData.value.length > 0 ? Math.round(totalMinutes.value / chartData.value.length) : 0;

  // 计算趋势（比较前半段和后半段）
  const mid = Math.floor(minutes.length / 2);
  const firstHalf = minutes.slice(0, mid);
  const secondHalf = minutes.slice(mid);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length || 0;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length || 0;

  if (firstAvg === 0 && secondAvg === 0) {
    trendDirection.value = 'stable';
    trendPercent.value = 0;
  } else if (firstAvg === 0) {
    trendDirection.value = 'up';
    trendPercent.value = 100;
  } else {
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    trendPercent.value = Math.abs(Math.round(change));

    if (change > 5) {
      trendDirection.value = 'up';
    } else if (change < -5) {
      trendDirection.value = 'down';
    } else {
      trendDirection.value = 'stable';
    }
  }
}

/**
 * 绘制图表
 */
function drawChart() {
  const ctx = uni.createCanvasContext('trendChart', instance.proxy);
  if (!ctx) return;

  const width = canvasWidth.value;
  const height = canvasHeight.value;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // 清空画布
  ctx.clearRect(0, 0, width, height);

  // 获取数据范围
  const values = chartData.value.map((d) => d.minutes);
  const maxValue = Math.max(...values, 10); // 至少显示到10
  const minValue = 0;

  // 绘制背景网格
  drawGrid(ctx, padding, chartWidth, chartHeight, maxValue);

  // 绘制折线和面积
  drawLineAndArea(ctx, padding, chartWidth, chartHeight, maxValue, minValue);

  // 绘制数据点
  drawDataPoints(ctx, padding, chartWidth, chartHeight, maxValue, minValue);

  // 绘制X轴标签
  drawXLabels(ctx, padding, chartWidth, chartHeight);

  ctx.draw();
}

/**
 * 绘制网格
 */
function drawGrid(ctx, padding, chartWidth, chartHeight, maxValue) {
  const gridLines = 4;
  ctx.setStrokeStyle('rgba(200, 200, 200, 0.3)');
  ctx.setLineWidth(1);

  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartHeight / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartWidth, y);
    ctx.stroke();

    // Y轴标签
    const value = Math.round(maxValue - (maxValue / gridLines) * i);
    ctx.setFillStyle('#999');
    ctx.setFontSize(10);
    ctx.setTextAlign('right');
    ctx.fillText(value.toString(), padding.left - 5, y + 3);
  }
}

/**
 * 绘制折线和面积
 */
function drawLineAndArea(ctx, padding, chartWidth, chartHeight, maxValue, _minValue) {
  if (chartData.value.length === 0) return;

  const points = chartData.value.map((d, i) => {
    const x = padding.left + (chartWidth / (chartData.value.length - 1 || 1)) * i;
    const y = padding.top + chartHeight - (d.minutes / maxValue) * chartHeight;
    return { x, y };
  });

  // 绘制渐变面积
  const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
  gradient.addColorStop(0, 'rgba(0, 122, 255, 0.3)');
  gradient.addColorStop(1, 'rgba(0, 122, 255, 0.05)');

  ctx.beginPath();
  ctx.moveTo(points[0].x, padding.top + chartHeight);
  points.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
  ctx.closePath();
  ctx.setFillStyle(gradient);
  ctx.fill();

  // 绘制折线
  ctx.beginPath();
  ctx.setStrokeStyle('#007AFF');
  ctx.setLineWidth(2);
  ctx.setLineCap('round');
  ctx.setLineJoin('round');

  points.forEach((p, i) => {
    if (i === 0) {
      ctx.moveTo(p.x, p.y);
    } else {
      ctx.lineTo(p.x, p.y);
    }
  });
  ctx.stroke();
}

/**
 * 绘制数据点
 */
function drawDataPoints(ctx, padding, chartWidth, chartHeight, maxValue, _minValue) {
  chartData.value.forEach((d, i) => {
    const x = padding.left + (chartWidth / (chartData.value.length - 1 || 1)) * i;
    const y = padding.top + chartHeight - (d.minutes / maxValue) * chartHeight;

    // 外圈
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.setFillStyle('#FFFFFF');
    ctx.fill();
    ctx.setStrokeStyle('#007AFF');
    ctx.setLineWidth(2);
    ctx.stroke();

    // 内圈
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.setFillStyle('#007AFF');
    ctx.fill();
  });
}

/**
 * 绘制X轴标签
 */
function drawXLabels(ctx, padding, chartWidth, chartHeight) {
  ctx.setFillStyle('#999');
  ctx.setFontSize(10);
  ctx.setTextAlign('center');

  // 根据数据量决定显示哪些标签
  const step = chartData.value.length <= 7 ? 1 : Math.ceil(chartData.value.length / 7);

  chartData.value.forEach((d, i) => {
    if (i % step === 0 || i === chartData.value.length - 1) {
      const x = padding.left + (chartWidth / (chartData.value.length - 1 || 1)) * i;
      const y = padding.top + chartHeight + 20;
      ctx.fillText(d.label, x, y);
    }
  });
}

/**
 * 选择时间范围
 */
function selectRange(range) {
  selectedRange.value = range;
  emit('range-change', range);
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取日期标签
 */
function getDateLabel(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}
</script>

<style lang="scss" scoped>
.study-trend-chart {
  width: 100%;
}

/* 时间范围选择器 */
.range-selector {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  margin-bottom: 24rpx;
}

.range-item {
  flex: 1;
  padding: 16rpx 24rpx;
  text-align: center;
  background: var(--bg-card);
  border-radius: 999rpx;
  transition: all 0.2s ease;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);

  &.active {
    background: #58cc02;
    border-color: #46a302;
    box-shadow: 0 8rpx 0 #46a302;

    .range-text {
      color: var(--text-inverse);
    }
  }

  &:active {
    transform: scale(0.98);
  }
}

.range-text {
  font-size: 24rpx;
  color: var(--text-secondary);
  font-weight: 600;
}

/* 图表区域 */
.chart-wrapper {
  width: 100%;
  padding: 16rpx;
  background: var(--bg-card);
  border-radius: 24rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}

.trend-canvas {
  width: 100%;
  height: 200px;
}

/* 数据摘要 */
.summary-row {
  display: flex;
  justify-content: space-around;
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1px solid var(--em3d-border);
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  background: var(--bg-card);
  border-radius: 20rpx;
  padding: 16rpx 20rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}

.summary-value {
  font-size: 36rpx;
  font-weight: 800;
  color: #58cc02;
}

.summary-label {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-weight: 600;
}

/* 趋势指示器 */
.trend-indicator {
  display: flex;
  align-items: center;
  /* gap: 4rpx; -- replaced for Android WebView compat */
  &.up {
    .trend-arrow,
    .trend-percent {
      color: var(--ds-color-success, #34c759);
    }
  }

  &.down {
    .trend-arrow,
    .trend-percent {
      color: var(--ds-color-error, var(--danger));
    }
  }

  &.stable {
    .trend-arrow,
    .trend-percent {
      color: var(--text-sub, #666);
    }
  }
}

.trend-arrow {
  font-size: 32rpx;
  font-weight: 700;
}

.trend-percent {
  font-size: 32rpx;
  font-weight: 700;
}
</style>
