/**
 * 头像上传云函数
 *
 * 功能：
 * 1. 接收用户上传的头像图片
 * 2. 验证图片格式和大小
 * 3. 存储到云存储
 * 4. 更新用户头像URL
 * 5. 返回头像访问地址
 *
 * 请求方式：POST (multipart/form-data)
 *
 * 请求参数：
 * - file: File (必填) - 头像图片文件
 * - userId: string (可选) - 用户ID（实际以 JWT 为准）
 * - type: string (可选) - 上传类型，默认 'avatar'
 *
 * 返回格式：
 * { code: 0, success: true, data: { url: '...' }, message: 'success' }
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import fs from 'fs';
import { verifyJWT } from './login';
import { logger, success, badRequest, unauthorized, serverError, generateRequestId } from './_shared/api-response';
import { extractBearerToken } from './_shared/auth';

const db = cloud.database();

// ==================== 环境配置 ====================

// 允许的图片格式
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
// 最大文件大小 (2MB)
const MAX_FILE_SIZE = 2 * 1024 * 1024;
// 头像存储目录
const AVATAR_DIR = 'avatars';

// ==================== 主函数 ====================
export default async function (ctx: FunctionContext) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  try {
    // 获取请求方法
    const method = ctx.method?.toUpperCase();

    // 只允许 POST 请求
    if (method !== 'POST') {
      return { ...badRequest('只支持 POST 请求'), requestId };
    }

    // 获取上传的文件（兼容不同 runtime 的 multipart 结构）
    const file = resolveUploadedFile(ctx.files);
    if (!file) {
      return { ...badRequest('请选择要上传的图片'), requestId };
    }

    // 获取用户ID
    const bodyUserId = ctx.body?.userId || ctx.query?.userId;

    // JWT 认证：头像上传必须验证身份
    const rawHeaderToken = ctx.headers?.['authorization'] || ctx.headers?.Authorization;
    const token = extractBearerToken(rawHeaderToken);
    let userId = bodyUserId;

    if (!token) {
      return { ...unauthorized('请先登录'), requestId };
    }
    const payload = verifyJWT(token);
    if (!payload || !payload.userId) {
      return { ...unauthorized('登录已过期，请重新登录'), requestId };
    }
    // 使用 token 中的 userId，防止伪造
    userId = payload.userId;

    if (!userId) {
      return { ...badRequest('缺少用户ID'), requestId };
    }

    // 验证用户ID格式
    if (typeof userId !== 'string' || userId.length < 1 || userId.length > 100) {
      return { ...badRequest('用户ID格式无效'), requestId };
    }

    // 验证文件类型
    const mimeType = normalizeMimeType(file);
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      return { ...badRequest('不支持的图片格式，请上传 JPG、PNG、GIF 或 WebP 格式'), requestId };
    }

    // 验证文件大小
    const fileSize = Number(file.size || 0);
    if (fileSize > MAX_FILE_SIZE) {
      return { ...badRequest(`图片大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`), requestId };
    }

    logger.info(`开始处理头像上传: userId=${userId}, size=${fileSize}, type=${mimeType}`);

    // 生成文件名
    const ext = getExtension(mimeType);
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = `${AVATAR_DIR}/${userId}_${timestamp}_${randomStr}.${ext}`;

    // 上传到云存储
    let avatarUrl: string;

    try {
      // 使用 Laf 云存储
      const bucket: any = cloud.storage.bucket('default');

      // 读取文件内容
      const fileBuffer = await readFileBuffer(file);

      // 上传文件
      await bucket.putObject(fileName, fileBuffer, {
        ContentType: mimeType
      });

      // 获取文件访问URL
      avatarUrl = await bucket.getObjectUrl(fileName);

      logger.info(`头像上传成功: ${avatarUrl}`);
    } catch (uploadError: unknown) {
      logger.error('云存储上传失败:', uploadError);

      // 备选方案：使用 Base64 存储到数据库
      try {
        const fileBuffer = await readFileBuffer(file);
        const base64Data = fileBuffer.toString('base64');
        avatarUrl = `data:${mimeType};base64,${base64Data}`;

        logger.info('使用 Base64 存储头像');
      } catch (base64Error) {
        logger.error('Base64 转换失败:', base64Error);
        return { ...serverError('头像上传失败，请稍后重试'), requestId };
      }
    }

    // 更新用户头像
    try {
      const usersCollection = db.collection('users');

      // 查找用户
      const userResult = await usersCollection.where({ _id: userId }).getOne();

      if (userResult.data) {
        // 更新现有用户
        await usersCollection.where({ _id: userId }).update({
          avatar_url: avatarUrl,
          avatarUrl: avatarUrl,
          updated_at: Date.now()
        });

        logger.info(`用户头像已更新: userId=${userId}`);
      } else {
        // 尝试通过 openid 查找
        const openidResult = await usersCollection.where({ openid: userId }).getOne();

        if (openidResult.data) {
          await usersCollection.where({ openid: userId }).update({
            avatar_url: avatarUrl,
            avatarUrl: avatarUrl,
            updated_at: Date.now()
          });

          logger.info(`用户头像已更新 (by openid): userId=${userId}`);
        } else {
          logger.warn(`用户不存在，仅返回头像URL: userId=${userId}`);
        }
      }
    } catch (dbError: unknown) {
      // 数据库更新失败不影响返回结果
      logger.warn('更新用户头像记录失败:', (dbError as Error).message);
    }

    const duration = Date.now() - startTime;
    logger.info(`头像上传完成，耗时: ${duration}ms`);

    return success(
      {
        url: avatarUrl,
        avatarUrl: avatarUrl,
        avatar_url: avatarUrl,
        fileName: fileName,
        size: fileSize,
        type: mimeType
      },
      '头像上传成功'
    );
  } catch (err: unknown) {
    logger.error('头像上传异常:', err);
    const duration = Date.now() - startTime;
    return { ...serverError('服务器内部错误'), requestId, duration };
  }
}

// ==================== 工具函数 ====================

/**
 * 根据 MIME 类型获取文件扩展名
 */
function getExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp'
  };
  return mimeToExt[mimeType] || 'jpg';
}

/**
 * 读取文件 Buffer
 */
async function readFileBuffer(file: Record<string, unknown>): Promise<Buffer> {
  const rawBuffer = file.buffer;
  if (Buffer.isBuffer(rawBuffer)) {
    return rawBuffer;
  }

  if (rawBuffer instanceof Uint8Array) {
    return Buffer.from(rawBuffer);
  }

  if (typeof file.content === 'string') {
    return Buffer.from(file.content, 'base64');
  }

  if (file.path) {
    return fs.readFileSync(file.path as string);
  }

  const streamAny = file.stream as any;
  if (streamAny && typeof streamAny[Symbol.asyncIterator] === 'function') {
    const stream = streamAny as AsyncIterable<Buffer | Uint8Array>;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  throw new Error('无法读取文件内容');
}

function toFileLike(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = toFileLike(item);
      if (normalized) return normalized;
    }
    return null;
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  return null;
}

function resolveUploadedFile(files: unknown): Record<string, unknown> | null {
  const direct = toFileLike(files);
  if (direct && (direct.path || direct.buffer || direct.stream || direct.content)) {
    return direct;
  }

  if (!files || typeof files !== 'object') {
    return null;
  }

  const fileMap = files as Record<string, unknown>;

  if (fileMap.file) {
    const directFile = toFileLike(fileMap.file);
    if (directFile) return directFile;
  }

  for (const key of Object.keys(fileMap)) {
    const candidate = toFileLike(fileMap[key]);
    if (candidate) return candidate;
  }

  return null;
}

function normalizeMimeType(file: Record<string, unknown>): string {
  const mime = typeof file.mimetype === 'string' ? file.mimetype : typeof file.type === 'string' ? file.type : '';
  if (mime) return mime;

  const name =
    (typeof file.originalFilename === 'string' && file.originalFilename) ||
    (typeof file.filename === 'string' && file.filename) ||
    (typeof file.name === 'string' && file.name) ||
    '';

  const lowered = name.toLowerCase();
  if (lowered.endsWith('.png')) return 'image/png';
  if (lowered.endsWith('.gif')) return 'image/gif';
  if (lowered.endsWith('.webp')) return 'image/webp';
  if (lowered.endsWith('.jpg') || lowered.endsWith('.jpeg')) return 'image/jpeg';
  return '';
}
