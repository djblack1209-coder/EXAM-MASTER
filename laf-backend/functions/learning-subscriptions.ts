import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import { checkRateLimitDistributed } from './_shared/api-response.js';
import { mutateAccount } from './_shared/learning-account.js';
import { createSandboxOrder, verifySandboxCallback, applySandboxCallback } from './_shared/learning-subscription.js';
export default async function (ctx: any) {
  const auth = requireAuth(ctx);
  if (isAuthError(auth)) return auth;
  const limit = await checkRateLimitDistributed(`learning-subscription:${auth.userId}`, 20, 60000);
  if (!limit.allowed) return { code: 429, success: false, message: '请求过于频繁' };
  const body = ctx.body || {};
  // 生产支付永远保持关闭，不能仅用前端 paid 状态或普通环境开关开启收费。
  if (body.environment !== 'sandbox' || process.env.LEARNING_PAYMENT_SANDBOX_ENABLED !== 'true') {
    return { code: 503, success: false, message: '真实收费关闭；订阅价格、渠道与销售规则尚未确认' };
  }
  try {
    const db = cloud.database();
    if (body.action === 'order') {
      const policy = JSON.parse(process.env.LEARNING_PAYMENT_SANDBOX_POLICY || '{}');
      const result = await mutateAccount(db, auth.userId, (a) => createSandboxOrder(a, { id: body.orderId }, policy));
      return { code: 0, success: true, data: { order: result.order, charged: false } };
    }
    if (body.action === 'callback') {
      verifySandboxCallback(
        body.payload,
        ctx.headers?.['x-sandbox-signature'],
        process.env.LEARNING_PAYMENT_SANDBOX_SECRET || ''
      );
      const result = await mutateAccount(db, auth.userId, (a) => applySandboxCallback(a, body.payload));
      return { code: 0, success: true, data: { order: result.order, reused: result.reused || false, charged: false } };
    }
    return { code: 400, success: false, message: '订阅操作不支持' };
  } catch {
    return { code: 422, success: false, message: '沙箱订单或回调未通过服务端验证' };
  }
}
