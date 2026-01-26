/**
 * Token 刷新插件 (Token Refresh Plugin)
 * 
 * 功能：
 * 1. 401 响应时自动刷新 Token
 * 2. 刷新成功后自动重发原请求
 * 3. 并发请求时只刷新一次 Token
 * 4. 刷新失败时优雅降级
 * 5. Token 过期预检测
 * 
 * 使用示例：
 * import { tokenRefreshPlugin } from '@/utils/token-refresh-plugin.js'
 * 
 * // 初始化
 * tokenRefreshPlugin.init({
 *   refreshTokenFn: async () => {
 *     const res = await http.post('/auth/refresh', { refreshToken })
 *     return res.data.accessToken
 *   }
 * })
 * 
 * // 包装请求
 * const result = await tokenRefreshPlugin.wrapRequest(() => http.get('/api/data'))
 */

const TOKEN_KEY = 'EXAM_ACCESS_TOKEN'
const REFRESH_TOKEN_KEY = 'EXAM_REFRESH_TOKEN'
const TOKEN_EXPIRE_KEY = 'EXAM_TOKEN_EXPIRE'

/**
 * Token 刷新插件类
 */
class TokenRefreshPlugin {
  constructor() {
    this.config = {
      refreshTokenFn: null,           // 刷新 Token 的函数
      onRefreshSuccess: null,         // 刷新成功回调
      onRefreshFailed: null,          // 刷新失败回调
      onLogout: null,                 // 登出回调
      tokenExpireBuffer: 5 * 60 * 1000, // Token 过期缓冲时间（提前5分钟刷新）
      maxRefreshRetries: 2,           // 最大刷新重试次数
      enablePreCheck: true            // 启用预检测
    }
    
    this.isRefreshing = false         // 是否正在刷新
    this.refreshPromise = null        // 刷新 Promise（用于并发控制）
    this.pendingRequests = []         // 等待刷新完成的请求队列
    this.refreshRetryCount = 0        // 刷新重试计数
  }

  /**
   * 初始化插件
   * @param {Object} config - 配置对象
   */
  init(config) {
    this.config = { ...this.config, ...config }
    console.log('[TokenRefreshPlugin] 插件已初始化')
    
    // 启动预检测定时器
    if (this.config.enablePreCheck) {
      this._startPreCheckTimer()
    }
  }

  /**
   * 获取当前 Token
   * @returns {string|null}
   */
  getAccessToken() {
    try {
      return uni.getStorageSync(TOKEN_KEY) || null
    } catch (error) {
      console.error('[TokenRefreshPlugin] 获取 Token 失败:', error)
      return null
    }
  }

  /**
   * 获取 Refresh Token
   * @returns {string|null}
   */
  getRefreshToken() {
    try {
      return uni.getStorageSync(REFRESH_TOKEN_KEY) || null
    } catch (error) {
      console.error('[TokenRefreshPlugin] 获取 RefreshToken 失败:', error)
      return null
    }
  }

  /**
   * 保存 Token
   * @param {string} accessToken - 访问令牌
   * @param {string} refreshToken - 刷新令牌
   * @param {number} expiresIn - 过期时间（秒）
   */
  saveTokens(accessToken, refreshToken, expiresIn) {
    try {
      uni.setStorageSync(TOKEN_KEY, accessToken)
      
      if (refreshToken) {
        uni.setStorageSync(REFRESH_TOKEN_KEY, refreshToken)
      }
      
      if (expiresIn) {
        const expireTime = Date.now() + expiresIn * 1000
        uni.setStorageSync(TOKEN_EXPIRE_KEY, expireTime)
      }
      
      console.log('[TokenRefreshPlugin] Token 已保存')
    } catch (error) {
      console.error('[TokenRefreshPlugin] 保存 Token 失败:', error)
    }
  }

  /**
   * 清除 Token
   */
  clearTokens() {
    try {
      uni.removeStorageSync(TOKEN_KEY)
      uni.removeStorageSync(REFRESH_TOKEN_KEY)
      uni.removeStorageSync(TOKEN_EXPIRE_KEY)
      console.log('[TokenRefreshPlugin] Token 已清除')
    } catch (error) {
      console.error('[TokenRefreshPlugin] 清除 Token 失败:', error)
    }
  }

  /**
   * 检查 Token 是否即将过期
   * @returns {boolean}
   */
  isTokenExpiringSoon() {
    try {
      const expireTime = uni.getStorageSync(TOKEN_EXPIRE_KEY)
      if (!expireTime) return false
      
      const buffer = this.config.tokenExpireBuffer
      return Date.now() + buffer >= expireTime
    } catch (error) {
      return false
    }
  }

