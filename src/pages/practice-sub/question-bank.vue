<template>
  <view
    ref="keyboardRoot"
    class="yozi-page"
    :style="$yoziInsets"
    :class="['qb-page', { 'dark-mode': isDark, 'theme-light': !isDark }]"
  >
    <view class="navbar">
      <view class="navbar-inner" :style="{ paddingTop: statusBarHeight + 'px' }">
        <BaseButton class="nav-back" :label="$t('ui.back')" data-learning-toggle variant="secondary" @tap="goBack"
          ><BaseIcon name="arrow-left"
        /></BaseButton>
        <text class="nav-title">{{ t('quiz.copy102') }}</text>
        <view class="nav-right" />
      </view>
    </view>

    <scroll-view class="scroll-body" scroll-y>
      <view class="paper-hero">
        <text class="hero-title">{{ t('quiz.copy103') }}</text>
        <view class="hero-metrics">
          <BaseStat :label="t('quiz.copy104')" :value="Number(readyCount) || 0" />
          <BaseStat :label="t('quiz.copy105')" :value="Number(organizingCount) || 0" />
          <BaseStat :label="t('quiz.copy106')" :value="Number(missingCount) || 0" />
        </view>
      </view>

      <view class="subject-tabs">
        <BaseChip
          v-for="subject in navigationTree"
          :key="subject.id"
          data-learning-toggle
          :model-value="selectedSubject?.id === subject.id"
          @update:model-value="selectSubject(subject.id)"
          ><text>{{ uiText(subject.label) }}</text></BaseChip
        >
      </view>

      <view class="track-row">
        <BaseChip
          v-for="track in selectedSubject?.tracks || []"
          :key="track.id"
          data-learning-toggle
          :model-value="selectedTrack?.id === track.id"
          @update:model-value="selectTrack(track.id)"
          ><text class="track-code">{{ track.code }}</text
          ><text>{{ uiText(track.label) }}</text></BaseChip
        >
      </view>

      <view v-if="recommendedSlot" class="recommended-panel">
        <view class="recommended-copy">
          <view class="recommended-kicker-row">
            <text class="recommended-pill">{{ uiText(recommendedLocalState.label) }}</text>
          </view>
          <text class="recommended-title">{{ uiText(recommendedSlot.name) }}</text>
        </view>
        <view class="recommended-meta-row">
          <view class="recommended-meta-item">
            <text class="recommended-meta-label">{{ t('quiz.copy107') }}</text>
            <text class="recommended-meta-value">{{ selectedTrack?.code || '--' }}</text>
          </view>
          <view class="recommended-meta-item">
            <text class="recommended-meta-label">{{ t('quiz.copy108') }}</text>
            <text class="recommended-meta-value">{{ recommendedSlot.year }}</text>
          </view>
          <view class="recommended-meta-item">
            <text class="recommended-meta-label">{{ t('quiz.copy109') }}</text>
            <text class="recommended-meta-value">{{ uiText(recommendedLocalState.countText) }}</text>
          </view>
        </view>
        <BaseButton
          class="recommended-action"
          data-learning-toggle
          variant="primary"
          @tap="loadAndStartSlot(recommendedSlot)"
          ><text>{{ uiText(recommendedActionText) }}</text
          ><BaseIcon name="arrow-right"
        /></BaseButton>
      </view>

      <view class="section-head">
        <view>
          <text class="section-title">{{ uiText(selectedTrack?.label || t('quiz.copy110')) }}</text>
          <text class="section-meta">{{ uiText(selectedYearRangeText) }}</text>
        </view>
        <text class="section-meta">{{ uiText(selectedTrackSlotText) }}</text>
      </view>

      <view v-if="selectedYearSlots.length > 0" class="year-map">
        <BaseChip
          v-for="slot in selectedYearSlots"
          :key="slot.id"
          class="year-slot"
          :class="{ active: selectedYearSlot?.id === slot.id }"
          data-learning-toggle
          :model-value="selectedYearSlot?.id === slot.id"
          @update:model-value="selectYearSlot(slot)"
          ><text class="slot-year">{{ slot.year }}</text
          ><text class="slot-status">{{ uiText(slot.statusLabel) }}</text></BaseChip
        >
      </view>

      <view v-if="selectedYearSlot" class="slot-detail">
        <view class="slot-detail-head">
          <view class="slot-title-block">
            <text class="slot-kicker">{{ selectedTrack?.code }} · {{ uiText(selectedYearSlot.statusLabel) }}</text>
            <text class="slot-title">{{ uiText(selectedYearSlot.name) }}</text>
          </view>
          <view class="slot-badge" :class="`status-${selectedYearSlot.status}`">
            <text>{{ uiText(selectedYearSlot.actionLabel) }}</text>
          </view>
        </view>
        <text class="slot-desc">{{ uiText(selectedYearSlot.description) }}</text>
        <text v-if="!selectedYearSlot.clickable" class="slot-caution">{{
          uiText(selectedYearSlot.disabledReason)
        }}</text>
        <view v-if="selectedYearSlot.clickable" class="local-sync-strip">
          <view class="local-sync-item">
            <text class="local-sync-label">{{ t('quiz.copy111') }}</text>
            <text class="local-sync-value">{{ uiText(getPaperLocalState(selectedYearSlot).label) }}</text>
          </view>
          <view class="local-sync-item">
            <text class="local-sync-label">{{ t('quiz.copy109') }}</text>
            <text class="local-sync-value">{{ uiText(getPaperLocalState(selectedYearSlot).countText) }}</text>
          </view>
        </view>
        <view v-if="selectedYearSlot.sections?.length" class="paper-section-row slot-sections">
          <text v-for="section in selectedYearSlot.sections" :key="section" class="paper-section">{{
            uiText(section)
          }}</text>
        </view>
        <BaseButton
          v-if="selectedYearSlot.clickable"
          class="paper-btn primary slot-action"
          data-learning-toggle
          variant="primary"
          @tap="loadAndStartSlot(selectedYearSlot)"
          ><text>{{
            uiText(loadingBankId === selectedYearSlot.bankId ? t('quiz.copy40') : selectedYearSlot.actionLabel)
          }}</text></BaseButton
        >
        <view v-else class="paper-btn muted slot-action slot-action-disabled" aria-disabled="true">
          <text>{{ uiText(selectedYearSlotReadiness.disabledActionLabel) }}</text>
        </view>
      </view>

      <view v-if="secondaryReadyBanks.length > 0" class="paper-list">
        <view class="paper-list-head">
          <view>
            <text class="paper-list-title">{{ t('quiz.copy112') }}</text>
          </view>
          <text class="paper-list-count">{{ t('quiz.copy113', { v0: secondaryReadyBanks.length }) }}</text>
        </view>
        <view v-for="paper in secondaryReadyBanks" :key="paper.id" class="paper-card">
          <view class="paper-main">
            <text class="paper-year">{{ paper.year }}</text>
            <view class="paper-copy">
              <text class="paper-name">{{ uiText(paper.name) }}</text>
              <text v-if="paper.releaseLabel" class="paper-release-label">{{ uiText(paper.releaseLabel) }}</text>

              <view class="paper-local-row">
                <text class="paper-local-pill" :class="{ synced: getPaperLocalState(paper).isSynced }">
                  {{ uiText(getPaperLocalState(paper).label) }}
                </text>
                <text class="paper-local-count">{{ uiText(getPaperLocalState(paper).countText) }}</text>
              </view>
              <view class="paper-section-row">
                <text v-for="section in paper.sections || []" :key="section" class="paper-section">{{
                  uiText(section)
                }}</text>
              </view>
            </view>
          </view>
          <view class="paper-actions">
            <BaseButton
              v-if="!isBankLoaded(paper.id)"
              class="paper-btn primary"
              data-learning-toggle
              variant="primary"
              @tap="loadAndStartPaper(paper)"
              ><text>{{ loadingBankId === paper.id ? t('quiz.copy40') : t('quiz.copy114') }}</text></BaseButton
            >
            <BaseButton
              v-else
              class="paper-btn secondary"
              data-learning-toggle
              variant="secondary"
              @tap="refreshAndStartPaper(paper)"
              ><text>{{ t('quiz.copy2') }}</text></BaseButton
            >
          </view>
        </view>
      </view>

      <view v-else-if="!recommendedSlot" class="empty-state yozi-icon-row">
        <BaseIcon name="book" />
        <text class="empty-text">{{ t('quiz.copy115') }}</text>
      </view>

      <view v-if="selectedPendingBanks.length > 0" class="pending-panel">
        <view class="pending-head">
          <text class="pending-title">{{ t('quiz.copy105') }}</text>
        </view>
        <view v-for="paper in selectedPendingBanks" :key="paper.id" class="pending-item">
          <view class="pending-copy">
            <text class="pending-name">{{ uiText(paper.name) }}</text>
            <text class="pending-reason">{{ uiText(paper.disabledReason || qualityLabel(paper.quality)) }}</text>
          </view>
          <text class="pending-year">{{ paper.year }}</text>
        </view>
      </view>

      <view v-if="selectedGapPreview.length > 0" class="gap-panel">
        <view class="gap-head">
          <view>
            <text class="gap-title">{{ t('quiz.copy116') }}</text>
          </view>
          <text class="gap-count">{{ selectedGapSummary }}</text>
        </view>
        <view class="gap-list">
          <view v-for="slot in selectedGapPreview" :key="slot.id" class="gap-item" :class="`status-${slot.status}`">
            <view class="gap-year-block">
              <text class="gap-year">{{ slot.year }}</text>
              <text class="gap-status">{{ uiText(slot.statusLabel) }}</text>
            </view>
            <view class="gap-copy">
              <text class="gap-name">{{ uiText(slot.name) }}</text>
              <text class="gap-reason">{{ uiText(buildGapReason(slot)) }}</text>
              <text class="gap-next">{{ uiText(buildGapNextStep(slot)) }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="bottom-spacer" />
    </scroll-view>
  </view>
</template>

<script setup>
import BaseStat from '@/components/base/base-stat/base-stat.vue';
const uiText = (value) => translateRegisteredText('quiz', value);
import '@/pages/practice-sub/messages.js';
import { t, translateRegisteredText } from '@/i18n/index.js';
import BaseChip from '@/components/base/base-chip/base-chip.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import '@/styles/yozi-pages.scss';

import { computed, ref, onMounted, onBeforeUnmount } from 'vue';
import { onHide, onShow, onUnload } from '@dcloudio/uni-app';
import { bindLearningKeyboard } from '@/services/learning/keyboard-controls.js';
import { safeNavigateBack, safeNavigateTo } from '@/utils/safe-navigate';
import { getPracticeNavigationTree } from '@/config/bank-registry.js';
import { loadBankData } from './bank-data-loader.js';
import { importFlashcardsToBank } from '@/utils/flashcard-adapter.js';
import { getStatusBarHeight } from '@/utils/core/system.js';
import storageService from '@/services/storageService.js';
import { getUserId, getToken } from '@/services/auth-storage.js';
import { toast } from '@/utils/toast.js';
import { useThemeStore } from '@/stores/modules/theme.js';
import { logger } from '@/utils/logger.js';

const keyboardRoot = ref(null);
let unbindKeyboard = () => undefined;

const isDark = computed(() => useThemeStore().isDark);
const pageOwner = getUserId() || '';
const pageToken = getToken() || '';
const ownerMatches = () => (getUserId() || '') === pageOwner && (getToken() || '') === pageToken;
const _themeHandler = (_mode) => {
  void 0;
};
uni.$on('themeUpdate', _themeHandler);
onBeforeUnmount(() => {
  leavePage();
  unbindKeyboard();
  uni.$off('themeUpdate', _themeHandler);
});

const statusBarHeight = ref(getStatusBarHeight());
const loadingBankId = ref('');
let pageActive = true;
let loadSequence = 0;
function leavePage() {
  pageActive = false;
  loadSequence += 1;
  loadingBankId.value = '';
}
onHide(leavePage);
onUnload(leavePage);
onShow(() => {
  pageActive = true;
});
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
  return t('quiz.copy117', { v0: ready, v1: organizing, v2: missing });
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
  if (!recommendedSlot.value) return t('quiz.copy118');
  if (loadingBankId.value === recommendedSlot.value.bankId) return t('quiz.copy40');
  return recommendedLocalState.value.isSynced ? t('quiz.copy119') : t('quiz.copy120');
});
const selectedGapSlots = computed(() => selectedYearSlots.value.filter((slot) => !slot.clickable));
const selectedGapPreview = computed(() => selectedGapSlots.value.slice(0, 6));
const selectedGapSummary = computed(() => {
  const organizing = selectedGapSlots.value.filter((slot) => slot.status === 'organizing').length;
  const missing = selectedGapSlots.value.filter((slot) => slot.status === 'missing').length;
  return t('quiz.copy121', { v0: organizing, v1: missing });
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
    label: isSynced ? t('quiz.copy122') : t('quiz.copy123'),
    countText: count > 0 ? t('quiz.copy124', { v0: count }) : t('quiz.copy125')
  };
}

