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

import cloud from '@lafjs/cloud'

const db = cloud.database()
const _ = db.command

// ==================== 环境配置 ====================
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'warn' : 'info')

// ==================== 日志工具 ====================
const logger = {
  info: (...args: any[]) => { if (LOG_LEVEL !== 'warn' && LOG_LEVEL !== 'error') console.log(...args) },
  warn: (...args: any[]) => { if (LOG_LEVEL !== 'error') console.warn(...args) },
  error: (...args: any[]) => console.error(...args)
}

// ==================== 幂等性工具（内联版本） ====================
const IDEMPOTENCY_COLLECTION = 'idempotency_records'
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000

async function checkIdempotency(userId: string, action: string, idempotencyKey: string) {
  const fullKey = `${userId}:${action}:${idempotencyKey}`
  const collection = db.collection(IDEMPOTENCY_COLLECTION)
  const now = Date.now()
  
  try {
    const existing = await collection.where({
      key: fullKey,
      expires_at: _.gt(now)
    }).getOne()
    
    if (existing.data) {
      if (existing.data.status === 'completed') {
        return { isDuplicate: true, previousResult: existing.data.result }
      }
      if (existing.data.status === 'processing' && now - existing.data.created_at < 30000) {
        return { isDuplicate: true, previousResult: { code: 429, message: '请求正在处理中' } }
      }
      // 超时或失败，允许重试
      await collection.doc(existing.data._id).update({ status: 'processing', created_at: now })
      return { isDuplicate: false, recordId: existing.data._id }
    }
    
    const insertResult = await collection.add({
      key: fullKey,
      user_id: userId,
      action,
      status: 'processing',
      created_at: now,
      expires_at: now + IDEMPOTENCY_TTL
    })
    
    return { isDuplicate: false, recordId: insertResult.id }
  } catch (error) {
    logger.error('[Idempotency] 检查失败:', error)
    return { isDuplicate: false }
  }
}

async function markIdempotencyCompleted(recordId: string, result: any) {
  if (!recordId) return
  try {
    await db.collection(IDEMPOTENCY_COLLECTION).doc(recordId).update({
      status: 'completed',
      result,
      completed_at: Date.now()
    })
  } catch (error) {
    logger.error('[Idempotency] 标记完成失败:', error)
  }
}

// ==================== 参数校验 ====================
function validateSubmitParams(data: any): { valid: boolean; error?: string } {
  if (!data) return { valid: false, error: 'data 不能为空' }
  
  const { question_id, user_answer, session_id } = data
  
  if (!question_id || typeof question_id !== 'string') {
    return { valid: false, error: 'question_id 不合法' }
  }
  if (question_id.length > 64) {
    return { valid: false, error: 'question_id 过长' }
  }
  
  if (!user_answer || typeof user_answer !== 'string') {
    return { valid: false, error: 'user_answer 不能为空' }
  }
  if (user_answer.length > 100) {
    return { valid: false, error: 'user_answer 过长' }
  }
  // 答案格式校验（只允许字母）
  if (!/^[A-Ha-h]+$/.test(user_answer)) {
    return { valid: false, error: 'user_answer 格式不正确' }
  }
  
  if (session_id && (typeof session_id !== 'string' || session_id.length > 64)) {
    return { valid: false, error: 'session_id 不合法' }
  }
  
  return { valid: true }
}

// ==================== 主函数 ====================
export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info(`[${requestId}] 答案提交请求开始`)

  try {
    const { action, userId, idempotencyKey, data } = ctx.body || {}

    // 1. 基础参数校验
    if (!action || typeof action !== 'string') {
      return { code: 400, success: false, message: 'action 不能为空', requestId }
    }
    if (!userId || typeof userId !== 'string' || userId.length > 64) {
      return { code: 401, success: false, message: '用户未登录', requestId }
    }

    // 2. 路由处理
    if (action === 'submit') {
      return await handleSubmit(userId, idempotencyKey, data, requestId)
    } else if (action === 'getRecords') {
      return await handleGetRecords(userId, data, requestId)
    } else {
      return { code: 400, success: false, message: `不支持的操作: ${action}`, requestId }
    }

  } catch (error) {
    logger.error(`[${requestId}] 答案提交异常:`, error)
    return {
      code: 500,
      success: false,
      message: '服务器内部错误',
      requestId,
      duration: Date.now() - startTime
    }
  }
}

/**
 * 提交答案（带幂等性保护）
 */
