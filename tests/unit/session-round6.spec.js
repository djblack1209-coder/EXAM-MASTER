import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { spawnSync } from 'node:child_process';
import { storageService } from '@/services/storageService.js';
import { captureSession, checkSession, isSessionUnavailable } from '@/services/auth-storage.js';
import { useUserStore } from '@/stores/modules/user.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { useReviewStore } from '@/stores/modules/review.js';
import { OfflineQueue } from '@/utils/core/offline-queue.js';
import { learningRequest } from '@/services/api/domains/learning.api.js';
import { syncLearningGoals } from '@/services/api/domains/user.api.js';
import { learningGoalManager } from '@/utils/learning/learning-goal.js';
import { offlineCache } from '@/pages/practice-sub/services/offline-cache-service.js';
import { saveOfflineAnswer } from '@/pages/practice-sub/offline-cache.js';
import { generateLearningTurnStream } from '@/services/learning/learning-stream.js';
import { saveQuizProgress } from '@/composables/useQuizAutoSave.js';
import { tokenRefreshPlugin } from '@/utils/auth/token-refresh-plugin.js';
import { analytics } from '@/utils/analytics/event-bus-analytics.js';
const read = uni.getStorageSync.getMockImplementation();
let blocked, pinia;
const login = (n = 1) =>
  storageService.saveLoginSession({ userId: `account-${n}`, token: `fixture-${n}`, userInfo: { id: `account-${n}` } });
