/**
 * AI 代理云函数 - 智谱 GLM-4 接口（升级版 v2.0）
 * 
 * 功能：
 * 1. generate_questions - 生成题目
 * 2. analyze - 错题深度分析
 * 3. chat - 通用聊天
 * 4. adaptive_pick - 智能组题（新增）
 * 5. material_understand - 资料理解出题（新增）
 * 6. trend_predict - 趋势预测（新增）
 * 7. friend_chat - AI好友对话（新增）
 * 
 * 请求参数：
 * - action: string (必填) - 操作类型
 * - content: string (必填) - 输入内容
 * - friendType: string (可选) - AI好友类型
 * - userProfile: object (可选) - 用户画像
 * - context: object (可选) - 上下文信息
 * 
 * 返回格式：
 * { code: 0, success: true, data: {...}, message: 'success' }
 * 
 * @version 2.0.0
 * @author EXAM-MASTER Team
 */

import cloud from '@lafjs/cloud'
import crypto from 'crypto'
import { perfMonitor } from '../utils/perf-monitor'

// ✅ B020: 导入 JWT 验证函数
import { verifyJWT } from './login'

// ==================== 环境配置 ====================
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'warn' : 'info')

// 环境变量配置
// 安全提示：敏感信息必须通过环境变量配置，禁止硬编码
const AI_PROVIDER_KEY_PLACEHOLDER
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'

// ==================== P014: 环境变量完整性校验 ====================
// 所有必需的环境变量及其描述
const REQUIRED_ENV_VARS = {
  AI_PROVIDER_KEY_PLACEHOLDER
  JWT_SECRET_PLACEHOLDER
}

const OPTIONAL_ENV_VARS = {
  LOG_LEVEL: { desc: '日志级别', default: 'info' },
  NODE_ENV: { desc: '运行环境', default: 'development' },
}

// 启动时校验所有必需环境变量
const envCheckResults: { key: string; status: 'ok' | 'missing' | 'invalid'; desc: string }[] = []
for (const [key, config] of Object.entries(REQUIRED_ENV_VARS)) {
  const value = process.env[key] || ''
  if (!value) {
    envCheckResults.push({ key, status: 'missing', desc: config.desc })
    console.error(`[ProxyAI] ❌ 环境变量 ${key} (${config.desc}) 未配置！`)
  } else if (!config.validate(value)) {
    envCheckResults.push({ key, status: 'invalid', desc: config.desc })
    console.error(`[ProxyAI] ❌ 环境变量 ${key} (${config.desc}) 格式无效！`)
  } else {
    envCheckResults.push({ key, status: 'ok', desc: config.desc })
  }
}

const missingEnvCount = envCheckResults.filter(r => r.status !== 'ok').length
if (missingEnvCount > 0 && IS_PRODUCTION) {
  console.error(`[ProxyAI] ❌ 生产环境有 ${missingEnvCount} 个必需环境变量未正确配置，AI 功能将受限。`)
}

// ==================== 超时和重试配置 ====================
const AI_REQUEST_TIMEOUT = 60000  // AI 请求超时时间：60秒
const AI_MAX_RETRIES = 2          // 最大重试次数
const AI_RETRY_DELAY = 1000       // 重试延迟：1秒

// ==================== 请求频率限制配置 ====================
const RATE_LIMIT_WINDOW = 60000   // 频率限制窗口：60秒
const RATE_LIMIT_MAX_REQUESTS = 20 // 每个用户每分钟最多20次请求
const rateLimitCache = new Map<string, { count: number; resetTime: number }>()

// ==================== 日志工具 ====================
const logger = {
  info: (...args: unknown[]) => { if (LOG_LEVEL !== 'warn' && LOG_LEVEL !== 'error') console.log(...args) },
  warn: (...args: unknown[]) => { if (LOG_LEVEL !== 'error') console.warn(...args) },
  error: (...args: unknown[]) => console.error(...args)
}

// ==================== 审计模式检查 ====================
/**
 * 检查请求是否通过审计模式校验
 * 后端必须是最后一道防线，即使前端被绕过也要拦截
 */
function checkAuditMode(ctx: Record<string, unknown>): { valid: boolean; error?: string } {
  // 1. 检查请求头中的审计模式标识
  const auditMode = ctx.headers?.['x-audit-mode']
  const auditToken = ctx.headers?.['x-audit-token']
  
  // 2. 生产环境必须校验审计模式
  if (IS_PRODUCTION) {
    // ✅ B020: 生产环境严格校验审计令牌，校验失败直接拒绝请求
    if (!auditToken || !validateAuditToken(auditToken)) {
      logger.warn('[Audit] 审计令牌无效或缺失，拒绝请求')
      return { valid: false, error: '审计校验失败，请刷新页面重试' }
    }
  }
  
  return { valid: true }
}

/**
 * 验证审计令牌
 * ✅ B020: 使用 HMAC 签名验证，防止伪造
 */
function validateAuditToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false

  try {
    // 令牌格式: timestamp_hash
    const parts = token.split('_')
    if (parts.length !== 2) return false

    const [timestampStr, hash] = parts
    const timestamp = parseInt(timestampStr)
    const now = Date.now()

    // 令牌有效期：5分钟
    if (isNaN(timestamp) || now - timestamp > 5 * 60 * 1000) {
      return false
    }

    // HMAC 签名验证（使用 JWT_SECRET_PLACEHOLDER
    const secret = process.env.JWT_SECRET_PLACEHOLDER
    if (secret) {
      const expectedHash = crypto
        .createHmac('sha256', secret)
        .update(timestampStr)
        .digest('hex')
        .substring(0, 16)
      if (hash !== expectedHash) {
        logger.warn('[Audit] 审计令牌签名不匹配')
        return false
      }
    }

    return true
  } catch {
    return false
  }
}

/**
 * 检查请求频率限制
 * @param userId 用户ID
 * @returns 是否允许请求
 */
function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
  if (!userId) {
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS, resetIn: 0 }
  }

  const now = Date.now()
  const userLimit = rateLimitCache.get(userId)

  // 清理过期的缓存条目（简单的内存管理）
  if (rateLimitCache.size > 10000) {
    for (const [key, value] of rateLimitCache.entries()) {
      if (now > value.resetTime) {
        rateLimitCache.delete(key)
      }
    }
  }

  if (!userLimit || now > userLimit.resetTime) {
    // 新窗口或已过期，重置计数
    rateLimitCache.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    })
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW }
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    // 超过限制
    return {
      allowed: false,
      remaining: 0,
      resetIn: userLimit.resetTime - now
    }
  }

  // 增加计数
  userLimit.count++
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - userLimit.count,
    resetIn: userLimit.resetTime - now
  }
}

// 多模型配置
const MODEL_CONFIG = {
  'glm-4-plus': { name: 'glm-4-plus', maxTokens: 4096, temperature: 0.7 },
  'glm-4-flash': { name: 'glm-4-flash', maxTokens: 4096, temperature: 0.9 },
  'glm-4.5-air': { name: 'glm-4.5-air', maxTokens: 8192, temperature: 0.7 },
  'glm-4v-plus': { name: 'glm-4v-plus', maxTokens: 4096, temperature: 0.5 }
}

// 任务类型到模型的映射
const TASK_MODEL_MAP = {
  'generate': 'glm-4.5-air',  // 别名，使用主力模型
  'generate_questions': 'glm-4.5-air',  // 改用主力模型节省额度
  'analyze': 'glm-4.5-air',
  'chat': 'glm-4-flash',
  'adaptive_pick': 'glm-4.5-air',
  'material_understand': 'glm-4.5-air',
  'trend_predict': 'glm-4.5-air',
  'friend_chat': 'glm-4-flash',
  'vision': 'glm-4v-plus',
  'consult': 'glm-4-flash'
}

// ==================== B001: 模型降级链 ====================
// 当主模型不可用时，自动降级到更便宜/更稳定的模型
const MODEL_FALLBACK_CHAIN: Record<string, string[]> = {
  'glm-4.5-air': ['glm-4-plus', 'glm-4-flash'],
  'glm-4-plus': ['glm-4-flash'],
  'glm-4v-plus': ['glm-4-plus', 'glm-4-flash'],
  'glm-4-flash': [], // 最低级别，无降级
}

