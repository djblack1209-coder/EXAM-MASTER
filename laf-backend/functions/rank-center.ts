/**
 * 排行榜中心云函数
 *
 * 功能：
 * 1. 更新用户分数 (update)
 * 2. 获取排行榜 (get)
 * 3. 获取用户排名 (getUserRank)
 *
 * 请求参数：
 * - action: string (必填) - 操作类型
 * - uid: string (必填) - 用户ID
 * - score: number (可选) - 分数
 * - nickName: string (可选) - 昵称
 * - avatarUrl: string (可选) - 头像
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware';
import {
  logger,
  sanitizeString,
  validateUserId,
  success,
  badRequest,
  tooManyRequests,
  serverError,
  generateRequestId,
  checkRateLimitDistributed
} from './_shared/api-response';

const db = cloud.database();
const _ = db.command;

// ==================== 缓存配置 ====================
const RANK_CACHE_TTL = 60 * 1000; // 排行榜缓存60秒
const ENABLE_RANK_CACHE = process.env.ENABLE_RANK_CACHE === 'true' && process.env.NODE_ENV !== 'production';
const rankCache = new Map<string, { data: unknown; expireAt: number }>();
const rateLimit = new Map<string, { expireAt: number }>();

function checkLocalUpdateRateLimit(
  key: string,
  cooldownMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const cached = rateLimit.get(key);

  if (cached && now < cached.expireAt) {
    return { allowed: false, remaining: 0, resetAt: cached.expireAt };
  }

  rateLimit.set(key, { expireAt: now + cooldownMs });
  return { allowed: true, remaining: 0, resetAt: now + cooldownMs };
}

/**
 * 获取缓存的排行榜数据
 */
function getCachedRank(cacheKey: string): unknown | null {
  if (!ENABLE_RANK_CACHE) return null;

  const cached = rankCache.get(cacheKey);
  if (cached && cached.expireAt > Date.now()) {
    return cached.data;
  }
  // 清理过期缓存
  if (cached) {
    rankCache.delete(cacheKey);
  }
  return null;
}

/**
 * 设置排行榜缓存
 */
function setCachedRank(cacheKey: string, data: unknown, ttl: number = RANK_CACHE_TTL): void {
  if (!ENABLE_RANK_CACHE) return;

  // 限制缓存大小，防止内存溢出
  if (rankCache.size > 100) {
    const now = Date.now();
    for (const [key, value] of rankCache.entries()) {
      if (value.expireAt < now) {
        rankCache.delete(key);
      }
    }
    // 如果还是太多，删除最旧的
    if (rankCache.size > 100) {
      const firstKey = rankCache.keys().next().value;
      rankCache.delete(firstKey);
    }
  }

  rankCache.set(cacheKey, {
    data,
    expireAt: Date.now() + ttl
  });
}

function validateScore(score: unknown): boolean {
  // 单次提交上限 200 分（PK 对战最多 10 题 × 20 分）
  return typeof score === 'number' && !isNaN(score) && score >= 0 && score <= 200;
}

// 排行榜类型
const RANK_TYPES = {
  DAILY: 'daily', // 日榜
  WEEKLY: 'weekly', // 周榜
  MONTHLY: 'monthly', // 月榜
  TOTAL: 'total' // 总榜
};

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = generateRequestId('rank');

  logger.info(`[${requestId}] 排行榜请求开始`);

  try {
    const { action, uid: bodyUid, score, nickName, avatarUrl, rankType, limit } = ctx.body || {};

    if (!action || typeof action !== 'string' || action.length > 50) {
      return { ...badRequest('参数错误: action 不合法'), requestId };
    }

    // JWT 认证：update 操作强制验证
    let uid = bodyUid;

    if (action === 'update') {
      const authResult = requireAuth(ctx);
      if (isAuthError(authResult)) {
        return { ...authResult, requestId };
      }
      uid = authResult.userId;
    } else {
      // 读操作：可选认证，有 token 则使用 token 中的 userId
      const authResult = requireAuth(ctx);
      if (!isAuthError(authResult)) {
        uid = authResult.userId;
      }
    }

    logger.info(`[${requestId}] action: ${action}, uid: ${uid}`);

    const handlers = {
      update: handleUpdate,
      get: handleGet,
      getUserRank: handleGetUserRank
    };

    const handler = handlers[action];
    if (!handler) {
      return { ...badRequest(`不支持的操作: ${action}`), requestId };
    }

    const result = await handler({ uid, score, nickName, avatarUrl, rankType, limit }, requestId);

    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] 操作完成，耗时: ${duration}ms`);

    return { ...result, requestId, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[${requestId}] 排行榜异常:`, error);

    return { ...serverError('服务器内部错误'), requestId, duration };
  }
}

/**
 * 更新用户分数
 */
