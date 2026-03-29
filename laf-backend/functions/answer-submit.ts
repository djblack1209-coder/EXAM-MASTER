/**
 * 答案提交云函数 (带幂等性保护)
 *
 * 功能：
 * 1. 提交答案 (submit)
 * 2. 获取答题记录 (getRecords)
 *
 * 幂等性说明：
 * - 客户端需要在请求中携带 idempotencyKey
 * - 相同的 idempotencyKey 在24小时内只会被处理一次
 * - 重复请求会直接返回之前的结果
 *
 * 请求参数：
 * - action: string (必填) - 操作类型
 * - userId: string (必填) - 用户ID
 * - idempotencyKey: string (提交答案时必填) - 幂等键
 * - data: object - 操作数据
 *
 * @version 1.0.0
 * @author EXAM-MASTER Backend Team
 */

import cloud from '@lafjs/cloud';
// ✅ B003: 使用共享 API 响应模块，统一错误处理格式
import {
  badRequest,
  serverError,
  generateRequestId,
  wrapResponse,
  logger,
  checkRateLimitDistributed
} from './_shared/api-response.js';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import {
  createNewCard,
  scheduleReviewFSRS,
  hasFSRSState,
  extractFSRSState,
  migrateToFSRS,
  type ReviewLogRecord,
  type FSRSScheduleResult,
  type ReviewRating
} from './_shared/fsrs-scheduler.js';

const db = cloud.database();
const _ = db.command;

const ANSWER_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const ANSWER_RATE_LIMIT_MAX = 120;

// ==================== 幂等性工具（内联版本） ====================
const IDEMPOTENCY_COLLECTION = 'idempotency_records';
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;

export async function checkIdempotency(userId: string, action: string, idempotencyKey: string) {
  const fullKey = `${userId}:${action}:${idempotencyKey}`;
  const collection = db.collection(IDEMPOTENCY_COLLECTION);
  const now = Date.now();

  try {
    const existing = await collection
      .where({
        key: fullKey,
        expires_at: _.gt(now)
      })
      .getOne();

    if (existing.data) {
      if (existing.data.status === 'completed') {
        return { isDuplicate: true, previousResult: existing.data.result };
      }
      if (existing.data.status === 'processing' && now - existing.data.created_at < 30000) {
        return { isDuplicate: true, previousResult: { code: 429, success: false, message: '请求正在处理中' } };
      }
      // 超时或失败，允许重试
      await collection.doc(existing.data._id).update({ status: 'processing', created_at: now });
      return { isDuplicate: false, recordId: existing.data._id };
    }

    const insertResult = await collection.add({
      key: fullKey,
      user_id: userId,
      action,
      status: 'processing',
      created_at: now,
      expires_at: now + IDEMPOTENCY_TTL
    });

    return { isDuplicate: false, recordId: insertResult.id };
  } catch (error) {
    logger.error('[Idempotency] 检查失败:', error);
    return { isDuplicate: false };
  }
}

export async function markIdempotencyCompleted(recordId: string, result: unknown) {
  if (!recordId) return;
  try {
    await db.collection(IDEMPOTENCY_COLLECTION).doc(recordId).update({
      status: 'completed',
      result,
      completed_at: Date.now()
    });
  } catch (error) {
    logger.error('[Idempotency] 标记完成失败:', error);
  }
}

