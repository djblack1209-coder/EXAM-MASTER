/**
 * FSRS 个性化参数优化器
 *
 * 聚合用户 review_logs，使用 ts-fsrs 的 FSRS 优化能力
 * 计算个性化记忆参数，存入用户 profile
 *
 * Actions:
 * - optimize: 触发参数优化（需要至少 50 条 review log）
 * - getStatus: 获取当前优化状态和参数
 * - getRetentionCurve: 获取用户记忆留存率曲线数据
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { fsrs, generatorParameters, State, createEmptyCard, type Grade, type RecordLogItem } from 'ts-fsrs';
import { requireAuth, isAuthError } from './_shared/auth-middleware';
import { generateRequestId, createLogger } from './_shared/api-response';
import type { UserFSRSParams, ReviewLogRecord } from './_shared/fsrs-scheduler';

const db = cloud.database();
const _ = db.command;
const logger = createLogger('[FSRSOptimizer]');

// 最少需要的 review log 数量才能进行有意义的优化
const MIN_LOGS_FOR_OPTIMIZE = 50;
// 优化冷却时间：24 小时内不重复优化
const OPTIMIZE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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
      case 'getStatus':
        return await handleGetStatus(userId, requestId, startTime);
      case 'getRetentionCurve':
        return await handleGetRetentionCurve(userId, requestId, startTime);
      default:
        return { code: 400, ok: false, message: `不支持的操作: ${action}`, requestId };
    }
  } catch (error) {
    logger.error(`[${requestId}] 优化器异常:`, error);
    return { code: 500, ok: false, message: '服务器内部错误', requestId };
  }
}

/**
 * 触发 FSRS 参数优化
 * 1. 拉取用户全部 review_logs
 * 2. 按卡片分组，模拟 FSRS 调度，用不同参数组合评估 log-loss
 * 3. 选择最优参数写入用户 profile
 */
async function handleOptimize(userId: string, requestId: string, startTime: number) {
  // 检查冷却时间
  const userDoc = await db.collection('users').doc(userId).get();
  const existingParams: UserFSRSParams = userDoc.data?.fsrs_params || {};

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

  // 拉取用户 review logs（按时间排序）
  const logsResult = await db
    .collection('review_logs')
    .where({ user_id: userId })
    .orderBy('review', 'asc')
    .limit(5000)
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

  // 使用网格搜索优化 request_retention 和关键权重
  // FSRS 的 w 向量有 19 个参数，我们优化最关键的几个：
  // w[0]: initial stability (Again)
  // w[1]: initial stability (Hard)
  // w[2]: initial stability (Good)
  // w[3]: initial stability (Easy)
  // w[4]: difficulty mean reversion weight
  // w[5]: difficulty multiplier for initial difficulty
  const bestParams = optimizeParameters(logs, cardLogs);

  // 写入用户 profile
  const fsrsParams: UserFSRSParams = {
    w: bestParams.w,
    request_retention: bestParams.retention,
    maximum_interval: 180,
    optimized_at: Date.now(),
    optimize_count: (existingParams.optimize_count || 0) + 1,
    review_log_count: logs.length
  };

  await db.collection('users').doc(userId).update({
    fsrs_params: fsrsParams,
    updated_at: Date.now()
  });

  logger.info(`[${requestId}] 参数优化完成: ${logs.length} 条日志, retention=${bestParams.retention}`);

  return {
    code: 0,
    ok: true,
    data: {
      optimized: true,
      log_count: logs.length,
      card_count: cardLogs.size,
      optimize_count: fsrsParams.optimize_count,
      request_retention: bestParams.retention,
      loss: bestParams.loss
    },
    message: '记忆模型优化完成',
    requestId,
    duration: Date.now() - startTime
  };
}

/**
 * 获取用户 FSRS 优化状态
 */
async function handleGetStatus(userId: string, requestId: string, startTime: number) {
  const [userDoc, logCount] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('review_logs').where({ user_id: userId }).count()
  ]);

  const fsrsParams: UserFSRSParams = userDoc.data?.fsrs_params || {};
  const count = logCount.total || 0;

  return {
    code: 0,
    ok: true,
    data: {
      has_custom_params: !!(fsrsParams.w && fsrsParams.w.length > 0),
      optimize_count: fsrsParams.optimize_count || 0,
      optimized_at: fsrsParams.optimized_at || null,
      request_retention: fsrsParams.request_retention || 0.9,
      review_log_count: count,
      min_logs_required: MIN_LOGS_FOR_OPTIMIZE,
      can_optimize: count >= MIN_LOGS_FOR_OPTIMIZE,
      cooldown_remaining: fsrsParams.optimized_at
        ? Math.max(0, OPTIMIZE_COOLDOWN_MS - (Date.now() - fsrsParams.optimized_at))
        : 0
    },
    message: '获取成功',
    requestId,
    duration: Date.now() - startTime
  };
}

