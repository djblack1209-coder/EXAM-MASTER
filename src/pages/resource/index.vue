<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <view class="aurora-bg" />

    <!-- 导航栏 -->
    <view class="header-nav apple-glass" :style="{ paddingTop: statusBarHeight + 'px' }">
      <view class="nav-content">
        <view class="nav-back" @tap="goBack"><BaseIcon name="arrow-left" :size="32" /></view>
        <text class="nav-title">学习资源</text>
        <view class="nav-placeholder" />
      </view>
    </view>

    <!-- 加载骨架屏 -->
    <view v-if="isLoading" class="loading-state" :style="{ paddingTop: statusBarHeight + 60 + 'px' }">
      <view class="skeleton-list">
        <view class="skeleton-search" />
        <view v-for="i in 5" :key="i" class="skeleton-card apple-glass-card">
          <view class="skeleton-line skeleton-title" />
          <view class="skeleton-line skeleton-desc" />
          <view class="skeleton-line skeleton-short" />
        </view>
      </view>
    </view>

    <scroll-view
      v-if="!isLoading"
      scroll-y
      class="main-scroll"
      :style="{ paddingTop: statusBarHeight + 50 + 'px' }"
      refresher-enabled
      :refresher-triggered="isRefreshing"
      @refresherrefresh="onPullRefresh"
      @scrolltolower="loadMore"
    >
      <!-- 搜索栏 -->
      <view class="search-bar apple-glass-card">
        <BaseIcon name="search" :size="28" class="search-icon" />
        <input
          v-model="searchText"
          class="search-input"
          placeholder="搜索资源..."
          confirm-type="search"
          @confirm="handleSearch"
          @input="onSearchInput"
        />
        <view v-if="searchText" class="search-clear" @tap="clearSearch">
          <BaseIcon name="close" :size="22" />
        </view>
      </view>

      <!-- 非搜索模式 -->
      <view v-if="!isSearching">
        <!-- 分类筛选 -->
        <scroll-view scroll-x class="category-scroll" :show-scrollbar="false">
          <view class="category-tabs">
            <view
              v-for="cat in categoryList"
              :key="cat.key"
              :class="['cat-tab', { active: activeCategory === cat.key }]"
              @tap="selectCategory(cat.key)"
            >
              <text class="cat-tab-text">{{ cat.label }}</text>
            </view>
          </view>
        </scroll-view>

        <!-- 学科筛选 -->
        <view class="subject-pills">
          <view
            v-for="sub in subjectList"
            :key="sub.key"
            :class="['subject-pill', { active: activeSubject === sub.key }]"
            @tap="selectSubject(sub.key)"
          >
            <text class="subject-pill-text">{{ sub.label }}</text>
          </view>
        </view>

        <!-- 推荐资源 -->
        <view v-if="recommendations.length > 0" class="section-block">
          <view class="section-header">
            <text class="section-title">推荐</text>
            <text class="section-action" @tap="viewMoreRecommend">查看更多</text>
          </view>
          <view class="resource-cards">
            <view
              v-for="item in recommendations.slice(0, 4)"
              :key="item._id || item.id"
              class="resource-card apple-group-card"
              @tap="handleResourceTap(item)"
            >
              <view class="card-top-row">
                <view class="category-badge" :style="{ background: getCategoryColor(item.category) }">
                  <text class="category-badge-text">{{ getCategoryLabel(item.category) }}</text>
                </view>
                <view v-if="item.subject" class="subject-tag">
                  <text class="subject-tag-text">{{ item.subject }}</text>
                </view>
              </view>
              <text class="card-title">{{ item.title || '未命名资源' }}</text>
              <text v-if="item.description" class="card-desc">{{ item.description }}</text>
              <view class="card-bottom-row">
                <view class="view-count">
                  <BaseIcon name="eye" :size="22" />
                  <text class="view-count-text">{{ formatCount(item.view_count || 0) }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 热门资源 -->
        <view v-if="hotResources.length > 0" class="section-block">
          <view class="section-header">
            <text class="section-title">热门</text>
          </view>
          <view class="hot-list">
            <view
              v-for="(item, idx) in hotResources.slice(0, 10)"
              :key="item._id || item.id"
              class="hot-item apple-glass-card"
              @tap="handleResourceTap(item)"
            >
              <view :class="['rank-badge', getRankClass(idx)]">
                <text class="rank-text">{{ idx + 1 }}</text>
              </view>
              <view class="hot-info">
                <text class="hot-title">{{ item.title || '未命名资源' }}</text>
                <view class="hot-meta">
                  <view class="category-badge-sm" :style="{ background: getCategoryColor(item.category) }">
                    <text class="category-badge-sm-text">{{ getCategoryLabel(item.category) }}</text>
                  </view>
                  <text class="hot-views">{{ formatCount(item.view_count || 0) }} 次浏览</text>
                </view>
              </view>
              <BaseIcon name="chevron-right" :size="24" class="hot-arrow" />
            </view>
          </view>
        </view>

        <!-- 分类浏览结果 -->
        <view v-if="activeCategory !== 'all' || activeSubject !== 'all'" class="section-block">
          <view class="section-header">
            <text class="section-title">筛选结果</text>
            <text class="section-count">{{ categoryResources.length }} 项</text>
          </view>
          <view v-if="categoryResources.length > 0" class="resource-cards">
            <view
              v-for="item in categoryResources"
              :key="item._id || item.id"
              class="resource-card apple-group-card"
              @tap="handleResourceTap(item)"
            >
              <view class="card-top-row">
                <view class="category-badge" :style="{ background: getCategoryColor(item.category) }">
                  <text class="category-badge-text">{{ getCategoryLabel(item.category) }}</text>
                </view>
                <view v-if="item.subject" class="subject-tag">
                  <text class="subject-tag-text">{{ item.subject }}</text>
                </view>
              </view>
              <text class="card-title">{{ item.title || '未命名资源' }}</text>
              <text v-if="item.description" class="card-desc">{{ item.description }}</text>
              <view class="card-bottom-row">
                <view class="view-count">
                  <BaseIcon name="eye" :size="22" />
                  <text class="view-count-text">{{ formatCount(item.view_count || 0) }}</text>
                </view>
              </view>
            </view>
          </view>
          <view v-else class="empty-box">
            <BaseIcon name="folder-open" :size="64" class="empty-icon" />
            <text class="empty-title">暂无相关资源</text>
            <text class="empty-text">试试切换其他分类或学科</text>
          </view>
        </view>

        <!-- 全部都为空的状态 -->
        <view
          v-if="
            recommendations.length === 0 &&
            hotResources.length === 0 &&
            activeCategory === 'all' &&
            activeSubject === 'all'
          "
          class="empty-box"
        >
          <BaseIcon name="books" :size="80" class="empty-icon" />
          <text class="empty-title">暂无学习资源</text>
          <text class="empty-text">资源正在准备中，请稍后再来看看吧</text>
        </view>
      </view>

      <!-- 搜索结果模式 -->
      <view v-if="isSearching" class="search-results">
        <view class="section-header">
          <text class="section-title">搜索结果</text>
          <text class="section-count">{{ searchResults.length }} 项</text>
        </view>

        <view v-if="searchResults.length > 0" class="resource-cards">
          <view
            v-for="item in searchResults"
            :key="item._id || item.id"
            class="resource-card apple-group-card"
            @tap="handleResourceTap(item)"
          >
            <view class="card-top-row">
              <view class="category-badge" :style="{ background: getCategoryColor(item.category) }">
                <text class="category-badge-text">{{ getCategoryLabel(item.category) }}</text>
              </view>
              <view v-if="item.subject" class="subject-tag">
                <text class="subject-tag-text">{{ item.subject }}</text>
              </view>
            </view>
            <text class="card-title">{{ item.title || '未命名资源' }}</text>
            <text v-if="item.description" class="card-desc">{{ item.description }}</text>
            <view class="card-bottom-row">
              <view class="view-count">
                <BaseIcon name="eye" :size="22" />
                <text class="view-count-text">{{ formatCount(item.view_count || 0) }}</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 搜索空状态 -->
        <view v-if="searchResults.length === 0 && !resourceStore.loading" class="empty-box">
          <BaseIcon name="search" :size="80" class="empty-icon" />
          <text class="empty-title">未找到相关资源</text>
          <text class="empty-text">换个关键词试试吧</text>
        </view>
      </view>

      <view class="safe-area" />
    </scroll-view>
  </view>
</template>

<script setup>
import { ref, computed } from 'vue';
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app';
import { toast } from '@/utils/toast.js';
import { storageService } from '@/services/storageService.js';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { useResourceStore } from '@/stores/modules/resource.js';
import { logger } from '@/utils/logger.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';

// ── Store ──
const resourceStore = useResourceStore();

// ── 响应式状态 ──
const statusBarHeight = ref(44);
const isDark = ref(false);
const isLoading = ref(true);
const isRefreshing = ref(false);
const searchText = ref('');
const isSearching = ref(false);
const activeCategory = ref('all');
const activeSubject = ref('all');

// 分类和学科定义
const categoryList = [
  { key: 'all', label: '全部' },
  { key: 'video', label: '视频课程' },
  { key: 'article', label: '文章教程' },
  { key: 'ebook', label: '电子书籍' },
  { key: 'exercise', label: '练习题库' },
  { key: 'tool', label: '学习工具' }
];

const subjectList = [
  { key: 'all', label: '全部' },
  { key: 'politics', label: '政治' },
  { key: 'english', label: '英语' },
  { key: 'math', label: '数学' },
  { key: 'major', label: '专业课' }
];

// 分类颜色映射
const categoryColorMap = {
  video: 'rgba(239, 68, 68, 0.85)',
  article: 'rgba(59, 130, 246, 0.85)',
  ebook: 'rgba(16, 185, 129, 0.85)',
  exercise: 'rgba(245, 158, 11, 0.85)',
  tool: 'rgba(139, 92, 246, 0.85)'
};

// 分类标签映射
const categoryLabelMap = {
  video: '视频',
  article: '文章',
  ebook: '书籍',
  exercise: '题库',
  tool: '工具'
};

// 直接引用 Store 数据
const recommendations = computed(() => resourceStore.recommendations);
const hotResources = computed(() => resourceStore.hotResources);
const categoryResources = computed(() => resourceStore.categoryResources);
const searchResults = computed(() => resourceStore.searchResults);

// 当前分页
let currentPage = 1;

// 主题切换回调引用
let _themeHandler = null;
// 搜索防抖定时器
let _searchTimer = null;

// ── 方法 ──

/** 初始化系统信息 */
function initSystemUI() {
  statusBarHeight.value = getStatusBarHeight();
}

/** 初始化数据 */
async function loadData() {
  isLoading.value = true;
  try {
    // 并行加载推荐和热门
    await Promise.all([resourceStore.fetchRecommendations(), resourceStore.fetchHotResources()]);
    logger.log('[resource] 数据加载完成:', {
      推荐: recommendations.value.length,
      热门: hotResources.value.length
    });
  } catch (e) {
    logger.warn('[resource] 初始化数据失败:', e);
    toast.info('加载失败，请下拉刷新重试');
  } finally {
    isLoading.value = false;
  }
}

/** 下拉刷新 */
async function onPullRefresh() {
  isRefreshing.value = true;
  try {
    if (isSearching.value) {
      await handleSearch();
    } else {
      currentPage = 1;
      await Promise.all([resourceStore.fetchRecommendations(), resourceStore.fetchHotResources()]);
      // 如果有分类筛选，同时刷新分类数据
      if (activeCategory.value !== 'all' || activeSubject.value !== 'all') {
        await fetchFilteredResources();
      }
    }
  } catch (_e) {
    /* 静默处理 */
  }
  isRefreshing.value = false;
}

/** 滚动到底部加载更多 */
async function loadMore() {
  if (resourceStore.loading || !resourceStore.hasMore) return;
  currentPage++;
  if (isSearching.value) {
    await resourceStore.search({ keyword: searchText.value, page: currentPage });
  } else if (activeCategory.value !== 'all' || activeSubject.value !== 'all') {
    await fetchFilteredResources(currentPage);
  }
}

/** 选择分类 */
function selectCategory(key) {
  activeCategory.value = key;
  currentPage = 1;
  if (key !== 'all' || activeSubject.value !== 'all') {
    fetchFilteredResources();
  }
}

/** 选择学科 */
function selectSubject(key) {
  activeSubject.value = key;
  currentPage = 1;
  if (key !== 'all' || activeCategory.value !== 'all') {
    fetchFilteredResources();
  }
}

/** 按筛选条件获取资源 */
async function fetchFilteredResources(page = 1) {
  const params = { page, pageSize: 20 };
  if (activeCategory.value !== 'all') {
    params.category = activeCategory.value;
  }
  if (activeSubject.value !== 'all') {
    params.subject = activeSubject.value;
  }
  await resourceStore.fetchByCategory(params);
}

/** 搜索输入防抖 */
function onSearchInput() {
  if (_searchTimer) clearTimeout(_searchTimer);
  if (!searchText.value.trim()) {
    isSearching.value = false;
    return;
  }
  _searchTimer = setTimeout(() => {
    handleSearch();
  }, 500);
}

/** 执行搜索 */
async function handleSearch() {
  const keyword = searchText.value.trim();
  if (!keyword) {
    isSearching.value = false;
    return;
  }
  isSearching.value = true;
  currentPage = 1;
  await resourceStore.search({ keyword, page: 1, pageSize: 20 });
  logger.log('[resource] 搜索完成:', keyword, '结果:', searchResults.value.length);
}

/** 清除搜索 */
function clearSearch() {
  searchText.value = '';
  isSearching.value = false;
  if (_searchTimer) clearTimeout(_searchTimer);
}

/** 查看更多推荐 */
function viewMoreRecommend() {
  // 切换到全部分类查看
  activeCategory.value = 'all';
  activeSubject.value = 'all';
  toast.info('已展示全部推荐资源');
}

/** 点击资源卡片 */
function handleResourceTap(item) {
  if (item.url) {
    // 尝试复制链接
    uni.setClipboardData({
      data: item.url,
      success: () => {
        toast.success('资源链接已复制');
      },
      fail: () => {
        toast.info('复制失败，请稍后重试');
      }
    });
  } else {
    toast.info('该资源暂无访问链接');
  }
}

/** 获取分类颜色 */
function getCategoryColor(category) {
  return categoryColorMap[category] || 'rgba(107, 114, 128, 0.85)';
}

/** 获取分类标签文本 */
function getCategoryLabel(category) {
  return categoryLabelMap[category] || '其他';
}

/** 获取排名样式类名 */
function getRankClass(index) {
  if (index === 0) return 'rank-gold';
  if (index === 1) return 'rank-silver';
  if (index === 2) return 'rank-bronze';
  return '';
}

/** 格式化数字 */
function formatCount(count) {
  if (count >= 10000) {
    return (count / 10000).toFixed(1) + 'w';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1) + 'k';
  }
  return String(count);
}

