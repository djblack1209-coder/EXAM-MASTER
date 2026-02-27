/**
 * 用户资料管理云函数
 * 支持更新用户昵称、头像等信息
 *
 * 功能：
 * 1. 获取用户资料 (get)
 * 2. 更新用户资料 (update)
 * 3. 上传头像 (upload_avatar) - v2.0新增
 * 4. 获取/更新练习模式配置 (get_practice_config / update_practice_config) - v2.0新增
 *
 * @author Exam-Master Team
 * @version 2.0.0
 * @date 2026-02-05
 */

import cloud from '@lafjs/cloud';

const db = cloud.database();

// ==================== 环境配置 ====================
import { createLogger, sanitizeString } from './_shared/api-response';
const JWT_SECRET_PLACEHOLDER

// 头像上传配置
const AVATAR_MAX_SIZE = 2 * 1024 * 1024; // 2MB
const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// ==================== 日志工具 ====================
const logger = createLogger('[UserProfile]');

// ==================== 访问控制工具 ====================
import crypto from 'crypto';

/**
 * 验证JWT Token并提取用户ID
 * @param token JWT token
 * @returns 用户ID或null
 */
function verifyTokenAndGetUserId(token: string): string | null {
  try {
    if (!token || !JWT_SECRET_PLACEHOLDER

    // 移除 Bearer 前缀
    const cleanToken = token.replace(/^Bearer\s+/i, '');

    const parts = cleanToken.split('.');
    if (parts.length !== 3) return null;

    const [headerBase64, payloadBase64, signature] = parts;

    // 验证签名
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET_PLACEHOLDER
      .update(`${headerBase64}.${payloadBase64}`)
      .digest('base64url');

    if (!crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expectedSignature, 'utf8'))) {
      logger.warn('JWT 签名验证失败');
      return null;
    }

    // 解析载荷
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());

    // 检查过期 — 必须包含 exp 声明，否则拒绝（与 login.ts verifyJWT 保持一致）
    if (!payload.exp) {
      logger.warn('JWT 缺少 exp 声明，拒绝验证');
      return null;
    }
    if (payload.exp < Date.now()) {
      logger.warn('JWT 已过期');
      return null;
    }

    return payload.userId || null;
  } catch (error) {
    logger.error('JWT 验证异常:', error);
    return null;
  }
}

/**
 * 验证用户访问权限
 * 确保用户只能访问自己的数据
 * @param ctx 请求上下文
 * @param targetUserId 目标用户ID
 * @returns 验证结果
 */
function verifyUserAccess(
  ctx: Record<string, unknown>,
  targetUserId: string
): { valid: boolean; error?: string; tokenUserId?: string } {
  // 从请求头获取token
  const authHeader = ctx.headers?.authorization || ctx.headers?.Authorization || '';

  if (!authHeader) {
    return { valid: false, error: '缺少认证信息' };
  }

  const tokenUserId = verifyTokenAndGetUserId(authHeader);

  if (!tokenUserId) {
    return { valid: false, error: '认证信息无效或已过期' };
  }

  // 验证用户只能访问自己的数据
  if (tokenUserId !== targetUserId) {
    logger.warn(`访问控制拦截: token用户=${tokenUserId}, 目标用户=${targetUserId}`);
    return { valid: false, error: '无权访问该用户数据' };
  }

  return { valid: true, tokenUserId };
}

interface UpdateProfileRequest {
  action: 'update' | 'get' | 'upload_avatar' | 'get_practice_config' | 'update_practice_config';
  userId: string;
  nickname?: string;
  avatar_url?: string;
  avatar_base64?: string; // Base64编码的头像数据
  avatar_type?: string; // 图片MIME类型
  target_school?: string;
  target_major?: string;
  practice_config?: PracticeConfig;
}

