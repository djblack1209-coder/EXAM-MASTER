<template>
  <view class="page" :class="{ 'dark-mode': isDark }">
    <view class="aurora-bg" />

    <!-- 导航栏 -->
    <view class="top-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <text class="nav-back" @tap="goBack">
        <BaseIcon name="arrow-left" :size="36" />
      </text>
      <text class="nav-title">历史错题分组</text>
      <view class="nav-right" />
    </view>

    <scroll-view
      scroll-y
      class="main-scroll"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onRefresh"
    >
      <!-- ==================== 骨架屏 ==================== -->
      <view v-if="loading" class="skel-area">
        <view class="skel-card skel-hero" />
        <view class="skel-row">
          <view v-for="i in 4" :key="i" class="skel-dot" />
        </view>
        <view class="skel-grid">
          <view v-for="i in 20" :key="i" class="skel-cell" />
        </view>
        <view class="skel-card skel-short" />
      </view>

      <!-- ==================== 主体内容 ==================== -->
      <template v-else-if="clusters.length > 0">
        <!-- 总览卡片 -->
        <view class="hero-card glass-card">
          <view class="hero-row">
            <view class="hero-stat">
              <text class="hero-val danger-text">{{ summaryData.totalMistakes }}</text>
              <text class="hero-lbl">旧条目</text>
            </view>
            <view class="hero-divider" />
            <view class="hero-stat">
              <text class="hero-val warning-text">{{ summaryData.reviewableCount }}</text>
              <text class="hero-lbl">可重练</text>
            </view>
            <view class="hero-divider" />
            <view class="hero-stat">
              <text class="hero-val">{{ activeSubjects.length }}</text>
              <text class="hero-lbl">分类</text>
            </view>
          </view>
          <view class="hero-tip">
            <view class="tip-dot" />
            <text class="tip-text">按旧标签整理，判定依据待核对。</text>
          </view>
        </view>

        <!-- 条目数量图例 -->
        <view class="legend-bar">
          <view class="legend-item">
            <view class="legend-swatch sev-high" />
            <text class="legend-text">≥10条</text>
          </view>
          <view class="legend-item">
            <view class="legend-swatch sev-medium" />
            <text class="legend-text">5–9条</text>
          </view>
          <view class="legend-item">
            <view class="legend-swatch sev-low" />
            <text class="legend-text">1–4条</text>
          </view>
          <view class="legend-item">
            <view class="legend-swatch sev-empty" />
            <text class="legend-text">无</text>
          </view>
        </view>

        <!-- ==================== 聚类矩阵 ==================== -->
        <scroll-view scroll-x :show-scrollbar="false" class="matrix-scroll">
          <view class="matrix-table">
            <!-- 表头行：左上角 + 各错因列标题 -->
            <view class="m-row m-header">
              <view class="m-cell m-corner">
                <text class="m-corner-text">分类＼旧标签</text>
              </view>
              <view v-for="et in activeErrorTypes" :key="et.key" class="m-cell m-col-hd">
                <text class="m-col-text">{{ et.short }}</text>
              </view>
            </view>
            <!-- 数据行：每行一个学科 -->
            <view v-for="subj in activeSubjects" :key="subj" class="m-row">
              <view class="m-cell m-row-hd">
                <text class="m-row-text">{{ truncate(subj, 5) }}</text>
              </view>
              <view
                v-for="et in activeErrorTypes"
                :key="et.key"
                :class="[
                  'm-cell',
                  'm-data',
                  'sev-' + getCellSeverity(et.key, subj),
                  { 'm-selected': isSelected(et.key, subj) }
                ]"
                role="button"
                :tabindex="getCellCount(et.key, subj) ? 0 : -1"
                :aria-disabled="!getCellCount(et.key, subj)"
                :aria-label="`${subj}，旧标签${et.label}，${getCellCount(et.key, subj)}条`"
                @keydown.enter.prevent="selectCell(et.key, subj)"
                @keydown.space.prevent="selectCell(et.key, subj)"
                @tap="selectCell(et.key, subj)"
              >
                <text v-if="getCellCount(et.key, subj) > 0" class="m-count">
                  {{ getCellCount(et.key, subj) }}
                </text>
              </view>
            </view>
          </view>
        </scroll-view>

        <!-- ==================== 原记录展开面板 ==================== -->
        <view v-if="selected" class="trend-panel glass-card" :class="'accent-' + selected.severity">
          <!-- 标题行 -->
          <view class="tp-header">
            <view class="tp-title-wrap">
              <text class="tp-type">{{ selected.typeName }}</text>
              <text class="tp-sep">×</text>
              <text class="tp-subj">{{ selected.subject }}</text>
            </view>
            <view
              class="tp-close"
              role="button"
              tabindex="0"
              aria-label="收起旧条目"
              @keydown.enter.prevent="selected = null"
              @keydown.space.prevent="selected = null"
              @tap="selected = null"
            >
              <BaseIcon name="close" :size="24" />
            </view>
          </view>

          <!-- 条目统计 -->
          <view class="tp-stats">
            <view class="tp-stat">
              <text class="tp-stat-val">{{ selected.count }}</text>
              <text class="tp-stat-lbl">条目数</text>
            </view>
            <view class="tp-stat">
              <text class="tp-stat-val">{{ selected.cluster.reviewableCount }}</text>
              <text class="tp-stat-lbl">可重练</text>
            </view>
          </view>

          <!-- 典型错题 -->
          <view
            v-if="selected.cluster && selected.cluster.examples && selected.cluster.examples.length"
            class="ex-section"
          >
            <text class="ex-title">旧条目示例</text>
            <view v-for="(ex, i) in selected.cluster.examples.slice(0, 3)" :key="i" class="ex-item">
              <text class="ex-q">{{ i + 1 }}. {{ ex.questionContent || '原题未保存' }}</text>
              <view class="ex-ans">
                <text class="ex-yours">旧原答: {{ ex.userAnswer || '未保存' }}</text>
                <text class="ex-right">原参考: {{ ex.referenceAnswer || '未保存' }}</text>
              </view>
            </view>
          </view>

          <WdButton
            block
            plain
            :disabled="!selected.cluster.reviewableCount"
            custom-style="margin-top: 28rpx; border-radius: 999rpx; min-height: 44px;"
            @click="goQuiz(selected.cluster)"
            >重练完整条目</WdButton
          >
        </view>

        <!-- ==================== 按条目数量分组的卡片列表 ==================== -->
        <view v-for="group in countGroups" :key="group.key" class="section">
          <view class="section-header">
            <view class="section-dot" :class="'dot-' + group.key" />
            <text class="section-title">{{ group.label }}</text>
            <text class="section-badge" :class="'badge-' + group.key">{{ group.items.length }}</text>
          </view>

          <view
            v-for="(cluster, idx) in group.items"
            :key="cluster.clusterId || idx"
            class="cluster-card glass-card"
            :class="'accent-' + group.key"
            :style="{ animationDelay: idx * 0.08 + 's' }"
          >
            <view class="cluster-header">
              <text class="cluster-name">{{ cluster.errorTypeName }}</text>
            </view>
            <view class="cluster-meta">
              <text class="cluster-count">{{ cluster.questionCount }} 条 · 可重练 {{ cluster.reviewableCount }}</text>
            </view>
            <view v-if="cluster.knowledgePoints && cluster.knowledgePoints.length" class="kp-tags">
              <text v-for="kp in cluster.knowledgePoints.slice(0, 4)" :key="kp" class="kp-tag">{{ kp }}</text>
            </view>
            <WdButton
              size="small"
              :disabled="!cluster.reviewableCount"
              plain
              custom-style="margin-top: 20rpx; border-radius: 999rpx; min-height: 44px;"
              @click="goQuiz(cluster)"
            >
              重练完整条目
            </WdButton>
          </view>
        </view>
      </template>

      <!-- ==================== 空状态 ==================== -->
      <view v-else class="empty-state">
        <BaseIcon name="sparkle" :size="96" />
        <text class="empty-title">暂无历史分组</text>
        <text class="empty-sub">还没有可分组的旧条目</text>
      </view>

      <view class="bottom-safe" />
    </scroll-view>
  </view>