/** 返回上一页 */
function goBack() {
  safeNavigateBack();
}

// ── 生命周期 ──

onLoad(() => {
  initSystemUI();
  loadData();

  // 主题初始化
  const savedTheme = storageService.get('theme_mode', 'light');
  isDark.value = savedTheme === 'dark';
  _themeHandler = (mode) => {
    isDark.value = mode === 'dark';
  };
  uni.$on('themeUpdate', _themeHandler);
});

onShow(() => {
  // 页面再次展示时静默刷新
});

onUnload(() => {
  uni.$off('themeUpdate', _themeHandler);
  if (_searchTimer) clearTimeout(_searchTimer);
});
</script>

<style lang="scss" scoped>
.container {
  min-height: 100vh;
  background: var(--bg-secondary, #f5f5f7);
}

.aurora-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 400rpx;
  background: var(--gradient-aurora);
  filter: blur(60px);
  z-index: 0;
}

/* 导航栏 */
.header-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background-color: var(--em3d-card-bg);
  border-bottom: 1rpx solid var(--em3d-border);
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
}

.nav-content {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20rpx;
}

.nav-back {
  font-size: 40rpx;
  color: var(--text-primary);
  padding: 10rpx 20rpx;
}

.nav-title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--text-primary);
}

.nav-placeholder {
  width: 72rpx;
}

