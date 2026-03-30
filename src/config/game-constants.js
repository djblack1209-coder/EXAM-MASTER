/**
 * 游戏化系统常量 — 单一数据源
 *
 * 所有 XP 奖励、等级阈值、成就定义、连续打卡配置、每日挑战模板
 * 均集中在此文件，其余模块统一从这里导入。
 *
 * 整合来源：
 * - gamification.js store（XP_REWARDS / ACHIEVEMENT_DEFS / STREAK_MILESTONES / CHALLENGE_TEMPLATES）
 * - useXPSystem.js composable（LEVEL_TABLE / 细粒度 XP 奖励）
 * - learning-analytics.js（ACHIEVEMENTS 子集，已合并到 ACHIEVEMENT_DEFS）
 * - checkin-streak.js（REWARD_CONFIG / CHECKIN_STATUS）
 *
 * @module config/game-constants
 */

// ==================== XP 奖励配置 ====================

/**
 * XP 奖励值
 * 合并了 gamification store（基础奖励）与 useXPSystem（细粒度加成）
 */
export const XP_REWARDS = {
  /** 答对一题的基础 XP */
  CORRECT_ANSWER: 10,
  /** 每日首次答题奖励 */
  FIRST_PRACTICE_OF_DAY: 20,
  /** 全对一个 session 的额外奖励 */
  PERFECT_SCORE: 50,
  /** 每连击加成 XP（叠加在基础之上） */
  COMBO_MULTIPLIER: 2,
  /** 连击加成上限 */
  COMBO_MAX: 20,
  /** 按难度等级（1-5）的额外 XP */
  DIFFICULTY_BONUS: {
    1: 0, // 简单
    2: 3, // 中等
    3: 8, // 困难
    4: 15, // 极难
    5: 25 // 地狱
  },
  /** 复习模式额外奖励 */
  REVIEW_BONUS: 5
};

// ==================== 等级系统 ====================

/**
 * 等级阈值表
 * 采用 useXPSystem 的 12 级查找表（含中文称号，适合考研场景）
 */
export const LEVEL_TABLE = [
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

/**
 * 根据总 XP 计算当前等级（查找表方式）
 * @param {number} totalXP - 总经验值
 * @returns {{ level: number, xpRequired: number, title: string }}
 */
export function getLevelByXP(totalXP) {
  let result = LEVEL_TABLE[0];
  for (let i = LEVEL_TABLE.length - 1; i >= 0; i--) {
    if (totalXP >= LEVEL_TABLE[i].xpRequired) {
      result = LEVEL_TABLE[i];
      break;
    }
  }
  return result;
}

/**
 * 获取下一等级信息
 * @param {number} currentLevelNum - 当前等级编号
 * @returns {{ level: number, xpRequired: number, title: string } | null}
 */
export function getNextLevel(currentLevelNum) {
  const idx = LEVEL_TABLE.findIndex((l) => l.level === currentLevelNum);
  return idx < LEVEL_TABLE.length - 1 ? LEVEL_TABLE[idx + 1] : null;
}

/**
 * 计算当前等级进度百分比（0-100）
 * @param {number} totalXP - 总经验值
 * @returns {number}
 */
export function getLevelProgress(totalXP) {
  const current = getLevelByXP(totalXP);
  const next = getNextLevel(current.level);
  if (!next) return 100;
  const earned = totalXP - current.xpRequired;
  const needed = next.xpRequired - current.xpRequired;
  return needed > 0 ? Math.round((earned / needed) * 100) : 100;
}

// ==================== 连续打卡/学习 ====================

/** 连续学习里程碑天数（用于成就触发检测） */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365];

/**
 * 连续学习 XP 乘数阶梯
 * 统一了 gamification（阶梯）与 checkin-streak（6 档）两套模型
 * key = 最低连续天数，value = XP 倍率
 */
export const STREAK_MULTIPLIER = {
  3: 1.5, // 连续 3 天 → 1.5 倍
  7: 2, // 连续 7 天 → 2 倍
  14: 2.5, // 连续 14 天 → 2.5 倍
  30: 3, // 连续 30 天 → 3 倍
  60: 4, // 连续 60 天 → 4 倍
  100: 5 // 连续 100 天 → 5 倍
};

/**
 * 根据连续天数获取 XP 倍率
 * @param {number} streakDays - 连续学习天数
 * @returns {number} XP 倍率（最低 1）
 */
export function getStreakMultiplier(streakDays) {
  let multiplier = 1;
  const thresholds = Object.keys(STREAK_MULTIPLIER)
    .map(Number)
    .sort((a, b) => a - b);
  for (const threshold of thresholds) {
    if (streakDays >= threshold) {
      multiplier = STREAK_MULTIPLIER[threshold];
    } else {
      break;
    }
  }
  return multiplier;
}

// ==================== 打卡配置 ====================

/** 打卡状态枚举 */
export const CHECKIN_STATUS = {
  NOT_CHECKED: 'not_checked', // 未打卡
  CHECKED: 'checked', // 已打卡
  MISSED: 'missed', // 已断签
  RECOVERED: 'recovered' // 已补签
};

