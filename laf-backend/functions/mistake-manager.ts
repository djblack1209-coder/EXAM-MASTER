/**
 * 错题本管理云函数 (Sealos 兼容版)
 *
 * 功能：
 * 1. 添加错题 (add)
 * 2. 获取错题列表 (get)
 * 3. 删除错题 (remove)
 * 3b. 批量删除错题 (batchRemove) - v2.1新增
 * 4. 更新错题状态 (updateStatus)
 * 4b. 更新错题字段 (updateFields)
 * 5. 批量同步 (batchSync)
 * 6. 获取错题分类统计 (getCategories) - v2.0新增
 * 7. 管理错题标签 (manageTags) - v2.0新增
 * 8. 按标签筛选错题 (getByTags) - v2.0新增
 *
 * 请求参数：
 * - action: string (必填) - 操作类型
 * - userId: string (必填) - 用户ID
 * - data: object (可选) - 操作数据
 *
 * 返回格式：
 * { code: 0, success: true, data: {...}, message: 'success' }
 *
 * @version 2.0.0
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import {
  scheduleReviewFSRS,
  createNewCard,
  hasFSRSState,
  extractFSRSState,
  migrateToFSRS,
  type FSRSScheduleResult,
  type ReviewLogRecord
} from './_shared/fsrs-scheduler.js';
import {
  sanitizeString,
  validateAction,
  validateUserId,
  createLogger,
  generateRequestId,
  checkRateLimitDistributed
} from './_shared/api-response.js';

const db = cloud.database();
const _ = db.command;

// ✅ E004: 简单的内容哈希函数（用于去重，非密码学用途）
function contentHash(str: string): string {
  let hash = 0;
  const s = (str || '').substring(0, 200);
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    hash = (hash << 5) - hash + ch;
    hash |= 0; // 转为32位整数
  }
  return 'h_' + (hash >>> 0).toString(36);
}

// ==================== 日志工具 ====================
const logger = createLogger('[MistakeManager]');

// ==================== 参数校验 ====================
// sanitizeString, validateAction, validateUserId 已从 _shared/api-response 导入

function validateMistakeData(data: unknown): { valid: boolean; error?: string; sanitized?: Record<string, unknown> } {
  if (!data || typeof data !== 'object') {
    return { valid: true, sanitized: {} };
  }

  const d = data as Record<string, unknown>;

  const sanitized: Record<string, unknown> = {};

  // 校验并清理题目内容
  if (d.question_content !== undefined) {
    if (typeof d.question_content !== 'string') {
      return { valid: false, error: 'question_content 必须是字符串' };
    }
    if (d.question_content.length < 5) {
      return { valid: false, error: '题目内容至少5个字符' };
    }
    sanitized.question_content = sanitizeString(d.question_content, 2000);
  }

  // 校验选项
  if (d.options !== undefined) {
    if (!Array.isArray(d.options)) {
      return { valid: false, error: 'options 必须是数组' };
    }
    if (d.options.length > 10) {
      return { valid: false, error: '选项数量不能超过10个' };
    }
    sanitized.options = d.options.map((opt: unknown) => sanitizeString(String(opt), 500));
  }

  // 校验答案
  if (d.user_answer !== undefined) {
    sanitized.user_answer = sanitizeString(String(d.user_answer), 100);
  }
  if (d.correct_answer !== undefined) {
    sanitized.correct_answer = sanitizeString(String(d.correct_answer), 100);
  }

  // 校验分类
  if (d.category !== undefined) {
    const validCategories = ['政治', '英语', '数学', '专业课', '综合'];
    if (!validCategories.includes(String(d.category))) {
      sanitized.category = '综合';
    } else {
      sanitized.category = d.category;
    }
  }

  // 校验难度
  if (d.difficulty !== undefined) {
    const validDifficulties = ['easy', 'medium', 'hard'];
    if (!validDifficulties.includes(String(d.difficulty))) {
      sanitized.difficulty = 'medium';
    } else {
      sanitized.difficulty = d.difficulty;
    }
  }

  // 校验分页参数
  if (d.page !== undefined) {
    const page = parseInt(String(d.page), 10);
    sanitized.page = isNaN(page) || page < 1 ? 1 : Math.min(page, 1000);
  }
  if (d.limit !== undefined) {
    const limit = parseInt(String(d.limit), 10);
    sanitized.limit = isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 100);
  }

  // 校验 ID
  if (d.id !== undefined) {
    if (typeof d.id !== 'string' || d.id.length > 64) {
      return { valid: false, error: 'id 格式不正确' };
    }
    sanitized.id = d.id;
  }

  // 校验布尔值
  if (d.is_mastered !== undefined) {
    sanitized.is_mastered = Boolean(d.is_mastered);
  }

  // 其他字段直接复制（已清理）
  if (d.analysis !== undefined) {
    sanitized.analysis = sanitizeString(String(d.analysis), 5000);
  }
  if (d.tags !== undefined && Array.isArray(d.tags)) {
    sanitized.tags = d.tags.slice(0, 20).map((t: unknown) => sanitizeString(String(t), 50));
  }
  if (d.error_type !== undefined) {
    sanitized.error_type = sanitizeString(String(d.error_type), 50);
  }
  if (d.question_id !== undefined) {
    sanitized.question_id = sanitizeString(String(d.question_id), 64);
  }
  if (d.wrong_count !== undefined) {
    const count = parseInt(String(d.wrong_count), 10);
    sanitized.wrong_count = isNaN(count) || count < 1 ? 1 : Math.min(count, 1000);
  }

  if (d.review_count !== undefined) {
    const count = parseInt(String(d.review_count), 10);
    sanitized.review_count = isNaN(count) || count < 0 ? 0 : Math.min(count, 10000);
  }

  if (d.last_review_time !== undefined) {
    if (d.last_review_time === null) {
      sanitized.last_review_time = null;
    } else {
      const ts = parseInt(String(d.last_review_time), 10);
      sanitized.last_review_time = isNaN(ts) || ts <= 0 ? null : ts;
    }
  }

  if (d.next_review_time !== undefined) {
    if (d.next_review_time === null) {
      sanitized.next_review_time = null;
    } else {
      const ts = parseInt(String(d.next_review_time), 10);
      sanitized.next_review_time = isNaN(ts) || ts <= 0 ? null : ts;
    }
  }

  if (d.ease_factor !== undefined) {
    const ef = Number(d.ease_factor);
    sanitized.ease_factor = Number.isFinite(ef) ? Math.min(Math.max(ef, 1.3), 5.0) : 2.5;
  }

  if (d.interval_days !== undefined) {
    const interval = parseInt(String(d.interval_days), 10);
    sanitized.interval_days = isNaN(interval) || interval < 1 ? 1 : Math.min(interval, 365);
  }

  if (d.source !== undefined) {
    sanitized.source = sanitizeString(String(d.source), 100);
  }

  if (d.notes !== undefined || d.note !== undefined) {
    const noteValue = d.notes !== undefined ? d.notes : d.note;
    if (noteValue === null) {
      sanitized.notes = null;
    } else {
      sanitized.notes = sanitizeString(String(noteValue), 2000);
    }
  }

  return { valid: true, sanitized };
}

export default async function (ctx: FunctionContext) {
  const startTime = Date.now();
  const requestId = generateRequestId('mm');

  logger.info(`[${requestId}] 错题管理请求开始`);

  try {
    // 1. 参数校验（后端必须再校验一遍，不信任前端）
    const { action, data } = ctx.body || {};

    if (!validateAction(action)) {
      return { code: 400, success: false, message: '参数错误: action 不合法', requestId };
    }

    // [H-01 FIX] JWT 认证：始终从 JWT payload 派生 userId，不信任 body
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return { code: 401, success: false, message: authResult.message, requestId };
    }
    // 始终使用 JWT 中的 userId，忽略 body 中的值
    const userId = authResult.userId;

    if (!validateUserId(userId)) {
      return { code: 401, success: false, message: '用户未登录或 userId 不合法', requestId };
    }

    // 分布式频率限制（每用户每分钟30次）
    const rateResult = await checkRateLimitDistributed(`mistake:${userId}`, 30, 60_000);
    if (!rateResult.allowed) {
      logger.warn(`[${requestId}] 错题本请求频率过高: userId=${userId}`);
      return { code: 429, success: false, message: '请求过于频繁，请稍后再试', requestId };
    }

    // 校验并清理 data
    const dataValidation = validateMistakeData(data);
    if (!dataValidation.valid) {
      return { code: 400, success: false, message: `参数错误: ${dataValidation.error}`, requestId };
    }

    logger.info(`[${requestId}] action: ${action}, userId: ${userId}`);

    // 3. 路由到对应处理函数
    const handlers = {
      add: handleAdd,
      get: handleGet,
      remove: handleRemove,
      batchRemove: handleBatchRemove,
      updateStatus: handleUpdateStatus,
      updateFields: handleUpdateFields,
      batchSync: handleBatchSync,
      getCategories: handleGetCategories,
      manageTags: handleManageTags,
      getByTags: handleGetByTags
    };

    const handler = handlers[action];
    if (!handler) {
      return { code: 400, success: false, message: `不支持的操作: ${action}`, requestId };
    }

    // 4. 执行操作（已清理字段覆盖原始字段，保留 action 特有参数）
    const baseData = data && typeof data === 'object' ? data : {};
    const sanitizedData = {
      ...(baseData as Record<string, unknown>),
      ...(dataValidation.sanitized || {})
    };
    const result = await handler(userId, sanitizedData, requestId);

    // 5. 返回结果
    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] 操作完成，耗时: ${duration}ms`);

    return {
      ...result,
      requestId,
      duration
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[${requestId}] 错题管理异常:`, error);

    // P015: 错误分类，提供更精确的错误码和信息
    const errMsg = error.message || '';
    let code = 500;
    let message = '服务器内部错误';

    if (errMsg.includes('not found') || errMsg.includes('不存在')) {
      code = 404;
      message = '请求的资源不存在';
    } else if (errMsg.includes('duplicate') || errMsg.includes('已存在')) {
      code = 409;
      message = '数据已存在，请勿重复操作';
    } else if (errMsg.includes('validation') || errMsg.includes('参数')) {
      code = 400;
      message = '请求参数错误';
    } else if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT')) {
      code = 504;
      message = '数据库请求超时，请稍后重试';
    }

    return {
      code,
      success: false,
      message,
      requestId,
      duration
    };
  }
}

/**
 * 添加错题
 * ✅ E004: 使用内容哈希去重，避免拉取500条记录到内存
 */
