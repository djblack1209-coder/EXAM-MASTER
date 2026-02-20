/**
 * 错题本管理云函数 (Sealos 兼容版)
 * 
 * 功能：
 * 1. 添加错题 (add)
 * 2. 获取错题列表 (get)
 * 3. 删除错题 (remove)
 * 4. 更新错题状态 (updateStatus)
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
 * { code: 0, ok: true, data: {...}, message: 'success' }
 * 
 * @version 2.0.0
 */

import cloud from '@lafjs/cloud'
import { verifyJWT } from './login'
import { sanitizeString, validateAction, validateUserId, createLogger, generateRequestId } from './_shared/api-response'

const db = cloud.database()
const _ = db.command

// ✅ E004: 简单的内容哈希函数（用于去重，非密码学用途）
function contentHash(str: string): string {
  let hash = 0
  const s = (str || '').substring(0, 200)
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i)
    hash = ((hash << 5) - hash) + ch
    hash |= 0 // 转为32位整数
  }
  return 'h_' + (hash >>> 0).toString(36)
}

// ==================== 日志工具 ====================
const logger = createLogger('[MistakeManager]')

// ==================== 用户身份验证 ====================
/**
 * 验证用户身份和权限
 * @param userId 请求中的用户ID
 * @param token 用户token（可选）
 * @param headers 请求头
 * @returns 验证结果
 */
async function verifyUserAuth(userId: string, token?: string, headers?: Record<string, string>): Promise<{ valid: boolean; error?: string }> {
  // ✅ B006: 使用完整的 JWT 签名验证，而非仅解析 payload
  if (token) {
    // 去除 Bearer 前缀
    const rawToken = token.startsWith('Bearer ') ? token.slice(7) : token
    const payload = verifyJWT(rawToken)
    
    if (!payload) {
      return { valid: false, error: 'token 无效或已过期，请重新登录' }
    }
    
    // 检查 userId 是否匹配
    if (payload.userId && payload.userId !== userId) {
      logger.warn(`[Auth] userId 不匹配: token=${payload.userId}, request=${userId}`)
      return { valid: false, error: '用户身份验证失败' }
    }
  } else {
    // 没有 token 时，必须拒绝请求（所有环境）
    return { valid: false, error: '缺少认证 token，请重新登录' }
  }
  
  // 检查请求头中的用户标识（如果有）
  const headerUserId = headers?.['x-user-id']
  if (headerUserId && headerUserId !== userId) {
    logger.warn(`[Auth] 请求头 userId 不匹配: header=${headerUserId}, body=${userId}`)
    return { valid: false, error: '用户身份验证失败' }
  }
  
  return { valid: true }
}

// ==================== 参数校验 ====================
// sanitizeString, validateAction, validateUserId 已从 _shared/api-response 导入

