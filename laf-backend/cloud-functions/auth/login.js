/**
 * 微信小程序登录云函数
 * 
 * 功能：
 * 1. 接收微信 code，换取 openid
 * 2. 查询或创建用户
 * 3. 生成 JWT token
 * 4. 返回用户信息
 * 
 * 请求参数：
 * - code: string (必填) - 微信登录凭证
 * 
 * 返回格式：
 * { code: 0, data: { userId, token, userInfo }, message: 'success' }
 */

import cloud from '@lafjs/cloud'
import crypto from 'crypto'

// 环境变量配置
const WX_APPID = process.env.WX_APPID || 'wxd634d50ad63e14ed'
const WX_SECRET_PLACEHOLDER
const JWT_SECRET_PLACEHOLDER
const JWT_EXPIRES_IN = 7 * 24 * 60 * 60 * 1000 // 7天

// 获取数据库实例
const db = cloud.database()

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  console.log(`[${requestId}] 登录请求开始`)
  
  try {
    // 1. 参数校验
    const { code } = ctx.body || {}
    
    if (!code || typeof code !== 'string') {
      console.warn(`[${requestId}] 参数错误: code 无效`)
      return {
        code: 400,
        message: '参数错误: code 不能为空',
        requestId
      }
    }
    
    // 2. 调用微信接口获取 openid
    console.log(`[${requestId}] 开始获取微信 openid...`)
    
    const wxLoginUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET_PLACEHOLDER
    
    const wxRes = await cloud.fetch({
      url: wxLoginUrl,
      method: 'GET'
    })
    
    const wxData = wxRes.data
    
    if (wxData.errcode) {
      console.error(`[${requestId}] 微信登录失败:`, wxData)
      return {
        code: 401,
        message: `微信登录失败: ${wxData.errmsg}`,
        requestId
      }
    }
    
    const { openid, session_key, unionid } = wxData
    
    if (!openid) {
      console.error(`[${requestId}] 获取 openid 失败`)
      return {
        code: 401,
        message: '获取用户标识失败',
        requestId
      }
    }
    
    console.log(`[${requestId}] 获取 openid 成功: ${openid.substring(0, 10)}...`)
    
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
      
      console.log(`[${requestId}] 新用户创建成功: ${insertRes.id}`)
    } else {
      // 老用户，更新登录时间
      await usersCollection.doc(user.data._id).update({
        updated_at: now,
        // 如果有 unionid 且之前没有，则更新
        ...(unionid && !user.data.unionid ? { unionid } : {})
      })
      
      console.log(`[${requestId}] 老用户登录: ${user.data._id}`)
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
    console.log(`[${requestId}] 登录成功，耗时: ${duration}ms`)
    
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
    console.error(`[${requestId}] 登录异常:`, error)
    
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
      console.warn('JWT 签名验证失败')
      return null
    }
    
    // 解析载荷
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString())
    
    // 检查过期
    if (payload.exp && payload.exp < Date.now()) {
      console.warn('JWT 已过期')
      return null
    }
    
    return payload
  } catch (error) {
    console.error('JWT 验证异常:', error)
    return null
  }
}
