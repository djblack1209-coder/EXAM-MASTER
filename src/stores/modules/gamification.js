/**
 * 游戏化系统状态管理
 *
 * 借鉴 Duolingo 模式，通过 XP、连续学习、成就徽章、每日挑战
 * 驱动用户留存与学习动力。
 *
 * 职责边界：
 * - gamification.js：XP / 等级 / 连续天数 / 成就 / 每日挑战
 * - study.js：聚合做题指标（总题数、正确率）
 *
 * @module stores/gamification
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { storageService } from '../../services/storageService.js';
import { logger } from '@/utils/logger.js';
import {
  XP_REWARDS,
  getLevelByXP,
  getNextLevel,
  getLevelProgress,
  STREAK_MILESTONES,
  getStreakMultiplier,
  ACHIEVEMENT_DEFS,
  CHALLENGE_TEMPLATES,
  GAME_STORAGE_KEYS
} from '@/config/game-constants.js';

// ==================== 常量 ====================

const STORAGE_KEY = GAME_STORAGE_KEYS.GAMIFICATION_STATE;

// ==================== 工具函数 ====================

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emitEvent(name, detail) {
  try {
    if (typeof uni !== 'undefined' && uni.$emit) {
      uni.$emit(name, detail);
    }
  } catch {
    /* 静默 */
  }
}

// ==================== Store ====================

