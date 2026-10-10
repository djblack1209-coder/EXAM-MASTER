import crypto from 'node:crypto';
import { AccountError, weekKey } from './learning-account.js';

const need = (value: any, message: string) => {
  if (!value) throw new AccountError('SUBSCRIPTION_INVALID', message);
};
export function createSandboxOrder(account: any, input: any, policy: any, now = Date.now()) {
  need(
    policy?.environment === 'sandbox' &&
      typeof policy.version === 'string' &&
      policy.version.startsWith('TEST_ONLY') &&
      Number.isInteger(policy.weeklyUnits) &&
      policy.weeklyUnits >= 0 &&
      Number.isInteger(policy.periodDays) &&
      policy.periodDays > 0 &&
      Number.isFinite(policy.costHardLimit) &&
      policy.costHardLimit >= 0,
    '订阅仅允许明确的开发沙箱配置'
  );
  need(/^[a-zA-Z0-9_-]{1,120}$/.test(input.id), '订单标识不合法');
  weekKey(now, policy.timezone, policy.weekStartDay);
  const existing = account.subscriptions.find((s: any) => s.id === input.id);
  if (existing) return { account, order: existing, reused: true };
  const next = structuredClone(account);
  const order = {
    id: input.id,
    policyVersion: policy.version,
    status: 'pending',
    environment: 'sandbox',
    weeklyUnits: policy.weeklyUnits,
    periodDays: policy.periodDays,
    costHardLimit: policy.costHardLimit,
    timezone: policy.timezone,
    weekStartDay: policy.weekStartDay,
    createdAt: now,
    periodStart: null,
    periodEnd: null,
    amount: null,
    currency: null,
    autoCharge: false
  };
  next.subscriptions.push(order);
  return { account: next, order };
}
export function verifySandboxCallback(payload: any, signature: string, secret: string) {
  need(secret.length >= 32 && /^[a-f0-9]{64}$/i.test(signature || ''), '沙箱回调签名无效');
  const actual = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest();
  need(crypto.timingSafeEqual(actual, Buffer.from(signature, 'hex')), '沙箱回调签名无效');
}
export function applySandboxCallback(account: any, payload: any, now = Date.now()) {
  need(
    /^[a-zA-Z0-9_-]{1,120}$/.test(payload.id) &&
      ['activate', 'cancel', 'refund', 'renew', 'change'].includes(payload.action),
    '回调不合法'
  );
  const previous = account.callbacks.find((c: any) => c.id === payload.id);
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  if (previous) {
    need(previous.fingerprint === fingerprint, '重复回调内容不一致');
    return { account, reused: true };
  }
  const next = structuredClone(account);
  const order = next.subscriptions.find((s: any) => s.id === payload.orderId);
  need(order?.environment === 'sandbox', '订单不存在');
  if (payload.action === 'activate' || payload.action === 'renew') {
    need(
      payload.action === 'activate' ? order.status === 'pending' : order.status === 'active',
      '订单状态不允许此操作'
    );
    order.status = 'active';
    order.periodStart = payload.action === 'renew' ? Math.max(now, order.periodEnd) : now;
    order.periodEnd = order.periodStart + order.periodDays * 86400000;
    const week = weekKey(now, order.timezone, order.weekStartDay);
    // 周补给与订阅周期分开；同一周续订不会再发一份额度。
    next.entitlement = {
      ...next.entitlement,
      policyVersion: order.policyVersion,
      timezone: order.timezone,
      startDay: order.weekStartDay,
      weeklyUnits: order.weeklyUnits,
      week,
      spent: next.entitlement.week === week ? next.entitlement.spent : 0,
      reserved: next.entitlement.week === week ? next.entitlement.reserved : 0,
      subscriptionId: order.id
    };
    next.cost.hardLimit = order.costHardLimit;
  } else if (payload.action === 'change') {
    need(
      order.status === 'active' && Number.isInteger(payload.weeklyUnits) && payload.weeklyUnits >= 0,
      '变更参数不合法'
    );
    // 开发规则：升级/降级下周生效，当前周预留不丢失。不作为生产销售权益。
    order.pendingWeeklyUnits = payload.weeklyUnits;
  } else if (payload.action === 'cancel') {
    need(order.status === 'active', '订单尚未激活');
    order.status = 'cancelled';
    order.cancelledAt = now;
  } else {
    need(['active', 'cancelled'].includes(order.status), '订单不能退款');
    order.status = 'refunded';
    order.refundedAt = now;
    next.entitlement.weeklyUnits = 0;
  }
  next.callbacks.push({ id: payload.id, fingerprint, action: payload.action, at: now });
  return { account: next, order };
}
export function refreshSubscriptionEntitlement(account: any, now: number) {
  const next = structuredClone(account);
  const order = next.subscriptions.find((s: any) => s.id === next.entitlement.subscriptionId);
  const week = weekKey(now, next.entitlement.timezone, next.entitlement.startDay);
  if (!order) {
    if (week !== next.entitlement.week) next.entitlement = { ...next.entitlement, week, spent: 0, reserved: 0 };
    return next;
  }
  if (order.status === 'refunded' || now >= order.periodEnd) {
    next.entitlement.weeklyUnits = 0;
    return next;
  }
  if (week !== next.entitlement.week && order.pendingWeeklyUnits !== undefined) {
    order.weeklyUnits = order.pendingWeeklyUnits;
    delete order.pendingWeeklyUnits;
    next.entitlement.weeklyUnits = order.weeklyUnits;
  }
  if (week !== next.entitlement.week) next.entitlement = { ...next.entitlement, week, spent: 0, reserved: 0 };
  return next;
}
