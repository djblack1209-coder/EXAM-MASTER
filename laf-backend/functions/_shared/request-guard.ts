/**
 * 请求签名与审计模式校验 — 共享模块
 *
 * 从 proxy-ai.ts 提取的请求安全校验逻辑，供多个云函数复用。
 * 包含：
 * 1. getHeaderValue       — 大小写不敏感地读取请求头
 * 2. validateRequestSign  — FNV-1a 轻量签名校验
 * 3. checkAuditMode       — 生产环境请求签名 / 审计令牌总入口
 * 4. validateAuditToken   — HMAC 审计令牌校验
 */

import crypto from 'crypto';
import { IS_PRODUCTION, createLogger } from './api-response';

const logger = createLogger('[RequestGuard]');

// ==================== 常量 ====================

/** 审核模式开关（环境变量 AUDIT_MODE=true 时启用） */
export const AUDIT_MODE_ENABLED =
  String(process.env.AUDIT_MODE || '')
    .trim()
    .toLowerCase() === 'true';

/** 请求签名盐值（前后端共享，用于 FNV-1a 签名计算） */
export const REQUEST_SIGN_SALT = process.env.REQUEST_SIGN_SALT || process.env.VITE_REQUEST_SIGN_SALT || '';

/** 审计令牌 / 请求签名最大有效期：5 分钟 */
export const AUDIT_TOKEN_MAX_AGE_MS = 5 * 60 * 1000;

// 模块级状态：SALT 缺失只日志一次，避免刷屏
let hasLoggedMissingSalt = false;

// ==================== 工具函数 ====================

/**
 * 大小写不敏感地读取请求头
 * @param ctx  云函数上下文（或任何含 headers 字段的对象）
 * @param headerName  要读取的头名称
 * @returns 去掉首尾空格后的值，找不到返回空字符串
 */
