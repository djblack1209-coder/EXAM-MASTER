import { dayKey } from './learning-domain.js';
import { coachFeedbackPreview, museLearningInsights } from './muse-learning-insights.js';
import { classifyModelFailure } from '../../../laf-backend/functions/_shared/model-errors.js';

// Muse Ideas form over saved learning facts: one row is one next step the
// learner can start. Reading or dismissing a row never creates mastery or
// changes the review queue; a newer fact (another due day, more evidence)
// brings a dismissed step back under a new id.
export const IDEAS_DISMISSED_KEY = 'yozi_ideas_dismissed_v1';
const LIMIT = 100;

export function museLearningIdeas(state, now = Date.now(), dismissed = new Set()) {
  const today = dayKey(now, state.timezone);
  const review = [],
    practice = [],
    resume = [];
  for (const conversation of state.conversations) {
    const coach = conversation.coach;
    if (!coach?.profile) continue;
    const due = (coach.library || []).filter((phrase) => phrase.due <= now);
    if (due.length)
      review.push({
        id: `review:${conversation.id}:${today}`,
        icon: 'refresh',
        title: `复习 ${due.length} 条到期句式`,
        body: due
          .slice(0, 2)
          .map((phrase) => phrase.text)
          .join(' / '),
        reason: '已保存的复习安排今天到期',
        conversationId: conversation.id
      });
    const day = (coach.days || []).find((value) => value.day === today);
    if (!day?.completed)
      resume.push({
        id: `resume:${conversation.id}:${today}`,
        icon: 'pen',
        title: day ? '继续今天的写作带练' : '开始今天的写作带练',
        body: conversation.goal || '',
        reason: day ? '今天的带练还没完成' : '今天还没开始带练',
        conversationId: conversation.id
      });
  }
  for (const weakness of museLearningInsights(state, now).weaknesses.slice(0, 3)) {
    const count = weakness.evidence.length;
    practice.push({
      id: `weakness:${weakness.id}:${count}`,
      icon: 'target',
      title: `专练「${weakness.label}」`,
      body: coachFeedbackPreview(weakness.evidence.at(-1)?.feedback),
      reason: `${count} 次反馈提到这一点 · AI 评估`,
      draft: `我想专门练一下「${weakness.label}」：先用一两句讲清要点，再出一道题让我试。`
    });
  }
  return [
    { id: 'review', label: '到期复习', items: review },
    { id: 'practice', label: '薄弱点拓展', items: practice },
    { id: 'resume', label: '继续带练', items: resume }
  ]
    .map((section) => ({ ...section, items: section.items.filter((item) => !dismissed.has(item.id)) }))
    .filter((section) => section.items.length);
}

const ownerKey = (key, owner) => `${key}:${encodeURIComponent(owner || '')}`;
function readSaved(key) {
  try {
    const raw = uni.getStorageSync(key);
    const saved = typeof raw === 'string' && raw ? JSON.parse(raw) : raw;
    return saved?.version === 1 ? saved : null;
  } catch {
    return null;
  }
}
function writeSaved(key, value) {
  try {
    uni.setStorageSync(key, { version: 1, ...value });
    return true;
  } catch {
    return false;
  }
}

// Dismissals are a device preference beside drafts, never learning facts.
export function ideaDismissals(owner) {
  const key = ownerKey(IDEAS_DISMISSED_KEY, owner);
  const read = () => {
    const saved = readSaved(key);
    return Array.isArray(saved?.ids) ? saved.ids.filter((id) => typeof id === 'string') : [];
  };
  return {
    ids: () => new Set(read()),
    dismiss(id) {
      return writeSaved(key, { ids: [...read().filter((value) => value !== id), id].slice(-LIMIT) });
    }
  };
}

// Suggestions from the learner's own API: at most one automatic request a day,
// switched off per account on this device. The reply is a cache for this page.
export const IDEAS_MODEL_KEY = 'yozi_ideas_model_v1';
export const IDEAS_MODEL_PREFERENCE_KEY = 'yozi_ideas_model_enabled_v1';
const exams = new Set(['english1', 'english2']);
const clip = (value, max) =>
  String(value || '')
    .trim()
    .slice(0, max);

export function ideasModelEnabled(owner) {
  return readSaved(ownerKey(IDEAS_MODEL_PREFERENCE_KEY, owner))?.enabled !== false;
}
export function setIdeasModelEnabled(owner, enabled) {
  return writeSaved(ownerKey(IDEAS_MODEL_PREFERENCE_KEY, owner), { enabled: enabled === true });
}

