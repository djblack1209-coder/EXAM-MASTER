/**
 * 答案提交云函数 (带幂等性保护)
 *
 * 功能：
 * 1. 提交答案 (submit)
 * 2. 获取答题记录 (getRecords)
 *
 * 幂等性说明：
 * - 客户端需要在请求中携带 idempotencyKey
 * - 同一账户的 idempotencyKey 在原记录保留期间只接收一次
 * - 重复请求会直接返回之前的结果
 *
 * 请求参数：
 * - action: string (必填) - 操作类型
 * - 用户身份只取 JWT，忽略 body userId
 * - idempotencyKey: string (提交答案时必填) - 幂等键
 * - data: object - 操作数据
 *
 * @version 1.0.0
 * @author EXAM-MASTER Backend Team
 */

import cloud from '@lafjs/cloud';
import { summarizeQuizReceipts } from './_shared/quiz-receipts.js';
import { createHash } from 'node:crypto';
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
import { createNewCard, type ReviewLogRecord } from './_shared/fsrs-scheduler.js';

const db = cloud.database();
const _ = db.command;

const ANSWER_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const ANSWER_RATE_LIMIT_MAX = 120;

// 一份不可变 practice_records 文档即作答回执；内置 _id 唯一约束保证并发重传只写一次。

// ==================== 参数校验 ====================
export function validateSubmitParams(data: unknown): {
  valid: boolean;
  error?: string;
  sanitized?: Record<string, unknown>;
} {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { valid: false, error: 'data 不合法' };
  const allowed = ['question_id', 'user_answer', 'session_id', 'duration', 'practice_mode'];
  if (Object.keys(data).some((key) => !allowed.includes(key))) return { valid: false, error: 'data 包含不支持字段' };

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
  if (user_answer.length > 8) {
    return { valid: false, error: 'user_answer 过长' };
  }
  // 答案格式校验（只允许字母，支持多选题）
  if (!/^[A-Ha-h]+$/.test(user_answer)) {
    return { valid: false, error: 'user_answer 格式不正确，只允许字母A-H' };
  }
  if (new Set(user_answer.toUpperCase()).size !== user_answer.length) return { valid: false, error: '答案选项重复' };

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
    if (
      !['number', 'string'].includes(typeof duration) ||
      (typeof duration === 'string' && duration.length > 32) ||
      !/^\d+(?:\.\d+)?$/.test(String(duration)) ||
      !Number.isFinite(Number(duration))
    )
      return { valid: false, error: 'duration 不合法' };
    sanitizedDuration = Math.min(Math.floor(Number(duration)), 3600);
  }

  // practice_mode 校验（可选）
  const validModes = ['normal', 'exam', 'review', 'challenge', 'pk'];
  let sanitizedMode = 'normal';
  if (practice_mode !== undefined) {
    if (typeof practice_mode !== 'string' || !validModes.includes(practice_mode))
      return { valid: false, error: 'practice_mode 不合法' };
    sanitizedMode = practice_mode;
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
    if (!action || typeof action !== 'string' || !['submit', 'getRecords'].includes(action)) {
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
  } catch (_error) {
    logger.error(`[${requestId}] 答案提交异常`);
    return wrapResponse(serverError('服务器内部错误'), requestId, startTime);
  }
}

/**
 * 提交答案（带幂等性保护）
 */
function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function bindServerQuestion(questionId: string, userId: string) {
  const response = await db
    .collection('questions')
    .where({ _id: questionId, is_active: true, review_status: 'approved' })
    .getOne();
  const q = response.data;
  if (
    !q ||
    q.is_premium === true ||
    ['user_id', 'owner', 'owner_id'].some((key) => q[key] != null && q[key] !== userId)
  ) {
    return { status: 'unresolved', kind: 'question_id_only', question_id: questionId };
  }
  const text = q.question || q.content;
  if (
    typeof text !== 'string' ||
    !text.trim() ||
    text.length > 50000 ||
    !Array.isArray(q.options) ||
    q.options.length < 2 ||
    q.options.length > 8 ||
    q.options.some((item) => typeof item !== 'string' || item.length > 4000)
  ) {
    return { status: 'unresolved', kind: 'question_id_only', question_id: questionId };
  }
  const snapshot = {
    question_id: questionId,
    question: text,
    options: q.options,
    type: typeof q.type === 'string' ? q.type : null,
    category: typeof q.category === 'string' ? q.category : null,
    source: typeof q.source === 'string' ? q.source : null,
    year: typeof q.year === 'string' || typeof q.year === 'number' ? q.year : null
  };
  if (JSON.stringify(snapshot).length > 65536)
    return { status: 'unresolved', kind: 'question_id_only', question_id: questionId };
  return {
    status: 'bound',
    kind: 'server_question_snapshot',
    question_id: questionId,
    fingerprint: digest(snapshot),
    snapshot
  };
}

