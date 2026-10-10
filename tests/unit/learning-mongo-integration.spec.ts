import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  mutateAccount,
  reserveCall,
  settleCall,
  cancelCall
} from '../../laf-backend/functions/_shared/learning-account';
import { syncLearningOperations } from '../../laf-backend/functions/_shared/learning-sync';
import { encodeServerHistory, decodeServerHistory } from '../../laf-backend/functions/_shared/learning-history-server';
import { historyFixture } from '../fixtures/learning/history-fixture.js';
import { eraseLearningModelResultCache } from '../../laf-backend/functions/_shared/learning-model-runtime';
import {
  maintainModelResources,
  modelResultPolicy
} from '../../laf-backend/functions/_shared/learning-model-resources';

// 只接受独立本机测试库；默认不连接任何数据库，也不从项目 .env 读取凭据。
const uri = process.env.LEARNING_TEST_MONGO_URI;
const enabled = uri === 'mongodb://127.0.0.1:27189/exam_learning_isolated';
if (uri && !enabled) throw new Error('真实 Mongo 验收仅允许固定的本机隔离测试库');
describe.skipIf(!enabled)('真实本机 MongoDB 学习事务合同', () => {
  let shim: any;
  let native: any;
  let db: any;
  beforeAll(async () => {
    process.env.MONGODB_URI = uri;
    process.env.DB_NAME = 'exam_learning_isolated';
    shim = await import('../../laf-backend/standalone/cloud-shim');
    native = await shim.getDb();
    db = shim.default.database();
  });
  beforeEach(async () => {
    await native.collection('learning_accounts').deleteMany({});
    await native.collection('learning_states').deleteMany({});
    await native.collection('adapter_contract').deleteMany({});
  });
  afterAll(async () => {
    await shim?.closeDb();
  });
  it('真实并发缓存容量、过期清理和原幂等事实共用同一CAS，不删除成本记录', async () => {
    const policy = modelResultPolicy('{"maxEntries":2,"ttlMs":60000}');
    const owner = 'isolated-resource-owner',
      at = Date.now();
    for (let i = 0; i < 4; i++)
      await mutateAccount(db, owner, (a) =>
        reserveCall(a, { id: `cache-${i}`, fingerprint: `f-${i}`, source: 'byok', maxCost: 0, units: 0 }, at, policy)
      );
    await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        mutateAccount(db, owner, (a) =>
          settleCall(
            a,
            `cache-${i}`,
            {
              success: true,
              actualCost: null,
              usage: { prompt_tokens: 1, completion_tokens: 2 },
              result: { message: `合成教学 ${i}` }
            },
            at + i + 1,
            policy
          )
        )
      )
    );
    const before = await native.collection('learning_accounts').findOne({ user_id: owner });
    expect(before.calls).toHaveLength(4);
    expect(before.calls.filter((c: any) => c.result)).toHaveLength(2);
    await mutateAccount(db, owner, (a) => maintainModelResources(a, at + 60005, policy));
    const after = await native.collection('learning_accounts').findOne({ user_id: owner });
    expect(after.calls.every((c: any) => c.status === 'completed' && c.result === null)).toBe(true);
    expect(after.cost).toEqual(before.cost);
    expect(after.entitlement).toEqual(before.entitlement);
    expect(
      (
        await mutateAccount(db, owner, (a) =>
          reserveCall(
            a,
            { id: 'cache-3', fingerprint: 'f-3', source: 'byok', maxCost: 0, units: 0 },
            at + 60006,
            policy
          )
        )
      ).reused
    ).toBe(true);
  });

  it('真实单文档 CAS 让4个并发调用只有2个成功预留，并且重复结算一次', async () => {
    await mutateAccount(db, 'isolated-u1', (a: any) => {
      a.entitlement.weeklyUnits = 2;
      a.cost.hardLimit = 2;
      return { account: a };
    });
    const result = await Promise.allSettled(
      ['a', 'b', 'c', 'd'].map((id) =>
        mutateAccount(db, 'isolated-u1', (a: any) =>
          reserveCall(a, {
            id,
            fingerprint: id,
            source: 'platform',
            provider: 'TEST_ONLY',
            model: 'TEST_ONLY',
            maxCost: 1,
            units: 1
          })
        )
      )
    );
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    let row = await native.collection('learning_accounts').findOne({ user_id: 'isolated-u1' });
    expect(row.cost.reserved).toBe(2);
    expect(row.entitlement.reserved).toBe(2);
    const id = row.calls[0].id;
    await Promise.all([
      mutateAccount(db, 'isolated-u1', (a: any) => settleCall(a, id, { success: true, actualCost: 0.4 })),
      mutateAccount(db, 'isolated-u1', (a: any) => settleCall(a, id, { success: true, actualCost: 0.4 }))
    ]);
    row = await native.collection('learning_accounts').findOne({ user_id: 'isolated-u1' });
    expect(row.cost.spent).toBe(0.4);
    expect(row.cost.reserved).toBe(1);
    expect(row.entitlement.spent).toBe(1);
    const otherId = row.calls[1].id;
    await mutateAccount(db, 'isolated-u1', (a: any) => cancelCall(a, otherId));
    await mutateAccount(db, 'isolated-u1', (a: any) => settleCall(a, otherId, { success: true, actualCost: 0.2 }));
    row = await native.collection('learning_accounts').findOne({ user_id: 'isolated-u1' });
    expect(row.entitlement.spent).toBe(1);
    expect(row.cost.reserved).toBe(0);
    expect(row.cost.spent).toBeCloseTo(0.6);
    expect(row.calls[1].status).toBe('cancelled');
  });

  it('真实并发同步合并两台设备消息，重复补传不重复事件，用户隔离', async () => {
    const at = Date.now();
    const start = { id: 'c1', type: 'conversation.start', at, data: { goal: '隔离算例' } };
    await syncLearningOperations(db, 'isolated-u1', [start], 'Asia/Shanghai');
    const operations = ['device-a', 'device-b'].map((id) => ({
      id,
      type: 'message.add',
      at: at + 1,
      data: { conversationId: 'c1', role: 'user', content: id }
    }));
    await Promise.all(operations.map((op) => syncLearningOperations(db, 'isolated-u1', [op], 'Asia/Shanghai')));
    const repeated = await syncLearningOperations(db, 'isolated-u1', [start, ...operations], 'Asia/Shanghai');
    expect(repeated.state.events).toHaveLength(3);
    expect(repeated.state.conversations[0].messages).toHaveLength(2);
    const other = await syncLearningOperations(db, 'isolated-u2', [], 'Asia/Shanghai');
    expect(other.state.conversations).toHaveLength(0);
    expect(await native.collection('learning_states').countDocuments({})).toBe(2);
  });

  it('真实CAS并发删除/结算永不回填私人正文，成本保留、其他用户不受影响', async () => {
    const input = { id: 'private', fingerprint: 'private', source: 'byok', maxCost: 0, units: 0 };
    for (const owner of ['isolated-u1', 'isolated-u2'])
      await mutateAccount(db, owner, (a: any) => reserveCall(a, input));
    await mutateAccount(db, 'isolated-u2', (a: any) =>
      settleCall(a, 'private', {
        success: true,
        actualCost: 0.2,
        result: { message: '另一用户的私有结果' }
      })
    );
    await Promise.all([
      eraseLearningModelResultCache(db, 'isolated-u1'),
      mutateAccount(db, 'isolated-u1', (a: any) =>
        settleCall(a, 'private', {
          success: true,
          actualCost: 0.4,
          result: { message: '本账户删除后不能保留' }
        })
      )
    ]);
    const row = await native.collection('learning_accounts').findOne({ user_id: 'isolated-u1' });
    expect(row.calls[0]).toMatchObject({ result: null, actualCost: 0.4, entitlementCharged: 0 });
    expect(row.calls[0].resultDeletedAt).toBeGreaterThan(0);
    expect((await eraseLearningModelResultCache(db, 'isolated-u1')).erasedResults).toBe(0);
    const other = await native.collection('learning_accounts').findOne({ user_id: 'isolated-u2' });
    expect(other.calls[0].result.message).toBe('另一用户的私有结果');
    expect(other.calls[0].actualCost).toBe(0.2);
    expect(other.calls[0].resultDeletedAt).toBeUndefined();
  });

  it('集合快捷查询、字段选择、分页和唯一索引真正作用于Mongo', async () => {
    const collection = db.collection('adapter_contract');
    await collection.createIndex({ key: 1 }, { unique: true });
    await collection.add([
      { key: 'a', score: 1 },
      { key: 'b', score: 2 },
      { key: 'c', score: 3 }
    ]);
    expect(await collection.count()).toEqual({ total: 3 });
    const rows = await collection.field({ key: 1, _id: 0 }).orderBy('score', 'desc').skip(1).limit(1).get();
    expect(rows.data).toEqual([{ key: 'b' }]);
    expect((await collection.limit(1).get()).data).toHaveLength(1);
    await expect(collection.add({ key: 'a', score: 9 })).rejects.toThrow();
    expect(await collection.count()).toEqual({ total: 3 });
  });
  it('真实 Mongo 大历史压缩保存，CAS 并发和重复操作不丢事实，旧原始快照读取兼容', async () => {
    const state = historyFixture('isolated-u1');
    const seed = await syncLearningOperations(db, 'isolated-u1', [], 'Asia/Shanghai');
    expect(seed.revision).toBe(0);
    const row = await native.collection('learning_states').findOne({ user_id: 'isolated-u1' });
    await native
      .collection('learning_states')
      .updateOne({ _id: row._id }, { $set: { state: await encodeServerHistory(state, 'isolated-u1') } });
    const op = (id: string) => ({
      id,
      type: 'message.add',
      at: Date.now(),
      data: { conversationId: 'history-c', role: 'user', content: id }
    });
    await Promise.all(
      ['mongo-device-a', 'mongo-device-b'].map((id) =>
        syncLearningOperations(db, 'isolated-u1', [op(id)], state.timezone)
      )
    );
    const current = await syncLearningOperations(db, 'isolated-u1', [], state.timezone);
    expect(current.state.events.length).toBe(state.events.length + 2);
    expect(current.revision).toBe(2);
    const previous = current.state.events.find((e: any) => e.id === 'mongo-device-a');
    expect((await syncLearningOperations(db, 'isolated-u1', [previous], state.timezone)).revision).toBe(2);
    const saved = await native.collection('learning_states').findOne({ user_id: 'isolated-u1' });
    expect(saved.state.format).toBe('learning-gzip-v1');
    expect(await decodeServerHistory(saved.state, 'isolated-u1')).toEqual(current.state);
    expect(await native.collection('learning_states').countDocuments({ user_id: 'isolated-u1' })).toBe(1);
  }, 20000);
});
