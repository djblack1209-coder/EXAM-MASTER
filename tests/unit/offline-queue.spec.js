import { captureSession } from '@/services/auth-storage.js';
// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

const QUEUE_STORAGE_KEY = '__exam_offline_queue__:EXAM_OFFLINE_QUEUE';

function clearOfflineQueueStorage() {
  if (typeof localStorage === 'undefined') return;
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('__exam_offline_queue__:')) {
      keys.push(key);
    }
  }
  keys.forEach((key) => localStorage.removeItem(key));
}

// 确保 uni 不存在，让 OfflineQueue 使用 compat 层
delete globalThis.uni;

describe('OfflineQueue', () => {
  let OfflineQueue, queue;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    clearOfflineQueueStorage();

    const mod = await import('../../src/utils/core/offline-queue.js');
    OfflineQueue = mod.OfflineQueue;
    queue = new OfflineQueue();
  });

  function seedLegacyTask(queue, { requestFn, ...fields } = {}) {
    const task = {
      id: `legacy-${Date.now()}-${Math.random()}`,
      timestamp: Date.now(),
      retryCount: 0,
      priority: 'normal',
      requestData: { fixture: true },
      session: captureSession(),
      ...fields
    };
    const stored = JSON.parse(localStorage.getItem(QUEUE_STORAGE_KEY) || '[]');
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify([...stored, task]));
    queue._loadFromStorage();
    if (requestFn) queue.registerRebuilder(requestFn);
    return task.id;
  }

  it('restores legacy priority order', () => {
    seedLegacyTask(queue, { priority: 'low' });
    seedLegacyTask(queue, { priority: 'critical' });
    seedLegacyTask(queue, { priority: 'normal' });
    expect(queue.queue.map((item) => item.priority)).toEqual(['critical', 'normal', 'low']);
  });

  // ==================== dequeue ====================
  describe('dequeue', () => {
    it('移除存在的请求 → true', () => {
      const id = seedLegacyTask(queue, { requestFn: () => {} });
      expect(queue.dequeue(id)).toBe(true);
      expect(queue.queue.length).toBe(0);
    });

    it('移除不存在的请求 → false', () => {
      expect(queue.dequeue('nonexistent')).toBe(false);
    });

    it('通知 listener', () => {
      const listener = vi.fn();
      const id = seedLegacyTask(queue, { requestFn: () => {} });
      queue.addListener(listener);

      queue.dequeue(id);

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'dequeue' }));
    });
  });

  // ==================== processQueue ====================
  describe('processQueue', () => {
    it('正常处理队列中的请求', async () => {
      const fn = vi.fn(() => Promise.resolve());
      seedLegacyTask(queue, { requestFn: fn });

      const result = await queue.processQueue();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(fn).toHaveBeenCalled();
    });

    it('离线时不处理', async () => {
      queue.isOnline = false;
      seedLegacyTask(queue, { requestFn: () => Promise.resolve() });

      const result = await queue.processQueue();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('offline');
    });

    it('暂停时不处理', async () => {
      queue.pause();
      seedLegacyTask(queue, { requestFn: () => Promise.resolve() });

      const result = await queue.processQueue();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('paused');
    });

    it('空队列 → 直接返回成功', async () => {
      const result = await queue.processQueue();
      expect(result.success).toBe(true);
      expect(result.processed).toBe(0);
    });

    it('请求失败 + 重试次数 < 3 → 保留在队列', async () => {
      const fn = vi.fn(() => Promise.reject(new Error('fail')));
      seedLegacyTask(queue, { requestFn: fn });

      await queue.processQueue();

      // retryCount 增加但仍在队列中
      expect(queue.queue.length).toBe(1);
      expect(queue.queue[0].retryCount).toBe(1);
    });

    it('请求失败 + 重试次数 >= 3 → 保留失败待重试', async () => {
      const fn = vi.fn(() => Promise.reject(new Error('fail')));
      seedLegacyTask(queue, { requestFn: fn });
      queue.queue[0].retryCount = 2; // 已重试 2 次
      queue._saveToStorage(queue.queue[0]);

      await queue.processQueue();

      expect(queue.queue).toEqual([expect.objectContaining({ state: 'retry', retryCount: 3 })]);
    });

    it('无 requestFn + 有 rebuilder → 使用 rebuilder', async () => {
      const rebuilder = vi.fn(() => Promise.resolve('rebuilt'));
      queue.registerRebuilder(rebuilder);

      seedLegacyTask(queue, {
        requestData: { url: '/api/test', method: 'POST' }
      });

      await queue.processQueue();

      expect(rebuilder).toHaveBeenCalledWith(
        { url: '/api/test', method: 'POST' },
        { session: captureSession(), taskId: expect.any(String) }
      );
    });

    it('无 requestFn + 无 rebuilder → 保留失败待重试', async () => {
      seedLegacyTask(queue, { requestData: { url: '/test' } });

      const result = await queue.processQueue();
      expect(result.failed).toBe(1);
      expect(queue.queue[0]).toMatchObject({ state: 'retry', retryCount: 0 });
    });

    it('处理完成后通知 listener', async () => {
      const listener = vi.fn();
      queue.addListener(listener);
      seedLegacyTask(queue, { requestFn: () => Promise.resolve() });

      await queue.processQueue();

      const processEvent = listener.mock.calls.find((c) => c[0].type === 'processComplete');
      expect(processEvent).toBeDefined();
    });
  });

  // ==================== clear ====================
  describe('clear', () => {
    it('清空已载入队列', () => {
      seedLegacyTask(queue, { requestFn: () => {} });
      seedLegacyTask(queue, { requestFn: () => {} });

      queue.clear();

      expect(queue.queue.length).toBe(0);
    });

    it('通知 listener', () => {
      const listener = vi.fn();
      queue.addListener(listener);

      queue.clear();

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'clear', queueLength: 0 }));
    });
  });

  // ==================== getStatus ====================
  describe('getStatus', () => {
    it('返回正确的状态信息', () => {
      seedLegacyTask(queue, { requestFn: () => {}, priority: 'high' });

      const status = queue.getStatus();

      expect(status.queueLength).toBe(1);
      expect(status.isProcessing).toBe(false);
      expect(status.isOnline).toBe(true);
      expect(status.items[0].priority).toBe('high');
      expect(status.items[0].age).toBeDefined();
    });
  });

  // ==================== addListener ====================
  describe('addListener', () => {
    it('返回取消监听函数', () => {
      const listener = vi.fn();
      const unsubscribe = queue.addListener(listener);

      queue.clear(); // 触发事件
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      queue.clear();
      expect(listener).toHaveBeenCalledTimes(1); // 不再触发
    });

    it('listener 抛异常不影响其他 listener', () => {
      const badListener = vi.fn(() => {
        throw new Error('boom');
      });
      const goodListener = vi.fn();

      queue.addListener(badListener);
      queue.addListener(goodListener);

      queue.clear();

      expect(badListener).toHaveBeenCalled();
      expect(goodListener).toHaveBeenCalled();
    });
  });

  // ==================== pause / resume ====================
  describe('pause / resume', () => {
    it('pause 设置 paused 标志', () => {
      queue.pause();
      expect(queue.paused).toBe(true);
    });

    it('resume 清除 paused 标志', () => {
      queue.pause();
      queue.resume();
      expect(queue.paused).toBe(false);
    });

    it('resume 时在线且有请求 → 自动处理', () => {
      seedLegacyTask(queue, { requestFn: () => Promise.resolve() });
      queue.pause();

      const spy = vi.spyOn(queue, 'processQueue').mockResolvedValue({ success: true });
      queue.resume();

      expect(spy).toHaveBeenCalled();
    });
  });

  // ==================== _loadFromStorage ====================
  describe('_loadFromStorage', () => {
    it('过滤过期请求', () => {
      const now = Date.now();
      localStorage.setItem(
        QUEUE_STORAGE_KEY,
        JSON.stringify([
          { id: 'fresh', session: captureSession(), timestamp: now - 1000, priority: 'normal' },
          { id: 'expired', session: captureSession(), timestamp: now - 25 * 60 * 60 * 1000, priority: 'normal' }
        ])
      );

      queue._loadFromStorage();

      expect(queue.queue.length).toBe(1);
      expect(queue.queue[0].id).toBe('fresh');
    });

    it('存储数据损坏 → 空队列', () => {
      localStorage.setItem(QUEUE_STORAGE_KEY, '{invalid_json');

      queue._loadFromStorage();

      expect(queue.queue).toEqual([]);
    });

    it('存储返回非数组 → 不加载', () => {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify('not_an_array'));

      queue._loadFromStorage();

      expect(queue.queue.length).toBe(0);
    });
  });

  // ==================== registerRebuilder ====================
  describe('registerRebuilder', () => {
    it('注册重建函数', () => {
      const fn = vi.fn();
      queue.registerRebuilder(fn);
      expect(queue._rebuilder).toBe(fn);
    });
  });
});

