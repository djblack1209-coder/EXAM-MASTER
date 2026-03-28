/**
 * AI 智能服务 API
 * 职责：AI 代理请求、智能好友对话、智能组题、资料理解出题、
 *       考点预测、错题分析、拍照搜题、AI 课堂、AI 批改、
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
      return {
        code: -1,
        success: false,
        message: '智能思考时间过长，请稍后重试或简化您的问题',
        error: error,
        data: null,
        _timeout: true,
        _fallback: true
      };
    }

    return {
      code: -1,
      success: false,
      message: isOffline ? '当前网络不可用，智能功能暂时无法使用' : error.message || '智能服务响应异常',
      error: error,
      data: null,
      _offline: isOffline,
      _fallback: true
    };
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

/**
 * 智能组题（基于用户画像和学习数据）
 * @param {Object} userProfile - 用户画像
 * @param {Object} mistakeStats - 错题统计
 * @param {Object} recentPractice - 最近练习数据
 * @returns {Promise} 返回推荐题目列表
 */
export async function adaptiveQuestionPick(userProfile = {}, mistakeStats = {}, recentPractice = {}) {
  logger.log('[LafService] 📊 智能组题请求:', {
    targetSchool: userProfile.targetSchool,
    questionCount: userProfile.questionCount
  });

  return await proxyAI('adaptive_pick', {
    content: '请根据学生画像生成个性化题目推荐',
    userProfile,
    mistakeStats,
    recentPractice
  });
}

/**
 * 资料理解出题
 * @param {string} materialText - 学习资料文本
 * @param {Object} options - 配置选项
 * @returns {Promise} 返回生成的题目
 */
export async function materialUnderstand(materialText, options = {}) {
  if (!materialText || materialText.trim() === '') {
    return {
      code: -1,
      success: false,
      message: '资料内容不能为空',
      data: null
    };
  }

  logger.log('[LafService] 📚 资料理解出题:', {
    textLength: materialText.length,
    materialType: options.materialType
  });

  return await proxyAI('material_understand', {
    content: materialText.trim(),
    materialType: options.materialType || '教材',
    difficulty: options.difficulty || 3,
    topicFocus: options.topicFocus || ''
  });
}

/**
 * 考点趋势预测
 * @param {Object} historicalData - 历年真题数据
 * @param {number} examYear - 目标考试年份
 * @param {string} subject - 学科
 * @returns {Promise} 返回预测结果
 */
export async function trendPredict(historicalData = {}, examYear = 2025, subject = '') {
  logger.log('[LafService] 🔮 考点趋势预测:', { examYear, subject });

  return await proxyAI('trend_predict', {
    content: '请预测考研热点考点',
    historicalData,
    examYear,
    subject
  });
}

/**
 * 错题深度分析（升级版）
 * @param {Object} mistakeData - 错题数据
 * @param {Object} userHistory - 用户历史数据
 * @returns {Promise} 返回分析结果
 */
export async function deepMistakeAnalysis(mistakeData, userHistory = {}) {
  if (!mistakeData || !mistakeData.question) {
    return {
      code: -1,
      success: false,
      message: '错题数据不完整',
      data: null
    };
  }

  logger.log('[LafService] 🔍 错题深度分析:', {
    category: mistakeData.category,
    hasUserHistory: Object.keys(userHistory).length > 0
  });

  const analysisContent = `
题目：${mistakeData.question}
选项：${JSON.stringify(mistakeData.options || [])}
学生答案：${mistakeData.userAnswer || '未作答'}
正确答案：${mistakeData.correctAnswer || '未知'}
学科分类：${mistakeData.category || '未分类'}
答题用时：${mistakeData.duration || '未知'}秒
    `.trim();

  return await proxyAI('analyze', {
    content: analysisContent,
    question: mistakeData.question,
    userAnswer: mistakeData.userAnswer,
    correctAnswer: mistakeData.correctAnswer,
    context: {
      topicAccuracy: userHistory.topicAccuracy,
      typeAccuracy: userHistory.typeAccuracy,
      recentState: userHistory.recentState,
      consecutiveErrors: userHistory.consecutiveErrors
    }
  });
}

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

