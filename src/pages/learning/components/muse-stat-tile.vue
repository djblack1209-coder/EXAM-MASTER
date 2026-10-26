<template>
  <view class="muse-stat-tile" :class="`stat-${tone}`">
    <BaseStat :label="label" :value="value" :denominator="denominator" :unit="unit" />
    <text v-if="caption" class="stat-caption">{{ caption }}</text>
  </view>
</template>
<script setup>
import BaseStat from '@/components/base/base-stat/base-stat.vue';
defineProps({
  label: { type: String, required: true },
  value: { type: [String, Number], required: true },
  denominator: { type: [String, Number], default: null },
  unit: { type: String, default: '' },
  tone: { type: String, default: 'default' },
  caption: { type: String, default: '' }
});
</script>
<style scoped>
.muse-stat-tile {
  min-width: 0;
  flex: 1 1 100px;
}
.stat-caption {
  display: block;
  margin-top: 8px;
  color: var(--ink-3);
  font-size: 12px;
  overflow-wrap: anywhere;
}
.stat-success :deep(.base-stat__number) {
  color: var(--muse-rich-success);
}
.stat-warning :deep(.base-stat__number) {
  color: var(--muse-rich-warning);
}
.stat-danger :deep(.base-stat__number) {
  color: var(--muse-rich-danger);
}
</style>
