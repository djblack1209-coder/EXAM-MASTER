/**
 * 请求基础设施层
 * 包含：请求签名、统一响应规范化、错误处理、指数退避重试、
 *       LRU 缓存、请求去重、网络预检、前端限流、双服务器自动切换
 *
 * ⚠️ 隐藏约束（Chesterton's Fence）：
 * - _requestSign 使用 FNV-1a 而非 crypto：小程序环境无原生 crypto API
 * - getStorageValue 使用原生 uni.getStorageSync：避免 storageService 循环依赖
 *
 * @module services/api/domains/_request-core
 */

import { logger } from '@/utils/logger.js';
import config from '../../../config/index.js';
import { getUserId, getToken } from '../../auth-storage.js';
import { perfMonitor } from '@/utils/core/performance.js';

// ==================== 双服务器自动切换 ====================

const BASE_URL = config.api.baseUrl;
const FALLBACK_URL = config.api.fallbackUrl;

let _primaryFailCount = 0;
let _useFallback = false;
let _fallbackTimer = null;

function getActiveBaseUrl() {
  if (!FALLBACK_URL) return BASE_URL;
  if (_useFallback) return FALLBACK_URL;
  return BASE_URL;
}

function markPrimaryFail() {
  if (!FALLBACK_URL) return;
  _primaryFailCount++;
  if (_primaryFailCount >= config.api.fallbackThreshold && !_useFallback) {
    _useFallback = true;
    logger.warn('[API] 主后端连续失败，切换到备用:', FALLBACK_URL);
    clearTimeout(_fallbackTimer);
    _fallbackTimer = setTimeout(() => {
      _useFallback = false;
      _primaryFailCount = 0;
      logger.log('[API] 尝试恢复主后端:', BASE_URL);
    }, config.api.fallbackRecoveryMs);
  }
}

function markPrimarySuccess() {
  _primaryFailCount = 0;
  if (_useFallback) {
    _useFallback = false;
    clearTimeout(_fallbackTimer);
    logger.log('[API] 主后端恢复正常');
  }
}

// ==================== 请求签名（FNV-1a 哈希，轻量级防篡改） ====================