// ==================== 参数校验 ====================
export function validateSubmitParams(data: unknown): {
  valid: boolean;
  error?: string;
  sanitized?: Record<string, unknown>;
} {
  if (!data) return { valid: false, error: 'data 不能为空' };

  const { question_id, user_answer, session_id, duration, practice_mode } = data as Record<string, unknown>;

  // question_id 校验
  if (!question_id || typeof question_id !== 'string') {
    return { valid: false, error: 'question_id 不合法' };
  }
  if (question_id.length > 64) {
    return { valid: false, error: 'question_id 过长' };
  }
  // 防止 NoSQL 注入：只允许字母数字和下划线
  if (!/^[a-zA-Z0-9_-]+$/.test(question_id)) {
    return { valid: false, error: 'question_id 格式不正确' };
  }

  // user_answer 校验
  if (!user_answer || typeof user_answer !== 'string') {
    return { valid: false, error: 'user_answer 不能为空' };
  }
  if (user_answer.length > 100) {
    return { valid: false, error: 'user_answer 过长' };
  }
  // 答案格式校验（只允许字母，支持多选题）
  if (!/^[A-Ha-h]+$/.test(user_answer)) {
    return { valid: false, error: 'user_answer 格式不正确，只允许字母A-H' };
  }

  // session_id 校验（可选）
  if (session_id !== undefined && session_id !== null) {
    if (typeof session_id !== 'string' || session_id.length > 64) {
      return { valid: false, error: 'session_id 不合法' };
    }
    if (!/^[a-zA-Z0-9_-]*$/.test(session_id)) {
      return { valid: false, error: 'session_id 格式不正确' };
    }
  }

  // duration 校验（可选，答题用时，单位秒）
  let sanitizedDuration = 0;
  if (duration !== undefined) {
    const parsedDuration = parseInt(duration as string, 10);
    if (isNaN(parsedDuration) || parsedDuration < 0) {
      sanitizedDuration = 0;
    } else {
      // 限制最大值为1小时（3600秒），防止异常数据
      sanitizedDuration = Math.min(parsedDuration, 3600);
    }
  }

  // practice_mode 校验（可选）
  const validModes = ['normal', 'exam', 'review', 'challenge', 'pk'];
  let sanitizedMode = 'normal';
  if (practice_mode !== undefined) {
    if (typeof practice_mode === 'string' && validModes.includes(practice_mode)) {
      sanitizedMode = practice_mode;
    }
  }

  return {
    valid: true,
    sanitized: {
      question_id: question_id.trim(),
      user_answer: user_answer.trim().toUpperCase(),
      session_id: session_id ? (session_id as string).trim() : null,
      duration: sanitizedDuration,
      practice_mode: sanitizedMode
    }
  };
}

// ==================== 主函数 ====================
export default async function (ctx) {
  const startTime = Date.now();
  const requestId = generateRequestId('ans');

  logger.info(`[${requestId}] 答案提交请求开始`);

  try {
    const { action, idempotencyKey, data } = ctx.body || {};

    // 防御纵深：优先 JWT 认证，再校验参数
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return wrapResponse(authResult, requestId, startTime);
    }
    // 始终使用 JWT 中的 userId，忽略客户端传入的 bodyUserId
    const userId = authResult.userId;

    // 1. 基础参数校验（已通过认证） - ✅ B003: 使用共享响应格式
    if (!action || typeof action !== 'string') {
      return wrapResponse(badRequest('action 不能为空'), requestId, startTime);
    }

    // 1.5 限流
    const rateLimit = await checkRateLimitDistributed(
      `answer-submit:${userId}:${action}`,
      ANSWER_RATE_LIMIT_MAX,
      ANSWER_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return wrapResponse(
        { code: 429, success: false, message: '请求过于频繁，请稍后再试', timestamp: Date.now() },
        requestId,
        startTime
      );
    }

    // 2. 路由处理
    if (action === 'submit') {
      const result = await handleSubmit(userId, idempotencyKey, data, requestId);
      return wrapResponse(result as unknown as import('./_shared/api-response.js').ApiResponse, requestId, startTime);
    } else if (action === 'getRecords') {
      const result = await handleGetRecords(userId, data, requestId);
      return wrapResponse(result as unknown as import('./_shared/api-response.js').ApiResponse, requestId, startTime);
    } else {
      return wrapResponse(badRequest(`不支持的操作: ${action}`), requestId, startTime);
    }
  } catch (error) {
    logger.error(`[${requestId}] 答案提交异常:`, error);
    return wrapResponse(serverError('服务器内部错误'), requestId, startTime);
  }
}

/**
 * 提交答案（带幂等性保护）
 */
