/** 旧学习引擎接口保留入口，当前建议只使用 Yozi 已保存的题目级依据。 */
import cloud from '@lafjs/cloud';
import { createHash } from 'node:crypto';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import {
  success,
  badRequest,
  unauthorized,
  serverError,
  generateRequestId,
  checkRateLimitDistributed,
  createLogger
} from './_shared/api-response.js';
import {
  emptyLearningState,
  summarizeLearning,
  knowledgeScope,
  questionKey,
  dayKey
} from './_shared/learning-domain.js';
import { decodeServerHistory } from './_shared/learning-history-server.js';
import { summarizeQuizReceipts } from './_shared/quiz-receipts.js';

const db = cloud.database();
const logger = createLogger('[SmartStudyEngine]');
const DAY_MS = 86400000;
const ERROR_TYPE_NAMES: Record<string, string> = {
  concept_confusion: '概念混淆',
  calculation_error: '计算失误',
  memory_lapse: '记忆遗忘',
  logic_error: '逻辑推理错误',
  careless_mistake: '粗心大意',
  knowledge_gap: '知识盲区',
  time_pressure: '时间不足',
  unknown: '未分类'
};
const oldText = (value: unknown) =>
  typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

async function readEvidence(userId: string) {
  const id = `learning_sync_${createHash('sha256').update(userId).digest('hex')}`;
  const stored = (await db.collection('learning_states').where({ _id: id, user_id: userId }).limit(1).get()).data?.[0];
  // 缺记录返回空依据；损坏或跨账户历史由既有解码器拒绝，不能写空记录覆盖。
  const state = stored ? await decodeServerHistory(stored.state, userId) : emptyLearningState(userId);
  const reliable = summarizeLearning(state);
  const canPractice = (attemptId: string) => {
    const attempt = state.attempts.find((item: any) => item.id === attemptId);
    return Boolean(
      attempt && state.conversations.some((session: any) => session.id === attempt.conversationId && !session.stopped)
    );
  };
  const mastery = Object.entries(reliable.knowledge).map(([scope, evidence]: [string, any]) => ({
    knowledgePoint: scope,
    subject: state.questions.find((question: any) => knowledgeScope(question) === scope)?.subject || '综合',
    status: evidence.status,
    evidenceIds: [...evidence.evidenceIds],
    needsRetest: evidence.status === '待复测',
    needsHelp: evidence.status === '需提示',
    canPractice: canPractice(evidence.evidenceIds.at(-1))
  }));
  const reviewTargets = reliable.due
    .filter((review: any) => canPractice(review.attemptId))
    .map((review: any) => {
      const question = state.questions.find((item: any) => questionKey(item) === review.questionKey);
      return {
        knowledgePoint: knowledgeScope(question),
        subject: question?.subject || '综合',
        questionKey: review.questionKey,
        due: review.due,
        evidenceIds: [review.attemptId]
      };
    })
    .sort((a: any, b: any) => a.due - b.due);
  return {
    contract: 'learning-evidence-summary-v1',
    ownerId: userId,
    revision: stored?.revision ?? 0,
    timezone: state.timezone,
    source: 'learning-core',
    mastery,
    reviewTargets,
    summary: {
      totalKnowledgePoints: mastery.length,
      independentCount: mastery.filter((item) => item.status === '可独立完成').length,
      retestCount: mastery.filter((item) => item.needsRetest).length,
      needsHelpCount: mastery.filter((item) => item.needsHelp).length,
      avgMastery: null,
      masteredCount: null,
      weakCount: null,
      weakestPoint: null,
      reliableAnswers: reliable.totalReliableAnswers,
      pending: reliable.pending
    }
  };
}

