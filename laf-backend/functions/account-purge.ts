/**
 * 账号数据清除定时任务
 *
 * C5: 冷静期到期后，彻底删除用户在所有集合中的数据
 *
 * 部署方式：在 Laf/Sealos 控制台配置定时触发器，每天执行一次
 * 触发器 cron: 0 3 * * *  （每天凌晨3点）
 *
 * 也可通过 account-delete?action=execute_purge 由管理员手动触发
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import crypto from 'crypto';
import { createLogger } from './_shared/api-response.js';

const db = cloud.database();
const _ = db.command;
const logger = createLogger('[AccountPurge]');

// 需要清除用户数据的集合及其用户ID字段名
const USER_COLLECTIONS = [
  // 用户主表（最后删除）
  // { name: 'users', field: '_id' },  — 单独处理

  // 学习数据（按各集合实际字段映射）
  { name: 'mistake_book', field: 'user_id' },
  { name: 'practice_records', field: 'user_id' },
  { name: 'learning_goals', field: 'user_id' },
  { name: 'goal_progress', field: 'user_id' },
  { name: 'learning_progress', field: 'user_id' },
  { name: 'daily_stats', field: 'user_id' },
  { name: 'study_plans', field: 'user_id' },
  { name: 'user_materials', field: 'userId' },
  { name: 'user_questions', field: 'userId' },

  // 社交 & PK
  { name: 'friends', field: 'user_id' },
  { name: 'rankings', field: 'uid' },
  { name: 'pk_battles', field: 'user_id' },
  // pk_records 使用 player1.uid / player2.uid，需特殊处理，见下方
  { name: 'group_members', field: 'user_id' },

  // 收藏
  { name: 'favorites', field: 'user_id' },
  { name: 'resource_favorites', field: 'user_id' },
  { name: 'user_school_favorites', field: 'userId' },

  // AI 相关
  { name: 'ai_friend_memory', field: 'user_id' },
  { name: 'ai_usage_logs', field: 'userId' },

  // 邀请（invites 使用 inviterId/inviteeId，需特殊处理，见下方）
  { name: 'invite_stats', field: 'userId' },

  // 用户档案
  { name: 'user_profiles', field: 'user_id' },
  { name: 'user_bans', field: 'uid' },

  // 成就
  { name: 'achievements', field: 'userId' }
];

// 安全审计日志保留（法规可能要求保留），仅脱敏处理
const ANONYMIZE_COLLECTIONS = [
  { name: 'suspicious_behaviors', field: 'uid' },
  { name: 'security_audit_logs', field: 'context.userId' }
];

function isIgnorableCollectionError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  return (
    (message.includes('collection') && (message.includes('not exist') || message.includes('not found'))) ||
    message.includes('namespace not found') ||
    message.includes('集合不存在')
  );
}

function secureTokenEqual(providedToken: string, expectedToken: string): boolean {
  const provided = Buffer.from(providedToken || '', 'utf8');
  const expected = Buffer.from(expectedToken || '', 'utf8');
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(provided, expected);
}

/**
 * 清除单个用户的所有数据
 */
async function purgeUserData(userId: string): Promise<{ deleted: Record<string, number>; errors: string[] }> {
  const deleted: Record<string, number> = {};
  const errors: string[] = [];

  const recordError = (scope: string, error: any) => {
    if (isIgnorableCollectionError(error)) {
      logger.warn(`[AccountPurge] 忽略集合异常 ${scope}: ${error?.message || error}`);
      return;
    }
    errors.push(`${scope}: ${error?.message || String(error)}`);
  };

  // 1. 删除所有用户关联集合的数据
  for (const col of USER_COLLECTIONS) {
    try {
      const result = await db
        .collection(col.name)
        .where({ [col.field]: userId })
        .remove();
      const count = result.deleted || 0;
      if (count > 0) {
        deleted[col.name] = count;
      }
    } catch (e: any) {
      // 集合不存在等非致命错误，记录后继续
      recordError(col.name, e);
    }
  }

  // 2. friends 表可能用 friendId 关联（双向好友关系）
  try {
    const result = await db
      .collection('friends')
      .where(
        _.or([
          { friend_id: userId },
          { friendId: userId } // 兼容历史驼峰字段
        ])
      )
      .remove();
    if (result.deleted > 0) {
      deleted['friends(friend_id)'] = result.deleted;
    }
  } catch (e: any) {
    recordError('friends(friend_id)', e);
  }

  // 3. pk_battles 可能使用多种字段存储参与者
  try {
    const result = await db
      .collection('pk_battles')
      .where(
        _.or([
          { user_id: userId },
          { userId },
          { opponent_id: userId },
          { opponentId: userId },
          { inviterId: userId },
          { inviteeId: userId },
          { 'players.userId': userId },
          { 'players.uid': userId }
        ])
      )
      .remove();
    if (result.deleted > 0) {
      deleted['pk_battles(extra_fields)'] = result.deleted;
    }
  } catch (e: any) {
    recordError('pk_battles(extra_fields)', e);
  }

  // 3.5 invites 使用 inviterId / inviteeId（非顶层 user_id）
  try {
    const result = await db
      .collection('invites')
      .where(_.or([{ inviterId: userId }, { inviteeId: userId }]))
      .remove();
    if (result.deleted > 0) {
      deleted['invites'] = result.deleted;
    }
  } catch (e: any) {
    recordError('invites', e);
  }

  // 4. pk_records 使用嵌套 player1/player2 字段（非顶层 userId）
  try {
    const result = await db
      .collection('pk_records')
      .where(
        _.or([
          { 'player1.uid': userId },
          { 'player2.uid': userId },
          { 'player1.userId': userId },
          { 'player2.userId': userId }
        ])
      )
      .remove();
    if ((result.deleted || 0) > 0) {
      deleted['pk_records'] = result.deleted;
    }
  } catch (e: any) {
    recordError('pk_records', e);
  }

  // 5. 安全审计日志脱敏（不删除，替换 userId 为 [已注销]）
  for (const col of ANONYMIZE_COLLECTIONS) {
    try {
      const result = await db
        .collection(col.name)
        .where({ [col.field]: userId })
        .update({
          [col.field]: '[已注销]',
          anonymized_at: Date.now()
        });
      if (result.updated > 0) {
        deleted[`${col.name}(anonymized)`] = result.updated;
      }
    } catch (e: any) {
      recordError(`${col.name}(anonymize)`, e);
    }
  }

  // 6. 仅在全链路成功时删除用户主记录；若部分失败，保留 pending_deletion 以便下次重试
  if (errors.length === 0) {
    try {
      await db.collection('users').doc(userId).remove();
      deleted['users'] = 1;
    } catch (e: any) {
      recordError('users', e);
    }
  } else {
    try {
      await db
        .collection('users')
        .doc(userId)
        .update({
          purge_last_error_at: Date.now(),
          purge_last_errors: errors.slice(0, 10),
          updated_at: Date.now()
        });
    } catch (e: any) {
      recordError('users(mark_retry)', e);
    }
  }

  return { deleted, errors };
}

