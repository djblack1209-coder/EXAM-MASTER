/**
 * FSRS 个性化参数优化器
 *
 * 聚合用户 review_logs，计算个性化记忆参数，存入 user_profiles
 *
 * Actions:
 * - optimize:        触发参数优化（需要至少 100 条 review log）
 * - get_params:      获取当前个性化 FSRS 参数（或默认值）
 * - get_review_stats: 获取复习统计、留存率曲线、学习分析数据
 *
 * 兼容旧 action 名:
 * - getStatus         → get_params
 * - getRetentionCurve → get_review_stats
 *
 * @version 2.0.0
 */

import cloud from '@lafjs/cloud';
import { fsrs, generatorParameters, State, createEmptyCard, type Grade, type RecordLogItem } from 'ts-fsrs';
import { requireAuth, isAuthError } from './_shared/auth-middleware';
import { generateRequestId, createLogger } from './_shared/api-response';
import type { UserFSRSParams, ReviewLogRecord } from './_shared/fsrs-scheduler';

const db = cloud.database();
const logger = createLogger('[FSRSOptimizer]');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 最少需要的 review log 数量才能进行有意义的优化 */
const MIN_LOGS_FOR_OPTIMIZE = 100;

/** 优化冷却时间：24 小时内不重复优化 */
const OPTIMIZE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** FSRS-5 默认权重（21 个参数） */
const FSRS5_DEFAULT_W: number[] = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589, 1.533, 0.1544, 1.0347, 1.9395, 0.1091, 0.2943,
  2.4888, 0.2975, 2.6772, 0.0553, 0.5225, 0.5485, 0.0
];

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default async function (ctx: FunctionContext) {
  const startTime = Date.now();
  const requestId = generateRequestId('fopt');

  try {
    const { action } = ctx.body || {};

    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return { code: 401, ok: false, message: authResult.message, requestId };
    }
    const userId = authResult.userId;

    switch (action) {
      case 'optimize':
        return await handleOptimize(userId, requestId, startTime);

      case 'get_params':
      case 'getStatus':
        return await handleGetParams(userId, requestId, startTime);

      case 'get_review_stats':
      case 'getRetentionCurve':
        return await handleGetReviewStats(userId, requestId, startTime);

      default:
        return { code: 400, ok: false, message: `不支持的操作: ${action}`, requestId };
    }
  } catch (error) {
    logger.error(`[${requestId}] 优化器异常:`, error);
    return { code: 500, ok: false, message: '服务器内部错误', requestId };
  }
}

// ---------------------------------------------------------------------------
// Action: optimize
// ---------------------------------------------------------------------------

/**
 * 触发 FSRS 参数优化
 *
 * 1. 拉取用户全部 review_logs
 * 2. 按卡片分组，模拟 FSRS 调度，计算 binary cross-entropy loss
 * 3. 网格搜索 request_retention + 梯度下降优化 w[0..3] 初始稳定性
 * 4. 将最优参数写入 user_profiles.fsrs_params
 *
 * Returns: { w: number[21], requestRetention: number, metrics: { totalReviews, retentionRate, rmse } }
 */
