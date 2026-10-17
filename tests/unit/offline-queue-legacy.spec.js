import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { storageService } from '@/services/storageService.js';
import { captureSession, sessionUnavailable } from '@/services/auth-storage.js';
import { OfflineQueue, offlineQueue } from '@/utils/core/offline-queue.js';
import { networkMonitor } from '@/utils/core/network-monitor.js';
import { seedLegacyTask } from '../fixtures/legacy-queue.js';

const KEY = 'EXAM_OFFLINE_QUEUE';
const read = uni.getStorageSync.getMockImplementation();
const set = uni.setStorageSync.getMockImplementation();
let blocked;
const login = (n) => storageService.saveLoginSession({ userId: `account-${n}`, token: `fixture-${n}` });
async function drain(pending) {
  await vi.runAllTimersAsync();
  return pending;
}
beforeEach(() => {
  blocked = null;
  uni.clearStorageSync();
  login(1);
  vi.useFakeTimers();
  uni.getStorageSync.mockImplementation((key) => {
    if (key === blocked) throw sessionUnavailable();
    return structuredClone(read(key));
  });
});
afterEach(() => {
  blocked = null;
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  uni.getStorageSync.mockImplementation(read);
  uni.setStorageSync.mockImplementation(set);
  vi.unstubAllGlobals();
  delete uni.onNetworkStatusChange;
});

it('drain exposes no enqueue, pending replay or transport closure collection', () => {
  const queue = new OfflineQueue();
  expect(queue.enqueue).toBeUndefined();
  expect(queue.pendingEnqueues).toBeUndefined();
  expect(queue.requestFnMap).toBeUndefined();
});

it('receipts match legacy task ids, including two tasks sharing an old dedupe key', async () => {
  const queue = new OfflineQueue();
  const one = seedLegacyTask(queue, { requestData: { value: 1 }, dedupeKey: 'save' });
  const two = seedLegacyTask(queue, { requestData: { value: 2 }, dedupeKey: 'save' });
  const send = vi.fn(async (body) => {
    if (body.value === 1) blocked = KEY;
    return { success: true };
  });
  queue.registerRebuilder(send);
  expect(await drain(queue.processQueue())).toMatchObject({ success: false, reason: 'storage_unavailable' });
  expect(read(KEY)).toHaveLength(2);
  blocked = null;
  const restored = new OfflineQueue();
  restored.registerRebuilder(send);
  expect(await drain(restored.processQueue())).toMatchObject({ success: true, processed: 2 });
  expect(send.mock.calls.map(([body, context]) => [body.value, context.taskId])).toEqual([
    [1, one],
    [2, two]
  ]);
  expect(read(KEY)).toEqual([]);
});

it.each(['dequeue', 'clear'])(
  '%s removes only the loaded legacy ids, keeping unseen and foreign records',
  async (method) => {
    const queue = new OfflineQueue();
    const known = seedLegacyTask(queue);
    const other = new OfflineQueue();
    const unseen = seedLegacyTask(other, { requestData: { unseen: true } });
    login(2);
    const foreign = seedLegacyTask(new OfflineQueue(), { requestData: { private: true } });
    expect(await (method === 'clear' ? queue.clear() : queue.dequeue(known))).toBe(true);
    expect(read(KEY).map((x) => x.id)).toEqual([unseen, foreign]);
    expect(queue.dequeue(unseen)).toBe(false);
  }
);

