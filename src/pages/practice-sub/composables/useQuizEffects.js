/**
 * 答题动画/特效 composable
 *
 * 从 do-quiz.vue 提取的答题正确/错误动画、连击特效、粒子效果、
 * 屏幕微震、升级动画等视觉反馈逻辑。
 *
 * @module composables/useQuizEffects
 */

import { ref } from 'vue';
import { playCorrectAnimation, playWrongAnimation, getComboDisplay, resetAnimation } from '../quiz-animation.js';

/** 粒子可选颜色池 */
const PARTICLE_COLORS = ['#4CAF50', '#8BC34A', '#FFD700', '#26C6DA', '#FF9800', '#FF5722', '#E91E63', '#9C27B0'];

/**
 * 生成随机粒子数组
 *
 * @param {number} count - 粒子数量（8-12）
 * @returns {Array<{id: number, x: number, y: number, size: number, color: string, duration: number, delay: number}>}
 */
function generateRandomParticles(count) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      // 位置：以中心为原点，随机偏移 -50% ~ 50%
      x: Math.random() * 100 - 50,
      y: Math.random() * 100 - 50,
      // 大小：4px ~ 12px
      size: 4 + Math.random() * 8,
      // 从颜色池随机取色
      color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      // 动画持续时间：600ms ~ 1000ms
      duration: 600 + Math.random() * 400,
      // 延迟：0 ~ 100ms，制造错落感
      delay: Math.random() * 100
    });
  }
  return particles;
}

/**
 * 答题动画/特效 composable
 *
 * 管理答对/答错时的视觉反馈，包括：
 * - 正确/错误 CSS 动画类
 * - 连击（combo）数字与文案显示
 * - 随机粒子爆炸效果
 * - 屏幕微震
 * - 升级弹窗
 *
 * @returns {{
 *   comboDisplay: import('vue').Ref<{count: number, message: string, color: string} | null>,
 *   showComboEffect: import('vue').Ref<boolean>,
 *   correctAnimationClass: import('vue').Ref<string>,
 *   wrongAnimationClass: import('vue').Ref<string>,
 *   screenShake: import('vue').Ref<boolean>,
 *   particles: import('vue').Ref<Array>,
 *   showParticles: import('vue').Ref<boolean>,
 *   showLevelUp: import('vue').Ref<boolean>,
 *   playCorrectEffect: (comboCount: number, xpSystem: object, _safeTimeout: Function) => {correctAnimationClass: string},
 *   playWrongEffect: (_safeTimeout: Function) => {wrongAnimationClass: string},
 *   resetEffects: () => void,
 * }}
 */
export function useQuizEffects() {
  // ==================== 响应式状态 ====================

  /** @type {import('vue').Ref<{count: number, message: string, color: string} | null>} 连击显示数据 */
  const comboDisplay = ref(null);

  /** @type {import('vue').Ref<boolean>} 连击特效开关 */
  const showComboEffect = ref(false);

  /** @type {import('vue').Ref<string>} 正确动画 CSS 类 */
  const correctAnimationClass = ref('');

  /** @type {import('vue').Ref<string>} 错误动画 CSS 类 */
  const wrongAnimationClass = ref('');

  /** @type {import('vue').Ref<boolean>} 屏幕微震 */
  const screenShake = ref(false);

  /** @type {import('vue').Ref<Array>} 粒子数据数组 */
  const particles = ref([]);

  /** @type {import('vue').Ref<boolean>} 粒子特效开关 */
  const showParticles = ref(false);

  /** @type {import('vue').Ref<boolean>} 升级特效开关 */
  const showLevelUp = ref(false);

  // ==================== 方法 ====================

  /**
   * 播放正确答案特效
   *
   * 触发正确动画类、连击显示、粒子爆炸。
   * XP 相关逻辑（xpBoostActive / xpBoostRemaining / xpSystem.earnXP）
   * 留给外部在调用后自行处理。
   *
   * @param {number} comboCount - 当前连击数（由外部维护）
   * @param {object} xpSystem - XP 系统实例（仅用于判断升级，具体 XP 计算留给外部）
   * @param {Function} _safeTimeout - 安全延时函数，签名 (callback, delay) => void
   * @returns {{ correctAnimationClass: string }} 当前设置的动画类名
   */
  function playCorrectEffect(comboCount, xpSystem, _safeTimeout) {
    const animData = playCorrectAnimation();
    if (!animData) {
      return { correctAnimationClass: '' };
    }

    // 1. 设置正确动画类
    correctAnimationClass.value = 'quiz-correct-animation';

    // 2. 粒子特效：生成 8-12 个随机粒子
    const particleCount = 8 + Math.floor(Math.random() * 5); // 8 ~ 12
    particles.value = generateRandomParticles(particleCount);
    showParticles.value = true;
    _safeTimeout(() => {
      showParticles.value = false;
      particles.value = [];
    }, 1000);

    // 3. 连击显示
    comboDisplay.value = getComboDisplay();
    if (comboDisplay.value && comboDisplay.value.count >= 3) {
      showComboEffect.value = true;
      _safeTimeout(() => {
        showComboEffect.value = false;
      }, 2000);
    }

    // 4. 动画结束后清除类名（与 CSS 动画时长 600ms 对齐）
    _safeTimeout(() => {
      correctAnimationClass.value = '';
    }, 600);

    return { correctAnimationClass: 'quiz-correct-animation' };
  }

  /**
   * 播放错误答案特效
   *
   * 触发错误动画类、屏幕微震，并重置连击。
   *
   * @param {Function} _safeTimeout - 安全延时函数，签名 (callback, delay) => void
   * @returns {{ wrongAnimationClass: string }} 当前设置的动画类名
   */
  function playWrongEffect(_safeTimeout) {
    const animData = playWrongAnimation();
    if (!animData) {
      return { wrongAnimationClass: '' };
    }

    // 1. 设置错误动画类
    wrongAnimationClass.value = 'quiz-wrong-animation';

    // 2. 屏幕微震
    screenShake.value = true;
    _safeTimeout(() => {
      screenShake.value = false;
    }, 500);

    // 3. 重置连击显示
    comboDisplay.value = null;
    showComboEffect.value = false;

    // 4. 重置动画管理器连击计数
    resetAnimation();

    // 5. 动画结束后清除类名（与 CSS 动画时长 500ms 对齐）
    _safeTimeout(() => {
      wrongAnimationClass.value = '';
    }, 500);

    return { wrongAnimationClass: 'quiz-wrong-animation' };
  }

  /**
   * 重置所有特效状态
   *
   * 在切换题目或重新开始时调用。
   */
  function resetEffects() {
    comboDisplay.value = null;
    showComboEffect.value = false;
    correctAnimationClass.value = '';
    wrongAnimationClass.value = '';
    screenShake.value = false;
    particles.value = [];
    showParticles.value = false;
    showLevelUp.value = false;
  }

  // ==================== 导出 ====================

  return {
    // 状态
    comboDisplay,
    showComboEffect,
    correctAnimationClass,
    wrongAnimationClass,
    screenShake,
    particles,
    showParticles,
    showLevelUp,

    // 方法
    playCorrectEffect,
    playWrongEffect,
    resetEffects
  };
}
