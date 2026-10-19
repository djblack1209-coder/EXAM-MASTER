import { retiredBankResponse } from '@/services/retired-question-bank.js';
import { captureSession } from '../../auth-storage.js';
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
// submitAnswer, addFavorite, getFavorites, removeFavorite
// [AUDIT R432] 补删 getQuestionBank（R275 遗漏）

// Compatibility exports return a retirement result without making network requests.
export { retiredBankResponse } from '@/services/retired-question-bank.js';
export async function getRandomQuestions() {
  return retiredBankResponse();
}
export async function getQuestionBankStats() {
  return retiredBankResponse();
}
export async function browseQuestions() {
  return retiredBankResponse();
}
export async function getQuestionBankRandom() {
  return retiredBankResponse();
}

// ==================== FSRS 间隔重复优化 ====================

/**
 * 触发 FSRS 参数优化（需要至少 50 条复习记录）
 */
export async function optimizeFSRS() {
  const session = captureSession();
  try {
    return await request(
      '/fsrs-optimizer',
      {
        action: 'optimize'
      },
      { session }
    );
  } catch (error) {
    logger.warn('[LafService] FSRS优化失败:', error);
    return normalizeError(error, 'FSRS优化');
  }
}

/**
 * 获取 FSRS 优化状态
 */
export async function getFSRSStatus() {
  const session = captureSession();
  try {
    return await request(
      '/fsrs-optimizer',
      {
        action: 'getStatus'
      },
      { session }
    );
  } catch (error) {
    logger.warn('[LafService] 获取FSRS状态失败:', error);
    return normalizeError(error, '获取FSRS状态');
  }
}

/**
 * 获取用户记忆留存率曲线数据
 */
export async function getFSRSRetentionCurve() {
  const session = captureSession();
  try {
    return await request(
      '/fsrs-optimizer',
      {
        action: 'getRetentionCurve'
      },
      { session }
    );
  } catch (error) {
    logger.warn('[LafService] 获取留存率曲线失败:', error);
    return normalizeError(error, '获取留存率曲线');
  }
}

/**
 * 获取用户个性化 FSRS 参数（含优化状态信息）
 */
export async function getFSRSParams() {
  const session = captureSession();
  try {
    return await request(
      '/fsrs-optimizer',
      {
        action: 'get_params'
      },
      { session }
    );
  } catch (error) {
    logger.warn('[Practice] 获取FSRS参数失败:', error);
    return normalizeError(error, '获取FSRS参数');
  }
}

/**
 * 获取用户复习统计数据（用于学习分析和遗忘曲线）
 */
export async function getFSRSReviewStats() {
  const session = captureSession();
  try {
    return await request(
      '/fsrs-optimizer',
      {
        action: 'get_review_stats'
      },
      { session }
    );
  } catch (error) {
    logger.warn('[Practice] 获取复习统计失败:', error);
    return normalizeError(error, '获取复习统计');
  }
}

// ==================== 错题管理 ====================

/**
 * 通用错题管理请求
 * @param {Object} params - { action, userId, data, ... }
 */
async function mistakeManager(params, options = { session: captureSession() }) {
  const session = options.session;
  try {
    return await request('/mistake-manager', params, { session, skipCache: true });
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
export async function addMistake(userId, mistakeData, options = { session: captureSession() }) {
  const session = options.session;
  return mistakeManager({ action: 'add', data: mistakeData, userId }, { session });
}

/**
 * 获取错题列表（分页）
 * @param {string} userId - 用户 ID
 * @param {Object} params - { page, limit, is_mastered, id }
 */
export async function getMistakes(userId, params = {}, options = { session: captureSession() }) {
  const session = options.session;
  return mistakeManager({ action: 'get', userId, data: params }, { session });
}

/**
 * 删除单条错题
 */
export async function removeMistake(userId, id, options = { session: captureSession() }) {
  const session = options.session;
  return mistakeManager({ action: 'remove', data: { id }, userId }, { session });
}

/**
 * 批量删除错题
 */
export async function batchRemoveMistakes(userId, ids, options = { session: captureSession() }) {
  const session = options.session;
  return mistakeManager({ action: 'batchRemove', data: { ids }, userId }, { session });
}

/**
 * 更新错题掌握状态
 */
export async function updateMistakeStatus(userId, id, isMastered, options = { session: captureSession() }) {
  const session = options.session;
  return mistakeManager({ action: 'updateStatus', data: { id, is_mastered: isMastered }, userId }, { session });
}

/**
 * 更新错题字段
 */
export async function updateMistakeFields(userId, id, fields, options = { session: captureSession() }) {
  const session = options.session;
  return mistakeManager({ action: 'updateFields', userId, data: { id, fields } }, { session });
}

/**
 * 批量同步错题到云端
 */
export async function batchSyncMistakes(userId, mistakes, options = { session: captureSession() }) {
  const session = options.session;
  return mistakeManager({ action: 'batchSync', userId, data: { mistakes } }, { session });
}

// ==================== 答题提交 ====================

/**
 * 提交原答并获取保存回执（不触发可靠判分、错题或复习统计）
 * @param {Object} params - 提交参数
 * @param {string} params.idempotencyKey - 幂等键（防重复提交）
 * @param {Object} params.data - 答题数据 { question_id, user_answer, session_id, duration, practice_mode }
 * @returns {Promise} 返回提交结果
 */
export async function submitAnswer(params, options = { session: captureSession() }) {
  const session = options.session;
  try {
    const response = await request(
      '/answer-submit',
      {
        action: 'submit',
        idempotencyKey: params.idempotencyKey,
        data: params.data
      },
      { session }
    );
    return response;
  } catch (error) {
    logger.warn('[LafService] 答题提交失败:', error);
    return normalizeError(error, '答题提交');
  }
}
