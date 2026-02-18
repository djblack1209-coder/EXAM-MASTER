/**
 * 离线缓存模块 - 支持无网络环境下刷题
 *
 * 核心功能：
 * 1. 题目离线缓存
 * 2. 答题记录离线存储
 * 3. 网络恢复后自动同步
 * 4. 缓存空间管理
 */

import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
// ✅ 5.2: 导入 lafService 用于离线数据同步
import { lafService } from '@/services/lafService.js';
const STORAGE_KEYS = {
  OFFLINE_QUESTIONS: 'offline_questions',
  OFFLINE_ANSWERS: 'offline_answers',
  OFFLINE_MISTAKES: 'offline_mistakes',
  SYNC_QUEUE: 'offline_sync_queue',
  CACHE_META: 'offline_cache_meta',
  SETTINGS: 'offline_settings'
};

// 默认设置
const DEFAULT_SETTINGS = {
  enabled: true,
  maxCacheSize: 50 * 1024 * 1024, // 50MB
  maxQuestions: 500,
  autoSync: true,
  syncOnWifi: true,
  cacheExpireDays: 30
};

/**
 * 离线缓存管理器
 */
class OfflineCacheManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.cacheMeta = {
      lastSync: null,
      totalSize: 0,
      questionCount: 0,
      version: 1
    };
    this.syncQueue = [];
    this.isOnline = true;
    this.isInitialized = false;
    this.syncInProgress = false;
  }

  /**
   * 初始化
   */
  init() {
    if (this.isInitialized) return;

    this._loadSettings();
    this._loadCacheMeta();
    this._loadSyncQueue();
    this._checkNetworkStatus();
    this._setupNetworkListener();

    this.isInitialized = true;
    logger.log('[OfflineCache] 初始化完成');
  }

  /**
   * 缓存题目
   * @param {Array} questions - 题目列表
   * @param {Object} options - 缓存选项
   * @returns {Object} 缓存结果
   */
  cacheQuestions(questions, options = {}) {
    this.init();

    if (!this.settings.enabled) {
      return { success: false, error: '离线缓存已禁用' };
    }

    const {
      category = 'default',
      replace = false,
      priority = 'normal'
    } = options;

    try {
      // 获取现有缓存
      let cached = this._getStorageSync(STORAGE_KEYS.OFFLINE_QUESTIONS) || {};

      if (replace) {
        cached[category] = [];
      }

      if (!cached[category]) {
        cached[category] = [];
      }

      // 去重并添加
      const existingIds = new Set(cached[category].map((q) => q.id || q.question));
      let addedCount = 0;

      for (const question of questions) {
        const qId = question.id || question.question;
        if (!existingIds.has(qId)) {
          // 添加缓存元数据
          const cachedQuestion = {
            ...question,
            _cachedAt: Date.now(),
            _category: category,
            _priority: priority
          };
          cached[category].push(cachedQuestion);
          existingIds.add(qId);
          addedCount++;
        }
      }

      // 检查缓存限制
      const totalCount = Object.values(cached).reduce((sum, arr) => sum + arr.length, 0);
      if (totalCount > this.settings.maxQuestions) {
        // 移除最旧的低优先级题目
        cached = this._trimCache(cached, this.settings.maxQuestions);
      }

      // 保存缓存
      this._setStorageSync(STORAGE_KEYS.OFFLINE_QUESTIONS, cached);

      // 更新元数据
      this._updateCacheMeta();

      return {
        success: true,
        addedCount,
        totalCount: Object.values(cached).reduce((sum, arr) => sum + arr.length, 0)
      };
    } catch (e) {
      console.error('[OfflineCache] 缓存题目失败:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * 获取离线题目
   * @param {Object} options - 获取选项
   * @returns {Array} 题目列表
   */
  getOfflineQuestions(options = {}) {
    this.init();

    const {
      category = null,
      count = null,
      random = false
    } = options;

    try {
      const cached = this._getStorageSync(STORAGE_KEYS.OFFLINE_QUESTIONS) || {};

      let questions = [];

      if (category) {
        questions = cached[category] || [];
      } else {
        // 合并所有分类
        questions = Object.values(cached).flat();
      }

      // 随机打乱
      if (random) {
        questions = this._shuffleArray([...questions]);
      }

      // 限制数量
      if (count && count > 0) {
        questions = questions.slice(0, count);
      }

      return questions;
    } catch (e) {
      console.error('[OfflineCache] 获取离线题目失败:', e);
      return [];
    }
  }

  /**
   * 保存离线答题记录
   * @param {Object} answerData - 答题数据
   * @returns {Object} 保存结果
   */
  saveOfflineAnswer(answerData) {
    this.init();

    try {
      const answers = this._getStorageSync(STORAGE_KEYS.OFFLINE_ANSWERS) || [];

      const record = {
        id: this._generateId(),
        questionId: answerData.questionId,
        userAnswer: answerData.userAnswer,
        isCorrect: answerData.isCorrect,
        timeSpent: answerData.timeSpent,
        category: answerData.category,
        timestamp: Date.now(),
        synced: false
      };

      answers.push(record);

      // 只保留最近1000条
      const trimmedAnswers = answers.slice(-1000);
      this._setStorageSync(STORAGE_KEYS.OFFLINE_ANSWERS, trimmedAnswers);

      // 如果是错题，添加到离线错题本
      if (!answerData.isCorrect) {
        this._saveOfflineMistake(answerData);
      }

      // 添加到同步队列
      this._addToSyncQueue({
        type: 'answer',
        data: record
      });

      return { success: true, id: record.id };
    } catch (e) {
      console.error('[OfflineCache] 保存离线答题记录失败:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * 检查是否有离线数据可用
   * @returns {Object} 离线数据状态
   */
  checkOfflineAvailability() {
    this.init();

    try {
      const cached = this._getStorageSync(STORAGE_KEYS.OFFLINE_QUESTIONS) || {};
      const totalQuestions = Object.values(cached).reduce((sum, arr) => sum + arr.length, 0);

      const categories = Object.keys(cached).map((cat) => ({
        name: cat,
        count: cached[cat].length
      }));

      return {
        available: totalQuestions > 0,
        totalQuestions,
        categories,
        lastSync: this.cacheMeta.lastSync,
        cacheSize: this.cacheMeta.totalSize,
        isOnline: this.isOnline
      };
    } catch (e) {
      return {
        available: false,
        totalQuestions: 0,
        categories: [],
        error: e.message
      };
    }
  }

  /**
   * 同步离线数据
   * @returns {Object} 同步结果
   */
  async syncOfflineData() {
    this.init();

    if (!this.isOnline) {
      return { success: false, error: '当前处于离线状态' };
    }

    if (this.syncInProgress) {
      return { success: false, error: '同步正在进行中' };
    }

    this.syncInProgress = true;

    try {
      const queue = this._getStorageSync(STORAGE_KEYS.SYNC_QUEUE) || [];

      if (queue.length === 0) {
        this.syncInProgress = false;
        return { success: true, syncedCount: 0 };
      }

      let syncedCount = 0;
      const failedItems = [];

      for (const item of queue) {
        try {
          await this._syncItem(item);
          syncedCount++;
        } catch (e) {
          console.warn('[OfflineCache] 同步项目失败:', item.id, e);
          failedItems.push(item);
        }
      }

      // 更新同步队列（只保留失败的项目）
      this._setStorageSync(STORAGE_KEYS.SYNC_QUEUE, failedItems);
      this.syncQueue = failedItems;

      // 更新同步时间
      this.cacheMeta.lastSync = Date.now();
      this._saveCacheMeta();

      this.syncInProgress = false;

      return {
        success: true,
        syncedCount,
        failedCount: failedItems.length
      };
    } catch (e) {
      this.syncInProgress = false;
      console.error('[OfflineCache] 同步失败:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * 清除缓存
   * @param {Object} options - 清除选项
   * @returns {Object} 清除结果
   */
  clearCache(options = {}) {
    this.init();

    const {
      category = null,
      clearAnswers = false,
      clearMistakes = false,
      clearAll = false
    } = options;

    try {
      if (clearAll) {
        this._removeStorageSync(STORAGE_KEYS.OFFLINE_QUESTIONS);
        this._removeStorageSync(STORAGE_KEYS.OFFLINE_ANSWERS);
        this._removeStorageSync(STORAGE_KEYS.OFFLINE_MISTAKES);
        this._removeStorageSync(STORAGE_KEYS.SYNC_QUEUE);
        this.syncQueue = [];
      } else {
        if (category) {
          const cached = this._getStorageSync(STORAGE_KEYS.OFFLINE_QUESTIONS) || {};
          delete cached[category];
          this._setStorageSync(STORAGE_KEYS.OFFLINE_QUESTIONS, cached);
        }

        if (clearAnswers) {
          this._removeStorageSync(STORAGE_KEYS.OFFLINE_ANSWERS);
        }

        if (clearMistakes) {
          this._removeStorageSync(STORAGE_KEYS.OFFLINE_MISTAKES);
        }
      }

      this._updateCacheMeta();

      return { success: true };
    } catch (e) {
      console.error('[OfflineCache] 清除缓存失败:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * 获取缓存统计
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    this.init();

    try {
      const questions = this._getStorageSync(STORAGE_KEYS.OFFLINE_QUESTIONS) || {};
      const answers = this._getStorageSync(STORAGE_KEYS.OFFLINE_ANSWERS) || [];
      const mistakes = this._getStorageSync(STORAGE_KEYS.OFFLINE_MISTAKES) || [];
      const queue = this._getStorageSync(STORAGE_KEYS.SYNC_QUEUE) || [];

      const questionCount = Object.values(questions).reduce((sum, arr) => sum + arr.length, 0);

      // 估算缓存大小
      const estimatedSize = this._estimateSize(questions) +
                           this._estimateSize(answers) +
                           this._estimateSize(mistakes);

      return {
        questionCount,
        answerCount: answers.length,
        mistakeCount: mistakes.length,
        pendingSyncCount: queue.length,
        estimatedSize,
        estimatedSizeMB: (estimatedSize / (1024 * 1024)).toFixed(2),
        maxSize: this.settings.maxCacheSize,
        usagePercent: Math.round((estimatedSize / this.settings.maxCacheSize) * 100),
        lastSync: this.cacheMeta.lastSync,
        isOnline: this.isOnline,
        categories: Object.keys(questions).map((cat) => ({
          name: cat,
          count: questions[cat].length
        }))
      };
    } catch (e) {
      console.error('[OfflineCache] 获取缓存统计失败:', e);
      return { error: e.message };
    }
  }

  /**
   * 预加载题目
   * @param {Object} options - 预加载选项
   * @returns {Object} 预加载结果
   */
  async preloadQuestions(options = {}) {
    this.init();

    if (!this.isOnline) {
      return { success: false, error: '需要网络连接进行预加载' };
    }

    const {
      count = 100,
      categories = [],
      includeReview = true
    } = options;

    try {
      // 从本地题库获取题目
      const bank = this._getStorageSync('v30_bank') || [];

      if (bank.length === 0) {
        return { success: false, error: '题库为空' };
      }

      // 筛选题目
      let questionsToCache = [...bank];

      if (categories.length > 0) {
        questionsToCache = questionsToCache.filter((q) =>
          categories.includes(q.category)
        );
      }

      // 随机选择
      questionsToCache = this._shuffleArray(questionsToCache).slice(0, count);

      // 缓存题目
      const result = this.cacheQuestions(questionsToCache, {
        category: 'preloaded',
        replace: true
      });

      // 如果需要，也缓存错题
      if (includeReview) {
        const mistakes = this._getStorageSync('mistake_book') || [];
        if (mistakes.length > 0) {
          this.cacheQuestions(mistakes.slice(0, 50), {
            category: 'review',
            priority: 'high'
          });
        }
      }

      return {
        success: true,
        cachedCount: result.addedCount,
        totalCached: result.totalCount
      };
    } catch (e) {
      console.error('[OfflineCache] 预加载失败:', e);
      return { success: false, error: e.message };
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 保存离线错题
   */
  _saveOfflineMistake(answerData) {
    try {
      const mistakes = this._getStorageSync(STORAGE_KEYS.OFFLINE_MISTAKES) || [];

      mistakes.push({
        id: this._generateId(),
        questionId: answerData.questionId,
        questionContent: answerData.questionContent,
        userAnswer: answerData.userAnswer,
        correctAnswer: answerData.correctAnswer,
        category: answerData.category,
        timestamp: Date.now(),
        synced: false
      });

      // 只保留最近200条
      this._setStorageSync(STORAGE_KEYS.OFFLINE_MISTAKES, mistakes.slice(-200));
    } catch (_e) {
      console.warn('[OfflineCache] 保存离线错题失败:', _e);
    }
  }

  /**
   * 添加到同步队列
   */
  _addToSyncQueue(item) {
    item.id = this._generateId();
    item.createdAt = Date.now();

    this.syncQueue.push(item);
    this._setStorageSync(STORAGE_KEYS.SYNC_QUEUE, this.syncQueue);

    // 如果在线且启用自动同步，尝试同步
    if (this.isOnline && this.settings.autoSync) {
      this.syncOfflineData();
    }
  }

  /**
   * 同步单个项目
   * ✅ 5.2: 实现实际的同步逻辑，替代原有空桩
   */
  async _syncItem(item) {
    switch (item.type) {
      case 'answer':
        // 同步答题记录到云端
        await lafService.request('/answer-submit', {
          action: 'syncOffline',
          userId: item.data.userId,
          answers: Array.isArray(item.data.answers) ? item.data.answers : [item.data]
        });
        logger.log('[OfflineCache] 答题记录同步成功:', item.data?.questionId || 'batch');
        break;
      case 'mistake':
        // 同步错题到云端（复用 storageService 的云同步能力）
        await storageService.syncPendingMistakes();
        logger.log('[OfflineCache] 错题同步成功');
        break;
      default:
        logger.warn('[OfflineCache] 未知的同步类型:', item.type);
    }
  }

  /**
   * 裁剪缓存
   */
  _trimCache(cached, maxCount) {
    // 按优先级和时间排序，移除低优先级的旧题目
    const allQuestions = [];

    for (const [category, questions] of Object.entries(cached)) {
      for (const q of questions) {
        allQuestions.push({ ...q, _sourceCategory: category });
      }
    }

    // 排序：高优先级在前，新题目在前
    allQuestions.sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      const aPriority = priorityOrder[a._priority] || 1;
      const bPriority = priorityOrder[b._priority] || 1;

      if (aPriority !== bPriority) return aPriority - bPriority;
      return (b._cachedAt || 0) - (a._cachedAt || 0);
    });

    // 保留前maxCount个
    const kept = allQuestions.slice(0, maxCount);

    // 重建缓存结构
    const newCached = {};
    for (const q of kept) {
      const cat = q._sourceCategory;
      if (!newCached[cat]) newCached[cat] = [];
      delete q._sourceCategory;
      newCached[cat].push(q);
    }

    return newCached;
  }

  /**
   * 检查网络状态
   */
  _checkNetworkStatus() {
    try {
      if (typeof uni !== 'undefined') {
        uni.getNetworkType({
          success: (res) => {
            this.isOnline = res.networkType !== 'none';
          }
        });
      }
    } catch (_e) {
      this.isOnline = true;
    }
  }

  /**
   * 设置网络监听
   */
  _setupNetworkListener() {
    try {
      if (typeof uni !== 'undefined') {
        uni.onNetworkStatusChange((res) => {
          const wasOffline = !this.isOnline;
          this.isOnline = res.isConnected;

          // 从离线恢复到在线，尝试同步
          if (wasOffline && this.isOnline && this.settings.autoSync) {
            logger.log('[OfflineCache] 网络恢复，开始同步');
            this.syncOfflineData();
          }
        });
      }
    } catch (_e) {
      console.warn('[OfflineCache] 设置网络监听失败:', _e);
    }
  }

  /**
   * 更新缓存元数据
   */
  _updateCacheMeta() {
    try {
      const questions = this._getStorageSync(STORAGE_KEYS.OFFLINE_QUESTIONS) || {};
      const questionCount = Object.values(questions).reduce((sum, arr) => sum + arr.length, 0);

      this.cacheMeta.questionCount = questionCount;
      this.cacheMeta.totalSize = this._estimateSize(questions);

      this._saveCacheMeta();
    } catch (_e) {
      console.warn('[OfflineCache] 更新缓存元数据失败:', _e);
    }
  }

  /**
   * 估算数据大小
   */
  _estimateSize(data) {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch (_e) {
      // 降级方案
      return JSON.stringify(data).length * 2;
    }
  }

  /**
   * 打乱数组
   */
  _shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * 生成唯一ID
   */
  _generateId() {
    return 'offline_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  // ==================== 存储操作封装 ====================

  _getStorageSync(key) {
    try {
      if (typeof uni !== 'undefined') {
        return storageService.get(key);
      }
      return null;
    } catch (_e) {
      return null;
    }
  }

  _setStorageSync(key, data) {
    try {
      if (typeof uni !== 'undefined') {
        storageService.save(key, data);
      }
    } catch (e) {
      console.warn('[OfflineCache] 存储失败:', key, e);
    }
  }

  _removeStorageSync(key) {
    try {
      if (typeof uni !== 'undefined') {
        storageService.remove(key);
      }
    } catch (e) {
      console.warn('[OfflineCache] 删除存储失败:', key, e);
    }
  }

  _loadSettings() {
    const saved = this._getStorageSync(STORAGE_KEYS.SETTINGS);
    if (saved) {
      this.settings = { ...DEFAULT_SETTINGS, ...saved };
    }
  }

  _loadCacheMeta() {
    const saved = this._getStorageSync(STORAGE_KEYS.CACHE_META);
    if (saved) {
      this.cacheMeta = { ...this.cacheMeta, ...saved };
    }
  }

  _saveCacheMeta() {
    this._setStorageSync(STORAGE_KEYS.CACHE_META, this.cacheMeta);
  }

  _loadSyncQueue() {
    this.syncQueue = this._getStorageSync(STORAGE_KEYS.SYNC_QUEUE) || [];
  }
}

// 创建单例
export const offlineCacheManager = new OfflineCacheManager();

// 便捷函数
export function cacheQuestionsOffline(questions, options) {
  return offlineCacheManager.cacheQuestions(questions, options);
}

export function getOfflineQuestions(options) {
  return offlineCacheManager.getOfflineQuestions(options);
}

export function saveOfflineAnswer(answerData) {
  return offlineCacheManager.saveOfflineAnswer(answerData);
}

export function checkOfflineAvailability() {
  return offlineCacheManager.checkOfflineAvailability();
}

export function syncOfflineData() {
  return offlineCacheManager.syncOfflineData();
}

export function getCacheStats() {
  return offlineCacheManager.getCacheStats();
}

export function preloadQuestions(options) {
  return offlineCacheManager.preloadQuestions(options);
}

export function clearOfflineCache(options) {
  return offlineCacheManager.clearCache(options);
}

export default offlineCacheManager;
