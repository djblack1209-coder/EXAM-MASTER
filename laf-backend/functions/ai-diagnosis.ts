/**
 * AI诊断引擎 — 刷题结束后生成个性化诊断报告
 *
 * 这是「AI学习闭环」的核心枢纽：
 * 刷题(answer-submit) → 数据累积(practice_session_cache) → AI诊断(本函数)
 * → 生成薄弱点报告 → 推荐针对性讲解(lesson-generator) → 安排复习(SM-2)
 *
 * 功能：
 * 1. generate - 生成AI诊断报告（刷题结束时调用）
 * 2. get - 获取诊断报告
 * 3. list - 获取历史诊断列表
 * 4. get_review_plan - 获取AI推荐的复习计划
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
import { getProvider, ChatMessage } from './_shared/ai-providers/provider-factory';

const db = cloud.database();
const _ = db.command;
const logger = createLogger('[AiDiagnosis]');

export default async function (ctx: any) {
  const requestId = generateRequestId('diag');

  try {
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return unauthorized('请先登录');
    }
    const userId = authResult.userId;

    const rateLimitKey = `ai-diagnosis:${userId}`;
    const rateLimit = await checkRateLimitDistributed(rateLimitKey, 15, 60000);
    if (!rateLimit.allowed) {
      return { code: 429, success: false, message: '请求过于频繁', requestId };
    }

    const { action, data } = ctx.body || {};
    if (!action) return badRequest('缺少 action 参数');

    switch (action) {
      case 'generate':
        return await generateDiagnosis(userId, data, requestId);
      case 'get':
        return await getDiagnosis(userId, data, requestId);
      case 'list':
        return await listDiagnoses(userId, data, requestId);
      case 'get_review_plan':
        return await getReviewPlan(userId, data, requestId);
      case 'smart_recommend':
        return await smartRecommend(userId, data, requestId);
      default:
        return badRequest(`不支持的操作: ${action}`);
    }
  } catch (err: any) {
    logger.error(`[${requestId}] 异常:`, err.message);
    return serverError('服务异常');
  }
}

// ==================== generate ====================
async function generateDiagnosis(userId: string, data: any, requestId: string) {
  const { sessionId } = data || {};
  if (!sessionId) return badRequest('缺少 sessionId');

  // 1. 获取会话答题数据
  const sessionResult = await db
    .collection('practice_session_cache')
    .where({ user_id: userId, session_id: sessionId })
    .getOne();

  if (!sessionResult.data) {
    return { code: 404, success: false, message: '会话数据不存在', requestId };
  }

  const session = sessionResult.data;
  if (session.diagnosis_status === 'ready') {
    // 已有诊断，直接返回
    const existing = await db
      .collection('ai_diagnoses')
      .where({ userId, sessionId })
      .orderBy('created_at', 'desc')
      .getOne();
    if (existing.data) return success(existing.data);
  }

  // 乐观锁：仅当状态为 pending 时才标记为 generating（防止并发重复生成）
  if (session.diagnosis_status === 'generating') {
    return { code: 202, success: true, message: '诊断正在生成中，请稍后查询', requestId };
  }
  const lockResult = await db
    .collection('practice_session_cache')
    .where({ _id: session._id, diagnosis_status: 'pending' })
    .update({ diagnosis_status: 'generating' });
  if (!lockResult.updated || lockResult.updated === 0) {
    // 已被其他请求抢占，返回等待
    return { code: 202, success: true, message: '诊断正在生成中，请稍后查询', requestId };
  }

  const answers = session.answers || [];
  if (answers.length < 3) {
    return badRequest('答题数量不足（至少3题），无法生成有效诊断');
  }

  // 2. 统计分析
  const stats = analyzeAnswers(answers);

  // 3. 调用AI生成诊断
  const provider = getProvider();
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `你是一位考研学习诊断专家。根据学生的答题数据，生成精准的学习诊断报告。

要求：
1. 识别薄弱知识点（不是泛泛而谈，要具体到知识点）
2. 分析错误模式（是概念不清、计算失误、还是审题不仔细）
3. 给出针对性的学习建议（具体到应该复习什么、怎么复习）
4. 推荐下一步学习计划

严格按以下 JSON 格式输出：
{
  "overallLevel": "优秀|良好|一般|薄弱",
  "accuracy": 75,
  "weakPoints": [
    {
      "knowledgePoint": "具体知识点名称",
      "errorPattern": "错误模式描述",
      "severity": "high|medium|low",
      "suggestion": "针对性建议"
    }
  ],
  "strongPoints": ["掌握较好的知识点1", "知识点2"],
  "errorPatterns": [
    {
      "type": "概念混淆|计算失误|审题不仔细|知识盲区",
      "description": "具体描述",
      "frequency": 3
    }
  ],
  "studyPlan": {
    "immediate": "立即需要复习的内容",
    "thisWeek": "本周学习重点",
    "suggestion": "整体学习建议"
  },
  "encouragement": "一句鼓励的话"
}`
    },
    {
      role: 'user',
      content: `学生答题数据：
- 总题数：${stats.total}
- 正确率：${stats.accuracyPercent}%
- 各科目正确率：${JSON.stringify(stats.categoryStats)}
- 各难度正确率：${JSON.stringify(stats.difficultyStats)}
- 薄弱知识点（错误次数排序）：${JSON.stringify(stats.weakKnowledgePoints)}
- 平均答题时间：${stats.avgDuration}秒
- 错题详情：
${stats.wrongAnswers
  .slice(0, 15)
  .map(
    (a: any, i: number) =>
      `${i + 1}. [${a.category}/${a.difficulty}] 知识点:${a.knowledge_point} 用户答:${a.user_answer} 正确答:${a.correct_answer}`
  )
  .join('\n')}`
    }
  ];

  const aiResult = await provider.chat(messages, {
    temperature: 0.4,
    maxTokens: 4096
  });

  // 4. 解析AI结果
  let diagnosis: any = {};
  try {
    const jsonMatch = aiResult.content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : aiResult.content.trim();
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}') + 1;
    diagnosis = JSON.parse(jsonStr.substring(start, end));
  } catch {
    diagnosis = {
      overallLevel: stats.accuracyPercent >= 80 ? '良好' : stats.accuracyPercent >= 60 ? '一般' : '薄弱',
      accuracy: stats.accuracyPercent,
      weakPoints: stats.weakKnowledgePoints.map((kp: any) => ({
        knowledgePoint: kp.point,
        errorPattern: '需要加强练习',
        severity: kp.errorCount >= 3 ? 'high' : 'medium',
        suggestion: `重点复习${kp.point}相关内容`
      })),
      strongPoints: [],
      errorPatterns: [],
      studyPlan: { immediate: '复习错题', thisWeek: '针对薄弱点专项练习', suggestion: aiResult.content },
      encouragement: '继续加油！'
    };
  }

  // 5. 存储诊断报告
  const diagnosisDoc = {
    userId,
    sessionId,
    stats,
    diagnosis,
    created_at: Date.now()
  };

  const insertResult = await db.collection('ai_diagnoses').add(diagnosisDoc);

  // 6. 更新会话状态
  await db.collection('practice_session_cache').doc(session._id).update({
    diagnosis_status: 'ready'
  });

  // 7. [闭环关键] 根据诊断结果更新错题本的SM-2参数（失败不影响诊断结果）
  try {
    await updateMistakeReviewSchedule(userId, diagnosis.weakPoints || []);
  } catch (scheduleErr: any) {
    logger.warn(`[${requestId}] 更新SM-2复习计划失败（不影响诊断）:`, scheduleErr.message);
  }

  logger.info(
    `[${requestId}] AI诊断完成: accuracy=${stats.accuracyPercent}%, weakPoints=${(diagnosis.weakPoints || []).length}`
  );

  return success({ _id: insertResult.id, ...diagnosisDoc });
}

// ==================== 答题数据统计分析 ====================
function analyzeAnswers(answers: any[]) {
  const total = answers.length;
  const correct = answers.filter((a) => a.is_correct).length;
  const accuracyPercent = Math.round((correct / total) * 100);

  // 按科目统计
  const categoryMap: Record<string, { total: number; correct: number }> = {};
  // 按难度统计
  const difficultyMap: Record<string, { total: number; correct: number }> = {};
  // 按知识点统计错误
  const knowledgeErrorMap: Record<string, number> = {};

  const wrongAnswers: any[] = [];

  for (const a of answers) {
    // 科目
    const cat = a.category || '未分类';
    if (!categoryMap[cat]) categoryMap[cat] = { total: 0, correct: 0 };
    categoryMap[cat].total++;
    if (a.is_correct) categoryMap[cat].correct++;

    // 难度
    const diff = a.difficulty || 'medium';
    if (!difficultyMap[diff]) difficultyMap[diff] = { total: 0, correct: 0 };
    difficultyMap[diff].total++;
    if (a.is_correct) difficultyMap[diff].correct++;

    // 错题
    if (!a.is_correct) {
      const kp = a.knowledge_point || a.category || '未知';
      knowledgeErrorMap[kp] = (knowledgeErrorMap[kp] || 0) + 1;
      wrongAnswers.push(a);
    }
  }

  // 转换为数组并排序
  const categoryStats = Object.entries(categoryMap).map(([name, s]) => ({
    name,
    total: s.total,
    correct: s.correct,
    accuracy: Math.round((s.correct / s.total) * 100)
  }));

  const difficultyStats = Object.entries(difficultyMap).map(([name, s]) => ({
    name,
    total: s.total,
    correct: s.correct,
    accuracy: Math.round((s.correct / s.total) * 100)
  }));

  const weakKnowledgePoints = Object.entries(knowledgeErrorMap)
    .map(([point, errorCount]) => ({ point, errorCount }))
    .sort((a, b) => b.errorCount - a.errorCount);

  const totalDuration = answers.reduce((sum, a) => sum + (a.duration || 0), 0);
  const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0;

  return {
    total,
    correct,
    accuracyPercent,
    categoryStats,
    difficultyStats,
    weakKnowledgePoints,
    wrongAnswers,
    avgDuration
  };
}

// ==================== [闭环关键] 根据诊断更新错题复习计划 ====================
async function updateMistakeReviewSchedule(userId: string, weakPoints: any[]) {
  if (!weakPoints || weakPoints.length === 0) return;

  const now = Date.now();
  const mistakeCollection = db.collection('mistake_book');

  for (const wp of weakPoints) {
    if (!wp.knowledgePoint) continue;

    // 找到该知识点的错题
    const mistakes = await mistakeCollection
      .where({
        user_id: userId,
        knowledge_point: wp.knowledgePoint,
        is_mastered: false
      })
      .limit(20)
      .get();

    for (const mistake of mistakes.data || []) {
      // 根据严重程度调整复习间隔
      let nextReviewDelay: number;
      if (wp.severity === 'high') {
        nextReviewDelay = 20 * 60 * 1000; // 20分钟后
      } else if (wp.severity === 'medium') {
        nextReviewDelay = 8 * 60 * 60 * 1000; // 8小时后
      } else {
        nextReviewDelay = 24 * 60 * 60 * 1000; // 1天后
      }

      // 降低 easiness_factor（题目变难了）
      const newEF = Math.max(1.3, (mistake.easiness_factor || 2.5) - 0.15);

      await mistakeCollection.doc(mistake._id).update({
        next_review_at: now + nextReviewDelay,
        easiness_factor: newEF,
        ai_diagnosis_tag: wp.severity, // 标记AI诊断严重程度
        last_diagnosed_at: now
      });
    }
  }
}

// ==================== get ====================
async function getDiagnosis(userId: string, data: any, requestId: string) {
  const { diagnosisId, sessionId } = data || {};

  let result;
  if (diagnosisId) {
    result = await db.collection('ai_diagnoses').doc(diagnosisId).get();
  } else if (sessionId) {
    result = await db.collection('ai_diagnoses').where({ userId, sessionId }).orderBy('created_at', 'desc').getOne();
  } else {
    return badRequest('缺少 diagnosisId 或 sessionId');
  }

  if (!result.data || (result.data as any).userId !== userId) {
    return { code: 404, success: false, message: '诊断报告不存在', requestId };
  }

  return success(result.data);
}

// ==================== list ====================
async function listDiagnoses(userId: string, data: any, _requestId: string) {
  const { page = 1, pageSize = 10 } = data || {};
  const skip = (page - 1) * pageSize;

  const [countResult, listResult] = await Promise.all([
    db.collection('ai_diagnoses').where({ userId }).count(),
    db.collection('ai_diagnoses').where({ userId }).orderBy('created_at', 'desc').skip(skip).limit(pageSize).get()
  ]);

  return success({
    list: listResult.data,
    total: countResult.total,
    page,
    pageSize
  });
}

// ==================== get_review_plan ====================
// 基于AI诊断 + SM-2算法，生成智能复习计划
async function getReviewPlan(userId: string, _data: any, _requestId: string) {
  const now = Date.now();

  // 获取所有需要复习的错题（next_review_at <= now 且未掌握）
  const reviewNeeded = await db
    .collection('mistake_book')
    .where({
      user_id: userId,
      is_mastered: false,
      next_review_at: _.lte(now)
    })
    .orderBy('next_review_at', 'asc')
    .limit(30)
    .get();

  // 按AI诊断严重程度分组
  const urgent: any[] = []; // high severity
  const normal: any[] = []; // medium
  const light: any[] = []; // low or untagged

  for (const item of reviewNeeded.data || []) {
    if (item.ai_diagnosis_tag === 'high') {
      urgent.push(item);
    } else if (item.ai_diagnosis_tag === 'medium') {
      normal.push(item);
    } else {
      light.push(item);
    }
  }

  // 获取最近一次诊断报告的建议
  const latestDiagnosis = await db.collection('ai_diagnoses').where({ userId }).orderBy('created_at', 'desc').getOne();

  return success({
    reviewPlan: {
      urgent: { count: urgent.length, items: urgent.slice(0, 10) },
      normal: { count: normal.length, items: normal.slice(0, 10) },
      light: { count: light.length, items: light.slice(0, 10) },
      totalPending: reviewNeeded.data?.length || 0
    },
    latestDiagnosis: latestDiagnosis.data?.diagnosis || null,
    generatedAt: now
  });
}

// ==================== Phase 3-7: AI 个性化推题 ====================

/**
 * 智能推题：综合 FSRS 复习数据 + 错题模式 + 知识薄弱点，生成个性化题目推荐
 *
 * 策略：
 * 1. 分析用户错题分布（按 category/knowledge_point 聚合）
 * 2. 分析 FSRS review_logs 中低留存率的知识点
 * 3. 结合用户 difficulty_preference 和历史正确率
 * 4. 调用 AI 生成推荐理由和学习建议
 * 5. 从题库中按权重抽取推荐题目
 */
