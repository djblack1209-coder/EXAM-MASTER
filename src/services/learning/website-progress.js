import { dayKey } from './learning-domain.js';
import { writingCoachDashboard } from '../../../laf-backend/functions/_shared/learning-writing-coach.js';

// A read-only projection of the same saved facts used by the app; no demo values or inferred scores.
export function websiteProgress(state, now = Date.now()) {
  const timezone = state.timezone || 'Asia/Shanghai';
  const today = dayKey(now, timezone);
  const dates = new Set(),
    counts = new Map();
  let answers = state.attempts.length;
  const activity = (day, count = 1) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today || count <= 0) return;
    dates.add(day);
    counts.set(day, (counts.get(day) || 0) + count);
  };
  for (const answer of state.attempts) activity(dayKey(answer.at, timezone));
  const coaches = state.conversations.filter((session) => session.coach?.profile).map((session) => session.coach);
  for (const coach of coaches) {
    for (const day of coach.days) {
      activity(day.day, day.answers.length + day.rewrites.length);
      answers += day.answers.length;
    }
    answers += coach.diagnostic?.answers.length || 0;
    for (const phrase of coach.library)
      for (const review of phrase.reviews) activity(review.day || dayKey(review.at, timezone));
  }
  const latest = coaches.at(-1);
  const board = latest ? writingCoachDashboard(latest, today, timezone) : null;
  const days = Array.from({ length: 7 }, (_, index) => {
    const value = new Date(today + 'T12:00:00Z');
    value.setUTCDate(value.getUTCDate() - 6 + index);
    const day = value.toISOString().slice(0, 10);
    return { day, count: counts.get(day) || 0 };
  });
  return {
    owner: state.owner,
    timezone,
    today,
    revision: state.revision,
    hasRecords: Boolean(state.events.length || state.conversations.length || state.attempts.length),
    studyDays: dates.size,
    answers,
    essays: coaches.reduce((sum, coach) => sum + (writingCoachDashboard(coach, today, timezone)?.essays || 0), 0),
    familiar: board?.familiar ?? 0,
    learning: board?.learning ?? 0,
    daysToExam: board?.daysToExam ?? null,
    weaknesses: board?.weaknesses || [],
    days,
    lastActivity: state.events.reduce((latest, event) => Math.max(latest || 0, event.at), null)
  };
}
