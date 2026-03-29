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

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import { success, badRequest, serverError, validateUserId, logger, generateRequestId } from './_shared/api-response.js';

const db = cloud.database();
const _ = db.command;

// ==================== ELO 配置 ====================
const ELO_K_FACTOR = 32; // ELO K 因子
const ELO_BASE = 1000; // 初始 ELO 分数

// ==================== 计分配置 ====================
const POINTS_PER_CORRECT = 20; // 每道正确题目得分
const MAX_QUESTIONS_PER_BATTLE = 10; // 单场最大题目数上限

// ==================== 幂等性配置 ====================
const IDEMPOTENCY_COLLECTION = 'idempotency_records';
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24小时
const PK_BATTLE_SESSION_COLLECTION = 'pk_battles';

// ==================== 防作弊配置 ====================
const ANTI_CHEAT_CONFIG = {
  // 每题最短答题时间（毫秒）- 低于此时间判定为可疑
  MIN_TIME_PER_QUESTION: 2000, // 2秒
  // 每题最长答题时间（毫秒）- 超过此时间判定为超时
  MAX_TIME_PER_QUESTION: 120000, // 2分钟
  // 连续高分检测阈值（连续N场正确率>90%触发检测）
  CONSECUTIVE_HIGH_SCORE_THRESHOLD: 5,
  // 高分定义（正确率）
  HIGH_SCORE_RATE: 0.9,
  // 作弊封禁时长（毫秒）
  BAN_DURATION: 7 * 24 * 60 * 60 * 1000, // 7天
  // 可疑行为累计阈值（达到此值触发封禁）
  SUSPICIOUS_THRESHOLD: 3
};

// ==================== 参数校验 ====================
function validateScore(score: unknown): boolean {
  return typeof score === 'number' && !isNaN(score) && score >= 0 && score <= 10000;
}

function validateBattleId(battleId: unknown): boolean {
  return typeof battleId === 'string' && battleId.length > 0 && battleId.length <= 100;
}

async function findBattleSessionById(battleId: string): Promise<Record<string, unknown> | null> {
  const collection = db.collection(PK_BATTLE_SESSION_COLLECTION);
  const candidates: Array<Record<string, unknown>> = [
    { battle_id: battleId },
    { battleId },
    { room_id: battleId },
    { roomId: battleId },
    { inviteCode: battleId },
    { _id: battleId }
  ];

  for (const where of candidates) {
    try {
      const result = await collection.where(where).getOne();
      if (result.data) {
        return result.data as Record<string, unknown>;
      }
    } catch {
      // 兼容不同环境/索引，不中断后续候选查询
    }
  }

  return null;
}

function extractSessionParticipantUids(session: Record<string, unknown>): string[] {
  const uidSet = new Set<string>();

  const addUid = (uid: unknown) => {
    if (typeof uid === 'string' && validateUserId(uid)) {
      uidSet.add(uid);
    }
  };

  addUid(session.user_id);
  addUid(session.userId);
  addUid(session.opponentId);
  addUid(session.opponent_id);
  addUid(session.inviterId);
  addUid(session.inviteeId);

  if (Array.isArray(session.players)) {
    for (const player of session.players) {
      if (!player || typeof player !== 'object') continue;
      const p = player as Record<string, unknown>;
      addUid(p.uid);
      addUid(p.userId);
      addUid(p.user_id);
    }
  }

  if (session.player1 && typeof session.player1 === 'object') {
    const p1 = session.player1 as Record<string, unknown>;
    addUid(p1.uid);
    addUid(p1.userId);
    addUid(p1.user_id);
  }

  if (session.player2 && typeof session.player2 === 'object') {
    const p2 = session.player2 as Record<string, unknown>;
    addUid(p2.uid);
    addUid(p2.userId);
    addUid(p2.user_id);
  }

  return Array.from(uidSet);
}