async function smartRecommend(userId: string, data: any, requestId: string) {
  const count = Math.min(Math.max(parseInt(data?.count) || 10, 5), 30);
  const now = Date.now();

  // 1. 聚合错题分布（按 category + knowledge_point）
  const [mistakeResult, reviewLogResult, userDoc] = await Promise.all([
    db
      .collection('mistake_book')
      .where({ user_id: userId, is_mastered: false })
      .orderBy('error_count', 'desc')
      .limit(200)
      .get(),
    db.collection('review_logs').where({ user_id: userId }).orderBy('review', 'desc').limit(500).get(),
    db.collection('users').where({ _id: userId }).getOne()
  ]);

  const mistakes = mistakeResult.data || [];
  const reviewLogs = reviewLogResult.data || [];
  const userProfile = userDoc.data || {};

  // 2. 计算知识点薄弱度
  const weakPoints = analyzeWeakPoints(mistakes, reviewLogs);

  // 3. 确定推荐难度分布
  const difficultyDist = calculateDifficultyDistribution(mistakes, userProfile);

  // 4. 从题库按薄弱点权重抽题
  const recommendations = await fetchRecommendedQuestions(weakPoints, difficultyDist, count, userId);

  // 5. 生成 AI 推荐理由（异步，不阻塞返回）
  let aiAdvice = '';
  try {
    if (weakPoints.length > 0) {
      aiAdvice = await generateAIAdvice(weakPoints.slice(0, 5), userProfile, requestId);
    }
  } catch (_e) {
    aiAdvice = '';
  }

  logger.info(`[${requestId}] 智能推题: ${recommendations.length} 题, ${weakPoints.length} 个薄弱点`);

  return success({
    questions: recommendations,
    weak_points: weakPoints.slice(0, 10),
    difficulty_distribution: difficultyDist,
    ai_advice: aiAdvice,
    total: recommendations.length,
    generated_at: now
  });
}

