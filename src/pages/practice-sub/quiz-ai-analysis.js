/**
 * AI 深度解析模块（已降级）
 * ai.api 已移除，仅返回题目自带解析
 */
import { logger } from '@/utils/logger.js';

/**
 * 获取 AI 深度解析（降级：返回题目自带解析）
 * @param {Object} params
 * @param {Object} params.question - 当前题目
 * @param {string} params.userChoice - 用户选择
 * @returns {{ success: boolean, comment: string }}
 */
export async function fetchAIDeepAnalysis({ question, userChoice }) {
  logger.warn('[quiz-ai-analysis] AI 深度解析已降级，使用题目自带解析');
  const comment = question?.desc || question?.analysis || '暂无解析';
  return { success: false, comment };
}