async function handleAdd(userId, data, requestId) {
  if (!data || !data.question_content) {
    return { code: 400, success: false, message: '参数错误: 题目内容不能为空' };
  }

  const collection = db.collection('mistake_book');
  const now = Date.now();

  // 使用内容哈希进行 O(1) 去重查询
  const qHash = contentHash(data.question_content);

  const existing = await collection
    .where({
      user_id: userId,
      _content_hash: qHash
    })
    .getOne();

  if (existing.data) {
    // 二次验证：哈希碰撞时比较前100字符
    const existingKey = (existing.data.question_content || '').substring(0, 100);
    const newKey = (data.question_content || '').substring(0, 100);
    if (existingKey === newKey) {
      await collection.doc(existing.data._id).update({
        wrong_count: _.inc(1),
        updated_at: now,
        is_mastered: false
      });

      logger.info(`[${requestId}] 错题已存在，更新错误次数: ${existing.data._id}`);

      return {
        code: 0,
        success: true,
        id: existing.data._id,
        _id: existing.data._id,
        message: '错题已更新',
        isUpdate: true
      };
    }
  }

  // 新增错题（带内容哈希字段）
  const mistake = {
    user_id: userId,
    _content_hash: qHash,
    question_id: data.question_id || null,
    question_content: data.question_content,
    options: data.options || [],
    user_answer: data.user_answer || '',
    correct_answer: data.correct_answer || '',
    analysis: data.analysis || '',
    category: data.category || '综合',
    tags: data.tags || [],
    error_type: data.error_type || 'knowledge_gap',
    difficulty: data.difficulty || 'medium',
    wrong_count: data.wrong_count || 1,
    review_count: 0,
    is_mastered: false,
    last_review_time: null,
    ...createNewCard(),
    created_at: now,
    updated_at: now
  };

  const result = await collection.add(mistake);

  logger.info(`[${requestId}] 新增错题成功: ${result.id}`);

  return {
    code: 0,
    success: true,
    id: result.id,
    _id: result.id,
    message: '添加成功'
  };
}