function qualityLabel(quality) {
  if (quality === 'needs_passage') return t('quiz.copy126');
  if (quality === 'needs_review') return t('quiz.copy127');
  if (quality === 'needs_cleaning') return t('quiz.copy128');
  if (quality === 'source_missing') return t('quiz.copy129');
  return t('quiz.copy130');
}

function buildYearSlotReadiness(slot) {
  if (!slot) {
    return {
      current: t('quiz.copy131'),
      next: t('quiz.copy132'),
      disabledActionLabel: t('quiz.copy118')
    };
  }

  if (slot.status === 'ready') {
    return {
      current: t('quiz.copy133'),
      next: isBankLoaded(slot.bankId) ? t('quiz.copy134') : t('quiz.copy135'),
      disabledActionLabel: ''
    };
  }

  if (slot.status === 'organizing') {
    return {
      current: slot.disabledReason || qualityLabel(slot.quality),
      next: t('quiz.copy136'),
      disabledActionLabel: t('quiz.copy137')
    };
  }

  return {
    current: t('quiz.copy138'),
    next: slot.disabledReason || t('quiz.copy139'),
    disabledActionLabel: t('quiz.copy140')
  };
}

function buildGapReason(slot) {
  if (slot?.status === 'organizing') {
    return slot.disabledReason || qualityLabel(slot.quality);
  }
  return t('quiz.copy138');
}