beforeEach(() => {
  vi.useFakeTimers();
  blocked = null;
  uni.getStorageSync.mockImplementation((key) => {
    if (key === blocked) throw Error('fixture read failure');
    return read(key);
  });
  uni.clearStorageSync();
  const events = new Map();
  uni.$on.mockImplementation((name, fn) => {
    if (!events.has(name)) events.set(name, new Set());
    events.get(name).add(fn);
  });
  uni.$off.mockImplementation((name, fn) => events.get(name)?.delete(fn));
  uni.$emit.mockImplementation((name, ...args) => {
    for (const fn of [...(events.get(name) || [])]) fn(...args);
  });
  login();
  pinia = createPinia();
  setActivePinia(pinia);
  uni.request.mockReset();
});
afterEach(() => {
  blocked = null;
  storageService.flushPendingWrites();
  tokenRefreshPlugin.stopPreCheckTimer();
  for (const store of pinia._s.values()) store.$dispose();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('order-01/order-02: latest queued login survives and logout cannot be rolled back', () => {
  const child = spawnSync(process.execPath, ['--experimental-vm-modules', 'tests/fixtures/session-races/round6.mjs'], {
    encoding: 'utf8',
    timeout: 15000
  });
  expect(child.status, child.stderr).toBe(0);
  const rows = child.stdout
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  expect(rows).toHaveLength(2);
  for (const row of rows) expect(row.ok, row.name).toBe(true);
});
it('WRITES-06-01: guest binding stays revoked after login then logout', async () => {
  storageService._clearRevokedCredentials();
  const guest = captureSession();
  login(2);
  storageService._clearRevokedCredentials();
  expect(checkSession(guest)).toBe('changed');
  expect(storageService.save('conversation_learning_v1', { old: true }, true, guest)).toBe(false);
  expect(await saveOfflineAnswer({ userId: 'guest', attemptId: 'quiz_answer_guest_old' }, guest)).toBe(false);
  expect(checkSession(captureSession())).toBe('current');
});
it('WRITES-06-01: first guest revocation is never mistaken for epoch initialization', () => {
  uni.clearStorageSync();
  const old = captureSession();
  expect(old.epoch).toBeNull();
  storageService._clearRevokedCredentials();
  expect(checkSession(old)).toBe('changed');
  storageService.beginLoginAttempt();
  expect(checkSession(old)).toBe('changed');
  storageService.clear(true, { preserveGlobal: false });
  expect(checkSession(old)).toBe('changed');
});
it('MIGRATE-15-01: unavailable older debounce cannot replace newer owner progress', () => {
  const old = captureSession();
  login(2);
  const current = captureSession();
  saveQuizProgress({ currentIndex: 8 }, false, null, current);
  blocked = '_enc_EXAM_SESSION_EPOCH';
  saveQuizProgress({ currentIndex: 1 }, false, null, old);
  blocked = null;
  storageService.flushPendingWrites();
  expect(storageService.get('EXAM_QUIZ_PROGRESS')).toMatchObject({ currentIndex: 8 });
});
it('regress-6-02: logout revokes before identity read and completes while reads fail', () => {
  const auth = useUserStore();
  auth.restoreUserInfo();
  const old = captureSession();
  storageService.save('temporary_cache', { transient: true }, true);
  expect(auth.isLogin).toBe(true);
  blocked = '_enc_EXAM_SESSION_EPOCH';
  expect(() => auth.logout()).not.toThrow();
  expect(auth.isLogin).toBe(false);
  blocked = null;
  expect(checkSession(old)).toBe('changed');
  expect(captureSession()?.owner).toBe('guest');
});
it('logout revokes before cleanup and never flushes a deferred old-session write', () => {
  const auth = useUserStore();
  auth.restoreUserInfo();
  storageService.saveDebounced('imported_files', [{ id: 'uncommitted' }]);
  const write = vi.spyOn(uni, 'setStorageSync');
  write.mockClear();
  auth.logout();
  expect(write.mock.calls[0]?.[0]).toBe('EXAM_IDENTITY_GENERATION');
  expect(read('u_account-1_imported_files')).toBe('');
  storageService.flushPendingWrites();
  expect(read('u_account-1_imported_files')).toBe('');
});
it('regress-6-01: failed learning root read preserves projection and history on next start', () => {
  const store = useConversationLearningStore();
  store.start('原目标');
  const before = JSON.stringify(store.state);
  blocked = 'u_account-1_conversation_learning_v1';
  store.refresh();
  expect(JSON.stringify(store.state)).toBe(before);
  expect(() => store.start('新目标')).toThrow();
  blocked = null;
  store.refresh();
  expect(store.state.conversations).toHaveLength(1);
  store.start('恢复后的目标');
  expect(store.state.conversations).toHaveLength(2);
});
it.each(['throw', 'empty'])('MIGRATE-15-02: failed sync queue %s retains old and new pending rows', (mode) => {
  const key = 'u_account-1_EXAM_OFFLINE_SYNC_QUEUE';
  offlineCache.addToSyncQueue('old', { answer: 'original' });
  const original = read(key);
  if (mode === 'throw') blocked = key;
  else uni.getStorageSync.mockImplementation((k) => (k === key ? '' : read(k)));
  offlineCache.addToSyncQueue('new', { answer: 'next' });
  expect(read(key)).toEqual(original);
  blocked = null;
  uni.getStorageSync.mockImplementation(read);
  offlineCache.addToSyncQueue('third', {});
  expect(read(key).map((row) => row.action)).toEqual(['old', 'new', 'third']);
});
it.each(['fetchQuestionBankStats', 'browseQuestions', 'fetchQuestionBankRandom'])(
  'inflight-15-01: fulfilled unavailable %s preserves review projection',
  async (method) => {
    const store = useReviewStore();
    store.questionBankStats = { total: 8, categories: [] };
    store.questionBankList = [{ id: 'original' }];
    uni.request.mockImplementation((o) => {
      blocked = '_enc_EXAM_SESSION_EPOCH';
      o.success({ statusCode: 200, data: { code: 0, data: {} } });
      blocked = null;
      return { abort() {} };
    });
    const result = await store[method]().catch((e) => e);
    expect(isSessionUnavailable(result)).toBe(true);
    expect(store.questionBankStats.total).toBe(8);
    expect(store.questionBankList).toEqual([{ id: 'original' }]);
    expect(store.loading).toBe(false);
  }
);
it('inflight-15-02: fulfilled learningRequest unavailable retains body and retry count', async () => {
  const queue = new OfflineQueue();
  const session = captureSession();
  queue.enqueue({
    requestFn: () => {
      blocked = '_enc_EXAM_SESSION_EPOCH';
      const result = learningRequest('/learning-sync', { action: 'push' }, { session });
      blocked = null;
      return result;
    },
    requestData: { original: 'answer' },
    session
  });
  queue.queue[0].retryCount = 2;
  const pending = queue.processQueue();
  await vi.runAllTimersAsync();
  await pending;
  expect(uni.request).not.toHaveBeenCalled();
  expect(queue.queue).toHaveLength(1);
  expect(queue.queue[0]).toMatchObject({ retryCount: 2, requestData: { original: 'answer' } });
});
it('WRITES-06-02: real goal API retains unavailable type and pending marker', async () => {
  uni.request.mockImplementation((o) => {
    blocked = '_enc_EXAM_SESSION_EPOCH';
    o.success({ statusCode: 200, data: { code: 0, data: {} } });
    blocked = null;
    return { abort() {} };
  });
  const goals = [{ type: 'DAILY_QUESTIONS', targetValue: 20, status: 'active' }];
  const response = await syncLearningGoals('account-1', { goals });
  expect(isSessionUnavailable(response)).toBe(true);
  const manager = new learningGoalManager.constructor();
  manager.goals = goals;
  await manager._syncToServer();
  expect(storageService.get('learning_goals_pending_sync')).toBe(true);
});
it('inflight-15-03: stream result keeps unavailable classification', async () => {
  const session = captureSession();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      blocked = '_enc_EXAM_SESSION_EPOCH';
      return new Response('{}');
    })
  );
  const result = await generateLearningTurnStream(
    { requestId: 'round6', modelId: 'fixture', learningContext: { owner: 'account-1' } },
    { session, platform: 'h5' }
  );
  blocked = null;
  expect(isSessionUnavailable(result)).toBe(true);
});

