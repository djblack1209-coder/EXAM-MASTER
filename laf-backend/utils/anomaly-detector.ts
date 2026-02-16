/**
 * 异常行为检测中间件 (S002/B006)
 *
 * 在云函数中检测可疑请求模式：
 * - 高频请求（短时间内大量请求）
 * - 注入攻击尝试（SQL/NoSQL/XSS）
 * - 异常参数模式（超长字段、非法字符）
 * - 暴力破解尝试（连续认证失败）
 *
 * 用法：在云函数入口处调用 detectAnomalies(ctx)
 *
 * @version 1.0.0
 */

import { audit, extractContext } from './audit-logger'

// ==================== 检测规则 ====================

/** NoSQL 注入特征 */
const NOSQL_PATTERNS = [
  /\$gt\b/i, /\$lt\b/i, /\$ne\b/i, /\$regex\b/i,
  /\$where\b/i, /\$or\b/i, /\$and\b/i, /\$exists\b/i,
  /\$elemMatch\b/i, /\$nin\b/i,
]

/** XSS 攻击特征 */
const XSS_PATTERNS = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /on(error|load|click|mouseover)\s*=/i,
  /eval\s*\(/i,
  /document\.(cookie|location|write)/i,
]

/** 路径遍历特征 */
const PATH_TRAVERSAL = /\.\.\//

// ==================== 内存级频率追踪 ====================

const requestTracker = new Map<string, { count: number; window: number; authFails: number }>()
const TRACKER_WINDOW = 60000 // 1分钟窗口
const HIGH_FREQ_THRESHOLD = 60 // 每分钟超过60次视为异常
const AUTH_FAIL_THRESHOLD = 10 // 连续认证失败超过10次

// 定期清理过期条目
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of requestTracker.entries()) {
    if (now - val.window > TRACKER_WINDOW * 2) {
      requestTracker.delete(key)
    }
  }
}, 300000) // 每5分钟清理

// ==================== 核心检测函数 ====================

export interface AnomalyResult {
  blocked: boolean
  reason?: string
  severity: 'none' | 'warn' | 'critical'
  details: string[]
}

/**
 * 检测请求中的异常行为
 * @param ctx - Laf 云函数上下文
 * @param options - 配置项
 * @returns 检测结果，blocked=true 时应拒绝请求
 */
export function detectAnomalies(
  ctx: any,
  options: { userId?: string; action?: string } = {}
): AnomalyResult {
  const details: string[] = []
  let severity: 'none' | 'warn' | 'critical' = 'none'
  const body = ctx?.body || {}
  const headers = ctx?.headers || {}
  const userId = options.userId || body.userId || 'anonymous'
  const auditCtx = extractContext(ctx, { userId, action: options.action })

  // 1. 高频请求检测
  const freqResult = checkFrequency(userId)
  if (freqResult === 'critical') {
    details.push(`高频请求: 用户 ${userId} 超过 ${HIGH_FREQ_THRESHOLD} 次/分钟`)
    severity = 'critical'
    audit('behavior.suspicious', `高频请求检测触发`, auditCtx).catch(() => {})
  } else if (freqResult === 'warn') {
    details.push(`请求频率偏高`)
    if (severity === 'none') severity = 'warn'
  }

  // 2. 请求体注入检测
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
  
  for (const pattern of NOSQL_PATTERNS) {
    if (pattern.test(bodyStr)) {
      details.push(`疑似NoSQL注入: ${pattern.source}`)
      severity = 'critical'
      audit('input.injection_attempt', `NoSQL注入尝试: ${pattern.source}`, auditCtx).catch(() => {})
      break
    }
  }

  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(bodyStr)) {
      details.push(`疑似XSS攻击: ${pattern.source}`)
      severity = 'critical'
      audit('input.xss_attempt', `XSS攻击尝试: ${pattern.source}`, auditCtx).catch(() => {})
      break
    }
  }

  if (PATH_TRAVERSAL.test(bodyStr)) {
    details.push('疑似路径遍历攻击')
    severity = 'critical'
    audit('input.injection_attempt', '路径遍历尝试', auditCtx).catch(() => {})
  }

  // 3. 异常参数检测
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string' && value.length > 50000) {
      details.push(`参数 ${key} 异常过长: ${value.length} 字符`)
      if (severity === 'none') severity = 'warn'
    }
  }

  // 4. 伪造头部检测
  const suspiciousHeaders = ['x-audit-bypass', 'x-skip-audit', 'admin-override', 'x-forwarded-host']
  for (const h of suspiciousHeaders) {
    if (headers[h]) {
      details.push(`可疑请求头: ${h}`)
      severity = 'critical'
      audit('behavior.suspicious', `伪造头部尝试: ${h}`, auditCtx).catch(() => {})
    }
  }

  return {
    blocked: severity === 'critical',
    reason: severity === 'critical' ? details[0] : undefined,
    severity,
    details,
  }
}

/**
 * 记录认证失败（用于暴力破解检测）
 */
export function recordAuthFailure(userId: string): boolean {
  const now = Date.now()
  const tracker = requestTracker.get(userId) || { count: 0, window: now, authFails: 0 }
  
  if (now - tracker.window > TRACKER_WINDOW) {
    tracker.authFails = 1
    tracker.window = now
  } else {
    tracker.authFails++
  }
  
  requestTracker.set(userId, tracker)
  
  if (tracker.authFails >= AUTH_FAIL_THRESHOLD) {
    audit('behavior.suspicious', `暴力破解检测: ${userId} 连续 ${tracker.authFails} 次认证失败`, { userId }).catch(() => {})
    return true // 应该封禁
  }
  return false
}

// ==================== 内部函数 ====================

function checkFrequency(userId: string): 'none' | 'warn' | 'critical' {
  const now = Date.now()
  const tracker = requestTracker.get(userId) || { count: 0, window: now, authFails: 0 }

  if (now - tracker.window > TRACKER_WINDOW) {
    tracker.count = 1
    tracker.window = now
  } else {
    tracker.count++
  }

  requestTracker.set(userId, tracker)

  if (tracker.count > HIGH_FREQ_THRESHOLD) return 'critical'
  if (tracker.count > HIGH_FREQ_THRESHOLD * 0.7) return 'warn'
  return 'none'
}

export default { detectAnomalies, recordAuthFailure }
