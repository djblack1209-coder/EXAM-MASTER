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

import { ref } from 'vue'

// 链接类型
const LINK_TYPE = {
  PK: 'pk',                    // PK对战
  FRIEND: 'friend',            // 好友邀请
  GROUP: 'group',              // 组队学习
  CHALLENGE: 'challenge'       // 挑战赛
}

// 平台类型
const PLATFORM = {
  WEIXIN_MP: 'weixin_mp',      // 微信小程序
  H5: 'h5',                    // H5网页
  APP: 'app',                  // 原生APP
  WEIXIN_H5: 'weixin_h5'       // 微信H5
}

// 配置
const CONFIG = {
  // 基础URL
  baseUrl: {
    h5: 'https://exam-master.com',
    mp: '/pages/practice/pk-battle',
    app: 'exammaster://'
  },
  // 邀请码有效期（毫秒）
  codeExpiry: 24 * 60 * 60 * 1000, // 24小时
  // 邀请码长度
  codeLength: 8
}

/**
 * 生成唯一邀请码
 * @param {Object} options - 选项
 * @param {string} options.roomId - 房间ID
 * @param {string} options.userId - 用户ID
 * @returns {string} 邀请码
 */
export function generateInviteCode(options = {}) {
  const { roomId = '', userId = '' } = options
  
  // 基于时间戳和随机数生成
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  const userHash = hashString(userId).toString(36).substring(0, 2)
  const roomHash = hashString(roomId).toString(36).substring(0, 2)
  
  // 组合并截取
  const code = `${timestamp}${random}${userHash}${roomHash}`
    .toUpperCase()
    .substring(0, CONFIG.codeLength)
  
  return code
}

/**
 * 简单字符串哈希
 */
function hashString(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

/**
 * 创建邀请深度链接
 * @param {Object} params - 链接参数
 * @param {string} params.type - 链接类型
 * @param {string} params.roomId - 房间ID
 * @param {string} params.inviteCode - 邀请码
 * @param {string} params.inviterId - 邀请者ID
 * @param {string} params.subject - 科目
 * @param {number} params.questionCount - 题目数量
 * @returns {Promise<string>} 深度链接
 */
export async function createInviteDeepLink(params) {
  const {
    type = LINK_TYPE.PK,
    roomId,
    inviteCode,
    inviterId,
    subject,
    questionCount,
    expiry = CONFIG.codeExpiry
  } = params
  
  // 构建参数对象
  const linkParams = {
    t: type,                           // 类型
    r: roomId,                         // 房间ID
    c: inviteCode,                     // 邀请码
    i: inviterId,                      // 邀请者ID
    s: subject,                        // 科目
    q: questionCount,                  // 题目数
    e: Date.now() + expiry             // 过期时间
  }
  
  // 生成签名
  linkParams.sign = generateSignature(linkParams)
  
  // 根据平台生成不同格式的链接
  const platform = detectPlatform()
  
  switch (platform) {
    case PLATFORM.WEIXIN_MP:
      return generateMpLink(linkParams)
    case PLATFORM.H5:
    case PLATFORM.WEIXIN_H5:
      return generateH5Link(linkParams)
    case PLATFORM.APP:
      return generateAppLink(linkParams)
    default:
      return generateH5Link(linkParams)
  }
}

/**
 * 检测当前平台
 */
function detectPlatform() {
  // #ifdef MP-WEIXIN
  return PLATFORM.WEIXIN_MP
  // #endif
  
  // #ifdef H5
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('micromessenger')) {
    return PLATFORM.WEIXIN_H5
  }
  return PLATFORM.H5
  // #endif
  
  // #ifdef APP-PLUS
  return PLATFORM.APP
  // #endif
  
  return PLATFORM.H5
}

/**
 * 生成小程序链接
 */
function generateMpLink(params) {
  const query = encodeParams(params)
  return `${CONFIG.baseUrl.mp}?${query}`
}

/**
 * 生成H5链接
 */
function generateH5Link(params) {
  const query = encodeParams(params)
  return `${CONFIG.baseUrl.h5}/pk?${query}`
}

/**
 * 生成APP深度链接
 */
function generateAppLink(params) {
  const query = encodeParams(params)
  return `${CONFIG.baseUrl.app}pk?${query}`
}

/**
 * 编码参数
 */
function encodeParams(params) {
  return Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

/**
 * 生成签名
 */
function generateSignature(params) {
  // 签名密钥从环境变量获取，默认使用动态生成的密钥
  const secret = import.meta.env.VITE_INVITE_SECRET || `exam_pk_${Date.now().toString(36).slice(-4)}`
  const sortedKeys = Object.keys(params).sort()
  const str = sortedKeys.map(k => `${k}=${params[k]}`).join('&')
  return hashString(str + secret).toString(16).substring(0, 8)
}

/**
 * 解析邀请链接
 * @param {string} url - 链接URL
 * @returns {Object|null} 解析后的参数
 */
export function parseInviteLink(url) {
  try {
    let params = {}
    
    // 解析URL参数
    if (url.includes('?')) {
      const queryString = url.split('?')[1]
      params = parseQueryString(queryString)
    }
    
    // 验证必要参数
    if (!params.r || !params.c) {
      console.warn('[InviteDeepLink] Missing required params')
      return null
    }
    
    // 验证签名
    const sign = params.sign
    delete params.sign
    const expectedSign = generateSignature(params)
    
    if (sign !== expectedSign) {
      console.warn('[InviteDeepLink] Invalid signature')
      return null
    }
    
    // 验证过期时间
    if (params.e && Date.now() > parseInt(params.e)) {
      console.warn('[InviteDeepLink] Link expired')
      return { expired: true }
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
    }
    
  } catch (error) {
    console.error('[InviteDeepLink] Parse error:', error)
    return null
  }
}

/**
 * 解析查询字符串
 */
function parseQueryString(queryString) {
  const params = {}
  const pairs = queryString.split('&')
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=')
    if (key) {
      params[decodeURIComponent(key)] = decodeURIComponent(value || '')
    }
  }
  
  return params
}

