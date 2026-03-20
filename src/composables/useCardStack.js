/**
 * 卡片堆叠切换 composable
 * 提供 3 层卡片堆叠视觉效果：当前卡片在最上层，下一张缩小在后面
 * 滑动时当前卡片飞出，下一张放大到前台
 *
 * 兼容 uni-app H5 + 小程序
 */
import { ref, computed } from 'vue';

const SWIPE_THRESHOLD = 80; // 滑动触发阈值 (px)
const STACK_SCALE = 0.92; // 后方卡片缩放比例
const STACK_OFFSET_Y = 20; // 后方卡片 Y 偏移 (rpx → px ≈ 10px)

export function useCardStack(options = {}) {
  const { onSwipeLeft = null, onSwipeRight = null, threshold = SWIPE_THRESHOLD } = options;

  const deltaX = ref(0);
  const deltaY = ref(0);
  const isSwiping = ref(false);
  const isAnimating = ref(false);

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  /**
   * 当前卡片样式（最上层，跟随手指移动）
   */
  const currentCardStyle = computed(() => {
    if (isAnimating.value) {
      return {
        transform: 'translateX(0) rotate(0deg) scale(1)',
        transition: 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        zIndex: 3
      };
    }
    if (deltaX.value === 0) {
      return {
        transform: 'translateX(0) rotate(0deg) scale(1)',
        transition: 'transform 0.3s ease',
        zIndex: 3
      };
    }
    // 跟随手指：平移 + 微旋转
    const rotate = (deltaX.value / 400) * 8; // 最大旋转 8 度
    const opacity = Math.max(0.5, 1 - Math.abs(deltaX.value) / 500);
    return {
      transform: `translateX(${deltaX.value}px) rotate(${rotate}deg) scale(1)`,
      opacity,
      transition: 'none',
      zIndex: 3
    };
  });

  /**
   * 下一张卡片样式（第二层，随滑动逐渐放大）
   */
  const nextCardStyle = computed(() => {
    const progress = Math.min(1, Math.abs(deltaX.value) / threshold);
    const scale = STACK_SCALE + (1 - STACK_SCALE) * progress;
    const offsetY = STACK_OFFSET_Y * (1 - progress);
    return {
      transform: `translateY(${offsetY}px) scale(${scale})`,
      transition: deltaX.value === 0 ? 'transform 0.3s ease' : 'none',
      zIndex: 2
    };
  });

  /**
   * 第三层卡片样式（最底层，微缩）
   */
  const thirdCardStyle = computed(() => {
    const progress = Math.min(1, Math.abs(deltaX.value) / threshold);
    const baseScale = STACK_SCALE * STACK_SCALE;
    const scale = baseScale + (STACK_SCALE - baseScale) * progress;
    const offsetY = STACK_OFFSET_Y * 2 * (1 - progress) + STACK_OFFSET_Y * progress;
    return {
      transform: `translateY(${offsetY}px) scale(${scale})`,
      transition: deltaX.value === 0 ? 'transform 0.3s ease' : 'none',
      zIndex: 1,
      opacity: 0.6 + 0.4 * progress
    };
  });

  function onTouchStart(e) {
    if (isAnimating.value) return;
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    if (!touch) return;
    startX = touch.clientX;
    startY = touch.clientY;
    startTime = Date.now();
    isSwiping.value = false;
  }

  function onTouchMove(e) {
    if (isAnimating.value) return;
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    if (!touch) return;

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    // 判断是否为水平滑动（首次判定）
    if (!isSwiping.value) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        isSwiping.value = true;
      } else if (Math.abs(dy) > 10) {
        return; // 垂直滚动，不拦截
      }
    }

    if (isSwiping.value) {
      deltaX.value = dx;
      deltaY.value = dy;
    }
  }

  function onTouchEnd() {
    if (isAnimating.value || !isSwiping.value) {
      deltaX.value = 0;
      isSwiping.value = false;
      return;
    }

    const elapsed = Date.now() - startTime;
    const velocity = Math.abs(deltaX.value) / elapsed; // px/ms

    // 快速滑动或超过阈值
    const triggered = Math.abs(deltaX.value) > threshold || (velocity > 0.5 && Math.abs(deltaX.value) > 30);

    if (triggered) {
      const direction = deltaX.value > 0 ? 'right' : 'left';
      if (direction === 'left' && onSwipeLeft) {
        onSwipeLeft();
      } else if (direction === 'right' && onSwipeRight) {
        onSwipeRight();
      }
    }

    // 回弹
    deltaX.value = 0;
    deltaY.value = 0;
    isSwiping.value = false;
  }

  /**
   * 编程式触发飞出动画（用于点击选项后自动切题）
   */
  function animateOut(direction = 'left') {
    return new Promise((resolve) => {
      isAnimating.value = true;
      deltaX.value = direction === 'left' ? -400 : 400;

      setTimeout(() => {
        deltaX.value = 0;
        isAnimating.value = false;
        resolve();
      }, 350);
    });
  }

  return {
    deltaX,
    isSwiping,
    isAnimating,
    currentCardStyle,
    nextCardStyle,
    thirdCardStyle,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    animateOut
  };
}
