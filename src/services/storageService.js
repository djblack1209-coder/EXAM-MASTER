/**
 * 统一存储服务层 (Storage Service Layer)
 * 
 * 目的：
 * 1. 封装 uni.getStorageSync/setStorageSync，统一存储接口
 * 2. 支持云端数据库同步（混合模式：云端优先，本地降级）
 * 3. 提供统一的错误处理和日志记录
 * 4. 支持数据加密、压缩等扩展功能
 * 
 * 使用示例：
 * import { storageService } from '@/services/storageService.js'
 * 
 * // 保存数据（本地）
 * storageService.save('mistakes', mistakeList)
 * 
 * // 读取数据（本地）
 * const mistakes = storageService.get('mistakes', [])
 * 
 * // 错题相关（云端+本地混合）
 * await storageService.saveMistake(mistakeData)
 * const mistakes = await storageService.getMistakes(1, 20)
 * await storageService.removeMistake(mistakeId)
 * await storageService.updateMistakeStatus(mistakeId, true)
 */

import { lafService } from './lafService.js'

/**
 * 获取当前用户ID
 */
const getUserId = () => {
  // 优先使用 EXAM_USER_ID，兼容旧的 user_id
  return uni.getStorageSync('EXAM_USER_ID') || uni.getStorageSync('user_id') || null
}

/**
 * 存储服务类
 */
class StorageService {
  /**
   * 保存数据到本地存储
   * @param {string} key - 存储键名
   * @param {any} value - 要存储的值（支持对象、数组、字符串等）
   * @param {boolean} silent - 是否静默失败（不显示错误提示）
   * @returns {boolean} 是否保存成功
   */
  save(key, value, silent = false) {
    try {
      uni.setStorageSync(key, value)
      return true
    } catch (error) {
      console.error(`[StorageService] 保存失败: ${key}`, error)
      if (!silent) {
        uni.showToast({
          title: '保存失败，请检查存储空间',
          icon: 'none',
          duration: 2000
        })
      }
      return false
    }
  }

  /**
   * 从本地存储读取数据
   * @param {string} key - 存储键名
   * @param {any} defaultValue - 如果不存在时返回的默认值
   * @returns {any} 存储的值或默认值
   */
  get(key, defaultValue = null) {
    try {
      const value = uni.getStorageSync(key)
      // uni.getStorageSync 在 key 不存在时返回空字符串，需要判断
      if (value === '' || value === null || value === undefined) {
        return defaultValue
      }
      return value
    } catch (error) {
      console.error(`[StorageService] 读取失败: ${key}`, error)
      return defaultValue
    }
  }

  /**
   * 删除指定的存储项
   * @param {string} key - 要删除的键名
   * @param {boolean} silent - 是否静默失败
   * @returns {boolean} 是否删除成功
   */
  remove(key, silent = false) {
    try {
      uni.removeStorageSync(key)
      return true
    } catch (error) {
      console.error(`[StorageService] 删除失败: ${key}`, error)
      if (!silent) {
        uni.showToast({
          title: '删除失败',
          icon: 'none',
          duration: 2000
        })
      }
      return false
    }
  }

  /**
   * 清空所有本地存储（谨慎使用！）
   * @param {boolean} silent - 是否静默失败
   * @returns {boolean} 是否清空成功
   */
  clear(silent = false) {
    try {
      uni.clearStorageSync()
      return true
    } catch (error) {
      console.error('[StorageService] 清空存储失败', error)
      if (!silent) {
        uni.showToast({
          title: '清空失败',
          icon: 'none',
          duration: 2000
        })
      }
      return false
    }
  }

  /**
   * 检查指定键是否存在
   * @param {string} key - 要检查的键名
   * @returns {boolean} 是否存在
   */
  has(key) {
    try {
      const value = uni.getStorageSync(key)
      return value !== '' && value !== null && value !== undefined
    } catch (error) {
      console.error(`[StorageService] 检查失败: ${key}`, error)
      return false
    }
  }

