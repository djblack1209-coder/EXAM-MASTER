/**
 * 健康检查云函数
 * 
 * 功能：
 * 1. 检查数据库连接
 * 2. 检查 AI 服务可用性
 * 3. 返回系统状态
 */

import cloud from '@lafjs/cloud'

const db = cloud.database()

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `health_${Date.now()}`

  const checks = {
    database: { status: 'unknown', latency: 0 },
    ai: { status: 'unknown', latency: 0 },
    timestamp: new Date().toISOString()
  }

  // 1. 检查数据库
  try {
    const dbStart = Date.now()
    await db.collection('users').count()
    checks.database = {
      status: 'healthy',
      latency: Date.now() - dbStart
    }
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error.message,
      latency: Date.now() - startTime
    }
  }

  // 2. 检查 AI 服务（简单 ping）
  try {
    const aiStart = Date.now()
    const AI_PROVIDER_KEY_PLACEHOLDER

    if (AI_PROVIDER_KEY_PLACEHOLDER
      // 只检查 API Key 是否配置，不实际调用
      checks.ai = {
        status: 'configured',
        latency: Date.now() - aiStart
      }
    } else {
      checks.ai = {
        status: 'not_configured',
        latency: 0
      }
    }
  } catch (error) {
    checks.ai = {
      status: 'error',
      error: error.message
    }
  }

  // 3. 计算总体状态
  const isHealthy = checks.database.status === 'healthy'
  const totalLatency = Date.now() - startTime

  return {
    code: isHealthy ? 0 : 500,
    status: isHealthy ? 'healthy' : 'degraded',
    checks,
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    uptime: process.uptime ? process.uptime() : 'N/A',
    latency: totalLatency,
    requestId
  }
}
