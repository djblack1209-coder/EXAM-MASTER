/**
 * 收藏管理云函数
 *
 * 功能：
 * 1. 添加收藏 (add)
 * 2. 获取收藏列表 (get)
 * 3. 删除收藏 (remove)
 * 4. 检查是否已收藏 (check)
 * 5. 批量操作 (batchAdd, batchRemove)
 * 6. 获取收藏分类统计 (getCategories)
 * 7. 按分类筛选收藏 (getByCategory)
 *
 * 请求参数：
 * - action: string (必填) - 操作类型
 * - userId: string (必填) - 用户ID
 * - data: object (可选) - 操作数据
 *
 * 返回格式：
 * { code: 0, success: true, data: {...}, message: 'success' }
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware';
import {
  logger,
  sanitizeString,
  validateUserId,
  validateAction,
  badRequest,
  unauthorized,
  serverError,
  generateRequestId,
  checkRateLimitDistributed
} from './_shared/api-response';

const db = cloud.database();
const _ = db.command;
const FAVORITE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const FAVORITE_RATE_LIMIT_MAX = 120;

function sanitizeFilterValue(value: unknown, maxLength = 50): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const sanitized = sanitizeString(value, maxLength);
  if (!sanitized) {
    return null;
  }

  return sanitized;
}

// ==================== 主入口 ====================
export default async function (ctx) {
  const startTime = Date.now();
  const requestId = generateRequestId('fav');

  logger.info(`[${requestId}] 收藏管理请求开始`);

  try {
    const { action, data } = ctx.body || {};

    // 参数校验
    if (!validateAction(action)) {
      return { ...badRequest('参数错误: action 不合法'), requestId };
    }

    // [R2-P0] JWT 认证：所有操作强制验证（读操作也涉及用户私有数据）
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return { ...authResult, requestId };
    }
    const userId = authResult.userId;

    if (!validateUserId(userId)) {
      return { ...unauthorized('用户未登录或 userId 不合法'), requestId };
    }

    const rateLimit = await checkRateLimitDistributed(
      `favorite-manager:${userId}:${action}`,
      FAVORITE_RATE_LIMIT_MAX,
      FAVORITE_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return {
        code: 429,
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        requestId
      };
    }

    logger.info(`[${requestId}] action: ${action}, userId: ${userId}`);

    // 路由到对应处理函数
    const handlers = {
      add: handleAdd,
      get: handleGet,
      remove: handleRemove,
      check: handleCheck,
      batchAdd: handleBatchAdd,
      batchRemove: handleBatchRemove,
      getCategories: handleGetCategories,
      getByCategory: handleGetByCategory
    };

    const handler = handlers[action];
    if (!handler) {
      return { ...badRequest(`不支持的操作: ${action}`), requestId };
    }

    // 执行操作
    const result = await handler(userId, data || {}, requestId);

    // 返回结果
    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] 操作完成，耗时: ${duration}ms`);

    return {
      ...result,
      requestId,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[${requestId}] 收藏管理异常:`, error);

    return { ...serverError('服务器内部错误'), requestId, duration };
  }
}

/**
 * 添加收藏
 */
