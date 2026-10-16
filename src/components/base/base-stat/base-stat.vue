<template>
  <view class="base-stat"
    ><text class="base-stat__label">{{ label }}</text
    ><view class="base-stat__number"
      ><text class="summary-count">{{ formatNumber(value) }}</text
      ><text v-if="denominator !== null" class="base-stat__unit">/ {{ formatNumber(denominator) }}</text
      ><text v-else-if="unit" class="base-stat__unit">{{ ` ${unit}` }}</text></view
    ></view
  >
</template>
<script setup>
import { formatNumber } from '@/i18n/format.js';
defineProps({
  label: { type: String, required: true },
  value: { type: Number, required: true },
  denominator: { type: Number, default: null },
  unit: { type: String, default: '' }
});
</script>
<style scoped>
.base-stat {
  display: grid;
  gap: var(--s-2);
}
.base-stat__label {
  color: var(--ink-3);
  font: var(--weight-medium) var(--size-caption)/var(--leading-caption) var(--font-ui);
}
.base-stat__number {
  display: flex;
  align-items: baseline;
  gap: var(--s-1);
  color: var(--ink);
  font: var(--weight-ui-emphasis) var(--size-number)/var(--leading-number) var(--font-ui);
  font-variant-numeric: tabular-nums;
}
.base-stat__unit {
  font: var(--weight-medium) var(--size-small)/var(--leading-small) var(--font-ui);
  color: var(--ink-3);
}
</style>