</template>

<script setup>
// wot-design-uni 组件（显式导入，分包优化）
import WdButton from 'wot-design-uni/components/wd-button/wd-button.vue';

import { ref, computed, onMounted } from 'vue';
import { toast } from '@/utils/toast.js';
import { safeNavigateBack, safeNavigateTo } from '@/utils/safe-navigate';
import { useStudyEngineStore } from '@/stores/modules/study-engine';
import { initTheme } from '@/composables/useTheme.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import { getUserId } from '@/services/auth-storage.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

// ==================== 常量定义 ====================

/** 后端支持的所有错误类型 */
const ALL_ERROR_TYPES = [
  { key: 'concept_confusion', label: '概念混淆', short: '概念' },
  { key: 'calculation_error', label: '计算失误', short: '计算' },
  { key: 'careless_mistake', label: '粗心大意', short: '粗心' },
  { key: 'memory_lapse', label: '记忆遗忘', short: '记忆' },
  { key: 'logic_error', label: '逻辑错误', short: '逻辑' },
  { key: 'knowledge_gap', label: '知识盲区', short: '盲区' },
  { key: 'time_pressure', label: '时间不足', short: '时间' },
  { key: 'unknown', label: '未分类', short: '其他' }
];

/** 错误类型 key → 显示名称映射 */
const ERROR_TYPE_MAP = Object.fromEntries(ALL_ERROR_TYPES.map((t) => [t.key, t.label]));

