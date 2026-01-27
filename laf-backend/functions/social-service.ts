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

import cloud from '@lafjs/cloud'

const db = cloud.database()
const _ = db.command

export default async function (ctx) {
  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  console.log(`[${requestId}] 社交服务请求开始`)

  try {
    const { action, ...params } = ctx.body || {}

    // 获取用户ID（从请求头或请求体）
    const userId = ctx.headers?.['x-user-id'] || params.userId

    if (!action) {
      return { code: 400, success: false, message: '参数错误: action 不能为空', requestId }
    }

    console.log(`[${requestId}] action: ${action}, userId: ${userId}`)

    // 路由到对应处理函数
    const handlers = {
      search_user: handleSearchUser,
      send_request: handleSendRequest,
      handle_request: handleHandleRequest,
      get_friend_list: handleGetFriendList,
      get_friend_requests: handleGetFriendRequests,
      remove_friend: handleRemoveFriend
    }

    const handler = handlers[action]
    if (!handler) {
      return { code: 400, success: false, message: `不支持的操作: ${action}`, requestId }
    }

    const result = await handler(userId, params, requestId)

    const duration = Date.now() - startTime
    console.log(`[${requestId}] 操作完成，耗时: ${duration}ms`)

    return { ...result, requestId, duration }

  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[${requestId}] 社交服务异常:`, error)

    return {
      code: 500,
      success: false,
      message: '服务器内部错误',
      error: error.message,
      requestId,
      duration
    }
  }
}

/**
 * 搜索用户 (Sealos 兼容版 - 使用内存过滤代替正则)
 */
async function handleSearchUser(userId, params, requestId) {
  const { keyword } = params

  if (!keyword || keyword.trim().length < 2) {
    return { code: 400, success: false, message: '搜索关键词至少2个字符' }
  }

  const usersCollection = db.collection('users')
  const searchKeyword = keyword.trim().toLowerCase()

  // 获取所有用户（限制数量），然后在内存中过滤
  // 这是为了兼容 Sealos，因为 _.regex 是 Laf 特有语法
  const allUsers = await usersCollection
    .where({
      _id: _.neq(userId)
    })
    .field({
      _id: true,
      nickname: true,
      avatar_url: true,
      streak_days: true,
      total_questions: true
    })
    .limit(500)
    .get()

  // 在内存中进行模糊搜索
  const matchedUsers = allUsers.data.filter(user => {
    const nickname = (user.nickname || '').toLowerCase()
    return nickname.includes(searchKeyword)
  }).slice(0, 20)

  console.log(`[${requestId}] 搜索用户: ${keyword}, 找到 ${matchedUsers.length} 个`)

  return {
    code: 0,
    success: true,
    data: matchedUsers,
    message: `找到 ${matchedUsers.length} 个用户`
  }
}

/**
 * 发送好友请求
 */
async function handleSendRequest(userId, params, requestId) {
  const { targetUid, message } = params

  if (!userId) {
    return { code: 401, success: false, message: '用户未登录' }
  }

  if (!targetUid) {
    return { code: 400, success: false, message: '目标用户ID不能为空' }
  }

  if (userId === targetUid) {
    return { code: 400, success: false, message: '不能添加自己为好友' }
  }

  const friendsCollection = db.collection('friends')
  const now = Date.now()

  // 检查是否已经是好友或已发送请求
  const existing = await friendsCollection.where(_.or([
    { user_id: userId, friend_id: targetUid },
    { user_id: targetUid, friend_id: userId }
  ])).getOne()

  if (existing.data) {
    if (existing.data.status === 'accepted') {
      return { code: 400, success: false, message: '你们已经是好友了' }
    }
    if (existing.data.status === 'pending') {
      return { code: 400, success: false, message: '已发送过好友请求，请等待对方处理' }
    }
  }

  // 创建好友请求
  const friendRequest = {
    user_id: userId,
    friend_id: targetUid,
    status: 'pending',
    request_message: message || '',
    requester_id: userId,
    created_at: now,
    accepted_at: null
  }

  await friendsCollection.add(friendRequest)

  console.log(`[${requestId}] 发送好友请求: ${userId} -> ${targetUid}`)

  return {
    code: 0,
    success: true,
    message: '好友请求已发送'
  }
}

/**
 * 处理好友请求
 */
async function handleHandleRequest(userId, params, requestId) {
  const { fromUid, requestAction } = params

  if (!userId) {
    return { code: 401, success: false, message: '用户未登录' }
  }

  if (!fromUid || !requestAction) {
    return { code: 400, success: false, message: '参数不完整' }
  }

  if (!['accept', 'reject'].includes(requestAction)) {
    return { code: 400, success: false, message: '无效的操作类型' }
  }

  const friendsCollection = db.collection('friends')
  const now = Date.now()

  // 查找好友请求
  const request = await friendsCollection.where({
    user_id: fromUid,
    friend_id: userId,
    status: 'pending'
  }).getOne()

  if (!request.data) {
    return { code: 404, success: false, message: '好友请求不存在或已处理' }
  }

  if (requestAction === 'accept') {
    // 接受请求：更新状态并创建双向关系
    await friendsCollection.doc(request.data._id).update({
      status: 'accepted',
      accepted_at: now
    })

    // 创建反向关系
    await friendsCollection.add({
      user_id: userId,
      friend_id: fromUid,
      status: 'accepted',
      request_message: '',
      requester_id: fromUid,
      created_at: now,
      accepted_at: now
    })

    console.log(`[${requestId}] 接受好友请求: ${fromUid} <-> ${userId}`)

    return { code: 0, success: true, message: '已添加好友' }
  } else {
    // 拒绝请求
    await friendsCollection.doc(request.data._id).update({
      status: 'rejected'
    })

    console.log(`[${requestId}] 拒绝好友请求: ${fromUid} -> ${userId}`)

    return { code: 0, success: true, message: '已拒绝请求' }
  }
}

/**
 * 获取好友列表
 */
async function handleGetFriendList(userId, params, requestId) {
  if (!userId) {
    return { code: 401, success: false, message: '用户未登录', data: [] }
  }

  const { sortBy } = params
  const friendsCollection = db.collection('friends')
  const usersCollection = db.collection('users')

  // 获取好友关系
  const friendships = await friendsCollection.where({
    user_id: userId,
    status: 'accepted'
  }).get()

  if (friendships.data.length === 0) {
    return { code: 0, success: true, data: [], message: '暂无好友' }
  }

  // 获取好友详细信息
  const friendIds = friendships.data.map(f => f.friend_id)
  const friends = await usersCollection.where({
    _id: _.in(friendIds)
  }).field({
    _id: true,
    nickname: true,
    avatar_url: true,
    streak_days: true,
    total_questions: true,
    correct_questions: true,
    last_study_date: true
  }).get()

  // 合并数据
  let friendList = friends.data.map(friend => {
    const friendship = friendships.data.find(f => f.friend_id === friend._id)
    return {
      ...friend,
      added_at: friendship?.accepted_at || friendship?.created_at,
      accuracy: friend.total_questions > 0
        ? Math.round((friend.correct_questions / friend.total_questions) * 100)
        : 0
    }
  })

  // 排序
  if (sortBy === 'score') {
    friendList.sort((a, b) => b.total_questions - a.total_questions)
  } else if (sortBy === 'active') {
    friendList.sort((a, b) => b.streak_days - a.streak_days)
  } else {
    friendList.sort((a, b) => (b.added_at || 0) - (a.added_at || 0))
  }

  console.log(`[${requestId}] 获取好友列表: ${friendList.length} 个`)

  return {
    code: 0,
    success: true,
    data: friendList,
    message: '获取成功'
  }
}

/**
 * 获取好友请求列表
 */
async function handleGetFriendRequests(userId, params, requestId) {
  if (!userId) {
    return { code: 401, success: false, message: '用户未登录', data: [] }
  }

  const friendsCollection = db.collection('friends')
  const usersCollection = db.collection('users')

  // 获取待处理的好友请求
  const requests = await friendsCollection.where({
    friend_id: userId,
    status: 'pending'
  }).orderBy('created_at', 'desc').get()

  if (requests.data.length === 0) {
    return { code: 0, success: true, data: [], message: '暂无好友请求' }
  }

  // 获取请求者信息
  const requesterIds = requests.data.map(r => r.user_id)
  const requesters = await usersCollection.where({
    _id: _.in(requesterIds)
  }).field({
    _id: true,
    nickname: true,
    avatar_url: true,
    streak_days: true
  }).get()

  // 合并数据
  const requestList = requests.data.map(request => {
    const requester = requesters.data.find(u => u._id === request.user_id)
    return {
      ...request,
      requester_info: requester || { nickname: '未知用户' }
    }
  })

  console.log(`[${requestId}] 获取好友请求: ${requestList.length} 个`)

  return {
    code: 0,
    success: true,
    data: requestList,
    message: '获取成功'
  }
}

/**
 * 删除好友
 */
async function handleRemoveFriend(userId, params, requestId) {
  const { friendUid } = params

  if (!userId) {
    return { code: 401, success: false, message: '用户未登录' }
  }

  if (!friendUid) {
    return { code: 400, success: false, message: '好友ID不能为空' }
  }

  const friendsCollection = db.collection('friends')

  // 删除双向好友关系
  await friendsCollection.where(_.or([
    { user_id: userId, friend_id: friendUid },
    { user_id: friendUid, friend_id: userId }
  ])).remove()

  console.log(`[${requestId}] 删除好友: ${userId} <-> ${friendUid}`)

  return {
    code: 0,
    success: true,
    message: '已删除好友'
  }
}
