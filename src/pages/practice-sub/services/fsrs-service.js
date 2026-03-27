/**
 * 集中式 FSRS 间隔重复调度服务 (Centralized FSRS Spaced Repetition Service)
 *
 * 基于 ts-fsrs v5 实现生产级间隔重复调度，使用 FSRS-5 最新研究参数。
 * 本模块是所有 FSRS 调度逻辑的唯一入口，取代分散在各处的零碎调用。
 *
 * 职责:
 * 1. 维护全局 FSRS 调度器实例（支持个性化参数热替换）
 * 2. 卡片调度: scheduleCard / createNewCard
 * 3. 到期筛选与排序: getDueCards（按可提取性排序）
 * 4. 统计聚合: getReviewStats
 * 5. 持久化: 通过 storageService 存取每张卡的 FSRS 状态
 *
 * 存储键模式: `fsrs_card_{questionId}`
 *
 * @module fsrs-service
 * @see https://github.com/open-spaced-repetition/ts-fsrs
 * @see https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 */

import { FSRS, Rating, State, createEmptyCard, generatorParameters } from '@/utils/fsrs-lite.js';
import { storageService } from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * FSRS-5 优化默认权重
 * 来源: open-spaced-repetition 研究项目最新发布的 FSRS-5 default weights
 * @see https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 */
const FSRS5_DEFAULT_WEIGHTS = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589, 1.533, 0.1544, 1.0347, 1.9395, 0.1091, 0.2943,
  2.4888, 0.2975, 2.6772, 0.0553, 0.5225, 0.5485, 0.0
];

/** 目标留存率 (90%) — 考研场景的平衡点 */
const DEFAULT_REQUEST_RETENTION = 0.9;

/** 最大复习间隔天数 (100 年，实际由 FSRS 算法约束) */
const DEFAULT_MAXIMUM_INTERVAL = 36500;

/** 存储键前缀 */
const STORAGE_KEY_PREFIX = 'fsrs_card_';

/** 用户个性化参数存储键 */
const USER_PARAMS_KEY = 'fsrs_user_params';

// ---------------------------------------------------------------------------
// Scheduler singleton
// ---------------------------------------------------------------------------

/**
 * 当前 FSRS 调度器实例
 * @type {FSRS}
 */
let _scheduler = _buildScheduler(null);

/**
 * 当前已加载的参数指纹，用于避免重复重建
 * @type {string}
 */
let _paramsFingerprint = '';

/**
 * 根据参数构建 FSRS 实例
 * @param {Object|null} userParams - 用户个性化参数 { w: number[], requestRetention?: number }
 * @returns {FSRS}
 * @private
 */
function _buildScheduler(userParams) {
  const params = generatorParameters({
    w: userParams?.w?.length ? userParams.w : FSRS5_DEFAULT_WEIGHTS,
    request_retention: userParams?.requestRetention ?? userParams?.request_retention ?? DEFAULT_REQUEST_RETENTION,
    maximum_interval: DEFAULT_MAXIMUM_INTERVAL,
    enable_fuzz: true,
    enable_short_term: true
  });
  return new FSRS(params);
}

// ---------------------------------------------------------------------------
// User parameter management
// ---------------------------------------------------------------------------

/**
 * 加载用户个性化 FSRS 参数并重建调度器
 *
 * 当后端 fsrs-optimizer 计算出个性化权重后，调用此函数注入。
 * 如果传入 null/undefined，则回退到 FSRS-5 默认参数。
 *
 * @param {Object|null} userParams - 用户参数，包含 w (个性化权重数组, 长度 21) 和
 *   requestRetention (个性化目标留存率) 字段
 * @returns {boolean} 是否成功加载了个性化参数（false 表示回退到默认）
 */
export function loadUserParams(userParams) {
  const fingerprint = userParams?.w?.length
    ? JSON.stringify(userParams.w) + ':' + (userParams.requestRetention ?? DEFAULT_REQUEST_RETENTION)
    : '';

  if (fingerprint === _paramsFingerprint) {
    return fingerprint !== '';
  }

  _scheduler = _buildScheduler(userParams);
  _paramsFingerprint = fingerprint;

  // 持久化到本地，下次冷启动可直接使用
  if (userParams?.w?.length) {
    storageService.save(USER_PARAMS_KEY, userParams, true);
  } else {
    storageService.remove(USER_PARAMS_KEY, true);
  }

  logger.log('[FSRSService] 调度器参数已更新', fingerprint ? '个性化' : '默认');
  return fingerprint !== '';
}

