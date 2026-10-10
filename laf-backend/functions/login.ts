/**
 * 统一登录云函数
 *
 * 功能：
 * 1. 微信登录：接收微信 code，换取 openid
 * 2. QQ 登录：支持 H5 OAuth / App OAuth / QQ 小程序 code
 * 3. ✅ B001: 邮箱登录：邮箱 + 验证码 / 邮箱 + 密码
 * 4. 查询或创建用户
 * 5. 生成 JWT token
 * 6. 返回用户信息
 *
 * 环境变量要求：
 * - WX_APPID: 微信小程序 AppID
 * - WX_SECRET: 微信小程序密钥
 * - QQ_APPID/QQ_SECRET: QQ互联网站应用（小程序旧配置兼容）
 * - QQ_MOBILE_APPID: QQ互联移动应用 AppID（SDK token 必须核验归属）
 * - QQ_MINI_APPID/QQ_MINI_SECRET: QQ小程序独立配置
 * - QQ_REDIRECT_URI: QQ H5 OAuth 回调地址（可选，建议配置）
 * - JWT_SECRET: JWT签名密钥
 *
 * 请求参数：
 * - type: string (可选) - 登录类型: 'wechat'(默认) | 'wechat_h5' | 'wechat_web' | 'qq' | 'email'
 * - code: string (微信登录必填) - 微信登录凭证
 * - email: string (邮箱登录必填) - 邮箱地址
 * - verifyCode: string (邮箱验证码登录必填) - 验证码
 * - password: string (邮箱密码登录可选) - 密码
 *
 * 返回格式：
 * { code: 0, data: { userId, token, userInfo }, message: 'success' }
 *
 * @version 3.0.0
 * @author EXAM-MASTER Team
 */

import cloud from '@lafjs/cloud';
import crypto from 'crypto';
import { perfMonitor } from './_shared/perf-monitor.js';
import { createLogger, checkRateLimitDistributed } from './_shared/api-response.js';
import { verifyJWT as verifySharedJWT } from './_shared/auth.js';
import { handleDesktopOAuth } from './_shared/desktop-oauth.js';
const logger = createLogger('[Login]');

// ==================== 环境变量配置 ====================
// 重要：请确保在后端控制台配置了正确的环境变量
// 安全提示：敏感信息必须通过环境变量配置，禁止硬编码
const WX_APPID = process.env.WX_APPID || '';
const WX_SECRET = process.env.WX_SECRET || '';
// E007: 微信公众号配置（H5网页授权）
const WX_GZH_APPID = process.env.WX_GZH_APPID || '';
const WX_GZH_SECRET = process.env.WX_GZH_SECRET || '';
// 微信开放平台移动应用：禁止借用小程序或公众号密钥。
const WX_MOBILE_APPID = process.env.WX_MOBILE_APPID || '';
const WX_MOBILE_SECRET = process.env.WX_MOBILE_SECRET || '';
// 微信普通浏览器扫码使用网站应用，禁止借用其他应用的配置。
const WX_WEB_APPID = process.env.WX_WEB_APPID || '';
const WX_WEB_SECRET = process.env.WX_WEB_SECRET || '';
const WX_WEB_REDIRECT_URI = process.env.WX_WEB_REDIRECT_URI || '';
const DESKTOP_OAUTH_ENABLED = process.env.DESKTOP_OAUTH_ENABLED === 'true';
// QQ 网站、移动应用和小程序分别核对配置，移动应用不得借用网站 AppID。
const QQ_APPID = process.env.QQ_APPID || '';
const QQ_SECRET = process.env.QQ_SECRET || '';
const QQ_REDIRECT_URI = process.env.QQ_REDIRECT_URI || '';
const QQ_MOBILE_APPID = process.env.QQ_MOBILE_APPID || '';
const QQ_MINI_APPID = process.env.QQ_MINI_APPID || '';
const QQ_MINI_SECRET = process.env.QQ_MINI_SECRET || '';
// ✅ B017: JWT_SECRET 必须通过环境变量配置，不再提供任何硬编码默认值
const JWT_SECRET = process.env.JWT_SECRET || '';
if (!process.env.JWT_SECRET) {
  // 避免模块加载阶段抛错导致所有依赖 verifyJWT 的云函数无法启动
  logger.error('❌ 严重安全警告：JWT_SECRET 未配置！登录与鉴权请求将被拒绝。');
}
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7天

// ==================== 环境变量完整性检查 ====================
const ENV_CHECK_RESULTS: { key: string; present: boolean }[] = [
  { key: 'WX_APPID', present: !!process.env.WX_APPID },
  { key: 'WX_SECRET', present: !!process.env.WX_SECRET },
  { key: 'QQ_APPID', present: !!process.env.QQ_APPID },
  { key: 'QQ_SECRET', present: !!process.env.QQ_SECRET },
  { key: 'QQ_MOBILE_APPID', present: !!QQ_MOBILE_APPID },
  { key: 'QQ_MINI_APPID', present: !!QQ_MINI_APPID },
  { key: 'QQ_MINI_SECRET', present: !!QQ_MINI_SECRET },
  { key: 'JWT_SECRET', present: !!process.env.JWT_SECRET },
  { key: 'WX_GZH_APPID', present: !!process.env.WX_GZH_APPID },
  { key: 'WX_GZH_SECRET', present: !!process.env.WX_GZH_SECRET },
  { key: 'WX_MOBILE_APPID', present: !!process.env.WX_MOBILE_APPID },
  { key: 'WX_MOBILE_SECRET', present: !!process.env.WX_MOBILE_SECRET }
];

const missingEnvVars = ENV_CHECK_RESULTS.filter((r) => !r.present).map((r) => r.key);
if (missingEnvVars.length > 0) {
  logger.warn(`⚠️ 缺少环境变量: ${missingEnvVars.join(', ')}。部分功能可能不可用。`);
}

// ==================== 登录频率限制配置 ====================
const LOGIN_RATE_LIMIT_WINDOW = 60 * 1000; // 频率限制窗口：60秒
const LOGIN_RATE_LIMIT_MAX = 5; // 每个IP每分钟最多5次登录尝试
const LOGIN_BLOCK_DURATION = 15 * 60 * 1000; // 超限后封禁15分钟
const loginRateLimitCache = new Map<
  string,
  { count: number; resetTime: number; blocked?: boolean; blockedUntil?: number }
>();

// ==================== 密码强度配置 ====================
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 32;
const PASSWORD_RULES = {
  minLength: PASSWORD_MIN_LENGTH,
  maxLength: PASSWORD_MAX_LENGTH,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: false // 可选：要求特殊字符
};

// ==================== scrypt 密码哈希 ====================
const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = 16384; // N=2^14, 推荐值
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;

/**
 * 使用 crypto.scrypt 哈希密码（异步）
 * 返回格式: scrypt:<salt_hex>:<hash_hex>
 */
function hashPasswordScrypt(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
      (err, derivedKey) => {
        if (err) return reject(err);
        resolve(`scrypt:${salt}:${derivedKey.toString('hex')}`);
      }
    );
  });
}

