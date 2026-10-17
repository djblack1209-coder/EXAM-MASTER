import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { emptyLearningState, applyLearningOperation } from '../../laf-backend/functions/_shared/learning-domain.js';
import { encodeServerHistory } from '../../laf-backend/functions/_shared/learning-history-server.js';
import { recordAnswerToAnalytics } from '@/pages/practice-sub/quiz-analytics-recorder.js';
import { recordSmartAnswer } from '@/pages/practice-sub/utils/smart-question-picker.js';
import { recordAnswer as recordDailyAnswer } from '@/pages/practice-sub/utils/learning-analytics.js';
import { recordTime } from '@/pages/practice-sub/question-timer.js';
import { saveOfflineAnswer } from '@/pages/practice-sub/offline-cache.js';
import { scheduleReviewFSRS } from '../../laf-backend/functions/_shared/fsrs-scheduler';
import { checkRateLimitDistributed, logger } from '../../laf-backend/functions/_shared/api-response';

const clientSubmit = vi.hoisted(() => vi.fn(async () => ({ success: false, code: 400 })));
const clientBridge = vi.hoisted(() => vi.fn());
vi.mock('@/services/api/domains/practice.api.js', () => ({ submitAnswer: clientSubmit }));
vi.mock('@/services/learning/quiz-learning-bridge.js', () => ({ recordQuizLearningAttempt: clientBridge }));
vi.mock('@/pages/practice-sub/question-timer.js', () => ({ recordTime: vi.fn() }));
vi.mock('@/pages/practice-sub/offline-cache.js', () => ({ saveOfflineAnswer: vi.fn() }));
vi.mock('@/pages/practice-sub/utils/smart-question-picker.js', () => ({ recordSmartAnswer: vi.fn() }));
vi.mock('@/pages/practice-sub/utils/learning-analytics.js', () => ({ recordAnswer: vi.fn() }));

beforeEach(() => {
  uni.clearStorageSync();
  uni.setStorageSync('EXAM_USER_ID', 'receipt-owner');
  uni.setStorageSync('EXAM_TOKEN', 'local-test-token');
  clientSubmit.mockReset().mockResolvedValue({ success: false, code: 400 });
  clientBridge.mockReset();
  saveOfflineAnswer.mockReset().mockResolvedValue(true);
});

const receiptInput = () => ({
  currentQuestion: { id: 'q_1', question: '原题', answer: 'B' },
  isCorrect: false,
  timeSpent: 2000,
  userChoice: 0,
  getOptionLabel: () => 'A',
  sessionId: 'quiz_original_session',
  attemptId: 'quiz_answer_original'
});
const validReceipt = () => ({
  code: 0,
  success: true,
  data: {
    submission_contract: 'quiz-answer-submission-v1',
    attempt_id: 'quiz_answer_original',
    record_id: 'ans_' + 'a'.repeat(64),
    question_id: 'q_1',
    session_id: 'quiz_original_session',
    user_answer_raw: 'A',
    user_answer: 'A',
    duration: 2,
    practice_mode: 'normal',
    received_at: 1791525621000,
    grade: { status: 'pending' },
    isCorrect: null
  }
});

it('only acknowledges a bound receipt and persists it without upgrading the pending grade', async () => {
  clientSubmit.mockResolvedValueOnce(validReceipt());
  const result = await recordAnswerToAnalytics(receiptInput());
  expect(result.submission).toEqual({
    status: 'received',
    recordId: 'ans_' + 'a'.repeat(64),
    receivedAt: 1791525621000,
    localSaved: true
  });
  expect(result.grade).toEqual({ status: 'pending' });
  expect(result.isCorrect).toBeNull();
  expect(saveOfflineAnswer).toHaveBeenLastCalledWith(
    expect.objectContaining({ submission: expect.objectContaining({ status: 'received' }) }),
    expect.objectContaining({ owner: 'receipt-owner' })
  );
});

it('keeps numeric zero in originals and offline records while the legacy receipt wire uses the same scalar id as a string', async () => {
  const input = {
    ...receiptInput(),
    currentQuestion: { id: 0, question: '零号原题', options: ['甲', '乙'], answer: 'B' }
  };
  clientSubmit.mockImplementationOnce(async ({ data }) => ({
    ...validReceipt(),
    data: { ...validReceipt().data, question_id: data.question_id }
  }));
  const result = await recordAnswerToAnalytics(input);
  expect(clientSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ question_id: '0', practice_mode: 'normal' }) }),
    expect.objectContaining({ session: expect.objectContaining({ owner: 'receipt-owner' }) })
  );
  expect(clientBridge).toHaveBeenCalledWith(
    expect.objectContaining({ currentQuestion: expect.objectContaining({ id: 0 }) })
  );
  expect(saveOfflineAnswer).toHaveBeenCalledWith(
    expect.objectContaining({ questionId: 0 }),
    expect.objectContaining({ owner: 'receipt-owner' })
  );
  expect(result.questionId).toBe(0);
  expect(result.submission.status).toBe('received');
  expect(result.grade.status).toBe('pending');
});

it.each([
  ['attempt_id', 'another-attempt'],
  ['session_id', 'another-session'],
  ['question_id', 'another-question'],
  ['user_answer_raw', 'B'],
  ['user_answer', 'B'],
  ['duration', 99],
  ['practice_mode', 'exam'],
  ['submission_contract', 'unknown'],
  ['record_id', ''],
  ['received_at', 0],
  ['grade', { status: 'graded' }],
  ['isCorrect', true]
])('does not claim sync from a receipt with mismatched %s', async (field, value) => {
  const response = validReceipt();
  response.data[field] = value;
  clientSubmit.mockResolvedValueOnce(response);
  expect((await recordAnswerToAnalytics(receiptInput())).submission).toEqual({
    status: 'unconfirmed',
    localSaved: true
  });
});

