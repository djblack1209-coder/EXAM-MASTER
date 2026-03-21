<template>
  <view class="base-icon" :style="wrapperStyle">
    <image v-if="iconSrc" class="base-icon__img" :src="iconSrc" alt="" mode="aspectFit" />
  </view>
</template>

<script>
import { getIconPath } from './icons.js';
import storageService from '@/services/storageService.js';

export default {
  name: 'BaseIcon',
  props: {
    name: { type: String, default: 'info' },
    size: { type: [String, Number], default: 40 },
    color: { type: String, default: '' },
    theme: { type: String, default: '' }
  },
  data() {
    return {
      themeMode: 'light'
    };
  },
  computed: {
    sizeRpx() {
      const parsedSize = typeof this.size === 'number' ? this.size : Number.parseInt(String(this.size || ''), 10);
      const safeSize = Number.isFinite(parsedSize) ? parsedSize : 40;
      return `${safeSize}rpx`;
    },
    currentTheme() {
      return this.theme || this.themeMode || 'light';
    },
    iconSrc() {
      return getIconPath(this.name, undefined, this.currentTheme);
    },
    wrapperStyle() {
      return {
        width: this.sizeRpx,
        height: this.sizeRpx
      };
    }
  },
  mounted() {
    this.syncTheme();
    this._themeHandler = (mode) => {
      this.themeMode = mode === 'dark' ? 'dark' : 'light';
    };
    if (typeof uni !== 'undefined' && typeof uni.$on === 'function') {
      uni.$on('themeUpdate', this._themeHandler);
      uni.$on('updateTheme', this._themeHandler);
    }
  },
  beforeUnmount() {
    if (this._themeHandler && typeof uni !== 'undefined' && typeof uni.$off === 'function') {
      uni.$off('themeUpdate', this._themeHandler);
      uni.$off('updateTheme', this._themeHandler);
    }
  },
  methods: {
    syncTheme() {
      try {
        this.themeMode = storageService.get('theme_mode', 'light') || 'light';
      } catch (_e) {
        this.themeMode = 'light';
      }
    }
  }
};
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
  transition: opacity 0.22s ease;
}
</style>
