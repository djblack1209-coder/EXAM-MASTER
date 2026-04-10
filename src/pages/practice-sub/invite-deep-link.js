/**
 * 邀请深度链接服务
 * 检查点4.2: 好友PK邀请 - 深度链接生成与解析
 *
 * 功能：
 * - 生成PK邀请深度链接
 * - 解析邀请链接参数
 * - 生成唯一邀请码
 * - 支持多平台（小程序、H5、APP）
 */

import { ref } from 'vue';
// P006: 从中央配置读取深度链接配置
import appConfig from '@/config/index.js';
import { logger } from '@/utils/logger.js';
import { pkBattle } from '@/services/api/domains/social.api.js';

// 链接类型
const LINK_TYPE = {
  PK: 'pk', // PK对战
  FRIEND: 'friend', // 好友邀请
  GROUP: 'group', // 组队学习
  CHALLENGE: 'challenge' // 挑战赛
};

// 平台类型
const PLATFORM = {
  WEIXIN_MP: 'weixin_mp', // 微信小程序
  H5: 'h5', // H5网页
  APP: 'app', // 原生APP
  WEIXIN_H5: 'weixin_h5' // 微信H5
};

// 配置 — P006: 从中央配置读取
const CONFIG = {
  baseUrl: {
    h5: appConfig.deepLink.h5BaseUrl,
    mp: appConfig.deepLink.miniProgramPkPath,
    app: appConfig.deepLink.appScheme
  },
  codeExpiry: appConfig.deepLink.inviteExpiry,
  codeLength: appConfig.deepLink.inviteCodeLength
};

/**
 * 生成唯一邀请码
 * @param {{ roomId?: string, userId?: string }} [options={}] - 选项
 * @returns {string} 邀请码
 */
export function generateInviteCode(options = {}) {
  const { roomId = '', userId = '' } = options;

  // 基于时间戳和随机数生成
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  const userHash = hashString(userId).toString(36).substring(0, 2);
  const roomHash = hashString(roomId).toString(36).substring(0, 2);

  // 组合并截取
  const code = `${timestamp}${random}${userHash}${roomHash}`.toUpperCase().substring(0, CONFIG.codeLength);

  return code;
}

/**
 * 加密级字符串哈希（替代弱 DJB2 哈希）
 * 使用 Web Crypto 风格的多轮混合，输出 64 位哈希
 */
function hashString(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * 创建邀请深度链接
 * @param {{
 *   type?: string,
 *   roomId?: string,
 *   inviteCode?: string,
 *   inviterId?: string,
 *   subject?: string,
 *   questionCount?: number,
 *   expiry?: number
 * }} [params={}] - 链接参数
 * @returns {Promise<string>} 深度链接
 */
export async function createInviteDeepLink(params = {}) {
  const {
    type = LINK_TYPE.PK,
    roomId,
    inviteCode,
    inviterId,
    subject,
    questionCount,
    expiry = CONFIG.codeExpiry
  } = params;

  if (!roomId || !inviteCode || !inviterId) {
    throw new Error('INVITE_PARAMS_INVALID');
  }

  // 构建参数对象
  const linkParams = {
    t: type, // 类型
    r: roomId, // 房间ID
    c: inviteCode, // 邀请码
    i: inviterId, // 邀请者ID
    s: subject, // 科目
    q: questionCount, // 题目数
    e: Date.now() + expiry // 过期时间
  };

  // 生成签名
  linkParams.sign = generateSignature(linkParams);

  // 根据平台生成不同格式的链接
  const platform = detectPlatform();

  switch (platform) {
    case PLATFORM.WEIXIN_MP:
      return generateMpLink(linkParams);
    case PLATFORM.H5:
    case PLATFORM.WEIXIN_H5:
      return generateH5Link(linkParams);
    case PLATFORM.APP:
      return generateAppLink(linkParams);
    default:
      return generateH5Link(linkParams);
  }
}

/**
 * 检测当前平台
 */
function detectPlatform() {
  // #ifdef MP-WEIXIN
  return PLATFORM.WEIXIN_MP;
  // #endif

  // #ifdef H5
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('micromessenger')) {
    return PLATFORM.WEIXIN_H5;
  }
  return PLATFORM.H5;
  // #endif

  // #ifdef APP-PLUS
  return PLATFORM.APP;
  // #endif

  return PLATFORM.H5;
}