/**
 * 验证密码是否匹配 scrypt 哈希
 */
function verifyPasswordScrypt(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const parts = storedHash.split(':');
    if (parts[0] !== 'scrypt' || parts.length !== 3) return resolve(false);
    const salt = parts[1];
    const hash = parts[2];
    crypto.scrypt(
      password,
      salt,
      SCRYPT_KEYLEN,
      { N: SCRYPT_COST, r: SCRYPT_BLOCK_SIZE, p: SCRYPT_PARALLELIZATION },
      (err, derivedKey) => {
        if (err) return reject(err);
        // 使用 timingSafeEqual 防止时序攻击
        try {
          const hashBuf = Buffer.from(hash, 'hex');
          resolve(crypto.timingSafeEqual(derivedKey, hashBuf));
        } catch {
          resolve(false);
        }
      }
    );
  });
}

/**
 * 判断存储的哈希是否为旧版 SHA256 格式
 */
function isLegacySHA256(storedHash: string): boolean {
  return !storedHash.startsWith('scrypt:');
}

// 获取数据库实例
const db = cloud.database();

// ==================== 参数校验 ====================
function validateLoginParams(data: unknown): { valid: boolean; error?: string; sanitized?: Record<string, unknown> } {
  const safeData = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const code = safeData.code;

  // 1. 必填检查
  if (!code) {
    return { valid: false, error: 'code 不能为空' };
  }

  // 2. 类型检查
  if (typeof code !== 'string') {
    return { valid: false, error: 'code 必须是字符串' };
  }

  // 3. 长度检查（微信 code 通常在 32-100 字符之间）
  if (code.length < 10 || code.length > 200) {
    return { valid: false, error: 'code 长度不合法' };
  }

  // 4. 格式检查（只允许字母数字和部分特殊字符）
  if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
    return { valid: false, error: 'code 格式不合法' };
  }

  return { valid: true, sanitized: { code: code.trim() } };
}

/**
 * 验证密码强度
 * @param password 密码
 * @returns 验证结果
 */
function validatePasswordStrength(password: string): { valid: boolean; score: number; errors: string[] } {
  const errors: string[] = [];
  let score = 0;

  if (!password) {
    return { valid: false, score: 0, errors: ['密码不能为空'] };
  }

  // 长度检查
  if (password.length < PASSWORD_RULES.minLength) {
    errors.push(`密码长度至少 ${PASSWORD_RULES.minLength} 位`);
  } else {
    score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
  }

  if (password.length > PASSWORD_RULES.maxLength) {
    errors.push(`密码长度不能超过 ${PASSWORD_RULES.maxLength} 位`);
  }

  // 大写字母检查
  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('密码需要包含大写字母');
  } else if (/[A-Z]/.test(password)) {
    score += 1;
  }

  // 小写字母检查
  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('密码需要包含小写字母');
  } else if (/[a-z]/.test(password)) {
    score += 1;
  }

  // 数字检查
  if (PASSWORD_RULES.requireNumber && !/[0-9]/.test(password)) {
    errors.push('密码需要包含数字');
  } else if (/[0-9]/.test(password)) {
    score += 1;
  }

  // 特殊字符检查
  if (PASSWORD_RULES.requireSpecial && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('密码需要包含特殊字符');
  } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 2;
  }

  // 常见弱密码检查
  const weakPasswords = [
    '12345678',
    '123456789',
    '1234567890',
    'password',
    'password1',
    'password123',
    'qwerty',
    'qwerty123',
    'abc123',
    '11111111',
    '00000000',
    '88888888',
    'admin123',
    'root123',
    'test123'
  ];
  if (weakPasswords.includes(password.toLowerCase())) {
    errors.push('密码过于简单，请使用更复杂的密码');
    score = Math.max(0, score - 3);
  }

  // 连续字符检查
  if (/(.)\1{3,}/.test(password)) {
    errors.push('密码不能包含4个以上连续相同字符');
    score = Math.max(0, score - 1);
  }

  // 键盘序列检查
  const keyboardSequences = ['qwerty', 'asdfgh', 'zxcvbn', '123456', '654321'];
  for (const seq of keyboardSequences) {
    if (password.toLowerCase().includes(seq)) {
      errors.push('密码不能包含键盘连续字符');
      score = Math.max(0, score - 1);
      break;
    }
  }

  return {
    valid: errors.length === 0,
    score: Math.min(10, score), // 最高10分
    errors
  };
}

/**
 * 获取密码强度等级
 * @param score 密码强度分数
 * @returns 强度等级描述
 */
function getPasswordStrengthLevel(score: number): { level: string; color: string } {
  if (score <= 2) return { level: '弱', color: 'red' };
  if (score <= 4) return { level: '较弱', color: 'orange' };
  if (score <= 6) return { level: '中等', color: 'yellow' };
  if (score <= 8) return { level: '强', color: 'green' };
  return { level: '非常强', color: 'darkgreen' };
}

/**
 * 检查登录频率限制
 * @param clientIp 客户端IP
 * @returns 是否允许登录
 */