async function verifySubmitParticipants(
  authUserId: string,
  battleId: string,
  player1Uid: string,
  player2Uid: string,
  requestId: string
): Promise<{ valid: boolean; mode?: 'bot' | 'human'; reason?: string; code?: number }> {
  if (player1Uid === player2Uid) {
    return { valid: false, reason: '对战双方不能是同一用户', code: 400 };
  }

  if (authUserId !== player1Uid && authUserId !== player2Uid) {
    return { valid: false, reason: '无权提交此对战结果', code: 403 };
  }

  const nonBotParticipants = Array.from(
    new Set([player1Uid, player2Uid].filter((uid) => typeof uid === 'string' && !uid.startsWith('bot_')))
  );

  if (nonBotParticipants.length === 0) {
    return { valid: false, reason: '对战参与者无效', code: 400 };
  }

  // 单真人 + 单机器人：允许直接提交
  if (nonBotParticipants.length === 1) {
    if (nonBotParticipants[0] !== authUserId) {
      return { valid: false, reason: '无权提交此对战结果', code: 403 };
    }
    return { valid: true, mode: 'bot' };
  }

  // 双真人对战：必须有服务端会话记录，防止伪造对手身份
  if (!nonBotParticipants.includes(authUserId)) {
    return { valid: false, reason: '无权提交此对战结果', code: 403 };
  }

  const battleSession = await findBattleSessionById(battleId);
  if (!battleSession) {
    logger.warn(`[${requestId}] 双真人对战缺少服务端会话: battleId=${battleId}`);
    return { valid: false, reason: '未找到有效对战会话，请重新发起对战', code: 400 };
  }

  if (battleSession.status === 'cancelled') {
    return { valid: false, reason: '该对战已取消', code: 400 };
  }

  const allowedUids = extractSessionParticipantUids(battleSession);
  if (allowedUids.length === 0) {
    logger.warn(`[${requestId}] 对战会话缺少参与者信息: battleId=${battleId}`);
    return { valid: false, reason: '对战会话数据异常，请重新发起对战', code: 400 };
  }

  const isAuthorizedPair = nonBotParticipants.every((uid) => allowedUids.includes(uid));
  if (!isAuthorizedPair) {
    logger.warn(
      `[${requestId}] 对战参与者校验失败: submit=[${nonBotParticipants.join(',')}], session=[${allowedUids.join(',')}]`
    );
    return { valid: false, reason: '对战参与者与会话不匹配', code: 403 };
  }

  return { valid: true, mode: 'human' };
}

