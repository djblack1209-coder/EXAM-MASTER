/**
 * 事件总线分析系统 - 检查点 5.1
 * 核心转化路径监控
 *
 * 功能：
 * 1. 统一的事件追踪接口
 * 2. 核心转化漏斗监控
 * 3. 本地存储 + 批量上报
 * 4. 留存率计算支持
 */

// 存储键名
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
const STORAGE_KEYS = {
  EVENTS: 'analytics_events',
  USER_PROFILE: 'analytics_user_profile',
  SESSION: 'analytics_session',
  RETENTION: 'analytics_retention'
};

// 核心转化事件定义
const CONVERSION_EVENTS = {
  // 新用户激活漏斗
  ONBOARDING_START: 'onboarding_start',
  ONBOARDING_UPLOAD: 'onboarding_upload',
  ONBOARDING_FIRST_PRACTICE: 'onboarding_first_practice',
  ONBOARDING_COMPLETE: 'onboarding_complete',

  // 核心功能使用
  START_PRACTICE: 'start_practice', // 开始刷题
  COMPLETE_QUESTION: 'complete_question', // 完成一道题
  COMPLETE_SESSION: 'complete_session', // 完成一次练习
  VIEW_MISTAKE: 'view_mistake', // 查看错题
  REVIEW_MISTAKE: 'review_mistake', // 复习错题

  // 成就系统
  UNLOCK_ACHIEVEMENT: 'unlock_achievement', // 解锁成就
  SHARE_ACHIEVEMENT: 'share_achievement', // 分享成就

  // 社交功能
  START_PK: 'start_pk', // 开始PK
  COMPLETE_PK: 'complete_pk', // 完成PK
  ADD_FRIEND: 'add_friend', // 添加好友

  // 留存相关
  DAY_1_RETURN: 'day_1_return', // 次日回访
  DAY_7_RETURN: 'day_7_return', // 7日回访
  DAY_30_RETURN: 'day_30_return' // 30日回访
};

// 事件优先级
const EVENT_PRIORITY = {
  CRITICAL: 1, // 立即上报
  HIGH: 2, // 高优先级
  NORMAL: 3, // 正常
  LOW: 4 // 低优先级，批量上报
};

/**
 * 分析服务类
 */
class AnalyticsService {
  constructor() {
    this.eventQueue = [];
    this.sessionId = null;
    this.userId = null;
    this.isInitialized = false;
    this.uploadTimer = null;
    this.config = {
      batchSize: 20, // 批量上报数量
      uploadInterval: 60000, // 上报间隔（1分钟）
      maxQueueSize: 500, // 最大队列长度
      enableDebug: process.env.NODE_ENV !== 'production'
    };
  }

  /**
   * 初始化分析服务
   */
  init(options = {}) {
    if (this.isInitialized) return;

    // 合并配置
    this.config = { ...this.config, ...options };

    // 生成或恢复会话ID
    this.sessionId = this._getOrCreateSession();

    // 恢复用户ID
    this.userId = storageService.get('EXAM_USER_ID', null);

    // 恢复未上报的事件
    this._restoreEventQueue();

    // 启动定时上报
    this._startUploadTimer();

    // 记录会话开始
    this.track('session_start', {
      sessionId: this.sessionId,
      timestamp: Date.now()
    });

    // 检查留存
    this._checkRetention();

    this.isInitialized = true;
    logger.log('[Analytics] 初始化完成，会话ID:', this.sessionId);
  }

  /**
   * 追踪事件
   * @param {string} eventName - 事件名称
   * @param {Object} data - 事件数据
   * @param {number} priority - 优先级
   */
  track(eventName, data = {}, priority = EVENT_PRIORITY.NORMAL) {
    const event = {
      id: this._generateEventId(),
      name: eventName,
      data: {
        ...data,
        _timestamp: Date.now(),
        _sessionId: this.sessionId,
        _userId: this.userId,
        _page: this._getCurrentPage(),
        _platform: this._getPlatform()
      },
      priority,
      createdAt: Date.now()
    };

    // 添加到队列
    this.eventQueue.push(event);

    // 控制队列大小
    if (this.eventQueue.length > this.config.maxQueueSize) {
      this.eventQueue = this.eventQueue.slice(-this.config.maxQueueSize);
    }

    // 保存到本地
    this._saveEventQueue();

    // 调试输出
    if (this.config.enableDebug) {
      logger.log('[Analytics] 事件追踪:', eventName, data);
    }

    // 关键事件立即上报
    if (priority === EVENT_PRIORITY.CRITICAL) {
      this._uploadEvents([event]);
    }

    // 检查是否需要批量上报
    if (this.eventQueue.length >= this.config.batchSize) {
      this._uploadBatch();
    }

    return event.id;
  }