/**
 * 获取错题列表
 */
async function handleGet(userId, data, requestId) {
  const collection = db.collection('mistake_book');

  // 构建查询条件
  const query: Record<string, unknown> = { user_id: userId };

  // 可选筛选条件
  if (data?.id) {
    query._id = data.id;
  }
  if (data?.is_mastered !== undefined) {
    query.is_mastered = data.is_mastered;
  }
  if (data?.category) {
    query.category = data.category;
  }
  if (data?.error_type) {
    query.error_type = data.error_type;
  }

  // 分页参数
  const page = data?.page || 1;
  const limit = Math.min(data?.limit || 50, 100); // 最大100条
  const skip = (page - 1) * limit;

  // 查询数据
  const [listRes, countRes] = await Promise.all([
    collection.where(query).orderBy('created_at', 'desc').skip(skip).limit(limit).get(),
    collection.where(query).count()
  ]);

  logger.info(`[${requestId}] 查询错题列表: ${listRes.data.length}/${countRes.total}`);

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
 * 删除错题
 */
async function handleRemove(userId, data, requestId) {
  if (!data?.id) {
    return { code: 400, success: false, message: '参数错误: id 不能为空' };
  }

  const collection = db.collection('mistake_book');

  // 验证权限：只能删除自己的错题
  const mistake = await collection
    .where({
      _id: data.id,
      user_id: userId
    })
    .getOne();

  if (!mistake.data) {
    logger.warn(`[${requestId}] 错题不存在: ${data.id}`);
    return { code: 0, success: true, deleted: 0, message: '错题不存在' };
  }

  // 执行删除
  const result = await collection.doc(data.id).remove();

  logger.info(`[${requestId}] 删除错题成功: ${data.id}`);

  return {
    code: 0,
    success: true,
    deleted: result.deleted || 1,
    message: '删除成功'
  };
}

/**
 * 批量删除错题 (P2-4: 替代逐条 remove 的 N+1 模式)
 * 接收 ids 数组，一次性删除该用户名下匹配的所有错题
 */
async function handleBatchRemove(userId, data, requestId) {
  const ids: string[] = data?.ids;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return { code: 400, success: false, message: '参数错误: ids 必须是非空数组' };
  }

  // 上限 500 条，防止滥用
  if (ids.length > 500) {
    return { code: 400, success: false, message: '单次最多删除 500 条' };
  }

  const collection = db.collection('mistake_book');

  // 批量删除：只删除属于该用户的记录
  const result = await collection
    .where({
      _id: _.in(ids),
      user_id: userId
    })
    .remove({ multi: true });

  const deleted = result.deleted || 0;
  logger.info(`[${requestId}] 批量删除错题: 请求 ${ids.length} 条, 实际删除 ${deleted} 条`);

  return {
    code: 0,
    success: true,
    deleted,
    requested: ids.length,
    message: `成功删除 ${deleted} 条错题`
  };
}

