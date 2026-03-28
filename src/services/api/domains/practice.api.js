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

// ==================== Anki 导入导出 ====================

/**
 * 导出 Anki 牌组
 * @param {string} [deckName='我的考研题库'] - 牌组名称
 */
export async function exportAnki(deckName = '我的考研题库') {
  try {
    return await request('/anki-export', { deckName });
  } catch (error) {
    logger.warn('[Practice] Anki导出失败:', error);
    return normalizeError(error, 'Anki导出');
  }
}

/**
 * 导入 Anki 牌组文件
 * @param {string} fileData - 文件 base64 数据
 * @param {string} fileName - 文件名
 */
export async function importAnki(fileData, fileName) {
  try {
    return await request('/anki-import', { fileData, fileName }, { timeout: 60000, maxRetries: 1 });
  } catch (error) {
    logger.warn('[Practice] Anki导入失败:', error);
    return normalizeError(error, 'Anki导入');
  }
}

// ==================== 答题提交 ====================

/**
 * 提交答题记录（触发后端自动错题收集+会话累积）
 * @param {Object} params - { idempotencyKey, questionId, userAnswer, sessionId, duration, practiceMode }
 */
export async function submitAnswer({
  idempotencyKey,
  questionId,
  userAnswer,
  sessionId,
  duration,
  practiceMode = 'normal'
}) {
  try {
    return await request('/answer-submit', {
      action: 'submit',
      idempotencyKey,
      data: {
        question_id: questionId,
        user_answer: userAnswer,
        session_id: sessionId,
        duration,
        practice_mode: practiceMode
      }
    });
  } catch (error) {
    logger.warn('[Practice] 答题提交失败:', error);
    return normalizeError(error, '答题提交');
  }
}

// ==================== 错题管理 ====================

/**
 * 通用错题管理请求
 * @param {Object} params - { action, userId, data, ... }
 */
export async function mistakeManager(params) {
  try {
    return await request('/mistake-manager', params);
  } catch (error) {
    logger.warn('[Practice] 错题管理失败:', error);
    return normalizeError(error, '错题管理');
  }
}

/**
 * 新增错题到云端
 * @param {string} userId - 用户 ID
 * @param {Object} mistakeData - 错题数据
 */
export async function addMistake(userId, mistakeData) {
  return mistakeManager({ action: 'add', data: mistakeData, userId });
}

/**
 * 获取错题列表（分页）
 * @param {string} userId - 用户 ID
 * @param {Object} params - { page, limit, is_mastered, id }
 */
export async function getMistakes(userId, params = {}) {
  return mistakeManager({ action: 'get', userId, ...params });
}

/**
 * 删除单条错题
 */
export async function removeMistake(userId, id) {
  return mistakeManager({ action: 'remove', data: { id }, userId });
}

/**
 * 批量删除错题
 */
export async function batchRemoveMistakes(userId, ids) {
  return mistakeManager({ action: 'batchRemove', data: { ids }, userId });
}

/**
 * 更新错题掌握状态
 */
export async function updateMistakeStatus(userId, id, isMastered) {
  return mistakeManager({ action: 'updateStatus', data: { id, is_mastered: isMastered }, userId });
}

/**
 * 更新错题字段
 */
export async function updateMistakeFields(userId, id, fields) {
  return mistakeManager({ action: 'updateFields', userId, data: { id, fields } });
}

/**
 * 批量同步错题到云端
 */
export async function batchSyncMistakes(userId, mistakes) {
  return mistakeManager({ action: 'batchSync', userId, data: { mistakes } });
}
