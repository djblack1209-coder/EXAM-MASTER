/**
 * 答题数据分析记录模块
 * 从 do-quiz.vue 提取，负责将答题数据分发到各个分析子模块
 *
 * ⚠️ 隐藏约束（Chesterton's Fence）：
 * - 每个子模块的 try/catch 是独立的，一个失败不影响其他模块记录
 * - smart-question-picker 已下沉到 practice-sub，避免进入主包
 * - learning-analytics 使用动态导入，避免主包引入分包依赖
 */

import { recordTime as recordQuestionTime } from './question-timer.js';
import { saveOfflineAnswer } from './offline-cache.js';
import { logger } from '@/utils/logger.js';
import { recordSmartAnswer } from './utils/smart-question-picker.js';
import { recordAnswer as recordAnalyticsAnswer } from '@/utils/analytics/learning-analytics.js';

/**
 * 记录答题数据到各个分析模块
 * @param {Object} params
 * @param {Object} params.currentQuestion - 当前题目对象
 * @param {boolean} params.isCorrect - 是否答对
 * @param {number} params.timeSpent - 答题用时（毫秒）
 * @param {number} params.userChoice - 用户选择的选项索引
 * @param {number} params.questionTimeLimit - 单题时限（秒）
 * @param {Function} params.getOptionLabel - 获取选项标签的函数
 * @returns {Object} questionData - 记录的题目数据
 */
export async function recordAnswerToAnalytics({
  currentQuestion,
  isCorrect,
  timeSpent,
  userChoice,
  questionTimeLimit,
  getOptionLabel
}) {
  if (!currentQuestion) return null;

  const questionData = {
    questionId: currentQuestion.id,
    category: currentQuestion.category,
    difficulty: currentQuestion.difficulty || 2,
    isCorrect,
    timeSpent
  };

  // 记录到智能组题模块（懒加载）
  try {
    recordSmartAnswer(currentQuestion, isCorrect, timeSpent);
  } catch (e) {
    logger.warn('[quiz-analytics] 记录到智能组题模块失败:', e);
  }

  // 记录到学习数据分析模块
  try {
    recordAnalyticsAnswer(questionData);
  } catch (e) {
    logger.warn('[quiz-analytics] 记录到学习分析模块失败:', e);
  }

  // 记录到单题计时器模块
  try {
    recordQuestionTime({
      ...questionData,
      timeLimit: questionTimeLimit
    });
  } catch (e) {
    logger.warn('[quiz-analytics] 记录到计时器模块失败:', e);
  }

  // ✅ 保存离线答题记录
  try {
    saveOfflineAnswer({
      questionId: currentQuestion.id,
      questionContent: currentQuestion.question,
      userAnswer: getOptionLabel(userChoice),
      correctAnswer: currentQuestion.answer,
      isCorrect,
      timeSpent,
      category: currentQuestion.category
    });
  } catch (e) {
    logger.warn('[quiz-analytics] 保存离线答题记录失败:', e);
  }

  logger.log('[quiz-analytics] ✅ 答题数据已记录:', questionData);
  return questionData;
}
