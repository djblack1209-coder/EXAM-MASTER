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

const db = cloud.database();
const _ = db.command;

const COLLECTIONS = [
  'users', 'mistakes', 'questions', 'learning_goals',
  'achievements', 'pk_battles', 'rankings', 'groups',
  'favorites', 'email_codes', 'conversations',
  'study_stats', 'user_stats'
];

const TIMESTAMP_FIELDS = ['created_at', 'updated_at'];
const BATCH_SIZE = 100;

export default async function (ctx) {
  const { action = 'check' } = ctx.body || {};

  switch (action) {
  case 'check':
    return await checkTimestampTypes();
  case 'migrate':
    return await migrateToDate();
  case 'rollback':
    return await rollbackToNumber();
  default:
    return { code: 400, message: '无效的 action，可选: check, migrate, rollback' };
  }
}

/**
 * 检查各集合时间戳字段的类型分布
 */
async function checkTimestampTypes() {
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
        const numberCount = (await col.where({
          [field]: _.exists(true)
        }).count()).total;

        // 抽样检查类型
        const sample = await col.where({
          [field]: _.exists(true)
        }).limit(1).get();

        let sampleType = 'unknown';
        if (sample.data?.[0]?.[field] !== undefined) {
          const val = sample.data[0][field];
          sampleType = typeof val === 'number' ? 'number' :
            val instanceof Date ? 'Date' : typeof val;
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

  return { code: 0, message: '时间戳类型检查完成', data: report };
}

/**
 * 将 number 类型时间戳迁移为 Date 类型
 */
async function migrateToDate() {
  const results = [];

  for (const colName of COLLECTIONS) {
    try {
      const col = db.collection(colName);
      let totalMigrated = 0;

      for (const field of TIMESTAMP_FIELDS) {
        let hasMore = true;
        while (hasMore) {
          // 查找 field 为 number 类型的记录
          const batch = await col.where({
            [field]: _.exists(true)
          }).limit(BATCH_SIZE).get();

          if (!batch.data || batch.data.length === 0) {
            hasMore = false;
            break;
          }

          // 过滤出 number 类型的记录
          const numberRecords = batch.data.filter(
            doc => typeof doc[field] === 'number'
          );

          if (numberRecords.length === 0) {
            hasMore = false;
            break;
          }

          // 逐条更新（Laf 不支持批量条件更新）
          for (const doc of numberRecords) {
            await col.doc(doc._id).update({
              [field]: new Date(doc[field])
            });
            totalMigrated++;
          }

          // 如果本批次全部是 number，可能还有更多
          if (numberRecords.length < BATCH_SIZE) {
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
    message: `迁移完成: 共转换 ${totalMigrated} 条记录`,
    data: results
  };
}

/**
 * 回滚：将 Date 类型转回 number 时间戳
 */
async function rollbackToNumber() {
  const results = [];

  for (const colName of COLLECTIONS) {
    try {
      const col = db.collection(colName);
      let totalRolledBack = 0;

      for (const field of TIMESTAMP_FIELDS) {
        let hasMore = true;
        while (hasMore) {
          const batch = await col.where({
            [field]: _.exists(true)
          }).limit(BATCH_SIZE).get();

          if (!batch.data || batch.data.length === 0) {
            hasMore = false;
            break;
          }

          const dateRecords = batch.data.filter(
            doc => doc[field] instanceof Date ||
              (typeof doc[field] === 'string' && !isNaN(Date.parse(doc[field])))
          );

          if (dateRecords.length === 0) {
            hasMore = false;
            break;
          }

          for (const doc of dateRecords) {
            const ts = doc[field] instanceof Date
              ? doc[field].getTime()
              : new Date(doc[field]).getTime();
            await col.doc(doc._id).update({ [field]: ts });
            totalRolledBack++;
          }

          if (dateRecords.length < BATCH_SIZE) {
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
    message: `回滚完成: 共转换 ${total} 条记录`,
    data: results
  };
}
