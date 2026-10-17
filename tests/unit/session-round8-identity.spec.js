import { spawnSync } from 'node:child_process';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { storageService } from '@/services/storageService.js';
import { captureSession, checkSession } from '@/services/auth-storage.js';
const login = (n = 1) => storageService.saveLoginSession({ userId: `account-${n}`, token: `fixture-${n}` });
beforeEach(() => {
  uni.clearStorageSync();
  login();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it('order-08-01: a browser without Web Locks cannot use existing or new login state', async () => {
  const old = captureSession();
  vi.stubEnv('UNI_PLATFORM', 'h5');
  vi.stubGlobal('navigator', {});
  expect(checkSession(old)).toBe('changed');
  await expect(Promise.resolve().then(() => login(2))).rejects.toMatchObject({ code: 'BROWSER_UPGRADE_REQUIRED' });
});
it('order-08-02/order-08-03: shared-store delayed registration and cleanup', () => {
  const child = spawnSync(process.execPath, ['--experimental-vm-modules', 'tests/fixtures/session-races/round8.mjs'], {
    encoding: 'utf8',
    timeout: 15000
  });
  expect(child.status, child.stderr).toBe(0);
  const rows = child.stdout.trim().split('\n').map(JSON.parse);
  expect(rows).toHaveLength(2);
  for (const row of rows) expect(row.ok, row.name).toBe(true);
});

it('order-08: independent workers serialize registration cleanup and stale profile commits', () => {
  const child = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', 'tests/fixtures/session-races/round8-workers.mjs'],
    { encoding: 'utf8', timeout: 15000 }
  );
  expect(child.status, child.stderr).toBe(0);
  const rows = child.stdout.trim().split('\n').map(JSON.parse);
  expect(rows).toHaveLength(5);
  for (const row of rows) expect(row.ok, row.name).toBe(true);
});

it('normal unsupported browser: guest learning still works and no saved credential is exposed', () => {
  vi.stubEnv('UNI_PLATFORM', 'h5');
  vi.stubGlobal('navigator', {});
  const session = captureSession();
  expect(session.owner).toBe('guest');
  expect(storageService.get('EXAM_USER_ID', null)).toBeNull();
  expect(storageService.save('conversation_learning_v1', { fixture: true }, true, session)).toBe(true);
  expect(storageService.get('conversation_learning_v1')).toEqual({ fixture: true });
});
it('same-class identity: selective clear still locks and advances the captured generation', async () => {
  const { readIdentityGeneration } = await import('@/services/auth-storage.js');
  storageService.save('theme_mode', 'dark', true);
  const origin = captureSession(),
    generation = readIdentityGeneration();
  const request = vi.fn((_name, _options, write) => Promise.resolve().then(write));
  vi.stubGlobal('navigator', { locks: { request } });
  const cleared = storageService.clear(true, { preserveGlobal: false, preserveKeys: ['theme_mode'] });
  await cleared;
  expect(request).toHaveBeenCalled();
  expect(readIdentityGeneration()).toBe(generation + 1);
  expect(checkSession(origin)).toBe('changed');
  expect(storageService.get('theme_mode')).toBe('dark');
});
it('same-class identity: ordinary save and remove cannot reset transaction control keys', () => {
  const generation = uni.getStorageSync('EXAM_IDENTITY_GENERATION');
  expect(storageService.save('EXAM_IDENTITY_GENERATION', 0, true)).toBe(false);
  expect(storageService.remove('EXAM_IDENTITY_GENERATION', true)).toBe(false);
  expect(uni.getStorageSync('EXAM_IDENTITY_GENERATION')).toBe(generation);
});
