<template>
  <view class="page" :class="{ 'dark-mode': isDark }">
    <view class="aurora-bg" />

    <!-- 导航栏 -->
    <view class="top-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <text class="nav-back" @tap="goBack">
        <BaseIcon name="arrow-left" :size="36" />
      </text>
      <text class="nav-title">错题归因矩阵</text>
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
              <text class="hero-lbl">累计错题</text>
            </view>
            <view class="hero-divider" />
            <view class="hero-stat">
              <text class="hero-val warning-text">{{ summaryData.highSeverity }}</text>
              <text class="hero-lbl">高危聚类</text>
            </view>
            <view class="hero-divider" />
            <view class="hero-stat">
              <text class="hero-val">{{ activeSubjects.length }}</text>
              <text class="hero-lbl">涉及学科</text>
            </view>
          </view>
          <view v-if="summaryData.topErrorType" class="hero-tip">
            <view class="tip-dot" />
            <text class="tip-text">最高频错因：{{ summaryData.topErrorType }}</text>
          </view>
        </view>

        <!-- 严重程度图例 -->
        <view class="legend-bar">
          <view class="legend-item">
            <view class="legend-swatch sev-high" />
            <text class="legend-text">高危≥10</text>
          </view>
          <view class="legend-item">
            <view class="legend-swatch sev-medium" />
            <text class="legend-text">中危5-9</text>
          </view>
          <view class="legend-item">
            <view class="legend-swatch sev-low" />
            <text class="legend-text">低危1-4</text>
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
                <text class="m-corner-text">学科＼错因</text>
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
                @tap="selectCell(et.key, subj)"
              >
                <text v-if="getCellCount(et.key, subj) > 0" class="m-count">
                  {{ getCellCount(et.key, subj) }}
                </text>
              </view>
            </view>
          </view>
        </scroll-view>

        <!-- ==================== 趋势分析展开面板 ==================== -->
        <view v-if="selected" class="trend-panel glass-card" :class="'accent-' + selected.severity">
          <!-- 标题行 -->
          <view class="tp-header">
            <view class="tp-title-wrap">
              <text class="tp-type">{{ selected.typeName }}</text>
              <text class="tp-sep">×</text>
              <text class="tp-subj">{{ selected.subject }}</text>
            </view>
            <view class="tp-close" @tap="selected = null">
              <BaseIcon name="close" :size="24" />
            </view>
          </view>

          <!-- 三项统计 -->
          <view class="tp-stats">
            <view class="tp-stat">
              <text class="tp-stat-val">{{ selected.count }}</text>
              <text class="tp-stat-lbl">错题数</text>
            </view>
            <view class="tp-stat">
              <text :class="['tp-stat-val', 'dir-' + selected.trend]">{{ trendLabel(selected.trend) }}</text>
              <text class="tp-stat-lbl">趋势</text>
            </view>
            <view class="tp-stat">
              <text class="tp-stat-val">{{ severityLabel(selected.severity) }}</text>
              <text class="tp-stat-lbl">级别</text>
            </view>
          </view>

          <!-- 近7天趋势柱状图（纯CSS，无第三方依赖） -->
          <view class="chart-section">
            <text class="chart-title">近 7 日趋势</text>
            <view class="bar-chart">
              <view v-for="(val, i) in selected.trendData" :key="i" class="bar-col">
                <view class="bar-track">
                  <view
                    class="bar-fill"
                    :class="'sev-' + barSeverity(val)"
                    :style="{ height: barHeight(val, selected.trendMax) }"
                  />
                </view>
                <text class="bar-val">{{ val }}</text>
                <text class="bar-day">{{ dayLabels[i] }}</text>
              </view>
            </view>
          </view>

          <!-- 典型错题 -->
          <view
            v-if="selected.cluster && selected.cluster.examples && selected.cluster.examples.length"
            class="ex-section"
          >
            <text class="ex-title">典型错题</text>
            <view v-for="(ex, i) in selected.cluster.examples.slice(0, 3)" :key="i" class="ex-item">
              <text class="ex-q">{{ i + 1 }}. {{ ex.questionContent }}</text>
              <view class="ex-ans">
                <text class="ex-yours">你选: {{ ex.userAnswer }}</text>
                <text class="ex-right">正确: {{ ex.correctAnswer }}</text>
              </view>
            </view>
          </view>

          <!-- AI 建议 -->
          <view v-if="selected.cluster && selected.cluster.suggestion" class="suggestion-box">
            <BaseIcon name="sparkle" :size="28" />
            <text class="suggestion-text">{{ selected.cluster.suggestion }}</text>
          </view>

          <!-- 一键针对训练（高危）/ 查看同类题（中低危） -->
          <WdButton
            v-if="selected.severity === 'high'"
            type="error"
            block
            custom-style="margin-top: 28rpx; border-radius: 999rpx; font-weight: 700;"
            @click="startTargetedTraining"
          >
            一键针对训练
          </WdButton>
          <WdButton
            v-else
            block
            plain
            custom-style="margin-top: 28rpx; border-radius: 999rpx;"
            @click="goQuiz(selected.cluster)"
          >
            查看同类题
          </WdButton>
        </view>

        <!-- ==================== 按严重度分组的卡片列表 ==================== -->
        <view v-for="group in severityGroups" :key="group.key" class="section">
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
              <text class="cluster-trend" :class="'trend-' + normalizeTrend(cluster.trend)">
                <BaseIcon :name="trendIcon(cluster.trend)" :size="28" />
              </text>
            </view>
            <view class="cluster-meta">
              <text class="cluster-count">{{ cluster.questionCount }} 题</text>
            </view>
            <view v-if="cluster.knowledgePoints && cluster.knowledgePoints.length" class="kp-tags">
              <text v-for="kp in cluster.knowledgePoints.slice(0, 4)" :key="kp" class="kp-tag">{{ kp }}</text>
            </view>
            <text v-if="cluster.suggestion" class="cluster-suggestion">{{ cluster.suggestion }}</text>
            <WdButton
              size="small"
              plain
              custom-style="margin-top: 20rpx; border-radius: 999rpx;"
              @click="goQuiz(cluster)"
            >
              查看同类题
            </WdButton>
          </view>
        </view>
      </template>

      <!-- ==================== 空状态 ==================== -->
      <view v-else class="empty-state">
        <BaseIcon name="sparkle" :size="96" />
        <text class="empty-title">暂无错题聚类</text>
        <text class="empty-sub">多做几套题后，AI 会自动分析错题模式</text>
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
import { storageService } from '@/services/storageService.js';
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
const summaryData = ref({ totalMistakes: 0, highSeverity: 0, topErrorType: '' });
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
    // 取最高严重度
    if (severityRank(c.severity) > severityRank(map[key].severity)) {
      map[key].severity = c.severity;
      map[key].cluster = c;
    }
  });
  // 重新计算每个格子的 severity（基于累计数量）
  Object.values(map).forEach((cell) => {
    cell.severity = countToSeverity(cell.count);
  });
  return map;
});

