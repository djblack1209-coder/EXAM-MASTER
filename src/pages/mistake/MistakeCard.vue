<template>
  <view class="glass-card mistake-card">
    <view class="card-tag">{{ item.category || item.subject || t('mistake.copy48') }}</view>
    <text class="question-text">{{ item.question ?? item.question_content ?? t('mistake.copy49') }}</text>
    <BaseOptions :label="t('mistake.copy50')" :options="options.map((label, value) => ({ label, value }))" disabled />
    <view v-if="mode === 'recite' || localShowAnalysis" class="analysis-box">
      <view class="correct-ans">{{ t('mistake.copy51', { v0: reference ?? t('mistake.copy52') }) }}</view>
      <view v-if="originalAnswer !== undefined && originalAnswer !== null" class="analysis-content">
        <text class="label">{{ t('mistake.copy53') }}</text
        >{{ originalAnswer }}
      </view>
      <view class="analysis-content"
        ><text class="label">{{ t('mistake.copy54') }}</text
        >{{ item.desc ?? item.analysis ?? t('mistake.copy52') }}</view
      >
    </view>
    <view class="card-footer">
      <text class="time-text">{{ formatDate(item.addTime ?? item.created_at ?? item.timestamp) }}</text>
      <view v-if="(item.wrongCount ?? item.wrong_count ?? 0) > 1" class="wrong-count yozi-icon-row">
        <BaseIcon name="warning" class="count-icon" />
        <text class="count-text">{{ t('mistake.copy55', { v0: item.wrongCount ?? item.wrong_count }) }}</text>
      </view>
      <view class="actions">
        <BaseButton v-if="mode === 'quiz'" class="action-btn sm" variant="secondary" @tap="toggleAnalysis">{{
          localShowAnalysis ? t('mistake.copy56') : t('mistake.copy57')
        }}</BaseButton>
        <BaseButton class="action-btn sm primary" :disabled="!reviewable" variant="primary" @tap="startPractice">{{
          t('mistake.copy58')
        }}</BaseButton>
        <BaseButton class="action-btn sm del" variant="danger" danger-secondary @tap="emit('remove', index)">{{
          t('mistake.copy59')
        }}</BaseButton>
      </view>
    </view>
    <text v-if="!reviewable" class="time-text">{{ t('mistake.copy60') }}</text>
  </view>
</template>

<script setup>
import '@/pages/mistake/messages.js';
import { t } from '@/i18n/index.js';
import BaseOptions from '@/components/base/base-options/base-options.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import '@/styles/yozi-pages.scss';

import { ref, computed, watch } from 'vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
import { useStudyEngineStore } from '@/stores/modules/study-engine.js';
import { normalizeLegacyReviewQuestion, legacyReviewQuestionIdentity } from '@/services/quiz-session-contract.js';
import { toast } from '@/utils/toast.js';
import { safeNavigateTo } from '@/utils/safe-navigate';
const props = defineProps({
  item: { type: Object, required: true },
  index: { type: Number, required: true },
  mode: { type: String, default: 'quiz' },
  mistakes: { type: Array, default: () => [] },
  expectedOwnerId: { type: String, default: null }
});
const emit = defineEmits(['remove']);
const engine = useStudyEngineStore();
const localShowAnalysis = ref(false),
  referenceViewed = ref(props.mode === 'recite');
const options = computed(() => (Array.isArray(props.item.options) ? props.item.options : []));
const reference = computed(() => props.item.answer ?? props.item.correct_answer ?? props.item.correctAnswer);
const originalAnswer = computed(() => props.item.user_answer ?? props.item.userAnswer ?? props.item.userChoice);
const reviewable = computed(() => !!normalizeLegacyReviewQuestion(props.item));
watch(
  () => [legacyReviewQuestionIdentity(props.item), props.expectedOwnerId],
  () => {
    localShowAnalysis.value = false;
    referenceViewed.value = props.mode === 'recite';
  }
);
watch(
  () => props.mode,
  (mode) => {
    if (mode === 'recite') referenceViewed.value = true;
  }
);
function toggleAnalysis() {
  localShowAnalysis.value = !localShowAnalysis.value;
  if (localShowAnalysis.value) referenceViewed.value = true;
}
function formatDate(value) {
  if (value === undefined || value === null) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return t('mistake.copy61', {
    v0: date.getMonth() + 1,
    v1: date.getDate(),
    v2: String(date.getHours()).padStart(2, '0'),
    v3: String(date.getMinutes()).padStart(2, '0')
  });
}
function startPractice() {
  const id = props.item.id ?? props.item._id;
  const result = engine.prepareLegacyReview({
    expectedOwnerId: props.expectedOwnerId,
    recordIds: [id],
    expectedQuestions: [props.item],
    referenceViewedIds: referenceViewed.value ? [id] : []
  });
  if (!result.success) return toast.info(result.message || t('mistake.copy62'));
  safeNavigateTo(result.url);
}
</script>
