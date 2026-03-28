/**
 * 全局错误处理器 v2.0
 * 统一处理 Vue 错误、运行时错误、未捕获 Promise rejection
 * 支持错误持久化、去重、开发环境 toast 提示
 */
import { logger } from '@/utils/logger.js';
import { storageService } from '@/services/storageService.js';
import { toast } from '@/utils/toast.js';

function _getStorage() {
  return storageService;
}

let _config = {};
const _errorLogs = [];
const MAX_MEMORY_LOGS = 50;
const MAX_STORAGE_LOGS = 100;

// 错误去重：短时间内相同错误只记录一次
const _recentErrors = new Map();
const DEDUP_WINDOW_MS = 5000;

function _extractErrorInfo(type, error) {
  let message = '';
  let stack = '';
  if (error === null || error === undefined) {
    message = 'Unknown error';
  } else if (typeof error === 'string') {
    message = error;
  } else if (error instanceof Error) {
    message = error.message || String(error);
    stack = error.stack || '';
  } else if (typeof error === 'object') {
    message = error.errMsg || error.message || error.msg || JSON.stringify(error).substring(0, 200);
    stack = error.stack || '';
  } else {
    message = String(error);
  }

  let page = 'unknown';
  try {
    const pages = getCurrentPages();
    if (pages.length > 0) {
      page = pages[pages.length - 1].route;
    }
  } catch (_) {
    /* getCurrentPages 可能未就绪 */
  }

  return { type, message, stack, page, timestamp: new Date().toISOString() };
}

function _isDuplicate(errorInfo) {
  const key = `${errorInfo.type}:${errorInfo.message}`;
  const now = Date.now();
  if (_recentErrors.has(key) && now - _recentErrors.get(key) < DEDUP_WINDOW_MS) {
    return true;
  }
  _recentErrors.set(key, now);
  // 定期清理过期条目
  if (_recentErrors.size > 100) {
    for (const [k, t] of _recentErrors) {
      if (now - t > DEDUP_WINDOW_MS) _recentErrors.delete(k);
    }
  }
  return false;
}

function _shouldIgnore(message) {
  return _config.ignorePatterns?.some((p) => p.test?.(String(message)));
}

function _handleError(type, error) {
  const errorInfo = _extractErrorInfo(type, error);

  if (_shouldIgnore(errorInfo.message)) return;
  if (_isDuplicate(errorInfo)) return;

  // 内存日志
  _errorLogs.push(errorInfo);
  if (_errorLogs.length > MAX_MEMORY_LOGS) _errorLogs.shift();

  // 持久化到本地存储
  try {
    const storage = _getStorage();
    const stored = storage ? storage.get('runtime_errors', []) : uni.getStorageSync('runtime_errors') || [];
    stored.push(errorInfo);
    if (stored.length > MAX_STORAGE_LOGS) {
      stored.splice(0, stored.length - MAX_STORAGE_LOGS);
    }
    if (storage) {
      storage.save('runtime_errors', stored);
    } else {
      uni.setStorageSync('runtime_errors', stored);
    }
  } catch (_) {
    /* 存储失败静默处理 */
  }

  // 控制台输出
  logger.error(`[${type}]`, errorInfo.message);
  if (errorInfo.stack) {
    logger.error('Stack:', errorInfo.stack);
  }

  // 开发环境 toast 提示
  if (_config.enableToast) {
    try {
      // #ifdef MP-WEIXIN
      if (typeof __wxConfig !== 'undefined' && __wxConfig.envVersion === 'develop') {
        toast.info(`错误: ${errorInfo.message.substring(0, 20)}...`, 3000);
      }
      // #endif
    } catch (_) {
      /* toast 失败静默处理 */
    }
  }

  // 回调
  _config.onError?.(errorInfo);
}

export const globalErrorHandler = {
  /**
   * 初始化全局错误处理器
   * 注册 uni.onError 和 uni.onUnhandledRejection
   */
  init(config = {}) {
    _config = config;

    if (typeof uni !== 'undefined') {
      if (uni.onError) {
        uni.onError((err) => _handleError('Runtime Error', err));
      }
      if (uni.onUnhandledRejection) {
        uni.onUnhandledRejection((event) => _handleError('Unhandled Promise Rejection', event.reason));
      }
    }
  },

  /**
   * 创建 Vue app.config.errorHandler
   */
  createVueErrorHandler() {
    return (err, _vm, _info) => {
      _handleError('Vue Error', err);
    };
  },

  /**
   * 手动上报错误（供外部调用）
   */
  report(type, error) {
    _handleError(type, error);
  },

  /** 获取内存中的错误日志 */
  getErrorLogs() {
    return [..._errorLogs];
  },

  /** 清除所有错误日志 */
  clearErrorLogs() {
    _errorLogs.length = 0;
    try {
      uni.removeStorageSync('runtime_errors');
    } catch (_) {
      /* ignore */
    }
  }
};