// ==================== 主函数 ====================
export default async function (ctx) {
  const startTime = Date.now();
  const requestId = generateRequestId('pk');

  logger.info(`[${requestId}] PK 对战请求开始`);

  try {
    const { action, ...params } = ctx.body || {};

    if (!action || typeof action !== 'string' || action.length > 50) {
      return { ...badRequest('参数错误: action 不合法'), requestId };
    }

    // JWT 认证：所有操作强制验证（防止未认证用户查询他人记录或计算ELO）
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return { ...authResult, requestId };
    }
    // 将验证后的 userId 注入 params，防止伪造
    params._authUserId = authResult.userId;

    logger.info(`[${requestId}] action: ${action}`);

    const handlers = {
      submit_result: handleSubmitResult,
      get_records: handleGetRecords,
      calculate_elo: handleCalculateElo,
      // Phase 3-2: 实时PK房间管理
      find_match: handleFindMatch,
      poll_room: handlePollRoom,
      room_answer: handleRoomAnswer,
      leave_room: handleLeaveRoom
    };

    const handler = handlers[action];
    if (!handler) {
      return { ...badRequest(`不支持的操作: ${action}`), requestId };
    }

    const result = await handler(params, requestId);

    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] 操作完成，耗时: ${duration}ms`);

    return { ...result, requestId, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[${requestId}] PK 对战异常:`, error);

    // ✅ P0修复：不泄露内部错误信息给客户端
    return { ...serverError('服务器内部错误'), requestId, duration };
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
  const { battleId, idempotencyKey, player1, player2, questionCount, clientInfo } = params;

  // 1. 参数校验
  if (!validateBattleId(battleId)) {
    return badRequest('battleId 不合法', requestId);
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    return badRequest('idempotencyKey 不能为空（防止重复提交）', requestId);
  }

  if (!player1 || !validateUserId(player1.uid) || !validateScore(player1.score)) {
    return badRequest('player1 参数不合法', requestId);
  }

  if (!player2 || !validateUserId(player2.uid) || !validateScore(player2.score)) {
    return badRequest('player2 参数不合法', requestId);
  }

  // ✅ P0-ELO: 服务端分数重算 — 不信任客户端 score，根据 correctCount 和 questionCount 计算
  const safeQuestionCount = Math.min(Math.max(1, parseInt(questionCount) || 5), MAX_QUESTIONS_PER_BATTLE);

  const p1CorrectCount = Math.min(Math.max(0, parseInt(player1.correctCount) || 0), safeQuestionCount);
  const p2CorrectCount = Math.min(Math.max(0, parseInt(player2.correctCount) || 0), safeQuestionCount);

  // 服务端权威分数 = correctCount * 每题分值
  const p1ServerScore = p1CorrectCount * POINTS_PER_CORRECT;
  const p2ServerScore = p2CorrectCount * POINTS_PER_CORRECT;

  // 如果客户端 score 与服务端计算不一致，记录警告（可能是作弊）
  if (player1.score !== p1ServerScore) {
    logger.warn(
      `[${requestId}] P1 score mismatch: client=${player1.score}, server=${p1ServerScore} (correct=${p1CorrectCount}/${safeQuestionCount})`
    );
  }
  if (player2.score !== p2ServerScore) {
    logger.warn(
      `[${requestId}] P2 score mismatch: client=${player2.score}, server=${p2ServerScore} (correct=${p2CorrectCount}/${safeQuestionCount})`
    );
  }

  // 覆盖客户端 score 为服务端计算值
  player1.score = p1ServerScore;
  player1.correctCount = p1CorrectCount;
  player2.score = p2ServerScore;
  player2.correctCount = p2CorrectCount;

  // ✅ P0修复：校验提交者必须是对战中的某一方，防止伪造他人对战结果
  const authUserId = params._authUserId;
  if (authUserId !== player1.uid && authUserId !== player2.uid) {
    logger.warn(`[${requestId}] 用户 ${authUserId} 试图提交非本人对战结果 (p1: ${player1.uid}, p2: ${player2.uid})`);
    return { code: 403, success: false, message: '无权提交此对战结果', requestId };
  }

  const participantCheck = await verifySubmitParticipants(authUserId, battleId, player1.uid, player2.uid, requestId);
  if (!participantCheck.valid) {
    logger.warn(
      `[${requestId}] 提交参与者校验失败: auth=${authUserId}, p1=${player1.uid}, p2=${player2.uid}, reason=${participantCheck.reason}`
    );
    return {
      code: participantCheck.code || 400,
      success: false,
      message: participantCheck.reason || '对战参与者校验失败',
      requestId
    };
  }

  // 2. 防作弊检测（仅对真实玩家，跳过机器人）— 并行执行
  const antiCheatResults = { player1: null, player2: null };

  const [p1Check, p2Check] = await Promise.all([
    !player1.uid.startsWith('bot_') ? performAntiCheatCheck(player1, safeQuestionCount, clientInfo, requestId) : null,
    !player2.uid.startsWith('bot_') ? performAntiCheatCheck(player2, safeQuestionCount, clientInfo, requestId) : null
  ]);

  antiCheatResults.player1 = p1Check;
  antiCheatResults.player2 = p2Check;

  if (p1Check?.banned) {
    return {
      code: 403,
      success: false,
      message: '账号因异常行为被暂时封禁，请联系客服',
      banExpires: p1Check.banExpires,
      requestId
    };
  }

  if (p2Check?.banned) {
    return {
      code: 403,
      success: false,
      message: '对手账号异常，对战结果无效',
      requestId
    };
  }

  // 3. 幂等性检查
  const idempotencyResult = await checkIdempotency(battleId, 'pk_submit', idempotencyKey);

  if (idempotencyResult.isDuplicate) {
    logger.info(`[${requestId}] 重复提交，返回缓存结果`);
    return {
      ...idempotencyResult.previousResult,
      isDuplicate: true
    };
  }

  // 3. 执行原子性更新
  try {
    const now = Date.now();
    const pkRecordsCollection = db.collection('pk_records');
    const rankingsCollection = db.collection('rankings');

    // 3.1 计算 ELO 分数变化
    const eloResult = calculateEloChange(player1.score, player2.score);

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
    };

    await pkRecordsCollection.add(pkRecord);
    logger.info(`[${requestId}] PK 记录创建成功: ${battleId}`);

    // 3.3 原子性更新双方排行榜分数（使用乐观锁）— 并行执行
    await Promise.all([
      player1.uid && !player1.uid.startsWith('bot_')
        ? updateRankingWithLock(rankingsCollection, player1.uid, player1.score, eloResult.player1Change, requestId)
        : null,
      player2.uid && !player2.uid.startsWith('bot_')
        ? updateRankingWithLock(rankingsCollection, player2.uid, player2.score, eloResult.player2Change, requestId)
        : null
    ]);

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
    };

    // 5. 标记幂等记录完成
    await markIdempotencyCompleted(idempotencyResult.recordId, result);

    return result;
  } catch (error) {
    logger.error(`[${requestId}] 提交对战结果失败:`, error);

    // 标记失败（允许重试）
    if (idempotencyResult.recordId) {
      await db
        .collection(IDEMPOTENCY_COLLECTION)
        .doc(idempotencyResult.recordId)
        .update({
          status: 'failed',
          result: { error: (error as Error).message },
          completed_at: Date.now()
        });
    }

    return {
      code: 500,
      success: false,
      message: '提交失败，请重试'
    };
  }
}

/**
 * 使用乐观锁更新排行榜分数
 * 防止并发更新导致的数据竞争
 */
