/**
 * 邀请系统 API
 * 职责：对接后端 invite-service 云函数，提供邀请关系记录、
 *       奖励领取、邀请信息查询等功能
 *
 * 后端接口：/invite-service
 * 认证方式：JWT（后端自动从 token 提取 userId）
 *
 * @module services/api/domains/invite
 */

import { logger } from '@/utils/logger.js';
import { request, normalizeError } from './_request-core.js';

const ENDPOINT = '/invite-service';

// ==================== 查询类 ====================

/**
 * 获取邀请信息（邀请码、已邀请人数、奖励列表及领取状态）
 * @returns {Promise<{code:number, data:{inviteCode:string, count:number, rewards:Array}}>}
 *   rewards[]: { threshold, type, value, label, claimed, unlocked }
 */
export async function getInviteInfo() {
  try {
    return await request(ENDPOINT, { action: 'get_info' });
  } catch (error) {
    logger.warn('[invite.api] 获取邀请信息失败:', error);
    return normalizeError(error, '获取邀请信息');
  }
}

// ==================== 写入类 ====================

/**
 * 处理新邀请（被邀请人调用，绑定邀请关系）
 * @param {string} inviterId - 邀请人的用户ID
 * @returns {Promise<{code:number, success:boolean, message:string}>}
 */
export async function handleInvite(inviterId) {
  try {
    return await request(ENDPOINT, { action: 'handle', inviterId });
  } catch (error) {
    logger.warn('[invite.api] 处理邀请失败:', error);
    return normalizeError(error, '处理邀请');
  }
}

/**
 * 领取邀请奖励
 * @param {number} threshold - 奖励阈值（1/3/5/10）
 * @returns {Promise<{code:number, data:{reward:Object}, message:string}>}
 *   reward: { threshold, type, value, label }
 */
export async function claimInviteReward(threshold) {
  try {
    return await request(ENDPOINT, { action: 'claim_reward', threshold });
  } catch (error) {
    logger.warn('[invite.api] 领取奖励失败:', error);
    return normalizeError(error, '领取奖励');
  }
}
