/**
 * 离线缓存服务
 *
 * 提供离线状态检测、题目缓存、答题队列等功能。
 * 当网络不可用时自动降级到本地缓存的题目数据，
 * 并将答题记录暂存在同步队列中，待网络恢复后上传。
 *
 * @module services/offline-cache-service
 */

import { logger } from '@/utils/logger.js';

// ==================== 存储键 ====================
const STORAGE_KEYS = {
  /** 离线题目缓存（按分类） */
  CACHED_QUESTIONS: 'EXAM_OFFLINE_QUESTIONS',
  /** 待同步的操作队列 */
  SYNC_QUEUE: 'EXAM_OFFLINE_SYNC_QUEUE',
  /** 本地题库（v30_bank，与 offline-cache.js 一致） */
  QUESTION_BANK: 'v30_bank'
};

// ==================== 网络状态检测 ====================

/**
 * 判断当前是否有网络连接
 * 优先使用 uni.getNetworkType，H5 降级到 navigator.onLine
 */
function getOnlineStatus() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    // 微信小程序环境：同步方式无法获取，默认在线
    return true;
  } catch {
    return true;
  }
}

// ==================== 离线缓存对象 ====================

/**
 * 离线缓存单例
 *
 * 属性：
 * - isOnline: 当前网络状态（getter）
 *
 * 方法：
 * - getCachedQuestions(category, limit): 获取缓存的题目
 * - cacheQuestions(questions, category): 缓存题目
 * - addToSyncQueue(action, data): 将操作加入同步队列
 * - getSyncQueue(): 获取待同步队列
 * - clearSyncQueue(): 清空同步队列
 */
export const offlineCache = {
  /**
   * 当前是否在线（getter 语义，每次访问实时检测）
   */
  get isOnline() {
    return getOnlineStatus();
  },

  /**
   * 从本地缓存获取题目
   * @param {string} category - 题目分类，'all' 表示全部
   * @param {number} limit - 最多返回题目数
   * @returns {Array} 缓存的题目数组，无缓存时返回空数组
   */
  getCachedQuestions(category = 'all', limit = 20) {
    try {
      const cached = uni.getStorageSync(STORAGE_KEYS.CACHED_QUESTIONS) || {};
      const questions = category === 'all' ? Object.values(cached).flat() : cached[category] || [];
      return questions.slice(0, limit);
    } catch (err) {
      logger.warn('[OfflineCacheService] getCachedQuestions 失败:', err);
      return [];
    }
  },

  /**
   * 将题目缓存到本地存储
   * @param {Array} questions - 要缓存的题目数组
   * @param {string} category - 题目分类
   */
  cacheQuestions(questions, category = 'all') {
    try {
      if (!Array.isArray(questions) || questions.length === 0) return;
      const cached = uni.getStorageSync(STORAGE_KEYS.CACHED_QUESTIONS) || {};
      cached[category] = questions;
      uni.setStorageSync(STORAGE_KEYS.CACHED_QUESTIONS, cached);
      logger.log(`[OfflineCacheService] 缓存 ${questions.length} 道题目 (${category})`);
    } catch (err) {
      logger.warn('[OfflineCacheService] cacheQuestions 失败:', err);
    }
  },

  /**
   * 将操作加入离线同步队列，待网络恢复后批量上传
   * @param {string} action - 操作类型（如 'answer_submit'）
   * @param {Object} data - 操作数据
   */
  addToSyncQueue(action, data) {
    try {
      const queue = uni.getStorageSync(STORAGE_KEYS.SYNC_QUEUE) || [];
      queue.push({ action, data, timestamp: Date.now() });
      uni.setStorageSync(STORAGE_KEYS.SYNC_QUEUE, queue);
      logger.log(`[OfflineCacheService] 加入同步队列: ${action}`);
    } catch (err) {
      logger.warn('[OfflineCacheService] addToSyncQueue 失败:', err);
    }
  },

  /**
   * 获取待同步队列
   * @returns {Array} 待同步的操作列表
   */
  getSyncQueue() {
    try {
      return uni.getStorageSync(STORAGE_KEYS.SYNC_QUEUE) || [];
    } catch {
      return [];
    }
  },

  /**
   * 清空同步队列（同步完成后调用）
   */
  clearSyncQueue() {
    try {
      uni.removeStorageSync(STORAGE_KEYS.SYNC_QUEUE);
    } catch {
      /* 静默 */
    }
  }
};

// ==================== 离线可用性检测 ====================

/**
 * 检查离线数据是否可用
 *
 * 返回结构化状态对象，供 useQuizState / do-quiz 使用：
 * - available: 本地是否有可用的缓存题目
 * - isOnline: 当前网络是否连通
 *
 * @returns {{ available: boolean, isOnline: boolean }}
 */
export function checkOfflineAvailability() {
  const isOnline = getOnlineStatus();
  let available = false;

  try {
    // 检查本地题库
    const bank = uni.getStorageSync(STORAGE_KEYS.QUESTION_BANK);
    if (Array.isArray(bank) && bank.length > 0) {
      available = true;
    }

    // 也检查离线缓存的题目
    if (!available) {
      const cached = uni.getStorageSync(STORAGE_KEYS.CACHED_QUESTIONS);
      if (cached && typeof cached === 'object' && Object.keys(cached).length > 0) {
        available = true;
      }
    }
  } catch {
    available = false;
  }

  return { available, isOnline };
}
