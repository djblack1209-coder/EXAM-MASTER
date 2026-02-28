/**
 * 用户资料管理云函数
 *
 * ⚠️ [未启用] 此函数已实现但尚未接入前端。
 * 前端资料相关功能通过 proxy-ai 的 material_understand action 实现，
 * 未直接调用 /material-manager 端点。待后续版本整合。
 *
 * 功能：
 * 1. 上传资料记录管理
 * 2. AI生成题目存储
 * 3. 用户题库同步
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { verifyJWT, extractBearerToken } from './_shared/auth';
import { createLogger, checkRateLimitDistributed } from './_shared/api-response';

const db = cloud.database();
const logger = createLogger('[MaterialManager]');
const MATERIAL_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MATERIAL_RATE_LIMIT_MAX = 60;
const ALLOWED_ACTIONS = new Set([
  'save_upload_record',
  'get_upload_records',
  'delete_upload_record',
  'save_questions',
  'get_questions',
  'delete_questions',
  'sync_questions',
  'get_stats'
]);

function extractToken(ctx) {
  const authHeader = ctx?.headers?.authorization || ctx?.headers?.Authorization;
  return extractBearerToken(authHeader);
}

function toSafeString(value, maxLength = 200) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function toPositiveInt(value, fallback, max) {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = `material_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const { action, userId: requestUserId, data } = ctx.body || {};

    // 参数校验
    if (!action || typeof action !== 'string') {
      return { code: 400, success: false, message: '缺少 action 参数', requestId };
    }
    if (!ALLOWED_ACTIONS.has(action)) {
      return { code: 400, success: false, message: `未知的 action: ${action}`, requestId };
    }

    // JWT 身份验证
    const rawToken = extractToken(ctx);
    if (!rawToken) {
      return { code: 401, success: false, message: '缺少认证 token，请重新登录', requestId };
    }
    const payload = verifyJWT(rawToken);
    if (!payload || !payload.userId) {
      return { code: 401, success: false, message: 'token 无效或已过期，请重新登录', requestId };
    }
    const userId = payload.userId;

    if (requestUserId && requestUserId !== userId) {
      logger.warn(`[${requestId}] 检测到 userId 不匹配，已使用 token 用户ID`);
    }

    // 限流
    const rateLimit = await checkRateLimitDistributed(
      `material-manager:${userId}:${action}`,
      MATERIAL_RATE_LIMIT_MAX,
      MATERIAL_RATE_LIMIT_WINDOW_MS
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

    logger.info(`[${requestId}] 用户资料管理: action=${action}, userId=${userId}`);

    switch (action) {
      // ==================== 资料上传记录 ====================
      case 'save_upload_record':
        return await saveUploadRecord(userId, data, requestId);

      case 'get_upload_records':
        return await getUploadRecords(userId, data, requestId);

      case 'delete_upload_record':
        return await deleteUploadRecord(userId, data, requestId);

      // ==================== AI生成题目存储 ====================
      case 'save_questions':
        return await saveQuestions(userId, data, requestId);

      case 'get_questions':
        return await getQuestions(userId, data, requestId);

      case 'delete_questions':
        return await deleteQuestions(userId, data, requestId);

      case 'sync_questions':
        return await syncQuestions(userId, data, requestId);

      // ==================== 题库统计 ====================
      case 'get_stats':
        return await getQuestionStats(userId, requestId);
    }
  } catch (error) {
    logger.error(`[${requestId}] 用户资料管理异常:`, error);
    return {
      code: 500,
      success: false,
      message: '服务异常，请稍后重试',
      requestId,
      duration: Date.now() - startTime
    };
  }
}

/**
 * 保存上传记录
 */
