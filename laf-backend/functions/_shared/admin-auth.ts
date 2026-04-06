import crypto from 'crypto';
import { extractBearerToken, verifyJWT } from './auth';

interface AdminAuthOptions {
  headerName?: string;
  bodyFieldName?: string;
  secretEnvKey?: string;
  allowBodyFallback?: boolean;
  allowJwtAdmin?: boolean;
}

export interface AdminAuthResult {
  ok: boolean;
  code: number;
  message: string;
  mode?: 'jwt' | 'secret';
  adminId?: string;
}

function getHeaderValue(headers: Record<string, unknown> | undefined, headerName: string): unknown {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }

  const exact = headers[headerName];
  if (exact !== undefined) {
    return exact;
  }

  const loweredTarget = headerName.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === loweredTarget) {
      return value;
    }
  }

  return undefined;
}

function timingSafeEqualText(left: string, right: string): boolean {
  const a = Buffer.from(left || '', 'utf8');
  const b = Buffer.from(right || '', 'utf8');
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function hasAdminPrivileges(payload: Record<string, unknown>): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const role = payload.role;
  if (typeof role === 'string' && role.toLowerCase() === 'admin') {
    return true;
  }

  if (payload.isAdmin === true || payload.admin === true) {
    return true;
  }

  const permissions = payload.permissions;
  if (Array.isArray(permissions)) {
    const normalized = permissions.filter((item) => typeof item === 'string').map((item) => item.toLowerCase());
    if (normalized.includes('admin') || normalized.includes('system:admin') || normalized.includes('*')) {
      return true;
    }
  }

  const scopes = payload.scopes;
  if (Array.isArray(scopes)) {
    const normalized = scopes.filter((item) => typeof item === 'string').map((item) => item.toLowerCase());
    if (normalized.includes('admin') || normalized.includes('system:admin') || normalized.includes('*')) {
      return true;
    }
  }

  return false;
}

export function requireAdminAccess(
  ctx: { headers?: Record<string, unknown>; body?: Record<string, unknown> },
  options: AdminAuthOptions = {}
): AdminAuthResult {
  const headerName = options.headerName || 'x-admin-secret';
  const bodyFieldName = options.bodyFieldName || 'adminSecret';
  const secretEnvKey = options.secretEnvKey || 'ADMIN_SECRET';
  const allowBodyFallback = options.allowBodyFallback === true;
  const allowJwtAdmin = options.allowJwtAdmin !== false;

  if (allowJwtAdmin) {
    const rawAuth = getHeaderValue(ctx?.headers, 'authorization');
    const token = extractBearerToken(typeof rawAuth === 'string' ? rawAuth : '');
    if (token) {
      const payload = verifyJWT(token);
      if (payload && hasAdminPrivileges(payload as Record<string, unknown>)) {
        const adminId =
          typeof payload.userId === 'string'
            ? payload.userId
            : typeof payload.uid === 'string'
              ? payload.uid
              : undefined;
        return {
          ok: true,
          code: 0,
          message: 'ok',
          mode: 'jwt',
          adminId
        };
      }
    }
  }

  const expectedSecret = process.env[secretEnvKey] || '';
  if (!expectedSecret) {
    return {
      ok: false,
      code: 503,
      message: '服务端管理员鉴权未配置'
    };
  }

  const headerSecretRaw = getHeaderValue(ctx?.headers, headerName);
  const headerSecret = typeof headerSecretRaw === 'string' ? headerSecretRaw.trim() : '';

  const body = ctx?.body && typeof ctx.body === 'object' ? ctx.body : {};
  const bodySecretRaw = (body as Record<string, unknown>)[bodyFieldName];
  const bodySecret = typeof bodySecretRaw === 'string' ? bodySecretRaw.trim() : '';

  if (!headerSecret && bodySecret && !allowBodyFallback) {
    return {
      ok: false,
      code: 400,
      message: `请通过请求头 ${headerName} 提供管理员凭据`
    };
  }

  const providedSecret = headerSecret || (allowBodyFallback ? bodySecret : '');
  if (!providedSecret) {
    return {
      ok: false,
      code: 403,
      message: '无权执行此操作'
    };
  }

  if (!timingSafeEqualText(providedSecret, expectedSecret)) {
    return {
      ok: false,
      code: 403,
      message: '无权执行此操作'
    };
  }

  return {
    ok: true,
    code: 0,
    message: 'ok',
    mode: 'secret'
  };
}
