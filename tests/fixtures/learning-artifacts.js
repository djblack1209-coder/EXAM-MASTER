import { emptyLearningState } from '../../laf-backend/functions/_shared/learning-domain.js';
import { writingAnswerHash } from '../../laf-backend/functions/_shared/learning-rubric.js';

export function artifactFixtureState(owner = 'artifact-student') {
  const state = emptyLearningState(owner),
    day = '2026-10-30';
  state.revision = 7;
  const text = 'Dear Tom,\n\nI am writing to invite you to our charity sale.\n\nYours,\nLi Ming';
  const task = { taskId: 'essay-task', taskVersion: 1, essayType: 'small' };
  state.conversations = [
    {
      id: 'essay-chat',
      goal: '考研英语二写作',
      at: 1793361600000,
      messages: [],
      stopped: false,
      coach: {
        version: 1,
        startedDay: day,
        profile: { exam: 'english2', minutes: 25 },
        diagnostic: null,
        library: [],
        requests: [],
        rewriteTasks: [],
        days: [
          {
            day,
            pack: {
              cards: [],
              writing: {
                prompt: 'Write an invitation.',
                essayType: 'small',
                source: { title: 'synthetic' },
                patterns: [['I am writing to']]
              }
            },
            answers: [],
            analysis: { purpose: 'invite' },
            feedback: {},
            drafts: [{ id: 'first-paragraph', text, at: 1 }],
            rewrites: [{ id: 'last-paragraph', text, at: 2, authorship: 'user_typed' }],
            writingTask: task,
            writingSubmissions: [
              {
                ...task,
                submissionId: 'essay-submission',
                text,
                answerHash: writingAnswerHash(text),
                authorship: 'user_typed',
                submittedAt: 3
              }
            ],
            essay: {
              id: 'essay-feedback',
              kind: 'essay',
              target: 'essay',
              dimensions: [{ name: '内容', score: 1, evidence: [] }],
              errors: [],
              weaknesses: [],
              phrases: [],
              strengths: [],
              message: 'AI 评估',
              feedbackVersion: 2
            },
            summary: { kind: 'summary', learned: ['邀请函'], tomorrow: [] },
            completed: true
          }
        ]
      }
    }
  ];
  return state;
}

export function artifactMemoryStorage() {
  const rows = new Map();
  return {
    rows,
    get(key, fallback, options) {
      const value = rows.get(`${options?.session?.owner}:${key}`);
      return value === undefined ? fallback : structuredClone(value);
    },
    save(key, value, silent, session) {
      rows.set(`${session.owner}:${key}`, structuredClone(value));
      return true;
    },
    remove(key, silent, session) {
      rows.delete(`${session.owner}:${key}`);
      return true;
    }
  };
}

export function artifactMemoryDatabase() {
  const rows = new Map(),
    writes = [];
  const field = (row, path) => path.split('.').reduce((v, k) => v?.[k], row);
  const db = {
    collection: (name) => ({
      async add(row) {
        const key = `${name}:${row._id}`;
        if (rows.has(key)) throw { code: 11000 };
        writes.push({ name, action: 'add', id: row._id });
        rows.set(key, structuredClone(row));
      },
      where(query) {
        const matches = () =>
          [...rows].filter(
            ([id, row]) =>
              id.startsWith(name + ':') &&
              Object.entries(query).every(([key, value]) =>
                value && typeof value === 'object' && '$exists' in value
                  ? (field(row, key) !== undefined) === value.$exists
                  : field(row, key) === value
              )
          );
        return {
          async get() {
            return { data: matches().map(([, row]) => structuredClone(row)) };
          },
          async update(next) {
            const found = matches();
            found.forEach(([id, row]) => {
              rows.set(id, { ...row, ...structuredClone(next) });
              writes.push({ name, action: 'update', query });
            });
            return { updated: found.length };
          },
          async remove() {
            const found = matches();
            found.forEach(([id]) => rows.delete(id));
            return { deleted: found.length };
          }
        };
      }
    })
  };
  return { db, rows, writes };
}
