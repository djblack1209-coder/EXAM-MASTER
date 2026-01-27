/**
 * 错题本管理云函数 (Sealos 兼容版)
 * 
 * 功能：
 * 1. 添加错题 (add)
 * 2. 获取错题列表 (get)
 * 3. 删除错题 (remove)
 * 4. 更新错题状态 (updateStatus)
 * 5. 批量同步 (batchSync)
 * 
 * 请求参数：
 * - action: string (必填) - 操作类型
 * - userId: string (必填) - 用户ID
 * - data: object (可选) - 操作数据
 * 
 * 返回格式：
 * { code: 0, ok: true, data: {...}, message: 'success' }
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

// ==================== 参数校验 ====================
function sanitizeString(input: string, maxLength: number = 2000): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .substring(0, maxLength)
    .trim()
}

function validateAction(action: any): boolean {
  return typeof action === 'string' && 
         action.length > 0 && 
         action.length <= 50 && 
         /^[a-zA-Z_]+$/.test(action)
}

function validateUserId(userId: any): boolean {
  return typeof userId === 'string' && 
         userId.length > 0 && 
         userId.length <= 64
}

function validateMistakeData(data: any): { valid: boolean; error?: string; sanitized?: any } {
  if (!data || typeof data !== 'object') {
    return { valid: true, sanitized: {} }
  }
  
  const sanitized: any = {}
  
  // 校验并清理题目内容
  if (data.question_content !== undefined) {
    if (typeof data.question_content !== 'string') {
      return { valid: false, error: 'question_content 必须是字符串' }
    }
    if (data.question_content.length < 5) {
      return { valid: false, error: '题目内容至少5个字符' }
    }
    sanitized.question_content = sanitizeString(data.question_content, 2000)
  }
  
  // 校验选项
  if (data.options !== undefined) {
    if (!Array.isArray(data.options)) {
      return { valid: false, error: 'options 必须是数组' }
    }
    if (data.options.length > 10) {
      return { valid: false, error: '选项数量不能超过10个' }
    }
    sanitized.options = data.options.map((opt: any) => sanitizeString(String(opt), 500))
  }
  
  // 校验答案
  if (data.user_answer !== undefined) {
    sanitized.user_answer = sanitizeString(String(data.user_answer), 100)
  }
  if (data.correct_answer !== undefined) {
    sanitized.correct_answer = sanitizeString(String(data.correct_answer), 100)
  }
  
  // 校验分类
  if (data.category !== undefined) {
    const validCategories = ['政治', '英语', '数学', '专业课', '综合']
    if (!validCategories.includes(data.category)) {
      sanitized.category = '综合'
    } else {
      sanitized.category = data.category
    }
  }
  
  // 校验难度
  if (data.difficulty !== undefined) {
    const validDifficulties = ['easy', 'medium', 'hard']
    if (!validDifficulties.includes(data.difficulty)) {
      sanitized.difficulty = 'medium'
    } else {
      sanitized.difficulty = data.difficulty
    }
  }
  
  // 校验分页参数
  if (data.page !== undefined) {
    const page = parseInt(data.page, 10)
    sanitized.page = isNaN(page) || page < 1 ? 1 : Math.min(page, 1000)
  }
  if (data.limit !== undefined) {
    const limit = parseInt(data.limit, 10)
    sanitized.limit = isNaN(limit) || limit < 1 ? 50 : Math.min(limit, 100)
  }
  
  // 校验 ID
  if (data.id !== undefined) {
    if (typeof data.id !== 'string' || data.id.length > 64) {
      return { valid: false, error: 'id 格式不正确' }
    }
    sanitized.id = data.id
  }
  
  // 校验布尔值
  if (data.is_mastered !== undefined) {
    sanitized.is_mastered = Boolean(data.is_mastered)
  }
  
  // 其他字段直接复制（已清理）
  if (data.analysis !== undefined) {
    sanitized.analysis = sanitizeString(String(data.analysis), 5000)
  }
  if (data.tags !== undefined && Array.isArray(data.tags)) {
    sanitized.tags = data.tags.slice(0, 20).map((t: any) => sanitizeString(String(t), 50))
  }
  if (data.error_type !== undefined) {
    sanitized.error_type = sanitizeString(String(data.error_type), 50)
  }
  if (data.question_id !== undefined) {
    sanitized.question_id = sanitizeString(String(data.question_id), 64)
  }
  if (data.wrong_count !== undefined) {
    const count = parseInt(data.wrong_count, 10)
    sanitized.wrong_count = isNaN(count) || count < 1 ? 1 : Math.min(count, 1000)
  }
  
  return { valid: true, sanitized }
}

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info(`[${requestId}] 错题管理请求开始`)

  try {
    // 1. 参数校验（后端必须再校验一遍，不信任前端）
    const { action, userId, data } = ctx.body || {}

    if (!validateAction(action)) {
      return { code: 400, ok: false, message: '参数错误: action 不合法', requestId }
    }

    if (!validateUserId(userId)) {
      return { code: 401, ok: false, message: '用户未登录或 userId 不合法', requestId }
    }
    
    // 校验并清理 data
    const dataValidation = validateMistakeData(data)
    if (!dataValidation.valid) {
      return { code: 400, ok: false, message: `参数错误: ${dataValidation.error}`, requestId }
    }

    logger.info(`[${requestId}] action: ${action}, userId: ${userId}`)

    // 2. 路由到对应处理函数
    const handlers = {
      add: handleAdd,
      get: handleGet,
      remove: handleRemove,
      updateStatus: handleUpdateStatus,
      batchSync: handleBatchSync
    }

    const handler = handlers[action]
    if (!handler) {
      return { code: 400, ok: false, message: `不支持的操作: ${action}`, requestId }
    }

    // 3. 执行操作（使用清理后的数据）
    const result = await handler(userId, dataValidation.sanitized || data, requestId)

    // 4. 返回结果
    const duration = Date.now() - startTime
    logger.info(`[${requestId}] 操作完成，耗时: ${duration}ms`)

    return {
      ...result,
      requestId,
      duration
    }

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error(`[${requestId}] 错题管理异常:`, error)

    return {
      code: 500,
      ok: false,
      message: '服务器内部错误',
      error: error.message,
      requestId,
      duration
    }
  }
}

/**
 * 添加错题
 */
