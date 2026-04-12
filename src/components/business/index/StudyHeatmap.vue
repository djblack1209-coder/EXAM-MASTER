<template>
  <view class="study-heatmap" :class="{ dark: isDark }">
    <view class="heatmap-shell">
      <view class="month-strip">
        <text v-for="(month, index) in monthLabels" :key="index" class="month-label">
          {{ month }}
        </text>
      </view>

      <view class="heatmap-panel">
        <view class="week-labels">
          <text class="week-label" />
          <text class="week-label"> 一 </text>
          <text class="week-label" />
          <text class="week-label"> 三 </text>
          <text class="week-label" />
          <text class="week-label"> 五 </text>
          <text class="week-label" />
        </view>

        <scroll-view class="heatmap-scroll" scroll-x :show-scrollbar="false">
          <view class="heatmap-grid">
            <view v-for="(week, weekIndex) in heatmapData" :key="weekIndex" class="week-column">
              <view
                v-for="(day, dayIndex) in week"
                :key="dayIndex"
                class="day-cell"
                :class="getDayClass(day)"
                :style="getDayStyle(day)"
                @tap="handleDayTap(day)"
              />
            </view>
          </view>
        </scroll-view>
      </view>
    </view>

    <view class="legend-row">
      <view class="legend-pill">
        <text class="legend-text"> 少 </text>
        <view class="legend-cells">
          <view class="legend-cell level-0" />
          <view class="legend-cell level-1" />
          <view class="legend-cell level-2" />
          <view class="legend-cell level-3" />
          <view class="legend-cell level-4" />
        </view>
        <text class="legend-text"> 多 </text>
      </view>
    </view>

    <view class="stats-row">
      <view class="stat-item glass-stat">
        <text class="stat-value">
          {{ totalDays }}
        </text>
        <text class="stat-label"> 学习天数 </text>
      </view>
      <view class="stat-item glass-stat">
        <text class="stat-value">
          {{ currentStreak }}
        </text>
        <text class="stat-label"> 当前连续 </text>
      </view>
      <view class="stat-item glass-stat">
        <text class="stat-value">
          {{ maxStreak }}
        </text>
        <text class="stat-label"> 最长连续 </text>
      </view>
    </view>

    <view v-if="selectedDay" class="day-detail">
      <view>
        <text class="detail-caption"> 已选日期 </text>
        <text class="detail-date">
          {{ selectedDay.dateStr }}
        </text>
      </view>
      <text class="detail-value"> 学习 {{ selectedDay.minutes }} 分钟 </text>
    </view>
  </view>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { initTheme, onThemeUpdate, offThemeUpdate } from '@/composables/useTheme';

// ---- Props & Emits ----
const props = defineProps({
  // 学习记录数据 { 'YYYY-MM-DD': minutes }
  studyData: {
    type: Object,
    default: () => ({})
  },
  // 显示的周数（默认显示最近52周，即一年）
  weeks: {
    type: Number,
    default: 52
  }
});

const emit = defineEmits(['day-tap']);

// ---- 响应式状态 ----
const heatmapData = ref([]);
const monthLabels = ref([]);
const selectedDay = ref(null);
const totalDays = ref(0);
const currentStreak = ref(0);
const maxStreak = ref(0);
const isDark = ref(false);

// 主题回调引用，用于卸载时取消监听
let themeHandlerRef = null;

// ---- 工具函数 ----

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
 * 格式化显示日期
 */
function formatDisplayDate(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return `${month}月${day}日 ${weekDays[date.getDay()]}`;
}

/**
 * 获取月份标签
 */
function getMonthLabel(date) {
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  return monthNames[date.getMonth()];
}

/**
 * 根据学习时长获取等级 (0-4)
 */
function getLevel(minutes) {
  if (minutes === 0) return 0;
  if (minutes < 15) return 1;
  if (minutes < 30) return 2;
  if (minutes < 60) return 3;
  return 4;
}

/**
 * 获取日期格子的类名
 */
function getDayClass(day) {
  if (!day) return 'empty';
  return `level-${day.level}`;
}

/**
 * 获取日期格子的样式
 */
function getDayStyle(day) {
  if (!day) return {};
  return {};
}

// ---- 核心逻辑 ----

/**
 * 生成月份标签
 */
function generateMonthLabels() {
  const labels = [];
  const today = new Date();
  const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  for (let i = 0; i < props.weeks; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() - (props.weeks - 1 - i) * 7);

    if (i === 0 || date.getDate() <= 7) {
      labels.push(monthNames[date.getMonth()]);
    } else {
      labels.push('');
    }
  }

  monthLabels.value = labels;
}

/**
 * 生成热力图数据
 */
