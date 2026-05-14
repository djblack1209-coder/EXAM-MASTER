<template>
  <view :class="['qb-page', { 'dark-mode': isDark }]">
    <view class="navbar">
      <view class="navbar-inner" :style="{ paddingTop: statusBarHeight + 'px' }">
        <view class="nav-back" @tap="goBack">
          <BaseIcon name="arrow-left" :size="32" />
        </view>
        <text class="nav-title">历年真题</text>
        <view class="nav-right" />
      </view>
    </view>

    <scroll-view class="scroll-body" scroll-y :style="{ paddingTop: statusBarHeight + 44 + 'px' }">
      <view class="paper-hero">
        <text class="hero-kicker">PAST PAPERS</text>
        <text class="hero-title">按年份整卷训练</text>
        <text class="hero-desc">先选科目和年份，再进入完整试卷。英语卷会按篇章保留原文材料，缺原文的卷不会开放选择题训练。</text>
        <view class="hero-metrics">
          <view class="hero-metric">
            <text class="metric-value">{{ readyCount }}</text>
            <text class="metric-label">可练试卷</text>
          </view>
          <view class="hero-metric">
            <text class="metric-value">{{ pendingCount }}</text>
            <text class="metric-label">即将开放</text>
          </view>
          <view class="hero-metric">
            <text class="metric-value">{{ totalQuestions }}</text>
            <text class="metric-label">本地题量</text>
          </view>
        </view>
      </view>

      <view class="subject-tabs">
        <view
          v-for="subject in navigationTree"
          :key="subject.id"
          class="subject-tab"
          :class="{ active: selectedSubject?.id === subject.id }"
          @tap="selectSubject(subject.id)"
        >
          <text>{{ subject.label }}</text>
        </view>
      </view>

      <view class="track-row">
        <view
          v-for="track in selectedSubject?.tracks || []"
          :key="track.id"
          class="track-pill"
          :class="{ active: selectedTrack?.id === track.id }"
          @tap="selectTrack(track.id)"
        >
          <text class="track-code">{{ track.code }}</text>
          <text>{{ track.label }}</text>
        </view>
      </view>

      <view class="section-head">
        <view>
          <text class="section-title">{{ selectedTrack?.label || '公共课' }}</text>
          <text class="section-hint">按年份选择整套试卷</text>
        </view>
        <text class="section-meta">{{ selectedTrackReadyCount }} 套可练</text>
      </view>

      <view v-if="selectedReadyBanks.length > 0" class="paper-list">
        <view v-for="paper in selectedReadyBanks" :key="paper.id" class="paper-card">
          <view class="paper-main">
            <text class="paper-year">{{ paper.year }}</text>
            <view class="paper-copy">
              <text class="paper-name">{{ paper.name }}</text>
              <text class="paper-desc">{{ paper.description }}</text>
              <view class="paper-section-row">
                <text v-for="section in paper.sections || []" :key="section" class="paper-section">{{ section }}</text>
              </view>
            </view>
          </view>
          <view class="paper-actions">
            <view
              v-if="!isBankLoaded(paper.id)"
              class="paper-btn primary"
              hover-class="btn-hover"
              @tap="loadAndStartPaper(paper)"
            >
              <text>{{ loadingBankId === paper.id ? '加载中' : '整卷练习' }}</text>
            </view>
            <view v-else class="paper-btn secondary" hover-class="btn-hover" @tap="startLoadedPaper(paper)">
              <text>继续练习</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else class="empty-state">
        <BaseIcon name="book" :size="56" />
        <text class="empty-text">该方向暂无可练整卷</text>
        <text class="empty-sub">资料和答案说明完善后，会按年份开放整卷练习。</text>
      </view>

      <view v-if="selectedPendingBanks.length > 0" class="pending-panel">
        <view class="pending-head">
          <text class="pending-title">即将开放</text>
          <text class="pending-sub">开放后可整卷练习</text>
        </view>
        <view v-for="paper in selectedPendingBanks" :key="paper.id" class="pending-item">
          <view class="pending-copy">
            <text class="pending-name">{{ paper.name }}</text>
            <text class="pending-reason">{{ paper.disabledReason || qualityLabel(paper.quality) }}</text>
          </view>
          <text class="pending-year">{{ paper.year }}</text>
        </view>
      </view>

      <view class="bottom-spacer" />
    </scroll-view>
  </view>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { safeNavigateBack } from '@/utils/safe-navigate';
import { getPracticeNavigationTree, loadBank } from '@/config/bank-registry.js';
import { importFlashcardsToBank, getBankStats } from '@/utils/flashcard-adapter.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import storageService from '@/services/storageService.js';
import { toast } from '@/utils/toast.js';
import { logger } from '@/utils/logger.js';

const isDark = ref(storageService.get('theme_mode', 'light') === 'dark');
const _themeHandler = (mode) => {
  isDark.value = mode === 'dark';
};
uni.$on('themeUpdate', _themeHandler);
onBeforeUnmount(() => {
  uni.$off('themeUpdate', _themeHandler);
});