  /**
   * 追踪核心转化事件
   */
  trackConversion(conversionType, data = {}) {
    const eventName = CONVERSION_EVENTS[conversionType];
    if (!eventName) {
      logger.warn('[Analytics] 未知的转化类型:', conversionType);
      return;
    }

    // 转化事件使用高优先级
    return this.track(
      eventName,
      {
        conversionType,
        ...data
      },
      EVENT_PRIORITY.HIGH
    );
  }

  /**
   * 追踪"开始刷题"事件
   */
  trackStartPractice(data = {}) {
    return this.trackConversion('START_PRACTICE', {
      questionCount: data.questionCount || 0,
      category: data.category || 'all',
      mode: data.mode || 'normal',
      ...data
    });
  }

  /**
   * 追踪"解锁成就"事件
   */
  trackUnlockAchievement(achievementId, achievementName, data = {}) {
    return this.trackConversion('UNLOCK_ACHIEVEMENT', {
      achievementId,
      achievementName,
      ...data
    });
  }

  /**
   * 追踪"完成题目"事件
   */
  trackCompleteQuestion(questionId, isCorrect, data = {}) {
    return this.track(CONVERSION_EVENTS.COMPLETE_QUESTION, {
      questionId,
      isCorrect,
      timeSpent: data.timeSpent || 0,
      ...data
    });
  }

  /**
   * 追踪"复习错题"事件
   */
  trackReviewMistake(mistakeId, isCorrect, data = {}) {
    return this.trackConversion('REVIEW_MISTAKE', {
      mistakeId,
      isCorrect,
      reviewCount: data.reviewCount || 1,
      ...data
    });
  }

  /**
   * 设置用户ID
   */
  setUserId(userId) {
    this.userId = userId;
    // ✅ B021-3: 使用加密的 EXAM_USER_ID 替代明文 user_id
    storageService.save('EXAM_USER_ID', userId, true);

    this.track('user_identify', {
      userId,
      previousUserId: this.userId
    });
  }

  /**
   * 设置用户属性
   */
  setUserProperties(properties) {
    const profile = storageService.get(STORAGE_KEYS.USER_PROFILE, {});
    const updatedProfile = { ...profile, ...properties, updatedAt: Date.now() };
    storageService.save(STORAGE_KEYS.USER_PROFILE, updatedProfile);

    this.track('user_profile_update', properties);
  }

  /**
   * 获取留存数据
   */
  getRetentionData() {
    return storageService.get(STORAGE_KEYS.RETENTION, {
      firstVisit: null,
      lastVisit: null,
      visitDays: [],
      day1Retained: false,
      day7Retained: false,
      day30Retained: false
    });
  }