async function handleAdd(userId: string, data: Record<string, unknown>, requestId: string) {
  const { questionId, question, options, answer, analysis, category, tags, source } = data;

  if (!questionId && !question) {
    return { code: 400, success: false, message: '参数错误: questionId 或 question 不能为空' };
  }

  const collection = db.collection('favorites');
  const now = Date.now();

  // [C-01 FIX] 对用户输入做 sanitization + injection 检查，防止 NoSQL Injection
  const safeQuestionId = typeof questionId === 'string' ? sanitizeString(questionId, 64) : null;
  const safeQuestion = typeof question === 'string' ? question.substring(0, 100) : '';

  // 检查是否已收藏
  const orConditions: Record<string, unknown>[] = [];
  if (safeQuestionId) orConditions.push({ question_id: safeQuestionId });
  if (safeQuestion) orConditions.push({ question_content: safeQuestion });

  if (orConditions.length === 0) {
    return { code: 400, success: false, message: '参数错误: questionId 或 question 不能为空' };
  }

  const existing = await collection
    .where({
      user_id: userId,
      $or: orConditions
    })
    .getOne();

  if (existing.data) {
    logger.info(`[${requestId}] 题目已收藏: ${existing.data._id}`);
    return {
      code: 0,
      success: true,
      id: existing.data._id,
      message: '题目已在收藏中',
      isExisting: true
    };
  }

  // 新增收藏
  const favorite = {
    user_id: userId,
    question_id: questionId || null,
    question_content: sanitizeString(String(question || ''), 2000),
    options: Array.isArray(options) ? options.map((opt) => sanitizeString(String(opt), 500)) : [],
    correct_answer: sanitizeString(String(answer || ''), 100),
    analysis: sanitizeString(String(analysis || ''), 5000),
    category: sanitizeString(String(category || '综合'), 50),
    tags: Array.isArray(tags) ? tags.slice(0, 20).map((t) => sanitizeString(String(t), 50)) : [],
    source: sanitizeString(String(source || 'manual'), 50),
    review_count: 0,
    last_review_time: null,
    created_at: now,
    updated_at: now
  };

  const result = await collection.add(favorite);

  logger.info(`[${requestId}] 新增收藏成功: ${result.id}`);

  return {
    code: 0,
    success: true,
    id: result.id,
    message: '收藏成功'
  };
}

/**
 * 获取收藏列表
 */
async function handleGet(userId: string, data: Record<string, unknown>, requestId: string) {
  const collection = db.collection('favorites');

  // 构建查询条件
  const query: Record<string, unknown> = { user_id: userId };

  // 可选筛选条件
  const safeCategory = sanitizeFilterValue(data.category, 50);
  if (safeCategory) {
    query.category = safeCategory;
  }
  const safeSource = sanitizeFilterValue(data.source, 50);
  if (safeSource) {
    query.source = safeSource;
  }

  // 分页参数
  const page = Math.max(1, Number.parseInt(String(data.page || 1), 10) || 1);
  const limit = Math.min(Math.max(1, Number.parseInt(String(data.limit || 50), 10) || 50), 100);
  const skip = (page - 1) * limit;

  // 排序 — [R2-P1] sortBy 白名单防注入
  const allowedSortFields = ['created_at', 'updated_at', 'category', 'question'];
  const sortBy = typeof data.sortBy === 'string' ? data.sortBy : '';
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
  const sortOrder = data.sortOrder === 'asc' ? 'asc' : 'desc';

  // 查询数据
  const [listRes, countRes] = await Promise.all([
    collection.where(query).orderBy(sortField, sortOrder).skip(skip).limit(limit).get(),
    collection.where(query).count()
  ]);

  logger.info(`[${requestId}] 查询收藏列表: ${listRes.data.length}/${countRes.total}`);

  return {
    code: 0,
    success: true,
    data: listRes.data,
    total: countRes.total,
    page,
    limit,
    hasMore: skip + listRes.data.length < countRes.total,
    message: '获取成功'
  };
}

/**
 * 删除收藏
 */
async function handleRemove(userId: string, data: Record<string, unknown>, requestId: string) {
  const { id, questionId } = data;

  if (!id && !questionId) {
    return { code: 400, success: false, message: '参数错误: id 或 questionId 不能为空' };
  }

  const collection = db.collection('favorites');

  // 构建查询条件
  const query: Record<string, unknown> = { user_id: userId };
  if (id) {
    query._id = id;
  } else if (questionId) {
    query.question_id = questionId;
  }

  // 验证权限并删除
  const favorite = await collection.where(query).getOne();

  if (!favorite.data) {
    logger.warn(`[${requestId}] 收藏不存在`);
    return { code: 0, success: true, deleted: 0, message: '收藏不存在' };
  }

  // 执行删除
  const result = await collection.doc(favorite.data._id).remove();

  logger.info(`[${requestId}] 删除收藏成功: ${favorite.data._id}`);

  return {
    code: 0,
    success: true,
    deleted: result.deleted || 1,
    message: '取消收藏成功'
  };
}

