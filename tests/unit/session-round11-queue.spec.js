import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { storageService } from '@/services/storageService.js';
import { OfflineQueue } from '@/utils/core/offline-queue.js';
const KEY = 'EXAM_OFFLINE_QUEUE';
const read = uni.getStorageSync.getMockImplementation();
const set = uni.setStorageSync.getMockImplementation();
beforeEach(() => {
  uni.clearStorageSync();
  storageService.saveLoginSession({ userId: 'account-1', token: 'fixture-1' });
  vi.useFakeTimers();
  uni.getStorageSync.mockImplementation((key) => (key === KEY ? structuredClone(read(key)) : read(key)));
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  uni.getStorageSync.mockImplementation(read);
  uni.setStorageSync.mockImplementation(set);
});

it.each(['pending', 'sending', 'confirmed', 'missing'])(
  'fixes-20-02 / order-20-02: replay failed dedupe write before persistence with target %s',
  async (state) => {
    const queue = new OfflineQueue();
    const id = await queue.enqueue({ requestData: { value: 1 }, dedupeKey: 'save' });
    uni.setStorageSync.mockImplementation((key, value) => {
      if (key === KEY) throw new Error('write failed before persistence');
      return set(key, value);
    });
    expect(await queue.enqueue({ requestData: { value: 2 }, dedupeKey: 'save' })).toBe(id);
    expect(read(KEY)[0].requestData.value).toBe(1);
    expect(queue.pendingEnqueues.size).toBe(1);
    uni.setStorageSync.mockImplementation(set);
    if (state === 'missing') set(KEY, []);
    else set(KEY, [{ ...read(KEY)[0], state }]);
    const sent = [];
    queue.registerRebuilder(async (body, context) => {
      sent.push({ value: body.value, id: context.taskId });
      return { success: true };
    });
    // Inspect durable replay before transport can alter or remove it.
    queue._loadFromStorage();
    expect(await queue._saveToStorage()).toBe(true);
    const updated = read(KEY).find((item) => item.requestData?.value === 2);
    expect(updated).toBeDefined();
    expect(updated.id === id).toBe(state === 'pending');
    if (state === 'pending') expect(updated.version).toBe(2);
    expect(queue.pendingEnqueues.size).toBe(0);
    const processing = queue.processQueue();
    await vi.runAllTimersAsync();
    await processing;
    expect(sent.filter((item) => item.value === 2)).toEqual([{ value: 2, id: updated.id }]);
  }
);

it('fixes-20-02: ordered dedupe replays survive repeated writes and failed verification without incrementing twice', async () => {
  const queue = new OfflineQueue();
  const id = await queue.enqueue({ requestData: { value: 1 }, dedupeKey: 'save' });
  uni.setStorageSync.mockImplementation((key, value) => {
    if (key === KEY) throw new Error('write unavailable');
    return set(key, value);
  });
  await queue.enqueue({ requestData: { value: 2 }, dedupeKey: 'save' });
  await queue.enqueue({ requestData: { value: 3 }, dedupeKey: 'save' });
  expect(queue.pendingEnqueues.size).toBe(2);
  uni.setStorageSync.mockImplementation((key, value) => {
    const result = set(key, value);
    if (key === KEY)
      uni.getStorageSync.mockImplementation((name) => {
        if (name === KEY) throw new Error('verification unavailable');
        return read(name);
      });
    return result;
  });
  expect(await queue._saveToStorage()).toBe(false);
  expect(queue.pendingEnqueues.size).toBe(2);
  expect(read(KEY)).toEqual([expect.objectContaining({ id, version: 3, requestData: { value: 3 } })]);
  uni.setStorageSync.mockImplementation(set);
  uni.getStorageSync.mockImplementation(read);
  expect(await queue._saveToStorage()).toBe(true);
  expect(read(KEY)).toEqual([expect.objectContaining({ id, version: 3, requestData: { value: 3 } })]);
  expect(queue.pendingEnqueues.size).toBe(0);
});

it('fixes-20-02: processQueue retains failed replay until durable confirmation and sends only the new body', async () => {
  const queue = new OfflineQueue();
  const id = await queue.enqueue({ requestData: { value: 1 }, dedupeKey: 'save' });
  uni.setStorageSync.mockImplementation((key, value) => {
    if (key === KEY) throw new Error('write unavailable');
    return set(key, value);
  });
  await queue.enqueue({ requestData: { value: 2 }, dedupeKey: 'save' });
  const send = vi.fn(async () => ({ success: true }));
  queue.registerRebuilder(send);
  expect(await queue.processQueue()).toMatchObject({ success: false, reason: 'storage_unavailable' });
  expect(queue.pendingEnqueues.size).toBe(1);
  expect(send).not.toHaveBeenCalled();
  uni.setStorageSync.mockImplementation(set);
  const pending = queue.processQueue();
  await vi.runAllTimersAsync();
  await pending;
  expect(send).toHaveBeenCalledExactlyOnceWith({ value: 2 }, expect.objectContaining({ taskId: id }));
  expect(queue.pendingEnqueues.size).toBe(0);
  expect(read(KEY)).toEqual([]);
});

it('fixes-20-02: an active claim forbids replay merging even when durable state still says pending', async () => {
  const queue = new OfflineQueue();
  const id = await queue.enqueue({ requestData: { value: 1 }, dedupeKey: 'save' });
  const sender = new OfflineQueue();
  uni.setStorageSync.mockImplementation((key, value) => {
    if (key === KEY) throw new Error('write unavailable');
    return set(key, value);
  });
  await queue.enqueue({ requestData: { value: 2 }, dedupeKey: 'save' });
  uni.setStorageSync.mockImplementation(set);
  let release;
  sender.registerRebuilder(
    () =>
      new Promise((resolve) => {
        release = resolve;
      })
  );
  const sending = sender.processQueue();
  await vi.advanceTimersByTimeAsync(0);
  try {
    expect(release).toBeTypeOf('function');
    set(KEY, [{ ...read(KEY)[0], state: 'pending' }]);
    expect(await queue._saveToStorage()).toBe(true);
    const newTask = read(KEY).find((item) => item.requestData.value === 2);
    expect(newTask.id).not.toBe(id);
    expect(read(KEY).find((item) => item.id === id).requestData.value).toBe(1);
    expect(queue.pendingEnqueues.size).toBe(0);
  } finally {
    release?.({ success: true });
    await vi.runAllTimersAsync();
    await sending;
  }
});
