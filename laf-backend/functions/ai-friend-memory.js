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
import { verifyJWT } from './login';

const db = cloud.database();
const _ = db.command;

// 每个好友最多保存的记忆条数
const MAX_MEMORY_PER_FRIEND = 50;

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const { action, userId, friendType, data, token } = ctx.body || {};

    if (!userId) {
      return { code: 401, message: '用户未登录', requestId };
    }

    if (!action) {
      return { code: 400, message: '缺少 action 参数', requestId };
    }

    // [AUDIT FIX] JWT 身份验证 — 始终要求认证（移除 NODE_ENV 条件），且强制校验 payload.userId
    const authToken = ctx.headers?.['authorization'] || token;
    if (!authToken) {
      return { code: 401, message: '缺少认证 token，请重新登录', requestId };
    }
    const rawToken = authToken.startsWith('Bearer ') ? authToken.slice(7) : authToken;
    const payload = verifyJWT(rawToken);
    if (!payload) {
      return { code: 401, message: 'token 无效或已过期，请重新登录', requestId };
    }
    if (!payload.userId) {
      return { code: 401, message: '无效的 token（缺少用户标识）', requestId };
    }
    if (payload.userId !== userId) {
      return { code: 401, message: '身份验证失败', requestId };
    }

    console.log(`[${requestId}] AI记忆: action=${action}, friendType=${friendType}`);

    switch (action) {
      case 'get':
        return await getMemory(userId, friendType, requestId);
      case 'save':
        return await saveMemory(userId, friendType, data, requestId);
      case 'clear':
        return await clearMemory(userId, friendType, requestId);
      default:
        return { code: 400, message: `未知的 action: ${action}`, requestId };
    }
  } catch (error) {
    console.error(`[${requestId}] AI记忆异常:`, error);
    return {
      code: 500,
      message: error.message || '服务器错误',
      requestId,
      duration: Date.now() - startTime
    };
  }
}

/**
 * 获取对话记忆
 */
async function getMemory(userId, friendType, requestId) {
  const query = { user_id: userId };
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
    return { code: 400, message: '缺少 friendType 参数', requestId };
  }

  const { userMessage, aiReply, emotion, summary } = data || {};

  if (!userMessage && !aiReply) {
    return { code: 400, message: '缺少对话内容', requestId };
  }

  const now = Date.now();

  await db.collection('ai_friend_memory').add({
    user_id: userId,
    friend_type: friendType,
    user_message: userMessage || '',
    ai_reply: aiReply || '',
    emotion: emotion || 'neutral',
    summary: summary || '',
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
  const query = { user_id: userId };
  if (friendType) query.friend_type = friendType;

  const result = await db.collection('ai_friend_memory').where(query).remove();

  return {
    code: 0,
    success: true,
    message: `已清除 ${result.deleted || 0} 条记忆`,
    requestId
  };
}
