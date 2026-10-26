<template>
  <view class="muse-figure" role="figure" :aria-label="figure.caption">
    <!-- #ifdef H5 -->
    <img class="figure-image" :src="source" :alt="figure.caption" draggable="false" :style="dimensions" />
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <image class="figure-image" :src="source" mode="aspectFit" :aria-label="figure.caption" :style="dimensions" />
    <!-- #endif -->
    <text class="figure-caption">{{ figure.caption }}</text>
  </view>
</template>
<script setup>
import { computed } from 'vue';
import { useThemeStore } from '@/stores/modules/theme.js';
import { figureSvg } from '../../../../laf-backend/functions/_shared/learning-figures.js';
const props = defineProps({ figure: { type: Object, required: true } });
const theme = useThemeStore();
const source = computed(
  () =>
    'data:image/svg+xml,' +
    encodeURIComponent(
      figureSvg(
        props.figure,
        theme.isDark
          ? { node: '#1f1f20', line: '#94a3b8', text: '#f2f7ff' }
          : { node: '#fff', line: '#64748b', text: '#0f172a' }
      )
    )
);
const dimensions = computed(() => ({
  width: `${props.figure.width || 260}px`,
  aspectRatio: `${props.figure.width || 260}/${props.figure.height || 174}`
}));
</script>
<style scoped>
.muse-figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  gap: 8px;
}
.figure-image {
  display: block;
  max-width: 100%;
  height: auto;
  object-fit: contain;
}
.figure-caption {
  color: var(--ink-3);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
</style>
