/**
 * 保存明确提交的原答与参考匹配，沿原编号同步到学习记录和后端。
 * 本地答案键不构成可靠评分，不分发到掌握度、每日正确率和计时评分。
 */

import { saveOfflineAnswer } from './offline-cache.js';
import { logger } from '@/utils/logger.js';
// H026 FIX: 通过 API domain 层调用，不再直接导入 _request-core.js
import { recordQuizLearningAttempt } from '@/services/learning/quiz-learning-bridge.js';
import { submitAnswer } from '@/services/api/domains/practice.api.js';
import {
  isValidQuizAttemptId,
  isValidQuizSessionId,
  parseQuizSubmissionReceipt
} from '@/services/quiz-session-contract.js';
import { getUserId, getToken } from '@/services/auth-storage.js';

/**
 * 记录答题数据到各个分析模块
 * @param {Object} params
 * @param {Object} params.currentQuestion - 当前题目对象
 * @param {boolean} params.isCorrect - 本地参考答案是否匹配（不代表可靠判分）
 * @param {number} params.timeSpent - 答题用时（毫秒）
 * @param {number} params.userChoice - 用户选择的选项索引
 * @param {number} params.questionTimeLimit - 单题时限（秒）
 * @param {Function} params.getOptionLabel - 获取选项标签的函数
 * @param {string} [params.sessionId] - 刷题会话ID（用于AI诊断闭环）
 * @returns {Object} questionData - 记录的题目数据
 */
export async function recordAnswerToAnalytics({
  currentQuestion,
  isCorrect,
  timeSpent,
  userChoice,
  questionTimeLimit,
  getOptionLabel,
  sessionId,
  attemptId,
  canContinue = () => true
}) {
  if (!currentQuestion) return null;
  const owner = getUserId() || '';
  const token = getToken() || '';
  const stillCurrent = () => (getUserId() || '') === owner && (getToken() || '') === token && canContinue();
  if (!stillCurrent()) return null;

  // 在任何异步操作前冻结本次明确提交，重试不读取后来的草稿。
  currentQuestion = JSON.parse(JSON.stringify(currentQuestion));
  const userAnswer = String(getOptionLabel(userChoice));
  const submitted = {
    question_id: Number.isSafeInteger(currentQuestion.id) ? String(currentQuestion.id) : currentQuestion.id,
    user_answer: userAnswer,
    session_id: sessionId,
    duration: Math.round(timeSpent / 1000),
    practice_mode: 'normal'
  };
  const questionData = {
    questionId: currentQuestion.id,
    category: currentQuestion.category,
    difficulty: currentQuestion.difficulty || 2,
    isCorrect: null,
    grade: { status: 'pending' },
    source: 'reference_match',
    referenceMatch: typeof isCorrect === 'boolean' ? isCorrect : null,
    timeSpent
  };

  try {
    await recordQuizLearningAttempt({
      currentQuestion,
      sessionId,
      attemptId,
      userAnswer,
      canContinue: stillCurrent
    });
    if (stillCurrent()) uni.$emit('conversationLearningUpdated');
  } catch (_error) {
    if (_error?.code === 'STOPPED') return null;
    logger.warn('[quiz-analytics] 对话学习记录写入失败，旧版答题记录仍保留');
  }
  if (!stillCurrent()) return null;

  const offlineAnswer = {
    ...questionData,
    attemptId,
    sessionId,
    userId: owner,
    questionContent: currentQuestion.question,
    userAnswer,
    correctAnswer: currentQuestion.answer,
    timeLimit: questionTimeLimit
  };
  let localSaved = false;
  try {
    localSaved = (await saveOfflineAnswer(offlineAnswer)) === true;
  } catch {
    logger.warn('[quiz-analytics] 离线原答保存未完成');
  }
  if (!stillCurrent()) return null;

  let submission = { status: owner && token ? 'unconfirmed' : 'local_only' };
  // 访客不向受保护接口发送请求；账户、令牌或页面变化后不接收迟到回执。
  if (owner && token && isValidQuizSessionId(sessionId) && isValidQuizAttemptId(attemptId)) {
    try {
      const response = await submitAnswer({ idempotencyKey: attemptId, data: submitted });
      if (!stillCurrent()) return null;
      submission = parseQuizSubmissionReceipt(response, attemptId, submitted) || submission;
      if (submission.status === 'received') {
        localSaved = (await saveOfflineAnswer({ ...offlineAnswer, submission })) === true;
      }
    } catch {
      logger.warn('[quiz-analytics] 原答同步未完成，可沿原编号重试');
    }
  }
  if (!stillCurrent()) return null;
  return { ...questionData, submission: { ...submission, localSaved } };
}