  /**
   * 获取所有存储的键名（仅用于调试）
   * @returns {string[]} 所有键名数组
   */
  getAllKeys() {
    try {
      return uni.getStorageInfoSync().keys || []
    } catch (error) {
      console.error('[StorageService] 获取所有键名失败', error)
      return []
    }
  }

  /**
   * 获取存储信息（大小、键数量等）
   * @returns {Object} 存储信息对象
   */
  getStorageInfo() {
    try {
      return uni.getStorageInfoSync()
    } catch (error) {
      console.error('[StorageService] 获取存储信息失败', error)
      return { keys: [], currentSize: 0, limitSize: 0 }
    }
  }

  /**
   * 批量保存多个键值对
   * @param {Object} data - 键值对对象，如 { key1: value1, key2: value2 }
   * @param {boolean} silent - 是否静默失败
   * @returns {boolean} 是否全部保存成功
   */
  saveBatch(data, silent = false) {
    try {
      Object.keys(data).forEach(key => {
        this.save(key, data[key], true) // 批量操作时静默单个失败
      })
      return true
    } catch (error) {
      console.error('[StorageService] 批量保存失败', error)
      if (!silent) {
        uni.showToast({
          title: '批量保存失败',
          icon: 'none',
          duration: 2000
        })
      }
      return false
    }
  }

  /**
   * 批量读取多个键的值
   * @param {string[]} keys - 要读取的键名数组
   * @returns {Object} 键值对对象，如 { key1: value1, key2: value2 }
   */
  getBatch(keys) {
    const result = {}
    keys.forEach(key => {
      result[key] = this.get(key)
    })
    return result
  }

  // ==================== 错题本云端同步方法 ====================

  /**
   * 保存错题（使用 Laf 后端）
   * @param {Object} data - 错题数据
   * @returns {Promise<Object>} 返回保存结果
   */
  async addMistake(data) {
    const userId = uni.getStorageSync('EXAM_USER_ID')
    if (!userId) {
      console.warn('[StorageService] 用户未登录，降级到本地存储')
      return this._saveMistakeLocal(data, 'local_only')
    }
    
    try {
      console.log('[StorageService] 📡 开始保存错题到云端...')
      const res = await lafService.request('/mistake-manager', { 
        action: 'add', 
        data, 
        userId 
      })
      
      // 统一返回格式：后端可能返回 {id: "...", ok: true} 或 {code: 0, data: {...}}
      const cloudId = res.id || res._id || res.data?.id || res.data?._id
      const isSuccess = (res.ok === true || res.code === 0) && cloudId
      
      if (isSuccess) {
        console.log(`[StorageService] ✅ 云端保存成功 - ID: ${cloudId}`)
        // 更新本地缓存（云端保存成功后，同步更新本地）
        const localMistakes = this.get('mistake_book', [])
        const newMistake = {
          ...data,
          id: cloudId,
          _id: cloudId,
          sync_status: 'synced',
          created_at: Date.now()
        }
        localMistakes.unshift(newMistake)
        this.save('mistake_book', localMistakes, true)
        console.log(`[StorageService] ✅ 本地缓存已同步更新`)
        
        return {
          success: true,
          id: cloudId,
          source: 'cloud'
        }
      } else {
        console.warn('[StorageService] ⚠️ 云端保存返回格式异常，降级到本地:', res)
        return this._saveMistakeLocal(data, 'pending')
      }
    } catch (error) {
      console.warn('[StorageService] ⚠️ 云端保存异常，降级到本地存储:', error)
      const localResult = this._saveMistakeLocal(data, 'pending')
      if (localResult.success) {
        console.log('[StorageService] ✅ 已降级到本地保存，sync_status: pending')
      }
      return localResult
    }
  }

  /**
   * 保存错题（兼容旧方法名）
   * @param {Object} mistakeData - 错题数据
   * @returns {Promise<Object>} 返回保存结果
   */
  async saveMistake(mistakeData) {
    return this.addMistake(mistakeData)
  }