async function updateRankingWithLock(collection, uid: string, pkScore: number, eloChange: number, requestId: string) {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // 获取当前记录
      const existing = await collection.where({ uid }).getOne();
      const now = Date.now();
      const today = new Date().toISOString().split('T')[0];

      if (existing.data) {
        // 使用版本号作为乐观锁
        const currentVersion = existing.data.version || 0;

        const updateResult = await collection
          .where({
            uid,
            version: currentVersion // 乐观锁条件
          })
          .update({
            total_score: _.inc(pkScore),
            elo_score: _.inc(eloChange),
            pk_count: _.inc(1),
            pk_wins: eloChange > 0 ? _.inc(1) : _.inc(0),
            daily_score: existing.data.daily_date === today ? _.inc(pkScore) : pkScore,
            daily_date: today,
            version: _.inc(1), // 版本号递增
            updated_at: now
          });

        // 检查是否更新成功
        if (updateResult.updated === 0) {
          // 版本冲突，重试
          logger.warn(`[${requestId}] 乐观锁冲突，重试 (${attempt}/${MAX_RETRIES}): ${uid}`);
          if (attempt < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
            continue;
          }
          throw new Error('并发更新冲突，请重试');
        }

        logger.info(`[${requestId}] 排行榜更新成功: ${uid}, +${pkScore}, ELO ${eloChange > 0 ? '+' : ''}${eloChange}`);
        return;
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
        });

        logger.info(`[${requestId}] 排行榜记录创建成功: ${uid}`);
        return;
      }
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }
      logger.warn(`[${requestId}] 更新排行榜失败，重试 (${attempt}/${MAX_RETRIES}):`, (error as Error).message);
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
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
  let winner = 'draw';

  if (player1Score > player2Score) {
    winner = 'player1';
  } else if (player2Score > player1Score) {
    winner = 'player2';
  }

  // 简化版 ELO：基于分数差计算变化
  // 实际 ELO 需要双方历史 ELO 分数，这里使用简化版本
  const scoreDiff = Math.abs(player1Score - player2Score);
  const baseChange = Math.min(ELO_K_FACTOR, Math.ceil(scoreDiff / 10) + 10);

  const player1Change = winner === 'player1' ? baseChange : winner === 'player2' ? -baseChange : 0;
  const player2Change = winner === 'player2' ? baseChange : winner === 'player1' ? -baseChange : 0;

  return {
    winner,
    player1Change,
    player2Change
  };
}

/**
 * 获取 PK 对战记录
 */
async function handleGetRecords(params, requestId) {
  // ✅ P0修复：使用 JWT 认证的 userId，防止 IDOR 越权读取他人记录
  const uid = params._authUserId;
  const { page = 1, limit = 20 } = params;

  if (!validateUserId(uid)) {
    return badRequest('用户ID不合法', requestId);
  }

  const collection = db.collection('pk_records');
  const skip = (Math.max(1, Math.min(page, 100)) - 1) * Math.min(limit, 50);

  const [listRes, countRes] = await Promise.all([
    collection
      .where(_.or([{ 'player1.uid': uid }, { 'player2.uid': uid }]))
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(Math.min(limit, 50))
      .get(),
    collection.where(_.or([{ 'player1.uid': uid }, { 'player2.uid': uid }])).count()
  ]);

  logger.info(`[${requestId}] 获取 PK 记录: ${listRes.data.length}/${countRes.total}`);

  return {
    code: 0,
    success: true,
    data: listRes.data,
    total: countRes.total,
    page,
    limit,
    hasMore: skip + listRes.data.length < countRes.total
  };
}

/**
 * 计算 ELO 分数（供外部调用）
 */
async function handleCalculateElo(params, requestId) {
  const { player1Score, player2Score } = params;

  if (!validateScore(player1Score) || !validateScore(player2Score)) {
    return badRequest('分数参数不合法', requestId);
  }

  const result = calculateEloChange(player1Score, player2Score);

  return success(result, 'ELO 计算完成');
}

// ==================== 幂等性工具函数 ====================

async function checkIdempotency(userId: string, action: string, idempotencyKey: string) {
  const fullKey = `${userId}:${action}:${idempotencyKey}`;
  const collection = db.collection(IDEMPOTENCY_COLLECTION);
  const now = Date.now();

  try {
    const existing = await collection
      .where({
        key: fullKey,
        expires_at: _.gt(now)
      })
      .getOne();

    if (existing.data) {
      if (existing.data.status === 'completed') {
        return { isDuplicate: true, previousResult: existing.data.result };
      }
      if (existing.data.status === 'processing' && now - existing.data.created_at < 30000) {
        return { isDuplicate: true, previousResult: { code: 429, success: false, message: '请求正在处理中' } };
      }
      await collection.doc(existing.data._id).update({ status: 'processing', created_at: now });
      return { isDuplicate: false, recordId: existing.data._id };
    }

    const insertResult = await collection.add({
      key: fullKey,
      user_id: userId,
      action,
      status: 'processing',
      created_at: now,
      expires_at: now + IDEMPOTENCY_TTL
    });

    return { isDuplicate: false, recordId: insertResult.id };
  } catch (error) {
    logger.error('[Idempotency] 检查失败:', error);
    return { isDuplicate: false };
  }
}

