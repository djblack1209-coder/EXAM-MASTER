/**
 * 离线请求队列 (Offline Queue)
 * 
 * 功能：
 * 1. 网络断开时缓存请求
 * 2. 网络恢复后自动重发
 * 3. 请求持久化（localStorage）
 * 4. 队列优先级管理
 * 5. 请求去重和合并
 * 
 * 使用示例：
 * import { offlineQueue } from '@/utils/offline-queue.js'
 * 
 * // 添加请求到队列
 * offlineQueue.enqueue({
 *   requestFn: () => http.post('/api/data', payload),
 *   priority: 'high',
 *   dedupeKey: 'save-user-data'
 * })
 * 
 * // 手动处理队列
 * await offlineQueue.processQueue()
 */

const STORAGE_KEY = 'EXAM_OFFLINE_QUEUE'
const MAX_QUEUE_SIZE = 100
const MAX_AGE = 24 * 60 * 60 * 1000 // 24小时过期

/**
 * 优先级权重
 */
const PRIORITY_WEIGHTS = {
  critical: 4,
  high: 3,
  normal: 2,
  low: 1
}

/**
 * 离线队列类
 */
class OfflineQueue {
  constructor() {
    this.queue = []
    this.processing = false
    this.isOnline = true
    this.listeners = new Set()
    this.requestFnMap = new Map() // 存储请求函数引用
    
    // 初始化
    this._init()
  }

  /**
   * 初始化
   * @private
   */
  _init() {
    // 从本地存储恢复队列
    this._loadFromStorage()
    
    // 监听网络状态
    this._setupNetworkListener()
    
    console.log(`[OfflineQueue] 初始化完成，队列中有 ${this.queue.length} 个待处理请求`)
  }

  /**
   * 从本地存储加载队列
   * @private
   */
  _loadFromStorage() {
    try {
      const stored = uni.getStorageSync(STORAGE_KEY)
      if (stored && Array.isArray(stored)) {
        // 过滤过期的请求
        const now = Date.now()
        this.queue = stored.filter(item => {
          return (now - item.timestamp) < MAX_AGE
        })
        
        if (this.queue.length !== stored.length) {
          console.log(`[OfflineQueue] 已清理 ${stored.length - this.queue.length} 个过期请求`)
          this._saveToStorage()
        }
      }
    } catch (error) {
      console.error('[OfflineQueue] 加载队列失败:', error)
      this.queue = []
    }
  }

  /**
   * 保存队列到本地存储
   * @private
   */
  _saveToStorage() {
    try {
      // 只保存可序列化的数据
      const serializable = this.queue.map(item => ({
        id: item.id,
        priority: item.priority,
        dedupeKey: item.dedupeKey,
        timestamp: item.timestamp,
        retryCount: item.retryCount,
        requestData: item.requestData, // 请求数据（可序列化）
        metadata: item.metadata
      }))
      
      uni.setStorageSync(STORAGE_KEY, serializable)
    } catch (error) {
      console.error('[OfflineQueue] 保存队列失败:', error)
    }
  }

  /**
   * 设置网络监听
   * @private
   */
  _setupNetworkListener() {
    // 检查当前网络状态
    uni.getNetworkType({
      success: (res) => {
        this.isOnline = res.networkType !== 'none'
        console.log(`[OfflineQueue] 当前网络状态: ${res.networkType}`)
      }
    })

    // 监听网络变化
    uni.onNetworkStatusChange((res) => {
      const wasOffline = !this.isOnline
      this.isOnline = res.isConnected

      console.log(`[OfflineQueue] 网络状态变化: ${res.isConnected ? '在线' : '离线'} (${res.networkType})`)

      // 从离线恢复到在线，自动处理队列
      if (wasOffline && this.isOnline && this.queue.length > 0) {
        console.log('[OfflineQueue] 网络恢复，开始处理离线队列...')
        this.processQueue()
      }

      // 通知监听器
      this._notifyListeners({
        type: 'networkChange',
        isOnline: this.isOnline,
        networkType: res.networkType
      })
    })
  }