it('MIGRATE-14-04: failed H5 restore never overwrites unread pending body', async () => {
  vi.resetModules();
  const prefix = '__exam_offline_queue__:EXAM_OFFLINE_QUEUE';
  localStorage.setItem(
    prefix,
    JSON.stringify([
      {
        id: 'old-pending',
        priority: 'normal',
        timestamp: Date.now(),
        retryCount: 2,
        session: captureSession(),
        requestData: { answer: 'original' }
      }
    ])
  );
  const get = localStorage.getItem.getMockImplementation();
  let unavailable = true;
  const read = vi.spyOn(localStorage, 'getItem').mockImplementation((key) => {
    if (key === prefix && unavailable) throw Error('fixture restore failure');
    return get(key);
  });
  try {
    const { OfflineQueue } = await import('../../src/utils/core/offline-queue.js');
    const queue = new OfflineQueue();
    queue.isOnline = false;
    queue.isOnline = true;
    expect(await queue.processQueue()).toMatchObject({ success: false, reason: 'storage_unavailable' });
    expect(JSON.parse(get(prefix))).toHaveLength(1);
    expect(JSON.parse(get(prefix))[0].requestData).toEqual({ answer: 'original' });
    unavailable = false;
    const send = vi.fn(async () => ({ success: true }));
    queue.registerRebuilder(send);
    expect(await queue.processQueue()).toMatchObject({ success: true, processed: 1 });
    expect(send).toHaveBeenCalledWith({ answer: 'original' }, expect.objectContaining({ taskId: 'old-pending' }));
    expect(JSON.parse(get(prefix))).toEqual([]);
  } finally {
    read.mockRestore();
  }
});