export function getHeaderValue(ctx: Record<string, unknown>, headerName: string): string {
  const headers = (ctx.headers || {}) as Record<string, unknown>;

  // 先精确匹配
  const exactValue = headers[headerName];
  if (typeof exactValue === 'string' && exactValue.trim()) {
    return exactValue.trim();
  }

  // 再不区分大小写遍历
  const lowered = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowered && typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

// ==================== 签名校验 ====================

/**
 * 兼容前端 X-Request-* 轻量签名（FNV-1a）
 * 说明：这是线上兼容兜底，生产审核模式仍以 x-audit-token 为准。
 *
 * @param path             请求路径，如 '/proxy-ai'
 * @param timestampHeader  前端传来的时间戳字符串
 * @param requestSign      前端传来的签名字符串（base-36 编码的 FNV-1a 哈希）
 * @returns 校验是否通过
 */
export function validateRequestSign(path: string, timestampHeader: string, requestSign: string): boolean {
  if (!timestampHeader || !requestSign) return false;

  const timestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp)) {
    return false;
  }

  // 时间戳超出有效期则拒绝
  if (Math.abs(Date.now() - timestamp) > AUDIT_TOKEN_MAX_AGE_MS) {
    return false;
  }

  // H029 FIX: SALT 未配置时拒绝签名校验，而非放行
  if (!REQUEST_SIGN_SALT) {
    if (!hasLoggedMissingSalt) {
      hasLoggedMissingSalt = true;
      logger.error('[Audit] REQUEST_SIGN_SALT 未配置，拒绝 X-Request-Sign 校验');
    }
    return false;
  }

  // FNV-1a 哈希计算
  const raw = `${path}:${timestamp}:${REQUEST_SIGN_SALT}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }

  return requestSign === hash.toString(36);
}

// ==================== 审计令牌校验 ====================

/**
 * 验证审计令牌（HMAC-SHA256 签名）
 * 令牌格式：timestamp_hash
 * - timestamp: 生成时的毫秒时间戳
 * - hash: 以 JWT_SECRET_PLACEHOLDER
 *
 * @param token  完整的审计令牌字符串
 * @returns 令牌是否有效
 */
export function validateAuditToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;

  try {
    // 令牌格式: timestamp_hash
    const parts = token.split('_');
    if (parts.length !== 2) return false;

    const [timestampStr, hash] = parts;
    const timestamp = parseInt(timestampStr);
    const now = Date.now();

    // 令牌有效期检查
    if (isNaN(timestamp) || now - timestamp > AUDIT_TOKEN_MAX_AGE_MS) {
      return false;
    }

    // HMAC 签名验证（使用 JWT_SECRET_PLACEHOLDER
    // P0修复：JWT_SECRET_PLACEHOLDER
    const secret = process.env.JWT_SECRET_PLACEHOLDER
    if (!secret) {
      logger.error('[Audit] JWT_SECRET_PLACEHOLDER
      return false;
    }

    // H-10 FIX: 使用完整 HMAC hex 摘要（64 字符），不再截断以保持 256-bit 防伪造强度
    const expectedHash = crypto.createHmac('sha256', secret).update(timestampStr).digest('hex');

    // 长度不匹配直接拒绝
    if (hash.length !== expectedHash.length) {
      logger.warn('[Audit] 审计令牌签名长度不匹配');
      return false;
    }

    // 使用 timingSafeEqual 防止时序攻击
    try {
      if (!crypto.timingSafeEqual(Buffer.from(hash, 'utf8'), Buffer.from(expectedHash, 'utf8'))) {
        logger.warn('[Audit] 审计令牌签名不匹配');
        return false;
      }
    } catch {
      logger.warn('[Audit] 审计令牌签名校验异常');
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ==================== 审计模式总入口 ====================

/**
 * 检查请求是否通过审计模式校验
 * 后端必须是最后一道防线，即使前端被绕过也要拦截。
 *
 * 校验逻辑：
 * 1. 非生产环境 → 直接放行
 * 2. 审核模式开启 → 必须携带有效的 x-audit-token
 * 3. 生产非审核模式 → 优先校验 x-audit-token，否则必须通过 X-Request-Sign 签名校验
 *
 * @param ctx                云函数上下文
 * @param signPath           用于 FNV-1a 签名的请求路径，默认 '/proxy-ai'
 * @returns { valid, error? }
 */
export function checkAuditMode(
  ctx: Record<string, unknown>,
  signPath: string = '/proxy-ai'
): { valid: boolean; error?: string } {
  // 1. 非生产环境直接放行
  if (!IS_PRODUCTION) {
    return { valid: true };
  }

  // 2. 读取请求头
  const auditToken = getHeaderValue(ctx, 'x-audit-token');
  const requestTimestamp = getHeaderValue(ctx, 'x-request-timestamp');
  const requestSign = getHeaderValue(ctx, 'x-request-sign');

  // 3. 审核模式下：必须严格校验 x-audit-token
  if (AUDIT_MODE_ENABLED) {
    if (!auditToken || !validateAuditToken(auditToken)) {
      logger.warn('[Audit] 审核模式下审计令牌无效或缺失，拒绝请求');
      return { valid: false, error: '审计校验失败，请刷新页面重试' };
    }
    return { valid: true };
  }

  // 4. 生产非审核模式：
  //    - 若携带 x-audit-token，校验其合法性
  //    - 否则必须携带 X-Request-* 签名头并通过 FNV-1a 校验
  //    - H029 FIX: 不再允许两类头都不携带的情况（关闭绕过路径）
  if (auditToken) {
    if (!validateAuditToken(auditToken)) {
      logger.warn('[Audit] 审计令牌非法，拒绝请求');
      return { valid: false, error: '审计校验失败，请刷新页面重试' };
    }
    return { valid: true };
  }

  // 必须携带请求签名
  if (!requestTimestamp || !requestSign) {
    logger.warn('[Audit] 生产环境缺少 X-Request-Timestamp/X-Request-Sign 头，拒绝请求');
    return { valid: false, error: '请求签名缺失，请升级客户端后重试' };
  }

  if (!validateRequestSign(signPath, requestTimestamp, requestSign)) {
    logger.warn('[Audit] X-Request-Sign 校验失败，拒绝请求');
    return { valid: false, error: '请求签名校验失败，请刷新后重试' };
  }

  return { valid: true };
}
