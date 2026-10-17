import { seedLegacyTask } from '../fixtures/legacy-queue.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { readFileSync } from 'node:fs';
import { storageService } from '@/services/storageService.js';
import { captureSession, checkSession, getUserId, getToken, isSessionUnavailable } from '@/services/auth-storage.js';
import { useProfileStore } from '@/stores/modules/profile.js';
import { useStatsStore } from '@/stores/modules/stats.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { OfflineQueue } from '@/utils/core/offline-queue.js';
import { request, normalizeError } from '@/services/api/domains/_request-core.js';
import { recordAnswerToAnalytics } from '@/pages/practice-sub/quiz-analytics-recorder.js';
import { tokenRefreshPlugin } from '@/utils/auth/token-refresh-plugin.js';
import * as practiceApi from '@/services/api/domains/practice.api.js';
import * as statsApi from '@/services/api/domains/stats.api.js';
import { recordQuizLearningAttempt } from '@/services/learning/quiz-learning-bridge.js';
import { saveOfflineAnswer } from '@/pages/practice-sub/offline-cache.js';
vi.mock('@/services/learning/quiz-learning-bridge.js', () => ({ recordQuizLearningAttempt: vi.fn() }));
vi.mock('@/pages/practice-sub/offline-cache.js', () => ({ saveOfflineAnswer: vi.fn() }));
vi.mock('@/services/api/domains/practice.api.js', () => ({
  addMistake: vi.fn(),
  getMistakes: vi.fn(),
  removeMistake: vi.fn(),
  batchRemoveMistakes: vi.fn(),
  updateMistakeFields: vi.fn(),
  batchSyncMistakes: vi.fn(),
  submitAnswer: vi.fn()
}));
vi.mock('@/services/api/domains/stats.api.js', () => ({
  getStatsOverview: vi.fn(),
  getDailyStats: vi.fn(),
  getStudyTrend: vi.fn(),
  getRankInfo: vi.fn(),
  recordStudyTime: vi.fn(),
  updateStreak: vi.fn()
}));
const read = uni.getStorageSync.getMockImplementation();
let blocked, pinia;
const login = (n = 1) =>
  storageService.saveLoginSession({
    userId: `account-${n}`,
    token: `fixture-${n}`,
    userInfo: { id: `account-${n}`, nickname: 'original' }
  });
