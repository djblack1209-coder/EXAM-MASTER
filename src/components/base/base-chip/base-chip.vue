<template>
  <button
    class="base-chip"
    role="button"
    :aria-pressed="modelValue"
    :disabled="disabled"
    :aria-disabled="disabled"
    :tabindex="disabled ? -1 : 0"
    @tap="toggle"
    @keydown="keydown"
  >
    <BaseIcon v-if="icon" :name="icon" :tone="modelValue ? 'violet-ink' : 'ink-2'" />
    <slot></slot><text v-if="count !== null" class="base-chip__count">{{ formatNumber(count) }}</text>
  </button>
</template>
<script setup>
import BaseIcon from '../base-icon/base-icon.vue';
import { formatNumber } from '@/i18n/format.js';
const props = defineProps({
  modelValue: Boolean,
  disabled: Boolean,
  icon: { type: String, default: '' },
  count: { type: Number, default: null }
});
const emit = defineEmits(['update:modelValue']);
function toggle() {
  if (!props.disabled) emit('update:modelValue', !props.modelValue);
}
function keydown(event) {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat) toggle();
}
</script>
<style scoped>
.base-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  height: var(--touch-min);
  padding: 0 var(--s-4);
  margin: 0;
  border-radius: var(--r-pill);
  background: var(--paper-sunk);
  border: var(--border-thin) solid var(--line);
  color: var(--ink-2);
  font: var(--weight-medium) var(--size-small)/1 var(--font-ui);
  transition:
    background-color var(--t-state) var(--ease),
    border-color var(--t-state) var(--ease);
}
.base-chip::after {
  border: 0;
}
.base-chip[aria-pressed='true'] {
  background: var(--violet-soft);
  border-color: var(--violet);
  color: var(--violet-ink);
  font-weight: var(--weight-semibold);
}
.base-chip[disabled] {
  color: var(--ink-4);
}
.base-chip__count {
  font-size: var(--size-caption);
  font-variant-numeric: tabular-nums;
}
.base-chip:focus-visible {
  outline: var(--border-selected) solid var(--focus);
  outline-offset: var(--focus-offset);
}
</style>
