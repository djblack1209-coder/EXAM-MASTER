<template>
  <view :class="['qb-page', { 'dark-mode': isDark }]">
    <view class="navbar">
      <view class="navbar-inner" :style="{ paddingTop: statusBarHeight + 'px' }">
        <view class="nav-back" @tap="goBack">
          <BaseIcon name="arrow-left" :size="32" />
        </view>
        <text class="nav-title">真题库</text>
        <view class="nav-right" />
      </view>
    </view>

    <scroll-view class="scroll-body" scroll-y :style="{ paddingTop: statusBarHeight + 44 + 'px' }">
      <view class="paper-hero">
        <text class="hero-kicker">Exam Master</text>
        <text class="hero-title">按年份刷真题</text>
        <text class="hero-desc">选择科目和年份后进入整卷训练。英语卷先读完整文章，再做对应题目。</text>
        <view class="hero-metrics">
          <view class="hero-metric">
            <text class="metric-value">{{ readyCount }}</text>
            <text class="metric-label">正式</text>
          </view>
          <view class="hero-metric">
            <text class="metric-value">{{ draftCount }}</text>
            <text class="metric-label">自练</text>
          </view>
          <view class="hero-metric">
            <text class="metric-value">{{ pendingCount }}</text>
            <text class="metric-label">待完善</text>
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
          <text class="section-hint">2005-2026 整卷真题地图</text>
        </view>
        <text class="section-meta">{{ selectedTrackSlotText }}</text>
      </view>

      <view v-if="selectedYearSlots.length > 0" class="year-map">
        <view
          v-for="slot in selectedYearSlots"
          :key="slot.id"
          class="year-slot"
          :class="[`status-${slot.status}`, { active: selectedYearSlot?.id === slot.id }]"
          @tap="selectYearSlot(slot)"
        >
          <text class="slot-year">{{ slot.year }}</text>
          <text class="slot-status">{{ slot.statusLabel }}</text>
        </view>
      </view>

      <view v-if="selectedYearSlot" class="slot-detail">
        <view class="slot-detail-head">
          <view class="slot-title-block">
            <text class="slot-kicker">{{ selectedTrack?.code }} · {{ selectedYearSlot.statusLabel }}</text>
            <text class="slot-title">{{ selectedYearSlot.name }}</text>
          </view>
          <view class="slot-badge" :class="`status-${selectedYearSlot.status}`">
            <text>{{ selectedYearSlot.actionLabel }}</text>
          </view>
        </view>
        <text class="slot-desc">{{ selectedYearSlot.description }}</text>
        <text v-if="selectedYearSlot.caution" class="slot-caution">{{ selectedYearSlot.caution }}</text>
        <text v-else class="slot-caution">{{ selectedYearSlot.disabledReason }}</text>
        <view v-if="selectedYearSlot.sections?.length" class="paper-section-row slot-sections">
          <text v-for="section in selectedYearSlot.sections" :key="section" class="paper-section">{{ section }}</text>
        </view>
        <view
          v-if="selectedYearSlot.clickable"
          class="paper-btn primary slot-action"
          hover-class="btn-hover"
          @tap="loadAndStartSlot(selectedYearSlot)"
        >
          <text>{{ loadingBankId === selectedYearSlot.bankId ? '加载中' : selectedYearSlot.actionLabel }}</text>
        </view>
      </view>

      <view v-if="selectedReadyBanks.length > 0" class="paper-list">
        <view v-for="paper in selectedReadyBanks" :key="paper.id" class="paper-card">
          <view class="paper-main">
            <text class="paper-year">{{ paper.year }}</text>
            <view class="paper-copy">
              <text class="paper-name">{{ paper.name }}</text>
              <text v-if="paper.releaseLabel" class="paper-release-label">{{ paper.releaseLabel }}</text>
              <text class="paper-desc">{{ paper.description }}</text>
              <text v-if="paper.caution" class="paper-caution">{{ paper.caution }}</text>
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
              <text>{{ loadingBankId === paper.id ? '加载中' : '开始' }}</text>
            </view>
            <view v-else class="paper-btn secondary" hover-class="btn-hover" @tap="refreshAndStartPaper(paper)">
              <text>继续</text>
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
          <text class="pending-title">整理中</text>
          <text class="pending-sub">验证通过后开放</text>
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
import { importFlashcardsToBank } from '@/utils/flashcard-adapter.js';
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
const readyCount = computed(() => allTracks.value.reduce((sum, track) => sum + (track.slotSummary?.ready || 0), 0));
const draftCount = computed(() => allTracks.value.reduce((sum, track) => sum + (track.slotSummary?.draft || 0), 0));
const totalSlotCount = computed(() => allTracks.value.reduce((sum, track) => sum + (track.slotSummary?.total || 0), 0));
const pendingCount = computed(() => Math.max(totalSlotCount.value - readyCount.value - draftCount.value, 0));

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
const selectedYearSlots = computed(() => selectedTrack.value?.yearSlots || []);
const selectedYearSlotId = ref('');
const selectedYearSlot = computed(() => {
  return (
    selectedYearSlots.value.find((slot) => slot.id === selectedYearSlotId.value) || selectedYearSlots.value[0] || null
  );
});
const selectedTrackSlotText = computed(() => {
  const summary = selectedTrack.value?.slotSummary || {};
  const ready = Number(summary.ready || 0);
  const draft = Number(summary.draft || 0);
  const total = Number(summary.total || 0);
  const pending = Math.max(total - ready - draft, 0);
  return `正式 ${ready} · 自练 ${draft} · 待完善 ${pending}`;
});

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
  ensureYearSlotSelection();
}

