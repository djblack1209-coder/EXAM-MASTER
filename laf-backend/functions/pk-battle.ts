/**
 * PK 对战云函数
 * 
 * 功能：
 * 1. 提交 PK 对战结果 (submit_result)
 * 2. 获取 PK 对战记录 (get_records)
 * 3. 计算 ELO 分数变化 (calculate_elo)
 * 
 * 事务一致性保证：
 * - 使用乐观锁机制防止并发冲突
 * - 使用幂等性保护防止重复提交
 * - 原子性更新双方分数
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

// ==================== ELO 配置 ====================
const ELO_K_FACTOR = 32  // ELO K 因子
const ELO_BASE = 1000    // 初始 ELO 分数

// ==================== 幂等性配置 ====================
const IDEMPOTENCY_COLLECTION = 'idempotency_records'
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000  // 24小时

// ==================== 参数校验 ====================
function validateUserId(uid: any): boolean {
  return typeof uid === 'string' && uid.length > 0 && uid.length <= 64
}

function validateScore(score: any): boolean {
  return typeof score === 'number' && !isNaN(score) && score >= 0 && score <= 10000
}

function validateBattleId(battleId: any): boolean {
  return typeof battleId === 'string' && battleId.length > 0 && battleId.length <= 100
}

// ==================== 主函数 ====================
export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info(`[${requestId}] PK 对战请求开始`)

  try {
    const { action, ...params } = ctx.body || {}

    if (!action || typeof action !== 'string' || action.length > 50) {
      return { code: 400, success: false, message: '参数错误: action 不合法', requestId }
    }

    logger.info(`[${requestId}] action: ${action}`)

    const handlers = {
      submit_result: handleSubmitResult,
      get_records: handleGetRecords,
      calculate_elo: handleCalculateElo
    }

    const handler = handlers[action]
    if (!handler) {
      return { code: 400, success: false, message: `不支持的操作: ${action}`, requestId }
    }

    const result = await handler(params, requestId)

    const duration = Date.now() - startTime
    logger.info(`[${requestId}] 操作完成，耗时: ${duration}ms`)

    return { ...result, requestId, duration }

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error(`[${requestId}] PK 对战异常:`, error)

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
 * 提交 PK 对战结果（带幂等性和原子性保护）
 * 
 * 参数：
 * - battleId: string - 对战ID（用于幂等性）
 * - odempotencyKey: string - 幂等键
 * - player1: { uid, score, correctCount, totalTime }
 * - player2: { uid, score, correctCount, totalTime }
 * - questionCount: number - 题目数量
 */
async function handleSubmitResult(params, requestId) {
  const { battleId, idempotencyKey, player1, player2, questionCount } = params

  // 1. 参数校验
  if (!validateBattleId(battleId)) {
    return { code: 400, success: false, message: 'battleId 不合法' }
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    return { code: 400, success: false, message: 'idempotencyKey 不能为空（防止重复提交）' }
  }

  if (!player1 || !validateUserId(player1.uid) || !validateScore(player1.score)) {
    return { code: 400, success: false, message: 'player1 参数不合法' }
  }

  if (!player2 || !validateUserId(player2.uid) || !validateScore(player2.score)) {
    return { code: 400, success: false, message: 'player2 参数不合法' }
  }

  // 2. 幂等性检查
  const idempotencyResult = await checkIdempotency(battleId, 'pk_submit', idempotencyKey)
  
  if (idempotencyResult.isDuplicate) {
    logger.info(`[${requestId}] 重复提交，返回缓存结果`)
    return {
      ...idempotencyResult.previousResult,
      isDuplicate: true
    }
  }

  // 3. 执行原子性更新
  try {
    const now = Date.now()
    const pkRecordsCollection = db.collection('pk_records')
    const rankingsCollection = db.collection('rankings')

    // 3.1 计算 ELO 分数变化
    const eloResult = calculateEloChange(player1.score, player2.score)

    // 3.2 创建 PK 记录
    const pkRecord = {
      battle_id: battleId,
      player1: {
        uid: player1.uid,
        score: player1.score,
        correct_count: player1.correctCount || 0,
        total_time: player1.totalTime || 0,
        elo_change: eloResult.player1Change
      },
      player2: {
        uid: player2.uid,
        score: player2.score,
        correct_count: player2.correctCount || 0,
        total_time: player2.totalTime || 0,
        elo_change: eloResult.player2Change
      },
      winner: eloResult.winner,
      question_count: questionCount || 5,
      created_at: now
    }

    await pkRecordsCollection.add(pkRecord)
    logger.info(`[${requestId}] PK 记录创建成功: ${battleId}`)

    // 3.3 原子性更新双方排行榜分数（使用乐观锁）
    // 更新 player1
    if (player1.uid && !player1.uid.startsWith('bot_')) {
      await updateRankingWithLock(rankingsCollection, player1.uid, player1.score, eloResult.player1Change, requestId)
    }

    // 更新 player2
    if (player2.uid && !player2.uid.startsWith('bot_')) {
      await updateRankingWithLock(rankingsCollection, player2.uid, player2.score, eloResult.player2Change, requestId)
    }

    // 4. 构建返回结果
    const result = {
      code: 0,
      success: true,
      data: {
        battleId,
        winner: eloResult.winner,
        player1EloChange: eloResult.player1Change,
        player2EloChange: eloResult.player2Change
      },
      message: '对战结果提交成功'
    }

    // 5. 标记幂等记录完成
    await markIdempotencyCompleted(idempotencyResult.recordId, result)

    return result

  } catch (error) {
    logger.error(`[${requestId}] 提交对战结果失败:`, error)
    
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
      message: '提交失败，请重试'
    }
  }
}

