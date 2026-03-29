/**
 * 智能多模型路由器
 *
 * 功能：
 * 1. 智能模型选择 - 根据任务类型自动选择最优模型
 * 2. Redis缓存 - 相同请求命中缓存，提升响应速度
 * 3. 超时降级 - 主模型超时自动切换到快速模型
 * 4. 性能监控 - 收集调用指标用于优化
 *
 * @version 1.0.0
 * @author EXAM-MASTER Team
 */

import { proxyAI } from '@/services/api/domains/ai.api.js';
import { logger } from '@/utils/logger.js';

// 模型性能基线配置
const MODEL_BASELINES = {
  'glm-4.5-air': {
    avgLatency: 800,
    p95Latency: 1500,
    costPer1k: 0.002,
    maxTokens: 8192,
    capabilities: ['text', 'reasoning', 'analysis']
  },
  'glm-4-flash': {
    avgLatency: 300,
    p95Latency: 600,
    costPer1k: 0.0005,
    maxTokens: 4096,
    capabilities: ['text', 'chat', 'quick']
  },
  'glm-4-plus': {
    avgLatency: 600,
    p95Latency: 1200,
    costPer1k: 0.0015,
    maxTokens: 4096,
    capabilities: ['text', 'generation', 'analysis']
  },
  'glm-4v-plus': {
    avgLatency: 1500,
    p95Latency: 3000,
    costPer1k: 0.003,
    maxTokens: 4096,
    capabilities: ['vision', 'ocr', 'image']
  },
  'glm-4-speech': {
    avgLatency: 1000,
    p95Latency: 2000,
    costPer1k: 0.0025,
    maxTokens: 4096,
    capabilities: ['speech', 'text-to-speech', 'speech-to-text']
  }
};

// 任务类型路由配置
const ROUTING_CONFIG = {
  // 快速问答 - 使用最快模型
  quick: {
    model: 'glm-4-flash',
    timeout: 15000,
    fallback: null,
    cacheTTL: 3600, // 1小时
    description: '简单问答、快速回复'
  },

  // 标准任务 - 平衡速度和质量
  standard: {
    model: 'glm-4.5-air',
    timeout: 30000,
    fallback: 'glm-4-flash',
    cacheTTL: 1800, // 30分钟
    description: '组题、解析、一般分析'
  },

  // 复杂任务 - 优先质量
  complex: {
    model: 'glm-4.5-air',
    timeout: 60000,
    fallback: 'glm-4-plus',
    cacheTTL: 3600,
    description: '资料理解、趋势预测、深度分析'
  },

  // 视觉任务 - 图像处理
  vision: {
    model: 'glm-4v-plus',
    timeout: 45000,
    fallback: null,
    cacheTTL: 3600,
    description: '拍照搜题、图像识别'
  },

  // 语音任务 - 语音处理
  speech: {
    model: 'glm-4-speech',
    timeout: 30000,
    fallback: null,
    cacheTTL: 0, // 不缓存语音
    description: '语音输入/输出、语音识别'
  },

  // 聊天任务 - 对话场景
  chat: {
    model: 'glm-4-flash',
    timeout: 20000,
    fallback: null,
    cacheTTL: 0, // 不缓存聊天
    description: '智能好友对话、实时聊天'
  },

  // 实时答疑 - 快速响应
  realtime: {
    model: 'glm-4-flash',
    timeout: 15000,
    fallback: null,
    cacheTTL: 0, // 不缓存实时对话
    description: '实时答疑、紧急问题'
  },

  // 生成任务 - 内容生成
  generation: {
    model: 'glm-4-plus',
    timeout: 45000,
    fallback: 'glm-4.5-air',
    cacheTTL: 1800,
    description: '题目生成、内容创作'
  }
};

