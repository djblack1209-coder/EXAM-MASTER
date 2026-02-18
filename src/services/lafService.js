/**
 * Sealos 后端服务封装
 * 已从阿里云 uniCloud 迁移到 Sealos
 *
 * ✅ P1-2: 统一错误处理 + 自动重试机制
 * ✅ P1-3: JSDoc 类型注释
 *
 * @module services/lafService
 */

// ✅ P0-2: 使用相对路径导入配置（避免别名解析问题）
import { logger } from '@/utils/logger.js';
import config from '../config/index.js';
// ✅ B021: 使用独立的 auth-storage 模块读取敏感数据（避免循环依赖）
import { getUserId, getToken } from './auth-storage.js';
// ✅ 6.3: 性能监控集成
import { perfMonitor } from '@/utils/core/performance.js';

// ✅ 从统一配置读取，支持环境变量
const BASE_URL = config.api.baseUrl;

// ✅ 3.5: 请求签名函数（FNV-1a 哈希，轻量级防篡改）
function _requestSign(path, timestamp) {
  const raw = `${path}:${timestamp}:${config.security.requestSignSalt}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

// ==================== P1-2/I001: 统一响应格式工具 ====================

/**
 * @typedef {Object} ApiResponse
 * @property {number} code - 状态码，0 表示成功，非0表示失败
 * @property {boolean} success - 是否成功
 * @property {string} [message] - 提示信息
 * @property {*} [data] - 响应数据（成功时）
 * @property {*} [error] - 错误详情（仅失败时）
 */

/**
 * @typedef {Object} RequestOptions
 * @property {Object} [headers] - 自定义请求头
 * @property {boolean} [skipAuth] - 是否跳过认证
 * @property {number} [maxRetries] - 最大重试次数（默认2）
 * @property {number} [timeout] - 请求超时毫秒数（默认30000）
 */

/**
 * ✅ I001: 统一响应规范化 - 将后端各种格式统一为标准 ApiResponse
 * 后端可能返回的格式：
 *   { code: 0, data: {...} }
 *   { success: true, data: {...} }
 *   { ok: true, id: "...", deleted: 1 }
 *   { error: "...", message: "..." }
 * 全部规范化为：{ code, success, message, data, error? }
 *
 * @param {Object} raw - 后端原始响应
 * @param {string} context - 调用上下文（用于日志）
 * @returns {ApiResponse}
 */
function normalizeResponse(raw, context = '') {
  if (!raw || typeof raw !== 'object') {
    return { code: -1, success: false, message: `${context ? `[${context}] ` : ''}响应为空`, data: null };
  }

  // 判断是否成功：兼容 success/code/ok 三种标识
  const isSuccess = raw.success === true || raw.code === 0 || raw.ok === true;
  const code = isSuccess ? 0 : (raw.code || raw.statusCode || -1);

  // 提取数据：兼容 data/list/items 等字段
  let data = raw.data !== undefined ? raw.data : null;
  if (data === null && raw.list) data = raw.list;
  if (data === null && raw.items) data = raw.items;
  // 对于 ok 格式的响应（如 mistake-manager），保留原始字段
  if (data === null && raw.ok !== undefined) {
    const { ok, ...rest } = raw;
    if (Object.keys(rest).length > 0) data = rest;
  }

  const message = raw.message || raw.msg || (isSuccess ? 'ok' : '请求失败');

  return {
    code,
    success: isSuccess,
    message,
    data,
    ...(raw.error ? { error: raw.error } : {})
  };
}

/**
 * 标准化错误对象
 * @param {Error|Object|string} error - 原始错误
 * @param {string} context - 错误上下文描述
 * @returns {ApiResponse}
 */
function normalizeError(error, context = '') {
  const prefix = context ? `[${context}] ` : '';

  if (error && typeof error === 'object') {
    return {
      code: error.code || error.statusCode || -1,
      success: false,
      message: prefix + (error.message || error.errMsg || '请求失败'),
      error: error,
      data: null
    };
  }

  return {
    code: -1,
    success: false,
    message: prefix + (typeof error === 'string' ? error : '未知错误'),
    error: error,
    data: null
  };
}

/**
 * 延迟函数（指数退避）
 * @param {number} attempt - 当前重试次数（从0开始）
 * @param {number} baseDelay - 基础延迟毫秒数
 * @returns {Promise<void>}
 */
function delay(attempt, baseDelay = 1000) {
  const ms = Math.min(baseDelay * Math.pow(2, attempt), 10000); // 最大10秒
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 启动时配置信息（仅开发环境）
if (process.env.NODE_ENV !== 'production') {
  logger.log('[LafService] 配置信息:', { BASE_URL, ENV: 'development' });
}

// ==================== 2.4: 请求去重 + 短TTL缓存 ====================

// 只读 action 白名单（仅这些 action 会被缓存）
const CACHEABLE_ACTIONS = new Set(['get', 'list', 'search', 'getAll', 'check', 'detail', 'hot', 'provinces', 'getOverview', 'getRecommendations', 'getHotResources', 'getCategories']);
const CACHE_TTL = 30000; // 30秒缓存（默认）
// 9.2: 分级 TTL — 静态/半静态数据使用更长缓存
const LONG_CACHE_ACTIONS = new Set(['provinces', 'getCategories', 'getHotResources']);
const LONG_CACHE_TTL = 300000; // 5分钟
const _cache = new Map(); // key → { data, expiry }
const _inflight = new Map(); // key → Promise

function _cacheKey(path, data) {
  return path + ':' + JSON.stringify(data);
}

function _getCache(key) {
  const entry = _cache.get(key);
  if (entry && Date.now() < entry.expiry) return entry.data;
  _cache.delete(key);
  return undefined;
}

function _setCache(key, data, action) {
  const ttl = (action && LONG_CACHE_ACTIONS.has(action)) ? LONG_CACHE_TTL : CACHE_TTL;
  _cache.set(key, { data, expiry: Date.now() + ttl });
  // 防止缓存无限增长，超过100条清理最旧的
  if (_cache.size > 100) {
    const first = _cache.keys().next().value;
    _cache.delete(first);
  }
}

// ✅ I002: 网络连通性预检
let _lastNetworkState = true;
function _checkNetwork() {
  return new Promise((resolve) => {
    uni.getNetworkType({
      success: (res) => {
        _lastNetworkState = res.networkType !== 'none';
        resolve(_lastNetworkState);
      },
      fail: () => resolve(_lastNetworkState) // 检测失败时用上次状态
    });
  });
}

// ✅ I004: 前端 API 限流器 — 滑动窗口，按路径分组
const _rateLimits = {
  // path前缀 → { maxRequests, windowMs }
  '/proxy-ai': { maxRequests: 10, windowMs: 60000 }, // AI: 10次/分钟
  '/ai-photo-search': { maxRequests: 5, windowMs: 60000 }, // 拍照搜题: 5次/分钟
  '/voice-service': { maxRequests: 8, windowMs: 60000 }, // 语音: 8次/分钟
  '_default': { maxRequests: 30, windowMs: 60000 } // 默认: 30次/分钟
};
const _requestTimestamps = new Map(); // path → number[]

function _checkRateLimit(path) {
  const config = Object.entries(_rateLimits).find(([prefix]) => prefix !== '_default' && path.startsWith(prefix));
  const { maxRequests, windowMs } = config ? config[1] : _rateLimits._default;
  const key = config ? config[0] : path;
  const now = Date.now();
  let timestamps = _requestTimestamps.get(key) || [];
  // 清除窗口外的时间戳
  timestamps = timestamps.filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((timestamps[0] + windowMs - now) / 1000) };
  }
  timestamps.push(now);
  _requestTimestamps.set(key, timestamps);
  return { allowed: true };
}

export const lafService = {
  /**
    * 通用请求方法（带自动重试）
    * @param {string} path - API 路径（如 '/rank-center'）
    * @param {Object} data - 请求体数据
    * @param {RequestOptions} options - 可选配置
    * @returns {Promise<ApiResponse>} 返回标准化响应
    * @throws {ApiResponse} 请求失败时抛出标准化错误对象
    */
  async request(path, data = {}, options = {}) {
    // ✅ I002: 网络连通性预检 — 离线时快速失败，避免等待超时
    if (!options.skipNetworkCheck) {
      const isOnline = await _checkNetwork();
      if (!isOnline) {
        throw normalizeError({ message: '当前无网络连接，请检查网络设置后重试', code: -2, errorType: 'offline' }, `请求 ${path}`);
      }
    }

    // ✅ I004: 前端限流 — 防止高频请求打爆后端
    if (!options.skipRateLimit) {
      const rateCheck = _checkRateLimit(path);
      if (!rateCheck.allowed) {
        throw normalizeError({ message: `操作过于频繁，请${rateCheck.retryAfter}秒后重试`, code: 429, errorType: 'rate_limit' }, `请求 ${path}`);
      }
    }

    // ✅ 2.4: 请求去重 + 缓存（仅对只读 action 生效）
    const action = data && data.action;
    const isCacheable = !options.skipCache && action && CACHEABLE_ACTIONS.has(action);
    const cKey = isCacheable ? _cacheKey(path, data) : null;

    if (isCacheable) {
      // 命中缓存直接返回
      const cached = _getCache(cKey);
      if (cached !== undefined) {
        return JSON.parse(JSON.stringify(cached)); // 返回深拷贝防止外部修改
      }
      // in-flight 去重：相同请求正在进行中，复用同一个 Promise
      if (_inflight.has(cKey)) {
        const result = await _inflight.get(cKey);
        return JSON.parse(JSON.stringify(result));
      }
    }

    // 包装实际请求逻辑，支持 inflight 去重
    const doRequest = async () => {
    // P1-2: 重试配置
      const maxRetries = options.maxRetries ?? 2; // 默认最多重试2次（共3次请求）
      const retryableStatuses = [408, 429, 500, 502, 503, 504]; // 可重试的HTTP状态码
      const nonRetryableStatuses = [400, 401, 403, 404, 405, 409, 422]; // 不可重试的客户端错误

      // 构建请求头
      const headers = {
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        ...options.headers
      };

      // ✅ 3.5: 请求时间戳 + 签名，防重放和篡改
      const timestamp = Date.now();
      headers['X-Request-Timestamp'] = String(timestamp);
      // 简单签名：path + timestamp 的 FNV-1a 哈希（轻量级，后端可选验证）
      headers['X-Request-Sign'] = _requestSign(path, timestamp);

      // ✅ B021: 使用 storageService 读取认证信息（支持加密存储）
      if (!options.skipAuth) {
        try {
          const token = getToken();
          const userId = getUserId();

          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          } else if (userId) {
            headers['X-User-Id'] = userId;
            if (data && typeof data === 'object' && !Array.isArray(data)) {
              data.userId = userId;
            }
          }
        } catch (e) {
          console.warn('[LafService] 获取认证信息失败:', e);
        }
      }

      // ✅ P1-2: 带重试的请求执行
      let lastError = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            console.warn(`[LafService] 🔄 第 ${attempt} 次重试: ${path}`);
            await delay(attempt - 1);
          }

          const result = await new Promise((resolve, reject) => {
            uni.request({
              url: BASE_URL + path,
              method: 'POST',
              data: data,
              header: headers,
              timeout: options.timeout || 30000,
              success: (res) => {
                if (res.statusCode === 200) {
                // 安全解析响应数据
                  let responseData = res.data;
                  if (typeof responseData === 'string') {
                    try {
                      responseData = JSON.parse(responseData);
                    } catch (parseErr) {
                      console.error(`[LafService] 响应数据解析失败: ${path}`, parseErr);
                      reject({ message: '服务器返回数据格式异常', statusCode: 200, parseError: true });
                      return;
                    }
                  }
                  resolve(responseData);
                } else if (res.statusCode === 401 || res.statusCode === 403) {
                // 认证失败，不重试
                  console.warn(`[LafService] 认证失败 (${res.statusCode}): ${path}`);
                  // ✅ I002: 全局广播认证失败，让 App 层统一处理（跳转登录等）
                  uni.$emit('authFailure', { statusCode: res.statusCode, path });
                  reject({ statusCode: res.statusCode, message: res.statusCode === 401 ? '登录已过期，请重新登录' : '没有访问权限', retryable: false, errorType: 'auth' });
                } else if (nonRetryableStatuses.includes(res.statusCode)) {
                // 客户端错误，不重试（400/404/422等）
                  reject({ statusCode: res.statusCode, message: `请求错误: ${res.statusCode}`, retryable: false, data: res.data });
                } else if (retryableStatuses.includes(res.statusCode) && attempt < maxRetries) {
                // 可重试的服务端错误（408/429/5xx）
                  reject({ statusCode: res.statusCode, message: `服务端错误: ${res.statusCode}`, retryable: true });
                } else {
                  reject(res.data || { message: `请求失败: ${res.statusCode}`, statusCode: res.statusCode });
                }
              },
              fail: (err) => {
              // 区分网络错误类型，提供更友好的提示
                let errorMsg = '网络请求失败';
                const errMsg = err.errMsg || '';
                if (errMsg.includes('timeout')) {
                  errorMsg = '请求超时，请检查网络后重试';
                } else if (errMsg.includes('abort')) {
                  errorMsg = '请求已取消';
                } else if (errMsg.includes('fail')) {
                  errorMsg = '网络连接失败，请检查网络设置';
                }
                reject({ message: errorMsg, error: err, errMsg: err.errMsg, retryable: !errMsg.includes('abort') });
              }
            });
          });

          // ✅ 6.3: 记录 API 响应耗时
          const _apiDuration = Date.now() - timestamp;
          perfMonitor.trackApi(path, _apiDuration, 200);

          // ✅ I001: 统一规范化所有成功响应
          return normalizeResponse(result, path);
        } catch (err) {
          lastError = err;
          // ✅ 6.3: 记录失败请求耗时
          const _apiDuration = Date.now() - timestamp;
          perfMonitor.trackApi(path, _apiDuration, err.statusCode || 0);
          // 如果不可重试或已达最大重试次数，直接抛出
          if (!err.retryable || attempt >= maxRetries) {
            console.error(`[LafService] ❌ 请求最终失败 (${attempt + 1}次尝试): ${path}`, err);
            throw normalizeError(err, `请求 ${path}`);
          }
        }
      }

      // 兜底：不应到达这里
      throw normalizeError(lastError, `请求 ${path}`);
    }; // end doRequest

    // ✅ 2.4: 执行请求，支持 inflight 去重 + 缓存写入
    if (isCacheable) {
      const promise = doRequest().then((result) => {
        _setCache(cKey, result, action);
        _inflight.delete(cKey);
        return result;
      }).catch((err) => {
        _inflight.delete(cKey);
        throw err;
      });
      _inflight.set(cKey, promise);
      return promise;
    }
    return doRequest();
  },

  /**
   * AI 代理请求（适配后端 action/payload 模式）
   * ⚠️ 重要：后端使用 action/payload 结构，不是直接传 messages
   *
   * @param {string} action - 操作类型：'generate_questions'(生成题目) | 'analyze'(错题分析) | 'chat'(通用聊天)
   * @param {Object} payload - 请求数据，根据 action 不同而不同
   * @param {Object} options - 可选配置 { model }
   * @returns {Promise} 返回格式：兼容 { success: true, data: ... } 和 { code: 0, data: ... }
   *
   * @example
   * // 生成题目
   * await lafService.proxyAI('generate_questions', { content: '线性代数知识点', questionCount: 5 })
   *
   * // 错题分析
   * await lafService.proxyAI('analyze', {
   *   question: '题目内容',
   *   userAnswer: 'A',
   *   correctAnswer: 'C'
   * })
   *
   * // 通用聊天
   * await lafService.proxyAI('chat', { messages: [...] })
   */
  async proxyAI(action, payload, _options = {}) {
    // ✅ 前置参数校验 - 防止传空值给后端
    if (!payload || typeof payload !== 'object') {
      console.error('❌ [LafService] 参数错误: payload 必须是对象');
      return {
        code: -1,
        success: false,
        message: '参数错误: payload 不能为空',
        data: null
      };
    }

    // ✅ 检查 content 字段（对于 chat 类型的 action，content 是必需的）
    if (action === 'chat' || action === 'analyze' || action === 'generate_questions') {
      if (!payload.content || typeof payload.content !== 'string' || payload.content.trim() === '') {
        console.error('❌ [LafService] 拦截: 尝试发送空内容给 AI');
        return {
          code: -1,
          success: false,
          message: '输入内容不能为空',
          data: null
        };
      }
      // 清理内容
      payload.content = payload.content.trim();
    }

    logger.log('[LafService] 🚀 发起 AI 请求:', {
      action,
      payloadKeys: Object.keys(payload || {}),
      payloadSample: JSON.stringify(payload).substring(0, 100),
      hasContent: !!payload.content,
      contentLength: payload.content ? payload.content.length : 0
    });

    try {
      // ✅ B021: 通过 storageService 获取用户ID
      const userId = getUserId() || 'anonymous';

      // 构建请求体（符合后端 action/payload 契约）
      const requestData = {
        action: action || 'chat',
        ...payload // 直接展开 payload，不嵌套
      };

      // 如果有 userId，添加到请求中
      if (userId !== 'anonymous') {
        requestData.userId = userId;
      }

      logger.log('[LafService] 📤 请求数据:', {
        action: requestData.action,
        hasContent: !!requestData.content,
        contentPreview: requestData.content ? requestData.content.substring(0, 50) + '...' : 'N/A',
        userId: userId
      });

      const response = await this.request('/proxy-ai', requestData);

      logger.log('[LafService] 📡 原始响应:', {
        hasSuccess: 'success' in response,
        hasCode: 'code' in response,
        hasData: 'data' in response,
        successValue: response.success,
        codeValue: response.code,
        dataType: typeof response.data,
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        fullResponse: response
      });

      // ✅ 核心修复：双重认证补丁 (Dual Auth Patch)
      // 如果后端返回 { success: true }，强制注入 code: 0
      // 这样既符合新标准，也能骗过老前端的 (res.code !== 0) 检查
      if (response.success === true) {
        response.code = 0; // <--- 关键兼容补丁！
        logger.log('[LafService] ✅ AI 响应成功 (兼容模式已激活)');
        logger.log('[LafService] 📦 返回数据:', {
          code: response.code,
          success: response.success,
          dataType: typeof response.data,
          dataLength: Array.isArray(response.data) ? response.data.length : 'N/A'
        });
        return response; // 直接返回，包含 code: 0 和 success: true
      }

      // 兼容旧格式：{ code: 0, data: {...} }
      if (response.code === 0) {
        logger.log('[LafService] ✅ AI 响应成功 (旧格式)');
        return response;
      }

      // 处理错误响应
      if (response.error || response.success === false) {
        const errorMsg = response.error || response.message || 'AI 服务异常';
        console.error('[LafService] ❌ AI 响应错误:', errorMsg);
        throw new Error(errorMsg);
      }

      // 未知格式，记录警告并返回错误而非静默注入成功状态
      console.warn('[LafService] ⚠️ 未知响应格式，视为异常:', response);
      return {
        code: -1,
        success: false,
        message: 'AI 服务返回了未知格式的响应',
        data: response,
        _fallback: true
      };

    } catch (error) {
      console.error('[LafService] ❌ AI 代理请求失败:', {
        error: error,
        message: error.message,
        stack: error.stack
      });

      // ✅ 修复：返回标准错误对象，同时提供离线降级提示
      // 这样调用方可以正常处理错误，而不会导致未捕获的异常
      const isOffline = error.message?.includes('网络') || error.errMsg?.includes('fail');
      return {
        code: -1,
        success: false,
        message: isOffline
          ? '当前网络不可用，AI功能暂时无法使用'
          : (error.message || 'AI 服务响应异常'),
        error: error,
        data: null,
        _offline: isOffline,
        _fallback: true
      };
    }
  },

  /**
    * 排行榜服务（替代 uniCloud.callFunction('rank-center')）
    * @param {{ action: string, userId?: string, nickName?: string, avatarUrl?: string, score?: number }} data - 排行榜请求数据
    * @returns {Promise<ApiResponse>} 返回操作结果
    */
  async rankCenter(data) {
    try {
      return await this.request('/rank-center', data);
    } catch (error) {
      console.error('[LafService] 排行榜请求失败:', error);
      return normalizeError(error, '排行榜请求');
    }
  },

  /**
    * 社交服务（Module 7 - 好友系统）
    * @param {{ action: string, userId?: string, targetUserId?: string, keyword?: string }} data - 社交数据
    * @returns {Promise<ApiResponse>} 返回操作结果
   *
   * 支持的 action:
   * - search_user: 搜索用户
   * - send_request: 发送好友请求
   * - handle_request: 处理好友请求
   * - get_friend_list: 获取好友列表
   * - get_friend_requests: 获取好友请求列表
   * - remove_friend: 删除好友
   */
  async socialService(data) {
    try {
      logger.log('[LafService] 社交服务请求:', data);
      const response = await this.request('/social-service', data);
      logger.log('[LafService] 社交服务响应:', response);
      return response;
    } catch (error) {
      console.error('[LafService] 社交服务请求失败:', error);
      return normalizeError(error, '社交服务请求');
    }
  },

  /**
    * 获取题库数据（带本地降级）
    * @param {string} userId - 用户ID
    * @returns {Promise<ApiResponse>} 返回题库数据
    */
  async getQuestionBank(userId) {
    try {
      const response = await this.request('/question-bank', {
        action: 'get',
        userId
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 获取题库失败:', error);
      return normalizeError(error, '获取题库');
    }
  },

  /**
   * Fetch random questions from backend (P002)
   * 从后端随机获取题目
   * @param {Object} [params] - Query parameters
   * @param {number} [params.count=20] - Number of questions to fetch
   * @param {string} [params.category] - Category filter
   * @param {string} [params.difficulty] - Difficulty filter ('easy'|'medium'|'hard')
   * @returns {Promise<ApiResponse>} Response with random questions array
   */
  async getRandomQuestions(params = {}) {
    try {
      const response = await this.request('/question-bank', {
        action: 'random',
        data: {
          count: params.count || 20,
          category: params.category,
          difficulty: params.difficulty
        }
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 随机获取题目失败:', error);
      return normalizeError(error, '随机获取题目');
    }
  },

  /**
   * Get user study statistics with local fallback (P004)
   * 获取用户学习统计，网络失败时降级使用本地数据
   * @param {string} userId - User ID
   * @returns {Promise<ApiResponse>} Stats data; check `data._source` for 'local_fallback' flag
   */
  async getStudyStats(userId) {
    try {
      const response = await this.request('/study-stats', {
        action: 'get',
        userId
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 获取学习统计失败，降级使用本地数据:', error);
      // P004: 降级到本地存储数据，而非返回错误
      try {
        const storageService = (await import('@/services/storageService.js')).default;
        const localStats = storageService.get('study_stats', {});
        const bankCount = (storageService.get('v30_bank', [])).length;
        const mistakeCount = (storageService.get('mistake_book', [])).length;
        return {
          code: 0,
          data: {
            totalQuestions: bankCount,
            totalMistakes: mistakeCount,
            studyDays: Object.keys(localStats).length,
            dailyStats: localStats,
            _source: 'local_fallback'
          },
          message: '使用本地缓存数据'
        };
      } catch (_e) {
        return normalizeError(error, '获取学习统计');
      }
    }
  },

  // ==================== AI 升级功能 v2.0 ====================

  /**
   * AI好友对话（角色化聊天）
   * @param {string} friendType - 好友类型: 'yan-cong'(学霸) | 'yan-man'(心理导师) | 'yan-shi'(名师) | 'yan-you'(研友)
   * @param {string} content - 用户消息
   * @param {Object} context - 上下文信息
   * @returns {Promise} 返回AI回复
   *
   * @example
   * await lafService.aiFriendChat('yan-cong', '我最近学习压力好大', { emotion: 'anxious' })
   */
  async aiFriendChat(friendType, content, context = {}) {
    if (!content || content.trim() === '') {
      return {
        code: -1,
        success: false,
        message: '消息内容不能为空',
        data: null
      };
    }

    logger.log('[LafService] 🤖 AI好友对话:', { friendType, contentLength: content.length });

    return await this.proxyAI('friend_chat', {
      content: content.trim(),
      friendType: friendType || 'yan-cong',
      context: {
        emotion: context.emotion || 'neutral',
        conversationCount: context.conversationCount || 0,
        studyState: context.studyState || '正常',
        recentAccuracy: context.recentAccuracy || 0,
        recentConversations: context.recentConversations || ''
      }
    });
  },

  /**
   * 智能组题（基于用户画像和学习数据）
   * @param {Object} userProfile - 用户画像
   * @param {Object} mistakeStats - 错题统计
   * @param {Object} recentPractice - 最近练习数据
   * @returns {Promise} 返回推荐题目列表
   *
   * @example
   * await lafService.adaptiveQuestionPick({
   *   targetSchool: '清华大学',
   *   weakSubjects: ['数学', '英语'],
   *   correctRate: 65,
   *   questionCount: 10
   * }, mistakeStats, recentPractice)
   */
  async adaptiveQuestionPick(userProfile = {}, mistakeStats = {}, recentPractice = {}) {
    logger.log('[LafService] 📊 智能组题请求:', {
      targetSchool: userProfile.targetSchool,
      questionCount: userProfile.questionCount
    });

    return await this.proxyAI('adaptive_pick', {
      content: '请根据学生画像生成个性化题目推荐',
      userProfile,
      mistakeStats,
      recentPractice
    });
  },

  /**
   * 资料理解出题
   * @param {string} materialText - 学习资料文本
   * @param {Object} options - 配置选项
   * @returns {Promise} 返回生成的题目
   *
   * @example
   * await lafService.materialUnderstand('马克思主义基本原理...', {
   *   materialType: '教材',
   *   difficulty: 3,
   *   topicFocus: '唯物辩证法'
   * })
   */
  async materialUnderstand(materialText, options = {}) {
    if (!materialText || materialText.trim() === '') {
      return {
        code: -1,
        success: false,
        message: '资料内容不能为空',
        data: null
      };
    }

    logger.log('[LafService] 📚 资料理解出题:', {
      textLength: materialText.length,
      materialType: options.materialType
    });

    return await this.proxyAI('material_understand', {
      content: materialText.trim(),
      materialType: options.materialType || '教材',
      difficulty: options.difficulty || 3,
      topicFocus: options.topicFocus || ''
    });
  },

  /**
   * 考点趋势预测
   * @param {Object} historicalData - 历年真题数据
   * @param {number} examYear - 目标考试年份
   * @param {string} subject - 学科
   * @returns {Promise} 返回预测结果
   *
   * @example
   * await lafService.trendPredict({
   *   topicFrequency: {...},
   *   recentHotspots: [...]
   * }, 2025, '政治')
   */
  async trendPredict(historicalData = {}, examYear = 2025, subject = '') {
    logger.log('[LafService] 🔮 考点趋势预测:', { examYear, subject });

    return await this.proxyAI('trend_predict', {
      content: '请预测考研热点考点',
      historicalData,
      examYear,
      subject
    });
  },

  /**
   * 错题深度分析（升级版）
   * @param {Object} mistakeData - 错题数据
   * @param {Object} userHistory - 用户历史数据
   * @returns {Promise} 返回分析结果
   *
   * @example
   * await lafService.deepMistakeAnalysis({
   *   question: '题目内容',
   *   options: ['A', 'B', 'C', 'D'],
   *   userAnswer: 'A',
   *   correctAnswer: 'C',
   *   category: '马原'
   * }, { topicAccuracy: 60, consecutiveErrors: 2 })
   */
  async deepMistakeAnalysis(mistakeData, userHistory = {}) {
    if (!mistakeData || !mistakeData.question) {
      return {
        code: -1,
        success: false,
        message: '错题数据不完整',
        data: null
      };
    }

    logger.log('[LafService] 🔍 错题深度分析:', {
      category: mistakeData.category,
      hasUserHistory: Object.keys(userHistory).length > 0
    });

    // 构建分析内容
    const analysisContent = `
题目：${mistakeData.question}
选项：${JSON.stringify(mistakeData.options || [])}
学生答案：${mistakeData.userAnswer || '未作答'}
正确答案：${mistakeData.correctAnswer || '未知'}
学科分类：${mistakeData.category || '未分类'}
答题用时：${mistakeData.duration || '未知'}秒
    `.trim();

    return await this.proxyAI('analyze', {
      content: analysisContent,
      question: mistakeData.question,
      userAnswer: mistakeData.userAnswer,
      correctAnswer: mistakeData.correctAnswer,
      context: {
        topicAccuracy: userHistory.topicAccuracy,
        typeAccuracy: userHistory.typeAccuracy,
        recentState: userHistory.recentState,
        consecutiveErrors: userHistory.consecutiveErrors
      }
    });
  },

  /**
   * 拍照搜题（视觉识别）
   * @param {string} imageBase64 - 图片Base64编码
   * @param {Object} options - 配置选项
   * @returns {Promise} 返回识别结果和匹配题目
   *
   * @example
   * await lafService.photoSearch(base64Image, { subject: 'math' })
   */
  async photoSearch(imageBase64, options = {}) {
    if (!imageBase64) {
      return {
        code: -1,
        success: false,
        message: '图片数据不能为空',
        data: null
      };
    }

    logger.log('[LafService] 📷 拍照搜题:', {
      imageSize: imageBase64.length,
      subject: options.subject
    });

    // 调用拍照搜题云函数
    try {
      const response = await this.request('/ai-photo-search', {
        imageBase64,
        subject: options.subject || '',
        context: options.context || ''
      });
      return response;
    } catch (error) {
      console.error('[LafService] 拍照搜题失败:', error);
      return normalizeError(error, '拍照搜题');
    }
  },

  /**
   * 获取AI好友对话记忆
   * @param {string} friendType - 好友类型
   * @returns {Promise} 返回历史对话
   */
  async getAiFriendMemory(friendType) {
    try {
      const userId = getUserId();

      if (!userId) {
        return { code: 0, success: true, data: [] };
      }

      const response = await this.request('/ai-friend-memory', {
        action: 'get',
        userId,
        friendType
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 获取AI好友记忆失败:', error);
      return normalizeError(error, '获取AI好友记忆');
    }
  },

  // ==================== 学校数据查询 ====================

  /**
   * 获取学校列表
   * @param {Object} params - 查询参数
   * @returns {Promise} 返回学校列表
   */
  async getSchoolList(params = {}) {
    try {
      const response = await this.request('/school-query', {
        action: 'list',
        data: params
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 获取学校列表失败:', error);
      return normalizeError(error, '获取学校列表');
    }
  },

  /**
   * 获取学校详情
   * @param {string} schoolId - 学校ID或代码
   * @returns {Promise} 返回学校详情
   */
  async getSchoolDetail(schoolId) {
    try {
      const response = await this.request('/school-query', {
        action: 'detail',
        data: { code: String(schoolId) }
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 获取学校详情失败:', error);
      return normalizeError(error, '获取学校详情');
    }
  },

  /**
   * 搜索学校
   * @param {string} keyword - 搜索关键词
   * @param {number} limit - 返回数量限制
   * @returns {Promise} 返回搜索结果
   */
  async searchSchools(keyword, limit = 10) {
    try {
      const response = await this.request('/school-query', {
        action: 'search',
        data: { keyword, limit }
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 搜索学校失败:', error);
      return normalizeError(error, '搜索学校');
    }
  },

  /**
   * 获取热门学校
   * @param {Object} params - 查询参数
   * @returns {Promise} 返回热门学校列表
   */
  async getHotSchools(params = {}) {
    try {
      const response = await this.request('/school-query', {
        action: 'hot',
        data: params
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 获取热门学校失败:', error);
      return { code: -1, success: false, data: [] };
    }
  },

  /**
   * 获取省份列表
   * @returns {Promise} 返回省份列表
   */
  async getProvinces() {
    try {
      const response = await this.request('/school-query', {
        action: 'provinces',
        data: {}
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 获取省份列表失败:', error);
      return { code: -1, success: false, data: [] };
    }
  },

  // ==================== 登录服务 ====================

  /**
   * 统一登录接口
   * @param {Object} params - 登录参数
   * @param {string} params.type - 登录类型: 'wechat' | 'qq' | 'email'
   * @param {string} params.code - 微信/QQ登录凭证
   * @param {string} params.email - 邮箱地址
   * @param {string} params.password - 密码
   * @param {string} params.verifyCode - 验证码（注册时需要）
   * @param {boolean} params.isRegister - 是否为注册
   * @returns {Promise} 返回登录结果
   */
  async login(params) {
    try {
      logger.log('[LafService] 🔐 登录请求:', { type: params.type });

      const response = await this.request('/login', params, { skipAuth: true });

      if (response.code === 0 && response.data) {
        logger.log('[LafService] ✅ 登录成功:', {
          userId: response.data.userId,
          isNewUser: response.data.isNewUser
        });
      }

      return response;
    } catch (error) {
      console.error('[LafService] ❌ 登录失败:', error);
      return {
        code: -1,
        success: false,
        message: error.message || '登录失败，请重试'
      };
    }
  },

  /**
   * 发送邮箱验证码
   * @param {string} email - 邮箱地址
   * @returns {Promise} 返回发送结果
   */
  async sendEmailCode(email) {
    try {
      logger.log('[LafService] 📧 发送验证码:', { email });

      const response = await this.request('/send-email-code', { email }, { skipAuth: true });
      return response;
    } catch (error) {
      console.error('[LafService] ❌ 发送验证码失败:', error);
      return {
        code: -1,
        success: false,
        message: error.message || '发送失败，请重试'
      };
    }
  },

  /**
   * 更新用户资料（昵称、头像等）
   * @param {Object} profileData - 用户资料数据
   * @returns {Promise} 返回更新结果
   *
   * @example
   * await lafService.updateUserProfile({
   *   nickname: '新昵称',
   *   avatar_url: 'https://...'
   * })
   */
  async updateUserProfile(profileData) {
    try {
      const userId = getUserId();

      if (!userId) {
        return {
          code: -1,
          success: false,
          message: '用户未登录'
        };
      }

      logger.log('[LafService] 📝 更新用户资料:', {
        userId,
        hasNickname: !!profileData.nickname,
        hasAvatar: !!profileData.avatar_url
      });

      const response = await this.request('/user-profile', {
        action: 'update',
        userId,
        ...profileData
      });
      return response;
    } catch (error) {
      console.error('[LafService] 更新用户资料失败:', error);
      return {
        code: -1,
        success: false,
        message: '更新失败，请重试'
      };
    }
  },

  // ==================== 收藏管理 ====================

  /**
   * 添加收藏
   * @param {Object} data - 收藏数据
   * @returns {Promise} 返回操作结果
   */
  async addFavorite(data) {
    try {
      const userId = getUserId();

      if (!userId) {
        return { code: -1, success: false, message: '请先登录' };
      }

      const response = await this.request('/favorite-manager', {
        action: 'add',
        userId,
        data
      });
      return response;
    } catch (error) {
      console.error('[LafService] 添加收藏失败:', error);
      return { code: -1, success: false, message: '添加失败' };
    }
  },

  /**
   * 获取收藏列表
   * @param {Object} params - 查询参数
   * @returns {Promise} 返回收藏列表
   */
  async getFavorites(params = {}) {
    try {
      const userId = getUserId();

      if (!userId) {
        return { code: -1, success: false, message: '请先登录', data: [] };
      }

      const response = await this.request('/favorite-manager', {
        action: 'get',
        userId,
        data: params
      });
      return response;
    } catch (error) {
      console.error('[LafService] 获取收藏失败:', error);
      return { code: -1, success: false, message: '获取失败', data: [] };
    }
  },

  /**
   * 删除收藏
   * @param {string} id - 收藏ID或题目ID
   * @returns {Promise} 返回操作结果
   */
  async removeFavorite(id) {
    try {
      const userId = getUserId();

      if (!userId) {
        return { code: -1, success: false, message: '请先登录' };
      }

      const response = await this.request('/favorite-manager', {
        action: 'remove',
        userId,
        data: { id }
      });
      return response;
    } catch (error) {
      console.error('[LafService] 删除收藏失败:', error);
      return { code: -1, success: false, message: '删除失败' };
    }
  },

  /**
   * 检查是否已收藏
   * @param {string|Array} questionId - 题目ID或ID数组
   * @returns {Promise} 返回检查结果
   */
  async checkFavorite(questionId) {
    try {
      const userId = getUserId();

      if (!userId) {
        return { code: 0, success: true, data: { isFavorite: false } };
      }

      const data = Array.isArray(questionId)
        ? { questionIds: questionId }
        : { questionId };

      const response = await this.request('/favorite-manager', {
        action: 'check',
        userId,
        data
      });
      return response;
    } catch (error) {
      console.error('[LafService] 检查收藏失败:', error);
      // ✅ B023: 返回真实错误，不伪装成功
      return { code: -1, success: false, data: { isFavorite: false }, message: '检查收藏状态失败', _errorSource: 'network' };
    }
  },

  // ==================== 学习资源推荐 ====================

  /**
   * 获取推荐学习资源
   * @param {Object} params - 查询参数
   * @returns {Promise} 返回推荐资源
   */
  async getLearningResources(params = {}) {
    try {
      const userId = getUserId();

      const response = await this.request('/learning-resource', {
        action: 'getRecommendations',
        userId: userId || '',
        data: params
      });
      return response;
    } catch (error) {
      console.error('[LafService] 获取学习资源失败:', error);
      return { code: -1, success: false, message: '获取失败', data: { resources: [] } };
    }
  },

  /**
   * 获取热门学习资源
   * @param {Object} params - 查询参数
   * @returns {Promise} 返回热门资源
   */
  async getHotResources(params = {}) {
    try {
      const userId = getUserId();

      const response = await this.request('/learning-resource', {
        action: 'getHotResources',
        userId: userId || '',
        data: params
      });
      return response;
    } catch (error) {
      console.error('[LafService] 获取热门资源失败:', error);
      return { code: -1, success: false, message: '获取失败', data: [] };
    }
  },

  /**
   * 搜索学习资源
   * @param {string} keyword - 搜索关键词
   * @param {Object} params - 其他参数
   * @returns {Promise} 返回搜索结果
   */
  async searchResources(keyword, params = {}) {
    try {
      const userId = getUserId();

      const response = await this.request('/learning-resource', {
        action: 'search',
        userId: userId || '',
        data: { keyword, ...params }
      });
      return response;
    } catch (error) {
      console.error('[LafService] 搜索资源失败:', error);
      return { code: -1, success: false, message: '搜索失败', data: { resources: [] } };
    }
  },

  /**
   * 获取资源分类
   * @returns {Promise} 返回分类列表
   */
  async getResourceCategories() {
    try {
      const response = await this.request('/learning-resource', {
        action: 'getCategories',
        userId: '',
        data: {}
      });
      return response;
    } catch (error) {
      console.error('[LafService] 获取资源分类失败:', error);
      return { code: -1, success: false, message: '获取失败', data: {} };
    }
  },

  // ==================== F012: 学习目标同步 ====================

  /**
   * 同步学习目标到后端
   * @param {string} userId - 用户ID
   * @param {Object} syncData - 同步数据 { goals, updatedAt }
   * @returns {Promise} 返回同步结果
   */
  async syncLearningGoals(userId, syncData) {
    try {
      if (!userId) return { code: -1, success: false, message: '用户未登录' };

      // 将本地目标逐个同步到后端（容错：单个失败不影响其他）
      const activeGoals = (syncData.goals || []).filter((g) => g.status === 'active');
      const results = [];
      let failCount = 0;

      for (const goal of activeGoals) {
        try {
          const response = await this.request('/learning-goal', {
            action: 'create',
            userId,
            data: {
              type: goal.type,
              targetValue: goal.targetValue,
              period: goal.period
            }
          });
          results.push(response);
        } catch (goalErr) {
          failCount++;
          console.warn('[LafService] 单个目标同步失败:', goal.type, goalErr);
          results.push({ code: -1, success: false, type: goal.type });
        }
      }

      const successCount = results.length - failCount;
      if (failCount > 0 && successCount === 0) {
        return { code: -1, success: false, message: '同步失败', data: results };
      }
      return { code: 0, success: true, message: `已同步 ${successCount}/${activeGoals.length} 个目标`, data: results };
    } catch (error) {
      console.warn('[LafService] 同步学习目标失败:', error);
      return { code: -1, success: false, message: '同步失败', _errorSource: 'network' };
    }
  },

  /**
   * 获取后端学习目标
   * @param {Object} params - 查询参数
   * @returns {Promise} 返回目标列表
   */
  async getLearningGoals(params = {}) {
    try {
      const userId = getUserId();
      if (!userId) return { code: -1, success: false, message: '请先登录', data: [] };

      const response = await this.request('/learning-goal', {
        action: 'get',
        userId,
        data: params
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 获取学习目标失败:', error);
      return { code: -1, success: false, message: '获取失败', data: [] };
    }
  },

  /**
   * 记录学习目标进度到后端
   * @param {string} type - 目标类型
   * @param {number} value - 进度值
   * @returns {Promise} 返回记录结果
   */
  async recordGoalProgress(type, value) {
    try {
      const userId = getUserId();
      if (!userId) return { code: -1, success: false, message: '请先登录' };

      const response = await this.request('/learning-goal', {
        action: 'recordProgress',
        userId,
        data: { type, value }
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 记录目标进度失败:', error);
      return { code: -1, success: false, message: '记录失败' };
    }
  },

  // ==================== F013: 成就系统同步 ====================

  /**
   * 检查并同步成就到后端
   * @returns {Promise} 返回新解锁的成就
   */
  async checkAchievements() {
    try {
      const userId = getUserId();
      if (!userId) return { code: -1, success: false, message: '请先登录', data: { newlyUnlocked: [] } };

      // 1.8: 先重试之前失败的解锁请求
      try {
        const pending = uni.getStorageSync('_pendingAchievements') || [];
        if (pending.length > 0) {
          const remaining = [];
          for (const aid of pending) {
            try {
              await this.request('/achievement-manager', { action: 'unlock', userId, data: { achievementId: aid } });
            } catch (_e) {
              remaining.push(aid);
            }
          }
          uni.setStorageSync('_pendingAchievements', remaining);
        }
      } catch (_e) { /* 重试失败不影响主流程 */ }

      const response = await this.request('/achievement-manager', {
        action: 'check',
        userId,
        data: {}
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 检查成就失败:', error);
      return { code: -1, success: false, message: '检查失败', data: { newlyUnlocked: [] } };
    }
  },

  /**
   * 获取所有成就（含解锁状态）
   * @returns {Promise} 返回成就列表
   */
  async getAllAchievements() {
    try {
      const userId = getUserId();
      if (!userId) return { code: -1, success: false, message: '请先登录', data: { achievements: [] } };

      const response = await this.request('/achievement-manager', {
        action: 'getAll',
        userId,
        data: {}
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 获取成就失败:', error);
      return { code: -1, success: false, message: '获取失败', data: { achievements: [] } };
    }
  },

  /**
   * 解锁指定成就
   * @param {string} achievementId - 成就ID
   * @returns {Promise} 返回解锁结果
   */
  async unlockAchievement(achievementId) {
    try {
      const userId = getUserId();
      if (!userId) return { code: -1, success: false, message: '请先登录' };

      const response = await this.request('/achievement-manager', {
        action: 'unlock',
        userId,
        data: { achievementId }
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 解锁成就失败，已缓存待重试:', achievementId, error);
      // 1.8: 失败时缓存到本地，下次 checkAchievements 时自动重试
      // 注意：此处直接用 uni.getStorageSync 而非 storageService，因为 storageService → lafService 存在循环依赖
      try {
        const pending = uni.getStorageSync('_pendingAchievements') || [];
        if (!pending.includes(achievementId)) {
          pending.push(achievementId);
          uni.setStorageSync('_pendingAchievements', pending);
        }
      } catch (_e) { /* 存储失败忽略 */ }
      return { code: -1, success: false, message: '解锁失败，将自动重试' };
    }
  },

  // ==================== F014: 邀请系统 ====================

  /**
   * 处理新邀请（后端验证+持久化）
   * @param {string} inviterId - 邀请人ID
   * @returns {Promise} 返回邀请结果
   */
  async handleInvite(inviterId) {
    try {
      const userId = getUserId();
      if (!userId) return { code: -1, success: false, message: '请先登录' };

      const response = await this.request('/invite-service', {
        action: 'handle',
        userId,
        inviterId
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 处理邀请失败:', error);
      return { code: -1, success: false, message: '邀请处理失败' };
    }
  },

  /**
   * 领取邀请奖励
   * @param {number} threshold - 奖励阈值（邀请人数）
   * @returns {Promise} 返回领取结果
   */
  async claimInviteReward(threshold) {
    try {
      const userId = getUserId();
      if (!userId) return { code: -1, success: false, message: '请先登录' };

      const response = await this.request('/invite-service', {
        action: 'claim_reward',
        userId,
        threshold
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 领取邀请奖励失败:', error);
      return { code: -1, success: false, message: '领取失败' };
    }
  },

  /**
   * 获取邀请信息（邀请码、邀请数、奖励列表）
   * @returns {Promise} 返回邀请信息
   */
  async getInviteInfo() {
    try {
      const userId = getUserId();
      if (!userId) return { code: -1, success: false, message: '请先登录', data: null };

      const response = await this.request('/invite-service', {
        action: 'get_info',
        userId
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 获取邀请信息失败:', error);
      return { code: -1, success: false, message: '获取失败', data: null };
    }
  },

  // ==================== 用户统计同步 ====================

  /**
   * 获取用户学习统计概览
   * @returns {Promise} 返回统计数据
   */
  async getUserStatsOverview() {
    try {
      const userId = getUserId();
      if (!userId) return { code: -1, success: false, message: '请先登录', data: null };

      const response = await this.request('/user-stats', {
        action: 'getOverview',
        userId,
        data: {}
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 获取用户统计失败:', error);
      return { code: -1, success: false, message: '获取失败', data: null };
    }
  },

  // ==================== 文档转换 ====================

  /**
   * 获取支持的转换类型列表
   */
  async getDocConvertTypes() {
    try {
      return await this.request('/doc-convert', { action: 'get_types' });
    } catch (error) {
      console.warn('[LafService] 获取转换类型失败:', error);
      return { code: -1, success: false, message: '获取失败', data: null };
    }
  },

  /**
   * 提交文档转换任务
   * @param {string} fileBase64 - 文件 base64
   * @param {string} fileName - 文件名
   * @param {string} convertType - 转换类型 (pdf2img/img2pdf/word2pdf/pdf2word/excel2pdf/ppt2pdf)
   * @param {object} options - 可选参数
   */
  async submitDocConvert(fileBase64, fileName, convertType, options = {}) {
    try {
      return await this.request('/doc-convert', {
        action: 'convert',
        fileBase64,
        fileName,
        convertType,
        ...options
      });
    } catch (error) {
      console.warn('[LafService] 提交转换任务失败:', error);
      return { code: -1, success: false, message: '提交失败', data: null };
    }
  },

  /**
   * 查询转换任务状态
   * @param {string} taskId - 任务ID
   */
  async getDocConvertStatus(taskId) {
    try {
      return await this.request('/doc-convert', { action: 'get_status', taskId });
    } catch (error) {
      console.warn('[LafService] 查询转换状态失败:', error);
      return { code: -1, success: false, message: '查询失败', data: null };
    }
  },

  /**
   * 获取转换结果（下载链接）
   * @param {string} taskId - 任务ID
   */
  async getDocConvertResult(taskId) {
    try {
      return await this.request('/doc-convert', { action: 'get_result', taskId });
    } catch (error) {
      console.warn('[LafService] 获取转换结果失败:', error);
      return { code: -1, success: false, message: '获取失败', data: null };
    }
  },

  // ==================== 证件照处理 ====================

  /**
   * 获取证件照尺寸和颜色配置
   */
  async getPhotoConfig() {
    try {
      const [sizes, colors] = await Promise.all([
        this.request('/photo-bg', { action: 'get_sizes' }),
        this.request('/photo-bg', { action: 'get_colors' })
      ]);
      return {
        code: 0,
        success: true,
        data: {
          sizes: sizes.code === 0 ? sizes.data : null,
          colors: colors.code === 0 ? colors.data : null
        }
      };
    } catch (error) {
      console.warn('[LafService] 获取证件照配置失败:', error);
      return { code: -1, success: false, message: '获取失败', data: null };
    }
  },

  /**
   * 证件照一键处理（抠图 + 换背景 + 裁剪）
   * @param {string} imageBase64 - 图片 base64
   * @param {string} bgColor - 背景颜色 key (white/blue/red/gray/light_blue/dark_blue)
   * @param {string} size - 尺寸 key (1inch/2inch/small2inch/passport/visa)
   * @param {object} options - 可选参数 { beauty: boolean }
   */
  async processIdPhoto(imageBase64, bgColor, size, options = {}) {
    try {
      return await this.request('/photo-bg', {
        action: 'process',
        imageBase64,
        bgColor,
        size,
        ...options
      });
    } catch (error) {
      console.warn('[LafService] 证件照处理失败:', error);
      return { code: -1, success: false, message: '处理失败', data: null };
    }
  },

  /**
   * 仅去除背景（返回透明PNG）
   * @param {string} imageBase64 - 图片 base64
   */
  async removePhotoBg(imageBase64) {
    try {
      return await this.request('/photo-bg', {
        action: 'remove_bg',
        imageBase64
      });
    } catch (error) {
      console.warn('[LafService] 去除背景失败:', error);
      return { code: -1, success: false, message: '处理失败', data: null };
    }
  }
};