const statusBarHeight = ref(getStatusBarHeight());
const loadingBankId = ref('');
const selectedSubjectKey = ref('');
const selectedTrackId = ref('');
const loadedBankIds = ref(new Set(storageService.get('loaded_flashcard_banks', []) || []));
const navigationTree = computed(() => getPracticeNavigationTree(storageService.get('exam_profile', null) || {}));
const allTracks = computed(() => navigationTree.value.flatMap((subject) => subject.tracks || []));
const readyCount = computed(() => allTracks.value.reduce((sum, track) => sum + (track.banks?.length || 0), 0));
const pendingCount = computed(() => allTracks.value.reduce((sum, track) => sum + (track.pendingBanks?.length || 0), 0));
const bankStats = computed(() =>
  getBankStats({
    get: (key) => storageService.get(key, [])
  })
);
const totalQuestions = computed(() => bankStats.value.total || 0);

const selectedSubject = computed(() => {
  const fallbackSubject = navigationTree.value[0] || null;
  return navigationTree.value.find((subject) => subject.id === selectedSubjectKey.value) || fallbackSubject;
});
const selectedTrack = computed(() => {
  const tracks = selectedSubject.value?.tracks || [];
  return tracks.find((track) => track.id === selectedTrackId.value) || tracks[0] || null;
});
const selectedReadyBanks = computed(() => selectedTrack.value?.banks || []);
const selectedPendingBanks = computed(() => selectedTrack.value?.pendingBanks || []);
const selectedTrackReadyCount = computed(() => selectedReadyBanks.value.length);

function goBack() {
  safeNavigateBack();
}

function ensureSelection() {
  const tree = navigationTree.value;
  if (!tree.length) return;
  const preferredSubject = tree.find((subject) => subject.tracks?.some((track) => track.banks?.length)) || tree[0];
  if (!selectedSubjectKey.value || !tree.some((subject) => subject.id === selectedSubjectKey.value)) {
    selectedSubjectKey.value = preferredSubject.id;
  }
  const subject = tree.find((item) => item.id === selectedSubjectKey.value) || preferredSubject;
  const preferredTrack = subject.tracks?.find((track) => track.banks?.length) || subject.tracks?.[0];
  if (!selectedTrackId.value || !subject.tracks?.some((track) => track.id === selectedTrackId.value)) {
    selectedTrackId.value = preferredTrack?.id || '';
  }
}

function selectSubject(subjectId) {
  selectedSubjectKey.value = subjectId;
  const subject = navigationTree.value.find((item) => item.id === subjectId);
  const track = subject?.tracks?.find((item) => item.banks?.length) || subject?.tracks?.[0];
  selectedTrackId.value = track?.id || '';
}

function selectTrack(trackId) {
  selectedTrackId.value = trackId;
}

function isBankLoaded(bankId) {
  return loadedBankIds.value.has(bankId);
}

function qualityLabel(quality) {
  if (quality === 'needs_passage') return '篇章材料完善中';
  if (quality === 'needs_cleaning') return '题目与答案说明完善中';
  if (quality === 'source_missing') return '资料完善中';
  return '即将开放';
}

async function loadPaper(paper) {
  loadingBankId.value = paper.id;
  try {
    const data = await loadBank(paper.id);
    const adapter = {
      get: (key) => storageService.get(key, []),
      set: (key, value) => storageService.save(key, value)
    };
    const result = importFlashcardsToBank(data, adapter, {
      paperId: paper.id,
      paperName: paper.name,
      subject: paper.subject
    });
    const loaded = storageService.get('loaded_flashcard_banks', []) || [];
    if (!loaded.includes(paper.id)) {
      loaded.push(paper.id);
      storageService.save('loaded_flashcard_banks', loaded);
    }
    loadedBankIds.value = new Set(loaded);
    toast.success(`已加载 ${result.imported} 题`);
    return result;
  } catch (error) {
    logger.error('[QuestionBank] load paper failed:', error);
    toast.error('试卷加载失败');
    throw error;
  } finally {
    loadingBankId.value = '';
  }
}

async function loadAndStartPaper(paper) {
  await loadPaper(paper);
  startLoadedPaper(paper);
}

function startLoadedPaper(paper) {
  const bank = storageService.get('v30_bank', []);
  const ids = bank
    .filter((q) => q.paperId === paper.id || (q.source === paper.source && q.year === paper.year))
    .map((q) => q.id);
  if (ids.length > 0) {
    uni.setStorageSync('smart_review_ids', ids);
    uni.navigateTo({ url: '/pages/practice-sub/do-quiz?mode=smart_review' });
    return;
  }
  uni.navigateTo({ url: '/pages/practice-sub/do-quiz' });
}

