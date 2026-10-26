import crypto from 'node:crypto';
import { AccountError, mutateAccount } from './learning-account.js';
import { DEV_TEST } from './build-channel.js';
const need = (ok: any, code: string, message: string) => {
  if (!ok) throw new AccountError(code, message);
};
export function platformDailyPolicy(env = process.env) {
  const userCalls = Number(env.LEARNING_USER_DAILY_CALL_LIMIT || 0);
  const globalCalls = Number(env.LEARNING_GLOBAL_DAILY_CALL_LIMIT || 0);
  const budget = Number(env.LEARNING_GLOBAL_DAILY_BUDGET);
  need(
    Number.isInteger(userCalls) &&
      userCalls > 0 &&
      userCalls <= 500 &&
      Number.isInteger(globalCalls) &&
      globalCalls > 0 &&
      globalCalls <= 2000 &&
      Number.isFinite(budget) &&
      budget >= 0,
    'DAILY_POLICY_DISABLED',
    '平台模型暂未开放'
  );
  return { userCalls, globalCalls, budget };
}
const hash = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const dayKey = (now: number) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(now));
export function reserveDailyBudget(account: any, input: any, policy: ReturnType<typeof platformDailyPolicy>) {
  const next = structuredClone(account),
    rows = next.platformDay?.calls || [];
  const prior = rows.find((r: any) => r.id === input.id);
  if (prior) {
    need(prior.fingerprint === input.fingerprint, 'IDEMPOTENCY_CONFLICT', '请求编号对应不同内容');
    return { account, reused: true };
  }
  need(!rows.some((r: any) => r.status === 'pending'), 'COST_PENDING', '平台有用量待结算，请稍后再试');
  need(
    DEV_TEST || rows.filter((r: any) => r.owner === input.owner).length < policy.userCalls,
    'USER_DAILY_LIMIT',
    '今日调用次数已用完，明天再来'
  );
  need(DEV_TEST || rows.length < policy.globalCalls, 'GLOBAL_DAILY_LIMIT', '今日平台服务额度已用完，明天再来');
  need(Number.isFinite(input.maxCost) && input.maxCost >= 0, 'POLICY_INVALID', '费用预算不合法');
  const committed = rows.reduce(
    (n: number, r: any) => n + (r.status === 'reserved' ? r.maxCost : r.actualCost || 0),
    0
  );
  need(committed + input.maxCost <= policy.budget + 1e-12, 'GLOBAL_DAILY_BUDGET', '今日平台预算已用完，明天再来');
  rows.push({ ...input, status: 'reserved', actualCost: null });
  next.platformDay = { calls: rows };
  return { account: next, reused: false };
}
export async function reservePlatformDay(
  db: any,
  owner: string,
  requestId: string,
  fingerprint: string,
  maxCost: number,
  now = Date.now()
) {
  const policy = platformDailyPolicy(),
    day = dayKey(now),
    user = `__platform_day_v1:${day}`;
  const id = hash(`${owner}:${requestId}`);
  await mutateAccount(db, user, (account) =>
    reserveDailyBudget(account, { id, owner: hash(owner), fingerprint, maxCost, at: now }, policy)
  );
  return { user, id };
}
export async function settlePlatformDay(
  db: any,
  reservation: { user: string; id: string },
  cost: number | null,
  notCalled = false
) {
  await mutateAccount(db, reservation.user, (account) => {
    const next = structuredClone(account),
      row = next.platformDay?.calls.find((r: any) => r.id === reservation.id);
    need(row, 'BUDGET_MISSING', '每日预算预留不可用');
    if (row.status !== 'reserved') return { account, reused: true };
    row.status = cost === null && !notCalled ? 'pending' : 'settled';
    row.actualCost = notCalled ? 0 : cost;
    return { account: next, reused: false };
  });
}
