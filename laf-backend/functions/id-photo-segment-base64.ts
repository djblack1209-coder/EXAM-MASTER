import { createLogger, checkRateLimitDistributed } from './_shared/api-response.js';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
const logger = createLogger('[IdPhoto]');

export default async function (ctx) {
  const requestId = `id_photo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const unauthorizedResponse = (message: string) => ({
    code: 401,
    success: false,
    msg: message,
    message,
    requestId
  });

  // [AUDIT FIX] JWT 认证 — 防止未登录用户消耗付费腾讯云 API 额度
  const authResult = requireAuth(ctx);
  if (isAuthError(authResult)) {
    return unauthorizedResponse(authResult.message);
  }
  const authUserId = authResult.userId;

  // [AUDIT FIX] 速率限制 — 每用户每分钟最多 10 次证件照抠图
  const rateCheck = await checkRateLimitDistributed(`id_photo:${authUserId}`, 10, 60 * 1000);
  if (!rateCheck.allowed) {
    return {
      code: 429,
      success: false,
      msg: '操作过于频繁，请稍后再试',
      message: '操作过于频繁，请稍后再试',
      requestId
    };
  }

  const { imageBase64 } = ctx.body || {};

  // S003: 参数校验
  if (!imageBase64) {
    return { code: 1, msg: '请提供图片数据' };
  }
  if (typeof imageBase64 !== 'string') {
    return { code: 1, msg: '图片数据格式错误，需要 Base64 字符串' };
  }
  // 粗略检查 base64 大小（10MB 原始 ≈ ~13.3MB base64）
  if (imageBase64.length > 14 * 1024 * 1024) {
    return { code: 1, msg: '图片数据过大，请压缩后重试' };
  }

  // 检查环境变量
  const secretId = process.env.TENCENT_SECRET_ID;
  const secretKey = process.env.TENCENT_SECRET_KEY;

  if (!secretId || !secretKey) {
    logger.error('[id-photo] 环境变量未配置');
    return {
      code: 500,
      success: false,
      msg: '服务配置错误，请联系管理员',
      message: '服务配置错误，请联系管理员',
      detail: 'ENV_NOT_SET',
      requestId
    };
  }

  try {
    logger.info('[id-photo] 开始处理，图片大小:', imageBase64.length);

    // 动态导入 tencentcloud-sdk-nodejs（Laf 运行时提供）
    const tencentcloud = await import('tencentcloud-sdk-nodejs');
    const BdaClient = (tencentcloud.default || tencentcloud).bda.v20200324.Client;

    // 初始化腾讯云客户端
    const client = new BdaClient({
      credential: {
        secretId: secretId,
        secretKey: secretKey
      },
      region: 'ap-guangzhou',
      profile: {
        httpProfile: {
          endpoint: 'bda.tencentcloudapi.com'
        }
      }
    });

    logger.info('[id-photo] 调用腾讯云 API...');

    // 调用腾讯云人像分割接口
    const result = await client.SegmentPortraitPic({
      Image: imageBase64
    });

    // 获取返回的透明背景图 (Base64)
    const resultImageBase64 = result.ResultImage;
    if (!resultImageBase64) {
      throw new Error('AI 处理失败，未返回图片');
    }

    logger.info('[id-photo] 人像分割成功');

    // 直接返回 Base64
    return {
      code: 0,
      msg: 'success',
      success: true,
      data: {
        imageBase64: resultImageBase64,
        tip: '透明背景 PNG，前端可用 CSS 即时换色'
      }
    };
  } catch (err) {
    logger.error('[id-photo] 处理失败:', err.message, err.code);

    let errorMsg = err.message || '服务器内部错误';
    let errorCode = err.code || 'UNKNOWN';

    // 常见错误提示
    if (errorCode === 'FailedOperation.ImageNotSupported') {
      errorMsg = '图片格式不支持，请上传 JPG/PNG 格式的证件照';
    } else if (errorCode === 'FailedOperation.NoFaceInPhoto') {
      errorMsg = '未检测到人脸，请上传正面免冠证件照';
    } else if (errorCode === 'FailedOperation.ImageSizeExceed') {
      errorMsg = '图片尺寸过大，请压缩后重试';
    } else if (errorCode === 'FailedOperation.ImageDecodeFailed') {
      errorMsg = '图片解码失败，请确保图片完整';
    }

    return {
      code: 500,
      success: false,
      msg: errorMsg,
      message: errorMsg,
      requestId,
      detail: errorCode
    };
  }
}