function buildGapNextStep(slot) {
  if (slot?.status === 'organizing') {
    return t('quiz.copy141');
  }
  return slot?.disabledReason || t('quiz.copy142');
}

async function loadPaper(paper) {
  if (!pageActive) return null;
  if (!ownerMatches()) {
    toast.info(t('quiz.copy143'));
    return null;
  }
  if (!paper?.id) {
    toast.error(t('quiz.copy144'));
    return null;
  }
  if (loadingBankId.value) return null;

  loadingBankId.value = paper.id;
  const requestSequence = ++loadSequence;
  const requestIsCurrent = () => pageActive && requestSequence === loadSequence;
  try {
    const data = await loadBankData(paper.id);
    if (!requestIsCurrent()) return null;
    if (!ownerMatches()) {
      toast.info(t('quiz.copy143'));
      return null;
    }
    const adapter = {
      get: (key) => {
        if (!requestIsCurrent() || !ownerMatches()) throw new Error('CONTEXT_CHANGED');
        return storageService.get(key, [], { migrateLegacy: false, throwOnError: true });
      },
      set: (key, value) => requestIsCurrent() && ownerMatches() && storageService.save(key, value, true) === true
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
    toast.success(changed > 0 ? t('quiz.copy145', { v0: changed }) : t('quiz.copy146'));
    return { ...result, requestSequence };
  } catch (error) {
    if (!requestIsCurrent()) return null;
    if (!ownerMatches()) {
      toast.info(t('quiz.copy143'));
      return null;
    }
    logger.error('[QuestionBank] load paper failed:', error);
    toast.error(t('quiz.copy147'));
    return null;
  } finally {
    if (requestIsCurrent()) loadingBankId.value = '';
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
  if (!loadResult || !pageActive || loadResult.requestSequence !== loadSequence || !ownerMatches()) return false;
  try {
    const ids = getPaperQuestionIds(paper);
    if (ids.length === 0) {
      toast.error(t('quiz.copy148'));
      return false;
    }
    const result = storageService.prepareQuizReview({ ids, expectedOwner: pageOwner, paperId: paper.id });
    if (!result.success || !ownerMatches()) {
      toast.error(t('quiz.copy149'));
      return false;
    }
    safeNavigateTo(result.url);
    return true;
  } catch (_error) {
    toast.error(t('quiz.copy150'));
    return false;
  }
}

onMounted(() => {
  unbindKeyboard = bindLearningKeyboard(keyboardRoot.value);
  ensureSelection();
  selectBank(getCurrentRouteBankId());
});
</script>