// Action 到任务类型的映射
const ACTION_TASK_MAP = {
  chat: 'chat',
  friend_chat: 'chat',
  generate_questions: 'generation',
  analyze: 'standard',
  adaptive_pick: 'complex',
  material_understand: 'complex',
  trend_predict: 'complex',
  vision: 'vision',
  photo_search: 'vision',
  consult: 'standard',
  speech_to_text: 'speech',
  text_to_speech: 'speech',
  voice_chat: 'speech',
  realtime_answer: 'realtime',
  urgent_question: 'realtime'
};

/**
 * 智能路由器类
 */
class AIRouter {
  constructor() {
    this.cache = new Map(); // 内存缓存
    this.metrics = {
      totalCalls: 0,
      cacheHits: 0,
      fallbacks: 0,
      errors: 0,
      latencies: []
    };
    this.isInitialized = false;
  }

  /**
   * 初始化路由器
   */
  init() {
    if (this.isInitialized) return;

    // 定期清理过期缓存
    this.startCacheCleanup();

    this.isInitialized = true;
    logger.log('[AIRouter] 初始化完成');
  }

  /**
   * 智能调用
   * @param {string} action - 操作类型
   * @param {Object} payload - 请求参数
   * @param {Object} options - 可选配置
   * @returns {Promise<Object>} 智能响应
   */
  async call(action, payload, options = {}) {
    if (!this.isInitialized) this.init();

    const startTime = Date.now();
    const requestId = this.generateRequestId();

    this.metrics.totalCalls++;

    logger.log(`[AIRouter] ${requestId} 开始处理: ${action}`);

    try {
      // 1. 确定任务类型和路由配置
      const taskType = options.taskType || ACTION_TASK_MAP[action] || 'standard';
      const routeConfig = ROUTING_CONFIG[taskType];

      if (!routeConfig) {
        throw new Error(`未知的任务类型: ${taskType}`);
      }

      // 2. 检查缓存
      if (routeConfig.cacheTTL > 0 && !options.skipCache) {
        const cacheKey = this.generateCacheKey(action, payload);
        const cached = this.getFromCache(cacheKey);

        if (cached) {
          this.metrics.cacheHits++;
          logger.log(`[AIRouter] ${requestId} 命中缓存`);

          return {
            ...cached,
            cached: true,
            requestId,
            duration: Date.now() - startTime
          };
        }
      }

      // 3. 执行智能调用（带超时和降级）
      let response;
      let usedModel = routeConfig.model;

      try {
        response = await this.executeWithTimeout(
          this.callAI(action, payload, routeConfig.model, options),
          routeConfig.timeout
        );

        // 检查服务端错误，尝试降级
        if (!response.success && routeConfig.fallback && this.isRetryableError(response)) {
          logger.warn(
            `[AIRouter] ${requestId} 主模型返回可重试错误(${response.code})，降级到: ${routeConfig.fallback}`
          );
          this.metrics.fallbacks++;
          usedModel = routeConfig.fallback;
          response = await this.callAI(action, payload, routeConfig.fallback, options);
        }
      } catch (timeoutError) {
        // 超时或网络错误降级
        if (routeConfig.fallback) {
          logger.warn(`[AIRouter] ${requestId} 主模型异常，降级到: ${routeConfig.fallback}`);
          this.metrics.fallbacks++;
          usedModel = routeConfig.fallback;

          response = await this.callAI(action, payload, routeConfig.fallback, options);
        } else {
          throw timeoutError;
        }
      }

      // 4. 写入缓存
      if (routeConfig.cacheTTL > 0 && response.success) {
        const cacheKey = this.generateCacheKey(action, payload);
        this.setToCache(cacheKey, response, routeConfig.cacheTTL);
      }

      // 5. 记录性能指标
      const duration = Date.now() - startTime;
      this.recordLatency(duration);

      logger.log(`[AIRouter] ${requestId} 完成，耗时: ${duration}ms，模型: ${usedModel}`);

      return {
        ...response,
        cached: false,
        model: usedModel,
        requestId,
        duration
      };
    } catch (error) {
      this.metrics.errors++;
      logger.error(`[AIRouter] ${requestId} 错误:`, error.message);

      return {
        code: -1,
        success: false,
        message: error.message || '智能调用失败',
        requestId,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 实时答疑调用
   * @param {string} question - 问题内容
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 实时答疑响应
   */
  async realtimeAnswer(question, context = {}) {
    return this.call(
      'realtime_answer',
      {
        content: question,
        context
      },
      {
        taskType: 'realtime',
        temperature: 0.7
      }
    );
  }

  /**
   * 语音识别
   * @param {string} audioData - 音频数据（base64）
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 识别结果
   */
  async speechToText(audioData, options = {}) {
    return this.call(
      'speech_to_text',
      {
        audio: audioData,
        format: options.format || 'base64',
        language: options.language || 'zh-CN'
      },
      {
        taskType: 'speech'
      }
    );
  }

  /**
   * 文本转语音
   * @param {string} text - 文本内容
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 语音数据
   */
  async textToSpeech(text, options = {}) {
    return this.call(
      'text_to_speech',
      {
        text,
        voice: options.voice || 'default',
        speed: options.speed || 1.0
      },
      {
        taskType: 'speech'
      }
    );
  }

  /**
   * 多模态交互
   * @param {Object} input - 多模态输入
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 多模态响应
   */
  async multimodal(input, options = {}) {
    const { text, image, audio } = input;

    let taskType = 'standard';
    if (image) taskType = 'vision';
    if (audio) taskType = 'speech';

    return this.call(
      'multimodal',
      {
        text,
        image,
        audio,
        multimodal: true
      },
      {
        taskType,
        temperature: options.temperature || 0.7
      }
    );
  }

  /**
   * 判断是否为可重试的服务端错误
   */
  isRetryableError(response) {
    const retryableCodes = [500, 502, 503, 504];
    return retryableCodes.includes(response.code);
  }

  /**
   * 调用智能服务
   */
  async callAI(action, payload, model, options) {
    // 构建请求参数
    const requestData = {
      action,
      ...payload,
      _model: model, // 指定模型
      _temperature: options.temperature
    };

    // 调用后端服务
    const response = await proxyAI(action, requestData);

    return response;
  }

  /**
   * 带超时的执行
   */
  executeWithTimeout(promise, timeout) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI_TIMEOUT')), timeout))
    ]);
  }

