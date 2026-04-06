<template>
  <view :class="['qb-page', { 'dark-mode': isDark }]">
    <!-- 自定义导航栏 -->
    <view class="navbar">
      <view class="navbar-inner" :style="{ paddingTop: statusBarHeight + 'px' }">
        <view class="nav-back" @tap="goBack">
          <BaseIcon name="arrow-left" :size="32" />
        </view>
        <text class="nav-title">考研题库</text>
        <view class="nav-right" />
      </view>
    </view>

    <scroll-view
      class="scroll-body"
      scroll-y
      :style="{ paddingTop: statusBarHeight + 44 + 'px' }"
      @scrolltolower="loadMore"
    >
      <!-- 题库总览 -->
      <view class="stats-header">
        <text class="stats-total">共 {{ totalCount }} 题</text>
        <text class="stats-sub">按科目分类浏览，点击开始练习</text>
      </view>

      <!-- 分类卡片 -->
      <view v-if="!loading" class="category-list">
        <view
          v-for="cat in categories"
          :key="cat.category"
          class="cat-card"
          :class="{ active: selectedCategory === cat.category }"
          @tap="selectCategory(cat.category)"
        >
          <view class="cat-icon">
            <BaseIcon :name="categoryIcon(cat.category)" :size="36" />
          </view>
          <view class="cat-info">
            <text class="cat-name">{{ cat.category }}</text>
            <text class="cat-count">{{ cat.total }} 题</text>
          </view>
          <view class="cat-diff">
            <view class="diff-bar easy" :style="{ flex: cat.difficulty.easy || 0 }" />
            <view class="diff-bar medium" :style="{ flex: cat.difficulty.medium || 0 }" />
            <view class="diff-bar hard" :style="{ flex: cat.difficulty.hard || 0 }" />
          </view>
        </view>
      </view>

      <!-- 筛选栏 -->
      <view v-if="selectedCategory" class="filter-bar">
        <view class="filter-row">
          <view
            v-for="d in difficultyOptions"
            :key="d.value"
            class="filter-chip"
            :class="{ selected: selectedDifficulty === d.value }"
            @tap="
              selectedDifficulty = d.value;
              currentPage = 1;
              loadQuestions();
            "
          >
            <text>{{ d.label }}</text>
          </view>
        </view>
        <view class="filter-actions">
          <view class="action-btn primary" @tap="startPractice">
            <text>随机练习 {{ selectedCategory }}</text>
          </view>
        </view>
      </view>

      <!-- 题目列表 -->
      <view v-if="selectedCategory && questionList.length > 0" class="question-list">
        <view v-for="(q, idx) in questionList" :key="q._id" class="q-item">
          <view class="q-header">
            <text class="q-index">#{{ (currentPage - 1) * pageSize + idx + 1 }}</text>
            <view class="q-tags">
              <text class="q-diff" :class="q.difficulty">{{ diffLabel(q.difficulty) }}</text>
              <text v-if="q.source" class="q-source">{{ q.source }}</text>
              <text v-if="q.year" class="q-year">{{ q.year }}年</text>
            </view>
          </view>
          <text class="q-content">{{ q.question || q.content }}</text>
          <view class="q-options">
            <text v-for="(opt, oi) in q.options || []" :key="oi" class="q-opt">
              {{ String.fromCharCode(65 + oi) }}. {{ opt }}
            </text>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="selectedCategory && !loading && questionList.length === 0" class="empty-state">
        <!-- 搜索无结果插图 -->
        <image class="empty-illustration" src="/static/illustrations/empty-search.png" mode="aspectFit" lazy-load />
        <text class="empty-text">该分类暂无题目</text>
        <text class="empty-sub">可通过"资料导入"或管理后台添加题目</text>
      </view>

      <!-- 加载状态 -->
      <view v-if="loading" class="loading-state">
        <text>加载中...</text>
      </view>

      <view class="bottom-spacer" />
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { useReviewStore } from '@/stores/modules/review.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import storageService from '@/services/storageService.js';
import { toast } from '@/utils/toast.js';

