/**
 * 题库管理云函数
 * 支持操作：get, random, getByIds
 */

import cloud from '@lafjs/cloud';
import { verifyJWT } from './login';
import { extractBearerToken } from './_shared/auth';

const db = cloud.database();
const _ = db.command;

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toSafeInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stripSensitiveQuestionFields(item) {
  if (!item || typeof item !== 'object') {
    return item;
  }

  const { answer, correct_answer, ...safeFields } = item;
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
    const rawHeaderToken = ctx.headers?.['authorization'] || ctx.headers?.Authorization;
    let authUserId = null;

    if (rawHeaderToken) {
      const rawToken = extractBearerToken(rawHeaderToken);
      const payload = verifyJWT(rawToken);
      if (!payload || !payload.userId) {
        return { code: 401, success: false, message: 'token 无效或已过期，请重新登录', requestId };
      }
      if (claimedUserId && payload.userId !== claimedUserId) {
        return { code: 403, success: false, message: '身份验证失败', requestId };
      }
      authUserId = payload.userId;
    } else if (!publicActions.has(action)) {
      return { code: 401, success: false, message: '缺少认证 token，请重新登录', requestId };
    }

    console.log(`[${requestId}] 题库查询: action=${action}`);

    switch (action) {
      case 'get':
        return await getQuestions(data, requestId, authUserId);
      case 'random':
        return await getRandomQuestions(data, requestId);
      case 'getByIds':
        return await getQuestionsByIds(data, requestId);

      default:
        return { code: 400, success: false, message: `未知的 action: ${action}`, requestId };
    }
  } catch (error) {
    console.error(`[${requestId}] 题库查询异常:`, error);
    return {
      code: 500,
      success: false,
      message: '服务异常，请稍后重试',
      requestId,
      duration: Date.now() - startTime
    };
  }
}

async function getQuestions(data, requestId, _authUserId) {
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

  const safeList = (questions.data || []).map(stripSensitiveQuestionFields);

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

async function getRandomQuestions(data, requestId) {
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
  const safeData = (result.data || []).map(stripSensitiveQuestionFields);

  return {
    code: 0,
    success: true,
    data: safeData,
    requestId
  };
}

async function getQuestionsByIds(data, requestId) {
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
  const safeData = (result.data || []).map(stripSensitiveQuestionFields);

  return {
    code: 0,
    success: true,
    data: safeData,
    requestId
  };
}
