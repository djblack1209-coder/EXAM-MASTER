import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia, storeToRefs } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import { spawnSync } from 'node:child_process';
import { storageService } from '@/services/storageService.js';
import { captureSession, checkSession, sessionUnavailable, readSessionSnapshot } from '@/services/auth-storage.js';
import { useProfileStore } from '@/stores/modules/profile.js';
import { useAuthStore } from '@/stores/modules/auth.js';
import timer from '@/pages/practice-sub/question-timer.js';
import { swipeGestureManager as swipe } from '@/pages/practice-sub/swipe-gesture.js';
import { request } from '@/services/api/domains/_request-core.js';
import { clearQuizProgress } from '@/composables/useQuizAutoSave.js';
import App from '@/App.vue';
import { useUserStore } from '@/stores/modules/user.js';
import MistakeReport from '@/pages/mistake/MistakeReport.vue';
const canvas = vi.hoisted(() => ({ image: vi.fn() }));
vi.mock('@/pages/mistake/canvas-report.js', () => ({
  getCanvasTheme: () => ({}),
  drawStyledCard: vi.fn(),
  drawWrappedText: vi.fn(),
  drawDivider: vi.fn(),
  canvasToImage: canvas.image,
  drawLabel: vi.fn(),
  drawReportBackground: vi.fn()
}));
const read = uni.getStorageSync.getMockImplementation();
let blocked, stores;
const login = (n = 1) =>
  storageService.saveLoginSession({
    userId: `account-${n}`,
    token: `fixture-${n}`,
    userInfo: { id: `account-${n}`, nickName: `name-${n}` }
  });
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
beforeEach(() => {
  blocked = null;
  stores = [];
  uni.getStorageSync.mockImplementation((key) => {
    if (key === blocked) throw sessionUnavailable();
    return read(key);
  });
  uni.clearStorageSync();
  login();
  setActivePinia(createPinia());
  timer.stop();
  timer.isInitialized = false;
  swipe.isInitialized = false;
});
afterEach(() => {
  blocked = null;
  stores.forEach((s) => s.$dispose());
  timer.stop();
  storageService.flushPendingWrites();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
it.each(['timer', 'swipe'])(
  'writes-09-03: %s new settings action binds current account and returns save receipt',
  async (kind) => {
    const manager = kind === 'timer' ? timer : swipe,
      key = kind === 'timer' ? 'question_timer_settings' : 'swipe_gesture_settings';
    manager.init();
    login(2);
    storageService.save(key, { enabled: false, retained: 'new-account' }, true, captureSession());
    expect(await manager.updateSettings({ enabled: true })).toBe(true);
    expect(storageService.get(key)).toMatchObject({ enabled: true, retained: 'new-account' });
  }
);
it('writes-09-02: failed swipe initialization retries saved settings before exposing or saving defaults', () => {
  storageService.save('swipe_gesture_settings', { enabled: false, minSwipeDistance: 91 }, true);
  blocked = 'u_account-1_swipe_gesture_settings';
  expect(() => swipe.getSettings()).toThrow();
  expect(swipe.isInitialized).toBe(false);
  expect(() => swipe.updateSettings({ maxSwipeTime: 401 })).toThrow();
  blocked = null;
  expect(swipe.getSettings()).toMatchObject({ enabled: false, minSwipeDistance: 91 });
});
it('regress-09-01: new incremental profile action recovers after initial identity read failure', async () => {
  blocked = '_enc_EXAM_SESSION_EPOCH';
  const profile = useProfileStore();
  stores.push(profile);
  blocked = null;
  expect(await profile.updateUserInfo({ avatar: 'new.png' })).toBe(true);
  expect(profile.userInfo).toMatchObject({ id: 'account-1', nickName: 'name-1', avatar: 'new.png' });
});
it.each(['registration', 'renewal'])(
  'order-09-01: %s intermediate generation preserves binding and projections',
  async (kind) => {
    const auth = useAuthStore(),
      profile = useProfileStore();
    stores.push(auth, profile);
    auth._setUserInfoRef(storeToRefs(profile).userInfo);
    auth.restoreUserInfo();
    profile.userInfo = storageService.get('userInfo');
    auth.syncLoginStatus();
    const origin = captureSession();
    let during;
    const set = uni.setStorageSync.getMockImplementation();
    vi.spyOn(uni, 'setStorageSync').mockImplementation((key, value) => {
      const result = set(key, value);
      if (key === '_enc_EXAM_SESSION_EPOCH') {
        window.dispatchEvent(
          new StorageEvent('storage', { key: '__exam_storage__:_enc_EXAM_SESSION_EPOCH', newValue: 'intermediate' })
        );
        during = { status: checkSession(origin), info: profile.userInfo, login: auth.isLogin };
      }
      return result;
    });
    if (kind === 'registration') await storageService.beginLoginAttempt();
    else await storageService.save('EXAM_TOKEN', 'renewed', true, origin);
    expect(during).toMatchObject({ status: 'unavailable', info: { id: 'account-1' }, login: true });
    window.dispatchEvent(
      new StorageEvent('storage', { key: '__exam_storage__:EXAM_IDENTITY_GENERATION', newValue: 'committed' })
    );
    expect(checkSession(origin)).toBe('current');
    expect(profile.userInfo.id).toBe('account-1');
  }
);
it('order-09-02: failed newer queued intent still fences older registered login', async () => {
  const callbacks = [];
  vi.stubGlobal('navigator', {
    locks: {
      request: (_name, _options, fn) =>
        new Promise((resolve, reject) =>
          callbacks.push(() => {
            try {
              resolve(fn());
            } catch (e) {
              reject(e);
            }
          })
        )
    }
  });
  const first = storageService.beginLoginAttempt().catch((e) => e),
    second = storageService.beginLoginAttempt().catch((e) => e);
  callbacks.shift()();
  callbacks.shift()();
  const a = await first;
  await second;
  expect(storageService.isLoginAttemptCurrent(a)).toBe(false);
});
it('order-09-03: external committed account restores profile from current snapshot', async () => {
  const auth = useAuthStore(),
    profile = useProfileStore();
  stores.push(auth, profile);
  auth._setUserInfoRef(storeToRefs(profile).userInfo);
  auth.restoreUserInfo();
  profile.userInfo = storageService.get('userInfo');
  auth.syncLoginStatus();
  await login(2);
  window.dispatchEvent(
    new StorageEvent('storage', { key: '__exam_storage__:EXAM_IDENTITY_GENERATION', newValue: 'committed' })
  );
  expect(auth.isLogin).toBe(true);
  expect(profile.userInfo).toMatchObject({ id: 'account-2', nickName: 'name-2' });
});
it.each(['save', 'clear'])(
  'migrate-09-01: equivalent migrated debounce binding %s cannot resurrect older progress',
  async (action) => {
    vi.useFakeTimers();
    uni.clearStorageSync();
    uni.setStorageSync('EXAM_USER_ID', 'legacy-owner');
    uni.setStorageSync('EXAM_TOKEN', 'legacy-token');
    const old = captureSession();
    storageService.saveDebounced('EXAM_QUIZ_PROGRESS', { value: 'old' }, true, old);
    storageService.getSessionEpoch();
    const current = captureSession();
    expect(checkSession(old)).toBe('current');
    expect(current.epoch).not.toBe(old.epoch);
    if (action === 'save') storageService.saveDebounced('EXAM_QUIZ_PROGRESS', { value: 'new' }, true, current, 0);
    else clearQuizProgress();
    await vi.advanceTimersByTimeAsync(0);
    storageService.flushPendingWrites();
    expect(storageService.get('EXAM_QUIZ_PROGRESS')).toEqual(action === 'save' ? { value: 'new' } : null);
  }
);
it.each([false, true])('inflight-18-01: late 401 renewed=%s only logs out matching credential', async (renewed) => {
  const origin = captureSession();
  let reply;
  uni.request.mockImplementation((options) => {
    reply = options.success;
    return { abort: vi.fn() };
  });
  const pending = request(
    '/round9',
    { action: 'submit' },
    { session: origin, skipNetworkCheck: true, skipRateLimit: true, maxRetries: 2 }
  ).catch((e) => e);
  await flushPromises();
  if (renewed) await storageService.save('EXAM_TOKEN', 'fixture-renewed', true, origin);
  uni.$emit.mockClear();
  reply({ statusCode: 401, data: {} });
  const result = await pending;
  expect(result.code).toBe(401);
  expect(uni.$emit.mock.calls.filter(([name]) => name === 'authFailure')).toHaveLength(renewed ? 0 : 1);
  if (renewed) {
    expect(result.error.retryable).toBe(true);
    expect(checkSession(origin)).toBe('current');
  }
  expect(uni.request).toHaveBeenCalledTimes(1);
});
it.each(['epoch', 'renewal', 'owner'])('writes-09-01: mounted report late image checks original %s', async (kind) => {
  const gate = deferred();
  canvas.image.mockReturnValue(gate.promise);
  vi.spyOn(uni, 'createCanvasContext').mockImplementation(() => ({
    setFillStyle: vi.fn(),
    setFontSize: vi.fn(),
    draw: (_reserve, done) => done()
  }));
  const wrapper = mount(MistakeReport, {
    props: { expectedOwnerId: 'account-1', mistakes: [{ id: 'q', question: '原题', category: '数学' }] },
    global: { stubs: { BaseIcon: true } }
  });
  try {
    await wrapper.get('.export-btn').trigger('tap');
    await flushPromises();
    expect(canvas.image).toHaveBeenCalled();
    if (kind === 'renewal') await storageService.save('EXAM_TOKEN', 'new-token', true, captureSession());
    else await login(kind === 'epoch' ? 1 : 2);
    gate.resolve('late-image.png');
    await flushPromises();
    expect(wrapper.vm.$.setupState.reportImagePath).toBe(kind === 'renewal' ? 'late-image.png' : '');
  } finally {
    wrapper.unmount();
  }
});
it('round9 independent contexts: queued writes and generation notification', () => {
  const child = spawnSync(process.execPath, ['--experimental-vm-modules', 'tests/fixtures/session-races/round9.mjs'], {
    encoding: 'utf8',
    timeout: 15000
  });
  expect(child.status, child.stderr).toBe(0);
  const rows = child.stdout.trim().split('\n').map(JSON.parse);
  for (const row of rows) expect(row.ok, row.name).toBe(true);
  expect(rows).toHaveLength(10);
});
it.each(['timer', 'swipe'])('normal settings: %s failed save returns false and preserves projection', async (kind) => {
  const manager = kind === 'timer' ? timer : swipe;
  manager.init();
  const before = manager.getSettings();
  vi.spyOn(storageService, 'save').mockReturnValue(false);
  expect(await manager.updateSettings({ enabled: !before.enabled })).toBe(false);
  expect(manager.getSettings()).toEqual(before);
});
it.each([
  ['question-note.js', 'questionNoteManager', 'question_note_tags'],
  ['question-timer.js', 'questionTimer', 'question_time_records'],
  ['utils/smart-question-picker.js', 'smartQuestionPicker', 'smart_picker_performance'],
  ['utils/learning-analytics.js', 'learningAnalytics', 'learning_achievements']
])(
  'same-class initialization: %s later failed read remains pending and recovery rereads all bases',
  async (file, name, key) => {
    const module = await import(`../../src/pages/practice-sub/${file}`),
      manager = module[name];
    manager.isInitialized = false;
    if (manager._fetchAndMergeAchievementsFromServer)
      vi.spyOn(manager, '_fetchAndMergeAchievementsFromServer').mockResolvedValue();
    blocked = `u_account-1_${key}`;
    const getter = vi.spyOn(storageService, 'get');
    // Verify the key belongs to this holder, avoiding a vacuous fault probe.
    let error;
    try {
      manager.init();
    } catch (e) {
      error = e;
    }
    expect(getter.mock.calls.some(([called]) => called === key)).toBe(true);
    expect(error?.code).toBe('SESSION_UNAVAILABLE');
    expect(manager.isInitialized).toBe(false);
    blocked = null;
    getter.mockClear();
    manager.init();
    expect(manager.isInitialized).toBe(true);
    expect(getter.mock.calls.length).toBeGreaterThanOrEqual(2);
  }
);
it('normal intent: latest queued login commits and renewal keeps originating work current', async () => {
  let tail = Promise.resolve();
  vi.stubGlobal('navigator', {
    locks: {
      request: (_name, _options, fn) => {
        const next = tail.then(fn);
        tail = next.catch(() => {});
        return next;
      }
    }
  });
  const old = storageService.beginLoginAttempt().catch((e) => e),
    latest = storageService.beginLoginAttempt();
  await old;
  const attempt = await latest;
  await storageService.saveLoginSession({ userId: 'account-2', token: 'current-token' }, attempt);
  const session = captureSession();
  expect(await storageService.save('EXAM_TOKEN', 'current-renewed', true, session)).toBe(true);
  expect(checkSession(session)).toBe('current');
});
it('normal OAuth: serialized attempt remains current in callback and an old local intent stays fenced', async () => {
  const { beginWebOAuth, consumeWebOAuth } = await import('@/pages/login/oauth-utils.js');
  vi.stubGlobal('location', new URL('https://fixture.example/login'));
  const authorization = new URL(await beginWebOAuth('wechat', 'fixture-app-id'));
  const state = authorization.searchParams.get('state');
  vi.stubGlobal('location', new URL(`https://fixture.example/oauth/wechat.html?code=fixture-code&state=${state}`));
  expect(consumeWebOAuth('wechat').attempt).toBeTruthy();
});
it('order-09-02: newer intent failing its initial read still revokes an earlier registered attempt', async () => {
  const attempt = await storageService.beginLoginAttempt();
  blocked = '_enc_EXAM_SESSION_EPOCH';
  expect(() => storageService.beginLoginAttempt()).toThrow();
  blocked = null;
  expect(storageService.isLoginAttemptCurrent(attempt)).toBe(false);
});

it.each([false, true])(
  'inflight-18-01 actual App interceptor: renewed=%s preserves only renewed login',
  async (renewed) => {
    vi.useFakeTimers();
    const listeners = new Map();
    uni.$on.mockImplementation((name, callback) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    });
    uni.$off.mockImplementation((name, callback) => {
      if (callback) listeners.get(name)?.delete(callback);
      else listeners.delete(name);
    });
    uni.$emit.mockImplementation((name, ...args) => {
      for (const callback of [...(listeners.get(name) || [])]) callback(...args);
    });
    const user = useUserStore();
    stores.push(user, useAuthStore(), useProfileStore());
    user.restoreUserInfo();
    App.methods.initApiErrorInterceptor();
    await vi.advanceTimersByTimeAsync(4000);
    const origin = captureSession();
    let reply;
    uni.request.mockImplementation((options) => {
      reply = options.success;
      return { abort: vi.fn() };
    });
    const pending = request(
      '/round9-interceptor',
      { action: 'submit' },
      { session: origin, skipNetworkCheck: true, skipRateLimit: true, maxRetries: 2 }
    ).catch((e) => e);
    await flushPromises();
    if (renewed) await storageService.save('EXAM_TOKEN', 'renewed-valid', true, origin);
    reply({ statusCode: 401, data: {} });
    await pending;
    await flushPromises();
    expect(captureSession().owner).toBe(renewed ? 'account-1' : 'guest');
    expect(user.isLogin).toBe(renewed);
    if (renewed) expect(readSessionSnapshot().token).toBe('renewed-valid');
    expect(uni.request).toHaveBeenCalledTimes(1);
    App.beforeUnmount.call({});
    vi.clearAllTimers();
  }
);
it('same-class initialization: account switch between timer bases cannot publish mixed initialization', () => {
  const get = storageService.get.bind(storageService);
  let switched = false;
  vi.spyOn(storageService, 'get').mockImplementation((key, ...args) => {
    if (key === 'question_time_records' && !switched) {
      switched = true;
      login(2);
    }
    return get(key, ...args);
  });
  expect(() => timer.init()).toThrow();
  expect(timer.isInitialized).toBe(false);
  vi.restoreAllMocks();
  timer.init();
  expect(timer.isInitialized).toBe(true);
});