// The model sees a short host summary with local refs (goal, today, w1…, p1…),
// never record ids, essays or feedback history.
export function ideasModelContext(state, now = Date.now(), avoid = []) {
  const today = dayKey(now, state.timezone);
  const conversation = state.conversations
    .filter((value) => value.coach?.profile && value.coach.profile.exam !== 'cs408')
    .sort((a, b) => (b.at || 0) - (a.at || 0))[0];
  if (!conversation) return null;
  const { coach } = conversation,
    profile = coach.profile;
  const day = (coach.days || []).find((value) => value.day === today);
  const weaknesses = museLearningInsights(state, now)
    .weaknesses.filter((weakness) => clip(weakness.label, 40))
    .slice(0, 5)
    .map((weakness, index) => ({
      id: `w${index + 1}`,
      label: clip(weakness.label, 40),
      count: Math.min(999, weakness.evidence.length),
      advice: clip(coachFeedbackPreview(weakness.evidence.at(-1)?.feedback), 120)
    }));
  const library = (coach.library || []).filter((phrase) => clip(phrase.text, 80));
  const phrases = [
    ...library.filter((phrase) => phrase.due <= now),
    ...library.filter((phrase) => !(phrase.due <= now))
  ]
    .slice(0, 8)
    .map((phrase, index) => ({ id: `p${index + 1}`, text: clip(phrase.text, 80), due: phrase.due <= now }));
  const goal = clip(conversation.goal, 300);
  if (!goal && !weaknesses.length && !phrases.length) return null;
  const minutes = Number(profile.minutes);
  return {
    conversationId: conversation.id,
    context: {
      exam: exams.has(profile.exam) ? profile.exam : null,
      goal,
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(profile.deadline || '') ? profile.deadline : null,
      minutes: Number.isInteger(minutes) && minutes >= 5 && minutes <= 120 ? minutes : null,
      today: day?.completed ? 'completed' : day ? 'in_progress' : 'not_started',
      weaknesses,
      phrases,
      avoid: avoid.filter((title) => typeof title === 'string' && title.trim()).slice(-10)
    }
  };
}

export function ideasBasisText(basis, context) {
  const labels = basis.map((ref) => {
    if (ref === 'goal') return '学习目标';
    if (ref === 'today') return '今天的带练';
    if (ref === 'exam') return context.exam === 'english2' ? '英语二' : '英语一';
    if (ref === 'deadline') return '考试日期';
    if (ref === 'minutes') return '每天的学习时长';
    const weakness = context.weaknesses.find((item) => item.id === ref);
    if (weakness) return `薄弱点「${weakness.label}」`;
    const phrase = context.phrases.find((item) => item.id === ref);
    return phrase ? `句式「${phrase.text}」` : '';
  });
  return `AI 建议 · 依据${labels.filter(Boolean).join('、')}`;
}

// status: pending (a request was sent; never re-sent automatically), ready, failed.
export function modelIdeas(owner) {
  const key = ownerKey(IDEAS_MODEL_KEY, owner);
  const read = () => readSaved(key);
  return {
    read,
    today(day) {
      const saved = read();
      return saved?.day === day ? saved : null;
    },
    recentTitles: () => (Array.isArray(read()?.recent) ? read().recent : []),
    save(day, value) {
      const recent = [...new Set([...(read()?.recent || []), ...(value.ideas || []).map((idea) => idea.title)])];
      return writeSaved(key, { day, at: Date.now(), ...value, recent: recent.slice(-10) });
    }
  };
}
// One request per account and day at a time, shared by every mount of the page,
// so reopening Ideas while a reply is on its way never sends a second one.
const running = new Map();
const runKey = (owner, day) => `${owner}\n${day}`;
export function modelIdeasRunning(owner, day) {
  return running.get(runKey(owner, day)) || null;
}
export function requestModelIdeas(owner, day, built, suggest) {
  const key = runKey(owner, day),
    cache = modelIdeas(owner);
  if (running.has(key)) return running.get(key);
  // Without a saved pending mark a reopened page could send again, so nothing is sent.
  if (!cache.save(day, { status: 'pending' })) return Promise.resolve(null);
  const run = Promise.resolve()
    .then(() => suggest(built.context))
    .catch((error) => ({ success: false, error: error?.code }))
    .then((result) => {
      cache.save(
        day,
        result?.success
          ? {
              status: 'ready',
              requestId: result.requestId,
              ideas: result.ideas.map((idea) => ({
                title: idea.title,
                body: idea.body,
                draft: idea.draft,
                reason: ideasBasisText(idea.basis, built.context)
              }))
            }
          : { status: 'failed', code: classifyModelFailure(result || {}) }
      );
      return cache.today(day);
    })
    .finally(() => running.delete(key));
  running.set(key, run);
  return run;
}
export function modelIdeaItems(saved) {
  return (saved?.status === 'ready' ? saved.ideas : []).map((idea, index) => ({
    id: `ai:${saved.day}:${saved.requestId}:${index}`,
    icon: 'sparkle',
    title: idea.title,
    body: idea.body,
    reason: idea.reason,
    draft: idea.draft
  }));
}
