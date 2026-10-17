import { seedLegacyTask } from '../fixtures/legacy-queue.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia, storeToRefs } from 'pinia';
import { storageService } from '@/services/storageService.js';
import { captureSession, checkSession } from '@/services/auth-storage.js';
import { useProfileStore } from '@/stores/modules/profile.js';
import { useAuthStore } from '@/stores/modules/auth.js';
import { useReviewStore } from '@/stores/modules/review.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { learningRepository } from '@/services/learning/learning-repository.js';
import { intelligentPlanManager as plans } from '@/pages/plan/intelligent-plan-manager.js';
import { startPracticeMode, practiceModeManager } from '@/pages/practice-sub/utils/practice-mode-manager.js';
import { saveQuizProgress, loadQuizProgress, clearQuizProgress } from '@/composables/useQuizAutoSave.js';
import { OfflineQueue } from '@/utils/core/offline-queue.js';
import * as practiceApi from '@/services/api/domains/practice.api.js';
vi.mock('@/services/api/domains/practice.api.js', () => ({
  addMistake: vi.fn(),
  getMistakes: vi.fn(),
  removeMistake: vi.fn(),
  batchRemoveMistakes: vi.fn(),
  updateMistakeFields: vi.fn(),
  batchSyncMistakes: vi.fn(),
  browseQuestions: vi.fn(),
  getQuestionBankRandom: vi.fn(),
  getQuestionBankStats: vi.fn()
}));
const read = uni.getStorageSync.getMockImplementation();
let pinia, blocked;
const login = (n = 1) =>
  storageService.saveLoginSession({
    userId: `account-${n}`,
    token: `fixture-${n}`,
    userInfo: { id: `account-${n}`, nickname: '保留昵称' }
  });