  /**
   * 检查 Token 是否已过期
   * @returns {boolean}
   */
  isTokenExpired() {
    try {
      const expireTime = uni.getStorageSync(TOKEN_EXPIRE_KEY)
      if (!expireTime) return false
      
      return Date.now() >= expireTime
    } catch (error) {
      return false
    }
  }

  /**
   * 启动预检测定时器
   * @private
   */
  _startPreCheckTimer() {
    // 每分钟检查一次
    setInterval(() => {
      if (this.isTokenExpiringSoon() && !this.isRefreshing) {
        console.log('[TokenRefreshPlugin] 🔔 Token 即将过期，预刷新...')
        this.refreshToken().catch(err => {
          console.warn('[TokenRefreshPlugin] 预刷新失败:', err)
        })
      }
    }, 60 * 1000)
  }

  /**
   * 刷新 Token
   * @returns {Promise<string>} 新的 accessToken
   */
  async refreshToken() {
    // 如果已经在刷新，返回现有的 Promise
    if (this.isRefreshing && this.refreshPromise) {
      console.log('[TokenRefreshPlugin] 等待正在进行的刷新...')
      return this.refreshPromise
    }

    // 检查是否有刷新函数
    if (typeof this.config.refreshTokenFn !== 'function') {
      console.error('[TokenRefreshPlugin] 未配置 refreshTokenFn')
      throw new Error('refreshTokenFn not configured')
    }

    // 检查是否有 refreshToken
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      console.warn('[TokenRefreshPlugin] 无 RefreshToken，无法刷新')
      this._handleRefreshFailed(new Error('No refresh token'))
      throw new Error('No refresh token')
    }

    this.isRefreshing = true
    console.log('[TokenRefreshPlugin] 🔄 开始刷新 Token...')

    this.refreshPromise = (async () => {
      try {
        // 调用刷新函数
        const result = await this.config.refreshTokenFn(refreshToken)
        
        // 处理返回结果
        let newAccessToken, newRefreshToken, expiresIn
        
        if (typeof result === 'string') {
          newAccessToken = result
        } else if (result && typeof result === 'object') {
          newAccessToken = result.accessToken || result.access_token || result.token
          newRefreshToken = result.refreshToken || result.refresh_token
          expiresIn = result.expiresIn || result.expires_in
        }

        if (!newAccessToken) {
          throw new Error('Invalid refresh response')
        }

        // 保存新 Token
        this.saveTokens(newAccessToken, newRefreshToken, expiresIn)
        
        // 重置重试计数
        this.refreshRetryCount = 0
        
        console.log('[TokenRefreshPlugin] ✅ Token 刷新成功')

        // 成功回调
        if (typeof this.config.onRefreshSuccess === 'function') {
          this.config.onRefreshSuccess(newAccessToken)
        }

        // 处理等待队列中的请求
        this._processPendingRequests(newAccessToken)

        return newAccessToken

      } catch (error) {
        console.error('[TokenRefreshPlugin] ❌ Token 刷新失败:', error)
        
        this.refreshRetryCount++
        
        // 重试
        if (this.refreshRetryCount < this.config.maxRefreshRetries) {
          console.log(`[TokenRefreshPlugin] 🔄 重试刷新 (${this.refreshRetryCount}/${this.config.maxRefreshRetries})...`)
          this.isRefreshing = false
          this.refreshPromise = null
          return this.refreshToken()
        }

        // 刷新失败处理
        this._handleRefreshFailed(error)
        throw error

      } finally {
        this.isRefreshing = false
        this.refreshPromise = null
      }
    })()

