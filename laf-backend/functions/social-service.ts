/**
 * 社交服务云函数 (Sealos 兼容版)
 *
 * 功能：
 * 1. 搜索用户 (search_user)
 * 2. 发送好友请求 (send_request)
 * 3. 处理好友请求 (handle_request)
 * 4. 获取好友列表 (get_friend_list)
 * 5. 获取好友请求列表 (get_friend_requests)
 * 6. 删除好友 (remove_friend)
 *
 * 请求参数：
 * - action: string (必填) - 操作类型
 * - 其他参数根据 action 不同而不同
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import {
  badRequest,
  unauthorized,
  serverError,
  validateUserId,
  sanitizeString,
  logger,
  generateRequestId,
  checkRateLimitDistributed
} from './_shared/api-response.js';

const db = cloud.database();
const _ = db.command;

const SOCIAL_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const SOCIAL_RATE_LIMIT_MAX = 60;

/** Escape user input for safe use in $regex (prevents ReDoS) */
function escapeRegex(str: string): string {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = generateRequestId();

  logger.info(`[${requestId}] 社交服务请求开始`);

  try {
    const { action, ...params } = ctx.body || {};

    if (!action || typeof action !== 'string' || action.length > 50) {
      return { ...badRequest('参数错误: action 不合法'), requestId };
    }

    // [R2-P0] JWT 认证：所有操作强制验证（读操作也涉及用户私有数据）
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return { ...authResult, requestId };
    }
    const userId = authResult.userId;

    // 限流
    const rateLimit = await checkRateLimitDistributed(
      `social-service:${userId}:${action}`,
      SOCIAL_RATE_LIMIT_MAX,
      SOCIAL_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return {
        code: 429,
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        requestId
      };
    }

    logger.info(`[${requestId}] action: ${action}, userId: ${userId}`);

    // 路由到对应处理函数
    const handlers = {
      search_user: handleSearchUser,
      send_request: handleSendRequest,
      handle_request: handleHandleRequest,
      get_friend_list: handleGetFriendList,
      get_friend_requests: handleGetFriendRequests,
      remove_friend: handleRemoveFriend
    };

    const handler = handlers[action];
    if (!handler) {
      return { ...badRequest(`不支持的操作: ${action}`), requestId };
    }

    const result = await handler(userId, params, requestId);

    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] 操作完成，耗时: ${duration}ms`);

    return { ...result, requestId, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[${requestId}] 社交服务异常:`, error);

    return { ...serverError('服务器内部错误'), requestId, duration };
  }
}

/**
 * 搜索用户 (优化版 - 数据库分页查询，避免内存过滤)
 */
async function handleSearchUser(userId, params, requestId) {
  const { keyword, page = 1, pageSize = 20 } = params;

  if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 2) {
    return { code: 400, success: false, message: '搜索关键词至少2个字符' };
  }

  // 清理搜索关键词
  const searchKeyword = sanitizeString(keyword, 50).toLowerCase();
  if (searchKeyword.length < 2) {
    return { code: 400, success: false, message: '搜索关键词包含非法字符' };
  }

  // 分页参数校验
  const safePage = Math.max(1, Math.min(Number(page) || 1, 100));
  const safePageSize = Math.max(1, Math.min(Number(pageSize) || 20, 50));

  const usersCollection = db.collection('users');

  // 优化：使用数据库正则查询代替内存过滤
  // MongoDB 原生 $regex 在 Sealos 环境下可用
  const query = usersCollection
    .where({
      _id: _.neq(userId),
      nickname: db.RegExp({
        regexp: escapeRegex(searchKeyword),
        options: 'i' // 不区分大小写
      })
    })
    .field({
      _id: true,
      nickname: true,
      avatar_url: true,
      streak_days: true,
      total_questions: true
    });

  // 分页查询，避免一次性加载大量数据到内存
  const [countRes, matchedUsers] = await Promise.all([
    usersCollection
      .where({
        _id: _.neq(userId),
        nickname: db.RegExp({ regexp: escapeRegex(searchKeyword), options: 'i' })
      })
      .count(),
    query
      .skip((safePage - 1) * safePageSize)
      .limit(safePageSize)
      .get()
  ]);

  const total = countRes.total || 0;

  logger.info(`[${requestId}] 搜索用户: ${keyword}, 找到 ${total} 个, 返回第 ${safePage} 页`);

  return {
    code: 0,
    success: true,
    data: {
      list: matchedUsers.data,
      total,
      page: safePage,
      pageSize: safePageSize,
      hasMore: safePage * safePageSize < total
    },
    message: `找到 ${total} 个用户`
  };
}