/**
 * 处理邀请链接（页面加载时调用）
 * @param {Object} options - 页面参数
 * @returns {Promise<Object|null>} 邀请信息
 */
export async function handleInviteLink(options = {}) {
  // 从页面参数中获取邀请信息
  const { roomId, inviteCode, r, c, t, i, s, q, e, sign } = options
  
  // 如果有完整参数，直接解析
  if (r && c) {
    const params = { t, r, c, i, s, q, e, sign }
    const queryString = encodeParams(params)
    return parseInviteLink(`?${queryString}`)
  }
  
  // 如果只有roomId和inviteCode，构建简单邀请
  if (roomId && inviteCode) {
    return {
      type: LINK_TYPE.PK,
      roomId,
      inviteCode,
      valid: true
    }
  }
  
  return null
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
  } = inviteInfo
  
  // 分享标题
  const titles = {
    [LINK_TYPE.PK]: `${inviterName}邀请你来一场知识PK！`,
    [LINK_TYPE.FRIEND]: `${inviterName}邀请你成为学习伙伴`,
    [LINK_TYPE.GROUP]: `${inviterName}邀请你加入学习小组`,
    [LINK_TYPE.CHALLENGE]: `${inviterName}向你发起挑战！`
  }
  
  // 分享描述
  const descriptions = {
    [LINK_TYPE.PK]: `${subject} ${questionCount}道题，看谁更厉害！`,
    [LINK_TYPE.FRIEND]: '一起学习，共同进步',
    [LINK_TYPE.GROUP]: '组队学习，效率翻倍',
    [LINK_TYPE.CHALLENGE]: `${subject}挑战赛，等你来战！`
  }
  
  return {
    title: titles[type] || titles[LINK_TYPE.PK],
    desc: descriptions[type] || descriptions[LINK_TYPE.PK],
    path: `/pages/practice/pk-battle?roomId=${roomId}&inviteCode=${inviteCode}`,
    imageUrl: '/static/images/pk-share-cover.png'
  }
}

/**
 * 验证邀请码
 * @param {string} code - 邀请码
 * @param {string} roomId - 房间ID
 * @returns {Promise<boolean>} 是否有效
 */
export async function validateInviteCode(code, roomId) {
  try {
    // 这里应该调用后端API验证
    // 暂时返回基本验证
    if (!code || code.length !== CONFIG.codeLength) {
      return false
    }
    
    // NOTE: 后端验证API暂未实现，当前使用本地基础验证
    // 后续接入后端时取消下方注释：
    // const result = await api.validateInviteCode({ code, roomId })
    // return result.valid
    
    // 当前降级方案：本地基础验证通过即返回 true
    return true
    
  } catch (error) {
    console.error('[InviteDeepLink] Validate error:', error)
    return false
  }
}

/**
 * 加入PK房间
 * @param {Object} inviteInfo - 邀请信息
 * @returns {Promise<Object>} 加入结果
 */
export async function joinPKRoom(inviteInfo) {
  const { roomId, inviteCode, inviterId } = inviteInfo
  
  try {
    // NOTE: 后端加入房间API暂未实现，当前使用模拟返回
    // 后续接入后端时取消下方注释：
    // const result = await api.joinPKRoom({ roomId, inviteCode, inviterId })
    
    // 当前降级方案：模拟返回成功
    return {
      success: true,
      roomId,
      message: '成功加入房间'
    }
    
  } catch (error) {
    console.error('[InviteDeepLink] Join room error:', error)
    return {
      success: false,
      message: error.message || '加入房间失败'
    }
  }
}

// 导出常量
export { LINK_TYPE, PLATFORM, CONFIG }

// Vue组合式API Hook
export function useInviteDeepLink() {
  const inviteInfo = ref(null)
  const isProcessing = ref(false)
  const error = ref(null)
  
  /**
   * 处理页面邀请参数
   */
  const processPageParams = async (options) => {
    isProcessing.value = true
    error.value = null
    
    try {
      inviteInfo.value = await handleInviteLink(options)
      
      if (inviteInfo.value?.expired) {
        error.value = '邀请链接已过期'
        inviteInfo.value = null
      }
      
    } catch (e) {
      error.value = e.message
      inviteInfo.value = null
    } finally {
      isProcessing.value = false
    }
    
    return inviteInfo.value
  }
  
  /**
   * 创建邀请
   */
  const createInvite = async (params) => {
    isProcessing.value = true
    
    try {
      const code = generateInviteCode(params)
      const link = await createInviteDeepLink({
        ...params,
        inviteCode: code
      })
      
      return { code, link }
      
    } finally {
      isProcessing.value = false
    }
  }
  
  /**
   * 加入房间
   */
  const joinRoom = async () => {
    if (!inviteInfo.value) {
      error.value = '无效的邀请信息'
      return null
    }
    
    isProcessing.value = true
    
    try {
      return await joinPKRoom(inviteInfo.value)
    } finally {
      isProcessing.value = false
    }
  }
  
  return {
    inviteInfo,
    isProcessing,
    error,
    processPageParams,
    createInvite,
    joinRoom,
    generateShareConfig
  }
}
