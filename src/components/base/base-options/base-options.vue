<template>
  <view
    ref="root"
    class="base-options"
    :role="multiple ? 'group' : 'radiogroup'"
    :aria-label="label"
    @keydown="keydown"
  >
    <button
      v-for="(option, index) in options"
      :key="option.value"
      class="base-option"
      :data-state="state(option)"
      :data-value="option.value"
      :role="multiple ? 'checkbox' : 'radio'"
      :aria-checked="selected(option)"
      :disabled="disabled || option.disabled"
      :aria-disabled="Boolean(disabled || option.disabled)"
      :tabindex="tabIndex(index)"
      :aria-describedby="state(option) === 'default' ? undefined : `yozi-option-${id}-${index}`"
      @tap="choose(index)"
    >
      <view class="base-option__key" aria-hidden="true">
        <BaseIcon v-if="state(option) === 'pending'" name="pen" tone="apricot" />
        <text v-else>{{ option.key || optionKey(index) }}</text>
      </view>
      <view class="base-option__label"
        ><slot name="option" :option="option"
          ><text>{{ option.label }}</text></slot
        ></view
      >
      <text v-if="state(option) !== 'default'" :id="`yozi-option-${id}-${index}`" class="base-option__status">{{
        t(`ui.option.${state(option)}`)
      }}</text>
    </button>
  </view>
</template>
<script setup>
import { getCurrentInstance, onMounted, onBeforeUnmount, ref } from 'vue';
import { t } from '@/i18n/index.js';
import BaseIcon from '../base-icon/base-icon.vue';
const props = defineProps({
  options: { type: Array, default: () => [] },
  modelValue: { type: [String, Number, Array], default: '' },
  label: { type: String, required: true },
  disabled: Boolean,
  multiple: Boolean
});
const emit = defineEmits(['update:modelValue']);
const id = getCurrentInstance().uid;
const root = ref(null);
let keyboardElement;
onMounted(() => {
  // #ifdef H5
  keyboardElement = root.value?.$el || root.value;
  keyboardElement?.addEventListener?.('keydown', keydown);
  // #endif
});
onBeforeUnmount(() => keyboardElement?.removeEventListener?.('keydown', keydown));
function selected(option) {
  return props.multiple
    ? Array.isArray(props.modelValue) && props.modelValue.includes(option.value)
    : props.modelValue === option.value;
}
function state(option) {
  return ['correct', 'wrong', 'pending'].includes(option.state)
    ? option.state
    : selected(option)
      ? 'selected'
      : 'default';
}
// 选项字母 A、B、C…；颜色之外由状态文字区分。
function optionKey(index) {
  return String.fromCharCode(65 + index);
}
function choose(index) {
  const option = props.options[index];
  if (option && !props.disabled && !option.disabled) {
    const values = Array.isArray(props.modelValue) ? props.modelValue : [];
    emit(
      'update:modelValue',
      props.multiple
        ? selected(option)
          ? values.filter((value) => value !== option.value)
          : [...values, option.value]
        : option.value
    );
  }
}
function tabIndex(index) {
  if (props.disabled) return -1;
  const selectedIndex = props.options.findIndex((item) => selected(item) && !item.disabled);
  return index === (selectedIndex < 0 ? props.options.findIndex((item) => !item.disabled) : selectedIndex) ? 0 : -1;
}
function keydown(event) {
  if (event.defaultPrevented) return;
  const controls = [...event.currentTarget.querySelectorAll('[role="radio"], [role="checkbox"]')];
  const index = controls.indexOf(event.target.closest('[role="radio"], [role="checkbox"]'));
  if (
    index < 0 ||
    props.disabled ||
    !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter', ' '].includes(event.key)
  )
    return;
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
      eligible[
        (eligible.indexOf(index) + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + eligible.length) %
          eligible.length
      ];
  if (!props.multiple || ['Enter', ' '].includes(event.key)) choose(next);
  controls[next]?.focus();
}
</script>
<style scoped lang="scss">
.base-options {
  display: grid;
  gap: var(--s-3);
}
.base-option {
  display: flex;
  align-items: center;
  gap: var(--s-3);
  width: 100%;
  min-height: var(--s-14);
  margin: 0;
  padding: var(--s-3) var(--s-4);
  border: var(--border-control) solid var(--line-strong);
  border-radius: var(--r-md);
  background: var(--paper);
  color: var(--ink);
  text-align: left;
  font: var(--weight-regular) var(--size-body)/var(--leading-body) var(--font-ui);
}
.base-option::after {
  border: 0;
}
.base-option[disabled] {
  opacity: 1;
  color: var(--ink);
  background: var(--paper);
}
.base-option__key {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: var(--leading-body);
  height: var(--leading-body);
  border-radius: var(--r-pill);
  background: var(--paper-sunk);
  box-shadow: inset 0 0 0 var(--border-thin) var(--line-strong);
  color: var(--ink-2);
  font: var(--weight-ui-emphasis) var(--size-small)/1 var(--font-ui);
}
.base-option__label {
  flex: 1;
}
.base-option__status {
  margin-left: auto;
  font: var(--weight-ui-emphasis) var(--size-caption)/var(--leading-caption) var(--font-ui);
}
.base-option[data-state='selected'] {
  background: var(--violet-soft);
  border-color: var(--violet);
  border-width: var(--border-selected);
  .base-option__key {
    background: var(--violet);
    box-shadow: none;
    color: var(--on-clay);
  }
}
.base-option[data-state='correct'] {
  background: var(--mint-soft);
  border-color: var(--mint-fill);
  border-width: var(--border-selected);
  .base-option__key {
    background: var(--mint-fill);
    box-shadow: none;
    color: var(--on-clay);
  }
  .base-option__status {
    color: var(--mint);
  }
}
.base-option[data-state='wrong'] {
  background: var(--coral-soft);
  border-color: var(--coral-fill);
  border-width: var(--border-selected);
  .base-option__key {
    background: var(--coral-fill);
    box-shadow: none;
    color: var(--on-clay);
  }
  .base-option__status {
    color: var(--coral);
  }
}
.base-option[data-state='pending'] {
  background: var(--apricot-soft);
  border: var(--border-selected) dashed var(--apricot-fill);
  .base-option__status {
    color: var(--apricot);
  }
}
.base-option:focus-visible {
  outline: var(--border-selected) solid var(--focus);
  outline-offset: var(--focus-offset);
}
</style>