function receipt(record) {
  return {
    code: 0,
    success: true,
    message: '作答已保存，判分待核对',
    data: {
      submission_contract: record.submission_contract,
      attempt_id: record.idempotency_key,
      record_id: record._id,
      question_id: record.question_id,
      session_id: record.session_id,
      user_answer: record.user_answer,
      user_answer_raw: record.raw_input.user_answer,
      duration: record.duration,
      practice_mode: record.practice_mode,
      received_at: record.created_at,
      question_binding: record.question_binding,
      grade: record.grade,
      isCorrect: null,
      memoryState: null,
      tutorFeedback: null
    }
  };
}

async function handleSubmit(userId: string, idempotencyKey: unknown, data: unknown, _requestId: string) {
  if (typeof idempotencyKey !== 'string' || !/^[a-zA-Z0-9_:-]{1,160}$/.test(idempotencyKey))
    return badRequest('参数错误：缺少合法作答编号');
  const checked = validateSubmitParams(data);
  if (!checked.valid) return badRequest(`参数错误：${checked.error}`);
  const raw = data as Record<string, unknown>;
  const rawInput = Object.fromEntries(
    ['question_id', 'user_answer', 'session_id', 'duration', 'practice_mode']
      .filter((key) => Object.prototype.hasOwnProperty.call(raw, key))
      .map((key) => [key, raw[key]])
  );
  const fingerprint = digest(rawInput);
  const id = `ans_${digest([userId, 'answer-submit', idempotencyKey])}`;
  const records = db.collection('practice_records');
  const existing = await records.where({ _id: id, user_id: userId }).getOne();
  const replay = (original) => {
    if (original.submission_contract !== 'quiz-answer-submission-v1' || original.payload_fingerprint !== fingerprint)
      return { code: 409, success: false, message: '该作答编号已有不同内容，原作答已保留' };
    return receipt(original);
  };
  if (existing.data) return replay(existing.data);
  const input = checked.sanitized!;
  const binding = await bindServerQuestion(input.question_id as string, userId);
  const record = {
    _id: id,
    submission_contract: 'quiz-answer-submission-v1',
    user_id: userId,
    idempotency_key: idempotencyKey,
    payload_fingerprint: fingerprint,
    raw_input: rawInput,
    ...input,
    category: binding.snapshot?.category || null,
    question_binding: binding,
    grade: { status: 'pending', outcome: null, basis: 'no_independent_reference' },
    is_correct: null,
    created_at: Date.now()
  };
  try {
    const saved = await records.add(record);
    if (saved.id !== id) throw new Error('RECEIPT_ID_MISMATCH');
    return receipt(record);
  } catch (_error) {
    // 并发唯一冲突或响应丢失后，只读取已保存的同一账户回执，不补写或重复调度。
    const persisted = await records.where({ _id: id, user_id: userId }).getOne();
    if (persisted.data) return replay(persisted.data);
    logger.warn('原作答未保存，请求可沿原编号重试');
    return serverError('作答未保存，请沿原编号重试');
  }
}

/**
 * 获取答题记录
 */
async function handleGetRecords(userId: string, data: Record<string, unknown>, requestId: string) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return badRequest('记录筛选参数不合法');
  const allowed = ['page', 'limit', 'category', 'is_correct', 'session_id', 'question_id'];
  if (Object.keys(data).some((key) => !allowed.includes(key))) return badRequest('记录筛选包含不支持字段');
  for (const key of ['page', 'limit']) {
    const value = data[key];
    if (
      value !== undefined &&
      (!['number', 'string'].includes(typeof value) || !/^\d{1,10}$/.test(String(value)) || Number(value) < 1)
    )
      return badRequest('分页参数不合法');
  }
  for (const key of ['session_id', 'question_id']) {
    const value = data[key];
    if (value !== undefined && (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(value)))
      return badRequest('记录筛选编号不合法');
  }
  if (
    data.category !== undefined &&
    (typeof data.category !== 'string' || !data.category.trim() || data.category.length > 100)
  )
    return badRequest('记录分类不合法');
  if (data.is_correct !== undefined && data.is_correct !== null && typeof data.is_correct !== 'boolean')
    return badRequest('判分筛选只接受布尔值或 null');
  const collection = db.collection('practice_records');

  // 分页参数校验
  const page = Math.max(1, Math.min(parseInt(data?.page as string) || 1, 1000));
  const limit = Math.max(1, Math.min(parseInt(data?.limit as string) || 20, 100));
  const skip = (page - 1) * limit;

  // 构建查询条件
  const query: Record<string, unknown> = { user_id: userId };

  if (data.category !== undefined) query.category = data.category;
  for (const key of ['session_id', 'question_id']) if (data[key] !== undefined) query[key] = data[key];

  if (data?.is_correct !== undefined) {
    query.is_correct = data.is_correct;
  }

  // 列表与汇总共享已校验的账户/筛选；汇总不受分页上限影响。
  const [listRes, summary] = await Promise.all([
    collection.where(query).orderBy('created_at', 'desc').skip(skip).limit(limit).get(),
    summarizeQuizReceipts(db, userId, query)
  ]);

  logger.info(`[${requestId}] 获取答题记录: ${listRes.data.length}/${summary.received}`);

  return {
    code: 0,
    success: true,
    data: listRes.data,
    total: summary.received,
    summary,
    page,
    limit,
    hasMore: skip + listRes.data.length < summary.received,
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