async function markIdempotencyCompleted(recordId: string, result: unknown) {
  if (!recordId) return;
  try {
    await db.collection(IDEMPOTENCY_COLLECTION).doc(recordId).update({
      status: 'completed',
      result,
      completed_at: Date.now()
    });
  } catch (error) {
    logger.error('[Idempotency] 标记完成失败:', error);
  }
}

// ==================== 工具函数 ====================

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

function getMonthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

// ==================== 防作弊检测函数 (v2.0新增) ====================

/**
 * 执行防作弊检测
 * @param player 玩家数据
 * @param questionCount 题目数量
 * @param clientInfo 客户端信息
 * @param requestId 请求ID
 */
async function performAntiCheatCheck(
  player: Record<string, unknown>,
  questionCount: number,
  clientInfo: Record<string, unknown>,
  requestId: string
) {
  const result = {
    suspicious: false,
    reasons: [],
    banned: false,
    banExpires: null
  };

  const uid = typeof player.uid === 'string' ? player.uid : '';
  const totalTime = Number(player.totalTime || 0);
  const correctCount = Number(player.correctCount || 0);

  if (!validateUserId(uid)) {
    logger.warn(`[${requestId}] 防作弊检查跳过: 非法 uid`);
    return result;
  }

  // 1. 检查用户是否已被封禁
  const banRecord = await checkUserBan(uid);
  if (banRecord) {
    result.banned = true;
    result.banExpires = banRecord.expires_at;
    logger.warn(`[${requestId}] 用户已被封禁: ${uid}`);
    return result;
  }

  // 2. 答题时间检测
  if (questionCount > 0 && totalTime > 0) {
    const avgTimePerQuestion = totalTime / questionCount;

    // 答题过快检测
    if (avgTimePerQuestion < ANTI_CHEAT_CONFIG.MIN_TIME_PER_QUESTION) {
      result.suspicious = true;
      result.reasons.push(`答题过快: 平均${Math.round(avgTimePerQuestion)}ms/题`);
      logger.warn(`[${requestId}] 可疑行为-答题过快: ${uid}, ${avgTimePerQuestion}ms/题`);
    }
  }

  // 3. 分数合理性检测
  if (questionCount > 0) {
    const correctRate = correctCount / questionCount;

    // 检测连续高分
    if (correctRate >= ANTI_CHEAT_CONFIG.HIGH_SCORE_RATE) {
      const consecutiveHighScores = await checkConsecutiveHighScores(uid);
      if (consecutiveHighScores >= ANTI_CHEAT_CONFIG.CONSECUTIVE_HIGH_SCORE_THRESHOLD) {
        result.suspicious = true;
        result.reasons.push(`连续${consecutiveHighScores}场高分(>${ANTI_CHEAT_CONFIG.HIGH_SCORE_RATE * 100}%)`);
        logger.warn(`[${requestId}] 可疑行为-连续高分: ${uid}, ${consecutiveHighScores}场`);
      }
    }
  }

  // 4. 记录可疑行为
  if (result.suspicious) {
    const suspiciousCount = await recordSuspiciousBehavior(uid, result.reasons, clientInfo, requestId);

    // 达到阈值则封禁
    if (suspiciousCount >= ANTI_CHEAT_CONFIG.SUSPICIOUS_THRESHOLD) {
      await banUser(uid, ANTI_CHEAT_CONFIG.BAN_DURATION, result.reasons.join('; '), requestId);
      result.banned = true;
      result.banExpires = Date.now() + ANTI_CHEAT_CONFIG.BAN_DURATION;
      logger.warn(`[${requestId}] 用户被封禁: ${uid}, 原因: ${result.reasons.join('; ')}`);
    }
  }

  return result;
}

/**
 * 检查用户是否被封禁
 */
async function checkUserBan(uid: string) {
  try {
    const collection = db.collection('user_bans');
    const ban = await collection
      .where({
        uid,
        expires_at: _.gt(Date.now())
      })
      .getOne();
    return ban.data;
  } catch (e) {
    return null;
  }
}

/**
 * 检查连续高分场次
 */
