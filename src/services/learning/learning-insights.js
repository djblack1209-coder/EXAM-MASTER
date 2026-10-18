import { dayKey, effectiveGrade, knowledgeScope, questionKey } from './learning-domain.js';

// Charts are projections of saved facts. No chart writes profile or mastery state.
export function learningInsights(state, now = Date.now(), conversationId = null) {
  const session = state.conversations.find((item) => item.id === conversationId);
  const attempts = state.attempts.filter((item) => !conversationId || item.conversationId === conversationId);
  const units = new Map(),
    days = new Map();
  const calendarDay = (day) => {
    if (!days.has(day))
      days.set(day, { day, answers: 0, reliable: 0, pending: 0, reviews: 0, due: 0, evidenceIds: [] });
    return days.get(day);
  };
  for (const attempt of attempts) {
    const question = state.questions.find((item) => questionKey(item) === attempt.questionKey);
    if (!question) continue;
    const scope = knowledgeScope(question),
      grade = effectiveGrade(attempt);
    if (!units.has(scope))
      units.set(scope, {
        scope,
        label: question.knowledgePoint || question.subject || scope,
        reliable: 0,
        independent: 0,
        pending: 0,
        evidenceIds: []
      });
    const unit = units.get(scope),
      day = calendarDay(dayKey(attempt.at, state.timezone));
    unit.evidenceIds.push(attempt.id);
    day.evidenceIds.push(attempt.id);
    day.answers++;
    if (attempt.kind === 'review') day.reviews++;
    if (grade?.status === 'reliable') {
      unit.reliable++;
      day.reliable++;
      if (
        grade.outcome === 'correct' &&
        !attempt.hints?.length &&
        ['first', 'variant', 'review'].includes(attempt.kind)
      )
        unit.independent++;
    } else {
      unit.pending++;
      day.pending++;
    }
  }
  for (const review of state.reviews) {
    if (
      review.cancelled ||
      review.completedBy ||
      review.resolvedBy ||
      (conversationId &&
        !attempts.some((attempt) => attempt.questionKey === review.questionKey) &&
        !session?.messages.some((message) => message.questionKey === review.questionKey))
    )
      continue;
    calendarDay(dayKey(review.due, state.timezone)).due++;
  }
  const scope = session?.goal;
  const profile = {};
  for (const entry of state.profile) {
    if (session && entry.source === 'self_report' && entry.scope === scope) profile[entry.field] = entry;
  }
  const today = dayKey(now, state.timezone);
  const deadline = profile.deadline?.value || null;
  const daysLeft = deadline
    ? Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
    : null;
  const modules = session?.journey?.moduleIds || [];
  const done = modules.filter((id) =>
    session.trainingGroups?.some((group) => group.moduleId === id && group.day === today && group.submittedBy)
  ).length;
  return {
    today,
    timezone: state.timezone,
    profile,
    deadline,
    daysLeft,
    progress: { completed: done, total: modules.length || null },
    units: [...units.values()].sort(
      (a, b) => (a.reliable ? a.independent / a.reliable : -1) - (b.reliable ? b.independent / b.reliable : -1)
    ),
    days: [...days.values()].sort((a, b) => b.day.localeCompare(a.day))
  };
}
