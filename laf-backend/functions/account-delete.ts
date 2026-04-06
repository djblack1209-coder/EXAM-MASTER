/**
 * 账号注销云函数
 *
 * C5: 微信审核硬性要求 — 用户必须能注销账号
 *
 * 功能：
 * 1. 验证用户身份（JWT）
 * 2. 标记账号为待删除状态（7天冷静期）
 * 3. 冷静期后由 account-purge 定时任务彻底清除数据
 * 4. 支持撤销注销、查询注销状态
 *
 * actions: request | cancel | status
 *
 * @version 2.0.0
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware';
import { createLogger, checkRateLimitDistributed } from './_shared/api-response';

const db = cloud.database();
const logger = createLogger('[AccountDelete]');

// 冷静期天数
const COOLING_DAYS = 7;
const ACCOUNT_DELETE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const ACCOUNT_DELETE_RATE_LIMIT_MAX = 10;

export default async function (ctx: any) {
  const requestId = `accdel_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    // 1. 身份验证
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return { ...authResult, requestId };
    }

    const userId = authResult.userId;
    const action = typeof ctx.body?.action === 'string' ? ctx.body.action.trim() : '';

    if (!action) {
      return { code: 400, success: false, message: '缺少 action 参数', requestId };
    }

    if (!['request', 'cancel', 'status'].includes(action)) {
      return { code: 400, success: false, message: '不支持的操作', requestId };
    }

    // 限流
    const rateLimit = await checkRateLimitDistributed(
      `account-delete:${userId}:${action}`,
      ACCOUNT_DELETE_RATE_LIMIT_MAX,
      ACCOUNT_DELETE_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return {
        code: 429,
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        requestId
      };
    }

    // 2. 请求注销
    if (action === 'request') {
      // 检查是否已在注销流程中
      const { data: existingUser } = await db.collection('users').doc(userId).get();
      if (!existingUser) {
        return { code: 404, success: false, message: '用户不存在', requestId };
      }

      if (existingUser?.account_status === 'pending_deletion') {
        return {
          code: 0,
          success: true,
          message: '注销申请已存在，无需重复提交',
          data: {
            deletionScheduledAt: existingUser.deletion_scheduled_at,
            coolingDays: COOLING_DAYS
          },
          requestId
        };
      }

      const deleteAt = Date.now() + COOLING_DAYS * 24 * 60 * 60 * 1000;

      await db.collection('users').doc(userId).update({
        account_status: 'pending_deletion',
        deletion_requested_at: Date.now(),
        deletion_scheduled_at: deleteAt,
        updated_at: Date.now()
      });

      logger.info(`[${requestId}] 用户 ${userId} 申请注销，将于 ${new Date(deleteAt).toISOString()} 执行`);

      return {
        code: 0,
        success: true,
        message: `账号注销申请已提交，${COOLING_DAYS}天冷静期内可撤销`,
        data: { deletionScheduledAt: deleteAt, coolingDays: COOLING_DAYS },
        requestId
      };
    }

    // 3. 撤销注销
    if (action === 'cancel') {
      const { data: user } = await db.collection('users').doc(userId).get();
      if (!user || user.account_status !== 'pending_deletion') {
        return { code: 400, success: false, message: '当前账号无待注销申请', requestId };
      }

      await db.collection('users').doc(userId).update({
        account_status: 'active',
        deletion_requested_at: db.command.remove(),
        deletion_scheduled_at: db.command.remove(),
        updated_at: Date.now()
      });

      logger.info(`[${requestId}] 用户 ${userId} 撤销注销`);
      return { code: 0, success: true, message: '注销申请已撤销，账号已恢复正常', requestId };
    }

    // 4. 查询注销状态
    if (action === 'status') {
      const { data: user } = await db.collection('users').doc(userId).get();
      const status = user?.account_status || 'active';
      const scheduledAt = user?.deletion_scheduled_at || null;
      const remainingDays = scheduledAt
        ? Math.max(0, Math.ceil((scheduledAt - Date.now()) / (24 * 60 * 60 * 1000)))
        : null;

      return {
        code: 0,
        success: true,
        data: {
          status,
          deletionScheduledAt: scheduledAt,
          remainingDays
        },
        requestId
      };
    }
  } catch (error: any) {
    logger.error(`[${requestId}] 账号注销异常:`, error);
    return { code: 500, success: false, message: '操作失败，请稍后重试', requestId };
  }
}
