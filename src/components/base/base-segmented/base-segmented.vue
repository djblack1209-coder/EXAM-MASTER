<template>
  <view
    ref="root"
    class="base-segmented"
    :class="{ 'is-block': block }"
    role="tablist"
    :aria-label="label"
    :aria-disabled="disabled"
    @keydown="keydown"
  >
    <button
      v-for="(item, index) in options"
      :key="item.value"
      :data-index="index"
      role="tab"
      :aria-selected="modelValue === item.value"
      :tabindex="tabIndex(index)"
      :disabled="disabled || item.disabled"
      :aria-disabled="disabled || Boolean(item.disabled)"
      @tap="select(index)"
    >
      {{ item.label }}
    </button>
  </view>
</template>
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  options: { type: Array, default: () => [] },
  label: { type: String, required: true },
  disabled: Boolean,
  block: Boolean
});
const emit = defineEmits(['update:modelValue']);
const root = ref(null);
let keyboardElement;
onMounted(() => {
  // #ifdef H5
  keyboardElement = root.value?.$el || root.value;
  keyboardElement?.addEventListener?.('keydown', keydown);
  // #endif
});
onBeforeUnmount(() => keyboardElement?.removeEventListener?.('keydown', keydown));

function tabIndex(index) {
  if (props.disabled) return -1;
  const selected = props.options.findIndex((item) => item.value === props.modelValue && !item.disabled);
  return index === (selected < 0 ? props.options.findIndex((item) => !item.disabled) : selected) ? 0 : -1;
}
function select(index) {
  const option = props.options[index];
  if (!props.disabled && option && !option.disabled) emit('update:modelValue', option.value);
}
function keydown(event) {
  // uni H5 also emits a wrapped event; only the native DOM listener owns keys.
  // #ifdef H5
  if (!event.currentTarget?.querySelectorAll) return;
  // #endif
  if (props.disabled || event.defaultPrevented) return;
  const controls = [...event.currentTarget.querySelectorAll('[role="tab"]')];
  const index = controls.indexOf(event.target.closest('[role="tab"]'));
  if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  if (event.repeat && ['Enter', ' '].includes(event.key)) return;
  const eligible = props.options.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0);
  if (!eligible.length) return;
  let next = index;
  if (event.key === 'Home') next = eligible[0];
  else if (event.key === 'End') next = eligible.at(-1);
  else if (event.key.startsWith('Arrow'))
    next =
      eligible[(eligible.indexOf(index) + (event.key === 'ArrowRight' ? 1 : -1) + eligible.length) % eligible.length];
  select(next);
  controls[next]?.focus();
}
</script>
<style scoped>
.base-segmented {
  display: inline-flex;
  max-width: 100%;
  padding: var(--s-1);
  gap: calc(var(--s-1) / 2);
  border: var(--border-thin) solid var(--line);
  border-radius: var(--r-pill);
  background: var(--paper-sunk);
}
.base-segmented.is-block {
  display: flex;
}
.base-segmented button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: var(--touch-min);
  margin: 0;
  padding: 0 var(--s-4);
  border: 0;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--ink-3);
  font: var(--weight-ui-emphasis) var(--size-small)/1 var(--font-ui);
  white-space: nowrap;
}
.base-segmented button::after {
  border: 0;
}
.base-segmented button[aria-selected='true'] {
  background: var(--paper);
  color: var(--ink);
  box-shadow: var(--lift-1);
}
.base-segmented [disabled] {
  color: var(--ink-4);
}
.base-segmented button:focus-visible {
  outline: var(--border-selected) solid var(--focus);
  outline-offset: calc(-1 * var(--border-selected));
}
</style>
