<template>
  <BaseButton
    :variant="variant"
    :small="size === 'small'"
    :block="block"
    :disabled="disabled"
    :loading="loading"
    :icon="icon"
    :label="label"
    :class="customClass"
    :style="customStyle"
    @tap="emit('click', $event)"
    ><slot></slot
  ></BaseButton>
</template>
<script setup>
import { computed } from 'vue';
import BaseButton from './base-button.vue';
const props = defineProps({
  type: { type: String, default: 'primary' },
  size: { type: String, default: 'medium' },
  plain: Boolean,
  text: Boolean,
  block: Boolean,
  disabled: Boolean,
  loading: Boolean,
  icon: { type: String, default: '' },
  label: { type: String, default: '' },
  customClass: { type: String, default: '' },
  customStyle: { type: String, default: '' }
});
const emit = defineEmits(['click']);
const variant = computed(() =>
  props.text
    ? 'quiet'
    : props.plain || props.type === 'info'
      ? 'secondary'
      : ['error', 'danger'].includes(props.type)
        ? 'danger'
        : 'primary'
);
</script>
