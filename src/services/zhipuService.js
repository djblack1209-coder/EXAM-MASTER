/**
 * 智谱AI服务类
 * 用于处理与智谱AI (BigModel) API的通信
 */

import { AI_CONFIG } from '../common/config.js'
import { generateToken } from '../utils/core/jwt.js'

/**
 * 智谱AI服务类
 */
class ZhipuService {
  constructor() {
    this.apiKey = AI_CONFIG.apiKey
    this.baseURL = AI_CONFIG.baseURL
    this.model = AI_CONFIG.model || 'glm-4'
    this.timeout = AI_CONFIG.timeout || 60000
    this.token = null
    this.tokenExpireTime = 0
  }

  /**
   * 获取有效的Token
   * @returns {Promise<string>} Bearer Token
   */
  async getToken() {
    const runtimeKey = AI_CONFIG.getApiKey ? AI_CONFIG.getApiKey() : this.apiKey
    this.apiKey = runtimeKey || this.apiKey
    if (!this.apiKey) {
      throw new Error('未配置智谱AI Key，请在运行时注入 AI_PROVIDER_KEY_PLACEHOLDER
    }
    // 如果token存在且未过期，直接返回
    if (this.token && Date.now() < this.tokenExpireTime) {
      return this.token
    }

    try {
      // 生成新的token
      this.token = await generateToken(this.apiKey)
      // 设置过期时间（提前5分钟刷新）
      this.tokenExpireTime = Date.now() + (55 * 60 * 1000)
      return this.token
    } catch (error) {
      console.error('获取Token失败:', error)
      throw new Error('Token生成失败，请检查API Key配置')
    }
  }

  /**
   * 发送消息到智谱AI
   * @param {Array} messages - 消息数组，格式: [{ role: "user", content: "..." }]
   * @param {Object} options - 可选配置
   * @returns {Promise<Object>} API响应结果
   */
  async sendMessage(messages, options = {}) {
    try {
      // 参数验证
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('messages 参数必须是非空数组')
      }

      // 获取Token
      const token = await this.getToken()

      // 构建请求体
      const requestBody = {
        model: options.model || this.model,
        messages: messages,
        temperature: options.temperature || 0.7,
        ...(options.max_tokens && { max_tokens: options.max_tokens }),
        ...(options.top_p && { top_p: options.top_p }),
        ...(options.stream !== undefined && { stream: options.stream })
      }

      console.log('发送请求到智谱AI:', {
        url: `${this.baseURL}/chat/completions`,
        model: requestBody.model,
        messageCount: messages.length
      })

      // 发送请求
      const response = await this.request({
        url: `${this.baseURL}/chat/completions`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        data: requestBody,
        timeout: this.timeout
      })

      // 验证响应
      if (!response) {
        throw new Error('API响应为空')
      }

      if (response.error) {
        throw new Error(`API错误: ${response.error.message || JSON.stringify(response.error)}`)
      }

      console.log('智谱AI响应成功')
      return response

    } catch (error) {
      console.error('智谱AI请求失败:', {
        message: error.message,
        stack: error.stack
      })

      // 返回友好的错误提示
      return {
        error: true,
        message: this.getErrorMessage(error)
      }
    }
  }

  /**
   * 封装的请求方法（适配uni-app）
   * @param {Object} config - 请求配置
   * @returns {Promise<Object>} 响应数据
   */
  request(config) {
    return new Promise((resolve, reject) => {
      uni.request({
        url: config.url,
        method: config.method || 'GET',
        header: config.headers,
        data: config.data,
        timeout: config.timeout || this.timeout,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data)
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.data?.error?.message || '请求失败'}`))
          }
        },
        fail: (err) => {
          reject(new Error(err.errMsg || '网络请求失败'))
        }
      })
    })
  }

  /**
   * 获取友好的错误提示信息
   * @param {Error} error - 错误对象
   * @returns {string} 错误提示
   */
  getErrorMessage(error) {
    const message = error.message || '未知错误'

    if (message.includes('timeout')) {
      return '请求超时，请检查网络连接后重试'
    }
    if (message.includes('network')) {
      return '网络连接失败，请检查网络设置'
    }
    if (message.includes('401') || message.includes('Unauthorized')) {
      return 'API认证失败，请检查API Key配置'
    }
    if (message.includes('429')) {
      return '请求过于频繁，请稍后再试'
    }
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return '服务器错误，请稍后重试'
    }

    return `请求失败: ${message}`
  }

  /**
   * 生成待办清单计划
   * @param {Object} schoolInfo - 择校信息
   * @returns {Promise<Array|Object>} 计划数组或错误对象
   */
  async generateTodoPlan(schoolInfo = {}) {
    const messages = [
      {
        role: 'system',
        content: '你是专业考研备考规划助手，只返回严格的 JSON 数组。'
      },
      {
        role: 'user',
        content: `请根据以下择校信息生成 3-5 条备考 To do 计划，返回 JSON 数组。
每条包含字段：title（任务名称）、status（todo/done）、priority（high/medium/low）。
不要输出多余文字，只返回 JSON 数组。
择校信息：${JSON.stringify(schoolInfo)}`
      }
    ]

    try {
      const response = await this.sendMessage(messages, {
        temperature: 0.4,
        max_tokens: 500
      })

      if (response.error) {
        return { error: true, message: response.message }
      }

      const content = response?.choices?.[0]?.message?.content
      const plan = this.extractJsonArray(content)

      if (!Array.isArray(plan)) {
        return { error: true, message: 'AI 返回格式错误' }
      }

      return plan.slice(0, 5)
    } catch (error) {
      console.error('生成待办计划失败:', error)
      return { error: true, message: this.getErrorMessage(error) }
    }
  }

  /**
   * 提取 JSON 数组
   * @param {string} content - AI 返回内容
   * @returns {Array|null}
   */
  extractJsonArray(content) {
    if (!content) return null
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return null
    try {
      return JSON.parse(jsonMatch[0])
    } catch (error) {
      return null
    }
  }

  /**
   * 流式对话（用于实时返回结果）
   * @param {Array} messages - 消息数组
   * @param {Function} onMessage - 收到消息时的回调
   * @param {Object} options - 可选配置
   */
  async streamChat(messages, onMessage, options = {}) {
    try {
      // 注意：uni-app的uni.request不支持流式响应
      // 这里提供一个基本实现，实际使用可能需要WebSocket或SSE
      console.warn('流式对话功能需要WebSocket或SSE支持，当前为模拟实现')

      const response = await this.sendMessage(messages, {
        ...options,
        stream: false // uni-app暂不支持stream
      })

      if (response.error) {
        throw new Error(response.message)
      }

      // 模拟流式返回
      if (response.choices && response.choices[0]) {
        const content = response.choices[0].message.content
        onMessage(content)
      }

      return response

    } catch (error) {
      console.error('流式对话失败:', error)
      throw error
    }
  }
}

// 创建单例实例
const zhipuService = new ZhipuService()

export default zhipuService

// 导出类供扩展使用
export { ZhipuService }
