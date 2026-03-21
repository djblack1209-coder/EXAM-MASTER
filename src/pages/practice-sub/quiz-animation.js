/**
 * 答题动画效果模块 - 提供丰富的答题反馈动画
 *
 * 核心功能：
 * 1. 正确/错误答案动画
 * 2. 连击特效
 * 3. 成就解锁动画
 * 4. 进度里程碑动画
 */

import { logger } from '@/utils/logger.js';
import { playCorrectSound, playWrongSound, playComboSound } from './utils/quiz-sound.js';

// ✅ [体感革命] 引入 canvas-confetti（12.5k stars）
let confettiModule = null;
async function getConfetti() {
  if (confettiModule) return confettiModule;
  try {
    // 动态导入，避免SSR/小程序环境报错
    const mod = await import('canvas-confetti');
    confettiModule = mod.default || mod;
    return confettiModule;
  } catch (_e) {
    return null;
  }
}

// ✅ [体感革命] 真正的confetti爆炸 — 答对时调用
async function fireConfetti(intensity = 'normal') {
  const confetti = await getConfetti();
  if (!confetti) return;

  if (intensity === 'combo') {
    // 连击时：双侧喷射
    confetti({ particleCount: 60, spread: 55, origin: { x: 0.1, y: 0.6 }, colors: ['#FFD700', '#FF6B35', '#FF1744'] });
    confetti({ particleCount: 60, spread: 55, origin: { x: 0.9, y: 0.6 }, colors: ['#FFD700', '#FF6B35', '#FF1744'] });
  } else if (intensity === 'milestone') {
    // 里程碑：全屏烟花
    const end = Date.now() + 1500;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FFD700', '#26C6DA', '#FF1744']
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FFD700', '#26C6DA', '#FF1744']
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  } else {
    // 普通答对：中央爆发
    confetti({
      particleCount: 40,
      spread: 70,
      origin: { y: 0.65 },
      colors: ['#4CAF50', '#8BC34A', '#FFD700', '#26C6DA']
    });
  }
}

// 动画配置
const ANIMATION_CONFIG = {
  // 正确答案动画
  correct: {
    duration: 600,
    scale: [1, 1.2, 1],
    rotate: [0, 5, -5, 0],
    colors: ['#4CAF50', '#8BC34A', '#CDDC39'],
    particles: 12,
    sound: 'correct'
  },
  // 错误答案动画
  wrong: {
    duration: 500,
    shake: [-10, 10, -8, 8, -5, 5, 0],
    colors: ['#F44336', '#E91E63'],
    sound: 'wrong'
  },
  // 连击动画
  combo: {
    thresholds: [3, 5, 10, 20, 50],
    messages: ['不错！', '厉害！', '太强了！', '无敌！', '神级！'],
    colors: ['#FF9800', '#FF5722', '#E91E63', '#9C27B0', '#FFD700']
  },
  // 里程碑动画
  milestone: {
    thresholds: [10, 50, 100, 200, 500],
    messages: ['初露锋芒', '小有成就', '百题斩', '刷题达人', '题海霸主']
  }
};

/**
 * 答题动画管理器
 */
class QuizAnimationManager {
  constructor() {
    this.comboCount = 0;
    this.totalCorrect = 0;
    this.animationQueue = [];
    this.isAnimating = false;
    this.settings = {
      enabled: true,
      showParticles: true,
      showCombo: true,
      showMilestone: true,
      vibration: true,
      sound: uni.getStorageSync('quiz_sound_enabled') || false
    };
  }

  /**
   * 更新设置
   * @param {Object} newSettings - 新设置
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
  }

  /**
   * 播放正确答案动画
   * @param {Object} options - 动画选项
   * @returns {Object} 动画数据
   */
  playCorrectAnimation(options = {}) {
    if (!this.settings.enabled) return null;

    this.comboCount++;
    this.totalCorrect++;

    const animationData = {
      type: 'correct',
      timestamp: Date.now(),
      combo: this.comboCount,
      // ✅ [体感革命] XP奖励数据（基础10 + combo加成）
      xpEarned: 10 + Math.min(this.comboCount * 2, 20),
      ...this._generateCorrectEffects(options)
    };

    // 检查连击
    if (this.settings.showCombo) {
      const comboEffect = this._checkCombo();
      if (comboEffect) {
        animationData.comboEffect = comboEffect;
      }
    }

    // 检查里程碑
    if (this.settings.showMilestone) {
      const milestone = this._checkMilestone();
      if (milestone) {
        animationData.milestone = milestone;
      }
    }

    // 震动反馈
    if (this.settings.vibration) {
      this._vibrate('light');
    }

    // ✅ [体感革命] 音效 + 真实confetti
    if (this.settings.sound) {
      playCorrectSound();
      // 连击时播放升调和弦
      if (this.comboCount >= 3) {
        const level = Math.min(Math.floor(this.comboCount / 5), 4);
        setTimeout(() => playComboSound(level), 150);
      }
    }

    // ✅ [体感革命] 真实confetti爆炸
    if (this.settings.showParticles) {
      if (animationData.milestone) {
        fireConfetti('milestone');
      } else if (this.comboCount >= 5) {
        fireConfetti('combo');
      } else {
        fireConfetti('normal');
      }
    }

    return animationData;
  }