it('strict reads distinguish missing, valid empty, thrown and swallowed failures', () => {
  expect(storageService.read('rows', [])).toEqual({ status: 'ready', value: [] });
  storageService.save('rows', [], true);
  expect(storageService.read('rows', []).status).toBe('ready');
  storageService.save('text', '', true);
  expect(storageService.read('text', '').value).toBe('');
  blocked = 'u_account-1_rows';
  expect(storageService.read('rows', []).status).toBe('unavailable');
  expect(() => storageService.get('rows', [])).toThrow();
  blocked = null;
  uni.getStorageSync.mockImplementation((key) => (key === 'u_account-1_rows' ? '' : read(key)));
  expect(storageService.read('rows', []).status).toBe('unavailable');
});
it('an unread write base blocks later snapshot saves until a successful reread', () => {
  storageService.save('guarded_rows', ['history'], true);
  blocked = 'u_account-1_guarded_rows';
  expect(storageService.read('guarded_rows', []).status).toBe('unavailable');
  expect(storageService.save('guarded_rows', ['draft'], true)).toBe(false);
  expect(read(blocked)).toEqual(['history']);
  blocked = null;
  expect(storageService.save('guarded_rows', ['draft'], true)).toBe(false);
  const confirmed = storageService.get('guarded_rows', []);
  expect(storageService.save('guarded_rows', [...confirmed, 'draft'], true)).toBe(true);
  expect(storageService.get('guarded_rows')).toEqual(['history', 'draft']);
});
it('a goal load fault keeps the draft in memory and blocks both local and remote writes', () => {
  const manager = new learningGoalManager.constructor();
  manager.goals = [{ id: 'history', type: 'DAILY_QUESTIONS', status: 'active' }];
  storageService.save('learning_goals', JSON.parse(JSON.stringify(manager.goals)), true);
  blocked = 'u_account-1_learning_goals';
  expect(() => manager._loadGoals()).toThrow();
  manager.goals.push({ id: 'draft', type: 'DAILY_TIME', status: 'active' });
  manager._saveGoals();
  expect(manager.goals).toHaveLength(2);
  expect(read(blocked)).toHaveLength(1);
  expect(uni.request).not.toHaveBeenCalled();
});
it('offline original answers merge retained work after a read fault and preserve receipts', async () => {
  const answer = (id) => ({
    userId: 'account-1',
    attemptId: `quiz_answer_round6_${id}`,
    questionId: id,
    userAnswer: '原答',
    timeSpent: 10
  });
  await saveOfflineAnswer(answer('old'));
  blocked = 'u_account-1_EXAM_OFFLINE_ANSWERS';
  expect(await saveOfflineAnswer(answer('new'))).toBe(false);
  expect(read(blocked)).toHaveLength(1);
  blocked = null;
  storageService.flushPendingWrites();
  expect(storageService.get('EXAM_OFFLINE_ANSWERS').map((a) => a.questionId)).toEqual(['old', 'new']);
  expect(await saveOfflineAnswer({ ...answer('new'), submission: { status: 'received' } })).toBe(true);
  expect(storageService.get('EXAM_OFFLINE_ANSWERS')).toHaveLength(2);
});
it('pending cache merge retains other categories and does not duplicate after unreadable confirmation', () => {
  offlineCache.cacheQuestions([{ id: 'old' }], 'math');
  blocked = 'u_account-1_EXAM_OFFLINE_QUESTIONS';
  offlineCache.cacheQuestions([{ id: 'new' }], 'english');
  blocked = null;
  storageService.flushPendingWrites();
  expect(storageService.get('EXAM_OFFLINE_QUESTIONS')).toEqual({ math: [{ id: 'old' }], english: [{ id: 'new' }] });
  const write = uni.setStorageSync.getMockImplementation();
  vi.spyOn(uni, 'setStorageSync').mockImplementation((key, value) => {
    write(key, value);
    if (key === 'u_account-1_confirm') blocked = key;
  });
  expect(storageService.update('confirm', [], (rows) => [...rows, 'once'])).toBe(false);
  blocked = null;
  storageService.flushPendingWrites();
  expect(storageService.get('confirm')).toEqual(['once']);
});
it('mistake preflight retains frozen new data until history can be read', async () => {
  storageService._clearRevokedCredentials();
  storageService.save('mistake_book', [{ id: 'old', question: '旧原题' }], true);
  blocked = 'mistake_book';
  const input = { question: '新原题' };
  const pending = storageService.addMistake(input).catch((e) => e);
  expect(isSessionUnavailable(await pending)).toBe(true);
  input.question = 'mutated';
  blocked = null;
  await vi.advanceTimersByTimeAsync(500);
  await storageService._mistakeBookMutex;
  expect(storageService.get('mistake_book').map((m) => m.question)).toEqual(['新原题', '旧原题']);
});
it.each([
  ['@/utils/learning/learning-goal.js', 'learningGoalManager', '_loadGoals', 'goals', 'learning_goals', []],
  ['@/utils/learning/learning-goal.js', 'learningGoalManager', '_loadRecords', 'records', 'learning_goal_records', []],
  [
    '@/utils/learning/adaptive-learning-engine.js',
    'adaptiveLearningEngine',
    '_loadMistakeBook',
    'mistakeBook',
    'mistake_book',
    []
  ],
  [
    '@/utils/learning/adaptive-learning-engine.js',
    'adaptiveLearningEngine',
    '_loadLearningHistory',
    'learningHistory',
    'adaptive_learning_history',
    []
  ],
  [
    '@/utils/learning/adaptive-learning-engine.js',
    'adaptiveLearningEngine',
    '_loadKnowledgeMap',
    'knowledgeMap',
    'adaptive_knowledge_map',
    {}
  ],
  [
    '@/utils/learning/adaptive-learning-engine.js',
    'adaptiveLearningEngine',
    '_loadReviewSchedule',
    'reviewSchedule',
    'adaptive_review_schedule',
    []
  ],
  ['@/pages/practice-sub/question-note.js', 'questionNoteManager', '_loadNotes', 'notes', 'question_notes', []],
  [
    '@/pages/practice-sub/question-timer.js',
    'questionTimer',
    '_loadTimeRecords',
    'timeRecords',
    'question_time_records',
    []
  ],
  [
    '@/pages/practice-sub/utils/smart-question-picker.js',
    'smartQuestionPicker',
    '_loadQuestionHistory',
    'questionHistory',
    'smart_picker_question_history',
    []
  ]
])(
  'strict manager load preserves projection and normal recovery: %s %s %s',
  async (path, name, load, field, key, empty) => {
    const mod = await import(path);
    const manager = new mod[name].constructor();
    manager[field] = { trusted: true };
    blocked = `u_account-1_${key}`;
    expect(() => manager[load]()).toThrow();
    expect(manager[field]).toEqual({ trusted: true });
    blocked = null;
    storageService.save(key, empty, true);
    manager[load]();
    expect(manager[field]).toEqual(empty);
  }
);
it.each([true, false])('goals clear pending only after every explicit receipt: success=%s', async (success) => {
  uni.request.mockImplementation((o) => {
    o.success({ statusCode: 200, data: { code: success ? 0 : -1, success, data: {} } });
    return { abort() {} };
  });
  const manager = new learningGoalManager.constructor();
  manager.goals = [{ type: 'DAILY_QUESTIONS', targetValue: 20, status: 'active' }];
  await manager._syncToServer();
  expect(storageService.get('learning_goals_pending_sync')).toBe(success ? null : true);
});
it('review normal remote and offline queue successful receipt remain usable', async () => {
  uni.request.mockImplementation((o) => {
    o.success({ statusCode: 200, data: { code: 0, data: { total: 3, categories: [] } } });
    return { abort() {} };
  });
  const store = useReviewStore();
  expect(await store.fetchQuestionBankStats()).toMatchObject({ success: true, source: 'remote', data: { total: 3 } });
  const queue = new OfflineQueue();
  queue.enqueue({ requestFn: async () => ({ code: 0, success: true }), requestData: { normal: true } });
  const pending = queue.processQueue();
  await vi.runAllTimersAsync();
  expect(await pending).toMatchObject({ processed: 1 });
  expect(queue.queue).toHaveLength(0);
});
it('analytics and achievement queues retain unread originals and new tasks', async () => {
  const service = new analytics.constructor();
  service.session = captureSession();
  storageService.save('analytics_events', [{ id: 'old' }], true);
  service.eventQueue = [{ id: 'new' }];
  blocked = 'u_account-1_analytics_events';
  service._saveEventQueue();
  expect(read(blocked)).toEqual([{ id: 'old' }]);
  blocked = null;
  storageService.flushPendingWrites();
  expect(storageService.get('analytics_events')).toEqual([{ id: 'old' }, { id: 'new' }]);
  const { unlockAchievement } = await import('@/services/api/domains/user.api.js');
  storageService.save('achievement_retry_v1', ['old'], true);
  uni.request.mockImplementation((o) => {
    o.success({ statusCode: 200, data: { code: -1, success: false } });
    return { abort() {} };
  });
  blocked = 'u_account-1_achievement_retry_v1';
  await unlockAchievement('new');
  expect(read(blocked)).toEqual(['old']);
  blocked = null;
  storageService.flushPendingWrites();
  expect(storageService.get('achievement_retry_v1')).toEqual(['old', 'new']);
});
it('ordinary failed offline receipt is never recorded as a successful send', async () => {
  const queue = new OfflineQueue();
  queue.enqueue({
    requestFn: async () => ({
      success: false,
      code: 400,
      message: 'fixture-private-response',
      data: { original: 'fixture-private-body' }
    }),
    requestData: { answer: 'kept' }
  });
  const pending = queue.processQueue();
  await vi.runAllTimersAsync();
  expect(await pending).toMatchObject({ processed: 0, errors: [{ error: '请求未确认成功' }] });
  expect(queue.queue[0]).toMatchObject({ retryCount: 1, requestData: { answer: 'kept' } });
});
it('createGoal actual call chain retains pending marker when response preflight becomes unreadable', async () => {
  uni.request.mockImplementation((o) => {
    blocked = '_enc_EXAM_SESSION_EPOCH';
    o.success({ statusCode: 200, data: { code: 0, data: [] } });
    blocked = null;
    return { abort() {} };
  });
  const manager = new learningGoalManager.constructor();
  const goal = manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 20 });
  await vi.advanceTimersByTimeAsync(0);
  expect(storageService.get('learning_goals')).toEqual([goal]);
  expect(storageService.get('learning_goals_pending_sync')).toBe(true);
});
