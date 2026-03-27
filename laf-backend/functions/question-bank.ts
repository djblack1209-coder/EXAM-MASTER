/**
 * 题库管理云函数
 * 支持操作：get, random, getByIds
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import { checkRateLimitDistributed, createLogger } from './_shared/api-response.js';

const db = cloud.database();
const _ = db.command;
const logger = createLogger('[QuestionBank]');

const QUESTION_BANK_LIMIT_WINDOW_MS = 60 * 1000;
const QUESTION_BANK_LIMIT_MAX = 90;

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toSafeInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stripSensitiveQuestionFields(item, includeAnalysis = false) {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const { answer, correct_answer, analysis, ...safeFields } = item;
  if (includeAnalysis) {
    return { ...safeFields, analysis };
  }

  return safeFields;
}

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = `qb_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const { action, userId: claimedUserId, data } = ctx.body || {};

    if (!action) {
      return { code: 400, success: false, message: '缺少 action 参数', requestId };
    }

    const publicActions = new Set(['get', 'random', 'getByIds']);
    let authUserId = null;

    const authResult = requireAuth(ctx);
    if (!isAuthError(authResult)) {
      if (claimedUserId && authResult.userId !== claimedUserId) {
        return { code: 403, success: false, message: '身份验证失败', requestId };
      }
      authUserId = authResult.userId;
    } else if (!publicActions.has(action)) {
      return { code: 401, success: false, message: '缺少认证 token，请重新登录', requestId };
    }

    const clientIp =
      ctx.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      ctx.headers?.['x-real-ip'] ||
      ctx.socket?.remoteAddress ||
      'unknown';
    const rateLimitKey = `question-bank:${authUserId || clientIp}:${action}`;
    const rateLimit = await checkRateLimitDistributed(
      rateLimitKey,
      QUESTION_BANK_LIMIT_MAX,
      QUESTION_BANK_LIMIT_WINDOW_MS
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

    logger.info(`[${requestId}] 题库查询: action=${action}`);

    switch (action) {
      case 'get':
        return await getQuestions(data, requestId, Boolean(authUserId));
      case 'random':
        return await getRandomQuestions(data, requestId, Boolean(authUserId));
      case 'getByIds':
        return await getQuestionsByIds(data, requestId, Boolean(authUserId));
      case 'get_stats':
        return await getCategoryStats(requestId);
      case 'seed_preset':
        return await seedPresetQuestions(data, requestId);

      default:
        return { code: 400, success: false, message: `未知的 action: ${action}`, requestId };
    }
  } catch (error) {
    logger.error(`[${requestId}] 题库查询异常:`, error);
    return {
      code: 500,
      success: false,
      message: '服务异常，请稍后重试',
      requestId,
      duration: Date.now() - startTime
    };
  }
}

async function getQuestions(data, requestId, isAuthed) {
  const { category, sub_category, difficulty, type, tags, page = 1, pageSize = 20, keyword } = data || {};

  const query: Record<string, any> = {
    is_active: true,
    review_status: 'approved'
  };

  if (category && typeof category === 'string') query.category = category;
  if (sub_category && typeof sub_category === 'string') query.sub_category = sub_category;
  if (difficulty && typeof difficulty === 'string') query.difficulty = difficulty;
  if (type && typeof type === 'string') query.type = type;
  if (tags && Array.isArray(tags) && tags.every((tag) => typeof tag === 'string')) {
    query.tags = _.in(tags);
  }
  if (keyword && typeof keyword === 'string') {
    query.$or = [
      { question: { $regex: escapeRegex(keyword), $options: 'i' } },
      { analysis: { $regex: escapeRegex(keyword), $options: 'i' } }
    ];
  }

  const safePageSize = Math.min(Math.max(1, toSafeInt(pageSize, 20)), 100);
  const safePage = Math.max(1, Math.min(toSafeInt(page, 1), 100));
  const skip = (safePage - 1) * safePageSize;

  const [questions, countResult] = await Promise.all([
    db.collection('questions').where(query).orderBy('created_at', 'desc').skip(skip).limit(safePageSize).get(),
    db.collection('questions').where(query).count()
  ]);

  const safeList = (questions.data || []).map((item) => stripSensitiveQuestionFields(item, isAuthed));

  return {
    code: 0,
    success: true,
    data: {
      list: safeList,
      total: countResult.total || 0,
      page: safePage,
      pageSize: safePageSize,
      hasMore: skip + safePageSize < (countResult.total || 0)
    },
    requestId
  };
}

async function getRandomQuestions(data, requestId, isAuthed) {
  const { category, difficulty, count = 10 } = data || {};

  const query: Record<string, any> = {
    is_active: true,
    review_status: 'approved'
  };

  if (category && typeof category === 'string') query.category = category;
  if (difficulty && typeof difficulty === 'string') query.difficulty = difficulty;

  const countResult = await db.collection('questions').where(query).count();
  const total = countResult.total || 0;

  if (total === 0) {
    return { code: 0, success: true, data: [], requestId };
  }

  const safeCount = Math.max(1, Math.min(toSafeInt(count, 10), 50));
  const limit = Math.min(safeCount, total, 50);
  const maxSkip = Math.max(0, total - limit);
  const skip = Math.floor(Math.random() * (maxSkip + 1));

  const result = await db.collection('questions').where(query).skip(skip).limit(limit).get();
  const safeData = (result.data || []).map((item) => stripSensitiveQuestionFields(item, isAuthed));

  return {
    code: 0,
    success: true,
    data: safeData,
    requestId
  };
}

async function getQuestionsByIds(data, requestId, isAuthed) {
  const { ids } = data || {};

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return { code: 400, success: false, message: '缺少题目ID列表', requestId };
  }

  const safeIds = ids.slice(0, 100).filter((id) => typeof id === 'string' && id.length > 0);
  if (safeIds.length === 0) {
    return { code: 400, success: false, message: '题目ID列表不合法', requestId };
  }

  const result = await db
    .collection('questions')
    .where({ _id: _.in(safeIds) })
    .get();
  const safeData = (result.data || []).map((item) => stripSensitiveQuestionFields(item, isAuthed));

  return {
    code: 0,
    success: true,
    data: safeData,
    requestId
  };
}

/**
 * 获取题库分类统计（用于题库浏览页）
 */