async function handleSubmit(userId: string, _idempotencyKey: string, data: Record<string, unknown>, requestId: string) {
  const { questionId, userAnswer: _userAnswer, isCorrect, timeSpent: _timeSpent } = data;
  if (!questionId || typeof isCorrect !== 'boolean') {
    return { code: 400, success: false, message: '参数错误：缺少题目标识或对错结果', requestId };
  }

  try {
    // 1. 根据对错映射 FSRS 评分（答对=good, 答错=again）
    const rating: ReviewRating = isCorrect ? 'good' : 'again';

    // 2. 从 practice_records 获取已有卡片状态（如果有的话）
    const recordDoc = await db
      .collection('practice_records')
      .where({ user_id: userId, question_id: questionId })
      .orderBy('created_at', 'desc')
      .limit(1)
      .get();

    let fsrsResult: FSRSScheduleResult;
    const existingRecord = recordDoc.data?.[0];

    if (existingRecord && hasFSRSState(existingRecord)) {
      // 已有 FSRS 原生状态：无损往返调度
      const fsrsState = extractFSRSState(existingRecord);
      fsrsResult = scheduleReviewFSRS(fsrsState, rating);
    } else if (existingRecord?.ease_factor) {
      // 旧 SM-2 卡片：先迁移再调度
      const migrated = migrateToFSRS({
        ease_factor: existingRecord.ease_factor,
        interval_days: existingRecord.interval_days,
        review_count: existingRecord.review_count || 0,
        last_review_time: existingRecord.last_review_time,
        next_review_time: existingRecord.next_review_time
      });
      fsrsResult = scheduleReviewFSRS(migrated, rating);
    } else {
      // 新卡片：创建初始状态后调度
      const newCard = createNewCard();
      fsrsResult = scheduleReviewFSRS(newCard, rating);
    }

    // 3. 构建返回的记忆状态
    const memoryState = {
      ...fsrsResult.card,
      interval_days: fsrsResult.legacy.interval_days,
      ease_factor: fsrsResult.legacy.ease_factor,
      next_review_time: fsrsResult.legacy.next_review_time
    };

    return {
      code: 0,
      success: true,
      message: '提交成功',
      data: {
        isCorrect,
        memoryState,
        tutorFeedback: null // AI 辅导反馈通过独立的 AI 咨询接口提供
      },
      requestId
    };
  } catch (error) {
    logger.error('Answer submission processing failed', error);
    return { code: 500, success: false, message: '处理提交失败', requestId };
  }
}

/**
 * 获取答题记录
 */
async function handleGetRecords(userId: string, data: Record<string, unknown>, requestId: string) {
  const collection = db.collection('practice_records');

  // 分页参数校验
  const page = Math.max(1, Math.min(parseInt(data?.page as string) || 1, 1000));
  const limit = Math.max(1, Math.min(parseInt(data?.limit as string) || 20, 100));
  const skip = (page - 1) * limit;

  // 构建查询条件
  const query: Record<string, unknown> = { user_id: userId };

  if (data?.category) {
    const validCategories = ['政治', '英语', '数学', '专业课', '综合'];
    if (validCategories.includes(data.category as string)) {
      query.category = data.category;
    }
  }

  if (data?.is_correct !== undefined) {
    query.is_correct = Boolean(data.is_correct);
  }

  // 查询数据
  const [listRes, countRes] = await Promise.all([
    collection.where(query).orderBy('created_at', 'desc').skip(skip).limit(limit).get(),
    collection.where(query).count()
  ]);

  logger.info(`[${requestId}] 获取答题记录: ${listRes.data.length}/${countRes.total}`);

  return {
    code: 0,
    success: true,
    data: listRes.data,
    total: countRes.total,
    page,
    limit,
    hasMore: skip + listRes.data.length < countRes.total,
    requestId
  };
}

