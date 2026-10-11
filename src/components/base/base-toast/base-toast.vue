<template>
  <view v-if="visible" class="base-toast" role="status" aria-live="polite" aria-atomic="true"
    ><BaseIcon :name="icon" tone="toast-fg" /><text>{{ message || t('ui.saved') }}</text
    ><BaseButton v-if="closable" variant="quiet" icon="x" icon-only :label="t('ui.close')" @tap="dismiss"
  /></view>
</template>
<script setup>
import { onBeforeUnmount, watch } from 'vue';
import { t } from '@/i18n/index.js';
import BaseIcon from '../base-icon/base-icon.vue';
import BaseButton from '../base-button/base-button.vue';
const props = defineProps({
  visible: Boolean,
  message: { type: String, default: '' },
  icon: { type: String, default: 'check' },
  duration: { type: Number, default: 3000 },
  closable: Boolean
});
const emit = defineEmits(['update:visible']);
let timer;
function dismiss() {
  clearTimeout(timer);
  emit('update:visible', false);
}
watch(
  [() => props.visible, () => props.message, () => props.duration],
  () => {
    clearTimeout(timer);
    if (props.visible && props.duration > 0) timer = setTimeout(dismiss, props.duration);
  },
  { immediate: true }
);
onBeforeUnmount(() => clearTimeout(timer));
</script>
<style scoped>
.base-toast {
  display: inline-flex;
  align-items: center;
  gap: var(--s-3);
  padding: var(--s-3) var(--s-5);
  border-radius: var(--r-pill);
  background: var(--toast-bg);
  color: var(--toast-fg);
  box-shadow: var(--lift-2);
  font: var(--weight-semibold) var(--size-small)/var(--leading-small) var(--font-ui);
}
.base-toast :deep(.base-button) {
  color: var(--toast-fg);
}
</style>
