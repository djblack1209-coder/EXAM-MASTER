/**
 * 请求重试拦截器 (Retry Interceptor)
 *
 * 功能：
 * 1. 自动重试失败的请求（最多3次）
 * 2. 指数退避策略（1s -> 2s -> 4s）
 * 3. 可配置重试条件（网络错误、超时、5xx错误）
 * 4. 支持取消重试
 * 5. 重试状态回调
 *
 * 使用示例：
 * import { retryInterceptor, withRetry } from '@/utils/retry-interceptor.js'
 *
 * // 方式1：包装单个请求
 * const result = await withRetry(() => http.get('/api/data'))
 *
 * // 方式2：全局配置
 * retryInterceptor.setConfig({ maxRetries: 5 })
 */

import { offlineQueue } from './offline-queue.js';
import { logger } from '@/utils/logger.js';

/**
 * 默认配置
 */
const DEFAULT_CONFIG = {
  maxRetries: 3, // 最大重试次数
  baseDelay: 1000, // 基础延迟时间（毫秒）
  maxDelay: 30000, // 最大延迟时间（毫秒）
  backoffFactor: 2, // 退避因子（指数退避）
  retryableStatusCodes: [408, 429, 500, 502, 503, 504], // 可重试的HTTP状态码
  retryOnNetworkError: true, // 网络错误时重试
  retryOnTimeout: true, // 超时时重试
  shouldRetry: null, // 自定义重试条件函数
  onRetry: null, // 重试回调
  onMaxRetriesExceeded: null // 超过最大重试次数回调
};

/**
 * 重试拦截器类
 */
