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

import cloud from '@lafjs/cloud';
import { perfMonitor } from './_shared/perf-monitor';

// ✅ B020: 导入 JWT 验证函数
import { requireAuth, isAuthError } from './_shared/auth-middleware';

// ✅ H019: 微信内容安全检测
import { checkTextSecurity, ContentScene } from './_shared/wx-content-check';

// ✅ B7: 请求签名 / 审计模式校验（从本文件提取到共享模块）
import { checkAuditMode } from './_shared/request-guard';

// ✅ B7: RAG 知识库检索（从本文件提取到共享模块）
import { retrieveRAGContext } from './_shared/rag-retriever';

// ✅ B7: AI 好友对话记忆（从本文件提取到共享模块）
import { loadConversationMemory, saveConversationMemory } from './_shared/conversation-memory';

// ✅ B1: 统一提示词模块（含 AI_FRIENDS 角色常量）
import {
  buildGenerateQuestionsPrompt,
  buildGenerateQuestionsUserPrompt,
  selectGenerateModel,
  buildChatPrompt,
  buildDefaultPrompt,
  buildAdaptivePickPrompt,
  buildAdaptivePickUserPrompt,
  buildMistakeAnalysisPrompt,
  buildMistakeAnalysisUserPrompt,
  buildMaterialUnderstandPrompt,
  buildTrendPredictPrompt,
  buildTrendPredictUserPrompt,
  buildFriendChatPrompt,
  AI_FRIENDS,
  buildOcrParsePrompt,
  buildVisionPrompt,
  buildConsultPrompt,
  buildRecommendPrompt
} from './_shared/prompts';

// ==================== 环境配置 ====================
import { IS_PRODUCTION, createLogger, checkRateLimitDistributed } from './_shared/api-response';
const logger = createLogger('[ProxyAI]');

// 环境变量配置
// 安全提示：敏感信息必须通过环境变量配置，禁止硬编码
const AI_PROVIDER_KEY_PLACEHOLDER
const ZHIPU_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

// ==================== P014: 环境变量完整性校验 ====================
// 所有必需的环境变量及其描述
const REQUIRED_ENV_VARS = {
  AI_PROVIDER_KEY_PLACEHOLDER
  JWT_SECRET_PLACEHOLDER
};

// 启动时校验所有必需环境变量
const envCheckResults: { key: string; status: 'ok' | 'missing' | 'invalid'; desc: string }[] = [];
for (const [key, config] of Object.entries(REQUIRED_ENV_VARS)) {
  const value = process.env[key] || '';
  if (!value) {
    envCheckResults.push({ key, status: 'missing', desc: config.desc });
    logger.error(`❌ 环境变量 ${key} (${config.desc}) 未配置！`);
  } else if (!config.validate(value)) {
    envCheckResults.push({ key, status: 'invalid', desc: config.desc });
    logger.error(`❌ 环境变量 ${key} (${config.desc}) 格式无效！`);
  } else {
    envCheckResults.push({ key, status: 'ok', desc: config.desc });
  }
}

const missingEnvCount = envCheckResults.filter((r) => r.status !== 'ok').length;
if (missingEnvCount > 0 && IS_PRODUCTION) {
  logger.error(`❌ 生产环境有 ${missingEnvCount} 个必需环境变量未正确配置，AI 功能将受限。`);
}

// ==================== 超时和重试配置 ====================
const AI_REQUEST_TIMEOUT = 60000; // AI 请求超时时间：60秒
const AI_MAX_RETRIES = 2; // 最大重试次数
const AI_RETRY_DELAY = 1000; // 重试延迟：1秒

// ==================== 请求频率限制配置 ====================
const RATE_LIMIT_WINDOW = 60000; // 频率限制窗口：60秒
const RATE_LIMIT_MAX_REQUESTS = 20; // 每个用户每分钟最多20次请求
// M-11 FIX: 移除独立的 rateLimitCache Map，统一使用 _shared/api-response 中的
// checkRateLimitDistributed（已在主函数中调用），此处仅保留 fallback 函数的本地 Map
const localRateLimitFallback = new Map<string, { count: number; resetTime: number }>();

// ✅ B7: 审计模式 / 请求签名校验已提取到 _shared/request-guard.ts