/**
 * 主入口：定时任务 / 手动触发
 */
export default async function (_ctx: any) {
  const startTime = Date.now();
  const requestId = `purge_${Date.now()}`;

  // 安全修复：如果是通过 HTTP 手动触发（非定时任务），需要验证管理员身份
  const hasHttpMethod = typeof _ctx?.method === 'string' && _ctx.method.length > 0;
  const hasHttpHeaders = Boolean(_ctx?.headers && Object.keys(_ctx.headers).length > 0);
  const isHttpTrigger = hasHttpMethod || hasHttpHeaders;
  if (isHttpTrigger) {
    const adminToken = String(_ctx?.headers?.['x-admin-token'] || _ctx?.body?.adminToken || '');
    const expectedToken = process.env.ADMIN_PURGE_TOKEN;
    if (!expectedToken || !secureTokenEqual(adminToken, expectedToken)) {
      logger.warn(`[${requestId}] 未授权的手动触发尝试`);
      return {
        code: 403,
        success: false,
        message: '未授权：需要管理员令牌',
        requestId
      };
    }
  }

  try {
    // 查找所有冷静期已过的待删除用户
    const { data: pendingUsers } = await db
      .collection('users')
      .where({
        account_status: 'pending_deletion',
        deletion_scheduled_at: _.lte(Date.now())
      })
      .field({ _id: 1, nickName: 1, deletion_scheduled_at: 1 })
      .limit(50) // 每次最多处理50个，避免超时
      .get();

    if (!pendingUsers || pendingUsers.length === 0) {
      logger.info(`[${requestId}] 无待清除用户`);
      return {
        code: 0,
        success: true,
        message: '无待清除用户',
        data: { processed: 0, duration: Date.now() - startTime },
        requestId
      };
    }

    logger.info(`[${requestId}] 发现 ${pendingUsers.length} 个待清除用户`);

    const results: Array<{ userId: string; deleted: Record<string, number>; errors: string[] }> = [];

    for (const user of pendingUsers) {
      logger.info(`[${requestId}] 开始清除用户 ${user._id}`);
      const result = await purgeUserData(user._id);
      results.push({ userId: user._id, ...result });
      logger.info(`[${requestId}] 用户 ${user._id} 清除完成:`, result.deleted);
      if (result.errors.length > 0) {
        logger.warn(`[${requestId}] 用户 ${user._id} 部分清除失败:`, result.errors);
      }
    }

    const totalDeleted = results.reduce((sum, r) => {
      return sum + Object.values(r.deleted).reduce((s, n) => s + n, 0);
    }, 0);

    const fullyPurged = results.filter((r) => r.deleted.users === 1 && r.errors.length === 0).length;
    const pendingRetry = results.length - fullyPurged;

    return {
      code: 0,
      success: true,
      message:
        pendingRetry > 0
          ? `已清除 ${fullyPurged} 个用户，${pendingRetry} 个用户待重试`
          : `已清除 ${results.length} 个用户的数据`,
      data: {
        processed: results.length,
        fullyPurged,
        pendingRetry,
        totalDeleted,
        details: results,
        duration: Date.now() - startTime
      },
      requestId
    };
  } catch (error: any) {
    logger.error(`[${requestId}] 定时清除异常:`, error);
    return {
      code: 500,
      success: false,
      message: '清除任务执行失败',
      requestId
    };
  }
}

// 导出 purgeUserData 供 account-delete.ts 调用（管理员手动触发）
export { purgeUserData };
