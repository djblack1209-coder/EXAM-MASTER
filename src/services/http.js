/**
 * HTTP 请求封装
 * 统一处理请求拦截、响应拦截、错误处理等
 * ✅ 支持自动重试机制
 */

import config from '../config/index.js'
import { useUserStore } from '../stores/index.js'

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 2,           // 最大重试次数
  retryDelay: 1000,        // 重试延迟（毫秒）
  retryableErrors: [       // 可重试的错误类型
    'request:fail',
    'timeout',
    'network error'
  ],
  retryableStatusCodes: [  // 可重试的状态码
    408, 429, 500, 502, 503, 504
  ]
}

/**
 * 请求拦截器
 */
const requestInterceptor = (requestConfig) => {
  // 添加 token
  const userStore = useUserStore()
  if (userStore.token) {
    requestConfig.header = {
      ...requestConfig.header,
      'Authorization': `Bearer ${userStore.token}`
    }
  }

  // 添加通用请求头
  requestConfig.header = {
    ...requestConfig.header,
    'Content-Type': 'application/json'
  }

  // 调试日志
  if (config.debug.enabled) {
    console.log('🚀 [Request]', requestConfig.method || 'GET', requestConfig.url)
    console.log('📦 [Request Data]', requestConfig.data)
  }

  return requestConfig
}

/**
 * 响应拦截器
 */
const responseInterceptor = (response) => {
  const { data, statusCode } = response

  // HTTP 状态码处理
  if (statusCode === 200) {
    // 业务状态码处理
    if (data.code === 0 || data.success) {
      return data
    } else {
      // 业务错误
      uni.showToast({
        title: data.message || '请求失败',
        icon: 'none'
      })
      return Promise.reject(data)
    }
  } else if (statusCode === 401) {
    // 未授权，跳转登录
    uni.showToast({
      title: '请先登录',
      icon: 'none'
    })

    const userStore = useUserStore()
    userStore.logout()

    // 跳转到首页（应用使用静默登录，无需登录页面）
    uni.reLaunch({
      url: '/src/pages/index/index'
    })

    return Promise.reject({ message: '未授权' })
  } else {
    // 其他 HTTP 错误
    uni.showToast({
      title: `请求错误：${statusCode}`,
      icon: 'none'
    })
    return Promise.reject(response)
  }
}

/**
 * 错误处理（带重试提示）
 */
const errorHandler = (error, retryCount = 0, maxRetries = 0) => {
  console.error('请求错误：', error)

  // 如果还有重试机会，显示重试提示
  if (retryCount < maxRetries) {
    uni.showToast({
      title: `网络异常，正在重试(${retryCount + 1}/${maxRetries})...`,
      icon: 'none',
      duration: 1500
    })
  } else {
    // 最终失败，显示错误提示
    uni.showToast({
      title: error.message || '网络请求失败，请检查网络后重试',
      icon: 'none'
    })
  }

  return Promise.reject(error)
}

/**
 * 判断是否应该重试
 */
const shouldRetry = (error, statusCode, retryConfig) => {
  // 检查错误类型
  if (error && error.errMsg) {
    const errMsg = error.errMsg.toLowerCase()
    for (const retryableError of retryConfig.retryableErrors) {
      if (errMsg.includes(retryableError.toLowerCase())) {
        return true
      }
    }
  }
  
  // 检查状态码
  if (statusCode && retryConfig.retryableStatusCodes.includes(statusCode)) {
    return true
  }
  
  return false
}

/**
 * 延迟函数
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

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
    }
    
    return this._requestWithRetry(options, retryConfig, 0)
  }
  
  /**
   * 带重试的请求实现
   * @private
   */
  async _requestWithRetry(options, retryConfig, retryCount) {
    // 合并配置
    const requestConfig = {
      url: options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: options.header || {},
      timeout: options.timeout || config.api.timeout
    }

    // 如果 URL 不是完整地址，则添加 baseURL
    if (!requestConfig.url.startsWith('http')) {
      requestConfig.url = config.api.baseUrl + requestConfig.url
    }

    // 请求拦截
    const interceptedConfig = requestInterceptor(requestConfig)

    // 返回 Promise
    return new Promise((resolve, reject) => {
      uni.request({
        ...interceptedConfig,
        success: async (res) => {
          // 检查是否需要重试（基于状态码）
          if (shouldRetry(null, res.statusCode, retryConfig) && retryCount < retryConfig.maxRetries) {
            console.log(`[Http] 状态码 ${res.statusCode}，准备重试 (${retryCount + 1}/${retryConfig.maxRetries})`)
            await delay(retryConfig.retryDelay * (retryCount + 1))  // 指数退避
            try {
              const result = await this._requestWithRetry(options, retryConfig, retryCount + 1)
              resolve(result)
            } catch (err) {
              reject(err)
            }
            return
          }
          
          responseInterceptor(res)
            .then(resolve)
            .catch(reject)
        },
        fail: async (err) => {
          // 检查是否需要重试（基于错误类型）
          if (shouldRetry(err, null, retryConfig) && retryCount < retryConfig.maxRetries) {
            console.log(`[Http] 请求失败，准备重试 (${retryCount + 1}/${retryConfig.maxRetries}):`, err.errMsg)
            errorHandler(err, retryCount, retryConfig.maxRetries)
            await delay(retryConfig.retryDelay * (retryCount + 1))  // 指数退避
            try {
              const result = await this._requestWithRetry(options, retryConfig, retryCount + 1)
              resolve(result)
            } catch (retryErr) {
              reject(retryErr)
            }
            return
          }
          
          errorHandler(err, retryCount, 0).catch(reject)
        }
      })
    })
  }

  /**
   * GET 请求
   */
  get(url, params, options = {}) {
    return this.request({
      url,
      method: 'GET',
      data: params,
      ...options
    })
  }

  /**
   * POST 请求
   */
  post(url, data, options = {}) {
    return this.request({
      url,
      method: 'POST',
      data,
      ...options
    })
  }

  /**
   * PUT 请求
   */
  put(url, data, options = {}) {
    return this.request({
      url,
      method: 'PUT',
      data,
      ...options
    })
  }

  /**
   * DELETE 请求
   */
  delete(url, data, options = {}) {
    return this.request({
      url,
      method: 'DELETE',
      data,
      ...options
    })
  }

  /**
   * 文件上传
   */
  upload(url, filePath, formData = {}, options = {}) {
    const userStore = useUserStore()

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
              data = JSON.parse(res.data)
            } catch (parseError) {
              console.error('[Http] uploadFile JSON解析失败:', parseError);
              reject(new Error('服务器返回数据格式错误'))
              return
            }
            resolve(data)
          } else {
            reject(res)
          }
        },
        fail: (err) => {
          errorHandler(err).catch(reject)
        }
      })
    })
  }
}

// 创建实例并导出
const http = new Http()

export default http
