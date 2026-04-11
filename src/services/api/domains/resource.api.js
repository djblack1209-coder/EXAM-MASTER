/**
 * 学习资源 API
 * 职责：对接后端 learning-resource 云函数，提供资源推荐、
 *       热门排行、分类浏览、搜索、收藏、学习进度等功能
 *
 * 后端接口：/learning-resource
 * 认证方式：JWT（部分接口可匿名访问）
 *
 * @module services/api/domains/resource
 */

import { logger } from '@/utils/logger.js';
import { request, normalizeError } from './_request-core.js';

const ENDPOINT = '/learning-resource';

// ==================== 浏览类（可匿名） ====================

/**
 * 获取推荐资源
 * @param {Object} [params] - 查询参数
 * @param {string} [params.subject] - 学科筛选（politics/english/math/professional）
 * @param {number} [params.limit=10] - 数量（最大20）
 * @returns {Promise<{code:number, data:{resources:Array, personalized:boolean}}>}
 */
export async function getRecommendations(params = {}) {
  try {
    return await request(ENDPOINT, { action: 'getRecommendations', data: params });
  } catch (error) {
    logger.warn('[resource.api] 获取推荐资源失败:', error);
    return normalizeError(error, '获取推荐资源');
  }
}

/**
 * 获取热门资源
 * @param {Object} [params] - 查询参数
 * @param {string} [params.category] - 分类筛选
 * @param {string} [params.subject] - 学科筛选
 * @param {string} [params.period='week'] - 时间段（week/month/all）
 * @param {number} [params.limit=20] - 数量（最大50）
 * @returns {Promise<{code:number, data:Array}>}
 */
export async function getHotResources(params = {}) {
  try {
    return await request(ENDPOINT, { action: 'getHotResources', data: params });
  } catch (error) {
    logger.warn('[resource.api] 获取热门资源失败:', error);
    return normalizeError(error, '获取热门资源');
  }
}

/**
 * 按分类获取资源（分页）
 * @param {Object} params - 查询参数
 * @param {string} params.category - 分类（必填）：video/article/book/practice/tool/community
 * @param {string} [params.subject] - 学科筛选
 * @param {number} [params.page=1] - 页码
 * @param {number} [params.limit=20] - 每页数量（最大50）
 * @returns {Promise<{code:number, data:{resources:Array, total:number, hasMore:boolean}}>}
 */
export async function getByCategory(params = {}) {
  try {
    return await request(ENDPOINT, { action: 'getByCategory', data: params });
  } catch (error) {
    logger.warn('[resource.api] 按分类获取失败:', error);
    return normalizeError(error, '按分类获取');
  }
}

/**
 * 搜索资源
 * @param {Object} params - 查询参数
 * @param {string} params.keyword - 关键词（至少2字符，最长50）
 * @param {string} [params.category] - 分类筛选
 * @param {string} [params.subject] - 学科筛选
 * @param {number} [params.page=1] - 页码
 * @param {number} [params.limit=20] - 每页数量
 * @returns {Promise<{code:number, data:{resources:Array, total:number, keyword:string}}>}
 */
export async function searchResources(params = {}) {
  try {
    return await request(ENDPOINT, { action: 'search', data: params });
  } catch (error) {
    logger.warn('[resource.api] 搜索资源失败:', error);
    return normalizeError(error, '搜索资源');
  }
}

/**
 * 获取资源分类列表
 * @returns {Promise<{code:number, data:Object}>}
 */
export async function getCategories() {
  try {
    return await request(ENDPOINT, { action: 'getCategories', data: {} });
  } catch (error) {
    logger.warn('[resource.api] 获取分类失败:', error);
    return normalizeError(error, '获取分类');
  }
}

/**
 * 获取学科分类列表
 * @returns {Promise<{code:number, data:Object}>}
 */
export async function getSubjects() {
  try {
    return await request(ENDPOINT, { action: 'getSubjects', data: {} });
  } catch (error) {
    logger.warn('[resource.api] 获取学科失败:', error);
    return normalizeError(error, '获取学科');
  }
}

// ==================== 用户操作类（需登录） ====================

/**
 * 收藏/取消收藏资源
 * @param {string} resourceId - 资源ID
 * @param {string} [action='add'] - 操作：'add' 或 'remove'
 * @returns {Promise<{code:number, data:{isFavorite:boolean}}>}
 */
export async function favoriteResource(resourceId, action = 'add') {
  try {
    return await request(ENDPOINT, {
      action: 'favorite',
      data: { resourceId, action }
    });
  } catch (error) {
    logger.warn('[resource.api] 收藏操作失败:', error);
    return normalizeError(error, '收藏操作');
  }
}

/**
 * 获取用户收藏的资源（分页）
 * @param {Object} [params] - 查询参数
 * @param {number} [params.page=1] - 页码
 * @param {number} [params.limit=20] - 每页数量
 * @returns {Promise<{code:number, data:{favorites:Array, total:number, hasMore:boolean}}>}
 */
export async function getUserFavorites(params = {}) {
  try {
    return await request(ENDPOINT, { action: 'getUserFavorites', data: params });
  } catch (error) {
    logger.warn('[resource.api] 获取收藏资源失败:', error);
    return normalizeError(error, '获取收藏资源');
  }
}

/**
 * 记录学习进度
 * @param {Object} data - 进度信息
 * @param {string} data.resourceId - 资源ID（必填）
 * @param {number} [data.progress] - 进度百分比（0-100）
 * @param {number} [data.duration] - 学习时长（秒）
 * @returns {Promise<{code:number, success:boolean}>}
 */
export async function recordProgress(data = {}) {
  try {
    return await request(ENDPOINT, { action: 'recordProgress', data });
  } catch (error) {
    logger.warn('[resource.api] 记录进度失败:', error);
    return normalizeError(error, '记录进度');
  }
}

/**
 * 获取学习统计
 * @returns {Promise<{code:number, data:Object}>}
 */
export async function getResourceStats() {
  try {
    return await request(ENDPOINT, { action: 'getStats', data: {} });
  } catch (error) {
    logger.warn('[resource.api] 获取统计失败:', error);
    return normalizeError(error, '获取统计');
  }
}
