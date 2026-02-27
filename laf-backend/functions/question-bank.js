/**
 * 题库管理云函数
 * ✅ B024: 补充前端调用但后端缺失的 /question-bank 接口
 *
 * 支持操作：
 * - get: 获取题目列表（支持分类、难度、分页）
 * - random: 随机获取题目
 * - getByIds: 根据ID批量获取题目
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { verifyJWT } from './login';

const db = cloud.database();
const _ = db.command;

/** Escape user input for safe use in $regex (prevents ReDoS) */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = `qb_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const { action, userId, data } = ctx.body || {};

    if (!action) {
      return { code: 400, message: '缺少 action 参数', requestId };
    }

    // JWT 身份验证（题库查询允许匿名访问公共题目，但写操作需要认证）
    const authToken = ctx.headers?.['authorization'] || ctx.headers?.Authorization;
    if (authToken) {
      const rawToken = authToken.startsWith('Bearer ') ? authToken.slice(7) : authToken;
      const payload = verifyJWT(rawToken);
      if (!payload) {
        return { code: 401, message: 'token 无效或已过期，请重新登录', requestId };
      }
      if (userId && payload.userId && payload.userId !== userId) {
        return { code: 401, message: '身份验证失败', requestId };
      }
    }

    console.log(`[${requestId}] 题库查询: action=${action}`);

    switch (action) {
      case 'get':
        return await getQuestions(userId, data, requestId);
      case 'random':
        return await getRandomQuestions(data, requestId);
      case 'getByIds':
        return await getQuestionsByIds(data, requestId);
      default:
        return { code: 400, message: `未知的 action: ${action}`, requestId };
    }
  } catch (error) {
    console.error(`[${requestId}] 题库查询异常:`, error);
    return {
      code: 500,
      message: '服务异常，请稍后重试',
      requestId,
      duration: Date.now() - startTime
    };
  }
}

/**
 * 获取题目列表
 */
async function getQuestions(userId, data, requestId) {
  const { category, sub_category, difficulty, type, tags, page = 1, pageSize = 20, keyword } = data || {};

  const query = { is_active: true, review_status: 'approved' };

  // [R2-P1] NoSQL 注入防护：所有查询参数必须为 string，拒绝 object 类型（如 { "$ne": null }）
  if (category && typeof category === 'string') query.category = category;
  if (sub_category && typeof sub_category === 'string') query.sub_category = sub_category;
  if (difficulty && typeof difficulty === 'string') query.difficulty = difficulty;
  if (type && typeof type === 'string') query.type = type;
  if (tags && Array.isArray(tags) && tags.every((t) => typeof t === 'string')) query.tags = _.in(tags);
  if (keyword && typeof keyword === 'string') {
    query.$or = [
      { question: { $regex: escapeRegex(keyword), $options: 'i' } },
      { analysis: { $regex: escapeRegex(keyword), $options: 'i' } }
    ];
  }

  const safePageSize = Math.min(Math.max(1, parseInt(pageSize) || 20), 100);
  const safePage = Math.max(1, Math.min(parseInt(page) || 1, 100));
  const skip = (safePage - 1) * safePageSize;

  const [questions, countResult] = await Promise.all([
    db.collection('questions').where(query).orderBy('created_at', 'desc').skip(skip).limit(safePageSize).get(),
    db.collection('questions').where(query).count()
  ]);

  // 安全修复：剔除答案字段，防止客户端直接获取正确答案
  const safeList = (questions.data || []).map((q) => {
    const { answer, correct_answer, ...safeFields } = q;
    return safeFields;
  });

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

/**
 * 随机获取题目
 */
async function getRandomQuestions(data, requestId) {
  const { category, difficulty, count = 10 } = data || {};

  const query = { is_active: true, review_status: 'approved' };
  if (category && typeof category === 'string') query.category = category;
  if (difficulty && typeof difficulty === 'string') query.difficulty = difficulty;

  // 获取总数后随机跳过
  const countResult = await db.collection('questions').where(query).count();
  const total = countResult.total || 0;

  if (total === 0) {
    return { code: 0, success: true, data: [], requestId };
  }

  const safeCount = Math.max(1, Math.min(parseInt(count) || 10, 50));
  const limit = Math.min(safeCount, total, 50);
  const maxSkip = Math.max(0, total - limit);
  const skip = Math.floor(Math.random() * maxSkip);

  const result = await db.collection('questions').where(query).skip(skip).limit(limit).get();

  // 安全修复：剔除答案字段
  const safeData = (result.data || []).map((q) => {
    const { answer, correct_answer, ...safeFields } = q;
    return safeFields;
  });

  return {
    code: 0,
    success: true,
    data: safeData,
    requestId
  };
}

/**
 * 根据ID批量获取题目
 */
async function getQuestionsByIds(data, requestId) {
  const { ids } = data || {};

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return { code: 400, message: '缺少题目ID列表', requestId };
  }

  const safeIds = ids.slice(0, 100).filter((id) => typeof id === 'string' && id.length > 0);
  if (safeIds.length === 0) {
    return { code: 400, message: '题目ID列表不合法', requestId };
  }

  const result = await db
    .collection('questions')
    .where({ _id: _.in(safeIds) })
    .get();

  // 安全修复：剔除答案字段
  const safeData = (result.data || []).map((q) => {
    const { answer, correct_answer, ...safeFields } = q;
    return safeFields;
  });

  return {
    code: 0,
    success: true,
    data: safeData,
    requestId
  };
}