function checkLoginRateLimit(clientIp: string): {
  allowed: boolean;
  remaining: number;
  blockedUntil?: number;
  message?: string;
} {
  if (!clientIp) {
    return { allowed: true, remaining: LOGIN_RATE_LIMIT_MAX };
  }

  const now = Date.now();
  const record = loginRateLimitCache.get(clientIp);

  // 清理过期的缓存条目（简单的内存管理）
  if (loginRateLimitCache.size > 10000) {
    for (const [key, value] of loginRateLimitCache.entries()) {
      if (now > value.resetTime && (!value.blocked || now > (value.blockedUntil || 0))) {
        loginRateLimitCache.delete(key);
      }
    }
  }

  // 检查是否被封禁
  if (record?.blocked && record.blockedUntil && now < record.blockedUntil) {
    const remainingBlock = Math.ceil((record.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      blockedUntil: record.blockedUntil,
      message: `登录尝试过于频繁，请在 ${remainingBlock} 秒后重试`
    };
  }

  // 新窗口或已过期，重置计数
  if (!record || now > record.resetTime) {
    loginRateLimitCache.set(clientIp, {
      count: 1,
      resetTime: now + LOGIN_RATE_LIMIT_WINDOW,
      blocked: false
    });
    return { allowed: true, remaining: LOGIN_RATE_LIMIT_MAX - 1 };
  }

  // 检查是否超过限制
  if (record.count >= LOGIN_RATE_LIMIT_MAX) {
    // 超过限制，设置封禁
    loginRateLimitCache.set(clientIp, {
      ...record,
      blocked: true,
      blockedUntil: now + LOGIN_BLOCK_DURATION
    });
    return {
      allowed: false,
      remaining: 0,
      blockedUntil: now + LOGIN_BLOCK_DURATION,
      message: `登录尝试过于频繁，请在 ${LOGIN_BLOCK_DURATION / 1000} 秒后重试`
    };
  }

  // 增加计数
  record.count++;
  return {
    allowed: true,
    remaining: LOGIN_RATE_LIMIT_MAX - record.count
  };
}

// ==================== P3-FIX: 公共用户创建函数（消除3处重复代码） ====================
const usersCollection = db.collection('users');

/**
 * 创建新用户的默认数据结构
 * @param overrides - 覆盖默认值的字段（如 openid, email, h5_openid 等）
 */
function buildNewUserData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now();
  return {
    nickname: `考研学子${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    avatar_url: '',
    role: 'user',
    streak_days: 0,
    total_study_days: 0,
    total_study_minutes: 0,
    total_questions: 0,
    correct_questions: 0,
    last_study_date: null,
    achievements: [],
    settings: {
      theme: 'auto',
      notification: true,
      daily_goal: 30
    },
    created_at: now,
    updated_at: now,
    ...overrides
  };
}

/**
 * 创建新用户并插入数据库
 * @returns 插入后的用户对象 { data: { _id, ...fields } }
 */
async function createNewUser(
  overrides: Record<string, unknown>,
  requestId: string,
  label: string
): Promise<{ data: Record<string, unknown> }> {
  const newUser = buildNewUserData(overrides);
  const insertRes = await usersCollection.add(newUser);
  logger.info(`[${requestId}] ${label}新用户创建成功`);
  return { data: { _id: insertRes.id, ...newUser } };
}

function isDuplicateKeyError(error: unknown): boolean {
  const message = String((error as Error)?.message || error || '').toLowerCase();
  return (
    message.includes('duplicate') ||
    message.includes('e11000') ||
    message.includes('already exists') ||
    message.includes('conflict') ||
    message.includes('唯一')
  );
}

async function findFirstUserByQueries(
  queries: Array<Record<string, unknown>>
): Promise<{ data: Record<string, unknown> } | null> {
  for (const query of queries) {
    const found = await usersCollection.where(query).getOne();
    if (found?.data) {
      return found as { data: Record<string, unknown> };
    }
  }
  return null;
}

async function findOrCreateUserByIdentity(
  queries: Array<Record<string, unknown>>,
  createOverrides: Record<string, unknown>,
  requestId: string,
  label: string
): Promise<{ user: { data: Record<string, unknown> }; isNewUser: boolean }> {
  const existing = await findFirstUserByQueries(queries);
  if (existing?.data) {
    return { user: existing, isNewUser: false };
  }

  try {
    const created = await createNewUser(createOverrides, requestId, label);
    return { user: created, isNewUser: true };
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    logger.warn(`[${requestId}] ${label}用户并发创建冲突，回查已存在用户`);
    const raced = await findFirstUserByQueries(queries);
    if (raced?.data) {
      return { user: raced, isNewUser: false };
    }

    throw error;
  }
}

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const loginType = ctx.body?.type || 'wechat';
  const endPerf = perfMonitor.start('login', loginType);

  logger.info(`[${requestId}] 登录请求开始`);

  try {
    // 缺少密钥时仅拒绝当前请求，不阻断其他云函数模块加载
    if (!JWT_SECRET) {
      return {
        code: 500,
        success: false,
        message: '服务配置错误：缺少 JWT 签名密钥，请联系管理员',
        requestId
      };
    }

    // 0. 登录频率限制检查（防止暴力破解）
    const clientIp =
      ctx.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      ctx.headers?.['x-real-ip'] ||
      ctx.socket?.remoteAddress ||
      'unknown';

    // Poll/cancel cannot exchange a supplier credential. They use their own
    // bounded limit before session reads; other login attempts keep 5/min.
    if (loginType === 'desktop_oauth' && ['poll', 'cancel'].includes(ctx.body?.action)) {
      return await desktopLogin(ctx, requestId, startTime);
    }
    const distributedRateLimit = await checkRateLimitDistributed(
      `login:${clientIp}`,
      LOGIN_RATE_LIMIT_MAX,
      LOGIN_RATE_LIMIT_WINDOW
    );

    let rateLimitResult: {
      allowed: boolean;
      remaining: number;
      blockedUntil?: number;
      message?: string;
    } = {
      allowed: distributedRateLimit.allowed,
      remaining: distributedRateLimit.remaining
    };

    // DB 限流不可用时，降级到本地防暴力破解策略（含封禁窗口）
    if (distributedRateLimit.source === 'memory') {
      rateLimitResult = checkLoginRateLimit(clientIp);
    }

    if (!rateLimitResult.allowed) {
      logger.warn(`[${requestId}] 登录频率限制触发`);
      return {
        code: 429,
        success: false,
        message: rateLimitResult.message || '请求过于频繁，请稍后再试',
        retryAfter: rateLimitResult.blockedUntil
          ? Math.ceil((rateLimitResult.blockedUntil - Date.now()) / 1000)
          : Math.max(1, Math.ceil((distributedRateLimit.resetAt - Date.now()) / 1000)),
        requestId
      };
    }

    // ✅ B001: 根据登录类型分发处理（使用顶部已声明的 loginType）

    if (loginType === 'desktop_oauth') {
      return await desktopLogin(ctx, requestId, startTime);
    } else if (loginType === 'email') {
      return await handleEmailLogin(ctx, requestId, startTime);
    } else if (loginType === 'qq') {
      return await handleQQLogin(ctx, requestId, startTime);
    } else if (loginType === 'wechat_h5') {
      // E007: H5微信浏览器 OAuth 网页授权登录
      return await handleWechatOAuthLogin(ctx, requestId, startTime, 'h5');
    } else if (loginType === 'wechat_web') {
      return await handleWechatOAuthLogin(ctx, requestId, startTime, 'website');
    } else if (loginType === 'wechat' || loginType === 'weixin') {
      if (ctx.body?.platform === 'app') {
        return await handleWechatOAuthLogin(ctx, requestId, startTime, 'app');
      }
      if (ctx.body?.platform && ctx.body.platform !== 'mp-weixin') {
        return { code: 400, success: false, message: '不支持的微信登录平台', requestId };
      }
      return await handleWechatLogin(ctx, requestId, startTime);
    }
    return { code: 400, success: false, message: '不支持的登录方式', requestId };
  } catch (error) {
    const duration = Date.now() - startTime;
    endPerf({ error: true });
    // 数据库错误可能包含唯一键中的私人身份；仅保留本次请求定位。
    logger.error(`[${requestId}] 登录异常`);

    return {
      code: 500,
      success: false,
      message: '服务异常，请稍后重试',
      requestId,
      duration
    };
  }
}

// ==================== ✅ B001: 邮箱登录处理 ====================
async function desktopLogin(ctx, requestId: string, startTime: number) {
  const sessions: any = cloud.database().collection('desktop_oauth_sessions');
  const response = await handleDesktopOAuth(ctx, {
    enabled: DESKTOP_OAUTH_ENABLED,
    secret: JWT_SECRET,
    collection: sessions,
    retentionConfigured: async () => {
      if (typeof sessions.listIndexes !== 'function') return false;
      try {
        const indexes = await sessions.listIndexes();
        return (
          Array.isArray(indexes) &&
          indexes.some(
            (index) =>
              index.name === 'idx_desktop_oauth_expiry' &&
              index.expireAfterSeconds === 0 &&
              Object.keys(index.key || {}).length === 1 &&
              index.key.expires_at === 1
          )
        );
      } catch {
        return false;
      }
    },
    nativeOrigins: String(process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((value) => value.trim()),
    config: (provider) =>
      provider === 'qq'
        ? QQ_APPID && QQ_SECRET && QQ_REDIRECT_URI && isAllowedRedirectDomain(QQ_REDIRECT_URI)
          ? { appId: QQ_APPID, redirectUri: QQ_REDIRECT_URI }
          : null
        : WX_WEB_APPID && WX_WEB_SECRET && WX_WEB_REDIRECT_URI
          ? { appId: WX_WEB_APPID, redirectUri: WX_WEB_REDIRECT_URI }
          : null,
    exchange: (provider, code, redirectUri) =>
      provider === 'qq'
        ? handleQQLogin({ ...ctx, body: { type: 'qq', code, platform: 'h5', redirectUri } }, requestId, startTime)
        : handleWechatOAuthLogin({ ...ctx, body: { type: 'wechat_web', code } }, requestId, startTime, 'website'),
    pollAllowed: async (ip) => (await checkRateLimitDistributed(`desktop-poll:${ip}`, 30, 60_000)).allowed,
    issue: async (userId, isNewUser) => {
      const user = (await cloud.database().collection('users').doc(userId).get())?.data;
      if (!user || user.is_deleted === true || ['blocked', 'deleted'].includes(user.status)) {
        return { code: 401, success: false, message: '账户不可用，请重新登录' };
      }
      return {
        code: 0,
        data: {
          userId,
          isNewUser,
          token: generateJWT({ userId, role: user.role }),
          userInfo: {
            _id: userId,
            id: userId,
            nickname: user.nickname,
            avatar_url: user.avatar_url || '',
            role: user.role,
            streak_days: user.streak_days,
            total_study_days: user.total_study_days,
            total_questions: user.total_questions,
            correct_questions: user.correct_questions,
            settings: user.settings
          }
        },
        message: '登录成功'
      };
    }
  });
  return { ...response, requestId };
}

/**
 * 邮箱登录/注册
 * 支持两种方式：
 * 1. 邮箱 + 验证码（首选，用于注册和登录）
 * 2. 邮箱 + 密码（用于已设置密码的用户）
 */
async function handleEmailLogin(ctx, requestId: string, startTime: number) {
  const { email, verifyCode, password } = ctx.body || {};

  // 1. 参数校验
  if (!email) {
    return { code: 400, success: false, message: '邮箱不能为空', requestId };
  }

  // 邮箱格式校验
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return { code: 400, success: false, message: '邮箱格式不正确', requestId };
  }

  // 必须提供验证码或密码
  if (!verifyCode && !password) {
    return { code: 400, success: false, message: '请提供验证码或密码', requestId };
  }

  // 验证码注册/设置密码时，先校验密码强度，避免错误消耗验证码
  if (verifyCode && password) {
    const strengthResult = validatePasswordStrength(password);
    if (!strengthResult.valid) {
      return {
        code: 400,
        success: false,
        message: `密码强度不足: ${strengthResult.errors.join('; ')}`,
        passwordStrength: getPasswordStrengthLevel(strengthResult.score),
        requestId
      };
    }
  }

  // ✅ B005: 验证码校验逻辑
  if (verifyCode) {
    const codeValid = await validateEmailCode(email, verifyCode, requestId);
    if (!codeValid.valid) {
      return { code: 401, success: false, message: codeValid.error || '验证码错误', requestId };
    }
  }

  // 密码校验
  if (password && !verifyCode) {
    // 密码强度检查（仅注册时）
    const existingUser = await db.collection('users').where({ email }).getOne();

    if (!existingUser.data) {
      // ✅ 安全修复：新用户使用密码注册时必须先通过邮箱验证码校验，防止未验证邮箱直接注册
      return {
        code: 400,
        success: false,
        message: '新用户注册需先完成邮箱验证码校验',
        requestId
      };
    } else {
      // 老用户登录，验证密码
      if (!existingUser.data.password_hash) {
        return { code: 401, success: false, message: '该账号未设置密码，请使用验证码登录', requestId };
      }

      const storedHash = existingUser.data.password_hash;
      let passwordValid = false;

      if (isLegacySHA256(storedHash)) {
        // 兼容旧版 SHA256 密码验证
        // ✅ P0修复：使用 timingSafeEqual 防止时序攻击
        const legacyHash = crypto
          .createHash('sha256')
          .update(password + (existingUser.data.password_salt || ''))
          .digest('hex');
        try {
          passwordValid = crypto.timingSafeEqual(Buffer.from(legacyHash, 'utf8'), Buffer.from(storedHash, 'utf8'));
        } catch {
          passwordValid = false;
        }

        // 验证通过后自动迁移到 scrypt
        if (passwordValid) {
          try {
            const newSalt = crypto.randomBytes(16).toString('hex');
            const newHash = await hashPasswordScrypt(password, newSalt);
            const emailUsersCol = db.collection('users');
            await emailUsersCol.where({ email }).update({
              password_hash: newHash,
              password_salt: newSalt,
              password_upgraded_at: Date.now()
            });
            logger.info(`[${requestId}] 用户密码已从 SHA256 自动迁移到 scrypt`);
          } catch (migrateErr) {
            // 迁移失败不影响登录，仅记录警告
            logger.warn(`[${requestId}] 密码迁移到 scrypt 失败:`, migrateErr);
          }
        }
      } else {
        // 新版 scrypt 密码验证
        passwordValid = await verifyPasswordScrypt(password, storedHash);
      }

      if (!passwordValid) {
        return { code: 401, success: false, message: '密码错误', requestId };
      }
    }
  }

  // 2. 查询或创建用户（并发安全：创建冲突后回查）
  const now = Date.now();
  const overrides: Record<string, unknown> = { email };

  // 仅在验证码链路中提交密码时，才写入/更新密码哈希
  if (verifyCode && password) {
    const salt = crypto.randomBytes(16).toString('hex');
    overrides.password_salt = salt;
    overrides.password_hash = await hashPasswordScrypt(password, salt);
  }

  const { user, isNewUser } = await findOrCreateUserByIdentity([{ email }], overrides, requestId, '邮箱');
  const userData = user.data as Record<string, any>;
  if (!isNewUser) {
    // 老用户更新登录时间
    await usersCollection.doc(String(userData._id)).update({
      updated_at: now
    });

    logger.info(`[${requestId}] 邮箱用户登录: ${String(userData._id)}`);
  }

  // 3. 生成 JWT token
  const userId = String(userData._id);
  const token = generateJWT({
    userId,
    email,
    role: userData.role
  });

  // 4. 验证码已在校验阶段原子标记为 used，这里无需删除

  const duration = Date.now() - startTime;
  logger.info(`[${requestId}] 邮箱登录成功，耗时: ${duration}ms`);

  return {
    code: 0,
    data: {
      userId,
      token,
      isNewUser,
      userInfo: {
        _id: userId,
        id: userId,
        nickname: userData.nickname,
        avatar_url: userData.avatar_url,
        email: userData.email,
        role: userData.role,
        streak_days: userData.streak_days,
        total_study_days: userData.total_study_days,
        total_questions: userData.total_questions,
        correct_questions: userData.correct_questions,
        settings: userData.settings
      }
    },
    message: isNewUser ? '注册成功' : '登录成功',
    requestId,
    duration
  };
}

// 邮箱脱敏工具：日志中隐藏邮箱中间字符，防止敏感信息泄露
function maskEmailForLog(email: string): string {
  if (typeof email !== 'string' || !email.includes('@')) return '***';
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '***';
  if (localPart.length <= 2) return `${localPart[0] || '*'}***@${domain}`;
  return `${localPart[0]}***${localPart[localPart.length - 1]}@${domain}`;
}

// ✅ B005: 邮箱验证码校验（含暴力破解防护）
async function validateEmailCode(
  email: string,
  code: string,
  requestId: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    const now = Date.now();
    const CODE_EXPIRE_MS = 10 * 60 * 1000;
    const MAX_VERIFY_ATTEMPTS = 5; // 5分钟内最多尝试5次
    const VERIFY_WINDOW_MS = 5 * 60 * 1000;

    // [安全加固] 暴力破解防护：检查近5分钟内该邮箱的验证失败次数
    const recentFailures = await db
      .collection('email_code_attempts')
      .where({
        email,
        success: false,
        created_at: db.command.gt(now - VERIFY_WINDOW_MS)
      })
      .count();

    if (recentFailures.total >= MAX_VERIFY_ATTEMPTS) {
      logger.warn(
        `[${requestId}] 验证码暴力破解拦截: email=${maskEmailForLog(email)}, failures=${recentFailures.total}`
      );
      return { valid: false, error: '验证失败次数过多，请5分钟后再试' };
    }

    // 查询验证码记录
    const codeRecord = await db
      .collection('email_codes')
      .where({
        email,
        code,
        used: false
      })
      .orderBy('created_at', 'desc')
      .getOne();

    if (!codeRecord.data) {
      // 记录失败尝试
      await db
        .collection('email_code_attempts')
        .add({
          email,
          success: false,
          created_at: now
        })
        .catch(() => {});
      return { valid: false, error: '验证码错误或已过期' };
    }

    // 检查是否过期（10分钟有效期）
    if (now - codeRecord.data.created_at > CODE_EXPIRE_MS) {
      // 删除过期验证码
      await db.collection('email_codes').doc(codeRecord.data._id).remove();
      // 记录失败尝试
      await db
        .collection('email_code_attempts')
        .add({
          email,
          success: false,
          created_at: now
        })
        .catch(() => {});
      return { valid: false, error: '验证码已过期，请重新获取' };
    }

    // 原子消耗验证码：防止并发重复使用
    const consumeResult = await db
      .collection('email_codes')
      .where({
        _id: codeRecord.data._id,
        used: false
      })
      .update({
        used: true,
        used_at: now
      });

    if (consumeResult.updated !== 1) {
      return { valid: false, error: '验证码已失效，请重新获取' };
    }

    // 记录成功尝试（用于审计）
    await db
      .collection('email_code_attempts')
      .add({
        email,
        success: true,
        created_at: now
      })
      .catch(() => {});

    logger.info(`[${requestId}] 验证码校验通过: ${maskEmailForLog(email)}`);
    return { valid: true };
  } catch (e) {
    logger.error(`[${requestId}] 验证码校验异常:`, e);
    return { valid: false, error: '验证码校验失败' };
  }
}

function parseQueryStringPayload(raw: string): Record<string, string> {
  if (!raw || typeof raw !== 'string') return {};
  const normalized = raw.trim().replace(/^\?/, '');
  const params = new URLSearchParams(normalized);
  if (['access_token', 'error'].some((key) => params.getAll(key).length > 1)) return {};
  return Object.fromEntries(params.entries());
}

function parseQQCallbackPayload(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'string') return null;

  const match = raw.trim().match(/^callback\s*\(\s*(\{[\s\S]*\})\s*\)\s*;?$/);
  const candidate = match?.[1] || raw.trim();
  try {
    const data = JSON.parse(candidate);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/**
 * 允许的 QQ OAuth 回调域名白名单
 * 防止开放重定向攻击：客户端传入的 redirect_uri 必须匹配已知域名
 */
const ALLOWED_REDIRECT_DOMAINS = ['245334.xyz', 'nf98ia8qnt.sealosbja.site', '101.43.41.96', 'localhost', '127.0.0.1'];

/** 检查可登记回调的 URL 语法；客户端地址还须在既有主机白名单内。 */
function isAllowedRedirectDomain(urlStr: string, requireAllowedDomain = true): boolean {
  try {
    const url = new URL(urlStr);
    if (!['http:', 'https:'].includes(url.protocol) || url.hash || url.username || url.password) return false;
    return (
      !requireAllowedDomain ||
      ALLOWED_REDIRECT_DOMAINS.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`))
    );
  } catch {
    return false;
  }
}

