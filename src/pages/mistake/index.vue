<template>
  <LearningShell v-if="!showLegacy" active="mistake" title="错题与复习">
    <LearningOverview :initial-expanded="true" :show-navigation="false" view="mistake" />
    <view class="legacy-entry">
      <button class="quiet-button" role="button" tabindex="0" @tap="toggleLegacy">历史题库记录</button>
    </view>
  </LearningShell>
  <view v-else :class="['container', { 'dark-mode': isDark }]">
    <view class="aurora-bg" />

    <!-- 骨架屏 -->
    <MistakeSkeleton v-if="isInitLoading" :is-dark="isDark" />

    <!-- 导航栏 - 添加设计系统工具类 -->
    <view v-if="!isInitLoading" class="header-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content ds-flex ds-flex-between" :style="{ paddingRight: capsuleSafeRight + 'px' }">
        <view class="nav-back ds-touchable" @tap="goBack"><BaseIcon name="arrow-left" :size="32" /></view>
        <text class="nav-title ds-text-lg ds-font-semibold"> 我的错题本 </text>
        <view class="nav-actions">
          <!-- 移除垃圾桶图标 -->
          <view class="nav-placeholder" />
        </view>
      </view>
    </view>

    <scroll-view
      v-if="!isInitLoading"
      scroll-y
      class="main-scroll"
      :style="{ paddingTop: statusBarHeight + 50 + 'px' }"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @scrolltolower="loadMore"
      @refresherrefresh="onPullRefresh"
    >
      <LearningOverview :initial-expanded="true" />
      <button size="mini" @tap="toggleLegacy">
        {{ showLegacy ? '收起历史视图' : '历史题库记录' }}
      </button>
      <button
        role="button"
        tabindex="0"
        size="mini"
        :disabled="isPendingSyncing"
        :aria-busy="isPendingSyncing"
        @tap="confirmPendingSync"
        @keydown.enter.prevent="confirmPendingSync"
        @keydown.space.prevent="confirmPendingSync"
      >
        同步历史待办
      </button>
      <view v-if="syncFeedback" role="status" aria-live="polite" data-test="legacy-sync-feedback" class="sync-feedback">
        {{ syncFeedback }}
      </view>
      <template v-if="showLegacy">
        <!-- 统计卡片区域 -->
        <view v-if="mistakes.length > 0" class="stats-grid">
          <StatsCard title="已载入旧条目" :value="mistakes.length" icon="note" :is-dark="isDark" />
          <StatsCard
            title="旧重复错误"
            :value="pendingReviewCount"
            icon="refresh"
            change="原记录次数≥2"
            change-type="neutral"
            :is-dark="isDark"
          />
        </view>

        <!-- ✅ P1: 重练模式提示 -->
        <view v-if="isReviewMode && mistakes.length > 0" class="review-mode-banner">
          <BaseIcon name="refresh" :size="40" class="review-icon" />
          <view class="review-info">
            <text class="review-title"> 错题重练模式 </text>
            <text class="review-desc"> {{ filteredReviewMistakes.length }} 道待重练 </text>
          </view>
          <button class="start-review-btn" @tap="startSequentialReview">开始重练</button>
        </view>

        <!-- 错题筛选栏 -->
        <view v-if="mistakes.length > 0" class="review-filter-bar">
          <scroll-view scroll-x :show-scrollbar="false" class="filter-scroll">
            <view :class="['filter-chip', { active: reviewFilter === 'all' }]" @tap="reviewFilter = 'all'">
              <text class="filter-text"> 全部 </text>
            </view>
            <view :class="['filter-chip', { active: reviewFilter === 'high_freq' }]" @tap="reviewFilter = 'high_freq'">
              <text class="filter-text"> 高频错题 </text>
            </view>
            <view :class="['filter-chip', { active: reviewFilter === 'recent' }]" @tap="reviewFilter = 'recent'">
              <text class="filter-text"> 最近错题 </text>
            </view>
            <view
              :class="['filter-chip cluster-chip', { active: reviewFilter === 'cluster' }]"
              @tap="switchToClusterView"
            >
              <text class="filter-text"> 历史分组 </text>
            </view>
            <view
              v-for="cat in mistakeCategories"
              :key="cat"
              :class="['filter-chip', { active: reviewFilter === 'cat_' + cat }]"
              @tap="reviewFilter = 'cat_' + cat"
            >
              <text class="filter-text"> {{ cat }} </text>
            </view>
          </scroll-view>
        </view>

        <!-- 模式切换 - 优化布局 -->
        <view v-if="mistakes.length > 0" class="mode-switch glass-card ds-flex ds-gap-xs">
          <view
            :class="['mode-item', 'ds-flex-center', 'ds-touchable', { active: mode === 'quiz' }]"
            @tap="switchMode('quiz')"
          >
            <text class="ds-text-sm ds-font-medium"> 刷题模式 </text>
          </view>
          <view
            :class="['mode-item', 'ds-flex-center', 'ds-touchable', { active: mode === 'recite' }]"
            @tap="switchMode('recite')"
          >
            <text class="ds-text-sm ds-font-medium"> 背诵模式 </text>
          </view>
        </view>

        <!-- 空状态 - 优化样式 -->
        <view v-if="mistakes.length === 0 && !isInitLoading" class="empty-box ds-flex-col ds-flex-center">
          <BaseIcon name="celebrate" :size="160" class="empty-icon" />
          <text class="empty-title ds-text-lg ds-font-bold"> 暂无历史错题 </text>
          <text class="empty-text ds-text-sm"> 这里尚未记录旧版练习错题，不代表已经掌握。 </text>
          <view class="go-practice-btn ds-touchable" @tap="goBack">
            <BaseIcon name="pen" :size="28" /><text>去刷题</text>
          </view>
        </view>

        <!-- 历史分组视图（AI 分析模式） -->
        <view v-if="reviewFilter === 'cluster'" class="cluster-view">
          <view v-if="clusterLoading" class="cluster-loading">
            <view v-for="i in 3" :key="i" class="loading-dot" />
            <text class="cluster-loading-text">正在读取旧条目…</text>
          </view>
          <view v-else-if="errorClusters.length === 0" class="cluster-empty">
            <text class="cluster-empty-text">暂无可分组的旧条目</text>
          </view>
          <view v-else>
            <view v-for="cluster in errorClusters" :key="cluster.clusterId" class="cluster-card glass-card">
              <view class="cluster-header">
                <view class="cluster-badge" :class="[cluster.countBand]">
                  <text class="cluster-badge-text"> 旧标签 </text>
                </view>
                <text class="cluster-type">{{ cluster.errorTypeName }}</text>
                <text class="cluster-count">{{ cluster.questionCount }}条 · 可重练 {{ cluster.reviewableCount }}</text>
              </view>
              <view v-if="cluster.knowledgePoints && cluster.knowledgePoints.length > 0" class="cluster-kps">
                <text v-for="kp in cluster.knowledgePoints" :key="kp" class="kp-tag">{{ kp }}</text>
              </view>
              <button class="train-btn" :disabled="!cluster.reviewableCount" @tap="startClusterTraining(cluster)">
                重练完整条目
                {{
                  cluster.knowledgePoints && cluster.knowledgePoints[0]
                    ? cluster.knowledgePoints[0]
                    : cluster.errorTypeName
                }}
              </button>
            </view>
          </view>
        </view>

        <!-- 错题列表 (F007: 限制DOM节点数量，最多渲染 maxDomItems 条) -->
        <template v-if="reviewFilter !== 'cluster'">
          <MistakeCard
            v-for="(item, index) in displayedMistakes"
            :key="item.id || item._id || index"
            :item="item"
            :index="index"
            :mode="mode"
            :mistakes="mistakes"
            :expected-owner-id="loadedOwnerId"
            @remove="removeMistake(item)"
          />
        </template>

        <!-- 一键清空按钮（显示在列表最底部） - 优化样式 -->
        <view v-if="mistakes.length > 0 && !isLoading && reviewFilter !== 'cluster'" class="clear-all-section">
          <button
            class="clear-all-btn ds-flex ds-flex-center ds-gap-xs ds-touchable"
            :disabled="isClearing"
            @tap="clearAllMistakes"
          >
            <BaseIcon name="delete" :size="36" class="clear-all-icon" />
            <text class="clear-all-text ds-text-sm ds-font-semibold">
              {{ isClearing ? '移除中...' : '移除已载入条目' }}
            </text>
          </button>
        </view>

        <view class="safe-area" />
      </template>
    </scroll-view>

    <!-- 智能诊断报告组件 - ✅ 2.3: 仅在有错题时渲染，避免空数据时的无效组件挂载 -->
    <MistakeReport
      v-if="mistakes.length > 0"
      :mistakes="mistakes"
      :user-info="userInfo"
      :is-dark="isDark"
      :expected-owner-id="loadedOwnerId"
    />

    <!-- 离线状态指示器 -->
    <OfflineIndicator :auto-show="true" position="top" :auto-hide-delay="5000" />
  </view>
