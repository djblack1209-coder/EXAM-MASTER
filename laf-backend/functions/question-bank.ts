/**
 * 题库管理云函数
 * 支持操作：get, random, getByIds
 */

import { getClientIp, clientIpUnavailable } from './_shared/client-ip.js';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import { checkRateLimitDistributed, createLogger } from './_shared/api-response.js';
// ✅ B8: 输入清洗工具（共享模块）

const logger = createLogger('[QuestionBank]');

const QUESTION_BANK_LIMIT_WINDOW_MS = 60 * 1000;
const QUESTION_BANK_LIMIT_MAX = 90;

export default async function (ctx) {
  const requestId = `qb_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const { action, userId: claimedUserId } = ctx.body || {};

    // 防御纵深：优先检查认证，再校验参数
    const publicActions = new Set(['get', 'random', 'getByIds']);
    let authUserId = null;

    const authResult = requireAuth(ctx);
    if (!isAuthError(authResult)) {
      if (claimedUserId && authResult.userId !== claimedUserId) {
        return { code: 403, success: false, message: '身份验证失败', requestId, timestamp: Date.now() };
      }
      authUserId = authResult.userId;
    }

    // 参数校验（已尝试认证后再检查）
    if (!action) {
      // 未认证且缺少action → 返回401，不暴露参数要求
      if (!authUserId) {
        return { code: 401, success: false, message: '缺少认证 token，请重新登录', requestId, timestamp: Date.now() };
      }
      return { code: 400, success: false, message: '缺少 action 参数', requestId, timestamp: Date.now() };
    }

    // 非公开操作需要认证
    if (!authUserId && !publicActions.has(action)) {
      return { code: 401, success: false, message: '缺少认证 token，请重新登录', requestId, timestamp: Date.now() };
    }

    const clientIp = getClientIp(ctx);
    if (!clientIp) return clientIpUnavailable();
    const rateLimitKey = `question-bank:${authUserId || clientIp}:${action}`;
    const rateLimit = await checkRateLimitDistributed(
      rateLimitKey,
      QUESTION_BANK_LIMIT_MAX,
      QUESTION_BANK_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return {
        code: 429,
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        requestId,
        timestamp: Date.now()
      };
    }

    return {
      code: 410,
      success: false,
      error: 'QUESTION_BANK_RETIRED',
      message: '内置题库已下线',
      requestId,
      timestamp: Date.now()
    };
  } catch (error) {
    logger.error('题库退役请求失败', error);
    return { code: 500, success: false, message: '请求暂不可用', requestId, timestamp: Date.now() };
  }
}
