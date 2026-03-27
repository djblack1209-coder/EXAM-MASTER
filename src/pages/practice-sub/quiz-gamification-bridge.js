/**
 * 答题游戏化桥接模块
 *
 * 将 gamification store + useGamificationEffects 接入答题流程。
 * do-quiz.vue 在 selectOption() 中调用本模块，无需关心游戏化内部逻辑。
 *
 * 设计原则：
 * - 所有调用均为 fire-and-forget，不阻塞答题主流程
 * - 异常静默吞掉，游戏化是锦上添花而非核心链路
 *
 * @module practice-sub/quiz-gamification-bridge
 */

import { useGamificationStore } from '@/stores/modules/gamification';
import { useGamificationEffects } from './composables/useGamificationEffects.js';
import { logger } from '@/utils/logger.js';

let _store = null;
let _effects = null;
let _sessionStarted = false;
let _totalAnswered = 0;
let _correctStreak = 0;
let _totalCorrect = 0;
let _sessionStartTime = 0;

function getStore() {
  if (!_store) {
    try {
      _store = useGamificationStore();
    } catch {
      /* pinia 未就绪 */
    }
  }
  return _store;
}

function getEffects() {
  if (!_effects) {
    _effects = useGamificationEffects();
  }
  return _effects;
}

/**
 * 答题会话开始时调用（进入 do-quiz 页面时）
 * 触发连续学习检查 + 每日挑战生成 + 首次练习 XP
 */
export function onQuizSessionStart() {
  try {
    const store = getStore();
    if (!store) return;

    _sessionStarted = true;
    _totalAnswered = 0;
    _correctStreak = 0;
    _totalCorrect = 0;
    _sessionStartTime = Date.now();

    // 检查连续学习天数（如果今天还没记录）
    store.checkStreak();

    // 生成今日挑战（幂等，同一天不会重复生成）
    store.generateDailyChallenge();

    // 首次练习奖励
    store.addXp(store.XP_REWARDS.FIRST_PRACTICE_OF_DAY, 'first_practice');

    logger.log('[GamificationBridge] Session started');
  } catch (e) {
    logger.warn('[GamificationBridge] Session start error:', e);
  }
}

/**
 * 每次答题后调用
 * @param {Object} params
 * @param {boolean} params.isCorrect - 是否答对
 * @param {number} params.timeSpent - 答题用时（毫秒）
 * @param {number} [params.touchX] - 点击位置 X（用于 XP 浮动文字）
 * @param {number} [params.touchY] - 点击位置 Y
 */
export function onAnswerResult({ isCorrect, timeSpent, touchX = 0, touchY = 0 }) {
  try {
    const store = getStore();
    const effects = getEffects();
    if (!store) return;

    _totalAnswered++;

    if (isCorrect) {
      _correctStreak++;
      _totalCorrect++;

      // 加 XP + 显示浮动文字
      const xpGained = store.addXp(store.XP_REWARDS.CORRECT_ANSWER, 'correct_answer');
      effects.showXpGain(xpGained, touchX, touchY);
      effects.celebrateCorrectAnswer();
    } else {
      _correctStreak = 0;
      effects.celebrateWrongAnswer();
    }

    // 计算当前正确率
    const accuracy = _totalAnswered > 0 ? Math.round((_totalCorrect / _totalAnswered) * 100) : 0;

    // 检查成就
    store.checkAchievements({
      type: 'answer',
      isCorrect,
      totalAnswered: _totalAnswered,
      correctStreak: _correctStreak,
      timeSpent,
      accuracy
    });

    // 更新每日挑战进度
    store.updateChallengeProgress({
      type: 'answer',
      isCorrect,
      correctStreak: _correctStreak
    });
  } catch (e) {
    logger.warn('[GamificationBridge] Answer result error:', e);
  }
}

/**
 * 答题会话结束时调用（退出 do-quiz 或完成全部题目时）
 */
export function onQuizSessionEnd() {
  try {
    const store = getStore();
    const effects = getEffects();
    if (!store || !_sessionStarted) return;

    const sessionMinutes = Math.round((Date.now() - _sessionStartTime) / 60000);

    // 更新学习时长类挑战
    store.updateChallengeProgress({
      type: 'session',
      minutes: sessionMinutes
    });

    // 检查马拉松成就
    store.checkAchievements({
      type: 'session',
      minutes: sessionMinutes
    });

    // 全对奖励
    if (_totalAnswered > 0 && _totalCorrect === _totalAnswered) {
      const bonus = store.addXp(store.XP_REWARDS.PERFECT_SCORE, 'perfect_score');
      effects.showXpGain(bonus, 0, 0);
    }

    _sessionStarted = false;
    logger.log(
      `[GamificationBridge] Session ended: ${_totalAnswered} answered, ${_totalCorrect} correct, ${sessionMinutes}min`
    );
  } catch (e) {
    logger.warn('[GamificationBridge] Session end error:', e);
  }
}

/**
 * 监听游戏化事件（升级、成就解锁等），绑定视觉反馈
 * 在 do-quiz.vue 的 onLoad 中调用一次，onUnload 中调用返回的 cleanup
 * @returns {Function} cleanup 函数
 */
export function bindGamificationEvents() {
  const effects = getEffects();
  const cleanups = [];

  try {
    if (typeof uni !== 'undefined' && uni.$on) {
      const onLevelUp = (detail) => {
        effects.celebrateLevelUp(detail.level);
      };
      const onAchievement = (detail) => {
        effects.celebrateAchievement(detail);
      };
      const onChallengeComplete = () => {
        effects.celebrateStreak(3); // 用 confetti 庆祝挑战完成
      };

      uni.$on('gamification:level-up', onLevelUp);
      uni.$on('gamification:achievement', onAchievement);
      uni.$on('gamification:challenge-complete', onChallengeComplete);

      cleanups.push(() => {
        uni.$off('gamification:level-up', onLevelUp);
        uni.$off('gamification:achievement', onAchievement);
        uni.$off('gamification:challenge-complete', onChallengeComplete);
      });
    }
  } catch (e) {
    logger.warn('[GamificationBridge] Event binding error:', e);
  }

  return () => cleanups.forEach((fn) => fn());
}

/**
 * 获取当前会话的游戏化状态快照（供 UI 展示）
 */
export function getSessionGamificationState() {
  const store = getStore();
  if (!store) return null;

  return {
    level: store.level,
    xp: store.xp,
    todayXp: store.todayXp,
    levelProgress: store.levelProgress,
    xpToNextLevel: store.xpToNextLevel,
    currentStreak: store.currentStreak,
    dailyChallenge: store.dailyChallenge,
    xpMultiplier: store.getXpMultiplier(),
    sessionStats: {
      totalAnswered: _totalAnswered,
      correctStreak: _correctStreak,
      totalCorrect: _totalCorrect
    }
  };
}
