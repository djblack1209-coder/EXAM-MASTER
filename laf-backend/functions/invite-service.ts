/**
 * 邀请系统云函数
 *
 * 功能：
 * 1. handle - 处理新邀请（记录邀请关系、防重复、防自邀请）
 * 2. claim_reward - 领取邀请奖励
 * 3. get_info - 获取邀请信息（邀请码、邀请数、奖励列表）
 *
 * @version 1.0.0
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import {
  logger,
  success,
  badRequest,
  unauthorized,
  serverError,
  error as apiError,
  generateRequestId,
  ResponseCode
} from './_shared/api-response.js';

const db = cloud.database();
const _ = db.command;

// 邀请奖励配置
const INVITE_REWARDS = [
  { threshold: 1, type: 'vip_trial', value: 3, label: '邀请1人：VIP体验3天' },
  { threshold: 3, type: 'vip_trial', value: 7, label: '邀请3人：VIP体验7天' },
  { threshold: 5, type: 'vip_trial', value: 15, label: '邀请5人：VIP体验15天' },
  { threshold: 10, type: 'vip_trial', value: 30, label: '邀请10人：VIP体验30天' }
];

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = generateRequestId('inv');

  try {
    const { action, ...params } = ctx.body || {};

    if (!action || typeof action !== 'string') {
      return { ...badRequest('参数错误: action 不合法'), requestId };
    }

    // [R2-P0] JWT 认证：所有操作强制验证（get_info 也涉及用户私有数据）
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return { ...authResult, requestId };
    }
    const userId = authResult.userId;

    if (!userId || typeof userId !== 'string' || userId.length > 64) {
      return { ...unauthorized('请先登录'), requestId };
    }

    logger.info(`[${requestId}] invite action: ${action}, userId: ${userId}`);

    const handlers = {
      handle: handleInvite,
      claim_reward: claimReward,
      get_info: getInviteInfo
    };

    const handler = handlers[action];
    if (!handler) {
      return { ...badRequest(`不支持的操作: ${action}`), requestId };
    }

    const result = await handler(userId, params, requestId);
    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] 完成，耗时: ${duration}ms`);

    return { ...result, requestId, duration };
  } catch (error) {
    logger.error(`[${requestId}] 邀请服务异常:`, error);
    return { ...serverError('服务器内部错误'), requestId, duration: Date.now() - startTime };
  }
}

/**
 * 处理新邀请
 */
async function handleInvite(userId: string, params: Record<string, unknown>, requestId: string) {
  const { inviterId } = params;
  if (!inviterId || typeof inviterId !== 'string' || inviterId.length > 64) {
    return badRequest('缺少邀请人ID');
  }
  if (inviterId === userId) {
    return badRequest('不能邀请自己');
  }

  // 校验邀请人存在
  const inviter = await db.collection('users').doc(inviterId).get();
  if (!inviter.data) {
    return badRequest('邀请人不存在');
  }

  const col = db.collection('invites');

  // 每个被邀请人仅允许绑定一次，防止重复归因/刷邀请
  const existingInvitee = await col.where({ inviteeId: userId, status: 'accepted' }).getOne();
  if (existingInvitee.data) {
    if (existingInvitee.data.inviterId === inviterId) {
      return apiError(ResponseCode.CONFLICT, '已接受过该邀请');
    }
    return apiError(ResponseCode.CONFLICT, '该账号已绑定其他邀请关系');
  }

  // 防重复：同一对邀请关系只记录一次
  const existing = await col.where({ inviterId, inviteeId: userId }).getOne();
  if (existing.data) {
    return apiError(ResponseCode.CONFLICT, '已接受过该邀请');
  }

  // 记录邀请关系
  await col.add({
    inviterId,
    inviteeId: userId,
    status: 'accepted',
    createdAt: new Date()
  });

  // 更新邀请人的邀请计数（使用原子操作避免竞态条件）
  const inviterCol = db.collection('invite_stats');
  const updateResult = await inviterCol.where({ userId: inviterId }).update({ count: _.inc(1), updatedAt: new Date() });
  if (updateResult.updated === 0) {
    // 记录不存在，创建新记录
    await inviterCol.add({
      userId: inviterId,
      count: 1,
      claimedRewards: [],
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  logger.info(`[${requestId}] 邀请记录成功: ${inviterId} -> ${userId}`);
  return success(undefined, '邀请成功');
}

/**
 * 领取邀请奖励
 */
async function claimReward(userId: string, params: Record<string, unknown>, requestId: string) {
  const { threshold } = params;
  if (!threshold || typeof threshold !== 'number') {
    return badRequest('缺少奖励阈值');
  }

  const reward = INVITE_REWARDS.find((r) => r.threshold === threshold);
  if (!reward) {
    return badRequest('无效的奖励等级');
  }

  const col = db.collection('invite_stats');
  const stats = await col.where({ userId }).getOne();
  const data = stats.data as any;

  if (!data) {
    return badRequest('暂无邀请记录');
  }
  if (data.count < threshold) {
    return badRequest(`邀请人数不足，需要${threshold}人`);
  }

  // 原子领取：防止并发重复领取
  const claimResult = await col
    .where({
      userId,
      count: _.gte(threshold),
      claimedRewards: _.nin([threshold])
    })
    .update({
      claimedRewards: _.push(threshold),
      updatedAt: new Date()
    });

  if (!claimResult.updated) {
    return apiError(ResponseCode.CONFLICT, '该奖励已领取或条件不满足');
  }

  logger.info(`[${requestId}] 奖励领取成功: userId=${userId}, threshold=${threshold}, value=${reward.value}天`);
  return success({ reward }, '领取成功');
}

/**
 * 获取邀请信息
 */
async function getInviteInfo(userId: string, _params: Record<string, unknown>, requestId: string) {
  const col = db.collection('invite_stats');
  const stats = await col.where({ userId }).getOne();
  const data = (stats.data as any) || { count: 0, claimedRewards: [] };

  // 生成邀请码（基于 userId 的简单哈希）
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash = hash & hash;
  }
  const inviteCode = 'EX' + Math.abs(hash).toString(36).toUpperCase().padStart(6, '0');

  // 构建奖励列表（含领取状态）
  const rewards = INVITE_REWARDS.map((r) => ({
    ...r,
    claimed: (data.claimedRewards || []).includes(r.threshold),
    unlocked: data.count >= r.threshold
  }));

  logger.info(`[${requestId}] 获取邀请信息: count=${data.count}`);
  return success({
    inviteCode,
    count: data.count,
    rewards
  });
}