const planOptions = {
  name: '原计划',
  goal: '学习',
  category: '数学',
  startDate: '2026-10-16',
  endDate: '2026-10-18',
  dailyDuration: 20,
  reminderTime: '18:00',
  dimensions: ['short']
};
const progress = (index) => ({
  currentIndex: index,
  seconds: 10,
  hasAnswered: false,
  answeredQuestions: [],
  questions: [{ id: 'q1' }, { id: 'q2' }]
});
function stores() {
  const profile = useProfileStore();
  const auth = useAuthStore();
  auth._setUserInfoRef(storeToRefs(profile).userInfo);
  auth.restoreUserInfo();
  return { profile, auth };
}
beforeEach(() => {
  blocked = false;
  uni.getStorageSync.mockImplementation((key) => {
    if (blocked && key === '_enc_EXAM_SESSION_EPOCH') throw new Error('fixture unavailable');
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
  delete uni.__profileStoreLogoutBound__;
  delete uni.__profileStoreRestoreBound__;
  delete uni.__profileStoreUserdataBound__;
  pinia = createPinia();
  setActivePinia(pinia);
  login();
  practiceModeManager._session = captureSession();
  for (const api of [practiceApi.getQuestionBankStats, practiceApi.browseQuestions, practiceApi.getQuestionBankRandom])
    api.mockReset().mockResolvedValue({ code: -1 });
  storageService.save(
    'v30_bank',
    [{ id: 'q1', question: '题目', type: '单选', difficulty: 2, category: '数学', options: ['A', 'B'], answer: 'A' }],
    true
  );
});
afterEach(() => {
  blocked = false;
  for (const store of pinia._s.values()) store.$dispose();
  clearQuizProgress();
  storageService.flushPendingWrites();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('writes-1: reminder continuation keeps original owner, normal create still works', () => {
  const first = plans.createMultiDimensionPlan(planOptions);
  expect(storageService.get('study_reminders')).toEqual([expect.objectContaining({ planId: first.id })]);
  const save = storageService.save.bind(storageService);
  vi.spyOn(storageService, 'save').mockImplementation((key, ...args) => {
    const result = save(key, ...args);
    if (key === 'study_plans') login(2);
    return result;
  });
  plans.createMultiDimensionPlan({ ...planOptions, name: '旧账户计划' });
  expect(storageService.get('study_reminders', [])).toEqual([]);
  expect(uni.getStorageSync('u_account-1_study_reminders')).toHaveLength(1);
});
it.each([1, 2])('writes-2: singleton starts fresh practice after logout/login account-%s', async (n) => {
  expect((await startPracticeMode('TIME_LIMITED')).questionCount).toBe(1);
  storageService._clearRevokedCredentials();
  login(n);
  storageService.save(
    'v30_bank',
    [{ id: 'new', question: '新题', type: '单选', difficulty: 2, category: '数学', options: ['A', 'B'], answer: 'A' }],
    true
  );
  expect((await startPracticeMode('TIME_LIMITED')).questions[0].id).toBe('new');
  expect(plans.createMultiDimensionPlan(planOptions)).toBeTruthy();
});
it.each([false, true])(
  'writes-2: previous practice await cannot overwrite a new operation (switch=%s)',
  async (switchAccount) => {
    practiceModeManager.initMode('TIME_LIMITED');
    let finish;
    vi.spyOn(practiceModeManager, 'generatePracticeQuestions').mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const old = practiceModeManager.startPracticeSession();
    if (switchAccount) login(2);
    storageService.save(
      'v30_bank',
      [{ id: 'new', question: '新题', type: '单选', difficulty: 2, options: ['A', 'B'], answer: 'A' }],
      true
    );
    await startPracticeMode('TIME_LIMITED');
    finish([{ id: 'old' }]);
    await expect(old).rejects.toMatchObject({ code: 'CONTEXT_CHANGED' });
    expect(storageService.get('current_practice_session').questions[0].id).toBe('new');
  }
);
it('writes-3/migrate-13-01: unavailable debounce retries original snapshot on flush', async () => {
  vi.useFakeTimers();
  const origin = captureSession();
  expect(saveQuizProgress(progress(0), true)).toBe(true);
  saveQuizProgress(progress(1), false, null, origin);
  blocked = true;
  await vi.advanceTimersByTimeAsync(500);
  blocked = false;
  expect(checkSession(origin)).toBe('current');
  storageService.flushPendingWrites();
  expect(loadQuizProgress().currentIndex).toBe(1);
});
it('writes-3: unavailable immediate save also survives, changed session cannot replay', () => {
  const origin = captureSession();
  blocked = true;
  saveQuizProgress(progress(1), true, null, origin);
  blocked = false;
  storageService.flushPendingWrites();
  expect(loadQuizProgress()?.currentIndex).toBe(1);
  saveQuizProgress(progress(0), false, null, origin);
  login(2);
  storageService.flushPendingWrites();
  expect(loadQuizProgress()).toBeNull();
});
it.each([0, 2])(
  'inflight-01/migrate-13-02: unavailable network rejection preserves retry=%s then succeeds',
  async (retryCount) => {
    vi.useFakeTimers();
    const queue = new OfflineQueue();
    queue.isOnline = false;
    let reject;
    const request = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_resolve, r) => {
            reject = r;
          })
      )
      .mockResolvedValue(undefined);
    seedLegacyTask(queue, { requestFn: request, requestData: { fixture: true } });
    queue.queue[0].retryCount = retryCount;
    queue._saveToStorage(queue.queue[0]);
    const before = structuredClone(uni.getStorageSync('EXAM_OFFLINE_QUEUE'));
    queue.isOnline = true;
    const work = queue.processQueue();
    blocked = true;
    reject(new Error('network fixture'));
    await vi.runAllTimersAsync();
    await work;
    expect(queue.processing).toBe(false);
    expect(queue.queue).toHaveLength(1);
    expect(queue.queue[0].retryCount).toBe(retryCount);
    expect(uni.getStorageSync('EXAM_OFFLINE_QUEUE')).toEqual(before);
    blocked = false;
    const retry = queue.processQueue();
    await vi.runAllTimersAsync();
    await retry;
    expect(queue.queue).toEqual([]);
    expect(request).toHaveBeenCalledTimes(2);
  }
);
it.each([
  ['fetchQuestionBankStats', 'getQuestionBankStats', { total: 3, categories: [] }],
  ['browseQuestions', 'browseQuestions', { list: [{ id: 'q1' }], total: 1 }],
  ['fetchQuestionBankRandom', 'getQuestionBankRandom', [{ id: 'q1' }]]
])('inflight-02: %s always settles its own loading and works after recovery', async (method, api, data) => {
  const store = useReviewStore();
  let finish;
  practiceApi[api].mockImplementationOnce(
    () =>
      new Promise((r) => {
        finish = r;
      })
  );
  const before = JSON.stringify(store.questionBankStats);
  const pending = store[method]();
  expect(store.loading).toBe(true);
  blocked = true;
  finish({ code: 0, data });
  await expect(pending).rejects.toMatchObject({ code: 'SESSION_UNAVAILABLE' });
  expect(store.loading).toBe(false);
  expect(JSON.stringify(store.questionBankStats)).toBe(before);
  blocked = false;
  practiceApi[api].mockResolvedValue({ code: 0, data });
  expect((await store[method]()).success).toBe(true);
  expect(store.loading).toBe(false);
});
it('inflight-02: older finally leaves overlapping new review request busy', async () => {
  const store = useReviewStore();
  let a, b;
  practiceApi.getQuestionBankStats
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          a = r;
        })
    )
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          b = r;
        })
    );
  const first = store.fetchQuestionBankStats(),
    second = store.fetchQuestionBankStats();
  a({ code: 0, data: { total: 1 } });
  await first;
  expect(store.loading).toBe(true);
  b({ code: 0, data: { total: 2 } });
  await second;
  expect(store.loading).toBe(false);
});
it.each([false, true])(
  'regress-01/order-02: renewed token allows profile, practice, plan, review (locks=%s)',
  async (locks) => {
    const { profile, auth } = stores();
    const origin = captureSession();
    if (locks) vi.stubGlobal('navigator', { locks: { request: (_n, _o, fn) => Promise.resolve().then(fn) } });
    expect(await auth.setToken('fixture-renewed')).toBe(true);
    expect(checkSession(origin)).toBe('current');
    expect(await profile.updateUserInfo({ name: '保存修改' })).toBe(true);
    expect(await profile.updateUserInfo({ avatar: 'saved' })).toBe(true);
    expect(storageService.get('userInfo')).toMatchObject({ nickname: '保留昵称', name: '保存修改', avatar: 'saved' });
    expect((await startPracticeMode('TIME_LIMITED')).questionCount).toBe(1);
    const plan = plans.createMultiDimensionPlan(planOptions);
    expect(plans.adjustPlan(plan.id, 50)?.progress).toBe(50);
    expect((await useReviewStore().fetchQuestionBankStats()).success).toBe(true);
  }
);
it('regress-02: async legacy upgrade restores complete profile and login after commit', async () => {
  uni.clearStorageSync();
  uni.setStorageSync('EXAM_USER_ID', 'account-1');
  uni.setStorageSync('EXAM_TOKEN', 'fixture-1');
  uni.setStorageSync('userInfo', { id: 'account-1', nickname: '保留昵称' });
  const { profile, auth } = stores();
  const original = captureSession();
  vi.stubGlobal('navigator', { locks: { request: (_n, _o, fn) => Promise.resolve().then(fn) } });
  expect((await auth.silentLogin()).success).toBe(true);
  await new Promise((r) => setTimeout(r, 0));
  expect(checkSession(original)).toBe('current');
  expect(profile.userInfo?.nickname).toBe('保留昵称');
  expect(auth.isLogin).toBe(true);
  expect(await profile.updateUserInfo({ name: '升级后修改' })).toBe(true);
  expect(storageService.get('userInfo')).toMatchObject({ nickname: '保留昵称', name: '升级后修改' });
});
it('regress-03: unavailable permits local cancellation and readonly notification/compute contexts', () => {
  const store = useConversationLearningStore();
  store.start('12 + 8');
  const context = store.notificationContext(),
    compute = store.computeReferenceContext();
  blocked = true;
  expect(() => learningRepository.cancelPreview()).not.toThrow();
  expect(() => store.cancelHistory()).not.toThrow();
  expect(() => store.notificationContext()).not.toThrow();
  expect(() => store.computeReferenceContext()).not.toThrow();
  expect(store.notificationContext()).toBe(context);
  expect(store.computeReferenceContext()).toBe(compute);
  expect(() =>
    store.commit('profile.set', { field: 'foundation', value: 'blocked', source: 'self_report', scope: 'fixture' })
  ).toThrow();
  blocked = false;
  expect(() => store.start('20 + 8')).not.toThrow();
});
it('regress-04: first-login repeated input does not enumerate all storage keys', () => {
  const info = vi.spyOn(uni, 'getStorageInfoSync');
  info.mockClear();
  const store = useConversationLearningStore();
  store.start('12 + 8');
  info.mockClear();
  for (let i = 0; i < 20; i++) store.recordContext();
  expect(info).not.toHaveBeenCalled();
});
it('order-03: peer logout updates auth and profile, unavailable preserves login with status', () => {
  const { profile, auth } = stores();
  expect(auth.isLogin).toBe(true);
  blocked = true;
  window.dispatchEvent(
    new StorageEvent('storage', { key: '_enc_EXAM_SESSION_EPOCH', oldValue: 'fixture-old', newValue: 'fixture-new' })
  );
  expect(auth.isLogin).toBe(true);
  expect(auth.sessionStatus).toBe('unavailable');
  expect(profile.userInfo).toBeTruthy();
  blocked = false;
  // Peer mutates shared storage without notifying this execution context.
  uni.setStorageSync('EXAM_SESSION_REVOCATION', 'fixture-peer-logout');
  uni.removeStorageSync('_enc_EXAM_SESSION_EPOCH');
  expect(auth.isLogin).toBe(true);
  window.dispatchEvent(
    new StorageEvent('storage', { key: '_enc_EXAM_SESSION_EPOCH', oldValue: 'fixture-old', newValue: null })
  );
  expect(auth.isLogin).toBe(false);
  expect(auth.token).toBe('');
  expect(profile.userInfo).toBeNull();
});
it.each([0, false, ''])('migrate-13-03: existing account %s survives guest migration with source retained', (value) => {
  storageService.save('guest_value', value, true);
  storageService._clearRevokedCredentials();
  storageService.save('guest_value', 'guest input', true);
  login();
  storageService.migrateUserKeys();
  expect(uni.getStorageSync('u_account-1_guest_value')).toBe(value);
  expect(uni.getStorageSync('guest_value')).toBe('guest input');
});
it('regress-03: readonly notification controller can initialize while unavailable', async () => {
  const { createLearningNotifications } = await import('@/services/learning/learning-notifications.js');
  const store = useConversationLearningStore();
  store.start('12 + 8');
  blocked = true;
  let observer;
  expect(() => {
    observer = createLearningNotifications(store, () => {});
  }).not.toThrow();
  if (observer) {
    await observer.refresh();
    observer.dispose();
  }
});
it('inflight-02: typed temporary response preserves review cache without a storage fault', async () => {
  const store = useReviewStore();
  store.questionBankStats = { total: 8, categories: [] };
  practiceApi.getQuestionBankStats.mockRejectedValue(
    Object.assign(new Error('fixture'), { code: 'SESSION_UNAVAILABLE' })
  );
  await expect(store.fetchQuestionBankStats()).rejects.toMatchObject({ code: 'SESSION_UNAVAILABLE' });
  expect(store.questionBankStats.total).toBe(8);
  expect(store.loading).toBe(false);
});
it('regress-01/order-02: queued stale snapshot cannot overwrite a completed renewal', async () => {
  let release;
  vi.stubGlobal('navigator', {
    locks: {
      request: (_n, _o, fn) =>
        new Promise((resolve) => {
          release = () => resolve(fn());
        })
    }
  });
  const session = captureSession();
  const queued = storageService.save('userInfo', { id: 'account-1', nickname: 'queued' }, true, session);
  vi.stubGlobal('navigator', {});
  expect(storageService.save('EXAM_TOKEN', 'fixture-renewed', true, session)).toBe(true);
  release();
  expect(await queued).toBe(false);
  expect(storageService.get('userInfo').nickname).toBe('保留昵称');
  expect(storageService.save('userInfo', { id: 'account-1', nickname: 'new action' }, true, session)).toBe(true);
});

