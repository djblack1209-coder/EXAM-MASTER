<template>
  <view class="base-field">
    <label v-if="label" :id="`${id}-label`" :for="id" class="base-field__label">{{ label }}</label>
    <view
      class="base-field__group"
      :class="{ 'is-focused': focused, 'is-error': error, 'is-multiline': multiline, 'is-disabled': disabled }"
    >
      <text v-if="prefix" class="base-field__prefix">{{ prefix }}</text>
      <!-- #ifdef H5 -->
      <textarea
        v-if="multiline && !nativePlatform"
        :id="id"
        class="base-field__input"
        :value="modelValue"
        :disabled="disabled"
        :maxlength="maxlength"
        :placeholder="placeholder"
        :aria-label="label"
        :aria-labelledby="label ? `${id}-label` : undefined"
        :aria-describedby="descriptionId"
        :aria-invalid="Boolean(error)"
        :aria-disabled="disabled"
        data-yozi-answer-input="true"
        @input="input"
        @focus="focus"
        @blur="blur"
      ></textarea>
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <textarea
        v-if="multiline && nativePlatform"
        :id="id"
        class="base-field__input"
        :value="modelValue"
        :disabled="disabled"
        :maxlength="maxlength"
        :focus="nativeFocus"
        :placeholder="placeholder"
        :aria-label="label"
        :aria-labelledby="label ? `${id}-label` : undefined"
        :aria-describedby="descriptionId"
        :aria-invalid="Boolean(error)"
        :aria-disabled="disabled"
        data-yozi-answer-input="true"
        @input="input"
        @focus="focus"
        @blur="blur"
      ></textarea>
      <!-- #endif -->
      <!-- #ifdef H5 -->
      <input
        v-if="!multiline && !nativePlatform"
        :id="id"
        class="base-field__input"
        :value="modelValue"
        :type="type"
        :inputmode="inputmode"
        :disabled="disabled"
        :maxlength="maxlength"
        :placeholder="placeholder"
        :aria-label="label"
        :aria-labelledby="label ? `${id}-label` : undefined"
        :aria-describedby="descriptionId"
        :aria-invalid="Boolean(error)"
        :aria-disabled="disabled"
        data-yozi-answer-input="true"
        @input="input"
        @focus="focus"
        @blur="blur"
      />
      <!-- #endif -->
      <!-- #ifndef H5 -->
      <input
        v-if="!multiline && nativePlatform"
        :id="id"
        class="base-field__input"
        :value="modelValue"
        :type="type"
        :inputmode="inputmode"
        :disabled="disabled"
        :maxlength="maxlength"
        :focus="nativeFocus"
        :placeholder="placeholder"
        :aria-label="label"
        :aria-labelledby="label ? `${id}-label` : undefined"
        :aria-describedby="descriptionId"
        :aria-invalid="Boolean(error)"
        :aria-disabled="disabled"
        data-yozi-answer-input="true"
        @input="input"
        @focus="focus"
        @blur="blur"
      />
      <!-- #endif -->
      <BaseButton
        v-if="verification"
        variant="quiet"
        small
        :disabled="disabled || remaining > 0"
        :label="resendLabel"
        @tap="resend"
        >{{ resendLabel }}</BaseButton
      >
      <slot name="suffix"></slot>
    </view>
    <text
      v-if="help || error"
      :id="`${id}-description`"
      class="base-field__help"
      :class="{ 'is-error': error }"
      :role="error ? 'alert' : undefined"
      >{{ error || help }}</text
    >
  </view>
</template>
<script setup>
import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue';
import { t } from '@/i18n/index.js';
import { setMascotInputFocused } from '@/design/mascot-motion.js';
import BaseButton from '../base-button/base-button.vue';
const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  type: { type: String, default: 'text' },
  inputmode: { type: String, default: 'text' },
  prefix: { type: String, default: '' },
  multiline: Boolean,
  nativeFocus: Boolean,
  disabled: Boolean,
  verification: Boolean,
  resendSeconds: { type: Number, default: 0 },
  maxlength: { type: Number, default: -1 },
  help: { type: String, default: '' },
  error: { type: String, default: '' }
});
const emit = defineEmits(['update:modelValue', 'resend', 'focus', 'blur']);
const id = `yozi-field-${getCurrentInstance().uid}`;
const focused = ref(false);
let nativePlatform = true;
// #ifdef H5
nativePlatform = false;
// #endif
const remaining = ref(0);
const descriptionId = computed(() => (props.help || props.error ? `${id}-description` : undefined));
const resendLabel = computed(() =>
  remaining.value > 0 ? t('ui.resendCountdown', { seconds: remaining.value }) : t('ui.resend')
);
let timer;
watch(
  () => props.resendSeconds,
  (seconds) => {
    clearInterval(timer);
    const deadline = Date.now() + Math.max(0, Number.isFinite(seconds) ? Math.ceil(seconds) : 0) * 1000;
    const tick = () => {
      remaining.value = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (!remaining.value) clearInterval(timer);
    };
    tick();
    if (remaining.value) timer = setInterval(tick, 1000);
  },
  { immediate: true }
);
function input(event) {
  if (!props.disabled) emit('update:modelValue', event.detail?.value ?? event.target?.value ?? '');
}
function focus(event) {
  focused.value = true;
  setMascotInputFocused(id, true);
  emit('focus', event);
}
function blur(event) {
  focused.value = false;
  setMascotInputFocused(id, false);
  emit('blur', event);
}
function resend() {
  if (!props.disabled && remaining.value === 0) emit('resend');
}
onBeforeUnmount(() => {
  clearInterval(timer);
  setMascotInputFocused(id, false);
});
</script>
<style scoped lang="scss">
.base-field {
  display: grid;
  gap: var(--s-2);
  min-width: 0;
  font-family: var(--font-ui);
}
.base-field__label {
  color: var(--ink-2);
  font: var(--weight-semibold) var(--size-small)/var(--leading-small) var(--font-ui);
}
.base-field__group {
  display: flex;
  align-items: center;
  box-sizing: border-box;
  min-height: var(--control-height);
  border: var(--border-control) solid var(--line-strong);
  border-radius: var(--r-md);
  background: var(--paper);
  overflow: hidden;
}
.base-field__group.is-focused {
  border-color: var(--violet);
  box-shadow: 0 0 0 var(--s-1) var(--violet-soft);
}
.base-field__group.is-error {
  border-color: var(--coral);
  box-shadow: 0 0 0 var(--s-1) var(--coral-soft);
}
.base-field__group.is-disabled {
  background: var(--paper-sunk);
  color: var(--ink-4);
}
.base-field__input {
  width: 100%;
  flex: 1;
  min-width: 0;
  height: var(--control-height);
  padding: 0 var(--s-4);
  box-sizing: border-box;
  border: 0;
  background: transparent;
  color: var(--ink);
  font: var(--weight-regular) var(--size-body)/var(--leading-body) var(--font-ui);
}
.base-field__input::placeholder {
  color: var(--ink-4);
}
.base-field__input:focus {
  outline: none;
}
.is-multiline .base-field__input {
  height: var(--textarea-height);
  padding: var(--s-3) var(--s-4);
}
.base-field__prefix {
  align-self: stretch;
  display: flex;
  align-items: center;
  padding: 0 var(--s-4);
  border-right: var(--border-thin) solid var(--line);
  color: var(--ink);
  font-weight: var(--weight-semibold);
}
.base-field__help {
  color: var(--ink-3);
  font: var(--weight-regular) var(--size-small)/var(--leading-small) var(--font-ui);
}
.base-field__help.is-error {
  color: var(--coral);
}
</style>
