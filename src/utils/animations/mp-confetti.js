/**
 * 跨平台庆祝粒子效果
 *
 * H5: 使用 canvas-confetti（已安装）
 * 小程序: 使用 CSS keyframe view 动画（通过 uni.$emit 通知 ConfettiOverlay 组件）
 *
 * @module utils/animations/mp-confetti
 */

/**
 * 触发庆祝粒子效果
 * @param {object} options
 * @param {number} options.particleCount - 粒子数量 (default: 50)
 * @param {number} options.spread - 扩散角度 (default: 60)
 * @param {object} options.origin - 原点 { x: 0-1, y: 0-1 }
 * @param {string[]} options.colors - 颜色数组
 */
export function celebrate(options = {}) {
  // #ifdef H5
  try {
    import('canvas-confetti')
      .then(({ default: confetti }) => {
        if (typeof confetti === 'function') {
          confetti({
            particleCount: options.particleCount || 50,
            spread: options.spread || 60,
            origin: options.origin || { y: 0.6 },
            colors: options.colors || ['#0f5f34', '#10b981', '#f59e0b', '#3b82f6', '#ef4444']
          });
        }
      })
      .catch(() => {
        /* no-op: canvas-confetti unavailable */
      });
  } catch (_e) {}
  // #endif

  // #ifndef H5
  // Mini program fallback: create temporary animated views
  _mpCelebrate(options);
  // #endif
}

/**
 * 触发连续庆祝效果（双侧喷射）
 * @param {object} options
 */
export function celebrateContinuous(options = {}) {
  // #ifdef H5
  try {
    import('canvas-confetti')
      .then(({ default: confetti }) => {
        if (typeof confetti !== 'function') return;
        const end = Date.now() + (options.duration || 2000);
        const frame = () => {
          confetti({
            particleCount: options.particleCount || 4,
            angle: 60,
            spread: options.spread || 55,
            origin: { x: 0 },
            colors: options.colors || ['#FFD700', '#26C6DA', '#FF1744', '#4CAF50']
          });
          confetti({
            particleCount: options.particleCount || 4,
            angle: 120,
            spread: options.spread || 55,
            origin: { x: 1 },
            colors: options.colors || ['#FFD700', '#26C6DA', '#FF1744', '#4CAF50']
          });
          if (Date.now() < end) requestAnimationFrame(frame);
        };
        frame();
      })
      .catch(() => {
        /* no-op: canvas-confetti unavailable */
      });
  } catch (_e) {}
  // #endif

  // #ifndef H5
  _mpCelebrate({
    particleCount: Math.min((options.particleCount || 4) * 10, 40),
    colors: options.colors || ['#FFD700', '#26C6DA', '#FF1744', '#4CAF50'],
    origin: { x: 0.5, y: 0.4 }
  });
  // #endif
}

// Mini program implementation using uni event bus
function _mpCelebrate(options = {}) {
  const count = Math.min(options.particleCount || 30, 40); // Limit for performance
  const colors = options.colors || ['#0f5f34', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

  // Use uni event to notify the page's confetti container
  uni.$emit('mp-confetti', { count, colors, origin: options.origin || { x: 0.5, y: 0.6 } });
}