it('temporary generation failure preserves retry count, input and clears busy until recovery', async () => {
  const { aiGenerationMixin } = await import('@/pages/practice-sub/composables/ai-generation-mixin.js');
  vi.useFakeTimers();
  const vm = {
    ...aiGenerationMixin.methods,
    generationSession: captureSession(),
    isLooping: true,
    isPaused: false,
    isRequestInFlight: false,
    generatedCount: 0,
    totalQuestionsLimit: 20,
    _consecutiveFailures: 2,
    batchQuestionCount: 1,
    fullFileContent: 'fixture material',
    readOffset: 0,
    chunkSize: 100,
    _sanitizeAIInput: (s) => s,
    _processAIResponse: vi.fn(),
    _handleGenerationError: vi.fn()
  };
  blocked = true;
  await vm.generateNextBatch();
  expect(vm._consecutiveFailures).toBe(2);
  expect(vm.fullFileContent).toBe('fixture material');
  expect(vm.isRequestInFlight).toBe(false);
  expect(vm._processAIResponse).not.toHaveBeenCalled();
  blocked = false;
  await vi.advanceTimersByTimeAsync(1500);
  expect(vm._processAIResponse).toHaveBeenCalledTimes(1);
  vm.isLooping = false;
  vi.clearAllTimers();
});