// ==================== 响应式状态 ====================

const isDark = ref(initTheme());
const studyEngineStore = useStudyEngineStore();
const loading = ref(true);
const isRefreshing = ref(false);
const statusBarHeight = ref(0);
const clusters = ref([]);
const loadedOwnerId = ref(null);
const summaryData = ref({ totalMistakes: 0, reviewableCount: 0 });
const selected = ref(null); // 当前选中的矩阵格子

// ==================== 计算属性 ====================

/** 从聚类数据中提取实际出现的错误类型（X轴），保持预定义顺序 */
const activeErrorTypes = computed(() => {
  const existingKeys = new Set(clusters.value.map((c) => c.errorType));
  return ALL_ERROR_TYPES.filter((t) => existingKeys.has(t.key));
});

/** 从聚类数据中提取学科列表（Y轴） */
const activeSubjects = computed(() => {
  const subjSet = new Set();
  clusters.value.forEach((c) => {
    const subj = extractSubject(c);
    if (subj) subjSet.add(subj);
  });
  return [...subjSet].sort();
});

/** 构建 (errorType, subject) → cluster 的查找表 */
const cellMap = computed(() => {
  const map = {};
  clusters.value.forEach((c) => {
    const subj = extractSubject(c);
    const key = `${c.errorType}::${subj}`;
    // 同一个 (errorType, subject) 可能有多条记录，累加
    if (!map[key]) {
      map[key] = { count: 0, cluster: c, severity: 'empty' };
    }
    map[key].count += c.questionCount || 0;
    map[key].severity = countToSeverity(map[key].count);
  });
  return map;
});

/** 按严重度分组（用于下方卡片列表） */
const countGroups = computed(() => {
  const groups = [
    { key: 'high', label: '10条及以上', items: [] },
    { key: 'medium', label: '5–9条', items: [] },
    { key: 'low', label: '1–4条', items: [] }
  ];
  const idx = { high: 0, medium: 1, low: 2 };
  clusters.value.forEach((c) => {
    const i = idx[c.countBand] ?? 2;
    groups[i].items.push(c);
  });
  return groups.filter((g) => g.items.length > 0);
});

/** 从 cluster 中提取学科名称 */
function extractSubject(cluster) {
  // 降级：取第一个知识点
  if (cluster.knowledgePoints && cluster.knowledgePoints.length > 0) {
    return cluster.knowledgePoints[0];
  }
  return '未分类';
}

/** 根据数量返回严重程度等级 */
function countToSeverity(count) {
  if (count >= 10) return 'high';
  if (count >= 5) return 'medium';
  if (count >= 1) return 'low';
  return 'empty';
}

