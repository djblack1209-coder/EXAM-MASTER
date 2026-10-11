<template>
  <view class="base-icon" :style="wrapperStyle" aria-hidden="true">
    <!-- #ifdef H5 -->
    <!-- eslint-disable-next-line vue/no-v-html -- Only trusted static registry SVG, no caller markup. -->
    <span v-if="iconMarkup" class="base-icon__svg" v-html="iconMarkup"></span>
    <img
      v-else-if="iconSrc"
      class="base-icon__img"
      :class="{ 'base-icon__apple': name === 'apple' }"
      :src="iconSrc"
      alt=""
      draggable="false"
    />
    <!-- #endif -->
    <!-- #ifndef H5 -->
    <image
      v-if="iconSrc"
      class="base-icon__img"
      :class="{ 'base-icon__apple': name === 'apple' }"
      :src="iconSrc"
      alt=""
      mode="aspectFit"
    />
    <!-- #endif -->
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { getIconPath, getIconMarkup } from './icons.js';
import { tokens } from '@/design/tokens.js';
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

const props = defineProps({
  name: { type: String, default: 'info' },
  size: { type: [String, Number], default: 'var(--control-icon)' },
  color: { type: String, default: '' },
  theme: { type: String, default: '' },
  tone: { type: String, default: 'ink' },
  selected: { type: Boolean, default: false }
});

const themeMode = ref('light');

const sizeRpx = computed(() => {
  if (typeof props.size === 'string' && /^(var\(|calc\(|[\d.]+(px|rpx|rem|%))/.test(props.size)) return props.size;
  const parsedSize = typeof props.size === 'number' ? props.size : Number.parseInt(String(props.size || ''), 10);
  const safeSize = Number.isFinite(parsedSize) ? parsedSize : 40;
  return `${safeSize}rpx`;
});

const currentTheme = computed(() => {
  return props.theme || themeMode.value || 'light';
});

const iconSrc = computed(() => {
  return getIconPath(
    props.name,
    undefined,
    currentTheme.value,
    props.color || tokens[currentTheme.value === 'dark' ? 'dark' : 'light'][`--${props.tone}`],
    props.selected
  );
});
const iconMarkup = computed(() => getIconMarkup(props.name, props.selected));

const wrapperStyle = computed(() => {
  return {
    width: sizeRpx.value,
    height: sizeRpx.value,
    color: props.color || `var(--${props.tone})`
  };
});

function syncTheme() {
  try {
    themeMode.value = storageService.get('theme_mode', 'light') || 'light';
  } catch (_e) {
    // 静默降级：图标加载失败不打扰用户
    logger.warn('[BaseIcon] 主题读取失败，使用默认主题');
    themeMode.value = 'light';
  }
}

let _themeHandler;

onMounted(() => {
  syncTheme();
  _themeHandler = (mode) => {
    themeMode.value = mode === 'dark' ? 'dark' : 'light';
  };
  if (typeof uni !== 'undefined' && typeof uni.$on === 'function') {
    uni.$on('themeUpdate', _themeHandler);
    uni.$on('updateTheme', _themeHandler);
  }
});

onBeforeUnmount(() => {
  if (_themeHandler && typeof uni !== 'undefined' && typeof uni.$off === 'function') {
    uni.$off('themeUpdate', _themeHandler);
    uni.$off('updateTheme', _themeHandler);
  }
});
</script>

<style scoped>
.base-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.base-icon__img {
  width: 100%;
  height: 100%;
  display: block;
}
.base-icon__svg {
  display: inline-flex;
  width: 100%;
  height: 100%;
}
.base-icon__svg :deep(svg) {
  width: 100%;
  height: 100%;
}
/* The official Apple silhouette takes the foreground of its official button. */
.base-icon__apple {
  filter: var(--apple-icon-filter, none);
}
</style>
