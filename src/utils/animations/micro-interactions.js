/**
 * 微交互动画工具集
 * 搬运自 auto-animate + canvas-confetti + 自定义扩展
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

// ---------------------------------------------------------------------------
// Haptic feedback
// ---------------------------------------------------------------------------

const HAPTIC_PATTERNS = {
  /** 轻触 — 答对 */
  light: () => vibrateShort('light'),
  /** 中等 — 答错 */
  medium: () => vibrateShort('medium'),
  /** 重击 — 连击 combo */
  heavy: () => vibrateShort('heavy'),
  /** 双振 — 错误提示 */
  double: () => {
    vibrateShort('medium');
    setTimeout(() => vibrateShort('medium'), 120);
  },
  /** 节奏振动 — 成就解锁 */
  pattern: () => {
    vibrateShort('light');
    setTimeout(() => vibrateShort('medium'), 100);
    setTimeout(() => vibrateShort('heavy'), 250);
  }
};

function vibrateShort(type = 'light') {
  try {
    if (typeof uni !== 'undefined' && uni.vibrateShort) {
      uni.vibrateShort({ type });
    }
  } catch {
    /* 静默：平台不支持 */
  }
}

/**
 * 触觉反馈
 *
 * @param {'light'|'medium'|'heavy'|'double'|'pattern'} type
 */
export function hapticFeedback(type = 'light') {
  const handler = HAPTIC_PATTERNS[type] || HAPTIC_PATTERNS.light;
  handler();
}

// ---------------------------------------------------------------------------
// Celebration effects (wraps canvas-confetti)
// ---------------------------------------------------------------------------

let _confetti = null;

async function getConfetti() {
  if (_confetti) return _confetti;
  try {
    const mod = await import('canvas-confetti');
    _confetti = mod.default || mod;
    return _confetti;
  } catch {
    return null;
  }
}

const CELEBRATE_PRESETS = {
  /** 基础纸屑 */
  async default() {
    const confetti = await getConfetti();
    if (!confetti) return;
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 }
    });
  },

  /** 连击 combo — 两侧发射 */
  async combo() {
    const confetti = await getConfetti();
    if (!confetti) return;
    const defaults = { particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } };
    confetti({ ...defaults });
    confetti({ ...defaults, angle: 120, origin: { x: 1 } });
  },

  /** 成就解锁 — 星形爆发 */
  async achievement() {
    const confetti = await getConfetti();
    if (!confetti) return;
    confetti({
      particleCount: 120,
      spread: 100,
      origin: { y: 0.6 },
      shapes: ['star'],
      colors: ['#FFD700', '#FFA500', '#FF6347']
    });
  },

  /** 升级 — 烟花效果 */
  async levelup() {
    const confetti = await getConfetti();
    if (!confetti) return;
    const duration = 1500;
    const end = Date.now() + duration;

    function frame() {
      confetti({
        particleCount: 30,
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        origin: {
          x: Math.random(),
          y: Math.random() * 0.4
        }
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    }
    frame();
  }
};

/**
 * 庆祝特效
 *
 * @param {'default'|'combo'|'achievement'|'levelup'} type
 */
export function celebrate(type = 'default') {
  const preset = CELEBRATE_PRESETS[type] || CELEBRATE_PRESETS.default;
  preset();
}

// ---------------------------------------------------------------------------
// Page transition helper
// ---------------------------------------------------------------------------

const TRANSITION_MAP = {
  fade: {
    enter: 'animate__animated animate__fadeIn',
    leave: 'animate__animated animate__fadeOut'
  },
  slideLeft: {
    enter: 'animate__animated animate__slideInRight',
    leave: 'animate__animated animate__slideOutLeft'
  },
  slideUp: {
    enter: 'animate__animated animate__slideInUp',
    leave: 'animate__animated animate__slideOutDown'
  },
  zoom: {
    enter: 'animate__animated animate__zoomIn',
    leave: 'animate__animated animate__zoomOut'
  },
  /** uni-app 内置过渡（不依赖 animate.css） */
  uniFade: {
    enter: 'uni-fade-in',
    leave: 'uni-fade-out'
  }
};

/**
 * 页面过渡辅助 — 返回 enter/leave CSS 类名
 *
 * @param {'fade'|'slideLeft'|'slideUp'|'zoom'|'uniFade'} type
 * @returns {{ enter: string, leave: string }}
 */
export function pageTransition(type = 'fade') {
  return TRANSITION_MAP[type] || TRANSITION_MAP.fade;
}