/**
 * 冷启动时从本地存储恢复用户参数
 * 应在 App.vue onLaunch 中调用
 */
export function restoreUserParams() {
  try {
    const saved = storageService.get(USER_PARAMS_KEY, null);
    if (saved?.w?.length) {
      loadUserParams(saved);
    }
  } catch (e) {
    logger.warn('[FSRSService] 恢复用户参数失败', e);
  }
}

/**
 * 查询当前是否使用个性化参数
 * @returns {boolean}
 */
export function hasCustomParams() {
  return _paramsFingerprint !== '';
}

// ---------------------------------------------------------------------------
// Card CRUD (storage)
// ---------------------------------------------------------------------------

/**
 * 生成卡片的存储键
 * @param {string} questionId - 题目唯一 ID
 * @returns {string}
 * @private
 */
function _cardKey(questionId) {
  return `${STORAGE_KEY_PREFIX}${questionId}`;
}

/**
 * 创建一张全新的 FSRS 卡片
 *
 * 用于首次遇到一道题时初始化其 FSRS 状态。
 * 返回的对象可直接传给 scheduleCard 或 saveCardState。
 *
 * @param {Date} [now=new Date()] - 创建时间
 * @returns {import('ts-fsrs').Card} ts-fsrs 标准 Card 对象
 */
export function createNewCard(now = new Date()) {
  return createEmptyCard(now);
}

/**
 * 将 ts-fsrs Card 对象序列化为可持久化的纯对象
 *
 * ts-fsrs 的 Card 包含 Date 对象，不能直接 JSON 序列化后还原。
 * 此函数将日期转为 ISO 字符串以确保存取一致性。
 *
 * @param {import('ts-fsrs').Card} card
 * @returns {Object} 可安全序列化的纯 JS 对象
 * @private
 */
function _serializeCard(card) {
  return {
    due: card.due instanceof Date ? card.due.toISOString() : card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learning_steps,
    state: card.state,
    last_review: card.last_review instanceof Date ? card.last_review.toISOString() : (card.last_review ?? null)
  };
}

/**
 * 将持久化的纯对象反序列化为 ts-fsrs Card
 *
 * @param {Object} obj - 从存储读取的纯对象
 * @returns {import('ts-fsrs').Card} ts-fsrs Card 对象
 * @private
 */
function _deserializeCard(obj) {
  return {
    due: new Date(obj.due),
    stability: obj.stability ?? 0,
    difficulty: obj.difficulty ?? 0,
    elapsed_days: obj.elapsed_days ?? 0,
    scheduled_days: obj.scheduled_days ?? 0,
    reps: obj.reps ?? 0,
    lapses: obj.lapses ?? 0,
    learning_steps: obj.learning_steps ?? 0,
    state: obj.state ?? State.New,
    last_review: obj.last_review ? new Date(obj.last_review) : undefined
  };
}

/**
 * 保存卡片 FSRS 状态到本地存储
 *
 * @param {string} questionId - 题目唯一 ID
 * @param {import('ts-fsrs').Card} card - ts-fsrs Card 对象
 * @returns {boolean} 是否保存成功
 */
export function saveCardState(questionId, card) {
  if (!questionId) {
    logger.warn('[FSRSService] saveCardState: questionId 为空');
    return false;
  }
  return storageService.save(_cardKey(questionId), _serializeCard(card), true);
}

/**
 * 从本地存储读取卡片 FSRS 状态
 *
 * 如果该题目从未被 FSRS 调度过，返回 null。
 *
 * @param {string} questionId - 题目唯一 ID
 * @returns {import('ts-fsrs').Card|null} ts-fsrs Card 对象，或 null
 */
export function loadCardState(questionId) {
  if (!questionId) return null;
  const raw = storageService.get(_cardKey(questionId), null);
  if (!raw || typeof raw !== 'object' || !raw.due) return null;
  try {
    return _deserializeCard(raw);
  } catch (e) {
    logger.warn('[FSRSService] 反序列化卡片失败', questionId, e);
    return null;
  }
}