async function getCategoryStats(requestId) {
  try {
    const result = await db
      .collection('questions')
      .aggregate()
      .match({ is_active: true, review_status: 'approved' })
      .group({
        _id: {
          category: { $ifNull: ['$category', '综合'] },
          sub_category: { $ifNull: ['$sub_category', null] },
          difficulty: { $ifNull: ['$difficulty', 'medium'] }
        },
        count: { $sum: 1 }
      })
      .end();

    // 聚合为前端友好的结构
    const categories = {};
    for (const item of result.data || []) {
      const cat = item._id.category;
      const sub = item._id.sub_category;
      const diff = item._id.difficulty;

      if (!categories[cat]) {
        categories[cat] = { category: cat, total: 0, sub_categories: {}, difficulty: { easy: 0, medium: 0, hard: 0 } };
      }
      categories[cat].total += item.count;
      categories[cat].difficulty[diff] = (categories[cat].difficulty[diff] || 0) + item.count;

      if (sub) {
        if (!categories[cat].sub_categories[sub]) {
          categories[cat].sub_categories[sub] = 0;
        }
        categories[cat].sub_categories[sub] += item.count;
      }
    }

    // 转为数组
    const stats = Object.values(categories).map((c: any) => ({
      ...c,
      sub_categories: Object.entries(c.sub_categories).map(([name, count]) => ({ name, count }))
    }));

    // 总数
    const total = stats.reduce((sum, c: any) => sum + c.total, 0);

    return {
      code: 0,
      success: true,
      data: { categories: stats, total },
      requestId
    };
  } catch (aggErr) {
    // 聚合不可用，降级
    const countResult = await db.collection('questions').where({ is_active: true }).count();
    return {
      code: 0,
      success: true,
      data: { categories: [], total: countResult.total || 0 },
      requestId
    };
  }
}

/**
 * 批量导入预置考研真题
 * 参数：data.questions — 题目数组
 */
async function seedPresetQuestions(data, requestId) {
  const questions = data?.questions;
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return { code: 400, success: false, message: '题目数组不能为空', requestId };
  }

  if (questions.length > 500) {
    return { code: 400, success: false, message: '单次最多导入 500 题', requestId };
  }

  const collection = db.collection('questions');
  const now = Date.now();
  let inserted = 0;
  let skipped = 0;

  const BATCH_SIZE = 10;
  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    const _results = await Promise.allSettled(
      batch.map(async (q) => {
        // 基本校验
        if (!q.question || !q.options || !q.answer) {
          skipped++;
          return;
        }

        // 去重：按题目内容前100字符
        const prefix = String(q.question).substring(0, 100);
        const existing = await collection
          .where({
            question: { $regex: `^${escapeRegex(prefix)}` }
          })
          .count();

        if (existing.total > 0) {
          skipped++;
          return;
        }

        await collection.add({
          question: String(q.question).substring(0, 5000),
          options: Array.isArray(q.options) ? q.options.slice(0, 10).map((o) => String(o).substring(0, 500)) : [],
          answer: String(q.answer).substring(0, 20).toUpperCase(),
          analysis: q.analysis ? String(q.analysis).substring(0, 10000) : '',
          category: q.category || '综合',
          sub_category: q.sub_category || null,
          type: q.type || '单选',
          difficulty: q.difficulty || 'medium',
          tags: Array.isArray(q.tags) ? q.tags.slice(0, 20) : [],
          knowledge_points: Array.isArray(q.knowledge_points) ? q.knowledge_points.slice(0, 10) : [],
          source: q.source || '预置真题',
          year: q.year || null,
          chapter: q.chapter || null,
          total_attempts: 0,
          correct_attempts: 0,
          is_active: true,
          is_premium: false,
          review_status: 'approved',
          created_at: now,
          updated_at: now
        });
        inserted++;
      })
    );
  }

  logger.info(`[${requestId}] 预置题目导入: 成功 ${inserted}, 跳过 ${skipped}`);

  return {
    code: 0,
    success: true,
    data: { inserted, skipped, total: questions.length },
    message: `导入完成: ${inserted} 题成功, ${skipped} 题跳过`,
    requestId
  };
}
