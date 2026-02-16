/**
 * 邀请系统云函数
 * 
 * 功能：
 * 1. handle - 处理新邀请（记录邀请关系、防重复、防自邀请）
 * 2. claim_reward - 领取邀请奖励
 * 3. get_info - 获取邀请信息（邀请码、邀请数、奖励列表）
 * 
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud'

const db = cloud.database()

// ==================== 环境配置 ====================
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'warn' : 'info')

const logger = {
  info: (...args: unknown[]) => { if (LOG_LEVEL !== 'warn' && LOG_LEVEL !== 'error') console.log(...args) },
  warn: (...args: unknown[]) => { if (LOG_LEVEL !== 'error') console.warn(...args) },
  error: (...args: unknown[]) => console.error(...args)
}

// 邀请奖励配置
const INVITE_REWARDS = [
  { threshold: 1, type: 'vip_trial', value: 3, label: '邀请1人：VIP体验3天' },
  { threshold: 3, type: 'vip_trial', value: 7, label: '邀请3人：VIP体验7天' },
  { threshold: 5, type: 'vip_trial', value: 15, label: '邀请5人：VIP体验15天' },
  { threshold: 10, type: 'vip_trial', value: 30, label: '邀请10人：VIP体验30天' }
]

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`

  try {
    const { action, ...params } = ctx.body || {}
    const userId = ctx.headers?.['x-user-id'] || params.userId

    if (!action || typeof action !== 'string') {
      return { code: 400, success: false, message: '参数错误: action 不合法', requestId }
    }
    if (!userId || typeof userId !== 'string' || userId.length > 64) {
      return { code: 401, success: false, message: '请先登录', requestId }
    }

    logger.info(`[${requestId}] invite action: ${action}, userId: ${userId}`)

    const handlers = {
      handle: handleInvite,
      claim_reward: claimReward,
      get_info: getInviteInfo
    }

    const handler = handlers[action]
    if (!handler) {
      return { code: 400, success: false, message: `不支持的操作: ${action}`, requestId }
    }

    const result = await handler(userId, params, requestId)
    const duration = Date.now() - startTime
    logger.info(`[${requestId}] 完成，耗时: ${duration}ms`)

    return { ...result, requestId, duration }
  } catch (error) {
    logger.error(`[${requestId}] 邀请服务异常:`, error)
    return { code: 500, success: false, message: '服务器内部错误', requestId, duration: Date.now() - startTime }
  }
}

/**
 * 处理新邀请
 */
async function handleInvite(userId: string, params: Record<string, unknown>, requestId: string) {
  const { inviterId } = params
  if (!inviterId || typeof inviterId !== 'string') {
    return { code: 400, success: false, message: '缺少邀请人ID' }
  }
  if (inviterId === userId) {
    return { code: 400, success: false, message: '不能邀请自己' }
  }

  const col = db.collection('invites')

  // 防重复：同一对邀请关系只记录一次
  const existing = await col.where({ inviterId, inviteeId: userId }).getOne()
  if (existing.data) {
    return { code: 409, success: false, message: '已接受过该邀请' }
  }

  // 记录邀请关系
  await col.add({
    inviterId,
    inviteeId: userId,
    status: 'accepted',
    createdAt: new Date()
  })

  // 更新邀请人的邀请计数
  const inviterCol = db.collection('invite_stats')
  const stats = await inviterCol.where({ userId: inviterId }).getOne()
  if (stats.data) {
    await inviterCol.where({ userId: inviterId }).update({ count: (stats.data as any).count + 1, updatedAt: new Date() })
  } else {
    await inviterCol.add({ userId: inviterId, count: 1, claimedRewards: [], createdAt: new Date(), updatedAt: new Date() })
  }

  logger.info(`[${requestId}] 邀请记录成功: ${inviterId} -> ${userId}`)
  return { code: 0, success: true, message: '邀请成功' }
}

/**
 * 领取邀请奖励
 */
async function claimReward(userId: string, params: Record<string, unknown>, requestId: string) {
  const { threshold } = params
  if (!threshold || typeof threshold !== 'number') {
    return { code: 400, success: false, message: '缺少奖励阈值' }
  }

  const reward = INVITE_REWARDS.find(r => r.threshold === threshold)
  if (!reward) {
    return { code: 400, success: false, message: '无效的奖励等级' }
  }

  const col = db.collection('invite_stats')
  const stats = await col.where({ userId }).getOne()
  const data = stats.data as any

  if (!data) {
    return { code: 400, success: false, message: '暂无邀请记录' }
  }
  if (data.count < threshold) {
    return { code: 400, success: false, message: `邀请人数不足，需要${threshold}人` }
  }

  const claimed = data.claimedRewards || []
  if (claimed.includes(threshold)) {
    return { code: 409, success: false, message: '该奖励已领取' }
  }

  // 标记已领取
  claimed.push(threshold)
  await col.where({ userId }).update({ claimedRewards: claimed, updatedAt: new Date() })

  logger.info(`[${requestId}] 奖励领取成功: userId=${userId}, threshold=${threshold}, value=${reward.value}天`)
  return { code: 0, success: true, message: '领取成功', data: { reward } }
}

/**
 * 获取邀请信息
 */
async function getInviteInfo(userId: string, _params: Record<string, unknown>, requestId: string) {
  const col = db.collection('invite_stats')
  const stats = await col.where({ userId }).getOne()
  const data = (stats.data as any) || { count: 0, claimedRewards: [] }

  // 生成邀请码（基于 userId 的简单哈希）
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash = hash & hash
  }
  const inviteCode = 'EX' + Math.abs(hash).toString(36).toUpperCase().padStart(6, '0')

  // 构建奖励列表（含领取状态）
  const rewards = INVITE_REWARDS.map(r => ({
    ...r,
    claimed: (data.claimedRewards || []).includes(r.threshold),
    unlocked: data.count >= r.threshold
  }))

  logger.info(`[${requestId}] 获取邀请信息: count=${data.count}`)
  return {
    code: 0,
    success: true,
    data: {
      inviteCode,
      count: data.count,
      rewards
    }
  }
}
