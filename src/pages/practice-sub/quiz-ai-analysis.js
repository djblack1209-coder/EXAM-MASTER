/**
 * 智能深度解析模块
 * 从 do-quiz.vue 提取，负责调用后端智能代理进行题目解析
 *
 * ⚠️ 隐藏约束（Chesterton's Fence）：
 * - lafService.proxyAI('analyze', ...) 后端会自动注入考研辅导专家 Prompt
 * - response.code === 0 是兼容桥接格式（proxyAI 内部 force-inject）
 * - 降级文案根据错误类型区分（timeout / 401 / 网络），不可合并
 */

import { lafService } from '@/services/lafService.js';
import { logger } from '@/utils/logger.js';
import { storageService } from '@/services/storageService.js';

// ✅ [P3] 加载用户学习风格配置，注入AI prompt实现个性化解析
function _getLearningStyleDirective() {
  try {
    const config = storageService.get('learning_style_config');
    if (!config) return '';

    const DEPTHS = {
      basic: '用简单直白的语言解释，多举例子，避免复杂推导',
      standard: '平衡解释深度，适当展示推导过程',
      advanced: '深入分析解题思路，指出常见陷阱，给出举一反三的变式',
      expert: '精准定位知识盲区，用最简洁的方式点明关键，不需要基础铺垫'
    };
    const STYLES = {
      visual: '多用对比表格、分类列举、结构化呈现',
      verbal: '用完整的文字叙述，逻辑清晰，层层递进',
      example: '先给出典型例题，再总结规律，用例子驱动理解',
      socratic: '不直接给答案，用提问引导思考，逐步揭示解题路径'
    };
    const TONES = {
      encouraging: '语气温暖鼓励，肯定进步，错误时安慰并引导',
      neutral: '语气客观中性，直接指出问题和解法',
      strict: '语气严谨，高标准要求，直接指出不足'
    };

    const depth = DEPTHS[config.depth] || DEPTHS.standard;
    const style = STYLES[config.style] || STYLES.example;
    const tone = TONES[config.tone] || TONES.encouraging;

    let directive = `[个性化要求] ${depth}。${style}。${tone}。`;
    if (config.targetScore > 0) directive += ` 目标分数${config.targetScore}分。`;
    if (config.weakSubjects?.length > 0) directive += ` 薄弱科目：${config.weakSubjects.join('、')}，请额外详细。`;
    return directive;
  } catch (_e) {
    return '';
  }
}

/**
 * 请求智能深度解析
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
    // ✅ [P3] 注入用户学习风格指令，实现个性化AI解析
    const styleDirective = _getLearningStyleDirective();
    const response = await lafService.proxyAI('analyze', {
      question: questionText,
      options: options,
      userAnswer: userAnswer,
      correctAnswer: correctAnswer,
      ...(styleDirective ? { learningStyleHint: styleDirective } : {})
    });

    // 处理响应
    if (response.code === 0 && response.data) {
      return {
        comment: response.data.trim(),
        success: true
      };
    } else {
      // API 返回错误
      logger.warn('[quiz-ai] 智能解析返回异常:', response.message);
      return {
        comment: '智能解析暂时不可用，请结合参考答案进行复习。建议重新审视题干与选项的对应关系，查找知识点薄弱环节。',
        success: false
      };
    }
  } catch (e) {
    logger.warn('[quiz-ai] 智能解析请求失败，降级到本地解析:', e);

    // 根据错误类型提供更详细的提示
    let fallbackComment = '网络连接中断，智能导师未能成功接入。建议重新审视题干与选项的对应关系，查看解析加深理解。';
    if (e.message && e.message.includes('timeout')) {
      fallbackComment = '智能解析请求超时，请稍后重试。建议先查看题目解析，理解知识点。';
    } else if (e.message && e.message.includes('401')) {
      fallbackComment = '智能服务配置异常，请联系管理员。建议先查看题目解析，理解知识点。';
    } else if (e.message && (e.message.includes('网络') || e.message.includes('fail'))) {
      fallbackComment = '网络连接中断，智能导师未能成功接入。建议重新审视题干与选项的对应关系，查看解析加深理解。';
    }

    logger.log('[quiz-ai] ✅ 已使用降级文案');
    return {
      comment: fallbackComment,
      success: false
    };
  }
}