</template>

<script setup>
import LearningOverview from '@/components/business/learning/learning-overview.vue';
import LearningShell from '@/components/business/learning/learning-shell.vue';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';

import { ref, computed, watch, onUnmounted } from 'vue';
const learning = useConversationLearningStore();
const showLegacy = ref(false);
function toggleLegacy() {
  showLegacy.value = !showLegacy.value;
  if (showLegacy.value) loadData(true);
}
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app';
import { modal } from '@/utils/modal.js';
import { toast } from '@/utils/toast.js';
import { storageService } from '@/services/storageService.js';
import MistakeSkeleton from './components/mistake-skeleton/mistake-skeleton.vue';
import StatsCard from './StatsCard.vue';
// ✅ 统一日志工具（生产环境自动禁用）
import { logger } from '@/utils/logger.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
import { useStudyEngineStore } from '@/stores/modules/study-engine.js';
import MistakeCard from './MistakeCard.vue';
import MistakeReport from './MistakeReport.vue';
import { normalizeMistakes as normalizeFields } from '@/utils/field-normalizer.js';
import { getStatusBarHeight, getCapsuleSafeRight } from '@/utils/core/system.js';
import { getUserId, getToken } from '@/services/auth-storage.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

// --- 非响应式属性（模块级变量） ---
let studyEngineStore = null; // Pinia store 实例，在 onLoad 中初始化
let _themeHandler = null; // 主题切换回调引用，用于 onUnload 精确移除
let syncGeneration = 0;
const PAGE_SIZE = 20; // 每页数量（常量）
const MAX_DOM_ITEMS = 80; // F007: DOM 上限，防止无限滚动导致 DOM 节点过多