  /**
   * 播放错误答案动画
   * @param {Object} options - 动画选项
   * @returns {Object} 动画数据
   */
  playWrongAnimation(options = {}) {
    if (!this.settings.enabled) return null;

    // 重置连击
    const lostCombo = this.comboCount;
    this.comboCount = 0;

    const animationData = {
      type: 'wrong',
      timestamp: Date.now(),
      lostCombo,
      ...this._generateWrongEffects(options)
    };

    // 震动反馈
    if (this.settings.vibration) {
      this._vibrate('medium');
    }

    // 音效反馈
    if (this.settings.sound) {
      playWrongSound();
    }

    return animationData;
  }

  /**
   * 获取CSS动画样式
   * @param {string} type - 动画类型
   * @returns {Object} CSS样式对象
   */
  getAnimationStyle(type) {
    switch (type) {
      case 'correct':
        return {
          animation: 'correctPulse 0.6s ease-out',
          animationFillMode: 'forwards'
        };
      case 'wrong':
        return {
          animation: 'wrongShake 0.5s ease-out',
          animationFillMode: 'forwards'
        };
      case 'combo':
        return {
          animation: 'comboPopIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          animationFillMode: 'forwards'
        };
      case 'milestone':
        return {
          animation: 'milestoneReveal 1.2s ease-out',
          animationFillMode: 'forwards'
        };
      default:
        return {};
    }
  }

  /**
   * 生成粒子效果数据
   * @param {number} count - 粒子数量
   * @param {string} color - 主色调
   * @returns {Array} 粒子数据数组
   */
  generateParticles(count = 12, color = '#4CAF50') {
    if (!this.settings.showParticles) return [];

    const particles = [];
    const colors = this._generateColorVariants(color, 3);

    for (let i = 0; i < count; i++) {
      const angle = (360 / count) * i + Math.random() * 30 - 15;
      const distance = 50 + Math.random() * 50;
      const size = 4 + Math.random() * 8;
      const duration = 0.6 + Math.random() * 0.4;

      particles.push({
        id: i,
        angle,
        distance,
        size,
        duration,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.1,
        shape: Math.random() > 0.5 ? 'circle' : 'star'
      });
    }

    return particles;
  }

  /**
   * 生成连击文字效果
   * @returns {Object|null} 连击效果数据
   */
  getComboDisplay() {
    if (this.comboCount < 2) return null;

    const config = ANIMATION_CONFIG.combo;
    let level = 0;

    for (let i = config.thresholds.length - 1; i >= 0; i--) {
      if (this.comboCount >= config.thresholds[i]) {
        level = i;
        break;
      }
    }

    return {
      count: this.comboCount,
      message: this.comboCount >= config.thresholds[0] ? config.messages[level] : '',
      color: config.colors[Math.min(level, config.colors.length - 1)],
      level,
      isSpecial: this.comboCount >= config.thresholds[2] // 10连击以上为特殊
    };
  }

  /**
   * 重置状态
   */
  reset() {
    this.comboCount = 0;
  }