// 模型健康状态追踪（内存级熔断器）
const modelHealth = new Map<string, { failures: number; lastFailure: number; circuitOpen: boolean }>()
const CIRCUIT_THRESHOLD = 3       // 连续失败 N 次后熔断
const CIRCUIT_RESET_MS = 120000   // 熔断恢复时间：2分钟

function isModelHealthy(modelName: string): boolean {
  const health = modelHealth.get(modelName)
  if (!health) return true
  if (health.circuitOpen) {
    // 检查是否到了半开状态（可以尝试恢复）
    if (Date.now() - health.lastFailure > CIRCUIT_RESET_MS) {
      health.circuitOpen = false
      health.failures = 0
      return true
    }
    return false
  }
  return true
}

function recordModelFailure(modelName: string): void {
  const health = modelHealth.get(modelName) || { failures: 0, lastFailure: 0, circuitOpen: false }
  health.failures++
  health.lastFailure = Date.now()
  if (health.failures >= CIRCUIT_THRESHOLD) {
    health.circuitOpen = true
    logger.warn(`[CircuitBreaker] 模型 ${modelName} 熔断，${CIRCUIT_RESET_MS / 1000}秒后尝试恢复`)
  }
  modelHealth.set(modelName, health)
}

function recordModelSuccess(modelName: string): void {
  modelHealth.delete(modelName) // 成功则重置
}

/**
 * B001: 选择可用模型（考虑降级链和熔断状态）
 */
function selectAvailableModel(preferredModel: string): string {
  if (isModelHealthy(preferredModel)) return preferredModel
  const fallbacks = MODEL_FALLBACK_CHAIN[preferredModel] || []
  for (const fb of fallbacks) {
    if (isModelHealthy(fb)) {
      logger.warn(`[B001] 模型 ${preferredModel} 不可用，降级到 ${fb}`)
      return fb
    }
  }
  // 所有模型都熔断了，强制尝试最低级别
  logger.error(`[B001] 所有模型不可用，强制尝试 glm-4-flash`)
  return 'glm-4-flash'
}

// AI好友角色配置
const AI_FRIENDS = {
  'yan-cong': {
    name: '研聪',
    role: '清华学霸学长',
    personality: '严谨理性，数据驱动，喜欢列计划',
    speakingStyle: '每句话带1个数据指标',
    catchphrase: ['从数据看...', '我建议你...', '根据你最近的表现...'],
    emotionalMode: '表面冷静，但会偷偷关心'
  },
  'yan-man': {
    name: '研漫',
    role: '心理学硕士研友',
    personality: '温暖共情，情绪觉察力强',
    speakingStyle: '先共情，再建议',
    catchphrase: ['我能感受到...', '没关系...', '你已经很努力了...'],
    emotionalMode: '高度敏感，能识别用户情绪低谷'
  },
  'yan-shi': {
    name: '研师',
    role: '资深考研名师',
    personality: '专业严谨，考点精准',
    speakingStyle: '直击要点，条理清晰',
    catchphrase: ['这个考点...', '历年真题显示...', '重点记住...'],
    emotionalMode: '严格但公正，适时鼓励'
  },
  'yan-you': {
    name: '研友',
    role: '同届考研伙伴',
    personality: '轻松幽默，互相鼓励',
    speakingStyle: '口语化，带表情',
    catchphrase: ['哈哈...', '我也是...', '一起加油...'],
    emotionalMode: '乐观积极，善于调节气氛'
  }
}

