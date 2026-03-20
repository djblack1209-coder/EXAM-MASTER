<template>
  <view v-if="visible" class="xp-toast" :style="positionStyle">
    <view class="xp-toast-inner" :class="{ 'xp-toast-animate': animating }">
      <text class="xp-amount">+{{ amount }} XP</text>
      <text v-if="multiplier > 1" class="xp-multiplier">x{{ multiplier }}</text>
    </view>
  </view>
</template>

<script>
/**
 * XP 浮动文字组件（跨平台，兼容小程序/H5/App）
 *
 * 用法：通过 uni.$on('gamification:show-xp') 触发显示
 * 或直接调用 ref.show({ amount, x, y, multiplier })
 */
export default {
  name: 'XpToast',
  data() {
    return {
      visible: false,
      animating: false,
      amount: 0,
      multiplier: 1,
      x: 0,
      y: 0,
      timerId: null
    };
  },
  computed: {
    positionStyle() {
      return {
        left: this.x ? `${this.x}px` : '50%',
        top: this.y ? `${this.y}px` : '45%'
      };
    }
  },
  mounted() {
    uni.$on('gamification:show-xp', this.show);
  },
  beforeUnmount() {
    uni.$off('gamification:show-xp', this.show);
    if (this.timerId) clearTimeout(this.timerId);
  },
  methods: {
    show({ amount = 10, x = 0, y = 0, multiplier = 1 } = {}) {
      if (this.timerId) clearTimeout(this.timerId);
      this.amount = amount;
      this.multiplier = multiplier;
      this.x = x;
      this.y = y;
      this.visible = true;
      this.animating = false;

      // 触发动画（下一帧）
      setTimeout(() => {
        this.animating = true;
      }, 16);

      // 1.2秒后隐藏
      this.timerId = setTimeout(() => {
        this.visible = false;
        this.animating = false;
      }, 1200);
    }
  }
};
</script>

<style scoped lang="scss">
.xp-toast {
  position: fixed;
  z-index: 99999;
  pointer-events: none;
  transform: translateX(-50%);
}

.xp-toast-inner {
  display: flex;
  align-items: center;
  gap: 4rpx;
  opacity: 1;
  transform: translateY(0);
  transition: all 1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.xp-toast-inner.xp-toast-animate {
  opacity: 0;
  transform: translateY(-80rpx);
}

.xp-amount {
  font-size: 36rpx;
  font-weight: 700;
  color: #ffd700;
  text-shadow: 0 2rpx 8rpx rgba(255, 215, 0, 0.5);
}

.xp-multiplier {
  font-size: 24rpx;
  font-weight: 600;
  color: #ff6b35;
  margin-left: 4rpx;
}
</style>
