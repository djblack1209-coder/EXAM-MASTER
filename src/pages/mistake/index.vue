<template>
  <LearningShell v-if="!showLegacy" class="yozi-page" active="mistake" :title="$t('pages.mistake')">
    <LearningOverview :initial-expanded="true" :show-navigation="false" view="mistake" />
    <view class="legacy-entry">
      <BaseButton class="quiet-button" variant="secondary" @tap="toggleLegacy">{{ t('mistake.copy0') }}</BaseButton>
    </view>
  </LearningShell>
  <view v-else class="yozi-page" :class="['container', { 'dark-mode': isDark, 'theme-light': !isDark }]">
    <view class="aurora-bg" />

    <!-- 骨架屏 -->
    <BaseEmpty v-if="isInitLoading" :is-dark="isDark" state="loading" />

    <!-- 导航栏 - 添加设计系统工具类 -->
    <view v-if="!isInitLoading" class="header-nav" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content ds-flex ds-flex-between" :style="{ paddingRight: capsuleSafeRight + 'px' }">
        <BaseButton class="nav-back" :label="$t('ui.back')" variant="secondary" @tap="goBack"
          ><BaseIcon name="arrow-left"
        /></BaseButton>
        <text class="nav-title ds-text-lg ds-font-semibold">{{ $t('pages.mistake') }}</text>
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
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @scrolltolower="loadMore"
      @refresherrefresh="onPullRefresh"
    >
      <LearningOverview :initial-expanded="true" />
      <BaseButton class="quiet-button" variant="secondary" @tap="toggleLegacy">{{
        showLegacy ? t('mistake.copy1') : t('mistake.copy0')
      }}</BaseButton>
      <BaseButton
        :disabled="isPendingSyncing"
        :aria-busy="isPendingSyncing"
        variant="secondary"
        @tap="confirmPendingSync"
        >{{ t('mistake.copy2') }}</BaseButton
      >
      <view v-if="syncFeedback" role="status" aria-live="polite" data-test="legacy-sync-feedback" class="sync-feedback">
        {{ syncFeedback }}
      </view>
      <template v-if="showLegacy">
        <!-- 统计卡片区域 -->
        <view v-if="mistakes.length > 0" class="stats-grid">
          <StatsCard :title="t('mistake.copy3')" :value="mistakes.length" icon="note" :is-dark="isDark" />
          <StatsCard
            :title="t('mistake.copy4')"
            :value="pendingReviewCount"
            icon="refresh"
            :change="t('mistake.copy5')"
            change-type="neutral"
            :is-dark="isDark"
          />
        </view>

        <!-- ✅ P1: 重练模式提示 -->
        <view v-if="isReviewMode && mistakes.length > 0" class="review-mode-banner yozi-icon-row">
          <BaseIcon name="refresh" class="review-icon" />
          <view class="review-info">
            <text class="review-title">{{ t('mistake.copy6') }}</text>
            <text class="review-desc"> {{ t('mistake.copy7', { v0: filteredReviewMistakes.length }) }}</text>
          </view>
          <BaseButton class="start-review-btn" variant="primary" @tap="startSequentialReview">{{
            t('mistake.copy8')
          }}</BaseButton>
        </view>

        <!-- 错题筛选栏 -->
        <view v-if="mistakes.length > 0" class="review-filter-bar">
          <scroll-view scroll-x :show-scrollbar="false" class="filter-scroll">
            <BaseChip :model-value="reviewFilter === 'all'" @update:model-value="reviewFilter = 'all'"
              ><text class="filter-text">{{ t('mistake.copy9') }}</text></BaseChip
            >
            <BaseChip :model-value="reviewFilter === 'high_freq'" @update:model-value="reviewFilter = 'high_freq'"
              ><text class="filter-text">{{ t('mistake.copy10') }}</text></BaseChip
            >
            <BaseChip :model-value="reviewFilter === 'recent'" @update:model-value="reviewFilter = 'recent'"
              ><text class="filter-text">{{ t('mistake.copy11') }}</text></BaseChip
            >
            <BaseChip :model-value="reviewFilter === 'cluster'" @update:model-value="switchToClusterView"
              ><text class="filter-text">{{ t('mistake.copy12') }}</text></BaseChip
            >
            <BaseChip
              v-for="cat in mistakeCategories"
              :key="cat"
              :model-value="reviewFilter === 'cat_' + cat"
              @update:model-value="reviewFilter = 'cat_' + cat"
              ><text class="filter-text"> {{ cat }} </text></BaseChip
            >
          </scroll-view>
        </view>

        <!-- 模式切换 - 优化布局 -->
        <BaseSegmented
          v-if="mistakes.length > 0"
          :model-value="mode"
          :options="[
            { value: 'quiz', label: t('mistake.copy13') },
            { value: 'recite', label: t('mistake.copy14') }
          ]"
          :label="t('pages.mistake')"
          @update:model-value="switchMode"
        />

        <!-- 空状态 - 优化样式 -->
        <BaseEmpty
          v-if="mistakes.length === 0 && !isInitLoading"
          state="empty"
          :title="t('mistake.copy15')"
          show-button
          :button-text="t('pages.practice')"
          @action="goBack"
        />

        <!-- 历史分组视图（AI 分析模式） -->
        <view v-if="reviewFilter === 'cluster'" class="cluster-view">
          <BaseEmpty v-if="clusterLoading" state="loading" :title="t('mistake.copy16')" />
          <BaseEmpty v-else-if="errorClusters.length === 0" state="empty" :title="t('mistake.copy17')" />
          <view v-else>
            <view v-for="cluster in errorClusters" :key="cluster.clusterId" class="cluster-card glass-card">
              <view class="cluster-header">
                <view class="cluster-badge" :class="[cluster.countBand]">
                  <text class="cluster-badge-text">{{ t('mistake.copy18') }}</text>
                </view>
                <text class="cluster-type">{{ uiText(cluster.errorTypeName) }}</text>
                <text class="cluster-count">{{
                  t('mistake.copy19', { v0: cluster.questionCount, v1: cluster.reviewableCount })
                }}</text>
              </view>
              <view v-if="cluster.knowledgePoints && cluster.knowledgePoints.length > 0" class="cluster-kps">
                <text v-for="kp in cluster.knowledgePoints" :key="kp" class="kp-tag">{{ kp }}</text>
              </view>
              <BaseButton
                class="train-btn"
                :disabled="!cluster.reviewableCount"
                variant="primary"
                @tap="startClusterTraining(cluster)"
                >{{
                  t('mistake.copy20', {
                    v0:
                      cluster.knowledgePoints && cluster.knowledgePoints[0]
                        ? cluster.knowledgePoints[0]
                        : cluster.errorTypeName
                  })
                }}</BaseButton
              >
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
          <BaseButton
            class="clear-all-btn"
            :disabled="isClearing"
            variant="danger"
            danger-secondary
            @tap="clearAllMistakes"
            ><BaseIcon name="delete" class="clear-all-icon" /><text class="clear-all-text ds-text-sm ds-font-semibold">
              {{ isClearing ? t('mistake.copy21') : t('mistake.copy22') }}
            </text></BaseButton
          >
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
  <CustomModal
    v-if="pageDialog"
    :visible="true"
    :title="pageDialog.title"
    :content="pageDialog.content"
    :editable="pageDialog.editable"
    :placeholder-text="pageDialog.placeholderText"
    :confirm-text="pageDialog.confirmText"
    :cancel-text="pageDialog.cancelText"
    :show-cancel="pageDialog.showCancel !== false"
    :type="pageDialog.confirmColor ? 'error' : 'info'"
    escape-closable
    @confirm="settleDialog(true, $event)"
    @cancel="settleDialog(false)"
  />
