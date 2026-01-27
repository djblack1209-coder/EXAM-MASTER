/**
 * 微信小程序登录云函数
 * 
 * 功能：
 * 1. 接收微信 code，换取 openid
 * 2. 查询或创建用户
 * 3. 生成 JWT token
 * 4. 返回用户信息
 * 
 * 环境变量要求：
 * - WX_APPID: 微信小程序 AppID
 * - WX_SECRET_PLACEHOLDER
 * - JWT_SECRET_PLACEHOLDER
 * 
 * 请求参数：
 * - code: string (必填) - 微信登录凭证
 * 
 * 返回格式：
 * { code: 0, data: { userId, token, userInfo }, message: 'success' }
 * 
 * @version 2.0.0
 * @author EXAM-MASTER Team
 */

import cloud from '@lafjs/cloud'
import crypto from 'crypto'

// ==================== 环境变量配置 ====================
// 重要：请确保在后端控制台配置了正确的环境变量
// 安全提示：敏感信息必须通过环境变量配置，禁止硬编码
const WX_APPID = process.env.WX_APPID || ''
const WX_SECRET_PLACEHOLDER
const JWT_SECRET_PLACEHOLDER
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000 // 7天
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'warn' : 'info')

// 获取数据库实例
const db = cloud.database()

// ==================== 日志工具 ====================
const logger = {
  info: (...args: any[]) => { if (LOG_LEVEL !== 'warn' && LOG_LEVEL !== 'error') console.log(...args) },
  warn: (...args: any[]) => { if (LOG_LEVEL !== 'error') console.warn(...args) },
  error: (...args: any[]) => console.error(...args)
}

