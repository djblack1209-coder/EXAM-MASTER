<template>
  <view class="professional-page">
    <view class="navbar">
      <view class="navbar-inner" :style="{ paddingTop: statusBarHeight + 'px' }">
        <view class="nav-back" @tap="goBack">
          <BaseIcon name="arrow-left" :size="32" />
        </view>
        <text class="nav-title">专业课索引</text>
        <view class="nav-right" />
      </view>
    </view>

    <scroll-view class="scroll-body" scroll-y :style="{ paddingTop: statusBarHeight + 44 + 'px' }">
      <view class="hero">
        <text class="hero-kicker">Index only</text>
        <text class="hero-title">专业课资料总索引</text>
        <text class="hero-desc">先按优先级定位真题与机构候选，再逐步整理为题卡。</text>
        <view class="metric-row">
          <view class="metric">
            <text class="metric-value">{{ summary.eligibleIndexSources }}</text>
            <text class="metric-label">可索引</text>
          </view>
          <view class="metric">
            <text class="metric-value">{{ priorityCount('T0') }}</text>
            <text class="metric-label">优先整理</text>
          </view>
          <view class="metric">
            <text class="metric-value">{{ summary.reviewRequiredSources || 0 }}</text>
            <text class="metric-label">待确认</text>
          </view>
        </view>
      </view>

      <view class="search-panel">
        <view class="search-box">
          <BaseIcon name="search" :size="28" />
          <input
            v-model="keyword"
            class="search-input"
            placeholder="搜索院校、科目代码或文件名"
            confirm-type="search"
          />
        </view>
        <scroll-view scroll-x class="direction-scroll">
          <view class="direction-row">
            <view class="direction-chip" :class="{ active: selectedDirection === '' }" @tap="selectDirection('')">
              <text>全部</text>
            </view>
            <view
              v-for="direction in directions"
              :key="direction.name"
              class="direction-chip"
              :class="{ active: selectedDirection === direction.name }"
              @tap="selectDirection(direction.name)"
            >
              <text>{{ direction.name }}</text>
              <text class="direction-count">{{ direction.count }}</text>
            </view>
          </view>
        </scroll-view>
        <view class="priority-row">
          <view
            v-for="priority in priorityFilters"
            :key="priority.value"
            class="priority-chip"
            :class="{ active: selectedPriority === priority.value }"
            @tap="selectPriority(priority.value)"
          >
            <text>{{ priority.label }}</text>
            <text class="priority-count">{{ priority.count }}</text>
          </view>
        </view>
      </view>

      <view class="section-head">
        <view>
          <text class="section-title">资料列表</text>
          <text class="section-hint">{{ resultText }}</text>
        </view>
        <text class="section-meta">索引模式</text>
      </view>

      <view class="source-list">
        <view v-for="item in filteredItems" :key="item.sourceId" class="source-card">
          <view class="source-top">
            <view class="school-block">
              <text class="school">{{ item.school }}</text>
              <text class="direction">{{ item.direction }}</text>
            </view>
            <view class="source-badges">
              <text class="priority-badge" :class="`tier-${item.priorityTier || 'T3'}`">
                {{ item.priorityLabel || priorityLabel(item.priorityTier) }}
              </text>
              <text v-if="item.courseCode" class="course-code">{{ item.courseCode }}</text>
            </view>
          </view>
          <text class="file-name">{{ item.fileName }}</text>
          <view class="source-meta-row">
            <text class="source-meta">{{ item.bucket }}</text>
            <text class="source-meta">{{ item.sourceInstitution || '官方/院校资料' }}</text>
            <text class="source-meta">{{ typeLabel(item.sourceType) }}</text>
            <text class="source-meta">{{ statusLabel(item.status) }}</text>
            <text v-if="item.duplicateGroupSize > 1" class="source-meta warn">
              重复 {{ item.duplicateRank }}/{{ item.duplicateGroupSize }}
            </text>
            <text v-if="item.copyrightReviewRequired" class="source-meta risk">待确认来源</text>
          </view>
          <view v-if="item.riskLabels && item.riskLabels.length" class="risk-row">
            <text v-for="risk in item.riskLabels.slice(0, 3)" :key="`${item.sourceId}-${risk}`" class="risk-pill">
              {{ risk }}
            </text>
          </view>
        </view>
      </view>

      <view v-if="filteredItems.length === 0" class="empty">
        <BaseIcon name="empty" :size="56" />
        <text class="empty-title">没有匹配资料</text>
        <text class="empty-desc">换一个院校、专业方向或科目代码试试。</text>
      </view>

      <view class="footnote">
        <text>专业课本次只上线索引与筛选，不把待确认机构资料伪装成可刷题库。</text>
      </view>
    </scroll-view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import professionalIndex from '@/config/professional-source-index.json';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { getStatusBarHeight } from '@/utils/core/system.js';