async function handleSubmit(userId: string, idempotencyKey: string, data: any, requestId: string) {
  // 1. 幂等键校验
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    return { code: 400, success: false, message: 'idempotencyKey 不能为空（防止重复提交）', requestId }
  }
  if (idempotencyKey.length > 64) {
    return { code: 400, success: false, message: 'idempotencyKey 过长', requestId }
  }

  // 2. 参数校验
  const validation = validateSubmitParams(data)
  if (!validation.valid) {
    return { code: 400, success: false, message: validation.error, requestId }
  }

  // 3. 幂等性检查
  const idempotencyResult = await checkIdempotency(userId, 'submit_answer', idempotencyKey)
  
  if (idempotencyResult.isDuplicate) {
    logger.info(`[${requestId}] 重复提交，返回缓存结果`)
    return {
      ...idempotencyResult.previousResult,
      isDuplicate: true,
      requestId
    }
  }

  // 4. 执行业务逻辑
  try {
    const { question_id, user_answer, session_id, duration } = data
    const now = Date.now()

    // 获取题目信息
    const questionsCollection = db.collection('questions')
    const question = await questionsCollection.doc(question_id).get()

    if (!question.data) {
      const result = { code: 404, success: false, message: '题目不存在', requestId }
      await markIdempotencyCompleted(idempotencyResult.recordId, result)
      return result
    }

    // 判断答案是否正确
    const correctAnswer = question.data.answer.toUpperCase()
    const userAnswerUpper = user_answer.toUpperCase()
    const isCorrect = correctAnswer === userAnswerUpper

    // 创建答题记录
    const practiceRecord = {
      user_id: userId,
      question_id,
      session_id: session_id || null,
      user_answer: userAnswerUpper,
      correct_answer: correctAnswer,
      is_correct: isCorrect,
      duration: Math.min(Math.max(parseInt(duration) || 0, 0), 3600), // 0-3600秒
      category: question.data.category,
      difficulty: question.data.difficulty,
      practice_mode: data.practice_mode || 'normal',
      created_at: now
    }

    const recordsCollection = db.collection('practice_records')
    const insertResult = await recordsCollection.add(practiceRecord)

    // 更新题目统计
    await questionsCollection.doc(question_id).update({
      total_attempts: _.inc(1),
      correct_attempts: isCorrect ? _.inc(1) : _.inc(0)
    })

    // 更新用户统计
    const usersCollection = db.collection('users')
    await usersCollection.doc(userId).update({
      total_questions: _.inc(1),
      correct_questions: isCorrect ? _.inc(1) : _.inc(0),
      updated_at: now
    })

    // 构建返回结果
    const result = {
      code: 0,
      success: true,
      data: {
        record_id: insertResult.id,
        is_correct: isCorrect,
        correct_answer: correctAnswer,
        user_answer: userAnswerUpper,
        analysis: question.data.analysis || ''
      },
      message: isCorrect ? '回答正确！' : '回答错误',
      requestId
    }

    // 5. 标记幂等记录完成
    await markIdempotencyCompleted(idempotencyResult.recordId, result)

    logger.info(`[${requestId}] 答案提交成功: ${isCorrect ? '正确' : '错误'}`)

    return result

  } catch (error) {
    logger.error(`[${requestId}] 提交答案失败:`, error)
    
    // 标记失败（允许重试）
    if (idempotencyResult.recordId) {
      await db.collection(IDEMPOTENCY_COLLECTION).doc(idempotencyResult.recordId).update({
        status: 'failed',
        result: { error: error.message },
        completed_at: Date.now()
      })
    }
    
    return {
      code: 500,
      success: false,
      message: '提交失败，请重试',
      requestId
    }
  }
}

/**
 * 获取答题记录
 */
async function handleGetRecords(userId: string, data: any, requestId: string) {
  const collection = db.collection('practice_records')
  
  // 分页参数校验
  const page = Math.max(1, Math.min(parseInt(data?.page) || 1, 1000))
  const limit = Math.max(1, Math.min(parseInt(data?.limit) || 20, 100))
  const skip = (page - 1) * limit

  // 构建查询条件
  const query: any = { user_id: userId }
  
  if (data?.category) {
    const validCategories = ['政治', '英语', '数学', '专业课', '综合']
    if (validCategories.includes(data.category)) {
      query.category = data.category
    }
  }
  
  if (data?.is_correct !== undefined) {
    query.is_correct = Boolean(data.is_correct)
  }

  // 查询数据
  const [listRes, countRes] = await Promise.all([
    collection
      .where(query)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(limit)
      .get(),
    collection.where(query).count()
  ])

  logger.info(`[${requestId}] 获取答题记录: ${listRes.data.length}/${countRes.total}`)

  return {
    code: 0,
    success: true,
    data: listRes.data,
    total: countRes.total,
    page,
    limit,
    hasMore: skip + listRes.data.length < countRes.total,
    requestId
  }
}
