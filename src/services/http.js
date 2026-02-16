/**
 * HTTP 请求封装
 * 统一处理请求拦截、响应拦截、错误处理等
 * ✅ 支持自动重试机制
 * ✅ P006: 增强网络错误分类与用户提示
 */

import { logger } from '@/utils/logger.js';
import config from '../config/index.js';
import { useUserStore } from '../stores/index.js';

// ==================== 网络错误分类 (P006) ====================

/**
 * 将 UniApp 底层错误信息映射为用户可读的提示
 */
const NETWORK_ERROR_MAP = [
  { pattern: 'timeout', message: '请求超时，请稍后重试', type: 'timeout' },
  { pattern: 'request:fail abort', message: '请求已取消', type: 'abort' },
  { pattern: 'request:fail interrupted', message: '请求被中断', type: 'interrupted' },
  { pattern: 'ssl', message: '安全连接失败，请检查网络环境', type: 'ssl' },
  { pattern: 'dns', message: '域名解析失败，请检查网络连接', type: 'dns' },
  { pattern: 'request:fail', message: '网络连接失败，请检查网络设置', type: 'network' },
  { pattern: 'network error', message: '网络异常，请检查网络后重试', type: 'network' }
];

/**
 * 分类网络错误，返回结构化错误对象
 */
function classifyNetworkError(error) {
  const errMsg = (error?.errMsg || error?.message || String(error)).toLowerCase();

  for (const entry of NETWORK_ERROR_MAP) {
    if (errMsg.includes(entry.pattern)) {
      return {
        type: entry.type,
        message: entry.message,
        raw: errMsg
      };
    }
  }

  return {
    type: 'unknown',
    message: '请求失败，请稍后重试',
    raw: errMsg
  };
}

/**
 * 分类 HTTP 状态码错误
 */
function classifyHttpError(statusCode) {
  if (statusCode >= 500) return '服务器繁忙，请稍后重试';
  if (statusCode === 429) return '操作过于频繁，请稍后再试';
  if (statusCode === 408) return '请求超时，请重试';
  if (statusCode === 404) return '请求的资源不存在';
  if (statusCode === 403) return '没有访问权限';
  return `请求错误(${statusCode})`;
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 2, // 最大重试次数
  retryDelay: 1000, // 重试延迟（毫秒）
  retryableErrors: [ // 可重试的错误类型
    'request:fail',
    'timeout',
    'network error'
  ],
  retryableStatusCodes: [ // 可重试的状态码
    408, 429, 500, 502, 503, 504
  ]
};

/**
 * 请求拦截器
 */
const requestInterceptor = (requestConfig) => {
  // 添加 token
  const userStore = useUserStore();
  if (userStore.token) {
    requestConfig.header = {
      ...requestConfig.header,
      'Authorization': `Bearer ${userStore.token}`
    };
  }

  // 添加通用请求头
  requestConfig.header = {
    ...requestConfig.header,
    'Content-Type': 'application/json'
  };

  // 调试日志
  if (config.debug.enabled) {
    logger.log('🚀 [Request]', requestConfig.method || 'GET', requestConfig.url);
    logger.log('📦 [Request Data]', requestConfig.data);
  }

  return requestConfig;
};

/**
 * 响应拦截器
 */
const responseInterceptor = async (response) => {
  const { data, statusCode } = response;

  // HTTP 状态码处理
  if (statusCode === 200) {
    // 业务状态码处理
    if (data.code === 0 || data.success) {
      return data;
    } else {
      // 业务错误
      uni.showToast({
        title: data.message || '请求失败',
        icon: 'none'
      });
      return Promise.reject(data);
    }
  } else if (statusCode === 401) {
    // 未授权，尝试静默重新登录
    const userStore = useUserStore();

    // 先尝试静默登录刷新token，而不是直接登出
    try {
      const loginResult = await userStore.login(true); // silent=true
      if (loginResult && loginResult.success) {
        logger.log('[Http] 静默登录成功，token已刷新');
        // 静默登录成功，但不自动重试原请求（避免循环）
      }
    } catch (e) {
      console.warn('[Http] 静默登录失败:', e);
    }

    // 无论静默登录是否成功，都提示用户
    uni.showToast({
      title: '登录已过期，请重新操作',
      icon: 'none'
    });

    // 如果静默登录也失败，才执行登出
    if (!userStore.isLogin) {
      userStore.logout();
      // 修复：UniApp路由路径不应包含src前缀
      uni.reLaunch({
        url: '/pages/index/index'
      });
    }

    return Promise.reject({ message: '未授权', statusCode: 401 });
  } else {
    // 其他 HTTP 错误 — P006: 使用分类后的友好提示
    const friendlyMessage = classifyHttpError(statusCode);
    uni.showToast({
      title: friendlyMessage,
      icon: 'none'
    });
    return Promise.reject({ ...response, userMessage: friendlyMessage });
  }
};