/**
 * 获取智能好友对话记忆
 * @param {string} friendType - 好友类型
 * @returns {Promise} 返回历史对话
 */
export async function getAiFriendMemory(friendType) {
  try {
    const userId = getUserId();

    if (!userId) {
      return { code: 0, success: true, data: [] };
    }

    const response = await request('/ai-friend-memory', {
      action: 'get',
      userId,
      friendType
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 获取智能好友记忆失败:', error);
    return normalizeError(error, '获取智能好友记忆');
  }
}

// ==================== AI 课堂服务 ====================

/**
 * 创建AI课程（异步生成）
 * @param {string} topic - 学习主题
 * @param {string} subject - 考研科目
 * @param {string} [materials] - 学习资料文本
 * @param {number} [sceneCount=6] - 场景数量
 */
export async function createLesson(topic, subject, materials, sceneCount = 6) {
  try {
    return await request(
      '/lesson-generator',
      { action: 'create', data: { topic, subject, materials, sceneCount } },
      { timeout: 30000, maxRetries: 1 }
    );
  } catch (error) {
    logger.warn('[LafService] 创建课程失败:', error);
    return normalizeError(error, '创建课程');
  }
}

/**
 * 查询课程生成进度
 * @param {string} lessonId - 课程ID
 */
export async function getLessonStatus(lessonId) {
  try {
    return await request('/lesson-generator', {
      action: 'status',
      data: { lessonId }
    });
  } catch (error) {
    logger.warn('[LafService] 查询课程状态失败:', error);
    return normalizeError(error, '查询课程状态');
  }
}

/**
 * 获取用户课程列表
 * @param {number} [page=1]
 * @param {number} [pageSize=20]
 */
export async function getLessonList(page = 1, pageSize = 20) {
  try {
    return await request('/lesson-generator', {
      action: 'list',
      data: { page, pageSize }
    });
  } catch (error) {
    logger.warn('[LafService] 获取课程列表失败:', error);
    return normalizeError(error, '获取课程列表');
  }
}

/**
 * 删除课程
 * @param {string} lessonId
 */
export async function deleteLesson(lessonId) {
  try {
    return await request('/lesson-generator', {
      action: 'delete',
      data: { lessonId }
    });
  } catch (error) {
    logger.warn('[LafService] 删除课程失败:', error);
    return normalizeError(error, '删除课程');
  }
}

/**
 * 创建课堂会话（开始上课）
 * @param {string} lessonId
 */
export async function startClassroom(lessonId) {
  try {
    return await request('/agent-orchestrator', { action: 'start_session', data: { lessonId } }, { timeout: 15000 });
  } catch (error) {
    logger.warn('[LafService] 创建课堂会话失败:', error);
    return normalizeError(error, '创建课堂会话');
  }
}

/**
 * 发送课堂消息（推进多Agent对话）
 * @param {string} sessionId
 * @param {string} [message] - 用户消息（可选）
 */
export async function sendClassroomMessage(sessionId, message) {
  try {
    return await request(
      '/agent-orchestrator',
      { action: 'send_message', data: { sessionId, message } },
      { timeout: 60000, maxRetries: 1 }
    );
  } catch (error) {
    logger.warn('[LafService] 课堂消息发送失败:', error);
    return normalizeError(error, '课堂消息发送');
  }
}

/**
 * 结束课堂
 * @param {string} sessionId
 */
export async function endClassroom(sessionId) {
  try {
    return await request('/agent-orchestrator', {
      action: 'end_session',
      data: { sessionId }
    });
  } catch (error) {
    logger.warn('[LafService] 结束课堂失败:', error);
    return normalizeError(error, '结束课堂');
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
      { timeout: 60000, maxRetries: 1 }
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