/** 打卡奖励配置 */
export const CHECKIN_REWARD = {
  /** 基础奖励（每次打卡） */
  BASE: { exp: 5, coins: 2 },
  /** 里程碑奖励 */
  MILESTONES: {
    7: { exp: 50, coins: 30, badge: 'streak_7', recoveryCards: 1 },
    30: { exp: 200, coins: 100, badge: 'streak_30', recoveryCards: 2 },
    100: { exp: 1000, coins: 500, badge: 'streak_100', recoveryCards: 3 },
    365: { exp: 5000, coins: 2000, badge: 'streak_365', recoveryCards: 5 }
  }
};

// ==================== 成就系统 ====================

/**
 * 统一成就定义
 * 合并了 gamification.js（16 个）和 learning-analytics.js（7 个）
 * 去除重复后共 18 个成就。图标统一使用方括号文字标记（前端用 CSS/图标组件渲染）。
 *
 * category: volume / streak / accuracy / speed / social
 */
export const ACHIEVEMENT_DEFS = {
  // ---- 答题量 ----
  first_blood: {
    name: '初试锋芒',
    description: '完成第一道题目',
    icon: '[标]',
    category: 'volume'
  },
  // analytics 子系统使用 first_question 作为 id（兼容已有 localStorage 数据）
  first_question: {
    name: '初出茅庐',
    description: '完成第一道题目',
    icon: '[标]',
    category: 'volume'
  },
  ten_questions: {
    name: '小试牛刀',
    description: '累计完成 10 道题目',
    icon: '[笔]',
    category: 'volume'
  },
  centurion: {
    name: '百题斩',
    description: '累计完成 100 道题目',
    icon: '[力]',
    category: 'volume'
  },
  // analytics 子系统使用 hundred_questions 作为 id（兼容已有 localStorage 数据）
  hundred_questions: {
    name: '勤学苦练',
    description: '累计完成 100 道题目',
    icon: '[力]',
    category: 'volume'
  },
  thousand: {
    name: '千题王',
    description: '累计完成 1000 道题目',
    icon: '[冠]',
    category: 'volume'
  },
  night_owl: {
    name: '夜猫子',
    description: '23 点后学习',
    icon: '[夜]',
    category: 'volume'
  },
  early_bird: {
    name: '早起鸟',
    description: '7 点前学习',
    icon: '[晨]',
    category: 'volume'
  },
  marathon: {
    name: '马拉松',
    description: '单次学习超过 2 小时',
    icon: '[跑]',
    category: 'volume'
  },

  // ---- 连续学习 ----
  streak_3: {
    name: '三日不辍',
    description: '连续学习 3 天',
    icon: '[火]',
    category: 'streak'
  },
  streak_7: {
    name: '周周坚持',
    description: '连续学习 7 天',
    icon: '[火]',
    category: 'streak'
  },
  streak_14: {
    name: '两周达人',
    description: '连续学习 14 天',
    icon: '[火]',
    category: 'streak'
  },
  streak_30: {
    name: '月度之星',
    description: '连续学习 30 天',
    icon: '[星]',
    category: 'streak'
  },
  streak_100: {
    name: '百日征途',
    description: '连续学习 100 天',
    icon: '[杯]',
    category: 'streak'
  },
  comeback_kid: {
    name: '绝地反击',
    description: '使用连续学习保护卡',
    icon: '[盾]',
    category: 'streak'
  },

  // ---- 准确率 ----
  perfect_10: {
    name: '十全十美',
    description: '连续答对 10 题',
    icon: '[百]',
    category: 'accuracy'
  },
  accuracy_80: {
    name: '准确达人',
    description: '单日正确率达到 80%',
    icon: '[标]',
    category: 'accuracy'
  },
  accuracy_90: {
    name: '精准射手',
    description: '50 题内保持 90%+ 正确率',
    icon: '[标]',
    category: 'accuracy'
  },

  // ---- 速度 ----
  speed_demon: {
    name: '闪电侠',
    description: '5 秒内正确作答',
    icon: '[电]',
    category: 'speed'
  },

  // ---- 社交 ----
  social_butterfly: {
    name: '社交达人',
    description: '添加 5 位好友',
    icon: '[蝶]',
    category: 'social'
  }
};

// ==================== 每日挑战 ====================

/** 每日挑战模板 */
export const CHALLENGE_TEMPLATES = [
  { type: 'answer_count', description: '完成 {target} 道题目', target: 20, reward: 30 },
  { type: 'correct_streak', description: '连续答对 {target} 题', target: 5, reward: 40 },
  { type: 'study_minutes', description: '学习 {target} 分钟', target: 30, reward: 35 },
  { type: 'answer_count', description: '完成 {target} 道题目', target: 10, reward: 20 },
  { type: 'correct_streak', description: '连续答对 {target} 题', target: 3, reward: 25 },
  { type: 'study_minutes', description: '学习 {target} 分钟', target: 15, reward: 20 }
];

// ==================== 存储键名 ====================

/** 游戏化相关的 localStorage key（避免各模块各自定义） */
export const GAME_STORAGE_KEYS = {
  GAMIFICATION_STATE: 'gamification_state',
  XP_SYSTEM: 'xp_system',
  DAILY_STATS: 'learning_daily_stats',
  STREAK_DATA: 'learning_streak_data',
  ACHIEVEMENT_DATA: 'learning_achievements'
};
