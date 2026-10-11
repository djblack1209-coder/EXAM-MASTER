<template>
  <button
    class="base-button"
    :class="[`base-button--${variant}`, { 'is-small': small, 'is-block': block, 'is-icon': iconOnly }]"
    role="button"
    :tabindex="blocked ? -1 : 0"
    :disabled="blocked"
    :aria-disabled="blocked"
    :aria-busy="loading"
    :aria-label="label || (iconOnly ? t('ui.action') : undefined)"
    @tap="activate"
    @keydown="keydown"
  >
    <view v-if="loading" class="base-button__spinner" aria-hidden="true" />
    <BaseIcon v-else-if="icon" :name="icon" :tone="tone" />
    <text v-if="!iconOnly">{{ loading ? loadingText || t('ui.loading') : '' }}<slot v-if="!loading"></slot></text>
  </button>
</template>
<script setup>
import { computed } from 'vue';
import { t } from '@/i18n/index.js';
import BaseIcon from '../base-icon/base-icon.vue';
const props = defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'quiet', 'danger', 'apple', 'google', 'wechat'].includes(value)
  },
  small: Boolean,
  block: Boolean,
  iconOnly: Boolean,
  disabled: Boolean,
  loading: Boolean,
  label: { type: String, default: '' },
  icon: { type: String, default: '' },
  loadingText: { type: String, default: '' }
});
const emit = defineEmits(['tap']);
const blocked = computed(() => props.disabled || props.loading);
const tone = computed(
  () =>
    ({
      primary: 'on-clay',
      danger: 'on-danger',
      quiet: 'violet-ink',
      apple: 'apple-fg',
      google: 'google-fg',
      wechat: 'brand-wechat'
    })[props.variant] || 'ink'
);
function activate(event) {
  if (!blocked.value) emit('tap', event);
}
function keydown(event) {
  if (!['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat) activate(event);
}
</script>
<style scoped lang="scss">
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--s-2);
  box-sizing: border-box;
  height: var(--control-height);
  min-height: var(--touch-min);
  padding: 0 var(--button-pad);
  margin: 0;
  border: 0;
  border-radius: var(--r-md);
  font: var(--weight-semibold) var(--size-body)/1 var(--font-ui);
  cursor: pointer;
  white-space: nowrap;
  transition:
    transform var(--t-press) var(--ease),
    box-shadow var(--t-press) var(--ease),
    background-color var(--t-state) var(--ease);
}
.base-button::after {
  border: 0;
}
.base-button--primary {
  background: var(--clay-face);
  color: var(--on-clay);
  box-shadow: var(--clay-shadow);
}
.base-button--primary:hover {
  background: var(--clay-face-hover);
}
.base-button--primary:active:not([disabled]) {
  transform: translateY(var(--press-y));
  box-shadow: var(--clay-shadow-press);
}
.base-button--secondary {
  background: var(--paper);
  color: var(--ink);
  box-shadow: inset 0 0 0 var(--border-control) var(--line-strong);
}
.base-button--secondary:hover {
  background: var(--paper-sunk);
}
.base-button--quiet {
  background: transparent;
  color: var(--violet-ink);
  padding: 0 var(--s-4);
}
.base-button--quiet:hover {
  background: var(--violet-soft);
}
.base-button--danger {
  background: var(--danger-face);
  color: var(--on-danger);
}
.base-button--apple {
  background: var(--apple-bg);
  color: var(--apple-fg);
}
.base-button--google {
  background: var(--google-bg);
  color: var(--google-fg);
  box-shadow: inset 0 0 0 var(--border-thin) var(--google-line);
}
.base-button--wechat {
  background: var(--paper);
  color: var(--ink);
  box-shadow: inset 0 0 0 var(--border-control) var(--line-strong);
}
.base-button:not(.base-button--primary):active:not([disabled]) {
  opacity: 0.86;
}
.base-button__spinner {
  flex: none;
  box-sizing: border-box;
  width: var(--s-4);
  height: var(--s-4);
  border: var(--border-selected) solid currentColor;
  border-right-color: transparent;
  border-radius: var(--r-pill);
  animation: base-button-spin 0.8s linear infinite;
}
@keyframes base-button-spin {
  to {
    transform: rotate(360deg);
  }
}
.base-button.is-small {
  height: var(--touch-min);
  padding: 0 var(--s-4);
  font-size: var(--size-small);
  border-radius: var(--r-sm);
}
.base-button.is-icon {
  width: var(--touch-min);
  height: var(--touch-min);
  padding: 0;
  border-radius: var(--r-pill);
}
.base-button.is-block {
  display: flex;
  width: 100%;
}
.base-button[disabled] {
  background: var(--paper-sunk);
  color: var(--ink-4);
  box-shadow: inset 0 0 0 var(--border-control) var(--line);
  transform: none;
  cursor: not-allowed;
}
.base-button:focus-visible {
  outline: var(--border-selected) solid var(--focus);
  outline-offset: var(--focus-offset);
}
@media (prefers-reduced-motion: reduce) {
  .base-button {
    transition: none;
    transform: none !important;
  }
  .base-button__spinner {
    animation: none;
  }
}
</style>
