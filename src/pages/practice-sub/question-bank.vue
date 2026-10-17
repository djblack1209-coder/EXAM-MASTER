<template>
  <LearningShell ref="keyboardRoot" class="yozi-page" active="question-bank" :title="$t('pages.bank')">
    <template #controls
      ><BaseButton icon="arrow-left" icon-only variant="quiet" :label="$t('ui.back')" @tap="goBack"
    /></template>
    <scroll-view class="scroll-body" scroll-y>
      <view class="paper-hero"
        ><text class="hero-title">{{ t('quiz.copy103') }}</text></view
      >
      <view class="subject-tabs"
        ><BaseChip
          v-for="subject in navigationTree"
          :key="subject.id"
          :model-value="selectedSubject?.id === subject.id"
          @update:model-value="selectSubject(subject.id)"
          >{{ uiText(subject.label) }}</BaseChip
        ></view
      >
      <view v-if="(selectedSubject?.tracks?.length || 0) > 1" class="track-row"
        ><BaseChip
          v-for="track in selectedSubject?.tracks || []"
          :key="track.id"
          :model-value="selectedTrack?.id === track.id"
          @update:model-value="selectTrack(track.id)"
          >{{ uiText(track.label) }}</BaseChip
        ></view
      >
      <view class="section-head"
        ><text class="section-title">{{
          t('ui.bankAvailability', {
            name: uiText(selectedTrack?.label || t('pages.bank')),
            ready: selectedTrack?.slotSummary?.ready || 0,
            total: selectedYearSlots.length
          })
        }}</text
        ><text class="section-meta">{{ selectedYearRangeText }}</text></view
      >
      <view class="year-map"
        ><BaseChip
          v-for="slot in selectedYearSlots"
          :key="slot.id"
          class="year-slot"
          :class="{ active: selectedYearSlot?.id === slot.id }"
          :model-value="selectedYearSlot?.id === slot.id"
          @update:model-value="selectYearSlot(slot)"
          ><text class="slot-year">{{ slot.year }}</text
          ><text class="slot-status">{{ t(slot.clickable ? 'ui.paperOpen' : 'ui.paperClosed') }}</text></BaseChip
        ></view
      >
      <view v-if="selectedYearSlot" class="slot-detail">
        <text class="slot-title">{{ uiText(selectedYearSlot.name) }}</text>
        <view class="paper-section-row"
          ><text v-for="section in selectedYearSlot.sections || []" :key="section" class="paper-section">{{
            uiText(section)
          }}</text></view
        >
        <BaseButton
          v-if="selectedYearSlot.clickable"
          class="slot-action"
          variant="primary"
          icon="arrow-right"
          :loading="!!loadingBankId"
          :disabled="!!loadingBankId"
          @tap="loadAndStartSlot(selectedYearSlot)"
          >{{ t('ui.startPractice') }}</BaseButton
        >
        <BaseEmpty
          v-else
          :title="t('ui.paperUnavailable')"
          mascot-size="state"
          show-button
          :button-text="t('ui.choosePaper')"
          @action="chooseAvailablePaper"
        />
      </view>
      <BaseEmpty
        v-else
        :title="t('ui.paperUnavailable')"
        show-button
        :button-text="t('ui.learnNow')"
        @action="safeNavigateTo('/pages/learning/index')"
      />
    </scroll-view>
  </LearningShell>
</template>

<script setup>
import LearningShell from '@/components/business/learning/learning-shell.vue';
import BaseEmpty from '@/components/base/base-empty/base-empty.vue';
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

import storageService from '@/services/storageService.js';
import { captureSession, checkSession, getUserId } from '@/services/auth-storage.js';
import { toast } from '@/utils/toast.js';

import { logger } from '@/utils/logger.js';

const keyboardRoot = ref(null);
let unbindKeyboard = () => undefined;

const pageOwner = getUserId() || '';
const pageSession = captureSession();
const ownerMatches = () => checkSession(pageSession) === 'current';
const _themeHandler = (_mode) => {
  void 0;
};
uni.$on('themeUpdate', _themeHandler);
onBeforeUnmount(() => {
  leavePage();
  unbindKeyboard();
  uni.$off('themeUpdate', _themeHandler);
});

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

const navigationTree = computed(() => getPracticeNavigationTree(storageService.get('exam_profile', null) || {}));

const selectedSubject = computed(() => {
  const fallbackSubject = navigationTree.value[0] || null;
  return navigationTree.value.find((subject) => subject.id === selectedSubjectKey.value) || fallbackSubject;
});
const selectedTrack = computed(() => {
  const tracks = selectedSubject.value?.tracks || [];
  return tracks.find((track) => track.id === selectedTrackId.value) || tracks[0] || null;
});

const selectedYearSlots = computed(() => selectedTrack.value?.yearSlots || []);
const selectedYearSlotId = ref('');
const selectedYearSlot = computed(() => {
  return (
    selectedYearSlots.value.find((slot) => slot.id === selectedYearSlotId.value) || selectedYearSlots.value[0] || null
  );
});

const selectedYearRangeText = computed(() => {
  const years = selectedYearSlots.value.map((slot) => Number(slot.year)).filter(Number.isFinite);
  if (!years.length) return '2005-2026';
  return `${Math.min(...years)}-${Math.max(...years)}`;
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

function chooseAvailablePaper() {
  const first = selectedYearSlots.value.find((slot) => slot.clickable);
  if (first) selectedYearSlotId.value = first.id;
  else safeNavigateTo('/pages/learning/index');
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
  const session = captureSession();
  const requestSequence = ++loadSequence;
  const requestIsCurrent = () => pageActive && requestSequence === loadSequence;
  try {
    const data = await loadBankData(paper.id);
    if (!requestIsCurrent()) return null;
    if (checkSession(session) !== 'current' || !ownerMatches()) {
      toast.info(t('quiz.copy143'));
      return null;
    }
    const adapter = {
      get: (key) => {
        if (!requestIsCurrent() || !ownerMatches()) throw new Error('CONTEXT_CHANGED');
        return storageService.get(key, [], { migrateLegacy: false, throwOnError: true });
      },
      set: (key, value) =>
        requestIsCurrent() && ownerMatches() && storageService.save(key, value, true, session) === true
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
      if (!storageService.save('loaded_flashcard_banks', loaded, true, session)) throw new Error('SAVE_FAILED');
    }
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

<style scoped>
.paper-hero {
  margin-top: var(--s-5);
}
.year-map {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: var(--s-3);
  margin: var(--s-5) 0;
}
.year-map :deep(.base-chip) {
  flex-direction: column;
  gap: var(--s-1);
  border-radius: var(--r-md);
  padding: var(--s-3) var(--s-2);
}
.slot-status {
  display: block;
  font-size: var(--size-caption);
  margin-left: 0;
  white-space: nowrap;
}
.slot-detail {
  display: grid;
  justify-items: start;
  gap: var(--s-5);
}
.slot-detail .base-state {
  width: 100%;
  box-sizing: border-box;
}
</style>