const renew = () => storageService.save('EXAM_TOKEN', 'renewed-fixture', true);
const options = () => ({ session: captureSession(), skipNetworkCheck: true, skipRateLimit: true, skipCache: true });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
beforeEach(() => {
  vi.useFakeTimers();
  blocked = false;
  uni.getStorageSync.mockImplementation((key) => {
    if (blocked && key === '_enc_EXAM_SESSION_EPOCH') throw Error('fixture unavailable');
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
  storageService._mistakeBookMutex = Promise.resolve();
  practiceApi.removeMistake.mockResolvedValue({ code: 0, data: { ok: true, deleted: 1 } });
  practiceApi.batchRemoveMistakes.mockResolvedValue({ code: 0, data: { ok: true, deleted: 1 } });
  saveOfflineAnswer.mockResolvedValue(true);
  recordQuizLearningAttempt.mockResolvedValue({});
});
afterEach(() => {
  blocked = false;
  tokenRefreshPlugin.stopPreCheckTimer();
  for (const store of pinia._s.values()) store.$dispose();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it.each([false, true])('WRITES-01/inflight-14-02: response survives renewal=%s', async (renewal) => {
  let respond;
  uni.request.mockImplementation((o) => {
    respond = o.success;
    return { abort() {} };
  });
  const origin = captureSession();
  const pending = request('/round5', { action: 'submit' }, options()).catch((e) => e);
  if (renewal) await renew();
  expect(checkSession(origin)).toBe('current');
  respond({ statusCode: 200, data: { code: 0, data: { saved: true } } });
  expect(await pending).toMatchObject({ code: 0, data: { saved: true } });
});
it('inflight-14-02: retry after renewal sends latest credential', async () => {
  let sends = 0;
  const headers = [];
  uni.request.mockImplementation((o) => {
    headers.push(o.header);
    if (++sends === 1) o.fail({ errMsg: 'network failure' });
    else o.success({ statusCode: 200, data: { code: 0 } });
    return { abort() {} };
  });
  const pending = request('/round5-retry', { action: 'submit' }, { ...options(), maxRetries: 1 }).catch((e) => e);
  await renew();
  await vi.advanceTimersByTimeAsync(5000);
  expect((await pending).code).toBe(0);
  expect(sends).toBe(2);
  expect(JSON.stringify(headers[1])).toContain('renewed-fixture');
});
it('WRITES-03/inflight-14-01: typed unavailable response preserves offline retry and body', async () => {
  const queue = new OfflineQueue();
  queue.isOnline = false;
  let respond;
  uni.request.mockImplementation((o) => {
    respond = o.success;
    return { abort() {} };
  });
  seedLegacyTask(queue, {
    requestFn: () =>
      request('/round5-queue', { action: 'submit' }, options()).catch((error) => {
        blocked = false;
        throw error;
      }),
    requestData: { answer: 'A' }
  });
  queue.queue[0].retryCount = 2;
  queue._saveToStorage(queue.queue[0]);
  const before = structuredClone(uni.getStorageSync('EXAM_OFFLINE_QUEUE'));
  queue.isOnline = true;
  const pending = queue.processQueue();
  blocked = true;
  respond({ statusCode: 200, data: { code: 0 } });
  await vi.advanceTimersByTimeAsync(2000);
  await pending;
  expect(queue.queue).toHaveLength(1);
  expect(queue.queue[0].retryCount).toBe(2);
  expect(uni.getStorageSync('EXAM_OFFLINE_QUEUE')).toEqual(before);
});
it('WRITES-03: redacted and domain normalization preserve unavailable type', () => {
  for (const error of [{ code: 'SESSION_UNAVAILABLE' }, { errorCode: 'SESSION_UNAVAILABLE' }])
    for (const redact of [false, true])
      expect(isSessionUnavailable(normalizeError(error, 'fixture', { redact }))).toBe(true);
});
it.each([false, true])('inflight-14-03/MIGRATE-14-02: queued mistake removal survives renewal=%s', async (renewal) => {
  storageService.save('mistake_book', [{ id: 'm1' }], true);
  const gate = deferred();
  storageService._mistakeBookMutex = gate.promise;
  const pending = storageService.removeMistake('m1');
  if (renewal) await renew();
  gate.resolve();
  expect((await pending).success).toBe(true);
  expect(storageService.get('mistake_book')).toEqual([]);
});
it('MIGRATE-14-03: unavailable queued mistake retains typed task and resumes', async () => {
  storageService.save('mistake_book', [{ id: 'm1' }, { id: 'm2' }], true);
  const gate = deferred();
  storageService._mistakeBookMutex = gate.promise;
  const pending = storageService.removeMistake('m1').catch((e) => e);
  blocked = true;
  gate.resolve();
  expect(isSessionUnavailable(await pending)).toBe(true);
  blocked = false;
  const next = storageService.removeMistake('m2');
  await vi.advanceTimersByTimeAsync(1);
  expect(practiceApi.removeMistake).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1000);
  await next;
  expect(practiceApi.removeMistake.mock.calls.map((args) => args[1])).toEqual(['m1', 'm2']);
  expect(storageService.get('mistake_book')).toEqual([]);
});
it.each([false, true])(
  'inflight-14-04/regress-01: explicit answer saves and syncs after renewal=%s',
  async (renewal) => {
    const gate = deferred();
    recordQuizLearningAttempt.mockReturnValueOnce(gate.promise);
    const pending = recordAnswerToAnalytics({
      currentQuestion: { id: 'q1', question: 'Q', answer: 'A' },
      isCorrect: true,
      timeSpent: 1000,
      userChoice: 0,
      questionTimeLimit: 60,
      getOptionLabel: () => 'A',
      sessionId: 'quiz_round5_fixture',
      attemptId: 'attempt_round5_fixture'
    });
    if (renewal) await renew();
    gate.resolve();
    expect(await pending).not.toBeNull();
    expect(saveOfflineAnswer).toHaveBeenCalled();
    expect(practiceApi.submitAnswer).toHaveBeenCalled();
  }
);
it('regress-02: stats keeps four projections and accepts in-flight response after renewal', async () => {
  const store = useStatsStore();
  statsApi.getStatsOverview.mockResolvedValueOnce({ code: 0, data: { n: 1 } });
  await store.fetchOverview();
  store.dailyStats = [{ n: 2 }];
  store.trend = { n: 3 };
  store.rankInfo = { n: 4 };
  const gate = deferred();
  statsApi.getStatsOverview.mockReturnValueOnce(gate.promise);
  const pending = store.fetchOverview(true);
  await renew();
  gate.resolve({ code: 0, data: { n: 5 } });
  expect(await pending).toEqual({ n: 5 });
  expect(store.dailyStats).toEqual([{ n: 2 }]);
  expect(store.trend).toEqual({ n: 3 });
  expect(store.rankInfo).toEqual({ n: 4 });
});
it.each(['locateConversation', 'selectTraining'])(
  'regress-03: %s reads trusted local projection while unavailable',
  (action) => {
    const store = useConversationLearningStore();
    store.start('12 + 8');
    const id = store.state.conversations[0].id;
    blocked = true;
    expect(() => store[action](action === 'locateConversation' ? id : null)).not.toThrow();
    blocked = false;
    login(2);
    expect(store.state.owner).toBe('account-2');
    expect(store.state.conversations).toEqual([]);
  }
);
it('regress-04: queued disjoint profile patches reject stale generation and retry explicitly', async () => {
  const store = useProfileStore();
  await store.setUserInfo({ id: 'account-1', nickname: 'original' });
  const writes = [];
  vi.stubGlobal('navigator', {
    locks: { request: (_name, _opts, write) => new Promise((resolve) => writes.push(() => resolve(write()))) }
  });
  const first = store.updateUserInfo({ nickname: 'new' }),
    second = store.updateUserInfo({ avatar: 'avatar' });
  writes.shift()();
  await first;
  writes.shift()();
  expect(await second).toBe(false);
  vi.stubGlobal('navigator', {});
  expect(await store.updateUserInfo({ avatar: 'avatar' })).toBe(true);
  expect(storageService.get('userInfo')).toMatchObject({ id: 'account-1', nickname: 'new', avatar: 'avatar' });
});
it.each([1, 2])('order-5-01: post-login incremental patch preserves latest account-%s fields', async (n) => {
  const store = useProfileStore();
  await store.setUserInfo({ id: 'account-1', nickname: 'original' });
  await login(n);
  window.dispatchEvent(new StorageEvent('storage', { key: '__exam_storage__:_enc_EXAM_SESSION_EPOCH' }));
  expect(await store.updateUserInfo({ avatar: 'avatar' })).toBe(true);
  expect(storageService.get('userInfo')).toMatchObject({ id: `account-${n}`, nickname: 'original', avatar: 'avatar' });
});
it('regress-05: precheck retries after unavailable and stops after generation change', async () => {
  const refresh = vi.spyOn(tokenRefreshPlugin, 'refreshToken').mockResolvedValue('fixture');
  vi.spyOn(tokenRefreshPlugin, 'isTokenExpiringSoon').mockReturnValue(true);
  tokenRefreshPlugin.startPreCheckTimer();
  blocked = true;
  await vi.advanceTimersByTimeAsync(60000);
  expect(refresh).not.toHaveBeenCalled();
  blocked = false;
  await vi.advanceTimersByTimeAsync(60000);
  expect(refresh).toHaveBeenCalledTimes(1);
  login();
  await vi.advanceTimersByTimeAsync(60000);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(tokenRefreshPlugin._preCheckTimer).toBeNull();
});
it('MIGRATE-14-01: old migration never removes post-logout guest data', () => {
  storageService._clearRevokedCredentials();
  storageService.save('study_stats', { old: 1 }, true);
  login();
  let reads = 0;
  uni.getStorageSync.mockImplementation((key) => {
    const value = read(key);
    if (key === 'u_account-1_study_stats' && ++reads === 2) {
      storageService._clearRevokedCredentials();
      storageService.save('study_stats', { new: 2 }, true);
    }
    return value;
  });
  storageService.migrateUserKeys();
  uni.getStorageSync.mockImplementation(read);
  expect(uni.getStorageSync('study_stats')).toEqual({ new: 2 });
  login(2);
  storageService.migrateUserKeys();
  expect(storageService.get('study_stats')).toEqual({ new: 2 });
});
it('MIGRATE-14-05: legal empty guest value does not block later keys', () => {
  storageService._clearRevokedCredentials();
  storageService.save('empty_fixture', '', true);
  storageService.save('study_stats', { n: 7 }, true);
  login();
  expect(storageService.migrateUserKeys()).toBe(2);
  expect(storageService.get('study_stats')).toEqual({ n: 7 });
  expect(uni.getStorageInfoSync().keys).toContain('u_account-1_empty_fixture');
});
it.each(['normal', 'renew', 'relogin'])(
  'WRITES-02: actual bulk confirmation binds original session (%s)',
  async (mode) => {
    let dialog;
    const rows = { value: [{ id: 'm1' }] },
      busy = { value: false },
      owner = { value: 'account-1' };
    storageService.save('mistake_book', rows.value, true);
    const source = readFileSync('src/pages/mistake/index.vue', 'utf8');
    const body = source.slice(source.indexOf('function clearAllMistakes()'), source.indexOf('// 切换刷题/背诵模式'));
    const prompt = new Function(
      'captureSession',
      'checkSession',
      'getUserId',
      'storageService',
      'mistakes',
      'isClearing',
      'loadedOwnerId',
      'modal',
      'toast',
      't',
      body + ';return clearAllMistakes;'
    )(
      captureSession,
      checkSession,
      getUserId,
      storageService,
      rows,
      busy,
      owner,
      {
        show: (d) => {
          dialog = d;
        }
      },
      { info() {}, success() {} },
      (v) => v
    );
    prompt();
    if (mode === 'renew') await renew();
    if (mode === 'relogin') login();
    await dialog.success({ confirm: true });
    expect(practiceApi.batchRemoveMistakes.mock.calls.length).toBe(mode === 'relogin' ? 0 : 1);
    expect(storageService.get('mistake_book')).toHaveLength(mode === 'relogin' ? 1 : 0);
  }
);

it('WRITES-01: question bank page binding survives renewal and rejects relogin', async () => {
  const source = readFileSync('src/pages/practice-sub/question-bank.vue', 'utf8');
  const body = source.slice(source.indexOf('const pageOwner ='), source.indexOf('const _themeHandler'));
  const current = new Function(
    'captureSession',
    'checkSession',
    'getUserId',
    'getToken',
    body + ';return ownerMatches;'
  )(captureSession, checkSession, getUserId, getToken);
  expect(current()).toBe(true);
  await renew();
  expect(current()).toBe(true);
  login();
  expect(current()).toBe(false);
});
it.each(['renew', 'relogin'])('WRITES-02: profile logout confirmation uses origin (%s)', async (mode) => {
  const { default: Page } = await import('@/pages/profile/index.vue');
  const context = { dialog: {}, showDialog: false, userStore: { logout: vi.fn() } };
  Page.methods.handleLogout.call(context);
  if (mode === 'renew') await renew();
  else login();
  Page.methods.confirmDialog.call(context);
  expect(context.userStore.logout).toHaveBeenCalledTimes(mode === 'renew' ? 1 : 0);
});

it('regress-01: real learning and offline originals both persist through renewal', async () => {
  const bridge = await vi.importActual('@/services/learning/quiz-learning-bridge.js');
  const offline = await vi.importActual('@/pages/practice-sub/offline-cache.js');
  const { learningWriteLease } = await import('@/services/learning/learning-write-lease.js');
  const { learningRepository } = await import('@/services/learning/learning-repository.js');
  const gate = deferred();
  vi.spyOn(learningWriteLease, 'waitUntilWritable').mockReturnValueOnce(gate.promise);
  recordQuizLearningAttempt.mockImplementationOnce(bridge.recordQuizLearningAttempt);
  saveOfflineAnswer.mockImplementation(offline.saveOfflineAnswer);
  const pending = recordAnswerToAnalytics({
    currentQuestion: {
      id: 'q-real',
      question: '12 + 8 = ?',
      options: ['20', '18'],
      answer: 'A',
      type: '单选',
      category: '数学'
    },
    isCorrect: true,
    timeSpent: 1000,
    userChoice: 0,
    questionTimeLimit: 60,
    getOptionLabel: () => 'A',
    sessionId: 'quiz_real_round5',
    attemptId: 'attempt_real_round5'
  });
  await renew();
  gate.resolve();
  expect(await pending).not.toBeNull();
  expect(learningRepository.read().attempts).toEqual([expect.objectContaining({ answer: 'A' })]);
  expect(storageService.get('EXAM_OFFLINE_ANSWERS')).toEqual([
    expect.objectContaining({ attemptId: 'attempt_real_round5', userAnswer: 'A' })
  ]);
});
it('regress-04: queued profile patch rejects a changed generation then retries after renewal', async () => {
  const store = useProfileStore();
  await store.setUserInfo({ id: 'account-1', nickname: 'kept' });
  const writes = [];
  vi.stubGlobal('navigator', {
    locks: { request: (_n, _o, write) => new Promise((resolve) => writes.push(() => resolve(write()))) }
  });
  const pending = store.updateUserInfo({ avatar: 'new' });
  vi.stubGlobal('navigator', {});
  await renew();
  writes.shift()();
  expect(await pending).toBe(false);
  expect(await store.updateUserInfo({ avatar: 'new' })).toBe(true);
  expect(storageService.get('userInfo')).toMatchObject({ id: 'account-1', nickname: 'kept', avatar: 'new' });
});
it('MIGRATE-14-03: unavailable preflight retains frozen add body and drops revoked retry', async () => {
  const original = { id: 'fixture', question: 'original' };
  const gate = deferred();
  storageService._mistakeBookMutex = gate.promise;
  const pending = storageService.addMistake(original).catch((e) => e);
  original.question = 'changed';
  blocked = true;
  gate.resolve();
  expect(isSessionUnavailable(await pending)).toBe(true);
  blocked = false;
  login(2);
  await vi.advanceTimersByTimeAsync(1000);
  expect(practiceApi.addMistake).not.toHaveBeenCalled();
  expect(storageService.get('mistake_book', [])).toEqual([]);
});
it('regress-05: unavailable credential read after preflight retries next tick', async () => {
  const refresh = vi.spyOn(tokenRefreshPlugin, 'refreshToken').mockResolvedValue('fixture');
  vi.spyOn(tokenRefreshPlugin, 'isTokenExpiringSoon')
    .mockImplementationOnce(() => {
      throw Object.assign(new Error('fixture unavailable'), { code: 'SESSION_UNAVAILABLE' });
    })
    .mockReturnValue(true);
  tokenRefreshPlugin.startPreCheckTimer();
  await vi.advanceTimersByTimeAsync(60000);
  expect(refresh).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(60000);
  expect(refresh).toHaveBeenCalledTimes(1);
});
