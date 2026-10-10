import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => {
  const tables = new Map(),
    calls = [];
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const table = (name) => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  };
  const collection = (name) => {
    let query = {};
    const matches = (row) => Object.entries(query).every(([key, value]) => row[key] === value);
    const c = {
      where(value) {
        query = value;
        return c;
      },
      field() {
        return c;
      },
      orderBy() {
        return c;
      },
      skip() {
        return c;
      },
      limit() {
        return c;
      },
      async getOne() {
        const row = [...table(name).values()].find(matches);
        return { data: row ? copy(row) : null };
      },
      async get() {
        return { data: [...table(name).values()].filter(matches).map(copy) };
      },
      async count() {
        return { total: [...table(name).values()].filter(matches).length };
      },
      async add(row) {
        await Promise.resolve();
        const id = row._id || `generated-${table(name).size}`;
        if (
          table(name).has(id) ||
          [...table(name).values()].some(
            (old) => old.user_id === row.user_id && old._content_hash === row._content_hash
          )
        )
          throw Object.assign(new Error('duplicate key'), { code: 11000 });
        table(name).set(id, copy({ ...row, _id: id }));
        calls.push({ name, operation: 'add' });
        return { id };
      },
      async update(fields) {
        calls.push({ name, operation: 'update', fields: copy(fields) });
        const row = [...table(name).values()].find(matches);
        if (!row) return { updated: 0, matched: 0 };
        for (const [key, value] of Object.entries(fields))
          row[key] = value?.$inc ? (row[key] || 0) + value.$inc : value;
        return { updated: 1, matched: 1 };
      },
      doc(id) {
        return { update: (fields) => collection(name).where({ _id: id }).update(fields) };
      }
    };
    return c;
  };
  return { tables, calls, table, collection, command: { inc: (n) => ({ $inc: n }) } };
});
vi.mock('@lafjs/cloud', () => ({ default: { database: () => db } }));
vi.mock('../../laf-backend/functions/_shared/auth-middleware', () => ({
  requireAuth: (ctx) =>
    ctx.headers?.authorization ? { userId: ctx.headers.authorization.slice(7) } : { code: 401, message: '请先登录' },
  isAuthError: (result) => result.code === 401
}));
vi.mock('../../laf-backend/functions/_shared/api-response', async () => {
  const { createApiResponseMock } = await import('../__mocks__/api-response-mock.js');
  return createApiResponseMock();
});
import handler from '../../laf-backend/functions/mistake-manager';
import { offlineMistakeToBackend } from '@/utils/field-normalizer.js';

const raw = (id = 'local-original') => ({
  id,
  question_content: '共同题干'.repeat(60),
  options: ['A.原选项', 'B.另一选项'],
  user_answer: 'B',
  correct_answer: 'A',
  type: '单选',
  passage: '必须保存的完整阅读材料',
  targetSegment: '指定片段',
  questionImages: [{ src: '/static/images/logo.png', caption: '原图说明' }],
  audio: { transcript: '原音频文字' },
  source: { title: '合成原件', page: 2 },
  sourceSha256: 'a'.repeat(64),
  sourceLicense: '本轮原创合成资料',
  question_version: 1,
  wrong_count: 7,
  review_count: 3,
  is_mastered: true,
  next_review_time: 20,
  created_at: 10,
  tags: ['原标签'],
  notes: '原笔记'
});
const call = (action, data, owner = 'import-owner') =>
  handler({ body: { action, data, userId: 'forged-owner' }, headers: { authorization: `Bearer ${owner}` } });
const rows = () => [...db.table('mistake_book').values()];
beforeEach(() => {
  db.tables.clear();
  db.calls.length = 0;
});