async function checkConsecutiveHighScores(uid: string) {
  try {
    const collection = db.collection('pk_records');
    const recentRecords = await collection
      .where(_.or([{ 'player1.uid': uid }, { 'player2.uid': uid }]))
      .orderBy('created_at', 'desc')
      .limit(ANTI_CHEAT_CONFIG.CONSECUTIVE_HIGH_SCORE_THRESHOLD + 2)
      .get();

    let consecutiveCount = 0;
    for (const record of recentRecords.data) {
      const isPlayer1 = record.player1.uid === uid;
      const playerData = isPlayer1 ? record.player1 : record.player2;
      const questionCount = record.question_count || 5;
      const correctRate = (playerData.correct_count || 0) / questionCount;

      if (correctRate >= ANTI_CHEAT_CONFIG.HIGH_SCORE_RATE) {
        consecutiveCount++;
      } else {
        break;
      }
    }

    return consecutiveCount;
  } catch (e) {
    return 0;
  }
}

/**
 * 记录可疑行为
 */
async function recordSuspiciousBehavior(
  uid: string,
  reasons: string[],
  clientInfo: Record<string, unknown>,
  requestId: string
) {
  try {
    const collection = db.collection('suspicious_behaviors');
    const now = Date.now();

    // 记录本次可疑行为
    await collection.add({
      uid,
      reasons,
      client_ip: clientInfo?.ip || 'unknown',
      device_id: clientInfo?.deviceId || 'unknown',
      created_at: now,
      request_id: requestId
    });

    // 统计最近7天的可疑行为次数
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const countResult = await collection
      .where({
        uid,
        created_at: _.gt(sevenDaysAgo)
      })
      .count();

    return countResult.total;
  } catch (e) {
    logger.error('[AntiCheat] 记录可疑行为失败:', e);
    return 0;
  }
}

/**
 * 封禁用户
 */
async function banUser(uid: string, duration: number, reason: string, requestId: string) {
  try {
    const collection = db.collection('user_bans');
    const now = Date.now();

    await collection.add({
      uid,
      reason,
      banned_at: now,
      expires_at: now + duration,
      request_id: requestId
    });

    logger.info(`[${requestId}] 用户封禁成功: ${uid}, 时长: ${duration / 1000 / 60 / 60}小时`);
  } catch (e) {
    logger.error('[AntiCheat] 封禁用户失败:', e);
  }
}

// ==================== Phase 3-2: 实时 PK 房间管理 ====================

const PK_ROOMS_COLLECTION = 'pk_rooms';
const ROOM_TTL = 10 * 60 * 1000; // 房间 10 分钟过期
const MATCH_TIMEOUT = 30 * 1000; // 匹配超时 30 秒

/**
 * 寻找匹配 / 创建房间
 * 逻辑：查找 waiting 状态的房间 → 有则加入 → 无则创建新房间
 * 参数：category, questionCount (可选)
 */
async function handleFindMatch(params, requestId) {
  const userId = params._authUserId;
  const category = params.category || '综合';
  const questionCount = Math.min(Math.max(parseInt(params.questionCount) || 5, 3), 10);
  const now = Date.now();

  const rooms = db.collection(PK_ROOMS_COLLECTION);

  // 先清理该用户可能残留的旧 waiting 房间
  try {
    await rooms
      .where({
        'player1.uid': userId,
        status: 'waiting',
        created_at: _.lt(now - ROOM_TTL)
      })
      .update({ status: 'expired', updated_at: now });
  } catch (_e) {
    /* silent */
  }

  // 查找可加入的房间（同分类、waiting 状态、未过期、不是自己创建的）
  const available = await rooms
    .where({
      status: 'waiting',
      category,
      question_count: questionCount,
      'player1.uid': _.neq(userId),
      created_at: _.gt(now - MATCH_TIMEOUT)
    })
    .orderBy('created_at', 'asc')
    .limit(1)
    .get();

  if (available.data && available.data.length > 0) {
    // 加入已有房间
    const room = available.data[0];

    // 获取加入者信息
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data || {};

    const player2 = {
      uid: userId,
      name: userData.nickname || userData.username || '研友',
      avatar: userData.avatar || '',
      score: 0,
      correct_count: 0,
      answers: [],
      current_index: 0,
      finished: false
    };

    // 原子更新：只有 status 仍为 waiting 时才能加入（防并发）
    const updateResult = await rooms
      .where({
        _id: room._id,
        status: 'waiting'
      })
      .update({
        player2,
        status: 'ready',
        matched_at: now,
        updated_at: now
      });

    if (!updateResult.updated || updateResult.updated === 0) {
      // 被别人抢先加入了，递归重试一次
      return handleFindMatch(params, requestId);
    }

    logger.info(`[${requestId}] 玩家 ${userId} 加入房间 ${room._id}`);

    return {
      code: 0,
      success: true,
      data: {
        room_id: room._id,
        role: 'player2',
        status: 'ready',
        player1: room.player1,
        player2,
        questions: room.questions,
        question_count: room.question_count
      },
      message: '匹配成功'
    };
  }

  // 没有可用房间，创建新房间
  // 从题库随机抽题
  const questions = await pickRandomQuestions(category, questionCount);
  if (questions.length === 0) {
    return badRequest('该分类暂无可用题目');
  }

  // 获取创建者信息
  const userDoc = await db.collection('users').doc(userId).get();
  const userData = userDoc.data || {};

  const player1 = {
    uid: userId,
    name: userData.nickname || userData.username || '研友',
    avatar: userData.avatar || '',
    score: 0,
    correct_count: 0,
    answers: [],
    current_index: 0,
    finished: false
  };

  const roomData = {
    player1,
    player2: null,
    status: 'waiting', // waiting → ready → playing → finished
    category,
    question_count: questionCount,
    questions: questions.map((q) => ({
      _id: q._id,
      content: q.content || q.question || '',
      options: q.options || [],
      answer: q.answer,
      analysis: q.analysis || '',
      category: q.category || category,
      difficulty: q.difficulty || 'medium'
    })),
    current_round: 0,
    round_start_at: null,
    created_at: now,
    updated_at: now,
    matched_at: null,
    finished_at: null
  };

  const insertResult = await rooms.add(roomData);

  logger.info(`[${requestId}] 玩家 ${userId} 创建房间 ${insertResult.id}`);

  return {
    code: 0,
    success: true,
    data: {
      room_id: insertResult.id,
      role: 'player1',
      status: 'waiting',
      player1,
      question_count: questionCount
    },
    message: '等待匹配中'
  };
}