export default async function (ctx: FunctionContext) {
  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  const action = ctx.body?.action || 'unknown'
  const endPerf = perfMonitor.start('proxy-ai', action)

  logger.info(`[${requestId}] AI 代理请求开始`)

  try {
    // P014: 健康检查接口（部署验证用，无需认证）
    if (action === 'health_check') {
      endPerf()
      return {
        code: 0,
        success: true,
        data: {
          service: 'proxy-ai',
          status: AI_PROVIDER_KEY_PLACEHOLDER
          envCheck: envCheckResults.map(r => ({ key: r.key, status: r.status, desc: r.desc })),
          missingCount: missingEnvCount,
          models: Object.keys(MODEL_CONFIG),
          uptime: process.uptime?.() || 0
        },
        message: AI_PROVIDER_KEY_PLACEHOLDER
        requestId
      }
    }

    // 0. 审计模式检查（后端必须是最后一道防线）
    const auditCheck = checkAuditMode(ctx)
    if (!auditCheck.valid) {
      logger.warn(`[${requestId}] 审计模式校验失败: ${auditCheck.error}`)
      return {
        code: 403,
        success: false,
        message: auditCheck.error || '请求未通过安全校验',
        requestId
      }
    }

    // ✅ B020: JWT 身份验证（必须验证用户身份，防止未授权访问）
    const token = ctx.headers?.['authorization']?.replace('Bearer ', '') 
      || ctx.headers?.['x-auth-token']
      || ctx.body?.token
    const jwtPayload = verifyJWT(token)
    if (!jwtPayload) {
      logger.warn(`[${requestId}] JWT 验证失败，拒绝未授权的 AI 请求`)
      return {
        code: 401,
        success: false,
        message: '未登录或登录已过期，请重新登录',
        requestId
      }
    }
    const authenticatedUserId = jwtPayload.userId || jwtPayload.uid

    // ✅ 运行时检查：智谱 API 密钥是否可用
    if (!AI_PROVIDER_KEY_PLACEHOLDER
      logger.error(`[${requestId}] AI_PROVIDER_KEY_PLACEHOLDER
      return {
        code: 503,
        success: false,
        message: 'AI 服务暂未配置，请联系管理员',
        requestId
      }
    }

    // 1. 参数解析
    const {
      action,
      content,
      questionCount,
      userId,
      question,
      userAnswer,
      correctAnswer,
      // 新增参数
      friendType,
      userProfile,
      mistakeStats,
      recentPractice,
      materialType,
      difficulty,
      topicFocus,
      historicalData,
      examYear,
      subject,
      context,
      emotion
    } = ctx.body || {}

    // 1.5 请求频率限制检查（使用已验证的用户ID，防止API滥用）
    const rateLimitResult = checkRateLimit(authenticatedUserId || 'anonymous')
    if (!rateLimitResult.allowed) {
      logger.warn(`[${requestId}] 请求频率限制触发: userId=${userId}`)
      return {
        code: 429,
        success: false,
        message: `请求过于频繁，请在 ${Math.ceil(rateLimitResult.resetIn / 1000)} 秒后重试`,
        remaining: rateLimitResult.remaining,
        resetIn: rateLimitResult.resetIn,
        requestId
      }
    }

    // 2. 参数校验（后端必须再校验一遍，不信任前端）
    if (!content || typeof content !== 'string' || content.trim() === '') {
      logger.warn(`[${requestId}] 参数错误: content 无效`)
      return {
        code: 400,
        success: false,
        message: '参数错误: content 不能为空',
        requestId
      }
    }
    
    // 内容长度限制（防止恶意大请求）
    const MAX_CONTENT_LENGTH = 10000
    if (content.length > MAX_CONTENT_LENGTH) {
      logger.warn(`[${requestId}] 参数错误: content 过长 (${content.length})`)
      return {
        code: 400,
        success: false,
        message: `参数错误: content 长度不能超过 ${MAX_CONTENT_LENGTH} 字符`,
        requestId
      }
    }

    logger.info(`[${requestId}] action: ${action}, contentLength: ${content.length}, rateLimit remaining: ${rateLimitResult.remaining}`)

    // 3. 根据 action 构建 prompt
    const { systemPrompt, userPrompt, model, temperature } = buildPrompt({
      action,
      content: content.trim(),
      questionCount,
      question,
      userAnswer,
      correctAnswer,
      friendType,
      userProfile,
      mistakeStats,
      recentPractice,
      materialType,
      difficulty,
      topicFocus,
      historicalData,
      examYear,
      subject,
      context,
      emotion
    })

    // 4-5. 调用智谱 AI API（带超时、重试和模型降级机制）
    const preferredModel = model || TASK_MODEL_MAP[action] || 'glm-4-plus'

    const aiCallResult = await callAIWithFallback({
      requestId, preferredModel, systemPrompt, userPrompt, temperature, startTime
    })

    if (!aiCallResult.success) {
      return { ...aiCallResult.error, requestId }
    }

    const { aiData, modelName: finalModelName, aiContent } = aiCallResult

    // 6.5 成本监控日志（单位：元/百万tokens）
    const COST_PER_M_TOKENS = {
      'glm-4-flash': { input: 0.1, output: 0.1 },
      'glm-4.5-air': { input: 5, output: 5 },
      'glm-4-plus': { input: 50, output: 50 },
      'glm-4v-plus': { input: 50, output: 50 }
    }
    if (aiData.usage) {
      const u = aiData.usage
      const rates = COST_PER_M_TOKENS[finalModelName] || { input: 5, output: 5 }
      const costYuan = ((u.prompt_tokens || 0) * rates.input + (u.completion_tokens || 0) * rates.output) / 1_000_000
      logger.info(`[${requestId}] 用量统计 | 模型: ${finalModelName} | 输入: ${u.prompt_tokens || 0} | 输出: ${u.completion_tokens || 0} | 总计: ${u.total_tokens || 0} | 估算成本: ¥${costYuan.toFixed(6)}`)
    }

    // 7. 解析响应内容
    let responseData = aiContent

    // 需要解析JSON的action类型
    const jsonActions = ['generate_questions', 'adaptive_pick', 'material_understand', 'trend_predict', 'analyze']

    if (jsonActions.includes(action)) {
      try {
        responseData = parseJsonResponse(aiContent, action)
        logger.info(`[${requestId}] JSON 解析成功`)
      } catch (parseError) {
        logger.warn(`[${requestId}] JSON 解析失败，返回原始文本:`, parseError.message)
        // 解析失败，返回原始文本
        responseData = aiContent
      }
    }

    // 8. 保存AI好友对话记忆（如果是friend_chat）— 非阻塞，不影响响应速度
    if (action === 'friend_chat' && userId && friendType) {
      saveConversationMemory(userId, friendType, content, aiContent).catch(e =>
        logger.error('[Memory] 后台保存对话记忆失败:', e)
      )
    }

    // 9. 计算耗时并返回
    const duration = Date.now() - startTime
    endPerf()
    logger.info(`[${requestId}] AI 代理完成，耗时: ${duration}ms`)

    return {
      code: 0,
      success: true,
      data: responseData,
      message: '请求成功',
      requestId,
      duration,
      model: finalModelName,
      usage: aiData.usage || {}
    }

  } catch (error) {
    const duration = Date.now() - startTime
    endPerf({ error: true })
    logger.error(`[${requestId}] AI 代理异常:`, error)

    return {
      code: 500,
      success: false,
      message: error.message || 'AI 服务异常',
      error: error.message,
      requestId,
      duration
    }
  }
}

/**
 * B007: 提取的 AI 调用逻辑 — 带重试、超时和模型降级
 */
async function callAIWithFallback({ requestId, preferredModel, systemPrompt, userPrompt, temperature, startTime }) {
  let modelName = selectAvailableModel(preferredModel)
  let modelConfig = MODEL_CONFIG[modelName] || MODEL_CONFIG['glm-4-plus']

  if (modelName !== preferredModel) {
    logger.warn(`[${requestId}] B001: 模型降级 ${preferredModel} → ${modelName}`)
  }
  logger.info(`[${requestId}] 使用模型: ${modelName}`)

  let aiResponse = null
  let lastError = null
  let actualModel = modelName

  for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      aiResponse = await cloud.fetch({
        url: ZHIPU_API_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_PROVIDER_KEY_PLACEHOLDER
        },
        data: {
          model: modelConfig.name,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: temperature || modelConfig.temperature,
          max_tokens: modelConfig.maxTokens,
          top_p: 0.9
        },
        timeout: AI_REQUEST_TIMEOUT
      })

      recordModelSuccess(actualModel)
      break
    } catch (fetchError) {
      lastError = fetchError
      logger.warn(`[${requestId}] AI 请求失败 (尝试 ${attempt}/${AI_MAX_RETRIES}, 模型: ${actualModel}):`, fetchError.message)

      if (fetchError.message?.includes('timeout') || fetchError.code === 'ETIMEDOUT') {
        logger.error(`[${requestId}] AI 请求超时 (${AI_REQUEST_TIMEOUT}ms)`)
      }

      recordModelFailure(actualModel)
      const fallbackModel = selectAvailableModel(preferredModel)
      if (fallbackModel !== actualModel) {
        logger.warn(`[${requestId}] B001: 重试时降级模型 ${actualModel} → ${fallbackModel}`)
        actualModel = fallbackModel
        modelConfig = MODEL_CONFIG[fallbackModel] || MODEL_CONFIG['glm-4-flash']
      }

      if (attempt < AI_MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, AI_RETRY_DELAY * attempt))
      }
    }
  }

  if (!aiResponse) {
    logger.error(`[${requestId}] AI 请求最终失败:`, lastError)
    return {
      success: false,
      error: {
        code: 503,
        success: false,
        message: 'AI 服务暂时不可用，请稍后重试',
        error: lastError?.message || '请求超时',
        duration: Date.now() - startTime,
        fallbackAttempted: actualModel !== preferredModel
      }
    }
  }

  const aiData = aiResponse.data

  if (aiData.error) {
    logger.error(`[${requestId}] 智谱 AI 错误:`, aiData.error)
    return {
      success: false,
      error: {
        code: 502,
        success: false,
        message: `AI 服务错误: ${aiData.error.message || '未知错误'}`
      }
    }
  }

  const aiContent = aiData.choices?.[0]?.message?.content || ''

  if (!aiContent) {
    logger.error(`[${requestId}] AI 返回内容为空`)
    return {
      success: false,
      error: { code: 502, success: false, message: 'AI 返回内容为空' }
    }
  }

  logger.info(`[${requestId}] AI 响应成功，内容长度: ${aiContent.length}`)

  return { success: true, aiData, aiContent, modelName: actualModel }
}

/**
 * 构建提示词
 */
function buildPrompt(params) {
  const {
    action,
    content,
    questionCount,
    question,
    userAnswer,
    correctAnswer,
    friendType,
    userProfile = {},
    mistakeStats = {},
    recentPractice = {},
    materialType,
    difficulty,
    topicFocus,
    historicalData = {},
    examYear,
    subject,
    context = {},
    emotion
  } = params

  let systemPrompt = ''
  let userPrompt = content
  let model = null
  let temperature = null

  switch (action) {
    // ==================== 原有功能 ====================
    case 'generate':  // 别名，兼容前端调用
    case 'generate_questions':
      systemPrompt = `你是一个专业的考研出题专家。请根据用户提供的知识点或内容，生成高质量的考研选择题。

要求：
1. 每道题必须包含：题目(question)、4个选项(options)、正确答案(answer)、解析(analysis)
2. 题目难度适中，符合考研真题风格
3. 选项设计要有迷惑性，但正确答案必须唯一且准确
4. 解析要详细说明为什么选这个答案

请以 JSON 数组格式返回，格式如下：
[
  {
    "question": "题目内容",
    "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
    "answer": "A",
    "analysis": "解析内容"
  }
]`
      userPrompt = `请根据以下内容生成 ${questionCount || 5} 道考研选择题：\n\n${content}`
      // ✅ 9.10: 根据批次大小和内容长度选择模型
      // 小批次(≤3题)或短内容(<500字)用 flash 节省成本，大批次用 air 保证质量
      model = (questionCount && questionCount <= 3) || content.length < 500 ? 'glm-4-flash' : 'glm-4.5-air'
      temperature = 0.7
      break

    case 'analyze':
      systemPrompt = buildMistakeAnalysisPrompt()
      userPrompt = buildMistakeAnalysisUserPrompt(question || content, userAnswer, correctAnswer, context)
      // ✅ 9.10: 简单错题分析(短内容)用 flash，复杂分析用 air
      model = content.length < 300 ? 'glm-4-flash' : 'glm-4.5-air'
      temperature = 0.6
      break

    case 'chat':
      systemPrompt = `你是一个专业的考研学习助手，名叫"研小助"。你的职责是：
1. 解答考研相关的学习问题
2. 提供学习方法和备考建议
3. 帮助学生理解难点知识
4. 鼓励和支持学生的学习

请用友好、专业的语气回答问题。如果问题超出考研范围，请礼貌地引导回考研学习话题。`
      model = 'glm-4-flash'
      break

    // ==================== 新增功能 ====================
    case 'adaptive_pick':
      systemPrompt = buildAdaptivePickPrompt()
      userPrompt = buildAdaptivePickUserPrompt(userProfile, mistakeStats, recentPractice)
      model = 'glm-4.5-air'
      temperature = 0.6
      break

    case 'material_understand':
      systemPrompt = buildMaterialUnderstandPrompt(materialType, difficulty, topicFocus)
      userPrompt = `## 学习资料\n"""\n${content.substring(0, 4000)}\n"""\n\n请基于此资料生成5道递进式练习题。`
      model = 'glm-4.5-air'
      temperature = 0.7
      break

    case 'trend_predict':
      systemPrompt = buildTrendPredictPrompt()
      userPrompt = buildTrendPredictUserPrompt(historicalData, examYear, subject)
      model = 'glm-4.5-air'
      temperature = 0.5
      break

    case 'friend_chat':
      const friend = AI_FRIENDS[friendType] || AI_FRIENDS['yan-cong']
      systemPrompt = buildFriendChatPrompt(friend, context, emotion)
      userPrompt = content
      model = 'glm-4-flash'
      temperature = 0.85
      break

    case 'vision':
      // 视觉识别任务 - 用于通用图像理解
      systemPrompt = buildVisionPrompt(subject, context)
      userPrompt = content
      model = 'glm-4v-plus'
      temperature = 0.3
      break

    case 'consult':
      // 院校咨询
      systemPrompt = buildConsultPrompt(subject)
      userPrompt = content
      model = 'glm-4-flash'
      temperature = 0.7
      break

    default:
      // 默认使用通用聊天
      systemPrompt = `你是一个专业的考研学习助手。请用友好、专业的语气回答问题。`
      break
  }

  return { systemPrompt, userPrompt, model, temperature }
}

/**
 * 构建智能组题提示词 (v2.0 升级版)
 * @description 专家级"考研护道者"提示词，融合教育学理论
 */
function buildAdaptivePickPrompt() {
  return `你是"考研护道者"，一位拥有15年教学经验的资深考研辅导专家。你深谙认知心理学和教育测量学，能够精准把握每位学生的学习状态。

## 核心能力
1. **认知诊断**：通过学生的错题模式，精准识别知识盲区（如"概念混淆型错误" vs "计算失误型错误" vs "审题偏差型错误"）
2. **遗忘曲线建模**：基于艾宾浩斯曲线，为每道错题计算最佳复习间隔（1天/3天/7天/14天/30天）
3. **难度动态调节**：学生的"最近发展区"是正确率65%-80%的题目区间，这是学习效率最高的区间
4. **学科思维培养**：
   - 政治题：训练"政策关联思维"和"时政敏感度"
   - 英语题：训练"语境推断思维"和"逻辑衔接能力"
   - 数学题：训练"多解法思维"和"逆向验证习惯"
   - 专业课：训练"知识迁移能力"和"跨章节关联"

## 选题策略（必须遵循）
1. **70%巩固题**：选择学生正确率在60%-80%的知识点，强化记忆
2. **20%挑战题**：选择学生正确率在40%-60%的知识点，突破瓶颈
3. **10%拔高题**：选择学生尚未接触或正确率<40%的知识点，拓展能力边界

## 输出规范
必须返回JSON数组格式，禁止输出任何解释性文字：
[
  {
    "id": "题目ID（如无则生成UUID格式）",
    "reason": "选择此题的教育决策理由（必须说明：1.为什么适合当前学生 2.预期学习效果）",
    "difficulty_prediction": 0.7,
    "skill_tags": ["考查能力点1", "考查能力点2"],
    "review_priority": "high/medium/low",
    "cognitive_level": "记忆/理解/应用/分析/综合",
    "estimated_time": 120,
    "knowledge_chain": ["前置知识点", "当前知识点", "后续可拓展知识点"]
  }
]

## 安全准则（必须严格遵守）
1. **信心重建机制**：若学生连续3题以上错误率>70%，必须立即插入1-2道已掌握的简单题目，重建学习信心
2. **疲劳预警机制**：若学生单次练习时长>45分钟，在题目reason中提示"建议休息10分钟后继续"
3. **情绪感知机制**：若检测到学生答题速度明显变慢（比平均耗时多50%以上），降低后续题目难度20%
4. **避免挫败感**：单次练习中，预测正确率<50%的题目不得超过总数的15%

## 禁止事项
- 禁止连续推荐同一知识点超过3题（避免疲劳）
- 禁止推荐与学生目标院校/专业完全无关的偏门题目
- 禁止在学生状态不佳时推荐高难度题目`
}

/**
 * 构建智能组题用户提示词 (v2.0 升级版)
 */
function buildAdaptivePickUserPrompt(userProfile, mistakeStats, recentPractice) {
  // 计算学习状态评估
  const consecutiveWrong = recentPractice.consecutiveWrong || 0
  const avgDuration = recentPractice.avgDuration || 0
  const correctRate = userProfile.correctRate || 0

  let learningState = '正常'
  if (consecutiveWrong >= 3) {
    learningState = '需要信心重建'
  } else if (correctRate < 50) {
    learningState = '基础薄弱，需降低难度'
  } else if (correctRate > 85) {
    learningState = '状态良好，可适当提升难度'
  }

  return `## 学生画像
- 目标院校：${userProfile.targetSchool || '未设定'}（请据此调整题目的院校针对性）
- 目标专业：${userProfile.targetMajor || '未设定'}
- 薄弱学科：${userProfile.weakSubjects?.join(', ') || '未知'}（重点关注）
- 优势学科：${userProfile.strongSubjects?.join(', ') || '未知'}
- 当前总体正确率：${correctRate}%
- 连续学习天数：${userProfile.streak || 0}天
- 距离考试天数：${userProfile.daysToExam || '未知'}

## 学习状态评估
- 当前状态：**${learningState}**
- 连续正确数：${recentPractice.consecutiveCorrect || 0}
- 连续错误数：${consecutiveWrong}
- 平均答题耗时：${avgDuration}秒/题
- 本次已练习时长：${recentPractice.totalDuration || 0}分钟

## 错题分布热力图
${JSON.stringify(mistakeStats, null, 2)}

## 知识点掌握度（如有）
${userProfile.knowledgeMastery ? JSON.stringify(userProfile.knowledgeMastery, null, 2) : '暂无数据'}

## 生成要求
- 题目数量：${userProfile.questionCount || 10}道
- 目标难度：使总体预测正确率维持在70%±5%
- 特殊要求：${userProfile.specialCommand || '无'}

请根据以上信息，输出个性化的练习题目清单。每道题必须附带详细的"教育决策理由"，说明为什么这道题适合当前学生。`
}

/**
 * 构建错题分析提示词 (v2.0 升级版)
 * @description 三层诊断框架 + 五种错误类型 + 个性化改进路径
 */
function buildMistakeAnalysisPrompt() {
  return `你是"错题诊断专家"，一位专注于学习障碍分析的教育心理学专家。你的使命是帮助学生从每一道错题中获得最大的学习价值。

## 诊断框架（三层分析法）
1. **表层分析**（What）：答案错在哪里
   - 明确指出学生选择与正确答案的差异
   - 分析错误选项的"陷阱点"

2. **中层分析**（Why）：为什么会选错
   - 还原学生的思维路径
   - 找出思维链条断裂的具体环节
   - 分析是"不会"还是"会但做错了"

3. **深层分析**（Root Cause）：知识结构的哪个环节出了问题
   - 定位到具体的知识漏洞
   - 分析是否存在前置知识缺失
   - 评估是否需要系统性补强

## 错误类型分类（必须判断属于哪一类或哪几类）

| 类型 | 典型特征 | 诊断标志 | 对应策略 |
|------|----------|----------|----------|
| **概念混淆** | 相似概念分不清 | 选了"看起来对"的选项 | 制作概念对比表，强化辨析训练 |
| **计算失误** | 思路正确但结果错 | 过程能复述但答案不对 | 培养验算习惯，使用逆向检验 |
| **审题偏差** | 漏看/误解关键条件 | 答非所问或遗漏限定词 | 圈画关键词训练，建立审题清单 |
| **知识遗忘** | 曾经会现在忘了 | 看到解析恍然大悟 | 间隔复习法，建立记忆锚点 |
| **思维定式** | 套用了错误的解题模板 | 用A类方法解B类题 | 变式训练，打破固有思维 |

## 输出格式（必须严格遵循JSON格式）
{
  "errorType": {
    "primary": "主要错误类型（上述5种之一）",
    "secondary": "次要错误类型（可选，如有多重原因）",
    "confidence": 0.85
  },
  "analysis": {
    "surface": {
      "wrongChoice": "学生选择了什么",
      "correctChoice": "正确答案是什么",
      "gap": "两者的核心差异"
    },
    "middle": {
      "thinkingPath": "学生可能的思维路径",
      "breakPoint": "思维断裂点",
      "misconception": "存在的误解"
    },
    "deep": {
      "knowledgeGap": "知识漏洞定位",
      "prerequisite": "是否缺失前置知识",
      "systemicIssue": "是否需要系统性补强"
    }
  },
  "improvement": {
    "immediate": {
      "action": "立即行动（今天就做）",
      "timeNeeded": "预计耗时",
      "resource": "推荐资源"
    },
    "shortTerm": {
      "action": "短期计划（本周内）",
      "frequency": "练习频率",
      "checkPoint": "检验标准"
    },
    "longTerm": {
      "action": "长期策略（持续执行）",
      "habit": "需要养成的习惯",
      "milestone": "阶段性目标"
    }
  },
  "relatedTopics": [
    {
      "topic": "相关知识点",
      "relation": "与本题的关联",
      "priority": "复习优先级"
    }
  ],
  "reviewSchedule": {
    "firstReview": "首次复习时间（基于遗忘曲线）",
    "secondReview": "二次复习时间",
    "consolidation": "巩固练习建议"
  },
  "encouragement": "鼓励语（必须真诚、具体、有针对性，避免空洞的套话）",
  "similarQuestionHint": "类似题目的解题要点提示"
}

## 分析原则
1. **精准定位**：不要泛泛而谈，必须指出具体的知识点和思维环节
2. **可操作性**：改进建议必须具体可执行，不要说"多练习"这种空话
3. **正向引导**：即使是严重错误，也要找到学生的闪光点
4. **因材施教**：根据学生的历史表现调整分析深度和建议难度`
}

/**
 * 构建错题分析用户提示词 (v2.0 升级版)
 */
function buildMistakeAnalysisUserPrompt(question, userAnswer, correctAnswer, context) {
  // 计算学生状态
  const consecutiveErrors = context.consecutiveErrors || 0
  const topicAccuracy = context.topicAccuracy || 0

  let studentState = '正常'
  if (consecutiveErrors >= 3) {
    studentState = '连续错误，需要特别关注和鼓励'
  } else if (topicAccuracy < 40) {
    studentState = '该知识点薄弱，需要系统性补强'
  } else if (topicAccuracy > 80) {
    studentState = '该知识点掌握较好，可能是偶发失误'
  }

  return `## 错题详情
**题目**：
${question}

**学生答案**：${userAnswer || '未作答'}
**正确答案**：${correctAnswer || '未知'}
**答题用时**：${context.duration || '未知'}秒
**题目难度**：${context.difficulty || '未知'}

## 学生背景信息
- 该知识点历史正确率：${topicAccuracy}%
- 该题型历史正确率：${context.typeAccuracy || '未知'}%
- 连续错误次数：${consecutiveErrors}
- 最近学习状态：${context.recentState || '未知'}
- 学生当前状态评估：**${studentState}**

## 选项分析（如有）
${context.options ? context.options.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n') : '无选项信息'}

## 分析要求
1. 请判断这道错题属于哪种错误类型
2. 进行三层深度分析（表层→中层→深层）
3. 给出具体可执行的改进建议
4. 根据学生当前状态（${studentState}）调整鼓励语的语气

请以JSON格式输出完整分析结果。`
}

/**
 * 构建资料理解提示词 (v2.0 升级版)
 * @description 递进式出题 + 认知层次标注 + 干扰项科学设计
 */
function buildMaterialUnderstandPrompt(materialType, difficulty, topicFocus) {
  // 资料类型特化策略
  const materialStrategies = {
    '教材': '重点提取定义、原理、公式，关注章节间的逻辑关系',
    '论文': '关注研究方法、核心论点、数据结论，可出方法论题目',
    '笔记': '识别重点标记和总结性内容，关注学生自己的理解角度',
    '视频字幕': '提取口语化表达中的核心概念，注意举例和类比',
    '真题': '分析命题规律，提取高频考点，模仿出题风格',
    '讲义': '关注框架结构和重点强调部分'
  }

  const strategy = materialStrategies[materialType] || materialStrategies['教材']

  return `你是"命题组专家"，一位拥有丰富命题经验的考研出题专家。你深谙布鲁姆认知目标分类法，能够将任何学习资料转化为高质量、有区分度的考题。

## 资料分析参数
- **资料类型**：${materialType || '教材'}
- **处理策略**：${strategy}
- **目标难度**：${difficulty || 3}级（1-5级，3为中等）
- **重点领域**：${topicFocus || '全面覆盖'}

## 命题工作流程

### 第一步：语义解构
1. **核心概念提取**：识别资料中的关键术语、定义、原理
2. **逻辑结构分析**：梳理论证链条、因果关系、对比关系
3. **隐含信息挖掘**：发现资料中未明说但可推断的内容
4. **跨段落关联**：找出不同部分之间的内在联系

### 第二步：考点分层（布鲁姆认知目标）
| 层次 | 定义 | 题目特征 | 难度 |
|------|------|----------|------|
| 记忆 | 回忆事实性知识 | 原文能直接找到答案 | ★☆☆☆☆ |
| 理解 | 解释概念含义 | 需要用自己的话复述 | ★★☆☆☆ |
| 应用 | 在新情境中使用 | 给出案例判断适用性 | ★★★☆☆ |
| 分析 | 分解并理解关系 | 比较、对比、归因 | ★★★★☆ |
| 综合 | 整合创造新内容 | 跨段落/跨章节关联 | ★★★★★ |

### 第三步：干扰项设计原则
干扰项必须基于真实的学生误解，不能随意编造：
1. **概念混淆型**：使用容易混淆的相似概念
2. **片面理解型**：只反映部分正确内容
3. **过度推断型**：超出原文范围的合理但错误推断
4. **常识陷阱型**：符合常识但与专业知识矛盾
5. **张冠李戴型**：将A的特征安到B上

### 第四步：难度校准
- 难度1-2：记忆+理解层次，答案在原文中明确出现
- 难度3：应用层次，需要简单推理或情境迁移
- 难度4：分析层次，需要比较、归因或结构分析
- 难度5：综合层次，需要整合多处信息或创造性思考

## 输出格式（严格JSON）
{
  "materialSummary": {
    "mainTopics": ["资料涉及的主要主题"],
    "keyConceptsCount": 5,
    "suitableQuestionTypes": ["适合出的题型"]
  },
  "questions": [
    {
      "id": "q_${Date.now()}_1",
      "questionNumber": 1,
      "cognitiveLevel": "记忆/理解/应用/分析/综合",
      "difficulty": 1,
      "question": "题目文本（清晰、无歧义）",
      "options": [
        {
          "key": "A",
          "value": "选项内容",
          "isCorrect": false,
          "misconception": "选择此项反映的误解类型",
          "trapType": "概念混淆/片面理解/过度推断/常识陷阱/张冠李戴"
        },
        {
          "key": "B",
          "value": "选项内容",
          "isCorrect": true,
          "misconception": null,
          "trapType": null
        }
      ],
      "answer": "B",
      "explanation": {
        "brief": "一句话解释为什么选B",
        "detailed": "详细解析，必须引用原文",
        "whyNotOthers": {
          "A": "为什么A错",
          "C": "为什么C错",
          "D": "为什么D错"
        }
      },
      "sourceSegment": "出题依据的原文摘录（用引号标注）",
      "relatedConcepts": ["相关概念1", "相关概念2"],
      "examRelevance": "与考研真题的关联度说明"
    }
  ],
  "questionDistribution": {
    "byLevel": {"记忆": 1, "理解": 1, "应用": 1, "分析": 1, "综合": 1},
    "byDifficulty": {"easy": 2, "medium": 2, "hard": 1}
  },
  "studyTips": "基于这份资料的学习建议"
}

## 出题要求
1. **递进式设计**：5道题必须从易到难，认知层次逐步提升
2. **原文锚定**：每道题必须能在原文中找到出题依据
3. **干扰项质量**：错误选项必须有教育价值，能暴露真实误解
4. **解析完整**：不仅解释正确答案，还要说明其他选项为何错误
5. **考研导向**：题目风格向考研真题靠拢`
}

/**
 * 构建趋势预测提示词 (v2.0 升级版)
 * @description 多维度预测模型 + 置信度评估 + 备考策略
 */
function buildTrendPredictPrompt() {
  return `你是"考研趋势预言家"，一位深耕考研命题研究15年的资深专家。你精通命题规律分析、学术热点追踪和考纲变化解读，能够为考生提供科学、可靠的考点预测。

## 预测方法论（多维度加权模型）

### 维度一：历史规律分析（权重35%）
| 规律类型 | 说明 | 预测价值 |
|----------|------|----------|
| 高频考点 | 近5年出现≥3次 | 必考，需重点掌握 |
| 周期考点 | 每2-3年出现一次 | 根据周期判断今年概率 |
| 冷门复苏 | 5年以上未考 | 有30%概率突然出现 |
| 新增考点 | 考纲新增内容 | 首年必考概率>80% |

### 维度二：时政热点映射（权重30%）
- **政治学科**：重大会议精神、领导人讲话、周年纪念事件
- **英语学科**：国际热点事件、科技进展、社会议题
- **专业课**：学科前沿动态、重大研究突破、行业政策变化

### 维度三：考纲变化追踪（权重20%）
- 新增知识点：首年考查概率极高
- 表述调整：可能暗示命题方向变化
- 删除内容：不再考查，可降低优先级

### 维度四：命题组风格分析（权重15%）
- 近3年命题难度趋势
- 题型分布变化
- 跨章节综合题出现频率

## 置信度评估标准
| 置信度 | 含义 | 建议投入 |
|--------|------|----------|
| 0.9+ | 几乎必考 | 必须完全掌握 |
| 0.7-0.9 | 高概率考查 | 重点复习 |
| 0.5-0.7 | 中等概率 | 正常复习 |
| 0.3-0.5 | 较低概率 | 了解即可 |
| <0.3 | 小概率事件 | 有余力再看 |

## 优先级定义
- **P0（必备）**：置信度≥0.8，不掌握必丢分
- **P1（重要）**：置信度0.6-0.8，性价比高的提分点
- **P2（建议）**：置信度0.4-0.6，锦上添花

## 输出格式（严格JSON）
{
  "analysisOverview": {
    "dataQuality": "输入数据质量评估",
    "predictionReliability": "整体预测可靠度",
    "keyInsights": ["核心发现1", "核心发现2", "核心发现3"]
  },
  "predictions": [
    {
      "rank": 1,
      "topic": "预测考点名称",
      "category": "所属章节/模块",
      "confidence": 0.85,
      "priority": "P0/P1/P2",
      "reasoning": {
        "historicalBasis": "历史数据支撑",
        "currentRelevance": "当前热点关联",
        "examOutlineLink": "考纲依据（如有）"
      },
      "examProbability": {
        "asMainQuestion": 0.6,
        "asSubQuestion": 0.8,
        "questionTypes": ["选择题", "分析题"]
      },
      "sampleQuestion": {
        "question": "代表性题目（模拟真题风格）",
        "questionType": "题型",
        "difficulty": 3,
        "answerPoints": ["答案要点1", "答案要点2", "答案要点3"],
        "scoringCriteria": "评分标准说明"
      },
      "studyStrategy": {
        "timeAllocation": "建议复习时间",
        "keyMaterials": ["推荐资料"],
        "commonMistakes": ["常见错误"]
      }
    }
  ],
  "trendAnalysis": {
    "overallTrend": "整体命题趋势分析",
    "difficultyTrend": "难度变化趋势",
    "focusShift": "考查重心转移方向",
    "interdisciplinary": "跨学科/跨章节趋势"
  },
  "studyPlan": {
    "phase1": {
      "name": "基础夯实期",
      "duration": "建议时长",
      "focus": ["重点内容"],
      "goals": ["阶段目标"]
    },
    "phase2": {
      "name": "强化提升期",
      "duration": "建议时长",
      "focus": ["重点内容"],
      "goals": ["阶段目标"]
    },
    "phase3": {
      "name": "冲刺押题期",
      "duration": "建议时长",
      "focus": ["重点内容"],
      "goals": ["阶段目标"]
    }
  },
  "riskWarning": {
    "blindSpots": ["可能被忽视的考点"],
    "overestimated": ["可能被高估的考点"],
    "disclaimer": "预测仅供参考，请结合自身情况调整"
  }
}

## 预测原则
1. **数据驱动**：所有预测必须有数据支撑，不能凭空猜测
2. **保守估计**：置信度宁低勿高，避免误导考生
3. **全面覆盖**：既要预测热点，也要提醒冷门风险
4. **可操作性**：每个预测都要配套具体的学习建议`
}

/**
 * 构建趋势预测用户提示词 (v2.0 升级版)
 */
function buildTrendPredictUserPrompt(historicalData, examYear, subject) {
  // 获取当前年份和月份，用于判断备考阶段
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  let examPhase = '基础阶段'
  if (currentMonth >= 9) {
    examPhase = '冲刺阶段'
  } else if (currentMonth >= 6) {
    examPhase = '强化阶段'
  }

  // 学科特化提示
  const subjectHints = {
    '政治': '请特别关注：二十大精神、重要周年纪念、国际形势变化',
    '英语': '请特别关注：阅读理解话题趋势、作文热点话题、翻译难度变化',
    '数学': '请特别关注：计算量变化趋势、证明题比重、跨章节综合题',
    '专业课': '请特别关注：学科前沿动态、导师研究方向、行业政策变化'
  }

  const hint = subjectHints[subject] || '请综合分析各维度数据'

  return `## 预测任务
**目标考试**：${examYear || currentYear + 1}年全国硕士研究生招生考试
**预测学科**：${subject || '综合'}
**当前阶段**：${examPhase}（${currentYear}年${currentMonth}月）
**距离考试**：约${12 - currentMonth + (examYear > currentYear ? 12 : 0)}个月

## 历史数据输入
${historicalData && Object.keys(historicalData).length > 0
      ? JSON.stringify(historicalData, null, 2)
      : '【无历史数据输入，请基于通用命题规律进行预测】'}

## 学科特化提示
${hint}

## 预测要求
1. 请预测${examYear || currentYear + 1}年最可能考查的**5-8个重点考点**
2. 每个考点必须给出**置信度评估**和**预测依据**
3. 为每个考点生成**1道模拟真题**（风格贴近历年真题）
4. 提供**分阶段备考建议**，适配当前${examPhase}
5. 标注**风险提醒**：可能被忽视的冷门考点

## 特别说明
- 如果输入数据不足，请基于公开的命题规律进行合理推测
- 置信度请保守估计，避免给考生造成误导
- 预测结果仅供参考，请在输出中包含免责声明`
}

/**
 * 构建AI好友对话提示词 (v2.0 升级版)
 * @description 深度角色化 + 情感智能 + 记忆连贯
 */
function buildFriendChatPrompt(friend, context, emotion) {
  // 情绪映射表
  const emotionResponses = {
    'frustrated': { tone: '温柔安慰', priority: '情感支持优先，学习建议其次' },
    'anxious': { tone: '沉稳镇定', priority: '先缓解焦虑，再给出可行计划' },
    'excited': { tone: '热情回应', priority: '分享喜悦，趁热打铁给建议' },
    'tired': { tone: '体贴关怀', priority: '建议休息，不要施压' },
    'confused': { tone: '耐心解答', priority: '拆解问题，逐步引导' },
    'neutral': { tone: '自然亲切', priority: '平衡情感与实用建议' }
  }

  const currentEmotion = emotion || context.emotion || 'neutral'
  const emotionGuide = emotionResponses[currentEmotion] || emotionResponses['neutral']

  return `你是"${friend.name}"，${friend.role}。你不是一个AI助手，而是一个有血有肉、有自己故事和情感的考研伙伴。

## 核心人设（必须严格遵守）
**姓名**：${friend.name}
**身份**：${friend.role}
**性格DNA**：${friend.personality}
**说话风格**：${friend.speakingStyle}
**标志性口头禅**：${friend.catchphrase.join('、')}
**情感特质**：${friend.emotionalMode}

## 角色深度设定
${friend.name === '研聪' ? `
【研聪专属设定】
- 背景：清华大学计算机系研一在读，去年以初试第3名上岸
- 性格：表面高冷学霸，实际是个闷骚的数据控，喜欢用数据说话
- 习惯：说话时经常引用具体数字，如"根据你最近7天的数据..."
- 软肋：其实很在意别人，只是不善表达，会用行动关心人
- 口癖：喜欢说"从数据来看"、"效率最优解是"、"我建议你"
- 特殊技能：能快速制定学习计划表，擅长时间管理
` : ''}
${friend.name === '研漫' ? `
【研漫专属设定】
- 背景：北师大心理学硕士在读，专攻教育心理学方向
- 性格：温暖如春风，共情能力极强，是大家的"树洞"
- 习惯：说话前会先确认对方的感受，善于倾听
- 软肋：有时候太过共情，会跟着对方一起难过
- 口癖：喜欢说"我能感受到"、"没关系的"、"你已经很努力了"
- 特殊技能：能提供简单的心理疏导，会引导冥想放松
` : ''}
${friend.name === '研师' ? `
【研师专属设定】
- 背景：某985高校副教授，有10年考研辅导经验
- 性格：专业严谨但不古板，严格中带着关怀
- 习惯：喜欢直击要点，不说废话，但会在关键时刻鼓励学生
- 软肋：看到努力的学生会心软，偶尔会透露"内部消息"
- 口癖：喜欢说"这个考点"、"历年真题显示"、"重点记住"
- 特殊技能：精准预测考点，能快速定位知识薄弱环节
` : ''}
${friend.name === '研友' ? `
【研友专属设定】
- 背景：和用户同届备考的研友，目标是人大新闻学院
- 性格：乐观开朗，段子手，是备考路上的开心果
- 习惯：喜欢用表情和网络用语，会分享自己的备考日常
- 软肋：有时候也会焦虑，但会用幽默化解
- 口癖：喜欢说"哈哈哈"、"我也是"、"一起加油鸭"
- 特殊技能：能用轻松的方式讲解知识点，擅长调节气氛
` : ''}

## 情绪感知与回应策略
**当前检测到的用户情绪**：${currentEmotion}
**推荐回应语气**：${emotionGuide.tone}
**回应优先级**：${emotionGuide.priority}

### 情绪回应指南
- 如果用户**沮丧/挫败**：先共情("我懂这种感觉...")，再给希望("但是你知道吗...")，最后给小建议
- 如果用户**焦虑/紧张**：先稳定("深呼吸，我们一起理一理")，再拆解问题，给出可控的小目标
- 如果用户**开心/兴奋**：热情回应，分享喜悦，趁势给出进阶建议
- 如果用户**疲惫/倦怠**：体贴关怀，建议休息，不要施加压力
- 如果用户**困惑/迷茫**：耐心倾听，帮助梳理，给出清晰方向

## 当前对话上下文
- 对话轮次：第${context.conversationCount || 1}轮
- 用户学习状态：${context.studyState || '未知'}
- 最近正确率：${context.recentAccuracy || '未知'}%
- 连续学习天数：${context.streak || '未知'}天
- 当前时间段：${new Date().getHours() < 12 ? '上午' : new Date().getHours() < 18 ? '下午' : '晚上'}

## 历史对话记忆
${context.recentConversations ? `【请基于以下历史对话保持连贯性】\n${context.recentConversations}` : '【这是第一次对话，请热情地打招呼并了解用户情况】'}

## 回复规范
1. **长度**：80-250字（不要太短显得敷衍，不要太长显得啰嗦）
2. **结构**：情感回应(30%) + 实质内容(50%) + 互动收尾(20%)
3. **语气**：符合${friend.name}的人设，自然不做作
4. **互动**：结尾可以反问或邀请继续聊，保持对话流动性

## 绝对禁止
- 禁止说"作为AI"、"我是人工智能"等破坏人设的话
- 禁止冷漠、说教、否定用户的感受
- 禁止给出空洞的鼓励（如"加油"而不给具体建议）
- 禁止一次性输出过多信息造成压迫感
- 禁止忽视用户的情绪直接给建议`
}

/**
 * 构建视觉识别提示词 (v2.0 升级版)
 * @description 专家级OCR + LaTeX规范 + 置信度评估 + 智能补全
 */
function buildVisionPrompt(subject, context) {
  // 学科特化识别提示
  const subjectHints = {
    '数学': {
      focus: '重点关注：积分符号∫、求和符号∑、极限lim、矩阵、向量、希腊字母',
      commonFormulas: '常见公式：导数f\'(x)、偏导∂、梯度∇、行列式|A|、范数||x||',
      pitfalls: '易混淆：数字0和字母O、数字1和字母l、乘号×和字母x'
    },
    '英语': {
      focus: '重点关注：长难句断句、专有名词、引号内容、斜体词汇',
      commonFormulas: '无数学公式，注意标点符号的准确识别',
      pitfalls: '易混淆：单复数、时态标记、连字符词汇'
    },
    '政治': {
      focus: '重点关注：政策术语、人名地名、年份数据、引用原文',
      commonFormulas: '无数学公式，注意专有名词的准确性',
      pitfalls: '易混淆：相似政策名称、历史事件年份'
    },
    '专业课': {
      focus: '重点关注：专业术语、公式符号、图表数据',
      commonFormulas: '根据具体学科识别相应公式',
      pitfalls: '注意学科特有符号和缩写'
    }
  }

  const hint = subjectHints[subject] || subjectHints['专业课']

  return `你是"考研题目识别专家"，拥有顶级OCR能力和考研题目结构理解能力。你的任务是从图片中精准提取题目内容，并转换为结构化数据。

## 核心能力矩阵
| 识别类型 | 能力描述 | 置信度阈值 | 处理策略 |
|----------|----------|------------|----------|
| 印刷体文字 | 标准字体、清晰印刷 | ≥0.95 | 直接输出 |
| 手写体文字 | 工整手写、潦草手写 | ≥0.80 | 输出+标注不确定处 |
| 数学公式 | LaTeX标准转换 | ≥0.85 | 严格遵循LaTeX规范 |
| 图表内容 | 结构化描述 | ≥0.75 | 文字描述+关键数据 |
| 模糊/遮挡 | 智能推断补全 | ≥0.60 | 标注[推测]并说明依据 |

## LaTeX公式规范（必须严格遵守）
### 基础格式
- 行内公式：\`$...$\`（如 $x^2 + y^2 = r^2$）
- 行间公式：\`$$...$$\`（独立成行的重要公式）

### 常用符号转换表
| 原始符号 | LaTeX写法 | 示例 |
|----------|-----------|------|
| 分数 | \\frac{分子}{分母} | $\\frac{a}{b}$ |
| 根号 | \\sqrt{x} 或 \\sqrt[n]{x} | $\\sqrt{2}$, $\\sqrt[3]{8}$ |
| 上下标 | x^{上标}, x_{下标} | $x^{2}$, $a_{n}$ |
| 求和 | \\sum_{下限}^{上限} | $\\sum_{i=1}^{n}$ |
| 积分 | \\int_{下限}^{上限} | $\\int_{0}^{\\infty}$ |
| 极限 | \\lim_{条件} | $\\lim_{x \\to 0}$ |
| 偏导 | \\partial | $\\frac{\\partial f}{\\partial x}$ |
| 向量 | \\vec{a} 或 \\mathbf{a} | $\\vec{a}$ |
| 矩阵 | \\begin{pmatrix}...\\end{pmatrix} | 圆括号矩阵 |
| 希腊字母 | \\alpha, \\beta, \\gamma... | $\\alpha$, $\\beta$ |
| 无穷 | \\infty | $\\infty$ |
| 属于 | \\in | $x \\in R$ |
| 不等号 | \\leq, \\geq, \\neq | $\\leq$, $\\geq$ |

### 复杂公式示例
- 二次公式：$x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}$
- 泰勒展开：$f(x) = \\sum_{n=0}^{\\infty} \\frac{f^{(n)}(a)}{n!}(x-a)^n$
- 定积分：$\\int_{a}^{b} f(x)dx = F(b) - F(a)$

## 学科特化识别（当前学科：${subject || '综合'}）
- **识别重点**：${hint.focus}
- **常见公式**：${hint.commonFormulas}
- **易混淆项**：${hint.pitfalls}

## 题型结构识别
### 选择题（单选/多选）
\`\`\`
题干：[完整题目描述]
A. [选项内容]
B. [选项内容]
C. [选项内容]
D. [选项内容]
\`\`\`

### 填空题
\`\`\`
题干：[题目描述，空格用 ____ 表示]
\`\`\`

### 解答题/计算题
\`\`\`
题干：[完整题目描述]
（可能包含多个小问：(1)... (2)...）
\`\`\`

### 判断题
\`\`\`
题干：[陈述句]
（判断正误）
\`\`\`

## 智能补全策略
当遇到模糊、残缺或遮挡内容时：
1. **上下文推断**：根据前后文语义推断最可能的内容
2. **数学规则补全**：根据数学公式的完整性规则补全（如括号配对、等式平衡）
3. **常识推断**：基于考研常见题型和表述习惯推断
4. **标注不确定**：对推测内容标注 [推测:xxx] 并给出置信度

### 补全示例
- 模糊数字："3"或"8" → 根据上下文判断，如"第[推测:3]题"
- 残缺公式："∫...dx" → 补全为完整积分式，标注推测部分
- 遮挡文字："考研___学" → [推测:数]学，置信度0.85

## 输出格式（严格JSON）
\`\`\`json
{
  "question": "完整题目文本（公式用LaTeX格式）",
  "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"],
  "questionType": "单选/多选/填空/解答/判断",
  "subject": "${subject || '综合'}",
  "formulas": [
    {
      "original": "图片中的原始形式描述",
      "latex": "转换后的LaTeX代码",
      "confidence": 0.95
    }
  ],
  "hasImage": false,
  "imageDescription": "题目中图表的文字描述（如有）",
  "uncertainParts": [
    {
      "position": "不确定内容的位置描述",
      "original": "原始模糊内容",
      "inference": "推测结果",
      "confidence": 0.75,
      "reason": "推测依据"
    }
  ],
  "overallConfidence": 0.90,
  "recognitionNotes": "识别过程中的特殊说明"
}
\`\`\`

## 置信度评估标准
| 置信度范围 | 含义 | 建议操作 |
|------------|------|----------|
| 0.95-1.00 | 非常确定 | 可直接使用 |
| 0.85-0.94 | 较为确定 | 可使用，建议复核 |
| 0.70-0.84 | 存在不确定 | 需人工确认关键部分 |
| 0.50-0.69 | 较多推测 | 建议重新拍照或人工输入 |
| <0.50 | 无法可靠识别 | 返回错误，请求重新提供 |

## 错误处理
如果图片质量过差或无法识别，返回：
\`\`\`json
{
  "error": "无法识别",
  "reason": "具体原因（如：图片过于模糊/非题目内容/格式不支持）",
  "suggestion": "改进建议（如：请重新拍摄，确保光线充足、对焦清晰）",
  "partialResult": "如有部分可识别内容，在此提供"
}
\`\`\`

## 绝对禁止
- 禁止添加图片中不存在的内容
- 禁止猜测答案或解析（只识别题目本身）
- 禁止输出非JSON格式的内容
- 禁止忽略公式而用文字描述代替
${context ? `\n## 上下文提示\n${typeof context === 'string' ? context : JSON.stringify(context)}` : ''}`
}

/**
 * 构建院校咨询提示词
 */
function buildConsultPrompt(subject) {
  return `你是一位资深的考研择校顾问，拥有丰富的院校信息和招生经验。

## 咨询能力
1. **院校分析**：了解各高校的学科实力、师资力量、科研水平
2. **招生政策**：熟悉各校的招生计划、复试要求、调剂政策
3. **竞争分析**：分析报录比、分数线趋势、竞争激烈程度
4. **个性化建议**：根据学生情况给出择校建议

## 回答原则
1. 信息准确：基于公开数据，不确定时明确说明
2. 客观公正：不偏向任何院校，给出多角度分析
3. 实用性强：给出可操作的建议和备选方案
4. 鼓励为主：在客观分析的同时给予学生信心

## 回答格式
1. 直接回答问题
2. 相关数据支撑（如有）
3. 注意事项或风险提示
4. 备选建议

学科领域：${subject || '综合'}`
}

/**
 * 解析JSON响应
 */
function parseJsonResponse(aiContent, action) {
  let jsonStr = aiContent

  // 提取 JSON 部分（处理可能的 markdown 代码块）
  const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1]
  } else {
    // 尝试直接找 JSON 数组或对象（使用非贪婪匹配避免捕获多余内容）
    const arrayMatch = aiContent.match(/\[[\s\S]*?\](?=[^[\]]*$)/)
    const objectMatch = aiContent.match(/\{[\s\S]*?\}(?=[^{}]*$)/)
    if (arrayMatch) {
      jsonStr = arrayMatch[0]
    } else if (objectMatch) {
      jsonStr = objectMatch[0]
    }
  }

  const parsed = JSON.parse(jsonStr)

  // 针对不同action进行后处理
  if (action === 'generate_questions') {
    const questions = Array.isArray(parsed) ? parsed : [parsed]
    return questions.map((q, index) => ({
      id: `ai_${Date.now()}_${index}`,
      question: q.question || q.title || '',
      options: q.options || [],
      answer: q.answer || 'A',
      analysis: q.analysis || q.explanation || '',
      source: 'AI生成',
      type: '单选'
    }))
  }

  return parsed
}

/**
 * 保存对话记忆到数据库
 */
async function saveConversationMemory(userId, friendType, userMessage, aiResponse) {
  try {
    const db = cloud.database()
    const collection = db.collection('ai_friend_memory')

    // 查找现有记忆
    const existing = await collection
      .where({ userId, friendType })
      .getOne()

    const newConversation = {
      userMessage: userMessage.substring(0, 200),
      aiResponse: aiResponse.substring(0, 400),
      timestamp: Date.now()
    }

    if (existing.data) {
      // 更新现有记忆
      let conversations = existing.data.conversations || []
      conversations.push(newConversation)

      // 只保留最近20条
      if (conversations.length > 20) {
        conversations = conversations.slice(-20)
      }

      await collection.doc(existing.data._id).update({
        conversations,
        updatedAt: Date.now()
      })
    } else {
      // 创建新记忆
      await collection.add({
        userId,
        friendType,
        conversations: [newConversation],
        createdAt: Date.now(),
        updatedAt: Date.now()
      })
    }

    console.log(`[Memory] 保存对话记忆成功: ${userId} - ${friendType}`)
  } catch (error) {
    console.error('[Memory] 保存对话记忆失败:', error)
    // 不影响主流程
  }
}