it.each([
  { code: 0, success: false },
  { code: 409, success: true }
])('rejects contradictory transport status %j', async (status) => {
  clientSubmit.mockResolvedValueOnce({ ...validReceipt(), ...status });
  expect((await recordAnswerToAnalytics(receiptInput())).submission.status).toBe('unconfirmed');
});

it('keeps guests local and does not claim local persistence after a storage failure', async () => {
  uni.clearStorageSync();
  saveOfflineAnswer.mockResolvedValueOnce(false);
  expect((await recordAnswerToAnalytics(receiptInput())).submission).toEqual({
    status: 'local_only',
    localSaved: false
  });
  expect(clientSubmit).not.toHaveBeenCalled();
});

it.each(['account', 'relogin', 'closed'])('discards a late network receipt after %s changes', async (change) => {
  let finish;
  let allowed = true;
  clientSubmit.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const work = recordAnswerToAnalytics({ ...receiptInput(), canContinue: () => allowed });
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  if (change === 'account') uni.setStorageSync('EXAM_USER_ID', 'new-account');
  if (change === 'relogin') {
    const { storageService } = await import('@/services/storageService.js');
    await storageService.saveLoginSession({
      userId: 'receipt-owner',
      token: 'new-token',
      userInfo: { id: 'receipt-owner' }
    });
  }
  if (change === 'closed') allowed = false;
  finish(validReceipt());
  expect(await work).toBeNull();
  expect(saveOfflineAnswer).toHaveBeenCalledTimes(1);
});

it('freezes original question and answer before asynchronous local writes', async () => {
  let finish;
  clientBridge.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const input = receiptInput();
  let draft = 'A';
  input.getOptionLabel = () => draft;
  const work = recordAnswerToAnalytics(input);
  input.currentQuestion.id = 'later';
  draft = 'B';
  finish({});
  await work;
  expect(clientSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ question_id: 'q_1', user_answer: 'A', duration: 2 }) }),
    expect.objectContaining({ session: expect.objectContaining({ owner: 'receipt-owner' }) })
  );
});

it('stops before offline or network writes if the learning task has been stopped', async () => {
  clientBridge.mockRejectedValueOnce(Object.assign(new Error('stopped'), { code: 'STOPPED' }));
  expect(await recordAnswerToAnalytics(receiptInput())).toBeNull();
  expect(saveOfflineAnswer).not.toHaveBeenCalled();
  expect(clientSubmit).not.toHaveBeenCalled();
});

it('retries offline saves once per owner and original attempt without changing the original content or timestamp', async () => {
  const { saveOfflineAnswer: save } = await vi.importActual('@/pages/practice-sub/offline-cache.js');
  const raw = {
    attemptId: 'attempt-original',
    userId: 'receipt-owner',
    sessionId: 'session',
    questionId: 'q',
    userAnswer: 'A',
    timeSpent: 2000
  };
  expect(await save(raw)).toBe(true);
  const original = JSON.stringify(uni.getStorageSync('u_receipt-owner_EXAM_OFFLINE_ANSWERS'));
  expect(await save(raw)).toBe(true);
  expect(JSON.stringify(uni.getStorageSync('u_receipt-owner_EXAM_OFFLINE_ANSWERS'))).toBe(original);
  for (const field of ['sessionId', 'questionId', 'userAnswer', 'timeSpent']) {
    expect(await save({ ...raw, [field]: 'changed' })).toBe(false);
    expect(JSON.stringify(uni.getStorageSync('u_receipt-owner_EXAM_OFFLINE_ANSWERS'))).toBe(original);
  }
  const submission = { status: 'received', recordId: 'server-original', receivedAt: 123 };
  expect(await save({ ...raw, submission })).toBe(true);
  const accepted = JSON.stringify(uni.getStorageSync('u_receipt-owner_EXAM_OFFLINE_ANSWERS'));
  expect(await save(raw)).toBe(true);
  expect(JSON.stringify(uni.getStorageSync('u_receipt-owner_EXAM_OFFLINE_ANSWERS'))).toBe(accepted);
  expect(await save({ ...raw, userId: 'other-owner' })).toBe(false);
  expect(uni.getStorageSync('u_receipt-owner_EXAM_OFFLINE_ANSWERS')).toHaveLength(1);
  uni.setStorageSync('u_receipt-owner_EXAM_OFFLINE_ANSWERS', 'unreadable-original');
  expect(await save(raw)).toBe(false);
  expect(uni.getStorageSync('u_receipt-owner_EXAM_OFFLINE_ANSWERS')).toBe('unreadable-original');
  for (const corrupt of [0, false, {}]) {
    uni.setStorageSync('u_receipt-owner_EXAM_OFFLINE_ANSWERS', corrupt);
    expect(await save(raw)).toBe(false);
    expect(uni.getStorageSync('u_receipt-owner_EXAM_OFFLINE_ANSWERS')).toEqual(corrupt);
  }
});

it.each([true, false])('keeps reference match %s out of mastery, daily accuracy and timer scoring', async (match) => {
  vi.clearAllMocks();
  const result = await recordAnswerToAnalytics({
    currentQuestion: { id: 'q_1', question: '原题', answer: 'B' },
    isCorrect: match,
    timeSpent: 2000,
    userChoice: 0,
    getOptionLabel: () => 'A',
    sessionId: 'quiz_original_session',
    attemptId: 'quiz_answer_original'
  });
  expect(result).toMatchObject({ isCorrect: null, grade: { status: 'pending' }, referenceMatch: match });
  expect(recordSmartAnswer).not.toHaveBeenCalled();
  expect(recordDailyAnswer).not.toHaveBeenCalled();
  expect(recordTime).not.toHaveBeenCalled();
  expect(saveOfflineAnswer).toHaveBeenCalledWith(
    expect.objectContaining({
      userAnswer: 'A',
      correctAnswer: 'B',
      attemptId: 'quiz_answer_original',
      isCorrect: null,
      grade: { status: 'pending' },
      referenceMatch: match
    }),
    expect.objectContaining({ owner: 'receipt-owner' })
  );
  expect(clientSubmit).toHaveBeenCalledTimes(1);
});