    return this.refreshPromise
  }

  /**
   * 处理刷新失败
   * @private
   */
  _handleRefreshFailed(error) {
    console.log('[TokenRefreshPlugin] 🚪 刷新失败，执行登出流程')
    
    // 清除 Token
    this.clearTokens()
    
    // 拒绝所有等待的请求
    this._rejectPendingRequests(error)
    
    // 失败回调
    if (typeof this.config.onRefreshFailed === 'function') {
      this.config.onRefreshFailed(error)
    }
    
    // 登出回调
    if (typeof this.config.onLogout === 'function') {
      this.config.onLogout()
    } else {
      // 默认跳转到首页
      uni.showToast({
        title: '登录已过期，请重新登录',
        icon: 'none',
        duration: 2000
      })
      
      setTimeout(() => {
        uni.reLaunch({
          url: '/src/pages/index/index'
        })
      }, 1500)
    }
  }

  /**
   * 处理等待队列中的请求
   * @private
   */
  _processPendingRequests(newToken) {
    console.log(`[TokenRefreshPlugin] 处理 ${this.pendingRequests.length} 个等待的请求`)
    
    const requests = [...this.pendingRequests]
    this.pendingRequests = []
    
    requests.forEach(({ resolve, requestFn }) => {
      resolve(requestFn(newToken))
    })
  }

  /**
   * 拒绝等待队列中的请求
   * @private
   */
  _rejectPendingRequests(error) {
    console.log(`[TokenRefreshPlugin] 拒绝 ${this.pendingRequests.length} 个等待的请求`)
    
    const requests = [...this.pendingRequests]
    this.pendingRequests = []
    
    requests.forEach(({ reject }) => {
      reject(error)
    })
  }

  /**
   * 包装请求，自动处理 401
   * @param {Function} requestFn - 请求函数
   * @param {Object} options - 选项
   * @returns {Promise} 请求结果
   */
  async wrapRequest(requestFn, options = {}) {
    const { skipRefresh = false } = options

    try {
      // 预检测：如果 Token 即将过期，先刷新
      if (this.config.enablePreCheck && this.isTokenExpiringSoon() && !skipRefresh) {
        console.log('[TokenRefreshPlugin] Token 即将过期，先刷新...')
        await this.refreshToken()
      }

      // 执行请求
      return await requestFn()

    } catch (error) {
      // 检查是否是 401 错误
      const is401 = this._is401Error(error)
      
      if (is401 && !skipRefresh) {
        console.log('[TokenRefreshPlugin] 🔐 收到 401，尝试刷新 Token...')
        
        // 如果正在刷新，加入等待队列
        if (this.isRefreshing) {
          return new Promise((resolve, reject) => {
            this.pendingRequests.push({
              resolve,
              reject,
              requestFn: () => requestFn()
            })
          })
        }

        try {
          // 刷新 Token
          await this.refreshToken()
          
          // 重发原请求
          console.log('[TokenRefreshPlugin] 🔄 重发原请求...')
          return await requestFn()

        } catch (refreshError) {
          console.error('[TokenRefreshPlugin] 刷新后重发失败:', refreshError)
          throw refreshError
        }
      }

      // 非 401 错误，直接抛出
      throw error
    }
  }

  /**
   * 判断是否是 401 错误
   * @private
   */
  _is401Error(error) {
    // HTTP 状态码
    if (error.statusCode === 401 || error.status === 401) {
      return true
    }
    
    // 响应对象中的状态码
    if (error.response?.status === 401 || error.response?.statusCode === 401) {
      return true
    }
    
    // 业务状态码
    if (error.code === 401 || error.code === 'UNAUTHORIZED') {
      return true
    }
    
    // 错误消息
    if (error.message && (
      error.message.includes('401') ||
      error.message.includes('Unauthorized') ||
      error.message.includes('未授权')
    )) {
      return true
    }

    return false
  }

  /**
   * 创建响应拦截器（用于 http.js）
   * @returns {Function} 拦截器函数
   */
  createResponseInterceptor() {
    return async (response, originalRequest) => {
      const { statusCode } = response

      if (statusCode === 401) {
        console.log('[TokenRefreshPlugin] 🔐 拦截到 401 响应')
        
        try {
          // 刷新 Token
          const newToken = await this.refreshToken()
          
          // 更新原请求的 Token
          if (originalRequest && originalRequest.header) {
            originalRequest.header['Authorization'] = `Bearer ${newToken}`
          }
          
          // 返回标记，让调用方知道需要重发
          return {
            shouldRetry: true,
            newToken
          }

        } catch (error) {
          // 刷新失败，返回原始 401 响应
          return response
        }
      }

      return response
    }
  }

  /**
   * 获取插件状态
   * @returns {Object}
   */
  getStatus() {
    return {
      isRefreshing: this.isRefreshing,
      pendingRequestsCount: this.pendingRequests.length,
      refreshRetryCount: this.refreshRetryCount,
      hasAccessToken: !!this.getAccessToken(),
      hasRefreshToken: !!this.getRefreshToken(),
      isTokenExpiringSoon: this.isTokenExpiringSoon(),
      isTokenExpired: this.isTokenExpired()
    }
  }
}

// 创建单例
const tokenRefreshPlugin = new TokenRefreshPlugin()

// 导出
export { tokenRefreshPlugin, TokenRefreshPlugin }
export default tokenRefreshPlugin
