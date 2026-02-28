/**
 * offline-queue.js 单元测试
 *
 * 覆盖目标：OfflineQueue 核心方法
 * - enqueue: 正常入队 / 优先级排序 / 去重 / 队列满 / 队列满+全高优先级
 * - dequeue: 存在 / 不存在
 * - processQueue: 正常处理 / 离线 / 暂停 / 重试 / 超过重试次数 / rebuilder
 * - clear / getStatus / addListener / pause / resume
 * - _loadFromStorage: 过期清理 / 损坏数据
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/storageService.js', () => ({
  default: {
    get: vi.fn(() => null),
    save: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

import storageService from '../../src/services/storageService.js';

// 确保 uni 不存在，让 OfflineQueue 使用 compat 层
delete globalThis.uni;

describe('OfflineQueue', () => {
  let OfflineQueue, queue;

  beforeEach(async () => {
    vi.clearAllMocks();
    storageService.get.mockReturnValue(null);

    const mod = await import('../../src/utils/core/offline-queue.js');
    OfflineQueue = mod.OfflineQueue;
    queue = new OfflineQueue();
  });

  // ==================== enqueue ====================
  describe('enqueue', () => {
    it('正常入队并返回 ID', () => {
      const id = queue.enqueue({
        requestFn: () => Promise.resolve(),
        requestData: { url: '/api/test' },
        priority: 'normal'
      });

      expect(id).toBeTruthy();
      expect(queue.queue.length).toBe(1);
      expect(storageService.save).toHaveBeenCalled();
    });

    it('高优先级排在低优先级前面', () => {
      queue.enqueue({ requestFn: () => {}, priority: 'low' });
      queue.enqueue({ requestFn: () => {}, priority: 'critical' });
      queue.enqueue({ requestFn: () => {}, priority: 'normal' });

      expect(queue.queue[0].priority).toBe('critical');
    });

    it('去重：相同 dedupeKey 更新已有请求', () => {
      const id1 = queue.enqueue({
        requestFn: () => {},
        requestData: { v: 1 },
        dedupeKey: 'save-data'
      });

      const id2 = queue.enqueue({
        requestFn: () => {},
        requestData: { v: 2 },
        dedupeKey: 'save-data'
      });

      expect(id1).toBe(id2);
      expect(queue.queue.length).toBe(1);
      expect(queue.queue[0].requestData.v).toBe(2);
    });

    it('队列满时移除低优先级请求', () => {
      // 填满队列
      for (let i = 0; i < 100; i++) {
        queue.enqueue({ requestFn: () => {}, priority: 'low' });
      }
      expect(queue.queue.length).toBe(100);

      // 再添加一个
      const id = queue.enqueue({ requestFn: () => {}, priority: 'high' });
      expect(id).toBeTruthy();
      expect(queue.queue.length).toBe(100); // 移除了一个低优先级
    });

    it('队列满且全是高优先级 → 返回 null', () => {
      for (let i = 0; i < 100; i++) {
        queue.enqueue({ requestFn: () => {}, priority: 'critical' });
      }

      const id = queue.enqueue({ requestFn: () => {}, priority: 'critical' });
      expect(id).toBeNull();
    });

    it('通知 listener', () => {
      const listener = vi.fn();
      queue.addListener(listener);

      queue.enqueue({ requestFn: () => {} });

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'enqueue' }));
    });
  });

  // ==================== dequeue ====================
  describe('dequeue', () => {
    it('移除存在的请求 → true', () => {
      const id = queue.enqueue({ requestFn: () => {} });
      expect(queue.dequeue(id)).toBe(true);
      expect(queue.queue.length).toBe(0);
    });

    it('移除不存在的请求 → false', () => {
      expect(queue.dequeue('nonexistent')).toBe(false);
    });

    it('通知 listener', () => {
      const listener = vi.fn();
      const id = queue.enqueue({ requestFn: () => {} });
      queue.addListener(listener);

      queue.dequeue(id);

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ type: 'dequeue' }));
    });
  });

  // ==================== processQueue ====================
  describe('processQueue', () => {
    it('正常处理队列中的请求', async () => {
      const fn = vi.fn(() => Promise.resolve());
      queue.enqueue({ requestFn: fn });

      const result = await queue.processQueue();

      expect(result.success).toBe(true);
      expect(result.processed).toBe(1);
      expect(result.failed).toBe(0);
      expect(fn).toHaveBeenCalled();
    });

    it('离线时不处理', async () => {
      queue.isOnline = false;
      queue.enqueue({ requestFn: () => Promise.resolve() });

      const result = await queue.processQueue();
      expect(result.success).toBe(false);
      expect(result.reason).toBe('offline');
    });

    it('暂停时不处理', async () => {
      queue.pause();
      queue.enqueue({ requestFn: () => Promise.resolve() });

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
      queue.enqueue({ requestFn: fn });

      await queue.processQueue();

      // retryCount 增加但仍在队列中
      expect(queue.queue.length).toBe(1);
      expect(queue.queue[0].retryCount).toBe(1);
    });

    it('请求失败 + 重试次数 >= 3 → 移除', async () => {
      const fn = vi.fn(() => Promise.reject(new Error('fail')));
      queue.enqueue({ requestFn: fn });
      queue.queue[0].retryCount = 2; // 已重试 2 次

      await queue.processQueue();

      expect(queue.queue.length).toBe(0);
    });

    it('无 requestFn + 有 rebuilder → 使用 rebuilder', async () => {
      const rebuilder = vi.fn(() => Promise.resolve('rebuilt'));
      queue.registerRebuilder(rebuilder);

      // 入队时不提供 requestFn，只提供 requestData
      const id = queue.enqueue({
        requestData: { url: '/api/test', method: 'POST' }
      });

      // 清除 requestFnMap 模拟持久化后函数引用丢失
      queue.requestFnMap.delete(id);

      await queue.processQueue();

      expect(rebuilder).toHaveBeenCalledWith({ url: '/api/test', method: 'POST' });
    });

    it('无 requestFn + 无 rebuilder → 跳过并移除', async () => {
      const id = queue.enqueue({ requestData: { url: '/test' } });
      queue.requestFnMap.delete(id);

      const result = await queue.processQueue();
      expect(result.failed).toBe(1);
      expect(queue.queue.length).toBe(0);
    });

    it('处理完成后通知 listener', async () => {
      const listener = vi.fn();
      queue.addListener(listener);
      queue.enqueue({ requestFn: () => Promise.resolve() });

      await queue.processQueue();

      const processEvent = listener.mock.calls.find((c) => c[0].type === 'processComplete');
      expect(processEvent).toBeDefined();
    });
  });

  // ==================== clear ====================
  describe('clear', () => {
    it('清空队列和 requestFnMap', () => {
      queue.enqueue({ requestFn: () => {} });
      queue.enqueue({ requestFn: () => {} });

      queue.clear();

      expect(queue.queue.length).toBe(0);
      expect(queue.requestFnMap.size).toBe(0);
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
      queue.enqueue({ requestFn: () => {}, priority: 'high' });

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
      queue.enqueue({ requestFn: () => Promise.resolve() });
      queue.pause();

      const spy = vi.spyOn(queue, 'processQueue');
      queue.resume();

      expect(spy).toHaveBeenCalled();
    });
  });

  // ==================== _loadFromStorage ====================
  describe('_loadFromStorage', () => {
    it('过滤过期请求', () => {
      const now = Date.now();
      storageService.get.mockReturnValue([
        { id: 'fresh', timestamp: now - 1000, priority: 'normal' },
        { id: 'expired', timestamp: now - 25 * 60 * 60 * 1000, priority: 'normal' }
      ]);

      queue._loadFromStorage();

      expect(queue.queue.length).toBe(1);
      expect(queue.queue[0].id).toBe('fresh');
    });

    it('存储数据损坏 → 空队列', () => {
      storageService.get.mockImplementation(() => {
        throw new Error('corrupt');
      });

      queue._loadFromStorage();

      expect(queue.queue).toEqual([]);
    });

    it('存储返回非数组 → 不加载', () => {
      storageService.get.mockReturnValue('not_an_array');

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