// 暗色模式
const isDark = ref(storageService.get('theme_mode', 'light') === 'dark');
const _themeHandler = (mode) => {
  isDark.value = mode === 'dark';
};
uni.$on('themeUpdate', _themeHandler);
onBeforeUnmount(() => {
  uni.$off('themeUpdate', _themeHandler);
});

const reviewStore = useReviewStore();

const statusBarHeight = ref(getStatusBarHeight());
const loading = ref(false);
const totalCount = ref(0);
const categories = ref([]);
const selectedCategory = ref('');
const selectedDifficulty = ref('');
const questionList = ref([]);
const currentPage = ref(1);
const pageSize = 20;
const hasMore = ref(false);

const difficultyOptions = [
  { label: '全部', value: '' },
  { label: '简单', value: 'easy' },
  { label: '中等', value: 'medium' },
  { label: '困难', value: 'hard' }
];

// 分类图标映射（BaseIcon SVG 名称）
const CATEGORY_ICONS = {
  政治: 'shield',
  英语: 'globe',
  数学: 'formula',
  专业课: 'notebook',
  综合: 'books'
};

function categoryIcon(cat) {
  return CATEGORY_ICONS[cat] || 'book';
}

function diffLabel(d) {
  return { easy: '简单', medium: '中等', hard: '困难' }[d] || '中等';
}

function goBack() {
  safeNavigateBack();
}

async function loadStats() {
  loading.value = true;
  try {
    const res = await reviewStore.fetchQuestionBankStats();
    if (res?.success && res.data) {
      categories.value = res.data.categories || [];
      totalCount.value = res.data.total || 0;
    }
  } catch (_e) {
    toast.error('题库加载失败，请检查网络');
  }
  loading.value = false;
}

function selectCategory(cat) {
  if (selectedCategory.value === cat) {
    selectedCategory.value = '';
    questionList.value = [];
    return;
  }
  selectedCategory.value = cat;
  selectedDifficulty.value = '';
  currentPage.value = 1;
  loadQuestions();
}

async function loadQuestions() {
  loading.value = true;
  try {
    const params = {
      category: selectedCategory.value,
      page: currentPage.value,
      pageSize
    };
    if (selectedDifficulty.value) params.difficulty = selectedDifficulty.value;

    const res = await reviewStore.browseQuestions(params);
    if (res?.success && res.data) {
      if (currentPage.value === 1) {
        questionList.value = res.data.list || [];
      } else {
        questionList.value = [...questionList.value, ...(res.data.list || [])];
      }
      hasMore.value = res.data.hasMore || false;
    }
  } catch (_e) {
    toast.error('题目加载失败，请检查网络');
  }
  loading.value = false;
}

function loadMore() {
  if (!hasMore.value || loading.value) return;
  currentPage.value++;
  loadQuestions();
}

async function startPractice() {
  loading.value = true;
  try {
    const params = { category: selectedCategory.value, count: 10 };
    if (selectedDifficulty.value) params.difficulty = selectedDifficulty.value;

    const res = await reviewStore.fetchQuestionBankRandom(params);
    if (res?.success && res.data && res.data.length > 0) {
      // 将题目格式化为 v30_bank 兼容格式并存入临时练习
      const formatted = res.data.map((q, i) => ({
        id: q._id || `qb_${i}`,
        question: q.question || q.content || '',
        options: q.options || [],
        answer: q.answer || 'A',
        desc: q.analysis || '',
        category: q.category || selectedCategory.value,
        type: q.type || '单选',
        difficulty: q.difficulty || 'medium',
        source: q.source || '题库',
        _fromBank: true
      }));

      // 存入临时练习题目
      storageService.save('v30_temp_practice', formatted);

      uni.navigateTo({
        url: '/pages/practice-sub/do-quiz?source=question-bank&mode=normal'
      });
    } else {
      toast.info('该分类暂无题目');
    }
  } catch (_e) {
    toast.info('加载失败，请重试');
  }
  loading.value = false;
}