it('reuses the explicit attempt identity for network retransmission instead of randomizing the key', async () => {
  clientSubmit.mockClear();
  const input = {
    currentQuestion: { id: 'q_1', question: '原题' },
    isCorrect: true,
    timeSpent: 2000,
    userChoice: 0,
    questionTimeLimit: 60,
    getOptionLabel: () => 'A',
    sessionId: 'quiz_original_session',
    attemptId: 'quiz_answer_original'
  };
  await recordAnswerToAnalytics(input);
  await recordAnswerToAnalytics(input);
  expect(clientSubmit.mock.calls.map(([params]) => params.idempotencyKey)).toEqual([
    'quiz_answer_original',
    'quiz_answer_original'
  ]);
});

it('does not send the saved answer using a later account after awaiting local write ownership', async () => {
  uni.clearStorageSync();
  clientSubmit.mockClear();
  let finish;
  clientBridge.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const pending = recordAnswerToAnalytics({
    currentQuestion: { id: 'q_1' },
    isCorrect: true,
    userChoice: 0,
    getOptionLabel: () => 'A',
    sessionId: 'quiz_original',
    attemptId: 'quiz_answer_original'
  });
  uni.setStorageSync('EXAM_USER_ID', 'local-other');
  finish({ success: true });
  expect(await pending).toBeNull();
  expect(clientSubmit).not.toHaveBeenCalled();
  uni.clearStorageSync();
});

const mocked = vi.hoisted(() => {
  const scenario = {
    jwtPayload: { userId: 'ans_user_1' },
    getOne: {},
    documents: {},
    queries: [],
    writes: [],
    failSave: false,
    loseSaveResponse: false
  };

  function resetScenario() {
    scenario.jwtPayload = { userId: 'ans_user_1' };
    scenario.getOne = {};
    scenario.documents = {};
    scenario.queries = [];
    scenario.writes = [];
    scenario.failSave = false;
    scenario.loseSaveResponse = false;
  }

  function createCollection(name) {
    const state = { query: null, skip: 0, limit: Infinity };
    const documents = (scenario.documents[name] ||= new Map());
    const matchesQuery = (doc, query) =>
      Object.entries(query || {}).every(([key, value]) =>
        value?.$in
          ? value.$in.includes(doc[key])
          : value === null
            ? doc[key] === null || doc[key] === undefined
            : doc[key] === value
      );
    const matches = (doc) => matchesQuery(doc, state.query);

    const collection = {
      aggregate() {
        let query = {};
        let group;
        const read = (doc, path) => path.split('.').reduce((value, key) => value?.[key], doc);
        const evaluate = (doc, expression) => {
          if (typeof expression === 'string' && expression.startsWith('$')) return read(doc, expression.slice(1));
          if (!expression || typeof expression !== 'object') return expression;
          if (expression.$eq) {
            const [left, right] = expression.$eq.map((value) => evaluate(doc, value));
            return left === right;
          }
          if (expression.$and) return expression.$and.every((value) => evaluate(doc, value));
          if (expression.$type) {
            const value = evaluate(doc, expression.$type);
            return value === undefined ? 'missing' : value === null ? 'null' : typeof value;
          }
          if (expression.$cond) {
            const [condition, yes, no] = expression.$cond;
            return evaluate(doc, evaluate(doc, condition) ? yes : no);
          }
          throw new Error('Unsupported aggregate fixture expression');
        };
        const aggregate = {
          match(value) {
            query = value;
            scenario.queries.push({ name, query });
            return aggregate;
          },
          group(value) {
            group = value;
            return aggregate;
          },
          async end() {
            const selected = [...documents.values()].filter((doc) => matchesQuery(doc, query));
            if (!selected.length) return { data: [] };
            const row = Object.fromEntries(
              Object.entries(group).map(([key, value]) => [
                key,
                key === '_id' ? null : selected.reduce((sum, doc) => sum + evaluate(doc, value.$sum), 0)
              ])
            );
            return { data: [row] };
          }
        };
        return aggregate;
      },
      where(query) {
        state.query = query;
        scenario.queries.push({ name, query });
        return collection;
      },
      orderBy() {
        return collection;
      },
      skip(value) {
        state.skip = value;
        return collection;
      },
      limit(value) {
        state.limit = value;
        return collection;
      },
      async getOne() {
        return scenario.getOne[name] || { data: [...documents.values()].find(matches) || null };
      },
      async get() {
        return { data: [...documents.values()].filter(matches).slice(state.skip, state.skip + state.limit) };
      },
      async count() {
        return { total: [...documents.values()].filter(matches).length };
      },
      async add(doc) {
        await Promise.resolve();
        if (scenario.failSave) throw new Error('WRITE_FAILED');
        if (documents.has(doc._id)) throw Object.assign(new Error('duplicate'), { code: 11000 });
        documents.set(doc._id, structuredClone(doc));
        scenario.writes.push({ name, doc: structuredClone(doc) });
        if (scenario.loseSaveResponse) throw new Error('RESPONSE_LOST');
        return { id: doc._id };
      },
      async update(patch) {
        const selected = [...documents.values()].filter(matches);
        for (const doc of selected) Object.assign(doc, structuredClone(patch));
        return { updated: selected.length };
      },
      doc() {
        return {
          async update() {
            return { updated: 1 };
          }
        };
      }
    };

    return collection;
  }

  const mockDb = {
    command: {
      gt: (value) => ({ $gt: value }),
      inc: (value) => ({ $inc: value }),
      in: (value) => ({ $in: value })
    },
    collection(name) {
      return createCollection(name);
    }
  };

  return {
    scenario,
    resetScenario,
    mockDb
  };
});