/* 主滚动区域 */
.main-scroll {
  height: 100vh;
  padding: 0 20rpx;
  box-sizing: border-box;
}

/* 搜索栏 */
.search-bar {
  display: flex;
  align-items: center;
  background-color: var(--em3d-card-bg);
  border: 2rpx solid var(--em3d-border);
  border-radius: 999rpx;
  padding: 0 24rpx;
  height: 80rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
}

.search-icon {
  flex-shrink: 0;
  color: var(--text-sub);
  margin-right: 12rpx;
}

.search-input {
  flex: 1;
  height: 80rpx;
  font-size: 28rpx;
  color: var(--text-primary);
  background: transparent;
}

.search-clear {
  flex-shrink: 0;
  padding: 8rpx;
  color: var(--text-sub);
}

/* 分类筛选 - 横向滚动 */
.category-scroll {
  white-space: nowrap;
  margin-bottom: 16rpx;
}

.category-tabs {
  display: inline-flex;
  padding: 0 4rpx;
}

.cat-tab {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.68);
  border: 1rpx solid rgba(255, 255, 255, 0.5);
  margin-right: 16rpx;
  flex-shrink: 0;
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
}

.cat-tab:last-child {
  margin-right: 0;
}

.cat-tab.active {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
  box-shadow: var(--cta-primary-shadow);
}

