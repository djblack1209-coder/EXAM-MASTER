/**
 * AI 深度解析模块
 * 从 do-quiz.vue 提取，负责调用后端 AI 代理进行题目解析
 *
 * ⚠️ 隐藏约束（Chesterton's Fence）：
 * - lafService.proxyAI('analyze', ...) 后端会自动注入考研辅导专家 Prompt
 * - response.code === 0 是兼容桥接格式（proxyAI 内部 force-inject）
 * - 降级文案根据错误类型区分（timeout / 401 / 网络），不可合并
 */

import { lafService } from '@/services/lafService.js';
import { logger } from '@/utils/logger.js';

/**
 * 请求 AI 深度解析
 * @param {Object} params
 * @param {Object} params.question - 题目对象（含 question/title, options, answer）
 * @param {string} params.userChoice - 用户选择的选项文本
 * @returns {Promise<{comment: string, success: boolean}>}
 */
export async function fetchAIDeepAnalysis({ question, userChoice }) {
  const questionText = question.question || question.title || '';
  const options = question.options || [];
  const correctAnswer = question.answer || '';
  const userAnswer = userChoice || '';

  try {
    // ✅ 使用后端代理调用（安全）- action: 'analyze'
    // 后端会自动添加 "你是一位专业的考研辅导专家..." 的 Prompt
    const response = await lafService.proxyAI('analyze', {
      question: questionText,
      options: options,
      userAnswer: userAnswer,
      correctAnswer: correctAnswer
    });

    // 处理响应
    if (response.code === 0 && response.data) {
      return {
        comment: response.data.trim(),
        success: true
      };
    } else {
      // API 返回错误
      logger.warn('[quiz-ai] AI 解析返回异常:', response.message);
      return {
        comment: 'AI 解析暂时不可用，请结合参考答案进行复习。建议重新审视题干与选项的对应关系，查找知识点薄弱环节。',
        success: false
      };
    }
  } catch (e) {
    logger.warn('[quiz-ai] AI 解析请求失败，降级到本地解析:', e);

    // 根据错误类型提供更详细的提示
    let fallbackComment = '网络连接中断，AI 导师未能成功接入。建议重新审视题干与选项的对应关系，查看解析加深理解。';
    if (e.message && e.message.includes('timeout')) {
      fallbackComment = 'AI 解析请求超时，请稍后重试。建议先查看题目解析，理解知识点。';
    } else if (e.message && e.message.includes('401')) {
      fallbackComment = 'AI 服务配置异常，请联系管理员。建议先查看题目解析，理解知识点。';
    } else if (e.message && (e.message.includes('网络') || e.message.includes('fail'))) {
      fallbackComment = '网络连接中断，AI 导师未能成功接入。建议重新审视题干与选项的对应关系，查看解析加深理解。';
    }

    logger.log('[quiz-ai] ✅ 已使用降级文案');
    return {
      comment: fallbackComment,
      success: false
    };
  }
}
