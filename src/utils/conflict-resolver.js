/**
 * 数据冲突解决器 (Conflict Resolver)
 * 
 * 功能：
 * 1. 检测本地与云端数据版本冲突
 * 2. 基于时间戳和版本号的冲突检测
 * 3. 多种冲突解决策略
 * 4. 字段级别的智能合并
 * 5. 冲突历史记录
 * 
 * 使用示例：
 * import { conflictResolver } from '@/utils/conflict-resolver.js'
 * 
 * // 检测冲突
 * const conflict = conflictResolver.detectConflict(localData, cloudData)
 * 
 * // 自动解决
 * const resolved = conflictResolver.resolve(localData, cloudData, 'cloud_wins')
 * 
 * // 手动合并
 * const merged = conflictResolver.merge(localData, cloudData, userSelections)
 */

const CONFLICT_STORAGE_KEY = 'EXAM_CONFLICT_HISTORY'
const MAX_CONFLICT_HISTORY = 50

/**
 * 冲突类型
 */
const CONFLICT_TYPES = {
  VERSION_MISMATCH: 'version_mismatch',     // 版本号不匹配
  TIMESTAMP_CONFLICT: 'timestamp_conflict', // 时间戳冲突
  FIELD_CONFLICT: 'field_conflict',         // 字段级冲突
  DELETE_CONFLICT: 'delete_conflict',       // 删除冲突（一方删除，一方修改）
  CREATE_CONFLICT: 'create_conflict'        // 创建冲突（同时创建相同ID）
}

/**
 * 解决策略
 */
const RESOLUTION_STRATEGIES = {
  LOCAL_WINS: 'local_wins',       // 本地优先
  CLOUD_WINS: 'cloud_wins',       // 云端优先
  LATEST_WINS: 'latest_wins',     // 最新优先
  MANUAL: 'manual',               // 手动选择
  MERGE: 'merge'                  // 智能合并
}

/**
 * 冲突解决器类
 */
class ConflictResolver {
  constructor() {
    this.config = {
      defaultStrategy: RESOLUTION_STRATEGIES.LATEST_WINS,
      versionField: 'version',
      timestampField: 'updated_at',
      enableHistory: true,
      onConflictDetected: null,   // 冲突检测回调
      onConflictResolved: null    // 冲突解决回调
    }
    
    this.conflictHistory = []
    this._loadHistory()
  }

  /**
   * 配置解决器
   * @param {Object} config - 配置对象
   */
  configure(config) {
    this.config = { ...this.config, ...config }
    console.log('[ConflictResolver] 配置已更新')
  }

  /**
   * 加载冲突历史
   * @private
   */
  _loadHistory() {
    try {
      const stored = uni.getStorageSync(CONFLICT_STORAGE_KEY)
      if (stored && Array.isArray(stored)) {
        this.conflictHistory = stored
      }
    } catch (error) {
      console.error('[ConflictResolver] 加载历史失败:', error)
    }
  }

  /**
   * 保存冲突历史
   * @private
   */
  _saveHistory() {
    if (!this.config.enableHistory) return
    
    try {
      // 限制历史记录数量
      if (this.conflictHistory.length > MAX_CONFLICT_HISTORY) {
        this.conflictHistory = this.conflictHistory.slice(-MAX_CONFLICT_HISTORY)
      }
      
      uni.setStorageSync(CONFLICT_STORAGE_KEY, this.conflictHistory)
    } catch (error) {
      console.error('[ConflictResolver] 保存历史失败:', error)
    }
  }