/**
 * 分析知识点薄弱度
 */
function analyzeWeakPoints(mistakes: any[], reviewLogs: any[]) {
  const pointMap = new Map<string, { errors: number; reviews: number; failRate: number; category: string }>();

  // 从错题统计
  for (const m of mistakes) {
    const key = m.knowledge_point || m.category || '未分类';
    const existing = pointMap.get(key) || { errors: 0, reviews: 0, failRate: 0, category: m.category || '综合' };
    existing.errors += m.error_count || 1;
    pointMap.set(key, existing);
  }

  // 从 review logs 统计失败率
  for (const log of reviewLogs) {
    // rating=1 (Again) 视为失败
    const key = log.card_type === 'mistake' ? 'mistake_review' : 'question_review';
    const existing = pointMap.get(key) || { errors: 0, reviews: 0, failRate: 0, category: '综合' };
    existing.reviews++;
    if (log.rating <= 1) existing.errors++;
    pointMap.set(key, existing);
  }

  // 计算失败率并排序
  const result = Array.from(pointMap.entries())
    .map(([point, data]) => ({
      knowledge_point: point,
      category: data.category,
      error_count: data.errors,
      review_count: data.reviews,
      fail_rate: data.reviews > 0 ? Math.round((data.errors / data.reviews) * 100) : Math.min(100, data.errors * 20), // 无复习记录时按错题数估算
      weight: data.errors * 2 + (data.reviews > 0 ? (data.errors / data.reviews) * 10 : 5)
    }))
    .sort((a, b) => b.weight - a.weight);

  return result;
}

