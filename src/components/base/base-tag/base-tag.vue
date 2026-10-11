<template>
  <view class="base-tag" :class="`base-tag--${tone}`"
    ><BaseIcon
      v-if="icon"
      :name="icon"
      :size="'var(--size-caption)'"
      :tone="tone === 'violet' ? 'violet-ink' : tone === 'neutral' ? 'ink-2' : tone" /><slot></slot
  ></view>
</template>
<script setup>
import BaseIcon from '../base-icon/base-icon.vue';
defineProps({
  tone: {
    type: String,
    default: 'neutral',
    validator: (value) => ['violet', 'mint', 'coral', 'apricot', 'neutral'].includes(value)
  },
  icon: { type: String, default: '' }
});
</script>
<style scoped>
.base-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--s-1);
  height: var(--s-6);
  padding: 0 var(--s-2);
  border-radius: var(--r-xs);
  font: var(--weight-semibold) var(--size-caption)/1 var(--font-ui);
  background: var(--paper-sunk);
  color: var(--ink-2);
  white-space: nowrap;
}
.base-tag--violet {
  background: var(--violet-soft);
  color: var(--violet-ink);
}
.base-tag--mint {
  background: var(--mint-soft);
  color: var(--mint);
}
.base-tag--coral {
  background: var(--coral-soft);
  color: var(--coral);
}
.base-tag--apricot {
  background: var(--apricot-soft);
  color: var(--apricot);
}
</style>
