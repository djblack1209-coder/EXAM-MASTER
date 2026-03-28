/**
 * 微交互动画工具集
 *
 * @module utils/animations/micro-interactions
 */

// ---------------------------------------------------------------------------
// Number counting animation
// ---------------------------------------------------------------------------

/**
 * 数字滚动动画（用于 XP、分数、统计数据等）
 *
 * @param {number} from  - 起始值
 * @param {number} to    - 目标值
 * @param {number} duration - 动画时长 ms（默认 800）
 * @param {(current: number) => void} onUpdate - 每帧回调，接收当前值
 * @returns {{ cancel: () => void }} 返回可取消句柄
 */
export function animateNumber(from, to, duration = 800, onUpdate) {
  if (typeof onUpdate !== 'function') {
    return { cancel: () => undefined };
  }

  const start = performance.now();
  const delta = to - from;
  let rafId = null;
  let cancelled = false;

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function tick(now) {
    if (cancelled) return;
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutCubic(progress);
    const current = Math.round(from + delta * easedProgress);

    onUpdate(current);

    if (progress < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      onUpdate(to); // 确保最终值精确
    }
  }

  rafId = requestAnimationFrame(tick);

  return {
    cancel() {
      cancelled = true;
      if (rafId != null) cancelAnimationFrame(rafId);
    }
  };
}
