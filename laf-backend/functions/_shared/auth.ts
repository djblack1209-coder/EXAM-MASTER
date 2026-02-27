import crypto from 'crypto';

let hasLoggedMissingSecret = false;

function logMissingSecretOnce() {
  if (hasLoggedMissingSecret) {
    return;
  }

  hasLoggedMissingSecret = true;
  try {
    // 避免与 api-response 模块形成隐式耦合
    // eslint-disable-next-line no-console
    console.error('[Auth] JWT_SECRET 未配置，拒绝 token 验证');
  } catch {
    // ignore logging failure
  }
}

export interface JwtPayload {
  userId?: string;
  uid?: string;
  role?: string;
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

interface JwtHeader {
  alg?: string;
  typ?: string;
  [key: string]: unknown;
}

function decodeJwtPart<T extends Record<string, unknown>>(segment: string): T | null {
  try {
    const parsed = JSON.parse(Buffer.from(segment, 'base64url').toString());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as T;
  } catch {
    return null;
  }
}

function normalizeExpTimestamp(exp: number): number {
  if (!Number.isFinite(exp) || exp <= 0) {
    return 0;
  }

  // 兼容秒级 exp（10 位）和毫秒级 exp（13 位）
  return exp < 1_000_000_000_000 ? exp * 1000 : exp;
}

export function extractBearerToken(rawToken: unknown): string {
  if (typeof rawToken !== 'string') return '';

  const trimmed = rawToken.trim();
  if (!trimmed) return '';

  const bearerMatch = trimmed.match(/^Bearer(?:\s+(.+))?$/i);
  if (!bearerMatch) {
    return trimmed;
  }

  return (bearerMatch[1] || '').trim();
}

export function isJwtSecretConfigured(): boolean {
  return !!process.env.JWT_SECRET;
}

export function verifyJWT(token: string): JwtPayload | null {
  try {
    if (!token) return null;

    const secret = process.env.JWT_SECRET || '';
    if (!secret) {
      logMissingSecretOnce();
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerBase64, payloadBase64, signature] = parts;
    const header = decodeJwtPart<JwtHeader>(headerBase64);
    if (!header || header.alg !== 'HS256') {
      return null;
    }
    if (header.typ && header.typ !== 'JWT') {
      return null;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${headerBase64}.${payloadBase64}`)
      .digest('base64url');

    // timingSafeEqual 仅接受同长度 Buffer，先做长度检查避免抛异常
    if (signature.length !== expectedSignature.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'))) {
      return null;
    }

    const payload = decodeJwtPart<JwtPayload>(payloadBase64);
    if (!payload) {
      return null;
    }

    if (!payload.exp || typeof payload.exp !== 'number') {
      return null;
    }

    const expiresAt = normalizeExpTimestamp(payload.exp);
    if (!expiresAt || expiresAt < Date.now()) {
      return null;
    }

    if (payload.iat !== undefined && typeof payload.iat === 'number') {
      const issuedAt = normalizeExpTimestamp(payload.iat);
      if (issuedAt && issuedAt > expiresAt) {
        return null;
      }
    }

    return payload;
  } catch {
    return null;
  }
}
