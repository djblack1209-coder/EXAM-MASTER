/**
 * 院校数据查询 API
 * 职责：学校列表/详情/搜索、热门院校、省份列表
 *
 * @module services/api/domains/school
 */

import { logger } from '@/utils/logger.js';
import { request, normalizeError } from './_request-core.js';

/**
 * 获取学校详情
 * @param {string} schoolId - 学校ID或代码
 * @returns {Promise} 返回学校详情
 */
export async function getSchoolDetail(schoolId) {
  try {
    const response = await request('/school-query', {
      action: 'detail',
      data: { code: String(schoolId) }
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 获取学校详情失败:', error);
    return normalizeError(error, '获取学校详情');
  }
}

/**
 * 搜索学校
 * @param {string} keyword - 搜索关键词
 * @param {number} limit - 返回数量限制
 * @returns {Promise} 返回搜索结果
 */
export async function searchSchools(keyword, limit = 10) {
  try {
    const response = await request('/school-query', {
      action: 'search',
      data: { keyword, limit }
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 搜索学校失败:', error);
    return normalizeError(error, '搜索学校');
  }
}

/**
 * 获取热门学校
 * @param {Object} params - 查询参数
 * @returns {Promise} 返回热门学校列表
 */
export async function getHotSchools(params = {}) {
  try {
    const response = await request('/school-query', {
      action: 'hot',
      data: params
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 获取热门学校失败:', error);
    return { code: -1, success: false, message: '获取热门学校失败', data: [] };
  }
}

/**
 * 获取省份列表
 * @returns {Promise} 返回省份列表
 */
export async function getProvinces() {
  try {
    const response = await request('/school-query', {
      action: 'provinces',
      data: {}
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 获取省份列表失败:', error);
    return { code: -1, success: false, message: '获取省份列表失败', data: [] };
  }
}

// ==================== 院校爬虫 ====================

/**
 * 爬虫接口 - 获取院校实时数据
 * @param {Object} params - 请求参数（含 action, data 等）
 * @param {Object} [options] - 请求选项
 */
export async function crawlSchoolData(params, options = {}) {
  try {
    return await request('/school-crawler-api', params, options);
  } catch (error) {
    logger.warn('[School] 院校爬虫请求失败:', error);
    return normalizeError(error, '院校数据获取');
  }
}
