/**
 * 安全审计日志工具 (S005)
 * 
 * 记录安全相关事件到 security_audit_logs 集合，用于：
 * - 登录/登出事件追踪
 * - 认证失败监控
 * - 敏感操作记录
 * - 异常行为检测辅助
 * 
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud'

const db = cloud.database()
const COLLECTION = 'security_audit_logs'

// ==================== 类型定义 ====================

export type AuditSeverity = 'info' | 'warn' | 'critical'

export type AuditEventType =
  | 'auth.login'
  | 'auth.login_failed'
  | 'auth.logout'
  | 'auth.token_expired'
  | 'auth.token_invalid'
  | 'access.unauthorized'
  | 'access.forbidden'
  | 'access.rate_limited'
  | 'data.export'
  | 'data.bulk_delete'
  | 'data.sensitive_read'
  | 'input.injection_attempt'
  | 'input.xss_attempt'
  | 'input.validation_failed'
  | 'behavior.suspicious'
  | 'behavior.ban_issued'
  | 'system.config_change'
  | 'system.error'

export interface AuditContext {
  userId?: string
  ip?: string
  userAgent?: string
  requestId?: string
  action?: string
  resource?: string
  [key: string]: unknown
}

interface AuditEntry {
  event: AuditEventType
  severity: AuditSeverity
  message: string
  context: AuditContext
  timestamp: string
  created_at: Date
}

// ==================== 严重级别映射 ====================

const DEFAULT_SEVERITY: Record<string, AuditSeverity> = {
  'auth.login': 'info',
  'auth.login_failed': 'warn',
  'auth.logout': 'info',
  'auth.token_expired': 'info',
  'auth.token_invalid': 'warn',
  'access.unauthorized': 'warn',
  'access.forbidden': 'warn',
  'access.rate_limited': 'warn',
  'data.export': 'info',
  'data.bulk_delete': 'warn',
  'data.sensitive_read': 'info',
  'input.injection_attempt': 'critical',
  'input.xss_attempt': 'critical',
  'input.validation_failed': 'info',
  'behavior.suspicious': 'critical',
  'behavior.ban_issued': 'critical',
  'system.config_change': 'warn',
  'system.error': 'warn',
}

// ==================== 核心函数 ====================

/**
 * 记录审计事件
 * 
 * 写入失败时仅 console.error，不抛异常，避免影响业务流程。
 */
export async function audit(
  event: AuditEventType,
  message: string,
  context: AuditContext = {},
  severity?: AuditSeverity
): Promise<void> {
  const entry: AuditEntry = {
    event,
    severity: severity || DEFAULT_SEVERITY[event] || 'info',
    message,
    context: {
      ...context,
      // 脱敏：移除可能的敏感字段
      password: undefined,
      token: undefined,
    },
    timestamp: new Date().toISOString(),
    created_at: new Date(),
  }

  // 关键事件同时输出到控制台，确保即使 DB 写入失败也有记录
  if (entry.severity === 'critical') {
    console.error(`[AUDIT:CRITICAL] ${event} - ${message}`, JSON.stringify(context))
  } else if (entry.severity === 'warn') {
    console.warn(`[AUDIT:WARN] ${event} - ${message}`)
  }

  try {
    await db.collection(COLLECTION).add(entry)
  } catch (err) {
    console.error('[AuditLogger] 写入审计日志失败:', err)
  }
}

// ==================== 便捷方法 ====================

/**
 * 从 Laf 云函数 ctx 中提取审计上下文
 */
export function extractContext(ctx: any, extra: Partial<AuditContext> = {}): AuditContext {
  const headers = ctx?.headers || ctx?.request?.headers || {}
  return {
    ip: headers['x-real-ip'] || headers['x-forwarded-for'] || ctx?.ip || 'unknown',
    userAgent: headers['user-agent'] || 'unknown',
    requestId: headers['x-request-id'] || undefined,
    ...extra,
  }
}

/** 登录成功 */
export const auditLogin = (userId: string, ctx: AuditContext) =>
  audit('auth.login', `用户登录成功: ${userId}`, { ...ctx, userId })

/** 登录失败 */
export const auditLoginFailed = (reason: string, ctx: AuditContext) =>
  audit('auth.login_failed', `登录失败: ${reason}`, ctx)

/** 认证失败（无效/过期 token） */
export const auditAuthFailed = (event: 'auth.token_expired' | 'auth.token_invalid', userId: string | undefined, ctx: AuditContext) =>
  audit(event, `认证失败`, { ...ctx, userId })

/** 访问被拒 */
export const auditAccessDenied = (resource: string, ctx: AuditContext) =>
  audit('access.forbidden', `访问被拒: ${resource}`, { ...ctx, resource })

/** 频率限制触发 */
export const auditRateLimited = (action: string, ctx: AuditContext) =>
  audit('access.rate_limited', `触发频率限制: ${action}`, { ...ctx, action })

/** 注入/XSS 尝试 */
export const auditInjectionAttempt = (type: 'input.injection_attempt' | 'input.xss_attempt', detail: string, ctx: AuditContext) =>
  audit(type, detail, ctx, 'critical')

/** 可疑行为 */
export const auditSuspicious = (detail: string, ctx: AuditContext) =>
  audit('behavior.suspicious', detail, ctx)

export default {
  audit,
  extractContext,
  auditLogin,
  auditLoginFailed,
  auditAuthFailed,
  auditAccessDenied,
  auditRateLimited,
  auditInjectionAttempt,
  auditSuspicious,
}
