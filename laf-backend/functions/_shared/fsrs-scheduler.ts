/**
 * FSRS 间隔重复调度器
 * 替代手写 SM-2 算法，使用 ts-fsrs (FSRS v6) 实现更精准的复习调度
 */
import type { Card, FSRSBundleExports, FSRSParameters, Grade, RecordLogItem } from './ts-fsrs-bundle-types';

const { createEmptyCard, generatorParameters, fsrs, Rating, State } = require('./ts-fsrs-bundle') as FSRSBundleExports;

// ============ Types ============

/** 从数据库读取的卡片状态（旧版 SM-2 兼容） */
export interface SM2CardState {
  ease_factor?: number; // SM-2 EF, 默认 2.5
  interval_days?: number; // 当前间隔天数
  review_count?: number; // 复习次数
  last_review_time?: number; // 上次复习时间戳 (ms)
  next_review_time?: number; // 下次复习时间戳 (ms)
}

/** 调度结果（旧版 SM-2 兼容） */
export interface ScheduleResult {
  interval_days: number;
  ease_factor: number;
  next_review_time: number; // 时间戳 (ms)
  stability: number;
  difficulty: number;
}

/** FSRS 卡片持久化状态（可存入数据库） */
export interface FSRSCardState {
  due: number; // 时间戳 (ms)
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number; // State enum value
  last_review?: number; // 时间戳 (ms)
}

/** FSRS 原生调度结果 — 包含完整卡片状态 + 复习日志 */
export interface FSRSScheduleResult {
  /** 下一轮完整卡片状态，直接持久化到数据库 */
  card: FSRSCardState;
  /** 复习日志数据，可选存储用于分析 */
  reviewLog: {
    rating: number; // Rating enum value
    state: number; // 复习前的 State
    due: number; // 时间戳 (ms)
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    review: number; // 复习时间戳 (ms)
  };
  /** 向后兼容的 SM-2 字段，方便渐进迁移 */
  legacy: ScheduleResult;
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

// ============ Default FSRS Parameters ============

const DEFAULT_FSRS_PARAMS: Partial<FSRSParameters> = {
  maximum_interval: 180, // 考试备考场景，最大间隔 180 天
  request_retention: 0.9, // 目标记忆保持率 90%
  enable_fuzz: true, // 添加随机偏移，避免复习堆积
  enable_short_term: true // 启用短期调度（学习阶段内的步骤）
};

/** 全局默认调度器（无个性化参数时使用） */
const defaultScheduler = fsrs(generatorParameters(DEFAULT_FSRS_PARAMS));

/** 用户个性化参数缓存（userId → { scheduler, expiry }） */
const userSchedulerCache = new Map<string, { scheduler: ReturnType<typeof fsrs>; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

/** 用户个性化 FSRS 参数（存储在 user profile 中） */
export interface UserFSRSParams {
  w?: number[]; // FSRS 权重向量 (19 个浮点数)
  request_retention?: number; // 个性化目标留存率
  maximum_interval?: number;
  optimized_at?: number; // 上次优化时间戳
  optimize_count?: number; // 累计优化次数
  review_log_count?: number; // 用于优化的日志数量
}

/**
 * 获取调度器实例：优先使用用户个性化参数，回退到全局默认
 */
export function getScheduler(userParams?: UserFSRSParams | null): ReturnType<typeof fsrs> {
  if (!userParams?.w || userParams.w.length === 0) {
    return defaultScheduler;
  }
  // 用 JSON 序列化做缓存 key（参数不常变）
  const cacheKey = JSON.stringify(userParams.w) + ':' + (userParams.request_retention ?? 0.9);
  const cached = userSchedulerCache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return cached.scheduler;
  }
  const customParams = generatorParameters({
    ...DEFAULT_FSRS_PARAMS,
    w: userParams.w,
    request_retention: userParams.request_retention ?? DEFAULT_FSRS_PARAMS.request_retention
  });
  const s = fsrs(customParams);
  userSchedulerCache.set(cacheKey, { scheduler: s, expiry: Date.now() + CACHE_TTL });
  return s;
}

/** 持久化用的 review log 结构（写入 review_logs 集合） */
export interface ReviewLogRecord {
  user_id: string;
  card_id: string; // mistake_book._id 或 question_id
  card_type: 'mistake' | 'question'; // 来源类型
  rating: number;
  state: number; // 复习前的 State
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  review: number; // 复习时间戳 (ms)
  created_at: number;
}

// ============ Rating Mapping ============

const RATING_MAP: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy
};

