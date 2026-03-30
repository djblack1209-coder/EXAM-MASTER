/**
 * 学习数据与资源 API
 * 职责：首页动态数据
 *
 * @module services/api/domains/study
 */

import { logger } from '@/utils/logger.js';
import config from '../../../config/index.js';
import { request, normalizeError } from './_request-core.js';

// [AUDIT R276] 已删除 2 个无调用方的死代码函数:
// getStudyStats (含本地降级逻辑), getHotResources

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
        timeout: config.api.homeDataTimeout
      }
    );
    return response;
  } catch (error) {
    logger.warn('[LafService] 获取首页数据失败:', error);
    // [AUDIT FIX R269] 统一使用 normalizeError
    return normalizeError(error, '获取首页数据');
  }
}
