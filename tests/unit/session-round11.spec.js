import { spawnSync } from 'node:child_process';
import { afterEach, expect, it, vi } from 'vitest';
import { storageService } from '@/services/storageService.js';
import { readSessionSnapshot } from '@/services/auth-storage.js';
import { obfuscate } from '@/utils/crypto/cipher.js';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('fixes-20-01 / order-20-01: independent H5 recovery continuation rejects logout, successor login and renewal', () => {
  const child = spawnSync(process.execPath, ['--experimental-vm-modules', 'tests/fixtures/session-races/round11.mjs'], {
    encoding: 'utf8',
    timeout: 15000
  });
  expect(child.status, child.stderr).toBe(0);
  const rows = child.stdout.trim().split('\n').map(JSON.parse);
  expect(rows).toHaveLength(3);
  for (const row of rows) expect(row.ok, row.name).toBe(true);
});

it('fixes-20-01: single context recovers and registers synchronously in one original intent', () => {
  uni.clearStorageSync();
  storageService.saveLoginSession({ userId: 'account-1', token: 'fixture-1' });
  const snapshot = readSessionSnapshot();
  uni.setStorageSync('_enc_EXAM_SESSION_EPOCH', obfuscate({ ...snapshot.record, generation: snapshot.generation + 1 }));
  const begin = vi.spyOn(storageService, 'beginLoginAttempt');
  const attempt = storageService.beginLoginAttempt();
  expect(attempt.then).toBeUndefined();
  expect(begin).toHaveBeenCalledTimes(1);
  expect(storageService.isLoginAttemptCurrent(attempt)).toBe(true);
});

it('fixes-20-01: a successor intent during synchronous recovery cancels the initiating attempt', () => {
  uni.clearStorageSync();
  storageService.saveLoginSession({ userId: 'account-1', token: 'fixture-1' });
  const snapshot = readSessionSnapshot();
  uni.setStorageSync('_enc_EXAM_SESSION_EPOCH', obfuscate({ ...snapshot.record, generation: snapshot.generation + 1 }));
  let successor;
  const stop = storageService.onIdentityChange(() => {
    stop();
    successor = storageService.beginLoginAttempt();
  });
  try {
    expect(() => storageService.beginLoginAttempt()).toThrow();
    expect(storageService.isLoginAttemptCurrent(successor)).toBe(true);
  } finally {
    stop();
  }
});

it('fixes-20-01: ordinary logout can revoke while the revocation marker is unreadable', () => {
  uni.clearStorageSync();
  storageService.saveLoginSession({ userId: 'account-1', token: 'fixture-1' });
  const read = uni.getStorageSync.getMockImplementation();
  uni.getStorageSync.mockImplementation((key) => {
    if (key === 'EXAM_SESSION_REVOCATION') throw new Error('marker read unavailable');
    return read(key);
  });
  try {
    expect(storageService._clearRevokedCredentials()).toBe(true);
  } finally {
    uni.getStorageSync.mockImplementation(read);
  }
  expect(readSessionSnapshot()).toMatchObject({ status: 'current', session: { owner: 'guest' }, token: null });
});

it('fixes-20-01: queued registration retains the initiating guest migration proof', async () => {
  uni.clearStorageSync();
  storageService.save('before-registration', { value: 1 });
  const callbacks = [];
  vi.stubGlobal('navigator', {
    locks: {
      request: (_name, _options, fn) =>
        new Promise((resolve, reject) => {
          callbacks.push(() => {
            try {
              resolve(fn());
            } catch (error) {
              reject(error);
            }
          });
        })
    }
  });
  const pending = storageService.beginLoginAttempt();
  storageService.save('before-registration', { value: 3 });
  storageService.save('after-registration', { value: 2 });
  callbacks.shift()();
  const attempt = await pending;
  expect(attempt.guestSources.get('before-registration')).toBe(JSON.stringify({ value: 1 }));
  expect(attempt.guestSources.has('after-registration')).toBe(false);
});