/** 获取矩阵格子的错题数量 */
function getCellCount(errorType, subject) {
  return cellMap.value[`${errorType}::${subject}`]?.count || 0;
}

/** 获取矩阵格子的严重程度 */
function getCellSeverity(errorType, subject) {
  const count = getCellCount(errorType, subject);
  return countToSeverity(count);
}

/** 判断格子是否被选中 */
function isSelected(errorType, subject) {
  return selected.value && selected.value.errorType === errorType && selected.value.subject === subject;
}

/** 截断文本 */
function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

// ==================== 交互方法 ====================

/** 点击矩阵格子 → 展开趋势分析面板 */
function selectCell(errorType, subject) {
  const count = getCellCount(errorType, subject);
  // 点击已选中的格子 → 收起面板
  if (isSelected(errorType, subject)) {
    selected.value = null;
    return;
  }
  // 空格子不展开
  if (count === 0) return;

  const cell = cellMap.value[`${errorType}::${subject}`];
  const cluster = cell?.cluster || null;

  selected.value = {
    errorType,
    subject,
    typeName: ERROR_TYPE_MAP[errorType] || errorType,
    count,
    severity: countToSeverity(count),
    cluster
  };
}

/** 仅把当前账户完整旧条目交给答题页，不替换题库或回滚副本。 */
function goQuiz(cluster) {
  if (!cluster?.reviewableCount) return;
  const result = studyEngineStore.prepareLegacyReview({
    clusterId: cluster.clusterId,
    expectedOwnerId: loadedOwnerId.value
  });
  if (!result.success) {
    toast.info(result.message || '重练入口未准备好');
    return;
  }
  if (result.skipped || result.deferred) toast.info(`本次重练${result.count}条，其余原记录已保留`);
  safeNavigateTo(result.url);
}

// ==================== 数据加载 ====================

async function loadData() {
  loading.value = true;
  const ownerId = getUserId() || '';
  try {
    const result = await studyEngineStore.getErrorClusters();
    if ((getUserId() || '') !== ownerId) return;
    if (result?.success !== false && result?.data) {
      loadedOwnerId.value = ownerId;
      clusters.value = result.data.clusters || [];
      summaryData.value = {
        totalMistakes: result.data.summary?.totalMistakes || 0,
        reviewableCount: result.data.summary?.reviewableCount || 0
      };
    }
  } catch (e) {
    logger.warn('[ErrorClusters] 加载失败:', e);
    toast.info('加载失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}

async function onRefresh() {
  isRefreshing.value = true;
  selected.value = null; // 刷新时收起面板
  await loadData();
  isRefreshing.value = false;
}

function goBack() {
  safeNavigateBack();
}

// ==================== 生命周期 ====================

onMounted(() => {
  statusBarHeight.value = getStatusBarHeight();
  loadData();
});
</script>

<style scoped>
/* ==================== 页面容器 ==================== */
.m-data[role='button'],
.tp-close {
  min-width: 44px;
  min-height: 44px;
}
.m-data:focus-visible,
.tp-close:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.page {
  min-height: 100vh;
  background: var(--background);
  padding-bottom: constant(safe-area-inset-bottom);
  padding-bottom: env(safe-area-inset-bottom);
  position: relative;
  /* 颜色变量 */
  --c-high: var(--danger, #ff453a);
  --c-medium: var(--warning, #ff9f0a);
  --c-low: #ffcc00;
  --c-empty: var(--bg-secondary, rgba(0, 0, 0, 0.04));
  --c-high-bg: color-mix(in srgb, var(--c-high) 18%, transparent);
  --c-medium-bg: color-mix(in srgb, var(--c-medium) 18%, transparent);
  --c-low-bg: color-mix(in srgb, var(--c-low) 18%, transparent);
}
.page.dark-mode {
  background: linear-gradient(
    180deg,
    var(--background) 0%,
    var(--page-gradient-mid, var(--background)) 50%,
    var(--background) 100%
  );
}

/* ==================== 极光背景 ==================== */
.aurora-bg {
  position: absolute;
  top: -120rpx;
  left: -80rpx;
  width: 100%;
  height: 620rpx;
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 75, 75, 0.16) 0%, transparent 40%),
    radial-gradient(circle at 80% 10%, rgba(255, 75, 75, 0.08) 0%, transparent 28%);
  filter: blur(70px);
  opacity: 0.9;
  z-index: 0;
}
.dark-mode .aurora-bg {
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 69, 58, 0.12) 0%, transparent 42%),
    radial-gradient(circle at 80% 10%, rgba(100, 160, 255, 0.1) 0%, transparent 30%);
}

/* ==================== 导航栏 ==================== */
.top-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  padding: 16rpx 32rpx;
  background: var(--bg-card);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.dark-mode .top-nav {
  background: rgba(10, 10, 15, 0.72);
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
.nav-back {
  font-size: 36rpx;
  color: var(--text-primary);
  padding: 20rpx;
}
.nav-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.nav-right {
  width: 48rpx;
}
.main-scroll {
  padding: 160rpx 32rpx 40rpx;
  position: relative;
  z-index: 1;
}

/* ==================== 骨架屏 ==================== */
.skel-area {
  padding-top: 20rpx;
}
.skel-card {
  border-radius: 28rpx;
  margin-bottom: 24rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
  animation: pulse 1.5s ease-in-out infinite;
}
.skel-hero {
  height: 200rpx;
}
.skel-short {
  height: 140rpx;
}
.skel-row {
  display: flex;
  margin-bottom: 24rpx;
}
.skel-dot {
  width: 100rpx;
  height: 40rpx;
  border-radius: 20rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
  animation: pulse 1.5s ease-in-out infinite;
  margin-right: 16rpx;
}
.skel-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  margin-bottom: 24rpx;
}
.skel-grid > view {
  margin-right: 8rpx;
  margin-bottom: 8rpx;
}
.skel-cell {
  height: 80rpx;
  border-radius: 12rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.8;
  }
}

