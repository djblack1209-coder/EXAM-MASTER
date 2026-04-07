<template>
  <view class="ability-radar">
    <view class="radar-header">
      <view class="range-tabs">
        <text
          v-for="r in ranges"
          :key="r.key"
          class="range-tab"
          :class="{ active: activeRange === r.key }"
          @tap="activeRange = r.key"
        >
          {{ r.label }}
        </text>
      </view>
    </view>

    <!-- 纯 CSS 雷达图（跨平台兼容，无 canvas 依赖） -->
    <view class="radar-chart">
      <!-- 背景网格（5层同心多边形） -->
      <view v-for="level in 5" :key="'grid-' + level" class="radar-grid" :style="gridStyle(level)" />

      <!-- 轴线 -->
      <view v-for="(dim, i) in dimensions" :key="'axis-' + i" class="radar-axis" :style="axisStyle(i)" />

      <!-- 数据区域（SVG polygon） -->
      <view class="radar-polygon-wrap">
        <!-- #ifdef H5 -->
        <svg class="radar-svg" viewBox="0 0 200 200">
          <polygon :points="polygonPoints" class="radar-fill" />
          <polygon :points="polygonPoints" class="radar-stroke" />
          <!-- 数据点 -->
          <circle v-for="(pt, i) in dataPoints" :key="'dot-' + i" :cx="pt.x" :cy="pt.y" r="4" class="radar-dot" />
        </svg>
        <!-- #endif -->
        <!-- #ifndef H5 -->
        <!-- 小程序用 CSS 圆点标记各维度得分位置 -->
        <view
          v-for="(pt, i) in dataPoints"
          :key="'mp-dot-' + i"
          class="radar-mp-dot"
          :style="{ left: pt.x + 'px', top: pt.y + 'px' }"
        />
        <!-- #endif -->
      </view>

      <!-- 维度标签 -->
      <text v-for="(dim, i) in dimensions" :key="'label-' + i" class="radar-label" :style="labelStyle(i)">
        {{ dim.name }}
      </text>
    </view>

    <!-- 维度详情列表 -->
    <view class="dimension-list">
      <view v-for="dim in dimensions" :key="dim.id" class="dimension-item">
        <view class="dim-info">
          <text class="dim-name">{{ dim.name }}</text>
          <text class="dim-score">{{ dim.score }}%</text>
        </view>
        <view class="dim-bar-bg">
          <view class="dim-bar-fill" :style="{ width: dim.score + '%', backgroundColor: barColor(dim.score) }" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

const props = defineProps({
  /** 外部传入的知识点掌握度数据，格式 { [id]: { mastery, practiceCount, correctCount } } */
  masteryData: { type: Object, default: null }
});

const activeRange = ref('all');
const ranges = [
  { key: 'all', label: '全部' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' }
];
const rawDimensions = ref([]);

const dimensions = computed(() => {
  // 取 top 6 维度（雷达图最佳展示数量）
  return rawDimensions.value.slice(0, 6).map((d) => ({
    ...d,
    score: Math.round(Math.max(0, Math.min(100, d.score)))
  }));
});

/** 雷达图中心和半径 */
const center = computed(() => ({ x: 100, y: 100 }));
const radius = computed(() => 80);

/** SVG polygon 点位字符串 */
const polygonPoints = computed(() => {
  return dataPoints.value.map((p) => `${p.x},${p.y}`).join(' ');
});

/** 各维度在雷达图上的坐标 */
const dataPoints = computed(() => {
  const n = dimensions.value.length;
  if (n === 0) return [];
  return dimensions.value.map((dim, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (dim.score / 100) * radius.value;
    return {
      x: Math.round(center.value.x + r * Math.cos(angle)),
      y: Math.round(center.value.y + r * Math.sin(angle))
    };
  });
});

watch(
  () => props.masteryData,
  () => {
    loadData();
  },
  { immediate: true }
);

watch(activeRange, () => {
  loadData();
});

function loadData() {
  try {
    const source = props.masteryData || _loadFromStorage();
    if (!source || Object.keys(source).length === 0) {
      rawDimensions.value = _getDefaultDimensions();
      return;
    }

    rawDimensions.value = Object.entries(source)
      .filter(([, v]) => v && (v.practiceCount > 0 || v.accessCount > 0))
      .map(([id, v]) => ({
        id,
        name: _formatName(id),
        score: v.mastery != null ? v.mastery : (v.correctCount / Math.max(1, v.practiceCount)) * 100,
        practiceCount: v.practiceCount || 0
      }))
      .sort((a, b) => b.practiceCount - a.practiceCount);

    if (rawDimensions.value.length === 0) {
      rawDimensions.value = _getDefaultDimensions();
    }
  } catch (e) {
    logger.warn('[AbilityRadar] Load error:', e);
    rawDimensions.value = _getDefaultDimensions();
  }
}

function _loadFromStorage() {
  return storageService.get('knowledge_mastery', null);
}

function _formatName(id) {
  // 截断过长的知识点名称
  const name = String(id).replace(/_/g, ' ');
  return name.length > 5 ? name.slice(0, 5) + '…' : name;
}

function _getDefaultDimensions() {
  return [
    { id: 'none1', name: '暂无数据', score: 0, practiceCount: 0 },
    { id: 'none2', name: '开始练习', score: 0, practiceCount: 0 },
    { id: 'none3', name: '解锁更多', score: 0, practiceCount: 0 }
  ];
}

/** 同心多边形网格样式 */
function gridStyle(level) {
  const scale = level / 5;
  const size = radius.value * 2 * scale;
  return {
    width: size + 'px',
    height: size + 'px',
    left: center.value.x - size / 2 + 'px',
    top: center.value.y - size / 2 + 'px'
  };
}

/** 轴线样式 */
function axisStyle(index) {
  const n = dimensions.value.length;
  const angle = (360 / n) * index - 90;
  return {
    transform: `rotate(${angle}deg)`,
    width: radius.value + 'px',
    left: center.value.x + 'px',
    top: center.value.y + 'px'
  };
}

/** 标签位置 */
function labelStyle(index) {
  const n = dimensions.value.length;
  const angle = (Math.PI * 2 * index) / n - Math.PI / 2;
  const labelR = radius.value + 18;
  const x = center.value.x + labelR * Math.cos(angle);
  const y = center.value.y + labelR * Math.sin(angle);
  return {
    left: x + 'px',
    top: y + 'px'
  };
}

/** 进度条颜色 */
function barColor(score) {
  if (score >= 80) return '#4CAF50';
  if (score >= 60) return '#FF9800';
  if (score >= 40) return '#FF5722';
  return '#F44336';
}
</script>

<style scoped lang="scss">
.ability-radar {
  padding: 24rpx;
}

.radar-header {
  margin-bottom: 24rpx;
}

.range-tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 16rpx;
  padding: 4rpx;
}

