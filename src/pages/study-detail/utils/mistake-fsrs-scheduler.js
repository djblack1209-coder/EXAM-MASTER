/**
 * 错题FSRS间隔重复调度器
 * 使用ts-fsrs实现科学的间隔重复复习调度，替代简单的+20/-10线性掌握度系统
 * 支持加载用户个性化FSRS参数（由后端 fsrs-optimizer 计算）
 *
 * [分包隔离副本] 与 pages/practice-sub/utils/mistake-fsrs-scheduler.js 内容完全相同。
 * 因微信小程序分包不能跨包引用，需在各分包维护独立副本。
 * 修改时请同步更新对应副本。
 */

import { fsrs, generatorParameters, createEmptyCard, Rating, State } from 'ts-fsrs';

/**
 * 默认FSRS参数（与后端保持一致）
 */
const DEFAULT_PARAMS = {
  maximum_interval: 180,
  request_retention: 0.9,
  enable_fuzz: true,
  enable_short_term: true
};

/** 当前调度器实例 */
let scheduler = fsrs(generatorParameters(DEFAULT_PARAMS));

/** 当前加载的用户参数签名（用于判断是否需要重建） */
let currentParamsKey = '';

/**
 * 加载用户个性化FSRS参数，重建调度器实例
 * @param {Object|null} userParams - 用户参数 { w: number[], request_retention: number }
 * @returns {boolean} 是否成功加载了个性化参数
 */
export function loadUserFSRSParams(userParams) {
  if (!userParams?.w || !Array.isArray(userParams.w) || userParams.w.length === 0) {
    // 无个性化参数，使用默认
    if (currentParamsKey !== '') {
      scheduler = fsrs(generatorParameters(DEFAULT_PARAMS));
      currentParamsKey = '';
    }
    return false;
  }

  const newKey = JSON.stringify(userParams.w) + ':' + (userParams.request_retention ?? 0.9);
  if (newKey === currentParamsKey) return true; // 参数未变，无需重建

  scheduler = fsrs(
    generatorParameters({
      ...DEFAULT_PARAMS,
      w: userParams.w,
      request_retention: userParams.request_retention ?? DEFAULT_PARAMS.request_retention
    })
  );
  currentParamsKey = newKey;
  return true;
}

/**
 * 获取当前是否使用个性化参数
 */
export function hasCustomFSRSParams() {
  return currentParamsKey !== '';
}

/**
 * 评分字符串到ts-fsrs Rating的映射
 */
const RATING_MAP = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy
};

/**
 * 从错题对象还原ts-fsrs Card结构
 */
function _toFSRSCard(mistake) {
  if (!mistake.fsrs_due) return null;
  return {
    due: new Date(mistake.fsrs_due),
    stability: mistake.fsrs_stability ?? 0,
    difficulty: mistake.fsrs_difficulty ?? 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: mistake.fsrs_reps ?? 0,
    lapses: mistake.fsrs_lapses ?? 0,
    learning_steps: 0,
    state: mistake.fsrs_state ?? State.New,
    last_review: mistake.fsrs_last_review ? new Date(mistake.fsrs_last_review) : undefined
  };
}

/**
 * 将FSRS Card字段写回错题对象，返回更新后的字段
 */
function _applyFSRSFields(card) {
  return {
    fsrs_due: new Date(card.due).getTime(),
    fsrs_stability: card.stability,
    fsrs_difficulty: card.difficulty,
    fsrs_state: card.state,
    fsrs_reps: card.reps,
    fsrs_lapses: card.lapses,
    fsrs_last_review: card.last_review ? new Date(card.last_review).getTime() : Date.now()
  };
}

/**
 * 初始化错题的FSRS字段
 * @param {Object} mistake - 错题对象（会被就地修改）
 * @returns {Object} 同一个错题对象，已添加FSRS字段
 */
export function initMistakeFSRS(mistake) {
  const card = createEmptyCard(new Date());
  Object.assign(mistake, _applyFSRSFields(card));
  return mistake;
}

/**
 * 调度一次错题复习
 * @param {Object} mistake - 错题对象
 * @param {'again'|'hard'|'good'|'easy'} rating - 评分
 * @returns {Object} 更新后的FSRS字段（可直接Object.assign到错题上）
 */
export function scheduleMistakeReview(mistake, rating) {
  const ratingValue = RATING_MAP[rating];
  if (ratingValue === undefined) {
    throw new Error(`Invalid rating: ${rating}. Use 'again', 'hard', 'good', or 'easy'.`);
  }

  let card = _toFSRSCard(mistake);
  if (!card) {
    // 没有FSRS字段，先初始化
    card = createEmptyCard(new Date());
  }

  const now = new Date();
  const result = scheduler.repeat(card, now);
  const updated = result[ratingValue].card;

  return _applyFSRSFields(updated);
}

/**
 * 筛选到期需要复习的错题（fsrs_due <= 当前时间）
 * @param {Array} mistakes - 错题数组
 * @returns {Array} 到期的错题子集
 */
export function getMistakesDueForReview(mistakes) {
  const now = Date.now();
  return mistakes.filter((m) => {
    if (m.is_mastered) return false;
    if (!m.fsrs_due) return true; // 没有FSRS数据的视为需要复习
    return m.fsrs_due <= now;
  });
}

/**
 * 按逾期程度排序（最逾期的排最前）
 * @param {Array} mistakes - 错题数组
 * @returns {Array} 排序后的新数组
 */
export function getMistakeReviewPriority(mistakes) {
  const now = Date.now();
  return [...mistakes].sort((a, b) => {
    const overdueA = now - (a.fsrs_due || 0);
    const overdueB = now - (b.fsrs_due || 0);
    return overdueB - overdueA;
  });
}