// ============ Exported Functions ============

/**
 * [新] FSRS 原生调度 — 保留完整卡片状态，无损往返
 * @param cardState 数据库中存储的 FSRSCardState（由 createNewCard / migrateToFSRS 生成）
 * @param rating 用户评分
 * @param now 可选，复习时间点，默认当前时间
 * @param userParams 可选，用户个性化 FSRS 参数
 */
export function scheduleReviewFSRS(
  cardState: FSRSCardState,
  rating: ReviewRating,
  now: Date = new Date(),
  userParams?: UserFSRSParams | null
): FSRSScheduleResult {
  const fsrsCard = stateToCard(cardState);
  const grade: Grade = RATING_MAP[rating];

  const result: RecordLogItem = getScheduler(userParams).next(fsrsCard, now, grade);
  const next = result.card;
  const log = result.log;

  const nextState = cardToState(next);

  return {
    card: nextState,
    reviewLog: {
      rating: log.rating,
      state: log.state,
      due: log.due.getTime(),
      stability: _roundTo(log.stability, 4),
      difficulty: _roundTo(log.difficulty, 4),
      elapsed_days: log.elapsed_days,
      scheduled_days: log.scheduled_days,
      review: log.review.getTime()
    },
    legacy: {
      interval_days: next.scheduled_days || 1,
      ease_factor: _roundTo(mapDifficultyToEF(next.difficulty), 2),
      next_review_time: next.due.getTime(),
      stability: _roundTo(next.stability, 4),
      difficulty: _roundTo(next.difficulty, 4)
    }
  };
}

/**
 * [旧] SM-2 兼容调度 — 保留向后兼容，内部有损往返
 * @deprecated 请迁移到 scheduleReviewFSRS()
 */
export function scheduleReview(card: SM2CardState, rating: ReviewRating): ScheduleResult {
  const now = new Date();
  const fsrsCard = toFSRSCard(card);
  const grade: Grade = RATING_MAP[rating];

  const result: RecordLogItem = getScheduler().next(fsrsCard, now, grade);
  const next = result.card;

  return {
    interval_days: next.scheduled_days || 1,
    ease_factor: _roundTo(mapDifficultyToEF(next.difficulty), 2),
    next_review_time: next.due.getTime(),
    stability: _roundTo(next.stability, 4),
    difficulty: _roundTo(next.difficulty, 4)
  };
}

/**
 * 创建新卡片的初始 FSRS 状态
 */
export function createNewCard(): FSRSCardState {
  const card = createEmptyCard(new Date());
  return cardToState(card);
}

/**
 * 一次性迁移：SM-2 字段 → FSRS 原生状态
 * 迁移后应将返回值持久化到数据库，后续使用 scheduleReviewFSRS() 调度
 */
export function migrateToFSRS(sm2: SM2CardState): FSRSCardState {
  return convertFromSM2(sm2);
}

/**
 * 检测数据库文档是否已包含 FSRS 原生字段
 * 用于渐进迁移：如果有 stability 字段且 state 字段存在，视为已迁移
 */
export function hasFSRSState(doc: Record<string, unknown>): boolean {
  return (
    typeof doc.stability === 'number' &&
    typeof doc.difficulty === 'number' &&
    typeof doc.state === 'number' &&
    typeof doc.due === 'number'
  );
}

/**
 * 从数据库文档中提取 FSRSCardState
 * 前提：hasFSRSState(doc) === true
 */
export function extractFSRSState(doc: Record<string, unknown>): FSRSCardState {
  return {
    due: doc.due as number,
    stability: doc.stability as number,
    difficulty: doc.difficulty as number,
    elapsed_days: (doc.elapsed_days as number) ?? 0,
    scheduled_days: (doc.scheduled_days as number) ?? 0,
    learning_steps: (doc.learning_steps as number) ?? 0,
    reps: (doc.reps as number) ?? 0,
    lapses: (doc.lapses as number) ?? 0,
    state: (doc.state as number) ?? State.New,
    last_review: doc.last_review as number | undefined
  };
}

