/**
 * 学习资源推荐云函数
 *
 * 功能：
 * 1. 获取推荐资源 (getRecommendations)
 * 2. 获取热门资源 (getHotResources)
 * 3. 按分类获取资源 (getByCategory)
 * 4. 搜索资源 (search)
 * 5. 收藏资源 (favorite)
 * 6. 获取用户收藏的资源 (getUserFavorites)
 * 7. 记录学习进度 (recordProgress)
 * 8. 获取学习统计 (getStats)
 *
 * B023: 已将所有 mock 数据替换为真实数据库查询
 *
 * @version 2.0.0
 */

import cloud from '@lafjs/cloud';
import { validate } from './_shared/validator.js';
import { requireAuth, isAuthError } from './_shared/auth-middleware.js';
import { checkRateLimit, createLogger } from './_shared/api-response.js'; // 本地限流（单实例部署场景足够）

const db = cloud.database();
const _ = db.command;

// ==================== 配置 ====================
const CONFIG = {
  maxRecommendations: 20,
  maxHotResources: 50,
  defaultPageSize: 20,
  maxPageSize: 50
};

// 资源分类（用于 enrichment 和 getCategories 接口）
const RESOURCE_CATEGORIES = {
  video: { name: '视频课程', icon: '🎬', color: '#FF5722' },
  article: { name: '文章教程', icon: '📄', color: '#2196F3' },
  book: { name: '电子书籍', icon: '📚', color: '#4CAF50' },
  practice: { name: '练习题库', icon: '📝', color: '#9C27B0' },
  tool: { name: '学习工具', icon: '🛠️', color: '#FF9800' },
  community: { name: '学习社区', icon: '👥', color: '#00BCD4' }
};

// 学科分类
const SUBJECTS = {
  politics: { name: '政治', icon: '📕' },
  english: { name: '英语', icon: '📘' },
  math: { name: '数学', icon: '📗' },
  professional: { name: '专业课', icon: '📙' }
};

const CATEGORY_KEYS = Object.keys(RESOURCE_CATEGORIES);
const SUBJECT_KEYS = Object.keys(SUBJECTS);

// ==================== 日志工具 ====================
const logger = createLogger('[LearningResource]');

function extractClientIp(ctx: any): string {
  const xRealIp = ctx?.headers?.['x-real-ip'];
  const forwarded = ctx?.headers?.['x-forwarded-for'];
  const cfIp = ctx?.headers?.['cf-connecting-ip'];
  const candidate = xRealIp || cfIp || forwarded || 'unknown';

  if (typeof candidate !== 'string') return 'unknown';
  const firstIp = candidate.split(',')[0].trim();
  return firstIp || 'unknown';
}

function toSafeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toPositiveInt(value: unknown, fallback: number, max: number): number {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function toNonNegativeNumber(value: unknown, fallback = 0, max = Number.MAX_SAFE_INTEGER): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.min(n, max);
}

function normalizeCategory(value: unknown): string {
  const category = toSafeString(value);
  return CATEGORY_KEYS.includes(category) ? category : '';
}

function normalizeSubject(value: unknown): string {
  const subject = toSafeString(value);
  return SUBJECT_KEYS.includes(subject) ? subject : '';
}