function generateHeatmapData() {
  const today = new Date();
  const data = [];
  const months = new Set();

  // 计算起始日期（从最近的周日开始往前推）
  const endDate = new Date(today);
  const _dayOfWeek = endDate.getDay();

  // 计算需要显示的总天数
  const total = props.weeks * 7;

  // 从今天往前推算
  for (let i = total - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    const weekIndex = Math.floor((total - 1 - i) / 7);
    const dayIndex = date.getDay();

    if (!data[weekIndex]) {
      data[weekIndex] = new Array(7).fill(null);
    }

    const dateStr = formatDate(date);
    const minutes = props.studyData[dateStr] || 0;

    data[weekIndex][dayIndex] = {
      date: date,
      dateStr: formatDisplayDate(date),
      key: dateStr,
      minutes: minutes,
      level: getLevel(minutes)
    };

    // 收集月份标签
    if (date.getDate() <= 7) {
      months.add(getMonthLabel(date));
    }
  }

  heatmapData.value = data;
  generateMonthLabels();
}

/**
 * 计算统计数据
 */
function calculateStats() {
  let _totalDays = 0;
  let _currentStreak = 0;
  let _maxStreak = 0;
  let tempStreak = 0;

  const today = new Date();
  const sortedDates = Object.keys(props.studyData).sort().reverse();

  // 计算总学习天数
  _totalDays = sortedDates.filter((date) => props.studyData[date] > 0).length;

  // 计算连续天数
  const checkDate = new Date(today);
  let isCurrentStreak = true;

  for (let i = 0; i < 365; i++) {
    const dateStr = formatDate(checkDate);
    const minutes = props.studyData[dateStr] || 0;

    if (minutes > 0) {
      tempStreak++;
      if (isCurrentStreak) {
        _currentStreak = tempStreak;
      }
    } else {
      if (isCurrentStreak && i > 0) {
        isCurrentStreak = false;
      }
      _maxStreak = Math.max(_maxStreak, tempStreak);
      tempStreak = 0;
    }

    checkDate.setDate(checkDate.getDate() - 1);
  }

  _maxStreak = Math.max(_maxStreak, tempStreak, _currentStreak);

  totalDays.value = _totalDays;
  currentStreak.value = _currentStreak;
  maxStreak.value = _maxStreak;
}

/**
 * 处理日期点击
 */
function handleDayTap(day) {
  if (!day) return;
  selectedDay.value = day;
  emit('day-tap', day);
}

// ---- 侦听器 ----
// [AUDIT FIX R135] 移除 deep: true —— 父组件替换整个 studyData 对象引用时
// 浅引用比较已能捕获变化，无需深度遍历 52×7 个属性
watch(
  () => props.studyData,
  () => {
    generateHeatmapData();
    calculateStats();
  },
  { immediate: true }
);

// ---- 生命周期 ----
onMounted(() => {
  isDark.value = initTheme();
  themeHandlerRef = (mode) => {
    isDark.value = mode === 'dark';
  };
  onThemeUpdate(themeHandlerRef);
});

onBeforeUnmount(() => {
  if (themeHandlerRef) {
    offThemeUpdate(themeHandlerRef);
  }
});
</script>

<style lang="scss" scoped>
.study-heatmap {
  width: 100%;
}

.heatmap-shell {
  padding: 20rpx;
  border-radius: 24rpx;
  background: var(--bg-card);
  border: 1rpx solid var(--border);
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
}

.month-strip {
  display: flex;
  padding-left: 56rpx;
  margin-bottom: 16rpx;
  overflow: hidden;
}

.month-label {
  flex: 1;
  min-width: 24rpx;
  font-size: 20rpx;
  color: var(--text-sub);
  text-align: left;
}

.heatmap-panel {
  display: flex;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  padding: 20rpx;
  border-radius: 22rpx;
  background: var(--bg-secondary);
  border: 1rpx solid var(--border);
}

.heatmap-panel > .week-labels {
  margin-right: 12rpx;
}

.week-labels {
  display: flex;
  flex-direction: column;
  /* gap: 8rpx; -- replaced for Android WebView compat */
  padding-top: 4rpx;
}

.week-label {
  height: 28rpx;
  line-height: 28rpx;
  font-size: 20rpx;
  color: var(--text-sub);
  text-align: right;
  padding-right: 10rpx;
  margin-bottom: 8rpx;
}

.week-label:last-child {
  margin-bottom: 0;
}

.heatmap-scroll {
  flex: 1;
  white-space: nowrap;
}

.heatmap-grid {
  display: inline-flex;
  /* gap: 6rpx; -- replaced for Android WebView compat */
}

.heatmap-grid > .week-column {
  margin-right: 6rpx;
}

.heatmap-grid > .week-column:last-child {
  margin-right: 0;
}

.week-column {
  display: flex;
  flex-direction: column;
  /* gap: 6rpx; -- replaced for Android WebView compat */
}

.week-column > .day-cell {
  margin-bottom: 2rpx;
}

.week-column > .day-cell:last-child {
  margin-bottom: 0;
}

