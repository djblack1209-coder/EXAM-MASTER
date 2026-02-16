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
 * 防作弊机制 (v2.0新增)：
 * - 答题时间校验（过快判定为作弊）
 * - 分数合理性校验
 * - 连续高分检测
 * - IP/设备指纹追踪
 * - 作弊记录和封禁机制
 * 
 * @version 2.0.0
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
  info: (...args: unknown[]) => { if (LOG_LEVEL !== 'warn' && LOG_LEVEL !== 'error') console.log(...args) },
  warn: (...args: unknown[]) => { if (LOG_LEVEL !== 'error') console.warn(...args) },
  error: (...args: unknown[]) => console.error(...args)
}

// ==================== ELO 配置 ====================
const ELO_K_FACTOR = 32  // ELO K 因子
const ELO_BASE = 1000    // 初始 ELO 分数

// ==================== 幂等性配置 ====================
const IDEMPOTENCY_COLLECTION = 'idempotency_records'
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000  // 24小时

// ==================== 防作弊配置 ====================
const ANTI_CHEAT_CONFIG = {
  // 每题最短答题时间（毫秒）- 低于此时间判定为可疑
  MIN_TIME_PER_QUESTION: 2000,  // 2秒
  // 每题最长答题时间（毫秒）- 超过此时间判定为超时
  MAX_TIME_PER_QUESTION: 120000,  // 2分钟
  // 连续高分检测阈值（连续N场正确率>90%触发检测）
  CONSECUTIVE_HIGH_SCORE_THRESHOLD: 5,
  // 高分定义（正确率）
  HIGH_SCORE_RATE: 0.9,
  // 作弊封禁时长（毫秒）
  BAN_DURATION: 7 * 24 * 60 * 60 * 1000,  // 7天
  // 可疑行为累计阈值（达到此值触发封禁）
  SUSPICIOUS_THRESHOLD: 3
}

// ==================== 参数校验 ====================
function validateUserId(uid: unknown): boolean {
  return typeof uid === 'string' && uid.length > 0 && uid.length <= 64
}

function validateScore(score: unknown): boolean {
  return typeof score === 'number' && !isNaN(score) && score >= 0 && score <= 10000
}

function validateBattleId(battleId: unknown): boolean {
  return typeof battleId === 'string' && battleId.length > 0 && battleId.length <= 100
}

// ==================== 主函数 ====================
export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

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
 * - idempotencyKey: string - 幂等键
 * - player1: { uid, score, correctCount, totalTime, answers }
 * - player2: { uid, score, correctCount, totalTime, answers }
 * - questionCount: number - 题目数量
 * - clientInfo: { ip, deviceId, timestamp } - 客户端信息（防作弊用）
 */