async function saveUploadRecord(userId, data, requestId) {
  const { name, size, source, fileType, contentPreview } = data || {};
  const safeName = toSafeString(name, 200);

  if (!safeName) {
    return { code: 400, success: false, message: '缺少文件名', requestId };
  }

  const record = {
    userId,
    name: safeName,
    size: Math.max(0, Number(size) || 0),
    source: toSafeString(source, 50) || 'local',
    fileType: toSafeString(fileType, 50) || 'unknown',
    contentPreview: toSafeString(contentPreview, 500),
    status: 'ready',
    questionCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  const result = await db.collection('user_materials').add(record);

  logger.info(`[${requestId}] 保存上传记录成功: ${result.id}`);

  return {
    code: 0,
    message: '保存成功',
    data: { id: result.id, ...record },
    requestId
  };
}

/**
 * 获取上传记录列表
 */
async function getUploadRecords(userId, data, requestId) {
  const { page = 1, pageSize = 20 } = data || {};

  const safePageSize = Math.min(Math.max(1, parseInt(pageSize) || 20), 100);
  const skip = (page - 1) * safePageSize;

  const [records, countResult] = await Promise.all([
    db.collection('user_materials').where({ userId }).orderBy('createdAt', 'desc').skip(skip).limit(safePageSize).get(),
    db.collection('user_materials').where({ userId }).count()
  ]);

  return {
    code: 0,
    data: {
      list: records.data || [],
      total: countResult.total || 0,
      page,
      pageSize: safePageSize
    },
    requestId
  };
}

/**
 * 删除上传记录
 */
async function deleteUploadRecord(userId, data, requestId) {
  const { recordId } = data || {};

  if (!recordId) {
    return { code: 400, success: false, message: '缺少记录ID', requestId };
  }

  // 验证记录归属
  const record = await db.collection('user_materials').where({ _id: recordId, userId }).getOne();

  if (!record.data) {
    return { code: 404, success: false, message: '记录不存在', requestId };
  }

  // 删除记录
  await db.collection('user_materials').doc(recordId).remove();

  // 同时删除关联的题目
  await db.collection('user_questions').where({ userId, materialId: recordId }).remove();

  return { code: 0, message: '删除成功', requestId };
}

/**
 * 保存AI生成的题目
 */
async function saveQuestions(userId, data, requestId) {
  const { questions, materialId, materialName } = data || {};

  if (!Array.isArray(questions) || questions.length === 0) {
    return { code: 400, success: false, message: '题目数据无效', requestId };
  }

  // 为每道题添加元数据
  const questionsToSave = questions.map((q) => ({
    userId,
    materialId: materialId || null,
    materialName: materialName || '未知来源',
    question: q.question || '',
    options: q.options || [],
    answer: q.answer || '',
    analysis: q.analysis || '',
    difficulty: q.difficulty || 3,
    tags: q.tags || [],
    source: 'ai_generated',
    practiceCount: 0,
    correctCount: 0,
    lastPracticeAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }));

  // 批量插入
  const result = await db.collection('user_questions').add(questionsToSave);

  // 更新资料记录的题目数量（含所有权校验）
  if (materialId) {
    const material = await db.collection('user_materials').where({ _id: materialId, userId }).getOne();

    if (material.data) {
      await db
        .collection('user_materials')
        .doc(materialId)
        .update({
          questionCount: (material.data.questionCount || 0) + questions.length,
          status: 'completed',
          updatedAt: Date.now()
        });
    }
  }

  logger.info(`[${requestId}] 保存题目成功: ${questions.length} 道`);

  return {
    code: 0,
    message: '保存成功',
    data: {
      savedCount: questions.length,
      ids: Array.isArray(result.ids) ? result.ids : [result.id]
    },
    requestId
  };
}

/**
 * 获取用户题目
 */
async function getQuestions(userId, data, requestId) {
  const { page = 1, pageSize = 20, materialId, tags, difficulty, onlyWrong, random } = data || {};

  const safePageSize = toPositiveInt(pageSize, 20, 100);
  const safePage = toPositiveInt(page, 1, 1000000);
  const safeMaterialId = toSafeString(materialId, 64);
  const safeDifficulty = typeof difficulty === 'string' || typeof difficulty === 'number' ? String(difficulty) : '';
  const safeTags = Array.isArray(tags)
    ? tags
        .map((tag) => toSafeString(tag, 40))
        .filter(Boolean)
        .slice(0, 20)
    : [];

  // 构建查询条件
  const query = { userId };

  if (safeMaterialId) {
    query.materialId = safeMaterialId;
  }

  if (safeTags.length > 0) {
    query.tags = { $in: safeTags };
  }

  if (safeDifficulty) {
    query.difficulty = safeDifficulty;
  }

  if (onlyWrong) {
    // 只返回做错过的题目
    query.$expr = {
      $gt: ['$practiceCount', '$correctCount']
    };
  }

  // 随机抽题
  if (random) {
    const safeCount = toPositiveInt(data?.count, 10, 50);
    const result = await db.collection('user_questions').aggregate().match(query).sample({ size: safeCount }).end();

    return {
      code: 0,
      data: {
        list: result.data || [],
        total: result.data?.length || 0
      },
      requestId
    };
  }

  // 分页查询
  const skip = (safePage - 1) * safePageSize;

  const [questions, countResult] = await Promise.all([
    db.collection('user_questions').where(query).orderBy('createdAt', 'desc').skip(skip).limit(safePageSize).get(),
    db.collection('user_questions').where(query).count()
  ]);

  return {
    code: 0,
    data: {
      list: questions.data || [],
      total: countResult.total || 0,
      page: safePage,
      pageSize: safePageSize
    },
    requestId
  };
}

/**
 * 删除题目
 */
async function deleteQuestions(userId, data, requestId) {
  const { questionIds, materialId, deleteAll } = data || {};
  const safeMaterialId = toSafeString(materialId, 64);
  const safeQuestionIds = Array.isArray(questionIds)
    ? questionIds
        .map((id) => toSafeString(id, 64))
        .filter(Boolean)
        .slice(0, 200)
    : [];

  if (deleteAll) {
    // 删除用户所有题目
    const result = await db.collection('user_questions').where({ userId }).remove();

    return {
      code: 0,
      message: '已清空所有题目',
      data: { deletedCount: result.deleted },
      requestId
    };
  }

  if (safeMaterialId) {
    // 删除某个资料的所有题目
    const result = await db.collection('user_questions').where({ userId, materialId: safeMaterialId }).remove();

    return {
      code: 0,
      message: '删除成功',
      data: { deletedCount: result.deleted },
      requestId
    };
  }

  if (safeQuestionIds.length > 0) {
    // 删除指定题目
    const result = await db
      .collection('user_questions')
      .where({
        userId,
        _id: { $in: safeQuestionIds }
      })
      .remove();

    return {
      code: 0,
      message: '删除成功',
      data: { deletedCount: result.deleted },
      requestId
    };
  }

  return { code: 400, success: false, message: '缺少删除条件', requestId };
}

/**
 * 同步题目（本地 -> 云端）
 */
async function syncQuestions(userId, data, requestId) {
  const { localQuestions } = data || {};

  if (!Array.isArray(localQuestions)) {
    return { code: 400, success: false, message: '题目数据无效', requestId };
  }

  const safeLocalQuestions = localQuestions.slice(0, 1000);

  // 获取云端题目（分批加载，避免超出单次查询限制）
  const cloudMap = new Map();
  let cloudSkip = 0;
  const cloudBatchSize = 1000;
  while (true) {
    const batch = await db.collection('user_questions').where({ userId }).skip(cloudSkip).limit(cloudBatchSize).get();

    if (!batch.data || batch.data.length === 0) break;

    batch.data.forEach((q) => {
      const key = generateQuestionHash(q);
      cloudMap.set(key, q);
    });

    if (batch.data.length < cloudBatchSize) break;
    cloudSkip += cloudBatchSize;
  }

  // 找出需要上传的新题目
  const newQuestions = [];
  safeLocalQuestions.forEach((q) => {
    if (!q || typeof q !== 'object') return;
    const key = generateQuestionHash(q);
    if (!cloudMap.has(key)) {
      newQuestions.push({
        question: toSafeString(q.question, 2000),
        options: Array.isArray(q.options) ? q.options.slice(0, 10).map((opt) => toSafeString(opt, 200)) : [],
        answer: toSafeString(q.answer, 200),
        analysis: toSafeString(q.analysis, 4000),
        difficulty: toPositiveInt(q.difficulty, 3, 5),
        tags: Array.isArray(q.tags)
          ? q.tags
              .map((tag) => toSafeString(tag, 40))
              .filter(Boolean)
              .slice(0, 20)
          : [],
        materialId: toSafeString(q.materialId || '', 64) || null,
        materialName: toSafeString(q.materialName || '', 100) || '未知来源',
        userId,
        source: 'sync_upload',
        createdAt: Number(q.createdAt) || Date.now(),
        updatedAt: Date.now()
      });
    }
  });

  // 批量上传新题目
  let uploadedCount = 0;
  if (newQuestions.length > 0) {
    await db.collection('user_questions').add(newQuestions);
    uploadedCount = newQuestions.length;
  }

  // 返回云端最新题目（供本地更新）
  const latestQuestions = await db
    .collection('user_questions')
    .where({ userId })
    .orderBy('updatedAt', 'desc')
    .limit(100)
    .get();

  return {
    code: 0,
    message: '同步成功',
    data: {
      uploadedCount,
      cloudTotal: cloudMap.size,
      latestQuestions: latestQuestions.data || []
    },
    requestId
  };
}

/**
 * 获取题库统计
 */
async function getQuestionStats(userId, requestId) {
  const [totalResult, materialsResult] = await Promise.all([
    db.collection('user_questions').where({ userId }).count(),
    db.collection('user_materials').where({ userId }).count()
  ]);

  // 按来源统计
  const bySourceResult = await db
    .collection('user_questions')
    .aggregate()
    .match({ userId })
    .group({
      _id: '$materialName',
      count: { $sum: 1 }
    })
    .end();

  // 按难度统计
  const byDifficultyResult = await db
    .collection('user_questions')
    .aggregate()
    .match({ userId })
    .group({
      _id: '$difficulty',
      count: { $sum: 1 }
    })
    .end();

  return {
    code: 0,
    data: {
      totalQuestions: totalResult.total || 0,
      totalMaterials: materialsResult.total || 0,
      bySource: bySourceResult.data || [],
      byDifficulty: byDifficultyResult.data || []
    },
    requestId
  };
}

/**
 * 生成题目哈希（用于去重）
 */
function generateQuestionHash(question) {
  const text = (question.question || '') + (question.options?.join('') || '');
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
