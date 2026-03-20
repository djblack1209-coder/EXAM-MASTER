/**
 * AI测验批改云函数
 * 搬运自 OpenMAIC app/api/quiz-grade/ 的AI实时批改+反馈逻辑
 *
 * 功能：
 * 1. grade - AI批改单题
 * 2. batch_grade - AI批量批改
 * 3. get_results - 获取批改结果
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware';
import {
  success,
  badRequest,
  unauthorized,
  serverError,
  generateRequestId,
  checkRateLimitDistributed,
  createLogger
} from './_shared/api-response';
import { AiGradeResult } from './_shared/agents/agent-types';
import { gradeAnswer } from './_shared/agents/examiner-agent';

const db = cloud.database();
const logger = createLogger('[AiQuizGrade]');

const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 30;

export default async function (ctx: any) {
  const requestId = generateRequestId('grade');

  try {
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return unauthorized('请先登录');
    }
    const userId = authResult.userId;

    const rateLimitKey = `ai-quiz-grade:${userId}`;
    const rateLimit = await checkRateLimitDistributed(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);
    if (!rateLimit.allowed) {
      return { code: 429, success: false, message: '请求过于频繁，请稍后再试', requestId };
    }

    const { action, data } = ctx.body || {};
    if (!action) return badRequest('缺少 action 参数');

    switch (action) {
      case 'grade':
        return await gradeSingle(userId, data, requestId);
      case 'batch_grade':
        return await gradeBatch(userId, data, requestId);
      case 'get_results':
        return await getResults(userId, data, requestId);
      default:
        return badRequest(`不支持的操作: ${action}`);
    }
  } catch (err: any) {
    logger.error(`[${requestId}] 未捕获异常:`, err.message);
    return serverError('服务异常，请稍后重试');
  }
}

// ==================== grade ====================
async function gradeSingle(userId: string, data: any, requestId: string) {
  const { questionId, question, correctAnswer, userAnswer, subject, topic, lessonId, sceneId } = data || {};
  if (!questionId || !question || !userAnswer) {
    return badRequest('缺少必要参数: questionId, question, userAnswer');
  }

  const aiResult = await gradeAnswer(subject || '专业课', topic || '综合', question, correctAnswer || '', userAnswer);

  // 解析AI返回的批改结果
  let gradeData: any = {};
  try {
    const jsonMatch = aiResult.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : aiResult.content.trim();
    const parsed = JSON.parse(jsonStr);
    gradeData = parsed.result || parsed;
  } catch {
    // AI返回非JSON，作为纯文本反馈
    gradeData = {
      isCorrect: false,
      score: 0,
      feedback: aiResult.content,
      suggestions: [],
      relatedKnowledge: []
    };
  }

  // 存储批改结果
  const gradeResult: Omit<AiGradeResult, '_id'> = {
    userId,
    lessonId: lessonId || undefined,
    sceneId: sceneId || undefined,
    questionId,
    userAnswer,
    isCorrect: !!gradeData.isCorrect,
    score: Number(gradeData.score) || 0,
    feedback: gradeData.feedback || '',
    suggestions: Array.isArray(gradeData.suggestions) ? gradeData.suggestions : [],
    relatedKnowledge: Array.isArray(gradeData.relatedKnowledge) ? gradeData.relatedKnowledge : [],
    created_at: Date.now()
  };

  const insertResult = await db.collection('ai_grade_results').add(gradeResult);

  logger.info(`[${requestId}] AI批改完成: question=${questionId}, score=${gradeResult.score}`);

  return success({
    gradeId: insertResult.id,
    ...gradeResult
  });
}

// ==================== batch_grade ====================
async function gradeBatch(userId: string, data: any, requestId: string) {
  const { answers, subject, topic, lessonId, sceneId } = data || {};
  if (!Array.isArray(answers) || answers.length === 0) {
    return badRequest('缺少 answers 数组');
  }
  if (answers.length > 20) {
    return badRequest('单次批量批改最多20题');
  }

  const results = [];
  for (const item of answers) {
    try {
      const result = await gradeSingle(
        userId,
        {
          ...item,
          subject,
          topic,
          lessonId,
          sceneId
        },
        requestId
      );
      results.push(result);
    } catch (err: any) {
      results.push({
        questionId: item.questionId,
        error: err.message
      });
    }
  }

  return success({
    total: answers.length,
    graded: results.filter((r: any) => r.code === 0 || r.success).length,
    results
  });
}

// ==================== get_results ====================
async function getResults(userId: string, data: any, _requestId: string) {
  const { lessonId, questionId, page = 1, pageSize = 20 } = data || {};
  const skip = (page - 1) * pageSize;

  const where: any = { userId };
  if (lessonId) where.lessonId = lessonId;
  if (questionId) where.questionId = questionId;

  const [countResult, listResult] = await Promise.all([
    db.collection('ai_grade_results').where(where).count(),
    db.collection('ai_grade_results').where(where).orderBy('created_at', 'desc').skip(skip).limit(pageSize).get()
  ]);

  return success({
    list: listResult.data,
    total: countResult.total,
    page,
    pageSize
  });
}