/**
 * 删除卡片 FSRS 状态
 *
 * @param {string} questionId - 题目唯一 ID
 */
export function removeCardState(questionId) {
  if (!questionId) return;
  storageService.remove(_cardKey(questionId), true);
}

// ---------------------------------------------------------------------------
// Core scheduling
// ---------------------------------------------------------------------------

/**
 * 对一张卡片执行一次复习调度
 *
 * 这是核心调度函数。传入当前卡片状态和用户评分，返回更新后的卡片
 * 以及下次复习的元信息。
 *
 * @param {import('ts-fsrs').Card} card - 当前卡片状态（可从 loadCardState 或 createNewCard 获取）
 * @param {1|2|3|4|'again'|'hard'|'good'|'easy'} rating - 用户评分
 *   - 1 / 'again': 完全忘记
 *   - 2 / 'hard':  费力回忆
 *   - 3 / 'good':  正常回忆
 *   - 4 / 'easy':  轻松回忆
 * @param {Date} [now=new Date()] - 当前时间（可注入用于测试）
 * @returns {{ card: import('ts-fsrs').Card, log: import('ts-fsrs').ReviewLog, nextDue: Date, intervalDays: number }}
 *   - card: 更新后的卡片对象（应传给 saveCardState 持久化）
 *   - log: 本次复习日志（可用于后续上传给 fsrs-optimizer）
 *   - nextDue: 下次复习时间
 *   - intervalDays: 距离下次复习的天数
 * @throws {Error} 评分值无效时抛出
 */
export function scheduleCard(card, rating, now = new Date()) {
  const numericRating = _normalizeRating(rating);
  const result = _scheduler.repeat(card, now);
  const chosen = result[numericRating];

  return {
    card: chosen.card,
    log: chosen.log,
    nextDue: new Date(chosen.card.due),
    intervalDays: chosen.card.scheduled_days
  };
}

/**
 * 预览所有评分的调度结果（不实际执行）
 *
 * 用于在 UI 上同时显示四个按钮各自的下次复习时间。
 *
 * @param {import('ts-fsrs').Card} card - 当前卡片状态
 * @param {Date} [now=new Date()] - 当前时间
 * @returns {{ again: { nextDue: Date, intervalDays: number }, hard: { nextDue: Date, intervalDays: number }, good: { nextDue: Date, intervalDays: number }, easy: { nextDue: Date, intervalDays: number } }}
 */
export function previewSchedule(card, now = new Date()) {
  const result = _scheduler.repeat(card, now);

  return {
    again: _extractPreview(result[Rating.Again]),
    hard: _extractPreview(result[Rating.Hard]),
    good: _extractPreview(result[Rating.Good]),
    easy: _extractPreview(result[Rating.Easy])
  };
}

/**
 * 从 repeat 结果中提取预览信息
 * @private
 */
function _extractPreview(entry) {
  return {
    nextDue: new Date(entry.card.due),
    intervalDays: entry.card.scheduled_days
  };
}

// ---------------------------------------------------------------------------
// Due cards filtering & sorting
// ---------------------------------------------------------------------------

/**
 * 从卡片集合中筛选到期卡片，并按紧急度排序（最需要复习的排最前）
 *
 * 排序策略: 按可提取性 (retrievability) 升序。
 * 可提取性越低，说明遗忘风险越高，应优先复习。
 * 对于 New 状态的卡片（从未复习过），统一视为可提取性 0（最高优先）。
 *
 * @param {Array<{questionId: string, [key: string]: any}>} allCards - 卡片数组，
 *   每个元素至少包含 `questionId` 字段。FSRS 状态会从 storageService 自动加载。
 * @param {Date} [now=new Date()] - 当前时间
 * @returns {Array<{questionId: string, card: import('ts-fsrs').Card, retrievability: number, overdueDays: number}>}
 *   筛选并排序后的到期卡片数组，附带 FSRS card 对象和可提取性。
 */
