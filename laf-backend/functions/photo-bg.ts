/**
 * 证件照换背景云函数 - 使用腾讯云人像分割 API
 *
 * 支持的功能：
 * 1. 人像抠图（去除背景）
 * 2. 背景颜色替换
 * 3. 证件照尺寸裁剪
 * 4. 智能美颜处理
 *
 * 环境变量要求：
 * - TENCENT_SECRET_ID: 腾讯云 SecretId
 * - TENCENT_SECRET_KEY: 腾讯云 SecretKey
 *
 * @version 2.1.0
 * @author EXAM-MASTER Team
 */

import cloud from '@lafjs/cloud';
import crypto from 'crypto';
import { validate } from './_shared/validator';
import { createLogger, checkRateLimitDistributed } from './_shared/api-response';
import { verifyJWT } from './login';
import { extractBearerToken } from './_shared/auth';

const logger = createLogger('[PhotoBg]');

// ==================== 配置 ====================
const CONFIG = {
  tencent: {
    secretId: process.env.TENCENT_SECRET_ID,
    secretKey: process.env.TENCENT_SECRET_KEY,
    region: 'ap-beijing',
    // 人像分割服务
    bda: {
      host: 'bda.tencentcloudapi.com',
      service: 'bda',
      version: '2020-03-24'
    },
    // 人脸美颜服务
    fmu: {
      host: 'fmu.tencentcloudapi.com',
      service: 'fmu',
      version: '2019-12-13'
    }
  },
  timeout: 30000,
  maxFileSize: 10 * 1024 * 1024 // 最大 10MB
};

// 证件照尺寸配置（单位：像素，300dpi）
const PHOTO_SIZES = {
  '1inch': { width: 295, height: 413, name: '一寸', desc: '25×35mm', ratio: 0.714 },
  '2inch': { width: 413, height: 579, name: '二寸', desc: '35×49mm', ratio: 0.713 },
  small2inch: { width: 390, height: 567, name: '小二寸', desc: '33×48mm', ratio: 0.688 },
  big1inch: { width: 390, height: 567, name: '大一寸', desc: '33×48mm', ratio: 0.688 },
  '5inch': { width: 1050, height: 1500, name: '五寸', desc: '89×127mm', ratio: 0.7 },
  passport: { width: 390, height: 567, name: '护照', desc: '33×48mm', ratio: 0.688 },
  visa: { width: 413, height: 531, name: '签证', desc: '35×45mm', ratio: 0.778 }
};

// 背景颜色配置
const BG_COLORS = {
  white: { hex: '#FFFFFF', name: '白色', rgb: [255, 255, 255] },
  blue: { hex: '#438EDB', name: '蓝色', rgb: [67, 142, 219] },
  red: { hex: '#D03A3A', name: '红色', rgb: [208, 58, 58] },
  gray: { hex: '#F5F5F5', name: '灰色', rgb: [245, 245, 245] },
  light_blue: { hex: '#4A90D9', name: '浅蓝', rgb: [74, 144, 217] },
  dark_blue: { hex: '#1E3A8A', name: '深蓝', rgb: [30, 58, 138] }
};

