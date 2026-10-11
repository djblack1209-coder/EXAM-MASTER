<template>
  <view ref="keyboardRoot" :class="['qb-page', { 'dark-mode': isDark, 'theme-light': !isDark }]">
    <view class="navbar">
      <view class="navbar-inner" :style="{ paddingTop: statusBarHeight + 'px' }">
        <view class="nav-back" aria-label="返回" role="button" tabindex="0" data-learning-toggle @tap="goBack">
          <BaseIcon name="arrow-left" :size="32" />
        </view>
        <text class="nav-title">真题库</text>
        <view class="nav-right" />
      </view>
    </view>

    <scroll-view class="scroll-body" scroll-y :style="{ paddingTop: statusBarHeight + 44 + 'px' }">
      <view class="paper-hero">
        <text class="hero-title">按年份刷真题</text>
        <view class="hero-metrics">
          <view class="hero-metric">
            <text class="metric-value">{{ readyCount }}</text>
            <text class="metric-label">正式</text>
          </view>
          <view class="hero-metric">
            <text class="metric-value">{{ organizingCount }}</text>
            <text class="metric-label">整理中</text>
          </view>
          <view class="hero-metric">
            <text class="metric-value">{{ missingCount }}</text>
            <text class="metric-label">待入库</text>
          </view>
        </view>
      </view>

      <view class="subject-tabs">
        <view
          v-for="subject in navigationTree"
          :key="subject.id"
          class="subject-tab"
          role="button"
          tabindex="0"
          data-learning-toggle
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
          role="button"
          tabindex="0"
          data-learning-toggle
          :class="{ active: selectedTrack?.id === track.id }"
          @tap="selectTrack(track.id)"
        >
          <text class="track-code">{{ track.code }}</text>
          <text>{{ track.label }}</text>
        </view>
      </view>

      <view v-if="recommendedSlot" class="recommended-panel">
        <view class="recommended-copy">
          <view class="recommended-kicker-row">
            <text class="recommended-pill">{{ recommendedLocalState.label }}</text>
          </view>
          <text class="recommended-title">{{ recommendedSlot.name }}</text>
        </view>
        <view class="recommended-meta-row">
          <view class="recommended-meta-item">
            <text class="recommended-meta-label">方向</text>
            <text class="recommended-meta-value">{{ selectedTrack?.code || '--' }}</text>
          </view>
          <view class="recommended-meta-item">
            <text class="recommended-meta-label">年份</text>
            <text class="recommended-meta-value">{{ recommendedSlot.year }}</text>
          </view>
          <view class="recommended-meta-item">
            <text class="recommended-meta-label">可练题目</text>
            <text class="recommended-meta-value">{{ recommendedLocalState.countText }}</text>
          </view>
        </view>
        <view
          class="recommended-action"
          role="button"
          tabindex="0"
          data-learning-toggle
          hover-class="btn-hover"
          @tap="loadAndStartSlot(recommendedSlot)"
        >
          <text>{{ recommendedActionText }}</text>
          <BaseIcon name="arrow-right" :size="24" />
        </view>
      </view>

      <view class="section-head">
        <view>
          <text class="section-title">{{ selectedTrack?.label || '公共课' }}</text>
          <text class="section-meta">{{ selectedYearRangeText }}</text>
        </view>
        <text class="section-meta">{{ selectedTrackSlotText }}</text>
      </view>

      <view v-if="selectedYearSlots.length > 0" class="year-map">
        <view
          v-for="slot in selectedYearSlots"
          :key="slot.id"
          class="year-slot"
          role="button"
          tabindex="0"
          data-learning-toggle
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
        <text v-if="!selectedYearSlot.clickable" class="slot-caution">{{ selectedYearSlot.disabledReason }}</text>
        <view v-if="selectedYearSlot.clickable" class="local-sync-strip">
          <view class="local-sync-item">
            <text class="local-sync-label">本地状态</text>
            <text class="local-sync-value">{{ getPaperLocalState(selectedYearSlot).label }}</text>
          </view>
          <view class="local-sync-item">
            <text class="local-sync-label">可练题目</text>
            <text class="local-sync-value">{{ getPaperLocalState(selectedYearSlot).countText }}</text>
          </view>
        </view>
        <view v-if="selectedYearSlot.sections?.length" class="paper-section-row slot-sections">
          <text v-for="section in selectedYearSlot.sections" :key="section" class="paper-section">{{ section }}</text>
        </view>
        <view
          v-if="selectedYearSlot.clickable"
          class="paper-btn primary slot-action"
          role="button"
          tabindex="0"
          data-learning-toggle
          hover-class="btn-hover"
          @tap="loadAndStartSlot(selectedYearSlot)"
        >
          <text>{{ loadingBankId === selectedYearSlot.bankId ? '加载中' : selectedYearSlot.actionLabel }}</text>
        </view>
        <view v-else class="paper-btn muted slot-action slot-action-disabled" aria-disabled="true">
          <text>{{ selectedYearSlotReadiness.disabledActionLabel }}</text>
        </view>
      </view>

      <view v-if="secondaryReadyBanks.length > 0" class="paper-list">
        <view class="paper-list-head">
          <view>
            <text class="paper-list-title">更多可练整卷</text>
          </view>
          <text class="paper-list-count">{{ secondaryReadyBanks.length }} 卷</text>
        </view>
        <view v-for="paper in secondaryReadyBanks" :key="paper.id" class="paper-card">
          <view class="paper-main">
            <text class="paper-year">{{ paper.year }}</text>
            <view class="paper-copy">
              <text class="paper-name">{{ paper.name }}</text>
              <text v-if="paper.releaseLabel" class="paper-release-label">{{ paper.releaseLabel }}</text>

              <view class="paper-local-row">
                <text class="paper-local-pill" :class="{ synced: getPaperLocalState(paper).isSynced }">
                  {{ getPaperLocalState(paper).label }}
                </text>
                <text class="paper-local-count">{{ getPaperLocalState(paper).countText }}</text>
              </view>
              <view class="paper-section-row">
                <text v-for="section in paper.sections || []" :key="section" class="paper-section">{{ section }}</text>
              </view>
            </view>
          </view>
          <view class="paper-actions">
            <view
              v-if="!isBankLoaded(paper.id)"
              class="paper-btn primary"
              role="button"
              tabindex="0"
              data-learning-toggle
              hover-class="btn-hover"
              @tap="loadAndStartPaper(paper)"
            >
              <text>{{ loadingBankId === paper.id ? '加载中' : '开始' }}</text>
            </view>
            <view
              v-else
              class="paper-btn secondary"
              role="button"
              tabindex="0"
              data-learning-toggle
              hover-class="btn-hover"
              @tap="refreshAndStartPaper(paper)"
            >
              <text>继续</text>
            </view>
          </view>
        </view>
      </view>

      <view v-else-if="!recommendedSlot" class="empty-state">
        <BaseIcon name="book" :size="56" />
        <text class="empty-text">该方向暂无可练整卷</text>
      </view>

      <view v-if="selectedPendingBanks.length > 0" class="pending-panel">
        <view class="pending-head">
          <text class="pending-title">整理中</text>
        </view>
        <view v-for="paper in selectedPendingBanks" :key="paper.id" class="pending-item">
          <view class="pending-copy">
            <text class="pending-name">{{ paper.name }}</text>
            <text class="pending-reason">{{ paper.disabledReason || qualityLabel(paper.quality) }}</text>
          </view>
          <text class="pending-year">{{ paper.year }}</text>
        </view>
      </view>

      <view v-if="selectedGapPreview.length > 0" class="gap-panel">
        <view class="gap-head">
          <view>
            <text class="gap-title">待开放清单</text>
          </view>
          <text class="gap-count">{{ selectedGapSummary }}</text>
        </view>
        <view class="gap-list">
          <view v-for="slot in selectedGapPreview" :key="slot.id" class="gap-item" :class="`status-${slot.status}`">
            <view class="gap-year-block">
              <text class="gap-year">{{ slot.year }}</text>
              <text class="gap-status">{{ slot.statusLabel }}</text>
            </view>
            <view class="gap-copy">
              <text class="gap-name">{{ slot.name }}</text>
              <text class="gap-reason">{{ buildGapReason(slot) }}</text>
              <text class="gap-next">{{ buildGapNextStep(slot) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="bottom-spacer" />
    </scroll-view>
  </view>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { safeNavigateBack, safeNavigateTo } from '@/utils/safe-navigate';
import { getPracticeNavigationTree } from '@/config/bank-registry.js';
import { loadBankData } from './bank-data-loader.js';
import { importFlashcardsToBank } from '@/utils/flashcard-adapter.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import storageService from '@/services/storageService.js';
import { getUserId, getToken } from '@/services/auth-storage.js';
import { toast } from '@/utils/toast.js';
import { logger } from '@/utils/logger.js';

const keyboardRoot = ref(null);
let unbindKeyboard = () => undefined;

const isDark = ref(storageService.get('theme_mode', 'light') === 'dark');
const pageOwner = getUserId() || '';
const pageToken = getToken() || '';
const ownerMatches = () => (getUserId() || '') === pageOwner && (getToken() || '') === pageToken;
const _themeHandler = (mode) => {
  isDark.value = mode === 'dark';
};
uni.$on('themeUpdate', _themeHandler);
onBeforeUnmount(() => {
  unbindKeyboard();
  uni.$off('themeUpdate', _themeHandler);
});

const statusBarHeight = ref(getStatusBarHeight());
const loadingBankId = ref('');
const selectedSubjectKey = ref('');
const selectedTrackId = ref('');
const loadedBankIds = ref(new Set(readLocalArray('loaded_flashcard_banks')));
const navigationTree = computed(() => getPracticeNavigationTree(storageService.get('exam_profile', null) || {}));
const allTracks = computed(() => navigationTree.value.flatMap((subject) => subject.tracks || []));
const readyCount = computed(() => allTracks.value.reduce((sum, track) => sum + (track.slotSummary?.ready || 0), 0));
const organizingCount = computed(() =>
  allTracks.value.reduce((sum, track) => sum + (track.slotSummary?.organizing || 0), 0)
);
const missingCount = computed(() => allTracks.value.reduce((sum, track) => sum + (track.slotSummary?.missing || 0), 0));

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
  const organizing = Number(summary.organizing || 0);
  const missing = Number(summary.missing || 0);
  return `正式 ${ready} · 整理中 ${organizing} · 待入库 ${missing}`;
});
const selectedYearRangeText = computed(() => {
  const years = selectedYearSlots.value.map((slot) => Number(slot.year)).filter(Number.isFinite);
  if (!years.length) return '2005-2026';
  return `${Math.min(...years)}-${Math.max(...years)}`;
});
const selectedYearSlotReadiness = computed(() => buildYearSlotReadiness(selectedYearSlot.value));
const localPaperStats = ref(buildLocalPaperStats());
const recommendedSlot = computed(() => selectedYearSlots.value.find((slot) => slot.clickable) || null);
const secondaryReadyBanks = computed(() => {
  const recommendedBankId = recommendedSlot.value?.bankId || '';
  return selectedReadyBanks.value.filter((paper) => paper.id !== recommendedBankId);
});
const recommendedLocalState = computed(() => getPaperLocalState(recommendedSlot.value));
const recommendedActionText = computed(() => {
  if (!recommendedSlot.value) return '暂不可开始';
  if (loadingBankId.value === recommendedSlot.value.bankId) return '加载中';
  return recommendedLocalState.value.isSynced ? '继续本卷' : '同步并开始';
});
const selectedGapSlots = computed(() => selectedYearSlots.value.filter((slot) => !slot.clickable));
const selectedGapPreview = computed(() => selectedGapSlots.value.slice(0, 6));
const selectedGapSummary = computed(() => {
  const organizing = selectedGapSlots.value.filter((slot) => slot.status === 'organizing').length;
  const missing = selectedGapSlots.value.filter((slot) => slot.status === 'missing').length;
  return `整理中 ${organizing} · 待入库 ${missing}`;
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

function selectBank(bankId) {
  if (!bankId) return;
  for (const subject of navigationTree.value) {
    for (const track of subject.tracks || []) {
      const slot = (track.yearSlots || []).find((item) => item.bankId === bankId);
      if (slot) {
        selectedSubjectKey.value = subject.id;
        selectedTrackId.value = track.id;
        selectedYearSlotId.value = slot.id;
        return;
      }
    }
  }
}

function getCurrentRouteBankId() {
  if (typeof getCurrentPages !== 'function') return '';
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  return decodeURIComponent(current?.options?.bankId || '');
}

async function loadAndStartSlot(slot) {
  if (!slot?.bankId || !slot.clickable) return;
  await loadAndStartPaper({ ...slot, id: slot.bankId });
}

function isBankLoaded(bankId) {
  return loadedBankIds.value.has(bankId);
}

function readLocalArray(key) {
  if (!ownerMatches()) return [];
  try {
    const value = storageService.get(key, [], { migrateLegacy: false, throwOnError: true });
    return Array.isArray(value) ? value : [];
  } catch (_error) {
    return [];
  }
}

function buildLocalPaperStats() {
  const stats = {};
  const bank = readLocalArray('v30_bank');
  for (const item of bank) {
    const paperId = item?.paperId || '';
    if (!paperId) continue;
    stats[paperId] = (stats[paperId] || 0) + 1;
  }
  return stats;
}

function refreshLocalPaperStats() {
  localPaperStats.value = buildLocalPaperStats();
}

function getPaperLocalState(paper) {
  const paperId = paper?.bankId || paper?.id || '';
  const count = Number(localPaperStats.value[paperId] || 0);
  const isSynced = count > 0 || isBankLoaded(paperId);
  return {
    count,
    isSynced,
    label: isSynced ? '已同步' : '未同步',
    countText: count > 0 ? `${count} 题` : '待同步'
  };
}

function qualityLabel(quality) {
  if (quality === 'needs_passage') return '篇章材料完善中';
  if (quality === 'needs_review') return '题目与答案说明校对中';
  if (quality === 'needs_cleaning') return '题目与答案说明完善中';
  if (quality === 'source_missing') return '资料完善中';
  return '即将开放';
}

function buildYearSlotReadiness(slot) {
  if (!slot) {
    return {
      current: '请选择年份',
      next: '选择一个年份后查看训练状态。',
      disabledActionLabel: '暂不可开始'
    };
  }

  if (slot.status === 'ready') {
    return {
      current: '已正式开放，可进入整卷训练',
      next: isBankLoaded(slot.bankId) ? '继续同步最新题目并进入本卷。' : '点击开始，同步题库后进入本卷。',
      disabledActionLabel: ''
    };
  }

  if (slot.status === 'organizing') {
    return {
      current: slot.disabledReason || qualityLabel(slot.quality),
      next: '整理完成后开放开始入口，年份地图会自动切换为正式。',
      disabledActionLabel: '整理中，暂不可开始'
    };
  }

  return {
    current: '资料暂未入库',
    next: slot.disabledReason || '资料入库并完成答案说明后开放训练。',
    disabledActionLabel: '待入库后开放'
  };
}

function buildGapReason(slot) {
  if (slot?.status === 'organizing') {
    return slot.disabledReason || qualityLabel(slot.quality);
  }
  return '资料暂未入库';
}

function buildGapNextStep(slot) {
  if (slot?.status === 'organizing') {
    return '资料完善后会开放整卷训练入口。';
  }
  return slot?.disabledReason || '资料入库并完成答案说明后开放。';
}

async function loadPaper(paper) {
  if (!ownerMatches()) {
    toast.info('账户已变化，请返回题库重新选择');
    return null;
  }
  if (!paper?.id) {
    toast.error('试卷信息缺失');
    return null;
  }
  if (loadingBankId.value) return null;

  loadingBankId.value = paper.id;
  try {
    const data = await loadBankData(paper.id);
    if (!ownerMatches()) {
      toast.info('账户已变化，请返回题库重新选择');
      return null;
    }
    const adapter = {
      get: (key) => {
        if (!ownerMatches()) throw new Error('CONTEXT_CHANGED');
        return storageService.get(key, [], { migrateLegacy: false, throwOnError: true });
      },
      set: (key, value) => ownerMatches() && storageService.save(key, value, true) === true
    };
    const result = importFlashcardsToBank(data, adapter, {
      paperId: paper.id,
      paperName: paper.name,
      subject: paper.subject
    });
    if (!ownerMatches()) return null;
    const loaded = [...storageService.get('loaded_flashcard_banks', [], { migrateLegacy: false, throwOnError: true })];
    if (!loaded.includes(paper.id)) {
      loaded.push(paper.id);
      if (!storageService.save('loaded_flashcard_banks', loaded, true)) throw new Error('SAVE_FAILED');
    }
    loadedBankIds.value = new Set(loaded);
    refreshLocalPaperStats();
    const changed = result.imported + (result.updated || 0);
    toast.success(changed > 0 ? `已同步 ${changed} 题` : '题库已是最新');
    return result;
  } catch (error) {
    logger.error('[QuestionBank] load paper failed:', error);
    toast.error('试卷加载失败');
    return null;
  } finally {
    loadingBankId.value = '';
  }
}

async function loadAndStartPaper(paper) {
  const result = await loadPaper(paper);
  startLoadedPaper(paper, result);
}

async function refreshAndStartPaper(paper) {
  const result = await loadPaper(paper);
  startLoadedPaper(paper, result);
}

function getPaperQuestionIds(paper) {
  if (!paper?.id) return [];
  const bank = storageService.get('v30_bank', [], { migrateLegacy: false, throwOnError: true });
  if (!Array.isArray(bank)) return [];
  return bank.filter((q) => q?.paperId === paper.id).map((q) => q.id ?? q._id);
}

function startLoadedPaper(paper, loadResult) {
  if (!loadResult || !ownerMatches()) return false;
  try {
    const ids = getPaperQuestionIds(paper);
    if (ids.length === 0) {
      toast.error('本卷暂无可练题目');
      return false;
    }
    const result = storageService.prepareQuizReview({ ids, expectedOwner: pageOwner, paperId: paper.id });
    if (!result.success || !ownerMatches()) {
      toast.error('本卷原题未确认保存，请重试');
      return false;
    }
    safeNavigateTo(result.url);
    return true;
  } catch (_error) {
    toast.error('本卷原题暂不可读取，请重试');
    return false;
  }
}

onMounted(() => {
  unbindKeyboard = bindLearningKeyboard(keyboardRoot.value);
  ensureSelection();
  selectBank(getCurrentRouteBankId());
});
</script>

<style lang="scss" scoped>
.qb-page [role='button'] {
  min-height: 44px;
  touch-action: manipulation;
}
.qb-page [role='button']:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

.qb-page.dark-mode {
  --muted-foreground: #d2c8e5;
}

.qb-page {
  --muted-foreground: #62576d;
  min-height: 100vh;

  background: var(--yozi-background);
  color: #1d1d1f;

  font-family: 'DM Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;

  border-bottom: 1rpx solid rgba(0, 0, 0, 0.06);

  @include em-mobile-topbar;
}
.navbar-inner {
  display: flex;
  align-items: center;
  height: 44px;
  padding: 0 16px;
}
.nav-back {
  width: 44px;
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

  border-radius: 24px;

  background: var(--yozi-reading);

  border: 0;

  box-shadow: var(--yozi-shadow);
}
.hero-kicker {
  display: block;
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 18rpx);
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
  font-size: 12px;
  font-size: max(12px, 25rpx);
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
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 21rpx);
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

  min-height: 44px;
  padding: 0 24rpx;

  border-radius: 12px;

  background: var(--yozi-glass);
  color: #5f6672;
  font-size: 12px;
  font-size: max(12px, 24rpx);
  font-weight: 800;
  border: 1rpx solid rgba(0, 0, 0, 0.06);

  box-shadow: var(--yozi-control-shadow);
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
.recommended-panel {
  margin: 24rpx 24rpx 6rpx;
  padding: 28rpx 24rpx;

  border-radius: 24px;

  background: var(--yozi-reading);

  border: 0;

  box-shadow: var(--yozi-shadow);
}
.recommended-kicker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.recommended-kicker {
  color: #1f7a4d;
  font-size: 12px;
  font-size: max(12px, 20rpx);
  font-weight: 900;
}
.recommended-pill {
  padding: 5rpx 12rpx;
  border-radius: 999rpx;
  background: rgba(31, 122, 77, 0.1);
  color: #1f7a4d;
  font-size: 12px;
  font-size: max(12px, 20rpx);
  font-weight: 850;
}
.recommended-title {
  display: block;
  margin-top: 10rpx;
  color: #1d1d1f;
  font-size: 32rpx;
  font-weight: 900;
  line-height: 1.25;
}
.recommended-desc {
  display: block;
  margin-top: 10rpx;
  color: #5f6672;
  font-size: 12px;
  font-size: max(12px, 23rpx);
  line-height: 1.45;
}
.recommended-meta-row {
  display: flex;
  margin-top: 20rpx;
  padding: 16rpx;
  border-radius: 18rpx;
  background: #f6f7f9;
}
.recommended-meta-item {
  flex: 1;
  min-width: 0;
}
.recommended-meta-item + .recommended-meta-item {
  margin-left: 14rpx;
  padding-left: 14rpx;
  border-left: 1rpx solid rgba(0, 0, 0, 0.06);
}
.recommended-meta-label {
  display: block;
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 18rpx);
  font-weight: 900;
}
.recommended-meta-value {
  display: block;
  margin-top: 8rpx;
  color: #1d1d1f;
  font-size: 12px;
  font-size: max(12px, 24rpx);
  font-weight: 900;
  line-height: 1.2;
}
.recommended-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 76rpx;
  margin-top: 22rpx;

  font-size: 12px;
  font-size: max(12px, 25rpx);
  font-weight: 900;

  @include em-mobile-primary-action;
}
.recommended-action text {
  margin-right: 8rpx;
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
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 23rpx);
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

  min-height: 44px;
  padding: 12rpx 8rpx;

  border-radius: 12px;

  background: var(--yozi-glass);
  border: 1rpx solid rgba(0, 0, 0, 0.06);
  text-align: center;

  box-shadow: var(--yozi-control-shadow);
}
.year-slot.active {
  border-color: rgba(29, 29, 31, 0.62);
  box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.08);
}
.year-slot.status-ready {
  background: #edf8f1;
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
  font-size: 12px;
  font-size: max(12px, 27rpx);
  font-weight: 900;
  line-height: 1;
}
.slot-status {
  display: block;
  margin-top: 9rpx;
  color: #5f6672;
  font-size: 12px;
  font-size: max(12px, 18rpx);
  font-weight: 850;
  white-space: nowrap;
}
.status-ready .slot-status {
  color: #1f7a4d;
}
.status-organizing .slot-status {
  color: #0068d6;
}
.slot-detail {
  margin: 18rpx 24rpx 28rpx;
  padding: 28rpx 24rpx;

  border-radius: 24px;

  background: var(--yozi-reading);

  border: 0;

  box-shadow: var(--yozi-shadow);
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
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 20rpx);
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
  font-size: 12px;
  font-size: max(12px, 21rpx);
  font-weight: 900;
}
.slot-badge.status-ready {
  background: rgba(31, 122, 77, 0.12);
  color: #1f7a4d;
}
.slot-badge.status-organizing {
  background: rgba(0, 113, 227, 0.12);
  color: #0068d6;
}
.slot-desc {
  display: block;
  margin-top: 14rpx;
  color: #5f6672;
  font-size: 12px;
  font-size: max(12px, 24rpx);
  line-height: 1.45;
}
.slot-caution {
  display: block;
  margin-top: 10rpx;
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 22rpx);
  line-height: 1.45;
}
.local-sync-strip {
  display: flex;
  margin-top: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 18rpx;
  background: #f6f7f9;
  border: 1rpx solid rgba(0, 0, 0, 0.04);
}
.local-sync-item {
  flex: 1;
  min-width: 0;
}
.local-sync-item + .local-sync-item {
  margin-left: 18rpx;
  padding-left: 18rpx;
  border-left: 1rpx solid rgba(0, 0, 0, 0.06);
}
.local-sync-label {
  display: block;
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 19rpx);
  font-weight: 900;
}
.local-sync-value {
  display: block;
  margin-top: 8rpx;
  color: #1d1d1f;
  font-size: 12px;
  font-size: max(12px, 24rpx);
  font-weight: 860;
  line-height: 1.25;
}
.slot-readiness-panel {
  display: flex;
  margin-top: 18rpx;
  padding: 20rpx;
  border-radius: 20rpx;
  background: #f6f7f9;
  border: 1rpx solid rgba(0, 0, 0, 0.04);
}
.slot-readiness-panel.status-ready {
  background: #edf8f1;
  border-color: rgba(31, 122, 77, 0.12);
}
.slot-readiness-panel.status-organizing {
  background: #eef4ff;
  border-color: rgba(0, 104, 214, 0.12);
}
.slot-readiness-item {
  flex: 1;
  min-width: 0;
}
.slot-readiness-divider {
  width: 1rpx;
  margin: 0 18rpx;
  background: rgba(0, 0, 0, 0.06);
}
.readiness-label-row {
  display: flex;
  align-items: center;
}
.readiness-dot {
  width: 12rpx;
  height: 12rpx;
  margin-right: 8rpx;
  border-radius: 999rpx;
  background: #8e8e93;
}
.readiness-dot.status-ready {
  background: #1f7a4d;
}
.readiness-dot.status-organizing {
  background: #0068d6;
}
.readiness-label {
  display: block;
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 19rpx);
  font-weight: 900;
  line-height: 1.2;
}
.readiness-value {
  display: block;
  margin-top: 9rpx;
  color: #1d1d1f;
  font-size: 12px;
  font-size: max(12px, 23rpx);
  font-weight: 760;
  line-height: 1.35;
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
.paper-list-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding: 4rpx 8rpx 18rpx;
}
.paper-list-title {
  display: block;
  color: #1d1d1f;
  font-size: 12px;
  font-size: max(12px, 28rpx);
  font-weight: 900;
}
.paper-list-sub,
.paper-list-count {
  display: block;
  margin-top: 6rpx;
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 21rpx);
  font-weight: 760;
}
.paper-list-count {
  flex-shrink: 0;
  margin-left: 16rpx;
  text-align: right;
}
.paper-card {
  padding: 28rpx 24rpx;
  margin-bottom: 18rpx;

  border-radius: 24px;

  background: var(--yozi-reading);

  border: 0;

  box-shadow: var(--yozi-shadow);
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
  font-size: 12px;
  font-size: max(12px, 20rpx);
  font-weight: 850;
}
.paper-desc {
  display: block;
  margin-top: 8rpx;
  color: #5f6672;
  font-size: 12px;
  font-size: max(12px, 23rpx);
  line-height: 1.45;
}
.paper-caution {
  display: block;
  margin-top: 8rpx;
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 22rpx);
  line-height: 1.45;
}
.paper-local-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 12rpx;
}
.paper-local-pill {
  margin-right: 10rpx;
  margin-bottom: 8rpx;
  padding: 5rpx 12rpx;
  border-radius: 999rpx;
  background: #eef0f3;
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 20rpx);
  font-weight: 850;
}
.paper-local-pill.synced {
  background: rgba(31, 122, 77, 0.1);
  color: #1f7a4d;
}
.paper-local-count {
  margin-bottom: 8rpx;
  color: #5f6672;
  font-size: 12px;
  font-size: max(12px, 21rpx);
  font-weight: 760;
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
  font-size: 12px;
  font-size: max(12px, 20rpx);
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
  font-size: 12px;
  font-size: max(12px, 25rpx);
  font-weight: 900;
}
.paper-btn.primary {
  @include em-mobile-primary-action;
}
.paper-btn.secondary {
  background: var(--yozi-glass);

  color: var(--text-main);

  border-radius: 12px;

  min-height: 44px;

  box-shadow: var(--yozi-control-shadow);
}
.paper-btn.muted {
  background: #eef0f3;
  color: var(--muted-foreground);
}
.slot-action-disabled {
  border: 1rpx solid rgba(0, 0, 0, 0.04);
}
.pending-panel {
  margin: 30rpx 24rpx 0;
  padding: 26rpx 24rpx;

  border-radius: 24px;

  background: var(--yozi-reading);

  border: 0;

  box-shadow: var(--yozi-shadow);
}
.pending-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.pending-title {
  color: #1d1d1f;
  font-size: 12px;
  font-size: max(12px, 28rpx);
  font-weight: 900;
}
.pending-sub {
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 21rpx);
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
  font-size: 12px;
  font-size: max(12px, 25rpx);
  font-weight: 820;
}
.pending-reason {
  display: block;
  margin-top: 6rpx;
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 22rpx);
  line-height: 1.35;
}
.pending-year {
  color: #1d1d1f;
  font-size: 12px;
  font-size: max(12px, 26rpx);
  font-weight: 900;
}
.gap-panel {
  margin: 30rpx 24rpx 0;
  padding: 26rpx 24rpx;

  border-radius: 24px;

  background: var(--yozi-reading);

  border: 0;

  box-shadow: var(--yozi-shadow);
}
.gap-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.gap-title {
  display: block;
  color: #1d1d1f;
  font-size: 12px;
  font-size: max(12px, 28rpx);
  font-weight: 900;
}
.gap-sub,
.gap-count {
  display: block;
  margin-top: 6rpx;
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 21rpx);
  font-weight: 760;
}
.gap-count {
  flex-shrink: 0;
  margin-left: 16rpx;
  text-align: right;
}
.gap-list {
  margin-top: 8rpx;
}
.gap-item {
  display: flex;
  padding: 18rpx 0;
  border-top: 1rpx solid rgba(0, 0, 0, 0.06);
}
.gap-year-block {
  flex-shrink: 0;
  width: 96rpx;
  padding-top: 2rpx;
}
.gap-year {
  display: block;
  color: #1d1d1f;
  font-size: 12px;
  font-size: max(12px, 28rpx);
  font-weight: 900;
  line-height: 1;
}
.gap-status {
  display: inline-flex;
  margin-top: 10rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: #eef0f3;
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 18rpx);
  font-weight: 850;
}
.gap-item.status-organizing .gap-status {
  background: rgba(0, 104, 214, 0.1);
  color: #0068d6;
}
.gap-copy {
  flex: 1;
  min-width: 0;
  padding-left: 14rpx;
}
.gap-name {
  display: block;
  color: #1d1d1f;
  font-size: 12px;
  font-size: max(12px, 24rpx);
  font-weight: 820;
  line-height: 1.35;
}
.gap-reason,
.gap-next {
  display: block;
  margin-top: 7rpx;
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 21rpx);
  line-height: 1.4;
}
.gap-next {
  color: #5f6672;
}
.empty-state {
  margin: 34rpx 24rpx;
  padding: 56rpx 32rpx;

  border-radius: 24px;

  background: var(--yozi-reading);
  text-align: center;
  color: var(--muted-foreground);

  border: 0;

  box-shadow: var(--yozi-shadow);
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
  color: var(--muted-foreground);
  font-size: 12px;
  font-size: max(12px, 24rpx);
  line-height: 1.45;
}
.bottom-spacer {
  height: 120rpx;
}
.dark-mode {
  background: var(--yozi-background);

  font-family: 'DM Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}
.dark-mode .navbar {
  border-bottom-color: rgba(255, 255, 255, 0.08);

  @include em-mobile-topbar;
}
.dark-mode .nav-title,
.dark-mode .hero-title,
.dark-mode .metric-value,
.dark-mode .section-title,
.dark-mode .slot-year,
.dark-mode .slot-title,
.dark-mode .local-sync-value,
.dark-mode .recommended-title,
.dark-mode .recommended-meta-value,
.dark-mode .readiness-value,
.dark-mode .paper-year,
.dark-mode .paper-list-title,
.dark-mode .paper-name,
.dark-mode .pending-title,
.dark-mode .pending-name,
.dark-mode .pending-year,
.dark-mode .gap-title,
.dark-mode .gap-year,
.dark-mode .gap-name,
.dark-mode .empty-text {
  color: #f5f7fb;
}
.dark-mode .paper-hero,
.dark-mode .subject-tab,
.dark-mode .track-pill,
.dark-mode .recommended-panel,
.dark-mode .slot-detail,
.dark-mode .paper-card,
.dark-mode .pending-panel,
.dark-mode .gap-panel,
.dark-mode .empty-state {
  background: var(--yozi-reading);
  border-color: rgba(255, 255, 255, 0.08);

  box-shadow: var(--yozi-shadow);

  border: 0;
}
.dark-mode .hero-metric,
.dark-mode .year-slot,
.dark-mode .recommended-meta-row,
.dark-mode .local-sync-strip,
.dark-mode .paper-section,
.dark-mode .paper-local-pill,
.dark-mode .paper-btn.muted {
  background: var(--muted);
  border-color: rgba(255, 255, 255, 0.07);
}
.dark-mode .year-slot.active {
  border-color: rgba(83, 146, 255, 0.72);
  box-shadow: 0 12rpx 30rpx rgba(0, 104, 214, 0.16);
}
.dark-mode .year-slot.status-ready,
.dark-mode .slot-readiness-panel.status-ready {
  background: rgba(35, 134, 91, 0.16);
  border-color: rgba(35, 134, 91, 0.24);
}
.dark-mode .year-slot.status-organizing,
.dark-mode .slot-readiness-panel.status-organizing {
  background: rgba(0, 104, 214, 0.16);
  border-color: rgba(83, 146, 255, 0.24);
}
.dark-mode .year-slot.status-missing,
.dark-mode .slot-readiness-panel {
  background: var(--muted);
  border-color: rgba(255, 255, 255, 0.07);
}
.dark-mode .subject-tab.active,
.dark-mode .track-pill.active,
.dark-mode .recommended-action,
.dark-mode .paper-btn.primary {
  background: var(--yozi-button);

  color: var(--yozi-button-ink);
  border-color: #5392ff;

  box-shadow: var(--yozi-button-shadow);

  border: 0;
}
.dark-mode .paper-btn.secondary {
  background: rgba(35, 134, 91, 0.18);
  color: #7ee0ac;
}
.dark-mode .paper-local-pill.synced {
  background: rgba(35, 134, 91, 0.18);
  color: #7ee0ac;
}
.dark-mode .paper-btn.muted {
  color: #8f98a8;
}
.dark-mode .hero-kicker,
.dark-mode .metric-label,
.dark-mode .recommended-meta-label,
.dark-mode .section-hint,
.dark-mode .section-meta,
.dark-mode .slot-kicker,
.dark-mode .slot-caution,
.dark-mode .local-sync-label,
.dark-mode .readiness-label,
.dark-mode .paper-list-sub,
.dark-mode .paper-list-count,
.dark-mode .pending-sub,
.dark-mode .pending-reason,
.dark-mode .gap-sub,
.dark-mode .gap-count,
.dark-mode .gap-reason,
.dark-mode .empty-sub {
  color: #8f98a8;
}
.dark-mode .hero-desc,
.dark-mode .subject-tab,
.dark-mode .track-pill,
.dark-mode .recommended-desc,
.dark-mode .slot-status,
.dark-mode .slot-desc,
.dark-mode .paper-desc,
.dark-mode .paper-caution,
.dark-mode .paper-local-count,
.dark-mode .gap-next,
.dark-mode .paper-section {
  color: #c4cad4;
}
.dark-mode .slot-readiness-divider,
.dark-mode .local-sync-item + .local-sync-item,
.dark-mode .recommended-meta-item + .recommended-meta-item,
.dark-mode .gap-item,
.dark-mode .pending-item {
  border-color: rgba(255, 255, 255, 0.08);
}
.dark-mode .recommended-kicker {
  color: #7ee0ac;
}
.dark-mode .recommended-pill {
  background: rgba(35, 134, 91, 0.18);
  color: #7ee0ac;
}
.dark-mode .gap-status {
  background: #292e39;
  color: #8f98a8;
}
.dark-mode .gap-item.status-organizing .gap-status {
  background: rgba(0, 104, 214, 0.18);
  color: #8bb8ff;
}
.dark-mode .slot-readiness-divider {
  background: rgba(255, 255, 255, 0.08);
}
</style>