</template>

<script setup>
import CustomModal from '@/components/common/CustomModal.vue';
const uiText = (value) => translateRegisteredText('mistake', value);
import '@/pages/mistake/messages.js';
import { t, translateRegisteredText } from '@/i18n/index.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import BaseSegmented from '@/components/base/base-segmented/base-segmented.vue';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import '@/styles/yozi-pages.scss';

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
import { usePageDialog } from '@/composables/usePageDialog.js';
const { pageDialog, settleDialog, modal } = usePageDialog();
import { toast } from '@/utils/toast.js';
import { storageService } from '@/services/storageService.js';
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
const isDark = computed(() => useThemeStore().isDark);
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
  userInfo.value = storageService.get('userInfo', { nickName: t('mistake.examUser') });
}

// 自动同步待同步的错题
function confirmPendingSync() {
  if (isPendingSyncing.value) return;
  const owner = loadedOwnerId.value;
  const token = getToken() || '';
  if (owner !== (getUserId() || '')) return toast.info(t('mistake.copy23'));
  const records = storageService.get('mistake_book', [], { migrateLegacy: false });
  const pending = records.filter((item) => ['pending', 'local_only'].includes(item?.sync_status));
  if (!pending.length) {
    syncFeedback.value = t('mistake.noSync');
    return;
  }
  const snapshot = JSON.parse(JSON.stringify(pending));
  modal.show({
    title: t('mistake.copy2'),
    content: t('mistake.copy24', { v0: snapshot.length }),
    success: (res) => {
      if (!res.confirm) return;
      if (owner !== (getUserId() || '') || token !== (getToken() || '')) return toast.info(t('mistake.copy25'));
      syncPendingMistakes(snapshot, owner, token);
    }
  });
}
async function syncPendingMistakes(expectedRecords, owner, token) {
  if (isPendingSyncing.value) return;
  const generation = ++syncGeneration;
  const current = () => generation === syncGeneration && owner === (getUserId() || '') && token === (getToken() || '');
  isPendingSyncing.value = true;
  syncFeedback.value = t('mistake.syncing');
  toast.loading(t('mistake.copy26'));
  try {
    logger.log('[mistake-book] 开始自动同步待同步错题...');
    const result = await storageService.syncPendingMistakes({ expectedRecords });
    if (!current()) return;
    if (result.success === false) syncFeedback.value = result.error || t('mistake.unconfirmed');
    else if (result.synced > 0) {
      const remaining = (result.failed || 0) + (result.conflicts || 0);
      syncFeedback.value = remaining
        ? t('mistake.syncPartial', { done: result.synced, remaining })
        : t('mistake.syncDone', { done: result.synced });
      await loadData(true);
    } else syncFeedback.value = t('mistake.noSync');
  } catch (error) {
    logger.error('[mistake-book] 同步待同步错题异常:', error);
    if (current()) syncFeedback.value = t('mistake.unconfirmed');
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
    toast.info(t('mistake.copy27'));
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
    toast.info(result.message || t('mistake.copy28'));
    return;
  }
  if (result.skipped || result.deferred) toast.info(t('mistake.copy29', { v0: result.count }));
  safeNavigateTo(result.url);
}

