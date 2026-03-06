/**
 * 智能 Router 单元测试
 * 测试路由配置、缓存机制、超时降级、指标统计等纯逻辑
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock 依赖
vi.mock('@/services/lafService.js', () => ({
  lafService: {
    proxyAI: vi.fn()
  }
}));
vi.mock('@/utils/logger.js', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// 动态导入以确保 mock 生效
const { aiRouter } = await import('@/pages/chat/ai-router.js');

describe('智能 Router', () => {
  beforeEach(() => {
    // 重置缓存和指标
    aiRouter.cache.clear();
    aiRouter.metrics = {
      totalCalls: 0,
      cacheHits: 0,
      fallbacks: 0,
      errors: 0,
      latencies: []
    };
    aiRouter.isInitialized = false;
    aiRouter.stopCacheCleanup();
  });

  afterEach(() => {
    aiRouter.stopCacheCleanup();
  });

  describe('缓存机制', () => {
    it('setToCache/getFromCache 应正确存取数据', () => {
      const data = { code: 0, data: '测试数据' };
      aiRouter.setToCache('test_key', data, 60);

      const result = aiRouter.getFromCache('test_key');
      expect(result).toEqual(data);
    });

    it('getFromCache 应返回 null 当 key 不存在', () => {
      expect(aiRouter.getFromCache('nonexistent')).toBeNull();
    });

    it('getFromCache 应返回 null 当缓存过期', () => {
      aiRouter.cache.set('expired_key', {
        value: { data: 'old' },
        expireAt: Date.now() - 1000, // 已过期
        createdAt: Date.now() - 5000
      });

      expect(aiRouter.getFromCache('expired_key')).toBeNull();
      // 过期项应被删除
      expect(aiRouter.cache.has('expired_key')).toBe(false);
    });

    it('cleanupCache 应清理所有过期项', () => {
      const now = Date.now();
      aiRouter.cache.set('valid', { value: 'ok', expireAt: now + 60000, createdAt: now });
      aiRouter.cache.set('expired1', { value: 'old1', expireAt: now - 1000, createdAt: now - 5000 });
      aiRouter.cache.set('expired2', { value: 'old2', expireAt: now - 2000, createdAt: now - 6000 });

      aiRouter.cleanupCache();

      expect(aiRouter.cache.size).toBe(1);
      expect(aiRouter.cache.has('valid')).toBe(true);
    });

    it('setToCache 超过1000条时应触发清理', () => {
      const spy = vi.spyOn(aiRouter, 'cleanupCache');
      for (let i = 0; i <= 1000; i++) {
        aiRouter.cache.set(`key_${i}`, { value: i, expireAt: Date.now() + 60000, createdAt: Date.now() });
      }
      // 手动触发一次 setToCache 使 size > 1000
      aiRouter.setToCache('overflow_key', 'data', 60);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('缓存 Key 生成', () => {
    it('相同输入应生成相同 key', () => {
      const key1 = aiRouter.generateCacheKey('chat', { content: '你好' });
      const key2 = aiRouter.generateCacheKey('chat', { content: '你好' });
      expect(key1).toBe(key2);
    });

    it('不同 action 应生成不同 key', () => {
      const key1 = aiRouter.generateCacheKey('chat', { content: '你好' });
      const key2 = aiRouter.generateCacheKey('analyze', { content: '你好' });
      expect(key1).not.toBe(key2);
    });

    it('不同 content 应生成不同 key', () => {
      const key1 = aiRouter.generateCacheKey('chat', { content: '你好' });
      const key2 = aiRouter.generateCacheKey('chat', { content: '再见' });
      expect(key1).not.toBe(key2);
    });

    it('key 格式应以 ai_cache: 开头', () => {
      const key = aiRouter.generateCacheKey('chat', { content: 'test' });
      expect(key).toMatch(/^ai_cache:chat:/);
    });
  });

  describe('超时机制', () => {
    it('executeWithTimeout 应在超时前返回结果', async () => {
      const fast = new Promise((resolve) => setTimeout(() => resolve('done'), 10));
      const result = await aiRouter.executeWithTimeout(fast, 1000);
      expect(result).toBe('done');
    });

    it('executeWithTimeout 应在超时后抛出 AI_TIMEOUT', async () => {
      const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 5000));
      await expect(aiRouter.executeWithTimeout(slow, 50)).rejects.toThrow('AI_TIMEOUT');
    });
  });

  describe('指标统计', () => {
    it('recordLatency 应记录延迟值', () => {
      aiRouter.recordLatency(100);
      aiRouter.recordLatency(200);
      expect(aiRouter.metrics.latencies).toEqual([100, 200]);
    });

    it('recordLatency 应限制最多1000条', () => {
      for (let i = 0; i < 1005; i++) {
        aiRouter.recordLatency(i);
      }
      expect(aiRouter.metrics.latencies.length).toBe(1000);
      // 最早的5条应被移除
      expect(aiRouter.metrics.latencies[0]).toBe(5);
    });

    it('getMetrics 应返回正确的统计数据', () => {
      aiRouter.recordLatency(100);
      aiRouter.recordLatency(200);
      aiRouter.recordLatency(300);
      aiRouter.metrics.totalCalls = 10;
      aiRouter.metrics.cacheHits = 3;

      const metrics = aiRouter.getMetrics();
      expect(metrics.totalCalls).toBe(10);
      expect(metrics.cacheHitRate).toBe('30.00%');
      expect(metrics.latency.avg).toBe(200);
    });

    it('getMetrics 空延迟数组不应报错', () => {
      const metrics = aiRouter.getMetrics();
      expect(metrics.latency.avg).toBe(0);
      expect(metrics.latency.p50).toBe(0);
      expect(metrics.latency.p95).toBe(0);
    });
  });

  describe('请求ID生成', () => {
    it('generateRequestId 应返回唯一ID', () => {
      const id1 = aiRouter.generateRequestId();
      const id2 = aiRouter.generateRequestId();
      expect(id1).not.toBe(id2);
    });

    it('generateRequestId 应以 req_ 开头', () => {
      const id = aiRouter.generateRequestId();
      expect(id).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });

  describe('定时器清理', () => {
    it('stopCacheCleanup 应清除定时器', () => {
      aiRouter.init();
      expect(aiRouter._cacheCleanupTimer).not.toBeNull();

      aiRouter.stopCacheCleanup();
      expect(aiRouter._cacheCleanupTimer).toBeNull();
    });

    it('重复 init 不应创建多个定时器', () => {
      aiRouter.init();
      const _timer1 = aiRouter._cacheCleanupTimer;
      aiRouter.isInitialized = false;
      aiRouter.init();
      // 旧定时器应被替换（startCacheCleanup 内部先 clear 再 set）
      expect(aiRouter._cacheCleanupTimer).not.toBeNull();
      aiRouter.stopCacheCleanup();
    });
  });
});