class RetryInterceptor {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.retryingRequests = new Map(); // 正在重试的请求
    this.cancelTokens = new Map(); // 取消令牌
  }

  /**
   * 设置配置
   * @param {Object} config - 配置对象
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
    logger.log('[RetryInterceptor] 配置已更新:', this.config);
  }

  /**
   * 获取当前配置
   * @returns {Object} 当前配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 计算延迟时间（指数退避）
   * @param {number} retryCount - 当前重试次数
   * @returns {number} 延迟时间（毫秒）
   */
  calculateDelay(retryCount) {
    const delay = this.config.baseDelay * Math.pow(this.config.backoffFactor, retryCount);
    // 添加随机抖动（±10%）避免雷群效应
    const jitter = delay * 0.1 * (Math.random() * 2 - 1);
    return Math.min(delay + jitter, this.config.maxDelay);
  }

  /**
   * 判断是否应该重试
   * @param {Object} error - 错误对象
   * @param {number} retryCount - 当前重试次数
   * @returns {boolean} 是否应该重试
   */
  shouldRetry(error, retryCount) {
    // 超过最大重试次数
    if (retryCount >= this.config.maxRetries) {
      return false;
    }

    // 自定义重试条件
    if (typeof this.config.shouldRetry === 'function') {
      return this.config.shouldRetry(error, retryCount);
    }

    // 网络错误
    if (this.config.retryOnNetworkError && this.isNetworkError(error)) {
      return true;
    }

    // 超时错误
    if (this.config.retryOnTimeout && this.isTimeoutError(error)) {
      return true;
    }

    // HTTP状态码
    const statusCode = error.statusCode || error.status || error.response?.status;
    if (statusCode && this.config.retryableStatusCodes.includes(statusCode)) {
      return true;
    }

    return false;
  }

  /**
   * 判断是否为网络错误
   * @param {Object} error - 错误对象
   * @returns {boolean}
   */
  isNetworkError(error) {
    // uni-app 网络错误特征
    if (error.errMsg && (
      error.errMsg.includes('request:fail') ||
      error.errMsg.includes('网络') ||
      error.errMsg.includes('network')
    )) {
      return true;
    }

    // 通用网络错误
    if (error.message && (
      error.message.includes('Network Error') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('net::ERR')
    )) {
      return true;
    }

    return !error.statusCode && !error.status;
  }

  /**
   * 判断是否为超时错误
   * @param {Object} error - 错误对象
   * @returns {boolean}
   */
  isTimeoutError(error) {
    if (error.errMsg && error.errMsg.includes('timeout')) {
      return true;
    }

    if (error.message && error.message.toLowerCase().includes('timeout')) {
      return true;
    }

    return error.statusCode === 408 || error.code === 'ECONNABORTED';
  }

  /**
   * 延迟执行
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 执行带重试的请求
   * @param {Function} requestFn - 请求函数
   * @param {Object} options - 选项
   * @returns {Promise} 请求结果
   */
  async executeWithRetry(requestFn, options = {}) {
    const requestId = options.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const config = { ...this.config, ...options };

    let lastError = null;
    let retryCount = 0;

    // 注册取消令牌
    let cancelled = false;
    this.cancelTokens.set(requestId, () => {
      cancelled = true;
    });

    try {
      while (retryCount <= config.maxRetries) {
        // 检查是否已取消
        if (cancelled) {
          throw new Error('Request cancelled');
        }

        try {
          // 记录重试状态
          if (retryCount > 0) {
            this.retryingRequests.set(requestId, {
              retryCount,
              maxRetries: config.maxRetries,
              timestamp: Date.now()
            });

            // 重试回调
            if (typeof config.onRetry === 'function') {
              config.onRetry({
                requestId,
                retryCount,
                maxRetries: config.maxRetries,
                error: lastError
              });
            }

            logger.log(`[RetryInterceptor] 🔄 第 ${retryCount}/${config.maxRetries} 次重试...`);
          }

          // 执行请求
          const result = await requestFn();

          // 成功，清理状态
          this.retryingRequests.delete(requestId);
          this.cancelTokens.delete(requestId);

          if (retryCount > 0) {
            logger.log(`[RetryInterceptor] ✅ 重试成功（第 ${retryCount} 次）`);
          }

          return result;

        } catch (error) {
          lastError = error;

          // 判断是否应该重试
          if (!this.shouldRetry(error, retryCount)) {
            break;
          }

          // 计算延迟时间
          const delayMs = this.calculateDelay(retryCount);
          logger.log(`[RetryInterceptor] ⏳ ${delayMs}ms 后进行第 ${retryCount + 1} 次重试...`);

          // 等待后重试
          await this.delay(delayMs);
          retryCount++;
        }
      }

      // 超过最大重试次数
      this.retryingRequests.delete(requestId);
      this.cancelTokens.delete(requestId);

      // 超过最大重试次数回调
      if (typeof config.onMaxRetriesExceeded === 'function') {
        config.onMaxRetriesExceeded({
          requestId,
          retryCount,
          error: lastError
        });
      }

      logger.log(`[RetryInterceptor] ❌ 重试 ${retryCount} 次后仍然失败`);

      // 如果是网络错误，加入离线队列
      if (this.isNetworkError(lastError) && options.offlineQueueable !== false) {
        logger.log('[RetryInterceptor] 📥 请求已加入离线队列');
        offlineQueue.enqueue({
          requestFn,
          options,
          error: lastError,
          timestamp: Date.now()
        });
      }

      throw lastError;

    } catch (error) {
      this.retryingRequests.delete(requestId);
      this.cancelTokens.delete(requestId);
      throw error;
    }
  }

  /**
   * 取消重试
   * @param {string} requestId - 请求ID
   */
  cancelRetry(requestId) {
    const cancelFn = this.cancelTokens.get(requestId);
    if (cancelFn) {
      cancelFn();
      this.retryingRequests.delete(requestId);
      this.cancelTokens.delete(requestId);
      logger.log(`[RetryInterceptor] 🚫 已取消重试: ${requestId}`);
    }
  }

  /**
   * 取消所有重试
   */
  cancelAllRetries() {
    this.cancelTokens.forEach((cancelFn, _requestId) => {
      cancelFn();
    });
    this.retryingRequests.clear();
    this.cancelTokens.clear();
    logger.log('[RetryInterceptor] 🚫 已取消所有重试');
  }

  /**
   * 获取正在重试的请求列表
   * @returns {Array} 重试中的请求
   */
  getRetryingRequests() {
    return Array.from(this.retryingRequests.entries()).map(([id, info]) => ({
      requestId: id,
      ...info
    }));
  }

  /**
   * 创建请求拦截器（用于 uni.addInterceptor）
   * @returns {Object} 拦截器配置
   */
  createUniInterceptor() {
    const self = this;

    return {
      invoke(args) {
        // 保存原始配置
        args._retryConfig = {
          originalSuccess: args.success,
          originalFail: args.fail,
          retryCount: 0
        };
        return args;
      },

      fail(err, args) {
        const retryConfig = args._retryConfig;

        if (self.shouldRetry(err, retryConfig.retryCount)) {
          retryConfig.retryCount++;
          const delay = self.calculateDelay(retryConfig.retryCount - 1);

          logger.log(`[RetryInterceptor] 🔄 第 ${retryConfig.retryCount}/${self.config.maxRetries} 次重试，延迟 ${delay}ms`);

          setTimeout(() => {
            uni.request(args);
          }, delay);

          return; // 阻止原始 fail 回调
        }

        // 不再重试，调用原始 fail
        if (retryConfig.originalFail) {
          retryConfig.originalFail(err);
        }
      }
    };
  }
}

// 创建单例
const retryInterceptor = new RetryInterceptor();

/**
 * 便捷函数：包装请求函数使其支持重试
 * @param {Function} requestFn - 请求函数
 * @param {Object} options - 重试选项
 * @returns {Promise} 请求结果
 */
export const withRetry = (requestFn, options = {}) => {
  return retryInterceptor.executeWithRetry(requestFn, options);
};

/**
 * 便捷函数：创建带重试的请求函数
 * @param {Function} requestFn - 原始请求函数
 * @param {Object} defaultOptions - 默认选项
 * @returns {Function} 带重试的请求函数
 */
export const createRetryableRequest = (requestFn, defaultOptions = {}) => {
  return (...args) => {
    return retryInterceptor.executeWithRetry(
      () => requestFn(...args),
      defaultOptions
    );
  };
};

// 导出
export { retryInterceptor };
export default retryInterceptor;
