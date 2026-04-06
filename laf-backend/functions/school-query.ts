/**
 * 学校数据查询云函数
 *
 * 功能：
 * 1. 学校列表查询（支持筛选、搜索、分页）
 * 2. 学校详情查询
 * 3. 专业查询
 * 4. 分数线查询
 * 5. 报录比查询
 * 6. 用户收藏管理
 * 7. 从研招网同步院校数据
 *
 * @version 1.2.0
 * @changelog 1.2.0 - 添加内存缓存机制，优化查询响应速度
 */

import cloud from '@lafjs/cloud';
import { verifyJWT, extractBearerToken } from './_shared/auth';
import { requireAdminAccess } from './_shared/admin-auth';
import { createLogger, checkRateLimitDistributed } from './_shared/api-response';

const db = cloud.database();
const _ = db.command;
const logger = createLogger('[SchoolQuery]');

/** Escape user input for safe use in $regex (prevents ReDoS) */
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 研招网923个研究生招生单位总数
const TOTAL_GRADUATE_UNITS = 923;
// 数据完整性阈值（低于此数量认为数据不完整）
const DATA_COMPLETENESS_THRESHOLD = 900;

const QUERY_LIMITS = {
  page: { min: 1, max: 500, defaultValue: 1 },
  pageSize: { min: 1, max: 100, defaultValue: 20 },
  searchLimit: { min: 1, max: 20, defaultValue: 10 },
  hotLimit: { min: 1, max: 20, defaultValue: 10 },
  unitsPageSize: { min: 1, max: 100, defaultValue: 50 },
  keywordLength: 80,
  tagsMaxCount: 10
};

function clampInt(value, { min, max, defaultValue }) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, parsed));
}

function sanitizeFilterValue(value, maxLength = 64) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function sanitizeKeyword(value, maxLength = QUERY_LIMITS.keywordLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function sanitizeYear(value) {
  const currentYear = new Date().getFullYear() + 1;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(currentYear, Math.max(2000, parsed));
}

// ==================== 内存缓存系统 ====================

/**
 * 缓存配置（TTL 单位：毫秒）
 * - 省份列表、统计数据等变化极少的数据：缓存30分钟
 * - 热门学校、学校详情等：缓存10分钟
 * - 搜索结果：缓存5分钟
 * - 数据完整性检查：缓存10分钟
 */
const CACHE_TTL = {
  provinces: 30 * 60 * 1000, // 30分钟
  stats: 30 * 60 * 1000, // 30分钟
  hotSchools: 10 * 60 * 1000, // 10分钟
  schoolDetail: 10 * 60 * 1000, // 10分钟
  search: 5 * 60 * 1000, // 5分钟
  completeness: 10 * 60 * 1000, // 10分钟
  nationalLines: 30 * 60 * 1000 // 30分钟（国家线数据基本不变）
};

// 缓存最大条目数，防止内存溢出
const CACHE_MAX_SIZE = 500;

// 缓存存储（模块级变量，在 Laf 云函数中会在实例生命周期内保持）
const cache = new Map();

/**
 * 获取缓存
 * @param {string} key - 缓存键
 * @returns {any|null} 缓存值，过期或不存在返回 null
 */
function getCache(key) {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expireAt) {
    cache.delete(key);
    return null;
  }

  entry.hits = (entry.hits || 0) + 1;
  return entry.value;
}

/**
 * 设置缓存
 * @param {string} key - 缓存键
 * @param {any} value - 缓存值
 * @param {number} ttl - 过期时间（毫秒）
 */
function setCache(key, value, ttl) {
  // 如果缓存已满，清理过期条目；仍然的条目
  if (cache.size >= CACHE_MAX_SIZE) {
    evictExpiredEntries();
    if (cache.size >= CACHE_MAX_SIZE) {
      // LRU-like: 删除最早插入的条目（Map 保持插入顺序）
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
  }

  cache.set(key, {
    value,
    expireAt: Date.now() + ttl,
    createdAt: Date.now(),
    hits: 0
  });
}

/**
 * 清理所有过期缓存条目
 */
function evictExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expireAt) {
      cache.delete(key);
    }
  }
}

/**
 * 使指定前缀的缓存失效（用于数据更新后清理相关缓存）
 * @param {string} prefix - 缓存键前缀
 */