async function handleOptimize(userId: string, requestId: string, startTime: number) {
  // 从 user_profiles 或 users 读取已有参数（优先 user_profiles）
  const existingParams = await loadExistingParams(userId);

  // 检查冷却时间
  if (existingParams.optimized_at && Date.now() - existingParams.optimized_at < OPTIMIZE_COOLDOWN_MS) {
    const remaining = Math.ceil((OPTIMIZE_COOLDOWN_MS - (Date.now() - existingParams.optimized_at)) / 3600000);
    return {
      code: 429,
      ok: false,
      message: `优化冷却中，${remaining} 小时后可再次优化`,
      requestId,
      duration: Date.now() - startTime
    };
  }

  // 拉取用户 review logs（按时间排序，上限 10000 条）
  const logsResult = await db
    .collection('review_logs')
    .where({ user_id: userId })
    .orderBy('review', 'asc')
    .limit(10000)
    .get();

  const logs: ReviewLogRecord[] = logsResult.data || [];

  if (logs.length < MIN_LOGS_FOR_OPTIMIZE) {
    return {
      code: 400,
      ok: false,
      message: `复习记录不足，需要至少 ${MIN_LOGS_FOR_OPTIMIZE} 条（当前 ${logs.length} 条）`,
      data: { current: logs.length, required: MIN_LOGS_FOR_OPTIMIZE },
      requestId,
      duration: Date.now() - startTime
    };
  }

  // 按卡片分组 review logs
  const cardLogs = new Map<string, ReviewLogRecord[]>();
  for (const log of logs) {
    const key = log.card_id;
    if (!cardLogs.has(key)) cardLogs.set(key, []);
    cardLogs.get(key)!.push(log);
  }

  // 计算全局实际留存率（用于 metrics）
  const retentionInfo = computeRetentionRate(logs);

  // 运行优化器
  const optimResult = optimizeParameters(logs, cardLogs);

  // 组装最终参数
  const now = Date.now();
  const fsrsParams: UserFSRSParams = {
    w: optimResult.w,
    request_retention: optimResult.retention,
    maximum_interval: 180,
    optimized_at: now,
    optimize_count: (existingParams.optimize_count || 0) + 1,
    review_log_count: logs.length
  };

  // 同时写入 user_profiles 和 users（双写保证兼容性）
  await Promise.all([
    upsertUserProfile(userId, fsrsParams, now),
    db.collection('users').doc(userId).update({
      fsrs_params: fsrsParams,
      updated_at: now
    })
  ]);

  logger.info(
    `[${requestId}] 参数优化完成: ${logs.length} 条日志, ` +
      `cards=${cardLogs.size}, retention=${optimResult.retention}, ` +
      `rmse=${optimResult.rmse}, loss=${optimResult.loss}`
  );

  return {
    code: 0,
    ok: true,
    data: {
      w: optimResult.w,
      requestRetention: optimResult.retention,
      metrics: {
        totalReviews: logs.length,
        retentionRate: retentionInfo.rate,
        rmse: optimResult.rmse
      },
      // 额外信息
      optimized: true,
      cardCount: cardLogs.size,
      optimizeCount: fsrsParams.optimize_count,
      loss: optimResult.loss
    },
    message: '记忆模型优化完成',
    requestId,
    duration: Date.now() - startTime
  };
}

// ---------------------------------------------------------------------------
// Action: get_params
// ---------------------------------------------------------------------------

/**
 * 获取用户个性化 FSRS 参数（若未优化则返回默认值）
 */
async function handleGetParams(userId: string, requestId: string, startTime: number) {
  const [params, logCount] = await Promise.all([
    loadExistingParams(userId),
    db.collection('review_logs').where({ user_id: userId }).count()
  ]);

  const count = logCount.total || 0;
  const hasCustom = !!(params.w && params.w.length > 0);

  return {
    code: 0,
    ok: true,
    data: {
      // 核心参数（前端可直接传给 loadUserParams）
      w: hasCustom ? params.w : FSRS5_DEFAULT_W,
      requestRetention: params.request_retention ?? 0.9,

      // 状态信息
      hasCustomParams: hasCustom,
      optimizeCount: params.optimize_count || 0,
      optimizedAt: params.optimized_at || null,
      reviewLogCount: count,
      minLogsRequired: MIN_LOGS_FOR_OPTIMIZE,
      canOptimize: count >= MIN_LOGS_FOR_OPTIMIZE,
      cooldownRemaining: params.optimized_at
        ? Math.max(0, OPTIMIZE_COOLDOWN_MS - (Date.now() - params.optimized_at))
        : 0
    },
    message: '获取成功',
    requestId,
    duration: Date.now() - startTime
  };
}

// ---------------------------------------------------------------------------
// Action: get_review_stats
// ---------------------------------------------------------------------------

/**
 * 获取复习统计数据：总复习次数、按间隔天数的留存率、学习曲线
 */
async function handleGetReviewStats(userId: string, requestId: string, startTime: number) {
  // 拉取全部 review logs
  const logsResult = await db
    .collection('review_logs')
    .where({ user_id: userId })
    .orderBy('review', 'asc')
    .limit(10000)
    .get();

  const logs: ReviewLogRecord[] = logsResult.data || [];

  // 1. 按 elapsed_days 分桶，计算每个间隔天数的实际留存率
  const retentionByInterval = computeRetentionByInterval(logs);

  // 2. 学习曲线：按周聚合累计复习量和当周留存率
  const learningCurve = computeLearningCurve(logs);

  // 3. 评分分布
  const ratingDistribution = computeRatingDistribution(logs);

  // 4. 全局留存率
  const globalRetention = computeRetentionRate(logs);

  // 5. 每日复习量（最近 30 天）
  const dailyReviews = computeDailyReviews(logs);

  return {
    code: 0,
    ok: true,
    data: {
      totalReviews: logs.length,
      retentionRate: globalRetention.rate,
      retentionByInterval,
      learningCurve,
      ratingDistribution,
      dailyReviews
    },
    message: '获取成功',
    requestId,
    duration: Date.now() - startTime
  };
}

