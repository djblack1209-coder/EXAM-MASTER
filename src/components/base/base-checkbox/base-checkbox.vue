<template>
  <view
    ref="root"
    class="base-checkbox"
    role="checkbox"
    :aria-checked="modelValue"
    :aria-disabled="disabled"
    :tabindex="disabled ? -1 : 0"
    @tap="toggle"
    @keydown="keydown"
  >
    <view class="base-checkbox__box" aria-hidden="true"
      ><BaseIcon v-if="modelValue" name="check" size="var(--size-small)" tone="on-clay" /></view
    ><view class="base-checkbox__label"><slot></slot></view>
  </view>
</template>
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue';
import BaseIcon from '../base-icon/base-icon.vue';
const props = defineProps({ modelValue: Boolean, disabled: Boolean });
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

function toggle(event) {
  if (!props.disabled && !event?.target?.closest?.('a, [role="link"]')) emit('update:modelValue', !props.modelValue);
}
function keydown(event) {
  // #ifdef H5
  if (!event.currentTarget?.addEventListener) return;
  // #endif
  if (event.defaultPrevented) return;
  if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  if (!event.repeat) toggle(event);
}
</script>
<style scoped>
.base-checkbox {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  min-height: var(--touch-min);
  color: var(--ink-3);
  font: var(--weight-regular) var(--size-small)/var(--leading-small) var(--font-ui);
  cursor: pointer;
}
.base-checkbox__box {
  display: flex;
  justify-content: center;
  align-items: center;
  flex: none;
  width: var(--control-icon);
  height: var(--control-icon);
  border-radius: var(--checkbox-radius);
  background: var(--paper);
  box-shadow: inset 0 0 0 var(--border-control) var(--control-line);
}
.base-checkbox[aria-checked='true'] .base-checkbox__box {
  background: var(--violet);
  box-shadow: none;
}
.base-checkbox[aria-disabled='true'] {
  color: var(--ink-4);
  cursor: not-allowed;
}
.base-checkbox:focus-visible {
  outline: var(--border-selected) solid var(--focus);
  outline-offset: var(--focus-offset);
  border-radius: var(--r-xs);
}
</style>