describe('legacy originals are private imports, never new errors or reviews', () => {
  it('camel aliases, zero counts and original timestamps remain raw claims', async () => {
    const source = {
      id: 0,
      questionContent: '最初的原题文字',
      questionId: 0,
      userAnswer: 'B',
      correctAnswer: 'A',
      wrongCount: 0,
      isMastered: false,
      createdAt: 0,
      chapter: '原章节'
    };
    const reply = await call('add', offlineMistakeToBackend(source));
    expect(reply.code).toBe(0);
    expect(rows()[0]).toMatchObject({
      created_at: 0,
      wrong_count: 0,
      is_mastered: false,
      chapter: '原章节',
      stats_eligible: false
    });
    expect(rows()[0].legacy_original.question.fields.questionContent).toBe(source.questionContent);
    expect(rows()[0].legacy_original.state).toMatchObject({ wrongCount: 0, isMastered: false });
  });
  it('mapper keeps exact raw material/state before aliases and preserves false/zero', () => {
    const input = {
      ...raw(),
      user_answer: '',
      userAnswer: 'must-not-replace',
      wrong_count: 0,
      is_mastered: false,
      isMastered: true
    };
    const payload = offlineMistakeToBackend(input);
    expect(payload.legacy_raw).toEqual(input);
    expect(payload.user_answer).toBe('');
    expect(payload.wrong_count).toBe(0);
    expect(payload.is_mastered).toBe(false);
  });
  it('same import and concurrent retries leave one full original, no counters changed or schedules created', async () => {
    const payload = offlineMistakeToBackend(raw());
    const replies = await Promise.all(Array.from({ length: 5 }, () => call('batchSync', { mistakes: [payload] })));
    expect(replies.every((reply) => reply.code === 0 && reply.results[0].success)).toBe(true);
    expect(new Set(replies.map((reply) => reply.results[0].id)).size).toBe(1);
    expect(rows()).toHaveLength(1);
    const stored = rows()[0];
    expect(stored).toMatchObject({
      passage: raw().passage,
      source: raw().source,
      sourceLicense: raw().sourceLicense,
      user_answer: 'B',
      stats_eligible: false,
      grade: { status: 'pending' }
    });
    expect(stored.legacy_original.question.fields.question_content).toBe(raw().question_content);
    expect(stored.legacy_original.state).toMatchObject({
      wrong_count: 7,
      review_count: 3,
      is_mastered: true,
      next_review_time: 20
    });
    expect(stored.next_review_time).toBeUndefined();
    expect(stored.stability).toBeUndefined();
    expect(db.calls.filter((entry) => entry.operation === 'update')).toEqual([]);
    expect([...db.tables.keys()]).toEqual(['mistake_book']);
  });
  it.each(['passage', 'user_answer', 'sourceLicense', 'question_version'])(
    'changed %s creates a separate original and keeps the earlier bytes',
    async (field) => {
      const first = await call('add', offlineMistakeToBackend(raw()));
      const before = JSON.stringify(rows()[0]);
      const changed = { ...raw(), [field]: field === 'question_version' ? 2 : '另一版原文' };
      const second = await call('add', offlineMistakeToBackend(changed));
      expect(first.code).toBe(0);
      expect(second.code).toBe(0);
      expect(second.id).not.toBe(first.id);
      expect(rows()).toHaveLength(2);
      expect(JSON.stringify(db.table('mistake_book').get(first.id))).toBe(before);
    }
  );
  it('old partial originals replay only when known content is equal, without enriching or altering old counts', async () => {
    const old = {
      _id: 'old-cloud',
      user_id: 'import-owner',
      question_content: '旧题完整题干',
      options: ['甲', '乙'],
      user_answer: 'B',
      wrong_count: 9,
      is_mastered: true,
      _content_hash: 'h_old'
    };
    db.table('mistake_book').set(old._id, structuredClone(old));
    const before = JSON.stringify(old);
    const reply = await call('add', offlineMistakeToBackend(old));
    expect(reply).toMatchObject({ code: 0, id: old._id, replayed: true });
    expect(JSON.stringify(db.table('mistake_book').get(old._id))).toBe(before);
    const newer = await call('add', offlineMistakeToBackend({ ...old, passage: '旧记录没有保存的新材料' }));
    expect(newer.id).not.toBe(old._id);
    expect(JSON.stringify(db.table('mistake_book').get(old._id))).toBe(before);
  });
  it('changed old state is a conflict, not another error or review', async () => {
    await call('add', offlineMistakeToBackend(raw()));
    const before = JSON.stringify(rows());
    const reply = await call('add', offlineMistakeToBackend({ ...raw(), wrong_count: 8 }));
    expect(reply).toMatchObject({ code: 409, success: false });
    expect(JSON.stringify(rows())).toBe(before);
  });
  it('invalid late batch element, credential and duplicate mapping reject before any write', async () => {
    for (const invalid of [
      { ...raw('bad'), question_content: '' },
      { ...raw('bad'), source: { title: '原件', apiKey: 'never-save' } },
      raw()
    ]) {
      const reply = await call('batchSync', {
        mistakes: [offlineMistakeToBackend(raw()), { legacy_raw: invalid, _local_id: invalid.id }]
      });
      expect(reply.code).not.toBe(0);
      expect(rows()).toEqual([]);
    }
    expect(() => offlineMistakeToBackend({ ...raw(), token: 'never-transport' })).toThrow('访问凭据');
  });
  it('JWT ownership isolates identical imports and updates cannot rewrite originals/state', async () => {
    const first = await call('add', offlineMistakeToBackend(raw()));
    const second = await call('add', offlineMistakeToBackend(raw()), 'other-owner');
    expect(first.id).not.toBe(second.id);
    const before = JSON.stringify(rows());
    const changed = await call('updateFields', {
      id: first.id,
      fields: { notes: '注释', user_answer: 'A', is_mastered: true }
    });
    expect(changed).toMatchObject({ code: 403, success: false });
    expect(JSON.stringify(rows())).toBe(before);
    expect((await call('updateStatus', { id: first.id, is_mastered: true })).code).toBe(409);
    expect(JSON.stringify(rows())).toBe(before);
    expect((await call('updateFields', { id: first.id, fields: { notes: '外账户' } }, 'other-owner')).code).toBe(404);
    expect((await handler({ body: { action: 'add', data: raw() }, headers: {} })).code).toBe(401);
    const metadata = await call('updateFields', {
      id: first.id,
      fields: { tags: ['私人标签'], notes: '保留 <原笔记> 原文' }
    });
    expect(metadata).toMatchObject({ code: 0, success: true, updated: 1 });
    const saved = db.table('mistake_book').get(first.id);
    expect(saved.notes).toBe('保留 <原笔记> 原文');
    expect(saved.legacy_original).toEqual(JSON.parse(before)[0].legacy_original);
    expect(saved.review_count).toBe(3);
    expect(saved.stats_eligible).toBe(false);
  });
});
