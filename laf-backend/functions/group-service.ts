/**
 * 学习小组服务云函数
 *
 * 功能：
 * 1. 创建小组 (create_group)
 * 2. 加入小组 (join_group)
 * 3. 获取小组列表 (get_groups)
 * 4. 获取小组详情 (get_group_detail)
 * 5. 离开小组 (leave_group)
 * 6. 管理小组成员 (manage_member)
 * 7. 分享资源 (share_resource)
 * 8. 获取资源列表 (get_resources)
 *
 * 请求参数：
 * - action: string (必填) - 操作类型
 * - 其他参数根据 action 不同而不同
 */

import cloud from '@lafjs/cloud';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import { sanitizeString, checkRateLimitDistributed, tooManyRequests } from './_shared/api-response.js';

const db = cloud.database();
const _ = db.command;

// ==================== 环境配置 ====================
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'warn' : 'info');

// ==================== 日志工具 ====================
const logger = {
  info: (...args) => {
    if (LOG_LEVEL !== 'warn' && LOG_LEVEL !== 'error') console.log(...args);
  },
  warn: (...args) => {
    if (LOG_LEVEL !== 'error') console.warn(...args);
  },
  error: (...args) => console.error(...args)
};

// ==================== 常量定义 ====================
const GROUP_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  PENDING: 'pending'
};

const MEMBER_ROLE = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member'
};

const RESOURCE_TYPE = {
  NOTE: 'note',
  MATERIAL: 'material',
  EXPERIENCE: 'experience',
  OTHER: 'other'
};

// ==================== 工具函数 ====================

/**
 * 验证用户ID
 */
function validateUserId(userId) {
  return userId && typeof userId === 'string' && userId.trim().length > 0;
}

/**
 * 生成唯一ID
 */