/**
 * 检查请求频率限制
 * @param userId 用户ID
 * @returns 是否允许请求
 */
function checkRateLimitFallback(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
  if (!userId) {
    const resetAt = Date.now() + RATE_LIMIT_WINDOW;
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS, resetAt };
  }

  const now = Date.now();
  const userLimit = localRateLimitFallback.get(userId);

  // 清理过期的缓存条目（简单的内存管理）
  if (localRateLimitFallback.size > 10000) {
    for (const [key, value] of localRateLimitFallback.entries()) {
      if (now > value.resetTime) {
        localRateLimitFallback.delete(key);
      }
    }
  }

  if (!userLimit || now > userLimit.resetTime) {
    // 新窗口或已过期，重置计数
    localRateLimitFallback.set(userId, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW
    });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetAt: now + RATE_LIMIT_WINDOW };
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    // 超过限制
    return {
      allowed: false,
      remaining: 0,
      resetAt: userLimit.resetTime
    };
  }

  // 增加计数
  userLimit.count++;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - userLimit.count,
    resetAt: userLimit.resetTime
  };
}

// 多模型配置
const MODEL_CONFIG = {
  'glm-4-plus': { name: 'glm-4-plus', maxTokens: 4096, temperature: 0.7 },
  'glm-4-flash': { name: 'glm-4-flash', maxTokens: 4096, temperature: 0.9 },
  'glm-4.5-air': { name: 'glm-4.5-air', maxTokens: 8192, temperature: 0.7 },
  'glm-4v-plus': { name: 'glm-4v-plus', maxTokens: 4096, temperature: 0.5 }
};

// 任务类型到模型的映射
const TASK_MODEL_MAP = {
  generate: 'glm-4.5-air', // 别名，使用主力模型
  generate_questions: 'glm-4.5-air', // 改用主力模型节省额度
  analyze: 'glm-4.5-air',
  chat: 'glm-4-flash',
  adaptive_pick: 'glm-4.5-air',
  material_understand: 'glm-4.5-air',
  trend_predict: 'glm-4.5-air',
  friend_chat: 'glm-4-flash',
  vision: 'glm-4v-plus',
  consult: 'glm-4-flash'
};

// ==================== B001: 模型降级链 ====================
// 当主模型不可用时，自动降级到更便宜/更稳定的模型
const MODEL_FALLBACK_CHAIN: Record<string, string[]> = {
  'glm-4.5-air': ['glm-4-plus', 'glm-4-flash'],
  'glm-4-plus': ['glm-4-flash'],
  'glm-4v-plus': ['glm-4-plus', 'glm-4-flash'],
  'glm-4-flash': [] // 最低级别，无降级
};

// 模型健康状态追踪（内存级熔断器）
const modelHealth = new Map<string, { failures: number; lastFailure: number; circuitOpen: boolean }>();
const CIRCUIT_THRESHOLD = 3; // 连续失败 N 次后熔断
const CIRCUIT_RESET_MS = 120000; // 熔断恢复时间：2分钟

function isModelHealthy(modelName: string): boolean {
  const health = modelHealth.get(modelName);
  if (!health) return true;
  if (health.circuitOpen) {
    // 检查是否到了半开状态（可以尝试恢复）
    if (Date.now() - health.lastFailure > CIRCUIT_RESET_MS) {
      health.circuitOpen = false;
      health.failures = 0;
      return true;
    }
    return false;
  }
  return true;
}

function recordModelFailure(modelName: string): void {
  const health = modelHealth.get(modelName) || { failures: 0, lastFailure: 0, circuitOpen: false };
  health.failures++;
  health.lastFailure = Date.now();
  if (health.failures >= CIRCUIT_THRESHOLD) {
    health.circuitOpen = true;
    logger.warn(`[CircuitBreaker] 模型 ${modelName} 熔断，${CIRCUIT_RESET_MS / 1000}秒后尝试恢复`);
  }
  modelHealth.set(modelName, health);
}

function recordModelSuccess(modelName: string): void {
  modelHealth.delete(modelName); // 成功则重置
}

/**
 * B001: 选择可用模型（考虑降级链和熔断状态）
 */