async function handleUpdate(params, requestId) {
  const { uid, score, nickName, avatarUrl } = params;

  if (!validateUserId(uid)) {
    return badRequest('用户ID不合法');
  }

  if (!validateScore(score)) {
    return badRequest('分数必须是0-200之间的数字（单局上限200分）');
  }

  // 频率限制：同一用户 30 秒内只能提交一次分数（分布式优先，失败降级本地）
  const rateLimitKey = `rank_update:${uid}`;
  const rateResult = await checkRateLimitDistributed(rateLimitKey, 1, 30000, () =>
    checkLocalUpdateRateLimit(rateLimitKey, 30000)
  );
  if (!rateResult.allowed) {
    return tooManyRequests('操作过于频繁，请稍后再试');
  }

  const rankCollection = db.collection('rankings');
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();
  const monthStart = getMonthStart();

  // 更新或创建排行榜记录
  // [R2-P1] 使用条件式原子更新，避免 read-then-write 竞态丢分
  const existing = await rankCollection.where({ uid }).getOne();

  if (existing.data) {
    // 先尝试：日/周/月都未翻转的常见情况（单次原子 _.inc）
    const samePeriodResult = await rankCollection
      .where({
        _id: existing.data._id,
        daily_date: today,
        weekly_start: weekStart,
        monthly_start: monthStart
      })
      .update({
        total_score: _.inc(score),
        daily_score: _.inc(score),
        weekly_score: _.inc(score),
        monthly_score: _.inc(score),
        updated_at: now,
        ...(nickName ? { nick_name: sanitizeString(nickName, 32) } : {}),
        ...(avatarUrl ? { avatar_url: sanitizeString(avatarUrl, 500) } : {})
      });

    if (!samePeriodResult.updated) {
      // 有周期翻转，需要逐字段处理（低频路径，每天/周/月最多触发一次）
      const updateData: Record<string, unknown> = {
        total_score: _.inc(score),
        updated_at: now
      };

      if (existing.data.daily_date === today) {
        updateData.daily_score = _.inc(score);
      } else {
        updateData.daily_score = score;
        updateData.daily_date = today;
      }

      if (existing.data.weekly_start === weekStart) {
        updateData.weekly_score = _.inc(score);
      } else {
        updateData.weekly_score = score;
        updateData.weekly_start = weekStart;
      }

      if (existing.data.monthly_start === monthStart) {
        updateData.monthly_score = _.inc(score);
      } else {
        updateData.monthly_score = score;
        updateData.monthly_start = monthStart;
      }

      if (nickName) updateData.nick_name = sanitizeString(nickName, 32);
      if (avatarUrl) updateData.avatar_url = sanitizeString(avatarUrl, 500);

      // 条件更新：仅当周期字段仍是读取时的旧值才执行翻转，避免并发覆盖
      const flipUpdateResult = await rankCollection
        .where({
          _id: existing.data._id,
          daily_date: existing.data.daily_date,
          weekly_start: existing.data.weekly_start,
          monthly_start: existing.data.monthly_start
        })
        .update(updateData);

      if (!flipUpdateResult.updated) {
        // 说明并发请求已先完成翻转，这里补做一次纯增量，避免丢分
        await rankCollection
          .where({
            _id: existing.data._id,
            daily_date: today,
            weekly_start: weekStart,
            monthly_start: monthStart
          })
          .update({
            total_score: _.inc(score),
            daily_score: _.inc(score),
            weekly_score: _.inc(score),
            monthly_score: _.inc(score),
            updated_at: now,
            ...(nickName ? { nick_name: sanitizeString(nickName, 32) } : {}),
            ...(avatarUrl ? { avatar_url: sanitizeString(avatarUrl, 500) } : {})
          });
      }
    }

    logger.info(`[${requestId}] 更新排行榜分数: ${uid}, +${score}`);
  } else {
    // 创建新记录
    await rankCollection.add({
      uid,
      nick_name: sanitizeString(nickName || '考研学子', 32),
      avatar_url: sanitizeString(avatarUrl || '', 500),
      total_score: score,
      daily_score: score,
      daily_date: today,
      weekly_score: score,
      weekly_start: weekStart,
      monthly_score: score,
      monthly_start: monthStart,
      created_at: now,
      updated_at: now
    });

    logger.info(`[${requestId}] 创建排行榜记录: ${uid}, ${score}`);
  }

  return success(undefined, '分数更新成功');
}

/**
 * 获取排行榜（带缓存优化）
 */
