/**
 * 统一API响应格式工具
 * 
 * 提供标准化的API响应格式，确保所有云函数返回一致的数据结构
 * 
 * @version 1.0.0
 */

// ==================== 响应码定义 ====================
export const ResponseCode = {
  // 成功
  SUCCESS: 0,
  
  // 客户端错误 (4xx)
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
  TOO_MANY_REQUESTS: 429,
  
  // 服务端错误 (5xx)
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504
}

// ==================== 响应消息定义 ====================
export const ResponseMessage = {
  [ResponseCode.SUCCESS]: '操作成功',
  [ResponseCode.BAD_REQUEST]: '请求参数错误',
  [ResponseCode.UNAUTHORIZED]: '未授权，请先登录',
  [ResponseCode.FORBIDDEN]: '无权限访问',
  [ResponseCode.NOT_FOUND]: '资源不存在',
  [ResponseCode.METHOD_NOT_ALLOWED]: '不支持的操作',
  [ResponseCode.CONFLICT]: '资源冲突',
  [ResponseCode.VALIDATION_ERROR]: '数据验证失败',
  [ResponseCode.TOO_MANY_REQUESTS]: '请求过于频繁，请稍后再试',
  [ResponseCode.INTERNAL_ERROR]: '服务器内部错误',
  [ResponseCode.SERVICE_UNAVAILABLE]: '服务暂时不可用',
  [ResponseCode.TIMEOUT]: '请求超时'
}

// ==================== 响应接口定义 ====================
export interface ApiResponse<T = any> {
  code: number
  success: boolean
  message: string
  data?: T
  error?: string
  requestId?: string
  duration?: number
  timestamp?: number
}

// ==================== 响应构建器 ====================

/**
 * 成功响应
 */
export function success<T>(data?: T, message?: string): ApiResponse<T> {
  return {
    code: ResponseCode.SUCCESS,
    success: true,
    message: message || ResponseMessage[ResponseCode.SUCCESS],
    data,
    timestamp: Date.now()
  }
}

/**
 * 错误响应
 */
export function error(
  code: number = ResponseCode.INTERNAL_ERROR,
  message?: string,
  errorDetail?: string
): ApiResponse {
  return {
    code,
    success: false,
    message: message || ResponseMessage[code] || '未知错误',
    error: errorDetail,
    timestamp: Date.now()
  }
}

/**
 * 参数错误响应
 */
export function badRequest(message?: string, errorDetail?: string): ApiResponse {
  return error(ResponseCode.BAD_REQUEST, message || '请求参数错误', errorDetail)
}

/**
 * 未授权响应
 */
export function unauthorized(message?: string): ApiResponse {
  return error(ResponseCode.UNAUTHORIZED, message || '请先登录')
}

/**
 * 无权限响应
 */
export function forbidden(message?: string): ApiResponse {
  return error(ResponseCode.FORBIDDEN, message || '无权限访问')
}

/**
 * 资源不存在响应
 */
export function notFound(message?: string): ApiResponse {
  return error(ResponseCode.NOT_FOUND, message || '资源不存在')
}

/**
 * 请求过于频繁响应
 */
export function tooManyRequests(message?: string): ApiResponse {
  return error(ResponseCode.TOO_MANY_REQUESTS, message || '请求过于频繁，请稍后再试')
}

/**
 * 服务器错误响应
 */
export function serverError(message?: string, errorDetail?: string): ApiResponse {
  return error(ResponseCode.INTERNAL_ERROR, message || '服务器内部错误', errorDetail)
}

/**
 * 分页数据响应
 */
export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
  message?: string
): ApiResponse<{ list: T[], total: number, page: number, limit: number, hasMore: boolean }> {
  return success({
    list: data,
    total,
    page,
    limit,
    hasMore: page * limit < total
  }, message || '获取成功')
}

// ==================== 请求ID生成 ====================

/**
 * 生成请求ID
 */