export const useGamificationStore = defineStore('gamification', () => {
  // ---- XP ----
  const xp = ref(0);
  const todayXp = ref(0);
  const _todayDate = ref(todayISO());

  const level = computed(() => getLevelByXP(xp.value).level);

  const levelTitle = computed(() => getLevelByXP(xp.value).title);

  const xpToNextLevel = computed(() => {
    const next = getNextLevel(getLevelByXP(xp.value).level);
    return next ? next.xpRequired - xp.value : 0;
  });

  const levelProgress = computed(() => getLevelProgress(xp.value) / 100);

  function getXpMultiplier() {
    return getStreakMultiplier(currentStreak.value);
  }

  function addXp(amount, reason = '') {
    const prevLevel = level.value;
    const multiplied = Math.round(amount * getXpMultiplier());
    xp.value += multiplied;

    // 重置当日 XP（跨天检测）
    if (_todayDate.value !== todayISO()) {
      todayXp.value = 0;
      _todayDate.value = todayISO();
    }
    todayXp.value += multiplied;

    logger.log(`[Gamification] +${multiplied} XP (${reason}), total: ${xp.value}`);

    if (level.value > prevLevel) {
      logger.log(`[Gamification] Level up! ${prevLevel} -> ${level.value}`);
      emitEvent('gamification:level-up', { level: level.value, prevLevel });
    }

    _persist();
    return multiplied;
  }

  // ---- 连续学习 ----
  const currentStreak = ref(0);
  const longestStreak = ref(0);
  const lastStudyDate = ref('');
  const streakFreezeCount = ref(0);

  function checkStreak() {
    const today = todayISO();
    if (lastStudyDate.value === today) return; // 今天已记录

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString().slice(0, 10);

    if (lastStudyDate.value === yesterdayISO) {
      // 昨天学了，连续 +1
      currentStreak.value++;
    } else if (lastStudyDate.value && lastStudyDate.value !== today) {
      // 断了——尝试使用保护卡
      if (streakFreezeCount.value > 0) {
        streakFreezeCount.value--;
        currentStreak.value++; // 保护卡视为续上
        logger.log('[Gamification] Streak freeze used');
        checkAchievements({ type: 'streak_freeze_used' });
      } else {
        currentStreak.value = 1; // 重新开始
      }
    } else {
      // 首次学习
      currentStreak.value = 1;
    }

    lastStudyDate.value = today;
    if (currentStreak.value > longestStreak.value) {
      longestStreak.value = currentStreak.value;
    }

    // 检查连续学习里程碑
    STREAK_MILESTONES.forEach((m) => {
      if (currentStreak.value >= m) {
        checkAchievements({ type: 'streak', days: currentStreak.value });
      }
    });

    _persist();
  }

  // ---- 成就 ----
  const achievements = ref([]);

  function _hasAchievement(id) {
    return achievements.value.some((a) => a.id === id);
  }

  function _unlock(id) {
    if (_hasAchievement(id) || !ACHIEVEMENT_DEFS[id]) return false;
    const def = ACHIEVEMENT_DEFS[id];
    const achievement = { id, ...def, unlockedAt: new Date().toISOString() };
    achievements.value.push(achievement);
    logger.log(`[Gamification] Achievement unlocked: ${def.name}`);
    emitEvent('gamification:achievement', achievement);

    // 连续学习里程碑奖励保护卡
    if (id.startsWith('streak_')) {
      streakFreezeCount.value++;
    }

    _persist();
    return true;
  }

  function checkAchievements(event) {
    if (!event) return;
    const t = event.type;

    if (t === 'answer') {
      _unlock('first_blood');
      if (event.totalAnswered >= 100) _unlock('centurion');
      if (event.totalAnswered >= 1000) _unlock('thousand');
      if (event.correctStreak >= 10) _unlock('perfect_10');
      if (event.isCorrect && event.timeSpent < 5000) _unlock('speed_demon');
      if (event.totalAnswered >= 50 && event.accuracy >= 90) _unlock('accuracy_90');

      const hour = new Date().getHours();
      if (hour >= 23) _unlock('night_owl');
      if (hour < 7) _unlock('early_bird');
    }

    if (t === 'streak') {
      if (event.days >= 3) _unlock('streak_3');
      if (event.days >= 7) _unlock('streak_7');
      if (event.days >= 14) _unlock('streak_14');
      if (event.days >= 30) _unlock('streak_30');
      if (event.days >= 100) _unlock('streak_100');
    }

    if (t === 'streak_freeze_used') _unlock('comeback_kid');
    if (t === 'social' && event.friendCount >= 5) _unlock('social_butterfly');
    if (t === 'session' && event.minutes >= 120) _unlock('marathon');
  }

  // ---- 每日挑战 ----
  const dailyChallenge = ref(null);

  function generateDailyChallenge() {
    const today = todayISO();
    if (dailyChallenge.value && dailyChallenge.value._date === today) return;

    // 基于日期的伪随机选择（同一天始终同一个挑战）
    const seed = today.replace(/-/g, '');
    const idx = parseInt(seed, 10) % CHALLENGE_TEMPLATES.length;
    const tpl = CHALLENGE_TEMPLATES[idx];

    dailyChallenge.value = {
      type: tpl.type,
      description: tpl.description.replace('{target}', String(tpl.target)),
      target: tpl.target,
      progress: 0,
      reward: tpl.reward,
      completed: false,
      _date: today
    };

    _persist();
  }

  function updateChallengeProgress(event) {
    if (!dailyChallenge.value || dailyChallenge.value.completed) return;
    if (dailyChallenge.value._date !== todayISO()) {
      generateDailyChallenge();
      return;
    }

    const ch = dailyChallenge.value;

    if (ch.type === 'answer_count' && event.type === 'answer') {
      ch.progress++;
    } else if (ch.type === 'correct_streak' && event.type === 'answer' && event.isCorrect) {
      ch.progress = event.correctStreak || ch.progress + 1;
    } else if (ch.type === 'study_minutes' && event.type === 'session') {
      ch.progress = Math.floor(event.minutes || 0);
    }

    if (ch.progress >= ch.target && !ch.completed) {
      ch.completed = true;
      addXp(ch.reward, 'daily_challenge');
      logger.log('[Gamification] Daily challenge completed!');
      emitEvent('gamification:challenge-complete', ch);
    }

    _persist();
  }

  // ---- 持久化 ----
  function _persist() {
    storageService.saveDebounced(
      STORAGE_KEY,
      {
        xp: xp.value,
        todayXp: todayXp.value,
        _todayDate: _todayDate.value,
        currentStreak: currentStreak.value,
        longestStreak: longestStreak.value,
        lastStudyDate: lastStudyDate.value,
        streakFreezeCount: streakFreezeCount.value,
        achievements: achievements.value,
        dailyChallenge: dailyChallenge.value
      },
      true
    );
  }

  function restoreGamification() {
    const data = storageService.get(STORAGE_KEY, null);
    if (!data) return;

    xp.value = data.xp || 0;
    todayXp.value = data.todayXp || 0;
    _todayDate.value = data._todayDate || todayISO();
    currentStreak.value = data.currentStreak || 0;
    longestStreak.value = data.longestStreak || 0;
    lastStudyDate.value = data.lastStudyDate || '';
    streakFreezeCount.value = data.streakFreezeCount || 0;
    achievements.value = data.achievements || [];
    dailyChallenge.value = data.dailyChallenge || null;

    // 跨天重置当日 XP
    if (_todayDate.value !== todayISO()) {
      todayXp.value = 0;
      _todayDate.value = todayISO();
    }

    logger.log(`[Gamification] Restored: Lv${level.value}, ${xp.value} XP, streak ${currentStreak.value}`);
  }

  function resetGamification() {
    xp.value = 0;
    todayXp.value = 0;
    _todayDate.value = todayISO();
    currentStreak.value = 0;
    longestStreak.value = 0;
    lastStudyDate.value = '';
    streakFreezeCount.value = 0;
    achievements.value = [];
    dailyChallenge.value = null;
    storageService.remove(STORAGE_KEY, true);
  }

  // 监听登出事件
  try {
    if (typeof uni !== 'undefined' && uni.$on && !uni.__gamificationStoreLogoutBound__) {
      uni.$on('user:logout', resetGamification);
      uni.__gamificationStoreLogoutBound__ = true;
    }
  } catch {
    /* 静默 */
  }

  return {
    // XP
    xp,
    todayXp,
    level,
    levelTitle,
    xpToNextLevel,
    levelProgress,
    addXp,
    getXpMultiplier,
    // 连续学习
    currentStreak,
    checkStreak,
    // 成就
    achievements,
    checkAchievements,
    // 每日挑战
    dailyChallenge,
    generateDailyChallenge,
    updateChallengeProgress,
    // 持久化
    restoreGamification,
    // 常量（供外部使用）
    XP_REWARDS
  };
});