// Only the explicitly reviewed loaded identities are removed.
function clearAllMistakes() {
  if (isClearing.value || !mistakes.value.length) return;
  const owner = loadedOwnerId.value,
    snapshot = JSON.stringify(mistakes.value);
  const ids = mistakes.value.map((row) => row.id ?? row._id);
  if (ids.some((id) => !['string', 'number'].includes(typeof id)) || new Set(ids.map(String)).size !== ids.length)
    return toast.info(t('mistake.copy30'));
  const current = () => owner === (getUserId() || '') && snapshot === JSON.stringify(mistakes.value);
  if (!current()) return toast.info(t('mistake.copy31'));
  modal.show({
    title: t('mistake.copy22'),
    content: t('mistake.copy32', { v0: ids.length }),
    confirmColor: 'var(--danger)',
    success: async (res) => {
      if (!res.confirm) return;
      if (!current()) return toast.info(t('mistake.copy33'));
      isClearing.value = true;
      try {
        const result = await storageService.batchRemoveMistakes(ids);
        if (!current()) return;
        if (!result.success) return toast.info(result.error || t('mistake.copy34'));
        const removed = new Set(ids.map(String));
        mistakes.value = mistakes.value.filter((row) => !removed.has(String(row.id ?? row._id)));
        toast.success(
          t('mistake.copy35', {
            v0: ids.length,
            v1: result.source === 'local' ? t('mistake.copy36') : t('mistake.copy37')
          })
        );
      } catch (_error) {
        toast.info(t('mistake.copy38'));
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
    toast.info(t('mistake.copy39'));
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
    return toast.info(t('mistake.copy40'));

  modal.show({
    title: t('mistake.copy41'),
    content: t('mistake.copy42'),
    confirmColor: 'var(--danger)',
    success: async (res) => {
      if (res.confirm) {
        if (!current()) return toast.info(t('mistake.copy43'));
        toast.loading(t('mistake.copy44'));

        try {
          // 使用云端方法删除
          const result = await storageService.removeMistake(id);
          if (!current()) return;

          if (result.success) {
            // 从列表中移除
            mistakes.value = mistakes.value.filter((item) => (item.id ?? item._id) !== id);
            logger.log(`[mistake-book] ✅ 删除成功，列表剩余 ${mistakes.value.length} 条错题`);
            toast.success(t('mistake.copy45'));
          } else {
            // 保存失败不丢弃原记录或替换尚未加载的其他条目。
            logger.warn(`[mistake-book] 移除未确认: ${result.error}`);
            toast.info(t('mistake.copy46'));
          }
        } catch (error) {
          logger.error('[mistake-book] 删除错题异常:', error);
          // 降级到本地删除
          mistakes.value.splice(index, 1);
          storageService.save('mistake_book', mistakes.value, true);
          toast.info(t('mistake.copy47'));
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

  void 0;

  // F003: 存储回调引用，确保 $off 只移除自己的监听器
  _themeHandler = (_themeMode) => {
    void 0;
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