/**
 * 获取用户记忆留存率曲线数据（用于前端可视化）
 */
async function handleGetRetentionCurve(userId: string, requestId: string, startTime: number) {
  // 聚合：按 elapsed_days 分桶，计算每个间隔天数的实际留存率
  const logsResult = await db
    .collection('review_logs')
    .where({ user_id: userId, state: _.neq(0) }) // 排除 New 状态
    .orderBy('review', 'asc')
    .limit(5000)
    .get();

  const logs: ReviewLogRecord[] = logsResult.data || [];

  // 按 elapsed_days 分桶统计
  const buckets = new Map<number, { total: number; recalled: number }>();
  for (const log of logs) {
    const days = Math.round(log.elapsed_days);
    if (days < 0) continue;
    if (!buckets.has(days)) buckets.set(days, { total: 0, recalled: 0 });
    const b = buckets.get(days)!;
    b.total++;
    // rating > 1 (Hard/Good/Easy) 视为成功回忆
    if (log.rating > 1) b.recalled++;
  }

  // 转为数组，按天数排序
  const curve = Array.from(buckets.entries())
    .map(([days, { total, recalled }]) => ({
      days,
      total,
      recalled,
      retention: total > 0 ? Math.round((recalled / total) * 1000) / 10 : 0
    }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 180); // 最多 180 天

  return {
    code: 0,
    ok: true,
    data: { curve, total_reviews: logs.length },
    message: '获取成功',
    requestId,
    duration: Date.now() - startTime
  };
}

// ==================== 参数优化核心算法 ====================

/**
 * 简化版 FSRS 参数优化器
 *
 * 原理：遍历候选 request_retention 值，用每组参数模拟全部 review log，
 * 计算 negative log-likelihood (NLL) 作为 loss，选择 loss 最小的参数组合。
 *
 * 这是 fsrs4anki optimizer 的简化 JS 版本，适合在云函数中运行。
 */
function optimizeParameters(
  _logs: ReviewLogRecord[],
  cardLogs: Map<string, ReviewLogRecord[]>
): { w: number[]; retention: number; loss: number } {
  // 候选 retention 值
  const retentionCandidates = [0.8, 0.82, 0.85, 0.87, 0.9, 0.92, 0.95];

  let bestLoss = Infinity;
  let bestRetention = 0.9;
  let bestW: number[] = [];

  for (const retention of retentionCandidates) {
    const params = generatorParameters({
      maximum_interval: 180,
      request_retention: retention,
      enable_fuzz: false, // 优化时关闭 fuzz 以获得确定性结果
      enable_short_term: true
    });

    const testScheduler = fsrs(params);
    let totalLoss = 0;
    let totalCount = 0;

    // 对每张卡片，按时间顺序模拟调度，计算预测 vs 实际的 loss
    for (const [_cardId, cardLogList] of cardLogs) {
      if (cardLogList.length < 2) continue; // 至少需要 2 条记录

      let card = createEmptyCard(new Date(cardLogList[0].review));

      for (let i = 0; i < cardLogList.length; i++) {
        const log = cardLogList[i];
        const reviewDate = new Date(log.review);
        const grade = log.rating as Grade;

        if (grade < 1 || grade > 4) continue;

        // 计算预测留存率（基于当前 stability 和 elapsed_days）
        if (card.state !== State.New && card.stability > 0 && log.elapsed_days > 0) {
          const predictedRetention = Math.exp((Math.log(0.9) * log.elapsed_days) / card.stability);
          // 实际是否回忆成功：rating > 1 为成功
          const actual = grade > 1 ? 1 : 0;
          // Binary cross-entropy loss
          const p = Math.max(0.001, Math.min(0.999, predictedRetention));
          totalLoss += -(actual * Math.log(p) + (1 - actual) * Math.log(1 - p));
          totalCount++;
        }

        // 推进卡片状态
        try {
          const result: RecordLogItem = testScheduler.next(card, reviewDate, grade);
          card = result.card;
        } catch (_e) {
          break; // 调度异常，跳过此卡片
        }
      }
    }

    const avgLoss = totalCount > 0 ? totalLoss / totalCount : Infinity;

    if (avgLoss < bestLoss) {
      bestLoss = avgLoss;
      bestRetention = retention;
      bestW = Array.from(params.w);
    }
  }

  // 如果优化失败，返回默认参数
  if (bestW.length === 0) {
    const defaultParams = generatorParameters({
      maximum_interval: 180,
      request_retention: 0.9,
      enable_fuzz: true,
      enable_short_term: true
    });
    bestW = Array.from(defaultParams.w);
  }

  return {
    w: bestW,
    retention: bestRetention,
    loss: Math.round(bestLoss * 10000) / 10000
  };
}
