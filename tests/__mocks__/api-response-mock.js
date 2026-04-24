/**
 * api-response.ts 的完整 mock — 供所有后端审计测试共用
 */
import { vi } from 'vitest';

export function createApiResponseMock() {
  return {
    ResponseCode: {
      OK: 0,
      BAD_REQUEST: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      CONFLICT: 409,
      TOO_MANY_REQUESTS: 429,
      INTERNAL_ERROR: 500
    },
    ResponseMessage: {
      OK: '操作成功',
      BAD_REQUEST: '请求参数错误',
      UNAUTHORIZED: '请先登录',
      FORBIDDEN: '无权限',
      NOT_FOUND: '资源不存在',
      INTERNAL_ERROR: '服务器内部错误'
    },
    success: (data, message = '操作成功') => ({ code: 0, success: true, message, data, timestamp: Date.now() }),
    error: (code = 500, message = '服务器内部错误') => ({ code, success: false, message, timestamp: Date.now() }),
    badRequest: (message = '请求参数错误') => ({ code: 400, success: false, message, timestamp: Date.now() }),
    unauthorized: (message = '请先登录') => ({ code: 401, success: false, message, timestamp: Date.now() }),
    forbidden: (message = '无权限') => ({ code: 403, success: false, message, timestamp: Date.now() }),
    notFound: (message = '资源不存在') => ({ code: 404, success: false, message, timestamp: Date.now() }),
    tooManyRequests: (message = '请求过于频繁') => ({ code: 429, success: false, message, timestamp: Date.now() }),
    serverError: (message = '服务器内部错误') => ({ code: 500, success: false, message, timestamp: Date.now() }),
    accepted: (data, message = '已接受') => ({ code: 202, success: true, message, data, timestamp: Date.now() }),
    badGateway: (message = '网关错误') => ({ code: 502, success: false, message, timestamp: Date.now() }),
    requestTimeout: (message = '请求超时') => ({ code: 408, success: false, message, timestamp: Date.now() }),
    conflict: (message = '冲突') => ({ code: 409, success: false, message, timestamp: Date.now() }),
    paginated: (data, page, pageSize, total, message = '查询成功') => ({
      code: 0,
      success: true,
      message,
      data,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      timestamp: Date.now()
    }),
    generateRequestId: (prefix = 'req') => `${prefix}_${Date.now()}_test`,
    wrapResponse: (response, requestId, startTime) => ({ ...response, requestId, duration: Date.now() - startTime }),
    validateRequired: (params, fields) => {
      const missing = fields.filter((f) => !params?.[f]);
      return missing.length === 0 ? null : `缺少参数: ${missing.join(', ')}`;
    },
    validateStringLength: (value, min, max) => typeof value === 'string' && value.length >= min && value.length <= max,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() },
    createLogger: (_prefix) => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), log: vi.fn() }),
    checkRateLimitDistributed: vi.fn(async () => ({
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 60000,
      source: 'memory'
    })),
    checkRateLimit: vi.fn((_key, _limit, _windowMs) => ({ allowed: true, remaining: 9 })),
    validateUserId: vi.fn(
      (userId) =>
        typeof userId === 'string' && userId.length > 0 && userId.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(userId)
    ),
    sanitizeString: vi.fn((str, maxLen = 500) => (typeof str === 'string' ? str.trim().substring(0, maxLen) : '')),
    validateAction: vi.fn((action) => typeof action === 'string' && action.length > 0 && action.length <= 50)
  };
}