  /**
   * 获取当前状态
   * @returns {Object} 当前状态
   */
  getState() {
    return {
      comboCount: this.comboCount,
      totalCorrect: this.totalCorrect,
      isAnimating: this.isAnimating
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 生成正确答案效果
   */
  _generateCorrectEffects(_options) {
    const config = ANIMATION_CONFIG.correct;

    return {
      duration: config.duration,
      particles: this.generateParticles(config.particles, config.colors[0]),
      glowColor: config.colors[0],
      scaleKeyframes: config.scale,
      rotateKeyframes: config.rotate
    };
  }

  /**
   * 生成错误答案效果
   */
  _generateWrongEffects(_options) {
    const config = ANIMATION_CONFIG.wrong;

    return {
      duration: config.duration,
      shakeKeyframes: config.shake,
      glowColor: config.colors[0]
    };
  }

  /**
   * 检查连击
   */
  _checkCombo() {
    const config = ANIMATION_CONFIG.combo;

    for (let i = config.thresholds.length - 1; i >= 0; i--) {
      if (this.comboCount === config.thresholds[i]) {
        return {
          threshold: config.thresholds[i],
          message: config.messages[i],
          color: config.colors[i],
          level: i
        };
      }
    }

    return null;
  }

  /**
   * 检查里程碑
   */
  _checkMilestone() {
    const config = ANIMATION_CONFIG.milestone;

    for (let i = config.thresholds.length - 1; i >= 0; i--) {
      if (this.totalCorrect === config.thresholds[i]) {
        return {
          threshold: config.thresholds[i],
          message: config.messages[i],
          level: i
        };
      }
    }

    return null;
  }

  /**
   * 生成颜色变体
   */
  _generateColorVariants(baseColor, count) {
    const variants = [baseColor];

    // 简单的颜色变体生成
    for (let i = 1; i < count; i++) {
      const lightness = 10 + i * 15;
      variants.push(this._adjustColorLightness(baseColor, lightness));
    }

    return variants;
  }

  /**
   * 调整颜色亮度
   */
  _adjustColorLightness(hex, percent) {
    // 简化实现，实际可以使用更复杂的颜色算法
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
    const B = Math.min(255, (num & 0x0000ff) + amt);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  /**
   * 震动反馈
   */
  _vibrate(type = 'light') {
    try {
      if (typeof uni !== 'undefined' && typeof uni.vibrateShort === 'function') {
        uni.vibrateShort({ type });
      }
    } catch (e) {
      logger.warn('[QuizAnimation] 震动反馈失败:', e);
    }
  }
}

// 创建单例
export const quizAnimationManager = new QuizAnimationManager();

/**
 * 生成CSS关键帧动画字符串
 * @returns {string} CSS动画定义
 */
export function getAnimationCSS() {
  return `
    @keyframes correctPulse {
      0% { transform: scale(1); opacity: 1; }
      30% { transform: scale(1.15); }
      60% { transform: scale(0.95); }
      100% { transform: scale(1); opacity: 1; }
    }

    @keyframes wrongShake {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
      20%, 40%, 60%, 80% { transform: translateX(8px); }
    }

    @keyframes comboPopIn {
      0% { transform: scale(0) rotate(-180deg); opacity: 0; }
      50% { transform: scale(1.3) rotate(10deg); }
      70% { transform: scale(0.9) rotate(-5deg); }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }

    @keyframes milestoneReveal {
      0% { transform: translateY(50px) scale(0.5); opacity: 0; }
      40% { transform: translateY(-10px) scale(1.1); opacity: 1; }
      60% { transform: translateY(5px) scale(0.95); }
      100% { transform: translateY(0) scale(1); opacity: 1; }
    }

    @keyframes particleFly {
      0% { transform: translate(0, 0) scale(1); opacity: 1; }
      100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
    }

    @keyframes glowPulse {
      0%, 100% { box-shadow: 0 0 5px var(--glow-color); }
      50% { box-shadow: 0 0 20px var(--glow-color), 0 0 40px var(--glow-color); }
    }

    @keyframes starSpin {
      0% { transform: rotate(0deg) scale(1); }
      50% { transform: rotate(180deg) scale(1.2); }
      100% { transform: rotate(360deg) scale(1); }
    }

    @keyframes bounceIn {
      0% { transform: scale(0); }
      50% { transform: scale(1.25); }
      70% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }

    @keyframes fadeInUp {
      0% { transform: translateY(20px); opacity: 0; }
      100% { transform: translateY(0); opacity: 1; }
    }

    @keyframes slideInRight {
      0% { transform: translateX(100%); opacity: 0; }
      100% { transform: translateX(0); opacity: 1; }
    }

    @keyframes heartbeat {
      0%, 100% { transform: scale(1); }
      25% { transform: scale(1.1); }
      50% { transform: scale(1); }
      75% { transform: scale(1.1); }
    }

    .quiz-correct-animation {
      animation: correctPulse 0.6s ease-out;
    }

    .quiz-wrong-animation {
      animation: wrongShake 0.5s ease-out;
    }

    .quiz-combo-animation {
      animation: comboPopIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    .quiz-milestone-animation {
      animation: milestoneReveal 1.2s ease-out;
    }

    .quiz-particle {
      position: absolute;
      pointer-events: none;
      animation: particleFly 0.8s ease-out forwards;
    }

    .quiz-glow {
      animation: glowPulse 1s ease-in-out infinite;
    }

    .quiz-bounce {
      animation: bounceIn 0.5s ease-out;
    }

    .quiz-fade-up {
      animation: fadeInUp 0.4s ease-out;
    }
  `;
}

// 便捷函数
export function playCorrectAnimation(options) {
  return quizAnimationManager.playCorrectAnimation(options);
}

export function playWrongAnimation(options) {
  return quizAnimationManager.playWrongAnimation(options);
}

export function getAnimationStyle(type) {
  return quizAnimationManager.getAnimationStyle(type);
}

export function generateParticles(count, color) {
  return quizAnimationManager.generateParticles(count, color);
}

export function getComboDisplay() {
  return quizAnimationManager.getComboDisplay();
}

export function resetAnimation() {
  return quizAnimationManager.reset();
}

export function updateAnimationSettings(settings) {
  return quizAnimationManager.updateSettings(settings);
}

export { ANIMATION_CONFIG };
export default quizAnimationManager;