/**
 * 更新错题状态（掌握/未掌握）
 */
async function handleUpdateStatus(userId, data, requestId) {
  if (!data?.id) {
    return { code: 400, success: false, message: '参数错误: id 不能为空' };
  }

  const collection = db.collection('mistake_book');
  const now = Date.now();

  // 验证权限
  const mistake = await collection
    .where({
      _id: data.id,
      user_id: userId
    })
    .getOne();

  if (!mistake.data) {
    logger.warn(`[${requestId}] 错题不存在: ${data.id}`);
    return { code: 404, success: false, message: '错题不存在' };
  }

  // 计算 FSRS 调度参数（优先使用原生 FSRS 路径，回退到旧版 SM-2 兼容路径）
  const isMastered = Boolean(data.is_mastered);
  let updateData: Record<string, unknown> = {
    is_mastered: isMastered,
    last_review_time: now,
    review_count: _.inc(1),
    updated_at: now
  };

  const rating = isMastered ? 'good' : 'again';
  let fsrsResult: FSRSScheduleResult;

  if (hasFSRSState(mistake.data)) {
    // ✅ FSRS 原生路径：无损往返，保留 lapses/state/learning_steps
    const fsrsState = extractFSRSState(mistake.data);
    fsrsResult = scheduleReviewFSRS(fsrsState, rating);

    // 持久化完整 FSRS 卡片状态
    updateData = {
      ...updateData,
      ...fsrsResult.card,
      // 同时写回旧字段，保持向后兼容
      interval_days: fsrsResult.legacy.interval_days,
      ease_factor: fsrsResult.legacy.ease_factor,
      next_review_time: fsrsResult.legacy.next_review_time
    };
  } else {
    // 旧卡片：先迁移到 FSRS，再用原生路径调度
    const migrated = migrateToFSRS({
      ease_factor: mistake.data.ease_factor,
      interval_days: mistake.data.interval_days,
      review_count: mistake.data.review_count || 0,
      last_review_time: mistake.data.last_review_time,
      next_review_time: mistake.data.next_review_time
    });
    fsrsResult = scheduleReviewFSRS(migrated, rating);

    updateData = {
      ...updateData,
      ...fsrsResult.card,
      interval_days: fsrsResult.legacy.interval_days,
      ease_factor: fsrsResult.legacy.ease_factor,
      next_review_time: fsrsResult.legacy.next_review_time
    };
  }

  // 执行更新
  const result = await collection.doc(data.id).update(updateData);

  // ✅ Phase 3-1: 持久化 review log（异步写入，不阻塞主流程）
  try {
    const reviewLog: ReviewLogRecord = {
      user_id: userId,
      card_id: data.id,
      card_type: 'mistake',
      ...fsrsResult.reviewLog,
      created_at: now
    };
    await db.collection('review_logs').add(reviewLog);
  } catch (logErr) {
    logger.warn(`[${requestId}] review_log 写入失败（不影响主流程）:`, logErr.message);
  }

  logger.info(`[${requestId}] 更新错题状态: ${data.id}, is_mastered: ${isMastered}`);

  return {
    code: 0,
    success: true,
    updated: result.updated || 1,
    id: data.id,
    message: isMastered ? '已标记为掌握' : '已标记为未掌握'
  };
}