export function getDueCards(allCards, now = new Date()) {
  if (!Array.isArray(allCards) || allCards.length === 0) return [];

  const nowMs = now.getTime();
  const dueCards = [];

  for (const item of allCards) {
    const qid = item.questionId || item.question_id || item.id;
    if (!qid) continue;

    const card = loadCardState(qid);

    if (!card) {
      // 从未被 FSRS 调度过 → 视为新卡，最高优先级
      dueCards.push({
        ...item,
        questionId: qid,
        card: null,
        retrievability: 0,
        overdueDays: Infinity,
        isNew: true
      });
      continue;
    }

    const dueMs = new Date(card.due).getTime();
    if (dueMs > nowMs) continue; // 未到期，跳过

    // 计算可提取性 (retrievability)
    const retrievability = _calculateRetrievability(card, now);
    const overdueDays = (nowMs - dueMs) / 86400000;

    dueCards.push({
      ...item,
      questionId: qid,
      card,
      retrievability,
      overdueDays,
      isNew: false
    });
  }

  // 按可提取性升序排序（最可能遗忘的在前）
  dueCards.sort((a, b) => a.retrievability - b.retrievability);

  return dueCards;
}

/**
 * 计算卡片当前的可提取性 (retrievability)
 *
 * 使用 FSRS 的遗忘曲线公式:
 *   R(t) = (1 + t / (9 * S))^(-1)
 * 其中 S 为稳定性 (stability)，t 为距上次复习的天数。
 *
 * @param {import('ts-fsrs').Card} card - FSRS 卡片
 * @param {Date} now - 当前时间
 * @returns {number} 0~1 之间的可提取性值
 * @private
 */
function _calculateRetrievability(card, now) {
  if (card.state === State.New || !card.stability || card.stability <= 0) {
    return 0;
  }

  const lastReview = card.last_review ? new Date(card.last_review) : null;
  if (!lastReview) return 0;

  const elapsedDays = (now.getTime() - lastReview.getTime()) / 86400000;
  if (elapsedDays <= 0) return 1;

  // FSRS 遗忘曲线: R = (1 + t/(9*S))^(-1)
  const retrievability = Math.pow(1 + elapsedDays / (9 * card.stability), -1);
  return Math.max(0, Math.min(1, retrievability));
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} ReviewStats
 * @property {number} dueCount - 已到期待复习的卡片数
 * @property {number} newCount - 从未复习过的新卡片数
 * @property {number} learningCount - 处于学习/再学习阶段的到期卡片数
 * @property {number} reviewCount - 处于复习阶段的到期卡片数
 * @property {number} overdueCount - 逾期超过 1 天的卡片数
 * @property {number} totalCount - 总卡片数
 * @property {number} matureCount - 稳定性 >= 21 天的成熟卡片数（含未到期）
 * @property {number} averageRetention - 所有已复习卡片的平均可提取性 (0~1)
 */

/**
 * 计算卡片集合的复习统计信息
 *
 * @param {Array<{questionId: string, [key: string]: any}>} allCards - 卡片数组
 * @param {Date} [now=new Date()] - 当前时间
 * @returns {ReviewStats} 统计结果
 */
export function getReviewStats(allCards, now = new Date()) {
  if (!Array.isArray(allCards) || allCards.length === 0) {
    return _emptyStats();
  }

  const nowMs = now.getTime();
  const stats = _emptyStats();
  stats.totalCount = allCards.length;

  let retentionSum = 0;
  let retentionCount = 0;

  for (const item of allCards) {
    const qid = item.questionId || item.question_id || item.id;
    if (!qid) continue;

    const card = loadCardState(qid);

    if (!card) {
      // 新卡片（从未调度过）
      stats.newCount++;
      stats.dueCount++;
      continue;
    }

    const dueMs = new Date(card.due).getTime();
    const isDue = dueMs <= nowMs;

    // 计算可提取性（仅对已复习的卡片）
    if (card.state !== State.New && card.stability > 0) {
      const r = _calculateRetrievability(card, now);
      retentionSum += r;
      retentionCount++;

      // 成熟卡片: 稳定性 >= 21 天
      if (card.stability >= 21) {
        stats.matureCount++;
      }
    }

    if (!isDue) continue;

    stats.dueCount++;

    // 按状态分类
    switch (card.state) {
      case State.New:
        stats.newCount++;
        break;
      case State.Learning:
      case State.Relearning:
        stats.learningCount++;
        break;
      case State.Review:
        stats.reviewCount++;
        break;
      default:
        break;
    }

    // 逾期超过 1 天
    const overdueDays = (nowMs - dueMs) / 86400000;
    if (overdueDays > 1) {
      stats.overdueCount++;
    }
  }

  stats.averageRetention = retentionCount > 0 ? retentionSum / retentionCount : 0;

  return stats;
}

