/**
 * 收藏管理云函数
 * 
 * 功能：
 * 1. 添加收藏 (add)
 * 2. 获取收藏列表 (get)
 * 3. 删除收藏 (remove)
 * 4. 检查是否已收藏 (check)
 * 5. 批量操作 (batchAdd, batchRemove)
 * 6. 获取收藏分类统计 (getCategories)
 * 7. 按分类筛选收藏 (getByCategory)
 * 
 * 请求参数：
 * - action: string (必填) - 操作类型
 * - userId: string (必填) - 用户ID
 * - data: object (可选) - 操作数据
 * 
 * 返回格式：
 * { code: 0, success: true, data: {...}, message: 'success' }
 * 
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud'

const db = cloud.database()
const _ = db.command

// ==================== 环境配置 ====================
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'warn' : 'info')

// ==================== 日志工具 ====================
const logger = {
  info: (...args: unknown[]) => { if (LOG_LEVEL !== 'warn' && LOG_LEVEL !== 'error') console.log(...args) },
  warn: (...args: unknown[]) => { if (LOG_LEVEL !== 'error') console.warn(...args) },
  error: (...args: unknown[]) => console.error(...args)
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

function validateAction(action: unknown): boolean {
  return typeof action === 'string' && 
         action.length > 0 && 
         action.length <= 50 && 
         /^[a-zA-Z_]+$/.test(action)
}

function validateUserId(userId: unknown): boolean {
  return typeof userId === 'string' && 
         userId.length > 0 && 
         userId.length <= 64
}

// ==================== 主入口 ====================
export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info(`[${requestId}] 收藏管理请求开始`)

  try {
    const { action, userId, data } = ctx.body || {}

    // 参数校验
    if (!validateAction(action)) {
      return { code: 400, success: false, message: '参数错误: action 不合法', requestId }
    }

    if (!validateUserId(userId)) {
      return { code: 401, success: false, message: '用户未登录或 userId 不合法', requestId }
    }

    logger.info(`[${requestId}] action: ${action}, userId: ${userId}`)

    // 路由到对应处理函数
    const handlers = {
      add: handleAdd,
      get: handleGet,
      remove: handleRemove,
      check: handleCheck,
      batchAdd: handleBatchAdd,
      batchRemove: handleBatchRemove,
      getCategories: handleGetCategories,
      getByCategory: handleGetByCategory
    }

    const handler = handlers[action]
    if (!handler) {
      return { code: 400, success: false, message: `不支持的操作: ${action}`, requestId }
    }

    // 执行操作
    const result = await handler(userId, data || {}, requestId)

    // 返回结果
    const duration = Date.now() - startTime
    logger.info(`[${requestId}] 操作完成，耗时: ${duration}ms`)

    return {
      ...result,
      requestId,
      duration
    }

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error(`[${requestId}] 收藏管理异常:`, error)

    return {
      code: 500,
      success: false,
      message: '服务器内部错误',
    error: error.message,
      requestId,
      duration
    }
  }
}

/**
 * 添加收藏
 */
async function handleAdd(userId: string, data: Record<string, unknown>, requestId: string) {
  const { questionId, question, options, answer, analysis, category, tags, source } = data

  if (!questionId && !question) {
    return { code: 400, success: false, message: '参数错误: questionId 或 question 不能为空' }
  }

  const collection = db.collection('favorites')
  const now = Date.now()

  // 检查是否已收藏
  const existing = await collection.where({
    user_id: userId,
    $or: [
      { question_id: questionId },
      { question_content: question ? question.substring(0, 100) : '' }
    ]
  }).getOne()

  if (existing.data) {
    logger.info(`[${requestId}] 题目已收藏: ${existing.data._id}`)
    return {
      code: 0,
      success: true,
      id: existing.data._id,
      message: '题目已在收藏中',
      isExisting: true
    }
  }

  // 新增收藏
  const favorite = {
    user_id: userId,
    question_id: questionId || null,
    question_content: sanitizeString(question || '', 2000),
    options: Array.isArray(options) ? options.map(opt => sanitizeString(String(opt), 500)) : [],
    correct_answer: sanitizeString(answer || '', 100),
    analysis: sanitizeString(analysis || '', 5000),
    category: sanitizeString(category || '综合', 50),
    tags: Array.isArray(tags) ? tags.slice(0, 20).map(t => sanitizeString(String(t), 50)) : [],
    source: sanitizeString(source || 'manual', 50),
    review_count: 0,
    last_review_time: null,
    created_at: now,
    updated_at: now
  }

  const result = await collection.add(favorite)

  logger.info(`[${requestId}] 新增收藏成功: ${result.id}`)

  return {
    code: 0,
    success: true,
    id: result.id,
    message: '收藏成功'
  }
}

