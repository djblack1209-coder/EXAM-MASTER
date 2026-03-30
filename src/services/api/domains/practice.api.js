/**
 * 题库与练习 API
 * 职责：题库浏览/随机抽题、FSRS 间隔重复优化、Anki 导入导出、
 *       RAG 知识库索引、错题管理
 *
 * @module services/api/domains/practice
 */

import { logger } from '@/utils/logger.js';
import { request, normalizeError } from './_request-core.js';

// [AUDIT R275] 已删除 5 个无调用方的死代码函数:
// getQuestionBank, submitAnswer, addFavorite, getFavorites, removeFavorite

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

/**
 * 获取用户个性化 FSRS 参数（含优化状态信息）
 */
export async function getFSRSParams() {
  try {
    return await request('/fsrs-optimizer', {
      action: 'get_params'
    });
  } catch (error) {
    logger.warn('[Practice] 获取FSRS参数失败:', error);
    return normalizeError(error, '获取FSRS参数');
  }
}

/**
 * 获取用户复习统计数据（用于学习分析和遗忘曲线）
 */
export async function getFSRSReviewStats() {
  try {
    return await request('/fsrs-optimizer', {
      action: 'get_review_stats'
    });
  } catch (error) {
    logger.warn('[Practice] 获取复习统计失败:', error);
    return normalizeError(error, '获取复习统计');
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
 * 导入 Anki .apkg 牌组
 * @param {string} fileData - base64 编码的文件数据
 * @param {string} fileName - 原始文件名
 * @param {Object} [options] - 可选配置
 * @param {number} [options.timeout] - 超时时间
 * @param {number} [options.maxRetries=1] - 最大重试次数
 */
export async function ankiImport(fileData, fileName, options = {}) {
  try {
    return await request(
      '/anki-import',
      { fileData, fileName },
      {
        timeout: options.timeout,
        maxRetries: options.maxRetries ?? 1
      }
    );
  } catch (error) {
    logger.warn('[Practice] Anki导入失败:', error);
    return normalizeError(error, 'Anki导入');
  }
}

/**
 * 触发 RAG 知识库索引（非阻塞，用于导入后自动建立向量索引）
 * @param {string} action - 动作名称（如 'index_questions'）
 * @param {Object} data - 索引参数
 */
export async function ragIngest(action, data) {
  try {
    return await request('/rag-ingest', { action, data });
  } catch (error) {
    logger.warn('[Practice] RAG索引失败:', error);
    return normalizeError(error, 'RAG索引');
  }
}

// ==================== 错题管理 ====================

/**
 * 通用错题管理请求
 * @param {Object} params - { action, userId, data, ... }
 */
async function mistakeManager(params) {
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
