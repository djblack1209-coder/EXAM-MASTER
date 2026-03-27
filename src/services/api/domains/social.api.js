/**
 * 社交服务 API
 * 职责：好友系统、排行榜、邀请与奖励
 *
 * @module services/api/domains/social
 */

import { logger } from '@/utils/logger.js';
import { getUserId } from '../../auth-storage.js';
import { request, normalizeError } from './_request-core.js';

/**
 * 排行榜服务
 * @param {{ action: string, userId?: string, nickName?: string, avatarUrl?: string, score?: number }} data
 * @returns {Promise} 返回操作结果
 */
export async function rankCenter(data) {
  try {
    return await request('/rank-center', data);
  } catch (error) {
    logger.error('[LafService] 排行榜请求失败:', error);
    return normalizeError(error, '排行榜请求');
  }
}

/**
 * 社交服务（好友系统）
 *
 * 支持的 action:
 * - search_user: 搜索用户
 * - send_request: 发送好友请求
 * - handle_request: 处理好友请求
 * - get_friend_list: 获取好友列表
 * - get_friend_requests: 获取好友请求列表
 * - remove_friend: 删除好友
 *
 * @param {{ action: string, userId?: string, targetUserId?: string, keyword?: string }} data
 * @returns {Promise} 返回操作结果
 */
export async function socialService(data) {
  try {
    logger.log('[LafService] 社交服务请求:', data);
    const response = await request('/social-service', data);
    logger.log('[LafService] 社交服务响应:', response);
    return response;
  } catch (error) {
    logger.error('[LafService] 社交服务请求失败:', error);
    return normalizeError(error, '社交服务请求');
  }
}

// 便捷方法 — friend-list.vue 等页面直接以 socialService.xxx() 形式调用
socialService.getFriendList = (sortBy = 'score', silent = false) =>
  socialService({ action: 'get_friend_list', sortBy, silent });
socialService.getFriendRequests = () => socialService({ action: 'get_friend_requests' });
socialService.searchUser = (keyword) => socialService({ action: 'search_user', keyword });
socialService.sendRequest = (targetUserId, message) => socialService({ action: 'send_request', targetUserId, message });
socialService.handleRequest = (fromUserId, action) =>
  socialService({ action: 'handle_request', fromUserId, handleAction: action });
socialService.removeFriend = (targetUserId) => socialService({ action: 'remove_friend', targetUserId });
socialService.clearCache = () => {
  /* 本地缓存清理，无需请求后端 */
};

// ==================== 邀请系统 ====================

/**
 * 处理新邀请（后端验证+持久化）
 * @param {string} inviterId - 邀请人ID
 * @returns {Promise} 返回邀请结果
 */
export async function handleInvite(inviterId) {
  try {
    const userId = getUserId();
    if (!userId) return { code: -1, success: false, message: '请先登录' };

    const response = await request('/invite-service', {
      action: 'handle',
      userId,
      inviterId
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 处理邀请失败:', error);
    return { code: -1, success: false, message: '邀请处理失败' };
  }
}

/**
 * 领取邀请奖励
 * @param {number} threshold - 奖励阈值（邀请人数）
 * @returns {Promise} 返回领取结果
 */
export async function claimInviteReward(threshold) {
  try {
    const userId = getUserId();
    if (!userId) return { code: -1, success: false, message: '请先登录' };

    const response = await request('/invite-service', {
      action: 'claim_reward',
      userId,
      threshold
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 领取邀请奖励失败:', error);
    return { code: -1, success: false, message: '领取失败' };
  }
}

/**
 * 获取邀请信息（邀请码、邀请数、奖励列表）
 * @returns {Promise} 返回邀请信息
 */
export async function getInviteInfo() {
  try {
    const userId = getUserId();
    if (!userId) return { code: -1, success: false, message: '请先登录', data: null };

    const response = await request('/invite-service', {
      action: 'get_info',
      userId
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 获取邀请信息失败:', error);
    return { code: -1, success: false, message: '获取失败', data: null };
  }
}

/**
 * 为邀请链接参数生成签名（服务端签名，密钥不暴露给前端）
 * @param {Object} linkParams - 链接参数对象
 * @returns {Promise<{code: number, data: {signature: string}}>}
 */
export async function signInviteLink(linkParams) {
  try {
    const response = await request('/invite-service', {
      action: 'sign_link',
      linkParams
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 邀请链接签名失败:', error);
    return { code: -1, success: false, message: '签名失败', data: null };
  }
}

/**
 * 验证邀请链接签名（服务端验签）
 * @param {Object} linkParams - 链接参数对象（不含签名）
 * @param {string} signature - 签名值
 * @returns {Promise<{code: number, data: {valid: boolean, expired: boolean}}>}
 */
export async function verifyInviteLink(linkParams, signature) {
  try {
    const response = await request('/invite-service', {
      action: 'verify_link',
      linkParams,
      signature
    });
    return response;
  } catch (error) {
    logger.warn('[LafService] 邀请链接验签失败:', error);
    return { code: -1, success: false, message: '验签失败', data: null };
  }
}
