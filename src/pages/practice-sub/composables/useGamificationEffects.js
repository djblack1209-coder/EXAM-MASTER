/**
 * 游戏化视觉/触觉反馈层
 *
 * 提供 XP 浮动文字、连续学习庆祝、成就 toast、答题反馈等效果。
 * 依赖 canvas-confetti（动态导入，不影响首屏体积）和 uni 振动 API。
 *
 * @module composables/useGamificationEffects
 */

import { toast } from '@/utils/toast.js';
let _confetti = null;
let _storeRef = null;

function _getStore() {
  if (!_storeRef) {
    try {
      const { useGamificationStore } = require('@/stores/index.js');
      _storeRef = useGamificationStore();
    } catch {
      /* pinia 未就绪 */
    }
  }
  return _storeRef;
}

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

function vibrate(type = 'light') {
  try {
    if (typeof uni !== 'undefined' && uni.vibrateShort) {
      uni.vibrateShort({ type });
    }
  } catch {
    /* 静默 */
  }
}

export function useGamificationEffects() {
  async function celebrateStreak(days) {
    vibrate('medium');
    const confetti = await getConfetti();
    if (!confetti) return;
    confetti({ particleCount: Math.min(days * 10, 150), spread: 60, origin: { y: 0.7 } });
  }

  async function celebrateLevelUp(_level) {
    vibrate('heavy');
    const confetti = await getConfetti();
    if (!confetti) return;
    // 大型庆祝：两波纸屑
    confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 100, spread: 120, origin: { y: 0.5 } }), 300);
  }

  function celebrateAchievement(achievement) {
    vibrate('medium');
    try {
      if (typeof uni !== 'undefined' && uni.showToast) {
        toast.info(`${achievement.icon || '🏅'} ${achievement.name}`, 3000);
      }
    } catch {
      /* 静默 */
    }
  }

  function celebrateCorrectAnswer() {
    vibrate('light');
  }

  function celebrateWrongAnswer() {
    vibrate('light');
  }

  function showXpGain(amount, x = 0, y = 0) {
    // 跨平台：通过 uni 事件通知 XpToast 组件显示
    try {
      if (typeof uni !== 'undefined' && uni.$emit) {
        const store = _getStore();
        const multiplier = store ? store.getXpMultiplier() : 1;
        uni.$emit('gamification:show-xp', { amount, x, y, multiplier });
      }
    } catch {
      /* 静默 */
    }
  }

  return {
    celebrateStreak,
    celebrateLevelUp,
    celebrateAchievement,
    celebrateCorrectAnswer,
    celebrateWrongAnswer,
    showXpGain
  };
}
