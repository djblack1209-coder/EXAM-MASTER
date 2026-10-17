import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { storageService } from '@/services/storageService.js';
import { OfflineQueue } from '@/utils/core/offline-queue.js';
const login = (n) => storageService.saveLoginSession({ userId: `account-${n}`, token: `fixture-${n}` });
beforeEach(() => {
  uni.clearStorageSync();
  login(1);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('migrate-09-02: two loaded instances enqueue without losing the first task', async () => {
  const a = new OfflineQueue(),
    b = new OfflineQueue();
  const first = await a.enqueue({ requestData: { value: 1 } });
  const second = await b.enqueue({ requestData: { value: 2 } });
  expect(uni.getStorageSync('EXAM_OFFLINE_QUEUE').map((x) => x.id)).toEqual([first, second]);
});
it.each([false, true])('inflight-18-02: late old response failed=%s preserves new account task', async (failed) => {
  const a = new OfflineQueue();
  let finish;
  await a.enqueue({
    requestData: { value: 1 },
    requestFn: () =>
      new Promise((resolve, reject) => {
        finish = () => (failed ? reject(Error('fixture')) : resolve({ success: true }));
      })
  });
  const processing = a.processQueue();
  await vi.advanceTimersByTimeAsync(0);
  expect(finish).toBeTypeOf('function');
  login(2);
  const b = new OfflineQueue(),
    next = await b.enqueue({ requestData: { value: 2 } });
  finish();
  await vi.runAllTimersAsync();
  await processing;
  expect(uni.getStorageSync('EXAM_OFFLINE_QUEUE').map((x) => x.id)).toContain(next);
});
it('normal queue cancellation removes only known id and preserves another instance enqueue', async () => {
  const a = new OfflineQueue(),
    first = await a.enqueue({ requestData: { value: 1 } });
  const b = new OfflineQueue(),
    second = await b.enqueue({ requestData: { value: 2 } });
  expect(await a.dequeue(first)).toBe(true);
  expect(uni.getStorageSync('EXAM_OFFLINE_QUEUE').map((x) => x.id)).toEqual([second]);
});
it('normal restore: another account and unbound legacy body stay outside current projection', async () => {
  const a = new OfflineQueue();
  await a.enqueue({ requestData: { privateValue: 'original-account' } });
  login(2);
  const stored = uni.getStorageSync('EXAM_OFFLINE_QUEUE');
  uni.setStorageSync('EXAM_OFFLINE_QUEUE', [
    ...stored,
    { id: 'unbound', timestamp: Date.now(), requestData: { value: 1 } }
  ]);
  const b = new OfflineQueue();
  expect(b.getStatus().queueLength).toBe(0);
  // A projection refresh must not rewrite the other instance's durable task.
  expect(uni.getStorageSync('EXAM_OFFLINE_QUEUE')).toHaveLength(2);
});