  /**
   * 本地保存错题（内部方法）
   * @private
   */
  _saveMistakeLocal(mistakeData, syncStatus = 'pending') {
    try {
      const localMistakes = this.get('mistake_book', [])
      const newMistake = {
        ...mistakeData,
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sync_status: syncStatus,
        created_at: Date.now()
      }
      localMistakes.unshift(newMistake)
      this.save('mistake_book', localMistakes, true)
      
      return {
        success: true,
        id: newMistake.id,
        source: 'local',
        sync_status: syncStatus
      }
    } catch (error) {
      console.error('[StorageService] 本地保存错题失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 获取错题列表（使用 Laf 后端）
   * @param {number} page - 页码（从1开始，可选，用于兼容）
   * @param {number} limit - 每页数量（可选，用于兼容）
   * @param {Object} filters - 筛选条件（可选，用于兼容）
   * @returns {Promise<Array>} 返回错题列表数组
   */
  async getMistakes(page = 1, limit = 20, filters = {}) {
    const userId = uni.getStorageSync('EXAM_USER_ID')
    if (!userId) {
      console.warn('[StorageService] 用户未登录，使用本地存储')
      return this._getMistakesLocal(page, limit, filters)
    }
    
    try {
      console.log(`[StorageService] 开始从云端获取错题列表 (page: ${page}, limit: ${limit})`)
      const res = await lafService.request('/mistake-manager', { 
        action: 'get', 
        userId 
      })
      console.log(`[StorageService] ✅ 云端获取成功，返回 ${Array.isArray(res.data) ? res.data.length : (res.data?.data?.length || res.data?.list?.length || 0)} 条记录`)
      
      // 返回数据数组，兼容旧代码期望的格式
      const mistakeList = res.data || []
      
      // 如果返回的是对象格式，尝试提取数组
      let list = Array.isArray(mistakeList) ? mistakeList : (mistakeList.data || mistakeList.list || [])
      
      // 更新本地缓存（第一页时），合并本地待同步数据
      if (page === 1 && Array.isArray(list)) {
        // 获取本地待同步的错题（sync_status 为 'pending' 或 'local_only'）
        const localMistakes = this.get('mistake_book', [])
        const pendingMistakes = localMistakes.filter(m => 
          (m.sync_status === 'pending' || m.sync_status === 'local_only') && 
          m.id && m.id.startsWith('local_')
        )
        
        if (pendingMistakes.length > 0) {
          // 合并云端数据和本地待同步数据（去重：如果云端已有相同题目，保留云端版本）
          const cloudIds = new Set(list.map(m => m.id || m._id).filter(Boolean))
          const mergedList = [
            ...list, // 云端数据优先
            ...pendingMistakes.filter(m => {
              const mId = m.id || m._id
              // 如果本地待同步数据在云端不存在，则保留
              return mId && mId.startsWith('local_') && !cloudIds.has(mId)
            })
          ]
          
          // 按创建时间倒序排序
          mergedList.sort((a, b) => {
            const timeA = a.created_at || a.addTime || a.timestamp || 0
            const timeB = b.created_at || b.addTime || b.timestamp || 0
            return timeB - timeA
          })
          
          // 使用合并后的列表进行后续处理
          list = mergedList
          
          // 保存合并后的数据到本地缓存
          this.save('mistake_book', mergedList, true)
          console.log(`[StorageService] ✅ 已合并 ${pendingMistakes.length} 条本地待同步错题到列表`)
        } else {
          // 没有待同步数据，直接保存云端数据
          this.save('mistake_book', list, true)
        }
      }
      
      // 应用筛选和分页（兼容旧代码）
      let filteredList = list
      if (filters.is_mastered !== undefined) {
        filteredList = filteredList.filter(m => m.is_mastered === filters.is_mastered)
      }
      
      // 分页处理
      const skip = (page - 1) * limit
      const paginatedList = filteredList.slice(skip, skip + limit)
      
      // 统一返回对象格式，保持接口一致性
      return {
        list: paginatedList,
        total: filteredList.length,
        page: page,
        limit: limit,
        hasMore: skip + limit < filteredList.length,
        source: 'cloud'
      }
    } catch (error) {
      console.warn('[StorageService] Laf 获取异常，降级到本地:', error)
      return this._getMistakesLocal(page, limit, filters)
    }
  }

  /**
   * 本地获取错题列表（内部方法）
   * @private
   */
  _getMistakesLocal(page = 1, limit = 20, filters = {}) {
    try {
      const allMistakes = this.get('mistake_book', [])
      
      // 应用筛选条件
      let filteredMistakes = allMistakes
      if (filters.is_mastered !== undefined) {
        filteredMistakes = filteredMistakes.filter(m => m.is_mastered === filters.is_mastered)
      }
      
      // 按创建时间倒序排序
      filteredMistakes.sort((a, b) => {
        const timeA = a.created_at || a.addTime || 0
        const timeB = b.created_at || b.addTime || 0
        return timeB - timeA
      })
      
      // 分页
      const skip = (page - 1) * limit
      const paginatedList = filteredMistakes.slice(skip, skip + limit)
      
      return {
        list: paginatedList,
        total: filteredMistakes.length,
        page: page,
        limit: limit,
        hasMore: skip + limit < filteredMistakes.length,
        source: 'local'
      }
    } catch (error) {
      console.error('[StorageService] 本地获取错题失败:', error)
      return {
        list: [],
        total: 0,
        page: page,
        limit: limit,
        hasMore: false,
        source: 'local'
      }
    }
  }

  /**
   * 删除错题（使用 Laf 后端）
   * @param {string} id - 错题ID
   * @returns {Promise<Object>} 返回删除结果 { success: boolean, source: 'cloud'|'local' }
   */
  async removeMistake(id) {
    if (!id) {
      return { success: false, error: '错题ID不能为空' }
    }
    
    const userId = getUserId()
    if (!userId) {
      console.warn('[StorageService] 用户未登录，仅删除本地')
      return this._removeMistakeLocal(id)
    }
    
    // 使用 Laf 后端删除
    try {
      console.log(`[StorageService] 开始删除错题: ${id}`)
      const res = await lafService.request('/mistake-manager', {
        action: 'remove',
        data: { id },
        userId: userId
      })
      
      // 后端返回格式: {deleted: 1, ok: true} 或 {deleted: 0, ok: true}
      if (res.ok === true) {
        if (res.deleted > 0) {
          // 云端删除成功（云端确实有这条记录并已删除）
          console.log(`[StorageService] ✅ 云端删除成功: ${id} (deleted: ${res.deleted})`)
        } else {
          // 云端没有这条记录（可能是本地待同步数据），但仍认为操作成功
          console.log(`[StorageService] ⚠️ 云端未找到记录: ${id} (可能是本地待同步数据)，仅删除本地`)
        }
        // 无论云端是否找到记录，都同步删除本地
        const localResult = this._removeMistakeLocal(id)
        if (localResult.success) {
          console.log(`[StorageService] ✅ 本地缓存已同步删除: ${id}`)
        }
        return { success: true, source: 'cloud' }
      } else {
        // 云端删除失败，尝试本地删除
        console.warn('[StorageService] Laf 删除失败，尝试本地删除:', res.message || res)
        return this._removeMistakeLocal(id)
      }
    } catch (error) {
      // 网络错误，尝试本地删除
      console.warn('[StorageService] Laf 删除异常，尝试本地删除:', error)
      return this._removeMistakeLocal(id)
    }
  }

  /**
   * 本地删除错题（内部方法）
   * @private
   */
  _removeMistakeLocal(id) {
    try {
      const localMistakes = this.get('mistake_book', [])
      const index = localMistakes.findIndex(m => m.id === id || m._id === id)
      
      if (index !== -1) {
        localMistakes.splice(index, 1)
        this.save('mistake_book', localMistakes, true)
        console.log(`[StorageService] ✅ 本地删除成功: ${id}, 剩余 ${localMistakes.length} 条`)
        return { success: true, source: 'local' }
      } else {
        console.warn(`[StorageService] ⚠️ 本地缓存中未找到错题: ${id}`)
        return { success: false, error: '错题不存在' }
      }
    } catch (error) {
      console.error('[StorageService] 本地删除错题失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 更新错题掌握状态（云端+本地）
   * @param {string} id - 错题ID
   * @param {boolean} is_mastered - 是否已掌握
   * @returns {Promise<Object>} 返回更新结果 { success: boolean, source: 'cloud'|'local' }
   */
  async updateMistakeStatus(id, is_mastered) {
    if (!id) {
      console.warn('[StorageService] ⚠️ 更新错题状态失败：错题ID不能为空');
      return { success: false, error: '错题ID不能为空' }
    }
    
    const userId = getUserId()
    if (!userId) {
      console.warn('[StorageService] ⚠️ 用户未登录，仅更新本地状态');
      return this._updateMistakeStatusLocal(id, is_mastered)
    }
    
    console.log(`[StorageService] 📡 开始更新错题状态 - ID: ${id}, is_mastered: ${is_mastered}`);
    
    // 优先尝试云端更新（使用 Laf 后端）
    try {
      console.log(`[StorageService] 🌐 发送云端更新请求: /mistake-manager { action: 'updateStatus', id: ${id}, is_mastered: ${is_mastered} }`);
      const res = await lafService.request('/mistake-manager', {
        action: 'updateStatus',
        data: { id, is_mastered },
        userId: userId
      })
      
      console.log(`[StorageService] 📥 云端更新响应:`, res);
      
      // 检查返回格式：可能是 {code: 200, ok: true, updated: 1} 或 {ok: true} 或 {code: 0, data: {...}}
      const cloudId = res.id || res._id || res.data?.id
      const isSuccess = (res.ok === true || res.code === 200 || res.code === 0) && (res.updated > 0 || res.ok === true || cloudId)
      
      if (isSuccess) {
        console.log(`[StorageService] ✅ 云端状态更新成功 - ID: ${id}, is_mastered: ${is_mastered}, 响应:`, res);
        // 云端更新成功，同步更新本地
        const localResult = this._updateMistakeStatusLocal(id, is_mastered)
        if (localResult.success) {
          console.log(`[StorageService] ✅ 本地缓存已同步更新`);
        }
        return { success: true, source: 'cloud' }
      } else {
        // 云端更新失败，尝试本地更新
        console.warn(`[StorageService] ⚠️ 云端更新失败（返回格式异常），降级到本地更新 - ID: ${id}`, res);
        return this._updateMistakeStatusLocal(id, is_mastered)
      }
    } catch (error) {
      // 网络错误，尝试本地更新
      console.warn(`[StorageService] ⚠️ 云端更新异常（网络错误），降级到本地更新 - ID: ${id}`, error);
      return this._updateMistakeStatusLocal(id, is_mastered)
    }
  }

  /**
   * 本地更新错题状态（内部方法）
   * @private
   */
  _updateMistakeStatusLocal(id, is_mastered) {
    try {
      console.log(`[StorageService] 🔄 开始本地更新错题状态 - ID: ${id}, is_mastered: ${is_mastered}`);
      const localMistakes = this.get('mistake_book', [])
      const mistake = localMistakes.find(m => m.id === id || m._id === id)
      
      if (mistake) {
        const oldStatus = mistake.is_mastered;
        mistake.is_mastered = Boolean(is_mastered)
        mistake.isMastered = Boolean(is_mastered) // 兼容字段
        mistake.last_practice_time = Date.now()
        this.save('mistake_book', localMistakes, true)
        console.log(`[StorageService] ✅ 本地状态更新成功 - ID: ${id}, 状态: ${oldStatus} -> ${is_mastered}, last_practice_time: ${Date.now()}`);
        return { success: true, source: 'local' }
      } else {
        console.warn(`[StorageService] ⚠️ 本地缓存中未找到错题 - ID: ${id}`);
        return { success: false, error: '错题不存在' }
      }
    } catch (error) {
      console.error('[StorageService] ❌ 本地更新错题状态失败:', error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 同步本地待同步的错题到云端（使用 Laf 后端）
   * @returns {Promise<Object>} 返回同步结果 { success: boolean, synced: number, failed: number }
   */
  async syncPendingMistakes() {
    const userId = getUserId()
    if (!userId) {
      console.warn('[StorageService] 用户未登录，无法同步待同步错题')
      return { success: false, error: '用户未登录' }
    }
    
    try {
      const localMistakes = this.get('mistake_book', [])
      const pendingMistakes = localMistakes.filter(m => 
        m.sync_status === 'pending' || m.sync_status === 'local_only'
      )
      
      if (pendingMistakes.length === 0) {
        console.log('[StorageService] ✅ 没有待同步的错题')
        return { success: true, synced: 0, failed: 0 }
      }
      
      console.log(`[StorageService] 🔄 开始同步 ${pendingMistakes.length} 条待同步错题...`)
      
      // 逐个同步待同步的错题
      let synced = 0
      let failed = 0
      
      for (const mistake of pendingMistakes) {
        try {
          const mistakeData = {
            question_content: mistake.question_content || mistake.question,
            options: mistake.options || [],
            user_answer: mistake.user_answer || mistake.userChoice,
            correct_answer: mistake.correct_answer || mistake.answer,
            analysis: mistake.analysis || mistake.desc || '',
            tags: mistake.tags || [],
            is_mastered: mistake.is_mastered || false,
            wrong_count: mistake.wrong_count || mistake.wrongCount || 1
          }
          
          const oldId = mistake.id || mistake._id
          console.log(`[StorageService] 正在同步错题: ${oldId} -> 云端`)
          
          const res = await lafService.request('/mistake-manager', {
            action: 'add',
            data: mistakeData,
            userId: userId
          })
          
          // 检查返回格式：可能是 {code: 0, data: {...}} 或 {ok: true, data: {...}}
          const cloudId = res.data?.id || res.data?._id || res.id || res._id
          const isSuccess = (res.code === 0 || res.ok === true) && cloudId
          
          if (isSuccess) {
            // 同步成功，更新本地状态
            const newId = cloudId
            mistake.id = newId
            mistake._id = newId
            mistake.sync_status = 'synced'
            delete mistake.sync_status // 可选：完全移除该字段
            synced++
            console.log(`[StorageService] ✅ 错题同步成功: ${oldId} -> ${newId}`)
          } else {
            console.warn(`[StorageService] ⚠️ 错题同步失败: ${oldId}, 响应:`, res)
            failed++
          }
        } catch (error) {
          console.error(`[StorageService] ❌ 同步错题异常: ${mistake.id || mistake._id}`, error)
          failed++
        }
      }
      
      // 更新本地存储
      this.save('mistake_book', localMistakes, true)
      
      const result = {
        success: synced > 0,
        synced: synced,
        failed: failed
      }
      
      console.log(`[StorageService] 📊 同步完成: 成功 ${synced} 条, 失败 ${failed} 条`)
      
      return result
    } catch (error) {
      console.error('[StorageService] ❌ 同步待同步错题失败:', error)
      return {
        success: false,
        synced: 0,
        failed: pendingMistakes.length,
        error: error.message
      }
    }
  }
}

// 导出单例
export const storageService = new StorageService()

// 导出类（如果需要创建多个实例）
export { StorageService }

// 默认导出
export default storageService