.cat-tab-text {
  font-size: 24rpx;
  color: var(--text-sub);
  white-space: nowrap;
}

.cat-tab.active .cat-tab-text {
  color: var(--cta-primary-text);
  font-weight: 600;
}

/* 学科筛选 */
.subject-pills {
  display: flex;
  flex-wrap: wrap;
  margin-bottom: 24rpx;
}

.subject-pill {
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.54);
  border: 1rpx solid rgba(255, 255, 255, 0.44);
  margin-right: 12rpx;
  margin-bottom: 12rpx;
}

.subject-pill.active {
  background: rgba(79, 70, 229, 0.1);
  border-color: rgba(79, 70, 229, 0.3);
}

.subject-pill-text {
  font-size: 24rpx;
  color: var(--text-sub);
}

.subject-pill.active .subject-pill-text {
  color: var(--primary);
  font-weight: 600;
}

/* 区块 */
.section-block {
  margin-bottom: 32rpx;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary);
}

.section-count {
  font-size: 24rpx;
  color: var(--text-sub);
}

.section-action {
  font-size: 24rpx;
  color: var(--primary);
  padding: 8rpx 0;
}

/* 资源卡片 */
.resource-cards {
  /* 卡片容器 */
}

.resource-card {
  position: relative;
  overflow: hidden;
  background-color: var(--em3d-card-bg);
  border: 2rpx solid var(--em3d-border);
  border-radius: 28rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
  box-shadow: 0 var(--em3d-depth-md) 0 var(--em3d-border-shadow);
}