async function legacyGroups(userId: string) {
  const query = { user_id: userId };
  const [rows, count] = await Promise.all([
    db.collection('mistake_book').where(query).orderBy('_id', 'asc').limit(1000).get(),
    db.collection('mistake_book').where(query).count()
  ]);
  const groups = new Map<string, any>();
  for (const record of rows.data || []) {
    if (record.is_mastered === true) continue;
    const type =
      typeof record.error_type === 'string' && Object.hasOwn(ERROR_TYPE_NAMES, record.error_type)
        ? record.error_type
        : 'unknown';
    const category = oldText(record.category).trim() || '未分类';
    const key = JSON.stringify([type, category]);
    if (!groups.has(key))
      groups.set(key, {
        clusterId: key,
        source: 'legacy',
        scoringAuthority: false,
        errorType: type,
        errorTypeName: ERROR_TYPE_NAMES[type],
        knowledgePoints: [category],
        questionCount: 0,
        examples: []
      });
    const group = groups.get(key);
    group.questionCount++;
    if (group.examples.length < 3)
      group.examples.push({
        questionId: oldText(record.question_id || record._id),
        questionContent: oldText(record.question_content),
        userAnswer: oldText(record.user_answer),
        referenceAnswer: oldText(record.correct_answer)
      });
  }
  const clusters = [...groups.values()].map((group) => ({
    ...group,
    countBand: group.questionCount >= 10 ? 'high' : group.questionCount >= 5 ? 'medium' : 'low'
  }));
  return {
    contract: 'legacy-error-groups-v1',
    ownerId: userId,
    scoringAuthority: false,
    clusters,
    scope: {
      source: 'legacy_mistake_book',
      totalRecords: count.total,
      scannedRecords: rows.data?.length || 0,
      limit: 1000,
      truncated: count.total > (rows.data?.length || 0)
    },
    summary: { totalClusters: clusters.length, totalMistakes: clusters.reduce((n, item) => n + item.questionCount, 0) }
  };
}

function calendarInput(params: any, timezone: string) {
  const date = params.examDate;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) return null;
  const today = dayKey(Date.now(), timezone);
  const days = Math.round((timestamp - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (days < 0) return null;
  const hours = params.dailyHours === undefined ? 1 : params.dailyHours;
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0.5 || hours > 12) return null;
  return { today, daysRemaining: days, dailyBudgetMinutes: Math.round(hours * 60) };
}

function practiceSuggestions(evidence: Awaited<ReturnType<typeof readEvidence>>) {
  const due = evidence.reviewTargets.map((item: any) => ({
    ...item,
    priority: 'due_review',
    action: 'review',
    reason: '已有复习安排到期'
  }));
  const dueScopes = new Set(due.map((item: any) => item.knowledgePoint));
  const practice = evidence.mastery
    .filter((item) => item.canPractice && (item.needsHelp || item.needsRetest) && !dueScopes.has(item.knowledgePoint))
    .map((item) => ({
      knowledgePoint: item.knowledgePoint,
      subject: item.subject,
      evidenceIds: item.evidenceIds,
      priority: 'practice',
      action: 'drill',
      reason: item.needsHelp ? '此前使用过提示，可另题练习' : '此前作答需要复测'
    }));
  return [...due, ...practice];
}