/* ==================== 通用卡片 ==================== */
.glass-card {
  background: var(--bg-card);
  border-radius: 28rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.dark-mode .glass-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

/* ==================== 总览卡片 ==================== */
.hero-card {
  padding: 36rpx 32rpx;
}
.hero-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
}
.hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.hero-val {
  font-size: 56rpx;
  font-weight: 900;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}
.danger-text {
  color: var(--c-high);
}
.warning-text {
  color: var(--c-medium);
}
.hero-lbl {
  font-size: 22rpx;
  color: var(--text-secondary, #8e8e93);
  margin-top: 8rpx;
}
.hero-divider {
  width: 1px;
  height: 60rpx;
  background: var(--border, rgba(0, 0, 0, 0.06));
}
.hero-tip {
  display: flex;
  align-items: center;
  margin-top: 24rpx;
  padding: 10rpx 20rpx;
  border-radius: 16rpx;
  background: var(--c-high-bg);
}
.tip-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--c-high);
  margin-right: 12rpx;
}
.tip-text {
  font-size: 24rpx;
  color: var(--c-high);
  font-weight: 600;
}

/* ==================== 图例 ==================== */
.legend-bar {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 24rpx;
}
.legend-item {
  display: flex;
  align-items: center;
  margin-right: 24rpx;
  margin-bottom: 8rpx;
}
.legend-swatch {
  width: 24rpx;
  height: 24rpx;
  border-radius: 6rpx;
  margin-right: 8rpx;
}
.legend-text {
  font-size: 22rpx;
  color: var(--text-secondary);
}

/* ==================== 严重程度颜色（矩阵格子 + 图例 + 柱状条通用） ==================== */
.sev-high {
  background: var(--c-high-bg);
}
.sev-medium {
  background: var(--c-medium-bg);
}
.sev-low {
  background: var(--c-low-bg);
}
.sev-empty {
  background: var(--c-empty);
}

/* ==================== 聚类矩阵 ==================== */
.matrix-scroll {
  margin-bottom: 24rpx;
}
.matrix-table {
  display: flex;
  flex-direction: column;
  min-width: 100%;
}
.m-row {
  display: flex;
}
.m-cell {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

/* 左上角 */
.m-corner {
  width: 120rpx;
  height: 72rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.02));
  border-radius: 12rpx 0 0 0;
}
.m-corner-text {
  font-size: 18rpx;
  color: var(--text-secondary);
  text-align: center;
}