/**
 * 更新错题字段（用于冲突解决后的完整字段回写）
 * 仅允许白名单字段，且始终校验 user_id 所属关系
 */
async function handleUpdateFields(userId, data, requestId) {
  if (!data?.id) {
    return { code: 400, success: false, message: '参数错误: id 不能为空' };
  }

  const rawFields = data?.fields;
  if (!rawFields || typeof rawFields !== 'object' || Array.isArray(rawFields)) {
    return { code: 400, success: false, message: '参数错误: fields 必须是对象' };
  }

  const fieldValidation = validateMistakeData(rawFields);
  if (!fieldValidation.valid) {
    return { code: 400, success: false, message: `参数错误: ${fieldValidation.error}` };
  }

  const allowedFields = new Set([
    'question_id',
    'question_content',
    'options',
    'user_answer',
    'correct_answer',
    'analysis',
    'category',
    'tags',
    'error_type',
    'difficulty',
    'wrong_count',
    'review_count',
    'is_mastered',
    'last_review_time',
    'next_review_time',
    'ease_factor',
    'interval_days',
    'source',
    'notes',
    // FSRS 原生字段
    'due',
    'stability',
    'elapsed_days',
    'scheduled_days',
    'learning_steps',
    'reps',
    'lapses',
    'state',
    'last_review'
  ]);

  const updateData: Record<string, unknown> = {};
  const sanitizedFields = fieldValidation.sanitized || {};

  for (const [key, value] of Object.entries(sanitizedFields)) {
    if (allowedFields.has(key) && value !== undefined) {
      updateData[key] = value;
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { code: 400, success: false, message: '没有可更新字段' };
  }

  const collection = db.collection('mistake_book');
  const existing = await collection
    .where({
      _id: data.id,
      user_id: userId
    })
    .field({ _id: 1 })
    .getOne();

  if (!existing.data) {
    logger.warn(`[${requestId}] updateFields 权限校验失败或记录不存在: ${data.id}`);
    return { code: 404, success: false, message: '错题不存在' };
  }

  const now = Date.now();
  updateData.updated_at = now;

  if (typeof updateData.question_content === 'string' && updateData.question_content.length > 0) {
    updateData._content_hash = contentHash(updateData.question_content);
  }

  if (Object.prototype.hasOwnProperty.call(updateData, 'is_mastered')) {
    updateData.mastered_at = Boolean(updateData.is_mastered) ? now : null;
  }

  const result = await collection.doc(data.id).update(updateData);
  logger.info(`[${requestId}] updateFields 成功: ${data.id}, fields=${Object.keys(updateData).join(',')}`);

  return {
    code: 0,
    success: true,
    id: data.id,
    updated: result.updated || 1,
    data: {
      fields: Object.keys(updateData)
    },
    message: '错题字段更新成功'
  };
}

/**
 * 批量同步错题
 * ✅ E004: 并行批量插入（每批5条），替代逐条顺序插入
 */
async function handleBatchSync(userId, data, requestId) {
  if (!data?.mistakes || !Array.isArray(data.mistakes)) {
    return { code: 400, success: false, message: '参数错误: mistakes 必须是数组' };
  }

  // ✅ P1-7: 限制批量同步上限，防止滥用
  const MAX_SYNC_SIZE = 200;
  if (data.mistakes.length > MAX_SYNC_SIZE) {
    return { code: 400, success: false, message: `单次同步上限 ${MAX_SYNC_SIZE} 条` };
  }

  const collection = db.collection('mistake_book');
  const now = Date.now();

  let synced = 0;
  let failed = 0;
  const results = [];

  // 并行批量插入，每批5条
  const BATCH_SIZE = 5;
  for (let i = 0; i < data.mistakes.length; i += BATCH_SIZE) {
    const batch = data.mistakes.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(async (mistake) => {
        const questionContent = sanitizeString(String(mistake.question_content || mistake.question || ''), 2000);
        const qHash = contentHash(questionContent);

        // 去重检查：与 handleAdd 保持一致
        const existing = await collection
          .where({
            user_id: userId,
            _content_hash: qHash
          })
          .getOne();

        if (existing.data) {
          const existingKey = (existing.data.question_content || '').substring(0, 100);
          const newKey = questionContent.substring(0, 100);
          if (existingKey === newKey) {
            // 已存在，更新错误次数
            await collection.doc(existing.data._id).update({
              wrong_count: _.inc(mistake.wrong_count || 1),
              updated_at: now,
              is_mastered: false
            });
            return { oldId: mistake.id, newId: existing.data._id, isUpdate: true };
          }
        }

        // 新增 — [R2-P1] 对 batchSync 数据做消毒处理
        const mistakeData = {
          user_id: userId,
          _content_hash: qHash,
          question_content: questionContent,
          options: Array.isArray(mistake.options)
            ? mistake.options.slice(0, 10).map((o: unknown) => sanitizeString(String(o), 500))
            : [],
          user_answer: sanitizeString(String(mistake.user_answer || mistake.userChoice || ''), 100),
          correct_answer: sanitizeString(String(mistake.correct_answer || mistake.answer || ''), 100),
          analysis: sanitizeString(String(mistake.analysis || mistake.desc || ''), 5000),
          category: sanitizeString(String(mistake.category || '综合'), 50),
          tags: Array.isArray(mistake.tags)
            ? mistake.tags.slice(0, 20).map((t: unknown) => sanitizeString(String(t), 50))
            : [],
          is_mastered: mistake.is_mastered || false,
          wrong_count: mistake.wrong_count || 1,
          review_count: 0,
          ...createNewCard(),
          created_at: now,
          updated_at: now
        };
        const result = await collection.add(mistakeData);
        return { oldId: mistake.id, newId: result.id, isUpdate: false };
      })
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push({ ...r.value, success: true });
        synced++;
      } else {
        results.push({ success: false });
        failed++;
      }
    }
  }

  logger.info(`[${requestId}] 批量同步完成: 成功 ${synced}, 失败 ${failed}`);

  return {
    code: 0,
    success: true,
    synced,
    failed,
    results,
    message: `同步完成: ${synced} 成功, ${failed} 失败`
  };
}