/**
 * 发送好友请求
 */
async function handleSendRequest(userId, params, requestId) {
  const { targetUid, message } = params;

  if (!validateUserId(userId)) {
    return { code: 401, success: false, message: '用户未登录' };
  }

  if (!validateUserId(targetUid)) {
    return { code: 400, success: false, message: '目标用户ID不合法' };
  }

  if (userId === targetUid) {
    return { code: 400, success: false, message: '不能添加自己为好友' };
  }

  const friendsCollection = db.collection('friends');
  const now = Date.now();

  // 检查是否已经是好友或已发送请求
  const existing = await friendsCollection
    .where(
      _.or([
        { user_id: userId, friend_id: targetUid },
        { user_id: targetUid, friend_id: userId }
      ])
    )
    .getOne();

  if (existing.data) {
    if (existing.data.status === 'accepted') {
      return { code: 400, success: false, message: '你们已经是好友了' };
    }
    if (existing.data.status === 'pending') {
      return { code: 400, success: false, message: '已发送过好友请求，请等待对方处理' };
    }
  }

  // 创建好友请求
  const friendRequest = {
    user_id: userId,
    friend_id: targetUid,
    status: 'pending',
    request_message: sanitizeString(message || '', 200),
    requester_id: userId,
    created_at: now,
    accepted_at: null
  };

  await friendsCollection.add(friendRequest);

  logger.info(`[${requestId}] 发送好友请求: ${userId} -> ${targetUid}`);

  return {
    code: 0,
    success: true,
    message: '好友请求已发送'
  };
}

/**
 * 处理好友请求
 */
async function handleHandleRequest(userId, params, requestId) {
  const { fromUid, requestAction } = params;

  if (!validateUserId(userId)) {
    return { code: 401, success: false, message: '用户未登录' };
  }

  if (!validateUserId(fromUid) || !requestAction) {
    return { code: 400, success: false, message: '参数不完整' };
  }

  if (!['accept', 'reject'].includes(requestAction)) {
    return { code: 400, success: false, message: '无效的操作类型' };
  }

  const friendsCollection = db.collection('friends');
  const now = Date.now();

  // 查找好友请求
  const request = await friendsCollection
    .where({
      user_id: fromUid,
      friend_id: userId,
      status: 'pending'
    })
    .getOne();

  if (!request.data) {
    return { code: 404, success: false, message: '好友请求不存在或已处理' };
  }

  if (requestAction === 'accept') {
    // [H-07 FIX] 原子条件更新：只有 status='pending' 时才更新为 accepted
    // 防止并发请求导致重复接受和重复创建反向关系
    const updateResult = await friendsCollection
      .where({
        _id: request.data._id,
        status: 'pending'
      })
      .update({
        status: 'accepted',
        accepted_at: now
      });

    // 如果 updated === 0，说明已被其他并发请求处理
    if (!updateResult.updated) {
      return { code: 409, success: false, message: '好友请求已被处理' };
    }

    // 创建反向关系
    await friendsCollection.add({
      user_id: userId,
      friend_id: fromUid,
      status: 'accepted',
      request_message: '',
      requester_id: fromUid,
      created_at: now,
      accepted_at: now
    });

    logger.info(`[${requestId}] 接受好友请求: ${fromUid} <-> ${userId}`);

    return { code: 0, success: true, message: '已添加好友' };
  } else {
    // 拒绝请求
    await friendsCollection.doc(request.data._id).update({
      status: 'rejected'
    });

    logger.info(`[${requestId}] 拒绝好友请求: ${fromUid} -> ${userId}`);

    return { code: 0, success: true, message: '已拒绝请求' };
  }
}

