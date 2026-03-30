/**
 * AI 智能服务 API
 * 职责：AI 代理请求、智能好友对话、拍照搜题、
 *       AI 诊断闭环、AI 个性化推题
 *
 * ⚠️ 隐藏约束：
 * - proxyAI 中 response.code = 0 强制注入：兼容新旧 API 格式的桥接补丁
 *
 * @module services/api/domains/ai
 */

import { logger } from '@/utils/logger.js';
import config from '../../../config/index.js';
import { getUserId } from '../../auth-storage.js';
import { request, normalizeError } from './_request-core.js';

/**
 * 智能代理请求（适配后端 action/payload 模式）
 * ⚠️ 重要：后端使用 action/payload 结构，不是直接传 messages
 *
 * @param {string} action - 操作类型：'generate_questions' | 'analyze' | 'chat'
 * @param {Object} payload - 请求数据
 * @param {Object} _options - 可选配置 { model, timeout }
 * @returns {Promise} 返回格式：兼容 { success: true, data: ... } 和 { code: 0, data: ... }
 */
export async function proxyAI(action, payload, _options = {}) {
  // 前置参数校验
  if (!payload || typeof payload !== 'object') {
    logger.error('❌ [LafService] 参数错误: payload 必须是对象');
    return {
      code: -1,
      success: false,
      message: '参数错误: payload 不能为空',
      data: null
    };
  }

  // 检查 content 字段
  if (action === 'chat' || action === 'analyze' || action === 'generate_questions') {
    if (!payload.content || typeof payload.content !== 'string' || payload.content.trim() === '') {
      logger.error('❌ [LafService] 拦截: 尝试发送空内容给智能');
      return {
        code: -1,
        success: false,
        message: '输入内容不能为空',
        data: null
      };
    }
    payload.content = payload.content.trim();
  }

  logger.log('[LafService] 🚀 发起智能请求:', {
    action,
    payloadKeys: Object.keys(payload || {}),
    payloadSample: JSON.stringify(payload).substring(0, 100),
    hasContent: !!payload.content,
    contentLength: payload.content ? payload.content.length : 0
  });

  try {
    let userId;
    try {
      userId = getUserId() || 'anonymous';
    } catch (authErr) {
      logger.warn('[LafService] getUserId() 异常，降级为 anonymous:', authErr);
      userId = 'anonymous';
    }

    const requestData = {
      action: action || 'chat',
      ...payload
    };

    if (userId !== 'anonymous') {
      requestData.userId = userId;
    }

    logger.log('[LafService] 📤 请求数据:', {
      action: requestData.action,
      hasContent: !!requestData.content,
      contentPreview: requestData.content ? requestData.content.substring(0, 50) + '...' : 'N/A',
      userId: userId
    });

    // 智能请求超时保护
    const aiTimeout = _options.timeout || config.ai.timeout || 60000;
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('AI_TIMEOUT')), aiTimeout);
    });

    let response;
    try {
      response = await Promise.race([
        request('/proxy-ai', requestData, { timeout: aiTimeout, maxRetries: 1 }),
        timeoutPromise
      ]);
    } finally {
      clearTimeout(timeoutId);
    }

    logger.log('[LafService] 📡 原始响应:', {
      hasSuccess: 'success' in response,
      hasCode: 'code' in response,
      hasData: 'data' in response,
      successValue: response.success,
      codeValue: response.code,
      dataType: typeof response.data,
      dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
      fullResponse: response
    });

    // 双重认证补丁：success: true → 注入 code: 0
    if (response.success === true) {
      response.code = 0;
      logger.log('[LafService] ✅ 智能响应成功 (兼容模式已激活)');
      logger.log('[LafService] 📦 返回数据:', {
        code: response.code,
        success: response.success,
        dataType: typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A'
      });
      return response;
    }

    if (response.code === 0) {
      logger.log('[LafService] ✅ 智能响应成功 (旧格式)');
      return response;
    }

    if (response.error || response.success === false) {
      const errorMsg = response.error || response.message || '智能服务异常';
      logger.error('[LafService] ❌ 智能响应错误:', errorMsg);
      throw new Error(errorMsg);
    }

    logger.warn('[LafService] ⚠️ 未知响应格式，视为异常:', response);
    return {
      code: -1,
      success: false,
      message: '智能服务返回了未知格式的响应',
      data: response,
      _fallback: true
    };
  } catch (error) {
    logger.error('[LafService] ❌ 智能代理请求失败:', {
      error: error,
      message: error.message,
      stack: error.stack
    });

    const isTimeout = error.message === 'AI_TIMEOUT';
    const isOffline = error.message?.includes('网络') || error.errMsg?.includes('fail');

    if (isTimeout) {
      logger.warn('[LafService] ⏱️ 智能请求超时');
      // [AUDIT FIX R269] 统一使用 normalizeError
      return { ...normalizeError(error, 'AI代理请求超时'), _timeout: true, _fallback: true };
    }

    // [AUDIT FIX R269] 统一使用 normalizeError
    return { ...normalizeError(error, 'AI代理请求'), _offline: isOffline, _fallback: true };
  }
}