/**
 * 轮询房间状态（客户端每 1s 调用一次）
 * 返回：房间状态、双方分数、对手答题进度
 */
async function handlePollRoom(params, _requestId) {
  const userId = params._authUserId;
  const roomId = params.room_id;

  if (!roomId) return badRequest('room_id 不能为空');

  const rooms = db.collection(PK_ROOMS_COLLECTION);
  const roomDoc = await rooms.doc(roomId).get();

  if (!roomDoc.data) {
    return { code: 404, success: false, message: '房间不存在或已过期' };
  }

  const room = roomDoc.data;

  // 验证用户是房间参与者
  const isP1 = room.player1?.uid === userId;
  const isP2 = room.player2?.uid === userId;
  if (!isP1 && !isP2) {
    return { code: 403, success: false, message: '你不是该房间的参与者' };
  }

  // 检查房间是否超时（waiting 超过 30s 未匹配）
  const now = Date.now();
  if (room.status === 'waiting' && now - room.created_at > MATCH_TIMEOUT) {
    await rooms.doc(roomId).update({ status: 'timeout', updated_at: now });
    return {
      code: 0,
      success: true,
      data: { status: 'timeout', room_id: roomId },
      message: '匹配超时，请降级为机器人对战'
    };
  }

  // 构建返回数据（隐藏题目答案，只返回对手已答题的结果）
  const myRole = isP1 ? 'player1' : 'player2';
  const opRole = isP1 ? 'player2' : 'player1';
  const me = room[myRole];
  const opponent = room[opRole];

  return {
    code: 0,
    success: true,
    data: {
      room_id: roomId,
      status: room.status,
      my_role: myRole,
      me: me
        ? { score: me.score, correct_count: me.correct_count, current_index: me.current_index, finished: me.finished }
        : null,
      opponent: opponent
        ? {
            uid: opponent.uid,
            name: opponent.name,
            avatar: opponent.avatar,
            score: opponent.score,
            correct_count: opponent.correct_count,
            current_index: opponent.current_index,
            finished: opponent.finished
          }
        : null,
      // 只在 ready/playing 状态下发题目（不含答案）
      questions:
        room.status === 'ready' || room.status === 'playing'
          ? room.questions.map((q) => ({
              _id: q._id,
              content: q.content,
              options: q.options,
              category: q.category,
              difficulty: q.difficulty
            }))
          : undefined,
      question_count: room.question_count,
      matched_at: room.matched_at,
      created_at: room.created_at
    }
  };
}

/**
 * 提交单题答案（实时同步）
 * 参数：room_id, question_index, answer, duration
 */