  /**
   * 生成缓存Key
   */
  generateCacheKey(action, payload) {
    // 简化版：使用action + content的hash
    const content = payload.content || JSON.stringify(payload);
    const sample = content.substring(0, 500);

    let hash = 0;
    for (let i = 0; i < sample.length; i++) {
      const char = sample.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }

    return `ai_cache:${action}:${Math.abs(hash).toString(36)}`;
  }

  /**
   * 从缓存获取
   */
  getFromCache(key) {
    const item = this.cache.get(key);

    if (!item) return null;

    // 检查是否过期
    if (Date.now() > item.expireAt) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * 写入缓存
   */
  setToCache(key, value, ttl) {
    this.cache.set(key, {
      value,
      expireAt: Date.now() + ttl * 1000,
      createdAt: Date.now()
    });

    // 限制缓存大小（小程序内存有限，100 条足够）
    if (this.cache.size > 100) {
      this.cleanupCache();
    }
  }

  /**
   * 清理过期缓存
   */
  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expireAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    logger.log(`[AIRouter] 清理过期缓存: ${cleaned} 条`);
  }

  /**
   * 启动定期缓存清理
   */
  startCacheCleanup() {
    // 每5分钟清理一次（保存引用以便销毁时清理）
    if (this._cacheCleanupTimer) {
      clearInterval(this._cacheCleanupTimer);
    }
    this._cacheCleanupTimer = setInterval(
      () => {
        this.cleanupCache();
      },
      5 * 60 * 1000
    );
  }

  /**
   * 停止缓存清理定时器（防止内存泄漏）
   */
  stopCacheCleanup() {
    if (this._cacheCleanupTimer) {
      clearInterval(this._cacheCleanupTimer);
      this._cacheCleanupTimer = null;
    }
  }

