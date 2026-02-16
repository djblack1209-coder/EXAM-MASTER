/**
 * AI 性能分析与埋点系统
 *
 * 功能：
 * 1. AI调用性能追踪
 * 2. 模型使用统计
 * 3. 缓存命中率监控
 * 4. 错误率分析
 * 5. 用户行为关联
 *
 * @version 1.0.0
 * @author EXAM-MASTER Team
 */

import { analytics } from './event-bus-analytics.js';
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

// AI事件类型定义
const AI_EVENTS = {
  // 调用事件
  AI_CALL_START: 'ai_call_start',
  AI_CALL_SUCCESS: 'ai_call_success',
  AI_CALL_ERROR: 'ai_call_error',
  AI_CALL_TIMEOUT: 'ai_call_timeout',

  // 缓存事件
  AI_CACHE_HIT: 'ai_cache_hit',
  AI_CACHE_MISS: 'ai_cache_miss',

  // 降级事件
  AI_FALLBACK: 'ai_fallback',

  // 功能使用事件
  AI_PHOTO_SEARCH: 'ai_photo_search',
  AI_ADAPTIVE_PICK: 'ai_adaptive_pick',
  AI_MATERIAL_UNDERSTAND: 'ai_material_understand',
  AI_TREND_PREDICT: 'ai_trend_predict',
  AI_FRIEND_CHAT: 'ai_friend_chat',
  AI_MISTAKE_ANALYSIS: 'ai_mistake_analysis',

  // 质量事件
  AI_RESPONSE_QUALITY: 'ai_response_quality',
  AI_USER_FEEDBACK: 'ai_user_feedback'
};

// 存储键名
const STORAGE_KEYS = {
  AI_METRICS: 'ai_analytics_metrics',
  AI_DAILY_STATS: 'ai_analytics_daily',
  AI_MODEL_STATS: 'ai_analytics_models'
};

/**
 * AI分析服务类
 */
class AIAnalyticsService {
  constructor() {
    this.sessionMetrics = {
      calls: 0,
      successes: 0,
      errors: 0,
      timeouts: 0,
      cacheHits: 0,
      fallbacks: 0,
      totalLatency: 0,
      latencies: [],
      modelUsage: {},
      actionUsage: {}
    };
    this.isInitialized = false;
  }