  /**
   * 记录冲突
   * @private
   */
  _recordConflict(conflict, resolution) {
    const record = {
      id: `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      conflict,
      resolution,
      resolved: !!resolution
    }
    
    this.conflictHistory.push(record)
    this._saveHistory()
    
    return record
  }

  /**
   * 获取数据的版本号
   * @private
   */
  _getVersion(data) {
    if (!data) return 0
    return data[this.config.versionField] || data.version || 0
  }

  /**
   * 获取数据的时间戳
   * @private
   */
  _getTimestamp(data) {
    if (!data) return 0
    
    const field = this.config.timestampField
    const timestamp = data[field] || data.updated_at || data.updatedAt || 
                     data.timestamp || data.modified_at || data.modifiedAt
    
    // 处理各种时间格式
    if (typeof timestamp === 'number') {
      return timestamp
    }
    
    if (typeof timestamp === 'string') {
      return new Date(timestamp).getTime()
    }
    
    return 0
  }

  /**
   * 检测冲突
   * @param {Object} localData - 本地数据
   * @param {Object} cloudData - 云端数据
   * @param {Object} options - 选项
   * @returns {Object|null} 冲突信息，无冲突返回 null
   */
  detectConflict(localData, cloudData, options = {}) {
    // 基础检查
    if (!localData && !cloudData) {
      return null
    }
    
    // 一方为空
    if (!localData || !cloudData) {
      return {
        type: CONFLICT_TYPES.DELETE_CONFLICT,
        hasLocal: !!localData,
        hasCloud: !!cloudData,
        localData,
        cloudData
      }
    }

    const localVersion = this._getVersion(localData)
    const cloudVersion = this._getVersion(cloudData)
    const localTimestamp = this._getTimestamp(localData)
    const cloudTimestamp = this._getTimestamp(cloudData)

    // 版本号检测
    if (localVersion !== cloudVersion) {
      // 如果云端版本更高，可能是正常同步
      if (cloudVersion > localVersion && !this._hasLocalChanges(localData)) {
        return null // 无冲突，云端更新
      }
      
      // 本地有修改但版本落后
      if (localVersion < cloudVersion && this._hasLocalChanges(localData)) {
        return {
          type: CONFLICT_TYPES.VERSION_MISMATCH,
          localVersion,
          cloudVersion,
          localTimestamp,
          cloudTimestamp,
          localData,
          cloudData,
          conflictFields: this._findConflictFields(localData, cloudData)
        }
      }
    }

    // 时间戳检测（版本相同但时间戳不同）
    if (localTimestamp && cloudTimestamp && localTimestamp !== cloudTimestamp) {
      // 检查是否有实际字段冲突
      const conflictFields = this._findConflictFields(localData, cloudData)
      
      if (conflictFields.length > 0) {
        return {
          type: CONFLICT_TYPES.TIMESTAMP_CONFLICT,
          localVersion,
          cloudVersion,
          localTimestamp,
          cloudTimestamp,
          localData,
          cloudData,
          conflictFields
        }
      }
    }

    // 字段级检测
    const conflictFields = this._findConflictFields(localData, cloudData)
    if (conflictFields.length > 0) {
      return {
        type: CONFLICT_TYPES.FIELD_CONFLICT,
        localVersion,
        cloudVersion,
        localTimestamp,
        cloudTimestamp,
        localData,
        cloudData,
        conflictFields
      }
    }

    return null // 无冲突
  }

  /**
   * 检查本地是否有未同步的修改
   * @private
   */
  _hasLocalChanges(data) {
    // 检查同步状态标记
    if (data.sync_status === 'pending' || data.sync_status === 'modified') {
      return true
    }
    
    // 检查脏标记
    if (data._dirty || data.isDirty) {
      return true
    }
    
    return false
  }

  /**
   * 查找冲突字段
   * @private
   */
  _findConflictFields(localData, cloudData) {
    const conflicts = []
    
    // 忽略的字段
    const ignoreFields = new Set([
      'id', '_id', 'created_at', 'createdAt', 'updated_at', 'updatedAt',
      'version', 'sync_status', '_dirty', 'isDirty', '__v'
    ])
    
    // 获取所有字段
    const allFields = new Set([
      ...Object.keys(localData || {}),
      ...Object.keys(cloudData || {})
    ])
    
    for (const field of allFields) {
      if (ignoreFields.has(field)) continue
      
      const localValue = localData?.[field]
      const cloudValue = cloudData?.[field]
      
      // 深度比较
      if (!this._deepEqual(localValue, cloudValue)) {
        conflicts.push({
          field,
          localValue,
          cloudValue
        })
      }
    }
    
    return conflicts
  }

  /**
   * 深度比较
   * @private
   */
  _deepEqual(a, b) {
    if (a === b) return true
    
    if (typeof a !== typeof b) return false
    
    if (a === null || b === null) return a === b
    
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      return a.every((item, index) => this._deepEqual(item, b[index]))
    }
    
    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a)
      const keysB = Object.keys(b)
      
      if (keysA.length !== keysB.length) return false
      
      return keysA.every(key => this._deepEqual(a[key], b[key]))
    }
    
    return false
  }

  /**
   * 解决冲突
   * @param {Object} localData - 本地数据
   * @param {Object} cloudData - 云端数据
   * @param {string} strategy - 解决策略
   * @returns {Object} 解决后的数据
   */
  resolve(localData, cloudData, strategy = null) {
    const useStrategy = strategy || this.config.defaultStrategy
    
    console.log(`[ConflictResolver] 使用策略 "${useStrategy}" 解决冲突`)
    
    let resolved
    
    switch (useStrategy) {
      case RESOLUTION_STRATEGIES.LOCAL_WINS:
        resolved = this._resolveLocalWins(localData, cloudData)
        break
        
      case RESOLUTION_STRATEGIES.CLOUD_WINS:
        resolved = this._resolveCloudWins(localData, cloudData)
        break
        
      case RESOLUTION_STRATEGIES.LATEST_WINS:
        resolved = this._resolveLatestWins(localData, cloudData)
        break
        
      case RESOLUTION_STRATEGIES.MERGE:
        resolved = this._resolveMerge(localData, cloudData)
        break
        
      case RESOLUTION_STRATEGIES.MANUAL:
        // 手动模式不自动解决，返回冲突信息
        return {
          needsManualResolution: true,
          conflict: this.detectConflict(localData, cloudData),
          localData,
          cloudData
        }
        
      default:
        console.warn(`[ConflictResolver] 未知策略: ${useStrategy}，使用最新优先`)
        resolved = this._resolveLatestWins(localData, cloudData)
    }
    
    // 记录解决历史
    const conflict = this.detectConflict(localData, cloudData)
    if (conflict) {
      this._recordConflict(conflict, {
        strategy: useStrategy,
        result: resolved,
        timestamp: Date.now()
      })
    }
    
    // 回调
    if (typeof this.config.onConflictResolved === 'function') {
      this.config.onConflictResolved({
        strategy: useStrategy,
        localData,
        cloudData,
        resolved
      })
    }
    
    return resolved
  }

  /**
   * 本地优先解决
   * @private
   */
  _resolveLocalWins(localData, cloudData) {
    if (!localData) return cloudData
    
    return {
      ...cloudData,
      ...localData,
      version: Math.max(this._getVersion(localData), this._getVersion(cloudData)) + 1,
      updated_at: Date.now(),
      _resolved: 'local_wins'
    }
  }

  /**
   * 云端优先解决
   * @private
   */
  _resolveCloudWins(localData, cloudData) {
    if (!cloudData) return localData
    
    return {
      ...localData,
      ...cloudData,
      version: Math.max(this._getVersion(localData), this._getVersion(cloudData)) + 1,
      updated_at: Date.now(),
      _resolved: 'cloud_wins'
    }
  }

  /**
   * 最新优先解决
   * @private
   */
  _resolveLatestWins(localData, cloudData) {
    const localTimestamp = this._getTimestamp(localData)
    const cloudTimestamp = this._getTimestamp(cloudData)
    
    if (localTimestamp >= cloudTimestamp) {
      return this._resolveLocalWins(localData, cloudData)
    } else {
      return this._resolveCloudWins(localData, cloudData)
    }
  }

  /**
   * 智能合并解决
   * @private
   */
  _resolveMerge(localData, cloudData) {
    if (!localData) return cloudData
    if (!cloudData) return localData
    
    const merged = { ...cloudData }
    const localTimestamp = this._getTimestamp(localData)
    const cloudTimestamp = this._getTimestamp(cloudData)
    
    // 逐字段合并
    const conflictFields = this._findConflictFields(localData, cloudData)
    
    for (const { field, localValue, cloudValue } of conflictFields) {
      // 如果本地更新时间更晚，使用本地值
      if (localTimestamp > cloudTimestamp) {
        merged[field] = localValue
      }
      // 否则保留云端值（已在 merged 中）
    }
    
    // 更新版本和时间戳
    merged.version = Math.max(this._getVersion(localData), this._getVersion(cloudData)) + 1
    merged.updated_at = Date.now()
    merged._resolved = 'merge'
    merged._mergedFields = conflictFields.map(c => c.field)
    
    return merged
  }

  /**
   * 手动合并（用户选择每个字段）
   * @param {Object} localData - 本地数据
   * @param {Object} cloudData - 云端数据
   * @param {Object} selections - 用户选择 { fieldName: 'local' | 'cloud' }
   * @returns {Object} 合并后的数据
   */
  merge(localData, cloudData, selections) {
    const merged = { ...cloudData, ...localData }
    
    // 应用用户选择
    for (const [field, choice] of Object.entries(selections)) {
      if (choice === 'cloud' && cloudData) {
        merged[field] = cloudData[field]
      } else if (choice === 'local' && localData) {
        merged[field] = localData[field]
      }
    }
    
    // 更新元数据
    merged.version = Math.max(this._getVersion(localData), this._getVersion(cloudData)) + 1
    merged.updated_at = Date.now()
    merged._resolved = 'manual'
    merged._selections = selections
    
    // 记录
    const conflict = this.detectConflict(localData, cloudData)
    if (conflict) {
      this._recordConflict(conflict, {
        strategy: 'manual',
        selections,
        result: merged,
        timestamp: Date.now()
      })
    }
    
    return merged
  }

  /**
   * 批量检测冲突
   * @param {Array} localItems - 本地数据数组
   * @param {Array} cloudItems - 云端数据数组
   * @param {string} idField - ID 字段名
   * @returns {Array} 冲突列表
   */
  detectBatchConflicts(localItems, cloudItems, idField = 'id') {
    const conflicts = []
    
    // 创建云端数据映射
    const cloudMap = new Map()
    for (const item of cloudItems) {
      const id = item[idField] || item._id
      if (id) cloudMap.set(id, item)
    }
    
    // 检测每个本地项
    for (const localItem of localItems) {
      const id = localItem[idField] || localItem._id
      if (!id) continue
      
      const cloudItem = cloudMap.get(id)
      const conflict = this.detectConflict(localItem, cloudItem)
      
      if (conflict) {
        conflicts.push({
          id,
          ...conflict
        })
      }
    }
    
    // 检测云端新增（本地不存在）
    const localIds = new Set(localItems.map(item => item[idField] || item._id))
    for (const cloudItem of cloudItems) {
      const id = cloudItem[idField] || cloudItem._id
      if (id && !localIds.has(id)) {
        // 云端新增，不算冲突
      }
    }
    
    return conflicts
  }

  /**
   * 批量解决冲突
   * @param {Array} conflicts - 冲突列表
   * @param {string} strategy - 解决策略
   * @returns {Array} 解决后的数据
   */
  resolveBatch(conflicts, strategy = null) {
    return conflicts.map(conflict => ({
      id: conflict.id,
      resolved: this.resolve(conflict.localData, conflict.cloudData, strategy)
    }))
  }

  /**
   * 获取冲突历史
   * @param {number} limit - 限制数量
   * @returns {Array}
   */
  getHistory(limit = 20) {
    return this.conflictHistory.slice(-limit).reverse()
  }

  /**
   * 清除冲突历史
   */
  clearHistory() {
    this.conflictHistory = []
    this._saveHistory()
    console.log('[ConflictResolver] 历史已清除')
  }

  /**
   * 获取统计信息
   * @returns {Object}
   */
  getStats() {
    const total = this.conflictHistory.length
    const resolved = this.conflictHistory.filter(c => c.resolved).length
    
    const byType = {}
    const byStrategy = {}
    
    for (const record of this.conflictHistory) {
      // 按类型统计
      const type = record.conflict?.type || 'unknown'
      byType[type] = (byType[type] || 0) + 1
      
      // 按策略统计
      if (record.resolution) {
        const strategy = record.resolution.strategy || 'unknown'
        byStrategy[strategy] = (byStrategy[strategy] || 0) + 1
      }
    }
    
    return {
      total,
      resolved,
      unresolved: total - resolved,
      byType,
      byStrategy
    }
  }
}

// 创建单例
const conflictResolver = new ConflictResolver()

// 导出常量
export { CONFLICT_TYPES, RESOLUTION_STRATEGIES }

// 导出
export { conflictResolver, ConflictResolver }
export default conflictResolver
