<template>
  <view class="rubric-evidence" aria-label="辅助评分的原答依据">
    <text v-if="attempt.corrections?.length" class="evidence-note"> 已校对 · 历史 AI 评分待核对 </text>
    <view v-for="dimension in dimensions" :key="dimension.id" class="evidence-dimension">
      <text class="evidence-note">
        {{ dimension.name }}：{{ dimension.score === null ? '待核对' : dimension.score }} / {{ dimension.maxScore }} ·
        {{ dimension.feedback }}
      </text>
      <view v-for="entry in dimension.quotes" :key="entry.key" class="evidence-quote">
        <text class="evidence-note" selectable>原答引用：{{ entry.quote }}</text>
        <template v-if="entry.location">
          <text class="evidence-note">
            原答第{{ entry.location.startCharacter }}至{{ entry.location.endCharacter }}字 · 同文第{{
              entry.location.occurrence
            }}/{{ entry.location.occurrences }}处
          </text>
          <text class="evidence-note" selectable>
            附近原文：{{ entry.location.before }}【{{ entry.quote }}】{{ entry.location.after }}
          </text>
          <button
            role="button"
            tabindex="0"
            size="mini"
            :aria-label="`查看${dimension.name}引用${entry.index + 1}的原答位置`"
            :aria-expanded="selected === entry.key"
            @tap="toggle(entry.key)"
          >
            {{ selected === entry.key ? '收起原答位置' : '查看原答位置' }}
          </button>
          <view v-if="selected === entry.key" class="answer-panel" aria-label="作答原文（完整）">
            <text class="answer-body" selectable
              ><text
                v-for="(segment, index) in answerSegments"
                :key="index"
                class="answer-segment"
                :class="{ 'evidence-highlight': segment.highlight }"
                >{{ segment.text }}</text
              ></text
            >
          </view>
        </template>
        <text v-else class="evidence-note">
          {{ assessment.contract === 'subjective-rubric-v1' ? '旧记录未定位 · 待核对' : '引用未定位 · 待核对' }}
        </text>
      </view>
    </view>
    <button
      role="button"
      tabindex="0"
      size="mini"
      :disabled="!sourceAvailable"
      :aria-disabled="!sourceAvailable"
      :aria-expanded="selected === 'answer'"
      @tap="toggle('answer')"
    >
      {{ selected === 'answer' ? '收起完整原答' : '查看完整原答' }}
    </button>
    <text v-if="!sourceAvailable" class="evidence-note">原答不可用</text>
    <view v-if="selected === 'answer' && sourceAvailable" class="answer-panel" aria-label="作答原文（完整）">
      <text class="answer-body" selectable>{{ attempt.answer }}</text>
    </view>
  </view>
