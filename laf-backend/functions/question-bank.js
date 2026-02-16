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

import cloud from '@lafjs/cloud'
import { verifyJWT } from './login'

const db = cloud.database()
const _ = db.command

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `qb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const { action, userId, data, token } = ctx.body || {}

    if (!action) {
      return { code: 400, message: '缺少 action 参数', requestId }
    }

    // JWT 身份验证（题库查询允许匿名访问公共题目，但写操作需要认证）
    const authToken = ctx.headers?.['authorization'] || token
    if (authToken) {
      const rawToken = authToken.startsWith('Bearer ') ? authToken.slice(7) : authToken
      const payload = verifyJWT(rawToken)
      if (!payload) {
        return { code: 401, message: 'token 无效或已过期，请重新登录', requestId }
      }
      if (userId && payload.userId && payload.userId !== userId) {
        return { code: 401, message: '身份验证失败', requestId }
      }
    }

    console.log(`[${requestId}] 题库查询: action=${action}`)

    switch (action) {
      case 'get':
        return await getQuestions(userId, data, requestId)
      case 'random':
        return await getRandomQuestions(data, requestId)
      case 'getByIds':
        return await getQuestionsByIds(data, requestId)
      default:
        return { code: 400, message: `未知的 action: ${action}`, requestId }
    }
  } catch (error) {
    console.error(`[${requestId}] 题库查询异常:`, error)
    return {
      code: 500,
      message: error.message || '服务器错误',
      requestId,
      duration: Date.now() - startTime
    }
  }
}

/**
 * 获取题目列表
 */
async function getQuestions(userId, data, requestId) {
  const {
    category,
    sub_category,
    difficulty,
    type,
    tags,
    page = 1,
    pageSize = 20,
    keyword
  } = data || {}

  const query = { is_active: true, review_status: 'approved' }

  if (category) query.category = category
  if (sub_category) query.sub_category = sub_category
  if (difficulty) query.difficulty = difficulty
  if (type) query.type = type
  if (tags && tags.length > 0) query.tags = _.in(tags)
  if (keyword) {
    query.$or = [
      { question: { $regex: keyword, $options: 'i' } },
      { analysis: { $regex: keyword, $options: 'i' } }
    ]
  }

  const skip = (page - 1) * pageSize

  const [questions, countResult] = await Promise.all([
    db.collection('questions')
      .where(query)
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get(),
    db.collection('questions')
      .where(query)
      .count()
  ])

  return {
    code: 0,
    success: true,
    data: {
      list: questions.data || [],
      total: countResult.total || 0,
      page,
      pageSize,
      hasMore: skip + pageSize < (countResult.total || 0)
    },
    requestId
  }
}

/**
 * 随机获取题目
 */
async function getRandomQuestions(data, requestId) {
  const { category, difficulty, count = 10 } = data || {}

  const query = { is_active: true, review_status: 'approved' }
  if (category) query.category = category
  if (difficulty) query.difficulty = difficulty

  // 获取总数后随机跳过
  const countResult = await db.collection('questions').where(query).count()
  const total = countResult.total || 0

  if (total === 0) {
    return { code: 0, success: true, data: [], requestId }
  }

  const limit = Math.min(count, total, 50)
  const maxSkip = Math.max(0, total - limit)
  const skip = Math.floor(Math.random() * maxSkip)

  const result = await db.collection('questions')
    .where(query)
    .skip(skip)
    .limit(limit)
    .get()

  return {
    code: 0,
    success: true,
    data: result.data || [],
    requestId
  }
}

/**
 * 根据ID批量获取题目
 */
async function getQuestionsByIds(data, requestId) {
  const { ids } = data || {}

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return { code: 400, message: '缺少题目ID列表', requestId }
  }

  const result = await db.collection('questions')
    .where({ _id: _.in(ids.slice(0, 100)) })
    .get()

  return {
    code: 0,
    success: true,
    data: result.data || [],
    requestId
  }
}