// ==================== 主入口 ====================
export default async function (ctx) {
  const startTime = Date.now();
  const requestId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  logger.info(`[${requestId}] 证件照处理请求开始`);

  try {
    // [AUDIT FIX] JWT 认证 — 防止未登录用户消耗付费腾讯云 API 额度
    const authToken = extractBearerToken(ctx.headers?.['authorization'] || ctx.headers?.Authorization);
    if (!authToken) {
      return { code: 401, success: false, message: '请先登录', requestId };
    }

    const payload = verifyJWT(authToken);
    if (!payload?.userId) {
      return { code: 401, success: false, message: 'token 无效或已过期', requestId };
    }
    const authUserId = payload.userId;

    // [AUDIT FIX] 速率限制 — 每用户每分钟最多 10 次证件照处理
    const rateCheck = await checkRateLimitDistributed(`photo_bg:${authUserId}`, 10, 60 * 1000);
    if (!rateCheck.allowed) {
      return { code: 429, success: false, message: '操作过于频繁，请稍后再试', requestId };
    }

    // 兼容多种参数传递方式
    let body = ctx.body || ctx.request?.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {}
    }

    const { action, ...params } = body;

    logger.info(`[${requestId}] action: ${action}`);

    // S003: 入口参数校验
    const entryValidation = validate(
      { action },
      {
        action: {
          required: true,
          type: 'string',
          maxLength: 50,
          enum: ['remove_bg', 'change_bg', 'process', 'beauty', 'get_sizes', 'get_colors']
        }
      }
    );
    if (!entryValidation.valid) {
      return { code: 400, success: false, message: entryValidation.errors[0], requestId };
    }

    // 检查配置
    if (!CONFIG.tencent.secretId || !CONFIG.tencent.secretKey) {
      return {
        code: 500,
        success: false,
        message: '服务配置错误：缺少腾讯云密钥',
        requestId
      };
    }

    switch (action) {
      case 'remove_bg':
        return await removeBackground(params, requestId);
      case 'change_bg':
        return await changeBackground(params, requestId);
      case 'process':
        return await processPhoto(params, requestId);
      case 'beauty':
        return await applyBeauty(params, requestId);
      case 'get_sizes':
        return getSizes();
      case 'get_colors':
        return getColors();
      default:
        return {
          code: 400,
          success: false,
          message: '未知操作，支持: remove_bg, change_bg, process, beauty, get_sizes, get_colors',
          requestId
        };
    }
  } catch (error) {
    logger.error(`[${requestId}] 证件照处理异常:`, error);
    return {
      code: 500,
      success: false,
      message: '处理失败',
      requestId,
      duration: Date.now() - startTime
    };
  }
}

// ==================== 获取支持的尺寸 ====================
function getSizes() {
  return {
    code: 0,
    success: true,
    data: PHOTO_SIZES
  };
}

// ==================== 获取支持的背景颜色 ====================
function getColors() {
  return {
    code: 0,
    success: true,
    data: BG_COLORS
  };
}

// ==================== 移除背景（人像抠图）====================
async function removeBackground(params, requestId) {
  const { imageBase64 } = params;

  if (!imageBase64) {
    return { code: 400, success: false, message: '缺少图片数据 imageBase64', requestId };
  }

  // 检查文件大小
  const fileSize = Buffer.from(imageBase64, 'base64').length;
  if (fileSize > CONFIG.maxFileSize) {
    return {
      code: 400,
      success: false,
      message: `图片过大，最大支持 ${CONFIG.maxFileSize / 1024 / 1024}MB`,
      requestId
    };
  }

  logger.info(`[${requestId}] 开始人像抠图, 图片大小: ${(fileSize / 1024).toFixed(2)}KB`);

  try {
    // 调用腾讯云人像分割 API
    const result = await callTencentAPI(
      'bda',
      'SegmentPortraitPic',
      {
        Image: imageBase64,
        RspImgType: 'Foreground' // 返回前景图（人像）
      },
      requestId
    );

    if (result.Response?.Error) {
      logger.error(`[${requestId}] 腾讯云 API 错误:`, result.Response.Error);
      return {
        code: 500,
        success: false,
        message: '抠图失败，请稍后重试',
        requestId
      };
    }

    // 返回抠图结果
    return {
      code: 0,
      success: true,
      data: {
        imageBase64: result.Response?.ResultImage,
        maskBase64: result.Response?.ResultMask,
        hasPortrait: result.Response?.HasForeground
      },
      message: '抠图成功',
      requestId
    };
  } catch (error) {
    logger.error(`[${requestId}] 抠图失败:`, error);
    return {
      code: 500,
      success: false,
      message: '抠图失败，请稍后重试',
      requestId
    };
  }
}