it.each(['dequeue', 'clear'])('%s rechecks active ownership after waiting for the lock', async (method) => {
  const queue = new OfflineQueue();
  const id = seedLegacyTask(queue);
  const sender = new OfflineQueue();
  let unlock, finish;
  vi.stubGlobal('navigator', {
    locks: {
      request: (_name, _options, fn) =>
        new Promise((resolve) => {
          unlock = () => resolve(fn());
        })
    }
  });
  const cancel = method === 'clear' ? queue.clear() : queue.dequeue(id);
  vi.unstubAllGlobals();
  sender.registerRebuilder(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const sending = sender.processQueue();
  expect(finish).toBeTypeOf('function');
  unlock();
  expect(await cancel).toBe(false);
  expect(read(KEY).map((x) => x.id)).toEqual([id]);
  finish({ success: true });
  expect(await drain(sending)).toMatchObject({ success: true, processed: 1 });
});

it('failed durable claim does not send and a retry recovers without a new identity', async () => {
  const queue = new OfflineQueue();
  const id = seedLegacyTask(queue);
  const send = vi.fn(async () => ({ success: true }));
  queue.registerRebuilder(send);
  uni.setStorageSync.mockImplementation((key, value) => {
    if (key === KEY && value.some((task) => task.state === 'sending')) throw Error('write unavailable');
    return set(key, value);
  });
  expect(await queue.processQueue()).toMatchObject({ success: false, reason: 'storage_unavailable' });
  expect(send).not.toHaveBeenCalled();
  expect(queue.processing).toBe(false);
  uni.setStorageSync.mockImplementation(set);
  expect(await drain(queue.processQueue())).toMatchObject({ success: true, processed: 1 });
  expect(send).toHaveBeenCalledExactlyOnceWith({ fixture: true }, expect.objectContaining({ taskId: id }));
});

it('a task canceled during the claim lock wait is never sent', async () => {
  const queue = new OfflineQueue();
  const id = seedLegacyTask(queue);
  const send = vi.fn(async () => ({ success: true }));
  queue.registerRebuilder(send);
  let calls = 0,
    unlock;
  vi.stubGlobal('navigator', {
    locks: {
      request: (_n, _o, fn) => {
        if (++calls === 2)
          return new Promise((resolve) => {
            unlock = () => resolve(fn());
          });
        return Promise.resolve(fn());
      }
    }
  });
  const pending = queue.processQueue();
  await vi.advanceTimersByTimeAsync(0);
  expect(unlock).toBeTypeOf('function');
  set(KEY, []);
  unlock();
  await drain(pending);
  expect(send).not.toHaveBeenCalled();
  expect(queue.dequeue(id)).toBe(false);
  expect(read(KEY)).toEqual([]);
});

it('loaded tasks that expire before processing are removed without a send', async () => {
  const queue = new OfflineQueue();
  seedLegacyTask(queue);
  const send = vi.fn(async () => ({ success: true }));
  queue.registerRebuilder(send);
  await vi.advanceTimersByTimeAsync(86400000);
  expect(await queue.processQueue()).toMatchObject({ success: true, processed: 0 });
  expect(send).not.toHaveBeenCalled();
  expect(read(KEY)).toEqual([]);
});

it('unbound old tasks and foreign owners are preserved and never claimed by a new account', async () => {
  const queue = new OfflineQueue();
  const one = seedLegacyTask(queue);
  set(KEY, [...read(KEY), { id: 'unbound', timestamp: Date.now(), requestData: { old: true } }]);
  login(2);
  const restored = new OfflineQueue();
  const send = vi.fn(async () => ({ success: true }));
  restored.registerRebuilder(send);
  expect(await restored.processQueue()).toMatchObject({ success: true, processed: 0 });
  expect(send).not.toHaveBeenCalled();
  expect(read(KEY).map((x) => x.id)).toEqual([one, 'unbound']);
});

it('missing rebuilder reports unsynced, retains the legacy body, then drains after registration', async () => {
  const queue = new OfflineQueue();
  const id = seedLegacyTask(queue, { state: undefined, retryCount: 2 });
  expect(queue.queue[0]).toMatchObject({ id, state: 'retry', retryCount: 2 });
  expect(await drain(queue.processQueue())).toMatchObject({ success: false, reason: 'request_unavailable', failed: 1 });
  expect(read(KEY)[0]).toMatchObject({ id, retryCount: 2 });
  queue.registerRebuilder(async () => ({ success: true }));
  expect(await drain(queue.processQueue())).toMatchObject({ success: true, processed: 1 });
});

it('queue network recovery drains preinstalled legacy tasks through its rebuilder', async () => {
  const callbacks = [];
  uni.onNetworkStatusChange = vi.fn((fn) => callbacks.push(fn));
  const queue = new OfflineQueue();
  seedLegacyTask(queue);
  const send = vi.fn(async () => ({ success: true }));
  queue.registerRebuilder(send);
  const change = callbacks.at(-1);
  change({ isConnected: false, networkType: 'none' });
  change({ isConnected: true, networkType: 'wifi' });
  await vi.runAllTimersAsync();
  expect(send).toHaveBeenCalledTimes(1);
  expect(read(KEY)).toEqual([]);
});

it('network-monitor recovery triggers the existing delayed singleton processing', async () => {
  seedLegacyTask(offlineQueue, { session: captureSession() });
  offlineQueue.isOnline = true;
  const send = vi.fn(async () => ({ success: true }));
  offlineQueue.registerRebuilder(send);
  networkMonitor._networkChangeHandler({ isConnected: false, networkType: 'none' });
  networkMonitor._networkChangeHandler({ isConnected: true, networkType: 'wifi' });
  await vi.advanceTimersByTimeAsync(999);
  expect(send).not.toHaveBeenCalled();
  await vi.runAllTimersAsync();
  expect(send).toHaveBeenCalledTimes(1);
  expect(read(KEY)).toEqual([]);
});

it('failed legacy transport retries the same task id and body, then confirms it', async () => {
  const queue = new OfflineQueue();
  const id = seedLegacyTask(queue, { retryCount: 2 });
  const send = vi.fn().mockRejectedValueOnce(Error('fixture')).mockResolvedValue({ success: true });
  queue.registerRebuilder(send);
  expect(await drain(queue.processQueue())).toMatchObject({ success: false, failed: 1 });
  expect(queue.queue[0]).toMatchObject({ id, state: 'retry', retryCount: 3 });
  expect(await drain(queue.processQueue())).toMatchObject({ success: true, processed: 1 });
  expect(send.mock.calls.map(([, context]) => context.taskId)).toEqual([id, id]);
  expect(read(KEY)).toEqual([]);
});
