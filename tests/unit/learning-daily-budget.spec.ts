import { describe, it, expect } from 'vitest';
import { platformDailyPolicy, reserveDailyBudget } from '../../laf-backend/functions/_shared/learning-daily-budget';
describe('平台每日调用与全局预算预留', () => {
  const policy = { userCalls: 2, globalCalls: 3, budget: 1 };
  const reserve = (account: any, id: string, owner = 'a', maxCost = 0.4) =>
    reserveDailyBudget(account, { id, owner, fingerprint: id, maxCost }, policy);
  it('未配置、负数和无限制配置均关闭，零成本免费模型仍有调用上限', () => {
    expect(() => platformDailyPolicy({} as any)).toThrow();
    expect(() =>
      platformDailyPolicy({
        LEARNING_USER_DAILY_CALL_LIMIT: '-1',
        LEARNING_GLOBAL_DAILY_CALL_LIMIT: '3',
        LEARNING_GLOBAL_DAILY_BUDGET: '1'
      } as any)
    ).toThrow();
    let a: any = {};
    a = reserve(a, '1', 'a', 0).account;
    a = reserve(a, '2', 'a', 0).account;
    expect(() => reserve(a, '3', 'a', 0)).toThrow('今日调用');
  });
  it('跨用户共享同一预算，幂等不会多占额度；未结算不当作免费', () => {
    let a: any = reserve({}, '1').account;
    expect(reserve(a, '1').reused).toBe(true);
    a = reserve(a, '2', 'b').account;
    expect(() => reserve(a, '3', 'c')).toThrow('预算');
    a.platformDay.calls[0].status = 'pending';
    expect(() => reserve(a, '4', 'd', 0)).toThrow('待结算');
  });
  it('已知费用结算释放差额；不突破全局调用次数，指纹不同拒绝复用', () => {
    let a: any = reserve({}, '1').account;
    a.platformDay.calls[0].status = 'settled';
    a.platformDay.calls[0].actualCost = 0.1;
    a = reserve(a, '2', 'b').account;
    a = reserve(a, '3', 'c').account;
    expect(() => reserve(a, '4', 'd', 0)).toThrow('服务额度');
    expect(() => reserveDailyBudget(a, { id: '1', owner: 'a', fingerprint: 'changed', maxCost: 0 }, policy)).toThrow(
      '不同内容'
    );
  });
});
