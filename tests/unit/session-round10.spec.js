import { spawnSync } from 'node:child_process';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { storageService } from '@/services/storageService.js';
import {
  captureSession,
  checkSession,
  sessionUnavailable,
  readSessionSnapshot,
  readIdentityGeneration
} from '@/services/auth-storage.js';
import { obfuscate } from '@/utils/crypto/cipher.js';
import { useAuthStore } from '@/stores/modules/auth.js';
const read = uni.getStorageSync.getMockImplementation();
let blocked;
const login = (n = 1) => storageService.saveLoginSession({ userId: `account-${n}`, token: `fixture-${n}` });
function interrupted() {
  const snapshot = readSessionSnapshot();
  uni.setStorageSync('_enc_EXAM_SESSION_EPOCH', obfuscate({ ...snapshot.record, generation: snapshot.generation + 1 }));
}
beforeEach(() => {
  blocked = false;
  uni.getStorageSync.mockImplementation((key) => {
    if (blocked && key === '_enc_EXAM_SESSION_EPOCH') throw sessionUnavailable();
    return read(key);
  });
  uni.clearStorageSync();
  login();
  setActivePinia(createPinia());
  vi.useFakeTimers();
});
afterEach(() => {
  blocked = false;
  storageService.flushPendingWrites();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  uni.getStorageSync.mockImplementation(read);
});
it.each(['flush', 'cancel', 'update'])(
  'fixes-10-03: verified migration stays one logical binding during unavailable %s',
  async (action) => {
    uni.clearStorageSync();
    uni.setStorageSync('EXAM_USER_ID', 'legacy-owner');
    uni.setStorageSync('EXAM_TOKEN', 'legacy-token');
    const old = captureSession();
    storageService.saveDebounced('EXAM_QUIZ_PROGRESS', { value: 'old' }, true, old, 5000);
    storageService.getSessionEpoch();
    const current = captureSession();
    expect(checkSession(old)).toBe('current');
    blocked = true;
    storageService.saveDebounced('EXAM_QUIZ_PROGRESS', { value: 'new' }, true, current, 0);
    if (action === 'cancel') storageService.cancelPendingWrite('EXAM_QUIZ_PROGRESS', old);
    if (action === 'update') {
      storageService.update('migration-counter', [], (rows) => [...rows, 'old'], old);
      storageService.update('migration-counter', [], (rows) => [...rows, 'new'], current);
    }
    blocked = false;
    await vi.advanceTimersByTimeAsync(0);
    storageService.flushPendingWrites();
    expect(storageService.get('EXAM_QUIZ_PROGRESS')).toEqual(action === 'cancel' ? null : { value: 'new' });
    if (action === 'update') expect(storageService.get('migration-counter')).toEqual(['old', 'new']);
  }
);
it.each(['app', 'h5'])(
  'order-10-02: %s entry recovers interrupted commit and permits fresh login',
  async (platform) => {
    interrupted();
    if (platform === 'h5')
      vi.stubGlobal('navigator', { locks: { request: (_n, _o, fn) => Promise.resolve().then(fn) } });
    expect(captureSession()).toBeNull();
    const attempt = await storageService.beginLoginAttempt();
    expect(readSessionSnapshot()).toMatchObject({ status: 'current', session: { owner: 'guest' }, token: null });
    await storageService.saveLoginSession({ userId: 'account-2', token: 'fixture-2' }, attempt);
    expect(captureSession().owner).toBe('account-2');
  }
);
it('order-10-02: fresh Store with no readable binding can revoke locally', async () => {
  interrupted();
  const auth = useAuthStore();
  try {
    expect((await auth.logout()).success).toBe(true);
    expect(readSessionSnapshot()).toMatchObject({ status: 'current', session: { owner: 'guest' }, token: null });
  } finally {
    auth.$dispose();
  }
});
it('order-10-02: queued recovery cannot erase successor login', async () => {
  interrupted();
  const auth = useAuthStore(),
    callbacks = [];
  vi.stubGlobal('navigator', {
    locks: {
      request: (_n, _o, fn) =>
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
  try {
    const pending = auth.logout();
    vi.unstubAllGlobals();
    // A later writer independently revokes the abandoned record and commits a new identity.
    await storageService._clearRevokedCredentials();
    await login(2);
    const generation = readIdentityGeneration();
    callbacks.shift()?.();
    await pending;
    expect(captureSession().owner).toBe('account-2');
    expect(readIdentityGeneration()).toBe(generation);
  } finally {
    auth.$dispose();
  }
});
it('order-10-02: revocation never publishes an abandoned record as committed', async () => {
  interrupted();
  const set = uni.setStorageSync.getMockImplementation(),
    seen = [];
  vi.spyOn(uni, 'setStorageSync').mockImplementation((key, value) => {
    const result = set(key, value);
    if (key === 'EXAM_IDENTITY_GENERATION') seen.push(readSessionSnapshot());
    return result;
  });
  await storageService.beginLoginAttempt();
  expect(seen.some((snapshot) => snapshot.status === 'current' && snapshot.token === 'fixture-1')).toBe(false);
});
it('order-10-02: an in-progress writer finishing before recovery lock remains committed', async () => {
  interrupted();
  const callbacks = [];
  vi.stubGlobal('navigator', {
    locks: {
      request: (_n, _o, fn) =>
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
  const pending = storageService.beginLoginAttempt().catch((e) => e);
  uni.setStorageSync('EXAM_IDENTITY_GENERATION', readIdentityGeneration() + 1);
  callbacks.shift()();
  expect((await pending).code).toBe('SESSION_UNAVAILABLE');
  expect(captureSession().owner).toBe('account-1');
});

it('order-10-02: actual terminated writer releases lock and new contexts recover', () => {
  const child = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', 'tests/fixtures/session-races/round10-workers.mjs'],
    { encoding: 'utf8', timeout: 15000 }
  );
  expect(child.status, child.stderr).toBe(0);
  const rows = child.stdout.trim().split('\n').map(JSON.parse);
  expect(rows).toHaveLength(3);
  for (const row of rows) expect(row.ok, row.name).toBe(true);
});
it('order-10-02: interrupted logout completes Store cleanup with its own generation receipt', async () => {
  const auth = useAuthStore();
  interrupted();
  uni.$emit.mockClear();
  try {
    expect((await auth.logout()).success).toBe(true);
    expect(uni.$emit).toHaveBeenCalledWith('user:logout');
  } finally {
    auth.$dispose();
  }
});
it('order-10-02: unreadable binding still revokes locally without publishing the interrupted record', async () => {
  interrupted();
  blocked = true;
  const auth = useAuthStore();
  const set = uni.setStorageSync.getMockImplementation(),
    seen = [];
  vi.spyOn(uni, 'setStorageSync').mockImplementation((key, value) => {
    const result = set(key, value);
    if (key === 'EXAM_IDENTITY_GENERATION') {
      blocked = false;
      seen.push(readSessionSnapshot());
      blocked = true;
    }
    return result;
  });
  try {
    expect((await auth.logout()).success).toBe(true);
    blocked = false;
    expect(captureSession().owner).toBe('guest');
    expect(seen.some((snap) => snap.status === 'current' && snap.token === 'fixture-1')).toBe(false);
  } finally {
    auth.$dispose();
  }
});