  /**
   * 销毁路由器实例（清理定时器 + 缓存，防止内存泄漏）
   * 应在页面 onUnload 或组件 unmounted 时调用
   */
  destroy() {
    this.stopCacheCleanup();
    this.cache.clear();
    this.isInitialized = false;
    logger.log('[AIRouter] 已销毁，定时器和缓存已清理');
  }

  /**
   * 生成请求ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 记录延迟
   */
  recordLatency(latency) {
    this.metrics.latencies.push(latency);

    // 只保留最近1000条
    if (this.metrics.latencies.length > 1000) {
      this.metrics.latencies.shift();
    }
  }

  /**
   * 获取性能统计
   */
  getMetrics() {
    const latencies = this.metrics.latencies;

    // 计算统计指标
    const sorted = [...latencies].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;
    const avg = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    return {
      totalCalls: this.metrics.totalCalls,
      cacheHits: this.metrics.cacheHits,
      cacheHitRate:
        this.metrics.totalCalls > 0
          ? ((this.metrics.cacheHits / this.metrics.totalCalls) * 100).toFixed(2) + '%'
          : '0%',
      fallbacks: this.metrics.fallbacks,
      fallbackRate:
        this.metrics.totalCalls > 0
          ? ((this.metrics.fallbacks / this.metrics.totalCalls) * 100).toFixed(2) + '%'
          : '0%',
      errors: this.metrics.errors,
      errorRate:
        this.metrics.totalCalls > 0 ? ((this.metrics.errors / this.metrics.totalCalls) * 100).toFixed(2) + '%' : '0%',
      latency: {
        avg: Math.round(avg),
        p50: Math.round(p50),
        p95: Math.round(p95),
        p99: Math.round(p99)
      },
      cacheSize: this.cache.size
    };
  }

  /**
   * 重置统计
   */
  resetMetrics() {
    this.metrics = {
      totalCalls: 0,
      cacheHits: 0,
      fallbacks: 0,
      errors: 0,
      latencies: []
    };
    logger.log('[AIRouter] 统计已重置');
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
    logger.log('[AIRouter] 缓存已清空');
  }

  /**
   * 获取路由配置
   */
  getRoutingConfig() {
    return ROUTING_CONFIG;
  }

  /**
   * 获取模型信息
   */
  getModelInfo(modelName) {
    return MODEL_BASELINES[modelName] || null;
  }

  /**
   * 推荐最优模型
   * @param {string} taskType - 任务类型
   * @param {Object} constraints - 约束条件
   */
  recommendModel(taskType, constraints = {}) {
    const { maxLatency, maxCost: _maxCost, requiredCapabilities } = constraints;

    // 获取默认配置
    const defaultConfig = ROUTING_CONFIG[taskType];
    if (!defaultConfig) return null;

    let recommendedModel = defaultConfig.model;

    // 根据约束条件调整
    if (maxLatency && maxLatency < MODEL_BASELINES[recommendedModel]?.avgLatency) {
      // 需要更快的模型
      recommendedModel = 'glm-4-flash';
    }

    if (requiredCapabilities?.includes('vision')) {
      recommendedModel = 'glm-4v-plus';
    }

    return {
      model: recommendedModel,
      config: MODEL_BASELINES[recommendedModel],
      reason: `基于任务类型 "${taskType}" 和约束条件推荐`
    };
  }
}

// 创建单例
export const aiRouter = new AIRouter();

// 便捷函数导出
export function callAI(action, payload, options) {
  return aiRouter.call(action, payload, options);
}

export function getAIMetrics() {
  return aiRouter.getMetrics();
}

export function clearAICache() {
  return aiRouter.clearCache();
}

export function realtimeAnswer(question, context) {
  return aiRouter.realtimeAnswer(question, context);
}

export function speechToText(audioData, options) {
  return aiRouter.speechToText(audioData, options);
}

export function textToSpeech(text, options) {
  return aiRouter.textToSpeech(text, options);
}

export function multimodal(input, options) {
  return aiRouter.multimodal(input, options);
}

export default aiRouter;