function resolveQQRedirectUri(ctx: any, bodyRedirectUri: unknown): string {
  // 显式地址无效时拒绝，不换成另一个地址继续交换已绑定的授权码。
  if (bodyRedirectUri !== undefined && bodyRedirectUri !== null && bodyRedirectUri !== '') {
    return typeof bodyRedirectUri === 'string' && isAllowedRedirectDomain(bodyRedirectUri) ? bodyRedirectUri : '';
  }

  if (QQ_REDIRECT_URI) {
    return isAllowedRedirectDomain(QQ_REDIRECT_URI, false) ? QQ_REDIRECT_URI : '';
  }

  const origin = ctx.headers?.origin || ctx.headers?.Origin;
  if (typeof origin === 'string' && /^https?:\/\//.test(origin) && isAllowedRedirectDomain(origin)) {
    return `${new URL(origin).origin}/oauth/qq.html`;
  }

  return '';
}

async function getQQOAuthBody(url: string, requestId: string): Promise<unknown | null> {
  try {
    const response = await cloud.fetch({
      url,
      method: 'GET',
      timeout: 10000,
      maxRedirects: 0,
      maxContentLength: 65536
    });
    return response.status === 200 ? response.data : null;
  } catch {
    logger.warn(`[${requestId}] QQ 授权上游请求未完成`);
    return null;
  }
}