async function handleGet(params, requestId) {
  const { rankType = RANK_TYPES.DAILY, limit = 50 } = params;
  const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), 100);

  // 构建缓存键
  const cacheKey = `rank_${rankType}_${safeLimit}`;

  // 尝试从缓存获取
  const cachedData = getCachedRank(cacheKey);
  if (cachedData) {
    logger.info(`[${requestId}] 排行榜缓存命中: ${rankType}`);
    return {
      ...success(cachedData, '获取成功'),
      rankType,
      cached: true
    };
  }

  const rankCollection = db.collection('rankings');

  // 确定排序字段
  let scoreField = 'daily_score';
  let dateField = 'daily_date';
  let dateValue = new Date().toISOString().split('T')[0];

  switch (rankType) {
    case RANK_TYPES.WEEKLY:
      scoreField = 'weekly_score';
      dateField = 'weekly_start';
      dateValue = getWeekStart();
      break;
    case RANK_TYPES.MONTHLY:
      scoreField = 'monthly_score';
      dateField = 'monthly_start';
      dateValue = getMonthStart();
      break;
    case RANK_TYPES.TOTAL:
      scoreField = 'total_score';
      dateField = null;
      break;
  }

  // 构建查询
  let query: Record<string, unknown> = {};
  if (dateField) {
    query[dateField] = dateValue;
    query[scoreField] = _.gt(0);
  } else {
    query[scoreField] = _.gt(0);
  }

  const result = await rankCollection
    .where(query)
    .orderBy(scoreField, 'desc')
    .limit(safeLimit)
    .field({
      uid: 1,
      nick_name: 1,
      avatar_url: 1,
      [scoreField]: 1
    })
    .get();

  // 添加排名
  const rankList = result.data.map((item, index) => ({
    rank: index + 1,
    uid: item.uid,
    nickName: item.nick_name,
    avatarUrl: item.avatar_url,
    score: item[scoreField]
  }));

  // 写入缓存
  setCachedRank(cacheKey, rankList);

  logger.info(`[${requestId}] 获取排行榜: ${rankType}, ${rankList.length} 条`);

  return {
    ...success(rankList, '获取成功'),
    rankType,
    cached: false
  };
}

/**
 * 获取用户排名（带缓存优化）
 */
async function handleGetUserRank(params, requestId) {
  const { uid, rankType = RANK_TYPES.DAILY } = params;

  if (!validateUserId(uid)) {
    return badRequest('用户ID不合法');
  }

  const rankCollection = db.collection('rankings');

  // 获取用户记录
  const userRecord = await rankCollection.where({ uid }).getOne();

  if (!userRecord.data) {
    return success({ rank: -1, score: 0 }, '用户暂无排名');
  }

  // 确定分数字段和日期字段
  let scoreField = 'daily_score';
  let dateField = 'daily_date';
  let dateValue = new Date().toISOString().split('T')[0];

  switch (rankType) {
    case RANK_TYPES.WEEKLY:
      scoreField = 'weekly_score';
      dateField = 'weekly_start';
      dateValue = getWeekStart();
      break;
    case RANK_TYPES.MONTHLY:
      scoreField = 'monthly_score';
      dateField = 'monthly_start';
      dateValue = getMonthStart();
      break;
    case RANK_TYPES.TOTAL:
      scoreField = 'total_score';
      dateField = null;
      break;
  }

  const userScore = userRecord.data[scoreField] || 0;

  // 检查用户数据是否在当前周期内
  if (dateField && userRecord.data[dateField] !== dateValue) {
    return {
      ...success({ rank: -1, score: 0 }, '用户在当前周期暂无排名'),
      rankType
    };
  }

  // 尝试从缓存获取排名（用户排名缓存时间较短）
  const cacheKey = `user_rank_${uid}_${rankType}`;
  const cachedRank = getCachedRank(cacheKey);
  if (cachedRank) {
    logger.info(`[${requestId}] 用户排名缓存命中: ${uid}`);
    return {
      ...success(cachedRank, '获取成功'),
      rankType,
      cached: true
    };
  }

  // 计算排名（比当前用户分数高的人数 + 1）
  // 优化：只统计当前周期内的数据
  let countQuery: Record<string, unknown> = {
    [scoreField]: _.gt(userScore)
  };
  if (dateField) {
    countQuery[dateField] = dateValue;
  }

  const higherCount = await rankCollection.where(countQuery).count();

  const rank = higherCount.total + 1;

  const rankData = {
    rank,
    score: userScore,
    nickName: userRecord.data.nick_name,
    avatarUrl: userRecord.data.avatar_url
  };

  // 缓存用户排名（30秒）
  setCachedRank(cacheKey, rankData, 30 * 1000);

  logger.info(`[${requestId}] 获取用户排名: ${uid}, 第 ${rank} 名, ${userScore} 分`);

  return {
    ...success(rankData, '获取成功'),
    rankType,
    cached: false
  };
}

/**
 * 获取本周开始日期
 */
function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

/**
 * 获取本月开始日期
 */
function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}