.range-tab {
  flex: 1;
  text-align: center;
  padding: 12rpx 0;
  font-size: 24rpx;
  color: var(--text-secondary);
  border-radius: 12rpx;
  transition: all 0.2s;
  font-weight: 600;
}

.range-tab.active {
  background: var(--bg-card);
  color: #58cc02;
  font-weight: 700;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.08);
}

.radar-chart {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0 auto 32rpx;
}

.radar-grid {
  position: absolute;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 50%;
}

.radar-axis {
  position: absolute;
  height: 1px;
  background: rgba(0, 0, 0, 0.08);
  transform-origin: 0 50%;
}

.radar-polygon-wrap {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}

.radar-svg {
  width: 100%;
  height: 100%;
}

.radar-fill {
  fill: rgba(76, 175, 80, 0.15);
  transition: all 0.3s;
}

.radar-stroke {
  fill: none;
  stroke: var(--color-primary, #0f5f34);
  stroke-width: 2;
  transition: all 0.3s;
}

.radar-dot {
  fill: var(--color-primary, #0f5f34);
}

.radar-mp-dot {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-primary, #0f5f34);
  transform: translate(-50%, -50%);
}

.radar-label {
  position: absolute;
  font-size: 20rpx;
  color: var(--text-secondary);
  transform: translate(-50%, -50%);
  white-space: nowrap;
}

.dimension-list {
  display: flex;
  flex-direction: column;
}

/* 使用 margin 替代 gap 兼容 Android WebView */
.dimension-list > .dimension-item + .dimension-item {
  margin-top: 16rpx;
}

.dimension-item {
  display: flex;
  flex-direction: column;
}

.dimension-item > .dim-bar-bg {
  margin-top: 8rpx;
}

.dim-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dim-name {
  font-size: 24rpx;
  color: var(--text-primary);
  font-weight: 700;
}

.dim-score {
  font-size: 24rpx;
  font-weight: 800;
  color: #58cc02;
}

.dim-bar-bg {
  height: 8rpx;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4rpx;
  overflow: hidden;
}

.dim-bar-fill {
  height: 100%;
  border-radius: 4rpx;
  transition: width 0.5s ease-out;
}

/* 暗色模式 */
.dark .range-tabs,
.dark-mode .range-tabs {
  background: rgba(255, 255, 255, 0.06);
}

.dark .range-tab.active,
.dark-mode .range-tab.active {
  background: rgba(255, 255, 255, 0.12);
}

.dark .radar-grid,
.dark-mode .radar-grid {
  border-color: rgba(255, 255, 255, 0.08);
}

.dark .radar-axis,
.dark-mode .radar-axis {
  background: rgba(255, 255, 255, 0.1);
}

.dark .radar-label,
.dark-mode .radar-label {
  color: var(--text-secondary);
}

.dark .dim-name,
.dark-mode .dim-name {
  color: var(--text-primary);
}

.dark .dim-bar-bg,
.dark-mode .dim-bar-bg {
  background: rgba(255, 255, 255, 0.08);
}
</style>