function selectAvailableModel(preferredModel: string): string {
  if (isModelHealthy(preferredModel)) return preferredModel;
  const fallbacks = MODEL_FALLBACK_CHAIN[preferredModel] || [];
  for (const fb of fallbacks) {
    if (isModelHealthy(fb)) {
      logger.warn(`[B001] 模型 ${preferredModel} 不可用，降级到 ${fb}`);
      return fb;
    }
  }
  // 所有模型都熔断了，强制尝试最低级别
  logger.error(`[B001] 所有模型不可用，强制尝试 glm-4-flash`);
  return 'glm-4-flash';
}

// ✅ B7: AI_FRIENDS 角色配置已迁移至 _shared/prompts/friend-chat.ts

export default async function (ctx: FunctionContext) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const action = ctx.body?.action || 'unknown';
  const endPerf = perfMonitor.start('proxy-ai', action);

  logger.info(`[${requestId}] AI 代理请求开始`);

  try {
    // P014: 健康检查接口（部署验证用，无需认证）
    // [H-04 FIX] 不暴露模型列表和运行时间给未认证用户
    if (action === 'health_check') {
      endPerf();
      return {
        code: 0,
        success: true,
        data: {
          service: 'proxy-ai',
          status: AI_PROVIDER_KEY_PLACEHOLDER
        },
        message: AI_PROVIDER_KEY_PLACEHOLDER
        requestId
      };
    }

    // 0. 审计模式检查（后端必须是最后一道防线）
    const auditCheck = checkAuditMode(ctx as Record<string, unknown>);
    if (!auditCheck.valid) {
      logger.warn(`[${requestId}] 审计模式校验失败: ${auditCheck.error}`);
      return {
        code: 403,
        success: false,
        message: auditCheck.error || '请求未通过安全校验',
        requestId
      };
    }

    // ✅ B020: JWT 身份验证（必须验证用户身份，防止未授权访问）
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      logger.warn(`[${requestId}] JWT 验证失败，拒绝未授权的 AI 请求`);
      return {
        code: 401,
        success: false,
        message: '未登录或登录已过期，请重新登录',
        requestId
      };
    }
    const authenticatedUserId = authResult.userId;

    // ✅ 运行时检查：智谱 API 密钥是否可用
    if (!AI_PROVIDER_KEY_PLACEHOLDER
      logger.error(`[${requestId}] AI_PROVIDER_KEY_PLACEHOLDER
      return {
        code: 503,
        success: false,
        message: 'AI 服务暂未配置，请联系管理员',
        requestId
      };
    }

    // 1. 参数解析
    const requestBody = ctx.body || {};

    const {
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
      context: rawContext,
      emotion,
      // [F3-FIX] 择校咨询多轮上下文参数
      schoolInfo,
      history
    } = requestBody;

    const context =
      rawContext && typeof rawContext === 'object' && !Array.isArray(rawContext)
        ? { ...(rawContext as Record<string, unknown>) }
        : {};

    // 1.5 请求频率限制检查（使用已验证的用户ID，防止API滥用）
    const distributedRateLimit = await checkRateLimitDistributed(
      `proxy_ai:${authenticatedUserId || 'anonymous'}`,
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW,
      () => checkRateLimitFallback(authenticatedUserId || 'anonymous')
    );
    const rateLimitResult = {
      allowed: distributedRateLimit.allowed,
      remaining: distributedRateLimit.remaining,
      resetIn: Math.max(0, distributedRateLimit.resetAt - Date.now())
    };

    if (!distributedRateLimit.allowed) {
      logger.warn(`[${requestId}] 请求频率限制触发: userId=${userId}`);
      return {
        code: 429,
        success: false,
        message: `请求过于频繁，请在 ${Math.ceil(rateLimitResult.resetIn / 1000)} 秒后重试`,
        remaining: rateLimitResult.remaining,
        resetIn: rateLimitResult.resetIn,
        requestId
      };
    }

    // 2. 参数校验（后端必须再校验一遍，不信任前端）
    if (!content || typeof content !== 'string' || content.trim() === '') {
      logger.warn(`[${requestId}] 参数错误: content 无效`);
      return {
        code: 400,
        success: false,
        message: '参数错误: content 不能为空',
        requestId
      };
    }

    // 内容长度限制（防止恶意大请求）
    const MAX_CONTENT_LENGTH = 10000;
    if (content.length > MAX_CONTENT_LENGTH) {
      logger.warn(`[${requestId}] 参数错误: content 过长 (${content.length})`);
      return {
        code: 400,
        success: false,
        message: `参数错误: content 长度不能超过 ${MAX_CONTENT_LENGTH} 字符`,
        requestId
      };
    }

    logger.info(
      `[${requestId}] action: ${action}, contentLength: ${content.length}, rateLimit remaining: ${rateLimitResult.remaining}`
    );

    // ✅ H019: 微信内容安全检测 — 用户输入在发给 AI 之前必须过微信审查
    // 从 JWT payload 获取微信 openid（非微信登录用户使用 userId 作为降级标识）
    const userOpenid = (authResult.payload?.openid as string) || authenticatedUserId;
    const inputCheck = await checkTextSecurity(content, userOpenid, ContentScene.SOCIAL);
    if (!inputCheck.pass) {
      logger.warn(`[${requestId}] 用户输入未通过内容安全检测: label=${inputCheck.label}`);
      endPerf();
      return {
        code: 403,
        success: false,
        message: inputCheck.reason || '内容包含敏感信息，请修改后重试',
        requestId
      };
    }

    // [F4-FIX] 加载AI好友对话记忆（从DB补充前端localStorage可能丢失的上下文）
    // ✅ P0修复：使用 authenticatedUserId 替代客户端 userId，防止 IDOR 越权读写他人对话记忆
    if (action === 'friend_chat' && authenticatedUserId && friendType) {
      try {
        const dbMemory = await loadConversationMemory(authenticatedUserId, friendType);
        if (dbMemory) {
          // 合并DB记忆到context，DB记忆优先（更完整）
          if (!context.recentConversations) {
            context.recentConversations = dbMemory;
          } else {
            context.recentConversations = dbMemory + '\n---\n' + context.recentConversations;
          }
        }
      } catch (e) {
        logger.warn(`[${requestId}] F4: 加载对话记忆失败，继续使用前端上下文`, e);
      }
    }

    // 3. 根据 action 构建 prompt
    let { systemPrompt, userPrompt, model, temperature, customMessages, ragEnabled } = buildPrompt({
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
      emotion,
      schoolInfo,
      history
    });

    // 3.5 RAG 增强：为支持的 action 注入知识库检索上下文
    if (ragEnabled && authenticatedUserId) {
      const ragContext = await retrieveRAGContext(authenticatedUserId, content || userPrompt);
      if (ragContext) {
        systemPrompt = systemPrompt + ragContext;
        logger.info(`[${requestId}] RAG增强: 已注入知识库上下文`);
      }
    }

    // 4-5. 调用智谱 AI API（带超时、重试和模型降级机制）
    const preferredModel = model || TASK_MODEL_MAP[action] || 'glm-4-plus';

    const aiCallResult = await callAIWithFallback({
      requestId,
      preferredModel,
      systemPrompt,
      userPrompt,
      temperature,
      startTime,
      messages: customMessages,
      action,
      data: ctx.body?.data || null
    });

    if (!aiCallResult.success) {
      return { ...aiCallResult.error, requestId };
    }

    const { aiData, modelName: finalModelName, aiContent } = aiCallResult;

    // 6.5 成本监控日志（单位：元/百万tokens）
    const COST_PER_M_TOKENS = {
      'glm-4-flash': { input: 0.1, output: 0.1 },
      'glm-4.5-air': { input: 5, output: 5 },
      'glm-4-plus': { input: 50, output: 50 },
      'glm-4v-plus': { input: 50, output: 50 }
    };
    if (aiData.usage) {
      const u = aiData.usage;
      const rates = COST_PER_M_TOKENS[finalModelName] || { input: 5, output: 5 };
      const costYuan = ((u.prompt_tokens || 0) * rates.input + (u.completion_tokens || 0) * rates.output) / 1_000_000;
      logger.info(
        `[${requestId}] 用量统计 | 模型: ${finalModelName} | 输入: ${u.prompt_tokens || 0} | 输出: ${u.completion_tokens || 0} | 总计: ${u.total_tokens || 0} | 估算成本: ¥${costYuan.toFixed(6)}`
      );
    }

    // 7. 解析响应内容
    let responseData = aiContent;

    // 需要解析JSON的action类型
    const jsonActions = ['generate_questions', 'adaptive_pick', 'material_understand', 'trend_predict', 'analyze'];

    if (jsonActions.includes(action)) {
      try {
        responseData = parseJsonResponse(aiContent, action);
        logger.info(`[${requestId}] JSON 解析成功`);
      } catch (parseError) {
        // [H-06 FIX] 安全访问 parseError.message，防止非 Error 对象抛异常
        const errMsg = parseError instanceof Error ? parseError.message : String(parseError);
        logger.warn(`[${requestId}] JSON 解析失败，返回原始文本:`, errMsg);
        // 解析失败，返回原始文本
        responseData = aiContent;
      }
    }

    // 8. 保存AI好友对话记忆（如果是friend_chat）— 非阻塞，不影响响应速度
    // ✅ P0修复：使用 authenticatedUserId 替代客户端 userId
    if (action === 'friend_chat' && authenticatedUserId && friendType) {
      saveConversationMemory(authenticatedUserId, friendType, content, aiContent).catch((e) =>
        logger.error('[Memory] 后台保存对话记忆失败:', e)
      );
    }

    // ✅ H019: AI 生成内容安全检测 — AI 回复也必须过微信审查
    // 对于聊天/咨询等用户可见的 AI 文本进行检测
    const AI_CHECK_ACTIONS = ['chat', 'friend_chat', 'consult', 'analyze'];
    if (AI_CHECK_ACTIONS.includes(action) && typeof aiContent === 'string' && aiContent.length > 0) {
      const outputCheck = await checkTextSecurity(aiContent, userOpenid, ContentScene.SOCIAL);
      if (!outputCheck.pass) {
        logger.warn(`[${requestId}] AI 回复未通过内容安全检测: label=${outputCheck.label}`);
        endPerf();
        return {
          code: 0,
          success: true,
          data: '抱歉，该回复内容暂时无法展示，请换个问题试试。',
          message: '请求成功',
          requestId,
          duration: Date.now() - startTime,
          model: finalModelName,
          usage: aiData.usage || {},
          _contentFiltered: true
        };
      }
    }

    // 9. 计算耗时并返回
    const duration = Date.now() - startTime;
    endPerf();
    logger.info(`[${requestId}] AI 代理完成，耗时: ${duration}ms`);

    return {
      code: 0,
      success: true,
      data: responseData,
      message: '请求成功',
      requestId,
      duration,
      model: finalModelName,
      usage: aiData.usage || {}
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    endPerf({ error: true });
    logger.error(`[${requestId}] AI 代理异常:`, error);

    return {
      code: 500,
      success: false,
      message: 'AI 服务异常，请稍后重试',
      requestId,
      duration
    };
  }
}

/**
 * B007: 提取的 AI 调用逻辑 — 带重试、超时和模型降级
 */
async function callAIWithFallback({
  requestId,
  preferredModel,
  systemPrompt,
  userPrompt,
  temperature,
  startTime,
  messages = null,
  action = '' as string,
  data = null as Record<string, any> | null
}) {
  let modelName = selectAvailableModel(preferredModel);
  let modelConfig = MODEL_CONFIG[modelName] || MODEL_CONFIG['glm-4-plus'];

  if (modelName !== preferredModel) {
    logger.warn(`[${requestId}] B001: 模型降级 ${preferredModel} → ${modelName}`);
  }
  logger.info(`[${requestId}] 使用模型: ${modelName}`);

  let aiResponse = null;
  let lastError = null;
  let actualModel = modelName;

  for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      // Override model for multimodal
      if (action === 'ocr_parse' || (data && data.base64)) {
        modelConfig.name = 'glm-4v';
      }
      aiResponse = await cloud.fetch({
        url: ZHIPU_API_URL,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AI_PROVIDER_KEY_PLACEHOLDER
        },
        data: {
          model: modelConfig.name,
          messages:
            messages ||
            (data && data.base64
              ? [
                  { role: 'system', content: systemPrompt },
                  {
                    role: 'user',
                    content: [
                      { type: 'text', text: userPrompt },
                      { type: 'image_url', image_url: { url: data.base64 } }
                    ]
                  }
                ]
              : [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt }
                ]),
          temperature: temperature || modelConfig.temperature,
          max_tokens: modelConfig.maxTokens,
          top_p: 0.9
        },
        timeout: AI_REQUEST_TIMEOUT
      });

      recordModelSuccess(actualModel);
      break;
    } catch (fetchError) {
      lastError = fetchError;
      logger.warn(
        `[${requestId}] AI 请求失败 (尝试 ${attempt}/${AI_MAX_RETRIES}, 模型: ${actualModel}):`,
        fetchError.message
      );

      if (fetchError.message?.includes('timeout') || fetchError.code === 'ETIMEDOUT') {
        logger.error(`[${requestId}] AI 请求超时 (${AI_REQUEST_TIMEOUT}ms)`);
      }

      recordModelFailure(actualModel);
      const fallbackModel = selectAvailableModel(preferredModel);
      if (fallbackModel !== actualModel) {
        logger.warn(`[${requestId}] B001: 重试时降级模型 ${actualModel} → ${fallbackModel}`);
        actualModel = fallbackModel;
        modelConfig = MODEL_CONFIG[fallbackModel] || MODEL_CONFIG['glm-4-flash'];
      }

      if (attempt < AI_MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, AI_RETRY_DELAY * attempt));
      }
    }
  }

  if (!aiResponse) {
    logger.error(`[${requestId}] AI 请求最终失败:`, lastError);
    return {
      success: false,
      error: {
        code: 503,
        success: false,
        message: 'AI 服务暂时不可用，请稍后重试',
        error: '请求失败',
        duration: Date.now() - startTime,
        fallbackAttempted: actualModel !== preferredModel
      }
    };
  }

  const aiData = aiResponse.data;

  if (aiData.error) {
    logger.error(`[${requestId}] 智谱 AI 错误:`, aiData.error);
    return {
      success: false,
      error: {
        code: 502,
        success: false,
        message: 'AI 服务错误，请稍后重试'
      }
    };
  }

  const aiContent = aiData.choices?.[0]?.message?.content || '';

  if (!aiContent) {
    logger.error(`[${requestId}] AI 返回内容为空`);
    return {
      success: false,
      error: { code: 502, success: false, message: 'AI 返回内容为空' }
    };
  }

  logger.info(`[${requestId}] AI 响应成功，内容长度: ${aiContent.length}`);

  return { success: true, aiData, aiContent, modelName: actualModel };
}

// ✅ B7: retrieveRAGContext 已迁移至 _shared/rag-retriever.ts

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
    emotion,
    // [F3-FIX] 择校咨询扩展参数
    schoolInfo = {},
    history = []
  } = params;

  let systemPrompt = '';
  let userPrompt = content;
  let model = null;
  let temperature = null;
  let customMessages = null; // [F3-FIX] 多轮对话消息数组（consult 等场景使用）

  switch (action) {
    // ==================== 原有功能 ====================
    case 'generate': // 别名，兼容前端调用
    case 'generate_questions':
      systemPrompt = buildGenerateQuestionsPrompt();
      userPrompt = buildGenerateQuestionsUserPrompt(content, questionCount || 5);
      model = selectGenerateModel(content, questionCount);
      temperature = 0.7;
      break;

    case 'analyze':
      systemPrompt = buildMistakeAnalysisPrompt();
      userPrompt = buildMistakeAnalysisUserPrompt(question || content, userAnswer, correctAnswer, context);
      // ✅ 9.10: 简单错题分析(短内容)用 flash，复杂分析用 air
      model = content.length < 300 ? 'glm-4-flash' : 'glm-4.5-air';
      temperature = 0.6;
      break;

    case 'ocr_parse':
      systemPrompt = buildOcrParsePrompt();
      break;
    case 'chat':
      systemPrompt = buildChatPrompt();
      model = 'glm-4-flash';
      break;

    // ==================== 新增功能 ====================
    case 'adaptive_pick':
      systemPrompt = buildAdaptivePickPrompt();
      userPrompt = buildAdaptivePickUserPrompt(userProfile, mistakeStats, recentPractice);
      model = 'glm-4.5-air';
      temperature = 0.6;
      break;

    case 'material_understand':
      systemPrompt = buildMaterialUnderstandPrompt(materialType, difficulty, topicFocus);
      userPrompt = `## 学习资料\n"""\n${content.substring(0, 4000)}\n"""\n\n请基于此资料生成5道递进式练习题。`;
      model = 'glm-4.5-air';
      temperature = 0.7;
      break;

    case 'trend_predict':
      systemPrompt = buildTrendPredictPrompt();
      userPrompt = buildTrendPredictUserPrompt(historicalData, examYear, subject);
      model = 'glm-4.5-air';
      temperature = 0.5;
      break;

    case 'friend_chat':
      const friend = AI_FRIENDS[friendType] || AI_FRIENDS['yan-cong'];
      systemPrompt = buildFriendChatPrompt(friend, context, emotion);
      userPrompt = content;
      model = 'glm-4-flash';
      temperature = 0.85;
      break;

    case 'vision':
      // 视觉识别任务 - 用于通用图像理解
      systemPrompt = buildVisionPrompt(subject, context);
      userPrompt = content;
      model = 'glm-4v-plus';
      temperature = 0.3;
      break;

    case 'consult':
      // [F3-FIX] 院校咨询 — 支持多轮上下文 + 院校信息注入
      systemPrompt = buildConsultPrompt(subject, schoolInfo);
      userPrompt = content;
      model = 'glm-4-flash';
      temperature = 0.7;
      // [H-05 FIX] 限制 history 长度，防止客户端发送大量历史消息刷 Token 费用
      const safeHistory = Array.isArray(history) ? history.slice(-20) : [];
      // 构建多轮对话消息数组
      if (safeHistory.length > 0) {
        const consultMessages: Array<{ role: string; content: string }> = [{ role: 'system', content: systemPrompt }];
        for (const msg of safeHistory) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            consultMessages.push({ role: msg.role, content: msg.content });
          }
        }
        consultMessages.push({ role: 'user', content: userPrompt });
        // 传递自定义 messages 给 callAIWithFallback
        customMessages = consultMessages;
      }
      break;

    case 'recommend':
      systemPrompt = buildRecommendPrompt();
      userPrompt = content;
      model = 'glm-4.5-air';
      temperature = 0.7;
      break;

    default:
      // 默认使用通用聊天
      systemPrompt = buildDefaultPrompt();
      break;
  }

  // RAG 增强标记：以下 action 将在调用前注入检索上下文
  const ragEnabledActions = [
    'analyze',
    'chat',
    'friend_chat',
    'material_understand',
    'generate_questions',
    'adaptive_pick'
  ];
  const ragEnabled = ragEnabledActions.includes(action);

  return { systemPrompt, userPrompt, model, temperature, customMessages, ragEnabled };
}

