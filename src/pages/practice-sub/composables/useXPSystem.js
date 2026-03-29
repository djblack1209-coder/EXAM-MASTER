/**
 * useXPSystem — 经验值/等级/称号系统
 * 借鉴 cjmellor/level-up 的数据模型 + HabitTrove 的 coin-reward 循环
 *
 * 核心机制：
 * - 答对题目获得 XP（基础10 + combo加成 + 难度加成）
 * - XP 累积升级，等级决定称号
 * - 每日首次答题 bonus，连续天数 streak multiplier
 * - 本地存储，无需服务端
 *
 * 常量全部从 config/game-constants.js 导入（单一数据源）
 */
import { ref, computed } from 'vue';
import { storageService } from '@/services/storageService.js';
import {
  XP_REWARDS,
  LEVEL_TABLE,
  getLevelByXP,
  getNextLevel,
  getLevelProgress,
  getStreakMultiplier,
  GAME_STORAGE_KEYS
} from '@/config/game-constants.js';

const STORAGE_KEY = GAME_STORAGE_KEYS.XP_SYSTEM;

function getDefaultState() {
  return {
    totalXP: 0,
    level: 1,
    todayXP: 0,
    todayDate: '',
    dailyBonusClaimed: false,
    streakDays: 0,
    lastActiveDate: '',
    sessionsCompleted: 0,
    perfectSessions: 0
  };
}

export function useXPSystem() {
  const state = ref(getDefaultState());

  // 从本地存储恢复
  function restore() {
    const saved = storageService.get(STORAGE_KEY);
    if (saved) {
      state.value = { ...getDefaultState(), ...saved };
    }
    // 检查日期变更，重置每日数据
    const today = new Date().toISOString().split('T')[0];
    if (state.value.todayDate !== today) {
      // 检查streak
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      if (state.value.lastActiveDate === yesterday) {
        state.value.streakDays++;
      } else if (state.value.lastActiveDate !== today) {
        state.value.streakDays = 0;
      }
      state.value.todayXP = 0;
      state.value.todayDate = today;
      state.value.dailyBonusClaimed = false;
      save();
    }
  }

  function save() {
    storageService.save(STORAGE_KEY, state.value);
  }

  // 当前等级信息（委托给 game-constants helper）
  const currentLevel = computed(() => getLevelByXP(state.value.totalXP));

  // 下一等级信息
  const nextLevel = computed(() => getNextLevel(currentLevel.value.level));

  // 当前等级进度百分比
  const levelProgress = computed(() => getLevelProgress(state.value.totalXP));

  // streak加成倍率（使用统一的阶梯模型）
  const streakBonus = computed(() => getStreakMultiplier(state.value.streakDays) - 1);

  /**
   * 答对题目获得XP
   * @param {Object} opts - { combo, difficulty, isReview }
   * @returns {Object} { xpEarned, levelUp, newLevel }
   */
  function earnXP(opts = {}) {
    const { combo = 0, difficulty = 2, isReview = false } = opts;
    const prevLevel = currentLevel.value.level;

    let xp = XP_REWARDS.CORRECT_ANSWER;

    // combo加成
    xp += Math.min(combo * XP_REWARDS.COMBO_MULTIPLIER, XP_REWARDS.COMBO_MAX);

    // 难度加成
    xp += XP_REWARDS.DIFFICULTY_BONUS[difficulty] || 0;

    // 复习模式bonus
    if (isReview) xp += XP_REWARDS.REVIEW_BONUS;

    // 每日首次bonus
    if (!state.value.dailyBonusClaimed) {
      xp += XP_REWARDS.FIRST_PRACTICE_OF_DAY;
      state.value.dailyBonusClaimed = true;
    }

    // streak倍率（getStreakMultiplier 返回绝对倍率，直接用）
    xp = Math.round(xp * getStreakMultiplier(state.value.streakDays));

    state.value.totalXP += xp;
    state.value.todayXP += xp;
    state.value.lastActiveDate = new Date().toISOString().split('T')[0];

    const levelUp = currentLevel.value.level > prevLevel;
    save();

    return {
      xpEarned: xp,
      levelUp,
      newLevel: levelUp ? currentLevel.value : null,
      totalXP: state.value.totalXP
    };
  }

  /**
   * 完成一个session
   * @param {boolean} isPerfect - 是否全对
   */
  function completeSession(isPerfect = false) {
    state.value.sessionsCompleted++;
    if (isPerfect) {
      state.value.perfectSessions++;
      state.value.totalXP += XP_REWARDS.PERFECT_SCORE;
      state.value.todayXP += XP_REWARDS.PERFECT_SCORE;
    }
    save();
    return isPerfect ? XP_REWARDS.PERFECT_SCORE : 0;
  }

  // 初始化
  restore();

  return {
    state,
    currentLevel,
    nextLevel,
    levelProgress,
    streakBonus,
    earnXP,
    completeSession,
    restore,
    LEVEL_TABLE,
    XP_REWARDS
  };
}