const statusBarHeight = ref(getStatusBarHeight());
const keyword = ref('');
const selectedDirection = ref('');
const selectedPriority = ref('');

const summary = computed(() => professionalIndex.summary || {});
const directions = computed(() => professionalIndex.directions || []);
const items = computed(() => professionalIndex.items || []);
const priorityFilters = computed(() => {
  const counts = summary.value.priorityCounts || {};
  return [
    { value: '', label: '全部', count: summary.value.eligibleIndexSources || 0 },
    { value: 'T0', label: '优先', count: counts.T0 || 0 },
    { value: 'T1', label: '可整理', count: counts.T1 || 0 },
    { value: 'T2', label: '待确认', count: counts.T2 || 0 },
    { value: 'T3', label: '暂缓', count: counts.T3 || 0 }
  ];
});

const filteredItems = computed(() => {
  const term = keyword.value.trim().toLowerCase();
  return items.value
    .filter((item) => !selectedDirection.value || item.direction === selectedDirection.value)
    .filter((item) => !selectedPriority.value || item.priorityTier === selectedPriority.value)
    .filter((item) => {
      if (!term) return true;
      return [item.school, item.direction, item.courseCode, item.fileName, item.bucket, item.sourceInstitution]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    })
    .slice(0, 80);
});

const resultText = computed(() => {
  const count = filteredItems.value.length;
  return keyword.value || selectedDirection.value ? `显示 ${count} 条匹配结果` : `显示前 ${count} 条摘要`;
});

function selectDirection(direction) {
  selectedDirection.value = direction;
}

function selectPriority(priority) {
  selectedPriority.value = priority;
}

function goBack() {
  safeNavigateBack();
}

function priorityCount(tier) {
  return summary.value.priorityCounts?.[tier] || 0;
}

function priorityLabel(tier) {
  if (tier === 'T0') return '优先整理';
  if (tier === 'T1') return '可整理';
  if (tier === 'T2') return '待确认';
  return '暂缓';
}

function typeLabel(type) {
  if (type === 'official_paper') return '真题资料';
  if (type === 'institution_candidate') return '机构资料';
  return '资料';
}

function statusLabel(status) {
  if (status === 'verified') return '已核验';
  if (status === 'published') return '已发布';
  if (status === 'rejected') return '不可用';
  return '待整理';
}
</script>

<style scoped lang="scss">
.professional-page {
  min-height: 100vh;
  background: #f5f5f7;
  color: #1d1d1f;
}

.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(245, 245, 247, 0.9);
  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);
}

.navbar-inner {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 16px;
}

.nav-back,
.nav-right {
  width: 40px;
}

.nav-title {
  flex: 1;
  text-align: center;
  color: #1d1d1f;
  font-size: 32rpx;
  font-weight: 760;
}

.scroll-body {
  height: 100vh;
  box-sizing: border-box;
}

.hero,
.search-panel,
.source-card,
.footnote,
.empty {
  margin: 24rpx;
  border-radius: 26rpx;
  background: #ffffff;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.06);
}

.hero {
  padding: 34rpx 32rpx;
}

.hero-kicker {
  display: block;
  color: #8e8e93;
  font-size: 18rpx;
  font-weight: 900;
}

.hero-title {
  display: block;
  margin-top: 12rpx;
  color: #1d1d1f;
  font-size: 40rpx;
  font-weight: 760;
  line-height: 1.18;
}

.hero-desc {
  display: block;
  margin-top: 14rpx;
  color: #5f6672;
  font-size: 25rpx;
  line-height: 1.5;
}

.metric-row {
  display: flex;
  margin-top: 28rpx;
}

.metric {
  flex: 1;
  padding: 18rpx 14rpx;
  border-radius: 20rpx;
  background: #f6f7f9;
}

.metric + .metric {
  margin-left: 12rpx;
}

.metric-value {
  display: block;
  color: #1d1d1f;
  font-size: 32rpx;
  font-weight: 760;
}