/**
   * 错误处理（带重试提示）— P006 增强：使用分类错误信息
   * @param {Error|Object} error - 请求错误对象
   * @param {number} [retryCount=0] - 当前重试次数
   * @param {number} [maxRetries=0] - 最大重试次数
   * @returns {Promise<never>} 始终返回 rejected Promise
   */
const errorHandler = (error, retryCount = 0, maxRetries = 0) => {
  const classified = classifyNetworkError(error);
  console.error(`[Http] 请求错误 [${classified.type}]:`, classified.raw);

  // 如果还有重试机会，显示重试提示
  if (retryCount < maxRetries) {
    uni.showToast({
      title: `${classified.message}，正在重试(${retryCount + 1}/${maxRetries})...`,
      icon: 'none',
      duration: 1500
    });
  } else {
    // 最终失败，显示分类后的错误提示
    uni.showToast({
      title: classified.message,
      icon: 'none'
    });
  }

  // 附加分类信息到错误对象，方便上层处理
  const enrichedError = error instanceof Error ? error : new Error(classified.message);
  enrichedError.errorType = classified.type;
  enrichedError.userMessage = classified.message;

  return Promise.reject(enrichedError);
};

/**
   * 判断是否应该重试
   * @param {Object|null} error - 错误对象，包含 errMsg 属性
   * @param {number|null} statusCode - HTTP 状态码
   * @param {Object} retryConfig - 重试配置
   * @param {string[]} retryConfig.retryableErrors - 可重试的错误关键词列表
   * @param {number[]} retryConfig.retryableStatusCodes - 可重试的状态码列表
   * @returns {boolean} 是否应该重试
   */
const shouldRetry = (error, statusCode, retryConfig) => {
  // 检查错误类型
  if (error && error.errMsg) {
    const errMsg = error.errMsg.toLowerCase();
    for (const retryableError of retryConfig.retryableErrors) {
      if (errMsg.includes(retryableError.toLowerCase())) {
        return true;
      }
    }
  }

  // 检查状态码
  if (statusCode && retryConfig.retryableStatusCodes.includes(statusCode)) {
    return true;
  }

  return false;
};

/**
 * 延迟函数
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 封装的 HTTP 请求方法
 */
class Http {
  /**
   * 通用请求方法（支持自动重试）
   * @param {Object} options - 请求配置
   * @param {Object} options.retry - 重试配置 { maxRetries, retryDelay }
   */
  request(options) {
    const retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...(options.retry || {})
    };

