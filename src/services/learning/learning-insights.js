import { dayKey, effectiveGrade, knowledgeScope, questionKey } from './learning-domain.js';

// Charts are projections of saved facts. No chart writes profile or mastery state.
export function learningInsights(state, now = Date.now(), conversationId = null) {
  const session = state.conversations.find((item) => item.id === conversationId);
  const attempts = state.attempts.filter((item) => !conversationId || item.conversationId === conversationId);
  const questions = new Map(state.questions.map((item) => [questionKey(item), item]));
  const sessions = new Map(state.conversations.map((item) => [item.id, item]));
  const originals = new Map(state.attempts.map((item) => [item.id, item]));
  const evidence = [],
    scheduled = [];
  const units = new Map(),
    days = new Map();
  const calendarDay = (day) => {
    if (!days.has(day))
      days.set(day, { day, answers: 0, reliable: 0, pending: 0, reviews: 0, due: 0, evidenceIds: [], reviewIds: [] });
    return days.get(day);
  };
  for (const attempt of attempts) {
    const question = questions.get(attempt.questionKey);
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
    evidence.push({
      id: attempt.id,
      recordId: JSON.stringify([attempt.conversationId, attempt.questionKey, attempt.id]),
      conversationId: attempt.conversationId,
      scope,
      label: unit.label,
      prompt: question.prompt || '',
      goal: sessions.get(attempt.conversationId)?.goal || '',
      day: day.day,
      at: attempt.at,
      kind: attempt.kind,
      grade,
      helped: Boolean(attempt.hints?.length),
      canOpen: sessions.has(attempt.conversationId)
    });
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
    const original = originals.get(review.attemptId),
      question = questions.get(review.questionKey);
    if (
      review.cancelled ||
      review.completedBy ||
      review.resolvedBy ||
      !question ||
      !original ||
      original.questionKey !== review.questionKey ||
      effectiveGrade(original)?.status !== 'reliable' ||
      !sessions.has(original.conversationId) ||
      (conversationId && original.conversationId !== conversationId)
    )
      continue;
    const day = calendarDay(dayKey(review.due, state.timezone));
    day.due++;
    day.reviewIds.push(review.id);
    scheduled.push({
      id: review.id,
      scope: knowledgeScope(question),
      label: question.knowledgePoint || question.subject || '',
      prompt: question.prompt || '',
      conversationId: original.conversationId,
      day: day.day,
      due: review.due
    });
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
    evidence: evidence.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)),
    scheduled: scheduled.sort((a, b) => a.due - b.due || a.id.localeCompare(b.id)),
    units: [...units.values()].sort(
      (a, b) => (a.reliable ? a.independent / a.reliable : -1) - (b.reliable ? b.independent / b.reliable : -1)
    ),
    days: [...days.values()].sort((a, b) => b.day.localeCompare(a.day))
  };
}

// Calendar arithmetic uses saved local date keys, never the browser's timezone
// or a fixed 24-hour step across a daylight-saving transition.
const dateFor = (day) => new Date(`${day}T12:00:00Z`);
const keyFor = (date) => date.toISOString().slice(0, 10);
export function insightMonth(day, offset = 0) {
  const date = dateFor(`${day.slice(0, 7)}-01`);
  const month = Math.max(12, Math.min(119999, date.getUTCFullYear() * 12 + date.getUTCMonth() + offset));
  return `${String(Math.floor(month / 12)).padStart(4, '0')}-${String((month % 12) + 1).padStart(2, '0')}`;
}
export function insightCalendar(today, month = today.slice(0, 7), compact = false) {
  const first = dateFor(compact ? today : `${month}-01`);
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = dateFor(`${month}-01`);
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  const count = compact ? 7 : Math.ceil((((first.getUTCDay() + 6) % 7) + end.getUTCDate()) / 7) * 7;
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);
    const day = keyFor(date);
    return { day, number: date.getUTCDate(), inMonth: compact || day.startsWith(month), today: day === today };
  });
}

// Only reliably checked units have a numeric ratio. Pending-only units stay in
// the accessible list instead of being drawn as zero mastery.
export function insightRadar(units, colors) {
  const rows = units.filter((unit) => unit.reliable > 0).slice(0, 6);
  if (rows.length < 3) return null;
  const color = (value, fallback) => (/^#[\da-f]{3,8}$/i.test(value || '') ? value : fallback);
  const ink = color(colors?.ink, '#172033'),
    line = color(colors?.line, '#CBD5E1'),
    brand = color(colors?.brand, '#6850CC');
  const point = (i, ratio = 1) => {
    const angle = -Math.PI / 2 + (i * Math.PI * 2) / rows.length;
    return [120 + Math.cos(angle) * 82 * ratio, 120 + Math.sin(angle) * 82 * ratio].map((n) => n.toFixed(2));
  };
  const polygon = (ratio) => rows.map((_, i) => point(i, ratio).join(',')).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g fill="none" stroke="${line}">${[0.25, 0.5, 0.75, 1].map((ratio) => `<polygon points="${polygon(ratio)}"/>`).join('')}${rows.map((_, i) => `<path d="M120 120L${point(i).join(' ')}"/>`).join('')}</g><polygon points="${rows.map((row, i) => point(i, row.independent / row.reliable).join(',')).join(' ')}" fill="${brand}" fill-opacity=".18" stroke="${brand}" stroke-width="2"/>${rows
    .map((_, i) => {
      const [x, y] = point(i, 1.22);
      return `<text x="${x}" y="${Number(y) + 4}" text-anchor="middle" font-size="13" font-family="sans-serif" fill="${ink}">${i + 1}</text>`;
    })
    .join('')}</svg>`;
  return { rows, src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` };
}