// ==================== 主入口 ====================
export default async function (ctx) {
  const startTime = Date.now();
  const requestId = `lr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const { action, userId: requestUserId, data } = ctx.body || {};
    let userId = '';

    // S003: 入口参数校验
    const entryValidation = validate(
      { action },
      {
        action: {
          required: true,
          type: 'string',
          maxLength: 50,
          enum: [
            'getRecommendations',
            'getHotResources',
            'getByCategory',
            'search',
            'favorite',
            'getUserFavorites',
            'recordProgress',
            'getStats',
            'getCategories',
            'getSubjects'
          ]
        }
      }
    );
    if (!entryValidation.valid) {
      return { code: 400, success: false, message: entryValidation.errors[0], requestId };
    }

    // 需要用户身份的操作（读写都必须鉴权，防止越权读取）
    const authRequiredActions = ['favorite', 'getUserFavorites', 'recordProgress', 'getStats'];
    const authResult = requireAuth(ctx);
    const tokenPayload = isAuthError(authResult) ? null : authResult;

    if (authRequiredActions.includes(action)) {
      if (isAuthError(authResult)) {
        return { code: 401, success: false, message: authResult.message, requestId };
      }

      if (requestUserId && requestUserId !== tokenPayload.userId) {
        logger.warn(`[${requestId}] 检测到 userId 不匹配，已使用 token 用户ID`);
      }

      // 强制使用 token 解析出的 userId，防止 IDOR
      userId = tokenPayload.userId;
    } else if (tokenPayload?.userId) {
      // 非敏感操作可选携带 token，用于个性化推荐
      if (requestUserId && requestUserId !== tokenPayload.userId) {
        logger.warn(`[${requestId}] 非敏感操作检测到 userId 不匹配，已使用 token 用户ID`);
      }
      userId = tokenPayload.userId;
    } else if (requestUserId) {
      // 非敏感操作未认证时，不信任请求体 userId，避免伪造限流主体
      logger.warn(`[${requestId}] 非敏感操作忽略未认证 userId`);
    }

    logger.info(`[${requestId}] action: ${action}, userId: ${userId || 'anonymous'}`);

    // 频率限制：按 userId 或 IP 限流
    const clientIp = extractClientIp(ctx);
    const rateLimitKey = userId ? `lr_${userId}` : `lr_ip_${clientIp}`;
    const rateLimit = checkRateLimit(rateLimitKey, 60, 60000); // 60次/分钟
    if (!rateLimit.allowed) {
      return { code: 429, success: false, message: '请求过于频繁，请稍后再试', requestId };
    }

    // 搜索操作使用更严格的频率限制（正则查询开销大）
    if (action === 'search') {
      const searchRateLimitKey = userId ? `lr_search_${userId}` : `lr_search_ip_${clientIp}`;
      const searchRateLimit = checkRateLimit(searchRateLimitKey, 15, 60000); // 15次/分钟
      if (!searchRateLimit.allowed) {
        return { code: 429, success: false, message: '搜索过于频繁，请稍后再试', requestId };
      }
    }

    // 路由到对应处理函数
    const handlers = {
      getRecommendations: handleGetRecommendations,
      getHotResources: handleGetHotResources,
      getByCategory: handleGetByCategory,
      search: handleSearch,
      favorite: handleFavorite,
      getUserFavorites: handleGetUserFavorites,
      recordProgress: handleRecordProgress,
      getStats: handleGetStats,
      getCategories: handleGetCategories,
      getSubjects: handleGetSubjects
    };

    const handler = handlers[action];
    if (!handler) {
      return { code: 400, success: false, message: `不支持的操作: ${action}`, requestId };
    }

    const result = await handler(userId, data || {}, requestId);

    return {
      ...result,
      requestId,
      duration: Date.now() - startTime
    };
  } catch (error) {
    logger.error(`[${requestId}] 异常:`, error);
    return {
      code: 500,
      success: false,
      message: '服务器内部错误',
      requestId,
      duration: Date.now() - startTime
    };
  }
}

/**
 * 获取推荐资源
 * 按推荐权重和浏览量排序，支持按学科筛选
 */
async function handleGetRecommendations(userId: string, data: Record<string, unknown>, requestId: string) {
  const rawSubject = data.subject;
  const subject = normalizeSubject(rawSubject);
  const safeLimit = toPositiveInt(data.limit, 10, CONFIG.maxRecommendations);

  if (rawSubject && !subject) {
    return { code: 400, success: false, message: '参数错误: subject 无效' };
  }

  // 获取用户学习数据用于个性化推荐
  let userProfile = null;
  if (userId) {
    try {
      const profileRes = await db.collection('user_profiles').where({ user_id: userId }).getOne();
      userProfile = profileRes.data;
    } catch (e) {
      logger.warn(`[${requestId}] 获取用户画像失败:`, e);
    }
  }

  // 构建查询条件
  const query: Record<string, unknown> = { status: 'published' };
  if (subject) query.subject = subject;

  // 如果有用户画像，优先推荐用户偏好的学科
  // 未来可根据 userProfile.preferred_subjects 等字段做更精细的推荐
  const result = await db
    .collection('learning_resources')
    .where(query)
    .orderBy('recommend_weight', 'desc')
    .orderBy('view_count', 'desc')
    .limit(safeLimit)
    .get();

  const resources = enrichResources(result.data || []);

  logger.info(`[${requestId}] 推荐资源: ${resources.length} 条`);

  return {
    code: 0,
    success: true,
    data: {
      resources,
      personalized: !!userProfile
    },
    message: '获取成功'
  };
}

/**
 * 获取热门资源
 * 按浏览量排序，支持按分类和学科筛选
 */
async function handleGetHotResources(_userId: string, data: Record<string, unknown>, _requestId: string) {
  const rawCategory = data.category;
  const rawSubject = data.subject;
  const category = normalizeCategory(rawCategory);
  const subject = normalizeSubject(rawSubject);
  const period = toSafeString(data.period) || 'week';
  const safeLimit = toPositiveInt(data.limit, CONFIG.defaultPageSize, CONFIG.maxHotResources);

  if (rawCategory && !category) {
    return { code: 400, success: false, message: '参数错误: category 无效' };
  }
  if (rawSubject && !subject) {
    return { code: 400, success: false, message: '参数错误: subject 无效' };
  }

  const query: Record<string, unknown> = { status: 'published' };
  if (category) query.category = category;
  if (subject) query.subject = subject;

  // 按时间段筛选
  if (period === 'week') {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    query.updated_at = _.gte(weekAgo);
  } else if (period === 'month') {
    const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    query.updated_at = _.gte(monthAgo);
  }

  const result = await db
    .collection('learning_resources')
    .where(query)
    .orderBy('view_count', 'desc')
    .limit(safeLimit)
    .get();

  const resources = enrichResources(result.data || []);

  // 添加排名
  resources.forEach((r, i) => {
    r.rank = i + 1;
  });

  return {
    code: 0,
    success: true,
    data: resources,
    message: '获取成功'
  };
}

/**
 * 按分类获取资源
 * 支持分页，按分类和学科筛选
 */
async function handleGetByCategory(_userId: string, data: Record<string, unknown>, _requestId: string) {
  const rawCategory = data.category;
  const rawSubject = data.subject;
  const category = normalizeCategory(rawCategory);
  const subject = normalizeSubject(rawSubject);
  const page = toPositiveInt(data.page, 1, 1000000);
  const safeLimit = toPositiveInt(data.limit, CONFIG.defaultPageSize, CONFIG.maxPageSize);

  if (!category) {
    return { code: 400, success: false, message: '参数错误: category 不能为空' };
  }
  if (rawSubject && !subject) {
    return { code: 400, success: false, message: '参数错误: subject 无效' };
  }

  const skip = (page - 1) * safeLimit;

  const query: Record<string, unknown> = { status: 'published', category };
  if (subject) query.subject = subject;

  const [listResult, countResult] = await Promise.all([
    db.collection('learning_resources').where(query).orderBy('created_at', 'desc').skip(skip).limit(safeLimit).get(),
    db.collection('learning_resources').where(query).count()
  ]);

  const resources = enrichResources(listResult.data || []);
  const total = countResult.total || 0;

  return {
    code: 0,
    success: true,
    data: {
      resources,
      total,
      page,
      limit: safeLimit,
      hasMore: skip + resources.length < total
    },
    message: '获取成功'
  };
}

/**
 * 搜索资源
 * 支持关键词搜索（标题、描述、标签），分页，按分类和学科筛选
 *
 * ✅ P3-FIX: 优化搜索性能
 * - 限制关键词长度防止过长正则
 * - 优先用 category/subject 索引字段缩小范围
 * - 优先使用 MongoDB $text 索引搜索，不可用时降级为 $regex
 */
async function handleSearch(_userId: string, data: Record<string, unknown>, requestId: string) {
  const keyword = toSafeString(data.keyword);
  const rawCategory = data.category;
  const rawSubject = data.subject;
  const category = normalizeCategory(rawCategory);
  const subject = normalizeSubject(rawSubject);
  const page = toPositiveInt(data.page, 1, 1000000);
  const safeLimit = toPositiveInt(data.limit, CONFIG.defaultPageSize, CONFIG.maxPageSize);

  if (rawCategory && !category) {
    return { code: 400, success: false, message: '参数错误: category 无效' };
  }
  if (rawSubject && !subject) {
    return { code: 400, success: false, message: '参数错误: subject 无效' };
  }

  if (!keyword || keyword.trim().length < 2) {
    return { code: 400, success: false, message: '搜索关键词至少2个字符' };
  }

  // 限制关键词长度，防止过长正则影响性能
  const rawKeyword = keyword.trim().substring(0, 50);

  const skip = (page - 1) * safeLimit;

  // 构建搜索查询：优先使用 $text 索引（需要先运行 db-create-indexes）
  const query: Record<string, unknown> = {
    status: 'published'
  };

  // 索引字段筛选
  if (category) query.category = category;
  if (subject) query.subject = subject;

  // 尝试使用 $text 搜索（依赖 idx_search_text 文本索引）
  let useTextSearch = true;
  query.$text = { $search: rawKeyword };

  let listResult, countResult;
  try {
    [listResult, countResult] = await Promise.all([
      db.collection('learning_resources').where(query).orderBy('view_count', 'desc').skip(skip).limit(safeLimit).get(),
      db.collection('learning_resources').where(query).count()
    ]);
  } catch (textErr) {
    // $text 索引不存在时降级为 $regex
    useTextSearch = false;
    logger.warn(`[${requestId}] $text 搜索失败，降级为 $regex: ${(textErr as Error).message}`);

    // 转义正则特殊字符，防止 ReDoS 攻击
    const trimmedKeyword = rawKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    delete query.$text;
    query.$or = [
      { title: { $regex: trimmedKeyword, $options: 'i' } },
      { description: { $regex: trimmedKeyword, $options: 'i' } },
      { tags: { $regex: trimmedKeyword, $options: 'i' } }
    ];

    [listResult, countResult] = await Promise.all([
      db.collection('learning_resources').where(query).orderBy('view_count', 'desc').skip(skip).limit(safeLimit).get(),
      db.collection('learning_resources').where(query).count()
    ]);
  }

  const resources = enrichResources(listResult.data || []);
  const total = countResult.total || 0;

  logger.info(`[${requestId}] 搜索 "${rawKeyword}" (${useTextSearch ? '$text' : '$regex'}): ${total} 条结果`);

  return {
    code: 0,
    success: true,
    data: {
      resources,
      keyword: rawKeyword,
      total,
      page,
      limit: safeLimit,
      hasMore: skip + resources.length < total
    },
    message: '搜索完成'
  };
}

/**
 * 收藏/取消收藏资源
 */
async function handleFavorite(userId: string, data: Record<string, unknown>, _requestId: string) {
  if (!userId) {
    return { code: 401, success: false, message: '请先登录' };
  }

  const resourceId = toSafeString(data.resourceId);
  const favAction = toSafeString(data.action);

  if (!resourceId) {
    return { code: 400, success: false, message: '参数错误: resourceId 不能为空' };
  }

  const collection = db.collection('resource_favorites');
  const now = Date.now();

  if (favAction === 'remove') {
    // 取消收藏
    await collection
      .where({
        user_id: userId,
        resource_id: resourceId
      })
      .remove();

    return {
      code: 0,
      success: true,
      data: { isFavorite: false },
      message: '已取消收藏'
    };
  } else {
    const resource = await getResourceById(resourceId);
    if (!resource || resource.status !== 'published') {
      return { code: 404, success: false, message: '资源不存在或不可用' };
    }

    // 添加收藏
    const existing = await collection
      .where({
        user_id: userId,
        resource_id: resourceId
      })
      .getOne();

    if (existing.data) {
      return {
        code: 0,
        success: true,
        data: { isFavorite: true },
        message: '已在收藏中'
      };
    }

    await collection.add({
      user_id: userId,
      resource_id: resourceId,
      created_at: now
    });

    return {
      code: 0,
      success: true,
      data: { isFavorite: true },
      message: '收藏成功'
    };
  }
}

/**
 * 获取用户收藏的资源
 * 通过收藏记录关联查询资源详情
 */
async function handleGetUserFavorites(userId: string, data: Record<string, unknown>, _requestId: string) {
  if (!userId) {
    return { code: 401, success: false, message: '请先登录' };
  }

  const page = toPositiveInt(data.page, 1, 1000000);
  const safeLimit = toPositiveInt(data.limit, CONFIG.defaultPageSize, CONFIG.maxPageSize);
  const skip = (page - 1) * safeLimit;

  const collection = db.collection('resource_favorites');

  const [listRes, countRes] = await Promise.all([
    collection.where({ user_id: userId }).orderBy('created_at', 'desc').skip(skip).limit(safeLimit).get(),
    collection.where({ user_id: userId }).count()
  ]);

  // 批量获取资源详情
  const resourceIds = (listRes.data || []).map((fav) => fav.resource_id).filter(Boolean);
  const resourceMap: Record<string, any> = {};

  if (resourceIds.length > 0) {
    const resourceRes = await db
      .collection('learning_resources')
      .where({ _id: _.in(resourceIds) })
      .get();
    for (const r of resourceRes.data || []) {
      resourceMap[r._id] = r;
    }
  }

  const favorites = (listRes.data || []).map((fav) => ({
    ...fav,
    resource: enrichResource(resourceMap[fav.resource_id] || null)
  }));

  return {
    code: 0,
    success: true,
    data: {
      favorites,
      total: countRes.total,
      page,
      limit: safeLimit,
      hasMore: skip + favorites.length < countRes.total
    },
    message: '获取成功'
  };
}

/**
 * 记录学习进度
 */
async function handleRecordProgress(userId: string, data: Record<string, unknown>, _requestId: string) {
  if (!userId) {
    return { code: 401, success: false, message: '请先登录' };
  }

  const resourceId = toSafeString(data.resourceId);
  const progress = Math.min(toNonNegativeNumber(data.progress, 0, 100), 100);
  const duration = toNonNegativeNumber(data.duration, 0, 24 * 60 * 60);

  if (!resourceId) {
    return { code: 400, success: false, message: '参数错误: resourceId 不能为空' };
  }

  const resource = await getResourceById(resourceId);
  if (!resource || resource.status !== 'published') {
    return { code: 404, success: false, message: '资源不存在或不可用' };
  }

  const collection = db.collection('learning_progress');
  const now = Date.now();

  // 查找现有进度
  const existing = await collection
    .where({
      user_id: userId,
      resource_id: resourceId
    })
    .getOne();

  if (existing.data) {
    // 更新进度
    await collection.doc(existing.data._id).update({
      progress: Math.max(existing.data.progress || 0, progress || 0),
      total_duration: _.inc(duration || 0),
      last_study_at: now,
      updated_at: now
    });
  } else {
    // 创建新记录
    await collection.add({
      user_id: userId,
      resource_id: resourceId,
      progress: progress || 0,
      total_duration: duration || 0,
      last_study_at: now,
      created_at: now,
      updated_at: now
    });
  }

  return {
    code: 0,
    success: true,
    message: '进度已保存'
  };
}

/**
 * 获取学习统计
 * 通过 learning_progress 和 resource_favorites 聚合统计
 */
async function handleGetStats(userId: string, _data: Record<string, unknown>, _requestId: string) {
  if (!userId) {
    return { code: 401, success: false, message: '请先登录' };
  }

  const progressCollection = db.collection('learning_progress');
  const favoriteCollection = db.collection('resource_favorites');

  const [progressRes, favoriteRes] = await Promise.all([
    progressCollection
      .where({ user_id: userId })
      .field({ resource_id: 1, progress: 1, total_duration: 1, last_study_at: 1 })
      .limit(500)
      .get(),
    favoriteCollection.where({ user_id: userId }).count()
  ]);

  const progressList = progressRes.data || [];

  // 计算统计数据
  const totalDuration = progressList.reduce((sum, p) => sum + (p.total_duration || 0), 0);
  const completedCount = progressList.filter((p) => (p.progress || 0) >= 100).length;
  const inProgressCount = progressList.filter((p) => (p.progress || 0) > 0 && (p.progress || 0) < 100).length;

  // 批量获取资源详情用于分类统计
  const resourceIds = progressList.map((p) => p.resource_id).filter(Boolean);
  const resourceMap: Record<string, any> = {};

  if (resourceIds.length > 0) {
    const resourceRes = await db
      .collection('learning_resources')
      .where({ _id: _.in(resourceIds) })
      .field({ _id: 1, category: 1 })
      .get();
    for (const r of resourceRes.data || []) {
      resourceMap[r._id] = r;
    }
  }

  // 按分类统计
  const categoryStats: Record<string, { count: number; duration: number }> = {};
  for (const p of progressList) {
    const resource = resourceMap[p.resource_id] as { category?: string } | undefined;
    if (resource) {
      const cat = resource.category || 'unknown';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { count: 0, duration: 0 };
      }
      categoryStats[cat].count++;
      categoryStats[cat].duration += p.total_duration || 0;
    }
  }

  return {
    code: 0,
    success: true,
    data: {
      totalResources: progressList.length,
      completedCount,
      inProgressCount,
      totalDuration,
      favoriteCount: favoriteRes.total,
      categoryStats,
      recentProgress: progressList.sort((a, b) => (b.last_study_at || 0) - (a.last_study_at || 0)).slice(0, 5)
    },
    message: '获取成功'
  };
}

/**
 * 获取资源分类
 */
async function handleGetCategories(_userId: string, _data: Record<string, unknown>, _requestId: string) {
  return {
    code: 0,
    success: true,
    data: RESOURCE_CATEGORIES,
    message: '获取成功'
  };
}

/**
 * 获取学科分类
 */
async function handleGetSubjects(_userId: string, _data: Record<string, unknown>, _requestId: string) {
  return {
    code: 0,
    success: true,
    data: SUBJECTS,
    message: '获取成功'
  };
}

// ==================== 辅助函数 ====================

/**
 * 为资源列表补充分类元信息（名称、图标、颜色）
 * @param resources - 从数据库查询到的资源数组
 * @returns 补充了 categoryName/categoryIcon/subjectName/subjectIcon 的资源数组
 */
function enrichResources(resources: Record<string, any>[]): Record<string, any>[] {
  return resources.map((r) => enrichResource(r)).filter(Boolean);
}

/**
 * 为单个资源补充分类元信息
 * @param resource - 从数据库查询到的单个资源对象
 * @returns 补充了元信息的资源对象，如果输入为 null 则返回 null
 */
function enrichResource(resource: Record<string, any> | null): Record<string, any> | null {
  if (!resource) return null;

  const catInfo = RESOURCE_CATEGORIES[resource.category];
  const subjInfo = SUBJECTS[resource.subject];

  return {
    ...resource,
    // 补充分类元信息（如果数据库中没有存储这些字段）
    categoryName: resource.categoryName || (catInfo ? catInfo.name : resource.category),
    categoryIcon: resource.categoryIcon || (catInfo ? catInfo.icon : ''),
    subjectName: resource.subjectName || (subjInfo ? subjInfo.name : resource.subject),
    subjectIcon: resource.subjectIcon || (subjInfo ? subjInfo.icon : '')
  };
}

/**
 * 根据ID从数据库获取资源
 * @param resourceId - 资源的 _id
 * @returns 资源对象或 null
 */
async function getResourceById(resourceId: string): Promise<Record<string, unknown> | null> {
  if (!resourceId) return null;

  try {
    const result = await db.collection('learning_resources').doc(resourceId).get();
    if (result.data) {
      return enrichResource(result.data);
    }
    return null;
  } catch (e) {
    logger.warn(`获取资源 ${resourceId} 失败:`, e);
    return null;
  }
}
