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
import { createLogger } from './_shared/api-response';

const db = cloud.database();
const _ = db.command;
const logger = createLogger('[AccountPurge]');

// 需要清除用户数据的集合及其用户ID字段名
const USER_COLLECTIONS = [
  // 用户主表（最后删除）
  // { name: 'users', field: '_id' },  — 单独处理

  // 学习数据
  { name: 'mistake_book', field: 'userId' },
  { name: 'practice_records', field: 'userId' },
  { name: 'learning_goals', field: 'userId' },
  { name: 'goal_progress', field: 'userId' },
  { name: 'learning_progress', field: 'userId' },
  { name: 'daily_stats', field: 'userId' },
  { name: 'study_plans', field: 'userId' },
  { name: 'user_materials', field: 'userId' },
  { name: 'user_questions', field: 'userId' },

  // 社交 & PK
  { name: 'friends', field: 'userId' },
  { name: 'rankings', field: 'userId' },
  { name: 'pk_battles', field: 'userId' },
  { name: 'pk_records', field: 'userId' },
  { name: 'group_members', field: 'userId' },

  // 收藏
  { name: 'favorites', field: 'userId' },
  { name: 'resource_favorites', field: 'userId' },
  { name: 'user_school_favorites', field: 'userId' },

  // AI 相关
  { name: 'ai_friend_memory', field: 'userId' },
  { name: 'ai_usage_logs', field: 'userId' },

  // 邀请
  { name: 'invites', field: 'userId' },
  { name: 'invite_stats', field: 'userId' },

  // 用户档案
  { name: 'user_profiles', field: 'userId' },
  { name: 'user_bans', field: 'userId' }
];

// 安全审计日志保留（法规可能要求保留），仅脱敏处理
const ANONYMIZE_COLLECTIONS = [
  { name: 'suspicious_behaviors', field: 'userId' },
  { name: 'security_audit_logs', field: 'userId' }
];

/**
 * 清除单个用户的所有数据
 */
async function purgeUserData(userId: string): Promise<{ deleted: Record<string, number>; errors: string[] }> {
  const deleted: Record<string, number> = {};
  const errors: string[] = [];

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
      errors.push(`${col.name}: ${e.message}`);
    }
  }

  // 2. friends 表可能用 friendId 关联（双向好友关系）
  try {
    const result = await db.collection('friends').where({ friendId: userId }).remove();
    if (result.deleted > 0) {
      deleted['friends(friendId)'] = result.deleted;
    }
  } catch (e: any) {
    errors.push(`friends(friendId): ${e.message}`);
  }

  // 3. pk_battles 可能用 opponentId 关联
  try {
    const result = await db.collection('pk_battles').where({ opponentId: userId }).remove();
    if (result.deleted > 0) {
      deleted['pk_battles(opponentId)'] = result.deleted;
    }
  } catch (e: any) {
    errors.push(`pk_battles(opponentId): ${e.message}`);
  }

  // 4. 安全审计日志脱敏（不删除，替换 userId 为 [已注销]）
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
      errors.push(`${col.name}(anonymize): ${e.message}`);
    }
  }

  // 5. 最后删除用户主记录
  try {
    await db.collection('users').doc(userId).remove();
    deleted['users'] = 1;
  } catch (e: any) {
    errors.push(`users: ${e.message}`);
  }

  return { deleted, errors };
}

/**
 * 主入口：定时任务 / 手动触发
 */
export default async function (_ctx: any) {
  const startTime = Date.now();
  const requestId = `purge_${Date.now()}`;

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
        data: { processed: 0, duration: Date.now() - startTime }
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

    return {
      code: 0,
      success: true,
      message: `已清除 ${results.length} 个用户的数据`,
      data: {
        processed: results.length,
        totalDeleted,
        details: results,
        duration: Date.now() - startTime
      }
    };
  } catch (error: any) {
    logger.error(`[${requestId}] 定时清除异常:`, error);
    return {
      code: 500,
      success: false,
      message: '清除任务执行失败',
      error: error.message
    };
  }
}

// 导出 purgeUserData 供 account-delete.ts 调用（管理员手动触发）
export { purgeUserData };