onMounted(() => {
  ensureSelection();
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
  color: var(--text-primary);
}
.nav-title {
  flex: 1;
  text-align: center;
  font-size: 34rpx;
  font-weight: 850;
  color: var(--text-primary);
}
.nav-right {
  width: 40px;
}
.scroll-body {
  min-height: 100vh;
}
.paper-hero {
  margin: 24rpx;
  padding: 34rpx 32rpx;
  border-radius: 30rpx;
  background: #142017;
  box-shadow: 0 18rpx 38rpx rgba(20, 32, 23, 0.16);
}
.hero-kicker {
  display: block;
  color: rgba(255, 255, 255, 0.52);
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 2rpx;
}
.hero-title {
  display: block;
  margin-top: 12rpx;
  color: #fff;
  font-size: 42rpx;
  font-weight: 900;
  line-height: 1.15;
}
.hero-desc {
  display: block;
  margin-top: 14rpx;
  color: rgba(255, 255, 255, 0.68);
  font-size: 25rpx;
  line-height: 1.5;
}
.hero-metrics {
  display: flex;
  margin-top: 28rpx;
}
.hero-metric {
  flex: 1;
  padding: 18rpx 14rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.1);
}
.hero-metric + .hero-metric {
  margin-left: 12rpx;
}
.metric-value {
  display: block;
  color: #fff;
  font-size: 34rpx;
  font-weight: 900;
  line-height: 1;
}
.metric-label {
  display: block;
  margin-top: 8rpx;
  color: rgba(255, 255, 255, 0.58);
  font-size: 21rpx;
  font-weight: 750;
}
.subject-tabs,
.track-row {
  display: flex;
  padding: 0 24rpx;
  margin-top: 18rpx;
}
.subject-tab,
.track-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 58rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 24rpx;
  font-weight: 800;
  border: 2rpx solid rgba(0, 0, 0, 0.05);
}
.subject-tab + .subject-tab,
.track-pill + .track-pill {
  margin-left: 12rpx;
}
.subject-tab.active,
.track-pill.active {
  background: #9fe870;
  color: #142017;
  border-color: #9fe870;
}
.track-code {
  margin-right: 8rpx;
  font-weight: 900;
}
.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 30rpx 32rpx 16rpx;
}
.section-title {
  display: block;
  color: var(--text-primary);
  font-size: 34rpx;
  font-weight: 900;
}
.section-hint,
.section-meta {
  display: block;
  color: var(--text-secondary);
  font-size: 23rpx;
  margin-top: 8rpx;
}
.paper-list {
  padding: 0 24rpx;
}
.paper-card {
  padding: 28rpx 24rpx;
  margin-bottom: 18rpx;
  border-radius: 24rpx;
  background: var(--bg-card);
  border: 2rpx solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}
.paper-main {
  display: flex;
}
.paper-year {
  flex-shrink: 0;
  width: 104rpx;
  color: #142017;
  font-size: 36rpx;
  font-weight: 950;
  line-height: 1;
}
.paper-copy {
  flex: 1;
  min-width: 0;
}
.paper-name {
  display: block;
  color: var(--text-primary);
  font-size: 30rpx;
  font-weight: 850;
}
.paper-desc {
  display: block;
  margin-top: 8rpx;
  color: var(--text-secondary);
  font-size: 23rpx;
  line-height: 1.45;
}
.paper-section-row {
  display: flex;
  flex-wrap: wrap;
  margin-top: 16rpx;
}
.paper-section {
  margin-right: 8rpx;
  margin-bottom: 8rpx;
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(20, 32, 23, 0.06);
  color: rgba(20, 32, 23, 0.68);
  font-size: 20rpx;
  font-weight: 750;
}
.paper-actions {
  margin-top: 22rpx;
}
.paper-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 72rpx;
  border-radius: 18rpx;
  font-size: 25rpx;
  font-weight: 900;
}
.paper-btn.primary {
  background: #142017;
  color: #fff;
}
.paper-btn.secondary {
  background: #9fe870;
  color: #142017;
}
.pending-panel {
  margin: 30rpx 24rpx 0;
  padding: 26rpx 24rpx;
  border-radius: 24rpx;
  background: rgba(20, 32, 23, 0.045);
}
.pending-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.pending-title {
  color: var(--text-primary);
  font-size: 28rpx;
  font-weight: 900;
}
.pending-sub {
  color: var(--text-secondary);
  font-size: 21rpx;
}
.pending-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 0;
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
}
.pending-copy {
  flex: 1;
  min-width: 0;
  padding-right: 18rpx;
}
.pending-name {
  display: block;
  color: var(--text-primary);
  font-size: 25rpx;
  font-weight: 820;
}
.pending-reason {
  display: block;
  margin-top: 6rpx;
  color: var(--text-secondary);
  font-size: 22rpx;
  line-height: 1.35;
}
.pending-year {
  color: #142017;
  font-size: 26rpx;
  font-weight: 900;
}
.empty-state {
  margin: 34rpx 24rpx;
  padding: 56rpx 32rpx;
  border-radius: 24rpx;
  background: var(--bg-card);
  text-align: center;
  color: var(--text-secondary);
}
.empty-text {
  display: block;
  margin-top: 18rpx;
  color: var(--text-primary);
  font-size: 30rpx;
  font-weight: 850;
}
.empty-sub {
  display: block;
  margin-top: 10rpx;
  color: var(--text-secondary);
  font-size: 24rpx;
  line-height: 1.45;
}
.bottom-spacer {
  height: 120rpx;
}
.dark-mode {
  background: #1a1c23;
}
</style>