// --- 响应式状态 ---
const isRefreshing = ref(false);
const statusBarHeight = ref(44);
const capsuleSafeRight = ref(20);
const mistakes = ref([]);
const loadedOwnerId = ref(null);
const clustersOwnerId = ref(null);
const mode = ref('quiz'); // 'quiz' 或 'recite'
const userInfo = ref({});
const isDark = ref(false);
const currentPage = ref(1);
const hasMore = ref(true);
const isLoading = ref(false);
const isInitLoading = ref(true); // 初始骨架屏加载状态
const isClearing = ref(false); // 防重复点击：清空错题
const isPendingSyncing = ref(false);
const syncFeedback = ref('');
function resetPendingSync() {
  syncGeneration++;
  if (isPendingSyncing.value) toast.hide();
  isPendingSyncing.value = false;
  syncFeedback.value = '';
}
onUnmounted(resetPendingSync);
const isReviewMode = ref(false); // ✅ P1: 错题重练模式
const reviewFilter = ref('all'); // ✅ 1.7: 筛选条件 all | high_freq | recent | cluster
const errorClusters = ref([]); // 历史分组数据
const clusterLoading = ref(false); // 聚类加载状态
watch(
  () => learning.state.owner,
  () => {
    if (loadedOwnerId.value === (getUserId() || '')) return;
    resetPendingSync();
    mistakes.value = [];
    loadedOwnerId.value = null;
    errorClusters.value = [];
    clustersOwnerId.value = null;
    if (showLegacy.value && !isLoading.value) loadData(true);
  }
);

// --- 计算属性 ---

// 待复习错题数量（错误次数>=2的题目）
const pendingReviewCount = computed(() => {
  return mistakes.value.filter((item) => (item.wrong_count || 1) >= 2).length;
});

// ✅ 1.7: 根据筛选条件过滤错题（兼容 camelCase 和 snake_case 字段名）
const filteredReviewMistakes = computed(() => {
  if (reviewFilter.value === 'high_freq') {
    return [...mistakes.value]
      .filter((m) => (m.wrongCount || m.wrong_count || 1) >= 2)
      .sort((a, b) => (b.wrongCount || b.wrong_count || 1) - (a.wrongCount || a.wrong_count || 1));
  }
  if (reviewFilter.value === 'recent') {
    return [...mistakes.value]
      .sort((a, b) => {
        const ta = a.last_wrong_time || a.lastWrongTime || a.created_at || 0;
        const tb = b.last_wrong_time || b.lastWrongTime || b.created_at || 0;
        return tb - ta;
      })
      .slice(0, 20);
  }
  // 按分类筛选
  if (reviewFilter.value.startsWith('cat_')) {
    const cat = reviewFilter.value.slice(4);
    return mistakes.value.filter((m) => (m.category || m.knowledge_point || '') === cat);
  }
  // 全部：按错误次数降序（优先复习高频错题）
  return [...mistakes.value].sort(
    (a, b) => (b.wrongCount || b.wrong_count || 1) - (a.wrongCount || a.wrong_count || 1)
  );
});

// 错题分类列表（去重）
const mistakeCategories = computed(() => {
  const cats = new Set();
  mistakes.value.forEach((m) => {
    const cat = m.category || m.knowledge_point || '';
    if (cat) cats.add(cat);
  });
  return [...cats].sort();
});

// F007: 限制渲染到 DOM 的错题数量，防止无限滚动导致 DOM 过大
const displayedMistakes = computed(() => {
  return filteredReviewMistakes.value.slice(0, MAX_DOM_ITEMS);
});

// --- 方法 ---

// 统一错题字段名，消除 wrongCount/wrong_count 等不一致
function normalizeMistakes(list) {
  return normalizeFields(
    Array.isArray(list) ? list.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : []
  ).map((item) => ({
    ...item,
    showAnalysis: item.showAnalysis ?? false
  }));
}

// 下拉刷新
async function onPullRefresh() {
  isRefreshing.value = true;
  try {
    await loadData(true);
  } catch (_e) {
    /* 静默处理 */
  }
  isRefreshing.value = false;
}

// 触底加载更多
function loadMore() {
  const nextPage = currentPage.value + 1;
  logger.log(`[mistake-book] 📄 触底加载: page=${nextPage}, isLoading=${isLoading.value}, hasMore=${hasMore.value}`);
  if (isLoading.value || !hasMore.value) {
    logger.log(`[mistake-book] ⏸️ 分页加载被阻止 - isLoading: ${isLoading.value}, hasMore: ${hasMore.value}`);
    return;
  }
  currentPage.value = nextPage;
  logger.log(`[mistake-book] ➡️ 开始加载第 ${currentPage.value} 页（追加模式）`);
  loadData(false);
}

