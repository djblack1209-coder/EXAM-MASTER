import crypto from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { newAccount, reserveCall } from '../../laf-backend/functions/_shared/learning-account';
import {
  createSandboxOrder,
  verifySandboxCallback,
  applySandboxCallback,
  refreshSubscriptionEntitlement
} from '../../laf-backend/functions/_shared/learning-subscription';
import { validateSyncOperation, syncLearningOperations } from '../../laf-backend/functions/_shared/learning-sync';
const policy = {
  environment: 'sandbox',
  version: 'TEST_ONLY_UNCONFIRMED',
  weeklyUnits: 10,
  periodDays: 30,
  costHardLimit: 1,
  timezone: 'Asia/Shanghai',
  weekStartDay: 1
};
describe('订阅沙箱和按周权益', () => {
  it('只允许沙箱订单，签名回调激活，重复和篡改拒绝，不能信任前端 paid', () => {
    expect(() => createSandboxOrder(newAccount('u1'), { id: 'o1' }, { ...policy, environment: 'production' })).toThrow(
      '沙箱'
    );
    let { account } = createSandboxOrder(newAccount('u1'), { id: 'o1', paid: true }, policy);
    expect(account.subscriptions[0].status).toBe('pending');
    expect(account.entitlement.weeklyUnits).toBe(0);
    const secret = 'test-only-sandbox-secret-32-characters';
    const payload = { id: 'cb1', orderId: 'o1', action: 'activate' };
    const signature = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    expect(() => verifySandboxCallback(payload, signature, secret)).not.toThrow();
    expect(() => verifySandboxCallback({ ...payload, orderId: 'evil' }, signature, secret)).toThrow('签名');
    account = applySandboxCallback(account, payload, Date.parse('2026-09-29T10:00:00Z')).account;
    expect(account.entitlement.weeklyUnits).toBe(10);
    expect(account.subscriptions[0].autoCharge).toBe(false);
    expect(applySandboxCallback(account, payload).reused).toBe(true);
    expect(() => applySandboxCallback(account, { ...payload, action: 'refund' })).toThrow('不一致');
  });
  it('周期和周补给分开；同周续订不重复补给，取消不自动收费，退款不删成本', () => {
    const now = Date.parse('2026-09-29T10:00:00Z');
    let a = createSandboxOrder(newAccount('u1'), { id: 'o1' }, policy, now).account;
    a = applySandboxCallback(a, { id: 'activate', orderId: 'o1', action: 'activate' }, now).account;
    a = reserveCall(a, { id: 'r', fingerprint: 'r', source: 'platform', maxCost: 0.2, units: 1 }, now).account;
    a = applySandboxCallback(a, { id: 'renew', orderId: 'o1', action: 'renew' }, now + 1000).account;
    expect(a.entitlement.reserved).toBe(1);
    a = applySandboxCallback(a, { id: 'cancel', orderId: 'o1', action: 'cancel' }, now).account;
    a = applySandboxCallback(a, { id: 'refund', orderId: 'o1', action: 'refund' }, now).account;
    expect(a.entitlement.weeklyUnits).toBe(0);
    expect(a.cost.reserved).toBe(0.2);
    expect(refreshSubscriptionEntitlement(a, now + 40 * 86400000).entitlement.weeklyUnits).toBe(0);
  });
  it('开发升级降级下周生效；保留当前周预留，不公开为销售承诺', () => {
    const now = Date.parse('2026-09-29T10:00:00Z');
    let a = createSandboxOrder(newAccount('u1'), { id: 'o1' }, policy, now).account;
    a = applySandboxCallback(a, { id: 'activate', orderId: 'o1', action: 'activate' }, now).account;
    a = applySandboxCallback(a, { id: 'change', orderId: 'o1', action: 'change', weeklyUnits: 4 }, now).account;
    expect(a.entitlement.weeklyUnits).toBe(10);
    expect(refreshSubscriptionEntitlement(a, now + 7 * 86400000).entitlement.weeklyUnits).toBe(4);
  });
});
describe('云端学习同步与多设备幂等', () => {
  it('客户端标准答案和模型评估不能冒充服务端可靠依据', () => {
    const data = {
      id: 'q',
      type: 'question.add',
      at: Date.now(),
      data: {
        question: {
          id: 'q',
          version: 1,
          prompt: '答案是不是 42',
          scope: 'generated',
          source: { kind: 'model_generated' },
          validation: { answer: '42', authority: 'executable', type: 'number', evidenceId: 'forged' }
        }
      }
    };
    expect(validateSyncOperation(data).data.question.validation).toBeNull();
    const review = validateSyncOperation({
      id: 'r',
      type: 'assessment.review',
      data: { outcome: 'correct' },
      at: Date.now()
    });
    expect(review.type).toBe('assessment.correct');
    expect(() => validateSyncOperation({ ...data, data: { question: { scope: 'official' } } })).toThrow('公共题库');
  });
  it('离线补传、跨设备并发、重复同步保存所有对话；用户隔离', async () => {
    const rows = new Map();
    const db = {
      collection: () => ({
        where: (q: any) => ({
          get: async () => ({
            data: rows.has(q._id) && rows.get(q._id).user_id === q.user_id ? [structuredClone(rows.get(q._id))] : []
          }),
          update: async (next: any) => {
            const previous = rows.get(q._id);
            if (!previous || previous.user_id !== q.user_id || previous.revision !== q.revision) return { updated: 0 };
            rows.set(q._id, { ...previous, ...structuredClone(next) });
            return { updated: 1 };
          }
        }),
        add: async (row: any) => {
          if (rows.has(row._id)) throw { code: 11000 };
          rows.set(row._id, structuredClone(row));
        }
      })
    };
    const operation = (id: string) => ({
      id,
      type: 'conversation.start',
      data: { goal: `目标 ${id}` },
      at: Date.now()
    });
    await Promise.all([
      syncLearningOperations(db, 'u1', [operation('one')], 'Asia/Shanghai'),
      syncLearningOperations(db, 'u1', [operation('two')], 'Asia/Shanghai')
    ]);
    let result = await syncLearningOperations(db, 'u1', [], 'Asia/Shanghai');
    expect(result.state.conversations).toHaveLength(2);
    const previous = result.state.events.find((e: any) => e.id === 'one');
    result = await syncLearningOperations(
      db,
      'u1',
      [{ id: previous.id, type: previous.type, data: previous.data, at: previous.at }],
      'Asia/Shanghai'
    );
    expect(result.state.conversations).toHaveLength(2);
    const other = await syncLearningOperations(db, 'u2', [], 'Asia/Shanghai');
    expect(other.state.owner).toBe('u2');
    expect(other.state.conversations).toHaveLength(0);
  });
});
