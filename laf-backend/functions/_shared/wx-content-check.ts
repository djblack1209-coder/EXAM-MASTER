/**
 * 微信内容安全检测模块
 *
 * 封装微信 security.msgSecCheck API，用于检测 UGC 文本和 AI 生成内容
 * 是否包含违规内容（涉政/涉黄/暴力/广告等）。
 *
 * 微信小程序审核要求：所有用户可见的 UGC 内容必须经过内容安全检测。
 *
 * API 文档: https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/sec-center/sec-check/msgSecCheck.html
 *
 * @version 1.0.0
 * @since H019 修复
 */

import { createLogger } from './api-response';

const logger = createLogger('[WxContentCheck]');

// ==================== 环境变量 ====================
const WX_APPID = process.env.WX_APPID || '';
const WX_SECRET_PLACEHOLDER

// ==================== access_token 缓存 ====================
// 微信 access_token 有效期 7200 秒（2小时），提前 5 分钟刷新
let cachedAccessToken = '';
let tokenExpiresAt = 0;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 提前 5 分钟刷新

/**
 * 获取微信平台 access_token（client_credential 模式）
 * 带内存缓存，避免频繁请求微信接口
 */
async function getAccessToken(): Promise<string> {
  // 缓存命中
  if (cachedAccessToken && Date.now() < tokenExpiresAt - TOKEN_REFRESH_BUFFER_MS) {
    return cachedAccessToken;
  }

  if (!WX_APPID || !WX_SECRET_PLACEHOLDER
    logger.warn('WX_APPID 或 WX_SECRET_PLACEHOLDER
    return '';
  }

  try {
    const url =
      `https://api.weixin.qq.com/cgi-bin/token` +
      `?grant_type=client_credential` +
      `&appid=${encodeURIComponent(WX_APPID)}` +
      `&secret=${encodeURIComponent(WX_SECRET_PLACEHOLDER

    const response = await fetch(url, { method: 'GET' });
    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      errcode?: number;
      errmsg?: string;
    };

    if (data.errcode) {
      logger.error(`获取 access_token 失败: errcode=${data.errcode}, errmsg=${data.errmsg}`);
      return '';
    }

    if (!data.access_token) {
      logger.error('获取 access_token 返回数据异常: 缺少 access_token 字段');
      return '';
    }

    cachedAccessToken = data.access_token;
    // expires_in 单位为秒，转换为毫秒
    tokenExpiresAt = Date.now() + (data.expires_in || 7200) * 1000;
    logger.info(`access_token 获取成功，有效期 ${data.expires_in || 7200} 秒`);

    return cachedAccessToken;
  } catch (err) {
    logger.error('获取 access_token 网络异常:', err);
    return '';
  }
}

// ==================== 检测结果类型 ====================
export interface ContentCheckResult {
  /** 是否通过检测（true = 安全, false = 违规） */
  pass: boolean;
  /** 检测标签：security（涉政敏感）、porn（涉黄）、ad（广告）等 */
  label?: string;
  /** 人类可读的拒绝原因 */
  reason?: string;
  /** 是否为异步审核（结果待回调） */
  isAsync?: boolean;
  /** 原始错误码（调试用） */
  errcode?: number;
}

// ==================== 场景值常量 ====================
/**
 * 微信 msgSecCheck 场景值
 * 1 = 资料（昵称/头像等）
 * 2 = 评论
 * 3 = 论坛（群组分享等）
 * 4 = 社交日志（聊天消息等）
 */
export const ContentScene = {
  /** 资料类（昵称、签名等） */
  PROFILE: 1,
  /** 评论类 */
  COMMENT: 2,
  /** 论坛/社区类（群组分享等） */
  FORUM: 3,
  /** 社交日志/聊天类 */
  SOCIAL: 4
} as const;

export type ContentSceneValue = (typeof ContentScene)[keyof typeof ContentScene];

// ==================== 标签中文映射 ====================
const LABEL_MAP: Record<string, string> = {
  '10001': '广告',
  '20001': '时政',
  '20002': '色情',
  '20003': '辱骂',
  '20006': '违法犯罪',
  '20008': '欺诈',
  '20012': '低俗',
  '20013': '版权',
  '21000': '其他'
};

/**
 * 调用微信 security.msgSecCheck 接口检测文本内容
 *
 * @param content - 待检测的文本内容（最大 2500 字节，约 833 个中文字符）
 * @param openid - 用户的微信 openid（用于关联用户上报）
 * @param scene - 场景值（1=资料, 2=评论, 3=论坛, 4=社交日志）
 * @returns ContentCheckResult
 */
export async function checkTextSecurity(
  content: string,
  openid: string,
  scene: ContentSceneValue = ContentScene.SOCIAL
): Promise<ContentCheckResult> {
  // 空内容直接放行
  if (!content || !content.trim()) {
    return { pass: true };
  }

  // 环境变量缺失时降级放行（开发环境/未配置场景）
  if (!WX_APPID || !WX_SECRET_PLACEHOLDER
    logger.warn('微信凭证未配置，内容安全检测降级放行');
    return { pass: true };
  }

  // 获取 access_token
  const accessToken = await getAccessToken();
  if (!accessToken) {
    // access_token 获取失败时降级放行，不阻塞用户正常使用
    logger.warn('access_token 获取失败，内容安全检测降级放行');
    return { pass: true };
  }

  try {
    // 截断超长内容（微信限制 2500 字节，约 833 个汉字）
    // UTF-8 中文字符 3 字节，保守取 800 字
    const truncatedContent = content.length > 800 ? content.substring(0, 800) : content;

    const url = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${accessToken}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        version: 2, // 使用 v2 版本（支持异步审核）
        openid: openid || 'anonymous',
        scene,
        content: truncatedContent
      })
    });

    const data = (await response.json()) as {
      errcode?: number;
      errmsg?: string;
      result?: {
        suggest?: string; // 'pass' | 'review' | 'risky'
        label?: number;
      };
      detail?: Array<{
        strategy?: string;
        errcode?: number;
        suggest?: string;
        label?: number;
        keyword?: string;
        prob?: number;
      }>;
      trace_id?: string;
    };

    // 系统级错误
    if (data.errcode && data.errcode !== 0) {
      // 常见错误码处理
      if (data.errcode === 40001 || data.errcode === 42001) {
        // access_token 无效或过期，清除缓存
        cachedAccessToken = '';
        tokenExpiresAt = 0;
        logger.warn(`access_token 已失效(${data.errcode})，已清除缓存，降级放行`);
        return { pass: true, errcode: data.errcode };
      }

      logger.error(`msgSecCheck API 错误: errcode=${data.errcode}, errmsg=${data.errmsg}`);
      // API 异常时降级放行
      return { pass: true, errcode: data.errcode };
    }

    // 解析检测结果
    const suggest = data.result?.suggest || 'pass';
    const label = data.result?.label;

    if (suggest === 'pass') {
      return { pass: true };
    }

    if (suggest === 'review') {
      // 需要人工审核（异步），先放行，后续通过回调处理
      logger.info(`内容需人工审核，trace_id=${data.trace_id}, label=${label}`);
      return { pass: true, isAsync: true, label: label ? LABEL_MAP[String(label)] : undefined };
    }

    if (suggest === 'risky') {
      // 命中违规
      const labelName = label ? LABEL_MAP[String(label)] || `未知(${label})` : '未知';
      logger.warn(
        `内容安全检测拦截: suggest=risky, label=${labelName}, ` +
          `detail=${JSON.stringify(data.detail?.map((d) => ({ s: d.suggest, l: d.label, k: d.keyword })))}`
      );

      return {
        pass: false,
        label: labelName,
        reason: `内容包含${labelName}相关敏感信息，请修改后重试`
      };
    }

    // 未知 suggest 值，放行
    logger.warn(`msgSecCheck 返回未知 suggest: ${suggest}`);
    return { pass: true };
  } catch (err) {
    // 网络异常降级放行
    logger.error('msgSecCheck 网络异常，降级放行:', err);
    return { pass: true };
  }
}

/**
 * 批量检测多段文本（如用户输入 + AI 回复）
 * 任一段不通过则整体不通过
 *
 * @param texts - 待检测文本数组
 * @param openid - 用户 openid
 * @param scene - 场景值
 * @returns 合并的检测结果（取最严格的）
 */
export async function checkMultipleTexts(
  texts: string[],
  openid: string,
  scene: ContentSceneValue = ContentScene.SOCIAL
): Promise<ContentCheckResult> {
  const validTexts = texts.filter((t) => t && t.trim());

  if (validTexts.length === 0) {
    return { pass: true };
  }

  // 串行检测（避免并发触发微信频率限制）
  for (const text of validTexts) {
    const result = await checkTextSecurity(text, openid, scene);
    if (!result.pass) {
      return result;
    }
  }

  return { pass: true };
}