// 加载用户信息
function loadUserInfo() {
  userInfo.value = storageService.get('userInfo', { nickName: '考研人' });
}

// 自动同步待同步的错题
function confirmPendingSync() {
  if (isPendingSyncing.value) return;
  const owner = loadedOwnerId.value;
  const token = getToken() || '';
  if (owner !== (getUserId() || '')) return toast.info('账户已变化，请重新打开历史记录');
  const records = storageService.get('mistake_book', [], { migrateLegacy: false });
  const pending = records.filter((item) => ['pending', 'local_only'].includes(item?.sync_status));
  if (!pending.length) {
    syncFeedback.value = '暂无历史同步待办';
    return;
  }
  const snapshot = JSON.parse(JSON.stringify(pending));
  modal.show({
    title: '同步历史待办',
    content: `将当前账户已确认的 ${snapshot.length} 条历史原文发送至本项目后端。原参考仍待核对。`,
    success: (res) => {
      if (!res.confirm) return;
      if (owner !== (getUserId() || '') || token !== (getToken() || '')) return toast.info('账户已变化，请重新确认');
      syncPendingMistakes(snapshot, owner, token);
    }
  });
}
async function syncPendingMistakes(expectedRecords, owner, token) {
  if (isPendingSyncing.value) return;
  const generation = ++syncGeneration;
  const current = () => generation === syncGeneration && owner === (getUserId() || '') && token === (getToken() || '');
  isPendingSyncing.value = true;
  syncFeedback.value = '同步中…';
  toast.loading('同步中...');
  try {
    logger.log('[mistake-book] 开始自动同步待同步错题...');
    const result = await storageService.syncPendingMistakes({ expectedRecords });
    if (!current()) return;
    if (result.success === false) syncFeedback.value = result.error || '同步未确认，原待办保留';
    else if (result.synced > 0) {
      const remaining = (result.failed || 0) + (result.conflicts || 0);
      syncFeedback.value = remaining
        ? `已确认 ${result.synced} 条，还有 ${remaining} 条未完成。`
        : `已确认 ${result.synced} 条历史原件。`;
      await loadData(true);
    } else syncFeedback.value = '暂无历史同步待办';
  } catch (error) {
    logger.error('[mistake-book] 同步待同步错题异常:', error);
    if (current()) syncFeedback.value = '同步未确认，原待办保留';
  } finally {
    if (generation === syncGeneration) {
      toast.hide();
      isPendingSyncing.value = false;
      if (!current()) syncFeedback.value = '';
    }
  }
}

/**
 * 加载错题列表数据（支持分页和重置）
 * @param {boolean} [reset=false] - 是否重置到第一页重新加载
 */
async function loadData(reset = false) {
  const ownerId = getUserId() || '';
  learning.refresh();
  if (!showLegacy.value) {
    isInitLoading.value = false;
    return;
  }
  if (isLoading.value) {
    logger.log('[mistake-book] ⏸️ 加载中，跳过重复请求');
    return;
  }

  isLoading.value = true;
  logger.log(
    `[mistake-book] 开始加载数据 - reset: ${reset}, currentPage: ${currentPage.value}, pageSize: ${PAGE_SIZE}`
  );

  try {
    if (reset) {
      currentPage.value = 1;
      mistakes.value = [];
      logger.log('[mistake-book] 🔄 重置状态，从第1页开始加载');
    }

    logger.log(`[mistake-book] 📡 调用 storageService.getMistakes(${currentPage.value}, ${PAGE_SIZE})`);
    // 使用云端方法获取错题列表
    const result = await storageService.getMistakes(currentPage.value, PAGE_SIZE);
    if ((getUserId() || '') !== ownerId) return;
    loadedOwnerId.value = ownerId;
    logger.log('[mistake-book] ✅ 数据加载完成:', {
      count: result?.list?.length || 0,
      total: result?.total || 0,
      page: result?.page || currentPage.value,
      hasMore: result?.hasMore || false,
      source: result?.source || 'unknown'
    });

    if (result && result.list) {
      const normalizedList = normalizeMistakes(result.list);
      const beforeCount = mistakes.value.length;
      if (reset) {
        mistakes.value = normalizedList;
        logger.log(`[mistake-book] 重置模式：加载了 ${normalizedList.length} 条错题`);
      } else {
        // 追加数据（用于分页加载）
        mistakes.value = [...mistakes.value, ...normalizedList];
        logger.log(
          `[mistake-book] 追加模式：从 ${beforeCount} 条增加到 ${mistakes.value.length} 条（新增 ${normalizedList.length} 条）`
        );
      }

      // 如果本页返回空列表，强制终止分页，防止无限加载
      hasMore.value = normalizedList.length > 0 && (result.hasMore || false);
      logger.log(
        `[mistake-book] 当前状态 - 总错题数: ${mistakes.value.length}, hasMore: ${hasMore.value}, currentPage: ${currentPage.value}`
      );

      // 空状态检查
      if (mistakes.value.length === 0) {
        logger.log(`[mistake-book] 📭 空状态：错题列表为空，显示空状态UI`);
      }

      // 如果从云端获取，本地缓存已在 storageService.getMistakes 中更新（包含合并逻辑）
      if (result.source === 'cloud' && currentPage.value === 1) {
        logger.log('[mistake-book] ✅ 云端数据已加载并合并本地待同步数据');
      }
    } else {
      // 降级到本地读取
      mistakes.value = normalizeMistakes(storageService.get('mistake_book', []));
    }
  } catch (error) {
    if ((getUserId() || '') !== ownerId) return;
    loadedOwnerId.value = ownerId;
    logger.error('加载错题列表失败:', error);
    // 降级到本地读取
    mistakes.value = normalizeMistakes(storageService.get('mistake_book', []));
  } finally {
    isLoading.value = false;
    isInitLoading.value = false; // 隐藏骨架屏
    if (showLegacy.value && (getUserId() || '') !== ownerId) loadData(true);
  }
}