// ============================================================================
// Data helpers
// ============================================================================

/**
 * 从 user_profiles 或 users 集合加载已有 FSRS 参数
 * 优先读 user_profiles，回退读 users
 */
async function loadExistingParams(userId: string): Promise<UserFSRSParams> {
  try {
    // 先尝试 user_profiles
    const profileRes = await db.collection('user_profiles').where({ user_id: userId }).getOne();
    if (profileRes.data?.fsrs_params) {
      return profileRes.data.fsrs_params;
    }
  } catch (_) {
    // user_profiles 可能不存在，忽略
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    return userDoc.data?.fsrs_params || {};
  } catch (_) {
    return {};
  }
}

/**
 * 更新或创建 user_profiles 中的 fsrs_params
 */
async function upsertUserProfile(userId: string, fsrsParams: UserFSRSParams, now: number) {
  try {
    const existing = await db.collection('user_profiles').where({ user_id: userId }).getOne();
    if (existing.data) {
      await db.collection('user_profiles').doc(existing.data._id).update({
        fsrs_params: fsrsParams,
        updated_at: now
      });
    } else {
      await db.collection('user_profiles').add({
        user_id: userId,
        fsrs_params: fsrsParams,
        created_at: now,
        updated_at: now
      });
    }
  } catch (e) {
    // user_profiles 写入失败不阻塞主流程，users 中已有备份
    logger.warn(`[upsertUserProfile] 写入 user_profiles 失败:`, e);
  }
}

/**
 * 计算全局实际留存率
 * rating > 1 (Hard/Good/Easy) 视为成功回忆，排除 New 状态
 */
function computeRetentionRate(logs: ReviewLogRecord[]): { rate: number; recalled: number; total: number } {
  let recalled = 0;
  let total = 0;
  for (const log of logs) {
    if (log.state === 0) continue; // 排除 New
    total++;
    if (log.rating > 1) recalled++;
  }
  return {
    rate: total > 0 ? Math.round((recalled / total) * 10000) / 100 : 0,
    recalled,
    total
  };
}

/**
 * 按 elapsed_days 分桶统计留存率
 */
function computeRetentionByInterval(logs: ReviewLogRecord[]): Array<{
  days: number;
  total: number;
  recalled: number;
  retention: number;
}> {
  const buckets = new Map<number, { total: number; recalled: number }>();

  for (const log of logs) {
    if (log.state === 0) continue; // 排除 New
    const days = Math.round(log.elapsed_days);
    if (days < 0) continue;
    if (!buckets.has(days)) buckets.set(days, { total: 0, recalled: 0 });
    const b = buckets.get(days)!;
    b.total++;
    if (log.rating > 1) b.recalled++;
  }

  return Array.from(buckets.entries())
    .map(([days, { total, recalled }]) => ({
      days,
      total,
      recalled,
      retention: total > 0 ? Math.round((recalled / total) * 1000) / 10 : 0
    }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 180);
}

/**
 * 学习曲线：按自然周聚合，展示复习积累与留存率趋势
 */
function computeLearningCurve(logs: ReviewLogRecord[]): Array<{
  week: string;
  reviews: number;
  retention: number;
  cumulativeReviews: number;
}> {
  if (logs.length === 0) return [];

  const weekMap = new Map<string, { reviews: number; recalled: number; total: number }>();

  for (const log of logs) {
    const d = new Date(log.review);
    // ISO week key: YYYY-Wnn
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
    const weekKey = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

    if (!weekMap.has(weekKey)) weekMap.set(weekKey, { reviews: 0, recalled: 0, total: 0 });
    const w = weekMap.get(weekKey)!;
    w.reviews++;

    if (log.state !== 0) {
      w.total++;
      if (log.rating > 1) w.recalled++;
    }
  }

  const weeks = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b));

  let cumulative = 0;
  return weeks.map(([week, data]) => {
    cumulative += data.reviews;
    return {
      week,
      reviews: data.reviews,
      retention: data.total > 0 ? Math.round((data.recalled / data.total) * 1000) / 10 : 0,
      cumulativeReviews: cumulative
    };
  });
}

