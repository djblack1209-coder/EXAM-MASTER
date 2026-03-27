/**
 * 题库与练习 API
 * 职责：题库查询/浏览/随机抽题、收藏管理、FSRS 间隔重复优化
 *
 * @module services/api/domains/practice
 */

import { logger } from '@/utils/logger.js';
import { getUserId } from '../../auth-storage.js';
import { request, normalizeError } from './_request-core.js';

// ==================== 题库 ====================

/**
 * 获取题库数据（带本地降级）
 * @param {string} userId - 用户ID
 * @returns {Promise} 返回题库数据
 */
export async function getQuestionBank(userId) {
  try {
    const response = await request('/question-bank', {
      action: 'get',
      userId
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 获取题库失败:', error);
    return normalizeError(error, '获取题库');
  }
}

/**
 * 从后端随机获取题目
 * @param {Object} [params] - 查询参数
 * @param {number} [params.count=20] - 题目数量
 * @param {string} [params.category] - 分类筛选
 * @param {string} [params.difficulty] - 难度筛选
 * @returns {Promise} 返回随机题目数组
 */
export async function getRandomQuestions(params = {}) {
  try {
    const response = await request('/question-bank', {
      action: 'random',
      data: {
        count: params.count || 20,
        category: params.category,
        difficulty: params.difficulty
      }
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 随机获取题目失败:', error);
    return normalizeError(error, '随机获取题目');
  }
}

/**
 * 获取题库分类统计
 */
export async function getQuestionBankStats() {
  try {
    return await request('/question-bank', {
      action: 'get_stats'
    });
  } catch (error) {
    logger.warn('[LafService] 获取题库统计失败:', error);
    return normalizeError(error, '获取题库统计');
  }
}

/**
 * 浏览题库（分页+筛选）
 */
export async function browseQuestions(params = {}) {
  try {
    return await request('/question-bank', {
      action: 'get',
      data: params
    });
  } catch (error) {
    logger.warn('[LafService] 浏览题库失败:', error);
    return normalizeError(error, '浏览题库');
  }
}

/**
 * 从题库随机抽题开始练习
 */
export async function getQuestionBankRandom(params = {}) {
  try {
    return await request('/question-bank', {
      action: 'random',
      data: params
    });
  } catch (error) {
    logger.warn('[LafService] 随机抽题失败:', error);
    return normalizeError(error, '随机抽题');
  }
}

// ==================== 收藏管理 ====================

/**
 * 添加收藏
 * @param {Object} data - 收藏数据
 * @returns {Promise} 返回操作结果
 */
export async function addFavorite(data) {
  try {
    const userId = getUserId();

    if (!userId) {
      return { code: -1, success: false, message: '请先登录' };
    }

    const response = await request('/favorite-manager', {
      action: 'add',
      userId,
      data
    });
    return response;
  } catch (error) {
    logger.error('[LafService] 添加收藏失败:', error);
    return { code: -1, success: false, message: '添加失败' };
  }
}

/**
 * 获取收藏列表
 * @param {Object} params - 查询参数
 * @returns {Promise} 返回收藏列表
 */
export async function getFavorites(params = {}) {
  try {
    const userId = getUserId();

    if (!userId) {
      return { code: -1, success: false, message: '请先登录', data: [] };
    }

    const response = await request('/favorite-manager', {
      action: 'get',
      userId,
      data: params
    });
    return response;
  } catch (error) {
    logger.error('[LafService] 获取收藏失败:', error);
    return { code: -1, success: false, message: '获取失败', data: [] };
  }
}

/**
 * 删除收藏
 * @param {string} id - 收藏ID或题目ID
 * @returns {Promise} 返回操作结果
 */
export async function removeFavorite(id) {
  try {
    const userId = getUserId();

    if (!userId) {
      return { code: -1, success: false, message: '请先登录' };
    }

    const response = await request('/favorite-manager', {
      action: 'remove',
      userId,
      data: { id }
    });
    return response;
  } catch (error) {
    logger.error('[LafService] 删除收藏失败:', error);
    return { code: -1, success: false, message: '删除失败' };
  }
}

/**
 * 检查是否已收藏
 * @param {string|Array} questionId - 题目ID或ID数组
 * @returns {Promise} 返回检查结果
 */
export async function checkFavorite(questionId) {
  try {
    const userId = getUserId();

    if (!userId) {
      return { code: 0, success: true, data: { isFavorite: false } };
    }

    const data = Array.isArray(questionId) ? { questionIds: questionId } : { questionId };

    const response = await request('/favorite-manager', {
      action: 'check',
      userId,
      data
    });
    return response;
  } catch (error) {
    logger.error('[LafService] 检查收藏失败:', error);
    return {
      code: -1,
      success: false,
      data: { isFavorite: false },
      message: '检查收藏状态失败',
      _errorSource: 'network'
    };
  }
}

// ==================== FSRS 间隔重复优化 ====================

/**
 * 触发 FSRS 参数优化（需要至少 50 条复习记录）
 */
export async function optimizeFSRS() {
  try {
    return await request('/fsrs-optimizer', {
      action: 'optimize'
    });
  } catch (error) {
    logger.warn('[LafService] FSRS优化失败:', error);
    return normalizeError(error, 'FSRS优化');
  }
}

/**
 * 获取 FSRS 优化状态
 */
export async function getFSRSStatus() {
  try {
    return await request('/fsrs-optimizer', {
      action: 'getStatus'
    });
  } catch (error) {
    logger.warn('[LafService] 获取FSRS状态失败:', error);
    return normalizeError(error, '获取FSRS状态');
  }
}

/**
 * 获取用户记忆留存率曲线数据
 */
export async function getFSRSRetentionCurve() {
  try {
    return await request('/fsrs-optimizer', {
      action: 'getRetentionCurve'
    });
  } catch (error) {
    logger.warn('[LafService] 获取留存率曲线失败:', error);
    return normalizeError(error, '获取留存率曲线');
  }
}