function qqOAuthObject(body: unknown): Record<string, unknown> | null {
  if (typeof body === 'string') return parseQQCallbackPayload(body);
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

function validOAuthToken(value: unknown): value is string {
  return typeof value === 'string' && /^[\x21-\x7e]{1,2048}$/.test(value);
}

async function handleQQLogin(ctx, requestId: string, startTime: number) {
  const body = ctx.body || {};
  const platform = body.platform === undefined || body.platform === '' ? 'h5' : body.platform;
  if (!['h5', 'app', 'mp-qq'].includes(platform)) {
    return { code: 400, success: false, message: 'QQ 登录平台无效', requestId };
  }
  const mobile = platform === 'app',
    mini = platform === 'mp-qq';
  // 小程序保留旧配置兼容；显式填写任一新配置后必须填写完整，不能混合密钥。
  const separateMini = !!(QQ_MINI_APPID || QQ_MINI_SECRET);
  const appId = mobile ? QQ_MOBILE_APPID : mini && separateMini ? QQ_MINI_APPID : QQ_APPID;
  const secret = mini && separateMini ? QQ_MINI_SECRET : QQ_SECRET;
  if (!appId || (!mobile && !secret)) {
    return { code: 500, success: false, message: '服务配置错误：缺少对应 QQ 应用配置，请联系管理员', requestId };
  }
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  let accessToken = mobile && typeof body.accessToken === 'string' ? body.accessToken : '';
  if (
    (mobile && !validOAuthToken(accessToken)) ||
    (!mobile && (!/^[a-zA-Z0-9_-]{6,200}$/.test(code) || body.accessToken !== undefined))
  ) {
    return { code: 400, success: false, message: 'QQ 登录凭证无效，请重新登录', requestId };
  }
  if (mobile && body.openid !== undefined && !validOAuthIdentity(body.openid)) {
    return { code: 400, success: false, message: 'QQ 登录参数无效', requestId };
  }
  let openid: string,
    unionid = '';
  const failed = () => ({ code: 401, success: false, message: 'QQ 登录校验失败，请重新登录', requestId });
  if (mini) {
    const url =
      'https://api.q.qq.com/sns/jscode2session?' +
      new URLSearchParams({
        appid: appId,
        secret,
        js_code: code,
        grant_type: 'authorization_code'
      });
    const data = qqOAuthObject(await getQQOAuthBody(url, requestId));
    if (
      !data ||
      (data.errcode !== undefined && data.errcode !== 0) ||
      !validOAuthIdentity(data.openid) ||
      (data.unionid !== undefined && !validOAuthIdentity(data.unionid))
    )
      return failed();
    openid = data.openid;
    unionid = typeof data.unionid === 'string' ? data.unionid : '';
  } else {
    if (!mobile) {
      const redirectUri = resolveQQRedirectUri(ctx, body.redirectUri);
      if (!redirectUri) return { code: 400, success: false, message: 'QQ 回调地址无效，请检查配置', requestId };
      const url =
        'https://graph.qq.com/oauth2.0/token?' +
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: appId,
          client_secret: secret,
          code,
          redirect_uri: redirectUri,
          fmt: 'json'
        });
      const tokenBody = await getQQOAuthBody(url, requestId);
      const data =
        qqOAuthObject(tokenBody) || (typeof tokenBody === 'string' ? parseQueryStringPayload(tokenBody) : null);
      if (
        !data ||
        (data.error !== undefined && data.error !== 0 && data.error !== '0') ||
        !validOAuthToken(data.access_token)
      )
        return failed();
      accessToken = data.access_token;
    }
    const meUrl =
      'https://graph.qq.com/oauth2.0/me?' +
      new URLSearchParams({
        access_token: accessToken,
        unionid: '1',
        fmt: 'json'
      });
    const data = qqOAuthObject(await getQQOAuthBody(meUrl, requestId));
    // /me 的 client_id 由 QQ 返回，是授权归属本项目应用的必要证据。
    if (
      !data ||
      (data.error !== undefined && data.error !== 0 && data.error !== '0') ||
      data.client_id !== appId ||
      !validOAuthIdentity(data.openid) ||
      (data.unionid !== undefined && !validOAuthIdentity(data.unionid))
    )
      return failed();
    openid = data.openid;
    unionid = typeof data.unionid === 'string' ? data.unionid : '';
    if (mobile && body.openid !== undefined && body.openid !== openid) return failed();
  }

  const openidKey = mobile ? 'qq_mobile_openid' : mini ? 'qq_mini_openid' : 'qq_openid';
  const appidKey = mobile ? 'qq_mobile_appid' : mini ? 'qq_mini_appid' : null;
  const identity: Record<string, unknown> = { [openidKey]: openid, ...(appidKey ? { [appidKey]: appId } : {}) };
  const byIdentity = await findFirstUserByQueries([identity]);
  const byUnionid = unionid ? await findFirstUserByQueries([{ qq_unionid: unionid }]) : null;
  const conflicting = (user: Record<string, any>) =>
    (user.qq_unionid && unionid && user.qq_unionid !== unionid) ||
    (user[openidKey] && (user[openidKey] !== openid || (appidKey && user[appidKey] !== appId)));
  if (
    (byIdentity && byUnionid && String(byIdentity.data._id) !== String(byUnionid.data._id)) ||
    (byIdentity && conflicting(byIdentity.data)) ||
    (byUnionid && conflicting(byUnionid.data))
  ) {
    return { code: 409, success: false, message: 'QQ 账户关联冲突，请联系管理员', requestId };
  }

  // 资料仅来自已核验应用/身份的服务端请求；客户端资料与角色不参与身份写入。
  let profile: Record<string, unknown> = {};
  if (!mini) {
    const url =
      'https://graph.qq.com/user/get_user_info?' +
      new URLSearchParams({
        access_token: accessToken,
        oauth_consumer_key: appId,
        openid
      });
    const data = qqOAuthObject(await getQQOAuthBody(url, requestId));
    if (data?.ret === 0) profile = data;
  }
  const nickname =
    typeof profile.nickname === 'string' && profile.nickname.length <= 128 && !/[\x00-\x1f\x7f]/.test(profile.nickname)
      ? profile.nickname
      : '';
  const rawAvatar = profile.figureurl_qq_2 || profile.figureurl_2;
  let avatar = '';
  if (typeof rawAvatar === 'string' && rawAvatar.length <= 2048) {
    try {
      const url = new URL(rawAvatar);
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) avatar = url.href;
    } catch {
      /* 不接受不明确的头像地址。 */
    }
  }
  const overrides: Record<string, unknown> = {
    ...identity,
    ...(unionid ? { qq_unionid: unionid } : {}),
    ...(nickname ? { nickname } : {}),
    ...(avatar ? { avatar_url: avatar } : {})
  };
  const queries: Array<Record<string, unknown>> = unionid ? [{ qq_unionid: unionid }, identity] : [identity];
  const { user, isNewUser } = await findOrCreateUserByIdentity(queries, overrides, requestId, 'QQ');
  const userData = user.data as Record<string, any>;
  // 唯一索引争用后的回查也必须复核归属，不能覆盖冲突账户。
  if (!isNewUser && conflicting(userData)) {
    return { code: 409, success: false, message: 'QQ 账户关联冲突，请联系管理员', requestId };
  }
  if (!isNewUser) {
    const patch: Record<string, unknown> = { ...identity, updated_at: Date.now() };
    if (unionid && !userData.qq_unionid) patch.qq_unionid = unionid;
    if (nickname && String(userData.nickname || '').startsWith('考研学子')) patch.nickname = nickname;
    if (avatar && !userData.avatar_url) patch.avatar_url = avatar;
    await usersCollection.doc(String(userData._id)).update(patch);
    Object.assign(userData, patch);
  }
  const userId = String(userData._id);
  const token = generateJWT({ userId, qq_openid: openid, role: userData.role });
  const duration = Date.now() - startTime;
  logger.info(`[${requestId}] QQ登录成功，耗时: ${duration}ms`);
  return {
    code: 0,
    data: {
      userId,
      token,
      isNewUser,
      userInfo: {
        _id: userId,
        id: userId,
        nickname: userData.nickname,
        avatar_url: userData.avatar_url,
        role: userData.role,
        streak_days: userData.streak_days,
        total_study_days: userData.total_study_days,
        total_questions: userData.total_questions,
        correct_questions: userData.correct_questions,
        settings: userData.settings
      }
    },
    message: isNewUser ? '注册成功' : '登录成功',
    requestId,
    duration
  };
}

