/**
 * 错题 FSRS 间隔重复调度器
 * 为错题记录提供基于 FSRS 算法的复习调度
 */

// FSRS 默认参数（简化版，不依赖 ts-fsrs 库减小包体积）
const DEFAULT_W = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];

/**
 * 初始化错题的 FSRS 字段
 * @param {Object} record - 错题记录对象（会被直接修改）
 */
export function initMistakeFSRS(record) {
  record.fsrs_stability = 0;
  record.fsrs_difficulty = 0.3;
  record.fsrs_elapsed_days = 0;
  record.fsrs_scheduled_days = 0;
  record.fsrs_reps = 0;
  record.fsrs_lapses = 0;
  record.fsrs_state = 0; // 0=New, 1=Learning, 2=Review, 3=Relearning
  record.fsrs_due = Date.now();
  record.fsrs_last_review = null;
}

/**
 * 根据评分调度下次复习时间
 * @param {Object} mistake - 错题记录
 * @param {string} rating - 评分: 'again' | 'hard' | 'good' | 'easy'
 * @returns {Object} 需要合并到错题记录的 FSRS 字段
 */
export function scheduleMistakeReview(mistake, rating) {
  const now = Date.now();
  const ratingMap = { again: 1, hard: 2, good: 3, easy: 4 };
  const r = ratingMap[rating] || 3;

  const stability = mistake.fsrs_stability || 0;
  const difficulty = mistake.fsrs_difficulty || 0.3;
  const reps = (mistake.fsrs_reps || 0) + 1;
  let lapses = mistake.fsrs_lapses || 0;

  let newStability, newDifficulty, scheduledDays;

  if (r === 1) {
    // Again — 重置
    lapses++;
    newStability = Math.max(0.1, stability * 0.2);
    newDifficulty = Math.min(1, difficulty + 0.1);
    scheduledDays = 0; // 立即复习
  } else if (stability < 0.01) {
    // 新卡片首次评分
    newStability = DEFAULT_W[r - 1];
    newDifficulty = difficulty;
    scheduledDays = Math.max(1, Math.round(newStability));
  } else {
    // 复习卡片
    const factor = r === 2 ? 0.8 : r === 3 ? 1.0 : 1.3;
    newStability = stability * (1 + Math.exp(DEFAULT_W[8]) * (11 - difficulty * 10) * Math.pow(stability, -DEFAULT_W[9]) * (Math.exp((1 - r / 4) * DEFAULT_W[10]) - 1)) * factor;
    newDifficulty = Math.max(0, Math.min(1, difficulty - DEFAULT_W[6] * (r - 3)));
    scheduledDays = Math.max(1, Math.round(newStability));
  }

  return {
    fsrs_stability: newStability,
    fsrs_difficulty: newDifficulty,
    fsrs_elapsed_days: mistake.fsrs_last_review ? Math.round((now - mistake.fsrs_last_review) / 86400000) : 0,
    fsrs_scheduled_days: scheduledDays,
    fsrs_reps: reps,
    fsrs_lapses: lapses,
    fsrs_state: r === 1 ? 3 : (stability < 0.01 ? 1 : 2),
    fsrs_due: now + scheduledDays * 86400000,
    fsrs_last_review: now
  };
}