// ========== 以下 buildXxxPrompt 函数已迁移至 _shared/prompts/ 模块 ==========

/**
 * 解析JSON响应
 */
function parseJsonResponse(aiContent, action) {
  let jsonStr = aiContent;

  // 提取 JSON 部分（处理可能的 markdown 代码块）
  const jsonMatch = aiContent.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  } else {
    // 尝试直接找 JSON 数组或对象（使用非贪婪匹配避免捕获多余内容）
    const arrayMatch = aiContent.match(/\[[\s\S]*?\](?=[^[\]]*$)/);
    const objectMatch = aiContent.match(/\{[\s\S]*?\}(?=[^{}]*$)/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    } else if (objectMatch) {
      jsonStr = objectMatch[0];
    }
  }

  const parsed = JSON.parse(jsonStr);

  // 针对不同action进行后处理
  if (action === 'generate_questions') {
    const questions = Array.isArray(parsed) ? parsed : [parsed];
    return questions.map((q, index) => ({
      id: `ai_${Date.now()}_${index}`,
      question: q.question || q.title || '',
      options: q.options || [],
      answer: q.answer || 'A',
      analysis: q.analysis || q.explanation || '',
      source: 'AI生成',
      type: '单选'
    }));
  }

  return parsed;
}

// ✅ B7: loadConversationMemory / saveConversationMemory 已迁移至 _shared/conversation-memory.ts