onMounted(() => {
  loadStats();
});
</script>

<style scoped>
.qb-page {
  min-height: 100vh;
  background: var(--background);
}
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  backdrop-filter: blur(40rpx);
  -webkit-backdrop-filter: blur(40rpx);
  background: var(--bg-card);
  border-bottom: 2rpx solid rgba(0, 0, 0, 0.04);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.navbar-inner {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 16px;
}
.nav-back {
  width: 40px;
  font-size: 20px;
  color: var(--text-primary);
}
.nav-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.nav-right {
  width: 40px;
}

.scroll-body {
  min-height: 100vh;
}
.stats-header {
  padding: 24rpx 32rpx 16rpx;
}
.stats-total {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.stats-sub {
  display: block;
  font-size: 24rpx;
  color: var(--text-secondary);
  margin-top: 8rpx;
}

.category-list {
  padding: 0 24rpx;
}
.cat-card {
  display: flex;
  align-items: center;
  /* gap: 20rpx; -- replaced for Android WebView compat */
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 24rpx;
  padding: 28rpx 24rpx;
  margin-bottom: 16rpx;
  transition: all 0.25s ease;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.cat-card > view + view {
  margin-left: 20rpx;
}
.cat-card.active {
  background: var(--info);
  border-color: transparent;
  box-shadow: 0 8rpx 0 #0e8ac0;
}
.cat-card.active:active {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 #0e8ac0;
}
.cat-card.active .cat-name,
.cat-card.active .cat-count {
  color: var(--text-inverse);
}
.cat-card.active .cat-icon {
  background: rgba(255, 255, 255, 0.2);
  color: var(--text-inverse);
}
.cat-card.active .cat-name,
.cat-card.active .cat-count {
  color: var(--text-inverse, #fff);
}
.cat-card.active .cat-icon {
  background: rgba(255, 255, 255, 0.2);
  color: var(--text-inverse, #fff);
}
.cat-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 20rpx;
  background: rgba(28, 176, 246, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--info);
  transition: all 0.25s ease;
}
.cat-info {
  flex: 1;
}
.cat-name {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-primary);
}
.cat-count {
  display: block;
  font-size: 22rpx;
  color: var(--text-secondary);
  margin-top: 4rpx;
}
.cat-diff {
  display: flex;
  width: 80rpx;
  height: 8rpx;
  border-radius: 4rpx;
  overflow: hidden;
  /* gap: 2rpx; -- replaced for Android WebView compat */
}
.cat-diff > view + view {
  margin-left: 2rpx;
}
.diff-bar {
  height: 100%;
  border-radius: 4rpx;
  min-width: 2rpx;
}
.diff-bar.easy {
  background: var(--success);
}
.diff-bar.medium {
  background: var(--warning, #fbbf24);
}
.diff-bar.hard {
  background: var(--danger, #f87171);
}

.filter-bar {
  padding: 16rpx 24rpx;
}
.filter-row {
  display: flex;
  /* gap: 16rpx; -- replaced for Android WebView compat */
  margin-bottom: 16rpx;
  flex-wrap: wrap;
}
.filter-row > view {
  margin-right: 16rpx;
  margin-bottom: 8rpx;
}
.filter-chip {
  padding: 12rpx 32rpx;
  border-radius: 32rpx;
  font-size: 24rpx;
  background: var(--bg-card);
  color: var(--text-secondary);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  transition: all 0.2s ease;
}
.filter-chip.selected {
  background: var(--info);
  color: var(--text-inverse);
  border-color: var(--info);
  box-shadow: 0 4rpx 16rpx rgba(28, 176, 246, 0.25);
}
.filter-actions {
  margin-top: 8rpx;
}
.action-btn {
  text-align: center;
  padding: 22rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: 600;
  transition: all 0.2s ease;
}
.action-btn.primary {
  background: var(--info);
  color: var(--text-inverse);
  box-shadow: 0 8rpx 0 #0e8ac0;
}
.action-btn.primary:active {
  transform: translateY(4rpx);
  box-shadow: 0 4rpx 0 #0e8ac0;
}

.question-list {
  padding: 0 24rpx;
}
.q-item {
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  border-radius: 24rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.q-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.q-index {
  font-size: 22rpx;
  color: var(--text-secondary);
  font-weight: 600;
}
.q-tags {
  display: flex;
  /* gap: 8rpx; -- replaced for Android WebView compat */
}
.q-tags > text + text {
  margin-left: 8rpx;
}
.q-diff {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
  font-weight: 500;
}
.q-diff.easy {
  background: color-mix(in srgb, var(--success) 12%, transparent);
  color: var(--success);
}
.q-diff.medium {
  background: color-mix(in srgb, var(--warning, #fbbf24) 12%, transparent);
  color: var(--warning, #d97706);
}
.q-diff.hard {
  background: color-mix(in srgb, var(--danger, #f87171) 12%, transparent);
  color: var(--danger, #dc2626);
}
.q-source,
.q-year {
  font-size: 20rpx;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 4rpx 12rpx;
  border-radius: 12rpx;
}
.q-content {
  font-size: 28rpx;
  color: var(--text-primary);
  line-height: 1.6;
  margin-bottom: 16rpx;
}
.q-options {
  display: flex;
  flex-direction: column;
  /* gap: 8rpx; -- replaced for Android WebView compat */
}
.q-options > text + text {
  margin-top: 8rpx;
}
.q-opt {
  font-size: 26rpx;
  color: var(--text-secondary);
  line-height: 1.5;
  padding: 8rpx 0;
}

.empty-state {
  text-align: center;
  padding: 80rpx 0;
}
/* 空状态插图 */
.empty-illustration {
  width: 320rpx;
  height: 260rpx;
  margin: 0 auto 24rpx;
  display: block;
}
.empty-text {
  font-size: 30rpx;
  color: var(--text-secondary);
}
.empty-sub {
  display: block;
  font-size: 24rpx;
  color: var(--text-tertiary);
  margin-top: 12rpx;
}
.loading-state {
  text-align: center;
  padding: 40rpx;
  color: var(--text-secondary);
  font-size: 26rpx;
}
.bottom-spacer {
  height: 120rpx;
}

/* 暗色模式 */
.dark-mode {
  background: linear-gradient(
    180deg,
    var(--page-gradient-top, #0b0b0f) 0%,
    var(--page-gradient-mid, #0b0b0f) 52%,
    var(--page-gradient-bottom, #0b0b0f) 100%
  );
  color: var(--text-primary, #f5f5f7);
}
.dark-mode .navbar {
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(40rpx);
  -webkit-backdrop-filter: blur(40rpx);
}
.dark-mode .nav-title,
.dark-mode .nav-back {
  color: var(--text-primary, #f5f5f7);
}
.dark-mode .cat-card {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}
.dark-mode .cat-icon {
  background: rgba(255, 255, 255, 0.06);
}
.dark-mode .cat-card.active {
  background: linear-gradient(135deg, var(--primary, #4a90e2), var(--primary-light, #6ba3eb));
}
.dark-mode .filter-chip {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary, #8e8e93);
  border-color: rgba(255, 255, 255, 0.08);
}
.dark-mode .filter-chip.selected {
  background: var(--primary, #4a90e2);
  color: var(--text-inverse);
  border-color: var(--primary, #4a90e2);
}
.dark-mode .q-item {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}
.dark-mode .action-btn.primary {
  background: linear-gradient(135deg, var(--primary, #4a90e2), var(--primary-light, #6ba3eb));
}
</style>
