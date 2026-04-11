/**
 * 学习小组 API
 * 职责：对接后端 group-service 云函数，提供小组创建/加入/离开、
 *       成员管理、资源分享等功能
 *
 * 后端接口：/group-service
 * 认证方式：JWT（后端自动从 token 提取 userId）
 *
 * @module services/api/domains/group
 */

import { logger } from '@/utils/logger.js';
import { request, normalizeError } from './_request-core.js';

const ENDPOINT = '/group-service';

// ==================== 小组管理 ====================

/**
 * 创建小组
 * @param {Object} data - 小组信息
 * @param {string} data.name - 小组名称（2-50字符）
 * @param {string} [data.description] - 小组描述
 * @param {string} [data.avatar] - 小组头像URL
 * @param {Array<string>} [data.tags] - 标签（最多20个）
 * @param {number} [data.maxMembers=50] - 最大成员数（2-100）
 * @returns {Promise<{code:number, data:{group_id:string}}>}
 */
export async function createGroup(data = {}) {
  try {
    return await request(ENDPOINT, { action: 'create_group', ...data });
  } catch (error) {
    logger.warn('[group.api] 创建小组失败:', error);
    return normalizeError(error, '创建小组');
  }
}

/**
 * 加入小组
 * @param {string} groupId - 小组ID
 * @returns {Promise<{code:number, data:{group_id:string, group_name:string}}>}
 */
export async function joinGroup(groupId) {
  try {
    return await request(ENDPOINT, { action: 'join_group', groupId });
  } catch (error) {
    logger.warn('[group.api] 加入小组失败:', error);
    return normalizeError(error, '加入小组');
  }
}

/**
 * 获取小组列表（分页）
 * @param {Object} [params] - 查询参数
 * @param {number} [params.page=1] - 页码
 * @param {number} [params.pageSize=20] - 每页数量（最大50）
 * @param {string} [params.type='all'] - 类型筛选：'all' 全部 / 'joined' 已加入
 * @returns {Promise<{code:number, data:Array, total:number}>}
 */
export async function getGroups(params = {}) {
  try {
    return await request(ENDPOINT, { action: 'get_groups', ...params });
  } catch (error) {
    logger.warn('[group.api] 获取小组列表失败:', error);
    return normalizeError(error, '获取小组列表');
  }
}

/**
 * 获取小组详情（含成员列表）
 * @param {string} groupId - 小组ID
 * @returns {Promise<{code:number, data:Object}>}
 */
export async function getGroupDetail(groupId) {
  try {
    return await request(ENDPOINT, { action: 'get_group_detail', groupId });
  } catch (error) {
    logger.warn('[group.api] 获取小组详情失败:', error);
    return normalizeError(error, '获取小组详情');
  }
}

/**
 * 离开小组
 * @param {string} groupId - 小组ID
 * @returns {Promise<{code:number, success:boolean}>}
 */
export async function leaveGroup(groupId) {
  try {
    return await request(ENDPOINT, { action: 'leave_group', groupId });
  } catch (error) {
    logger.warn('[group.api] 离开小组失败:', error);
    return normalizeError(error, '离开小组');
  }
}

// ==================== 资源分享 ====================

/**
 * 分享资源到小组
 * @param {Object} data - 资源信息
 * @param {string} data.groupId - 小组ID
 * @param {string} data.title - 资源标题
 * @param {string} [data.content] - 资源内容
 * @param {string} [data.resourceType='note'] - 类型：note/material/experience/other
 * @param {string} [data.fileUrl] - 文件URL
 * @param {Array<string>} [data.tags] - 标签
 * @returns {Promise<{code:number, data:Object}>}
 */
export async function shareResource(data = {}) {
  try {
    return await request(ENDPOINT, { action: 'share_resource', ...data });
  } catch (error) {
    logger.warn('[group.api] 分享资源失败:', error);
    return normalizeError(error, '分享资源');
  }
}

/**
 * 获取小组资源列表（分页）
 * @param {Object} params - 查询参数
 * @param {string} params.groupId - 小组ID（必填）
 * @param {number} [params.page=1] - 页码
 * @param {number} [params.pageSize=20] - 每页数量
 * @param {string} [params.type='all'] - 资源类型筛选
 * @returns {Promise<{code:number, data:Array, total:number}>}
 */
export async function getGroupResources(params = {}) {
  try {
    return await request(ENDPOINT, { action: 'get_resources', ...params });
  } catch (error) {
    logger.warn('[group.api] 获取资源列表失败:', error);
    return normalizeError(error, '获取资源列表');
  }
}