// 练习模式配置接口
interface PracticeConfig {
  default_mode?: 'normal' | 'exam' | 'review' | 'challenge';
  question_count?: number; // 每次练习题目数量
  time_limit?: number; // 时间限制（分钟）
  show_answer_immediately?: boolean; // 是否立即显示答案
  auto_next?: boolean; // 是否自动下一题
  shuffle_options?: boolean; // 是否打乱选项顺序
  difficulty_preference?: 'easy' | 'medium' | 'hard' | 'adaptive';
  categories?: string[]; // 偏好分类
  daily_goal?: number; // 每日目标题数
  reminder_enabled?: boolean; // 是否启用提醒
  reminder_time?: string; // 提醒时间 (HH:mm)
}

export default async function (ctx: FunctionContext) {
  const startTime = Date.now();
  const requestId = `UP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  logger.info(`[${requestId}] 用户资料请求开始`);

  try {
    const body = ctx.body as UpdateProfileRequest;
    const { action, userId } = body;

    // 参数校验
    if (!userId || typeof userId !== 'string' || userId.length > 64) {
      return {
        code: 400,
        success: false,
        message: '缺少用户ID或格式不正确',
        requestId
      };
    }

    // ==================== 访问控制检查 ====================
    // 对于敏感操作，验证用户只能访问自己的数据
    const sensitiveActions = ['get', 'get_practice_config', 'update', 'upload_avatar', 'update_practice_config'];
    if (sensitiveActions.includes(action)) {
      const accessCheck = verifyUserAccess(ctx, userId);
      if (!accessCheck.valid) {
        logger.warn(`[${requestId}] 访问控制拦截: ${accessCheck.error}`);
        return {
          code: 403,
          success: false,
          message: accessCheck.error || '无权执行此操作',
          requestId
        };
      }
      logger.info(`[${requestId}] 访问控制验证通过: ${accessCheck.tokenUserId}`);
    }

    // 路由到对应处理函数
    const handlers = {
      get: handleGetProfile,
      update: handleUpdateProfile,
      upload_avatar: handleUploadAvatar,
      get_practice_config: handleGetPracticeConfig,
      update_practice_config: handleUpdatePracticeConfig
    };

    const handler = handlers[action];
    if (!handler) {
      return {
        code: 400,
        success: false,
        message: '不支持的操作类型',
        requestId
      };
    }

    const result = await handler(body, requestId);

    return {
      ...result,
      requestId,
      duration: Date.now() - startTime
    };
  } catch (error) {
    logger.error(`[${requestId}] 用户资料操作异常:`, error);

    // P015: 错误分类，区分客户端错误和服务端错误
    const errMsg = error.message || '';
    let code = 500;
    let message = '服务器内部错误';

    if (errMsg.includes('not found') || errMsg.includes('不存在')) {
      code = 404;
      message = '用户不存在';
    } else if (errMsg.includes('validation') || errMsg.includes('参数') || errMsg.includes('invalid')) {
      code = 400;
      message = '请求参数错误';
    } else if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT')) {
      code = 504;
      message = '请求超时，请稍后重试';
    }

    return {
      code,
      success: false,
      message,
      requestId,
      duration: Date.now() - startTime
    };
  }
}

/**
 * 获取用户资料
 */
async function handleGetProfile(body: UpdateProfileRequest, requestId: string) {
  const { userId } = body;
  const usersCollection = db.collection('users');

  const user = await usersCollection.where({ _id: userId }).getOne();

  if (!user.data) {
    return {
      code: 404,
      success: false,
      message: '用户不存在'
    };
  }

  return {
    code: 0,
    success: true,
    data: {
      _id: user.data._id,
      nickname: user.data.nickname,
      avatar_url: user.data.avatar_url,
      target_school: user.data.target_school,
      target_major: user.data.target_major,
      practice_config: user.data.practice_config || getDefaultPracticeConfig()
    }
  };
}

/**
 * 更新用户资料
 */
async function handleUpdateProfile(body: UpdateProfileRequest, requestId: string) {
  const { userId, nickname, avatar_url, target_school, target_major } = body;
  const usersCollection = db.collection('users');

  // 构建更新数据
  const updateData: Record<string, any> = {
    updated_at: Date.now()
  };

  // 昵称更新（安全过滤）
  if (nickname !== undefined) {
    const sanitizedNickname = sanitizeString(nickname, 32);
    if (sanitizedNickname) {
      updateData.nickname = sanitizedNickname;
    }
  }

  // 头像更新（URL校验）
  if (avatar_url !== undefined) {
    const sanitizedAvatar = sanitizeString(avatar_url, 500);
    if (sanitizedAvatar && isValidUrl(sanitizedAvatar)) {
      updateData.avatar_url = sanitizedAvatar;
    }
  }

  // 目标院校更新
  if (target_school !== undefined) {
    updateData.target_school = sanitizeString(target_school, 50);
  }

  // 目标专业更新
  if (target_major !== undefined) {
    updateData.target_major = sanitizeString(target_major, 50);
  }

  // 检查是否有需要更新的字段
  if (Object.keys(updateData).length <= 1) {
    return {
      code: 400,
      success: false,
      message: '没有有效的更新字段'
    };
  }

  // 执行更新
  const result = await usersCollection.doc(userId).update(updateData);

  logger.info(`[${requestId}] 用户资料更新成功:`, {
    userId,
    updatedFields: Object.keys(updateData),
    result
  });

  // 同时更新排行榜中的昵称和头像（保持数据一致性）
  if (updateData.nickname || updateData.avatar_url) {
    try {
      const rankingsCollection = db.collection('rankings');
      const rankUpdateData: Record<string, any> = {};

      if (updateData.nickname) {
        rankUpdateData.nick_name = updateData.nickname;
      }
      if (updateData.avatar_url) {
        rankUpdateData.avatar_url = updateData.avatar_url;
      }

      await rankingsCollection.where({ uid: userId }).update(rankUpdateData);
      logger.info(`[${requestId}] 排行榜数据同步更新成功`);
    } catch (rankError) {
      logger.warn(`[${requestId}] 排行榜数据同步失败（非致命）:`, rankError);
    }
  }

  return {
    code: 0,
    success: true,
    message: '更新成功',
    data: updateData
  };
}

/**
 * 上传头像（Base64方式）
 *
 * 参数：
 * - avatar_base64: Base64编码的图片数据（不含data:前缀）
 * - avatar_type: 图片MIME类型，如 'image/jpeg'
 */
async function handleUploadAvatar(body: UpdateProfileRequest, requestId: string) {
  const { userId, avatar_base64, avatar_type } = body;

  // 1. 参数校验
  if (!avatar_base64 || typeof avatar_base64 !== 'string') {
    return {
      code: 400,
      success: false,
      message: '缺少头像数据'
    };
  }

  if (!avatar_type || !AVATAR_ALLOWED_TYPES.includes(avatar_type)) {
    return {
      code: 400,
      success: false,
      message: `不支持的图片格式，仅支持: ${AVATAR_ALLOWED_TYPES.join(', ')}`
    };
  }

  // 2. 检查文件大小
  const base64Data = avatar_base64.replace(/^data:image\/\w+;base64,/, '');
  const fileSize = Buffer.from(base64Data, 'base64').length;

  if (fileSize > AVATAR_MAX_SIZE) {
    return {
      code: 400,
      success: false,
      message: `头像文件过大，最大支持 ${AVATAR_MAX_SIZE / 1024 / 1024}MB`
    };
  }

  // 3. 生成文件名和存储路径
  const fileExt = avatar_type.split('/')[1] || 'jpg';
  const fileName = `avatars/${userId}_${Date.now()}.${fileExt}`;

  try {
    // 4. 上传到云存储
    const bucket = cloud.storage.bucket();
    const buffer = Buffer.from(base64Data, 'base64');

    await bucket.writeFile(fileName, buffer, {
      ContentType: avatar_type
    });

    // 5. 获取公开访问URL
    const avatarUrl = await bucket.getFileUrl(fileName);

    // 6. 更新用户头像URL
    const usersCollection = db.collection('users');
    await usersCollection.doc(userId).update({
      avatar_url: avatarUrl,
      updated_at: Date.now()
    });

    // 7. 同步更新排行榜
    try {
      const rankingsCollection = db.collection('rankings');
      await rankingsCollection.where({ uid: userId }).update({
        avatar_url: avatarUrl
      });
    } catch (e) {
      logger.warn(`[${requestId}] 排行榜头像同步失败（非致命）`);
    }

    logger.info(`[${requestId}] 头像上传成功: ${fileName}`);

    return {
      code: 0,
      success: true,
      message: '头像上传成功',
      data: {
        avatar_url: avatarUrl,
        file_name: fileName,
        file_size: fileSize
      }
    };
  } catch (error) {
    logger.error(`[${requestId}] 头像上传失败:`, error);
    return {
      code: 500,
      success: false,
      message: '头像上传失败，请重试'
    };
  }
}

/**
 * 获取练习模式配置
 */
async function handleGetPracticeConfig(body: UpdateProfileRequest, requestId: string) {
  const { userId } = body;
  const usersCollection = db.collection('users');

  const user = await usersCollection.where({ _id: userId }).getOne();

  if (!user.data) {
    return {
      code: 404,
      success: false,
      message: '用户不存在'
    };
  }

  const config = user.data.practice_config || getDefaultPracticeConfig();

  return {
    code: 0,
    success: true,
    data: config
  };
}

/**
 * 更新练习模式配置
 */
async function handleUpdatePracticeConfig(body: UpdateProfileRequest, requestId: string) {
  const { userId, practice_config } = body;

  if (!practice_config || typeof practice_config !== 'object') {
    return {
      code: 400,
      success: false,
      message: '缺少练习配置数据'
    };
  }

  // 校验并清理配置
  const sanitizedConfig = sanitizePracticeConfig(practice_config);

  const usersCollection = db.collection('users');
  await usersCollection.doc(userId).update({
    practice_config: sanitizedConfig,
    updated_at: Date.now()
  });

  logger.info(`[${requestId}] 练习配置更新成功: ${userId}`);

  return {
    code: 0,
    success: true,
    message: '练习配置更新成功',
    data: sanitizedConfig
  };
}

/**
 * 获取默认练习配置
 */
function getDefaultPracticeConfig(): PracticeConfig {
  return {
    default_mode: 'normal',
    question_count: 20,
    time_limit: 30,
    show_answer_immediately: true,
    auto_next: false,
    shuffle_options: false,
    difficulty_preference: 'adaptive',
    categories: [],
    daily_goal: 50,
    reminder_enabled: false,
    reminder_time: '20:00'
  };
}

/**
 * 校验并清理练习配置
 */
function sanitizePracticeConfig(config: unknown): PracticeConfig {
  const defaults = getDefaultPracticeConfig();
  const validModes = ['normal', 'exam', 'review', 'challenge'];
  const validDifficulties = ['easy', 'medium', 'hard', 'adaptive'];

  return {
    default_mode: validModes.includes(config.default_mode) ? config.default_mode : defaults.default_mode,
    question_count: Math.min(Math.max(parseInt(config.question_count) || defaults.question_count, 5), 100),
    time_limit: Math.min(Math.max(parseInt(config.time_limit) || defaults.time_limit, 5), 180),
    show_answer_immediately:
      typeof config.show_answer_immediately === 'boolean'
        ? config.show_answer_immediately
        : defaults.show_answer_immediately,
    auto_next: typeof config.auto_next === 'boolean' ? config.auto_next : defaults.auto_next,
    shuffle_options: typeof config.shuffle_options === 'boolean' ? config.shuffle_options : defaults.shuffle_options,
    difficulty_preference: validDifficulties.includes(config.difficulty_preference)
      ? config.difficulty_preference
      : defaults.difficulty_preference,
    categories: Array.isArray(config.categories)
      ? config.categories.slice(0, 10).map((c) => sanitizeString(c, 20))
      : defaults.categories,
    daily_goal: Math.min(Math.max(parseInt(config.daily_goal) || defaults.daily_goal, 10), 500),
    reminder_enabled:
      typeof config.reminder_enabled === 'boolean' ? config.reminder_enabled : defaults.reminder_enabled,
    reminder_time: /^\d{2}:\d{2}$/.test(config.reminder_time) ? config.reminder_time : defaults.reminder_time
  };
}

/**
 * URL格式校验
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
