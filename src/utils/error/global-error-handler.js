/**
 * 全局错误处理器 - 检查点 5.2
 * 全链路异常捕获与用户友好提示
 * 
 * 功能：
 * 1. 全局 JS 错误捕获
 * 2. Promise 未处理拒绝捕获
 * 3. 用户友好的错误提示弹窗
 * 4. 错误日志记录与上报
 * 5. 错误恢复建议
 */

// 存储键名
const STORAGE_KEYS = {
  ERROR_LOG: 'global_error_log',
  ERROR_STATS: 'global_error_stats'
};

// 错误类型定义
const ERROR_TYPES = {
  JS_ERROR: 'js_error',
  PROMISE_REJECTION: 'promise_rejection',
  NETWORK_ERROR: 'network_error',
  API_ERROR: 'api_error',
  RENDER_ERROR: 'render_error',
  RESOURCE_ERROR: 'resource_error'
};

// 用户友好的错误消息映射
const USER_FRIENDLY_MESSAGES = {
  // 网络相关
  'network': {
    title: '网络连接异常',
    message: '由于网络波动，请检查网络后重试',
    action: 'retry'
  },
  'timeout': {
    title: '请求超时',
    message: '服务器响应较慢，请稍后重试',
    action: 'retry'
  },
  'request:fail': {
    title: '网络请求失败',
    message: '无法连接到服务器，请检查网络设置',
    action: 'retry'
  },
  
  // 认证相关
  '401': {
    title: '登录已过期',
    message: '请重新登录以继续使用',
    action: 'relogin'
  },
  'unauthorized': {
    title: '未授权访问',
    message: '请先登录后再进行操作',
    action: 'relogin'
  },
  
  // 服务器相关
  '500': {
    title: '服务器繁忙',
    message: '服务器正在维护中，请稍后重试',
    action: 'retry'
  },
  '502': {
    title: '服务暂时不可用',
    message: '服务器正在重启，请稍后重试',
    action: 'retry'
  },
  '503': {
    title: '服务不可用',
    message: '服务器负载过高，请稍后重试',
    action: 'retry'
  },
  
  // 数据相关
  'parse': {
    title: '数据解析错误',
    message: '数据格式异常，请刷新页面重试',
    action: 'refresh'
  },
  'storage': {
    title: '存储空间不足',
    message: '本地存储空间不足，请清理后重试',
    action: 'clear'
  },
  
  // 默认
  'default': {
    title: '出了点小问题',
    message: '请稍后重试，如问题持续请联系客服',
    action: 'retry'
  }
};

// 最大错误日志数量
const MAX_ERROR_LOGS = 100;

/**
 * 全局错误处理器类
 */
class GlobalErrorHandler {
  constructor() {
    this.errorLogs = [];
    this.errorStats = {};
    this.isInitialized = false;
    this.config = {
      enableToast: true,           // 是否显示 Toast 提示
      enableModal: true,           // 是否显示弹窗
      enableLog: true,             // 是否记录日志
      enableReport: true,          // 是否上报错误
      reportUrl: null,             // 上报地址
      onError: null,               // 自定义错误处理回调
      ignorePatterns: []           // 忽略的错误模式
    };
    this.retryCallbacks = new Map(); // 重试回调
  }

  /**
   * 初始化错误处理器
   * @param {Object} options - 配置选项
   */
  init(options = {}) {
    if (this.isInitialized) return;

    this.config = { ...this.config, ...options };
    
    // 加载历史错误日志
    this._loadErrorLogs();
    
    // 设置全局错误处理
    this._setupGlobalErrorHandler();
    
    // 设置 Promise 拒绝处理
    this._setupPromiseRejectionHandler();
    
    // 设置 Vue 错误处理（如果在 Vue 环境中）
    this._setupVueErrorHandler();

    this.isInitialized = true;
    console.log('[GlobalErrorHandler] 初始化完成');
  }