/**
 * 计算推荐难度分布
 */
function calculateDifficultyDistribution(mistakes: any[], userProfile: any) {
  const pref = userProfile.difficulty_preference || 'adaptive';

  if (pref === 'easy') return { easy: 0.5, medium: 0.4, hard: 0.1 };
  if (pref === 'hard') return { easy: 0.1, medium: 0.3, hard: 0.6 };
  if (pref === 'medium') return { easy: 0.2, medium: 0.6, hard: 0.2 };

  // adaptive: 根据错题难度反推
  let easyErrors = 0,
    mediumErrors = 0,
    hardErrors = 0;
  for (const m of mistakes) {
    const d = m.difficulty || 'medium';
    if (d === 'easy') easyErrors++;
    else if (d === 'hard') hardErrors++;
    else mediumErrors++;
  }
  const total = Math.max(1, easyErrors + mediumErrors + hardErrors);

  // 错得多的难度多推（补短板）
  return {
    easy: Math.round((easyErrors / total) * 0.3 * 100) / 100 + 0.15,
    medium: Math.round((mediumErrors / total) * 0.4 * 100) / 100 + 0.2,
    hard: Math.round((hardErrors / total) * 0.3 * 100) / 100 + 0.15
  };
}

/**
 * 从题库按薄弱点权重抽取推荐题目
 */
