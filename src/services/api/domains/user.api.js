/**
 * 用户服务 API
 * 职责：账号注销、用户统计概览、
 *       学习目标同步、成就系统
 *
 * ⚠️ 隐藏约束：
 * - unlockAchievement 中直接用 uni.setStorageSync：避免 storageService 循环依赖
 *
 * @module services/api/domains/user
 */

import { logger } from '@/utils/logger.js';
import { getUserId } from '../../auth-storage.js';
import { request, normalizeError } from './_request-core.js';

// [AUDIT R276] 已删除 1 个无调用方的死代码函数: updateUserProfile

// ==================== 账号注销（7天冷静期） ====================

/**
 * 申请注销账号
 * @returns {Promise}
 */
export async function requestAccountDeletion() {
  try {
    const response = await request('/account-delete', { action: 'request' });
    return response;
  } catch (error) {
    logger.error('[LafService] 申请注销失败:', error);
    return normalizeError(error, '申请注销');
  }
}

/**
 * 撤销注销申请
 * @returns {Promise}
 */
export async function cancelAccountDeletion() {
  try {
    const response = await request('/account-delete', { action: 'cancel' });
    return response;
  } catch (error) {
    logger.error('[LafService] 撤销注销失败:', error);
    return normalizeError(error, '撤销注销');
  }
}

/**
 * 查询账号注销状态
 * @returns {Promise} data: { status, deletionScheduledAt, remainingDays }
 */
export async function getAccountDeletionStatus() {
  try {
    const response = await request('/account-delete', { action: 'status' });
    return response;
  } catch (error) {
    logger.error('[LafService] 查询注销状态失败:', error);
    return normalizeError(error, '查询注销状态');
  }
}

// ==================== 学习目标同步 ====================

/**
 * 同步学习目标到后端
 * @param {string} userId - 用户ID
 * @param {Object} syncData - 同步数据 { goals, updatedAt }
 * @returns {Promise} 返回同步结果
 */
export async function syncLearningGoals(userId, syncData) {
  try {
    if (!userId) return { code: -1, success: false, message: '用户未登录' };

    const activeGoals = (syncData.goals || []).filter((g) => g.status === 'active');
    const results = [];
    let failCount = 0;

    for (const goal of activeGoals) {
      try {
        const response = await request('/learning-goal', {
          action: 'create',
          userId,
          data: {
            type: goal.type,
            targetValue: goal.targetValue,
            period: goal.period
          }
        });
        results.push(response);
      } catch (goalErr) {
        failCount++;
        logger.warn('[LafService] 单个目标同步失败:', goal.type, goalErr);
        results.push({ code: -1, success: false, type: goal.type });
      }
    }

    const successCount = results.length - failCount;
    if (failCount > 0 && successCount === 0) {
      return { code: -1, success: false, message: '同步失败', data: results };
    }
    return { code: 0, success: true, message: `已同步 ${successCount}/${activeGoals.length} 个目标`, data: results };
  } catch (error) {
    // [AUDIT FIX R268] 统一 normalizeError
    logger.warn('[LafService] 同步学习目标失败:', error);
    return { ...normalizeError(error, '同步学习目标'), _errorSource: 'network' };
  }
}

/**
 * 获取后端学习目标
 * @param {Object} params - 查询参数
 * @returns {Promise} 返回目标列表
 */
export async function getLearningGoals(params = {}) {
  try {
    const userId = getUserId();
    if (!userId) return { code: -1, success: false, message: '请先登录', data: [] };

    const response = await request('/learning-goal', {
      action: 'get',
      userId,
      data: params
    });
    return response;
  } catch (error) {
    // [AUDIT FIX R268] 统一 normalizeError
    logger.warn('[LafService] 获取学习目标失败:', error);
    return { ...normalizeError(error, '获取学习目标'), data: [] };
  }
}

/**
 * 记录学习目标进度到后端
 * @param {string} type - 目标类型
 * @param {number} value - 进度值
 * @returns {Promise} 返回记录结果
 */
export async function recordGoalProgress(type, value) {
  try {
    const userId = getUserId();
    if (!userId) return { code: -1, success: false, message: '请先登录' };

    const response = await request('/learning-goal', {
      action: 'recordProgress',
      userId,
      data: { type, value }
    });
    return response;
  } catch (error) {
    // [AUDIT FIX R268] 统一 normalizeError
    logger.warn('[LafService] 记录目标进度失败:', error);
    return normalizeError(error, '记录目标进度');
  }
}

// ==================== 成就系统 ====================

/**
 * 检查并同步成就到后端
 * @returns {Promise} 返回新解锁的成就
 */
export async function checkAchievements() {
  try {
    const userId = getUserId();
    if (!userId) return { code: -1, success: false, message: '请先登录', data: { newlyUnlocked: [] } };

    // 先重试之前失败的解锁请求
    try {
      const pending = uni.getStorageSync('_pendingAchievements') || [];
      if (pending.length > 0) {
        const remaining = [];
        for (const aid of pending) {
          try {
            await request('/achievement-manager', { action: 'unlock', userId, data: { achievementId: aid } });
          } catch (_e) {
            remaining.push(aid);
          }
        }
        uni.setStorageSync('_pendingAchievements', remaining);
      }
    } catch (_e) {
      /* 重试失败不影响主流程 */
    }

    const response = await request('/achievement-manager', {
      action: 'check',
      userId,
      data: {}
    });
    return response;
  } catch (error) {
    // [AUDIT FIX R268] 统一 normalizeError
    logger.warn('[LafService] 检查成就失败:', error);
    return { ...normalizeError(error, '检查成就'), data: { newlyUnlocked: [] } };
  }
}

/**
 * 获取所有成就（含解锁状态）
 * @returns {Promise} 返回成就列表
 */
export async function getAllAchievements() {
  try {
    const userId = getUserId();
    if (!userId) return { code: -1, success: false, message: '请先登录', data: { achievements: [] } };

    const response = await request('/achievement-manager', {
      action: 'getAll',
      userId,
      data: {}
    });
    return response;
  } catch (error) {
    // [AUDIT FIX R268] 统一 normalizeError
    logger.warn('[LafService] 获取成就失败:', error);
    return { ...normalizeError(error, '获取成就'), data: { achievements: [] } };
  }
}

/**
 * 解锁指定成就
 * ⚠️ 此处直接用 uni.getStorageSync 而非 storageService，因为 storageService → lafService 存在循环依赖
 * @param {string} achievementId - 成就ID
 * @returns {Promise} 返回解锁结果
 */
export async function unlockAchievement(achievementId) {
  try {
    const userId = getUserId();
    if (!userId) return { code: -1, success: false, message: '请先登录' };

    const response = await request('/achievement-manager', {
      action: 'unlock',
      userId,
      data: { achievementId }
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 解锁成就失败，已缓存待重试:', achievementId, error);
    try {
      const pending = uni.getStorageSync('_pendingAchievements') || [];
      if (!pending.includes(achievementId)) {
        pending.push(achievementId);
        uni.setStorageSync('_pendingAchievements', pending);
      }
    } catch (_e) {
      /* 存储失败忽略 */
    }
    // [AUDIT FIX R268] 统一 normalizeError
    return { ...normalizeError(error, '解锁成就'), message: '解锁失败，将自动重试' };
  }
}