</template>
<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  attempt: { type: Object, required: true },
  assessment: { type: Object, required: true },
  contextKey: { type: String, default: null }
});
const selected = ref('');
const sourceAvailable = computed(
  () =>
    typeof props.attempt.answer === 'string' &&
    props.attempt.answer.length > 0 &&
    props.attempt.answer.length <= 10000 &&
    props.assessment.questionKey === props.attempt.questionKey &&
    (props.assessment.contract === 'subjective-rubric-v1' ||
      (props.assessment.contract === 'subjective-rubric-v2' && props.assessment.attemptId === props.attempt.id))
);
function locate(quote, location) {
  if (!sourceAvailable.value || props.assessment.contract !== 'subjective-rubric-v2' || !location) return null;
  const answer = props.attempt.answer;
  const { start, end } = location;
  const splitsSurrogate = (position) =>
    position > 0 &&
    position < answer.length &&
    answer.charCodeAt(position - 1) >= 0xd800 &&
    answer.charCodeAt(position - 1) <= 0xdbff &&
    answer.charCodeAt(position) >= 0xdc00 &&
    answer.charCodeAt(position) <= 0xdfff;
  if (
    typeof quote !== 'string' ||
    !quote.trim() ||
    quote.length > 250 ||
    location.quote !== quote ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end <= start ||
    end > answer.length ||
    splitsSurrogate(start) ||
    splitsSurrogate(end) ||
    answer.slice(start, end) !== quote
  )
    return null;
  const occurrences = [];
  for (let from = 0, found; (found = answer.indexOf(quote, from)) !== -1; from = found + 1) occurrences.push(found);
  return {
    start,
    end,
    startCharacter: Array.from(answer.slice(0, start)).length + 1,
    endCharacter: Array.from(answer.slice(0, end)).length,
    occurrence: occurrences.indexOf(start) + 1,
    occurrences: occurrences.length,
    before: Array.from(answer.slice(0, start)).slice(-24).join(''),
    after: Array.from(answer.slice(end)).slice(0, 24).join('')
  };
}
const dimensions = computed(() =>
  (props.assessment.dimensions || []).map((dimension, dimensionIndex) => ({
    ...dimension,
    quotes: (dimension.evidence || []).map((quote, index) => ({
      key: `${dimensionIndex}:${index}`,
      index,
      quote,
      location: locate(quote, dimension.evidenceLocations?.[index])
    }))
  }))
);
const answerSegments = computed(() => {
  const entry = dimensions.value.flatMap((dimension) => dimension.quotes).find((quote) => quote.key === selected.value);
  if (!entry?.location) return [];
  return [
    { text: props.attempt.answer.slice(0, entry.location.start) },
    { text: props.attempt.answer.slice(entry.location.start, entry.location.end), highlight: true },
    { text: props.attempt.answer.slice(entry.location.end) }
  ];
});
function toggle(key) {
  if (sourceAvailable.value) selected.value = selected.value === key ? '' : key;
}
watch(
  [
    () => props.contextKey,
    () => props.attempt.id,
    () => props.attempt.conversationId,
    () => props.attempt.questionKey,
    () => props.attempt.answer,
    () => props.assessment.id,
    () => props.assessment.questionKey,
    () => props.assessment.attemptId,
    () => props.assessment.contract,
    () => JSON.stringify(props.assessment.dimensions)
  ],
  () => {
    selected.value = '';
  },
  { flush: 'sync' }
);
</script>
<style scoped>
.rubric-evidence,
.evidence-dimension,
.evidence-quote {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 8px;
}
.rubric-evidence {
  gap: 14px;
}
.evidence-note {
  display: block;
  color: var(--space-muted, #62576d);
  font-size: 12px;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.rubric-evidence button {
  align-self: flex-start;
  min-height: 44px;
  max-width: 100%;
  margin: 0;
  padding: 8px 14px;
  color: var(--space-ink, #080909);
  background: transparent;
  border: 1px solid var(--space-line, #dbd5e6);
  border-radius: 12px;
  font-family: inherit;
  font-size: 12px;
  line-height: 1.65;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    color 180ms ease;
}
.rubric-evidence button::after {
  border: 0;
}
.rubric-evidence button:active:not([disabled]),
.rubric-evidence button[aria-expanded='true'] {
  background: var(--space-user, #e5d9f5);
}
.rubric-evidence button:active:not([disabled]) {
  transition-duration: 100ms;
}
.rubric-evidence button:focus-visible {
  outline: 2px solid var(--space-focus, #785bbc);
  outline-offset: 2px;
}
.answer-panel {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--space-line, #dbd5e6);
  border-radius: 12px;
  background: var(--space-composer, #fff);
}
.answer-body {
  display: block;
  color: var(--space-ink, #080909);
  font-size: 14px;
  line-height: 1.65;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.evidence-highlight {
  background: var(--space-user, #e5d9f5);
  font-weight: 700;
  text-decoration: underline;
}
.answer-segment {
  white-space: pre-wrap;
}
@media (hover: hover) and (pointer: fine) {
  .rubric-evidence button:hover:not([disabled]) {
    background: var(--space-notice, #eee7f7);
  }
}
@media (prefers-reduced-motion: reduce) {
  .rubric-evidence button {
    animation: none !important;
    transition: none !important;
  }
}
</style>