/**
 * 获取错题分类统计 (v2.0新增)
 * ✅ P3-FIX: 使用 aggregate 管道在数据库层面完成统计，避免拉取 2000 条到内存
 */
async function handleGetCategories(userId, _data, requestId) {
  const collection = db.collection('mistake_book');
  const now = Date.now();

  try {
    // 使用聚合管道在数据库层面完成分类统计
    const categoryResult = await collection
      .aggregate()
      .match({ user_id: userId })
      .group({
        _id: { $ifNull: ['$category', '综合'] },
        total: { $sum: 1 },
        mastered: { $sum: { $cond: [{ $eq: ['$is_mastered', true] }, 1, 0] } },
        unmastered: { $sum: { $cond: [{ $ne: ['$is_mastered', true] }, 1, 0] } },
        review_needed: {
          $sum: {
            $cond: [{ $and: [{ $ne: ['$next_review_time', null] }, { $lte: ['$next_review_time', now] }] }, 1, 0]
          }
        }
      })
      .end();

    // 错误类型统计
    const errorTypeResult = await collection
      .aggregate()
      .match({ user_id: userId })
      .group({
        _id: { $ifNull: ['$error_type', 'unknown'] },
        count: { $sum: 1 }
      })
      .end();

    // 总体统计
    const summaryResult = await collection
      .aggregate()
      .match({ user_id: userId })
      .group({
        _id: null,
        total: { $sum: 1 },
        mastered: { $sum: { $cond: [{ $eq: ['$is_mastered', true] }, 1, 0] } },
        review_needed: {
          $sum: {
            $cond: [{ $and: [{ $ne: ['$next_review_time', null] }, { $lte: ['$next_review_time', now] }] }, 1, 0]
          }
        }
      })
      .end();

    const categories = (categoryResult.data || []).map((stat: Record<string, unknown>) => ({
      category: stat._id,
      total: stat.total,
      mastered: stat.mastered,
      unmastered: stat.unmastered,
      review_needed: stat.review_needed,
      mastery_rate:
        Number(stat.total || 0) > 0 ? Math.round((Number(stat.mastered || 0) / Number(stat.total || 0)) * 100) : 0
    }));

    const errorTypes = (errorTypeResult.data || []).map((et: Record<string, unknown>) => ({
      type: et._id,
      count: et.count
    }));

    const summary = summaryResult.data?.[0] || { total: 0, mastered: 0, review_needed: 0 };

    logger.info(`[${requestId}] 获取分类统计: ${categories.length} 个分类`);

    return {
      code: 0,
      success: true,
      data: {
        categories,
        errorTypes,
        summary: {
          total: summary.total || 0,
          mastered: summary.mastered || 0,
          review_needed: summary.review_needed || 0
        }
      },
      message: '获取成功'
    };
  } catch (aggError) {
    // 聚合管道不可用时降级为原始查询方式
    logger.warn(`[${requestId}] 聚合查询失败，降级为内存统计:`, aggError.message);

    const allMistakes = await collection
      .where({
        user_id: userId
      })
      .field({
        category: 1,
        error_type: 1,
        is_mastered: 1,
        next_review_time: 1
      })
      .limit(2000)
      .get();

    const categoryStats = {};
    const errorTypeStats = {};

    for (const mistake of allMistakes.data) {
      const category = mistake.category || '综合';
      const errorType = mistake.error_type || 'unknown';

      if (!categoryStats[category]) {
        categoryStats[category] = { category, total: 0, mastered: 0, unmastered: 0, review_needed: 0 };
      }
      categoryStats[category].total++;
      if (mistake.is_mastered) categoryStats[category].mastered++;
      else categoryStats[category].unmastered++;
      if (mistake.next_review_time && mistake.next_review_time <= now) categoryStats[category].review_needed++;

      if (!errorTypeStats[errorType]) errorTypeStats[errorType] = { type: errorType, count: 0 };
      errorTypeStats[errorType].count++;
    }

    const categories = Object.values(categoryStats).map((stat: Record<string, unknown>) => ({
      ...stat,
      mastery_rate:
        Number(stat.total || 0) > 0 ? Math.round((Number(stat.mastered || 0) / Number(stat.total || 0)) * 100) : 0
    }));

    return {
      code: 0,
      success: true,
      data: {
        categories,
        errorTypes: Object.values(errorTypeStats),
        summary: {
          total: allMistakes.data.length,
          mastered: allMistakes.data.filter((m) => m.is_mastered).length,
          review_needed: allMistakes.data.filter((m) => m.next_review_time && m.next_review_time <= now).length
        }
      },
      message: '获取成功'
    };
  }
}

