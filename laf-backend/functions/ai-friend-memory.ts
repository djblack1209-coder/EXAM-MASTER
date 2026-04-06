/**
 * AI好友记忆管理云函数
 * ✅ B024: 补充前端调用但后端缺失的 /ai-friend-memory 接口
 *
 * 支持操作：
 * - get: 获取与某个AI好友的对话记忆
 * - save: 保存对话记忆
 * - clear: 清除对话记忆
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware';
import { createLogger, checkRateLimitDistributed } from './_shared/api-response';

const db = cloud.database();
const logger = createLogger('[AiFriendMemory]');

// 每个好友最多保存的记忆条数
const MAX_MEMORY_PER_FRIEND = 50;
const MAX_FRIEND_TYPE_LENGTH = 64;
const MAX_MEMORY_MESSAGE_LENGTH = 2000;
const MAX_MEMORY_SUMMARY_LENGTH = 1000;

function normalizeFriendType(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, MAX_FRIEND_TYPE_LENGTH);
}

function toSafeText(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLength);
}

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const { action, userId: requestUserId, friendType, data } = ctx.body || {};
    const safeFriendType = normalizeFriendType(friendType);

    if (!action) {
      return { code: 400, success: false, message: '缺少 action 参数', requestId };
    }

    // 统一认证中间件验证
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return { ...authResult, requestId };
    }
    const authUserId = authResult.userId;

    // 客户端声明的 userId 一致性校验（防止越权）
    if (requestUserId && authUserId !== requestUserId) {
      return { code: 403, success: false, message: '身份验证失败', requestId };
    }

    // 分布式频率限制（每用户每分钟20次）
    const rateResult = await checkRateLimitDistributed(`ai_mem:${authUserId}`, 20, 60_000);
    if (!rateResult.allowed) {
      logger.warn(`[${requestId}] AI记忆请求频率过高: userId=${authUserId}`);
      return { code: 429, success: false, message: '请求过于频繁，请稍后再试', requestId };
    }

    logger.info(`[${requestId}] AI记忆: action=${action}, friendType=${safeFriendType || 'all'}`);

    switch (action) {
      case 'get':
        return await getMemory(authUserId, safeFriendType, requestId);
      case 'save':
        return await saveMemory(authUserId, safeFriendType, data, requestId);
      case 'clear':
        return await clearMemory(authUserId, safeFriendType, requestId);
      default:
        return { code: 400, success: false, message: `未知的 action: ${action}`, requestId };
    }
  } catch (error) {
    logger.error(`[${requestId}] AI记忆异常:`, error);
    return {
      code: 500,
      success: false,
      message: '服务器错误',
      requestId,
      duration: Date.now() - startTime
    };
  }
}

/**
 * 获取对话记忆
 */
async function getMemory(userId, friendType, requestId) {
  const query: Record<string, unknown> = { user_id: userId };
  if (friendType) query.friend_type = friendType;

  const result = await db
    .collection('ai_friend_memory')
    .where(query)
    .orderBy('created_at', 'desc')
    .limit(MAX_MEMORY_PER_FRIEND)
    .get();

  return {
    code: 0,
    success: true,
    data: result.data || [],
    requestId
  };
}

/**
 * 保存对话记忆
 */
async function saveMemory(userId, friendType, data, requestId) {
  if (!friendType) {
    return { code: 400, success: false, message: '缺少 friendType 参数', requestId };
  }

  const payload = data && typeof data === 'object' ? data : {};
  const { userMessage, aiReply, emotion, summary } = payload;

  const safeUserMessage = toSafeText(userMessage, MAX_MEMORY_MESSAGE_LENGTH);
  const safeAiReply = toSafeText(aiReply, MAX_MEMORY_MESSAGE_LENGTH);
  const safeSummary = toSafeText(summary, MAX_MEMORY_SUMMARY_LENGTH);
  const safeEmotion = toSafeText(emotion, 32) || 'neutral';

  if (!safeUserMessage && !safeAiReply) {
    return { code: 400, success: false, message: '缺少对话内容', requestId };
  }

  const now = Date.now();

  await db.collection('ai_friend_memory').add({
    user_id: userId,
    friend_type: friendType,
    user_message: safeUserMessage,
    ai_reply: safeAiReply,
    emotion: safeEmotion,
    summary: safeSummary,
    created_at: now
  });

  // 清理超出限制的旧记忆
  const countResult = await db
    .collection('ai_friend_memory')
    .where({ user_id: userId, friend_type: friendType })
    .count();

  if ((countResult.total || 0) > MAX_MEMORY_PER_FRIEND) {
    const oldRecords = await db
      .collection('ai_friend_memory')
      .where({ user_id: userId, friend_type: friendType })
      .orderBy('created_at', 'asc')
      .limit((countResult.total || 0) - MAX_MEMORY_PER_FRIEND)
      .get();

    for (const record of oldRecords.data || []) {
      await db.collection('ai_friend_memory').doc(record._id).remove();
    }
  }

  return { code: 0, success: true, message: '记忆已保存', requestId };
}

/**
 * 清除对话记忆
 */
async function clearMemory(userId, friendType, requestId) {
  const query: Record<string, unknown> = { user_id: userId };
  if (friendType) query.friend_type = friendType;

  const result = await db.collection('ai_friend_memory').where(query).remove();

  return {
    code: 0,
    success: true,
    message: `已清除 ${result.deleted || 0} 条记忆`,
    requestId
  };
}