.day-cell {
  width: 28rpx;
  height: 28rpx;
  border-radius: 10rpx;
  border: 1rpx solid var(--border);
  transition: all 0.2s ease;
  /* 扩大点击区域：视觉尺寸不变，但通过 padding 增加触控面积 */
  padding: 4rpx;
  position: relative;

  &.empty {
    background: transparent;
    border-color: transparent;
    box-shadow: none;
  }

  &.level-0 {
    background: var(--muted);
  }

  &.level-1 {
    background: var(--primary-light);
  }

  &.level-2 {
    background: var(--primary);
    opacity: 0.5;
  }

  &.level-3 {
    background: var(--primary);
    opacity: 0.75;
  }

  &.level-4 {
    background: var(--primary);
  }

  &:active {
    transform: scale(1.08);
  }
}

.legend-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 20rpx;
}

.legend-pill {
  display: inline-flex;
  align-items: center;
  /* gap: 10rpx; -- replaced for Android WebView compat */
  padding: 12rpx 18rpx;
  border-radius: 999rpx;
  background: var(--bg-secondary);
  border: 1rpx solid var(--border);
  box-shadow: var(--shadow-sm);
}

.legend-pill > .legend-text {
  margin-right: 10rpx;
}

.legend-pill > .legend-text:last-child {
  margin-right: 0;
  margin-left: 10rpx;
}

.legend-pill > .legend-cells {
  margin-right: 10rpx;
}

.legend-text {
  font-size: 20rpx;
  color: var(--text-sub);
}

.legend-cells {
  display: flex;
  /* gap: 6rpx; -- replaced for Android WebView compat */
}

.legend-cells > .legend-cell {
  margin-right: 6rpx;
}

.legend-cells > .legend-cell:last-child {
  margin-right: 0;
}

.legend-cell {
  width: 20rpx;
  height: 20rpx;
  border-radius: 8rpx;
  border: 1rpx solid var(--border);

  &.level-0 {
    background: var(--muted);
  }

  &.level-1 {
    background: var(--primary-light);
  }

  &.level-2 {
    background: var(--primary);
    opacity: 0.5;
  }

  &.level-3 {
    background: var(--primary);
    opacity: 0.75;
  }

  &.level-4 {
    background: var(--primary);
  }
}

.stats-row {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  margin-top: 24rpx;
}

.stat-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* gap: 10rpx; -- replaced for Android WebView compat */
}

.stat-item + .stat-item {
  margin-left: 16rpx;
}

.glass-stat {
  padding: 22rpx 18rpx;
  border-radius: 20rpx;
  background: var(--bg-secondary);
  border: 1rpx solid var(--border);
  box-shadow: var(--shadow-sm);
}

.glass-stat > .stat-value {
  margin-bottom: 10rpx;
}

.stat-value {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--text-main);
  font-variant-numeric: tabular-nums;
}

.stat-label {
  font-size: 22rpx;
  color: var(--text-sub);
}

.day-detail {
  display: flex;
  justify-content: space-between;
  align-items: center;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  margin-top: 24rpx;
  padding: 22rpx 24rpx;
  background: var(--bg-card);
  border-radius: 20rpx;
  border: 1rpx solid var(--border);
  box-shadow: var(--shadow-sm);
}

.detail-caption {
  display: block;
  margin-bottom: 8rpx;
  font-size: 20rpx;
  letter-spacing: 2rpx;
  text-transform: uppercase;
  color: var(--text-sub);
}

.detail-date {
  display: block;
  font-size: 24rpx;
  color: var(--text-main);
  font-weight: 600;
}

.detail-value {
  font-size: 24rpx;
  color: var(--primary);
  font-weight: 600;
  white-space: nowrap;
}

.dark {
  .heatmap-shell {
    background: var(--bg-card);
    border-color: var(--border);
  }

  .heatmap-panel,
  .legend-pill,
  .glass-stat {
    background: var(--muted);
    border-color: var(--border);
  }

  /* [AUDIT FIX R178] 暗黑模式下日期格子边框/阴影适配 */
  .day-cell {
    border-color: var(--border);
    box-shadow: none;

    &.level-0 {
      background: var(--muted);
    }

    &.level-1 {
      background: var(--primary-light);
    }

    &.level-2 {
      background: var(--primary);
      opacity: 0.5;
    }

    &.level-3 {
      background: var(--primary);
      opacity: 0.75;
    }

    &.level-4 {
      background: var(--primary);
    }
  }

  /* [AUDIT FIX R179] 暗黑模式下图例格子边框适配 */
  .legend-cell {
    border-color: var(--border);

    &.level-0 {
      background: var(--muted);
    }

    &.level-1 {
      background: var(--primary-light);
    }

    &.level-2 {
      background: var(--primary);
      opacity: 0.5;
    }

    &.level-3 {
      background: var(--primary);
      opacity: 0.75;
    }

    &.level-4 {
      background: var(--primary);
    }
  }

  .day-detail {
    background: var(--bg-card);
    border-color: var(--border);
  }
}
</style>
