/**
 * 性能优化工具集
 * 包含防抖、节流、缓存、懒加载等性能优化函数
 */

import { logger } from '@/utils/logger.js';

/**
 * 防抖函数
 * @param {Function} fn - 要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @param {boolean} immediate - 是否立即执行
 * @returns {Function} 防抖后的函数
 */
export function debounce(fn, delay = 300, immediate = false) {
  let timer = null;
  let isInvoked = false;

  const debounced = function (...args) {
    const context = this;

    if (timer) {
      clearTimeout(timer);
    }

    if (immediate && !isInvoked) {
      fn.apply(context, args);
      isInvoked = true;
    }

    timer = setTimeout(() => {
      if (!immediate) {
        fn.apply(context, args);
      }
      isInvoked = false;
      timer = null;
    }, delay);
  };

  debounced.cancel = function () {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      isInvoked = false;
    }
  };

  return debounced;
}

/**
 * 节流函数
 * @param {Function} fn - 要节流的函数
 * @param {number} interval - 间隔时间（毫秒）
 * @param {Object} options - 配置选项
 * @returns {Function} 节流后的函数
 */
export function throttle(fn, interval = 300, options = {}) {
  const { leading = true, trailing = true } = options;
  let lastTime = 0;
  let timer = null;

  const throttled = function (...args) {
    const context = this;
    const now = Date.now();

    if (!lastTime && !leading) {
      lastTime = now;
    }

    const remaining = interval - (now - lastTime);

    if (remaining <= 0 || remaining > interval) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      lastTime = now;
      fn.apply(context, args);
    } else if (!timer && trailing) {
      timer = setTimeout(() => {
        lastTime = leading ? Date.now() : 0;
        timer = null;
        fn.apply(context, args);
      }, remaining);
    }
  };

  throttled.cancel = function () {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    lastTime = 0;
  };

  return throttled;
}

/**
 * 带缓存的计算函数
 * @param {Function} fn - 计算函数
 * @param {Function} resolver - 缓存键生成函数
 * @returns {Function} 带缓存的函数
 */
export function memoize(fn, resolver) {
  const cache = new Map();

  const memoized = function (...args) {
    const key = resolver ? resolver.apply(this, args) : args[0];

    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };

  memoized.cache = cache;
  memoized.clear = () => cache.clear();

  return memoized;
}

/**
 * 异步函数缓存
 * @param {Function} asyncFn - 异步函数
 * @param {number} ttl - 缓存时间（毫秒）
 * @returns {Function} 带缓存的异步函数
 */
export function memoizeAsync(asyncFn, ttl = 60000) {
  const cache = new Map();
  const pending = new Map();

  return async function (...args) {
    const key = JSON.stringify(args);
    const now = Date.now();

    // 检查缓存
    if (cache.has(key)) {
      const { value, timestamp } = cache.get(key);
      if (now - timestamp < ttl) {
        return value;
      }
      cache.delete(key);
    }

    // 检查是否有正在进行的请求
    if (pending.has(key)) {
      return pending.get(key);
    }

    // 发起新请求
    const promise = asyncFn.apply(this, args);
    pending.set(key, promise);

    try {
      const result = await promise;
      cache.set(key, { value: result, timestamp: now });
      return result;
    } finally {
      pending.delete(key);
    }
  };
}

/**
 * 请求空闲时执行
 * @param {Function} callback - 回调函数
 * @param {Object} options - 配置选项
 * @returns {number} 任务ID
 */
export function requestIdleCallback(callback, options = {}) {
  if (typeof window !== 'undefined' && window.requestIdleCallback) {
    return window.requestIdleCallback(callback, options);
  }

  // 降级处理
  const timeout = options.timeout || 1;
  return setTimeout(() => {
    callback({
      didTimeout: false,
      timeRemaining: () => Math.max(0, 50)
    });
  }, timeout);
}

/**
 * 取消空闲回调
 * @param {number} id - 任务ID
 */
export function cancelIdleCallback(id) {
  if (typeof window !== 'undefined' && window.cancelIdleCallback) {
    window.cancelIdleCallback(id);
  } else {
    clearTimeout(id);
  }
}

/**
 * 分批处理大数组
 * @param {Array} array - 要处理的数组
 * @param {Function} processor - 处理函数
 * @param {number} batchSize - 每批大小
 * @param {number} delay - 批次间延迟（毫秒）
 * @returns {Promise<Array>} 处理结果
 */