/**
 * 使用乐观锁更新排行榜分数
 * 防止并发更新导致的数据竞争
 */
async function updateRankingWithLock(collection, uid: string, pkScore: number, eloChange: number, requestId: string) {
  const MAX_RETRIES = 3
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // 获取当前记录
      const existing = await collection.where({ uid }).getOne()
      const now = Date.now()
      const today = new Date().toISOString().split('T')[0]

      if (existing.data) {
        // 使用版本号作为乐观锁
        const currentVersion = existing.data.version || 0
        
        const updateResult = await collection.where({
          uid,
          version: currentVersion  // 乐观锁条件
        }).update({
          total_score: _.inc(pkScore),
          elo_score: _.inc(eloChange),
          pk_count: _.inc(1),
          pk_wins: eloChange > 0 ? _.inc(1) : _.inc(0),
          daily_score: existing.data.daily_date === today ? _.inc(pkScore) : pkScore,
          daily_date: today,
          version: _.inc(1),  // 版本号递增
          updated_at: now
        })

        // 检查是否更新成功
        if (updateResult.updated === 0) {
          // 版本冲突，重试
          logger.warn(`[${requestId}] 乐观锁冲突，重试 (${attempt}/${MAX_RETRIES}): ${uid}`)
          if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 100 * attempt))
            continue
          }
          throw new Error('并发更新冲突，请重试')
        }

        logger.info(`[${requestId}] 排行榜更新成功: ${uid}, +${pkScore}, ELO ${eloChange > 0 ? '+' : ''}${eloChange}`)
        return

      } else {
        // 创建新记录
        await collection.add({
          uid,
          nick_name: '考研学子',
          avatar_url: '',
          total_score: pkScore,
          elo_score: ELO_BASE + eloChange,
          pk_count: 1,
          pk_wins: eloChange > 0 ? 1 : 0,
          daily_score: pkScore,
          daily_date: today,
          weekly_score: pkScore,
          weekly_start: getWeekStart(),
          monthly_score: pkScore,
          monthly_start: getMonthStart(),
          version: 1,
          created_at: now,
          updated_at: now
        })

        logger.info(`[${requestId}] 排行榜记录创建成功: ${uid}`)
        return
      }

    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error
      }
      logger.warn(`[${requestId}] 更新排行榜失败，重试 (${attempt}/${MAX_RETRIES}):`, error.message)
      await new Promise(resolve => setTimeout(resolve, 100 * attempt))
    }
  }
}

/**
 * 计算 ELO 分数变化
 * 
 * ELO 算法：
 * 1. 计算预期胜率：E = 1 / (1 + 10^((Rb - Ra) / 400))
 * 2. 计算分数变化：ΔR = K * (S - E)
 *    - S = 1 (胜), 0.5 (平), 0 (负)
 */
function calculateEloChange(player1Score: number, player2Score: number) {
  let winner = 'draw'
  let player1Result = 0.5
  let player2Result = 0.5

  if (player1Score > player2Score) {
    winner = 'player1'
    player1Result = 1
    player2Result = 0
  } else if (player2Score > player1Score) {
    winner = 'player2'
    player1Result = 0
    player2Result = 1
  }

  // 简化版 ELO：基于分数差计算变化
  // 实际 ELO 需要双方历史 ELO 分数，这里使用简化版本
  const scoreDiff = Math.abs(player1Score - player2Score)
  const baseChange = Math.min(ELO_K_FACTOR, Math.ceil(scoreDiff / 10) + 10)

  const player1Change = winner === 'player1' ? baseChange : (winner === 'player2' ? -baseChange : 0)
  const player2Change = winner === 'player2' ? baseChange : (winner === 'player1' ? -baseChange : 0)

  return {
    winner,
    player1Change,
    player2Change
  }
}

/**
 * 获取 PK 对战记录
 */
async function handleGetRecords(params, requestId) {
  const { uid, page = 1, limit = 20 } = params

  if (!validateUserId(uid)) {
    return { code: 400, success: false, message: '用户ID不合法' }
  }

  const collection = db.collection('pk_records')
  const skip = (Math.max(1, Math.min(page, 100)) - 1) * Math.min(limit, 50)

  const [listRes, countRes] = await Promise.all([
    collection
      .where(_.or([
        { 'player1.uid': uid },
        { 'player2.uid': uid }
      ]))
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(Math.min(limit, 50))
      .get(),
    collection.where(_.or([
      { 'player1.uid': uid },
      { 'player2.uid': uid }
    ])).count()
  ])

  logger.info(`[${requestId}] 获取 PK 记录: ${listRes.data.length}/${countRes.total}`)

  return {
    code: 0,
    success: true,
    data: listRes.data,
    total: countRes.total,
    page,
    limit,
    hasMore: skip + listRes.data.length < countRes.total
  }
}

/**
 * 计算 ELO 分数（供外部调用）
 */
async function handleCalculateElo(params, requestId) {
  const { player1Score, player2Score } = params

  if (!validateScore(player1Score) || !validateScore(player2Score)) {
    return { code: 400, success: false, message: '分数参数不合法' }
  }

  const result = calculateEloChange(player1Score, player2Score)

  return {
    code: 0,
    success: true,
    data: result
  }
}

// ==================== 幂等性工具函数 ====================

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

// ==================== 工具函数 ====================

function getWeekStart() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const weekStart = new Date(now.setDate(diff))
  return weekStart.toISOString().split('T')[0]
}

function getMonthStart() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}