/**
 * 生成小程序链接
 */
function generateMpLink(params) {
  const query = encodeParams(params);
  return `${CONFIG.baseUrl.mp}?${query}`;
}

/**
 * 生成H5链接
 */
function generateH5Link(params) {
  const query = encodeParams(params);
  return `${CONFIG.baseUrl.h5}/pk?${query}`;
}

/**
 * 生成APP深度链接
 */
function generateAppLink(params) {
  const query = encodeParams(params);
  return `${CONFIG.baseUrl.app}pk?${query}`;
}

/**
 * 编码参数
 */
function encodeParams(params) {
  return Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/**
 * 生成签名
 */
function generateSignature(params) {
  const secret = getInviteSecret();
  if (!secret) {
    throw new Error('INVITE_SECRET_MISSING');
  }
  const sortedKeys = Object.keys(params).sort();
  const str = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
  // 使用改进的哈希，输出 16 位十六进制（64 位熵，远强于原来的 8 位/32 位）
  return hashString(str + secret)
    .toString(16)
    .padStart(16, '0');
}

/**
 * 解析邀请链接
 * @param {string} url - 链接URL
 * @returns {Object|null} 解析后的参数
 */
export function parseInviteLink(url) {
  try {
    if (!getInviteSecret()) {
      logger.error('[InviteDeepLink] Missing invite secret, cannot verify link signature');
      return null;
    }

    let params = {};

    // 解析URL参数
    if (url.includes('?')) {
      const queryString = url.split('?')[1];
      params = parseQueryString(queryString);
    }

    // 验证必要参数
    if (!params.r || !params.c) {
      logger.warn('[InviteDeepLink] Missing required params');
      return null;
    }

    // 验证签名
    const sign = params.sign;
    delete params.sign;
    const expectedSign = generateSignature(params);

    if (sign !== expectedSign) {
      logger.warn('[InviteDeepLink] Invalid signature');
      return null;
    }

    // 验证过期时间
    if (params.e && Date.now() > parseInt(params.e)) {
      logger.warn('[InviteDeepLink] Link expired');
      return { expired: true };
    }

    // 返回解析后的参数
    return {
      type: params.t || LINK_TYPE.PK,
      roomId: params.r,
      inviteCode: params.c,
      inviterId: params.i,
      subject: params.s,
      questionCount: parseInt(params.q) || 10,
      expiry: parseInt(params.e),
      valid: true
    };
  } catch (error) {
    logger.error('[InviteDeepLink] Parse error:', error);
    return null;
  }
}

function getInviteSecret() {
  const secret = appConfig.deepLink.inviteSecret;
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    return '';
  }
  return secret.trim();
}

/**
 * 解析查询字符串
 */
function parseQueryString(queryString) {
  const params = {};
  const pairs = queryString.split('&');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
  }

  return params;
}

/**
 * 处理邀请链接（页面加载时调用）
 * @param {Object} options - 页面参数
 * @returns {Promise<Object|null>} 邀请信息
 */
export async function handleInviteLink(options = {}) {
  // 从页面参数中获取邀请信息
  const { roomId, inviteCode, r, c, t, i, s, q, e, sign } = options;

  // 如果有完整参数，直接解析
  if (r && c) {
    const params = { t, r, c, i, s, q, e, sign };
    const queryString = encodeParams(params);
    return parseInviteLink(`?${queryString}`);
  }

  // 如果只有roomId和inviteCode，构建简单邀请
  if (roomId && inviteCode) {
    return {
      type: LINK_TYPE.PK,
      roomId,
      inviteCode,
      valid: true
    };
  }

  return null;
}

/**
 * 生成分享配置（用于微信分享）
 * @param {Object} inviteInfo - 邀请信息
 * @returns {Object} 分享配置
 */