export default async function (ctx: any) {
  const requestId = generateRequestId('sse');
  try {
    const auth = requireAuth(ctx);
    if (isAuthError(auth)) return unauthorized('请先登录');
    const userId = auth.userId;
    const body = ctx.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.action !== 'string')
      return badRequest('请求格式不合法');
    if (body.data !== undefined && (!body.data || typeof body.data !== 'object' || Array.isArray(body.data)))
      return badRequest('参数格式不合法');
    const params = { ...body, ...body.data };
    for (const key of ['examDate', 'dailyHours', 'correctionId', 'knowledgePoint']) {
      if (body[key] !== undefined && body.data?.[key] !== undefined && body[key] !== body.data[key])
        return badRequest('参数冲突');
    }
    const rate = await checkRateLimitDistributed(`smart_study:${userId}`, 20, 60000);
    if (!rate.allowed) return { code: 429, success: false, message: '请求过于频繁，请稍后再试' };
    switch (body.action) {
      case 'analyze_mastery': {
        const [evidence, legacyHistory] = await Promise.all([readEvidence(userId), summarizeQuizReceipts(db, userId)]);
        return success({ ...evidence, legacyHistory });
      }
      case 'error_clustering':
        return success(await legacyGroups(userId));
      case 'deep_correction': {
        if (
          params.knowledgePoint !== undefined &&
          (typeof params.knowledgePoint !== 'string' ||
            !params.knowledgePoint.trim() ||
            params.knowledgePoint.length > 200)
        )
          return badRequest('知识点参数不合法');
        const evidence = await readEvidence(userId);
        const corrections = practiceSuggestions(evidence).filter(
          (item) => !params.knowledgePoint || item.knowledgePoint === params.knowledgePoint
        );
        // 原入口只给可追溯复测建议，不在缺少对话/任务/原答绑定时调用模型或写诊断。
        return success({
          contract: 'learning-evidence-review-v1',
          source: 'learning-core',
          ownerId: userId,
          modelInvoked: false,
          persisted: false,
          corrections,
          summary: { totalCorrections: corrections.length }
        });
      }
      case 'get_pending_corrections': {
        const { data } = await db
          .collection('deep_corrections')
          .where({ user_id: userId, status: 'pending' })
          .orderBy('created_at', 'desc')
          .limit(5)
          .get();
        return success({
          contract: 'legacy-correction-history-v1',
          ownerId: userId,
          scoringAuthority: false,
          corrections: (data || []).map((item: any) => ({
            ...item,
            source: 'legacy_generated_reference',
            verificationStatus: 'unverified',
            scoringAuthority: false
          }))
        });
      }
      case 'mark_correction_read': {
        if (typeof params.correctionId !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(params.correctionId))
          return badRequest('correctionId 不合法');
        const result = await db
          .collection('deep_corrections')
          .where({ _id: params.correctionId, user_id: userId })
          .update({ status: 'read' });
        if (result.updated !== 1) return { code: 404, success: false, message: '记录不存在或已不可用' };
        return success({ message: '已标记已读' });
      }
      case 'sprint_priority':
      case 'generate_plan': {
        const evidence = await readEvidence(userId);
        const calendar = calendarInput(params, evidence.timezone);
        if (!calendar) return badRequest('请提供有效的未来考试日期和每日0.5至12小时');
        const items = practiceSuggestions(evidence);
        if (body.action === 'sprint_priority')
          return success({
            contract: 'learning-evidence-priority-v1',
            ownerId: userId,
            source: 'learning-core',
            persisted: false,
            timezone: evidence.timezone,
            ...calendar,
            items,
            strategy: '按到期复习和已有作答依据安排；时间可调整，不预测提分或建议放弃科目。'
          });
        const plans = [];
        for (let index = 0; index < Math.min(7, calendar.daysRemaining); index++) {
          const tasks: any[] = [];
          let remaining = calendar.dailyBudgetMinutes;
          // 实际到期安排只放第一天；不把同一复习计划复制为未来每天已到期。
          for (const item of (index === 0 ? items : items.filter((item) => item.action !== 'review')).slice(0, 6)) {
            if (!remaining) break;
            const durationMinutes = Math.min(30, remaining);
            tasks.push({ ...item, durationMinutes });
            remaining -= durationMinutes;
          }
          if (remaining)
            tasks.push({
              knowledgePoint: '自主练习',
              subject: '综合',
              action: 'new_learn',
              durationMinutes: remaining,
              evidenceIds: [],
              reason: '根据自己的学习目标选择内容'
            });
          plans.push({
            date: new Date(Date.parse(`${calendar.today}T00:00:00Z`) + index * DAY_MS).toISOString().slice(0, 10),
            tasks,
            totalMinutes: tasks.reduce((n, item) => n + item.durationMinutes, 0)
          });
        }
        return success({
          contract: 'learning-evidence-plan-v1',
          ownerId: userId,
          source: 'learning-core',
          timezone: evidence.timezone,
          persisted: false,
          ...calendar,
          plans,
          phases: [],
          summary: `已准备${plans.length}天计划草稿；明确保存后才成为学习安排。`
        });
      }
      default:
        return badRequest('不支持的学习操作');
    }
  } catch (error: any) {
    logger.error(`[${requestId}] 学习依据读取失败:`, error);
    return serverError('服务暂时不可用，请稍后重试');
  }
}