function _requestSign(path, timestamp) {
  const raw = `${path}:${timestamp}:${config.security.requestSignSalt}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

// ==================== 统一响应格式工具 ====================

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
 * @property {boolean} [skipNetworkCheck] - 是否跳过网络连通性检查
 * @property {boolean} [skipRateLimit] - 是否跳过前端限流
 * @property {boolean} [skipCache] - 是否跳过只读缓存
 * @property {boolean} [suppressAuthFailure] - 是否抑制全局 authFailure 广播
 * @property {boolean} [redactErrors] - 凭据请求只保留固定错误消息/数字状态，不保留原始错误
 * @property {number} [maxRetries] - 最大重试次数（默认2）
 * @property {number} [coldStartRetries] - Laf 冷启动重试次数（默认6）
 * @property {number} [timeout] - 请求超时毫秒数（默认30000）
 */

/**
 * 统一响应规范化 - 将后端各种格式统一为标准 ApiResponse
 * @param {Object} raw - 后端原始响应
 * @param {string} context - 调用上下文（用于日志）
 * @returns {ApiResponse}
 */
export function normalizeResponse(raw, context = '') {
  if (!raw || typeof raw !== 'object') {
    return { code: -1, success: false, message: `${context ? `[${context}] ` : ''}响应为空`, data: null };
  }

  const isSuccess = raw.success === true || raw.code === 0 || raw.ok === true;
  const code = isSuccess ? 0 : raw.code || raw.statusCode || -1;

  let data = raw.data !== undefined ? raw.data : null;
  if (data === null && raw.list) data = raw.list;
  if (data === null && raw.items) data = raw.items;
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

// 技术错误 → 用户友好提示映射
const FRIENDLY_ERROR_MAP = [
  { pattern: /网络|network|net::|Failed to fetch/i, message: '网络连接异常，请检查网络后重试' },
  { pattern: /timeout|超时|ECONNABORTED/i, message: '请求超时，请稍后重试' },
  { pattern: /401|登录.*过期|token.*expired/i, message: '登录已过期，请重新登录' },
  { pattern: /403|没有.*权限|forbidden/i, message: '暂无访问权限' },
  { pattern: /404|not found/i, message: '请求的服务暂不可用' },
  { pattern: /429|频繁|rate.?limit/i, message: '操作过于频繁，请稍后再试' },
  { pattern: /5\d{2}|服务器|server error/i, message: '服务器繁忙，请稍后重试' },
  { pattern: /abort|cancel/i, message: '请求已取消' },
  { pattern: /parse|JSON|格式/i, message: '数据解析异常，请重试' }
];

// 凭据失败只保留客户端固定业务提示；完整匹配，不能夹带上游描述或凭据。
const PUBLIC_AUTH_ERROR_MESSAGES = new Map([
  ['邮箱不能为空', '邮箱不能为空'],
  ['邮箱格式不正确', '邮箱格式不正确'],
  ['请提供验证码或密码', '请提供验证码或密码'],
  ['新用户注册需先完成邮箱验证码校验', '该邮箱未注册，请先注册'],
  ['该邮箱未注册，请先注册', '该邮箱未注册，请先注册'],
  ['该账号未设置密码，请使用验证码登录', '该账号未设置密码，请使用验证码登录'],
  ['密码错误', '密码错误'],
  ['验证码错误', '验证码错误'],
  ['验证码错误或已过期', '验证码错误或已过期'],
  ['验证码已过期，请重新获取', '验证码已过期，请重新获取'],
  ['验证失败次数过多，请5分钟后再试', '验证失败次数过多，请5分钟后再试'],
  ['密码强度不足，请按要求设置密码', '密码强度不足，请按要求设置密码'],
  ['QQ 登录校验失败，请重新登录', 'QQ 登录校验失败，请重新登录'],
  ['QQ 登录凭证无效，请重新登录', 'QQ 登录凭证无效，请重新登录'],
  ['QQ 登录参数无效', 'QQ 登录参数无效'],
  ['QQ 登录平台无效', 'QQ 登录平台无效'],
  ['QQ 回调地址无效，请检查配置', 'QQ 回调地址无效，请检查配置'],
  ['QQ 账户关联冲突，请联系管理员', 'QQ 账户关联冲突，请联系管理员'],
  ['桌面授权未配置，请使用邮箱登录', '桌面授权未配置，请使用邮箱登录'],
  ['桌面授权未完成，请重新登录', '桌面授权未完成，请重新登录'],
  ['桌面授权已过期，请重新登录', '桌面授权已过期，请重新登录'],
  ['桌面授权参数无效', '桌面授权参数无效'],
  ['桌面授权来源无效', '桌面授权来源无效'],
  ['桌面授权来源或应用不一致', '桌面授权来源或应用不一致'],
  ['桌面授权校验失败', '桌面授权校验失败'],
  ['本次桌面授权已处理，请返回桌面', '本次桌面授权已处理，请返回桌面'],
  ['本次桌面授权已取消，请重新登录', '本次桌面授权已取消，请重新登录'],
  ['本次桌面授权已领取，请重新登录', '本次桌面授权已领取，请重新登录'],
  ['用户取消授权', '用户取消授权'],
  ['账户不可用，请重新登录', '账户不可用，请重新登录']
]);

function _toFriendlyMessage(rawMsg) {
  if (!rawMsg) return '操作失败，请重试';
  for (const rule of FRIENDLY_ERROR_MAP) {
    if (rule.pattern.test(rawMsg)) return rule.message;
  }
  if (/^[\u4e00-\u9fa5]/.test(rawMsg) && rawMsg.length < 30) return rawMsg;
  return '操作失败，请重试';
}

/**
 * 标准化错误对象
 * @param {Error|Object|string} error - 原始错误
 * @param {string} context - 错误上下文描述
 * @returns {ApiResponse}
 */
export function normalizeError(error, context = '', { redact = false } = {}) {
  const rawMessage =
    error && typeof error === 'object'
      ? error.message || error.errMsg || '请求失败'
      : typeof error === 'string'
        ? error
        : '未知错误';

  if (redact) {
    const code = error?.code || error?.statusCode;
    const publicMessage =
      typeof rawMessage === 'string'
        ? PUBLIC_AUTH_ERROR_MESSAGES.get(rawMessage) ||
          (rawMessage.startsWith('密码强度不足:') ? '密码强度不足，请按要求设置密码' : null)
        : null;
    const message =
      typeof rawMessage === 'string' ? FRIENDLY_ERROR_MAP.find((rule) => rule.pattern.test(rawMessage))?.message : null;
    const fallback =
      code === 401
        ? '登录验证失败，请重新登录'
        : code === 429
          ? '操作过于频繁，请稍后再试'
          : code >= 500 && code <= 599
            ? '服务器繁忙，请稍后重试'
            : code === 400
              ? '请求信息无效，请重试'
              : '操作失败，请重试';
    return {
      code: Number.isSafeInteger(code) && code >= -2 && code <= 599 ? code : -1,
      success: false,
      message: publicMessage || message || fallback,
      data: null
    };
  }
  const friendlyMessage = _toFriendlyMessage(rawMessage);

  if (error && typeof error === 'object') {
    return {
      code: error.code || error.statusCode || -1,
      success: false,
      message: friendlyMessage,
      _rawMessage: context ? `[${context}] ${rawMessage}` : rawMessage,
      error: error,
      data: null
    };
  }

  return {
    code: -1,
    success: false,
    message: friendlyMessage,
    _rawMessage: context ? `[${context}] ${rawMessage}` : rawMessage,
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
function delay(attempt, baseDelay = config.retry.retryDelay) {
  const ms = Math.min(baseDelay * Math.pow(2, attempt), config.retry.maxRetryDelay);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 读取本地存储（避免 storageService 循环依赖）
 */
export function getStorageValue(key, defaultValue) {
  try {
    if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
      const value = uni.getStorageSync(key);
      return value === '' || value === undefined || value === null ? defaultValue : value;
    }
  } catch {
    // ignore
  }
  return defaultValue;
}

// 启动时配置信息（仅开发环境）
if (process.env.NODE_ENV !== 'production') {
  logger.log('[LafService] 配置信息:', { BASE_URL, ENV: 'development' });
}

// ==================== 请求去重 + LRU 缓存 ====================

const CACHEABLE_ACTIONS = new Set([
  'get',
  'list',
  'search',
  'getAll',
  'check',
  'detail',
  'hot',
  'provinces',
  'getOverview',
  'getRecommendations',
  'getHotResources',
  'getCategories'
]);
const CACHE_TTL = config.cache?.defaultTtl || 30000;
const LONG_CACHE_ACTIONS = new Set(['provinces', 'getCategories', 'getHotResources']);
const LONG_CACHE_TTL = config.cache?.longTtl || 300000;
const CACHE_MAX_SIZE = config.cache?.maxSize || 100;
const _cache = new Map();
const _inflight = new Map();

const deepClone = typeof structuredClone === 'function' ? structuredClone : (obj) => JSON.parse(JSON.stringify(obj));

const pendingRequests = new Map();

export function getRequestKey(url, data, options = {}) {
  return _getAuthCacheScope(options) + '|' + url + '|' + JSON.stringify(data || {});
}

/**
 * 取消指定的待处理请求
 * @param {string} key - 由 getRequestKey 生成的请求标识
 * @returns {boolean} 是否成功取消
 */
export function abortRequest(key) {
  const entry = pendingRequests.get(key);
  if (entry && typeof entry.abort === 'function') {
    entry.abort();
    pendingRequests.delete(key);
    return true;
  }
  return false;
}

// 定期清理过期缓存（每60秒），避免内存泄漏
let _cacheCleanupTimer = null;
function _startCacheCleanup() {
  if (_cacheCleanupTimer) return;
  _cacheCleanupTimer = setInterval(() => {
    const now = Date.now();
    _cache.forEach((entry, key) => {
      if (now >= entry.expiry) _cache.delete(key);
    });
    for (const [key, timestamps] of _requestTimestamps.entries()) {
      const fresh = timestamps.filter((t) => now - t < 120000);
      if (fresh.length === 0) {
        _requestTimestamps.delete(key);
      } else {
        _requestTimestamps.set(key, fresh);
      }
    }
  }, 60000);
}
function _stopCacheCleanup() {
  if (_cacheCleanupTimer) {
    clearInterval(_cacheCleanupTimer);
    _cacheCleanupTimer = null;
  }
}
_startCacheCleanup();
let _authGeneration = 0;
let _authIdentity = null;
function _invalidateAuthRequests() {
  _authGeneration++;
  _cache.clear();
  for (const entry of pendingRequests.values()) {
    if (entry.authenticated) entry.abort();
  }
}
uni.$on('user:logout', _invalidateAuthRequests);
// HMR dispose — 防止热重载时 setInterval 累积
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    _stopCacheCleanup();
    _invalidateAuthRequests();
    uni.$off('user:logout', _invalidateAuthRequests);
  });
}

function _cacheKey(path, data, scope = 'public') {
  return path + ':' + scope + ':' + JSON.stringify(data);
}

function _getAuthCacheScope(options = {}) {
  if (options.skipAuth) return 'public';
  try {
    const userId = getUserId();
    const token = getToken();
    if (!_authIdentity || _authIdentity.userId !== userId || _authIdentity.token !== token) {
      _authIdentity = { userId, token };
      _authGeneration++;
      _cache.clear();
    }
    // 密钥只参与内存中的身份比较，不进入请求标识、缓存键或日志。
    return `uid:${userId || 'anon'}:generation:${_authGeneration}`;
  } catch (_e) {
    // ignore
  }
  return `anon:generation:${_authGeneration}`;
}

function _getCache(key) {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiry) {
    _cache.delete(key);
    return undefined;
  }
  _cache.delete(key);
  _cache.set(key, entry);
  return entry.data;
}

function _setCache(key, data, action) {
  const ttl = action && LONG_CACHE_ACTIONS.has(action) ? LONG_CACHE_TTL : CACHE_TTL;
  _cache.delete(key);
  _cache.set(key, { data, expiry: Date.now() + ttl });
  while (_cache.size > CACHE_MAX_SIZE) {
    const oldest = _cache.keys().next().value;
    _cache.delete(oldest);
  }
}

// ==================== 网络预检 + 限流 ====================

let _lastNetworkState = true;
function _checkNetwork() {
  return new Promise((resolve) => {
    uni.getNetworkType({
      success: (res) => {
        _lastNetworkState = res.networkType !== 'none';
        resolve(_lastNetworkState);
      },
      fail: () => resolve(_lastNetworkState)
    });
  });
}

const _rateLimits = {
  '/proxy-ai': config.rateLimit.ai,
  '/ai-photo-search': config.rateLimit.photoSearch,
  '/voice-service': config.rateLimit.voice,
  _default: config.rateLimit.default
};
const _requestTimestamps = new Map();

function _checkRateLimit(path) {
  const cfg = Object.entries(_rateLimits).find(([prefix]) => prefix !== '_default' && path.startsWith(prefix));
  const { maxRequests, windowMs } = cfg ? cfg[1] : _rateLimits._default;
  const key = cfg ? cfg[0] : path;
  const now = Date.now();
  let timestamps = _requestTimestamps.get(key) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    return { allowed: false, retryAfter: Math.ceil((timestamps[0] + windowMs - now) / 1000) };
  }
  timestamps.push(now);
  _requestTimestamps.set(key, timestamps);
  return { allowed: true };
}

// ==================== 核心请求方法 ====================

/**
 * 通用请求方法（带自动重试、缓存、去重、签名）
 * @param {string} path - API 路径（如 '/rank-center'）
 * @param {Object} data - 请求体数据
 * @param {RequestOptions} options - 可选配置
 * @returns {Promise<ApiResponse>} 返回标准化响应
 * @throws {ApiResponse} 请求失败时抛出标准化错误对象
 */
export async function request(path, data = {}, options = {}) {
  const requestError = (error) => normalizeError(error, `请求 ${path}`, { redact: options.redactErrors });
  const authScope = _getAuthCacheScope(options);
  let cancelled = false;
  let activeTask = null;
  let rejectActive = null;
  const assertActive = () => {
    if (cancelled) throw { message: '请求已取消', retryable: false, errorType: 'cancelled' };
    if (!options.skipAuth && authScope !== _getAuthCacheScope(options)) {
      throw { message: '账户已变化，请重新操作', retryable: false, errorType: 'account_changed' };
    }
  };
  // 网络连通性预检 — 离线时快速失败
  if (!options.skipNetworkCheck) {
    const isOnline = await _checkNetwork();
    try {
      assertActive();
    } catch (error) {
      throw requestError(error);
    }
    if (!isOnline) {
      throw requestError({ message: '当前无网络连接，请检查网络设置后重试', code: -2, errorType: 'offline' });
    }
  }

  // 前端限流 — 防止高频请求打爆后端
  if (!options.skipRateLimit) {
    const rateCheck = _checkRateLimit(path);
    if (!rateCheck.allowed) {
      throw requestError({
        message: `操作过于频繁，请${rateCheck.retryAfter}秒后重试`,
        code: 429,
        errorType: 'rate_limit'
      });
    }
  }

  // 请求去重 + 缓存（仅对只读 action 生效）
  const action = data && data.action;
  const isCacheable = !options.skipCache && action && CACHEABLE_ACTIONS.has(action);
  const cacheScope = isCacheable ? authScope : null;
  const cKey = isCacheable ? _cacheKey(path, data, cacheScope) : null;

  if (isCacheable) {
    const cached = _getCache(cKey);
    if (cached !== undefined) {
      return deepClone(cached);
    }
    if (_inflight.has(cKey)) {
      const result = await _inflight.get(cKey);
      return deepClone(result);
    }
  }

  const doRequest = async () => {
    const maxRetries = options.maxRetries ?? config.retry.maxRetries;
    const coldStartRetries = Math.max(maxRetries, options.coldStartRetries ?? config.retry.coldStartRetries);
    const maxRetryLoop = Math.max(maxRetries, coldStartRetries);
    const retryableStatuses = config.retry.retryableStatusCodes;
    const nonRetryableStatuses = [400, 401, 403, 404, 405, 409, 422];

    const headers = {
      'Content-Type': 'application/json',
      // 注意：不设置 Accept-Encoding，浏览器/小程序会自动协商压缩编码
      ...options.headers
    };

    const timestamp = Date.now();
    headers['X-Request-Timestamp'] = String(timestamp);
    headers['X-Request-Sign'] = _requestSign(path, timestamp);

    let requestData = data;
    if (!options.skipAuth) {
      try {
        const token = getToken();
        const userId = getUserId();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        } else if (userId) {
          headers['X-User-Id'] = userId;
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            requestData = { ...data, userId };
          }
        }
      } catch (e) {
        logger.warn('[LafService] 获取认证信息失败:', e);
      }
    }

    let lastError = null;
    for (let attempt = 0; attempt <= maxRetryLoop; attempt++) {
      try {
        if (attempt > 0) {
          logger.warn(`[LafService] 🔄 第 ${attempt} 次重试: ${path}`);
          await delay(attempt - 1);
        }
        assertActive();

        const result = await new Promise((resolve, reject) => {
          rejectActive = reject;
          activeTask = uni.request({
            url: getActiveBaseUrl() + path,
            method: 'POST',
            data: requestData,
            header: headers,
            timeout: options.timeout || config.api.timeout,
            success: (res) => {
              try {
                assertActive();
              } catch (error) {
                reject(error);
                return;
              }
              if (res.statusCode === 200) {
                let responseData = res.data;
                if (typeof responseData === 'string') {
                  try {
                    responseData = JSON.parse(responseData);
                  } catch (parseErr) {
                    logger.error(
                      `[LafService] 响应数据解析失败: ${path}`,
                      options.redactErrors ? { errorType: 'parse' } : parseErr
                    );
                    reject({ message: '服务器返回数据格式异常', statusCode: 200, parseError: true });
                    return;
                  }
                }
                markPrimarySuccess();
                resolve(responseData);
              } else if (res.statusCode === 401 || res.statusCode === 403) {
                logger.warn(`[LafService] 认证失败 (${res.statusCode}): ${path}`);
                if (res.statusCode === 401 && !options.suppressAuthFailure) {
                  uni.$emit('authFailure', { statusCode: res.statusCode, path });
                }
                reject({
                  statusCode: res.statusCode,
                  message: res.statusCode === 401 ? '登录已过期，请重新登录' : '没有访问权限',
                  retryable: false,
                  errorType: 'auth'
                });
              } else if (nonRetryableStatuses.includes(res.statusCode)) {
                const bodyText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || '');
                const isLafColdStart404 =
                  res.statusCode === 404 && /(Function\s*Not\s*Found|Cannot\s+POST|\bNot\s+Found\b)/i.test(bodyText);
                if (isLafColdStart404 && attempt < coldStartRetries) {
                  reject({
                    statusCode: res.statusCode,
                    message: `Laf 冷启动: ${res.statusCode}`,
                    retryable: true,
                    retryPolicy: 'laf_cold_start',
                    data: res.data
                  });
                } else {
                  reject({
                    statusCode: res.statusCode,
                    message: `请求错误: ${res.statusCode}`,
                    retryable: false,
                    data: res.data
                  });
                }
              } else if (retryableStatuses.includes(res.statusCode) && attempt < maxRetries) {
                reject({ statusCode: res.statusCode, message: `服务端错误: ${res.statusCode}`, retryable: true });
              } else {
                reject(res.data || { message: `请求失败: ${res.statusCode}`, statusCode: res.statusCode });
              }
            },
            fail: (err) => {
              try {
                assertActive();
              } catch (error) {
                reject(error);
                return;
              }
              markPrimaryFail();
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
        activeTask = null;
        rejectActive = null;
        assertActive();

        const _apiDuration = Date.now() - timestamp;
        perfMonitor.trackApi(path, _apiDuration, 200);

        const normalized = normalizeResponse(result, path);
        if (!options.redactErrors) return normalized;
        if (!normalized.success) return requestError(normalized);
        const { error: _privateError, ...response } = normalized;
        return response;
      } catch (err) {
        lastError = err;
        const _apiDuration = Date.now() - timestamp;
        perfMonitor.trackApi(path, _apiDuration, err.statusCode || 0);
        const retryBudget = err.retryPolicy === 'laf_cold_start' ? coldStartRetries : maxRetries;
        if (!err.retryable || attempt >= retryBudget) {
          logger.error(
            `[LafService] ❌ 请求最终失败 (${attempt + 1}次尝试): ${path}`,
            options.redactErrors ? { code: requestError(err).code } : err
          );
          throw requestError(err);
        }
      }
    }

    throw requestError(lastError);
  };

  // 执行请求，支持 inflight 去重 + 缓存写入
  const requestKey = authScope + '|' + path + '|' + JSON.stringify(data || {});

  // 非缓存请求也做去重
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey).promise.then((r) => deepClone(r));
  }

  const entry = {
    authenticated: !options.skipAuth,
    abort: () => {
      cancelled = true;
      // 即使平台没有取消回调，也立即拒收本次结果。
      rejectActive?.({ message: '请求已取消', retryable: false, errorType: 'cancelled' });
      activeTask?.abort?.();
      if (isCacheable) _inflight.delete(cKey);
    }
  };
  const promise = doRequest()
    .then((result) => {
      assertActive();
      if (isCacheable) _setCache(cKey, result, action);
      return result;
    })
    .catch((error) => {
      throw !options.redactErrors && error.success === false ? error : requestError(error);
    })
    .finally(() => {
      if (pendingRequests.get(requestKey) === entry) pendingRequests.delete(requestKey);
      if (isCacheable && _inflight.get(cKey) === promise) _inflight.delete(cKey);
      activeTask = null;
      rejectActive = null;
    });
  entry.promise = promise;
  pendingRequests.set(requestKey, entry);
  if (isCacheable) _inflight.set(cKey, promise);
  return promise;
}