/**
 * 获取好友列表
 */
async function handleGetFriendList(userId, params, requestId) {
  if (!validateUserId(userId)) {
    return { code: 401, success: false, message: '用户未登录', data: [] };
  }

  const { sortBy } = params;
  const friendsCollection = db.collection('friends');
  const usersCollection = db.collection('users');

  // 获取好友关系
  const friendships = await friendsCollection
    .where({
      user_id: userId,
      status: 'accepted'
    })
    .limit(200)
    .get();

  if (friendships.data.length === 0) {
    return { code: 0, success: true, data: [], message: '暂无好友' };
  }

  // 获取好友详细信息
  const friendIds = friendships.data.map((f) => f.friend_id);
  const friends = await usersCollection
    .where({
      _id: _.in(friendIds)
    })
    .field({
      _id: true,
      nickname: true,
      avatar_url: true,
      streak_days: true,
      total_questions: true,
      correct_questions: true,
      last_study_date: true
    })
    .get();

  // 合并数据
  let friendList = friends.data.map((friend) => {
    const friendship = friendships.data.find((f) => f.friend_id === friend._id);
    return {
      ...friend,
      added_at: friendship?.accepted_at || friendship?.created_at,
      accuracy: friend.total_questions > 0 ? Math.round((friend.correct_questions / friend.total_questions) * 100) : 0
    };
  });

  // 排序
  if (sortBy === 'score') {
    friendList.sort((a, b) => b.total_questions - a.total_questions);
  } else if (sortBy === 'active') {
    friendList.sort((a, b) => b.streak_days - a.streak_days);
  } else {
    friendList.sort((a, b) => (b.added_at || 0) - (a.added_at || 0));
  }

  logger.info(`[${requestId}] 获取好友列表: ${friendList.length} 个`);

  return {
    code: 0,
    success: true,
    data: friendList,
    message: '获取成功'
  };
}

/**
 * 获取好友请求列表
 */
async function handleGetFriendRequests(userId, params, requestId) {
  if (!validateUserId(userId)) {
    return { code: 401, success: false, message: '用户未登录', data: [] };
  }

  const friendsCollection = db.collection('friends');
  const usersCollection = db.collection('users');

  // 获取待处理的好友请求
  const requests = await friendsCollection
    .where({
      friend_id: userId,
      status: 'pending'
    })
    .orderBy('created_at', 'desc')
    .limit(100)
    .get();

  if (requests.data.length === 0) {
    return { code: 0, success: true, data: [], message: '暂无好友请求' };
  }

  // 获取请求者信息
  const requesterIds = requests.data.map((r) => r.user_id);
  const requesters = await usersCollection
    .where({
      _id: _.in(requesterIds)
    })
    .field({
      _id: true,
      nickname: true,
      avatar_url: true,
      streak_days: true
    })
    .get();

  // 合并数据
  const requestList = requests.data.map((request) => {
    const requester = requesters.data.find((u) => u._id === request.user_id);
    return {
      ...request,
      requester_info: requester || { nickname: '未知用户' }
    };
  });

  logger.info(`[${requestId}] 获取好友请求: ${requestList.length} 个`);

  return {
    code: 0,
    success: true,
    data: requestList,
    message: '获取成功'
  };
}

/**
 * 删除好友
 */
async function handleRemoveFriend(userId, params, requestId) {
  const { friendUid } = params;

  if (!validateUserId(userId)) {
    return { code: 401, success: false, message: '用户未登录' };
  }

  if (!validateUserId(friendUid)) {
    return { code: 400, success: false, message: '好友ID不合法' };
  }

  const friendsCollection = db.collection('friends');

  // 删除双向好友关系
  await friendsCollection
    .where(
      _.or([
        { user_id: userId, friend_id: friendUid },
        { user_id: friendUid, friend_id: userId }
      ])
    )
    .remove();

  logger.info(`[${requestId}] 删除好友: ${userId} <-> ${friendUid}`);

  return {
    code: 0,
    success: true,
    message: '已删除好友'
  };
}
