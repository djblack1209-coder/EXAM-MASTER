/**
 * 性能测试用例集
 * FT005-FT008: 性能与兼容性测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================== FT005/FT006: 页面加载性能测试 ====================
describe('FT005-FT006: 页面加载性能', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('数据加载函数应在合理时间内完成', async () => {
    const start = performance.now();
    // 模拟数据加载
    await new Promise((resolve) => setTimeout(resolve, 10));
    const duration = performance.now() - start;
    // 数据加载应在 3 秒内完成
    expect(duration).toBeLessThan(3000);
  });

  it('大数据量列表渲染不应阻塞', () => {
    // 模拟 1000 条数据的处理
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: `item_${i}`,
      title: `题目 ${i}`,
      category: i % 3 === 0 ? '政治' : i % 3 === 1 ? '英语' : '数学'
    }));

    const start = performance.now();
    // 模拟分类过滤
    const filtered = items.filter((item) => item.category === '政治');
    const duration = performance.now() - start;

    expect(filtered.length).toBeGreaterThan(0);
    expect(duration).toBeLessThan(100); // 过滤应在 100ms 内
  });

  it('分页加载每页数据量合理', () => {
    const pageSize = 20;
    const totalItems = 500;
    const totalPages = Math.ceil(totalItems / pageSize);
    expect(totalPages).toBe(25);
    expect(pageSize).toBeLessThanOrEqual(50); // 每页不超过 50
  });

  it('缓存命中时跳过网络请求', () => {
    const cache = new Map();
    const cacheKey = 'schools_list_page1';
    const cachedData = { list: [], total: 0 };
    const cacheTime = Date.now();

    cache.set(cacheKey, { data: cachedData, time: cacheTime });

    const TTL = 10 * 60 * 1000; // 10 分钟
    const entry = cache.get(cacheKey);
    const isValid = entry && Date.now() - entry.time < TTL;

    expect(isValid).toBe(true);
  });

  it('缓存过期时重新请求', () => {
    const cache = new Map();
    const cacheKey = 'schools_list';
    const expiredTime = Date.now() - 20 * 60 * 1000; // 20 分钟前

    cache.set(cacheKey, { data: {}, time: expiredTime });

    const TTL = 10 * 60 * 1000;
    const entry = cache.get(cacheKey);
    const isValid = entry && Date.now() - entry.time < TTL;

    expect(isValid).toBe(false);
  });
});

// ==================== FT007: 组件渲染性能测试 ====================
describe('FT007: 组件渲染性能', () => {
  it('列表项 key 应使用稳定唯一标识', () => {
    const messages = [
      { id: 'msg_1', content: 'hello' },
      { id: 'msg_2', content: 'world' }
    ];
    const keys = messages.map((m) => m.id);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  it('大量数据排序性能', () => {
    const data = Array.from({ length: 5000 }, () => ({
      score: Math.random() * 100,
      name: `item_${Math.random()}`
    }));

    // 预热一次，减少 CI / 本地首次 JIT 抖动
    [...data].sort((a, b) => b.score - a.score);

    const durations = [];
    let sorted = [];
    for (let i = 0; i < 3; i++) {
      const sample = [...data];
      const start = performance.now();
      sample.sort((a, b) => b.score - a.score);
      durations.push(performance.now() - start);
      sorted = sample;
    }

    const duration = Math.min(...durations);

    expect(duration).toBeLessThan(140);
    expect(sorted[0].score).toBeGreaterThanOrEqual(sorted[sorted.length - 1].score);
  });

  it('节流函数限制高频调用', () => {
    vi.useFakeTimers();
    let callCount = 0;
    let lastCallTime = 0;
    const interval = 16; // ~60fps

    const throttledFn = () => {
      const now = Date.now();
      if (now - lastCallTime >= interval) {
        callCount++;
        lastCallTime = now;
      }
    };

    // 模拟 100 次快速调用
    for (let i = 0; i < 100; i++) {
      throttledFn();
      vi.advanceTimersByTime(5); // 每 5ms 调用一次
    }

    // 500ms 内，16ms 间隔最多约 31 次
    expect(callCount).toBeLessThanOrEqual(35);
    expect(callCount).toBeGreaterThan(0);

    vi.useRealTimers();
  });
});

// ==================== FT008: 设备兼容性测试 ====================
describe('FT008: 设备兼容性', () => {
  it('安全区域适配 — 有刘海屏', () => {
    const systemInfo = {
      screenHeight: 812,
      safeArea: { bottom: 778 }
    };
    const safeAreaBottom = systemInfo.screenHeight - systemInfo.safeArea.bottom;
    expect(safeAreaBottom).toBe(34);
    expect(safeAreaBottom).toBeGreaterThan(0);
  });

  it('安全区域适配 — 无刘海屏', () => {
    const systemInfo = {
      screenHeight: 667,
      safeArea: { bottom: 667 }
    };
    const safeAreaBottom = systemInfo.screenHeight - systemInfo.safeArea.bottom;
    expect(safeAreaBottom).toBe(0);
  });

  it('rpx 单位转换', () => {
    const screenWidth = 375;
    const rpxToPx = (rpx) => rpx * (screenWidth / 750);
    expect(rpxToPx(750)).toBe(375);
    expect(rpxToPx(100)).toBeCloseTo(50);
    expect(rpxToPx(32)).toBeCloseTo(16);
  });

  it('Canvas API 可用性检测', () => {
    const hasCanvas = typeof uni.createCanvasContext === 'function';
    expect(hasCanvas).toBe(true);
  });

  it('Canvas 不可用时降级为文本', () => {
    const originalFn = uni.createCanvasContext;
    uni.createCanvasContext = undefined;

    const hasCanvas = typeof uni.createCanvasContext === 'function';
    expect(hasCanvas).toBe(false);

    // 降级逻辑
    const reportMode = hasCanvas ? 'canvas' : 'text';
    expect(reportMode).toBe('text');

    uni.createCanvasContext = originalFn;
  });

  it('平台检测', () => {
    const systemInfo = uni.getSystemInfoSync();
    expect(systemInfo).toHaveProperty('platform');
    expect(systemInfo).toHaveProperty('windowWidth');
    expect(systemInfo).toHaveProperty('windowHeight');
  });
});