/**
 * 评分分布统计
 */
function computeRatingDistribution(logs: ReviewLogRecord[]): {
  again: number;
  hard: number;
  good: number;
  easy: number;
} {
  const dist = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const log of logs) {
    switch (log.rating) {
      case 1:
        dist.again++;
        break;
      case 2:
        dist.hard++;
        break;
      case 3:
        dist.good++;
        break;
      case 4:
        dist.easy++;
        break;
    }
  }
  return dist;
}

/**
 * 每日复习量（最近 30 天）
 */
function computeDailyReviews(logs: ReviewLogRecord[]): Array<{ date: string; count: number }> {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 86400000;
  const dailyMap = new Map<string, number>();

  for (const log of logs) {
    if (log.review < thirtyDaysAgo) continue;
    const d = new Date(log.review);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
  }

  return Array.from(dailyMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================================
// Core optimization algorithm
// ============================================================================

interface OptimizeResult {
  w: number[];
  retention: number;
  loss: number;
  rmse: number;
}

/**
 * FSRS 参数优化器
 *
 * Two-phase optimization:
 * Phase 1: Grid search over request_retention candidates with default w
 * Phase 2: Gradient descent on w[0..3] (initial stability per rating) to minimize BCE loss
 *
 * Also computes RMSE between predicted and actual retention across all review pairs.
 */
function optimizeParameters(_logs: ReviewLogRecord[], cardLogs: Map<string, ReviewLogRecord[]>): OptimizeResult {
  // ---- Phase 1: Grid search over retention ----
  const retentionCandidates = [0.8, 0.82, 0.85, 0.87, 0.9, 0.92, 0.95];

  let bestLoss = Infinity;
  let bestRetention = 0.9;
  let bestW: number[] = [];

  for (const retention of retentionCandidates) {
    const params = generatorParameters({
      maximum_interval: 180,
      request_retention: retention,
      enable_fuzz: false,
      enable_short_term: true
    });

    const loss = evaluateParams(params.w, retention, cardLogs);

    if (loss < bestLoss) {
      bestLoss = loss;
      bestRetention = retention;
      bestW = Array.from(params.w);
    }
  }

  // ---- Phase 2: Gradient descent on w[0..3] (initial stabilities) ----
  // These 4 parameters control initial stability for Again/Hard/Good/Easy
  // and have the most impact on new card scheduling accuracy.
  if (bestW.length >= 4) {
    const optimizedW = optimizeInitialStabilities(bestW, bestRetention, cardLogs);
    const newLoss = evaluateParams(optimizedW, bestRetention, cardLogs);
    if (newLoss < bestLoss) {
      bestLoss = newLoss;
      bestW = optimizedW;
    }
  }

  // Fallback to defaults if optimization failed
  if (bestW.length === 0) {
    bestW = [...FSRS5_DEFAULT_W];
  }

  // Ensure w has exactly 21 elements (pad with defaults if needed)
  while (bestW.length < 21) {
    bestW.push(FSRS5_DEFAULT_W[bestW.length] ?? 0);
  }

  // ---- Compute RMSE ----
  const rmse = computeRMSE(bestW, bestRetention, cardLogs);

  return {
    w: bestW,
    retention: bestRetention,
    loss: Math.round(bestLoss * 10000) / 10000,
    rmse: Math.round(rmse * 10000) / 10000
  };
}

/**
 * Evaluate a set of weights by computing average BCE loss across all review log sequences.
 */
function evaluateParams(w: readonly number[], retention: number, cardLogs: Map<string, ReviewLogRecord[]>): number {
  const params = generatorParameters({
    w: Array.from(w),
    maximum_interval: 180,
    request_retention: retention,
    enable_fuzz: false,
    enable_short_term: true
  });
  const testScheduler = fsrs(params);

  let totalLoss = 0;
  let totalCount = 0;

  for (const [_cardId, cardLogList] of cardLogs) {
    if (cardLogList.length < 2) continue;

    let card = createEmptyCard(new Date(cardLogList[0].review));

    for (let i = 0; i < cardLogList.length; i++) {
      const log = cardLogList[i];
      const reviewDate = new Date(log.review);
      const grade = log.rating as Grade;

      if (grade < 1 || grade > 4) continue;

      // Compute predicted retention based on current stability and elapsed days
      if (card.state !== State.New && card.stability > 0 && log.elapsed_days > 0) {
        const predictedRetention = Math.exp((Math.log(0.9) * log.elapsed_days) / card.stability);
        const actual = grade > 1 ? 1 : 0;
        // Binary cross-entropy
        const p = Math.max(0.001, Math.min(0.999, predictedRetention));
        totalLoss += -(actual * Math.log(p) + (1 - actual) * Math.log(1 - p));
        totalCount++;
      }

      // Advance card state
      try {
        const result: RecordLogItem = testScheduler.next(card, reviewDate, grade);
        card = result.card;
      } catch (_e) {
        break;
      }
    }
  }

  return totalCount > 0 ? totalLoss / totalCount : Infinity;
}

/**
 * Gradient descent on w[0..3] (initial stabilities for Again/Hard/Good/Easy).
 *
 * Uses numerical gradient with small perturbations. Runs for a limited number of
 * iterations to stay within cloud function time limits.
 */
function optimizeInitialStabilities(
  baseW: number[],
  retention: number,
  cardLogs: Map<string, ReviewLogRecord[]>
): number[] {
  const w = [...baseW];
  const lr = 0.05; // learning rate
  const epsilon = 0.01; // perturbation for numerical gradient
  const maxIter = 15; // keep iterations low for cloud function runtime

  // Bounds for w[0..3]: initial stability must be positive
  const minBounds = [0.01, 0.01, 0.1, 0.5];
  const maxBounds = [2.0, 5.0, 15.0, 60.0];

  let currentLoss = evaluateParams(w, retention, cardLogs);

  for (let iter = 0; iter < maxIter; iter++) {
    let improved = false;

    for (let i = 0; i < 4; i++) {
      const original = w[i];

      // Compute numerical gradient: (f(x+eps) - f(x-eps)) / (2*eps)
      w[i] = Math.min(maxBounds[i], original + epsilon);
      const lossPlus = evaluateParams(w, retention, cardLogs);

      w[i] = Math.max(minBounds[i], original - epsilon);
      const lossMinus = evaluateParams(w, retention, cardLogs);

      w[i] = original; // restore

      const gradient = (lossPlus - lossMinus) / (2 * epsilon);

      // Update with clamping
      const newVal = w[i] - lr * gradient;
      w[i] = Math.max(minBounds[i], Math.min(maxBounds[i], newVal));
    }

    const newLoss = evaluateParams(w, retention, cardLogs);
    if (newLoss < currentLoss - 1e-6) {
      currentLoss = newLoss;
      improved = true;
    }

    // Early stopping if no improvement
    if (!improved) break;
  }

  return w;
}

/**
 * Compute RMSE between predicted retention and actual outcome (0 or 1)
 * across all review log pairs.
 */
function computeRMSE(w: number[], retention: number, cardLogs: Map<string, ReviewLogRecord[]>): number {
  const params = generatorParameters({
    w: Array.from(w),
    maximum_interval: 180,
    request_retention: retention,
    enable_fuzz: false,
    enable_short_term: true
  });
  const testScheduler = fsrs(params);

  let sumSquaredError = 0;
  let count = 0;

  for (const [_cardId, cardLogList] of cardLogs) {
    if (cardLogList.length < 2) continue;

    let card = createEmptyCard(new Date(cardLogList[0].review));

    for (let i = 0; i < cardLogList.length; i++) {
      const log = cardLogList[i];
      const reviewDate = new Date(log.review);
      const grade = log.rating as Grade;

      if (grade < 1 || grade > 4) continue;

      if (card.state !== State.New && card.stability > 0 && log.elapsed_days > 0) {
        const predictedRetention = Math.exp((Math.log(0.9) * log.elapsed_days) / card.stability);
        const actual = grade > 1 ? 1 : 0;
        const error = predictedRetention - actual;
        sumSquaredError += error * error;
        count++;
      }

      try {
        const result: RecordLogItem = testScheduler.next(card, reviewDate, grade);
        card = result.card;
      } catch (_e) {
        break;
      }
    }
  }

  return count > 0 ? Math.sqrt(sumSquaredError / count) : 0;
}