/**
 * 检查是否已收藏
 */
async function handleCheck(userId: string, data: Record<string, unknown>, _requestId: string) {
  const { questionId, questionIds } = data;

  const collection = db.collection('favorites');

  // 批量检查
  if (Array.isArray(questionIds) && questionIds.length > 0) {
    const favorites = await collection
      .where({
        user_id: userId,
        question_id: _.in(questionIds.slice(0, 100))
      })
      .field({ question_id: 1 })
      .get();

    const favoriteSet = new Set(favorites.data.map((f) => f.question_id));
    const result = questionIds.reduce((acc, qid) => {
      acc[qid] = favoriteSet.has(qid);
      return acc;
    }, {});

    return {
      code: 0,
      success: true,
      data: result,
      message: '检查完成'
    };
  }

  // 单个检查
  if (!questionId) {
    return { code: 400, success: false, message: '参数错误: questionId 不能为空' };
  }

  const favorite = await collection
    .where({
      user_id: userId,
      question_id: questionId
    })
    .getOne();

  return {
    code: 0,
    success: true,
    data: {
      isFavorite: !!favorite.data,
      favoriteId: favorite.data?._id || null
    },
    message: '检查完成'
  };
}

/**
 * 批量添加收藏
 * [H-09 FIX] 使用 _.in() 批量查询存在性，替代逐条 N+1 查询
 */
async function handleBatchAdd(userId: string, data: Record<string, unknown>, requestId: string) {
  const { questions } = data;

  if (!Array.isArray(questions) || questions.length === 0) {
    return { code: 400, success: false, message: '参数错误: questions 必须是非空数组' };
  }

  const collection = db.collection('favorites');
  const now = Date.now();
  const batch = (questions as Array<Record<string, unknown>>).slice(0, 50);

  // 批量查询已存在的收藏（一次 DB 操作替代 N 次）
  const questionIds = batch.map((q) => q.questionId || q.id).filter((id) => id != null);

  let existingSet = new Set<string>();
  if (questionIds.length > 0) {
    const existingRes = await collection
      .where({
        user_id: userId,
        question_id: _.in(questionIds)
      })
      .field({ question_id: 1 })
      .get();
    existingSet = new Set(existingRes.data.map((f) => f.question_id));
  }

  let added = 0;
  let skipped = 0;
  const results = [];

  // 收集需要新增的收藏记录
  const toAdd: { qId: string; favorite: Record<string, unknown> }[] = [];

  for (const q of batch) {
    const qId = (q.questionId || q.id) as string;
    if (qId && existingSet.has(qId)) {
      skipped++;
      results.push({ id: qId, success: true, skipped: true });
      continue;
    }

    toAdd.push({
      qId,
      favorite: {
        user_id: userId,
        question_id: qId || null,
        question_content: sanitizeString(String(q.question || q.content || ''), 2000),
        options: Array.isArray(q.options) ? q.options : [],
        correct_answer: sanitizeString(String(q.answer || q.correctAnswer || ''), 100),
        analysis: sanitizeString(String(q.analysis || q.desc || ''), 5000),
        category: sanitizeString(String(q.category || '综合'), 50),
        tags: Array.isArray(q.tags) ? (q.tags as unknown[]).slice(0, 20) : [],
        source: 'batch',
        review_count: 0,
        last_review_time: null,
        created_at: now,
        updated_at: now
      }
    });
  }

  // 并发写入，限制并发数为 10 避免过载
  const CONCURRENCY = 10;
  for (let i = 0; i < toAdd.length; i += CONCURRENCY) {
    const chunk = toAdd.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      chunk.map((item) => collection.add(item.favorite))
    );
    for (let j = 0; j < settled.length; j++) {
      const s = settled[j];
      const qId = chunk[j].qId;
      if (s.status === 'fulfilled') {
        added++;
        results.push({ id: qId, newId: s.value.id, success: true });
      } else {
        results.push({ id: qId, success: false, error: 'add_failed' });
      }
    }
  }

  logger.info(`[${requestId}] 批量添加收藏: 成功 ${added}, 跳过 ${skipped}`);

  return {
    code: 0,
    success: true,
    data: { added, skipped, results },
    message: `添加完成: ${added} 成功, ${skipped} 已存在`
  };
}