function validateMistakeData(data: unknown): { valid: boolean; error?: string; sanitized?: Record<string, unknown> } {
  if (!data || typeof data !== 'object') {
    return { valid: true, sanitized: {} }
  }
  
  const sanitized: Record<string, unknown> = {}
  
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
    sanitized.options = data.options.map((opt: unknown) => sanitizeString(String(opt), 500))
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
    sanitized.tags = data.tags.slice(0, 20).map((t: unknown) => sanitizeString(String(t), 50))
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

export default async function (ctx: FunctionContext) {
  const startTime = Date.now()
  const requestId = generateRequestId('mm')

  logger.info(`[${requestId}] 错题管理请求开始`)

  try {
    // 1. 参数校验（后端必须再校验一遍，不信任前端）
    const { action, userId, data, token } = ctx.body || {}

    if (!validateAction(action)) {
      return { code: 400, ok: false, message: '参数错误: action 不合法', requestId }
    }

    if (!validateUserId(userId)) {
      return { code: 401, ok: false, message: '用户未登录或 userId 不合法', requestId }
    }
    
    // 2. 用户身份验证（增强权限检查）
    // 验证 token 与 userId 是否匹配，防止越权访问
    const authResult = await verifyUserAuth(userId, token, ctx.headers)
    if (!authResult.valid) {
      logger.warn(`[${requestId}] 权限校验失败: ${authResult.error}`)
      return { code: 403, ok: false, message: authResult.error || '权限验证失败', requestId }
    }
    
    // 校验并清理 data
    const dataValidation = validateMistakeData(data)
    if (!dataValidation.valid) {
      return { code: 400, ok: false, message: `参数错误: ${dataValidation.error}`, requestId }
    }

    logger.info(`[${requestId}] action: ${action}, userId: ${userId}`)

    // 3. 路由到对应处理函数
    const handlers = {
      add: handleAdd,
      get: handleGet,
      remove: handleRemove,
      updateStatus: handleUpdateStatus,
      batchSync: handleBatchSync,
      getCategories: handleGetCategories,
      manageTags: handleManageTags,
      getByTags: handleGetByTags
    }

    const handler = handlers[action]
    if (!handler) {
      return { code: 400, ok: false, message: `不支持的操作: ${action}`, requestId }
    }

    // 4. 执行操作（使用清理后的数据）
    const result = await handler(userId, dataValidation.sanitized || data, requestId)

    // 5. 返回结果
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

    // P015: 错误分类，提供更精确的错误码和信息
    const errMsg = error.message || ''
    let code = 500
    let message = '服务器内部错误'

    if (errMsg.includes('not found') || errMsg.includes('不存在')) {
      code = 404
      message = '请求的资源不存在'
    } else if (errMsg.includes('duplicate') || errMsg.includes('已存在')) {
      code = 409
      message = '数据已存在，请勿重复操作'
    } else if (errMsg.includes('validation') || errMsg.includes('参数')) {
      code = 400
      message = errMsg
    } else if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT')) {
      code = 504
      message = '数据库请求超时，请稍后重试'
    }

    return {
      code,
      ok: false,
      message,
      error: error.message,
      requestId,
      duration
    }
  }
}

/**
 * 添加错题
 * ✅ E004: 使用内容哈希去重，避免拉取500条记录到内存
 */