// ==================== 更换背景颜色 ====================
async function changeBackground(params, requestId) {
  const { imageBase64, bgColor, customColor } = params;

  if (!imageBase64) {
    return { code: 400, success: false, message: '缺少图片数据 imageBase64', requestId };
  }

  // 获取背景颜色配置
  const colorConfig = BG_COLORS[bgColor] || BG_COLORS['white'];
  const targetColorHex = customColor || colorConfig.hex;

  logger.info(`[${requestId}] 更换背景颜色: ${targetColorHex}`);

  try {
    // 调用腾讯云人像分割 API - 获取前景图
    const result = await callTencentAPI(
      'bda',
      'SegmentPortraitPic',
      {
        Image: imageBase64,
        RspImgType: 'Foreground' // 返回前景图（人像，透明背景 PNG）
      },
      requestId
    );

    if (result.Response?.Error) {
      logger.error(`[${requestId}] 腾讯云 API 错误:`, result.Response.Error);
      return {
        code: 500,
        success: false,
        message: '人像识别失败，请稍后重试',
        requestId
      };
    }

    // 返回前景图和背景色，让前端合成
    // 注意：腾讯云 SegmentPortraitPic 不直接支持换背景色
    // 需要在前端使用 Canvas 合成背景
    return {
      code: 0,
      success: true,
      data: {
        imageBase64: result.Response?.ResultImage, // 前景图（PNG，透明背景）
        bgColorHex: targetColorHex,
        bgColorRgb: colorConfig.rgb || hexToRgb(targetColorHex),
        needComposite: true // 标记需要前端合成
      },
      message: '抠图成功，请在前端合成背景',
      requestId
    };
  } catch (error) {
    logger.error(`[${requestId}] 换背景失败:`, error);
    return {
      code: 500,
      success: false,
      message: '换背景失败，请稍后重试',
      requestId
    };
  }
}

// ==================== 完整处理流程 ====================
async function processPhoto(params, requestId) {
  const { imageBase64, bgColor = 'white', customColor, size = '1inch', beauty = false, beautyLevel = 50 } = params;

  if (!imageBase64) {
    return { code: 400, success: false, message: '缺少图片数据 imageBase64', requestId };
  }

  const sizeConfig = PHOTO_SIZES[size];
  if (!sizeConfig) {
    return {
      code: 400,
      success: false,
      message: `不支持的尺寸: ${size}，支持: ${Object.keys(PHOTO_SIZES).join(', ')}`,
      requestId
    };
  }

  // 获取背景颜色
  const colorConfig = BG_COLORS[bgColor] || BG_COLORS['white'];
  const targetColorHex = customColor || colorConfig.hex;

  logger.info(`[${requestId}] 完整处理: 尺寸=${size}, 背景=${targetColorHex}, 美颜=${beauty}`);

  try {
    let processedImage = imageBase64;

    // 步骤1: 美颜处理（可选）
    if (beauty) {
      logger.info(`[${requestId}] 步骤1: 美颜处理...`);
      try {
        const beautyResult = await callTencentAPI(
          'fmu',
          'BeautifyPic',
          {
            Image: processedImage,
            Whitening: Math.round(beautyLevel * 0.7),
            Smoothing: Math.round(beautyLevel * 0.5),
            FaceLifting: Math.round(beautyLevel * 0.3),
            EyeEnlarging: Math.round(beautyLevel * 0.2)
          },
          requestId
        );

        if (beautyResult.Response?.ResultImage) {
          processedImage = beautyResult.Response.ResultImage;
          logger.info(`[${requestId}] 美颜完成`);
        } else if (beautyResult.Response?.Error) {
          logger.warn(`[${requestId}] 美颜失败:`, beautyResult.Response.Error.Message);
        }
      } catch (e) {
        logger.warn(`[${requestId}] 美颜处理异常，继续处理原图:`, e.message);
      }
    }

    // 步骤2: 人像分割
    logger.info(`[${requestId}] 步骤2: 人像分割...`);
    const segResult = await callTencentAPI(
      'bda',
      'SegmentPortraitPic',
      {
        Image: processedImage,
        RspImgType: 'Foreground'
      },
      requestId
    );

    if (segResult.Response?.Error) {
      return {
        code: 500,
        success: false,
        message: '人像识别失败，请稍后重试',
        requestId
      };
    }

    const foregroundImage = segResult.Response?.ResultImage;

    if (!foregroundImage) {
      return {
        code: 400,
        success: false,
        message: '未检测到人像，请确保照片中有清晰的人脸',
        requestId
      };
    }

    return {
      code: 0,
      success: true,
      data: {
        imageBase64: foregroundImage, // 前景图（透明背景）
        bgColorHex: targetColorHex,
        bgColorRgb: colorConfig.rgb || hexToRgb(targetColorHex),
        size: sizeConfig,
        beauty: beauty,
        needComposite: true // 需要前端合成背景
      },
      message: '处理成功',
      requestId
    };
  } catch (error) {
    logger.error(`[${requestId}] 处理失败:`, error);
    return {
      code: 500,
      success: false,
      message: '处理失败，请稍后重试',
      requestId
    };
  }
}

