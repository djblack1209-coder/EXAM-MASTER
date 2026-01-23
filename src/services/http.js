/**
 * HTTP 请求封装
 * 统一处理请求拦截、响应拦截、错误处理等
 */

import { API_CONFIG } from '../../common/config.js'
import { useUserStore } from '../stores/index.js'

/**
 * 请求拦截器
 */
const requestInterceptor = (config) => {
  // 添加 token
  const userStore = useUserStore()
  if (userStore.token) {
    config.header = {
      ...config.header,
      'Authorization': `Bearer ${userStore.token}`
    }
  }

  // 添加通用请求头
  config.header = {
    ...config.header,
    'Content-Type': 'application/json'
  }

  return config
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
 * 错误处理
 */
const errorHandler = (error) => {
  console.error('请求错误：', error)
  
  uni.showToast({
    title: error.message || '网络请求失败',
    icon: 'none'
  })
  
  return Promise.reject(error)
}

/**
 * 封装的 HTTP 请求方法
 */
class Http {
  /**
   * 通用请求方法
   */
  request(options) {
    // 合并配置
    const config = {
      url: options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: options.header || {},
      timeout: options.timeout || API_CONFIG.timeout
    }

    // 如果 URL 不是完整地址，则添加 baseURL
    if (!config.url.startsWith('http')) {
      config.url = API_CONFIG.baseURL + config.url
    }

    // 请求拦截
    const interceptedConfig = requestInterceptor(config)

    // 返回 Promise
    return new Promise((resolve, reject) => {
      uni.request({
        ...interceptedConfig,
        success: (res) => {
          responseInterceptor(res)
            .then(resolve)
            .catch(reject)
        },
        fail: (err) => {
          errorHandler(err).catch(reject)
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
        url: url.startsWith('http') ? url : API_CONFIG.baseURL + url,
        filePath,
        name: 'file',
        formData,
        header: {
          'Authorization': userStore.token ? `Bearer ${userStore.token}` : '',
          ...options.header
        },
        success: (res) => {
          if (res.statusCode === 200) {
            const data = JSON.parse(res.data)
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