// 返回刷题页面
function goBack() {
  uni.switchTab({
    url: '/pages/practice/index',
    fail: () => {
      uni.reLaunch({ url: '/pages/practice/index' });
    }
  });
}

// ✅ P1 + 1.7: 开始顺序重练（使用筛选后的错题列表）
function startSequentialReview() {
  const source = isReviewMode.value ? filteredReviewMistakes.value : mistakes.value;
  if (source.length === 0) {
    toast.info('暂无错题');
    return;
  }

  const result = studyEngineStore.prepareLegacyReview({
    expectedOwnerId: loadedOwnerId.value,
    recordIds: source.map((item) => item.id ?? item._id).filter((id) => id !== undefined && id !== null),
    expectedQuestions: source
  });
  openLegacyReview(result);
}

function openLegacyReview(result) {
  if (!result.success) {
    toast.info(result.message || '这些旧条目暂不能重练，原记录已保留');
    return;
  }
  if (result.skipped || result.deferred) toast.info(`本次重练${result.count}条，其余原记录已保留`);
  safeNavigateTo(result.url);
}

// Only the explicitly reviewed loaded identities are removed.
function clearAllMistakes() {
  if (isClearing.value || !mistakes.value.length) return;
  const owner = loadedOwnerId.value,
    snapshot = JSON.stringify(mistakes.value);
  const ids = mistakes.value.map((row) => row.id ?? row._id);
  if (ids.some((id) => !['string', 'number'].includes(typeof id)) || new Set(ids.map(String)).size !== ids.length)
    return toast.info('存在缺失或重复编号，原记录保留，请重新加载');
  const current = () => owner === (getUserId() || '') && snapshot === JSON.stringify(mistakes.value);
  if (!current()) return toast.info('账户或列表已变化，请重新加载');
  modal.show({
    title: '移除已载入条目',
    content: `仅移除当前已载入的 ${ids.length} 条历史记录，其他条目保留。移除后无法恢复。`,
    confirmColor: 'var(--danger)',
    success: async (res) => {
      if (!res.confirm) return;
      if (!current()) return toast.info('账户或列表已变化，请重新确认');
      isClearing.value = true;
      try {
        const result = await storageService.batchRemoveMistakes(ids);
        if (!current()) return;
        if (!result.success) return toast.info(result.error || '移除未确认，原记录保留');
        const removed = new Set(ids.map(String));
        mistakes.value = mistakes.value.filter((row) => !removed.has(String(row.id ?? row._id)));
        toast.success(
          `已移除本次 ${ids.length} 条${result.source === 'local' ? '本机记录，云端结果未确认' : '历史记录'}`
        );
      } catch (_error) {
        toast.info('移除未确认，请重新加载原列表');
      } finally {
        isClearing.value = false;
      }
    }
  });
}

// 切换刷题/背诵模式
function switchMode(newMode) {
  mode.value = newMode;
}

// === 历史分组功能 ===

// 切换到聚类视图，首次切换时加载数据
async function switchToClusterView() {
  reviewFilter.value = 'cluster';
  if (errorClusters.value.length === 0) {
    await loadErrorClusters();
  }
}

// 只读整理当前账户的旧条目
async function loadErrorClusters() {
  clusterLoading.value = true;
  const ownerId = getUserId() || '';
  try {
    const result = await studyEngineStore.getErrorClusters();
    if ((getUserId() || '') !== ownerId) return;
    if (result?.data?.clusters) {
      clustersOwnerId.value = ownerId;
      errorClusters.value = result.data.clusters;
    }
  } catch (error) {
    logger.error('[mistake-book] 错题聚类加载失败:', error);
    toast.info('历史分组暂时不可用');
  } finally {
    clusterLoading.value = false;
  }
}

// 基于聚类结果筛选错题，跳转到针对训练
function startClusterTraining(cluster) {
  if (!cluster?.reviewableCount) return;
  openLegacyReview(
    studyEngineStore.prepareLegacyReview({ clusterId: cluster.clusterId, expectedOwnerId: clustersOwnerId.value })
  );
}

