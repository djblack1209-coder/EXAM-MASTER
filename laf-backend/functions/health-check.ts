/**
 * 健康检查云函数
 *
 * 功能：
 * 1. 公开端点：仅返回 { status: "ok" }
 * 2. 管理员模式：检查数据库连接、AI 服务可用性，返回详细状态
 *
 * H8-FIX: 公开访问不再暴露 NODE_ENV、uptime 等内部信息
 */

import cloud from '@lafjs/cloud';

const db = cloud.database();
const SECRET_PLACEHOLDER

export default async function (ctx: any) {
  try {
    const adminSecret = ctx.headers?.['x-admin-secret'] || ctx.body?.adminSecret;
    const isAdmin = ADMIN_SECRET && adminSecret === ADMIN_SECRET;

    // 公开访问：仅返回最小状态
    if (!isAdmin) {
      return { code: 0, status: 'ok' };
    }

    // 管理员模式：返回详细诊断信息
    const startTime = Date.now();
    const checks: Record<string, any> = {
      database: { status: 'unknown', latency: 0 },
      ai: { status: 'unknown', latency: 0 },
      timestamp: new Date().toISOString()
    };

    // 1. 检查数据库
    try {
      const dbStart = Date.now();
      await db.collection('users').count();
      checks.database = {
        status: 'healthy',
        latency: Date.now() - dbStart
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        error: '数据库连接异常',
        latency: Date.now() - startTime
      };
    }

    // 2. 检查 AI 服务（仅检查配置）
    try {
      const aiStart = Date.now();
      checks.ai = {
        status: process.env.AI_PROVIDER_KEY_PLACEHOLDER
        latency: Date.now() - aiStart
      };
    } catch (error) {
      checks.ai = { status: 'error', latency: 0 };
    }

    // 3. 计算总体状态
    const isHealthy = checks.database.status === 'healthy';

    return {
      code: isHealthy ? 0 : 500,
      status: isHealthy ? 'healthy' : 'degraded',
      checks,
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      uptime: process.uptime ? process.uptime() : 'N/A',
      latency: Date.now() - startTime
    };
  } catch (error: any) {
    return { code: 500, status: 'error', message: '健康检查异常' };
  }
}