  /**
   * 设置全局错误处理
   * @private
   */
  _setupGlobalErrorHandler() {
    // #ifdef H5
    window.onerror = (message, source, lineno, colno, error) => {
      this.handleError({
        type: ERROR_TYPES.JS_ERROR,
        message: message,
        source: source,
        lineno: lineno,
        colno: colno,
        stack: error?.stack
      });
      return true; // 阻止默认处理
    };
    // #endif

    // #ifdef MP-WEIXIN
    // 微信小程序全局错误处理
    if (typeof App !== 'undefined') {
      const originalApp = App;
      App = function(appConfig) {
        const originalOnError = appConfig.onError;
        appConfig.onError = (error) => {
          globalErrorHandler.handleError({
            type: ERROR_TYPES.JS_ERROR,
            message: error,
            platform: 'mp-weixin'
          });
          if (originalOnError) {
            originalOnError.call(this, error);
          }
        };
        return originalApp(appConfig);
      };
    }
    // #endif
  }

  /**
   * 设置 Promise 拒绝处理
   * @private
   */
  _setupPromiseRejectionHandler() {
    // #ifdef H5
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError({
        type: ERROR_TYPES.PROMISE_REJECTION,
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        reason: event.reason
      });
      event.preventDefault();
    });
    // #endif

    // #ifdef MP-WEIXIN
    // 微信小程序 Promise 拒绝处理
    if (typeof uni !== 'undefined' && uni.onUnhandledRejection) {
      uni.onUnhandledRejection((res) => {
        this.handleError({
          type: ERROR_TYPES.PROMISE_REJECTION,
          message: res.reason?.message || String(res.reason),
          stack: res.reason?.stack,
          reason: res.reason,
          platform: 'mp-weixin'
        });
      });
    }
    // #endif
  }

  /**
   * 设置 Vue 错误处理
   * @private
   */
  _setupVueErrorHandler() {
    // Vue 3 错误处理会在 main.js 中通过 app.config.errorHandler 设置
    // 这里提供一个辅助方法
  }

  /**
   * 创建 Vue 错误处理器
   * @returns {Function} Vue 错误处理函数
   */
  createVueErrorHandler() {
    return (err, vm, info) => {
      this.handleError({
        type: ERROR_TYPES.RENDER_ERROR,
        message: err.message,
        stack: err.stack,
        componentName: vm?.$options?.name || 'Unknown',
        lifecycleHook: info
      });
    };
  }

  /**
   * 处理错误
   * @param {Object} errorInfo - 错误信息
   */
  handleError(errorInfo) {
    // 检查是否应该忽略
    if (this._shouldIgnore(errorInfo)) {
      return;
    }

    // 构建错误记录
    const errorRecord = {
      id: this._generateErrorId(),
      timestamp: Date.now(),
      ...errorInfo,
      page: this._getCurrentPage(),
      userAgent: this._getUserAgent(),
      networkType: this._getNetworkType()
    };

    // 记录日志
    if (this.config.enableLog) {
      this._logError(errorRecord);
    }

    // 更新统计
    this._updateStats(errorRecord);

    // 显示用户提示
    this._showUserFeedback(errorRecord);

    // 上报错误
    if (this.config.enableReport) {
      this._reportError(errorRecord);
    }

    // 自定义回调
    if (typeof this.config.onError === 'function') {
      this.config.onError(errorRecord);
    }

    console.error('[GlobalErrorHandler] 捕获错误:', errorRecord);
  }

  /**
   * 手动报告错误
   * @param {Error|string} error - 错误对象或消息
   * @param {Object} context - 上下文信息
   */
  report(error, context = {}) {
    const errorInfo = {
      type: ERROR_TYPES.JS_ERROR,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      ...context
    };

    this.handleError(errorInfo);
  }

  /**
   * 报告网络错误
   * @param {Object} error - 网络错误信息
   */
  reportNetworkError(error) {
    this.handleError({
      type: ERROR_TYPES.NETWORK_ERROR,
      message: error.errMsg || error.message || '网络请求失败',
      url: error.url,
      statusCode: error.statusCode,
      ...error
    });
  }

  /**
   * 报告 API 错误
   * @param {Object} error - API 错误信息
   */
  reportApiError(error) {
    this.handleError({
      type: ERROR_TYPES.API_ERROR,
      message: error.message || 'API 请求失败',
      code: error.code,
      url: error.url,
      ...error
    });
  }

  /**
   * 检查是否应该忽略错误
   * @private
   */
  _shouldIgnore(errorInfo) {
    const message = errorInfo.message || '';
    
    // 检查忽略模式
    for (const pattern of this.config.ignorePatterns) {
      if (pattern instanceof RegExp && pattern.test(message)) {
        return true;
      }
      if (typeof pattern === 'string' && message.includes(pattern)) {
        return true;
      }
    }

    // 忽略一些常见的无害错误
    const ignoreMessages = [
      'ResizeObserver loop',
      'Script error.',
      'Non-Error promise rejection'
    ];

    return ignoreMessages.some(msg => message.includes(msg));
  }

  /**
   * 显示用户反馈
   * @private
   */
  _showUserFeedback(errorRecord) {
    const friendlyMessage = this._getFriendlyMessage(errorRecord);

    if (this.config.enableModal && friendlyMessage.action !== 'ignore') {
      this._showErrorModal(friendlyMessage, errorRecord);
    } else if (this.config.enableToast) {
      uni.showToast({
        title: friendlyMessage.message,
        icon: 'none',
        duration: 3000
      });
    }
  }

  /**
   * 获取用户友好的错误消息
   * @private
   */
  _getFriendlyMessage(errorRecord) {
    const message = (errorRecord.message || '').toLowerCase();
    
    // 匹配错误类型
    for (const [key, value] of Object.entries(USER_FRIENDLY_MESSAGES)) {
      if (key !== 'default' && message.includes(key)) {
        return value;
      }
    }

    // 检查状态码
    if (errorRecord.statusCode) {
      const statusKey = String(errorRecord.statusCode);
      if (USER_FRIENDLY_MESSAGES[statusKey]) {
        return USER_FRIENDLY_MESSAGES[statusKey];
      }
    }

    return USER_FRIENDLY_MESSAGES.default;
  }

  /**
   * 显示错误弹窗
   * @private
   */
  _showErrorModal(friendlyMessage, errorRecord) {
    const actions = {
      retry: {
        text: '点击重试',
        handler: () => {
          const callback = this.retryCallbacks.get(errorRecord.id);
          if (callback) {
            callback();
            this.retryCallbacks.delete(errorRecord.id);
          } else {
            // 默认刷新页面
            const pages = getCurrentPages();
            if (pages.length > 0) {
              const currentPage = pages[pages.length - 1];
              if (currentPage.onLoad) {
                currentPage.onLoad(currentPage.options);
              }
            }
          }
        }
      },
      refresh: {
        text: '刷新页面',
        handler: () => {
          const pages = getCurrentPages();
          if (pages.length > 0) {
            const currentPage = pages[pages.length - 1];
            uni.redirectTo({
              url: '/' + currentPage.route
            });
          }
        }
      },
      relogin: {
        text: '重新登录',
        handler: () => {
          uni.reLaunch({
            url: '/src/pages/index/index'
          });
        }
      },
      clear: {
        text: '清理缓存',
        handler: () => {
          uni.clearStorage({
            success: () => {
              uni.showToast({
                title: '缓存已清理',
                icon: 'success'
              });
            }
          });
        }
      }
    };

    const action = actions[friendlyMessage.action] || actions.retry;

    uni.showModal({
      title: friendlyMessage.title,
      content: friendlyMessage.message,
      confirmText: action.text,
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          action.handler();
        }
      }
    });
  }

  /**
   * 设置重试回调
   * @param {string} errorId - 错误ID
   * @param {Function} callback - 重试回调
   */
  setRetryCallback(errorId, callback) {
    this.retryCallbacks.set(errorId, callback);
  }

  /**
   * 记录错误日志
   * @private
   */
  _logError(errorRecord) {
    this.errorLogs.push(errorRecord);

    // 限制日志数量
    if (this.errorLogs.length > MAX_ERROR_LOGS) {
      this.errorLogs = this.errorLogs.slice(-MAX_ERROR_LOGS);
    }

    this._saveErrorLogs();
  }

  /**
   * 更新错误统计
   * @private
   */
  _updateStats(errorRecord) {
    const type = errorRecord.type || 'unknown';
    const today = new Date().toISOString().split('T')[0];

    if (!this.errorStats[today]) {
      this.errorStats[today] = {};
    }

    this.errorStats[today][type] = (this.errorStats[today][type] || 0) + 1;

    this._saveErrorStats();
  }

  /**
   * 上报错误
   * @private
   */
  async _reportError(errorRecord) {
    if (!this.config.reportUrl) {
      // 没有配置上报地址，保存到本地
      return;
    }

    try {
      await uni.request({
        url: this.config.reportUrl,
        method: 'POST',
        data: {
          errors: [errorRecord],
          timestamp: Date.now()
        }
      });
    } catch (e) {
      // 上报失败，静默处理
      console.warn('[GlobalErrorHandler] 错误上报失败:', e);
    }
  }

  /**
   * 获取错误日志
   * @param {number} limit - 限制数量
   * @returns {Array} 错误日志
   */
  getErrorLogs(limit = 50) {
    return this.errorLogs.slice(-limit).reverse();
  }

  /**
   * 获取错误统计
   * @returns {Object} 错误统计
   */
  getErrorStats() {
    return { ...this.errorStats };
  }

  /**
   * 清除错误日志
   */
  clearErrorLogs() {
    this.errorLogs = [];
    this.errorStats = {};
    this._saveErrorLogs();
    this._saveErrorStats();
    console.log('[GlobalErrorHandler] 错误日志已清除');
  }

  // ==================== 辅助方法 ====================

  _generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  _getCurrentPage() {
    try {
      const pages = getCurrentPages();
      return pages.length > 0 ? pages[pages.length - 1].route : 'unknown';
    } catch (e) {
      return 'unknown';
    }
  }

  _getUserAgent() {
    try {
      // #ifdef MP-WEIXIN
      // 使用新的 API 替代废弃的 getSystemInfoSync
      const deviceInfo = uni.getDeviceInfo();
      const appBaseInfo = uni.getAppBaseInfo();
      return `${deviceInfo.platform}/${deviceInfo.system}/${appBaseInfo.version}`;
      // #endif
      
      // #ifndef MP-WEIXIN
      const systemInfo = uni.getSystemInfoSync();
      return `${systemInfo.platform}/${systemInfo.system}/${systemInfo.version}`;
      // #endif
    } catch (e) {
      return 'unknown';
    }
  }

  _getNetworkType() {
    try {
      let networkType = 'unknown';
      uni.getNetworkType({
        success: (res) => {
          networkType = res.networkType;
        }
      });
      return networkType;
    } catch (e) {
      return 'unknown';
    }
  }

  _loadErrorLogs() {
    try {
      this.errorLogs = uni.getStorageSync(STORAGE_KEYS.ERROR_LOG) || [];
      this.errorStats = uni.getStorageSync(STORAGE_KEYS.ERROR_STATS) || {};
    } catch (e) {
      this.errorLogs = [];
      this.errorStats = {};
    }
  }

  _saveErrorLogs() {
    try {
      uni.setStorageSync(STORAGE_KEYS.ERROR_LOG, this.errorLogs);
    } catch (e) {
      console.warn('[GlobalErrorHandler] 保存错误日志失败:', e);
    }
  }

  _saveErrorStats() {
    try {
      uni.setStorageSync(STORAGE_KEYS.ERROR_STATS, this.errorStats);
    } catch (e) {
      console.warn('[GlobalErrorHandler] 保存错误统计失败:', e);
    }
  }
}

// 创建单例
export const globalErrorHandler = new GlobalErrorHandler();

// 便捷函数
export function initErrorHandler(options) {
  return globalErrorHandler.init(options);
}

export function reportError(error, context) {
  return globalErrorHandler.report(error, context);
}

export function reportNetworkError(error) {
  return globalErrorHandler.reportNetworkError(error);
}

export function reportApiError(error) {
  return globalErrorHandler.reportApiError(error);
}

// 导出常量
export { ERROR_TYPES, USER_FRIENDLY_MESSAGES };

// 默认导出
export default globalErrorHandler;