/**
 * 管理错题标签 (v2.0新增)
 * 支持添加、删除、重命名标签
 */
async function handleManageTags(userId, data, requestId) {
  const { action: tagAction, mistakeId, tags, oldTag, newTag } = data || {};

  const collection = db.collection('mistake_book');

  switch (tagAction) {
    case 'add': {
      // 为错题添加标签
      if (!mistakeId || !tags || !Array.isArray(tags)) {
        return { code: 400, success: false, message: '参数错误: 需要 mistakeId 和 tags' };
      }

      // 验证权限
      const mistake = await collection
        .where({
          _id: mistakeId,
          user_id: userId
        })
        .getOne();

      if (!mistake.data) {
        return { code: 404, success: false, message: '错题不存在' };
      }

      // 合并标签（去重）
      const existingTags = mistake.data.tags || [];
      const newTags = [...new Set([...existingTags, ...tags.slice(0, 20)])];

      await collection.doc(mistakeId).update({
        tags: newTags,
        updated_at: Date.now()
      });

      logger.info(`[${requestId}] 添加标签成功: ${mistakeId}`);

      return {
        code: 0,
        success: true,
        data: { tags: newTags },
        message: '标签添加成功'
      };
    }

    case 'remove': {
      // 从错题移除标签
      if (!mistakeId || !tags || !Array.isArray(tags)) {
        return { code: 400, success: false, message: '参数错误: 需要 mistakeId 和 tags' };
      }

      const mistake = await collection
        .where({
          _id: mistakeId,
          user_id: userId
        })
        .getOne();

      if (!mistake.data) {
        return { code: 404, success: false, message: '错题不存在' };
      }

      const existingTags = mistake.data.tags || [];
      const tagsToRemove = new Set(tags);
      const newTags = existingTags.filter((t) => !tagsToRemove.has(t));

      await collection.doc(mistakeId).update({
        tags: newTags,
        updated_at: Date.now()
      });

      logger.info(`[${requestId}] 移除标签成功: ${mistakeId}`);

      return {
        code: 0,
        success: true,
        data: { tags: newTags },
        message: '标签移除成功'
      };
    }

    case 'rename': {
      // 批量重命名标签（用户所有错题中的该标签）
      // ✅ E004: 只拉取含目标标签的记录，减少内存占用
      if (!oldTag || !newTag) {
        return { code: 400, success: false, message: '参数错误: 需要 oldTag 和 newTag' };
      }

      // 只查询包含 oldTag 的错题，避免全量拉取
      const mistakes = await collection
        .where({
          user_id: userId,
          tags: oldTag
        })
        .field({ tags: 1 })
        .limit(2000)
        .get();

      // 查询已精确匹配 oldTag，直接使用结果
      const toUpdate = mistakes.data;

      // 并行批量更新（每批10条）
      let updated = 0;
      const BATCH = 10;
      for (let i = 0; i < toUpdate.length; i += BATCH) {
        const batch = toUpdate.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map((m) => {
            const newTags = m.tags.map((t) => (t === oldTag ? newTag : t));
            return collection.doc(m._id).update({
              tags: newTags,
              updated_at: Date.now()
            });
          })
        );
        updated += results.filter((r) => r.status === 'fulfilled').length;
      }

      logger.info(`[${requestId}] 重命名标签成功: ${oldTag} -> ${newTag}, 更新 ${updated} 条`);

      return {
        code: 0,
        success: true,
        data: { updated },
        message: `标签重命名成功，更新了 ${updated} 条错题`
      };
    }

    case 'list': {
      // 获取用户所有标签及使用次数
      // 优先使用聚合管道在 DB 层统计，避免拉取大量记录到内存
      try {
        const aggResult = await db
          .collection('mistake_book')
          .aggregate()
          .match({ user_id: userId, tags: { $exists: true, $ne: [] } })
          .unwind('$tags')
          .group({ _id: '$tags', count: { $sum: 1 } })
          .sort({ count: -1 })
          .end();

        const tagList = (aggResult.data || []).map((item) => ({
          tag: item._id,
          count: item.count
        }));

        return {
          code: 0,
          success: true,
          data: tagList,
          message: '获取成功'
        };
      } catch (aggErr) {
        // 聚合不可用时降级为内存统计
        logger.warn(`[${requestId}] 标签聚合失败，降级为内存统计:`, aggErr.message);

        const mistakes = await collection
          .where({
            user_id: userId
          })
          .field({ tags: 1 })
          .limit(2000)
          .get();

        const tagCounts = {};
        for (const mistake of mistakes.data) {
          if (mistake.tags && Array.isArray(mistake.tags)) {
            for (const tag of mistake.tags) {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            }
          }
        }

        const tagList = Object.entries(tagCounts)
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => (b.count as number) - (a.count as number));

        return {
          code: 0,
          success: true,
          data: tagList,
          message: '获取成功'
        };
      }
    }

    default:
      return { code: 400, success: false, message: '不支持的标签操作' };
  }
}

