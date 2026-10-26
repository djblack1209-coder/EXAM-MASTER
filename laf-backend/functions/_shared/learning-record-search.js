import { assert, dayKey, effectiveGrade, questionKey } from './learning-domain.js';
import { coachSavedRecords } from './learning-coach-records.js';

export const RECORD_SEARCH_CONTRACT = 'learning-record-search-v1';
export const RECORD_SEARCH_FILTERS = Object.freeze(['all', 'wrong', 'partial', 'pending', 'helped']);
const normalized = (value) =>
  String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
const identity = (conversationId, key = null, attemptId = null) => JSON.stringify([conversationId, key, attemptId]);
const projections = new WeakMap();

// Read only the current owner's canonical state. Search never replays events or trusts an imported index.
function records(state) {
  const cached = projections.get(state);
  if (cached?.revision === state.revision && cached.owner === state.owner) return cached;
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
    const row = Object.freeze({
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
      grade: attempt ? Object.freeze({ ...effectiveGrade(attempt) }) : null,
      helped: Boolean(attempt?.hints?.length),
      at
    });
    rows.push(
      Object.freeze({
        row,
        timezone: session.journey?.timezone || state.timezone,
        terms: Object.freeze(
          (row.kind === 'conversation' ? [row.goal] : [row.prompt, row.subject, row.knowledgePoint, row.answer]).map(
            normalized
          )
        )
      })
    );
  };
  for (const session of sessions.values()) append(session);
  for (const session of sessions.values())
    for (const saved of coachSavedRecords(session)) {
      const row = Object.freeze({
        id: identity(session.id, null, `coach:${saved.key}`),
        kind: 'answer',
        conversationId: session.id,
        goal: session.goal,
        questionKey: null,
        attemptId: null,
        coachRecordId: saved.key,
        prompt: saved.prompt || saved.title,
        answer: saved.answer,
        subject: '考研英语写作',
        grade: Object.freeze({ status: 'pending', outcome: null }),
        helped: false,
        at: saved.at
      });
      rows.push(
        Object.freeze({
          row,
          timezone: session.coach.timezone || state.timezone,
          terms: Object.freeze([row.prompt, row.subject, row.answer].map(normalized))
        })
      );
    }
  for (const entry of links.values()) {
    const session = sessions.get(entry.conversationId),
      question = questions.get(entry.questionKey);
    if (entry.attempts.length) for (const attempt of entry.attempts) append(session, question, attempt, attempt.at);
    else append(session, question, null, entry.at);
  }
  // Stable ties keep pagination deterministic without interpreting activity as mastery.
  rows.sort((a, b) => b.row.at - a.row.at || a.row.id.localeCompare(b.row.id));
  const projection = Object.freeze({ owner: state.owner, revision: state.revision, rows: Object.freeze(rows) });
  projections.set(state, projection);
  return projection;
}

function snippet(value, query) {
  const text = String(value || '')
      .replace(/\s+/gu, ' ')
      .trim(),
    index = query ? normalized(text).indexOf(query) : -1;
  const start = Math.max(0, index - 24);
  return `${start ? '…' : ''}${text.slice(start, start + 100)}${text.length > start + 100 ? '…' : ''}`;
}

function searchProjection(read, query, { offset = 0, limit = 20, filter = 'all' } = {}) {
  assert(typeof query === 'string' && query.length <= 120, 'INVALID_INPUT', '搜索词限120字符');
  assert(
    Number.isInteger(offset) && offset >= 0 && Number.isInteger(limit) && limit > 0 && limit <= 50,
    'INVALID_INPUT',
    '搜索分页不合法'
  );
  assert(RECORD_SEARCH_FILTERS.includes(filter), 'INVALID_INPUT', '学习记录筛选不合法');
  const term = normalized(query);
  const matches = read().rows.filter(({ row, terms }) => {
    if (filter !== 'all') {
      if (row.kind !== 'answer') return false;
      const reliable = row.grade?.status === 'reliable';
      if (
        filter === 'pending' ? reliable : filter === 'helped' ? !row.helped : !reliable || row.grade.outcome !== filter
      )
        return false;
    }
    return terms.some((value) => value.includes(term));
  });
  return {
    contract: RECORD_SEARCH_CONTRACT,
    total: matches.length,
    hasMore: offset + limit < matches.length,
    items: matches.slice(offset, offset + limit).map(({ row, timezone, terms }) => ({
      id: row.id,
      kind: row.kind,
      conversationId: row.conversationId,
      questionKey: row.questionKey,
      attemptId: row.attemptId,
      coachRecordId: row.coachRecordId || null,
      goal: row.goal,
      label: snippet(row.prompt || row.goal, ''),
      excerpt: snippet(row.answer && terms.at(-1).includes(term) ? row.answer : row.prompt || row.goal, term),
      day: dayKey(row.at, timezone),
      gradeStatus: row.grade?.status || null,
      outcome: row.grade?.status === 'reliable' ? row.grade.outcome : null,
      helped: row.helped
    }))
  };
}

export function searchLearningRecords(state, query, options) {
  return searchProjection(() => records(state), query, options);
}

function projectionTarget(projection, id) {
  const entry = projection.rows.find(({ row }) => row.id === id);
  assert(entry, 'NOT_FOUND', '学习记录不存在，请重新搜索');
  return { ...entry.row, day: dayKey(entry.row.at, entry.timezone) };
}

export function learningRecordTarget(state, id) {
  return projectionTarget(records(state), id);
}

// A store may reread an equivalent snapshot. Keep one projection until its revision or lifecycle changes.
export function createLearningRecordSearch() {
  let projection = null,
    lifecycle = null;
  const read = (state, context) => {
    if (
      !projection ||
      projection.owner !== state.owner ||
      projection.revision !== state.revision ||
      lifecycle !== context
    ) {
      projection = records(state);
      lifecycle = context;
    }
    return projection;
  };
  return {
    search: (state, query, options, context) => searchProjection(() => read(state, context), query, options),
    target: (state, id, context) => projectionTarget(read(state, context), id),
    clear() {
      projection = null;
      lifecycle = null;
    }
  };
}