function invalidateCache(prefix) {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * 生成缓存键
 * @param {string} namespace - 命名空间
 * @param {object} params - 参数对象
 * @returns {string} 缓存键
 */
function buildCacheKey(namespace, params = {}) {
  const sortedParams = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${JSON.stringify(params[k])}`)
    .join('&');
  return `${namespace}:${sortedParams}`;
}

export default async function (ctx) {
  const startTime = Date.now();
  const requestId = `school_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  try {
    const { action, data } = ctx.body || {};

    if (!action) {
      return { code: 400, success: false, message: '缺少 action 参数', requestId };
    }

    // 分布式限流：公开端点，按 IP 限制每分钟 30 次请求
    const clientIp =
      ctx.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      ctx.headers?.['x-real-ip'] ||
      ctx.socket?.remoteAddress ||
      'unknown';
    const rateLimitKey = `school-query:${clientIp}:${action}`;
    const rateLimit = await checkRateLimitDistributed(rateLimitKey, 30, 60 * 1000);
    if (!rateLimit.allowed) {
      return {
        code: 429,
        success: false,
        message: '请求过于频繁，请稍后再试',
        retryAfter: Math.max(1, Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
        requestId
      };
    }

    // JWT 身份验证（收藏操作需要认证，公开查询允许匿名）
    const userActions = ['add_favorite', 'remove_favorite', 'get_favorites'];
    const authToken = ctx.headers?.['authorization'] || ctx.headers?.Authorization;
    if (authToken) {
      const rawToken = extractBearerToken(authToken);
      const payload = verifyJWT(rawToken);
      if (!payload) {
        return { code: 401, success: false, message: 'token 无效或已过期，请重新登录', requestId };
      }
      // 将验证后的 userId 挂到 ctx 上供后续使用
      ctx._verifiedUserId = payload.userId;
    } else if (userActions.includes(action)) {
      return { code: 401, success: false, message: '该操作需要登录', requestId };
    }

    logger.info(`[${requestId}] 学校查询: action=${action}`);

    let result;

    switch (action) {
      // ==================== 学校查询 ====================
      case 'list':
        result = await getSchoolList(data, requestId);
        break;

      case 'detail':
        result = await getSchoolDetail(data, requestId);
        break;

      case 'search':
        result = await searchSchools(data, requestId);
        break;

      case 'hot':
        result = await getHotSchools(data, requestId);
        break;

      // ==================== 专业查询 ====================
      case 'majors':
        result = await getMajors(data, requestId);
        break;

      case 'major_detail':
        result = await getMajorDetail(data, requestId);
        break;

      case 'colleges':
        result = await getColleges(data, requestId);
        break;

      // ==================== 分数线查询 ====================
      case 'score_lines':
        result = await getScoreLines(data, requestId);
        break;

      case 'national_lines':
        result = await getNationalLines(data, requestId);
        break;

      // ==================== 报录比查询 ====================
      case 'admission_ratios':
        result = await getAdmissionRatios(data, requestId);
        break;

      // ==================== 用户收藏 ====================
      case 'add_favorite':
        result = await addFavorite(ctx, data, requestId);
        break;

      case 'remove_favorite':
        result = await removeFavorite(ctx, data, requestId);
        break;

      case 'get_favorites':
        result = await getFavorites(ctx, data, requestId);
        break;

      // ==================== 统计数据 ====================
      case 'stats':
        result = await getStats(requestId);
        break;

      case 'provinces':
        result = await getProvinces(requestId);
        break;

      // ==================== 数据同步 ====================
      case 'sync_from_chsi': {
        // [Phase3] sync_from_chsi 是写操作，统一走 _shared/admin-auth
        const syncAuth = requireAdminAccess(ctx, { allowBodyFallback: true });
        if (!syncAuth.ok) {
          return { code: syncAuth.code, success: false, message: syncAuth.message || '需要管理员权限', requestId };
        }
        result = await syncFromChsi(data, requestId);
        break;
      }

      case 'get_all_units':
        result = await getAllUnits(data, requestId);
        break;

      // P013: 数据完整性健康检查
      case 'data_health':
        result = await checkDataHealth(requestId);
        break;

      default:
        return { code: 400, success: false, message: `未知的 action: ${action}`, requestId };
    }

    // 添加响应耗时
    const duration = Date.now() - startTime;
    result.duration = duration;
    logger.info(`[${requestId}] action=${action} 耗时 ${duration}ms`);
    return result;
  } catch (error) {
    logger.error(`[${requestId}] 学校查询异常:`, error);
    return {
      code: 500,
      success: false,
      message: '服务异常，请稍后重试',
      requestId,
      duration: Date.now() - startTime
    };
  }
}

/**
 * 检查数据完整性（带缓存）
 */
async function checkDataCompleteness() {
  const cacheKey = 'completeness:check';
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const countResult = await db.collection('schools').count();
  const currentCount = countResult.total || 0;
  const isComplete = currentCount >= DATA_COMPLETENESS_THRESHOLD;

  const result = {
    currentCount,
    totalUnits: TOTAL_GRADUATE_UNITS,
    isComplete,
    needSync: !isComplete
  };

  setCache(cacheKey, result, CACHE_TTL.completeness);
  return result;
}

/**
 * 获取学校列表
 */
async function getSchoolList(data, requestId) {
  const { page = 1, pageSize = 20, province, level, type, tags, sortBy = 'ranking', sortOrder = 'asc' } = data || {};

  const safePage = clampInt(page, QUERY_LIMITS.page);
  const safePageSize = clampInt(pageSize, QUERY_LIMITS.pageSize);
  const safeProvince = sanitizeFilterValue(province);
  const safeLevel = sanitizeFilterValue(level);
  const safeType = sanitizeFilterValue(type);
  const safeSortBy = sanitizeFilterValue(sortBy, 30) || 'ranking';
  const safeTags = Array.isArray(tags)
    ? tags
        .map((tag) => sanitizeFilterValue(tag, 32))
        .filter(Boolean)
        .slice(0, QUERY_LIMITS.tagsMaxCount)
    : [];

  // 检查数据完整性
  const dataStatus = await checkDataCompleteness();

  // 构建查询条件
  const query: Record<string, any> = { status: 'active' };

  if (safeProvince) {
    query.province = safeProvince;
  }

  if (safeLevel) {
    query.level = safeLevel;
  }

  if (safeType) {
    query.type = safeType;
  }

  if (safeTags.length > 0) {
    query.tags = _.in(safeTags);
  }

  // 分页
  const skip = (safePage - 1) * safePageSize;

  // 排序
  let orderField = 'ranking.overall';
  if (safeSortBy === 'code') orderField = 'code';
  if (safeSortBy === 'name') orderField = 'name';
  if (safeSortBy === 'province') orderField = 'province';
  if (safeSortBy === 'updatedAt') orderField = 'updatedAt';
  const orderDirection = sortOrder === 'desc' ? 'desc' : 'asc';

  const [schools, countResult] = await Promise.all([
    db
      .collection('schools')
      .where(query)
      .orderBy(orderField, orderDirection)
      .skip(skip)
      .limit(safePageSize)
      .field({
        _id: true,
        code: true,
        name: true,
        shortName: true,
        province: true,
        city: true,
        level: true,
        tags: true,
        type: true,
        logo: true,
        ranking: true,
        graduateInfo: true
      })
      .get(),
    db.collection('schools').where(query).count()
  ]);

  const response = {
    code: 0,
    success: true,
    data: {
      list: schools.data || [],
      total: countResult.total || 0,
      page: safePage,
      pageSize: safePageSize,
      totalUnits: TOTAL_GRADUATE_UNITS
    },
    requestId
  };

  // 如果数据不完整，添加提示信息
  if (dataStatus.needSync) {
    (response as Record<string, unknown>).warning = {
      message: `数据库中院校数量(${dataStatus.currentCount})少于${DATA_COMPLETENESS_THRESHOLD}，数据可能不完整，建议执行同步操作`,
      currentCount: dataStatus.currentCount,
      expectedCount: TOTAL_GRADUATE_UNITS,
      action: 'sync_from_chsi'
    };
  }

  return response;
}

/**
 * P013: 数据完整性健康检查
 * 检查院校数据的完整性、质量和一致性
 */
async function checkDataHealth(requestId) {
  const dataStatus = await checkDataCompleteness();

  // 并行执行多项质量检查
  const [missingFieldsResult, provinceDistribution, duplicateCheck] = await Promise.all([
    // 检查缺少关键字段的记录
    db
      .collection('schools')
      .where({
        status: 'active',
        $or: [
          { name: { $exists: false } },
          { name: '' },
          { code: { $exists: false } },
          { code: '' },
          { province: { $exists: false } },
          { province: '' }
        ]
      })
      .count(),
    // 按省份统计分布
    db.collection('schools').where({ status: 'active' }).field({ province: true }).limit(2000).get(),
    // 检查重复 code
    db.collection('schools').where({ status: 'active' }).field({ code: true }).limit(2000).get()
  ]);

  // 统计省份分布
  const provinceCounts = {};
  for (const s of provinceDistribution.data || []) {
    const p = s.province || '未知';
    provinceCounts[p] = (provinceCounts[p] || 0) + 1;
  }

  // 检查重复 code
  const codeCounts = {};
  let duplicateCount = 0;
  for (const s of duplicateCheck.data || []) {
    if (s.code) {
      codeCounts[s.code] = (codeCounts[s.code] || 0) + 1;
      if (codeCounts[s.code] === 2) duplicateCount++;
    }
  }

  const missingFields = missingFieldsResult.total || 0;
  const completenessPercent = Math.round((dataStatus.currentCount / TOTAL_GRADUATE_UNITS) * 100);

  // 综合健康评分 (0-100)
  let healthScore = 100;
  if (!dataStatus.isComplete)
    healthScore -= Math.min(40, Math.round((1 - dataStatus.currentCount / TOTAL_GRADUATE_UNITS) * 40));
  if (missingFields > 0) healthScore -= Math.min(30, missingFields * 2);
  if (duplicateCount > 0) healthScore -= Math.min(20, duplicateCount * 5);
  healthScore = Math.max(0, healthScore);

  const status = healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'warning' : 'critical';

  return {
    code: 0,
    success: true,
    data: {
      status,
      healthScore,
      completeness: {
        currentCount: dataStatus.currentCount,
        expectedCount: TOTAL_GRADUATE_UNITS,
        percent: completenessPercent,
        isComplete: dataStatus.isComplete
      },
      quality: {
        missingRequiredFields: missingFields,
        duplicateCodes: duplicateCount
      },
      distribution: {
        byProvince: provinceCounts,
        provinceCount: Object.keys(provinceCounts).length
      },
      recommendations: [
        ...(!dataStatus.isComplete
          ? [`数据不完整(${completenessPercent}%)，建议执行 sync_from_chsi 同步研招网数据`]
          : []),
        ...(missingFields > 0 ? [`${missingFields} 条记录缺少必填字段(name/code/province)，需修复`] : []),
        ...(duplicateCount > 0 ? [`发现 ${duplicateCount} 个重复院校代码，需去重`] : [])
      ]
    },
    requestId
  };
}

/**
 * 获取学校详情（带缓存）
 */
async function getSchoolDetail(data, requestId) {
  const { schoolId, code } = data || {};
  const safeSchoolId = sanitizeFilterValue(schoolId, 64);
  const safeCode = sanitizeFilterValue(code, 64);

  if (!safeSchoolId && !safeCode) {
    return { code: 400, success: false, message: '缺少学校ID或代码', requestId };
  }

  // 缓存命中检查
  const cacheKey = buildCacheKey('detail', { schoolId: safeSchoolId, code: safeCode });
  const cached = getCache(cacheKey);
  if (cached) {
    logger.info(`[${requestId}] 学校详情缓存命中: ${safeSchoolId || safeCode}`);
    return { ...cached, requestId };
  }

  const query = safeSchoolId ? { _id: safeSchoolId } : { code: safeCode };

  const result = await db.collection('schools').where(query).getOne();

  if (!result.data) {
    return { code: 404, success: false, message: '学校不存在', requestId };
  }

  // 并行获取学院列表和最新分数线
  const [colleges, latestScoreLines] = await Promise.all([
    db.collection('colleges').where({ schoolId: result.data._id }).get(),
    db.collection('score_lines').where({ schoolId: result.data._id }).orderBy('year', 'desc').limit(10).get()
  ]);

  const response = {
    code: 0,
    success: true,
    data: {
      ...result.data,
      colleges: colleges.data || [],
      latestScoreLines: latestScoreLines.data || []
    },
    requestId
  };

  setCache(cacheKey, response, CACHE_TTL.schoolDetail);
  return response;
}

/**
 * 搜索学校（带缓存）
 */
async function searchSchools(data, requestId) {
  const { keyword, limit = 10 } = data || {};
  const searchTerm = sanitizeKeyword(keyword);
  const safeLimit = clampInt(limit, QUERY_LIMITS.searchLimit);

  if (!searchTerm) {
    return { code: 400, success: false, message: '搜索关键词不能为空', requestId };
  }

  // 缓存命中检查
  const cacheKey = buildCacheKey('search', { keyword: searchTerm, limit: safeLimit });
  const cached = getCache(cacheKey);
  if (cached) {
    logger.info(`[${requestId}] 搜索缓存命中: "${searchTerm}"`);
    return { ...cached, requestId };
  }

  // 并行执行搜索和数据完整性检查
  const [result, dataStatus] = await Promise.all([
    db
      .collection('schools')
      .where({
        status: 'active',
        $or: [
          { name: { $regex: escapeRegex(searchTerm), $options: 'i' } },
          { shortName: { $regex: escapeRegex(searchTerm), $options: 'i' } },
          { code: { $regex: escapeRegex(searchTerm), $options: 'i' } }
        ]
      })
      .limit(safeLimit)
      .field({
        _id: true,
        code: true,
        name: true,
        shortName: true,
        province: true,
        level: true,
        tags: true,
        logo: true
      })
      .get(),
    checkDataCompleteness()
  ]);

  const response = {
    code: 0,
    success: true,
    data: result.data || [],
    totalUnits: TOTAL_GRADUATE_UNITS,
    requestId
  };

  // 如果数据不完整，添加提示信息
  if (dataStatus.needSync) {
    (response as Record<string, unknown>).warning = {
      message: `数据库中院校数量(${dataStatus.currentCount})少于${DATA_COMPLETENESS_THRESHOLD}，搜索结果可能不完整，建议执行同步操作`,
      currentCount: dataStatus.currentCount,
      expectedCount: TOTAL_GRADUATE_UNITS,
      action: 'sync_from_chsi'
    };
  }

  setCache(cacheKey, response, CACHE_TTL.search);
  return response;
}

/**
 * 获取热门学校（带缓存）
 */
async function getHotSchools(data, requestId) {
  const { limit = 10, province } = data || {};
  const safeLimit = clampInt(limit, QUERY_LIMITS.hotLimit);
  const safeProvince = sanitizeFilterValue(province);

  // 缓存命中检查
  const cacheKey = buildCacheKey('hot', { limit: safeLimit, province: safeProvince });
  const cached = getCache(cacheKey);
  if (cached) {
    logger.info(`[${requestId}] 热门学校缓存命中`);
    return { ...cached, requestId };
  }

  const query: Record<string, any> = { status: 'active' };

  if (safeProvince) {
    query.province = safeProvince;
  }

  // 按排名获取热门学校
  const result = await db
    .collection('schools')
    .where(query)
    .orderBy('ranking.overall', 'asc')
    .limit(safeLimit)
    .field({
      _id: true,
      code: true,
      name: true,
      shortName: true,
      province: true,
      level: true,
      tags: true,
      logo: true,
      ranking: true
    })
    .get();

  const response = {
    code: 0,
    success: true,
    data: result.data || [],
    requestId
  };

  setCache(cacheKey, response, CACHE_TTL.hotSchools);
  return response;
}

/**
 * 获取专业列表（B015 增强：支持排序、学院聚合、缓存）
 */
async function getMajors(data, requestId) {
  const {
    schoolId,
    collegeId,
    category,
    degree,
    keyword,
    sortBy = 'name',
    sortOrder = 'asc',
    page = 1,
    pageSize = 20
  } = data || {};

  const safeSchoolId = sanitizeFilterValue(schoolId, 64);
  const safeCollegeId = sanitizeFilterValue(collegeId, 64);
  const safeCategory = sanitizeFilterValue(category, 64);
  const safeDegree = sanitizeFilterValue(degree, 64);
  const safeKeyword = sanitizeKeyword(keyword);
  const safePage = clampInt(page, QUERY_LIMITS.page);
  const safePageSize = clampInt(pageSize, QUERY_LIMITS.pageSize);
  const safeSortBy = sanitizeFilterValue(sortBy, 30);

  if (!safeSchoolId) {
    return { code: 400, success: false, message: '缺少学校ID', requestId };
  }

  // 缓存检查（无关键词搜索时缓存）
  const cacheKey = !safeKeyword
    ? buildCacheKey('majors', {
        schoolId: safeSchoolId,
        collegeId: safeCollegeId,
        category: safeCategory,
        degree: safeDegree,
        sortBy: safeSortBy,
        sortOrder,
        page: safePage,
        pageSize: safePageSize
      })
    : null;
  if (cacheKey) {
    const cached = getCache(cacheKey);
    if (cached) return { ...cached, requestId };
  }

  const query: Record<string, any> = { schoolId: safeSchoolId };

  if (safeCollegeId) {
    query.collegeId = safeCollegeId;
  }

  if (safeCategory) {
    query.category = safeCategory;
  }

  if (safeDegree) {
    query.degree = safeDegree;
  }

  if (safeKeyword) {
    query.$or = [
      { name: { $regex: escapeRegex(safeKeyword), $options: 'i' } },
      { code: { $regex: escapeRegex(safeKeyword), $options: 'i' } }
    ];
  }

  const skip = (safePage - 1) * safePageSize;
  // 排序字段白名单
  const allowedSortFields = ['name', 'code', 'category', 'created_at'];
  const finalSortBy = allowedSortFields.includes(safeSortBy) ? safeSortBy : 'name';
  const finalSortOrder = sortOrder === 'desc' ? 'desc' : 'asc';

  const [majors, countResult] = await Promise.all([
    db.collection('majors').where(query).orderBy(finalSortBy, finalSortOrder).skip(skip).limit(safePageSize).get(),
    db.collection('majors').where(query).count()
  ]);

  const response = {
    code: 0,
    success: true,
    data: {
      list: majors.data || [],
      total: countResult.total || 0,
      page: safePage,
      pageSize: safePageSize
    },
    requestId
  };

  if (cacheKey) {
    setCache(cacheKey, response, CACHE_TTL.search);
  }
  return response;
}

/**
 * 获取学院列表（B015 新增：按学院聚合专业数量）
 */
async function getColleges(data, requestId) {
  const { schoolId } = data || {};
  const safeSchoolId = sanitizeFilterValue(schoolId, 64);

  if (!safeSchoolId) {
    return { code: 400, success: false, message: '缺少学校ID', requestId };
  }

  const cacheKey = buildCacheKey('colleges', { schoolId: safeSchoolId });
  const cached = getCache(cacheKey);
  if (cached) return { ...cached, requestId };

  // 查询该校所有专业，按学院分组统计
  const allMajors = await db
    .collection('majors')
    .where({ schoolId: safeSchoolId })
    .field({ collegeId: true, collegeName: true, category: true, degree: true })
    .limit(1000)
    .get();

  const collegeMap = new Map();
  for (const m of allMajors.data || []) {
    const cid = m.collegeId || 'unknown';
    if (!collegeMap.has(cid)) {
      collegeMap.set(cid, {
        collegeId: cid,
        collegeName: m.collegeName || '未知学院',
        majorCount: 0,
        categories: new Set(),
        degrees: new Set()
      });
    }
    const entry = collegeMap.get(cid);
    entry.majorCount++;
    if (m.category) entry.categories.add(m.category);
    if (m.degree) entry.degrees.add(m.degree);
  }

  const list = Array.from(collegeMap.values())
    .map((c) => ({
      ...c,
      categories: Array.from(c.categories),
      degrees: Array.from(c.degrees)
    }))
    .sort((a, b) => a.collegeName.localeCompare(b.collegeName, 'zh-CN'));

  const response = {
    code: 0,
    success: true,
    data: { list, total: list.length },
    requestId
  };

  setCache(cacheKey, response, CACHE_TTL.hotSchools);
  return response;
}

/**
 * 获取专业详情
 */
async function getMajorDetail(data, requestId) {
  const { majorId } = data || {};
  const safeMajorId = sanitizeFilterValue(majorId, 64);

  if (!safeMajorId) {
    return { code: 400, success: false, message: '缺少专业ID', requestId };
  }

  const result = await db.collection('majors').where({ _id: safeMajorId }).getOne();

  if (!result.data) {
    return { code: 404, success: false, message: '专业不存在', requestId };
  }

  // 获取历年分数线和报录比 — 并行执行
  const [scoreLines, ratios] = await Promise.all([
    db.collection('score_lines').where({ majorId: safeMajorId }).orderBy('year', 'desc').limit(5).get(),
    db.collection('admission_ratios').where({ majorId: safeMajorId }).orderBy('year', 'desc').limit(5).get()
  ]);

  return {
    code: 0,
    success: true,
    data: {
      ...result.data,
      scoreLines: scoreLines.data || [],
      admissionRatios: ratios.data || []
    },
    requestId
  };
}

/**
 * 获取分数线
 */
async function getScoreLines(data, requestId) {
  const { schoolId, majorId, year, type } = data || {};
  const safeSchoolId = sanitizeFilterValue(schoolId, 64);
  const safeMajorId = sanitizeFilterValue(majorId, 64);
  const safeYear = sanitizeYear(year);
  const safeType = sanitizeFilterValue(type, 32);

  const query: Record<string, any> = {};

  if (safeSchoolId) query.schoolId = safeSchoolId;
  if (safeMajorId) query.majorId = safeMajorId;
  if (safeYear) query.year = safeYear;
  if (safeType) query.type = safeType;

  const result = await db.collection('score_lines').where(query).orderBy('year', 'desc').limit(50).get();

  return {
    code: 0,
    success: true,
    data: result.data || [],
    requestId
  };
}

/**
 * 获取国家线（带缓存）
 */
async function getNationalLines(data, requestId) {
  const { year, category, region } = data || {};
  const safeYear = sanitizeYear(year);
  const safeCategory = sanitizeFilterValue(category, 64);
  const safeRegion = sanitizeFilterValue(region, 64);

  // 缓存命中检查
  const cacheKey = buildCacheKey('nationalLines', { year: safeYear, category: safeCategory, region: safeRegion });
  const cached = getCache(cacheKey);
  if (cached) {
    logger.info(`[${requestId}] 国家线缓存命中`);
    return { ...cached, requestId };
  }

  const query: Record<string, any> = { type: '国家线' };

  if (safeYear) query.year = safeYear;
  if (safeCategory) query.category = safeCategory;
  if (safeRegion) query.region = safeRegion;

  const result = await db.collection('score_lines').where(query).orderBy('year', 'desc').limit(200).get();

  const response = {
    code: 0,
    success: true,
    data: result.data || [],
    requestId
  };

  setCache(cacheKey, response, CACHE_TTL.nationalLines);
  return response;
}

/**
 * 获取报录比
 */
async function getAdmissionRatios(data, requestId) {
  const { schoolId, majorId, year } = data || {};
  const safeSchoolId = sanitizeFilterValue(schoolId, 64);
  const safeMajorId = sanitizeFilterValue(majorId, 64);
  const safeYear = sanitizeYear(year);

  const query: Record<string, any> = {};

  if (safeSchoolId) query.schoolId = safeSchoolId;
  if (safeMajorId) query.majorId = safeMajorId;
  if (safeYear) query.year = safeYear;

  const result = await db.collection('admission_ratios').where(query).orderBy('year', 'desc').limit(50).get();

  return {
    code: 0,
    success: true,
    data: result.data || [],
    requestId
  };
}

/**
 * 添加收藏
 */
async function addFavorite(ctx, data, requestId) {
  // [P1-11] 仅使用 JWT 验证后的 userId，不回退到客户端可控值
  const userId = ctx._verifiedUserId;

  if (!userId) {
    return { code: 401, success: false, message: '未登录', requestId };
  }

  const { schoolId, majorId, notes, priority, status } = data || {};

  if (!schoolId) {
    return { code: 400, success: false, message: '缺少学校ID', requestId };
  }

  // 检查是否已收藏
  const existing = await db.collection('user_school_favorites').where({ userId, schoolId }).getOne();

  if (existing.data) {
    // 更新收藏
    await db.collection('user_school_favorites').doc(existing.data._id).update({
      majorId,
      notes,
      priority,
      status,
      updatedAt: Date.now()
    });

    return { code: 0, success: true, message: '更新成功', requestId };
  }

  // 新增收藏
  await db.collection('user_school_favorites').add({
    userId,
    schoolId,
    majorId,
    notes: notes || '',
    priority: priority || 3,
    status: status || 'considering',
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  return { code: 0, success: true, message: '收藏成功', requestId };
}

/**
 * 取消收藏
 */
async function removeFavorite(ctx, data, requestId) {
  // [P1-11] 仅使用 JWT 验证后的 userId，不回退到客户端可控值
  const userId = ctx._verifiedUserId;

  if (!userId) {
    return { code: 401, success: false, message: '未登录', requestId };
  }

  const { schoolId } = data || {};

  if (!schoolId) {
    return { code: 400, success: false, message: '缺少学校ID', requestId };
  }

  await db.collection('user_school_favorites').where({ userId, schoolId }).remove();

  return { code: 0, success: true, message: '取消收藏成功', requestId };
}

/**
 * 获取收藏列表
 */
async function getFavorites(ctx, data, requestId) {
  // [P1-11] 仅使用 JWT 验证后的 userId，不回退到客户端可控值
  const userId = ctx._verifiedUserId;

  if (!userId) {
    return { code: 401, success: false, message: '未登录', requestId };
  }

  const { status } = data || {};
  const safeStatus = sanitizeFilterValue(status, 32);

  const query: Record<string, any> = { userId };
  if (safeStatus) query.status = safeStatus;

  // [AUDIT FIX R135] 限制收藏列表最大返回数量，防止无界查询
  const favorites = await db
    .collection('user_school_favorites')
    .where(query)
    .orderBy('priority', 'asc')
    .orderBy('createdAt', 'desc')
    .limit(200)
    .get();

  // 获取学校详情
  const schoolIds = favorites.data?.map((f) => f.schoolId) || [];

  if (schoolIds.length > 0) {
    const schools = await db
      .collection('schools')
      .where({ _id: _.in(schoolIds) })
      .field({
        _id: true,
        code: true,
        name: true,
        shortName: true,
        province: true,
        level: true,
        tags: true,
        logo: true
      })
      .get();

    const schoolMap = new Map();
    schools.data?.forEach((s) => schoolMap.set(s._id, s));

    // 合并数据
    const result = favorites.data?.map((f) => ({
      ...f,
      school: schoolMap.get(f.schoolId) || null
    }));

    return { code: 0, success: true, data: result, requestId };
  }

  return { code: 0, success: true, data: [], requestId };
}

/**
 * 获取统计数据（带缓存）
 */
async function getStats(requestId) {
  const cacheKey = 'stats:all';
  const cached = getCache(cacheKey);
  if (cached) {
    logger.info(`[${requestId}] 统计数据缓存命中`);
    return { ...cached, requestId };
  }

  const [schoolCount, majorCount, provinceCount] = await Promise.all([
    db.collection('schools').where({ status: 'active' }).count(),
    db.collection('majors').count(),
    db
      .collection('schools')
      .aggregate()
      .match({ status: 'active' })
      .group({ _id: '$province', count: { $sum: 1 } })
      .end()
  ]);

  const response = {
    code: 0,
    success: true,
    data: {
      totalSchools: schoolCount.total || 0,
      totalMajors: majorCount.total || 0,
      byProvince: provinceCount.data || []
    },
    requestId
  };

  setCache(cacheKey, response, CACHE_TTL.stats);
  return response;
}

/**
 * 获取省份列表（带缓存）
 */
async function getProvinces(requestId) {
  const cacheKey = 'provinces:all';
  const cached = getCache(cacheKey);
  if (cached) {
    logger.info(`[${requestId}] 省份列表缓存命中`);
    return { ...cached, requestId };
  }

  const result = await db
    .collection('schools')
    .aggregate()
    .match({ status: 'active' })
    .group({
      _id: '$province',
      count: { $sum: 1 }
    })
    .sort({ count: -1 })
    .end();

  const provinces =
    result.data?.map((p) => ({
      name: p._id,
      count: p.count
    })) || [];

  const response = {
    code: 0,
    success: true,
    data: provinces,
    requestId
  };

  setCache(cacheKey, response, CACHE_TTL.provinces);
  return response;
}

/**
 * 从研招网同步院校数据
 * 注意：此函数需要配合爬虫服务使用，这里提供数据入库接口
 */
async function syncFromChsi(data, requestId) {
  const { schools, forceUpdate = false } = data || {};

  if (!schools || !Array.isArray(schools) || schools.length === 0) {
    // 如果没有传入数据，返回同步状态和指引
    const dataStatus = await checkDataCompleteness();

    return {
      code: 0,
      success: true,
      message: '请提供要同步的院校数据，或使用爬虫服务获取数据',
      data: {
        currentCount: dataStatus.currentCount,
        totalUnits: TOTAL_GRADUATE_UNITS,
        isComplete: dataStatus.isComplete,
        needSync: dataStatus.needSync,
        guide: {
          description: '同步研招网923个研究生招生单位数据',
          dataSource: 'https://yz.chsi.com.cn/zsml/queryAction.do',
          requiredFields: ['code', 'name', 'province', 'type'],
          optionalFields: ['shortName', 'city', 'level', 'tags', 'logo', 'website', 'address', 'phone']
        }
      },
      requestId
    };
  }

  logger.info(`[${requestId}] 开始同步 ${schools.length} 个院校数据`);

  let inserted = 0;
  let updated = 0;
  let failed = 0;
  const errors = [];

  for (const school of schools) {
    try {
      // 验证必填字段
      if (!school.code || !school.name) {
        failed++;
        errors.push({ code: school.code, name: school.name, error: '缺少必填字段 code 或 name' });
        continue;
      }

      // 检查是否已存在
      const existing = await db.collection('schools').where({ code: school.code }).getOne();

      const schoolData = {
        code: school.code,
        name: school.name,
        shortName: school.shortName || '',
        province: school.province || '',
        city: school.city || '',
        level: school.level || 'normal',
        type: school.type || '',
        tags: school.tags || [],
        logo: school.logo || '',
        website: school.website || '',
        address: school.address || '',
        phone: school.phone || '',
        graduateInfo: school.graduateInfo || {},
        ranking: school.ranking || {},
        status: 'active',
        source: 'chsi',
        updatedAt: Date.now()
      };

      if (existing.data) {
        if (forceUpdate) {
          // 强制更新
          await db.collection('schools').doc(existing.data._id).update(schoolData);
          updated++;
        } else {
          // 跳过已存在的
          continue;
        }
      } else {
        // 新增
        (schoolData as Record<string, unknown>).createdAt = Date.now();
        await db.collection('schools').add(schoolData);
        inserted++;
      }
    } catch (_error) {
      failed++;
      errors.push({ code: school.code, name: school.name, error: 'sync_failed' });
    }
  }

  // 同步完成后清理所有相关缓存，确保下次查询获取最新数据
  invalidateCache('completeness');
  invalidateCache('stats');
  invalidateCache('provinces');
  invalidateCache('hot');
  invalidateCache('search');
  invalidateCache('detail');
  logger.info(`[${requestId}] 已清理所有学校相关缓存`);

  // 获取同步后的状态（缓存已清理，会重新查询）
  const dataStatus = await checkDataCompleteness();

  logger.info(`[${requestId}] 同步完成: 新增=${inserted}, 更新=${updated}, 失败=${failed}`);

  return {
    code: 0,
    success: true,
    message: '同步完成',
    data: {
      inserted,
      updated,
      failed,
      errors: errors.slice(0, 10), // 只返回前10个错误
      currentCount: dataStatus.currentCount,
      totalUnits: TOTAL_GRADUATE_UNITS,
      isComplete: dataStatus.isComplete
    },
    requestId
  };
}

/**
 * 获取所有研究生招生单位（支持分页）
 */
async function getAllUnits(data, requestId) {
  const { page = 1, pageSize = 50, province, type, keyword } = data || {};
  const safePage = clampInt(page, QUERY_LIMITS.page);
  const safePageSize = clampInt(pageSize, {
    min: QUERY_LIMITS.unitsPageSize.min,
    max: QUERY_LIMITS.unitsPageSize.max,
    defaultValue: QUERY_LIMITS.unitsPageSize.defaultValue
  });
  const safeProvince = sanitizeFilterValue(province);
  const safeType = sanitizeFilterValue(type);
  const safeKeyword = sanitizeKeyword(keyword);

  // 检查数据完整性
  const dataStatus = await checkDataCompleteness();

  // 构建查询条件
  const query: Record<string, any> = { status: 'active' };

  if (safeProvince) {
    query.province = safeProvince;
  }

  if (safeType) {
    query.type = safeType;
  }

  if (safeKeyword) {
    query.$or = [
      { name: { $regex: escapeRegex(safeKeyword), $options: 'i' } },
      { shortName: { $regex: escapeRegex(safeKeyword), $options: 'i' } },
      { code: { $regex: escapeRegex(safeKeyword), $options: 'i' } }
    ];
  }

  const skip = (safePage - 1) * safePageSize;

  const [units, countResult] = await Promise.all([
    db
      .collection('schools')
      .where(query)
      .orderBy('code', 'asc')
      .skip(skip)
      .limit(safePageSize)
      .field({
        _id: true,
        code: true,
        name: true,
        shortName: true,
        province: true,
        city: true,
        type: true,
        level: true,
        tags: true,
        logo: true
      })
      .get(),
    db.collection('schools').where(query).count()
  ]);

  const response = {
    code: 0,
    success: true,
    data: {
      list: units.data || [],
      total: countResult.total || 0,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.ceil((countResult.total || 0) / safePageSize),
      totalUnits: TOTAL_GRADUATE_UNITS,
      currentCount: dataStatus.currentCount,
      isComplete: dataStatus.isComplete
    },
    requestId
  };

  // 如果数据不完整，添加提示信息
  if (dataStatus.needSync) {
    (response as Record<string, unknown>).warning = {
      message: `当前数据库中有${dataStatus.currentCount}个招生单位，研招网共有${TOTAL_GRADUATE_UNITS}个，数据不完整`,
      missingCount: TOTAL_GRADUATE_UNITS - dataStatus.currentCount,
      action: 'sync_from_chsi'
    };
  }

  return response;
}