/** @param {number} index - 错题在列表中的索引 */
async function removeMistake(mistake) {
  if (!mistake) return;
  const ownerId = loadedOwnerId.value,
    id = mistake.id ?? mistake._id;
  const snapshot = JSON.stringify(mistake);
  const current = () =>
    (getUserId() || '') === ownerId &&
    mistakes.value.some((item) => (item.id ?? item._id) === id && JSON.stringify(item) === snapshot);
  if (
    !current() ||
    mistakes.value.filter((row) => String(row.id ?? row._id) === String(id)).length !== 1 ||
    !['string', 'number'].includes(typeof id)
  )
    return toast.info('条目或账户已变化，请重新加载');

  modal.show({
    title: '移除题目',
    content: '仅移除这条历史记录，学习掌握状态保持独立。移除后无法恢复。',
    confirmColor: 'var(--danger)',
    success: async (res) => {
      if (res.confirm) {
        if (!current()) return toast.info('条目或账户已变化，请重新确认');
        toast.loading('删除中...');

        try {
          // 使用云端方法删除
          const result = await storageService.removeMistake(id);
          if (!current()) return;

          if (result.success) {
            // 从列表中移除
            mistakes.value = mistakes.value.filter((item) => (item.id ?? item._id) !== id);
            logger.log(`[mistake-book] ✅ 删除成功，列表剩余 ${mistakes.value.length} 条错题`);
            toast.success('已移除');
          } else {
            // 保存失败不丢弃原记录或替换尚未加载的其他条目。
            logger.warn(`[mistake-book] 移除未确认: ${result.error}`);
            toast.info('移除未确认，原记录保留，请重新加载');
          }
        } catch (error) {
          logger.error('[mistake-book] 删除错题异常:', error);
          // 降级到本地删除
          mistakes.value.splice(index, 1);
          storageService.save('mistake_book', mistakes.value, true);
          toast.info('已移除（本地）');
        } finally {
          toast.hide();
        }
      }
    }
  });
}

// --- 生命周期钩子 ---

onLoad((options) => {
  studyEngineStore = useStudyEngineStore();
  statusBarHeight.value = getStatusBarHeight();
  capsuleSafeRight.value = getCapsuleSafeRight();

  // 初始化主题
  const savedTheme = storageService.get('theme_mode', 'light');
  isDark.value = savedTheme === 'dark';

  // F003: 存储回调引用，确保 $off 只移除自己的监听器
  _themeHandler = (themeMode) => {
    isDark.value = themeMode === 'dark';
  };
  uni.$on('themeUpdate', _themeHandler);

  // ✅ P1: 检查是否为重练模式
  if (options && options.mode === 'review') {
    mode.value = 'quiz';
    isReviewMode.value = true;
    logger.log('[mistake-book] 📝 进入错题重练模式');
  }
});

onShow(() => {
  learning.refresh();
  if (loadedOwnerId.value !== (getUserId() || '')) {
    mistakes.value = [];
    loadedOwnerId.value = null;
    errorClusters.value = [];
    clustersOwnerId.value = null;
  }
  if (!showLegacy.value) {
    isInitLoading.value = false;
    return;
  }
  loadData(true); // 重置并重新加载
  loadUserInfo();
});

onUnload(() => {
  // 移除事件监听
  uni.$off('themeUpdate', _themeHandler);
  resetPendingSync();
});
</script>

<style lang="scss" scoped>
.sync-feedback {
  margin: 12rpx 30rpx;
  color: var(--text-secondary);
  line-height: 1.5;
}
/* 统计卡片网格 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  /* gap: 24rpx; -- replaced for Android WebView compat */
  padding: 0 30rpx;
  margin-bottom: 30rpx;
}
.stats-grid > view:nth-child(even) {
  margin-left: 24rpx;
}
.stats-grid > view:nth-child(n + 3) {
  margin-top: 24rpx;
}

.container {
  min-height: 100%;
  min-height: 100vh;
  background: var(--background);
  position: relative;
  overflow: hidden;
}

.aurora-bg {
  position: absolute;
  top: 0;
  width: 100%;
  height: 500rpx;
  background: radial-gradient(circle at 18% 20%, rgba(255, 75, 75, 0.12) 0%, transparent 70%);
  filter: blur(80px);
  opacity: 0.8;
  z-index: 0;
}

.header-nav {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  background: var(--bg-glass);

  .nav-content {
    height: 50px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 30rpx;

    .nav-back {
      font-size: 36rpx;
      color: var(--text-primary);
      font-weight: bold;
    }

    .nav-title {
      font-size: 34rpx;
      font-weight: 600;
      color: var(--text-primary);
    }

    .nav-placeholder {
      width: 36rpx;
    }

    .nav-actions {
      display: flex;
      align-items: center;
    }

    .nav-clear-btn {
      display: flex;
      align-items: center;
      /* gap: 8rpx; -- replaced for Android WebView compat */
      padding: 8rpx 16rpx;
      border-radius: 20rpx;
      background: var(--danger-light);
      transition: all 0.2s;

      &:active {
        background: var(--danger-light);
        transform: scale(0.95);
      }

      .clear-icon {
        font-size: 28rpx;
      }

      .clear-text {
        font-size: 24rpx;
        color: var(--danger);
        font-weight: 500;
      }
    }
  }
}