/** 按严重度分组（用于下方卡片列表） */
const severityGroups = computed(() => {
  const groups = [
    { key: 'high', label: '高频错误', items: [] },
    { key: 'medium', label: '中频错误', items: [] },
    { key: 'low', label: '低频错误', items: [] }
  ];
  const idx = { high: 0, medium: 1, low: 2 };
  clusters.value.forEach((c) => {
    const i = idx[c.severity] ?? 2;
    groups[i].items.push(c);
  });
  return groups.filter((g) => g.items.length > 0);
});

/** 近7天日期标签 */
const dayLabels = computed(() => {
  const labels = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return labels;
});

// ==================== 工具函数 ====================

/** 从 cluster 中提取学科名称 */
function extractSubject(cluster) {
  // 优先从 clusterId 解析（格式："errorType::subject"）
  if (cluster.clusterId && cluster.clusterId.includes('::')) {
    return cluster.clusterId.split('::')[1];
  }
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

/** 严重度排序权重 */
function severityRank(sev) {
  return { high: 3, medium: 2, low: 1, empty: 0 }[sev] || 0;
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

/** 趋势方向标准化（兼容 up/increasing 等不同格式） */
function normalizeTrend(trend) {
  if (trend === 'up' || trend === 'increasing') return 'up';
  if (trend === 'down' || trend === 'decreasing') return 'down';
  return 'flat';
}

/** 趋势图标 */
function trendIcon(trend) {
  const dir = normalizeTrend(trend);
  if (dir === 'up') return 'trend-up';
  if (dir === 'down') return 'trend-down';
  return 'arrow-right';
}

/** 趋势文字标签 */
function trendLabel(trend) {
  const dir = normalizeTrend(trend);
  if (dir === 'up') return '↑ 增多';
  if (dir === 'down') return '↓ 减少';
  return '— 稳定';
}

/** 严重程度中文标签 */
function severityLabel(sev) {
  return { high: '高危', medium: '中危', low: '低危' }[sev] || '低危';
}

/** 根据数量确定柱状条颜色等级 */
function barSeverity(val) {
  return countToSeverity(val);
}

/** 计算柱状条高度百分比 */
function barHeight(val, max) {
  if (!max || max <= 0) return '4rpx'; // 最小高度
  const pct = Math.max(4, Math.round((val / max) * 100));
  return pct + '%';
}

/**
 * 生成近7天近似趋势数据
 * 后端只返回 trend 方向，此处根据总数+方向生成合理的每日分布
 */
function generateDailyTrend(totalCount, trend) {
  const days = 7;
  const dir = normalizeTrend(trend);
  const base = Math.max(1, Math.ceil(totalCount / days));
  const result = [];
  for (let i = 0; i < days; i++) {
    let val;
    if (dir === 'up') {
      // 递增趋势：起始低，结尾高
      val = Math.max(0, Math.round(base * (0.3 + i * 0.18)));
    } else if (dir === 'down') {
      // 递减趋势：起始高，结尾低
      val = Math.max(0, Math.round(base * (1.4 - i * 0.15)));
    } else {
      // 稳定趋势：在均值附近小幅波动（使用固定种子避免每次渲染变化）
      const jitter = ((i * 7 + 3) % 5) - 2; // 确定性伪随机：-2, -1, 0, 1, 2
      val = Math.max(0, base + jitter);
    }
    result.push(val);
  }
  return result;
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
  const trend = cluster?.trend || 'stable';
  const trendData = generateDailyTrend(count, trend);

  selected.value = {
    errorType,
    subject,
    typeName: ERROR_TYPE_MAP[errorType] || errorType,
    count,
    severity: countToSeverity(count),
    trend: normalizeTrend(trend),
    trendData,
    trendMax: Math.max(...trendData, 1),
    cluster
  };
}

/** 查看同类题（中低危，跳转 do-quiz） */
function goQuiz(cluster) {
  if (!cluster) return;
  safeNavigateTo(
    `/pages/practice-sub/do-quiz?mode=error_cluster&errorType=${encodeURIComponent(cluster.errorType || cluster.errorTypeName)}`
  );
}

/** 一键针对训练（高危，从本地错题本筛选 → 临时替换题库 → 跳转 do-quiz） */
async function startTargetedTraining() {
  if (!selected.value) return;
  toast.loading('生成训练题…');

  try {
    const matchSubject = selected.value.subject;
    const matchErrorType = selected.value.errorType;
    const clusterKPs = selected.value.cluster?.knowledgePoints || [];

    // 从本地错题本筛选同类错题
    const allMistakes = storageService.get('mistake_book', []);
    const matched = allMistakes.filter((m) => {
      const cat = m.category || m.knowledge_point || m.subject || '';
      return cat === matchSubject || clusterKPs.includes(cat);
    });

    if (matched.length === 0) {
      toast.hide();
      toast.info('暂无可练习的同类错题');
      return;
    }

    // 格式化为练习题（与 mistake/index.vue 的 startClusterTraining 保持一致）
    const questions = matched
      .map((m, i) => ({
        id: m.id || m._id || `train_${i}_${Date.now()}`,
        question: m.question || m.question_content || m.title || `题目 ${i + 1}`,
        options:
          Array.isArray(m.options) && m.options.length >= 2
            ? m.options
            : m.choices || ['A. 选项A', 'B. 选项B', 'C. 选项C', 'D. 选项D'],
        answer: ((m.answer || m.correct_answer || m.correctAnswer || 'A') + '').charAt(0).toUpperCase(),
        desc: m.desc || m.analysis || m.explanation || '暂无解析',
        category: m.category || matchSubject,
        type: m.type || '单选',
        difficulty: m.difficulty || 2,
        isReview: true
      }))
      .filter((q) => q.question && q.options.length >= 2);

    if (questions.length === 0) {
      toast.hide();
      toast.info('错题数据格式异常');
      return;
    }

    // 备份原题库 → 临时替换 → 跳转
    const currentBank = storageService.get('v30_bank', []);
    if (currentBank.length > 0) {
      storageService.save('v30_bank_backup', currentBank);
    }
    storageService.save('v30_bank', questions);
    storageService.save('is_review_mode', true);

    toast.hide();
    logger.log(`[ErrorClusters] 针对训练启动: ${matchErrorType}×${matchSubject}, ${questions.length} 题`);
    safeNavigateTo('/pages/practice-sub/do-quiz?mode=error_cluster');
  } catch (e) {
    logger.error('[ErrorClusters] 训练启动失败:', e);
    toast.hide();
    toast.info('训练启动失败，请稍后重试');
  }
}

// ==================== 数据加载 ====================

async function loadData() {
  loading.value = true;
  try {
    const result = await studyEngineStore.getErrorClusters();
    if (result?.success !== false && result?.data) {
      clusters.value = result.data.clusters || [];
      summaryData.value = {
        totalMistakes: result.data.summary?.totalMistakes || result.data.totalMistakes || 0,
        highSeverity: result.data.summary?.highSeverity || 0,
        topErrorType:
          result.data.summary?.topErrorType ||
          (clusters.value.length > 0
            ? clusters.value.reduce((a, b) => (a.questionCount > b.questionCount ? a : b)).errorTypeName
            : '')
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