/**
 * 返回空统计对象
 * @returns {ReviewStats}
 * @private
 */
function _emptyStats() {
  return {
    dueCount: 0,
    newCount: 0,
    learningCount: 0,
    reviewCount: 0,
    overdueCount: 0,
    totalCount: 0,
    matureCount: 0,
    averageRetention: 0
  };
}

// ---------------------------------------------------------------------------
// Rating normalization
// ---------------------------------------------------------------------------

/**
 * 评分字符串/数字 → ts-fsrs Rating 枚举值
 * @type {Record<string, number>}
 * @private
 */
const RATING_MAP = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
  1: Rating.Again,
  2: Rating.Hard,
  3: Rating.Good,
  4: Rating.Easy
};

/**
 * 将多种评分格式归一化为 ts-fsrs Rating 数值
 * @param {1|2|3|4|'again'|'hard'|'good'|'easy'} rating
 * @returns {number} Rating 枚举值
 * @throws {Error} 评分值无效
 * @private
 */
function _normalizeRating(rating) {
  if (typeof rating === 'number' && rating >= 1 && rating <= 4) {
    return rating;
  }
  const mapped = RATING_MAP[String(rating).toLowerCase()];
  if (mapped === undefined) {
    throw new Error(`[FSRSService] 无效的评分: ${rating}. 可用值: 1-4 或 'again'/'hard'/'good'/'easy'`);
  }
  return mapped;
}

// ---------------------------------------------------------------------------
// Convenience: schedule + persist in one call
// ---------------------------------------------------------------------------

/**
 * 一站式调度并持久化（调度 + 保存 + 返回结果）
 *
 * 这是最常用的高层 API。在用户完成一道题的评分后调用:
 * 1. 如果该题没有 FSRS 状态，自动创建新卡片
 * 2. 执行调度计算
 * 3. 将更新后的卡片状态保存到 storageService
 * 4. 返回调度结果
 *
 * @param {string} questionId - 题目唯一 ID
 * @param {1|2|3|4|'again'|'hard'|'good'|'easy'} rating - 用户评分
 * @param {Date} [now=new Date()] - 当前时间
 * @returns {{ card: import('ts-fsrs').Card, log: import('ts-fsrs').ReviewLog, nextDue: Date, intervalDays: number, questionId: string }}
 */
export function scheduleAndSave(questionId, rating, now = new Date()) {
  let card = loadCardState(questionId);
  if (!card) {
    card = createNewCard(now);
  }

  const result = scheduleCard(card, rating, now);
  saveCardState(questionId, result.card);

  return {
    ...result,
    questionId
  };
}

// ---------------------------------------------------------------------------
// Exports: Rating & State enums (re-export for consumer convenience)
// ---------------------------------------------------------------------------

export { Rating, State };

/**
 * 格式化间隔天数为人类可读文本
 *
 * @param {number} days - 间隔天数
 * @returns {string} 例如 "10分钟", "1天", "2.5个月"
 */
export function formatInterval(days) {
  if (days < 1 / 24) {
    // < 1 小时 → 显示分钟
    const minutes = Math.max(1, Math.round(days * 1440));
    return `${minutes}分钟`;
  }
  if (days < 1) {
    const hours = Math.round(days * 24);
    return `${hours}小时`;
  }
  if (days < 30) {
    const d = Math.round(days * 10) / 10;
    return d === 1 ? '1天' : `${d}天`;
  }
  if (days < 365) {
    const months = Math.round((days / 30) * 10) / 10;
    return months === 1 ? '1个月' : `${months}个月`;
  }
  const years = Math.round((days / 365) * 10) / 10;
  return years === 1 ? '1年' : `${years}年`;
}