.main-scroll {
  height: 100%;
  height: 100vh;
  padding: 30rpx;
  box-sizing: border-box;
  position: relative;
  z-index: 1;
}

.glass-card {
  background: var(--yozi-reading);

  border: 0;

  border-radius: 24px;
  padding: 30rpx;
  margin-bottom: 30rpx;

  box-shadow: var(--yozi-shadow);
}

.mode-switch {
  display: flex;
  padding: 10rpx;
  border-radius: 20rpx;
  /* gap: 10rpx; -- replaced for Android WebView compat */
  .mode-item {
    flex: 1;
    padding: 20rpx 40rpx;
    border-radius: 20rpx;
    font-size: 26rpx;
    text-align: center;
    transition: 0.3s;
    color: var(--text-sub);

    &.active {
      background: var(--cta-primary-bg);
      color: var(--cta-primary-text);
      border: 1rpx solid var(--cta-primary-border);
      font-weight: bold;
      box-shadow: var(--cta-primary-shadow);
    }
  }
}

.empty-box {
  text-align: center;
  padding-top: 150rpx;
  padding-bottom: 100rpx;

  .empty-icon {
    font-size: 160rpx;
    display: block;
    margin-bottom: 30rpx;
    animation: bounce 2s ease-in-out infinite;
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-20rpx);
    }
  }

  .empty-title {
    color: var(--text-primary);
    font-size: 40rpx;
    font-weight: 800;
    margin-bottom: 16rpx;
    display: block;
  }

  .empty-text {
    color: var(--text-secondary);
    font-size: 28rpx;
    margin-bottom: 16rpx;
    display: block;
  }

  .empty-hint {
    color: var(--text-secondary);
    font-size: 24rpx;
    opacity: 0.7;
    margin-bottom: 60rpx;
    display: block;
  }

  .go-practice-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* gap: 12rpx; -- replaced for Android WebView compat */
    padding: 24rpx 64rpx;
    background: var(--danger);
    color: var(--text-inverse);
    border-radius: 50rpx;
    font-weight: 700;
    font-size: 30rpx;
    border: none;
    box-shadow: 0 8rpx 0 #cc3333;
    transition: all 0.3s ease;
  }

  .go-practice-btn:active {
    transform: scale(0.95);
    opacity: 0.9;
  }
}

/* 重练模式横幅 */
.review-mode-banner {
  display: flex;
  align-items: center;
  /* gap: 20rpx; -- replaced for Android WebView compat */
  padding: 24rpx 30rpx;
  margin: 0 0 30rpx 0;
  background: var(--theme-primary-light);
  border: 1rpx solid var(--brand-glow);
  border-radius: 24rpx;

  .review-icon {
    font-size: 40rpx;
    flex-shrink: 0;
  }

  .review-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    /* gap: 6rpx; -- replaced for Android WebView compat */
  }

  .review-title {
    font-size: 28rpx;
    font-weight: 600;
    color: var(--text-primary, #333);
  }

  .review-desc {
    font-size: 24rpx;
    color: var(--text-sub, #999);
  }

  .start-review-btn {
    padding: 14rpx 32rpx;
    background: var(--cta-primary-bg);
    color: var(--cta-primary-text);
    border-radius: 20rpx;
    font-size: 26rpx;
    font-weight: 600;
    border: 1rpx solid var(--cta-primary-border);
    box-shadow: var(--cta-primary-shadow);
    flex-shrink: 0;

    &::after {
      border: none;
    }
  }
}

.fab-btn {
  position: fixed;
  bottom: 60rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 300rpx;
  height: 90rpx;
  background: var(--bg-card);
  color: var(--text-primary);
  border-radius: 45rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 10rpx; -- replaced for Android WebView compat */
  font-size: 28rpx;
  box-shadow: var(--shadow-lg);
  z-index: 99;
}

.safe-area {
  height: 200rpx;
}

/* 一键清空按钮区域（列表底部） */
.clear-all-section {
  padding: 40rpx 30rpx;
  display: flex;
  justify-content: center;
}

.clear-all-btn {
  width: 100%;
  max-width: 600rpx;
  height: 88rpx;
  padding: 0 32rpx;
  background: var(--danger-light);
  border: 2rpx solid var(--danger);
  border-radius: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  /* gap: 12rpx; -- replaced for Android WebView compat */
  transition: all 0.2s;
  box-shadow: var(--shadow-sm);
}

.clear-all-btn:active {
  background: var(--danger-light);
  transform: scale(0.98);
  box-shadow: var(--shadow-xs);
}

.clear-all-btn::after {
  border: none;
}

.clear-all-icon {
  font-size: 36rpx;
  line-height: var(--line-height-normal);
}

.clear-all-text {
  font-size: 30rpx;
  color: var(--danger);
  font-weight: 600;
  white-space: nowrap;
}

/* [AUDIT FIX R201] 移除20个冗余 .dark-mode 覆盖块 — 基础规则已使用 CSS 变量自动适配暗色模式 */

/* ✅ 1.7: 错题筛选栏 */
.review-filter-bar {
  padding: 0 30rpx;
  margin-bottom: 24rpx;
}

.filter-scroll {
  white-space: nowrap;
}

.filter-chip {
  display: inline-block;
  padding: 16rpx 28rpx;
  border-radius: 24rpx;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  transition: all 0.2s;
  margin-right: 12rpx;
}

.filter-chip.active {
  background: var(--danger);
  border-color: var(--danger);
}

.filter-chip.active .filter-text {
  color: var(--text-inverse);
}

.filter-text {
  font-size: 24rpx;
  font-weight: 600;
  color: var(--text-secondary);
}

/* [AUDIT FIX R201] 筛选栏 .dark-mode 块已移除 — var(--bg-card)/var(--border-light)/var(--text-sub) 已自动适配 */

/* === 历史分组视图 === */
.cluster-view {
  padding: 0 0 30rpx;
}

.cluster-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60rpx 0;
}

