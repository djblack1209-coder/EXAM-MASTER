<template>
  <view class="quiz-progress" :aria-label="progressAriaLabel"
    ><BaseStat :label="t('quiz.progress.current')" :value="safeCurrent" :denominator="safeTotal" /><text
      class="progress-state"
      >{{ progressStateLabel }}</text
    ><scroll-view :id="scrollId" scroll-x :scroll-left="scrollLeft" class="progress-scroll"
      ><view class="dot-track"
        ><BaseButton
          v-for="idx in safeTotal"
          :key="idx - 1"
          variant="quiet"
          :selected="idx - 1 === current"
          :class="dotClass(idx - 1)"
          :label="
            t('quiz.questionState', { number: idx, state: t('quiz.state.' + (answeredMap[idx - 1] || 'unanswered')) })
          "
          @tap="$emit('tap', idx - 1)"
          >{{ idx }}</BaseButton
        ></view
      ></scroll-view
    ></view
  >
</template>
<script setup>
import { computed, watch, ref, nextTick } from 'vue';
import BaseStat from '@/components/base/base-stat/base-stat.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import { t } from '@/i18n/index.js';
import '@/pages/practice-sub/messages.js';
import { tokens } from '@/design/tokens.js';
import { getQuizAnswerRecordOutcome } from '@/services/quiz-session-contract.js';

const props = defineProps({
  total: { type: Number, default: 0 },
  current: { type: Number, default: 0 },
  answered: { type: Array, default: () => [] }
});

defineEmits(['tap']);

const scrollId = 'quiz-progress-scroll';
const scrollLeft = ref(0);
// 每个 dot-wrapper 宽度约 40rpx = 20px（在 750rpx 设计稿下）
const DOT_UNIT = parseFloat(tokens.light['--touch-min']) + parseFloat(tokens.light['--s-1']);

const answeredMap = computed(() => {
  const map = {};
  props.answered.forEach((item) => {
    const index = Number(item?.index);
    if (!Number.isFinite(index) || index < 0 || index >= safeTotal.value) return;
    map[index] = getQuizAnswerRecordOutcome(item);
  });
  return map;
});

const safeTotal = computed(() => Math.max(0, Number(props.total) || 0));
const safeCurrent = computed(() => {
  if (safeTotal.value <= 0) return 0;
  return Math.min(safeTotal.value, Math.max(1, (Number(props.current) || 0) + 1));
});
const answeredCount = computed(() => {
  return Object.keys(answeredMap.value).length;
});
const remainingCount = computed(() => {
  return Math.max(0, safeTotal.value - answeredCount.value);
});
const reviewedCount = computed(() => Object.values(answeredMap.value).filter((status) => status === 'reviewed').length);
const progressStateLabel = computed(() => {
  if (safeTotal.value <= 0) return t('quiz.progress.wait');
  const statuses = Object.values(answeredMap.value);
  const parts = [t('quiz.progress.recorded', { count: answeredCount.value })];
  const pending = statuses.filter((status) => status === 'pending').length;
  const legacy = statuses.filter((status) => status.startsWith('legacy_')).length;
  const unknown = statuses.filter((status) => status === 'unclassified').length;
  if (pending) parts.push(t('quiz.progress.pending', { count: pending }));
  if (reviewedCount.value) parts.push(t('quiz.progress.reviewed', { count: reviewedCount.value }));
  if (legacy) parts.push(t('quiz.progress.legacy', { count: legacy }));
  if (unknown) parts.push(t('quiz.progress.unknown', { count: unknown }));
  parts.push(t('quiz.progress.remaining', { count: remainingCount.value }));
  return parts.join(' · ');
});
const progressAriaLabel = computed(() => {
  return t('quiz.progress.aria', {
    current: safeCurrent.value,
    total: safeTotal.value,
    state: progressStateLabel.value
  });
});

function dotClass(idx) {
  const status = answeredMap.value[idx];
  if (idx === props.current) return status ? `dot-active dot-${status}` : 'dot-active';
  if (status) return `dot-${status}`;
  return 'dot-default';
}

// 自动滚动让当前 dot 居中
watch(
  () => props.current,
  (val) => {
    nextTick(() => {
      // 视口大约能显示 ~9 个 dot，居中偏移 = current * unit - 4 * unit
      const offset = Math.max(0, (val - 4) * DOT_UNIT);
      scrollLeft.value = offset;
    });
  },
  { immediate: true }
);
</script>
<style scoped>
.quiz-progress {
  width: 100%;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--s-2);
}
.progress-scroll {
  width: 100%;
}
.dot-track {
  display: inline-flex;
  gap: var(--s-1);
}
.progress-state {
  color: var(--ink-3);
  font-size: var(--size-caption);
}
</style>