function generateId(prefix = '') {
  return `${prefix}${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * 验证小组名称
 */
function validateGroupName(name) {
  return name && typeof name === 'string' && name.trim().length >= 2 && name.trim().length <= 50;
}

// ==================== 处理函数 ====================

/**
 * 创建小组
 */
async function handleCreateGroup(userId, params, requestId) {
  if (!validateUserId(userId)) {
    return { code: 401, success: false, message: '用户未登录', data: null };
  }

  const { name, description, avatar, tags = [], maxMembers = 50 } = params;

  if (!validateGroupName(name)) {
    return { code: 400, success: false, message: '小组名称长度应在2-50个字符之间', data: null };
  }

  try {
    const groupId = generateId('group_');
    // [H-02 FIX] XSS sanitization — 对用户输入做消毒处理
    const group = {
      _id: groupId,
      name: sanitizeString(name.trim(), 50),
      description: sanitizeString(description?.trim() || '', 500),
      avatar: avatar || '',
      tags: Array.isArray(tags) ? tags.slice(0, 20).map((t: string) => sanitizeString(String(t), 50)) : [],
      max_members: Math.min(Math.max(2, maxMembers), 100),
      member_count: 1,
      status: GROUP_STATUS.ACTIVE,
      created_by: userId,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    // 创建小组
    await db.collection('groups').add(group);

    // 添加创建者为成员
    await db.collection('group_members').add({
      _id: generateId('member_'),
      group_id: groupId,
      user_id: userId,
      role: MEMBER_ROLE.OWNER,
      joined_at: Date.now(),
      status: 'active'
    });

    logger.info(`[${requestId}] 创建小组成功:`, groupId, name);

    return {
      code: 0,
      success: true,
      message: '小组创建成功',
      data: { group_id: groupId, ...group }
    };
  } catch (error) {
    logger.error(`[${requestId}] 创建小组失败:`, error);
    // P015: 错误分类
    const errMsg = error.message || '';
    const code =
      errMsg.includes('duplicate') || errMsg.includes('已存在')
        ? 409
        : errMsg.includes('参数') || errMsg.includes('validation')
          ? 400
          : errMsg.includes('timeout')
            ? 504
            : 500;
    return {
      code,
      success: false,
      message:
        code === 409
          ? '小组已存在'
          : code === 400
            ? '请求参数错误'
            : code === 504
              ? '请求超时，请稍后重试'
              : '创建小组失败，请稍后重试'
    };
  }
}

/**
 * 加入小组
 */
async function handleJoinGroup(userId, params, requestId) {
  if (!validateUserId(userId)) {
    return { code: 401, success: false, message: '用户未登录', data: null };
  }

  const { groupId } = params;

  if (!groupId) {
    return { code: 400, success: false, message: '小组ID不能为空', data: null };
  }

  try {
    // 检查小组是否存在
    const group = await db.collection('groups').doc(groupId).get();
    if (!group.data) {
      return { code: 404, success: false, message: '小组不存在', data: null };
    }

    // 检查是否已经是成员
    const existingMember = await db.collection('group_members').where({ group_id: groupId, user_id: userId }).get();

    if (existingMember.data.length > 0) {
      return { code: 400, success: false, message: '您已经是该小组成员', data: null };
    }

    // ✅ P0修复：原子条件更新 — 先尝试递增 member_count（仅当未满时成功）
    const incrementResult = await db
      .collection('groups')
      .where({
        _id: groupId,
        member_count: _.lt(group.data.max_members)
      })
      .update({
        member_count: _.inc(1),
        updated_at: Date.now()
      });

    if (incrementResult.updated === 0) {
      return { code: 400, success: false, message: '小组已满员', data: null };
    }

    // 原子递增成功后再添加成员记录
    try {
      await db.collection('group_members').add({
        _id: generateId('member_'),
        group_id: groupId,
        user_id: userId,
        role: MEMBER_ROLE.MEMBER,
        joined_at: Date.now(),
        status: 'active'
      });
    } catch (addError) {
      // 成员添加失败，回滚计数
      await db
        .collection('groups')
        .doc(groupId)
        .update({ member_count: _.inc(-1) });
      throw addError;
    }

    logger.info(`[${requestId}] 加入小组成功:`, userId, groupId);

    return {
      code: 0,
      success: true,
      message: '加入小组成功',
      data: { group_id: groupId, group_name: group.data.name }
    };
  } catch (error) {
    logger.error(`[${requestId}] 加入小组失败:`, error);
    return {
      code: 500,
      success: false,
      message: '加入小组失败'
    };
  }
}

/**
 * 获取小组列表
 */
async function handleGetGroups(userId, params, requestId) {
  if (!validateUserId(userId)) {
    return { code: 401, success: false, message: '用户未登录', data: [] };
  }

  const { page = 1, pageSize = 20, type = 'all' } = params;
  // [H-03 FIX] pageSize 上限校验，防止客户端请求过大导出整个集合
  const safePageSize = Math.min(Math.max(1, pageSize), 50);

  try {
    const collection = db.collection('groups');
    let whereCondition: Record<string, any> = {};

    if (type === 'joined') {
      // 获取用户加入的小组
      const memberGroups = await db.collection('group_members').where({ user_id: userId, status: 'active' }).get();

      const groupIds = memberGroups.data.map((m) => m.group_id);
      if (groupIds.length > 0) {
        whereCondition = { _id: _.in(groupIds) };
      } else {
        return { code: 0, success: true, data: [], message: '暂无小组', total: 0 };
      }
    }

    // 并行查询总数和分页数据，每次从 collection.where() 构建独立查询链
    const [countResult, groups] = await Promise.all([
      collection.where(whereCondition).count(),
      collection
        .where(whereCondition)
        .orderBy('created_at', 'desc')
        .skip((page - 1) * safePageSize)
        .limit(safePageSize)
        .get()
    ]);
    const total = countResult.total;

    logger.info(`[${requestId}] 获取小组列表:`, groups.data.length, '个');

    return {
      code: 0,
      success: true,
      data: groups.data,
      message: '获取成功',
      total
    };
  } catch (error) {
    logger.error(`[${requestId}] 获取小组列表失败:`, error);
    return {
      code: 500,
      success: false,
      message: '获取小组列表失败',
      data: []
    };
  }
}

/**
 * 获取小组详情
 */
async function handleGetGroupDetail(userId, params, requestId) {
  if (!validateUserId(userId)) {
    return { code: 401, success: false, message: '用户未登录', data: null };
  }

  const { groupId } = params;

  if (!groupId) {
    return { code: 400, success: false, message: '小组ID不能为空', data: null };
  }

  try {
    // 获取小组信息
    const group = await db.collection('groups').doc(groupId).get();
    if (!group.data) {
      return { code: 404, success: false, message: '小组不存在', data: null };
    }

    // 获取小组成员
    const members = await db.collection('group_members').where({ group_id: groupId, status: 'active' }).get();

    // 检查当前用户是否是成员
    const currentMember = members.data.find((m) => m.user_id === userId);

    // 非成员仅返回公开信息，避免泄露成员隐私
    if (!currentMember) {
      logger.info(`[${requestId}] 非成员访问小组详情，返回脱敏数据:`, groupId);
      return {
        code: 0,
        success: true,
        data: {
          ...group.data,
          members: [],
          is_member: false,
          member_role: null
        },
        message: '获取成功'
      };
    }

    // 获取成员详细信息（仅成员可见）
    const memberIds = members.data.map((m) => m.user_id);
    let memberDetails = [];
    if (memberIds.length > 0) {
      const users = await db
        .collection('users')
        .where({ _id: _.in(memberIds) })
        .field({
          _id: true,
          nickname: true,
          avatar_url: true,
          streak_days: true,
          total_questions: true
        })
        .get();

      memberDetails = members.data.map((member) => {
        const user = users.data.find((u) => u._id === member.user_id);
        return {
          ...member,
          user_info: user || { nickname: '未知用户' }
        };
      });
    }

    logger.info(`[${requestId}] 获取小组详情:`, groupId, '成员数:', members.data.length);

    return {
      code: 0,
      success: true,
      data: {
        ...group.data,
        members: memberDetails,
        is_member: !!currentMember,
        member_role: currentMember?.role || null
      },
      message: '获取成功'
    };
  } catch (error) {
    logger.error(`[${requestId}] 获取小组详情失败:`, error);
    return {
      code: 500,
      success: false,
      message: '获取小组详情失败',
      data: null
    };
  }
}

/**
 * 离开小组
 */
async function handleLeaveGroup(userId, params, requestId) {
  if (!validateUserId(userId)) {
    return { code: 401, success: false, message: '用户未登录', data: null };
  }

  const { groupId } = params;

  if (!groupId) {
    return { code: 400, success: false, message: '小组ID不能为空', data: null };
  }

  try {
    // 获取小组信息
    const group = await db.collection('groups').doc(groupId).get();
    if (!group.data) {
      return { code: 404, success: false, message: '小组不存在', data: null };
    }

    // 检查是否是成员
    const member = await db
      .collection('group_members')
      .where({ group_id: groupId, user_id: userId, status: 'active' })
      .get();

    if (member.data.length === 0) {
      return { code: 403, success: false, message: '您不是该小组成员', data: null };
    }

    // 检查是否是群主
    if (member.data[0].role === MEMBER_ROLE.OWNER) {
      return { code: 403, success: false, message: '群主不能离开小组，请先转让群主身份', data: null };
    }

    // 更新成员状态
    await db.collection('group_members').doc(member.data[0]._id).update({
      status: 'left',
      left_at: Date.now()
    });

    // 更新小组成员数（原子递减）
    await db
      .collection('groups')
      .doc(groupId)
      .update({
        member_count: _.inc(-1),
        updated_at: Date.now()
      });

    logger.info(`[${requestId}] 离开小组成功:`, userId, groupId);

    return {
      code: 0,
      success: true,
      message: '离开小组成功',
      data: { group_id: groupId }
    };
  } catch (error) {
    logger.error(`[${requestId}] 离开小组失败:`, error);
    return {
      code: 500,
      success: false,
      message: '离开小组失败',
      data: null
    };
  }
}

/**
 * 分享资源
 */
async function handleShareResource(userId, params, requestId) {
  if (!validateUserId(userId)) {
    return { code: 401, success: false, message: '用户未登录', data: null };
  }

  const { groupId, title, content, resourceType = 'note', fileUrl = '', tags = [] } = params;

  if (!groupId || !title) {
    return { code: 400, success: false, message: '小组ID和资源标题不能为空', data: null };
  }

  try {
    // 检查是否是小组成员
    const member = await db
      .collection('group_members')
      .where({ group_id: groupId, user_id: userId, status: 'active' })
      .get();

    if (member.data.length === 0) {
      return { code: 403, success: false, message: '您不是该小组成员', data: null };
    }

    // 创建资源
    const resourceId = generateId('resource_');
    const resource = {
      _id: resourceId,
      group_id: groupId,
      user_id: userId,
      title: title.trim(),
      content: content?.trim() || '',
      resource_type: RESOURCE_TYPE[resourceType] || RESOURCE_TYPE.NOTE,
      file_url: fileUrl || '',
      tags: Array.isArray(tags) ? tags : [],
      likes_count: 0,
      comments_count: 0,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    await db.collection('group_resources').add(resource);

    logger.info(`[${requestId}] 分享资源成功:`, resourceId, title);

    return {
      code: 0,
      success: true,
      message: '分享资源成功',
      data: resource
    };
  } catch (error) {
    logger.error(`[${requestId}] 分享资源失败:`, error);
    return {
      code: 500,
      success: false,
      message: '分享资源失败',
      data: null
    };
  }
}

/**
 * 获取资源列表
 */
async function handleGetResources(userId, params, requestId) {
  if (!validateUserId(userId)) {
    return { code: 401, success: false, message: '用户未登录', data: [] };
  }

  const { groupId, page = 1, pageSize = 20, type = 'all' } = params;
  // [H-03 FIX] pageSize 上限校验
  const safePageSize = Math.min(Math.max(1, pageSize), 50);

  if (!groupId) {
    return { code: 400, success: false, message: '小组ID不能为空', data: [] };
  }

  try {
    // 检查是否是小组成员
    const member = await db
      .collection('group_members')
      .where({ group_id: groupId, user_id: userId, status: 'active' })
      .get();

    if (member.data.length === 0) {
      return { code: 403, success: false, message: '您不是该小组成员', data: [] };
    }

    const collection = db.collection('group_resources');
    const whereCondition: Record<string, any> = { group_id: groupId };

    if (type !== 'all') {
      whereCondition.resource_type = type;
    }

    // 并行查询总数和分页数据，每次从 collection.where() 构建独立查询链
    const [countResult, resources] = await Promise.all([
      collection.where(whereCondition).count(),
      collection
        .where(whereCondition)
        .orderBy('created_at', 'desc')
        .skip((page - 1) * safePageSize)
        .limit(safePageSize)
        .get()
    ]);
    const total = countResult.total;

    // 获取用户信息
    const userIds = [...new Set(resources.data.map((r) => r.user_id))];
    const userDetails = {};
    if (userIds.length > 0) {
      const users = await db
        .collection('users')
        .where({ _id: _.in(userIds) })
        .field({
          _id: true,
          nickname: true,
          avatar_url: true
        })
        .get();

      users.data.forEach((user) => {
        userDetails[user._id] = user;
      });
    }

    // 丰富资源信息
    const resourcesWithUser = resources.data.map((resource) => ({
      ...resource,
      user_info: userDetails[resource.user_id] || { nickname: '未知用户' }
    }));

    logger.info(`[${requestId}] 获取资源列表:`, resources.data.length, '个');

    return {
      code: 0,
      success: true,
      data: resourcesWithUser,
      message: '获取成功',
      total
    };
  } catch (error) {
    logger.error(`[${requestId}] 获取资源列表失败:`, error);
    return {
      code: 500,
      success: false,
      message: '获取资源列表失败',
      data: []
    };
  }
}

// ==================== 主函数 ====================
export default async function (ctx) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  logger.info(`[${requestId}] 学习小组服务请求开始`);

  try {
    const { action, ...params } = ctx.body || {};

    // 统一认证中间件验证
    const authResult = requireAuth(ctx);
    if (isAuthError(authResult)) {
      return { ...authResult, requestId };
    }
    const userId = authResult.userId;

    // 客户端声明的 userId 一致性校验（防止越权）
    const claimedUserId = ctx.headers?.['x-user-id'] || params.userId;
    if (claimedUserId && userId !== claimedUserId) {
      return { code: 403, success: false, message: '身份验证失败：用户不匹配', requestId };
    }

    if (!action) {
      return { code: 400, success: false, message: '参数错误: action 不能为空', requestId };
    }

    logger.info(`[${requestId}] action: ${action}, userId: ${userId}`);

    // 写操作频率限制：10次/分钟/用户
    const writeActions = ['create_group', 'join_group', 'share_resource'];
    if (writeActions.includes(action)) {
      const rateLimitResult = await checkRateLimitDistributed(`group_write_${userId}`, 10, 60000);
      if (!rateLimitResult.allowed) {
        return { ...tooManyRequests('请求过于频繁，请稍后再试'), requestId };
      }
    }

    // 路由到对应处理函数
    const handlers = {
      create_group: handleCreateGroup,
      join_group: handleJoinGroup,
      get_groups: handleGetGroups,
      get_group_detail: handleGetGroupDetail,
      leave_group: handleLeaveGroup,
      share_resource: handleShareResource,
      get_resources: handleGetResources
    };

    const handler = handlers[action];
    if (!handler) {
      return { code: 400, success: false, message: `不支持的操作: ${action}`, requestId };
    }

    const result = await handler(userId, params, requestId);

    const duration = Date.now() - startTime;
    logger.info(`[${requestId}] 操作完成，耗时: ${duration}ms`);

    return { ...result, requestId, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error(`[${requestId}] 学习小组服务异常:`, error);

    return {
      code: 500,
      success: false,
      message: '服务异常，请稍后重试',
      requestId,
      duration
    };
  }
}