  /**
   * 获取事件统计
   */
  getEventStats() {
    const events = storageService.get(STORAGE_KEYS.EVENTS, []);
    const stats = {};

    events.forEach((event) => {
      stats[event.name] = (stats[event.name] || 0) + 1;
    });

    return {
      totalEvents: events.length,
      eventCounts: stats,
      queueSize: this.eventQueue.length
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 获取或创建会话
   */
  _getOrCreateSession() {
    const session = storageService.get(STORAGE_KEYS.SESSION);
    const now = Date.now();

    // 会话超时时间：30分钟
    const SESSION_TIMEOUT = 30 * 60 * 1000;

    if (session && now - session.lastActive < SESSION_TIMEOUT) {
      // 更新最后活跃时间
      session.lastActive = now;
      storageService.save(STORAGE_KEYS.SESSION, session);
      return session.id;
    }

    // 创建新会话
    const newSession = {
      id: `session_${now}_${Math.random().toString(36).substring(2, 11)}`,
      startTime: now,
      lastActive: now
    };
    storageService.save(STORAGE_KEYS.SESSION, newSession);
    return newSession.id;
  }

  /**
   * 生成事件ID
   */
  _generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * 获取当前页面
   */
  _getCurrentPage() {
    const pages = getCurrentPages();
    return pages.length > 0 ? pages[pages.length - 1].route : 'unknown';
  }

  /**
   * 获取平台信息
   */
  _getPlatform() {
    try {
      const deviceInfo = uni.getDeviceInfo();
      return {
        platform: deviceInfo.platform || 'unknown',
        system: deviceInfo.system || 'unknown',
        version: deviceInfo.platform || 'unknown',
        model: deviceInfo.model || 'unknown'
      };
    } catch (_e) {
      return { platform: 'unknown' };
    }
  }

  /**
   * 保存事件队列
   */
  _saveEventQueue() {
    try {
      // 只保存最近的事件
      const eventsToSave = this.eventQueue.slice(-100);
      storageService.save(STORAGE_KEYS.EVENTS, eventsToSave);
    } catch (e) {
      logger.error('[Analytics] 保存事件队列失败:', e);
    }
  }

  /**
   * 恢复事件队列
   */
  _restoreEventQueue() {
    try {
      const savedEvents = storageService.get(STORAGE_KEYS.EVENTS, []);
      this.eventQueue = savedEvents;
    } catch (e) {
      logger.error('[Analytics] 恢复事件队列失败:', e);
      this.eventQueue = [];
    }
  }

  /**
   * 启动定时上报
   */
  _startUploadTimer() {
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
    }

    this.uploadTimer = setInterval(() => {
      this._uploadBatch();
    }, this.config.uploadInterval);
  }

  /**
   * 批量上报
   */
  _uploadBatch() {
    if (this.eventQueue.length === 0) return;

    const eventsToUpload = this.eventQueue.splice(0, this.config.batchSize);
    this._uploadEvents(eventsToUpload);
  }

  /**
   * 上报事件
   */
  async _uploadEvents(events) {
    if (events.length === 0) return;

    try {
      // NOTE: 事件上报接口暂未接入，当前使用本地存储作为降级方案
      // 后续可接入自建分析服务或第三方平台（如友盟、神策等）
      // 接入时取消下方注释并配置正确的上报地址：
      // await uni.request({
      //   url: 'https://your-analytics-server.com/events',
      //   method: 'POST',
      //   data: { events }
      // });

      // 当前降级方案：保存到本地存储（用于调试和后续分析）
      const uploadedEvents = storageService.get('analytics_uploaded', []);
      uploadedEvents.push(...events);

      // 只保留最近1000条已上报事件
      if (uploadedEvents.length > 1000) {
        uploadedEvents.splice(0, uploadedEvents.length - 1000);
      }

      storageService.save('analytics_uploaded', uploadedEvents);

      if (this.config.enableDebug) {
        logger.log('[Analytics] 事件上报成功:', events.length, '条');
      }
    } catch (e) {
      logger.error('[Analytics] 事件上报失败:', e);
      // 失败的事件重新加入队列
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * 检查留存
   */
  _checkRetention() {
    const retention = this.getRetentionData();
    const now = Date.now();
    const today = new Date().toISOString().split('T')[0];

    // 首次访问
    if (!retention.firstVisit) {
      retention.firstVisit = now;
      retention.visitDays = [today];
    } else {
      // 记录访问日期
      if (!retention.visitDays.includes(today)) {
        retention.visitDays.push(today);
      }

      // 计算留存
      const daysSinceFirst = Math.floor((now - retention.firstVisit) / (24 * 60 * 60 * 1000));

      // 次日留存
      if (daysSinceFirst >= 1 && !retention.day1Retained) {
        retention.day1Retained = true;
        this.track(CONVERSION_EVENTS.DAY_1_RETURN, { daysSinceFirst });
      }

      // 7日留存
      if (daysSinceFirst >= 7 && !retention.day7Retained) {
        retention.day7Retained = true;
        this.track(CONVERSION_EVENTS.DAY_7_RETURN, { daysSinceFirst });
      }

      // 30日留存
      if (daysSinceFirst >= 30 && !retention.day30Retained) {
        retention.day30Retained = true;
        this.track(CONVERSION_EVENTS.DAY_30_RETURN, { daysSinceFirst });
      }
    }

    retention.lastVisit = now;
    storageService.save(STORAGE_KEYS.RETENTION, retention);
  }
}

// 创建单例
export const analytics = new AnalyticsService();

// 导出转化事件常量
export { CONVERSION_EVENTS, EVENT_PRIORITY };

// 默认导出
export default analytics;