vi.mock('@lafjs/cloud', () => ({
  default: {
    database: () => mocked.mockDb
  }
}));

vi.mock('../../laf-backend/node_modules/@lafjs/cloud/dist/index.js', () => ({
  default: {
    database: () => mocked.mockDb
  }
}));

vi.mock('../../laf-backend/functions/login', () => ({
  verifyJWT: vi.fn(() => mocked.scenario.jwtPayload)
}));

vi.mock('../../laf-backend/functions/_shared/api-response', async () => {
  const { createApiResponseMock } = await import('../../tests/__mocks__/api-response-mock.js');
  return createApiResponseMock();
});

vi.mock('../../laf-backend/functions/_shared/auth-middleware', () => ({
  requireAuth: (ctx) => {
    const token = ctx?.headers?.authorization?.replace('Bearer ', '') || '';
    if (!token) return { code: 401, success: false, message: '请先登录' };
    const payload = mocked.scenario.jwtPayload;
    if (!payload) return { code: 401, success: false, message: '登录已过期，请重新登录' };
    return { userId: payload.userId };
  },
  isAuthError: (result) => result?.code === 401
}));

vi.mock('../../laf-backend/functions/_shared/fsrs-scheduler', () => ({
  scheduleReviewFSRS: vi.fn(() => ({
    card: {
      due: Date.now(),
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 1,
      learning_steps: 0,
      reps: 1,
      lapses: 0,
      state: 0
    },
    reviewLog: {
      rating: 1,
      state: 0,
      due: Date.now(),
      stability: 1,
      difficulty: 5,
      elapsed_days: 0,
      scheduled_days: 1,
      review: Date.now()
    },
    legacy: { interval_days: 1, ease_factor: 2.5, next_review_time: Date.now() + 86400000, stability: 1, difficulty: 5 }
  })),
  createNewCard: vi.fn(() => ({
    due: Date.now(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 0
  })),
  hasFSRSState: vi.fn(() => false),
  extractFSRSState: vi.fn(() => null),
  migrateToFSRS: vi.fn(() => ({
    due: Date.now(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    learning_steps: 0,
    reps: 0,
    lapses: 0,
    state: 0
  }))
}));

import answerSubmitHandler from '../../laf-backend/functions/answer-submit';
import smartStudyHandler from '../../laf-backend/functions/smart-study-engine';

describe('[安全审计] answer-submit 原答与幂等响应一致性', () => {
  beforeEach(() => {
    mocked.resetScenario();
    vi.clearAllMocks();
  });

  const submit = (data = {}, key = 'quiz_answer_original') =>
    answerSubmitHandler({
      body: {
        action: 'submit',
        idempotencyKey: key,
        userId: 'spoofed_user',
        data: {
          question_id: 'q_1',
          user_answer: 'A',
          session_id: 'quiz_original',
          duration: 5,
          practice_mode: 'normal',
          ...data
        }
      },
      headers: { authorization: 'Bearer valid_token' }
    });

  const records = (data = {}) =>
    answerSubmitHandler({
      body: { action: 'getRecords', userId: 'spoofed_user', data },
      headers: { authorization: 'Bearer valid_token' }
    });

  const registerQuestion = (overrides = {}) => {
    const q = {
      _id: 'q_1',
      is_active: true,
      review_status: 'approved',
      is_premium: false,
      question: '服务器保留的原题',
      options: ['甲', '乙'],
      type: 'single',
      category: '高等数学',
      source: '未核验出版参考',
      year: 2023,
      answer: 'B',
      ...overrides
    };
    mocked.scenario.documents.questions = new Map([['q_1', q]]);
    return q;
  };

  it('accepts the actual canonical client shape and persists the authenticated original as pending without FSRS', async () => {
    const response = await submit();
    expect(response.code).toBe(0);
    expect(response.success).toBe(true);
    expect(response.data).toMatchObject({
      submission_contract: 'quiz-answer-submission-v1',
      attempt_id: 'quiz_answer_original'
    });
    expect(mocked.scenario.writes).toHaveLength(1);
    expect(mocked.scenario.writes[0].doc).toMatchObject({
      user_id: 'ans_user_1',
      question_id: 'q_1',
      user_answer: 'A',
      session_id: 'quiz_original',
      is_correct: null,
      grade: { status: 'pending' }
    });
    expect(scheduleReviewFSRS).not.toHaveBeenCalled();
  });

  it('makes simultaneous identical retries one immutable receipt and rejects changed content', async () => {
    const responses = await Promise.all([submit(), submit()]);
    expect(responses.map((x) => x.code)).toEqual([0, 0]);
    expect(responses[0].data).toEqual(responses[1].data);
    expect(mocked.scenario.writes).toHaveLength(1);
    expect((await submit({ user_answer: 'B' })).code).toBe(409);
    expect(mocked.scenario.writes).toHaveLength(1);
  });

  it.each(['question_id', 'user_answer', 'session_id', 'duration', 'practice_mode'])(
    'rejects a changed %s without overwriting the original',
    async (field) => {
      const first = await submit();
      const changed = {
        question_id: 'q_2',
        user_answer: 'B',
        session_id: 'another',
        duration: 6,
        practice_mode: 'exam'
      };
      expect((await submit({ [field]: changed[field] })).code).toBe(409);
      expect((await submit()).data).toEqual(first.data);
      expect(mocked.scenario.writes).toHaveLength(1);
    }
  );

  it('keeps the exact raw input distinct even when sanitized values are the same', async () => {
    const first = await submit({ user_answer: 'a', duration: '5.9' });
    expect(first.data).toMatchObject({ user_answer: 'A', user_answer_raw: 'a', duration: 5 });
    expect(mocked.scenario.writes[0].doc.raw_input.duration).toBe('5.9');
    expect((await submit({ user_answer: 'A', duration: 5 })).code).toBe(409);
  });

  it('binds an eligible server snapshot without exposing or treating its unverified answer as a grade', async () => {
    const q = registerQuestion();
    const first = await submit();
    expect(first.data.question_binding).toMatchObject({
      status: 'bound',
      kind: 'server_question_snapshot',
      snapshot: { question: q.question, options: q.options }
    });
    expect(first.data.question_binding.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(first.data.question_binding.snapshot).not.toHaveProperty('answer');
    expect(first.data).toMatchObject({
      grade: { status: 'pending', outcome: null },
      isCorrect: null,
      memoryState: null
    });
    const savedReceipt = structuredClone(first.data);
    q.question = '后来修改的题面';
    q.answer = 'A';
    q.options[0] = '后来修改的选项';
    expect((await submit()).data).toEqual(savedReceipt);
    expect(scheduleReviewFSRS).not.toHaveBeenCalled();
  });

  it.each([
    { is_active: false },
    { review_status: 'pending' },
    { is_premium: true },
    { owner_id: 'other_account' },
    { user_id: 'other_account' },
    { owner: 'other_account' },
    { question: '' },
    { options: ['单个'] },
    { options: ['甲', { text: '乙' }] }
  ])('keeps unavailable or foreign questions unresolved without leaking content: %j', async (overrides) => {
    registerQuestion(overrides);
    expect((await submit()).data.question_binding).toEqual({
      status: 'unresolved',
      kind: 'question_id_only',
      question_id: 'q_1'
    });
  });

  it('isolates identical keys by JWT account and never reads body identity as the owner', async () => {
    const a = await submit();
    mocked.scenario.jwtPayload = { userId: 'ans_user_2' };
    const b = await submit({ user_answer: 'B' });
    expect(b.data.record_id).not.toBe(a.data.record_id);
    expect((await records()).data.map((r) => r.user_id)).toEqual(['ans_user_2']);
    expect(mocked.scenario.writes).toHaveLength(2);
  });

  it('requires authentication before querying or writing answer records', async () => {
    mocked.scenario.jwtPayload = null;
    expect((await submit()).code).toBe(401);
    expect((await records()).code).toBe(401);
    expect(mocked.scenario.queries).toEqual([]);
    expect(mocked.scenario.writes).toEqual([]);
  });

  it('returns a truthful failure before save and recovers an accepted save after response loss', async () => {
    mocked.scenario.failSave = true;
    expect((await submit()).code).toBe(500);
    expect(mocked.scenario.writes).toEqual([]);
    mocked.scenario.failSave = false;
    mocked.scenario.loseSaveResponse = true;
    const first = await submit();
    expect(first.code).toBe(0);
    expect((await submit()).data).toEqual(first.data);
    expect(mocked.scenario.writes).toHaveLength(1);
    expect(logger.warn.mock.calls.flat().join(' ')).not.toContain('ans_user_1');
  });

  it('retains the existing distributed rate boundary before any business write', async () => {
    checkRateLimitDistributed.mockResolvedValueOnce({ allowed: false });
    expect((await submit()).code).toBe(429);
    expect(checkRateLimitDistributed).toHaveBeenCalledWith('answer-submit:ans_user_1:submit', 120, 60000);
    expect(mocked.scenario.writes).toEqual([]);
  });

  it.each([
    { isCorrect: true },
    { user_id: 'someone' },
    { question_id: { $ne: '' } },
    { session_id: '../other' },
    { user_answer: 'AA' },
    { user_answer: ' A' },
    { duration: -1 },
    { duration: true },
    { duration: '0'.repeat(33) },
    { duration: Infinity },
    { practice_mode: 'unknown' }
  ])('rejects malformed or spoofed original fields before save: %j', async (data) => {
    expect((await submit(data)).code).toBe(400);
    expect(mocked.scenario.writes).toEqual([]);
  });

  it('retrieves only the authenticated original session and exact pending/false filters', async () => {
    registerQuestion();
    await submit();
    await submit({ session_id: 'other_session' }, 'quiz_answer_other');
    mocked.scenario.documents.practice_records.set('historical_wrong', {
      user_id: 'ans_user_1',
      is_correct: false,
      session_id: 'quiz_original',
      question_id: 'q_2'
    });
    expect((await records({ session_id: 'quiz_original', question_id: 'q_1', is_correct: null })).data).toHaveLength(1);
    const wrong = await records({ is_correct: false });
    expect(wrong.data.map((r) => r.question_id)).toEqual(['q_2']);
    expect((await records({ category: '高等数学' })).total).toBe(2);
  });

  it('reports pending-only receipts without a zero accuracy or legacy grade', async () => {
    registerQuestion();
    await submit();
    const before = JSON.stringify([...mocked.scenario.documents.practice_records.values()]);
    const response = await records();
    expect(response.summary).toEqual({
      contract: 'quiz-receipt-summary-v1',
      scope: 'filtered_records',
      scoringAuthority: false,
      received: 1,
      pending: 1,
      legacyGraded: 0,
      legacyCorrect: 0,
      legacyWrong: 0,
      unclassified: 0,
      legacyAccuracy: null
    });
    expect(JSON.stringify([...mocked.scenario.documents.practice_records.values()])).toBe(before);
    expect(mocked.scenario.writes).toHaveLength(1);
  });

  it('summarizes all matching pages and preserves unknown historical grades as unclassified', async () => {
    mocked.scenario.documents.practice_records = new Map([
      ['right', { user_id: 'ans_user_1', is_correct: true, category: '数学', session_id: 'original' }],
      ['wrong', { user_id: 'ans_user_1', is_correct: false, category: '数学', session_id: 'original' }],
      [
        'pending',
        {
          user_id: 'ans_user_1',
          is_correct: null,
          grade: { status: 'pending' },
          category: '数学',
          session_id: 'original'
        }
      ],
      [
        'conflicting',
        {
          user_id: 'ans_user_1',
          is_correct: true,
          grade: { status: 'pending' },
          category: '数学',
          session_id: 'original'
        }
      ],
      ['unknown', { user_id: 'ans_user_1', is_correct: null, category: '数学', session_id: 'original' }],
      ['string', { user_id: 'ans_user_1', is_correct: 'false', category: '数学', session_id: 'original' }],
      [
        'receipt-without-grade',
        {
          user_id: 'ans_user_1',
          submission_contract: 'quiz-answer-submission-v1',
          is_correct: true,
          category: '数学',
          session_id: 'original'
        }
      ],
      [
        'unknown-authority',
        {
          user_id: 'ans_user_1',
          is_correct: true,
          grade: { status: 'matched' },
          category: '数学',
          session_id: 'original'
        }
      ],
      ['other-session', { user_id: 'ans_user_1', is_correct: false, category: '数学', session_id: 'other' }],
      ['other-owner', { user_id: 'foreign', is_correct: true, category: '数学', session_id: 'original' }]
    ]);
    const before = JSON.stringify([...mocked.scenario.documents.practice_records.values()]);
    const response = await records({ category: '数学', session_id: 'original', page: 2, limit: 1 });
    expect(response.data).toHaveLength(1);
    expect(response.total).toBe(8);
    expect(response.summary).toMatchObject({
      received: 8,
      pending: 2,
      legacyGraded: 2,
      legacyCorrect: 1,
      legacyWrong: 1,
      unclassified: 4,
      legacyAccuracy: 50
    });
    expect(JSON.stringify([...mocked.scenario.documents.practice_records.values()])).toBe(before);
    expect(mocked.scenario.writes).toEqual([]);
    expect(mocked.scenario.queries.every(({ query }) => query.user_id === 'ans_user_1')).toBe(true);
  });

  it('keeps the exact false filter while a conflicting pending flag cannot become legacy wrong', async () => {
    mocked.scenario.documents.practice_records = new Map([
      ['wrong', { user_id: 'ans_user_1', is_correct: false, question_id: 'q_1' }],
      ['pending-false', { user_id: 'ans_user_1', is_correct: false, grade: { status: 'pending' }, question_id: 'q_1' }],
      ['different', { user_id: 'ans_user_1', is_correct: false, question_id: 'q_2' }],
      ['string-false', { user_id: 'ans_user_1', is_correct: 'false', question_id: 'q_1' }]
    ]);
    const response = await records({ is_correct: false, question_id: 'q_1' });
    expect(response.total).toBe(2);
    expect(response.summary).toMatchObject({
      received: 2,
      pending: 1,
      legacyGraded: 1,
      legacyWrong: 1,
      legacyAccuracy: 0
    });
  });

  it('returns a truthful empty summary for an account with no records', async () => {
    const response = await records();
    expect(response.summary).toMatchObject({
      received: 0,
      pending: 0,
      legacyGraded: 0,
      unclassified: 0,
      legacyAccuracy: null
    });
  });

  it('preserves Mongo null filter compatibility without classifying missing historical fields as pending', async () => {
    mocked.scenario.documents.practice_records = new Map([
      ['new', { user_id: 'ans_user_1', is_correct: null, grade: { status: 'pending' } }],
      ['legacy-null', { user_id: 'ans_user_1', is_correct: null }],
      ['legacy-missing', { user_id: 'ans_user_1' }],
      ['legacy-false', { user_id: 'ans_user_1', is_correct: false }]
    ]);
    const response = await records({ is_correct: null });
    expect(response.total).toBe(3);
    expect(response.summary).toMatchObject({
      received: 3,
      pending: 1,
      unclassified: 2,
      legacyGraded: 0,
      legacyAccuracy: null
    });
  });

  it('does not cap receipt summary to the displayed page or mastery history limit', async () => {
    mocked.scenario.documents.practice_records = new Map(
      Array.from({ length: 501 }, (_, i) => [
        `pending_${i}`,
        { user_id: 'ans_user_1', is_correct: null, grade: { status: 'pending' } }
      ])
    );
    mocked.scenario.documents.practice_records.set('old-true', { user_id: 'ans_user_1', is_correct: true });
    const response = await records({ page: 6, limit: 100 });
    expect(response.data).toHaveLength(2);
    expect(response.total).toBe(502);
    expect(response.summary).toMatchObject({ received: 502, pending: 501, legacyCorrect: 1, legacyAccuracy: 100 });
  });

  it.each([
    { is_correct: 'false' },
    { is_correct: 0 },
    { session_id: { $ne: '' } },
    { question_id: '' },
    { category: { $regex: '.*' } },
    { user_id: 'other' },
    { page: '1suffix' },
    { limit: -1 },
    { page: [] }
  ])('rejects untyped or foreign record filters: %j', async (data) => {
    expect((await records(data)).code).toBe(400);
    expect(mocked.scenario.queries).toEqual([]);
  });

  it('summarizes all legacy receipts without turning the old boolean into mastery', async () => {
    const docs = new Map(
      Array.from({ length: 501 }, (_, i) => [
        String(i),
        { user_id: 'ans_user_1', category: '高等数学', is_correct: null }
      ])
    );
    docs.set('old_true', { user_id: 'ans_user_1', category: '高等数学', is_correct: true });
    mocked.scenario.documents.practice_records = docs;
    const response = await smartStudyHandler({
      body: { action: 'analyze_mastery' },
      headers: { authorization: 'Bearer valid_token' }
    });
    expect(response.data.mastery).toEqual([]);
    expect(response.data.legacyHistory).toMatchObject({
      received: 502,
      legacyCorrect: 1,
      unclassified: 501,
      scoringAuthority: false
    });
    expect(response.data.summary.avgMastery).toBeNull();
  });

  it('does not classify new pending practice records as wrong or weak points', async () => {
    mocked.scenario.documents.practice_records = new Map([
      ['pending', { user_id: 'ans_user_1', category: '高等数学', is_correct: null, grade: { status: 'pending' } }]
    ]);
    const response = await smartStudyHandler({
      body: { action: 'analyze_mastery' },
      headers: { authorization: 'Bearer valid_token' }
    });
    expect(response.data.mastery).toEqual([]);
  });

  function registerLearningEvidence() {
    let state = emptyLearningState('ans_user_1', 'America/Los_Angeles');
    let serial = 0;
    const apply = (type, data, id = `remote_${++serial}`) => {
      const outcome = applyLearningOperation(state, { id, type, data, at: Date.now() - 1000 });
      state = outcome.state;
    };
    apply('conversation.start', { goal: '合成远端证据' }, 'remote_conversation');
    for (const [id, answer, validation] of [
      [
        'remote_good',
        '4',
        { type: 'number', answer: '4', authority: 'human_reviewed', evidenceId: 'synthetic-review' }
      ],
      [
        'remote_wrong',
        '5',
        { type: 'number', answer: '4', authority: 'human_reviewed', evidenceId: 'synthetic-review' }
      ],
      ['remote_pending', '4', null]
    ]) {
      apply('question.add', {
        question: {
          id,
          version: 1,
          prompt: '合成 2+2',
          scope: 'private',
          subject: '数学',
          knowledgePoint: id,
          validation,
          uncertainties: []
        }
      });
      apply('question.focus', { conversationId: 'remote_conversation', questionKey: `${id}@1` });
      apply('attempt.submit', { conversationId: 'remote_conversation', answer, explicit: true }, `${id}_answer`);
    }
    apply('review.schedule', { attemptId: 'remote_wrong_answer', due: Date.now() - 100, rating: 1 });
    const id = `learning_sync_${createHash('sha256').update('ans_user_1').digest('hex')}`;
    const row = { _id: id, user_id: 'ans_user_1', revision: state.revision, state };
    mocked.scenario.documents.learning_states = new Map([[id, row]]);
    return {
      row,
      stop() {
        apply('task.stop', { conversationId: 'remote_conversation' });
        row.state = state;
        row.revision = state.revision;
      }
    };
  }

  const remoteStudy = (action, data = {}) =>
    smartStudyHandler({ body: { action, data, userId: 'spoofed' }, headers: { authorization: 'Bearer valid_token' } });

  it('reads actual learning evidence and due reviews while preserving old counters and raw state', async () => {
    const { row, stop } = registerLearningEvidence();
    mocked.scenario.documents.mistake_book = new Map([
      ['old', { user_id: 'ans_user_1', category: '高等数学', wrong_count: 999, stability: 1, is_mastered: false }]
    ]);
    const original = JSON.stringify(row);
    const response = await remoteStudy('analyze_mastery');
    expect(response.data).toMatchObject({
      contract: 'learning-evidence-summary-v1',
      ownerId: 'ans_user_1',
      summary: { reliableAnswers: 2, pending: 1, avgMastery: null }
    });
    expect(response.data.mastery).toHaveLength(2);
    expect(response.data.reviewTargets[0]).toMatchObject({
      questionKey: 'remote_wrong@1',
      evidenceIds: ['remote_wrong_answer']
    });
    expect(JSON.stringify(row)).toBe(original);
    expect(mocked.scenario.writes).toEqual([]);
    stop();
    const stopped = await remoteStudy('sprint_priority', { examDate: '2099-12-31' });
    expect(stopped.data.items).toEqual([]);
    expect((await remoteStudy('analyze_mastery')).data.summary.reliableAnswers).toBe(2);
  });

  it('keeps suggestions as unsaved drafts and counts preparation days in the saved timezone', async () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-09T06:30:00Z'));
    try {
      registerLearningEvidence();
      const priority = await remoteStudy('sprint_priority', { examDate: '2026-10-10', dailyHours: 0.5 });
      expect(priority.data).toMatchObject({
        persisted: false,
        daysRemaining: 2,
        dailyBudgetMinutes: 30,
        timezone: 'America/Los_Angeles'
      });
      expect(priority.data.items[0]).toMatchObject({ priority: 'due_review', evidenceIds: ['remote_wrong_answer'] });
      const response = await remoteStudy('generate_plan', { examDate: '2026-10-10', dailyHours: 1 });
      expect(response.data.plans.map((plan) => plan.date)).toEqual(['2026-10-08', '2026-10-09']);
      expect(response.data.plans.every((plan) => plan.totalMinutes === 60)).toBe(true);
      expect(response.data.plans[0].tasks[0]).toMatchObject({ action: 'review', questionKey: 'remote_wrong@1' });
      expect(response.data.plans[1].tasks.some((task) => task.action === 'review')).toBe(false);
      expect((await remoteStudy('generate_plan', { examDate: '2026-10-08' })).data.plans).toEqual([]);
      expect(mocked.scenario.writes).toEqual([]);
    } finally {
      clock.mockRestore();
    }
  });

  it.each([
    { examDate: '2026-02-30' },
    { examDate: 'tomorrow' },
    { examDate: { $gt: '' } },
    { examDate: '2000-01-01' },
    { examDate: '2099-12-31', dailyHours: '6' },
    { examDate: '2099-12-31', dailyHours: 0 },
    { examDate: '2099-12-31', dailyHours: 24 }
  ])('rejects invalid calendar/budget input without writing plans: %j', async (data) => {
    expect((await remoteStudy('generate_plan', data)).code).toBe(400);
    expect(mocked.scenario.writes).toEqual([]);
  });

  it('isolates snapshot ownership, fails closed on corrupt history and never initializes data on read', async () => {
    const { row } = registerLearningEvidence();
    row.state = await encodeServerHistory(row.state, 'ans_user_1');
    mocked.scenario.jwtPayload = { userId: 'other-owner' };
    expect((await remoteStudy('analyze_mastery')).data.summary.reliableAnswers).toBe(0);
    mocked.scenario.jwtPayload = { userId: 'ans_user_1' };
    row.state.owner = 'other-owner';
    expect((await remoteStudy('analyze_mastery')).code).toBe(500);
    expect(row.state.owner).toBe('other-owner');
    expect(mocked.scenario.writes).toEqual([]);
    expect((await smartStudyHandler({ body: { action: 'analyze_mastery' }, headers: {} })).code).toBe(401);
    checkRateLimitDistributed.mockResolvedValueOnce({ allowed: false });
    expect((await remoteStudy('analyze_mastery')).code).toBe(429);
  });

  it('groups only owned legacy records and labels bounded coverage without inventing severity or a reference', async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => [
      String(i),
      {
        _id: String(i),
        user_id: 'ans_user_1',
        question_content: `原题${i}`,
        category: '数学::原标签',
        wrong_count: 999,
        error_type: 'calculation_error',
        is_mastered: 'false'
      }
    ]);
    rows.push(['foreign', { _id: 'foreign', user_id: 'other-owner', question_content: '不得泄漏', category: '私密' }]);
    mocked.scenario.documents.mistake_book = new Map(rows);
    const before = JSON.stringify(rows);
    const response = await remoteStudy('error_clustering');
    expect(response.data.scope).toMatchObject({ totalRecords: 1001, scannedRecords: 1000, truncated: true });
    expect(response.data.clusters).toHaveLength(1);
    expect(response.data.clusters[0]).toMatchObject({
      questionCount: 1000,
      countBand: 'high',
      scoringAuthority: false,
      knowledgePoints: ['数学::原标签']
    });
    expect(response.data.clusters[0].examples[0].referenceAnswer).toBe('');
    for (const key of ['severity', 'trend', 'suggestion']) expect(response.data.clusters[0]).not.toHaveProperty(key);
    expect(JSON.stringify(rows)).toBe(before);
  });

  it('returns evidence reminders instead of inventing or persisting a model diagnosis from legacy mistakes', async () => {
    mocked.scenario.documents.mistake_book = new Map(
      Array.from({ length: 3 }, (_, i) => [String(i), { user_id: 'ans_user_1', wrong_count: 30, category: '数学' }])
    );
    expect((await remoteStudy('deep_correction')).data).toMatchObject({
      modelInvoked: false,
      persisted: false,
      corrections: []
    });
    registerLearningEvidence();
    const response = await remoteStudy('deep_correction', { knowledgePoint: '数学 / remote_wrong' });
    expect(response.data.corrections[0]).toMatchObject({ evidenceIds: ['remote_wrong_answer'] });
    expect(response.data.corrections[0]).not.toHaveProperty('rootCause');
    expect(mocked.scenario.writes).toEqual([]);
  });

  it('retains old generated text as unverified history and marks only an owned exact record read', async () => {
    const own = { _id: 'old_own', user_id: 'ans_user_1', status: 'pending', rootCause: '旧模型文案' };
    const other = { _id: 'old_other', user_id: 'other-owner', status: 'pending', rootCause: '私密文案' };
    mocked.scenario.documents.deep_corrections = new Map([
      [own._id, own],
      [other._id, other]
    ]);
    const response = await remoteStudy('get_pending_corrections');
    expect(response.data.corrections).toHaveLength(1);
    expect(response.data.corrections[0]).toMatchObject({
      rootCause: own.rootCause,
      verificationStatus: 'unverified',
      scoringAuthority: false
    });
    expect((await remoteStudy('mark_correction_read', { correctionId: { $ne: '' } })).code).toBe(400);
    expect((await remoteStudy('mark_correction_read', { correctionId: 'old_other' })).code).toBe(404);
    expect(other.status).toBe('pending');
    expect((await remoteStudy('mark_correction_read', { correctionId: 'old_own' })).code).toBe(0);
    expect(own.status).toBe('read');
    expect(own.rootCause).toBe('旧模型文案');
  });

  it('invalid canonical parameters return 400 without claiming a saved fact', async () => {
    const result = /** @type {any} */ (
      await answerSubmitHandler({
        body: {
          action: 'submit',
          idempotencyKey: 'idem_processing_1',
          data: {
            question_id: 'q_1',
            user_answer: 'not-an-answer',
            session_id: 'session_1',
            duration: 5,
            practice_mode: 'normal'
          }
        },
        headers: {
          authorization: 'Bearer valid_token'
        }
      })
    );

    expect(result.code).toBe(400);
    expect(result.success).toBe(false);
    expect(result.message).toContain('参数错误');
  });
});