/**
 * 获取收藏列表
 */
async function handleGet(userId: string, data: Record<string, unknown>, requestId: string) {
  const collection = db.collection('favorites')

  // 构建查询条件
  const query: Record<string, unknown> = { user_id: userId }

  // 可选筛选条件
  if (data.category) {
    query.category = data.category
  }
  if (data.source) {
    query.source = data.source
  }

  // 分页参数
  const page = Math.max(1, parseInt(data.page) || 1)
  const limit = Math.min(Math.max(1, parseInt(data.limit) || 50), 100)
  const skip = (page - 1) * limit

  // 排序
  const sortField = data.sortBy || 'created_at'
  const sortOrder = data.sortOrder === 'asc' ? 'asc' : 'desc'

  // 查询数据
  const [listRes, countRes] = await Promise.all([
    collection
      .where(query)
      .orderBy(sortField, sortOrder)
      .skip(skip)
      .limit(limit)
      .get(),
    collection.where(query).count()
  ])

  logger.info(`[${requestId}] 查询收藏列表: ${listRes.data.length}/${countRes.total}`)

  return {
    code: 0,
    success: true,
    data: listRes.data,
    total: countRes.total,
    page,
    limit,
    hasMore: skip + listRes.data.length < countRes.total,
    message: '获取成功'
  }
}

/**
 * 删除收藏
 */
async function handleRemove(userId: string, data: Record<string, unknown>, requestId: string) {
  const { id, questionId } = data

  if (!id && !questionId) {
    return { code: 400, success: false, message: '参数错误: id 或 questionId 不能为空' }
  }

  const collection = db.collection('favorites')

  // 构建查询条件
  const query: Record<string, unknown> = { user_id: userId }
  if (id) {
    query._id = id
  } else if (questionId) {
    query.question_id = questionId
  }

  // 验证权限并删除
  const favorite = await collection.where(query).getOne()

  if (!favorite.data) {
    logger.warn(`[${requestId}] 收藏不存在或无权限`)
    return { code: 0, success: true, deleted: 0, message: '收藏不存在' }
  }

  // 执行删除
  const result = await collection.doc(favorite.data._id).remove()

  logger.info(`[${requestId}] 删除收藏成功: ${favorite.data._id}`)

  return {
    code: 0,
    success: true,
    deleted: result.deleted || 1,
    message: '取消收藏成功'
  }
}

/**
 * 检查是否已收藏
 */
async function handleCheck(userId: string, data: Record<string, unknown>, requestId: string) {
  const { questionId, questionIds } = data

  const collection = db.collection('favorites')

  // 批量检查
  if (Array.isArray(questionIds) && questionIds.length > 0) {
    const favorites = await collection.where({
      user_id: userId,
      question_id: _.in(questionIds.slice(0, 100))
    }).field({ question_id: true }).get()

    const favoriteSet = new Set(favorites.data.map(f => f.question_id))
    const result = questionIds.reduce((acc, qid) => {
      acc[qid] = favoriteSet.has(qid)
      return acc
    }, {})

    return {
      code: 0,
      success: true,
      data: result,
      message: '检查完成'
    }
  }

  // 单个检查
  if (!questionId) {
    return { code: 400, success: false, message: '参数错误: questionId 不能为空' }
  }

  const favorite = await collection.where({
    user_id: userId,
    question_id: questionId
  }).getOne()

  return {
    code: 0,
    success: true,
    data: {
      isFavorite: !!favorite.data,
      favoriteId: favorite.data?._id || null
    },
    message: '检查完成'
  }
}

/**
 * 批量添加收藏
 */
