/**
 * 排行榜中心云函数
 * 
 * 功能：
 * 1. 更新用户分数 (update)
 * 2. 获取排行榜 (get)
 * 3. 获取用户排名 (getUserRank)
 * 
 * 请求参数：
 * - action: string (必填) - 操作类型
 * - uid: string (必填) - 用户ID
 * - score: number (可选) - 分数
 * - nickName: string (可选) - 昵称
 * - avatarUrl: string (可选) - 头像
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
function sanitizeString(input: string, maxLength: number = 100): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .substring(0, maxLength)
    .trim()
}

function validateUserId(uid: any): boolean {
  return typeof uid === 'string' && uid.length > 0 && uid.length <= 64
}

function validateScore(score: any): boolean {
  return typeof score === 'number' && !isNaN(score) && score >= 0 && score <= 1000000
}

// 排行榜类型
const RANK_TYPES = {
  DAILY: 'daily',      // 日榜
  WEEKLY: 'weekly',    // 周榜
  MONTHLY: 'monthly',  // 月榜
  TOTAL: 'total'       // 总榜
}

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info(`[${requestId}] 排行榜请求开始`)

  try {
    const { action, uid, score, nickName, avatarUrl, rankType, limit } = ctx.body || {}

    if (!action || typeof action !== 'string' || action.length > 50) {
      return { code: 400, success: false, message: '参数错误: action 不合法', requestId }
    }

    logger.info(`[${requestId}] action: ${action}, uid: ${uid}`)

    const handlers = {
      update: handleUpdate,
      get: handleGet,
      getUserRank: handleGetUserRank
    }

    const handler = handlers[action]
    if (!handler) {
      return { code: 400, success: false, message: `不支持的操作: ${action}`, requestId }
    }

    const result = await handler({ uid, score, nickName, avatarUrl, rankType, limit }, requestId)

    const duration = Date.now() - startTime
    logger.info(`[${requestId}] 操作完成，耗时: ${duration}ms`)

    return { ...result, requestId, duration }

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error(`[${requestId}] 排行榜异常:`, error)

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
 * 更新用户分数
 */
async function handleUpdate(params, requestId) {
  const { uid, score, nickName, avatarUrl } = params

  if (!validateUserId(uid)) {
    return { code: 400, success: false, message: '用户ID不合法' }
  }

  if (!validateScore(score)) {
    return { code: 400, success: false, message: '分数必须是0-1000000之间的数字' }
  }

  const rankCollection = db.collection('rankings')
  const now = Date.now()
  const today = new Date().toISOString().split('T')[0]
  const weekStart = getWeekStart()
  const monthStart = getMonthStart()

  // 更新或创建排行榜记录
  const existing = await rankCollection.where({ uid }).getOne()

  if (existing.data) {
    // 更新现有记录
    const updateData = {
      total_score: _.inc(score),
      updated_at: now
    }

    // 更新日榜分数
    if (existing.data.daily_date === today) {
      updateData.daily_score = _.inc(score)
    } else {
      updateData.daily_score = score
      updateData.daily_date = today
    }

    // 更新周榜分数
    if (existing.data.weekly_start === weekStart) {
      updateData.weekly_score = _.inc(score)
    } else {
      updateData.weekly_score = score
      updateData.weekly_start = weekStart
    }

    // 更新月榜分数
    if (existing.data.monthly_start === monthStart) {
      updateData.monthly_score = _.inc(score)
    } else {
      updateData.monthly_score = score
      updateData.monthly_start = monthStart
    }

    // 更新用户信息（如果提供）- 清理输入
    if (nickName) updateData.nick_name = sanitizeString(nickName, 32)
    if (avatarUrl) updateData.avatar_url = sanitizeString(avatarUrl, 500)

    await rankCollection.doc(existing.data._id).update(updateData)

    logger.info(`[${requestId}] 更新排行榜分数: ${uid}, +${score}`)
  } else {
    // 创建新记录
    await rankCollection.add({
      uid,
      nick_name: sanitizeString(nickName || '考研学子', 32),
      avatar_url: sanitizeString(avatarUrl || '', 500),
      total_score: score,
      daily_score: score,
      daily_date: today,
      weekly_score: score,
      weekly_start: weekStart,
      monthly_score: score,
      monthly_start: monthStart,
      created_at: now,
      updated_at: now
    })

    logger.info(`[${requestId}] 创建排行榜记录: ${uid}, ${score}`)
  }

  return {
    code: 0,
    success: true,
    message: '分数更新成功'
  }
}