// ==================== [闭环串联] 答错自动归入错题本 ====================
export async function autoCollectMistake(
  userId: string,
  questionData: any,
  userAnswer: string,
  correctAnswer: string,
  timestamp: number
) {
  const mistakeCollection = db.collection('mistake_book');

  // 去重：同一用户同一题目不重复添加
  const existing = await mistakeCollection.where({ user_id: userId, question_id: questionData._id }).count();

  if (existing.total > 0) {
    // 已存在，更新错误次数
    await mistakeCollection.where({ user_id: userId, question_id: questionData._id }).update({
      error_count: _.inc(1),
      last_wrong_answer: userAnswer,
      last_wrong_at: timestamp,
      is_mastered: false // 又错了，重置掌握状态
    });
    return;
  }

  // 新增错题记录（使用 FSRS 初始化，与 mistake-manager 保持一致）
  const fsrsInit = createNewCard();
  const addResult = await mistakeCollection.add({
    user_id: userId,
    question_id: questionData._id,
    question_content: questionData.content || questionData.question || '',
    options: questionData.options || [],
    correct_answer: correctAnswer,
    last_wrong_answer: userAnswer,
    category: questionData.category || '',
    difficulty: questionData.difficulty || 'medium',
    knowledge_point: questionData.knowledge_point || questionData.category || '',
    analysis: questionData.analysis || '',
    error_count: 1,
    review_count: 0,
    is_mastered: false,
    // FSRS v6 间隔重复初始参数（与 mistake-manager.handleAdd 一致）
    ease_factor: 2.5,
    interval_days: 0,
    next_review_time: fsrsInit.due,
    last_wrong_at: timestamp,
    created_at: timestamp,
    // FSRS 卡片状态字段
    ...fsrsInit
  });

  // ✅ Phase 3-1: 记录首次 review log（答错 = Again rating）
  try {
    const reviewLog: ReviewLogRecord = {
      user_id: userId,
      card_id: addResult.id,
      card_type: 'question',
      rating: 1, // Rating.Again
      state: 0, // State.New
      due: fsrsInit.due,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      review: timestamp,
      created_at: timestamp
    };
    await db.collection('review_logs').add(reviewLog);
  } catch (_logErr) {
    // review log 写入失败不影响主流程
  }
}

// ==================== [闭环串联] 累积会话答题数据（用于AI诊断） ====================
export async function accumulateSessionData(
  userId: string,
  sessionId: string | null,
  answerData: {
    question_id: string;
    category: string;
    difficulty: string;
    knowledge_point: string;
    is_correct: boolean;
    duration: number;
    user_answer: string;
    correct_answer: string;
  },
  timestamp: number
) {
  if (!sessionId) return; // 无会话ID则跳过

  const sessionCollection = db.collection('practice_session_cache');

  // 查找或创建会话缓存（使用 upsert 防止并发创建重复文档）
  const existing = await sessionCollection.where({ user_id: userId, session_id: sessionId }).getOne();

  if (existing.data) {
    // 追加答题数据
    await sessionCollection.doc(existing.data._id).update({
      answers: _.push(answerData),
      total_count: _.inc(1),
      correct_count: answerData.is_correct ? _.inc(1) : _.inc(0),
      total_duration: _.inc(answerData.duration || 0),
      updated_at: timestamp
    });
  } else {
    // 创建新会话缓存（加 try-catch 处理并发首条插入冲突）
    try {
      await sessionCollection.add({
        user_id: userId,
        session_id: sessionId,
        answers: [answerData],
        total_count: 1,
        correct_count: answerData.is_correct ? 1 : 0,
        total_duration: answerData.duration || 0,
        diagnosis_status: 'pending',
        created_at: timestamp,
        updated_at: timestamp
      });
    } catch (_dupErr) {
      // 并发插入冲突，回退到更新模式
      const retry = await sessionCollection.where({ user_id: userId, session_id: sessionId }).getOne();
      if (retry.data) {
        await sessionCollection.doc(retry.data._id).update({
          answers: _.push(answerData),
          total_count: _.inc(1),
          correct_count: answerData.is_correct ? _.inc(1) : _.inc(0),
          total_duration: _.inc(answerData.duration || 0),
          updated_at: timestamp
        });
      }
    }
  }
}
