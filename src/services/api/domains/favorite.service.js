/**
 * Favorite Service - 领域服务方法
 * 公共 request 基础设施复用 ai.service.js（避免 6 份 2000+ 行重复代码）
 */
import { aiService } from './ai.service.js';

// 复用 ai.service 的 request 方法
const request = (path, data, options) => aiService.request(path, data, options);

export const favoriteService = {
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
        throw normalizeError(
          { message: '当前无网络连接，请检查网络设置后重试', code: -2, errorType: 'offline' },
          `请求 ${path}`
        );
      }
    }

    // ✅ I004: 前端限流 — 防止高频请求打爆后端
    if (!options.skipRateLimit) {
      const rateCheck = _checkRateLimit(path);
      if (!rateCheck.allowed) {
        throw normalizeError(
          { message: `操作过于频繁，请${rateCheck.retryAfter}秒后重试`, code: 429, errorType: 'rate_limit' },
          `请求 ${path}`
        );
      }
    }

    // ✅ 2.4: 请求去重 + 缓存（仅对只读 action 生效）
    const action = data && data.action;
    const isCacheable = !options.skipCache && action && CACHEABLE_ACTIONS.has(action);
    const cacheScope = isCacheable ? _getAuthCacheScope(options) : null;
    const cKey = isCacheable ? _cacheKey(path, data, cacheScope) : null;

    if (isCacheable) {
      // 命中缓存直接返回
      const cached = _getCache(cKey);
      if (cached !== undefined) {
        return deepClone(cached); // 返回深拷贝防止外部修改
      }
      // in-flight 去重：相同请求正在进行中，复用同一个 Promise
      if (_inflight.has(cKey)) {
        const result = await _inflight.get(cKey);
        return deepClone(result);
      }
    }

    // 包装实际请求逻辑，支持 inflight 去重
    const doRequest = async () => {
      // P1-2: 重试配置
      const maxRetries = options.maxRetries ?? 2; // 默认最多重试2次（共3次请求）
      const coldStartRetries = Math.max(maxRetries, options.coldStartRetries ?? 6);
      const maxRetryLoop = Math.max(maxRetries, coldStartRetries);
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
          logger.warn('[LafService] 获取认证信息失败:', e);
        }
      }

      // ✅ P1-2: 带重试的请求执行
      let lastError = null;
      for (let attempt = 0; attempt <= maxRetryLoop; attempt++) {
        try {
          if (attempt > 0) {
            logger.warn(`[LafService] 🔄 第 ${attempt} 次重试: ${path}`);
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
                      logger.error(`[LafService] 响应数据解析失败: ${path}`, parseErr);
                      reject({ message: '服务器返回数据格式异常', statusCode: 200, parseError: true });
                      return;
                    }
                  }
                  resolve(responseData);
                } else if (res.statusCode === 401 || res.statusCode === 403) {
                  // 认证相关失败，不重试
                  logger.warn(`[LafService] 认证失败 (${res.statusCode}): ${path}`);

                  // 仅对 401（凭证失效）广播全局 authFailure；403 往往是业务权限问题，不应强制登出
                  // 同时允许调用方通过 suppressAuthFailure 控制静默处理
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
                  // 客户端错误，不重试（400/404/422等）
                  // 例外：Laf 冷启动/网关抖动可能返回 404（Function Not Found / Cannot POST / Not Found），此时应重试
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
          const retryBudget = err.retryPolicy === 'laf_cold_start' ? coldStartRetries : maxRetries;
          // 如果不可重试或已达最大重试次数，直接抛出
          if (!err.retryable || attempt >= retryBudget) {
            logger.error(`[LafService] ❌ 请求最终失败 (${attempt + 1}次尝试): ${path}`, err);
            throw normalizeError(err, `请求 ${path}`);
          }
        }
      }

      // 兜底：不应到达这里
      throw normalizeError(lastError, `请求 ${path}`);
    }; // end doRequest

    // ✅ 2.4: 执行请求，支持 inflight 去重 + 缓存写入
    // ✅ 2.6: 请求去重 — 相同 URL+params 复用同一 Promise
    const requestKey = getRequestKey(path, data);

    if (isCacheable) {
      const promise = doRequest()
        .then((result) => {
          _setCache(cKey, result, action);
          _inflight.delete(cKey);
          pendingRequests.delete(requestKey);
          return result;
        })
        .catch((err) => {
          _inflight.delete(cKey);
          pendingRequests.delete(requestKey);
          throw err;
        });
      _inflight.set(cKey, promise);
      pendingRequests.set(requestKey, { promise, abort: null });
      return promise;
    }

    // 非缓存请求也做去重
    if (pendingRequests.has(requestKey)) {
      return pendingRequests.get(requestKey).promise.then((r) => deepClone(r));
    }

    const promise = doRequest()
      .then((result) => {
        pendingRequests.delete(requestKey);
        return result;
      })
      .catch((err) => {
        pendingRequests.delete(requestKey);
        throw err;
      });
    pendingRequests.set(requestKey, { promise, abort: null });
    return promise;
  },

  /**
   * 智能代理请求（适配后端 action/payload 模式）
   * ⚠️ 重要：后端使用 action/payload 结构，不是直接传 messages
   *
   * @param {string} action - 操作类型：'generate_questions'(生成题目) | 'analyze'(错题分析) | 'chat'(通用聊天)
   * @param {Object} payload - 请求数据，根据 action 不同而不同
   * @param {Object} _options - 可选配置 { model }
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
      logger.error('❌ [LafService] 参数错误: payload 必须是对象');
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
        logger.error('❌ [LafService] 拦截: 尝试发送空内容给智能');
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

    logger.log('[LafService] 🚀 发起智能请求:', {
      action,
      payloadKeys: Object.keys(payload || {}),
      payloadSample: JSON.stringify(payload).substring(0, 100),
      hasContent: !!payload.content,
      contentLength: payload.content ? payload.content.length : 0
    });

    try {
      // ✅ B021: 通过 storageService 获取用户ID
      let userId;
      try {
        userId = getUserId() || 'anonymous';
      } catch (authErr) {
        logger.warn('[LafService] getUserId() 异常，降级为 anonymous:', authErr);
        userId = 'anonymous';
      }

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

      // ✅ P1-2: 智能请求超时保护（修复 setTimeout 泄漏）
      const aiTimeout = _options.timeout || config.ai.timeout || 60000;
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('AI_TIMEOUT')), aiTimeout);
      });

      let response;
      try {
        response = await Promise.race([
          request('/proxy-ai', requestData, { timeout: aiTimeout, maxRetries: 1 }),
          timeoutPromise
        ]);
      } finally {
        clearTimeout(timeoutId);
      }

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
        logger.log('[LafService] ✅ 智能响应成功 (兼容模式已激活)');
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
        logger.log('[LafService] ✅ 智能响应成功 (旧格式)');
        return response;
      }

      // 处理错误响应
      if (response.error || response.success === false) {
        const errorMsg = response.error || response.message || '智能服务异常';
        logger.error('[LafService] ❌ 智能响应错误:', errorMsg);
        throw new Error(errorMsg);
      }

      // 未知格式，记录警告并返回错误而非静默注入成功状态
      logger.warn('[LafService] ⚠️ 未知响应格式，视为异常:', response);
      return {
        code: -1,
        success: false,
        message: '智能服务返回了未知格式的响应',
        data: response,
        _fallback: true
      };
    } catch (error) {
      logger.error('[LafService] ❌ 智能代理请求失败:', {
        error: error,
        message: error.message,
        stack: error.stack
      });

      // ✅ 修复：返回标准错误对象，同时提供离线降级提示
      // 这样调用方可以正常处理错误，而不会导致未捕获的异常
      const isTimeout = error.message === 'AI_TIMEOUT';
      const isOffline = error.message?.includes('网络') || error.errMsg?.includes('fail');

      if (isTimeout) {
        logger.warn('[LafService] ⏱️ 智能请求超时');
        return {
          code: -1,
          success: false,
          message: '智能思考时间过长，请稍后重试或简化您的问题',
          error: error,
          data: null,
          _timeout: true,
          _fallback: true
        };
      }

      return {
        code: -1,
        success: false,
        message: isOffline ? '当前网络不可用，智能功能暂时无法使用' : error.message || '智能服务响应异常',
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
      return await request('/rank-center', data);
    } catch (error) {
      logger.error('[LafService] 排行榜请求失败:', error);
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
      const response = await request('/social-service', data);
      logger.log('[LafService] 社交服务响应:', response);
      return response;
    } catch (error) {
      logger.error('[LafService] 社交服务请求失败:', error);
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
      const response = await request('/question-bank', {
        action: 'get',
        userId
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 获取题库失败:', error);
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
      const response = await request('/question-bank', {
        action: 'random',
        data: {
          count: params.count || 20,
          category: params.category,
          difficulty: params.difficulty
        }
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 随机获取题目失败:', error);
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
      const response = await request('/study-stats', {
        action: 'get',
        userId
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 获取学习统计失败，降级使用本地数据:', error);
      // P004: 降级到本地存储数据，而非返回错误
      try {
        const localStats = getStorageValue('study_stats', {});
        const bankCount = getStorageValue('v30_bank', []).length;
        const mistakeCount = getStorageValue('mistake_book', []).length;
        return {
          code: 0,
          success: true,
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

  // ==================== 智能升级功能 v2.0 ====================

  /**
   * 智能好友对话（角色化聊天）
   * @param {string} friendType - 好友类型: 'yan-cong'(学霸) | 'yan-man'(心理导师) | 'yan-shi'(名师) | 'yan-you'(研友)
   * @param {string} content - 用户消息
   * @param {Object} context - 上下文信息
   * @returns {Promise} 返回智能回复
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

    logger.log('[LafService] 🤖 智能好友对话:', { friendType, contentLength: content.length });

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
      const response = await request('/ai-photo-search', {
        imageBase64,
        subject: options.subject || '',
        context: options.context || ''
      });
      return response;
    } catch (error) {
      logger.error('[LafService] 拍照搜题失败:', error);
      return normalizeError(error, '拍照搜题');
    }
  },

  /**
   * 获取智能好友对话记忆
   * @param {string} friendType - 好友类型
   * @returns {Promise} 返回历史对话
   */
  async getAiFriendMemory(friendType) {
    try {
      const userId = getUserId();

      if (!userId) {
        return { code: 0, success: true, data: [] };
      }

      const response = await request('/ai-friend-memory', {
        action: 'get',
        userId,
        friendType
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 获取智能好友记忆失败:', error);
      return normalizeError(error, '获取智能好友记忆');
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
      const response = await request('/school-query', {
        action: 'list',
        data: params
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 获取学校列表失败:', error);
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
      const response = await request('/school-query', {
        action: 'detail',
        data: { code: String(schoolId) }
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 获取学校详情失败:', error);
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
      const response = await request('/school-query', {
        action: 'search',
        data: { keyword, limit }
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 搜索学校失败:', error);
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
      const response = await request('/school-query', {
        action: 'hot',
        data: params
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 获取热门学校失败:', error);
      return { code: -1, success: false, data: [] };
    }
  },

  /**
   * 获取省份列表
   * @returns {Promise} 返回省份列表
   */
  async getProvinces() {
    try {
      const response = await request('/school-query', {
        action: 'provinces',
        data: {}
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 获取省份列表失败:', error);
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

      const response = await request('/login', params, { skipAuth: true });

      if (response.code === 0 && response.data) {
        logger.log('[LafService] ✅ 登录成功:', {
          userId: response.data.userId,
          isNewUser: response.data.isNewUser
        });
      }

      return response;
    } catch (error) {
      logger.error('[LafService] ❌ 登录失败:', error);
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

      const response = await request('/send-email-code', { email }, { skipAuth: true, maxRetries: 0, timeout: 45000 });
      return response;
    } catch (error) {
      logger.error('[LafService] ❌ 发送验证码失败:', error);
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

      const response = await request('/user-profile', {
        action: 'update',
        userId,
        ...profileData
      });
      return response;
    } catch (error) {
      logger.error('[LafService] 更新用户资料失败:', error);
      return {
        code: -1,
        success: false,
        message: '更新失败，请重试'
      };
    }
  },

  // ==================== C5: 账号注销 ====================

  /**
   * 申请注销账号（7天冷静期）
   * @returns {Promise<ApiResponse>}
   */
  async requestAccountDeletion() {
    try {
      const response = await request('/account-delete', { action: 'request' });
      return response;
    } catch (error) {
      logger.error('[LafService] 申请注销失败:', error);
      return normalizeError(error, '申请注销');
    }
  },

  /**
   * 撤销注销申请
   * @returns {Promise<ApiResponse>}
   */
  async cancelAccountDeletion() {
    try {
      const response = await request('/account-delete', { action: 'cancel' });
      return response;
    } catch (error) {
      logger.error('[LafService] 撤销注销失败:', error);
      return normalizeError(error, '撤销注销');
    }
  },

  /**
   * 查询账号注销状态
   * @returns {Promise<ApiResponse>} data: { status, deletionScheduledAt, remainingDays }
   */
  async getAccountDeletionStatus() {
    try {
      const response = await request('/account-delete', { action: 'status' });
      return response;
    } catch (error) {
      logger.error('[LafService] 查询注销状态失败:', error);
      return normalizeError(error, '查询注销状态');
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

      const response = await request('/favorite-manager', {
        action: 'add',
        userId,
        data
      });
      return response;
    } catch (error) {
      logger.error('[LafService] 添加收藏失败:', error);
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

      const response = await request('/favorite-manager', {
        action: 'get',
        userId,
        data: params
      });
      return response;
    } catch (error) {
      logger.error('[LafService] 获取收藏失败:', error);
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

      const response = await request('/favorite-manager', {
        action: 'remove',
        userId,
        data: { id }
      });
      return response;
    } catch (error) {
      logger.error('[LafService] 删除收藏失败:', error);
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

      const data = Array.isArray(questionId) ? { questionIds: questionId } : { questionId };

      const response = await request('/favorite-manager', {
        action: 'check',
        userId,
        data
      });
      return response;
    } catch (error) {
      logger.error('[LafService] 检查收藏失败:', error);
      // ✅ B023: 返回真实错误，不伪装成功
      return {
        code: -1,
        success: false,
        data: { isFavorite: false },
        message: '检查收藏状态失败',
        _errorSource: 'network'
      };
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

      const response = await request('/learning-resource', {
        action: 'getRecommendations',
        userId: userId || '',
        data: params
      });
      return response;
    } catch (error) {
      logger.error('[LafService] 获取学习资源失败:', error);
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

      const response = await request('/learning-resource', {
        action: 'getHotResources',
        userId: userId || '',
        data: params
      });
      return response;
    } catch (error) {
      logger.error('[LafService] 获取热门资源失败:', error);
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

      const response = await request('/learning-resource', {
        action: 'search',
        userId: userId || '',
        data: { keyword, ...params }
      });
      return response;
    } catch (error) {
      logger.error('[LafService] 搜索资源失败:', error);
      return { code: -1, success: false, message: '搜索失败', data: { resources: [] } };
    }
  },

  /**
   * 获取资源分类
   * @returns {Promise} 返回分类列表
   */
  async getResourceCategories() {
    try {
      const response = await request('/learning-resource', {
        action: 'getCategories',
        userId: '',
        data: {}
      });
      return response;
    } catch (error) {
      logger.error('[LafService] 获取资源分类失败:', error);
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
          const response = await request('/learning-goal', {
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
          logger.warn('[LafService] 单个目标同步失败:', goal.type, goalErr);
          results.push({ code: -1, success: false, type: goal.type });
        }
      }

      const successCount = results.length - failCount;
      if (failCount > 0 && successCount === 0) {
        return { code: -1, success: false, message: '同步失败', data: results };
      }
      return { code: 0, success: true, message: `已同步 ${successCount}/${activeGoals.length} 个目标`, data: results };
    } catch (error) {
      logger.warn('[LafService] 同步学习目标失败:', error);
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

      const response = await request('/learning-goal', {
        action: 'get',
        userId,
        data: params
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 获取学习目标失败:', error);
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

      const response = await request('/learning-goal', {
        action: 'recordProgress',
        userId,
        data: { type, value }
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 记录目标进度失败:', error);
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
              await request('/achievement-manager', { action: 'unlock', userId, data: { achievementId: aid } });
            } catch (_e) {
              remaining.push(aid);
            }
          }
          uni.setStorageSync('_pendingAchievements', remaining);
        }
      } catch (_e) {
        /* 重试失败不影响主流程 */
      }

      const response = await request('/achievement-manager', {
        action: 'check',
        userId,
        data: {}
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 检查成就失败:', error);
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

      const response = await request('/achievement-manager', {
        action: 'getAll',
        userId,
        data: {}
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 获取成就失败:', error);
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

      const response = await request('/achievement-manager', {
        action: 'unlock',
        userId,
        data: { achievementId }
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 解锁成就失败，已缓存待重试:', achievementId, error);
      // 1.8: 失败时缓存到本地，下次 checkAchievements 时自动重试
      // 注意：此处直接用 uni.getStorageSync 而非 storageService，因为 storageService → lafService 存在循环依赖
      try {
        const pending = uni.getStorageSync('_pendingAchievements') || [];
        if (!pending.includes(achievementId)) {
          pending.push(achievementId);
          uni.setStorageSync('_pendingAchievements', pending);
        }
      } catch (_e) {
        /* 存储失败忽略 */
      }
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
  },

  /**
   * 获取邀请信息（邀请码、邀请数、奖励列表）
   * @returns {Promise} 返回邀请信息
   */
  async getInviteInfo() {
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

      const response = await request('/user-stats', {
        action: 'getOverview',
        userId,
        data: {}
      });
      return response;
    } catch (error) {
      logger.warn('[LafService] 获取用户统计失败:', error);
      return { code: -1, success: false, message: '获取失败', data: null };
    }
  },

  // ==================== 首页动态数据 ====================

  /**
   * 获取首页动态数据（金句、公式、公告等）
   * 对应后端 /getHomeData 接口
   * @returns {Promise<ApiResponse>} 返回首页数据
   */
  async getHomeData() {
    try {
      const response = await request(
        '/getHomeData',
        {},
        {
          skipAuth: true,
          timeout: 10000
        }
      );
      return response;
    } catch (error) {
      logger.warn('[LafService] 获取首页数据失败:', error);
      return { code: -1, success: false, message: '获取失败', data: null };
    }
  },

  /**
   * 仅去除背景（返回透明PNG）
   * @param {string} imageBase64 - 图片 base64
   */
  async removePhotoBg(imageBase64) {
    try {
      return await request('/photo-bg', {
        action: 'remove_bg',
        imageBase64
      });
    } catch (error) {
      logger.warn('[LafService] 去除背景失败:', error);
      return { code: -1, success: false, message: '处理失败', data: null };
    }
  },

  // ==================== 语音服务 ====================

  /**
   * 语音转文字
   * @param {string} audioBase64 - 音频 base64
   * @param {string} audioFormat - 音频格式（默认 mp3）
   * @param {object} options - 额外参数（hotwords/prompt）
   */
  async speechToText(audioBase64, audioFormat = 'mp3', options = {}) {
    try {
      return await request(
        '/voice-service',
        {
          action: 'speech_to_text',
          audioBase64,
          audioFormat,
          ...options
        },
        { timeout: 60000, maxRetries: 1 }
      );
    } catch (error) {
      logger.warn('[LafService] 语音识别失败:', error);
      return normalizeError(error, '语音识别');
    }
  },

  /**
   * 文字转语音
   * @param {string} text - 待合成文本
   * @param {object} options - 额外参数（voice/speed/volume/format）
   */
  async textToSpeech(text, options = {}) {
    try {
      return await request(
        '/voice-service',
        {
          action: 'text_to_speech',
          text,
          ...options
        },
        { timeout: 60000, maxRetries: 1 }
      );
    } catch (error) {
      logger.warn('[LafService] 语音合成失败:', error);
      return normalizeError(error, '语音合成');
    }
  },

  /**
   * 获取可用音色列表
   */
  async getVoiceOptions() {
    try {
      return await request('/voice-service', { action: 'get_voices' });
    } catch (error) {
      logger.warn('[LafService] 获取音色列表失败:', error);
      return normalizeError(error, '获取音色列表');
    }
  },

  // ==================== AI课堂服务（搬运自 OpenMAIC 前端对接层） ====================

  /**
   * 创建AI课程（异步生成）
   * @param {string} topic - 学习主题
   * @param {string} subject - 考研科目 (politics/english/math/professional)
   * @param {string} [materials] - 学习资料文本
   * @param {number} [sceneCount=6] - 场景数量
   */
  async createLesson(topic, subject, materials, sceneCount = 6) {
    try {
      return await request(
        '/lesson-generator',
        { action: 'create', data: { topic, subject, materials, sceneCount } },
        { timeout: 30000, maxRetries: 1 }
      );
    } catch (error) {
      logger.warn('[LafService] 创建课程失败:', error);
      return normalizeError(error, '创建课程');
    }
  },

  /**
   * 查询课程生成进度
   * @param {string} lessonId - 课程ID
   */
  async getLessonStatus(lessonId) {
    try {
      return await request('/lesson-generator', {
        action: 'status',
        data: { lessonId }
      });
    } catch (error) {
      logger.warn('[LafService] 查询课程状态失败:', error);
      return normalizeError(error, '查询课程状态');
    }
  },

  /**
   * 获取课程详情（含大纲和场景）
   * @param {string} lessonId - 课程ID
   */
  async getLessonDetail(lessonId) {
    try {
      return await request('/lesson-generator', {
        action: 'detail',
        data: { lessonId }
      });
    } catch (error) {
      logger.warn('[LafService] 获取课程详情失败:', error);
      return normalizeError(error, '获取课程详情');
    }
  },

  /**
   * 获取用户课程列表
   * @param {number} [page=1]
   * @param {number} [pageSize=20]
   */
  async getLessonList(page = 1, pageSize = 20) {
    try {
      return await request('/lesson-generator', {
        action: 'list',
        data: { page, pageSize }
      });
    } catch (error) {
      logger.warn('[LafService] 获取课程列表失败:', error);
      return normalizeError(error, '获取课程列表');
    }
  },

  /**
   * 删除课程
   * @param {string} lessonId
   */
  async deleteLesson(lessonId) {
    try {
      return await request('/lesson-generator', {
        action: 'delete',
        data: { lessonId }
      });
    } catch (error) {
      logger.warn('[LafService] 删除课程失败:', error);
      return normalizeError(error, '删除课程');
    }
  },

  /**
   * 创建课堂会话（开始上课）
   * @param {string} lessonId
   */
  async startClassroom(lessonId) {
    try {
      return await request('/agent-orchestrator', { action: 'start_session', data: { lessonId } }, { timeout: 15000 });
    } catch (error) {
      logger.warn('[LafService] 创建课堂会话失败:', error);
      return normalizeError(error, '创建课堂会话');
    }
  },

  /**
   * 发送课堂消息（推进多Agent对话）
   * @param {string} sessionId
   * @param {string} [message] - 用户消息（可选，不传则自动推进）
   */
  async sendClassroomMessage(sessionId, message) {
    try {
      return await request(
        '/agent-orchestrator',
        { action: 'send_message', data: { sessionId, message } },
        { timeout: 60000, maxRetries: 1 }
      );
    } catch (error) {
      logger.warn('[LafService] 课堂消息发送失败:', error);
      return normalizeError(error, '课堂消息发送');
    }
  },

  /**
   * 获取课堂状态
   * @param {string} sessionId
   */
  async getClassroomState(sessionId) {
    try {
      return await request('/agent-orchestrator', {
        action: 'get_state',
        data: { sessionId }
      });
    } catch (error) {
      logger.warn('[LafService] 获取课堂状态失败:', error);
      return normalizeError(error, '获取课堂状态');
    }
  },

  /**
   * 结束课堂
   * @param {string} sessionId
   */
  async endClassroom(sessionId) {
    try {
      return await request('/agent-orchestrator', {
        action: 'end_session',
        data: { sessionId }
      });
    } catch (error) {
      logger.warn('[LafService] 结束课堂失败:', error);
      return normalizeError(error, '结束课堂');
    }
  },

  /**
   * AI批改单题
   * @param {object} params - { questionId, question, correctAnswer, userAnswer, subject, topic, lessonId, sceneId }
   */
  async gradeQuiz(params) {
    try {
      return await request('/ai-quiz-grade', { action: 'grade', data: params }, { timeout: 30000, maxRetries: 1 });
    } catch (error) {
      logger.warn('[LafService] AI批改失败:', error);
      return normalizeError(error, 'AI批改');
    }
  },

  /**
   * AI批量批改
   * @param {Array} answers - 答案数组
   * @param {object} context - { subject, topic, lessonId, sceneId }
   */
  async batchGradeQuiz(answers, context = {}) {
    try {
      return await request(
        '/ai-quiz-grade',
        { action: 'batch_grade', data: { answers, ...context } },
        { timeout: 120000, maxRetries: 0 }
      );
    } catch (error) {
      logger.warn('[LafService] AI批量批改失败:', error);
      return normalizeError(error, 'AI批量批改');
    }
  },

  /**
   * 获取AI批改结果
   * @param {object} params - { lessonId, questionId, page, pageSize }
   */
  async getGradeResults(params = {}) {
    try {
      return await request('/ai-quiz-grade', {
        action: 'get_results',
        data: params
      });
    } catch (error) {
      logger.warn('[LafService] 获取批改结果失败:', error);
      return normalizeError(error, '获取批改结果');
    }
  },

  // ==================== AI诊断闭环服务 ====================

  /**
   * 生成AI诊断报告（刷题结束时调用）
   * @param {string} sessionId - 刷题会话ID
   */
  async generateDiagnosis(sessionId) {
    try {
      return await request(
        '/ai-diagnosis',
        { action: 'generate', data: { sessionId } },
        { timeout: 60000, maxRetries: 1 }
      );
    } catch (error) {
      logger.warn('[LafService] 生成AI诊断失败:', error);
      return normalizeError(error, '生成AI诊断');
    }
  },

  /**
   * 获取AI诊断报告
   * @param {object} params - { diagnosisId } 或 { sessionId }
   */
  async getDiagnosis(params) {
    try {
      return await request('/ai-diagnosis', {
        action: 'get',
        data: params
      });
    } catch (error) {
      logger.warn('[LafService] 获取诊断报告失败:', error);
      return normalizeError(error, '获取诊断报告');
    }
  },

  /**
   * 获取历史诊断列表
   * @param {number} [page=1]
   * @param {number} [pageSize=10]
   */
  async getDiagnosisList(page = 1, pageSize = 10) {
    try {
      return await request('/ai-diagnosis', {
        action: 'list',
        data: { page, pageSize }
      });
    } catch (error) {
      logger.warn('[LafService] 获取诊断列表失败:', error);
      return normalizeError(error, '获取诊断列表');
    }
  },

  /**
   * 获取AI推荐的复习计划（基于诊断+SM-2）
   */
  async getReviewPlan() {
    try {
      return await request('/ai-diagnosis', {
        action: 'get_review_plan',
        data: {}
      });
    } catch (error) {
      logger.warn('[LafService] 获取复习计划失败:', error);
      return normalizeError(error, '获取复习计划');
    }
  },

  // ==================== FSRS 个性化优化 ====================

  /**
   * 触发 FSRS 参数优化（需要至少 50 条复习记录）
   */
  async optimizeFSRS() {
    try {
      return await request('/fsrs-optimizer', {
        action: 'optimize'
      });
    } catch (error) {
      logger.warn('[LafService] FSRS优化失败:', error);
      return normalizeError(error, 'FSRS优化');
    }
  },

  /**
   * 获取 FSRS 优化状态（是否有个性化参数、优化次数、日志数量等）
   */
  async getFSRSStatus() {
    try {
      return await request('/fsrs-optimizer', {
        action: 'getStatus'
      });
    } catch (error) {
      logger.warn('[LafService] 获取FSRS状态失败:', error);
      return normalizeError(error, '获取FSRS状态');
    }
  },

  /**
   * 获取用户记忆留存率曲线数据
   */
  async getFSRSRetentionCurve() {
    try {
      return await request('/fsrs-optimizer', {
        action: 'getRetentionCurve'
      });
    } catch (error) {
      logger.warn('[LafService] 获取留存率曲线失败:', error);
      return normalizeError(error, '获取留存率曲线');
    }
  },

  // ==================== 题库浏览 ====================

  /**
   * 获取题库分类统计
   */
  async getQuestionBankStats() {
    try {
      return await request('/question-bank', {
        action: 'get_stats'
      });
    } catch (error) {
      logger.warn('[LafService] 获取题库统计失败:', error);
      return normalizeError(error, '获取题库统计');
    }
  },

  /**
   * 浏览题库（分页+筛选）
   */
  async browseQuestions(params = {}) {
    try {
      return await request('/question-bank', {
        action: 'get',
        data: params
      });
    } catch (error) {
      logger.warn('[LafService] 浏览题库失败:', error);
      return normalizeError(error, '浏览题库');
    }
  },

  /**
   * 从题库随机抽题开始练习
   */
  async getQuestionBankRandom(params = {}) {
    try {
      return await request('/question-bank', {
        action: 'random',
        data: params
      });
    } catch (error) {
      logger.warn('[LafService] 随机抽题失败:', error);
      return normalizeError(error, '随机抽题');
    }
  },

  // ==================== AI 个性化推题 ====================

  /**
   * 获取 AI 个性化推荐题目（基于薄弱点分析）
   */
  async getSmartRecommendations(count = 10) {
    try {
      return await request('/ai-diagnosis', {
        action: 'smart_recommend',
        data: { count }
      });
    } catch (error) {
      logger.warn('[LafService] AI推题失败:', error);
      return normalizeError(error, 'AI推题');
    }
  }
};


// ✅ 问题清单修复：注册离线队列请求重建函数
// app 重启后 requestFnMap 丢失，通过 requestData 重建请求
try {
  if (offlineQueue && typeof offlineQueue.registerRebuilder === 'function') {
    offlineQueue.registerRebuilder((requestData) => {
      const { path, data, options } = requestData || {};
      if (!path) {
        return Promise.reject(new Error('无法重建请求：缺少 path'));
      }
      return lafService.request(path, data || {}, options || {});
    });
  }
} catch (_e) {
  // 静默
}
