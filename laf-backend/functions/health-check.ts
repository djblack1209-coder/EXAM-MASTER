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
import { requireAdminAccess } from './_shared/admin-auth.js';

const db = cloud.database();

export default async function (ctx: any) {
  const requestId = `hc_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    if (!ctx || typeof ctx !== 'object') {
      throw new Error('invalid context');
    }

    const adminAuth = requireAdminAccess(ctx, {
      allowBodyFallback: true,
      allowJwtAdmin: false
    });
    const isAdmin = adminAuth.ok;

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
      success: isHealthy,
      status: isHealthy ? 'healthy' : 'degraded',
      requestId,
      checks,
      version: '1.0.0',
      latency: Date.now() - startTime
    };
  } catch (error: any) {
    return { code: 500, success: false, status: 'error', message: '健康检查异常', requestId };
  }
}
