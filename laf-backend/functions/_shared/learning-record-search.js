import { assert, dayKey, effectiveGrade, questionKey } from './learning-domain.js';

export const RECORD_SEARCH_CONTRACT = 'learning-record-search-v1';
const normalized = (value) =>
  String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
const identity = (conversationId, key = null, attemptId = null) => JSON.stringify([conversationId, key, attemptId]);

// Read only the current owner's canonical state. Search never replays events or trusts an imported index.
function records(state) {
  const sessions = new Map(state.conversations.map((session) => [session.id, session]));
  const questions = new Map(state.questions.map((question) => [questionKey(question), question]));
  const links = new Map();
  const link = (conversationId, key, at) => {
    if (!sessions.has(conversationId) || !questions.has(key)) return;
    const id = identity(conversationId, key);
    if (!links.has(id)) links.set(id, { conversationId, questionKey: key, at, attempts: [] });
  };
  for (const session of sessions.values()) {
    link(session.id, session.activeQuestionKey, session.at);
    for (const group of session.trainingGroups || [])
      for (const key of group.questionKeys) link(session.id, key, group.at || session.at);
  }
  for (const event of state.events)
    if (event.type === 'question.focus') link(event.data.conversationId, event.data.questionKey, event.at);
  for (const attempt of state.attempts) {
    link(attempt.conversationId, attempt.questionKey, attempt.at);
    links.get(identity(attempt.conversationId, attempt.questionKey))?.attempts.push(attempt);
  }
  const rows = [];
  const append = (session, question = null, attempt = null, at = session.at) => {
    rows.push({
      id: identity(session.id, question && questionKey(question), attempt?.id || null),
      kind: attempt ? 'answer' : question ? 'question' : 'conversation',
      conversationId: session.id,
      goal: session.goal,
      questionKey: question ? questionKey(question) : null,
      attemptId: attempt?.id || null,
      prompt: question?.prompt || '',
      subject: question?.subject || '',
      knowledgePoint: question?.knowledgePoint || '',
      answer: attempt?.answer || '',
      grade: attempt ? effectiveGrade(attempt) : null,
      helped: Boolean(attempt?.hints?.length),
      at,
      day: dayKey(at, session.journey?.timezone || state.timezone)
    });
  };
  for (const session of sessions.values()) append(session);
  for (const entry of links.values()) {
    const session = sessions.get(entry.conversationId),
      question = questions.get(entry.questionKey);
    if (entry.attempts.length) for (const attempt of entry.attempts) append(session, question, attempt, attempt.at);
    else append(session, question, null, entry.at);
  }
  // Stable ties keep pagination deterministic without interpreting activity as mastery.
  return rows.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
}

function snippet(value, query) {
  const text = String(value || '')
      .replace(/\s+/gu, ' ')
      .trim(),
    index = query ? normalized(text).indexOf(query) : -1;
  const start = Math.max(0, index - 24);
  return `${start ? '…' : ''}${text.slice(start, start + 100)}${text.length > start + 100 ? '…' : ''}`;
}

export function searchLearningRecords(state, query, { offset = 0, limit = 20 } = {}) {
  assert(typeof query === 'string' && query.length <= 120, 'INVALID_INPUT', '搜索词限120字符');
  assert(
    Number.isInteger(offset) && offset >= 0 && Number.isInteger(limit) && limit > 0 && limit <= 50,
    'INVALID_INPUT',
    '搜索分页不合法'
  );
  const term = normalized(query);
  const matches = records(state).filter((row) =>
    (row.kind === 'conversation' ? [row.goal] : [row.prompt, row.subject, row.knowledgePoint, row.answer]).some(
      (value) => normalized(value).includes(term)
    )
  );
  return {
    contract: RECORD_SEARCH_CONTRACT,
    total: matches.length,
    hasMore: offset + limit < matches.length,
    items: matches.slice(offset, offset + limit).map((row) => ({
      id: row.id,
      kind: row.kind,
      conversationId: row.conversationId,
      questionKey: row.questionKey,
      attemptId: row.attemptId,
      goal: row.goal,
      label: snippet(row.prompt || row.goal, ''),
      excerpt: snippet(row.answer && normalized(row.answer).includes(term) ? row.answer : row.prompt || row.goal, term),
      day: row.day
    }))
  };
}

export function learningRecordTarget(state, id) {
  const row = records(state).find((record) => record.id === id);
  assert(row, 'NOT_FOUND', '学习记录不存在，请重新搜索');
  return row;
}
