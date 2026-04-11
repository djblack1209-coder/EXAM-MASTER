/**
 * 收藏管理 API
 * 职责：对接后端 favorite-manager 云函数，提供收藏的增删查改、
 *       批量操作、分类统计等功能
 *
 * 后端接口：/favorite-manager
 * 认证方式：JWT（后端自动从 token 提取 userId）
 *
 * @module services/api/domains/favorite
 */

import { logger } from '@/utils/logger.js';
import { request, normalizeError } from './_request-core.js';

const ENDPOINT = '/favorite-manager';

// ==================== 单条操作 ====================

/**
 * 添加收藏
 * @param {Object} data - 题目数据
 * @param {string} [data.questionId] - 题目ID
 * @param {string} [data.question] - 题目内容
 * @param {Array} [data.options] - 选项列表
 * @param {string} [data.answer] - 正确答案
 * @param {string} [data.analysis] - 解析
 * @param {string} [data.category] - 分类
 * @param {Array} [data.tags] - 标签
 * @param {string} [data.source] - 来源
 * @returns {Promise<{code:number, success:boolean, id:string, message:string}>}
 */
export async function addFavorite(data = {}) {
  try {
    return await request(ENDPOINT, { action: 'add', data });
  } catch (error) {
    logger.warn('[favorite.api] 添加收藏失败:', error);
    return normalizeError(error, '添加收藏');
  }
}

/**
 * 获取收藏列表（分页）
 * @param {Object} [params] - 查询参数
 * @param {number} [params.page=1] - 页码
 * @param {number} [params.limit=50] - 每页数量（最大100）
 * @param {string} [params.category] - 按分类筛选
 * @param {string} [params.source] - 按来源筛选
 * @param {string} [params.sortBy='created_at'] - 排序字段
 * @param {string} [params.sortOrder='desc'] - 排序方向
 * @returns {Promise<{code:number, data:Array, total:number, hasMore:boolean}>}
 */
export async function getFavorites(params = {}) {
  try {
    return await request(ENDPOINT, { action: 'get', data: params });
  } catch (error) {
    logger.warn('[favorite.api] 获取收藏列表失败:', error);
    return normalizeError(error, '获取收藏列表');
  }
}

/**
 * 删除收藏
 * @param {Object} data - 删除条件（二选一）
 * @param {string} [data.id] - 收藏记录ID
 * @param {string} [data.questionId] - 题目ID
 * @returns {Promise<{code:number, success:boolean, deleted:number}>}
 */
export async function removeFavorite(data = {}) {
  try {
    return await request(ENDPOINT, { action: 'remove', data });
  } catch (error) {
    logger.warn('[favorite.api] 删除收藏失败:', error);
    return normalizeError(error, '删除收藏');
  }
}

/**
 * 检查是否已收藏（支持单个和批量）
 * @param {Object} data - 检查条件
 * @param {string} [data.questionId] - 单个题目ID
 * @param {Array<string>} [data.questionIds] - 批量题目ID（最多100个）
 * @returns {Promise<{code:number, data:Object}>}
 *   单个：data.isFavorite + data.favoriteId
 *   批量：data = { questionId: boolean, ... }
 */
export async function checkFavorite(data = {}) {
  try {
    return await request(ENDPOINT, { action: 'check', data });
  } catch (error) {
    logger.warn('[favorite.api] 检查收藏状态失败:', error);
    return normalizeError(error, '检查收藏状态');
  }
}

// ==================== 批量操作 ====================

/**
 * 批量添加收藏（最多50条）
 * @param {Array<Object>} questions - 题目数组
 * @returns {Promise<{code:number, data:{added:number, skipped:number, results:Array}}>}
 */
export async function batchAddFavorites(questions = []) {
  try {
    return await request(ENDPOINT, { action: 'batchAdd', data: { questions } });
  } catch (error) {
    logger.warn('[favorite.api] 批量添加收藏失败:', error);
    return normalizeError(error, '批量添加收藏');
  }
}

/**
 * 批量删除收藏（最多100条）
 * @param {Object} data - 删除条件
 * @param {Array<string>} [data.ids] - 收藏记录ID数组
 * @param {Array<string>} [data.questionIds] - 题目ID数组
 * @returns {Promise<{code:number, data:{deleted:number}}>}
 */
export async function batchRemoveFavorites(data = {}) {
  try {
    return await request(ENDPOINT, { action: 'batchRemove', data });
  } catch (error) {
    logger.warn('[favorite.api] 批量删除收藏失败:', error);
    return normalizeError(error, '批量删除收藏');
  }
}

// ==================== 分类统计 ====================

/**
 * 获取收藏分类统计
 * @returns {Promise<{code:number, data:{categories:Array, sources:Array, total:number}}>}
 */
export async function getFavoriteCategories() {
  try {
    return await request(ENDPOINT, { action: 'getCategories', data: {} });
  } catch (error) {
    logger.warn('[favorite.api] 获取分类统计失败:', error);
    return normalizeError(error, '获取分类统计');
  }
}

/**
 * 按分类筛选收藏（分页）
 * @param {Object} params - 查询参数
 * @param {string} params.category - 分类名称（必填）
 * @param {number} [params.page=1] - 页码
 * @param {number} [params.limit=50] - 每页数量
 * @returns {Promise<{code:number, data:Array, total:number, hasMore:boolean}>}
 */
export async function getFavoritesByCategory(params = {}) {
  try {
    return await request(ENDPOINT, { action: 'getByCategory', data: params });
  } catch (error) {
    logger.warn('[favorite.api] 按分类筛选失败:', error);
    return normalizeError(error, '按分类筛选');
  }
}
