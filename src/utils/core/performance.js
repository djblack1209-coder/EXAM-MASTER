/**
 * 性能监控工具
 *
 * 防抖(debounce)和节流(throttle)请使用 @/utils/throttle.js，
 * 本文件仅提供性能监控(PerformanceMonitor)功能。
 *
 * [AUDIT FIX R135] 移除重复的 debounce/throttle 定义，统一到 throttle.js
 * 为保持向后兼容，default export 中仍 re-export throttle.js 的 debounce/throttle
 */

import { logger } from '@/utils/logger.js';
import { debounce, throttle } from '@/utils/throttle.js';

/**
 * 性能监控（含 API 响应时间 + 页面加载追踪）
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
    this.marks.set(name, typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
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
    const endTime = endMark
      ? this.marks.get(endMark)
      : typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();

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

export default {
  debounce,
  throttle,
  PerformanceMonitor,
  perfMonitor
};
