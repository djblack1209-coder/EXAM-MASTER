<template>
  <view class="base-icon" :style="wrapperStyle">
    <image
      v-if="iconSrc"
      class="base-icon__img"
      :src="iconSrc"
      mode="aspectFit"
    />
  </view>
</template>

<script>
import { getIconPath } from './icons.js';

export default {
  name: 'BaseIcon',
  props: {
    name: { type: String, default: 'info' },
    size: { type: [String, Number], default: 40 },
    color: { type: String, default: '' }
  },
  computed: {
    sizeRpx() {
      const parsedSize = typeof this.size === 'number' ? this.size : Number.parseInt(String(this.size || ''), 10);
      const safeSize = Number.isFinite(parsedSize) ? parsedSize : 40;
      return `${safeSize}rpx`;
    },
    iconSrc() {
      return getIconPath(this.name);
    },
    wrapperStyle() {
      return {
        width: this.sizeRpx,
        height: this.sizeRpx
      };
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
}
</style>