.cluster-loading .loading-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background: var(--color-primary, #0f5f34);
  margin-right: 8rpx;
  animation: clusterDotBounce 1.4s ease-in-out infinite;
}
.cluster-loading .loading-dot:nth-child(2) {
  animation-delay: 0.2s;
}
.cluster-loading .loading-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes clusterDotBounce {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1.2);
  }
}

.cluster-loading-text {
  font-size: 26rpx;
  color: var(--text-sub);
  margin-left: 12rpx;
}

.cluster-empty {
  text-align: center;
  padding: 60rpx 0;
}
.cluster-empty-text {
  font-size: 28rpx;
  color: var(--text-sub);
}

.cluster-card {
  margin-bottom: 24rpx;
}

.cluster-header {
  display: flex;
  align-items: center;
  margin-bottom: 16rpx;
}

.cluster-badge {
  padding: 4rpx 16rpx;
  border-radius: 16rpx;
  margin-right: 12rpx;
}
.cluster-badge.high {
  background: color-mix(in srgb, var(--danger) 15%, transparent); /* [AUDIT FIX R196] */
}
.cluster-badge.high .cluster-badge-text {
  color: var(--danger); /* [AUDIT FIX R196] */
}
.cluster-badge.medium {
  background: color-mix(in srgb, var(--warning) 15%, transparent); /* [AUDIT FIX R197] */
}
.cluster-badge.medium .cluster-badge-text {
  color: var(--warning); /* [AUDIT FIX R197] */
}
.cluster-badge.low {
  background: color-mix(in srgb, var(--text-tertiary) 15%, transparent); /* [AUDIT FIX R198] */
}
.cluster-badge.low .cluster-badge-text {
  color: var(--text-tertiary); /* [AUDIT FIX R198] */
}

.cluster-badge-text {
  font-size: 24rpx;
  font-weight: 600;
}

.cluster-type {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-primary);
  flex: 1;
}

.cluster-count {
  font-size: 24rpx;
  color: var(--text-secondary);
  font-weight: 600;
}

.cluster-kps {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 12rpx;
}

.kp-tag {
  font-size: 24rpx;
  padding: 4rpx 14rpx;
  border-radius: 12rpx;
  background: var(--bg-secondary, var(--muted));
  color: var(--text-sub);
  margin-right: 8rpx;
  margin-bottom: 8rpx;
}

.cluster-suggestion {
  font-size: 26rpx;
  color: var(--text-primary);
  line-height: 1.6;
  margin-bottom: 12rpx;
  display: block;
}

.cluster-trend {
  margin-bottom: 16rpx;
}
.trend-text {
  font-size: 24rpx;
}
.trend-text.increasing {
  color: var(--danger); /* [AUDIT FIX R199] */
}
.trend-text.decreasing {
  color: var(--success); /* [AUDIT FIX R199] */
}
.trend-text.stable {
  color: var(--text-tertiary); /* [AUDIT FIX R199] */
}

.train-btn {
  width: 100%;
  padding: 20rpx;
  border-radius: 24rpx;
  background: var(--danger);
  color: var(--text-inverse);
  font-size: 28rpx;
  font-weight: 700;
  border: none;
  box-shadow: 0 8rpx 0 #cc3333;
}
.train-btn::after {
  border: none;
}
.train-btn:active {
  opacity: 0.85;
  transform: scale(0.98);
}

.cluster-chip {
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--success) 10%, transparent),
    color-mix(in srgb, var(--info-blue) 10%, transparent)
  ) !important; /* [AUDIT FIX R200] */
  border-color: color-mix(in srgb, var(--success) 30%, transparent) !important; /* [AUDIT FIX R200] */
}

/* [AUDIT FIX R201] 聚类 .dark-mode 块已移除 — .cluster-card 继承 .glass-card var(--bg-card), .kp-tag 使用 var(--bg-secondary) */
</style>