/**
 * 获取排行榜
 */
async function handleGet(params, requestId) {
  const { rankType = RANK_TYPES.DAILY, limit = 50 } = params
  const rankCollection = db.collection('rankings')

  // 确定排序字段
  let scoreField = 'daily_score'
  let dateField = 'daily_date'
  let dateValue = new Date().toISOString().split('T')[0]

  switch (rankType) {
    case RANK_TYPES.WEEKLY:
      scoreField = 'weekly_score'
      dateField = 'weekly_start'
      dateValue = getWeekStart()
      break
    case RANK_TYPES.MONTHLY:
      scoreField = 'monthly_score'
      dateField = 'monthly_start'
      dateValue = getMonthStart()
      break
    case RANK_TYPES.TOTAL:
      scoreField = 'total_score'
      dateField = null
      break
  }

  // 构建查询
  let query = {}
  if (dateField) {
    query[dateField] = dateValue
    query[scoreField] = _.gt(0)
  }

  const result = await rankCollection
    .where(query)
    .orderBy(scoreField, 'desc')
    .limit(Math.min(limit, 100))
    .field({
      uid: true,
      nick_name: true,
      avatar_url: true,
      [scoreField]: true
    })
    .get()

  // 添加排名
  const rankList = result.data.map((item, index) => ({
    rank: index + 1,
    uid: item.uid,
    nickName: item.nick_name,
    avatarUrl: item.avatar_url,
    score: item[scoreField]
  }))

  logger.info(`[${requestId}] 获取排行榜: ${rankType}, ${rankList.length} 条`)

  return {
    code: 0,
    success: true,
    data: rankList,
    rankType,
    message: '获取成功'
  }
}

/**
 * 获取用户排名
 */
async function handleGetUserRank(params, requestId) {
  const { uid, rankType = RANK_TYPES.DAILY } = params

  if (!validateUserId(uid)) {
    return { code: 400, success: false, message: '用户ID不合法' }
  }

  const rankCollection = db.collection('rankings')

  // 获取用户记录
  const userRecord = await rankCollection.where({ uid }).getOne()

  if (!userRecord.data) {
    return {
      code: 0,
      success: true,
      data: { rank: -1, score: 0 },
      message: '用户暂无排名'
    }
  }

  // 确定分数字段
  let scoreField = 'daily_score'
  switch (rankType) {
    case RANK_TYPES.WEEKLY:
      scoreField = 'weekly_score'
      break
    case RANK_TYPES.MONTHLY:
      scoreField = 'monthly_score'
      break
    case RANK_TYPES.TOTAL:
      scoreField = 'total_score'
      break
  }

  const userScore = userRecord.data[scoreField] || 0

  // 计算排名（比当前用户分数高的人数 + 1）
  const higherCount = await rankCollection.where({
    [scoreField]: _.gt(userScore)
  }).count()

  const rank = higherCount.total + 1

  console.log(`[${requestId}] 获取用户排名: ${uid}, 第 ${rank} 名, ${userScore} 分`)

  return {
    code: 0,
    success: true,
    data: {
      rank,
      score: userScore,
      nickName: userRecord.data.nick_name,
      avatarUrl: userRecord.data.avatar_url
    },
    rankType,
    message: '获取成功'
  }
}

/**
 * 获取本周开始日期
 */
function getWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const weekStart = new Date(now.setDate(diff))
  return weekStart.toISOString().split('T')[0]
}

/**
 * 获取本月开始日期
 */
function getMonthStart() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}