async function handleRoomAnswer(params, _requestId) {
  const userId = params._authUserId;
  const { room_id, question_index, answer, duration } = params;

  if (!room_id) return badRequest('room_id 不能为空');
  if (question_index === undefined || question_index === null) return badRequest('question_index 不能为空');
  if (!answer) return badRequest('answer 不能为空');

  const rooms = db.collection(PK_ROOMS_COLLECTION);
  const roomDoc = await rooms.doc(room_id).get();

  if (!roomDoc.data) {
    return { code: 404, success: false, message: '房间不存在' };
  }

  const room = roomDoc.data;
  const isP1 = room.player1?.uid === userId;
  const isP2 = room.player2?.uid === userId;
  if (!isP1 && !isP2) {
    return { code: 403, success: false, message: '你不是该房间的参与者' };
  }

  const playerKey = isP1 ? 'player1' : 'player2';
  const player = room[playerKey];
  const idx = parseInt(question_index);

  // 防止重复提交同一题
  if (player.answers && player.answers[idx] !== undefined) {
    return { code: 0, success: true, data: { duplicate: true }, message: '该题已提交' };
  }

  // 判断答案正确性
  const question = room.questions[idx];
  if (!question) {
    return badRequest('题目索引越界');
  }

  const correctAnswer = (question.answer || '').toUpperCase();
  const userAnswer = (answer || '').toUpperCase();
  const isCorrect = correctAnswer === userAnswer;
  const scoreGain = isCorrect ? POINTS_PER_CORRECT : 0;
  const now = Date.now();

  // 构建更新
  const updateData: Record<string, unknown> = {
    [`${playerKey}.answers.${idx}`]: {
      answer: userAnswer,
      correct: isCorrect,
      duration: Math.min(parseInt(duration) || 0, 60),
      submitted_at: now
    },
    [`${playerKey}.score`]: _.inc(scoreGain),
    [`${playerKey}.correct_count`]: isCorrect ? _.inc(1) : _.inc(0),
    [`${playerKey}.current_index`]: idx + 1,
    updated_at: now
  };

  // 检查是否答完所有题
  const isLastQuestion = idx + 1 >= room.question_count;
  if (isLastQuestion) {
    updateData[`${playerKey}.finished`] = true;
  }

  // 如果房间还是 ready 状态，第一次答题时切换为 playing
  if (room.status === 'ready') {
    updateData.status = 'playing';
  }

  await rooms.doc(room_id).update(updateData);

  // 检查双方是否都答完 → 标记房间 finished
  if (isLastQuestion) {
    const opKey = isP1 ? 'player2' : 'player1';
    const opFinished = room[opKey]?.finished;
    if (opFinished) {
      await rooms.doc(room_id).update({ status: 'finished', finished_at: now, updated_at: now });
    }
  }

  return {
    code: 0,
    success: true,
    data: {
      is_correct: isCorrect,
      correct_answer: correctAnswer,
      score_gain: scoreGain,
      analysis: question.analysis || '',
      is_last: isLastQuestion
    },
    message: isCorrect ? '回答正确' : '回答错误'
  };
}

/**
 * 离开房间
 */
async function handleLeaveRoom(params, requestId) {
  const userId = params._authUserId;
  const roomId = params.room_id;

  if (!roomId) return badRequest('room_id 不能为空');

  const rooms = db.collection(PK_ROOMS_COLLECTION);
  const roomDoc = await rooms.doc(roomId).get();

  if (!roomDoc.data) {
    return { code: 0, success: true, message: '房间已不存在' };
  }

  const room = roomDoc.data;
  const now = Date.now();

  if (room.status === 'waiting' && room.player1?.uid === userId) {
    // 创建者离开等待中的房间 → 直接删除
    await rooms.doc(roomId).remove();
  } else if (room.status === 'playing' || room.status === 'ready') {
    // 对战中离开 → 标记为对手胜利
    const isP1 = room.player1?.uid === userId;
    const winnerKey = isP1 ? 'player2' : 'player1';
    await rooms.doc(roomId).update({
      status: 'finished',
      winner: room[winnerKey]?.uid || 'unknown',
      finish_reason: 'opponent_left',
      finished_at: now,
      updated_at: now
    });
  }

  logger.info(`[${requestId}] 玩家 ${userId} 离开房间 ${roomId}`);

  return { code: 0, success: true, message: '已离开房间' };
}

/**
 * 从题库随机抽取指定数量的题目
 */
async function pickRandomQuestions(category: string, count: number) {
  const collection = db.collection('questions');

  try {
    // 使用聚合管道随机抽样
    const result = await collection
      .aggregate()
      .match(category === '综合' ? {} : { category })
      .sample({ size: count })
      .end();

    if (result.data && result.data.length > 0) {
      return result.data;
    }
  } catch (_e) {
    // 聚合不可用，降级为 skip+limit
  }

  // 降级方案：随机 skip
  const total = await collection.where(category === '综合' ? {} : { category }).count();
  const maxSkip = Math.max(0, (total.total || 0) - count);
  const skip = Math.floor(Math.random() * maxSkip);

  const result = await collection
    .where(category === '综合' ? {} : { category })
    .skip(skip)
    .limit(count)
    .get();

  return result.data || [];
}