.card-top-row {
  display: flex;
  align-items: center;
  margin-bottom: 12rpx;
}

.category-badge {
  padding: 4rpx 16rpx;
  border-radius: 999rpx;
  margin-right: 12rpx;
}

.category-badge-text {
  font-size: 20rpx;
  color: #ffffff;
  font-weight: 600;
}

.subject-tag {
  background: rgba(79, 70, 229, 0.08);
  border: 1rpx solid rgba(79, 70, 229, 0.15);
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
}

.subject-tag-text {
  font-size: 20rpx;
  color: var(--primary);
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.5;
  margin-bottom: 8rpx;
  display: block;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-desc {
  font-size: 26rpx;
  color: var(--text-sub);
  line-height: 1.5;
  margin-bottom: 12rpx;
  display: block;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.view-count {
  display: flex;
  align-items: center;
  color: var(--text-sub);
}

.view-count-text {
  font-size: 22rpx;
  color: var(--text-sub);
  margin-left: 6rpx;
}

/* 热门列表 */
.hot-list {
  /* 热门容器 */
}

.hot-item {
  display: flex;
  align-items: center;
  background-color: var(--em3d-card-bg);
  border: 2rpx solid var(--em3d-border);
  border-radius: 24rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 var(--em3d-depth-sm) 0 var(--em3d-border-shadow);
}

.rank-badge {
  width: 48rpx;
  height: 48rpx;
  border-radius: 14rpx;
  background: rgba(107, 114, 128, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 16rpx;
}

.rank-text {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-sub);
}

.rank-gold {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
}

.rank-gold .rank-text {
  color: #ffffff;
}

.rank-silver {
  background: linear-gradient(135deg, #d1d5db, #9ca3af);
}

.rank-silver .rank-text {
  color: #ffffff;
}

.rank-bronze {
  background: linear-gradient(135deg, #d97706, #b45309);
}

.rank-bronze .rank-text {
  color: #ffffff;
}

.hot-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hot-title {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hot-meta {
  display: flex;
  align-items: center;
}

.category-badge-sm {
  padding: 2rpx 12rpx;
  border-radius: 999rpx;
  margin-right: 12rpx;
}

.category-badge-sm-text {
  font-size: 18rpx;
  color: #ffffff;
  font-weight: 600;
}

.hot-views {
  font-size: 22rpx;
  color: var(--text-sub);
}

.hot-arrow {
  flex-shrink: 0;
  color: var(--text-sub);
  margin-left: 8rpx;
}

/* 搜索结果区域 */
.search-results {
  padding-top: 8rpx;
}

/* 空状态 */
.empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 40rpx;
  text-align: center;
}

.empty-icon {
  margin-bottom: 20rpx;
  color: var(--text-sub);
}

.empty-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12rpx;
}

.empty-text {
  font-size: 26rpx;
  color: var(--text-sub);
  line-height: 1.5;
}

/* 骨架屏 */
.loading-state {
  padding: 0 20rpx;
}

.skeleton-list {
  padding-top: 20rpx;
}

.skeleton-search {
  height: 80rpx;
  border-radius: 999rpx;
  background: var(--border, #e5e5e5);
  margin-bottom: 20rpx;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-card {
  background-color: var(--em3d-card-bg);
  border: 2rpx solid var(--em3d-border);
  border-radius: 28rpx;
  padding: 28rpx;
  margin-bottom: 20rpx;
}

.skeleton-line {
  height: 24rpx;
  border-radius: 12rpx;
  background: var(--border, #e5e5e5);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.skeleton-title {
  width: 60%;
  margin-bottom: 16rpx;
}

.skeleton-desc {
  width: 85%;
  margin-bottom: 12rpx;
}

.skeleton-short {
  width: 40%;
}

@keyframes skeleton-pulse {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.8;
  }
}

.safe-area {
  height: 120rpx;
}

/* ========== 暗黑模式 ========== */
.dark-mode .aurora-bg {
  opacity: 0.3;
}

.dark-mode .nav-back,
.dark-mode .nav-title,
.dark-mode .section-title,
.dark-mode .card-title,
.dark-mode .hot-title,
.dark-mode .empty-title,
.dark-mode .search-input {
  color: var(--text-main, #ffffff);
}

.dark-mode .resource-card,
.dark-mode .hot-item,
.dark-mode .search-bar,
.dark-mode .skeleton-card {
  background: var(--bg-card, #1c1c1e);
  border-color: var(--border, rgba(255, 255, 255, 0.1));
}

.dark-mode .cat-tab {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .cat-tab-text {
  color: var(--text-sub, #9ca3af);
}

.dark-mode .cat-tab.active {
  background: var(--cta-primary-bg);
  border-color: var(--cta-primary-border);
}

.dark-mode .cat-tab.active .cat-tab-text {
  color: var(--cta-primary-text);
}

.dark-mode .subject-pill {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.dark-mode .subject-pill.active {
  background: rgba(99, 102, 241, 0.15);
  border-color: rgba(99, 102, 241, 0.3);
}

.dark-mode .rank-badge {
  background: rgba(255, 255, 255, 0.08);
}
</style>
