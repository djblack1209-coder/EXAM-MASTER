import { describe, expect, it } from 'vitest';
import {
  newAccount,
  reserveCall,
  settleCall,
  eraseModelResultCache,
  mutateAccount
} from '../../laf-backend/functions/_shared/learning-account';
import {
  boundedModelUsage,
  maintainModelResources,
  modelResultPolicy,
  modelResultState,
  modelResultUnavailable,
  modelResourceBytes,
  supportedBillingUsage
} from '../../laf-backend/functions/_shared/learning-model-resources';
const input = (id: string) => ({ id, fingerprint: id, model: 'fixture', source: 'byok', maxCost: 0, units: 0 });
const small = modelResultPolicy(JSON.stringify({ maxEntries: 2, maxBytes: 1024, maxResultBytes: 1024, ttlMs: 60000 }));
const usage = { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 };
function complete(account: any, id: string, at: number, message = '隔离教学', policy = small) {
  return settleCall(
    reserveCall(account, input(id), at, policy).account,
    id,
    { success: true, actualCost: null, usage, result: { message } },
    at + 1,
    policy
  ).account;
}
describe('私人模型结果资源预算与账单保全', () => {
  it.each([
    'null',
    '[]',
    '{"ttlMs":0}',
    '{"ttlMs":60000.5}',
    '{"maxEntries":101}',
    '{"maxBytes":4194305}',
    '{"maxBytes":1024}',
    '{"constructor":{}}',
    '{"unexpected":1}',
    'broken'
  ])('无效配置 %s 在执行前拒绝', (raw) => {
    expect(() => modelResultPolicy(raw)).toThrow();
  });
  it('默认24小时/32条/1MiB，长度按UTF8字节；有限保留与明确过期', () => {
    expect(modelResultPolicy('')).toMatchObject({
      ttlMs: 86400000,
      maxEntries: 32,
      maxBytes: 1048576,
      maxResultBytes: 131072
    });
    expect(modelResourceBytes({ text: '中😀' })).toBe(Buffer.byteLength(JSON.stringify({ text: '中😀' })));
    const account = complete(newAccount('owner'), 'first', 1000);
    const before = structuredClone(account);
    expect(modelResultState(account.calls[0], 61000, small)).toBe('available');
    const expired = maintainModelResources(account, 61001, small);
    expect(expired.account.calls[0]).toMatchObject({
      status: 'completed',
      actualCost: null,
      result: null,
      resultReleasedReason: 'expired',
      usage
    });
    expect(expired.account.cost).toEqual(before.cost);
    expect(expired.account.entitlement).toEqual(before.entitlement);
    expect(account).toEqual(before);
    expect(modelResultUnavailable(expired.account.calls[0], 61001, small)).toMatchObject({
      code: 410,
      cacheStatus: 'expired'
    });
    expect(maintainModelResources(expired.account, 62000, small).reused).toBe(true);
    expect(reserveCall(expired.account, input('first'), 62000, small).reused).toBe(true);
  });
  it('容量淘汰先移除旧缓存，保留全部幂等/费用事实；单条太大也不丢结算', () => {
    let account: any = newAccount('owner');
    for (let i = 0; i < 4; i++) account = complete(account, `r${i}`, 1000 + i * 10);
    expect(account.calls).toHaveLength(4);
    expect(account.calls.filter((c: any) => c.result).map((c: any) => c.id)).toEqual(['r2', 'r3']);
    expect(account.calls[0].resultReleasedReason).toBe('capacity');
    const bytes = complete(newAccount('owner'), 'old', 1000, '中'.repeat(150));
    const limited = complete(bytes, 'new', 1010, '中'.repeat(200));
    expect(limited.calls[0].resultReleasedReason).toBe('capacity');
    expect(maintainModelResources(limited, 1020, small).cache.bytes).toBeLessThanOrEqual(1024);
    const oversize = complete(limited, 'huge', 1030, '中'.repeat(500));
    expect(oversize.calls[2]).toMatchObject({
      status: 'completed',
      costStatus: 'pending',
      resultReleasedReason: 'oversize',
      actualCost: null
    });
    expect(reserveCall(oversize, input('huge'), 1040, small).call.result).toBeNull();
    expect(settleCall(oversize, 'huge', { success: true, actualCost: 9 }, 1040, small).reused).toBe(true);
  });
  it('更短配置立即限制旧结果；更长配置不延长已有期限；用户删除优先', () => {
    const normal = modelResultPolicy('');
    const original = complete(newAccount('owner'), 'r', 1000, '原文', normal);
    const reduced = maintainModelResources(original, 61001, small).account;
    expect(reduced.calls[0].resultReleasedReason).toBe('expired');
    const longer = modelResultPolicy('{"ttlMs":604800000}');
    expect(modelResultState(original.calls[0], 86401001, longer)).toBe('expired');
    expect(modelResultUnavailable(eraseModelResultCache(reduced, 62000).account.calls[0], 62000, longer)?.error).toBe(
      'MODEL_RESULT_DELETED'
    );
  });
  it('旧数据按原时间补资源限制，正常usage完整保留，重复维护不写新版本', () => {
    const account: any = newAccount('owner');
    account.calls.push({
      ...input('old'),
      at: 1000,
      status: 'completed',
      result: { message: '旧私有正文' },
      usage,
      actualCost: 0.5,
      costStatus: 'settled'
    });
    const maintained = maintainModelResources(account, 61000, small);
    expect(maintained.account.calls[0]).toMatchObject({
      result: null,
      usage,
      usageEvidence: { status: 'complete', truncated: false },
      actualCost: 0.5
    });
    expect(maintainModelResources(maintained.account, 62000, small).reused).toBe(true);
  });
  it('异常大账单有界保存数值/摘要，未知成本保持预留，不吞掉实际调用或返还两次', () => {
    const raw = { ...usage, billable_extra: 'UNTRUSTED_PRIVATE_CONTENT'.repeat(10000) };
    const bounded = boundedModelUsage(raw);
    expect(bounded.evidence).toMatchObject({
      status: 'truncated',
      truncated: true,
      bytes: Buffer.byteLength(JSON.stringify(raw))
    });
    expect(bounded.evidence.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(bounded.usage).toEqual(usage);
    expect(JSON.stringify(bounded)).not.toContain('UNTRUSTED_PRIVATE_CONTENT');
    const account: any = newAccount('owner');
    account.entitlement.weeklyUnits = 10;
    account.cost.hardLimit = 10;
    const reserved = reserveCall(
      account,
      { ...input('r'), source: 'platform', maxCost: 2, units: 1 },
      1000,
      small
    ).account;
    const settled = settleCall(
      reserved,
      'r',
      { success: true, actualCost: 1, usage: raw, result: { message: '正常输出' } },
      1010,
      small
    ).account;
    expect(settled.cost).toMatchObject({ spent: 0, reserved: 2, pending: 1 });
    expect(settled.calls[0]).toMatchObject({
      status: 'completed',
      actualCost: null,
      usageEvidence: { truncated: true },
      entitlementCharged: 1
    });
    expect(settleCall(settled, 'r', { success: true, actualCost: 1 }, 1020, small).reused).toBe(true);
  });
  it('新账单项、异常数值/类型不能自动定价；已知细项完整保留', () => {
    const detailed = {
      ...usage,
      prompt_tokens_details: { cached_tokens: 0, audio_tokens: 0 },
      completion_tokens_details: { reasoning_tokens: 2 }
    };
    expect(supportedBillingUsage(detailed)).toBe(true);
    expect(boundedModelUsage(detailed).usage).toEqual(detailed);
    for (const invalid of [
      [],
      { ...usage, search_cost: 1 },
      { ...usage, completion_tokens: 0.5 },
      { ...usage, prompt_tokens: Infinity },
      { ...usage, prompt_tokens_details: { audio_tokens: 1 } },
      JSON.parse('{"prompt_tokens":1,"completion_tokens":2,"constructor":{}}')
    ]) {
      expect(supportedBillingUsage(invalid)).toBe(false);
    }
  });
  it('并发结算/CAS容量只保留2条，费用与调用记录各自一次', async () => {
    let account: any = newAccount('owner');
    for (let i = 0; i < 4; i++) account = reserveCall(account, input(`r${i}`), 1000 + i, small).account;
    const db = {
      collection: () => ({
        where: (query: any) => ({
          get: async () => ({ data: [structuredClone(account)] }),
          update: async (next: any) => {
            if (query.revision !== account.revision) return { updated: 0 };
            account = { ...account, ...structuredClone(next) };
            return { updated: 1 };
          }
        })
      })
    };
    await Promise.all(
      account.calls.map((c: any, index: number) =>
        mutateAccount(db, 'owner', (a) =>
          settleCall(
            a,
            c.id,
            { success: true, actualCost: null, usage, result: { message: c.id } },
            2000 + index,
            small
          )
        )
      )
    );
    expect(account.calls).toHaveLength(4);
    expect(account.calls.filter((c: any) => c.result)).toHaveLength(2);
    expect(account.calls.every((c: any) => c.status === 'completed' && c.entitlementCharged === 0)).toBe(true);
  });
  it('最大500次账单的大缓存被限制；安全容量超限在新预留前拒绝', () => {
    const account: any = newAccount('owner');
    for (let i = 0; i < 500; i++)
      account.calls.push({
        ...input(`r${i}`),
        at: 1000 + i,
        status: 'completed',
        result: { message: '中'.repeat(30000) },
        usage: { ...usage, unknown: 'x'.repeat(10000) },
        actualCost: null
      });
    const bounded = maintainModelResources(account, 2000, modelResultPolicy(''));
    expect(bounded.cache.entries).toBeLessThanOrEqual(32);
    expect(bounded.cache.bytes).toBeLessThanOrEqual(1048576);
    expect(modelResourceBytes(bounded.account)).toBeLessThan(2 * 1048576);
    expect(bounded.account.calls).toHaveLength(500);
    const legacy: any = newAccount('owner');
    legacy.callbacks = ['x'.repeat(8 * 1048576)];
    expect(() => reserveCall(legacy, input('not_called'), 1000, small)).toThrow('安全容量');
    expect(legacy.calls).toHaveLength(0);
  });
});
