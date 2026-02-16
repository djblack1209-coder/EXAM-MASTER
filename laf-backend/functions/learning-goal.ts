/**
 * ✅ B002: 学习目标管理云函数
 * 
 * 功能：
 * 1. 创建学习目标 (create)
 * 2. 获取用户目标列表 (get)
 * 3. 更新目标 (update)
 * 4. 删除目标 (remove)
 * 5. 获取今日目标进度 (getTodayProgress)
 * 6. 记录目标完成进度 (recordProgress)
 * 
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud'
import { verifyJWT } from './login'
import {
  success, badRequest, unauthorized, serverError,
  validateRequired, validateUserId, sanitizeString,
  checkRateLimit, logger, generateRequestId, wrapResponse
} from './_shared/api-response'

const db = cloud.database()
const _ = db.command

// ==================== 目标类型定义 ====================
const GOAL_TYPES = {
  DAILY_QUESTIONS: { type: 'DAILY_QUESTIONS', label: '每日刷题', unit: '道', defaultValue: 20, minValue: 5, maxValue: 200 },
  DAILY_STUDY_TIME: { type: 'DAILY_STUDY_TIME', label: '每日学习时长', unit: '分钟', defaultValue: 60, minValue: 10, maxValue: 480 },
  WEEKLY_ACCURACY: { type: 'WEEKLY_ACCURACY', label: '周正确率', unit: '%', defaultValue: 70, minValue: 30, maxValue: 100 },
  STREAK_DAYS: { type: 'STREAK_DAYS', label: '连续学习天数', unit: '天', defaultValue: 7, minValue: 1, maxValue: 365 },
  MONTHLY_QUESTIONS: { type: 'MONTHLY_QUESTIONS', label: '月刷题量', unit: '道', defaultValue: 500, minValue: 50, maxValue: 5000 }
}

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = generateRequestId('goal')

  try {
    const { action, userId, token, data } = ctx.body || {}

    // 1. 参数校验
    if (!action || typeof action !== 'string') {
      return wrapResponse(badRequest('action 不能为空'), requestId, startTime)
    }

    if (!validateUserId(userId)) {
      return wrapResponse(unauthorized('请先登录'), requestId, startTime)
    }

    // 2. JWT 验证（必须提供有效 token）
    if (!token) {
      return wrapResponse(unauthorized('请先登录：缺少认证令牌'), requestId, startTime)
    }
    const payload = verifyJWT(token)
    if (!payload) {
      return wrapResponse(unauthorized('认证令牌无效或已过期'), requestId, startTime)
    }
    if (payload.userId !== userId) {
      return wrapResponse(unauthorized('身份验证失败：用户不匹配'), requestId, startTime)
    }

    // 3. 频率限制
    const rateLimit = checkRateLimit(`goal_${userId}`, 30, 60000)
    if (!rateLimit.allowed) {
      return wrapResponse({ code: 429, success: false, message: '请求过于频繁', timestamp: Date.now() }, requestId, startTime)
    }

    // 4. 路由处理
    const handlers = {
      create: handleCreate,
      get: handleGet,
      update: handleUpdate,
      remove: handleRemove,
      getTodayProgress: handleGetTodayProgress,
      recordProgress: handleRecordProgress,
      getGoalTypes: handleGetGoalTypes
    }

    const handler = handlers[action]
    if (!handler) {
      return wrapResponse(badRequest(`不支持的操作: ${action}`), requestId, startTime)
    }

    const result = await handler(userId, data || {}, requestId)
    return wrapResponse(result, requestId, startTime)

  } catch (error) {
    logger.error(`[${requestId}] 学习目标异常:`, error)
    return wrapResponse(serverError('服务器内部错误', error.message), requestId, startTime)
  }
}

// ==================== 创建学习目标 ====================
async function handleCreate(userId: string, data: Record<string, unknown>, requestId: string) {
  const { type, targetValue, period = 'daily', startDate, endDate } = data

  // 校验目标类型
  if (!type || !GOAL_TYPES[type]) {
    return badRequest(`无效的目标类型，支持: ${Object.keys(GOAL_TYPES).join(', ')}`)
  }

  const goalType = GOAL_TYPES[type]

  // 校验目标值
  const value = parseInt(targetValue, 10) || goalType.defaultValue
  if (value < goalType.minValue || value > goalType.maxValue) {
    return badRequest(`目标值范围: ${goalType.minValue}-${goalType.maxValue}`)
  }

  // 检查是否已存在同类型目标
  const existing = await db.collection('learning_goals').where({
    user_id: userId,
    type,
    status: 'active'
  }).getOne()

  if (existing.data) {
    // 更新现有目标
    await db.collection('learning_goals').doc(existing.data._id).update({
      target_value: value,
      updated_at: Date.now()
    })

    logger.info(`[${requestId}] 更新已有目标: ${existing.data._id}`)
    return success({ id: existing.data._id, updated: true }, '目标已更新')
  }

  // 创建新目标
  const now = Date.now()
  const goal = {
    user_id: userId,
    type,
    label: goalType.label,
    unit: goalType.unit,
    target_value: value,
    current_value: 0,
    period,
    status: 'active',
    start_date: startDate || now,
    end_date: endDate || null,
    created_at: now,
    updated_at: now
  }

  const result = await db.collection('learning_goals').add(goal)

  logger.info(`[${requestId}] 创建目标成功: ${result.id}`)
  return success({ id: result.id, ...goal }, '目标创建成功')
}

// ==================== 获取用户目标列表 ====================
async function handleGet(userId: string, data: Record<string, unknown>, requestId: string) {
  const { status = 'active', type } = data

  const query: Record<string, unknown> = { user_id: userId }
  if (status) query.status = status
  if (type) query.type = type

  const result = await db.collection('learning_goals')
    .where(query)
    .orderBy('created_at', 'desc')
    .limit(50)
    .get()

  return success(result.data, '获取成功')
}

// ==================== 更新目标 ====================
async function handleUpdate(userId: string, data: Record<string, unknown>, requestId: string) {
  const { id, targetValue, status } = data

  if (!id) return badRequest('id 不能为空')

  // 验证权限
  const goal = await db.collection('learning_goals').where({
    _id: id,
    user_id: userId
  }).getOne()

  if (!goal.data) return badRequest('目标不存在')

  const updateData: Record<string, unknown> = { updated_at: Date.now() }
  if (targetValue !== undefined) updateData.target_value = parseInt(targetValue, 10)
  if (status) updateData.status = status

  await db.collection('learning_goals').doc(id).update(updateData)

  logger.info(`[${requestId}] 更新目标: ${id}`)
  return success({ id }, '更新成功')
}

// ==================== 删除目标 ====================
async function handleRemove(userId: string, data: Record<string, unknown>, requestId: string) {
  const { id } = data
  if (!id) return badRequest('id 不能为空')

  // 验证权限
  const goal = await db.collection('learning_goals').where({
    _id: id,
    user_id: userId
  }).getOne()

  if (!goal.data) return badRequest('目标不存在')

  await db.collection('learning_goals').doc(id).remove()

  logger.info(`[${requestId}] 删除目标: ${id}`)
  return success({ id, deleted: true }, '删除成功')
}

// ==================== 获取今日目标进度 ====================
async function handleGetTodayProgress(userId: string, data: Record<string, unknown>, requestId: string) {
  // 获取所有活跃目标
  const goals = await db.collection('learning_goals').where({
    user_id: userId,
    status: 'active'
  }).field({ _id: true, type: true, target_value: true, label: true, unit: true }).limit(50).get()

  // 获取今日进度记录
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const progressRecords = await db.collection('goal_progress').where({
    user_id: userId,
    date: todayStart.getTime()
  }).limit(50).get()

  // 合并目标和进度
  const progressMap = {}
  for (const record of progressRecords.data) {
    progressMap[record.goal_type] = record
  }

  const todayGoals = goals.data.map(goal => {
    const progress = progressMap[goal.type]
    const currentValue = progress?.current_value || 0
    const targetValue = goal.target_value || 0
    const percentage = targetValue > 0 ? Math.min(100, Math.round((currentValue / targetValue) * 100)) : 0

    return {
      ...goal,
      current_value: currentValue,
      percentage,
      completed: currentValue >= targetValue
    }
  })

  return success({
    goals: todayGoals,
    summary: {
      total: todayGoals.length,
      completed: todayGoals.filter(g => g.completed).length,
      overallPercentage: todayGoals.length > 0
        ? Math.round(todayGoals.reduce((sum, g) => sum + g.percentage, 0) / todayGoals.length)
        : 0
    }
  }, '获取成功')
}

// ==================== 记录目标进度 ====================
async function handleRecordProgress(userId: string, data: Record<string, unknown>, requestId: string) {
  const { type, value } = data

  if (!type || value === undefined) {
    return badRequest('type 和 value 不能为空')
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const dateKey = todayStart.getTime()

  // 查找今日进度记录
  const existing = await db.collection('goal_progress').where({
    user_id: userId,
    goal_type: type,
    date: dateKey
  }).getOne()

  if (existing.data) {
    // 更新进度（累加）
    await db.collection('goal_progress').doc(existing.data._id).update({
      current_value: _.inc(parseInt(value, 10) || 0),
      updated_at: Date.now()
    })
  } else {
    // 创建新记录
    await db.collection('goal_progress').add({
      user_id: userId,
      goal_type: type,
      date: dateKey,
      current_value: parseInt(value, 10) || 0,
      created_at: Date.now(),
      updated_at: Date.now()
    })
  }

  logger.info(`[${requestId}] 记录进度: ${type} +${value}`)
  return success({ type, value }, '进度已记录')
}

// ==================== 获取目标类型列表 ====================
async function handleGetGoalTypes(userId: string, data: Record<string, unknown>, requestId: string) {
  return success(Object.values(GOAL_TYPES), '获取成功')
}
