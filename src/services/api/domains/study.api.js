/**
 * 学习数据与资源 API
 * 职责：学习统计（含本地降级）、学习资源推荐/搜索/分类、首页动态数据
 *
 * ⚠️ 隐藏约束：
 * - getStudyStats 使用原生存储读取本地兜底：避免 storageService 循环依赖
 *
 * @module services/api/domains/study
 */

import { logger } from '@/utils/logger.js';
import { getUserId } from '../../auth-storage.js';
import { request, normalizeError, getStorageValue } from './_request-core.js';

// ==================== 学习统计 ====================

/**
 * 获取用户学习统计，网络失败时降级使用本地数据
 * @param {string} userId - 用户ID
 * @returns {Promise} 返回统计数据；check `data._source` for 'local_fallback' flag
 */
export async function getStudyStats(userId) {
  try {
    const response = await request('/study-stats', {
      action: 'get',
      userId
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 获取学习统计失败，降级使用本地数据:', error);
    // 降级到本地存储数据
    try {
      const localStats = getStorageValue('study_stats', {});
      const bankCount = getStorageValue('v30_bank', []).length;
      const mistakeCount = getStorageValue('mistake_book', []).length;
      return {
        code: 0,
        success: true,
        data: {
          totalQuestions: bankCount,
          totalMistakes: mistakeCount,
          studyDays: Object.keys(localStats).length,
          dailyStats: localStats,
          _source: 'local_fallback'
        },
        message: '使用本地缓存数据'
      };
    } catch (_e) {
      return normalizeError(error, '获取学习统计');
    }
  }
}

/**
 * 获取热门学习资源
 * @param {Object} params - 查询参数
 * @returns {Promise} 返回热门资源
 */
export async function getHotResources(params = {}) {
  try {
    const userId = getUserId();

    const response = await request('/learning-resource', {
      action: 'getHotResources',
      userId: userId || '',
      data: params
    });
    return response;
  } catch (error) {
    logger.error('[LafService] 获取热门资源失败:', error);
    return { code: -1, success: false, message: '获取失败', data: [] };
  }
}

// ==================== 智能学习引擎 ====================
// ✅ D019: 已移除 re-export，智能学习函数统一从 smart-study.api.js 导入
// 旧的 re-export 导致 analyzeMastery / getErrorClusters / getSprintPriority /
// generateAdaptivePlan 等 4+ 个函数同时从两个模块导出，引发 import 混乱

/**
 * 获取首页动态数据（金句、公式、公告等）
 * @returns {Promise} 返回首页数据
 */
export async function getHomeData() {
  try {
    const response = await request(
      '/getHomeData',
      {},
      {
        skipAuth: true,
        timeout: 10000
      }
    );
    return response;
  } catch (error) {
    logger.warn('[LafService] 获取首页数据失败:', error);
    return { code: -1, success: false, message: '获取失败', data: null };
  }
}