/* 列标题（错因） */
.m-col-hd {
  width: 100rpx;
  height: 72rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.02));
  margin-left: 4rpx;
}
.m-col-text {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--text-primary);
}

/* 行标题（学科） */
.m-row-hd {
  width: 120rpx;
  height: 88rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.02));
  margin-top: 4rpx;
}
.m-row-text {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--text-primary);
  text-align: center;
  word-break: break-all;
  line-height: 1.3;
  padding: 0 4rpx;
}

/* 数据格子 */
.m-data {
  width: 100rpx;
  height: 88rpx;
  margin-left: 4rpx;
  margin-top: 4rpx;
  border-radius: 12rpx;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
  position: relative;
}
.m-data:active {
  transform: scale(0.92);
}
.m-data.sev-high {
  background: var(--c-high-bg);
  border: 2rpx solid color-mix(in srgb, var(--c-high) 40%, transparent);
}
.m-data.sev-medium {
  background: var(--c-medium-bg);
  border: 2rpx solid color-mix(in srgb, var(--c-medium) 30%, transparent);
}
.m-data.sev-low {
  background: var(--c-low-bg);
  border: 2rpx solid color-mix(in srgb, var(--c-low) 30%, transparent);
}
.m-data.sev-empty {
  background: var(--c-empty);
  border: 2rpx solid transparent;
}
.m-data.m-selected {
  transform: scale(1.08);
  box-shadow: 0 0 0 4rpx color-mix(in srgb, var(--c-high) 40%, transparent);
  z-index: 2;
}
.m-count {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
.m-data.sev-high .m-count {
  color: var(--c-high);
}
.m-data.sev-medium .m-count {
  color: var(--c-medium);
}

/* 深色模式矩阵头部 */
.dark-mode .m-corner,
.dark-mode .m-col-hd,
.dark-mode .m-row-hd {
  background: rgba(255, 255, 255, 0.04);
}

/* ==================== 趋势分析面板 ==================== */
.trend-panel {
  animation: panelSlideIn 0.3s ease-out;
}
@keyframes panelSlideIn {
  from {
    opacity: 0;
    transform: translateY(-20rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.accent-high {
  border-left: 8rpx solid var(--c-high);
}
.accent-medium {
  border-left: 8rpx solid var(--c-medium);
}
.accent-low {
  border-left: 8rpx solid var(--c-low);
}

/* 面板标题 */
.tp-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.tp-title-wrap {
  display: flex;
  align-items: center;
}
.tp-type {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.tp-sep {
  font-size: 24rpx;
  color: var(--text-secondary);
  margin: 0 12rpx;
}
.tp-subj {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-secondary);
}
.tp-close {
  padding: 8rpx;
  color: var(--text-secondary);
}

/* 三项统计 */
.tp-stats {
  display: flex;
  justify-content: space-around;
  padding: 20rpx 0;
  margin-bottom: 20rpx;
  border-top: 1rpx solid var(--border, rgba(0, 0, 0, 0.04));
  border-bottom: 1rpx solid var(--border, rgba(0, 0, 0, 0.04));
}
.tp-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.tp-stat-val {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.tp-stat-lbl {
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}
.dir-up {
  color: var(--c-high);
}
.dir-down {
  color: var(--success, #34c759);
}
.dir-flat {
  color: var(--text-secondary);
}

/* ==================== 7日趋势柱状图 ==================== */
.chart-section {
  margin-bottom: 24rpx;
}
.chart-title {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 16rpx;
  display: block;
}
.bar-chart {
  display: flex;
  align-items: flex-end;
  height: 200rpx;
  padding-top: 20rpx;
}
.bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 4rpx;
}
.bar-col:last-child {
  margin-right: 0;
}
.bar-track {
  width: 100%;
  max-width: 48rpx;
  height: 140rpx;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: stretch;
}
.bar-fill {
  border-radius: 8rpx 8rpx 0 0;
  min-height: 4rpx;
  transition: height 0.5s ease-out;
}
.bar-fill.sev-high {
  background: var(--c-high);
}
.bar-fill.sev-medium {
  background: var(--c-medium);
}
.bar-fill.sev-low {
  background: var(--c-low);
}
.bar-fill.sev-empty {
  background: var(--c-empty);
}
.bar-val {
  font-size: 20rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 6rpx;
  font-variant-numeric: tabular-nums;
}
.bar-day {
  font-size: 18rpx;
  color: var(--text-secondary);
  margin-top: 2rpx;
}

/* ==================== 典型错题 ==================== */
.ex-section {
  margin-bottom: 20rpx;
}
.ex-title {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 12rpx;
  display: block;
}
.ex-item {
  padding: 16rpx;
  margin-bottom: 12rpx;
  border-radius: 16rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.02));
}
.dark-mode .ex-item {
  background: rgba(255, 255, 255, 0.04);
}
.ex-q {
  font-size: 24rpx;
  color: var(--text-primary);
  line-height: 1.5;
  display: block;
  margin-bottom: 8rpx;
}
.ex-ans {
  display: flex;
  flex-wrap: wrap;
}
.ex-yours {
  font-size: 22rpx;
  color: var(--c-high);
  margin-right: 20rpx;
}
.ex-right {
  font-size: 22rpx;
  color: var(--success, #34c759);
}

/* ==================== AI 建议 ==================== */
.suggestion-box {
  display: flex;
  align-items: flex-start;
  padding: 16rpx 20rpx;
  border-radius: 16rpx;
  background: color-mix(in srgb, var(--success, #34c759) 8%, transparent);
  margin-bottom: 8rpx;
}
.suggestion-text {
  font-size: 24rpx;
  color: var(--success, #34c759);
  line-height: 1.5;
  margin-left: 12rpx;
  flex: 1;
}

/* ==================== 按严重度分组的列表 ==================== */
.section {
  margin-top: 40rpx;
}
.section-header {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}
.section-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  margin-right: 12rpx;
}
.dot-high {
  background: var(--c-high);
  box-shadow: 0 0 12rpx rgba(255, 69, 58, 0.4);
}
.dot-medium {
  background: var(--c-medium);
}
.dot-low {
  background: var(--c-low);
}
.section-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-primary);
  flex: 1;
}
.section-badge {
  font-size: 22rpx;
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
  font-weight: 600;
}
.badge-high {
  background: var(--c-high-bg);
  color: var(--c-high);
}
.badge-medium {
  background: var(--c-medium-bg);
  color: var(--c-medium);
}
.badge-low {
  background: var(--c-low-bg);
  color: var(--c-low);
}

/* 聚类卡片 */
.cluster-card {
  padding: 28rpx;
  animation: fadeSlideIn 0.3s ease-out both;
}
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateX(-16rpx);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
.cluster-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.cluster-name {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-primary);
  flex: 1;
}
.cluster-trend {
  font-size: 28rpx;
  font-weight: 800;
}
.trend-up {
  color: var(--c-high);
}
.trend-down {
  color: var(--success, #34c759);
}
.trend-flat {
  color: var(--text-secondary);
}
.cluster-meta {
  margin-bottom: 12rpx;
}
.cluster-count {
  font-size: 24rpx;
  color: var(--text-secondary);
}
.kp-tags {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 12rpx;
}
.kp-tag {
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 12rpx;
  background: var(--bg-secondary, rgba(0, 0, 0, 0.04));
  color: var(--text-secondary);
  margin-right: 8rpx;
  margin-bottom: 8rpx;
}
.dark-mode .kp-tag {
  background: rgba(255, 255, 255, 0.06);
}
.cluster-suggestion {
  font-size: 24rpx;
  color: var(--success, #34c759);
  line-height: 1.5;
  display: block;
}

/* ==================== 空状态 ==================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}
.empty-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 32rpx;
}
.empty-sub {
  font-size: 26rpx;
  color: var(--text-secondary);
  margin-top: 16rpx;
}
.bottom-safe {
  height: 80rpx;
}
</style>