async function fetchRecommendedQuestions(
  weakPoints: any[],
  _diffDist: { easy: number; medium: number; hard: number },
  count: number,
  _userId: string
) {
  const questions: any[] = [];
  const collection = db.collection('questions');

  // 按薄弱点权重分配题目数量
  const totalWeight = weakPoints.reduce((sum, p) => sum + p.weight, 0) || 1;

  for (const point of weakPoints.slice(0, 8)) {
    const pointCount = Math.max(1, Math.round((point.weight / totalWeight) * count));
    if (questions.length >= count) break;

    try {
      const query: any = {
        is_active: true,
        review_status: 'approved'
      };

      // 按 category 或 knowledge_points 匹配
      if (point.category && point.category !== '综合') {
        query.category = point.category;
      }

      const result = await collection
        .where(query)
        .limit(Math.min(pointCount, count - questions.length))
        .get();

      for (const q of result.data || []) {
        questions.push({
          ...q,
          _recommend_reason: `薄弱知识点: ${point.knowledge_point}`,
          _recommend_weight: point.weight
        });
      }
    } catch (_e) {
      continue;
    }
  }

  // 如果薄弱点题目不够，补充随机题
  if (questions.length < count) {
    try {
      const remaining = count - questions.length;
      const total = await collection.where({ is_active: true, review_status: 'approved' }).count();
      const maxSkip = Math.max(0, (total.total || 0) - remaining);
      const skip = Math.floor(Math.random() * maxSkip);

      const extra = await collection
        .where({ is_active: true, review_status: 'approved' })
        .skip(skip)
        .limit(remaining)
        .get();

      for (const q of extra.data || []) {
        questions.push({ ...q, _recommend_reason: '随机推荐', _recommend_weight: 1 });
      }
    } catch (_e) {
      /* silent */
    }
  }

  return questions.slice(0, count);
}

/**
 * 调用 AI 生成个性化学习建议
 */
async function generateAIAdvice(weakPoints: any[], userProfile: any, requestId: string): Promise<string> {
  try {
    const provider = getProvider('glm-4-flash');
    if (!provider) return '';

    const weakSummary = weakPoints
      .map((p) => `${p.knowledge_point}(错${p.error_count}次, 失败率${p.fail_rate}%)`)
      .join('、');

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          '你是一位考研辅导专家。根据学生的薄弱知识点数据，给出简短的学习建议（100字以内）。直接给建议，不要寒暄。'
      },
      {
        role: 'user',
        content: `学生薄弱点：${weakSummary}。目标：${userProfile.target_school || '考研'}。请给出针对性学习建议。`
      }
    ];

    const result = await provider.chat(messages, { max_tokens: 200, temperature: 0.7 });
    return result?.content || '';
  } catch (e) {
    logger.warn(`[${requestId}] AI建议生成失败:`, e);
    return '';
  }
}
