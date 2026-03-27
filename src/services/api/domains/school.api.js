/**
 * 院校数据查询 API
 * 职责：学校列表/详情/搜索、热门院校、省份列表
 *
 * @module services/api/domains/school
 */

import { logger } from '@/utils/logger.js';
import { request, normalizeError } from './_request-core.js';

/**
 * 获取学校列表
 * @param {Object} params - 查询参数
 * @returns {Promise} 返回学校列表
 */
export async function getSchoolList(params = {}) {
  try {
    const response = await request('/school-query', {
      action: 'list',
      data: params
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 获取学校列表失败:', error);
    return normalizeError(error, '获取学校列表');
  }
}

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
    return { code: -1, success: false, data: [] };
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
    return { code: -1, success: false, data: [] };
  }
}