it('generation continuation keeps its operation binding and cannot clear a newer busy flag', async () => {
  const { aiGenerationMixin } = await import('@/pages/practice-sub/composables/ai-generation-mixin.js');
  const vm = {
    ...aiGenerationMixin.methods,
    generationSession: captureSession(),
    isLooping: true,
    isPaused: false,
    isRequestInFlight: false,
    generatedCount: 0,
    totalQuestionsLimit: 20,
    _consecutiveFailures: 0,
    batchQuestionCount: 1,
    fullFileContent: 'fixture material',
    readOffset: 0,
    chunkSize: 100,
    _sanitizeAIInput: (s) => s,
    _processAIResponse: vi.fn(),
    _handleGenerationError: vi.fn()
  };
  const old = vm.generateNextBatch();
  vm.generationSession = captureSession();
  vm.isRequestInFlight = true;
  await old;
  expect(vm._processAIResponse).not.toHaveBeenCalled();
  expect(vm.isRequestInFlight).toBe(true);
});
it('regress-02: migrated legacy binding stays retryable during a marker fault, relogin revokes it', () => {
  uni.clearStorageSync();
  uni.setStorageSync('EXAM_USER_ID', 'account-1');
  uni.setStorageSync('EXAM_TOKEN', 'fixture-1');
  const original = captureSession();
  storageService.getSessionEpoch();
  const currentRead = uni.getStorageSync.getMockImplementation();
  uni.getStorageSync.mockImplementation((key) => {
    if (key === 'EXAM_SESSION_ENABLED') throw new Error('fixture marker fault');
    return currentRead(key);
  });
  expect(checkSession(original)).toBe('unavailable');
  uni.getStorageSync.mockImplementation(currentRead);
  expect(checkSession(original)).toBe('current');
  login();
  expect(checkSession(original)).toBe('changed');
});
it('legacy string epoch and profile survive a failed locked login without becoming mixed identity', async () => {
  const { obfuscate } = await import('@/utils/crypto/cipher.js');
  uni.clearStorageSync();
  uni.setStorageSync('EXAM_USER_ID', 'account-1');
  uni.setStorageSync('EXAM_TOKEN', 'fixture-1');
  uni.setStorageSync('userInfo', { id: 'account-1', nickname: '保留昵称' });
  uni.setStorageSync('_enc_EXAM_SESSION_EPOCH', obfuscate('fixture-legacy-epoch'));
  const original = captureSession();
  vi.stubGlobal('navigator', { locks: { request: (_n, _o, fn) => Promise.resolve().then(fn) } });
  vi.spyOn(storageService, '_saveValue').mockReturnValueOnce(false);
  await expect(login(2)).rejects.toThrow();
  expect(checkSession(original)).toBe('current');
  expect(storageService.get('userInfo').nickname).toBe('保留昵称');
});