async function handleAdd(userId, data, requestId) {
  if (!data || !data.question_content) {
    return { code: 400, ok: false, message: '参数错误: 题目内容不能为空' }
  }

  const collection = db.collection('mistake_book')
  const now = Date.now()

  // 使用内容哈希进行 O(1) 去重查询
  const qHash = contentHash(data.question_content)

  const existing = await collection.where({
    user_id: userId,
    _content_hash: qHash
  }).getOne()

  if (existing.data) {
    // 二次验证：哈希碰撞时比较前100字符
    const existingKey = (existing.data.question_content || '').substring(0, 100)
    const newKey = (data.question_content || '').substring(0, 100)
    if (existingKey === newKey) {
      await collection.doc(existing.data._id).update({
        wrong_count: _.inc(1),
        updated_at: now,
        is_mastered: false
      })

      logger.info(`[${requestId}] 错题已存在，更新错误次数: ${existing.data._id}`)

      return {
        code: 0,
        ok: true,
        id: existing.data._id,
        _id: existing.data._id,
        message: '错题已更新',
        isUpdate: true
      }
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
    next_review_time: now + 24 * 60 * 60 * 1000,
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
    code: 0,
    ok: true,
    updated: result.updated || 1,
    id: data.id,
    message: isMastered ? '已标记为掌握' : '已标记为未掌握'
  }
}

/**
 * 批量同步错题
 * ✅ E004: 并行批量插入（每批5条），替代逐条顺序插入
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

  // 并行批量插入，每批5条
  const BATCH_SIZE = 5
  for (let i = 0; i < data.mistakes.length; i += BATCH_SIZE) {
    const batch = data.mistakes.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(async (mistake) => {
        const questionContent = mistake.question_content || mistake.question || ''
        const qHash = contentHash(questionContent)

        // 去重检查：与 handleAdd 保持一致
        const existing = await collection.where({
          user_id: userId,
          _content_hash: qHash
        }).getOne()

        if (existing.data) {
          const existingKey = (existing.data.question_content || '').substring(0, 100)
          const newKey = questionContent.substring(0, 100)
          if (existingKey === newKey) {
            // 已存在，更新错误次数
            await collection.doc(existing.data._id).update({
              wrong_count: _.inc(mistake.wrong_count || 1),
              updated_at: now,
              is_mastered: false
            })
            return { oldId: mistake.id, newId: existing.data._id, isUpdate: true }
          }
        }

        // 新增
        const mistakeData = {
          user_id: userId,
          _content_hash: qHash,
          question_content: questionContent,
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
        return { oldId: mistake.id, newId: result.id, isUpdate: false }
      })
    )

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push({ ...r.value, success: true })
        synced++
      } else {
        results.push({ success: false, error: r.reason?.message })
        failed++
      }
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

/**
 * 获取错题分类统计 (v2.0新增)
 * ✅ P3-FIX: 使用 aggregate 管道在数据库层面完成统计，避免拉取 2000 条到内存
 */
async function handleGetCategories(userId, data, requestId) {
  const collection = db.collection('mistake_book')
  const now = Date.now()

  try {
    // 使用聚合管道在数据库层面完成分类统计
    const categoryResult = await collection.aggregate()
      .match({ user_id: userId })
      .group({
        _id: { $ifNull: ['$category', '综合'] },
        total: { $sum: 1 },
        mastered: { $sum: { $cond: [{ $eq: ['$is_mastered', true] }, 1, 0] } },
        unmastered: { $sum: { $cond: [{ $ne: ['$is_mastered', true] }, 1, 0] } },
        review_needed: {
          $sum: {
            $cond: [
              { $and: [
                { $ne: ['$next_review_time', null] },
                { $lte: ['$next_review_time', now] }
              ] },
              1, 0
            ]
          }
        }
      })
      .end()

    // 错误类型统计
    const errorTypeResult = await collection.aggregate()
      .match({ user_id: userId })
      .group({
        _id: { $ifNull: ['$error_type', 'unknown'] },
        count: { $sum: 1 }
      })
      .end()

    // 总体统计
    const summaryResult = await collection.aggregate()
      .match({ user_id: userId })
      .group({
        _id: null,
        total: { $sum: 1 },
        mastered: { $sum: { $cond: [{ $eq: ['$is_mastered', true] }, 1, 0] } },
        review_needed: {
          $sum: {
            $cond: [
              { $and: [
                { $ne: ['$next_review_time', null] },
                { $lte: ['$next_review_time', now] }
              ] },
              1, 0
                   }
        }
      })
      .end()

    const categories = (categoryResult.data || []).map((stat: Record<string, unknown>) => ({
      category: stat._id,
      total: stat.total,
      mastered: stat.mastered,
      unmastered: stat.unmastered,
      review_needed: stat.review_needed,
      mastery_rate: stat.total > 0 ? Math.round(((stat.mastered as number) / (stat.total as number)) * 100) : 0
    }))

    const errorTypes = (errorTypeResult.data || []).map((et: Record<string, unknown>) => ({
      type: et._id,
      count: et.count
    }))

    const summary = summaryResult.data?.[0] || { total: 0, mastered: 0, review_needed: 0 }

    logger.info(`[${requestId}] 获取分类统计: ${categories.length} 个分类`)

    return {
      code: 0,
      ok: true,
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
    }
  } catch (aggError) {
    // 聚合管道不可用时降级为原始查询方式
    logger.warn(`[${requestId}] 聚合查询失败，降级为内存统计:`, aggError.message)

    const allMistakes = await collection.where({
      user_id: userId
    }).field({
      category: true,
      error_type: true,
      is_mastered: true,
      next_review_time: true
    }).limit(2000).get()

    const categoryStats = {}
    const errorTypeStats = {}

    for (const mistake of allMistakes.data) {
      const category = mistake.category || '综合'
      const errorType = mistake.error_type || 'unknown'

      if (!categoryStats[category]) {
        categoryStats[category] = { category, total: 0, mastered: 0, unmastered: 0, review_needed: 0 }
      }
      categoryStats[category].total++
      if (mistake.is_mastered) categoryStats[category].mastered++
      else categoryStats[category].unmastered++
      if (mistake.next_review_time && mistake.next_review_time <= now) categoryStats[category].review_needed++

      if (!errorTypeStats[errorType]) errorTypeStats[errorType] = { type: errorType, count: 0 }
      errorTypeStats[errorType].count++
    }

    const categories = Object.values(categoryStats).map((stat: Record<string, unknown>) => ({
      ...stat,
      mastery_rate: stat.total > 0 ? Math.round((stat.mastered / stat.total) * 100) : 0
    }))

    return {
      code: 0,
      ok: true,
      data: {
        categories,
        errorTypes: Object.values(errorTypeStats),
        summary: {
          total: allMistakes.data.length,
          mastered: allMistakes.data.filter(m => m.is_mastered).length,
          review_needed: allMistakes.data.filter(m => m.next_review_time && m.next_review_time <= now).length
        }
      },
      message: '获取成功'
    }
  }
}

/**
 * 管理错题标签 (v2.0新增)
 * 支持添加、删除、重命名标签
 */
async function handleManageTags(userId, data, requestId) {
  const { action: tagAction, mistakeId, tags, oldTag, newTag } = data || {}

  const collection = db.collection('mistake_book')

  switch (tagAction) {
    case 'add': {
      // 为错题添加标签
      if (!mistakeId || !tags || !Array.isArray(tags)) {
        return { code: 400, ok: false, message: '参数错误: 需要 mistakeId 和 tags' }
      }

      // 验证权限
      const mistake = await collection.where({
        _id: mistakeId,
        user_id: userId
      }).getOne()

      if (!mistake.data) {
        return { code: 404, ok: false, message: '错题不存在或无权限' }
      }

      // 合并标签（去重）
      const existingTags = mistake.data.tags || []
      const newTags = [...new Set([...existingTags, ...tags.slice(0, 20)])]

      await collection.doc(mistakeId).update({
        tags: newTags,
        updated_at: Date.now()
      })

      logger.info(`[${requestId}] 添加标签成功: ${mistakeId}`)

      return {
        code: 0,
        ok: true,
        data: { tags: newTags },
        message: '标签添加成功'
      }
    }

    case 'remove': {
      // 从错题移除标签
      if (!mistakeId || !tags || !Array.isArray(tags)) {
        return { code: 400, ok: false, message: '参数错误: 需要 mistakeId 和 tags' }
      }

      const mistake = await collection.where({
        _id: mistakeId,
        user_id: userId
      }).getOne()

      if (!mistake.data) {
        return { code: 404, ok: false, message: '错题不存在或无权限' }
      }

      const existingTags = mistake.data.tags || []
      const tagsToRemove = new Set(tags)
      const newTags = existingTags.filter(t => !tagsToRemove.has(t))

      await collection.doc(mistakeId).update({
        tags: newTags,
        updated_at: Date.now()
      })

      logger.info(`[${requestId}] 移除标签成功: ${mistakeId}`)

      return {
        code: 0,
        ok: true,
        data: { tags: newTags },
        message: '标签移除成功'
      }
    }

    case 'rename': {
      // 批量重命名标签（用户所有错题中的该标签）
      // ✅ E004: 只拉取含目标标签的记录，减少内存占用
      if (!oldTag || !newTag) {
        return { code: 400, ok: false, message: '参数错误: 需要 oldTag 和 newTag' }
      }

      // 只查询包含 oldTag 的错题，避免全量拉取
      const mistakes = await collection.where({
        user_id: userId,
        tags: oldTag
      }).field({ tags: true }).limit(2000).get()

      // 查询已精确匹配 oldTag，直接使用结果
      const toUpdate = mistakes.data

      // 并行批量更新（每批10条）
      let updated = 0
      const BATCH = 10
      for (let i = 0; i < toUpdate.length; i += BATCH) {
        const batch = toUpdate.slice(i, i + BATCH)
        const results = await Promise.allSettled(
          batch.map((m) => {
            const newTags = m.tags.map((t) => t === oldTag ? newTag : t)
            return collection.doc(m._id).update({
              tags: newTags,
              updated_at: Date.now()
            })
          })
        )
        updated += results.filter((r) => r.status === 'fulfilled').length
      }

      logger.info(`[${requestId}] 重命名标签成功: ${oldTag} -> ${newTag}, 更新 ${updated} 条`)

      return {
        code: 0,
        ok: true,
        data: { updated },
        message: `标签重命名成功，更新了 ${updated} 条错题`
      }
    }

    case 'list': {
      // 获取用户所有标签及使用次数
      // 优先使用聚合管道在 DB 层统计，避免拉取大量记录到内存
      try {
        const aggResult = await db.collection('mistake_book').aggregate()
          .match({ user_id: userId, tags: { $exists: true, $ne: [] } })
          .unwind('$tags')
          .group({ _id: '$tags', count: { $sum: 1 } })
          .sort({ count: -1 })
          .end()

        const tagList = (aggResult.data || []).map((item) => ({
          tag: item._id,
          count: item.count
        }))

        return {
          code: 0,
          ok: true,
          data: tagList,
          message: '获取成功'
        }
      } catch (aggErr) {
        // 聚合不可用时降级为内存统计
        logger.warn(`[${requestId}] 标签聚合失败，降级为内存统计:`, aggErr.message)

        const mistakes = await collection.where({
          user_id: userId
        }).field({ tags: true }).limit(2000).get()

        const tagCounts = {}
        for (const mistake of mistakes.data) {
          if (mistake.tags && Array.isArray(mistake.tags)) {
            for (const tag of mistake.tags) {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1
            }
          }
        }

        const tagList = Object.entries(tagCounts)
          .map(([tag, count]) => ({ tag, count }))
          .sort((a, b) => (b.count as number) - (a.count as number))

        return {
          code: 0,
          ok: true,
          data: tagList,
          message: '获取成功'
        }
      }
    }

    default:
      return { code: 400, ok: false, message: '不支持的标签操作' }
  }
}

/**
 * 按标签筛选错题 (v2.0新增)
 * ✅ P3-FIX: 使用 DB 级 $in/$all 操作符替代内存筛选，避免拉取 2000 条到内存
 */
async function handleGetByTags(userId, data, requestId) {
  const { tags, matchAll = false, page = 1, limit = 50 } = data || {}

  if (!tags || !Array.isArray(tags) || tags.length === 0) {
    return { code: 400, ok: false, message: '参数错误: tags 必须是非空数组' }
  }

  const collection = db.collection('mistake_book')
  const safeLimit = Math.min(limit, 100)
  const skip = (Math.max(1, page) - 1) * safeLimit

  // 在数据库层面过滤标签，避免全量拉取到内存
  const tagFilter = matchAll
    ? { tags: _.all(tags) }   // 必须包含所有指定标签
    : { tags: _.in(tags) }    // 包含任意一个指定标签

  const whereCondition = { user_id: userId, ...tagFilter }

  // 并行查询数据和总数
  const [result, countResult] = await Promise.all([
    collection.where(whereCondition)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(safeLimit)
      .get(),
    collection.where(whereCondition).count()
  ])

  const total = countResult.total || 0

  logger.info(`[${requestId}] 按标签筛选: ${result.data.length}/${total}`)

  return {
    code: 0,
    ok: true,
    data: result.data,
    total,
    page,
    limit,
    hasMore: skip + result.data.length < total,
    message: '获取成功'
  }
}