// ==================== 参数校验 ====================
function validateLoginParams(data: any): { valid: boolean; error?: string; sanitized?: any } {
  const { code } = data || {}
  
  // 1. 必填检查
  if (!code) {
    return { valid: false, error: 'code 不能为空' }
  }
  
  // 2. 类型检查
  if (typeof code !== 'string') {
    return { valid: false, error: 'code 必须是字符串' }
  }
  
  // 3. 长度检查（微信 code 通常在 32-100 字符之间）
  if (code.length < 10 || code.length > 200) {
    return { valid: false, error: 'code 长度不合法' }
  }
  
  // 4. 格式检查（只允许字母数字和部分特殊字符）
  if (!/^[a-zA-Z0-9_-]+$/.test(code)) {
    return { valid: false, error: 'code 格式不合法' }
  }
  
  return { valid: true, sanitized: { code: code.trim() } }
}

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  logger.info(`[${requestId}] 登录请求开始`)
  logger.info(`[${requestId}] 使用 AppID: ${WX_APPID.substring(0, 6)}...`)

  try {
    // 1. 参数校验（后端必须再校验一遍，不信任前端）
    const validation = validateLoginParams(ctx.body)
    
    if (!validation.valid) {
      logger.warn(`[${requestId}] 参数错误: ${validation.error}`)
      return {
        code: 400,
        message: `参数错误: ${validation.error}`,
        requestId
      }
    }
    
    const { code } = validation.sanitized

    // 2. 调用微信接口获取 openid
    logger.info(`[${requestId}] 开始获取微信 openid...`)

    const wxLoginUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET_PLACEHOLDER

    const wxRes = await cloud.fetch({
      url: wxLoginUrl,
      method: 'GET',
      timeout: 10000
    })

    const wxData = wxRes.data

    if (wxData.errcode) {
      logger.error(`[${requestId}] 微信登录失败:`, wxData)

      // 提供更详细的错误信息
      let errorMsg = wxData.errmsg
      if (wxData.errcode === 40029) {
        errorMsg = 'code 无效，请重新获取'
      } else if (wxData.errcode === 45011) {
        errorMsg = '请求频率过高，请稍后再试'
      } else if (wxData.errcode === 40125) {
        errorMsg = 'AppSecret 配置错误'
      } else if (wxData.errcode === -1) {
        errorMsg = '微信服务繁忙，请稍后再试'
      }

      return {
        code: 401,
        message: `微信登录失败: ${errorMsg}`,
        errcode: wxData.errcode,
        requestId
      }
    }

    const { openid, session_key, unionid } = wxData

    if (!openid) {
      logger.error(`[${requestId}] 获取 openid 失败`)
      return {
        code: 401,
        message: '获取用户标识失败',
        requestId
      }
    }

    logger.info(`[${requestId}] 获取 openid 成功: ${openid.substring(0, 10)}...`)

    // 3. 查询或创建用户
    const usersCollection = db.collection('users')
    let user = await usersCollection.where({ openid }).getOne()

    const now = Date.now()
    let isNewUser = false

    if (!user.data) {
      // 新用户，创建记录
      isNewUser = true
      const newUser = {
        openid,
        unionid: unionid || null,
        nickname: `考研学子${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
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
        updated_at: now
      }

      const insertRes = await usersCollection.add(newUser)
      user = { data: { _id: insertRes.id, ...newUser } }

      logger.info(`[${requestId}] 新用户创建成功: ${insertRes.id}`)
    } else {
      // 老用户，更新登录时间
      await usersCollection.doc(user.data._id).update({
        updated_at: now,
        // 如果有 unionid 且之前没有，则更新
        ...(unionid && !user.data.unionid ? { unionid } : {})
      })

      logger.info(`[${requestId}] 老用户登录: ${user.data._id}`)
    }

    // 4. 生成 JWT token
    const userId = user.data._id
    const token = generateJWT({
      userId,
      openid,
      role: user.data.role
    })

    // 5. 计算执行耗时
    const duration = Date.now() - startTime
    logger.info(`[${requestId}] 登录成功，耗时: ${duration}ms`)

    // 6. 返回结果
    return {
      code: 0,
      data: {
        userId,
        token,
        isNewUser,
        userInfo: {
          _id: userId,
          id: userId,
          nickname: user.data.nickname,
          avatar_url: user.data.avatar_url,
          role: user.data.role,
          streak_days: user.data.streak_days,
          total_study_days: user.data.total_study_days,
          total_questions: user.data.total_questions,
          correct_questions: user.data.correct_questions,
          settings: user.data.settings
        }
      },
      message: isNewUser ? '注册成功' : '登录成功',
      requestId,
      duration
    }

  } catch (error) {
    const duration = Date.now() - startTime
    logger.error(`[${requestId}] 登录异常:`, error)

    return {
      code: 500,
      message: '服务器内部错误',
      error: error.message,
      requestId,
      duration
    }
  }
}

/**
 * 生成 JWT Token
 * @param {Object} payload - 载荷数据
 * @returns {string} JWT token
 */
function generateJWT(payload) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  }

  const now = Date.now()
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + JWT_EXPIRES_IN
  }

  const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64url')
  const payloadBase64 = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url')

  const signature = crypto
    .createHmac('sha256', JWT_SECRET_PLACEHOLDER
    .update(`${headerBase64}.${payloadBase64}`)
    .digest('base64url')

  return `${headerBase64}.${payloadBase64}.${signature}`
}

/**
 * 验证 JWT Token（供其他云函数使用）
 * @param {string} token - JWT token
 * @returns {Object|null} 解析后的载荷或 null
 */
export function verifyJWT(token) {
  try {
    if (!token) return null

    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [headerBase64, payloadBase64, signature] = parts

    // 验证签名
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET_PLACEHOLDER
      .update(`${headerBase64}.${payloadBase64}`)
      .digest('base64url')

    if (signature !== expectedSignature) {
      logger.warn('JWT 签名验证失败')
      return null
    }

    // 解析载荷
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString())

    // 检查过期
    if (payload.exp && payload.exp < Date.now()) {
      logger.warn('JWT 已过期')
      return null
    }

    return payload
  } catch (error) {
    logger.error('JWT 验证异常:', error)
    return null
  }
}