async function handleAdd(userId, data, requestId) {
  if (!data || !data.question_content) {
    return { code: 400, ok: false, message: '参数错误: 题目内容不能为空' }
  }

  const collection = db.collection('mistake_book')
  const now = Date.now()

  // 检查是否已存在相同题目（基于题目内容的前100字符去重）
  // 使用简单的字符串匹配代替正则，兼容 Sealos
  const questionKey = (data.question_content || '').substring(0, 100)

  // 先查询该用户的所有错题，然后在内存中匹配
  const userMistakes = await collection.where({
    user_id: userId
  }).limit(500).get()

  // 在内存中查找是否有匹配的题目
  const existing = userMistakes.data.find(m =>
    m.question_content && m.question_content.substring(0, 100) === questionKey
  )

  if (existing) {
    // 已存在，更新错误次数
    await collection.doc(existing._id).update({
      wrong_count: _.inc(1),
      updated_at: now,
      is_mastered: false // 再次做错，重置掌握状态
    })

    logger.info(`[${requestId}] 错题已存在，更新错误次数: ${existing._id}`)

    return {
      code: 0,
      ok: true,
      id: existing._id,
      _id: existing._id,
      message: '错题已更新',
      isUpdate: true
    }
  }

  // 新增错题
  const mistake = {
    user_id: userId,
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
    next_review_time: now + 24 * 60 * 60 * 1000, // 默认1天后复习
    ease_factor: 2.5,
    interval_days: 1,
    created_at: now,
    updated_at: now
  }

  const result = await collection.add(mistake)

  logger.info(`[${requestId}] 新增错题成功: ${result.id}`)

  return {
    code: 0,
    ok: true,
    id: result.id,
    _id: result.id,
    message: '添加成功'
  }
}

/**
 * 获取错题列表
 */
async function handleGet(userId, data, requestId) {
  const collection = db.collection('mistake_book')

  // 构建查询条件
  const query = { user_id: userId }

  // 可选筛选条件
  if (data?.is_mastered !== undefined) {
    query.is_mastered = data.is_mastered
  }
  if (data?.category) {
    query.category = data.category
  }
  if (data?.error_type) {
    query.error_type = data.error_type
  }

  // 分页参数
  const page = data?.page || 1
  const limit = Math.min(data?.limit || 50, 100) // 最大100条
  const skip = (page - 1) * limit

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

  logger.info(`[${requestId}] 查询错题列表: ${listRes.data.length}/${countRes.total}`)

  return {
    code: 0,
    ok: true,
    data: listRes.data,
    total: countRes.total,
    page,
    limit,
    hasMore: skip + listRes.data.length < countRes.total,
    message: '获取成功'
  }
}

/**
 * 删除错题
 */
