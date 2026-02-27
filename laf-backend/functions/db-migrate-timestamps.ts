/**
 * 时间戳类型规范化迁移脚本
 * B011: 将 created_at/updated_at 从整数时间戳统一为 Date 类型
 *
 * 使用方式：
 * 1. 在 Laf 控制台创建此云函数
 * 2. 调用时传入 action 参数：
 *    - action: 'check'  — 检查各集合的时间戳类型分布（只读）
 *    - action: 'migrate' — 执行迁移（将 number 类型转为 Date）
 *    - action: 'rollback' — 回滚（将 Date 类型转回 number）
 *
 * 注意：
 * - 迁移前请先执行 check 确认影响范围
 * - 迁移是批量操作，大数据量时可能需要多次执行
 * - 建议在低峰期执行
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { createLogger } from './_shared/api-response';

const logger = createLogger('[DbMigrate]');
const db = cloud.database();
const _ = db.command;

const COLLECTIONS = [
  'users',
  'mistakes',
  'questions',
  'learning_goals',
  'achievements',
  'pk_battles',
  'rankings',
  'groups',
  'favorites',
  'email_codes',
  'conversations',
  'study_stats',
  'user_stats'
];

const TIMESTAMP_FIELDS = ['created_at', 'updated_at'];
const BATCH_SIZE = 100;

export default async function (ctx) {
  const requestId = `db_ts_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    // [C3-FIX] 管理工具函数需要管理员权限
    const adminSecret = ctx.headers?.['x-admin-secret'] || ctx.body?.adminSecret;
    if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
      return { code: 403, success: false, message: '需要管理员权限，请提供 ADMIN_SECRET', requestId };
    }

    const { action = 'check' } = ctx.body || {};

    switch (action) {
      case 'check':
        return await checkTimestampTypes(requestId);
      case 'migrate':
        return await migrateToDate(requestId);
      case 'rollback':
        return await rollbackToNumber(requestId);
      default:
        return { code: 400, success: false, message: '无效的 action，可选: check, migrate, rollback', requestId };
    }
  } catch (error) {
    logger.error('[db-migrate-timestamps] 迁移脚本异常:', error);
    return {
      code: 500,
      success: false,
      message: '迁移脚本执行异常',
      error: (error as Error).message,
      requestId
    };
  }
}

/**
 * 检查各集合时间戳字段的类型分布
 */
async function checkTimestampTypes(requestId: string) {
  const report = [];

  for (const colName of COLLECTIONS) {
    try {
      const col = db.collection(colName);
      const total = (await col.count()).total;
      if (total === 0) {
        report.push({ collection: colName, total: 0, skip: true });
        continue;
      }

      const colReport = { collection: colName, total, fields: {} };

      for (const field of TIMESTAMP_FIELDS) {
        // 查询 number 类型的记录数
        const numberCount = (
          await col
            .where({
              [field]: _.exists(true)
            })
            .count()
        ).total;

        // 抽样检查类型
        const sample = await col
          .where({
            [field]: _.exists(true)
          })
          .limit(1)
          .get();

        let sampleType = 'unknown';
        if (sample.data?.[0]?.[field] !== undefined) {
          const val = sample.data[0][field];
          sampleType = typeof val === 'number' ? 'number' : val instanceof Date ? 'Date' : typeof val;
        }

        colReport.fields[field] = {
          hasField: numberCount,
          sampleType,
          sampleValue: sample.data?.[0]?.[field]
        };
      }

      report.push(colReport);
    } catch (e) {
      report.push({ collection: colName, error: e.message });
    }
  }

  return { code: 0, success: true, message: '时间戳类型检查完成', data: report, requestId };
}

/**
 * 将 number 类型时间戳迁移为 Date 类型
 */
async function migrateToDate(requestId: string) {
  const results = [];

  for (const colName of COLLECTIONS) {
    try {
      const col = db.collection(colName);
      let totalMigrated = 0;

      for (const field of TIMESTAMP_FIELDS) {
        let skip = 0;
        let hasMore = true;
        while (hasMore) {
          // 查找 field 存在的记录，使用 skip 分页避免重复扫描
          const batch = await col
            .where({
              [field]: _.exists(true)
            })
            .skip(skip)
            .limit(BATCH_SIZE)
            .get();

          if (!batch.data || batch.data.length === 0) {
            hasMore = false;
            break;
          }

          // 过滤出 number 类型的记录
          const numberRecords = batch.data.filter((doc) => typeof doc[field] === 'number');

          // 逐条更新（Laf 不支持批量条件更新）
          for (const doc of numberRecords) {
            await col.doc(doc._id).update({
              [field]: new Date(doc[field])
            });
            totalMigrated++;
          }

          // 跳过已经是 Date 类型的记录（含刚转换的，下轮会以 Date 出现）
          const alreadyDateCount = batch.data.length - numberRecords.length;
          skip += alreadyDateCount;

          if (batch.data.length < BATCH_SIZE) {
            hasMore = false;
          }
        }
      }

      results.push({ collection: colName, migrated: totalMigrated });
    } catch (e) {
      results.push({ collection: colName, error: e.message });
    }
  }

  const totalMigrated = results.reduce((sum, r) => sum + (r.migrated || 0), 0);
  return {
    code: 0,
    success: true,
    message: `迁移完成: 共转换 ${totalMigrated} 条记录`,
    data: results,
    requestId
  };
}

/**
 * 回滚：将 Date 类型转回 number 时间戳
 */
async function rollbackToNumber(requestId: string) {
  const results = [];

  for (const colName of COLLECTIONS) {
    try {
      const col = db.collection(colName);
      let totalRolledBack = 0;

      for (const field of TIMESTAMP_FIELDS) {
        let skip = 0;
        let hasMore = true;
        while (hasMore) {
          const batch = await col
            .where({
              [field]: _.exists(true)
            })
            .skip(skip)
            .limit(BATCH_SIZE)
            .get();

          if (!batch.data || batch.data.length === 0) {
            hasMore = false;
            break;
          }

          const dateRecords = batch.data.filter(
            (doc) => doc[field] instanceof Date || (typeof doc[field] === 'string' && !isNaN(Date.parse(doc[field])))
          );

          for (const doc of dateRecords) {
            const ts = doc[field] instanceof Date ? doc[field].getTime() : new Date(doc[field]).getTime();
            await col.doc(doc._id).update({ [field]: ts });
            totalRolledBack++;
          }

          // Skip records that are already number type
          const alreadyNumberCount = batch.data.length - dateRecords.length;
          skip += alreadyNumberCount;

          if (batch.data.length < BATCH_SIZE) {
            hasMore = false;
          }
        }
      }

      results.push({ collection: colName, rolledBack: totalRolledBack });
    } catch (e) {
      results.push({ collection: colName, error: e.message });
    }
  }

  const total = results.reduce((sum, r) => sum + (r.rolledBack || 0), 0);
  return {
    code: 0,
    success: true,
    message: `回滚完成: 共转换 ${total} 条记录`,
    data: results,
    requestId
  };
}