.metric-label {
  display: block;
  margin-top: 8rpx;
  color: #8e8e93;
  font-size: 21rpx;
  font-weight: 750;
}

.search-panel {
  padding: 22rpx;
}

.search-box {
  display: flex;
  align-items: center;
  min-height: 72rpx;
  padding: 0 22rpx;
  border-radius: 22rpx;
  background: #f2f3f5;
}

.search-input {
  flex: 1;
  margin-left: 12rpx;
  color: #1d1d1f;
  font-size: 26rpx;
}

.direction-scroll {
  margin-top: 18rpx;
  white-space: nowrap;
}

.direction-row {
  display: flex;
  align-items: center;
}

.direction-chip {
  display: inline-flex;
  align-items: center;
  min-height: 58rpx;
  margin-right: 12rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #f6f7f9;
  color: #5f6672;
  font-size: 23rpx;
  font-weight: 800;
}

.direction-chip.active {
  background: #1d1d1f;
  color: #ffffff;
}

.direction-count {
  margin-left: 8rpx;
  opacity: 0.7;
}

.priority-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 18rpx;
}

.priority-chip {
  min-height: 56rpx;
  padding: 8rpx 6rpx;
  border-radius: 16rpx;
  background: #f6f7f9;
  color: #5f6672;
  text-align: center;
  font-size: 21rpx;
  font-weight: 800;
}

.priority-chip.active {
  background: rgba(31, 122, 77, 0.12);
  color: #1f7a4d;
}

.priority-count {
  display: block;
  margin-top: 4rpx;
  font-size: 18rpx;
  opacity: 0.72;
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 12rpx 32rpx 0;
}

.section-title {
  display: block;
  color: #1d1d1f;
  font-size: 32rpx;
  font-weight: 760;
}

.section-hint,
.section-meta {
  display: block;
  margin-top: 8rpx;
  color: #8e8e93;
  font-size: 22rpx;
}

.source-list {
  padding-bottom: 10rpx;
}

.source-card {
  padding: 26rpx 24rpx;
}

.source-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.school-block {
  flex: 1;
  min-width: 0;
}

.school {
  display: block;
  color: #1d1d1f;
  font-size: 30rpx;
  font-weight: 850;
}

.direction {
  display: block;
  margin-top: 6rpx;
  color: #8e8e93;
  font-size: 22rpx;
}

.source-badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
  margin-left: 16rpx;
}

.course-code,
.priority-badge {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  font-size: 21rpx;
  font-weight: 900;
  white-space: nowrap;
}

.course-code {
  background: rgba(31, 122, 77, 0.1);
  color: #1f7a4d;
}

.priority-badge {
  background: #f2f3f5;
  color: #5f6672;
}

.priority-badge.tier-T0 {
  background: rgba(31, 122, 77, 0.12);
  color: #1f7a4d;
}

.priority-badge.tier-T1 {
  background: rgba(0, 113, 227, 0.1);
  color: #0068d6;
}

.priority-badge.tier-T2 {
  background: rgba(255, 149, 0, 0.12);
  color: #9a5b00;
}

.priority-badge.tier-T3 {
  background: rgba(142, 142, 147, 0.12);
  color: #5f6672;
}

.file-name {
  display: block;
  margin-top: 18rpx;
  color: #1d1d1f;
  font-size: 25rpx;
  line-height: 1.45;
}

.source-meta-row {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
}

.source-meta {
  margin-right: 8rpx;
  margin-bottom: 8rpx;
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: #f2f3f5;
  color: #5f6672;
  font-size: 20rpx;
  font-weight: 750;
}

.source-meta.warn {
  background: rgba(255, 149, 0, 0.12);
  color: #9a5b00;
}

.source-meta.risk {
  background: rgba(255, 59, 48, 0.1);
  color: #b42318;
}

.risk-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 6rpx;
}

.risk-pill {
  padding: 5rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(255, 149, 0, 0.1);
  color: #9a5b00;
  font-size: 19rpx;
  font-weight: 760;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 54rpx 32rpx;
  color: #8e8e93;
}

.empty-title {
  margin-top: 18rpx;
  color: #1d1d1f;
  font-size: 28rpx;
  font-weight: 850;
}

.empty-desc,
.footnote text {
  margin-top: 8rpx;
  color: #8e8e93;
  font-size: 22rpx;
  line-height: 1.45;
  text-align: center;
}

.footnote {
  padding: 24rpx;
  margin-bottom: 120rpx;
  box-shadow: none;
}
</style>