/**
 * 智能好友对话（角色化聊天）
 * @param {string} friendType - 好友类型: 'yan-cong' | 'yan-man' | 'yan-shi' | 'yan-you'
 * @param {string} content - 用户消息
 * @param {Object} context - 上下文信息
 * @returns {Promise} 返回智能回复
 */
export async function aiFriendChat(friendType, content, context = {}) {
  if (!content || content.trim() === '') {
    return {
      code: -1,
      success: false,
      message: '消息内容不能为空',
      data: null
    };
  }

  logger.log('[LafService] 🤖 智能好友对话:', { friendType, contentLength: content.length });

  return await proxyAI('friend_chat', {
    content: content.trim(),
    friendType: friendType || 'yan-cong',
    context: {
      emotion: context.emotion || 'neutral',
      conversationCount: context.conversationCount || 0,
      studyState: context.studyState || '正常',
      recentAccuracy: context.recentAccuracy || 0,
      recentConversations: context.recentConversations || ''
    }
  });
}

// [AUDIT R274] 已删除 12 个无调用方的死代码函数:
// adaptiveQuestionPick, materialUnderstand, trendPredict, deepMistakeAnalysis,
// getAiFriendMemory, createLesson, getLessonStatus, getLessonList,
// deleteLesson, startClassroom, sendClassroomMessage, endClassroom

/**
 * 拍照搜题（视觉识别）
 * @param {string} imageBase64 - 图片Base64编码
 * @param {Object} options - 配置选项
 * @returns {Promise} 返回识别结果和匹配题目
 */
export async function photoSearch(imageBase64, options = {}) {
  if (!imageBase64) {
    return {
      code: -1,
      success: false,
      message: '图片数据不能为空',
      data: null
    };
  }

  logger.log('[LafService] 📷 拍照搜题:', {
    imageSize: imageBase64.length,
    subject: options.subject
  });

  try {
    const response = await request('/ai-photo-search', {
      imageBase64,
      subject: options.subject || '',
      context: options.context || ''
    });
    return response;
  } catch (error) {
    logger.error('[LafService] 拍照搜题失败:', error);
    return normalizeError(error, '拍照搜题');
  }
}

// ==================== AI 诊断闭环 ====================

/**
 * 生成AI诊断报告（刷题结束时调用）
 * @param {string} sessionId - 刷题会话ID
 */
export async function generateDiagnosis(sessionId) {
  try {
    return await request(
      '/ai-diagnosis',
      { action: 'generate', data: { sessionId } },
      { timeout: config.ai.timeout, maxRetries: 1 }
    );
  } catch (error) {
    logger.warn('[LafService] 生成AI诊断失败:', error);
    return normalizeError(error, '生成AI诊断');
  }
}

/**
 * 获取AI诊断报告
 * @param {object} params - { diagnosisId } 或 { sessionId }
 */
export async function getDiagnosis(params) {
  try {
    return await request('/ai-diagnosis', {
      action: 'get',
      data: params
    });
  } catch (error) {
    logger.warn('[LafService] 获取诊断报告失败:', error);
    return normalizeError(error, '获取诊断报告');
  }
}

/**
 * 获取AI推荐的复习计划（基于诊断+SM-2）
 */
export async function getReviewPlan() {
  try {
    return await request('/ai-diagnosis', {
      action: 'get_review_plan',
      data: {}
    });
  } catch (error) {
    logger.warn('[LafService] 获取复习计划失败:', error);
    return normalizeError(error, '获取复习计划');
  }
}

/**
 * 获取智能推荐题目（基于 AI 诊断的个性化推题）
 * @param {Object} params - 推荐参数 { count, limit, ... }
 * @returns {Promise} 返回推荐题目列表
 */
export async function getSmartRecommendations(params = {}) {
  try {
    return await request('/ai-diagnosis', {
      action: 'smart_recommend',
      data: params
    });
  } catch (error) {
    logger.warn('[LafService] 获取智能推荐失败:', error);
    return normalizeError(error, '获取智能推荐');
  }
}