/**
 * 按标签筛选错题 (v2.0新增)
 * ✅ P3-FIX: 使用 DB 级 $in/$all 操作符替代内存筛选，避免拉取 2000 条到内存
 */
async function handleGetByTags(userId, data, requestId) {
  const { tags, matchAll = false, page = 1, limit = 50 } = data || {};

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return { code: 400, success: false, message: '参数错误: tags 必须是非空数组' };
  }

  const collection = db.collection('mistake_book');
  const safeLimit = Math.min(limit, 100);
  const skip = (Math.max(1, page) - 1) * safeLimit;

  // 在数据库层面过滤标签，避免全量拉取到内存
  const tagFilter = matchAll
    ? { tags: _.all(tags) } // 必须包含所有指定标签
    : { tags: _.in(tags) }; // 包含任意一个指定标签

  const whereCondition = { user_id: userId, ...tagFilter };

  // 并行查询数据和总数
  const [result, countResult] = await Promise.all([
    collection.where(whereCondition).orderBy('created_at', 'desc').skip(skip).limit(safeLimit).get(),
    collection.where(whereCondition).count()
  ]);

  const total = countResult.total || 0;

  logger.info(`[${requestId}] 按标签筛选: ${result.data.length}/${total}`);

  return {
    code: 0,
    success: true,
    data: result.data,
    total,
    page,
    limit,
    hasMore: skip + result.data.length < total,
    message: '获取成功'
  };
}
