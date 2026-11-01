import { dayKey } from './learning-domain.js';
import { coachFeedbackPreview, museLearningInsights } from './muse-learning-insights.js';

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

// Dismissals are a device preference beside drafts, never learning facts.
export function ideaDismissals(owner) {
  const key = `${IDEAS_DISMISSED_KEY}:${encodeURIComponent(owner || '')}`;
  const read = () => {
    try {
      const raw = uni.getStorageSync(key);
      const saved = typeof raw === 'string' && raw ? JSON.parse(raw) : raw;
      return saved?.version === 1 && Array.isArray(saved.ids) ? saved.ids.filter((id) => typeof id === 'string') : [];
    } catch {
      return [];
    }
  };
  return {
    ids: () => new Set(read()),
    dismiss(id) {
      const ids = [...read().filter((value) => value !== id), id].slice(-LIMIT);
      try {
        uni.setStorageSync(key, { version: 1, ids });
        return true;
      } catch {
        return false;
      }
    }
  };
}
