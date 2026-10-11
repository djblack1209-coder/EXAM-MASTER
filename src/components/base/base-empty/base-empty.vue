<template>
  <view
    class="base-state"
    :class="[{ 'dark-mode': isDark, 'is-compact': compact }, `base-state--${state}`]"
    :role="state === 'error' ? 'alert' : 'status'"
    :aria-busy="state === 'loading'"
    aria-live="polite"
  >
    <view class="base-state__halo"
      ><YoziMascot :pose="pose || poses[state]" :size="mascotSize" :decorative="true"
    /></view>
    <text v-if="!compact" class="base-state__title">{{ title || t(`ui.state.${state}`) }}</text>
    <text v-if="desc && !compact" class="base-state__description">{{ desc }}</text>
    <BaseButton
      v-if="showButton && !compact"
      :variant="state === 'error' ? 'primary' : 'secondary'"
      small
      @tap="emit('action')"
      >{{ buttonText || t(state === 'error' ? 'ui.retry' : 'ui.add') }}</BaseButton
    >
  </view>
</template>
<script setup>
import { t } from '@/i18n/index.js';
import YoziMascot from '../yozi-mascot/yozi-mascot.vue';
import BaseButton from '../base-button/base-button.vue';
defineProps({
  state: { type: String, default: 'empty', validator: (value) => ['empty', 'loading', 'error'].includes(value) },
  title: { type: String, default: '' },
  desc: { type: String, default: '' },
  showButton: Boolean,
  buttonText: { type: String, default: '' },
  isDark: Boolean,
  compact: Boolean,
  mascotSize: { type: [String, Number], default: 'state' },
  pose: { type: String, default: '' },
  icon: { type: String, default: '' }
});
const emit = defineEmits(['action']);
const poses = { empty: 'idle', loading: 'think', error: 'curious' };
</script>
<style scoped>
.base-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--s-2);
  padding: var(--s-3);
  text-align: center;
  font-family: var(--font-ui);
}
.base-state__halo {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--mascot-halo);
  height: var(--mascot-halo);
  border-radius: var(--r-pill);
  background: radial-gradient(closest-side, var(--violet-soft-2), transparent);
}
.base-state__title {
  color: var(--ink);
  font: var(--weight-bold) var(--size-title-3)/var(--leading-title-3) var(--font-ui);
}
.base-state__description {
  color: var(--ink-3);
  font: var(--weight-regular) var(--size-small)/var(--leading-small) var(--font-ui);
}
.base-state.is-compact {
  padding: 0;
  display: inline-flex;
}
.is-compact .base-state__halo {
  width: auto;
  height: auto;
  background: transparent;
}
</style>
