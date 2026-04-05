<template>
  <view class="base-icon" :style="wrapperStyle">
    <image v-if="iconSrc" class="base-icon__img" :src="iconSrc" alt="" mode="aspectFit" />
  </view>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { getIconPath } from './icons.js';
import storageService from '@/services/storageService.js';

const props = defineProps({
  name: { type: String, default: 'info' },
  size: { type: [String, Number], default: 40 },
  color: { type: String, default: '' },
  theme: { type: String, default: '' }
});

const themeMode = ref('light');

const sizeRpx = computed(() => {
  const parsedSize = typeof props.size === 'number' ? props.size : Number.parseInt(String(props.size || ''), 10);
  const safeSize = Number.isFinite(parsedSize) ? parsedSize : 40;
  return `${safeSize}rpx`;
});

const currentTheme = computed(() => {
  return props.theme || themeMode.value || 'light';
});

const iconSrc = computed(() => {
  return getIconPath(props.name, undefined, currentTheme.value, props.color);
});

const wrapperStyle = computed(() => {
  return {
    width: sizeRpx.value,
    height: sizeRpx.value
  };
});

function syncTheme() {
  try {
    themeMode.value = storageService.get('theme_mode', 'light') || 'light';
  } catch (_e) {
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
</style>
