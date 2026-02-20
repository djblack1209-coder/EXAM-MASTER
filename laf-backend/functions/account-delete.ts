/**
 * 账号注销云函数
 *
 * C5: 微信审核硬性要求 — 用户必须能注销账号
 *
 * 功能：
 * 1. 验证用户身份（JWT）
 * 2. 标记账号为待删除状态（7天冷静期）
 * 3. 冷静期后由定时任务彻底清除数据
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { verifyJWT } from './login';
import { createLogger } from './_shared/api-response';

const db = cloud.database();
const logger = createLogger('[AccountDelete]');

// 冷静期天数
const COOLING_DAYS = 7;

export default async function (ctx: any) {
  const requestId = `accdel_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    // 1. 身份验证
    const token = ctx.headers?.authorization?.replace('Bearer ', '') || ctx.body?.token;
    const payload = verifyJWT(token);
    if (!payload || !payload.uid) {
      return { code: 401, success: false, message: '请先登录' };
    }

    const userId = payload.uid;
    const { action = 'request' } = ctx.body || {};

    // 2. 请求注销
    if (action === 'request') {
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
        data: { deletionScheduledAt: deleteAt, coolingDays: COOLING_DAYS }
      };
    }

    // 3. 撤销注销
    if (action === 'cancel') {
      const { data: user } = await db.collection('users').doc(userId).get();
      if (!user || user.account_status !== 'pending_deletion') {
        return { code: 400, success: false, message: '当前账号无待注销申请' };
      }

      await db.collection('users').doc(userId).update({
        account_status: 'active',
        deletion_requested_at: db.command.remove(),
        deletion_scheduled_at: db.command.remove(),
        updated_at: Date.now()
      });

      logger.info(`[${requestId}] 用户 ${userId} 撤销注销`);
      return { code: 0, success: true, message: '注销申请已撤销' };
    }

    // 4. 查询注销状态
    if (action === 'status') {
      const { data: user } = await db.collection('users').doc(userId).get();
      return {
        code: 0,
        success: true,
        data: {
          status: user?.account_status || 'active',
          deletionScheduledAt: user?.deletion_scheduled_at || null
        }
      };
    }

    return { code: 400, success: false, message: '不支持的操作' };
  } catch (error: any) {
    logger.error(`[${requestId}] 账号注销异常:`, error);
    return { code: 500, success: false, message: '操作失败，请稍后重试' };
  }
}