export async function batchProcess(array, processor, batchSize = 100, delay = 0) {
  const results = [];
  const total = array.length;

  for (let i = 0; i < total; i += batchSize) {
    const batch = array.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    if (delay > 0 && i + batchSize < total) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return results;
}

/**
 * 虚拟列表辅助函数
 * @param {Object} options - 配置选项
 * @returns {Object} 虚拟列表状态
 */
export function useVirtualList(options = {}) {
  const { itemHeight = 50, containerHeight = 500, overscan = 5, totalItems = 0 } = options;

  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const totalHeight = totalItems * itemHeight;

  return {
    getVisibleRange(scrollTop) {
      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const end = Math.min(totalItems, start + visibleCount + overscan * 2);
      return { start, end };
    },

    getItemStyle(index) {
      return {
        position: 'absolute',
        top: `${index * itemHeight}px`,
        height: `${itemHeight}px`,
        width: '100%'
      };
    },

    containerStyle: {
      height: `${totalHeight}px`,
      position: 'relative'
    },

    visibleCount,
    totalHeight
  };
}

/**
 * 性能监控（含 API 响应时间 + 页面加载追踪）
 * 6.3: 添加关键指标监控机制
 */
export class PerformanceMonitor {
  constructor() {
    this.marks = new Map();
    this.measures = [];
    /** @type {Array<{url: string, duration: number, status: number, timestamp: number}>} */
    this.apiMetrics = [];
    /** @type {Array<{page: string, duration: number, timestamp: number}>} */
    this.pageMetrics = [];
    /** @type {number} API 慢请求阈值（毫秒） */
    this.slowApiThreshold = 3000;
    /** @type {number} 页面慢加载阈值（毫秒） */
    this.slowPageThreshold = 2000;
    /** @type {number} 最大保留指标条数 */
    this.maxMetrics = 200;
  }

  /**
   * 标记开始时间
   * @param {string} name - 标记名称
   */
  mark(name) {
    this.marks.set(name, performance.now());
  }

  /**
   * 测量两个标记之间的时间
   * @param {string} name - 测量名称
   * @param {string} startMark - 开始标记
   * @param {string} [endMark] - 结束标记（可选，默认为当前时间）
   * @returns {number} 耗时（毫秒）
   */
  measure(name, startMark, endMark) {
    const startTime = this.marks.get(startMark);
    const endTime = endMark ? this.marks.get(endMark) : performance.now();

    if (startTime === undefined) {
      logger.warn(`Mark "${startMark}" not found`);
      return 0;
    }

    const duration = endTime - startTime;
    this.measures.push({ name, duration, timestamp: Date.now() });

    return duration;
  }

  /**
   * 记录 API 请求耗时
   * @param {string} url - 请求 URL
   * @param {number} duration - 耗时（毫秒）
   * @param {number} status - HTTP 状态码
   */
  trackApi(url, duration, status) {
    this.apiMetrics.push({ url, duration, status, timestamp: Date.now() });
    if (this.apiMetrics.length > this.maxMetrics) {
      this.apiMetrics = this.apiMetrics.slice(-this.maxMetrics);
    }
    if (duration > this.slowApiThreshold) {
      logger.warn(`[PerfMonitor] 慢请求: ${url} ${duration.toFixed(0)}ms (status=${status})`);
    }
  }

  /**
   * 记录页面加载耗时
   * @param {string} page - 页面路径
   * @param {number} duration - 耗时（毫秒）
   */
  trackPage(page, duration) {
    this.pageMetrics.push({ page, duration, timestamp: Date.now() });
    if (this.pageMetrics.length > this.maxMetrics) {
      this.pageMetrics = this.pageMetrics.slice(-this.maxMetrics);
    }
    if (duration > this.slowPageThreshold) {
      logger.warn(`[PerfMonitor] 慢页面: ${page} ${duration.toFixed(0)}ms`);
    }
  }

  /**
   * 获取 API 性能摘要
   * @returns {{ avgDuration: number, slowCount: number, total: number }}
   */
  getApiSummary() {
    if (this.apiMetrics.length === 0) return { avgDuration: 0, slowCount: 0, total: 0 };
    const total = this.apiMetrics.length;
    const avgDuration = this.apiMetrics.reduce((s, m) => s + m.duration, 0) / total;
    const slowCount = this.apiMetrics.filter((m) => m.duration > this.slowApiThreshold).length;
    return { avgDuration: Math.round(avgDuration), slowCount, total };
  }

  /**
   * 获取所有测量结果
   * @returns {Array} 测量结果列表
   */
  getMeasures() {
    return [...this.measures];
  }

  /**
   * 清除所有标记和测量
   */
  clear() {
    this.marks.clear();
    this.measures = [];
    this.apiMetrics = [];
    this.pageMetrics = [];
  }

  /**
   * 输出性能报告
   */
  report() {
    logger.log('--- Performance Report ---');
    this.measures.forEach(({ name, duration }) => {
      logger.log(`${name}: ${duration.toFixed(2)}ms`);
    });
    const apiSummary = this.getApiSummary();
    if (apiSummary.total > 0) {
      logger.log(`API: avg=${apiSummary.avgDuration}ms, slow=${apiSummary.slowCount}/${apiSummary.total}`);
    }
    logger.log('--- End Report ---');
  }
}

// 全局性能监控实例
export const perfMonitor = new PerformanceMonitor();

/**
 * 组件渲染性能追踪 mixin
 */
export const performanceMixin = {
  beforeCreate() {
    this._perfStartTime = performance.now();
  },

  mounted() {
    const duration = performance.now() - this._perfStartTime;
    if (duration > 100) {
      logger.warn(
        `[Performance] Component ${this.$options.name || 'Anonymous'} took ${duration.toFixed(2)}ms to mount`
      );
    }
  }
};

/**
 * 延迟加载组件
 * @param {Function} loader - 组件加载函数
 * @param {Object} options - 配置选项
 * @returns {Object} 异步组件定义
 */
export function lazyComponent(loader, options = {}) {
  const { delay = 200, timeout = 10000, loadingComponent = null, errorComponent = null } = options;

  return {
    loader,
    delay,
    timeout,
    loadingComponent,
    errorComponent,
    onError(error, retry, fail, attempts) {
      if (attempts <= 3) {
        retry();
      } else {
        fail();
      }
    }
  };
}

export default {
  debounce,
  throttle,
  memoize,
  memoizeAsync,
  requestIdleCallback,
  cancelIdleCallback,
  batchProcess,
  useVirtualList,
  PerformanceMonitor,
  perfMonitor,
  performanceMixin,
  lazyComponent
};
