/**
 * 防作弊检测系统 — 共享模块
 *
 * 从 pk-battle.ts 提取，提供通用的答题防作弊能力：
 * 1. 答题时间检测（过快/过慢）
 * 2. 连续高分检测
 * 3. 可疑行为记录
 * 4. 用户封禁管理
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { validateUserId, createLogger } from './api-response';

const db = cloud.database();
const _ = db.command;
const logger = createLogger('[AntiCheat]');

// ==================== 防作弊配置 ====================
export const ANTI_CHEAT_CONFIG = {
  /** 每题最短答题时间（毫秒） — 低于此时间判定为可疑 */
  MIN_TIME_PER_QUESTION: 2000,
  /** 每题最长答题时间（毫秒） — 超过此时间判定为超时 */
  MAX_TIME_PER_QUESTION: 120000,
  /** 连续高分检测阈值（连续 N 场正确率 > 阈值触发检测） */
  CONSECUTIVE_HIGH_SCORE_THRESHOLD: 5,
  /** 高分定义（正确率） */
  HIGH_SCORE_RATE: 0.9,
  /** 作弊封禁时长（毫秒）— 默认 7 天 */
  BAN_DURATION: 7 * 24 * 60 * 60 * 1000,
  /** 可疑行为累计阈值（达到此值触发封禁） */
  SUSPICIOUS_THRESHOLD: 3
};

/** 防作弊检测结果 */
export interface AntiCheatResult {
  suspicious: boolean;
  reasons: string[];
  banned: boolean;
  banExpires: number | null;
}

/**
 * 执行防作弊检测
 * @param player - 玩家数据（需包含 uid、totalTime、correctCount）
 * @param questionCount - 题目数量
 * @param clientInfo - 客户端信息（ip、deviceId 等）
 * @param requestId - 请求 ID（日志追踪用）
 * @param recordsCollection - 战绩集合名，默认 'pk_records'
 * @returns 检测结果
 */
export async function performAntiCheatCheck(
  player: Record<string, unknown>,
  questionCount: number,
  clientInfo: Record<string, unknown>,
  requestId: string,
  recordsCollection = 'pk_records'
): Promise<AntiCheatResult> {
  const result: AntiCheatResult = {
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
    result.banExpires = banRecord.expires_at as number;
    logger.warn(`[${requestId}] 用户已被封禁: ${uid}`);
    return result;
  }

  // 2. 答题时间检测
  if (questionCount > 0 && totalTime > 0) {
    const avgTimePerQuestion = totalTime / questionCount;
    if (avgTimePerQuestion < ANTI_CHEAT_CONFIG.MIN_TIME_PER_QUESTION) {
      result.suspicious = true;
      result.reasons.push(`答题过快: 平均${Math.round(avgTimePerQuestion)}ms/题`);
      logger.warn(`[${requestId}] 可疑行为-答题过快: ${uid}, ${avgTimePerQuestion}ms/题`);
    }
  }

  // 3. 分数合理性检测
  if (questionCount > 0) {
    const correctRate = correctCount / questionCount;
    if (correctRate >= ANTI_CHEAT_CONFIG.HIGH_SCORE_RATE) {
      const consecutiveHighScores = await checkConsecutiveHighScores(uid, recordsCollection);
      if (consecutiveHighScores >= ANTI_CHEAT_CONFIG.CONSECUTIVE_HIGH_SCORE_THRESHOLD) {
        result.suspicious = true;
        result.reasons.push(`连续${consecutiveHighScores}场高分(>${ANTI_CHEAT_CONFIG.HIGH_SCORE_RATE * 100}%)`);
        logger.warn(`[${requestId}] 可疑行为-连续高分: ${uid}, ${consecutiveHighScores}场`);
      }
    }
  }

  // 4. 记录可疑行为并判断是否封禁
  if (result.suspicious) {
    const suspiciousCount = await recordSuspiciousBehavior(uid, result.reasons, clientInfo, requestId);
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
 * @returns 封禁记录，未封禁返回 null
 */
export async function checkUserBan(uid: string): Promise<Record<string, unknown> | null> {
  try {
    const collection = db.collection('user_bans');
    const ban = await collection
      .where({
        uid,
        expires_at: _.gt(Date.now())
      })
      .getOne();
    return (ban.data as Record<string, unknown>) || null;
  } catch {
    return null;
  }
}

/**
 * 检查连续高分场次
 */
async function checkConsecutiveHighScores(uid: string, collectionName = 'pk_records'): Promise<number> {
  try {
    const coll = db.collection(collectionName);
    const recentRecords = await coll
      .where(_.or([{ 'player1.uid': uid }, { 'player2.uid': uid }]))
      .orderBy('created_at', 'desc')
      .limit(ANTI_CHEAT_CONFIG.CONSECUTIVE_HIGH_SCORE_THRESHOLD + 2)
      .get();

    let consecutiveCount = 0;
    for (const record of recentRecords.data) {
      const isPlayer1 = (record as any).player1.uid === uid;
      const playerData = isPlayer1 ? (record as any).player1 : (record as any).player2;
      const questionCount = (record as any).question_count || 5;
      const correctRate = (playerData.correct_count || 0) / questionCount;

      if (correctRate >= ANTI_CHEAT_CONFIG.HIGH_SCORE_RATE) {
        consecutiveCount++;
      } else {
        break;
      }
    }

    return consecutiveCount;
  } catch {
    return 0;
  }
}

/**
 * 记录可疑行为
 * @returns 最近 7 天的可疑行为总次数
 */
async function recordSuspiciousBehavior(
  uid: string,
  reasons: string[],
  clientInfo: Record<string, unknown>,
  requestId: string
): Promise<number> {
  try {
    const collection = db.collection('suspicious_behaviors');
    const now = Date.now();

    await collection.add({
      uid,
      reasons,
      client_ip: clientInfo?.ip || 'unknown',
      device_id: clientInfo?.deviceId || 'unknown',
      created_at: now,
      request_id: requestId
    });

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
async function banUser(uid: string, duration: number, reason: string, requestId: string): Promise<void> {
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