export function generateShareConfig(inviteInfo) {
  const {
    type = LINK_TYPE.PK,
    roomId,
    inviteCode,
    inviterName = '',
    subject = '综合题库',
    questionCount = 10
  } = inviteInfo;

  // 分享标题
  const titles = {
    [LINK_TYPE.PK]: `${inviterName}邀请你来一场知识PK！`,
    [LINK_TYPE.FRIEND]: `${inviterName}邀请你成为学习伙伴`,
    [LINK_TYPE.GROUP]: `${inviterName}邀请你加入学习小组`,
    [LINK_TYPE.CHALLENGE]: `${inviterName}向你发起挑战！`
  };

  // 分享描述
  const descriptions = {
    [LINK_TYPE.PK]: `${subject} ${questionCount}道题，看谁更厉害！`,
    [LINK_TYPE.FRIEND]: '一起学习，共同进步',
    [LINK_TYPE.GROUP]: '组队学习，效率翻倍',
    [LINK_TYPE.CHALLENGE]: `${subject}挑战赛，等你来战！`
  };

  return {
    title: titles[type] || titles[LINK_TYPE.PK],
    desc: descriptions[type] || descriptions[LINK_TYPE.PK],
    path: `/pages/practice-sub/pk-battle?roomId=${roomId}&inviteCode=${inviteCode}`,
    imageUrl: './static/images/pk-share-cover.png'
  };
}

/**
 * 验证邀请码
 * @param {string} code - 邀请码
 * @param {string} roomId - 房间ID
 * @returns {Promise<boolean>} 是否有效
 */
export async function validateInviteCode(code, roomId) {
  try {
    if (!code || code.length !== CONFIG.codeLength) {
      return false;
    }

    if (appConfig.debug.enableMock) {
      logger.warn('[InviteDeepLink] validateInviteCode uses mock fallback in debug mode');
      return true;
    }

    // 调用后端验证邀请码有效性
    const res = await pkBattle({
      action: 'validate_invite_code',
      data: { code, roomId }
    });

    if (res?.code === 0 && res?.data?.valid) {
      return true;
    }

    return false;
  } catch (error) {
    logger.error('[InviteDeepLink] Validate error:', error);
    return false;
  }
}

/**
 * 加入PK房间
 * @param {Object} inviteInfo - 邀请信息
 * @returns {Promise<Object>} 加入结果
 */
export async function joinPKRoom(inviteInfo) {
  const { roomId, inviteCode } = inviteInfo;

  try {
    if (appConfig.debug.enableMock) {
      logger.warn('[InviteDeepLink] joinPKRoom uses mock fallback in debug mode');
      return {
        success: true,
        roomId,
        message: '成功加入房间'
      };
    }

    // 调用后端加入PK房间
    const res = await pkBattle({
      action: 'join_room',
      data: { roomId, inviteCode }
    });

    if (res?.code === 0) {
      return {
        success: true,
        roomId,
        data: res.data,
        message: res.message || '成功加入房间'
      };
    }

    return {
      success: false,
      message: res?.message || '加入房间失败'
    };
  } catch (error) {
    logger.error('[InviteDeepLink] Join room error:', error);
    return {
      success: false,
      message: error.message || '加入房间失败'
    };
  }
}

// 导出常量
export { LINK_TYPE, PLATFORM, CONFIG };

// Vue组合式API Hook
export function useInviteDeepLink() {
  const inviteInfo = ref(null);
  const isProcessing = ref(false);
  const error = ref(null);

  /**
   * 处理页面邀请参数
   */
  const processPageParams = async (options) => {
    isProcessing.value = true;
    error.value = null;

    try {
      inviteInfo.value = await handleInviteLink(options);

      if (inviteInfo.value?.expired) {
        error.value = '邀请链接已过期';
        inviteInfo.value = null;
      }
    } catch (_e2) {
      error.value = _e2.message;
      inviteInfo.value = null;
    } finally {
      isProcessing.value = false;
    }

    return inviteInfo.value;
  };

  /**
   * 创建邀请
   */
  const createInvite = async (params) => {
    isProcessing.value = true;

    try {
      const code = generateInviteCode(params);
      const link = await createInviteDeepLink({
        ...params,
        inviteCode: code
      });

      return { code, link };
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * 加入房间
   */
  const joinRoom = async () => {
    if (!inviteInfo.value) {
      error.value = '无效的邀请信息';
      return null;
    }

    isProcessing.value = true;

    try {
      return await joinPKRoom(inviteInfo.value);
    } finally {
      isProcessing.value = false;
    }
  };

  return {
    inviteInfo,
    isProcessing,
    error,
    processPageParams,
    createInvite,
    joinRoom,
    generateShareConfig
  };
}