  /**
   * 通知监听器
   * @private
   */
  _notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('[OfflineQueue] 监听器执行错误:', error)
      }
    })
  }

  /**
   * 生成唯一ID
   * @private
   */
  _generateId() {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 添加请求到队列
   * @param {Object} request - 请求配置
   * @param {Function} request.requestFn - 请求函数
   * @param {Object} request.requestData - 请求数据（用于持久化）
   * @param {string} request.priority - 优先级 (critical/high/normal/low)
   * @param {string} request.dedupeKey - 去重键（相同键的请求会被合并）
   * @param {Object} request.metadata - 元数据
   * @returns {string} 请求ID
   */
  enqueue(request) {
    const {
      requestFn,
      requestData,
      priority = 'normal',
      dedupeKey,
      metadata = {}
    } = request

    // 检查队列大小
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // 移除最旧的低优先级请求
      const lowPriorityIndex = this.queue.findIndex(item => 
        item.priority === 'low' || item.priority === 'normal'
      )
      
      if (lowPriorityIndex !== -1) {
        const removed = this.queue.splice(lowPriorityIndex, 1)[0]
        console.log(`[OfflineQueue] 队列已满，移除旧请求: ${removed.id}`)
      } else {
        console.warn('[OfflineQueue] 队列已满，无法添加新请求')
        return null
      }
    }

    // 去重检查
    if (dedupeKey) {
      const existingIndex = this.queue.findIndex(item => item.dedupeKey === dedupeKey)
      if (existingIndex !== -1) {
        // 更新现有请求
        const existing = this.queue[existingIndex]
        existing.requestData = requestData
        existing.timestamp = Date.now()
        existing.metadata = { ...existing.metadata, ...metadata }
        
        // 更新请求函数引用
        if (requestFn) {
          this.requestFnMap.set(existing.id, requestFn)
        }
        
        console.log(`[OfflineQueue] 更新已存在的请求: ${dedupeKey}`)
        this._saveToStorage()
        return existing.id
      }
    }

    // 创建新请求
    const id = this._generateId()
    const queueItem = {
      id,
      priority,
      dedupeKey,
      timestamp: Date.now(),
      retryCount: 0,
      requestData,
      metadata
    }

    // 保存请求函数引用（不可序列化）
    if (requestFn) {
      this.requestFnMap.set(id, requestFn)
    }

    // 按优先级插入
    const weight = PRIORITY_WEIGHTS[priority] || PRIORITY_WEIGHTS.normal
    const insertIndex = this.queue.findIndex(item => {
      const itemWeight = PRIORITY_WEIGHTS[item.priority] || PRIORITY_WEIGHTS.normal
      return itemWeight < weight
    })

    if (insertIndex === -1) {
      this.queue.push(queueItem)
    } else {
      this.queue.splice(insertIndex, 0, queueItem)
    }

    console.log(`[OfflineQueue] 📥 请求已入队: ${id} (优先级: ${priority}, 队列长度: ${this.queue.length})`)
    
    this._saveToStorage()
    this._notifyListeners({
      type: 'enqueue',
      request: queueItem,
      queueLength: this.queue.length
    })

    return id
  }

  /**
   * 从队列移除请求
   * @param {string} id - 请求ID
   * @returns {boolean} 是否成功移除
   */
  dequeue(id) {
    const index = this.queue.findIndex(item => item.id === id)
    if (index !== -1) {
      const removed = this.queue.splice(index, 1)[0]
      this.requestFnMap.delete(id)
      this._saveToStorage()
      
      console.log(`[OfflineQueue] 📤 请求已出队: ${id}`)
      this._notifyListeners({
        type: 'dequeue',
        request: removed,
        queueLength: this.queue.length
      })
      
      return true
    }
    return false
  }

  /**
   * 处理队列中的请求
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 处理结果
   */
  async processQueue(options = {}) {
    if (this.processing) {
      console.log('[OfflineQueue] 队列正在处理中...')
      return { success: false, reason: 'already_processing' }
    }

    if (!this.isOnline) {
      console.log('[OfflineQueue] 当前离线，暂停处理队列')
      return { success: false, reason: 'offline' }
    }

    if (this.queue.length === 0) {
      console.log('[OfflineQueue] 队列为空')
      return { success: true, processed: 0, failed: 0 }
    }

    this.processing = true
    console.log(`[OfflineQueue] 🔄 开始处理队列，共 ${this.queue.length} 个请求`)

    const results = {
      processed: 0,
      failed: 0,
      errors: []
    }

    // 复制队列进行处理
    const toProcess = [...this.queue]

    for (const item of toProcess) {
      // 检查网络状态
      if (!this.isOnline) {
        console.log('[OfflineQueue] 网络断开，暂停处理')
        break
      }

      try {
        // 获取请求函数
        const requestFn = this.requestFnMap.get(item.id)
        
        if (!requestFn) {
          // 没有请求函数，尝试从 requestData 重建
          if (item.requestData) {
            console.log(`[OfflineQueue] ⚠️ 请求 ${item.id} 无法执行（函数引用丢失），跳过`)
          }
          this.dequeue(item.id)
          results.failed++
          continue
        }

        console.log(`[OfflineQueue] 📡 处理请求: ${item.id}`)
        
        // 执行请求
        await requestFn()
        
        // 成功，移除队列
        this.dequeue(item.id)
        results.processed++
        
        console.log(`[OfflineQueue] ✅ 请求成功: ${item.id}`)

      } catch (error) {
        console.error(`[OfflineQueue] ❌ 请求失败: ${item.id}`, error)
        
        item.retryCount++
        results.errors.push({
          id: item.id,
          error: error.message || error
        })

        // 超过重试次数，移除
        if (item.retryCount >= 3) {
          console.log(`[OfflineQueue] 🗑️ 请求超过重试次数，移除: ${item.id}`)
          this.dequeue(item.id)
          results.failed++
        } else {
          // 更新重试次数
          this._saveToStorage()
        }
      }

      // 请求间隔，避免过快
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    this.processing = false
    
    console.log(`[OfflineQueue] 📊 队列处理完成: 成功 ${results.processed}, 失败 ${results.failed}`)
    
    this._notifyListeners({
      type: 'processComplete',
      results
    })

    return {
      success: true,
      ...results
    }
  }

  /**
   * 清空队列
   */
  clear() {
    this.queue = []
    this.requestFnMap.clear()
    this._saveToStorage()
    
    console.log('[OfflineQueue] 队列已清空')
    this._notifyListeners({
      type: 'clear',
      queueLength: 0
    })
  }

  /**
   * 获取队列状态
   * @returns {Object} 队列状态
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.processing,
      isOnline: this.isOnline,
      items: this.queue.map(item => ({
        id: item.id,
        priority: item.priority,
        timestamp: item.timestamp,
        retryCount: item.retryCount,
        age: Date.now() - item.timestamp
      }))
    }
  }

  /**
   * 添加监听器
   * @param {Function} listener - 监听函数
   * @returns {Function} 取消监听函数
   */
  addListener(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 暂停队列处理
   */
  pause() {
    this.processing = true // 阻止新的处理
    console.log('[OfflineQueue] 队列处理已暂停')
  }

  /**
   * 恢复队列处理
   */
  resume() {
    this.processing = false
    console.log('[OfflineQueue] 队列处理已恢复')
    
    // 如果在线且有待处理请求，自动开始处理
    if (this.isOnline && this.queue.length > 0) {
      this.processQueue()
    }
  }
}

// 创建单例
const offlineQueue = new OfflineQueue()

// 导出
export { offlineQueue, OfflineQueue }
export default offlineQueue