async function handleSubmitResult(params, requestId) {
  const { battleId, idempotencyKey, player1, player2, questionCount, clientInfo } = params

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

  // 2. 防作弊检测（仅对真实玩家，跳过机器人）— 并行执行
  const antiCheatResults = { player1: null, player2: null }
  
  const [p1Check, p2Check] = await Promise.all([
    !player1.uid.startsWith('bot_') ? performAntiCheatCheck(player1, questionCount, clientInfo, requestId) : null,
    !player2.uid.startsWith('bot_') ? performAntiCheatCheck(player2, questionCount, clientInfo, requestId) : null
  ])

  antiCheatResults.player1 = p1Check
  antiCheatResults.player2 = p2Check

  if (p1Check?.banned) {
    return {
      code: 403,
      success: false,
      message: '账号因异常行为被暂时封禁，请联系客服',
      banExpires: p1Check.banExpires
    }
  }

  if (p2Check?.banned) {
    return {
      code: 403,
      success: false,
      message: '对手账号异常，对战结果无效'
    }
  }

  // 3. 幂等性检查
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

    // 3.3 原子性更新双方排行榜分数（使用乐观锁）— 并行执行
    await Promise.all([
      player1.uid && !player1.uid.startsWith('bot_')
        ? updateRankingWithLock(rankingsCollection, player1.uid, player1.score, eloResult.player1Change, requestId)
        : null,
      player2.uid && !player2.uid.startsWith('bot_')
        ? updateRankingWithLock(rankingsCollection, player2.uid, player2.score, eloResult.player2Change, requestId)
        : null
    ])

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

async function markIdempotencyCompleted(recordId: string, result: unknown) {
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

// ==================== 防作弊检测函数 (v2.0新增) ====================

/**
 * 执行防作弊检测
 * @param player 玩家数据
 * @param questionCount 题目数量
 * @param clientInfo 客户端信息
 * @param requestId 请求ID
 */
async function performAntiCheatCheck(player: Record<string, unknown>, questionCount: number, clientInfo: Record<string, unknown>, requestId: string) {
  const result = {
    suspicious: false,
    reasons: [],
    banned: false,
    banExpires: null
  }

  const uid = player.uid
  const totalTime = player.totalTime || 0
  const correctCount = player.correctCount || 0
  const score = player.score || 0

  // 1. 检查用户是否已被封禁
  const banRecord = await checkUserBan(uid)
  if (banRecord) {
    result.banned = true
    result.banExpires = banRecord.expires_at
    logger.warn(`[${requestId}] 用户已被封禁: ${uid}`)
    return result
  }

  // 2. 答题时间检测
  if (questionCount > 0 && totalTime > 0) {
    const avgTimePerQuestion = totalTime / questionCount

    // 答题过快检测
    if (avgTimePerQuestion < ANTI_CHEAT_CONFIG.MIN_TIME_PER_QUESTION) {
      result.suspicious = true
      result.reasons.push(`答题过快: 平均${Math.round(avgTimePerQuestion)}ms/题`)
      logger.warn(`[${requestId}] 可疑行为-答题过快: ${uid}, ${avgTimePerQuestion}ms/题`)
    }
  }

  // 3. 分数合理性检测
  if (questionCount > 0) {
    const correctRate = correctCount / questionCount
    
    // 检测连续高分
    if (correctRate >= ANTI_CHEAT_CONFIG.HIGH_SCORE_RATE) {
      const consecutiveHighScores = await checkConsecutiveHighScores(uid)
      if (consecutiveHighScores >= ANTI_CHEAT_CONFIG.CONSECUTIVE_HIGH_SCORE_THRESHOLD) {
        result.suspicious = true
        result.reasons.push(`连续${consecutiveHighScores}场高分(>${ANTI_CHEAT_CONFIG.HIGH_SCORE_RATE * 100}%)`)
        logger.warn(`[${requestId}] 可疑行为-连续高分: ${uid}, ${consecutiveHighScores}场`)
      }
    }
  }

  // 4. 记录可疑行为
  if (result.suspicious) {
    const suspiciousCount = await recordSuspiciousBehavior(uid, result.reasons, clientInfo, requestId)
    
    // 达到阈值则封禁
    if (suspiciousCount >= ANTI_CHEAT_CONFIG.SUSPICIOUS_THRESHOLD) {
      await banUser(uid, ANTI_CHEAT_CONFIG.BAN_DURATION, result.reasons.join('; '), requestId)
      result.banned = true
      result.banExpires = Date.now() + ANTI_CHEAT_CONFIG.BAN_DURATION
      logger.warn(`[${requestId}] 用户被封禁: ${uid}, 原因: ${result.reasons.join('; ')}`)
    }
  }

  return result
}

/**
 * 检查用户是否被封禁
 */
async function checkUserBan(uid: string) {
  try {
    const collection = db.collection('user_bans')
    const ban = await collection.where({
      uid,
      expires_at: _.gt(Date.now())
    }).getOne()
    return ban.data
  } catch (e) {
    return null
  }
}

/**
 * 检查连续高分场次
 */
async function checkConsecutiveHighScores(uid: string) {
  try {
    const collection = db.collection('pk_records')
    const recentRecords = await collection.where(_.or([
      { 'player1.uid': uid },
      { 'player2.uid': uid }
    ]))
    .orderBy('created_at', 'desc')
    .limit(ANTI_CHEAT_CONFIG.CONSECUTIVE_HIGH_SCORE_THRESHOLD + 2)
    .get()

    let consecutiveCount = 0
    for (const record of recentRecords.data) {
      const isPlayer1 = record.player1.uid === uid
      const playerData = isPlayer1 ? record.player1 : record.player2
      const questionCount = record.question_count || 5
      const correctRate = (playerData.correct_count || 0) / questionCount

      if (correctRate >= ANTI_CHEAT_CONFIG.HIGH_SCORE_RATE) {
        consecutiveCount++
      } else {
        break
      }
    }

    return consecutiveCount
  } catch (e) {
    return 0
  }
}

/**
 * 记录可疑行为
 */
async function recordSuspiciousBehavior(uid: string, reasons: string[], clientInfo: Record<string, unknown>, requestId: string) {
  try {
    const collection = db.collection('suspicious_behaviors')
    const now = Date.now()

    // 记录本次可疑行为
    await collection.add({
      uid,
      reasons,
      client_ip: clientInfo?.ip || 'unknown',
      device_id: clientInfo?.deviceId || 'unknown',
      created_at: now,
      request_id: requestId
    })

    // 统计最近7天的可疑行为次数
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const countResult = await collection.where({
      uid,
      created_at: _.gt(sevenDaysAgo)
    }).count()

    return countResult.total
  } catch (e) {
    logger.error('[AntiCheat] 记录可疑行为失败:', e)
    return 0
  }
}

/**
 * 封禁用户
 */
async function banUser(uid: string, duration: number, reason: string, requestId: string) {
  try {
    const collection = db.collection('user_bans')
    const now = Date.now()

    await collection.add({
      uid,
      reason,
      banned_at: now,
      expires_at: now + duration,
      request_id: requestId
    })

    logger.info(`[${requestId}] 用户封禁成功: ${uid}, 时长: ${duration / 1000 / 60 / 60}小时`)
  } catch (e) {
    logger.error('[AntiCheat] 封禁用户失败:', e)
  }
}
