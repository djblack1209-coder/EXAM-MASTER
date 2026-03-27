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
 * - WX_SECRET_PLACEHOLDER
 * - QQ_APPID: QQ互联/QQ小程序 AppID
 * - QQ_SECRET: QQ互联/QQ小程序密钥
 * - QQ_REDIRECT_URI: QQ H5 OAuth 回调地址（可选，建议配置）
 * - JWT_SECRET_PLACEHOLDER
 *
 * 请求参数：
 * - type: string (可选) - 登录类型: 'wechat'(默认) | 'wechat_h5' | 'qq' | 'email'
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
const logger = createLogger('[Login]');

// ==================== 环境变量配置 ====================
// 重要：请确保在后端控制台配置了正确的环境变量
// 安全提示：敏感信息必须通过环境变量配置，禁止硬编码
const WX_APPID = process.env.WX_APPID || '';
const WX_SECRET_PLACEHOLDER
// E007: 微信公众号配置（H5网页授权）
const WX_GZH_APPID = process.env.WX_GZH_APPID || '';
const SECRET_PLACEHOLDER
// QQ 登录配置（H5/App/QQ小程序）
const QQ_APPID = process.env.QQ_APPID || '';
const SECRET_PLACEHOLDER
const QQ_REDIRECT_URI = process.env.QQ_REDIRECT_URI || '';
// ✅ B017: JWT_SECRET_PLACEHOLDER
const JWT_SECRET_PLACEHOLDER
if (!process.env.JWT_SECRET_PLACEHOLDER
  // 避免模块加载阶段抛错导致所有依赖 verifyJWT 的云函数无法启动
  logger.error('❌ 严重安全警告：JWT_SECRET_PLACEHOLDER
}
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000; // 7天

// ==================== 环境变量完整性检查 ====================
const ENV_CHECK_RESULTS: { key: string; present: boolean }[] = [
  { key: 'WX_APPID', present: !!process.env.WX_APPID },
  { key: 'WX_SECRET_PLACEHOLDER
  { key: 'QQ_APPID', present: !!process.env.QQ_APPID },
  { key: 'QQ_SECRET', present: !!process.env.QQ_SECRET },
  { key: 'JWT_SECRET_PLACEHOLDER
  { key: 'WX_GZH_APPID', present: !!process.env.WX_GZH_APPID },
  { key: 'WX_GZH_SECRET', present: !!process.env.WX_GZH_SECRET }
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
  logger.info(`[${requestId}] ${label}新用户创建成功: ${insertRes.id}`);
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
    if (!JWT_SECRET_PLACEHOLDER
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
      logger.warn(`[${requestId}] 登录频率限制触发: IP=${clientIp}`);
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

    if (loginType === 'email') {
      return await handleEmailLogin(ctx, requestId, startTime);
    } else if (loginType === 'qq') {
      return await handleQQLogin(ctx, requestId, startTime);
    } else if (loginType === 'wechat_h5') {
      // E007: H5微信浏览器 OAuth 网页授权登录
      return await handleWechatH5Login(ctx, requestId, startTime);
    } else {
      return await handleWechatLogin(ctx, requestId, startTime);
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    endPerf({ error: true });
    logger.error(`[${requestId}] 登录异常:`, error);

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
      logger.warn(`[${requestId}] 验证码暴力破解拦截: email=${email}, failures=${recentFailures.total}`);
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

    logger.info(`[${requestId}] 验证码校验通过: ${email}`);
    return { valid: true };
  } catch (e) {
    logger.error(`[${requestId}] 验证码校验异常:`, e);
    return { valid: false, error: '验证码校验失败' };
  }
}

function parseQueryStringPayload(raw: string): Record<string, string> {
  if (!raw || typeof raw !== 'string') return {};
  const normalized = raw.trim().replace(/^\?/, '');
  return Object.fromEntries(new URLSearchParams(normalized).entries());
}

function parseQQCallbackPayload(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'string') return null;

  const match = raw.match(/callback\s*\(\s*(\{[\s\S]*\})\s*\)\s*;?/);
  const candidate = match?.[1] || raw;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function resolveQQRedirectUri(ctx: any, bodyRedirectUri: unknown): string {
  if (typeof bodyRedirectUri === 'string' && /^https?:\/\//.test(bodyRedirectUri)) {
    return bodyRedirectUri;
  }

  if (QQ_REDIRECT_URI && /^https?:\/\//.test(QQ_REDIRECT_URI)) {
    return QQ_REDIRECT_URI;
  }

  const origin = ctx.headers?.origin || ctx.headers?.Origin;
  if (typeof origin === 'string' && /^https?:\/\//.test(origin)) {
    return `${origin.replace(/\/$/, '')}/#/pages/login/qq-callback`;
  }

  return '';
}

async function handleQQLogin(ctx, requestId: string, startTime: number) {
  const { code, accessToken, openid: requestOpenid, platform, redirectUri, userInfo: clientUserInfo } = ctx.body || {};

  if (!QQ_APPID) {
    logger.error(`[${requestId}] 缺少 QQ 配置: QQ_APPID=${!!QQ_APPID}`);
    return {
      code: 500,
      success: false,
      message: '服务配置错误：缺少 QQ 配置，请联系管理员',
      requestId
    };
  }

  if (!JWT_SECRET_PLACEHOLDER
    return { code: 500, success: false, message: '服务配置错误：缺少 JWT 签名密钥', requestId };
  }

  const normalizedPlatform = typeof platform === 'string' ? platform : '';
  const normalizedCode = typeof code === 'string' ? code.trim() : '';
  const normalizedAccessToken = typeof accessToken === 'string' ? accessToken.trim() : '';
  const normalizedRequestOpenid = typeof requestOpenid === 'string' ? requestOpenid.trim() : '';

  if (!normalizedAccessToken && !normalizedCode) {
    return { code: 400, success: false, message: 'QQ 登录参数不完整：缺少 code 或 accessToken', requestId };
  }

  let qqOpenid = '';
  let qqUnionid = '';
  let qqAccessToken = normalizedAccessToken;

  // QQ 小程序登录（code -> openid）
  if (normalizedPlatform === 'mp-qq') {
    if (!QQ_SECRET) {
      return {
        code: 500,
        success: false,
        message: '服务配置错误：缺少 QQ_SECRET，请联系管理员',
        requestId
      };
    }

    if (!normalizedCode || normalizedCode.length < 6 || normalizedCode.length > 200) {
      return { code: 400, success: false, message: 'QQ 登录 code 无效', requestId };
    }

    const qqMiniLoginUrl =
      'https://api.q.qq.com/sns/jscode2session' +
      `?appid=${QQ_APPID}` +
      `&secret=${QQ_SECRET}` +
      `&js_code=${normalizedCode}` +
      '&grant_type=authorization_code';

    const miniRes = await cloud.fetch({
      url: qqMiniLoginUrl,
      method: 'GET',
      timeout: 10000
    });

    const miniData = miniRes.data || {};
    if (miniData.errcode) {
      logger.error(`[${requestId}] QQ小程序登录失败:`, miniData);
      return {
        code: 401,
        success: false,
        message: miniData.errmsg || 'QQ 登录失败，请重新获取授权码',
        errcode: miniData.errcode,
        requestId
      };
    }

    qqOpenid = miniData.openid || '';
    qqUnionid = miniData.unionid || '';
    if (!qqOpenid) {
      return { code: 401, success: false, message: '获取 QQ 用户标识失败', requestId };
    }
  } else {
    // H5 / App 登录：有 accessToken 直接校验，无 accessToken 则通过 code 交换
    if (!qqAccessToken) {
      if (!QQ_SECRET) {
        return {
          code: 500,
          success: false,
          message: '服务配置错误：缺少 QQ_SECRET，请联系管理员',
          requestId
        };
      }

      if (!normalizedCode || normalizedCode.length < 6 || normalizedCode.length > 200) {
        return { code: 400, success: false, message: 'QQ 授权码无效', requestId };
      }

      const finalRedirectUri = resolveQQRedirectUri(ctx, redirectUri);
      if (!finalRedirectUri) {
        return {
          code: 400,
          success: false,
          message: '缺少 QQ 回调地址，请检查 QQ_REDIRECT_URI 配置',
          requestId
        };
      }

      const tokenUrl =
        'https://graph.qq.com/oauth2.0/token' +
        '?grant_type=authorization_code' +
        `&client_id=${QQ_APPID}` +
        `&client_secret=${QQ_SECRET}` +
        `&code=${encodeURIComponent(normalizedCode)}` +
        `&redirect_uri=${encodeURIComponent(finalRedirectUri)}`;

      const tokenRes = await cloud.fetch({
        url: tokenUrl,
        method: 'GET',
        timeout: 10000
      });

      const tokenRaw = typeof tokenRes.data === 'string' ? tokenRes.data : '';
      const tokenErrorPayload = parseQQCallbackPayload(tokenRaw);
      if (tokenErrorPayload?.error) {
        logger.error(`[${requestId}] QQ token 交换失败:`, tokenErrorPayload);
        return {
          code: 401,
          success: false,
          message: String(tokenErrorPayload.error_description || tokenErrorPayload.error || 'QQ 授权失败，请重新登录'),
          requestId
        };
      }

      const tokenParams = parseQueryStringPayload(tokenRaw);
      qqAccessToken = tokenParams.access_token || '';
      if (!qqAccessToken) {
        logger.error(`[${requestId}] QQ token 返回异常:`, tokenRes.data);
        return {
          code: 401,
          success: false,
          message: 'QQ 授权失败，请重新登录',
          requestId
        };
      }
    }

    const meUrl = `https://graph.qq.com/oauth2.0/me?access_token=${encodeURIComponent(qqAccessToken)}&unionid=1`;
    const meRes = await cloud.fetch({
      url: meUrl,
      method: 'GET',
      timeout: 10000
    });

    let mePayload: Record<string, unknown> | null = null;
    if (typeof meRes.data === 'string') {
      mePayload = parseQQCallbackPayload(meRes.data);
    } else if (meRes.data && typeof meRes.data === 'object') {
      mePayload = meRes.data;
    }

    if (!mePayload || mePayload.error) {
      logger.error(`[${requestId}] QQ openid 解析失败:`, meRes.data);
      return {
        code: 401,
        success: false,
        message: String(mePayload?.error_description || mePayload?.error || 'QQ 登录校验失败，请重试'),
        requestId
      };
    }

    qqOpenid = String(mePayload.openid || '');
    qqUnionid = String(mePayload.unionid || '');

    if (!qqOpenid) {
      return { code: 401, success: false, message: '获取 QQ 用户标识失败', requestId };
    }

    if (normalizedRequestOpenid && normalizedRequestOpenid !== qqOpenid) {
      logger.warn(`[${requestId}] QQ openid 不匹配，拒绝登录`);
      return { code: 401, success: false, message: 'QQ 登录校验失败，请重试', requestId };
    }
  }

  // 拉取 QQ 头像/昵称（若可用）
  let qqUserInfo: Record<string, unknown> = {};
  if (qqAccessToken && qqOpenid) {
    try {
      const userInfoUrl =
        'https://graph.qq.com/user/get_user_info' +
        `?access_token=${encodeURIComponent(qqAccessToken)}` +
        `&oauth_consumer_key=${QQ_APPID}` +
        `&openid=${encodeURIComponent(qqOpenid)}`;

      const userInfoRes = await cloud.fetch({ url: userInfoUrl, method: 'GET', timeout: 10000 });
      if (userInfoRes.data?.ret === 0) {
        qqUserInfo = userInfoRes.data;
      } else {
        logger.warn(`[${requestId}] 获取 QQ 用户信息失败:`, userInfoRes.data);
      }
    } catch (e) {
      logger.warn(`[${requestId}] 获取 QQ 用户信息异常:`, e?.message || e);
    }
  }

  // APP/MP 端可回传有限用户信息，作为补充兜底
  if (!qqUserInfo.nickname && clientUserInfo && typeof clientUserInfo === 'object') {
    if (typeof clientUserInfo.nickname === 'string') {
      qqUserInfo.nickname = clientUserInfo.nickname;
    }
    if (typeof clientUserInfo.avatarUrl === 'string') {
      qqUserInfo.figureurl_qq_2 = clientUserInfo.avatarUrl;
    }
  }

  logger.info(`[${requestId}] QQ openid: ${qqOpenid.substring(0, 10)}...`);

  // 查询或创建用户（并发安全：创建冲突后回查）
  const now = Date.now();
  const overrides: Record<string, unknown> = {
    qq_openid: qqOpenid,
    qq_unionid: qqUnionid || null
  };

  if (qqUserInfo.nickname) {
    overrides.nickname = qqUserInfo.nickname;
  }

  const avatar =
    (typeof qqUserInfo.figureurl_qq_2 === 'string' && qqUserInfo.figureurl_qq_2) ||
    (typeof qqUserInfo.figureurl_2 === 'string' && qqUserInfo.figureurl_2) ||
    '';
  if (avatar) {
    overrides.avatar_url = avatar;
  }

  const qqQueries: Array<Record<string, unknown>> = [];
  if (qqUnionid) {
    qqQueries.push({ qq_unionid: qqUnionid });
  }
  qqQueries.push({ qq_openid: qqOpenid });
  const { user, isNewUser } = await findOrCreateUserByIdentity(qqQueries, overrides, requestId, 'QQ');
  const userData = user.data as Record<string, any>;

  if (!isNewUser) {
    const updateData: Record<string, unknown> = {
      updated_at: now,
      qq_openid: qqOpenid
    };

    if (qqUnionid && !userData.qq_unionid) {
      updateData.qq_unionid = qqUnionid;
    }

    if (qqUserInfo.nickname && String(userData.nickname || '').startsWith('考研学子')) {
      updateData.nickname = qqUserInfo.nickname;
    }

    const avatar =
      (typeof qqUserInfo.figureurl_qq_2 === 'string' && qqUserInfo.figureurl_qq_2) ||
      (typeof qqUserInfo.figureurl_2 === 'string' && qqUserInfo.figureurl_2) ||
      '';
    if (avatar && !userData.avatar_url) {
      updateData.avatar_url = avatar;
    }

    await usersCollection.doc(String(userData._id)).update(updateData);
    logger.info(`[${requestId}] QQ老用户登录: ${String(userData._id)}`);
  }

  const userId = String(userData._id);
  const token = generateJWT({ userId, qq_openid: qqOpenid, role: userData.role });

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
  if (!WX_APPID || !WX_SECRET_PLACEHOLDER
    logger.error(`[${requestId}] 缺少微信配置: WX_APPID=${!!WX_APPID}, WX_SECRET_PLACEHOLDER
    return {
      code: 500,
      success: false,
      message: '服务配置错误：缺少微信小程序配置（WX_APPID/WX_SECRET_PLACEHOLDER
      requestId
    };
  }

  // ✅ P0-2: 生产环境必须配置 JWT_SECRET_PLACEHOLDER
  if (!JWT_SECRET_PLACEHOLDER
    logger.error(`[${requestId}] 生产环境缺少 JWT_SECRET_PLACEHOLDER
    return {
      code: 500,
      success: false,
      message: '服务配置错误：缺少 JWT 签名密钥，请联系管理员',
      requestId
    };
  }

  // 3. 调用微信接口获取 openid
  logger.info(`[${requestId}] 开始获取微信 openid...`);

  const wxLoginUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET_PLACEHOLDER

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

// ==================== E007: H5微信浏览器 OAuth 网页授权登录 ====================
/**
 * 微信公众号网页授权登录（H5环境，用户在微信内置浏览器中访问）
 * 流程：前端跳转微信授权页 -> 用户同意 -> 回调页拿到 code -> 调用此接口
 * 后端用 code 换 access_token + openid，再获取用户信息
 */
async function handleWechatH5Login(ctx, requestId: string, startTime: number) {
  const { code } = ctx.body || {};

  // 1. 参数校验
  if (!code || typeof code !== 'string') {
    return { code: 400, success: false, message: 'code 不能为空', requestId };
  }

  // 2. 环境变量检查
  if (!WX_GZH_APPID || !WX_GZH_SECRET) {
    logger.error(`[${requestId}] 缺少微信公众号配置: WX_GZH_APPID=${!!WX_GZH_APPID}, SECRET_PLACEHOLDER
    return {
      code: 500,
      success: false,
      message: '服务配置错误：缺少微信公众号配置，请联系管理员',
      requestId
    };
  }

  if (!JWT_SECRET_PLACEHOLDER
    return { code: 500, success: false, message: '服务配置错误：缺少 JWT 签名密钥', requestId };
  }

  // 3. 用 code 换取 access_token 和 openid
  logger.info(`[${requestId}] H5微信登录：开始换取 access_token...`);

  const tokenUrl =
    'https://api.weixin.qq.com/sns/oauth2/access_token' +
    `?appid=${WX_GZH_APPID}` +
    `&secret=${WX_GZH_SECRET}` +
    `&code=${code}` +
    '&grant_type=authorization_code';

  const tokenRes = await cloud.fetch({ url: tokenUrl, method: 'GET', timeout: 10000 });
  const tokenData = tokenRes.data;

  if (tokenData.errcode) {
    logger.error(`[${requestId}] H5微信 access_token 获取失败:`, tokenData);
    let errorMsg = tokenData.errmsg || '微信授权失败';
    if (tokenData.errcode === 40029) errorMsg = '授权码无效或已过期，请重新授权';
    if (tokenData.errcode === 40163) errorMsg = '授权码已被使用，请重新授权';
    return { code: 401, success: false, message: errorMsg, errcode: tokenData.errcode, requestId };
  }

  const { access_token, openid, unionid: tokenUnionid } = tokenData;

  if (!access_token || !openid) {
    logger.error(`[${requestId}] H5微信返回数据不完整:`, tokenData);
    return { code: 401, success: false, message: '获取微信用户标识失败', requestId };
  }

  // 4. 用 access_token 获取用户信息
  let wxUserInfo: Record<string, unknown> = {};
  try {
    const userInfoUrl =
      'https://api.weixin.qq.com/sns/userinfo' + `?access_token=${access_token}` + `&openid=${openid}` + '&lang=zh_CN';

    const userInfoRes = await cloud.fetch({ url: userInfoUrl, method: 'GET', timeout: 10000 });
    if (!userInfoRes.data?.errcode) {
      wxUserInfo = userInfoRes.data;
    } else {
      logger.warn(`[${requestId}] 获取微信用户信息失败:`, userInfoRes.data);
    }
  } catch (e) {
    logger.warn(`[${requestId}] 获取微信用户信息异常:`, e.message);
  }

  logger.info(`[${requestId}] H5微信 openid: ${openid.substring(0, 10)}...`);

  // 5. 查询或创建用户（并发安全：创建冲突后回查）
  const unionid = tokenUnionid || wxUserInfo.unionid || null;
  const now = Date.now();
  const overrides: Record<string, unknown> = {
    h5_openid: openid,
    unionid: unionid
  };
  if (wxUserInfo.nickname) overrides.nickname = wxUserInfo.nickname;
  if (wxUserInfo.headimgurl) overrides.avatar_url = wxUserInfo.headimgurl;

  const h5Queries: Array<Record<string, unknown>> = [];
  if (unionid) {
    h5Queries.push({ unionid });
  }
  h5Queries.push({ h5_openid: openid });
  const { user, isNewUser } = await findOrCreateUserByIdentity(h5Queries, overrides, requestId, 'H5微信');
  const userData = user.data as Record<string, any>;

  if (!isNewUser) {
    // 老用户，更新信息
    const updateData: Record<string, unknown> = { updated_at: now, h5_openid: openid };
    if (unionid && !userData.unionid) updateData.unionid = unionid;
    // [v1.2.0 修复] 运算符优先级 bug：!x === false 永远不会触发更新
    // 修复：当用户仍是默认昵称（考研学子xxx）时，用微信昵称覆盖
    if (wxUserInfo.nickname && String(userData.nickname || '').startsWith('考研学子')) {
      updateData.nickname = wxUserInfo.nickname;
    }
    if (wxUserInfo.headimgurl && !userData.avatar_url) {
      updateData.avatar_url = wxUserInfo.headimgurl;
    }
    await usersCollection.doc(String(userData._id)).update(updateData);
    logger.info(`[${requestId}] H5微信老用户登录: ${String(userData._id)}`);
  }

  // 6. 生成 JWT
  const userId = String(userData._id);
  const token = generateJWT({ userId, h5_openid: openid, role: userData.role });

  const duration = Date.now() - startTime;
  logger.info(`[${requestId}] H5微信登录成功，耗时: ${duration}ms`);

  return {
    code: 0,
    data: {
      userId,
      token,
      isNewUser,
      userInfo: {
        _id: userId,
        id: userId,
        nickname: userData.nickname || wxUserInfo.nickname,
        avatar_url: userData.avatar_url || wxUserInfo.headimgurl || '',
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
  if (!JWT_SECRET_PLACEHOLDER
    throw new Error('JWT_SECRET_PLACEHOLDER
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
    .createHmac('sha256', JWT_SECRET_PLACEHOLDER
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