    return this._requestWithRetry(options, retryConfig, 0);
  }

  /**
   * 带重试的请求实现
   * @private
   * @param {Object} options - 请求配置 (url, method, data, header, timeout)
   * @param {Object} retryConfig - 重试配置 (maxRetries, retryDelay, retryableErrors, retryableStatusCodes)
   * @param {number} retryCount - 当前重试次数
   * @returns {Promise<Object>} 响应数据
   */
  async _requestWithRetry(options, retryConfig, retryCount) {
    // 合并配置
    const requestConfig = {
      url: options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: options.header || {},
      timeout: options.timeout || config.api.timeout
    };

    // 如果 URL 不是完整地址，则添加 baseURL
    if (!requestConfig.url.startsWith('http')) {
      requestConfig.url = config.api.baseUrl + requestConfig.url;
    }

    // 请求拦截
    const interceptedConfig = requestInterceptor(requestConfig);

    // 返回 Promise
    return new Promise((resolve, reject) => {
      uni.request({
        ...interceptedConfig,
        success: async (res) => {
          // 检查是否需要重试（基于状态码）
          if (shouldRetry(null, res.statusCode, retryConfig) && retryCount < retryConfig.maxRetries) {
            logger.log(`[Http] 状态码 ${res.statusCode}，准备重试 (${retryCount + 1}/${retryConfig.maxRetries})`);
            await delay(retryConfig.retryDelay * (retryCount + 1)); // 指数退避
            try {
              const result = await this._requestWithRetry(options, retryConfig, retryCount + 1);
              resolve(result);
            } catch (err) {
              reject(err);
            }
            return;
          }

          responseInterceptor(res)
            .then(resolve)
            .catch(reject);
        },
        fail: async (err) => {
          // 检查是否需要重试（基于错误类型）
          if (shouldRetry(err, null, retryConfig) && retryCount < retryConfig.maxRetries) {
            logger.log(`[Http] 请求失败，准备重试 (${retryCount + 1}/${retryConfig.maxRetries}):`, err.errMsg);
            errorHandler(err, retryCount, retryConfig.maxRetries);
            await delay(retryConfig.retryDelay * (retryCount + 1)); // 指数退避
            try {
              const result = await this._requestWithRetry(options, retryConfig, retryCount + 1);
              resolve(result);
            } catch (retryErr) {
              reject(retryErr);
            }
            return;
          }

          errorHandler(err, retryCount, 0).catch(reject);
        }
      });
    });
  }

  /**
   * GET 请求
   * @param {string} url - API 端点路径
   * @param {Object} [params] - 查询参数
   * @param {Object} [options={}] - 额外请求配置 (header, timeout, retry 等)
   * @returns {Promise<Object>} 响应数据
   */
  get(url, params, options = {}) {
    return this.request({
      url,
      method: 'GET',
      data: params,
      ...options
    });
  }

  /**
   * POST 请求
   * @param {string} url - API 端点路径
   * @param {Object} [data] - 请求体数据
   * @param {Object} [options={}] - 额外请求配置 (header, timeout, retry 等)
   * @returns {Promise<Object>} 响应数据
   */
  post(url, data, options = {}) {
    return this.request({
      url,
      method: 'POST',
      data,
      ...options
    });
  }

  /**
   * PUT 请求
   * @param {string} url - API 端点路径
   * @param {Object} [data] - 请求体数据
   * @param {Object} [options={}] - 额外请求配置 (header, timeout, retry 等)
   * @returns {Promise<Object>} 响应数据
   */
  put(url, data, options = {}) {
    return this.request({
      url,
      method: 'PUT',
      data,
      ...options
    });
  }

  /**
   * DELETE 请求
   * @param {string} url - API 端点路径
   * @param {Object} [data] - 请求体数据
   * @param {Object} [options={}] - 额外请求配置 (header, timeout, retry 等)
   * @returns {Promise<Object>} 响应数据
   */
  delete(url, data, options = {}) {
    return this.request({
      url,
      method: 'DELETE',
      data,
      ...options
    });
  }

  /**
   * 文件上传
   * @param {string} url - 上传端点路径
   * @param {string} filePath - 本地文件路径
   * @param {Object} [formData={}] - 附加表单字段
   * @param {Object} [options={}] - 额外请求配置 (header 等)
   * @returns {Promise<Object>} 响应数据
   */
  upload(url, filePath, formData = {}, options = {}) {
    const userStore = useUserStore();

    return new Promise((resolve, reject) => {
      uni.uploadFile({
        url: url.startsWith('http') ? url : config.api.baseUrl + url,
        filePath,
        name: 'file',
        formData,
        header: {
          'Authorization': userStore.token ? `Bearer ${userStore.token}` : '',
          ...options.header
        },
        success: (res) => {
          if (res.statusCode === 200) {
            let data;
            try {
              data = JSON.parse(res.data);
            } catch (parseError) {
              console.error('[Http] uploadFile JSON解析失败:', parseError);
              reject(new Error('服务器返回数据格式错误'));
              return;
            }
            resolve(data);
          } else {
            reject(res);
          }
        },
        fail: (err) => {
          errorHandler(err).catch(reject);
        }
      });
    });
  }
}

// 创建实例并导出
const http = new Http();

export default http;