/**
 * 批量删除收藏
 */
async function handleBatchRemove(userId: string, data: Record<string, unknown>, requestId: string) {
  const { ids, questionIds } = data;

  const collection = db.collection('favorites');
  let deleted = 0;

  // 按收藏ID批量删除（单次查询代替逐条删除）
  if (Array.isArray(ids) && ids.length > 0) {
    try {
      const result = await collection
        .where({
          _id: _.in(ids.slice(0, 100)),
          user_id: userId
        })
        .remove();
      deleted += result.deleted || 0;
    } catch (e) {
      logger.warn(`[${requestId}] 批量按ID删除收藏失败`, e);
    }
  }

  // 按题目ID批量删除（单次查询代替逐条删除）
  if (Array.isArray(questionIds) && questionIds.length > 0) {
    try {
      const result = await collection
        .where({
          question_id: _.in(questionIds.slice(0, 100)),
          user_id: userId
        })
        .remove();
      deleted += result.deleted || 0;
    } catch (e) {
      logger.warn(`[${requestId}] 批量按题目ID删除收藏失败`, e);
    }
  }

  logger.info(`[${requestId}] 批量删除收藏: ${deleted} 条`);

  return {
    code: 0,
    success: true,
    data: { deleted },
    message: `删除完成: ${deleted} 条`
  };
}

/**
 * 获取收藏分类统计
 */
async function handleGetCategories(userId: string, _data: Record<string, unknown>, requestId: string) {
  const collection = db.collection('favorites');

  // 获取用户所有收藏
  const allFavorites = await collection
    .where({
      user_id: userId
    })
    .field({ category: 1, source: 1, created_at: 1 })
    .limit(2000)
    .get();

  // 按分类统计
  const categoryStats = {};
  const sourceStats = {};

  for (const fav of allFavorites.data) {
    const category = fav.category || '综合';
    const source = fav.source || 'manual';

    // 分类统计
    if (!categoryStats[category]) {
      categoryStats[category] = { category, count: 0 };
    }
    categoryStats[category].count++;

    // 来源统计
    if (!sourceStats[source]) {
      sourceStats[source] = { source, count: 0 };
    }
    sourceStats[source].count++;
  }

  const categories = Object.values(categoryStats).sort(
    (a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.count || 0) - Number(a.count || 0)
  );
  const sources = Object.values(sourceStats).sort(
    (a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.count || 0) - Number(a.count || 0)
  );

  logger.info(`[${requestId}] 获取分类统计: ${categories.length} 个分类`);

  return {
    code: 0,
    success: true,
    data: {
      categories,
      sources,
      total: allFavorites.data.length
    },
    message: '获取成功'
  };
}

/**
 * 按分类筛选收藏
 */
async function handleGetByCategory(userId: string, data: Record<string, unknown>, requestId: string) {
  const { category, page = 1, limit = 50 } = data;
  const safeCategory = sanitizeFilterValue(category, 50);

  if (!safeCategory) {
    return { code: 400, success: false, message: '参数错误: category 不能为空' };
  }

  const collection = db.collection('favorites');
  const safePage = Math.max(1, Number.parseInt(String(page || 1), 10) || 1);
  const safeLimit = Math.min(Math.max(1, Number.parseInt(String(limit || 50), 10) || 50), 100);
  const skip = (safePage - 1) * safeLimit;

  const [listRes, countRes] = await Promise.all([
    collection
      .where({ user_id: userId, category: safeCategory })
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(safeLimit)
      .get(),
    collection.where({ user_id: userId, category: safeCategory }).count()
  ]);

  logger.info(`[${requestId}] 按分类筛选: ${safeCategory}, ${listRes.data.length}/${countRes.total}`);

  return {
    code: 0,
    success: true,
    data: listRes.data,
    total: countRes.total,
    page: safePage,
    limit: safeLimit,
    hasMore: skip + listRes.data.length < countRes.total,
    message: '获取成功'
  };
}