async function handleRemove(userId, data, requestId) {
  if (!data?.id) {
    return { code: 400, ok: false, message: '参数错误: id 不能为空' }
  }

  const collection = db.collection('mistake_book')

  // 验证权限：只能删除自己的错题
  const mistake = await collection.where({
    _id: data.id,
    user_id: userId
  }).getOne()

  if (!mistake.data) {
    logger.warn(`[${requestId}] 错题不存在或无权限: ${data.id}`)
    return { code: 0, ok: true, deleted: 0, message: '错题不存在' }
  }

  // 执行删除
  const result = await collection.doc(data.id).remove()

  logger.info(`[${requestId}] 删除错题成功: ${data.id}`)

  return {
    code: 0,
    ok: true,
    deleted: result.deleted || 1,
    message: '删除成功'
  }
}

/**
 * 更新错题状态（掌握/未掌握）
 */
async function handleUpdateStatus(userId, data, requestId) {
  if (!data?.id) {
    return { code: 400, ok: false, message: '参数错误: id 不能为空' }
  }

  const collection = db.collection('mistake_book')
  const now = Date.now()

  // 验证权限
  const mistake = await collection.where({
    _id: data.id,
    user_id: userId
  }).getOne()

  if (!mistake.data) {
    logger.warn(`[${requestId}] 错题不存在或无权限: ${data.id}`)
    return { code: 404, ok: false, message: '错题不存在' }
  }

  // 计算 SM-2 算法参数
  const isMastered = Boolean(data.is_mastered)
  let updateData = {
    is_mastered: isMastered,
    last_review_time: now,
    review_count: _.inc(1),
    updated_at: now
  }

  if (isMastered) {
    // 掌握了，增加复习间隔
    const currentEF = mistake.data.ease_factor || 2.5
    const currentInterval = mistake.data.interval_days || 1

    // SM-2 算法：新间隔 = 旧间隔 * EF
    const newInterval = Math.min(Math.round(currentInterval * currentEF), 180) // 最大180天
    const newEF = Math.max(currentEF + 0.1, 1.3) // EF 增加，最小1.3

    updateData.interval_days = newInterval
    updateData.ease_factor = newEF
    updateData.next_review_time = now + newInterval * 24 * 60 * 60 * 1000
  } else {
    // 没掌握，重置间隔
    const currentEF = mistake.data.ease_factor || 2.5
    const newEF = Math.max(currentEF - 0.2, 1.3) // EF 减少

    updateData.interval_days = 1
    updateData.ease_factor = newEF
    updateData.next_review_time = now + 24 * 60 * 60 * 1000 // 1天后复习
  }

  // 执行更新
  const result = await collection.doc(data.id).update(updateData)

  logger.info(`[${requestId}] 更新错题状态: ${data.id}, is_mastered: ${isMastered}`)

  return {
    code: 200,
    ok: true,
    updated: result.updated || 1,
    id: data.id,
    message: isMastered ? '已标记为掌握' : '已标记为未掌握'
  }
}

/**
 * 批量同步错题
 */
async function handleBatchSync(userId, data, requestId) {
  if (!data?.mistakes || !Array.isArray(data.mistakes)) {
    return { code: 400, ok: false, message: '参数错误: mistakes 必须是数组' }
  }

  const collection = db.collection('mistake_book')
  const now = Date.now()

  let synced = 0
  let failed = 0
  const results = []

  for (const mistake of data.mistakes) {
    try {
      const mistakeData = {
        user_id: userId,
        question_content: mistake.question_content || mistake.question,
        options: mistake.options || [],
        user_answer: mistake.user_answer || mistake.userChoice,
        correct_answer: mistake.correct_answer || mistake.answer,
        analysis: mistake.analysis || mistake.desc || '',
        category: mistake.category || '综合',
        tags: mistake.tags || [],
        is_mastered: mistake.is_mastered || false,
        wrong_count: mistake.wrong_count || 1,
        review_count: 0,
        ease_factor: 2.5,
        interval_days: 1,
        next_review_time: now + 24 * 60 * 60 * 1000,
        created_at: now,
        updated_at: now
      }

      const result = await collection.add(mistakeData)
      results.push({ oldId: mistake.id, newId: result.id, success: true })
      synced++
    } catch (error) {
      logger.error(`[${requestId}] 同步错题失败:`, error)
      results.push({ oldId: mistake.id, success: false, error: error.message })
      failed++
    }
  }

  logger.info(`[${requestId}] 批量同步完成: 成功 ${synced}, 失败 ${failed}`)

  return {
    code: 0,
    ok: true,
    synced,
    failed,
    results,
    message: `同步完成: ${synced} 成功, ${failed} 失败`
  }
}
