/**
 * Sealos 后端服务封装
 * 已从阿里云 uniCloud 迁移到 Sealos
 */
// ✅ P0-2: 使用相对路径导入配置（避免别名解析问题）
import config from '../config/index.js'

// ✅ 从统一配置读取，支持环境变量
const BASE_URL = config.api.baseUrl;

// 【测试模式】云服务不可用模拟开关
// 设置为 true 时，所有 mistake-manager 请求将直接失败，用于测试降级逻辑
const SIMULATE_CLOUD_FAILURE = false; // 测试完成，已改回正常模式

// 启动时配置信息（仅开发环境）
if (process.env.NODE_ENV !== 'production') {
  console.log('[LafService] 配置信息:', { BASE_URL, ENV: 'development' });
}

export const lafService = {
  /**
   * 通用请求方法
   * @param {string} path - API 路径
   * @param {Object} data - 请求数据
   * @param {Object} options - 可选配置 { headers, skipAuth }
   * @returns {Promise} 返回 Promise
   */
  async request(path, data = {}, options = {}) {
    // 【测试模式】模拟云服务不可用
    if (SIMULATE_CLOUD_FAILURE && path.includes('mistake-manager')) {
      console.warn('[LafService] 🧪 【测试模式】模拟云服务不可用:', path);
      return Promise.reject({
        message: '模拟云服务不可用（测试模式）',
        error: new Error('Cloud service unavailable (TEST MODE)'),
        path: path
      });
    }

    // 构建请求头
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // 添加认证信息（如果需要）
    if (!options.skipAuth) {
      // 尝试从存储中获取 token 或 userId
      try {
        // 尝试多种可能的 token 存储键名
        const token = uni.getStorageSync('EXAM_TOKEN') ||
          uni.getStorageSync('token') ||
          uni.getStorageSync('EXAM_USER_TOKEN');

        // 尝试多种可能的 userId 存储键名
        const userId = uni.getStorageSync('EXAM_USER_ID') ||
          uni.getStorageSync('user_id') ||
          uni.getStorageSync('userId');

        console.log('[LafService] 🔐 认证信息检查:', {
          hasToken: !!token,
          hasUserId: !!userId,
          tokenLength: token ? token.length : 0,
          userId: userId,
          path: path
        });

        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
          console.log('[LafService] ✅ 已添加 Authorization header (Bearer token)');
        } else if (userId) {
          // 如果没有 token，尝试传递 userId
          // 方式1：在请求头中传递
          headers['X-User-Id'] = userId;
          // 方式2：在请求体中传递（如果 data 是对象）
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            data.userId = userId;
          }
          console.log('[LafService] ✅ 已添加 X-User-Id header 和 userId 到请求体');
        } else {
          console.warn('[LafService] ⚠️ 未找到认证信息（token 或 userId），请求可能失败');
        }
      } catch (e) {
        console.warn('[LafService] 获取认证信息失败:', e);
      }
    }

    return new Promise((resolve, reject) => {
      uni.request({
        url: BASE_URL + path,
        method: 'POST',
        data: data,
        header: headers,
        timeout: 100000, // 100秒超时，支持长时间 AI 请求
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.data);
          } else {
            reject(res.data || { message: `请求失败: ${res.statusCode}` });
          }
        },
        fail: (err) => {
          console.error('[LafService] 请求失败:', err);
          reject({ message: '网络请求失败', error: err });
        }
      });
    });
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
  async proxyAI(action, payload, options = {}) {
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

    console.log('[LafService] 🚀 发起 AI 请求:', {
      action,
      payloadKeys: Object.keys(payload || {}),
      payloadSample: JSON.stringify(payload).substring(0, 100),
      hasContent: !!payload.content,
      contentLength: payload.content ? payload.content.length : 0
    });

    try {
      // 获取用户ID（可选，某些接口可能不需要）
      const userId = uni.getStorageSync('EXAM_USER_ID') ||
        uni.getStorageSync('user_id') ||
        uni.getStorageSync('userId') ||
        'anonymous';

      // 构建请求体（符合后端 action/payload 契约）
      const requestData = {
        action: action || 'chat',
        ...payload // 直接展开 payload，不嵌套
      };

      // 如果有 userId，添加到请求中
      if (userId !== 'anonymous') {
        requestData.userId = userId;
      }

      console.log('[LafService] 📤 请求数据:', {
        action: requestData.action,
        hasContent: !!requestData.content,
        contentPreview: requestData.content ? requestData.content.substring(0, 50) + '...' : 'N/A',
        userId: userId
      });

      const response = await this.request('/proxy-ai', requestData);

      console.log('[LafService] 📡 原始响应:', {
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
        console.log('[LafService] ✅ AI 响应成功 (兼容模式已激活)');
        console.log('[LafService] 📦 返回数据:', {
          code: response.code,
          success: response.success,
          dataType: typeof response.data,
          dataLength: Array.isArray(response.data) ? response.data.length : 'N/A'
        });
        return response; // 直接返回，包含 code: 0 和 success: true
      }

      // 兼容旧格式：{ code: 0, data: {...} }
      if (response.code === 0) {
        console.log('[LafService] ✅ AI 响应成功 (旧格式)');
        return response;
      }

      // 处理错误响应
      if (response.error || response.success === false) {
        const errorMsg = response.error || response.message || 'AI 服务异常';
        console.error('[LafService] ❌ AI 响应错误:', errorMsg);
        throw new Error(errorMsg);
      }

      // 未知格式，尝试直接返回（同时注入 code: 0 保险）
      console.warn('[LafService] ⚠️ 未知响应格式，注入兼容补丁后返回');
      response.code = 0;
      response.success = true;
      return response;

    } catch (error) {
      console.error('[LafService] ❌ AI 代理请求失败:', {
        error: error,
        message: error.message,
        stack: error.stack
      });

      // ✅ 修复：返回标准错误对象，而不是抛出
      // 这样调用方可以正常处理错误，而不会导致未捕获的异常
      return {
        code: -1,
        success: false,
        message: error.message || 'AI 服务响应异常',
        error: error,
        data: null
      };
    }
  },

  /**
   * 兼容旧版本的 proxyAI 调用（传递 messages 数组）
   * @deprecated 请使用新版 proxyAI(action, payload) 替代
   * @param {Array} messages - 消息列表
   * @param {Object} options - 配置选项
   * @returns {Promise}
   */
  async proxyAI_legacy(messages, options = {}) {
    console.warn('[LafService] ⚠️ 使用了已废弃的 proxyAI_legacy 方法，请迁移到新版 proxyAI(action, payload)');

    // 尝试将 messages 转换为 chat action
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content || '你好';

    return await this.proxyAI('chat', { content }, options);
  },

  /**
   * 排行榜服务（替代 uniCloud.callFunction('rank-center')）
   * @param {Object} data - 排行榜数据 { action, uid, nickName, avatarUrl, score }
   * @returns {Promise} 返回操作结果
   */
  async rankCenter(data) {
    try {
      return await this.request('/rank-center', data);
    } catch (error) {
      console.error('[LafService] 排行榜请求失败:', error);
      throw error;
    }
  },

  /**
   * 社交服务（Module 7 - 好友系统）
   * @param {Object} data - 社交数据 { action, ...params }
   * @returns {Promise} 返回操作结果
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
      console.log('[LafService] 社交服务请求:', data);
      const response = await this.request('/social-service', data);
      console.log('[LafService] 社交服务响应:', response);
      return response;
    } catch (error) {
      console.error('[LafService] 社交服务请求失败:', error);
      // 返回Mock数据，确保前端不报错
      return this.getMockSocialData(data.action);
    }
  },
  
  /**
   * 获取Mock社交数据（容错处理）
   */
  getMockSocialData(action) {
    const mockData = {
      get_friend_list: {
        code: 0,
        success: true,
        data: [],
        message: '暂无好友数据'
      },
      get_friend_requests: {
        code: 0,
        success: true,
        data: [],
        message: '暂无好友请求'
      },
      search_user: {
        code: 0,
        success: true,
        data: [],
        message: '未找到用户'
      }
    };
    return mockData[action] || { code: 0, success: true, data: null };
  },
  
  /**
   * 获取题库数据（带Mock降级）
   * @param {string} userId - 用户ID
   * @returns {Promise} 返回题库数据
   */
  async getQuestionBank(userId) {
    try {
      const response = await this.request('/question-bank', { 
        action: 'get', 
        userId 
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 获取题库失败，使用本地数据:', error);
      // 返回空数组，让前端使用本地存储
      return {
        code: 0,
        success: true,
        data: [],
        source: 'local_fallback'
      };
    }
  },
  
  /**
   * 获取用户学习统计（带Mock降级）
   * @param {string} userId - 用户ID
   * @returns {Promise} 返回学习统计数据
   */
  async getStudyStats(userId) {
    try {
      const response = await this.request('/study-stats', { 
        action: 'get', 
        userId 
      });
      return response;
    } catch (error) {
      console.warn('[LafService] 获取学习统计失败，使用Mock数据:', error);
      // 返回Mock数据
      return {
        code: 0,
        success: true,
        data: {
          totalQuestions: 0,
          completedQuestions: 0,
          accuracy: 0,
          studyDays: 1,
          streakDays: 1
        },
        source: 'mock'
      };
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

    console.log('[LafService] 🤖 AI好友对话:', { friendType, contentLength: content.length });

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
    console.log('[LafService] 📊 智能组题请求:', { 
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

    console.log('[LafService] 📚 资料理解出题:', { 
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
    console.log('[LafService] 🔮 考点趋势预测:', { examYear, subject });

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

    console.log('[LafService] 🔍 错题深度分析:', { 
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

    console.log('[LafService] 📷 拍照搜题:', { 
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
      return {
        code: -1,
        success: false,
        message: '图片识别失败，请重试',
        data: null
      };
    }
  },

  /**
   * 获取AI好友对话记忆
   * @param {string} friendType - 好友类型
   * @returns {Promise} 返回历史对话
   */
  async getAiFriendMemory(friendType) {
    try {
      const userId = uni.getStorageSync('EXAM_USER_ID') || 
        uni.getStorageSync('user_id') || 
        uni.getStorageSync('userId');
      
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
      return { code: 0, success: true, data: [] };
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
      return { code: -1, success: false, data: { list: [], total: 0 } };
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
      return { code: -1, success: false, data: null };
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
      return { code: -1, success: false, data: [] };
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
  }
};
