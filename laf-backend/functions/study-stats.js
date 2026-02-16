/**
 * 学习统计云函数
 * ✅ B024: 补充前端调用但后端缺失的 /study-stats 接口
 * 
 * 支持操作：
 * - get: 获取用户学习统计概览
 * - daily: 获取每日学习数据
 * - weekly: 获取每周学习趋势
 * 
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud'
import { verifyJWT } from './login'

const db = cloud.database()
const _ = db.command

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `stats_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  try {
    const { action, userId, token } = ctx.body || {}

    if (!userId) {
      return { code: 401, message: '用户未登录', requestId }
    }

    if (!action) {
      return { code: 400, message: '缺少 action 参数', requestId }
    }

    // JWT 身份验证
    const authToken = ctx.headers?.['authorization'] || token
    if (authToken) {
      const rawToken = authToken.startsWith('Bearer ') ? authToken.slice(7) : authToken
      const payload = verifyJWT(rawToken)
      if (!payload) {
        return { code: 401, message: 'token 无效或已过期，请重新登录', requestId }
      }
      if (payload.userId && payload.userId !== userId) {
        return { code: 401, message: '身份验证失败', requestId }
      }
    } else if (process.env.NODE_ENV === 'production') {
      return { code: 401, message: '缺少认证 token，请重新登录', requestId }
    }

    console.log(`[${requestId}] 学习统计: action=${action}, userId=${userId}`)

    switch (action) {
      case 'get':
        return await getOverview(userId, requestId)
      case 'daily':
        return await getDailyStats(userId, ctx.body?.data, requestId)
      case 'weekly':
        return await getWeeklyTrend(userId, requestId)
      default:
        return { code: 400, message: `未知的 action: ${action}`, requestId }
    }
  } catch (error) {
    console.error(`[${requestId}] 学习统计异常:`, error)
    return {
      code: 500,
      message: error.message || '服务器错误',
      requestId,
      duration: Date.now() - startTime
    }
  }
}

/**
 * 获取学习统计概览
 */
async function getOverview(userId, requestId) {
  // 获取用户基本统计
  const userResult = await db.collection('users')
    .where({ _id: userId })
    .field({
      streak_days: true,
      total_study_days: true,
      total_study_minutes: true,
      total_questions: true,
      correct_questions: true,
      last_study_date: true
    })
    .getOne()

  if (!userResult.data) {
    return { code: 404, message: '用户不存在', requestId }
  }

  const user = userResult.data
  const accuracy = user.total_questions > 0
    ? Math.round((user.correct_questions / user.total_questions) * 100)
    : 0

  // 获取今日练习数据
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayTimestamp = todayStart.getTime()

  const todayResult = await db.collection('practice_records')
    .where({
      user_id: userId,
      created_at: _.gte(todayTimestamp)
    })
    .count()

  // 获取错题数量
  const mistakeCount = await db.collection('mistake_book')
    .where({ user_id: userId, is_mastered: false })
    .count()

  return {
    code: 0,
    success: true,
    data: {
      streakDays: user.streak_days || 0,
      totalStudyDays: user.total_study_days || 0,
      totalStudyMinutes: user.total_study_minutes || 0,
      totalQuestions: user.total_questions || 0,
      correctQuestions: user.correct_questions || 0,
      accuracy,
      todayQuestions: todayResult.total || 0,
      unmasteredMistakes: mistakeCount.total || 0,
      lastStudyDate: user.last_study_date
    },
    requestId
  }
}

/**
 * 获取每日学习数据
 */
async function getDailyStats(userId, data, requestId) {
  const { days = 7 } = data || {}
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  const records = await db.collection('practice_records')
    .where({
      user_id: userId,
      created_at: _.gte(startDate.getTime())
    })
    .field({ is_correct: true, created_at: true, duration: true })
    .limit(1000)
    .get()

  // 按天分组统计
  const dailyMap = {}
  for (const record of (records.data || [])) {
    const date = new Date(record.created_at).toISOString().split('T')[0]
    if (!dailyMap[date]) {
      dailyMap[date] = { total: 0, correct: 0, duration: 0 }
    }
    dailyMap[date].total++
    if (record.is_correct) dailyMap[date].correct++
    dailyMap[date].duration += record.duration || 0
  }

  // 填充缺失的日期
  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const stats = dailyMap[dateStr] || { total: 0, correct: 0, duration: 0 }
    result.push({
      date: dateStr,
      ...stats,
      accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    })
  }

  return { code: 0, success: true, data: result, requestId }
}

/**
 * 获取每周学习趋势
 */
async function getWeeklyTrend(userId, requestId) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 28) // 4周
  startDate.setHours(0, 0, 0, 0)

  const records = await db.collection('practice_records')
    .where({
      user_id: userId,
      created_at: _.gte(startDate.getTime())
    })
    .field({ is_correct: true, created_at: true, category: true })
    .limit(2000)
    .get()

  // 按周分组
  const weeks = [{}, {}, {}, {}]
  for (const record of (records.data || [])) {
    const daysAgo = Math.floor((Date.now() - record.created_at) / (24 * 60 * 60 * 1000))
    const weekIdx = Math.min(3, Math.floor(daysAgo / 7))
    const week = weeks[3 - weekIdx]
    if (!week.total) week.total = 0
    if (!week.correct) week.correct = 0
    week.total++
    if (record.is_correct) week.correct++
  }

  const result = weeks.map((w, i) => ({
    week: i + 1,
    total: w.total || 0,
    correct: w.correct || 0,
    accuracy: (w.total || 0) > 0 ? Math.round(((w.correct || 0) / w.total) * 100) : 0
  }))

  return { code: 0, success: true, data: result, requestId }
}