function selectSubject(subjectId) {
  selectedSubjectKey.value = subjectId;
  const subject = navigationTree.value.find((item) => item.id === subjectId);
  const track = subject?.tracks?.find((item) => item.banks?.length) || subject?.tracks?.[0];
  selectedTrackId.value = track?.id || '';
  ensureYearSlotSelection();
}

function selectTrack(trackId) {
  selectedTrackId.value = trackId;
  ensureYearSlotSelection();
}

function ensureYearSlotSelection() {
  const slots = selectedTrack.value?.yearSlots || [];
  const firstClickable = slots.find((slot) => slot.clickable);
  const firstKnownSlot = slots.find((slot) => slot.status !== 'missing');
  const fallback = firstClickable || firstKnownSlot || slots[0];
  if (!slots.some((slot) => slot.id === selectedYearSlotId.value)) {
    selectedYearSlotId.value = fallback?.id || '';
  }
}

function selectYearSlot(slot) {
  selectedYearSlotId.value = slot.id;
}

async function loadAndStartSlot(slot) {
  if (!slot?.bankId || !slot.clickable) return;
  await loadAndStartPaper({ ...slot, id: slot.bankId });
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
    const changed = result.imported + (result.updated || 0);
    toast.success(changed > 0 ? `已同步 ${changed} 题` : '题库已是最新');
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

async function refreshAndStartPaper(paper) {
  await loadPaper(paper);
  startLoadedPaper(paper);
}

function startLoadedPaper(paper) {
  const bank = storageService.get('v30_bank', []);
  const ids = bank
    .filter((q) => q.paperId === paper.id || (q.source === paper.source && q.year === paper.year))
    .map((q) => q.id);
  if (ids.length > 0) {
    storageService.save('smart_review_ids', ids);
    uni.navigateTo({ url: `/pages/practice-sub/do-quiz?mode=smart_review&paperId=${encodeURIComponent(paper.id)}` });
    return;
  }
  uni.navigateTo({ url: `/pages/practice-sub/do-quiz?paperId=${encodeURIComponent(paper.id)}` });
}

onMounted(() => {
  ensureSelection();
});
</script>

<style scoped>
.qb-page {
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
  box-shadow: none;
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
  font-size: 32rpx;
  font-weight: 760;
  color: #1d1d1f;
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
  background: #ffffff;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 18rpx 48rpx rgba(15, 23, 42, 0.08);
}
.hero-kicker {
  display: block;
  color: #8e8e93;
  font-size: 18rpx;
  font-weight: 900;
  letter-spacing: 0;
}
.hero-title {
  display: block;
  margin-top: 12rpx;
  color: #1d1d1f;
  font-size: 42rpx;
  font-weight: 760;
  line-height: 1.15;
}
.hero-desc {
  display: block;
  margin-top: 14rpx;
  color: #5f6672;
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
  background: #f6f7f9;
  border: 1rpx solid rgba(0, 0, 0, 0.04);
}
.hero-metric + .hero-metric {
  margin-left: 12rpx;
}
.metric-value {
  display: block;
  color: #1d1d1f;
  font-size: 34rpx;
  font-weight: 760;
  line-height: 1;
}
.metric-label {
  display: block;
  margin-top: 8rpx;
  color: #8e8e93;
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
  background: #ffffff;
  color: #5f6672;
  font-size: 24rpx;
  font-weight: 800;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
}
.subject-tab + .subject-tab,
.track-pill + .track-pill {
  margin-left: 12rpx;
}
.subject-tab.active,
.track-pill.active {
  background: #1d1d1f;
  color: #ffffff;
  border-color: #1d1d1f;
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
  color: #1d1d1f;
  font-size: 34rpx;
  font-weight: 760;
}
.section-hint,
.section-meta {
  display: block;
  color: #8e8e93;
  font-size: 23rpx;
  margin-top: 8rpx;
}
.section-meta {
  flex-shrink: 0;
  margin-left: 16rpx;
  text-align: right;
}
.year-map {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
  padding: 0 24rpx;
}
.year-slot {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-height: 92rpx;
  padding: 12rpx 8rpx;
  border-radius: 18rpx;
  background: #ffffff;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  text-align: center;
}
.year-slot.active {
  border-color: rgba(29, 29, 31, 0.62);
  box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.08);
}
.year-slot.status-ready {
  background: #edf8f1;
}
.year-slot.status-draft {
  background: #fff7e8;
}
.year-slot.status-organizing {
  background: #eef4ff;
}
.year-slot.status-missing {
  background: #f2f3f5;
  opacity: 0.72;
}
.slot-year {
  display: block;
  color: #1d1d1f;
  font-size: 27rpx;
  font-weight: 900;
  line-height: 1;
}
.slot-status {
  display: block;
  margin-top: 9rpx;
  color: #5f6672;
  font-size: 18rpx;
  font-weight: 850;
  white-space: nowrap;
}
.status-ready .slot-status {
  color: #1f7a4d;
}
.status-draft .slot-status {
  color: #9a5b00;
}
.status-organizing .slot-status {
  color: #0068d6;
}
.slot-detail {
  margin: 18rpx 24rpx 28rpx;
  padding: 28rpx 24rpx;
  border-radius: 24rpx;
  background: #ffffff;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.06);
}
.slot-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.slot-title-block {
  flex: 1;
  min-width: 0;
  padding-right: 16rpx;
}
.slot-kicker {
  display: block;
  color: #8e8e93;
  font-size: 20rpx;
  font-weight: 900;
}
.slot-title {
  display: block;
  margin-top: 8rpx;
  color: #1d1d1f;
  font-size: 31rpx;
  font-weight: 860;
  line-height: 1.3;
}
.slot-badge {
  flex-shrink: 0;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #f2f3f5;
  color: #5f6672;
  font-size: 21rpx;
  font-weight: 900;
}
.slot-badge.status-ready {
  background: rgba(31, 122, 77, 0.12);
  color: #1f7a4d;
}
.slot-badge.status-draft {
  background: rgba(255, 149, 0, 0.14);
  color: #9a5b00;
}
.slot-badge.status-organizing {
  background: rgba(0, 113, 227, 0.12);
  color: #0068d6;
}
.slot-desc {
  display: block;
  margin-top: 14rpx;
  color: #5f6672;
  font-size: 24rpx;
  line-height: 1.45;
}
.slot-caution {
  display: block;
  margin-top: 10rpx;
  color: #8e8e93;
  font-size: 22rpx;
  line-height: 1.45;
}
.slot-sections {
  margin-top: 16rpx;
}
.slot-action {
  margin-top: 22rpx;
}
.paper-list {
  padding: 0 24rpx;
}
.paper-card {
  padding: 28rpx 24rpx;
  margin-bottom: 18rpx;
  border-radius: 24rpx;
  background: #ffffff;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 10rpx 28rpx rgba(15, 23, 42, 0.06);
}
.paper-main {
  display: flex;
}
.paper-year {
  flex-shrink: 0;
  width: 104rpx;
  color: #1d1d1f;
  font-size: 36rpx;
  font-weight: 760;
  line-height: 1;
}
.paper-copy {
  flex: 1;
  min-width: 0;
}
.paper-name {
  display: block;
  color: #1d1d1f;
  font-size: 30rpx;
  font-weight: 760;
}
.paper-release-label {
  display: inline-flex;
  align-self: flex-start;
  margin-top: 10rpx;
  padding: 5rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(31, 122, 77, 0.1);
  color: #1f7a4d;
  font-size: 20rpx;
  font-weight: 850;
}
.paper-desc {
  display: block;
  margin-top: 8rpx;
  color: #5f6672;
  font-size: 23rpx;
  line-height: 1.45;
}
.paper-caution {
  display: block;
  margin-top: 8rpx;
  color: #8e8e93;
  font-size: 22rpx;
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
  background: #f2f3f5;
  color: #5f6672;
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
  border-radius: 16rpx;
  font-size: 25rpx;
  font-weight: 900;
}
.paper-btn.primary {
  background: #1d1d1f;
  color: #fff;
}
.paper-btn.secondary {
  background: #e8f4ee;
  color: #1f7a4d;
}
.pending-panel {
  margin: 30rpx 24rpx 0;
  padding: 26rpx 24rpx;
  border-radius: 24rpx;
  background: #ffffff;
  border: 1rpx solid rgba(0, 0, 0, 0.06);
}
.pending-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.pending-title {
  color: #1d1d1f;
  font-size: 28rpx;
  font-weight: 900;
}
.pending-sub {
  color: #8e8e93;
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
  color: #1d1d1f;
  font-size: 25rpx;
  font-weight: 820;
}
.pending-reason {
  display: block;
  margin-top: 6rpx;
  color: #8e8e93;
  font-size: 22rpx;
  line-height: 1.35;
}
.pending-year {
  color: #1d1d1f;
  font-size: 26rpx;
  font-weight: 900;
}
.empty-state {
  margin: 34rpx 24rpx;
  padding: 56rpx 32rpx;
  border-radius: 24rpx;
  background: #ffffff;
  text-align: center;
  color: #8e8e93;
}
.empty-text {
  display: block;
  margin-top: 18rpx;
  color: #1d1d1f;
  font-size: 30rpx;
  font-weight: 850;
}
.empty-sub {
  display: block;
  margin-top: 10rpx;
  color: #8e8e93;
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