// ==================== 美颜处理 ====================
async function applyBeauty(params, requestId) {
  const { imageBase64, whitening = 50, smoothing = 50, faceLifting = 30, eyeEnlarging = 20 } = params;

  if (!imageBase64) {
    return { code: 400, success: false, message: '缺少图片数据 imageBase64', requestId };
  }

  logger.info(`[${requestId}] 美颜处理: 美白=${whitening}, 磨皮=${smoothing}`);

  try {
    const result = await callTencentAPI(
      'fmu',
      'BeautifyPic',
      {
        Image: imageBase64,
        Whitening: whitening,
        Smoothing: smoothing,
        FaceLifting: faceLifting,
        EyeEnlarging: eyeEnlarging
      },
      requestId
    );

    if (result.Response?.Error) {
      return {
        code: 500,
        success: false,
        message: '美颜失败，请稍后重试',
        requestId
      };
    }

    return {
      code: 0,
      success: true,
      data: {
        imageBase64: result.Response?.ResultImage
      },
      message: '美颜成功',
      requestId
    };
  } catch (error) {
    logger.error(`[${requestId}] 美颜失败:`, error);
    return {
      code: 500,
      success: false,
      message: '美颜失败，请稍后重试',
      requestId
    };
  }
}

// ==================== 腾讯云 API 调用 ====================
async function callTencentAPI(service, action, params, requestId) {
  const serviceConfig = CONFIG.tencent[service];
  if (!serviceConfig) {
    throw new Error(`未知服务: ${service}`);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().split('T')[0];

  const payload = JSON.stringify(params);

  // 构建签名
  const authorization = generateTencentSignature(serviceConfig.service, serviceConfig.host, payload, timestamp, date);

  const headers = {
    'Content-Type': 'application/json',
    Host: serviceConfig.host,
    'X-TC-Action': action,
    'X-TC-Version': serviceConfig.version,
    'X-TC-Timestamp': timestamp.toString(),
    'X-TC-Region': CONFIG.tencent.region,
    Authorization: authorization
  };

  logger.info(`[${requestId}] 调用腾讯云 API: ${service}/${action}`);

  try {
    const response = await cloud.fetch({
      url: `https://${serviceConfig.host}`,
      method: 'POST',
      headers,
      data: params,
      timeout: CONFIG.timeout
    });

    return response.data;
  } catch (error) {
    logger.error(`[${requestId}] 腾讯云 API 调用失败:`, error);
    throw error;
  }
}

// ==================== 腾讯云签名生成 ====================
function generateTencentSignature(service, host, payload, timestamp, date) {
  const secretId = CONFIG.tencent.secretId;
  const secretKey = CONFIG.tencent.secretKey;

  // 1. 拼接规范请求串
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const canonicalHeaders = `content-type:application/json\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const hashedRequestPayload = sha256(payload);

  const canonicalRequest = [
    httpRequestMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    hashedRequestPayload
  ].join('\n');

  // 2. 拼接待签名字符串
  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = sha256(canonicalRequest);

  const stringToSign = [algorithm, timestamp, credentialScope, hashedCanonicalRequest].join('\n');

  // 3. 计算签名
  const secretDate = hmacSha256(`TC3${secretKey}`, date);
  const secretService = hmacSha256(secretDate, service);
  const secretSigning = hmacSha256(secretService, 'tc3_request');
  const signature = hmacSha256(secretSigning, stringToSign, 'hex');

  // 4. 拼接 Authorization
  return `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

// ==================== 辅助函数 ====================
function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key, data, encoding = 'buffer') {
  const keyBuffer = typeof key === 'string' ? Buffer.from(key) : key;
  const hmac = crypto.createHmac('sha256', keyBuffer).update(data);
  return encoding === 'hex' ? hmac.digest('hex') : hmac.digest();
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)] : [255, 255, 255];
}
