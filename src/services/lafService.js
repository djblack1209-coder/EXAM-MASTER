/**
 * Sealos 后端服务封装
 * 已从阿里云 uniCloud 迁移到 Sealos
 */
const BASE_URL = 'https://nf98ia8qnt.sealosbja.site';

// 【测试模式】云服务不可用模拟开关
// 设置为 true 时，所有 mistake-manager 请求将直接失败，用于测试降级逻辑
const SIMULATE_CLOUD_FAILURE = false; // 测试完成，已改回正常模式

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
    console.log('[LafService] 🚀 发起 AI 请求:', {
      action,
      payloadKeys: Object.keys(payload || {}),
      payloadSample: JSON.stringify(payload).substring(0, 100)
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

      console.log('[LafService] 📤 请求数据:', requestData);

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
      throw error;
    }
  }
};