/**
 * 将现有 SM-2 卡片数据转换为 FSRS 格式
 * 基于 SM-2 的 EF 和 interval 推算 FSRS 的 stability 和 difficulty
 */
export function convertFromSM2(sm2: SM2CardState): FSRSCardState {
  const ef = sm2.ease_factor ?? 2.5;
  const interval = sm2.interval_days ?? 0;
  const reviews = sm2.review_count ?? 0;
  const lastReview = sm2.last_review_time;
  const nextReview = sm2.next_review_time;

  if (reviews === 0 || interval === 0) {
    return createNewCard();
  }

  // interval 近似 stability（FSRS 中 stability ≈ 记忆半衰期天数）
  const stability = Math.max(interval, 0.1);

  // EF→difficulty 线性映射: EF 2.5→5.0, EF 1.3→9.0, EF 3.0+→2.0
  const difficulty = _clamp(10 - ((ef - 1.3) * 8) / 1.7, 1, 10);

  const now = Date.now();
  const lastReviewMs = lastReview ?? now;
  const elapsedDays = Math.max(Math.round((now - lastReviewMs) / 86_400_000), 0);

  return {
    due: nextReview ?? now,
    stability: _roundTo(stability, 4),
    difficulty: _roundTo(difficulty, 4),
    elapsed_days: elapsedDays,
    scheduled_days: interval,
    learning_steps: 0,
    reps: reviews,
    lapses: 0,
    state: State.Review,
    last_review: lastReviewMs
  };
}

// ============ FSRS 遗忘曲线 ============

/** FSRS 遗忘曲线常数（与 ts-fsrs FSRS5 默认值一致） */
const FSRS_DECAY = -0.5;
const FSRS_FACTOR = 19 / 81; // (0.9^(1/DECAY) - 1)

/**
 * 可提取性 R(t) — FSRS 遗忘曲线
 * 公式: R(t,S) = (1 + FACTOR × t/S)^DECAY
 * 来源: open-spaced-repetition/fsrs4anki
 *
 * @param elapsedDays 距上次复习的天数
 * @param stability 记忆稳定性（天数）
 * @returns 0~1 之间的可提取性值
 */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FSRS_FACTOR * elapsedDays) / stability, FSRS_DECAY);
}

// ============ Internal Helpers ============

/** SM-2 字段 → ts-fsrs Card（旧版有损路径） */
function toFSRSCard(card: SM2CardState): Card {
  const reviews = card.review_count ?? 0;
  const interval = card.interval_days ?? 0;

  if (reviews === 0 || interval === 0) {
    return createEmptyCard(new Date());
  }

  const ef = card.ease_factor ?? 2.5;
  const lastReview = card.last_review_time ? new Date(card.last_review_time) : new Date();
  const due = card.next_review_time ? new Date(card.next_review_time) : new Date();

  const stability = Math.max(interval, 0.1);
  const difficulty = _clamp(10 - ((ef - 1.3) * 8) / 1.7, 1, 10);
  const elapsedDays = Math.max(Math.round((Date.now() - lastReview.getTime()) / 86_400_000), 0);

  return {
    due,
    stability,
    difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: interval,
    learning_steps: 0,
    reps: reviews,
    lapses: 0,
    state: State.Review,
    last_review: lastReview
  };
}

/** FSRSCardState（数据库持久化格式） → ts-fsrs Card（无损） */
function stateToCard(s: FSRSCardState): Card {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    learning_steps: s.learning_steps,
    reps: s.reps,
    lapses: s.lapses,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review) : undefined
  };
}

/** ts-fsrs Card → FSRSCardState（数据库持久化格式） */
function cardToState(card: Card): FSRSCardState {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.getTime()
  };
}

/** FSRS difficulty (1-10) → SM-2 兼容的 ease_factor (1.3-4.0) */
function mapDifficultyToEF(difficulty: number): number {
  return _clamp(1.3 + ((10 - difficulty) * 1.7) / 8, 1.3, 4.0);
}

function _clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function _roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
