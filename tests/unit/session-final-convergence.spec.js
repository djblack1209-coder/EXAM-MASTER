import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { watch } from 'vue';
import { readFileSync } from 'node:fs';
import { storageService } from '@/services/storageService.js';
import { captureSession, checkSession, readSessionSnapshot } from '@/services/auth-storage.js';
import { useConversationLearningStore } from '@/stores/modules/conversation-learning.js';
import { useStatsStore } from '@/stores/modules/stats.js';
import { useFavoriteStore } from '@/stores/modules/favorite.js';
import { logger } from '@/utils/logger.js';
vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }
}));
vi.mock('@/services/api/domains/learning.api.js', async (original) => ({
  ...(await original()),
  fetchLearningModels: vi.fn(),
  fetchLearningUsage: vi.fn()
}));
import { fetchLearningModels, fetchLearningUsage } from '@/services/api/domains/learning.api.js';
const originalRead = uni.getStorageSync.getMockImplementation();
const login = (n = 1) =>
  storageService.saveLoginSession({ userId: `account-${n}`, token: `fixture-${n}`, userInfo: { id: `account-${n}` } });
let store;
function unreadable(mode = 'throw') {
  uni.getStorageSync.mockImplementation((key) => {
    if (key === '_enc_EXAM_SESSION_EPOCH') {
      if (mode === 'empty') return '';
      throw new Error('fixture unavailable');
    }
    return originalRead(key);
  });
}
beforeEach(() => {
  uni.getStorageSync.mockImplementation(originalRead);
  uni.clearStorageSync();
  login();
  setActivePinia(createPinia());
});
afterEach(() => {
  uni.getStorageSync.mockImplementation(originalRead);
  store?.$dispose();
  store = null;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it('regress-2: swallowed runtime read is unavailable and never revokes credentials', () => {
  const session = captureSession();
  unreadable('empty');
  expect(readSessionSnapshot().status).toBe('unavailable');
  storageService.getSessionEpoch();
  uni.getStorageSync.mockImplementation(originalRead);
  expect(checkSession(session)).toBe('current');
});
it('regress-3: search and stats preserve bound projections while unavailable', async () => {
  store = useConversationLearningStore();
  store.start('12 + 8');
  const before = store.searchRecords('12');
  expect(before.total).toBeGreaterThan(0);
  const stats = useStatsStore();
  stats.overview = { totalQuestions: 9 };
  // Bind before failure, then keep all already displayed caches.
  await stats.fetchOverview();
  stats.overview = { totalQuestions: 9 };
  stats.dailyStats = [{ count: 3 }];
  stats.trend = { value: 2 };
  unreadable();
  expect(store.searchRecords('12')).toEqual(before);
  expect(await stats.fetchOverview()).toEqual({ totalQuestions: 9 });
  expect(stats.dailyStats).toEqual([{ count: 3 }]);
  expect(stats.trend).toEqual({ value: 2 });
  stats.$dispose();
});
it('migrate-01: nested readonly reentry cannot release outer reset guard', () => {
  store = useConversationLearningStore();
  store.start('12 + 8');
  store.sharingAllowed = true;
  let accepted = false;
  const stop = watch(
    () => store.sharingAllowed,
    () => {
      try {
        store.reloadRecords();
      } catch {}
      try {
        store.commit('profile.set', {
          field: 'foundation',
          value: 'old-private',
          source: 'self_report',
          scope: 'fixture'
        });
        accepted = true;
      } catch {}
    },
    { flush: 'sync' }
  );
  login(2);
  stop();
  expect(accepted).toBe(false);
  expect(JSON.stringify(storageService.get('conversation_learning_v1', {}))).not.toContain('old-private');
});
it.each(['timer', 'flush'])('migrate-03: %s unavailable pending write retries with original binding', (how) => {
  vi.useFakeTimers();
  storageService.save('study_stats', { count: 1 }, true);
  storageService.saveDebounced('study_stats', { count: 2 });
  unreadable();
  if (how === 'timer') vi.advanceTimersByTime(500);
  else storageService.flushPendingWrites();
  uni.getStorageSync.mockImplementation(originalRead);
  storageService.flushPendingWrites();
  expect(storageService.get('study_stats')).toEqual({ count: 2 });
});
it.each(['source', 'identity'])('migrate-04: interrupted %s migration retains proof for idempotent retry', (how) => {
  storageService._clearRevokedCredentials();
  storageService.save('study_stats', { count: 7 }, true);
  login();
  if (how === 'identity')
    uni.getStorageSync.mockImplementation((key) => {
      const value = originalRead(key);
      if (key === 'study_stats') unreadable();
      return value;
    });
  else
    uni.getStorageSync.mockImplementation((key) => {
      if (key === 'study_stats') throw new Error('fixture source');
      return originalRead(key);
    });
  expect(storageService.migrateUserKeys()).toBe(0);
  uni.getStorageSync.mockImplementation(originalRead);
  expect(storageService.migrateUserKeys()).toBe(1);
  expect(storageService.get('study_stats')).toEqual({ count: 7 });
  expect(storageService.migrateUserKeys()).toBe(0);
});
it('regress-4: cleanup logs contain no account identifier', () => {
  storageService.save('temporary_fixture', 1, true);
  logger.log.mockClear();
  storageService.clearUserData();
  expect(JSON.stringify(logger.log.mock.calls)).not.toContain('account-1');
});
it('WRITES-12-1: real rename prompt rejects same-account generation change', () => {
  const favorites = useFavoriteStore();
  const created = favorites.createFolder({ name: 'kept' });
  const folder = favorites.loadFolders().find((f) => f.id === created.folder.id);
  let dialog;
  const source = readFileSync(`${process.env.YOZI_SESSION_SOURCE_ROOT || '.'}/src/pages/favorite/index.vue`, 'utf8');
  const body = source.slice(source.indexOf('function renameFolderPrompt('), source.indexOf('/** 确认删除收藏夹 */'));
  const prompt = new Function(
    'modal',
    't',
    'owned',
    'favoriteStore',
    'toast',
    'loadData',
    'captureSession',
    'checkSession',
    `${body}; return renameFolderPrompt;`
  )(
    {
      show: (d) => {
        dialog = d;
      }
    },
    (v) => v,
    () => true,
    favorites,
    { success() {}, info() {} },
    () => {},
    captureSession,
    checkSession
  );
  prompt(folder);
  login();
  dialog.success({ confirm: true, content: 'stale edit' });
  expect(storageService.get('favorite_folders').find((f) => f.id === folder.id).name).toBe('kept');
});
it('WRITES-12-2: singleton new adjustment binds current session and confirms persistence', async () => {
  const { default: manager } = await import('@/pages/plan/intelligent-plan-manager.js');
  const plan = {
    id: 'fixture',
    name: 'fixture',
    progress: 20,
    tasks: [],
    startDate: '2026-10-01',
    endDate: '2026-10-30',
    category: 'math',
    analytics: {}
  };
  storageService.save('study_plans', [plan], true);
  manager.init();
  login();
  const result = manager.adjustPlan('fixture', 10);
  expect(result?.progress).toBe(10);
  expect(storageService.get('study_plans')[0].progress).toBe(10);
  const write = vi.spyOn(storageService, 'save').mockReturnValue(false);
  expect(manager.adjustPlan('fixture', 30)).toBeNull();
  expect(manager.getPlan('fixture').progress).toBe(10);
  write.mockRestore();
});
it.each(['models', 'usage'])('inflight-01: %s unavailable completion ends loading and keeps cache', async (kind) => {
  store = useConversationLearningStore();
  store.start('12 + 8');
  store.models = [{ id: 'kept' }];
  store.modelPresets = [{ id: 'kept-preset' }];
  store.usage = { spent: 7 };
  let finish;
  const request = kind === 'models' ? fetchLearningModels : fetchLearningUsage;
  request.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const pending = kind === 'models' ? store.loadModels() : store.loadUsage();
  unreadable();
  finish({ success: true, data: kind === 'models' ? { models: [], presets: [] } : null });
  await pending.catch(() => undefined);
  expect(store[kind === 'models' ? 'modelListState' : 'modelUsageState'].phase).not.toBe('loading');
  expect(store.models).toEqual([{ id: 'kept' }]);
  expect(store.modelPresets).toEqual([{ id: 'kept-preset' }]);
  expect(store.usage).toEqual({ spent: 7 });
});
it.each(['models', 'usage'])(
  'inflight-01: %s one-shot and typed unavailable responses preserve caches and permit retry',
  async (kind) => {
    store = useConversationLearningStore();
    store.start('12 + 8');
    store.models = [{ id: 'kept' }];
    store.modelPresets = [{ id: 'preset' }];
    store.usage = { spent: 7 };
    let finish;
    const request = kind === 'models' ? fetchLearningModels : fetchLearningUsage;
    request.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const pending = kind === 'models' ? store.loadModels() : store.loadUsage();
    let failed = false;
    uni.getStorageSync.mockImplementation((key) => {
      if (!failed && key === '_enc_EXAM_SESSION_EPOCH') {
        failed = true;
        throw new Error('fixture one shot');
      }
      return originalRead(key);
    });
    finish({ success: true, data: kind === 'models' ? { models: [] } : null });
    await pending;
    expect(store.models).toEqual([{ id: 'kept' }]);
    expect(store.usage).toEqual({ spent: 7 });
    expect(store[kind === 'models' ? 'modelListState' : 'modelUsageState'].phase).toBe('error');
    request.mockResolvedValue({ success: false, errorCode: 'SESSION_UNAVAILABLE' });
    await (kind === 'models' ? store.loadModels() : store.loadUsage());
    expect(store.models).toEqual([{ id: 'kept' }]);
    expect(store.usage).toEqual({ spent: 7 });
    request.mockResolvedValue({ success: true, data: kind === 'models' ? { models: [] } : null });
    await (kind === 'models' ? store.loadModels() : store.loadUsage());
    expect(store[kind === 'models' ? 'modelListState' : 'modelUsageState'].phase).toBe('empty');
  }
);
it('migrate-04: copied target is verified on retry before source proof retirement', () => {
  storageService._clearRevokedCredentials();
  storageService.save('study_stats', { count: 11 }, true);
  login();
  const write = uni.setStorageSync.getMockImplementation();
  vi.spyOn(uni, 'setStorageSync').mockImplementation((key, value) => {
    write(key, value);
    if (key === 'u_account-1_study_stats') unreadable();
  });
  expect(storageService.migrateUserKeys()).toBe(0);
  uni.getStorageSync.mockImplementation(originalRead);
  expect(storageService.migrateUserKeys()).toBe(1);
  expect(storageService.get('study_stats')).toEqual({ count: 11 });
  // No portable cross-window compare/delete: verified copies retain the guest source.
  expect(originalRead('study_stats')).toEqual({ count: 11 });
});
it('regress-01/order-02: same owner and epoch binding survives credential renewal', async () => {
  const session = captureSession();
  expect(await storageService.save('EXAM_TOKEN', 'fixture-rotated', true, session)).toBe(true);
  expect(await storageService.save('userInfo', { id: 'account-1', nickname: 'renewed' }, true, session)).toBe(true);
  expect(checkSession(session)).toBe('current');
  expect(storageService.get('EXAM_TOKEN')).toBe('fixture-rotated');
});
it.each(['all', 'epoch'])('regress-2: installed H5 swallowed %s errors remain unavailable', (how) => {
  const source = readFileSync('node_modules/@dcloudio/uni-h5/dist/uni-h5.es.js', 'utf8');
  const callback = source
    .slice(
      source.indexOf('  (key, isUTS) => {', source.indexOf('const getStorageSync =')),
      source.indexOf('  GetStorageSyncProtocol', source.indexOf('const getStorageSync ='))
    )
    .trim()
    .replace(/,$/, '');
  const h5Read = new Function('getStorageOrigin', `return (${callback})`)((key) => {
    if (how === 'all' || key === '_enc_EXAM_SESSION_EPOCH') throw new Error('fixture platform read');
    return originalRead(key);
  });
  uni.getStorageSync.mockImplementation(h5Read);
  expect(readSessionSnapshot().status).toBe('unavailable');
  storageService.getSessionEpoch();
  uni.getStorageSync.mockImplementation(originalRead);
  expect(captureSession().owner).toBe('account-1');
});
it('regress-3: login guards expose unavailable and never redirect or execute actions', async () => {
  const { isUserLoggedIn, requireLogin, pageRequireLogin, requireLoginAsync, loginRequired } =
    await import('@/utils/auth/loginGuard.js');
  const action = vi.fn();
  const modal = vi.spyOn(uni, 'showModal');
  modal.mockClear();
  unreadable();
  expect(isUserLoggedIn()).toBeNull();
  expect(requireLogin(action)).toBeNull();
  expect(pageRequireLogin({})).toBeNull();
  await expect(requireLoginAsync()).rejects.toMatchObject({ code: 'SESSION_UNAVAILABLE' });
  vi.useFakeTimers();
  const decorated = loginRequired()(null, 'fixture', { value: action });
  expect(decorated.value()).toBeNull();
  expect(action).not.toHaveBeenCalled();
  expect(modal).not.toHaveBeenCalled();
});
it('order-2: cancelled guest login retires its aliases and cannot survive remount', async () => {
  await storageService._clearRevokedCredentials();
  const queued = [];
  vi.stubGlobal('navigator', {
    locks: {
      request: (_name, _opts, write) =>
        new Promise((resolve, reject) => {
          queued.push(() => {
            try {
              resolve(write());
            } catch (error) {
              reject(error);
            }
          });
        })
    }
  });
  const pending = Promise.resolve(login(2)).catch((error) => error);
  vi.stubGlobal('navigator', {});
  storageService.beginLoginAttempt();
  queued.shift()();
  expect(await pending).toBeInstanceOf(Error);
  expect(captureSession()?.owner).toBe('guest');
  expect(storageService.get('userInfo')).toBeNull();
});
it('regress-3: profile readonly fallbacks do not reread unavailable identity', async () => {
  const { default: Profile } = await import('@/pages/profile/index.vue');
  unreadable();
  const page = { isLoggedIn: null, userStore: { userInfo: {} } };
  expect(() => Profile.computed.userName.call(page)).not.toThrow();
  expect(() => Profile.computed.avatarUrl.call(page)).not.toThrow();
});
it('regress-1/order-1: clearing profile commits its explicit null value through identity CAS', async () => {
  expect(await storageService.save('userInfo', null, true, captureSession())).toBe(true);
  expect(storageService.get('userInfo')).toBeNull();
});
