import { effectiveGrade, knowledgeScope, questionKey } from './learning-domain.js';
export { requestedTeachingMethod } from './learning-strategy.js';

export const TEACHING_OBSERVATION_CONTRACT = 'teaching-followup-v1';

// 只关联实际交付与后续作答；时间相邻并不证明某种教法造成进步。
export function observeTeaching(state, options = {}) {
  const questions = new Map((state.questions || []).map((q) => [questionKey(q), q]));
  const roots = new Map();
  const root = (key) => {
    if (roots.has(key)) return roots.get(key);
    const seen = new Set();
    let cursor = key;
    for (let depth = 0; depth < 16; depth++) {
      if (seen.has(cursor) || !questions.has(cursor)) return null;
      seen.add(cursor);
      const parent = questions.get(cursor).parentQuestionKey;
      if (!parent) {
        roots.set(key, cursor);
        return cursor;
      }
      cursor = parent;
    }
    return null;
  };
  const executions = new Map((state.executions || []).map((e) => [e.id, e]));
  const messages = new Map();
  for (const conversation of state.conversations || []) {
    if (options.conversationId && conversation.id !== options.conversationId) continue;
    for (const message of conversation.messages || []) {
      const execution = executions.get(message.executionId);
      const historical = execution?.status === 'cancelled' && execution.errorCode === 'BACKUP_HISTORY_ONLY';
      const q = questions.get(message.questionKey);
      if (
        execution?.tool !== 'teaching' ||
        (!historical && execution.status !== 'success') ||
        execution.questionKey !== message.questionKey ||
        execution.method !== message.method ||
        !q ||
        (options.scope && knowledgeScope(q) !== options.scope)
      )
        continue;
      const lineage = root(message.questionKey);
      if (!lineage) continue;
      messages.set(message.id, {
        id: message.id,
        executionId: execution.id,
        conversationId: conversation.id,
        questionKey: message.questionKey,
        scope: knowledgeScope(q),
        method: message.method,
        historyOnly: historical,
        at: message.at,
        lineage,
        status: 'waiting',
        followups: {
          reliable: 0,
          pending: 0,
          blocked: 0,
          helpedCorrect: 0,
          independentTransfer: 0,
          dueReview: 0,
          originalRedo: 0
        },
        evidenceIds: [],
        lastOutcome: null
      });
    }
  }
  const attempts = new Map((state.attempts || []).map((a) => [a.id, a]));
  const dueReviews = new Set();
  const previousSchedules = new Map();
  for (const review of state.reviews || []) {
    const a = attempts.get(review.attemptId);
    if (review.policy !== 'reliable-due-v1' || effectiveGrade(a || {})?.status !== 'reliable') continue;
    const previous = previousSchedules.get(review.questionKey);
    if (
      !review.cancelled &&
      a.kind === 'review' &&
      !a.hints?.length &&
      previous &&
      attempts.get(previous.attemptId)?.at <= a.at &&
      previous.due <= a.at
    )
      dueReviews.add(a.id);
    previousSchedules.set(review.questionKey, review);
  }
  const active = new Map();
  const rows = [];
  for (const event of state.events || []) {
    const teaching = messages.get(event.id);
    if (teaching) {
      active.set(`${teaching.conversationId}:${teaching.lineage}`, teaching);
      rows.push(teaching);
    }
    const attempt = attempts.get(event.id);
    if (!attempt || (options.conversationId && attempt.conversationId !== options.conversationId)) continue;
    const lineage = root(attempt.questionKey);
    const row = lineage && active.get(`${attempt.conversationId}:${lineage}`);
    if (!row) continue;
    const currentQuestion = questions.get(attempt.questionKey);
    if (
      knowledgeScope(currentQuestion) !== row.scope &&
      (attempt.kind !== 'variant' || currentQuestion?.subject !== questions.get(row.questionKey)?.subject)
    )
      continue;
    const grade = effectiveGrade(attempt);
    const helped = Boolean(attempt.hints?.length);
    const counts = row.followups;
    if (grade?.status !== 'reliable') {
      counts.pending++;
      row.status = 'pending';
    } else {
      counts.reliable++;
      if (grade.outcome !== 'correct') {
        counts.blocked++;
        row.status = 'blocked';
      } else if (helped) {
        counts.helpedCorrect++;
        row.status = 'helped_correct';
      } else if (attempt.kind === 'variant' && attempt.questionKey !== row.questionKey) {
        counts.independentTransfer++;
        row.status = 'independent_transfer';
      } else if (attempt.kind === 'review' && dueReviews.has(attempt.id)) {
        counts.dueReview++;
        row.status = 'due_review';
      } else {
        counts.originalRedo++;
        row.status = 'original_redo';
      }
    }
    row.evidenceIds = [...row.evidenceIds.slice(-5), attempt.id];
    row.lastOutcome = {
      attemptId: attempt.id,
      status: grade?.status || 'pending',
      outcome: grade?.outcome || null,
      helped,
      kind: attempt.kind
    };
  }
  const limit = Math.max(1, Math.min(100, Number.isInteger(options.limit) ? options.limit : 20));
  return {
    contract: TEACHING_OBSERVATION_CONTRACT,
    total: rows.length,
    rows: rows.slice(-limit).map(({ lineage, ...row }) => row)
  };
}