// ==================== 微信登录处理（原有逻辑） ====================
async function handleWechatLogin(ctx, requestId: string, startTime: number) {
  // 1. 参数校验（后端必须再校验一遍，不信任前端）
  const validation = validateLoginParams(ctx.body);

  if (!validation.valid) {
    logger.warn(`[${requestId}] 参数错误: ${validation.error}`);
    return {
      code: 400,
      success: false,
      message: `参数错误: ${validation.error}`,
      requestId
    };
  }

  const { code } = validation.sanitized;

  // 2. 环境变量检查
  if (!WX_APPID || !WX_SECRET) {
    logger.error(`[${requestId}] 缺少微信配置: WX_APPID=${!!WX_APPID}, WX_SECRET=${!!WX_SECRET}`);
    return {
      code: 500,
      success: false,
      message: '服务配置错误：缺少微信小程序配置（WX_APPID/WX_SECRET），请联系管理员',
      requestId
    };
  }

  // ✅ P0-2: 生产环境必须配置 JWT_SECRET
  if (!JWT_SECRET) {
    logger.error(`[${requestId}] 生产环境缺少 JWT_SECRET 配置`);
    return {
      code: 500,
      success: false,
      message: '服务配置错误：缺少 JWT 签名密钥，请联系管理员',
      requestId
    };
  }

  // 3. 调用微信接口获取 openid
  logger.info(`[${requestId}] 开始获取微信 openid...`);

  const wxLoginUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET}&js_code=${encodeURIComponent(code as string)}&grant_type=authorization_code`;

  const wxRes = await cloud.fetch({
    url: wxLoginUrl,
    method: 'GET',
    timeout: 10000
  });

  const wxData = wxRes.data;

  if (wxData.errcode) {
    logger.error(`[${requestId}] 微信登录失败:`, wxData);

    let errorMsg = wxData.errmsg;
    if (wxData.errcode === 40029) {
      errorMsg = 'code 无效，请重新获取';
    } else if (wxData.errcode === 45011) {
      errorMsg = '请求频率过高，请稍后再试';
    } else if (wxData.errcode === 40125) {
      errorMsg = 'AppSecret 配置错误';
    } else if (wxData.errcode === -1) {
      errorMsg = '微信服务繁忙，请稍后再试';
    }

    return {
      code: 401,
      success: false,
      message: `微信登录失败: ${errorMsg}`,
      errcode: wxData.errcode,
      requestId
    };
  }

  const { openid, session_key: _session_key, unionid } = wxData;

  if (!openid) {
    logger.error(`[${requestId}] 获取 openid 失败`);
    return {
      code: 401,
      success: false,
      message: '获取用户标识失败',
      requestId
    };
  }

  logger.info(`[${requestId}] 获取 openid 成功: ${openid.substring(0, 10)}...`);

  // 3. 查询或创建用户（并发安全：创建冲突后回查）
  const now = Date.now();
  const { user, isNewUser } = await findOrCreateUserByIdentity(
    [{ openid }, ...(unionid ? [{ unionid }] : [])],
    { openid, unionid: unionid || null },
    requestId,
    '微信'
  );
  const userData = user.data as Record<string, any>;

  if (!isNewUser) {
    await usersCollection.doc(String(userData._id)).update({
      updated_at: now,
      ...(unionid && !userData.unionid ? { unionid } : {})
    });

    logger.info(`[${requestId}] 老用户登录: ${String(userData._id)}`);
  }

  // 4. 生成 JWT token
  const userId = String(userData._id);
  const token = generateJWT({
    userId,
    openid,
    role: userData.role
  });

  const duration = Date.now() - startTime;
  logger.info(`[${requestId}] 登录成功，耗时: ${duration}ms`);

  return {
    code: 0,
    data: {
      userId,
      token,
      isNewUser,
      userInfo: {
        _id: userId,
        id: userId,
        nickname: userData.nickname,
        avatar_url: userData.avatar_url,
        role: userData.role,
        streak_days: userData.streak_days,
        total_study_days: userData.total_study_days,
        total_questions: userData.total_questions,
        correct_questions: userData.correct_questions,
        settings: userData.settings
      }
    },
    message: isNewUser ? '注册成功' : '登录成功',
    requestId,
    duration
  };
}

// ==================== 微信 OAuth：公众号网页 / 网站扫码 / 移动应用 ====================
function validOAuthIdentity(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value);
}

async function getWechatOAuthData(url: string, requestId: string): Promise<Record<string, any> | null> {
  try {
    const response = await cloud.fetch({
      url,
      method: 'GET',
      timeout: 10000,
      maxRedirects: 0,
      maxContentLength: 65536
    });
    if (
      response.status !== 200 ||
      !response.data ||
      typeof response.data !== 'object' ||
      Array.isArray(response.data)
    ) {
      return null;
    }
    return response.data;
  } catch {
    // 原生 HTTP 错误可能带含 secret/code/access_token 的 URL，不记录异常对象。
    logger.warn(`[${requestId}] 微信授权上游请求未完成`);
    return null;
  }
}

async function handleWechatOAuthLogin(ctx, requestId: string, startTime: number, platform: 'h5' | 'app' | 'website') {
  const validation = validateLoginParams(ctx.body);
  if (!validation.valid) {
    return { code: 400, success: false, message: validation.error, requestId };
  }
  const code = String(validation.sanitized!.code);
  const mobile = platform === 'app';
  const website = platform === 'website';
  const appId = mobile ? WX_MOBILE_APPID : website ? WX_WEB_APPID : WX_GZH_APPID;
  const secret = mobile ? WX_MOBILE_SECRET : website ? WX_WEB_SECRET : WX_GZH_SECRET;
  const label = mobile ? 'App微信' : website ? '网站微信' : 'H5微信';
  if (!appId || !secret) {
    return {
      code: 500,
      success: false,
      message: `服务配置错误：缺少微信${mobile ? '移动应用' : website ? '网站应用' : '公众号'}配置，请联系管理员`,
      requestId
    };
  }

  const tokenUrl =
    'https://api.weixin.qq.com/sns/oauth2/access_token?' +
    new URLSearchParams({
      appid: appId,
      secret,
      code,
      grant_type: 'authorization_code'
    }).toString();
  const tokenData = await getWechatOAuthData(tokenUrl, requestId);
  if (!tokenData) {
    return { code: 502, success: false, message: '微信授权服务暂不可用，请重试', requestId };
  }
  if (tokenData.errcode) {
    const errcode =
      Number.isSafeInteger(tokenData.errcode) && Math.abs(tokenData.errcode) <= 1000000 ? tokenData.errcode : undefined;
    const message =
      errcode === 40029
        ? '授权码无效或已过期，请重新授权'
        : errcode === 40163
          ? '授权码已被使用，请重新授权'
          : '微信授权失败，请重新登录';
    return { code: 401, success: false, message, ...(errcode === undefined ? {} : { errcode }), requestId };
  }
  const { access_token: accessToken, openid, unionid: tokenUnionid } = tokenData;
  if (
    typeof accessToken !== 'string' ||
    !/^[\x21-\x7e]{1,2048}$/.test(accessToken) ||
    !validOAuthIdentity(openid) ||
    (tokenUnionid !== undefined && !validOAuthIdentity(tokenUnionid))
  ) {
    return { code: 401, success: false, message: '获取微信用户标识失败', requestId };
  }

  const userInfoUrl =
    'https://api.weixin.qq.com/sns/userinfo?' +
    new URLSearchParams({
      access_token: accessToken,
      openid,
      lang: 'zh_CN'
    }).toString();
  const profile = await getWechatOAuthData(userInfoUrl, requestId);
  let wxUserInfo: Record<string, any> = {};
  if (profile && !profile.errcode) {
    if (
      profile.openid !== openid ||
      (profile.unionid !== undefined && !validOAuthIdentity(profile.unionid)) ||
      (tokenUnionid && profile.unionid && tokenUnionid !== profile.unionid)
    ) {
      return { code: 401, success: false, message: '微信授权身份不一致，请重新登录', requestId };
    }
    wxUserInfo = profile;
  }
  const unionid = tokenUnionid || wxUserInfo.unionid || null;
  const openidField = mobile ? 'app_openid' : website ? 'web_openid' : 'h5_openid';
  const appIdField = mobile ? 'wx_mobile_appid' : website ? 'wx_web_appid' : null;
  const identity = { [openidField]: openid, ...(appIdField ? { [appIdField]: appId } : {}) };
  const queries: Array<Record<string, unknown>> = unionid ? [{ unionid }, identity] : [identity];
  // 不把已经归属不同账户的供应商身份自动合并。
  const byIdentity = await findFirstUserByQueries([identity]);
  const byUnionid = unionid ? await findFirstUserByQueries([{ unionid }]) : null;
  if (
    (byIdentity?.data.unionid && unionid && byIdentity.data.unionid !== unionid) ||
    (byIdentity && byUnionid && String(byIdentity.data._id) !== String(byUnionid.data._id)) ||
    (byUnionid &&
      byUnionid.data[openidField] &&
      (!appIdField || byUnionid.data[appIdField] === appId) &&
      byUnionid.data[openidField] !== openid)
  ) {
    return { code: 409, success: false, message: '微信账户关联冲突，请联系管理员', requestId };
  }

  const nickname =
    typeof wxUserInfo.nickname === 'string' && !/[\x00-\x1f\x7f]/.test(wxUserInfo.nickname)
      ? wxUserInfo.nickname.slice(0, 128).trim()
      : '';
  let avatar = '';
  if (typeof wxUserInfo.headimgurl === 'string' && wxUserInfo.headimgurl.length <= 2048) {
    try {
      const url = new URL(wxUserInfo.headimgurl);
      if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) avatar = url.href;
    } catch {
      /* 头像不是有效网址时沿用已有值。 */
    }
  }
  // 无 unionid 时不存 null，使现有 sparse 唯一身份索引保持可用。
  const overrides: Record<string, unknown> = { ...identity, ...(unionid ? { unionid } : {}) };
  if (nickname) overrides.nickname = nickname;
  if (avatar) overrides.avatar_url = avatar;
  const existing = byIdentity || byUnionid;
  const { user, isNewUser } = existing
    ? { user: existing, isNewUser: false }
    : await findOrCreateUserByIdentity(queries, overrides, requestId, label);
  const userData = user.data as Record<string, any>;
  // 唯一键冲突后的回查也必须核对绑定，不能通过并发路径覆盖别人的身份。
  if (
    !isNewUser &&
    ((userData.unionid && unionid && userData.unionid !== unionid) ||
      (userData[openidField] && (!appIdField || userData[appIdField] === appId) && userData[openidField] !== openid))
  ) {
    return { code: 409, success: false, message: '微信账户关联冲突，请联系管理员', requestId };
  }
  if (!isNewUser) {
    const updateData: Record<string, unknown> = { ...identity, updated_at: Date.now() };
    if (unionid && !userData.unionid) updateData.unionid = unionid;
    if (nickname && String(userData.nickname || '').startsWith('考研学子')) updateData.nickname = nickname;
    if (avatar && !userData.avatar_url) updateData.avatar_url = avatar;
    await usersCollection.doc(String(userData._id)).update(updateData);
    Object.assign(userData, updateData);
  }

  const userId = String(userData._id);
  const token = generateJWT({ userId, ...identity, role: userData.role });
  const duration = Date.now() - startTime;
  logger.info(`[${requestId}] ${label}登录成功，耗时: ${duration}ms`);
  return {
    code: 0,
    data: {
      userId,
      token,
      isNewUser,
      userInfo: {
        _id: userId,
        id: userId,
        nickname: userData.nickname,
        avatar_url: userData.avatar_url || '',
        role: userData.role,
        streak_days: userData.streak_days,
        total_study_days: userData.total_study_days,
        total_questions: userData.total_questions,
        correct_questions: userData.correct_questions,
        settings: userData.settings
      }
    },
    message: isNewUser ? '注册成功' : '登录成功',
    requestId,
    duration
  };
}

/**
 * 生成 JWT Token
 * @param {Object} payload - 载荷数据
 * @returns {string} JWT token
 */
function generateJWT(payload) {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET 未配置，禁止签发 token');
  }

  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const now = Date.now();
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + JWT_EXPIRES_IN
  };

  const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64url');
  const payloadBase64 = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${headerBase64}.${payloadBase64}`)
    .digest('base64url');

  return `${headerBase64}.${payloadBase64}.${signature}`;
}

/**
 * 验证 JWT Token（供其他云函数使用）
 * @param {string} token - JWT token
 * @returns {Object|null} 解析后的载荷或 null
 */
export function verifyJWT(token) {
  return verifySharedJWT(token);
}
