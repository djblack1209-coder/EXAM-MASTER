import { seedLegacyTask } from '../fixtures/legacy-queue.js';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { storageService } from '@/services/storageService.js';
import { captureSession, sessionUnavailable } from '@/services/auth-storage.js';
import { OfflineQueue } from '@/utils/core/offline-queue.js';
const KEY = 'EXAM_OFFLINE_QUEUE';
const read = uni.getStorageSync.getMockImplementation();
const set = uni.setStorageSync.getMockImplementation();
let blocked;
const login = (n) => storageService.saveLoginSession({ userId: `account-${n}`, token: `fixture-${n}` });
function locks() {
  let tail = Promise.resolve();
  vi.stubGlobal('navigator', {
    locks: {
      request: (_n, _o, fn) => {
        const next = tail.then(fn);
        tail = next.catch(() => {});
        return next;
      }
    }
  });
}
async function drain(promises) {
  await vi.runAllTimersAsync();
  return Promise.all(promises);
}
beforeEach(() => {
  blocked = false;
  uni.setStorageSync.mockImplementation(set);
  uni.clearStorageSync();
  login(1);
  vi.useFakeTimers();
  uni.getStorageSync.mockImplementation((key) => {
    if (key === KEY && blocked) throw sessionUnavailable();
    return read(key);
  });
});
afterEach(() => {
  blocked = false;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  uni.getStorageSync.mockImplementation(read);
  vi.unstubAllGlobals();
});
it.each(['same-instance', 'two-instances', 'two-recovering-instances'])(
  'fixes-10-01: %s claims one transport after lock wait',
  async (mode) => {
    const seed = new OfflineQueue();
    const id = await seedLegacyTask(seed, { requestData: { value: 1 } });
    blocked = mode !== 'two-instances';
    const a = new OfflineQueue(),
      b = mode === 'same-instance' ? a : new OfflineQueue();
    const send = vi.fn(async () => ({ success: true }));
    a.registerRebuilder(send);
    b.registerRebuilder(send);
    blocked = false;
    locks();
    const first = a.processQueue(),
      second = b.processQueue();
    await drain([first, second]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1].taskId).toBe(id);
    expect(a.processing).toBe(false);
    expect(b.processing).toBe(false);
    expect(read(KEY)).toEqual([]);
  }
);
it('fixes-10-01: a losing claimant cannot release the active owner', async () => {
  const a = new OfflineQueue();
  await seedLegacyTask(a, { requestData: { value: 1 } });
  const b = new OfflineQueue(),
    c = new OfflineQueue();
  let release;
  const send = vi.fn(
    () =>
      new Promise((r) => {
        release = r;
      })
  );
  for (const q of [a, b, c]) q.registerRebuilder(send);
  locks();
  const first = a.processQueue(),
    second = b.processQueue();
  await vi.advanceTimersByTimeAsync(0);
  const third = c.processQueue();
  await vi.advanceTimersByTimeAsync(0);
  expect(send).toHaveBeenCalledTimes(1);
  release({ success: true });
  await drain([first, second, third]);
});

it.each([false, true])(
  'fixes-10-04: drain expires own high tasks and preserves foreign rows relogged=%s',
  async (relogged) => {
    const session = captureSession();
    const foreign = {
      id: 'foreign',
      session: { owner: 'other-account', epoch: 'other_epoch' },
      timestamp: 0,
      priority: 'high',
      state: 'pending',
      requestData: { value: 'private' }
    };
    uni.setStorageSync(KEY, [
      foreign,
      ...Array.from({ length: 100 }, (_, i) => ({
        id: `expired-${i}`,
        session,
        timestamp: Date.now() - 86400001,
        state: 'pending',
        priority: 'high'
      }))
    ]);
    if (relogged) await login(1);
    const a = new OfflineQueue();
    expect(await a.processQueue()).toMatchObject({ success: true, processed: 0 });
    expect(read(KEY)).toEqual([foreign]);
  }
);
