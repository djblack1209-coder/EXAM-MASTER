/**
 * AI 供应商健康检查与余额监控
 *
 * 用途：
 *   - 夜间审计系统调用，检查付费供应商余额
 *   - 管理员手动调用，了解各供应商状态
 *
 * 安全：需要管理员令牌（X-Admin-Token 头 = WORKER_AUTH_TOKEN 环境变量）
 *
 * 请求示例：
 *   GET /provider-health
 *   Headers: { X-Admin-Token: <WORKER_AUTH_TOKEN> }
 *
 * 响应示例：
 *   { code: 0, data: { providers: [...], summary: { total: 14, healthy: 12, warning: 1, error: 1 } } }
 *
 * @module functions/provider-health
 */

import { checkAllProviderBalances } from './_shared/ai-providers/provider-factory';

export default async function (ctx: any) {
  // 管理员令牌校验（防止普通用户调用）
  const adminToken = process.env.WORKER_AUTH_TOKEN;
  const requestToken = ctx.headers?.['x-admin-token'] || ctx.query?.token;

  if (!adminToken || requestToken !== adminToken) {
    return { code: 403, message: '需要管理员权限' };
  }

  try {
    const balances = await checkAllProviderBalances();

    // 汇总统计
    const summary = {
      total: balances.length,
      ok: balances.filter((b) => b.status === 'ok').length,
      warning: balances.filter((b) => b.status === 'warning').length,
      error: balances.filter((b) => b.status === 'error').length,
      checkedAt: new Date().toISOString()
    };

    // 余额不足的供应商列表（用于告警）
    const alerts = balances.filter((b) => b.status === 'warning').map((b) => b.message);

    return {
      code: 0,
      data: {
        providers: balances,
        summary,
        alerts,
        hasAlerts: alerts.length > 0
      }
    };
  } catch (err: any) {
    return {
      code: 500,
      message: '健康检查执行失败',
      error: err?.message || String(err)
    };
  }
}