async function handleBatchAdd(userId: string, data: Record<string, unknown>, requestId: string) {
  const { questions } = data

  if (!Array.isArray(questions) || questions.length === 0) {
    return { code: 400, success: false, message: '参数错误: questions 必须是非空数组' }
  }

  const collection = db.collection('favorites')
  const now = Date.now()

  let added = 0
  let skipped = 0
  const results = []

  for (const q of questions.slice(0, 50)) { // 最多50条
    try {
      // 检查是否已存在
      const existing = await collection.where({
        user_id: userId,
        question_id: q.questionId || q.id
      }).getOne()

      if (existing.data) {
        skipped++
        results.push({ id: q.questionId || q.id, success: true, skipped: true })
        continue
      }

      // 添加收藏
      const favorite = {
        user_id: userId,
        question_id: q.questionId || q.id || null,
        question_content: sanitizeString(q.question || q.content || '', 2000),
        options: Array.isArray(q.options) ? q.options : [],
        correct_answer: sanitizeString(q.answer || q.correctAnswer || '', 100),
        analysis: sanitizeString(q.analysis || q.desc || '', 5000),
        category: sanitizeString(q.category || '综合', 50),
        tags: Array.isArray(q.tags) ? q.tags.slice(0, 20) : [],
        source: 'batch',
        review_count: 0,
        last_review_time: null,
        created_at: now,
        updated_at: now
      }

      const result = await collection.add(favorite)
      added++
      results.push({ id: q.questionId || q.id, newId: result.id, success: true })
    } catch (error) {
      results.push({ id: q.questionId || q.id, success: false, error: error.message })
    }
  }

  logger.info(`[${requestId}] 批量添加收藏: 成功 ${added}, 跳过 ${skipped}`)

  return {
    code: 0,
    success: true,
    data: { added, skipped, results },
    message: `添加完成: ${added} 成功, ${skipped} 已存在`
  }
}

/**
 * 批量删除收藏
 */
async function handleBatchRemove(userId: string, data: Record<string, unknown>, requestId: string) {
  const { ids, questionIds } = data

  const collection = db.collection('favorites')
  let deleted = 0

  // 按收藏ID删除
  if (Array.isArray(ids) && ids.length > 0) {
    for (const id of ids.slice(0, 100)) {
      try {
        const result = await collection.where({
          _id: id,
          user_id: userId
        }).remove()
        deleted += result.deleted || 0
      } catch (e) {
        logger.warn(`[${requestId}] 删除收藏失败: ${id}`, e)
      }
    }
  }

  // 按题目ID删除
  if (Array.isArray(questionIds) && questionIds.length > 0) {
    for (const qid of questionIds.slice(0, 100)) {
      try {
        const result = await collection.where({
          question_id: qid,
          user_id: userId
        }).remove()
        deleted += result.deleted || 0
      } catch (e) {
        logger.warn(`[${requestId}] 删除收藏失败: ${qid}`, e)
      }
    }
  }

  logger.info(`[${requestId}] 批量删除收藏: ${deleted} 条`)

  return {
    code: 0,
    success: true,
    data: { deleted },
    message: `删除完成: ${deleted} 条`
  }
}

/**
 * 获取收藏分类统计
 */
async function handleGetCategories(userId: string, data: Record<string, unknown>, requestId: string) {
  const collection = db.collection('favorites')

  // 获取用户所有收藏
  const allFavorites = await collection.where({
    user_id: userId
  }).field({ category: true, source: true, created_at: true }).limit(2000).get()

  // 按分类统计
  const categoryStats = {}
  const sourceStats = {}

  for (const fav of allFavorites.data) {
    const category = fav.category || '综合'
    const source = fav.source || 'manual'

    // 分类统计
    if (!categoryStats[category]) {
      categoryStats[category] = { category, count: 0 }
    }
    categoryStats[category].count++

    // 来源统计
    if (!sourceStats[source]) {
      sourceStats[source] = { source, count: 0 }
    }
    sourceStats[source].count++
  }

  const categories = Object.values(categoryStats).sort((a: Record<string, unknown>, b: Record<string, unknown>) => b.count - a.count)
  const sources = Object.values(sourceStats).sort((a: Record<string, unknown>, b: Record<string, unknown>) => b.count - a.count)

  logger.info(`[${requestId}] 获取分类统计: ${categories.length} 个分类`)

  return {
    code: 0,
    success: true,
    data: {
      categories,
      sources,
      total: allFavorites.data.length
    },
    message: '获取成功'
  }
}

/**
 * 按分类筛选收藏
 */
async function handleGetByCategory(userId: string, data: Record<string, unknown>, requestId: string) {
  const { category, page = 1, limit = 50 } = data

  if (!category) {
    return { code: 400, success: false, message: '参数错误: category 不能为空' }
  }

  const collection = db.collection('favorites')
  const skip = (Math.max(1, page) - 1) * Math.min(limit, 100)

  const [listRes, countRes] = await Promise.all([
    collection
      .where({ user_id: userId, category })
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(Math.min(limit, 100))
      .get(),
    collection.where({ user_id: userId, category }).count()
  ])

  logger.info(`[${requestId}] 按分类筛选: ${category}, ${listRes.data.length}/${countRes.total}`)

  return {
    code: 0,
    success: true,
    data: listRes.data,
    total: countRes.total,
    page,
    limit,
    hasMore: skip + listRes.data.length < countRes.total,
    message: '获取成功'
  }
}
