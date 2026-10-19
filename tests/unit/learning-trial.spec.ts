import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  assertTrialEmail,
  friendTrialPolicy,
  assertTrialUser
} from '../../laf-backend/functions/_shared/learning-trial';
import { trialMetrics } from '../../laf-backend/functions/_shared/learning-trial-metrics.js';
afterEach(() => vi.unstubAllEnvs());
describe('朋友白名单、人数和聚合指标', () => {
  const policy = {
    LEARNING_FRIEND_TRIAL_ENABLED: 'true',
    LEARNING_TRIAL_USER_LIMIT: '2',
    LEARNING_TRIAL_EMAILS: 'a@example.com,b@example.com'
  } as any;
  it('缺失配置、名单超人数及名单外邮箱全部拒绝；大小写与重复邮箱不会增加名额', () => {
    expect(() => friendTrialPolicy({ LEARNING_FRIEND_TRIAL_ENABLED: 'true' } as any)).toThrow();
    expect(() => friendTrialPolicy({ ...policy, LEARNING_TRIAL_USER_LIMIT: '1' })).toThrow();
    expect(() => assertTrialEmail('outside@example.com', policy)).toThrow();
    expect(() => assertTrialEmail(' A@EXAMPLE.COM ', policy)).not.toThrow();
    expect(friendTrialPolicy({ ...policy, LEARNING_TRIAL_EMAILS: 'A@example.com,a@example.com' }).emails).toHaveLength(
      1
    );
  });
  it('已有登录令牌也按当前名单重新检查，移出用户不能继续调用', async () => {
    Object.entries(policy).forEach(([key, value]) => vi.stubEnv(key, String(value)));
    const db = {
      collection: () => ({ where: () => ({ get: async () => ({ data: [{ email: 'outside@example.com' }] }) }) })
    };
    await expect(assertTrialUser(db, 'existing-user')).rejects.toMatchObject({ code: 'TRIAL_CLOSED' });
  });
  it('只按已完成事实统计周次；未知费用不填零，个人原文和身份不会进入聚合结果', () => {
    const result = trialMetrics(
      [
        {
          user_id: 'private-id',
          state: {
            conversations: [
              {
                coach: {
                  startedDay: '2026-10-01',
                  days: [
                    { day: '2026-10-09', completed: true, answers: [{ at: Date.parse('2026-10-09') }], rewrites: [] }
                  ],
                  library: [],
                  survey: { answer: 'skip' }
                }
              }
            ]
          }
        }
      ],
      [
        {
          user_id: 'private-id',
          calls: [
            { at: Date.parse('2026-10-09'), actualCost: 0.1, costStatus: 'settled' },
            { at: Date.parse('2026-10-09'), actualCost: null, costStatus: 'pending' }
          ]
        }
      ],
      { asOf: Date.parse('2026-10-20'), salt: 'synthetic-metrics-salt-at-least-24' }
    );
    expect(result.secondWeek).toEqual({ eligibleUsers: 1, activeUsers: 1 });
    expect(result.perUserWeekly[0].sessions).toBe(1);
    expect(result.perUserMonthly[0]).toMatchObject({ totalCost: null, knownCost: 0.1, pendingCalls: 1 });
    expect(JSON.stringify(result)).not.toContain('private-id');
  });
});
