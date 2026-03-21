/**
 * useXPSystem — 经验值/等级/称号系统
 * 借鉴 cjmellor/level-up 的数据模型 + HabitTrove 的 coin-reward 循环
 *
 * 核心机制：
 * - 答对题目获得 XP（基础10 + combo加成 + 难度加成）
 * - XP 累积升级，等级决定称号
 * - 每日首次答题 bonus，连续天数 streak multiplier
 * - 本地存储，无需服务端
 */
import { ref, computed } from 'vue';
import { storageService } from '@/services/storageService.js';

const STORAGE_KEY = 'xp_system';

// 等级阈值表（借鉴 level-up 的指数增长模型）
const LEVEL_TABLE = [
  { level: 1, xpRequired: 0, title: '初学者' },
  { level: 2, xpRequired: 50, title: '入门学徒' },
  { level: 3, xpRequired: 150, title: '勤奋学子' },
  { level: 4, xpRequired: 350, title: '知识探索者' },
  { level: 5, xpRequired: 700, title: '题海勇士' },
  { level: 6, xpRequired: 1200, title: '解题达人' },
  { level: 7, xpRequired: 2000, title: '学霸预备' },
  { level: 8, xpRequired: 3200, title: '知识精英' },
  { level: 9, xpRequired: 5000, title: '考研战神' },
  { level: 10, xpRequired: 8000, title: '满分传说' },
  { level: 11, xpRequired: 12000, title: '学术巅峰' },
  { level: 12, xpRequired: 18000, title: '知识之王' }
];

// XP 奖励配置
const XP_REWARDS = {
  correctBase: 10, // 答对基础XP
  comboMultiplier: 2, // 每连击+2 XP
  comboMax: 20, // combo加成上限
  difficultyBonus: {
    // 难度加成
    1: 0, // 简单
    2: 3, // 中等
    3: 8, // 困难
    4: 15, // 极难
    5: 25 // 地狱
  },
  dailyFirstBonus: 20, // 每日首次答题bonus
  streakMultiplier: 0.1, // 连续天数加成（每天+10%，上限50%）
  streakMultiplierMax: 0.5,
  reviewBonus: 5, // 复习模式额外奖励
  perfectSessionBonus: 50 // 全对session奖励
};

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

  // 当前等级信息
  const currentLevel = computed(() => {
    let lvl = LEVEL_TABLE[0];
    for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) {
      if (state.value.totalXP >= LEVEL_TABLE[i].xpRequired) {
        lvl = LEVEL_TABLE[i];
        break;
      }
    }
    return lvl;
  });

  // 下一等级信息
  const nextLevel = computed(() => {
    const idx = LEVEL_TABLE.findIndex((l) => l.level === currentLevel.value.level);
    return idx < LEVEL_TABLE.length - 1 ? LEVEL_TABLE[idx + 1] : null;
  });

  // 当前等级进度百分比
  const levelProgress = computed(() => {
    if (!nextLevel.value) return 100;
    const currentXP = state.value.totalXP - currentLevel.value.xpRequired;
    const needed = nextLevel.value.xpRequired - currentLevel.value.xpRequired;
    return Math.round((currentXP / needed) * 100);
  });

  // streak加成倍率
  const streakBonus = computed(() => {
    return Math.min(state.value.streakDays * XP_REWARDS.streakMultiplier, XP_REWARDS.streakMultiplierMax);
  });

  /**
   * 答对题目获得XP
   * @param {Object} opts - { combo, difficulty, isReview }
   * @returns {Object} { xpEarned, levelUp, newLevel }
   */
  function earnXP(opts = {}) {
    const { combo = 0, difficulty = 2, isReview = false } = opts;
    const prevLevel = currentLevel.value.level;

    let xp = XP_REWARDS.correctBase;

    // combo加成
    xp += Math.min(combo * XP_REWARDS.comboMultiplier, XP_REWARDS.comboMax);

    // 难度加成
    xp += XP_REWARDS.difficultyBonus[difficulty] || 0;

    // 复习模式bonus
    if (isReview) xp += XP_REWARDS.reviewBonus;

    // 每日首次bonus
    if (!state.value.dailyBonusClaimed) {
      xp += XP_REWARDS.dailyFirstBonus;
      state.value.dailyBonusClaimed = true;
    }

    // streak倍率
    xp = Math.round(xp * (1 + streakBonus.value));

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
      state.value.totalXP += XP_REWARDS.perfectSessionBonus;
      state.value.todayXP += XP_REWARDS.perfectSessionBonus;
    }
    save();
    return isPerfect ? XP_REWARDS.perfectSessionBonus : 0;
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