  /**
   * 初始化
   */
  init() {
    if (this.isInitialized) return;

    // 恢复历史数据
    this.restoreMetrics();

    // 注册页面卸载时保存
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.saveMetrics();
      });
    }

    this.isInitialized = true;
    logger.log('[AIAnalytics] 初始化完成');
  }

  /**
   * 追踪AI调用开始
   * @param {Object} params - 调用参数
   */
  trackCallStart(params) {
    const { action, model, requestId } = params;

    this.sessionMetrics.calls++;
    this.incrementActionUsage(action);

    // 记录到通用分析系统
    analytics.track(AI_EVENTS.AI_CALL_START, {
      action,
      model,
      requestId,
      timestamp: Date.now()
    });

    return {
      startTime: Date.now(),
      requestId
    };
  }

  /**
   * 追踪AI调用成功
   * @param {Object} params - 调用结果
   */
  trackCallSuccess(params) {
    const {
      action,
      model,
      requestId,
      duration,
      cached,
      responseSize,
      tokenUsage
    } = params;

    this.sessionMetrics.successes++;
    this.sessionMetrics.totalLatency += duration;
    this.sessionMetrics.latencies.push(duration);
    this.incrementModelUsage(model);

    if (cached) {
      this.sessionMetrics.cacheHits++;
    }

    // 限制延迟记录数量
    if (this.sessionMetrics.latencies.length > 500) {
      this.sessionMetrics.latencies.shift();
    }

    analytics.track(AI_EVENTS.AI_CALL_SUCCESS, {
      action,
      model,
      requestId,
      duration,
      cached,
      responseSize,
      tokenUsage
    });

    // 保存指标
    this.saveMetrics();
  }

  /**
   * 追踪AI调用错误
   * @param {Object} params - 错误信息
   */
  trackCallError(params) {
    const { action, model, requestId, error, duration } = params;

    this.sessionMetrics.errors++;

    analytics.track(AI_EVENTS.AI_CALL_ERROR, {
      action,
      model,
      requestId,
      error: error?.message || String(error),
      duration
    });

    this.saveMetrics();
  }

  /**
   * 追踪AI调用超时
   * @param {Object} params - 超时信息
   */
  trackCallTimeout(params) {
    const { action, model, requestId, timeout } = params;

    this.sessionMetrics.timeouts++;

    analytics.track(AI_EVENTS.AI_CALL_TIMEOUT, {
      action,
      model,
      requestId,
      timeout
    });

    this.saveMetrics();
  }

  /**
   * 追踪模型降级
   * @param {Object} params - 降级信息
   */
  trackFallback(params) {
    const { action, fromModel, toModel, requestId, reason } = params;

    this.sessionMetrics.fallbacks++;

    analytics.track(AI_EVENTS.AI_FALLBACK, {
      action,
      fromModel,
      toModel,
      requestId,
      reason
    });

    this.saveMetrics();
  }

  /**
   * 追踪缓存命中
   * @param {Object} params - 缓存信息
   */
  trackCacheHit(params) {
    const { action, cacheKey, age } = params;

    analytics.track(AI_EVENTS.AI_CACHE_HIT, {
      action,
      cacheKey,
      age
    });
  }

  /**
   * 追踪拍照搜题
   * @param {Object} params - 搜题参数
   */
  trackPhotoSearch(params) {
    const {
      duration,
      success,
      matchCount,
      hasAiGenerated,
      confidence,
      subject
    } = params;

    analytics.track(AI_EVENTS.AI_PHOTO_SEARCH, {
      duration,
      success,
      matchCount,
      hasAiGenerated,
      confidence,
      subject
    });
  }

  /**
   * 追踪智能组题
   * @param {Object} params - 组题参数
   */
  trackAdaptivePick(params) {
    const {
      questionCount,
      targetDifficulty,
      userCorrectRate,
      duration
    } = params;

    analytics.track(AI_EVENTS.AI_ADAPTIVE_PICK, {
      questionCount,
      targetDifficulty,
      userCorrectRate,
      duration
    });
  }

  /**
   * 追踪AI好友聊天
   * @param {Object} params - 聊天参数
   */
  trackFriendChat(params) {
    const {
      friendType,
      emotion,
      messageLength,
      responseLength,
      duration
    } = params;

    analytics.track(AI_EVENTS.AI_FRIEND_CHAT, {
      friendType,
      emotion,
      messageLength,
      responseLength,
      duration
    });
  }

  /**
   * 追踪用户反馈
   * @param {Object} params - 反馈信息
   */
  trackUserFeedback(params) {
    const {
      action,
      requestId,
      rating,
      helpful,
      comment
    } = params;

    analytics.track(AI_EVENTS.AI_USER_FEEDBACK, {
      action,
      requestId,
      rating,
      helpful,
      comment
    });
  }

  /**
   * 增加Action使用计数
   */
  incrementActionUsage(action) {
    if (!this.sessionMetrics.actionUsage[action]) {
      this.sessionMetrics.actionUsage[action] = 0;
    }
    this.sessionMetrics.actionUsage[action]++;
  }

  /**
   * 增加模型使用计数
   */
  incrementModelUsage(model) {
    if (!this.sessionMetrics.modelUsage[model]) {
      this.sessionMetrics.modelUsage[model] = 0;
    }
    this.sessionMetrics.modelUsage[model]++;
  }

  /**
   * 获取会话统计
   */
  getSessionStats() {
    const latencies = this.sessionMetrics.latencies;
    const sorted = [...latencies].sort((a, b) => a - b);

    return {
      // 调用统计
      totalCalls: this.sessionMetrics.calls,
      successRate: this.sessionMetrics.calls > 0
        ? ((this.sessionMetrics.successes / this.sessionMetrics.calls) * 100).toFixed(2) + '%'
        : '0%',
      errorRate: this.sessionMetrics.calls > 0
        ? ((this.sessionMetrics.errors / this.sessionMetrics.calls) * 100).toFixed(2) + '%'
        : '0%',
      timeoutRate: this.sessionMetrics.calls > 0
        ? ((this.sessionMetrics.timeouts / this.sessionMetrics.calls) * 100).toFixed(2) + '%'
        : '0%',

      // 缓存统计
      cacheHitRate: this.sessionMetrics.calls > 0
        ? ((this.sessionMetrics.cacheHits / this.sessionMetrics.calls) * 100).toFixed(2) + '%'
        : '0%',

      // 降级统计
      fallbackRate: this.sessionMetrics.calls > 0
        ? ((this.sessionMetrics.fallbacks / this.sessionMetrics.calls) * 100).toFixed(2) + '%'
        : '0%',

      // 延迟统计
      latency: {
        avg: latencies.length > 0
          ? Math.round(this.sessionMetrics.totalLatency / latencies.length)
          : 0,
        p50: sorted[Math.floor(sorted.length * 0.5)] || 0,
        p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
        p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
        min: sorted[0] || 0,
        max: sorted[sorted.length - 1] || 0
      },

      // 使用分布
      modelUsage: this.sessionMetrics.modelUsage,
      actionUsage: this.sessionMetrics.actionUsage
    };
  }

  /**
   * 获取每日统计
   */
  getDailyStats() {
    try {
      const dailyStats = storageService.get(STORAGE_KEYS.AI_DAILY_STATS, {});
      const today = new Date().toISOString().split('T')[0];

      return {
        today: dailyStats[today] || { calls: 0, successes: 0, errors: 0 },
        history: dailyStats
      };
    } catch (_e) {
      return { today: { calls: 0, successes: 0, errors: 0 }, history: {} };
    }
  }

  /**
   * 保存指标到本地存储
   */
  saveMetrics() {
    try {
      // 保存会话指标
      storageService.save(STORAGE_KEYS.AI_METRICS, {
        ...this.sessionMetrics,
        updatedAt: Date.now()
      });

      // 更新每日统计
      const today = new Date().toISOString().split('T')[0];
      const dailyStats = storageService.get(STORAGE_KEYS.AI_DAILY_STATS, {});

      if (!dailyStats[today]) {
        dailyStats[today] = { calls: 0, successes: 0, errors: 0, totalLatency: 0 };
      }

      dailyStats[today].calls = this.sessionMetrics.calls;
      dailyStats[today].successes = this.sessionMetrics.successes;
      dailyStats[today].errors = this.sessionMetrics.errors;
      dailyStats[today].totalLatency = this.sessionMetrics.totalLatency;

      // 只保留最近30天
      const dates = Object.keys(dailyStats).sort().reverse();
      if (dates.length > 30) {
        dates.slice(30).forEach((date) => delete dailyStats[date]);
      }

      storageService.save(STORAGE_KEYS.AI_DAILY_STATS, dailyStats);

    } catch (e) {
      console.error('[AIAnalytics] 保存指标失败:', e);
    }
  }

  /**
   * 恢复历史指标
   */
  restoreMetrics() {
    try {
      const saved = storageService.get(STORAGE_KEYS.AI_METRICS);

      if (saved) {
        // 检查是否是今天的数据
        const savedDate = new Date(saved.updatedAt).toDateString();
        const today = new Date().toDateString();

        if (savedDate === today) {
          // 恢复今天的数据
          this.sessionMetrics = {
            ...this.sessionMetrics,
            ...saved,
            latencies: saved.latencies || []
          };
        }
      }
    } catch (e) {
      console.error('[AIAnalytics] 恢复指标失败:', e);
    }
  }

  /**
   * 重置会话统计
   */
  resetSessionStats() {
    this.sessionMetrics = {
      calls: 0,
      successes: 0,
      errors: 0,
      timeouts: 0,
      cacheHits: 0,
      fallbacks: 0,
      totalLatency: 0,
      latencies: [],
      modelUsage: {},
      actionUsage: {}
    };

    this.saveMetrics();
    logger.log('[AIAnalytics] 会话统计已重置');
  }

  /**
   * 生成性能报告
   */
  generateReport() {
    const sessionStats = this.getSessionStats();
    const dailyStats = this.getDailyStats();

    return {
      summary: {
        totalCalls: sessionStats.totalCalls,
        successRate: sessionStats.successRate,
        avgLatency: sessionStats.latency.avg + 'ms',
        cacheHitRate: sessionStats.cacheHitRate
      },
      performance: {
        latency: sessionStats.latency,
        errorRate: sessionStats.errorRate,
        timeoutRate: sessionStats.timeoutRate,
        fallbackRate: sessionStats.fallbackRate
      },
      usage: {
        byModel: sessionStats.modelUsage,
        byAction: sessionStats.actionUsage
      },
      daily: dailyStats,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * 上报指标到服务器
   */
  async uploadMetrics() {
    try {
      const _report = this.generateReport();

      // 调用后端上报接口
      // await lafService.request('/analytics-track', {
      //   type: 'ai_metrics',
      //   data: report
      // })

      logger.log('[AIAnalytics] 指标上报成功');
      return true;
    } catch (e) {
      console.error('[AIAnalytics] 指标上报失败:', e);
      return false;
    }
  }
}

// 创建单例
export const aiAnalytics = new AIAnalyticsService();

// 便捷函数导出
export function trackAICall(params) {
  return aiAnalytics.trackCallStart(params);
}

export function trackAISuccess(params) {
  return aiAnalytics.trackCallSuccess(params);
}

export function trackAIError(params) {
  return aiAnalytics.trackCallError(params);
}

export function trackPhotoSearch(params) {
  return aiAnalytics.trackPhotoSearch(params);
}

export function getAIStats() {
  return aiAnalytics.getSessionStats();
}

export function getAIReport() {
  return aiAnalytics.generateReport();
}

// 导出事件类型
export { AI_EVENTS };

export default aiAnalytics;
