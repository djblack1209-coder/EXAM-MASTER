<template>
  <view class="content-cards" data-test="teaching-cards">
    <BaseCard
      v-for="(card, index) in visible"
      :key="index"
      class="teaching-card"
      :class="`card-${card.kind}`"
      :padding="['stat', 'chart', 'figure'].includes(card.kind) ? 'none' : 'large'"
    >
      <view class="card-eyebrow"
        ><BaseIcon :name="icons[card.kind]" tone="ink-3" /><text
          >{{ t(`tutor.card.${card.kind}`) }} · {{ index + 1 }}/{{ normalized.items.length }}</text
        ></view
      >
      <view v-if="card.formula" class="card-formula-block"
        ><text class="card-formula">{{ card.formula }}</text></view
      >
      <MuseStatTile v-if="card.kind === 'stat'" v-bind="card" />
      <MuseChart v-else-if="card.kind === 'chart'" :chart="card.chart" />
      <MuseFigure v-else-if="card.kind === 'figure'" :figure="card.figure" />
      <text v-if="card.title" class="card-title" role="heading" aria-level="3">{{ card.title }}</text>
      <text v-if="card.body" class="card-copy" selectable>{{ card.body }}</text>
      <view v-for="(point, pointIndex) in card.points || []" :key="pointIndex" class="card-point"
        ><BaseIcon name="check" tone="violet-ink" /><text selectable>{{ point }}</text></view
      >
      <view
        v-for="(step, stepIndex) in (card.steps || []).slice(0, steps[index] || 1)"
        :key="stepIndex"
        class="example-step"
        ><text class="step-number">{{ stepIndex + 1 }}</text
        ><text selectable>{{ step }}</text></view
      >
      <view class="card-actions">
        <BaseButton
          v-if="card.steps && (steps[index] || 1) < card.steps.length"
          variant="primary"
          @tap="steps[index] = (steps[index] || 1) + 1"
          >{{ t('tutor.card.nextStep') }}</BaseButton
        >
        <BaseButton
          v-else-if="index === count - 1 && count < normalized.items.length"
          variant="primary"
          @tap="count++"
          >{{ t(card.kind === 'example' ? 'tutor.card.try' : 'tutor.card.continue') }}</BaseButton
        >
      </view>
    </BaseCard>
  </view>
</template>
<script setup>
import '@/i18n/tutor.js';
import { computed, ref, watch } from 'vue';
import { normalizeContentBlocks } from '../../../../laf-backend/functions/_shared/learning-content-blocks.js';
import { t } from '@/i18n/index.js';
import MuseStatTile from './muse-stat-tile.vue';
import MuseChart from './muse-chart.vue';
import MuseFigure from './muse-figure.vue';
import BaseCard from '@/components/base/base-card/base-card.vue';
import BaseButton from '@/components/base/base-button/base-button.vue';
import BaseIcon from '@/components/base/base-icon/base-icon.vue';
const props = defineProps({ content: { type: Object, required: true } });
const normalized = computed(() => normalizeContentBlocks(props.content));
const count = ref(1),
  steps = ref({});
const visible = computed(() => normalized.value.items.slice(0, count.value));
const icons = { knowledge: 'book-open', example: 'pen', note: 'note', stat: 'chart', chart: 'chart', figure: 'shapes' };
watch(
  () => props.content,
  () => {
    count.value = 1;
    steps.value = {};
  }
);
</script>
<style scoped>
.content-cards {
  display: grid;
  gap: var(--s-3);
  width: 100%;
  max-width: 680px;
}
.teaching-card {
  overflow: visible;
  border: 1px solid var(--control-line);
  border-radius: 16px;
  background: var(--muse-rich-surface);
}
.card-eyebrow {
  display: flex;
  align-items: center;
  gap: var(--s-2);
  color: var(--ink-3);
  font-size: var(--size-caption);
}
.card-formula-block {
  margin: 16px 0;
  padding: 16px;
  background: var(--paper-sunk);
  border-radius: 16px;
}
.card-title {
  display: block;
  margin-bottom: var(--s-4);
  font: var(--weight-ui-emphasis) var(--size-title-2)/var(--leading-title-2) var(--font-ui);
}
.card-copy,
.card-point,
.example-step {
  line-height: var(--leading-body);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.card-point,
.example-step {
  display: flex;
  align-items: flex-start;
  gap: var(--s-3);
  margin-top: var(--s-4);
}
.step-number {
  color: var(--violet-ink);
  font-variant-numeric: tabular-nums;
}
.card-formula {
  font-size: var(--size-title-2);
  overflow-wrap: anywhere;
  min-width: 0;
}
.card-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--s-5);
}
.card-stat :deep(.base-card__body),
.card-chart :deep(.base-card__body),
.card-figure :deep(.base-card__body) {
  padding: 14px;
}
.card-actions:empty {
  display: none;
}
</style>
