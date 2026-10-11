<template>
  <CustomModal
    :visible="visible"
    :is-dark="isDark"
    position="bottom"
    :title="t('quiz.copy39')"
    :show-actions="false"
    close-button
    mask-closable
    @cancel="emit('close')"
    ><view class="yozi-page-content">
      <view class="answer-sheet"
        ><!-- 拖拽指示条 --><view class="sheet-handle"> <view class="handle-bar" /> </view
        ><view v-if="jumpLocked" class="sheet-lock-notice">
          <text>{{ lockText ? uiText(lockText) : t('quiz.copy95') }}</text> </view
        ><!-- 统计摘要 --><view class="sheet-summary">
          <text class="summary-text">{{ t('quiz.copy151', { v0: answeredCount, v1: questions.length }) }}</text>
          <text class="summary-divider">·</text>
          <text
            class="summary-text"
            :class="{ 'accuracy-good': accuracy >= 60, 'accuracy-bad': accuracy < 60 && gradedCount > 0 }"
          >
            {{ gradedCount ? t('quiz.copy152', { v0: accuracy }) : t('quiz.copy153') }}
          </text>
          <text class="summary-divider">·</text>
          <text class="summary-text summary-muted">{{ t('quiz.copy154', { v0: remainingCount }) }}</text> </view
        ><view class="sheet-insight-row">
          <BaseStat :label="t('quiz.copy155')" :value="Number(correctCount) || 0" :denominator="gradedCount" />
          <BaseStat :label="t('quiz.copy156')" :value="Number(wrongCount) || 0" :denominator="gradedCount" />
          <BaseStat :label="t('quiz.copy157')" :value="Number(reviewedCount) || 0" />
          <BaseStat :label="t('quiz.copy158')" :value="Number(pendingCount) || 0" /> </view
        ><view v-if="legacyCount || unclassifiedCount" class="sheet-insight-row">
          <text v-if="legacyCount" class="summary-text">{{
            t('quiz.copy159', { v0: legacyCount, v1: legacyCorrectCount, v2: legacyWrongCount })
          }}</text>
          <text v-if="unclassifiedCount" class="summary-text">{{
            t('quiz.copy160', { v0: unclassifiedCount })
          }}</text> </view
        ><!-- 题号网格 --><scroll-view scroll-y class="sheet-grid-scroll">
          <view class="sheet-grid">
            <BaseButton
              v-for="(q, idx) in questions"
              :key="idx"
              variant="secondary"
              class="grid-cell"
              :class="cellClass(idx)"
              :disabled="jumpLocked"
              :selected="idx === currentIndex"
              :label="
                t('quiz.questionState', {
                  number: idx + 1,
                  state: t('quiz.state.' + (answeredMap[idx] || 'unanswered'))
                })
              "
              hover-class="cell-hover"
              @tap="handleJump(idx)"
            >
              <text class="cell-num">{{ idx + 1 }}</text>
            </BaseButton>
          </view> </scroll-view
        ><!-- 图例 --><view class="sheet-legend">
          <view class="legend-item">
            <view class="legend-dot dot-current" />
            <text class="legend-label">{{ t('quiz.copy161') }}</text>
          </view>
          <view class="legend-item">
            <view class="legend-dot dot-reviewed" />
            <text class="legend-label">{{ t('quiz.copy162') }}</text>
          </view>
          <view class="legend-item">
            <view class="legend-dot dot-reviewed" />
            <text class="legend-label">{{ t('quiz.copy163') }}</text>
          </view>
          <view class="legend-item">
            <view class="legend-dot dot-reviewed" />
            <text class="legend-label">{{ t('quiz.copy157') }}</text>
          </view>
          <view v-if="pendingCount" class="legend-item">
            <view class="legend-dot dot-reviewed" />
            <text class="legend-label">{{ t('quiz.copy158') }}</text>
          </view>
          <view class="legend-item">
            <view class="legend-dot dot-unanswered" />
            <text class="legend-label">{{ t('quiz.copy164') }}</text>
          </view>
        </view></view
      >
    </view></CustomModal
  >
</template>

<script setup>
import BaseStat from '@/components/base/base-stat/base-stat.vue';
const uiText = (value) => translateRegisteredText('quiz', value);
import '@/pages/practice-sub/messages.js';
import { t, translateRegisteredText } from '@/i18n/index.js';
import BaseButton from '@/components/base/base-button/base-button.vue';
import CustomModal from '@/components/common/CustomModal.vue';
import '@/styles/yozi-pages.scss';

import { computed } from 'vue';
import { getQuizAnswerRecordOutcome } from '@/services/quiz-session-contract.js';

const props = defineProps({
  visible: { type: Boolean, default: false },
  isDark: Boolean,
  questions: { type: Array, default: () => [] },
  currentIndex: { type: Number, default: 0 },
  answeredQuestions: { type: Array, default: () => [] },
  jumpLocked: { type: Boolean, default: false },
  lockText: { type: String, default: '' }
});

const emit = defineEmits(['jump', 'close']);

const answeredMap = computed(() => {
  const map = {};
  props.answeredQuestions.forEach((item) => {
    const index = Number(item?.index);
    if (!Number.isFinite(index) || index < 0 || index >= props.questions.length) return;
    map[index] = getQuizAnswerRecordOutcome(item);
  });
  return map;
});

const answeredCount = computed(() => Object.keys(answeredMap.value).length);
const correctCount = computed(() => Object.values(answeredMap.value).filter((status) => status === 'correct').length);
const wrongCount = computed(() => Object.values(answeredMap.value).filter((status) => status === 'wrong').length);
const reviewedCount = computed(() => Object.values(answeredMap.value).filter((status) => status === 'reviewed').length);
const pendingCount = computed(() => Object.values(answeredMap.value).filter((status) => status === 'pending').length);
const legacyCorrectCount = computed(
  () => Object.values(answeredMap.value).filter((status) => status === 'legacy_correct').length
);
const legacyWrongCount = computed(
  () => Object.values(answeredMap.value).filter((status) => status === 'legacy_wrong').length
);
const legacyCount = computed(() => legacyCorrectCount.value + legacyWrongCount.value);
const unclassifiedCount = computed(
  () => Object.values(answeredMap.value).filter((status) => status === 'unclassified').length
);
const gradedCount = computed(() => correctCount.value + wrongCount.value);
const remainingCount = computed(() => Math.max(0, props.questions.length - answeredCount.value));

const accuracy = computed(() => {
  if (gradedCount.value === 0) return 0;
  return Math.round((correctCount.value / gradedCount.value) * 100);
});

function cellClass(idx) {
  const classes = [];
  if (idx === props.currentIndex) return 'cell-current';
  const status = answeredMap.value[idx];
  classes.push(status ? `cell-${status}` : 'cell-unanswered');
  if (props.jumpLocked) classes.push('cell-locked');
  return classes.join(' ');
}

function handleJump(idx) {
  if (props.jumpLocked) return;
  emit('jump', idx);
}
</script>