export function generateRequestId(prefix: string = 'req'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// ==================== 响应包装器 ====================

/**
 * 包装响应，添加请求ID和耗时
 */
export function wrapResponse<T>(
  response: ApiResponse<T>,
  requestId: string,
  startTime: number
): ApiResponse<T> {
  return {
    ...response,
    requestId,
    duration: Date.now() - startTime
  }
}

// ==================== 参数验证工具 ====================

/**
 * 验证必填参数
 */
export function validateRequired(params: Record<string, unknown>, requiredFields: string[]): { valid: boolean, missing: string[] } {
  const missing = requiredFields.filter(field => {
    const value = params[field]
    return value === undefined || value === null || value === ''
  })
  
  return {
    valid: missing.length === 0,
    missing
  }
}

/**
 * 验证字符串长度
 */
export function validateStringLength(value: string, minLength: number, maxLength: number): boolean {
  if (typeof value !== 'string') return false
  return value.length >= minLength && value.length <= maxLength
}

/**
 * 验证数字范围
 */
export function validateNumberRange(value: number, min: number, max: number): boolean {
  if (typeof value !== 'number' || isNaN(value)) return false
  return value >= min && value <= max
}

/**
 * 验证枚举值
 */
export function validateEnum<T>(value: T, allowedValues: T[]): boolean {
  return allowedValues.includes(value)
}

/**
 * 清理字符串（防XSS）
 */
export function sanitizeString(input: string, maxLength: number = 2000): string {
  if (typeof input !== 'string') return ''
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .substring(0, maxLength)
    .trim()
}

/**
 * 验证用户ID格式
 */
export function validateUserId(userId: unknown): boolean {
  return typeof userId === 'string' && 
         userId.length > 0 && 
         userId.length <= 64
}

/**
 * 验证操作类型格式
 */
export function validateAction(action: unknown): boolean {
  return typeof action === 'string' && 
         action.length > 0 && 
         action.length <= 50 && 
         /^[a-zA-Z_]+$/.test(action)
}

// ==================== 日志工具 ====================

const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'warn' : 'info')

export const logger = {
  info: (...args: unknown[]) => { 
    if (LOG_LEVEL !== 'warn' && LOG_LEVEL !== 'error') {
      console.log('[API]', ...args) 
    }
  },
  warn: (...args: unknown[]) => { 
    if (LOG_LEVEL !== 'error') {
      console.warn('[API]', ...args) 
    }
  },
  error: (...args: unknown[]) => console.error('[API]', ...args)
}

// ==================== 速率限制工具 ====================

// 内存缓存（简单实现，生产环境建议使用Redis）
const rateLimitCache = new Map<string, { count: number, resetAt: number }>()

/**
 * 检查速率限制
 * @param key 限制键（如 userId + action）
 * @param limit 限制次数
 * @param windowMs 时间窗口（毫秒）
 * @returns 是否允许请求
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean, remaining: number, resetAt: number } {
  const now = Date.now()
  const record = rateLimitCache.get(key)
  
  // 清理过期记录
  if (record && record.resetAt <= now) {
    rateLimitCache.delete(key)
  }
  
  const current = rateLimitCache.get(key)
  
  if (!current) {
    // 新记录
    rateLimitCache.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs }
  }
  
  if (current.count >= limit) {
    // 超过限制
    return { allowed: false, remaining: 0, resetAt: current.resetAt }
  }
  
  // 增加计数
  current.count++
  return { allowed: true, remaining: limit - current.count, resetAt: current.resetAt }
}

/**
 * 清理过期的速率限制记录
 */
export function cleanupRateLimitCache(): void {
  const now = Date.now()
  for (const [key, record] of rateLimitCache.entries()) {
    if (record.resetAt <= now) {
      rateLimitCache.delete(key)
    }
  }
}

// 定期清理（每5分钟）
setInterval(cleanupRateLimitCache, 5 * 60 * 1000)

export default {
  ResponseCode,
  ResponseMessage,
  success,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  tooManyRequests,
  serverError,
  paginated,
  generateRequestId,
  wrapResponse,
  validateRequired,
  validateStringLength,
  validateNumberRange,
  validateEnum,
  sanitizeString,
  validateUserId,
  validateAction,
  logger,
  checkRateLimit
}
