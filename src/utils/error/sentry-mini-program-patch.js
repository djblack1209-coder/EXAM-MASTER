/**
 * Sentry 小程序适配补丁 - 检查点 5.2
 * 为 UniApp 小程序环境提供 Sentry 兼容层
 * 
 * 功能：
 * 1. 小程序环境 Sentry SDK 适配
 * 2. 错误上下文增强
 * 3. 面包屑追踪
 * 4. 性能监控
 * 5. 用户反馈收集
 * 
 * 使用方式：
 * import { sentryPatch } from '@/utils/error/sentry-mini-program-patch.js'
 * sentryPatch.init({ dsn: 'your-sentry-dsn' })
 */

import { globalErrorHandler } from './global-error-handler.js';

// Sentry 配置
const DEFAULT_CONFIG = {
  dsn: '',                          // Sentry DSN
  environment: 'production',        // 环境
  release: '1.0.0',                 // 版本
  sampleRate: 1.0,                  // 采样率
  maxBreadcrumbs: 50,               // 最大面包屑数量
  enableAutoSessionTracking: true,  // 自动会话追踪
  enableNative: false,              // 原生崩溃追踪（小程序不支持）
  debug: false                      // 调试模式
};

// 面包屑类型
const BREADCRUMB_TYPES = {
  NAVIGATION: 'navigation',
  HTTP: 'http',
  UI: 'ui',
  USER: 'user',
  DEBUG: 'debug',
  ERROR: 'error'
};

// 严重级别
const SEVERITY_LEVELS = {
  FATAL: 'fatal',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  DEBUG: 'debug'
};

/**
 * Sentry 小程序适配类
 */
class SentryMiniProgramPatch {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.breadcrumbs = [];
    this.userContext = {};
    this.tags = {};
    this.extra = {};
    this.isInitialized = false;
    this.sessionId = null;
    this.eventQueue = [];
  }

  /**
   * 初始化 Sentry
   * @param {Object} options - 配置选项
   */
  init(options = {}) {
    if (this.isInitialized) {
      console.warn('[SentryPatch] 已经初始化');
      return;
    }

    this.config = { ...this.config, ...options };

    // 生成会话ID
    this.sessionId = this._generateSessionId();

    // 设置默认标签
    this._setDefaultTags();

    // 集成全局错误处理器
    this._integrateGlobalErrorHandler();

    // 设置导航追踪
    this._setupNavigationTracking();

    // 设置网络请求追踪
    this._setupNetworkTracking();

    // 启动会话
    if (this.config.enableAutoSessionTracking) {
      this._startSession();
    }

    this.isInitialized = true;
    console.log('[SentryPatch] 初始化完成，会话ID:', this.sessionId);
  }

  /**
   * 捕获异常
   * @param {Error} error - 错误对象
   * @param {Object} context - 上下文
   */
  captureException(error, context = {}) {
    const event = this._buildEvent({
      level: SEVERITY_LEVELS.ERROR,
      exception: {
        type: error.name || 'Error',
        value: error.message,
        stacktrace: this._parseStacktrace(error.stack)
      },
      ...context
    });

    this._sendEvent(event);
    return event.event_id;
  }

  /**
   * 捕获消息
   * @param {string} message - 消息
   * @param {string} level - 级别
   */
  captureMessage(message, level = SEVERITY_LEVELS.INFO) {
    const event = this._buildEvent({
      level: level,
      message: message
    });

    this._sendEvent(event);
    return event.event_id;
  }

  /**
   * 添加面包屑
   * @param {Object} breadcrumb - 面包屑数据
   */
  addBreadcrumb(breadcrumb) {
    const crumb = {
      timestamp: Date.now() / 1000,
      type: breadcrumb.type || BREADCRUMB_TYPES.DEBUG,
      category: breadcrumb.category || 'default',
      message: breadcrumb.message,
      data: breadcrumb.data,
      level: breadcrumb.level || SEVERITY_LEVELS.INFO
    };

    this.breadcrumbs.push(crumb);

    // 限制面包屑数量
    if (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.config.maxBreadcrumbs);
    }
  }

  /**
   * 设置用户上下文
   * @param {Object} user - 用户信息
   */
  setUser(user) {
    this.userContext = {
      id: user.id,
      username: user.username,
      email: user.email,
      ...user
    };
  }

  /**
   * 清除用户上下文
   */
  clearUser() {
    this.userContext = {};
  }

  /**
   * 设置标签
   * @param {string} key - 标签键
   * @param {string} value - 标签值
   */
  setTag(key, value) {
    this.tags[key] = value;
  }

  /**
   * 设置额外数据
   * @param {string} key - 键
   * @param {any} value - 值
   */
  setExtra(key, value) {
    this.extra[key] = value;
  }

  /**
   * 设置上下文
   * @param {string} name - 上下文名称
   * @param {Object} context - 上下文数据
   */
  setContext(name, context) {
    this.extra[`context_${name}`] = context;
  }

  /**
   * 创建作用域
   * @param {Function} callback - 回调函数
   */
  withScope(callback) {
    // 简化实现：直接执行回调
    const scope = {
      setTag: (key, value) => this.setTag(key, value),
      setExtra: (key, value) => this.setExtra(key, value),
      setUser: (user) => this.setUser(user),
      addBreadcrumb: (crumb) => this.addBreadcrumb(crumb)
    };
    callback(scope);
  }

  /**
   * 用户反馈
   * @param {Object} feedback - 反馈数据
   */
  captureUserFeedback(feedback) {
    const event = this._buildEvent({
      level: SEVERITY_LEVELS.INFO,
      type: 'user_feedback',
      message: feedback.comments,
      user: {
        name: feedback.name,
        email: feedback.email
      },
      extra: {
        event_id: feedback.event_id
      }
    });

    this._sendEvent(event);
  }

  // ==================== 私有方法 ====================

  /**
   * 集成全局错误处理器
   * @private
   */
  _integrateGlobalErrorHandler() {
    globalErrorHandler.init({
      onError: (errorRecord) => {
        // 将错误转发到 Sentry
        this.captureException(new Error(errorRecord.message), {
          extra: {
            errorType: errorRecord.type,
            page: errorRecord.page,
            timestamp: errorRecord.timestamp
          }
        });
      }
    });
  }

  /**
   * 设置导航追踪
   * @private
   */
  _setupNavigationTracking() {
    // 拦截页面跳转
    const originalNavigateTo = uni.navigateTo;
    const self = this;

    uni.navigateTo = function(options) {
      self.addBreadcrumb({
        type: BREADCRUMB_TYPES.NAVIGATION,
        category: 'navigation',
        message: `Navigate to ${options.url}`,
        data: { url: options.url }
      });
      return originalNavigateTo.call(this, options);
    };

    // 拦截页面返回
    const originalNavigateBack = uni.navigateBack;
    uni.navigateBack = function(options) {
      self.addBreadcrumb({
        type: BREADCRUMB_TYPES.NAVIGATION,
        category: 'navigation',
        message: 'Navigate back',
        data: { delta: options?.delta || 1 }
      });
      return originalNavigateBack.call(this, options);
    };
  }

  /**
   * 设置网络请求追踪
   * @private
   */
  _setupNetworkTracking() {
    const originalRequest = uni.request;
    const self = this;

    uni.request = function(options) {
      const startTime = Date.now();
      const url = options.url;

      // 添加请求面包屑
      self.addBreadcrumb({
        type: BREADCRUMB_TYPES.HTTP,
        category: 'http',
        message: `${options.method || 'GET'} ${url}`,
        data: {
          url: url,
          method: options.method || 'GET'
        }
      });

      const originalSuccess = options.success;
      const originalFail = options.fail;

      options.success = function(res) {
        const duration = Date.now() - startTime;
        
        self.addBreadcrumb({
          type: BREADCRUMB_TYPES.HTTP,
          category: 'http',
          message: `Response ${res.statusCode} from ${url}`,
          data: {
            url: url,
            status_code: res.statusCode,
            duration: duration
          },
          level: res.statusCode >= 400 ? SEVERITY_LEVELS.ERROR : SEVERITY_LEVELS.INFO
        });

        if (originalSuccess) {
          originalSuccess(res);
        }
      };

      options.fail = function(err) {
        const duration = Date.now() - startTime;
        
        self.addBreadcrumb({
          type: BREADCRUMB_TYPES.HTTP,
          category: 'http',
          message: `Request failed: ${url}`,
          data: {
            url: url,
            error: err.errMsg,
            duration: duration
          },
          level: SEVERITY_LEVELS.ERROR
        });

        if (originalFail) {
          originalFail(err);
        }
      };

      return originalRequest.call(this, options);
    };
  }

  /**
   * 设置默认标签
   * @private
   */
  _setDefaultTags() {
    try {
      // #ifdef MP-WEIXIN
      // 使用新的 API 替代废弃的 getSystemInfoSync
      const deviceInfo = uni.getDeviceInfo();
      const windowInfo = uni.getWindowInfo();
      const appBaseInfo = uni.getAppBaseInfo();
      
      this.tags = {
        platform: deviceInfo.platform,
        system: deviceInfo.system,
        version: appBaseInfo.version,
        model: deviceInfo.model,
        brand: deviceInfo.brand,
        screenWidth: windowInfo.screenWidth,
        screenHeight: windowInfo.screenHeight,
        language: appBaseInfo.language,
        'mp.type': 'weixin'
      };
      // #endif
      
      // #ifndef MP-WEIXIN
      const systemInfo = uni.getSystemInfoSync();
      
      this.tags = {
        platform: systemInfo.platform,
        system: systemInfo.system,
        version: systemInfo.version,
        model: systemInfo.model,
        brand: systemInfo.brand,
        screenWidth: systemInfo.screenWidth,
        screenHeight: systemInfo.screenHeight,
        language: systemInfo.language,
        // #ifdef H5
        'mp.type': 'h5',
        // #endif
        // #ifdef APP-PLUS
        'mp.type': 'app',
        // #endif
      };
      // #endif
    } catch (e) {
      console.warn('[SentryPatch] 获取系统信息失败:', e);
    }
  }

  /**
   * 启动会话
   * @private
   */
  _startSession() {
    const session = {
      sid: this.sessionId,
      started: new Date().toISOString(),
      status: 'ok',
      attrs: {
        release: this.config.release,
        environment: this.config.environment
      }
    };

    // 保存会话信息
    uni.setStorageSync('sentry_session', session);

    // 监听应用隐藏/显示
    uni.onAppHide(() => {
      this._endSession();
    });

    uni.onAppShow(() => {
      this._resumeSession();
    });
  }

  /**
   * 结束会话
   * @private
   */
  _endSession() {
    const session = uni.getStorageSync('sentry_session');
    if (session) {
      session.status = 'exited';
      session.duration = (Date.now() - new Date(session.started).getTime()) / 1000;
      uni.setStorageSync('sentry_session', session);
    }
  }

  /**
   * 恢复会话
   * @private
   */
  _resumeSession() {
    const session = uni.getStorageSync('sentry_session');
    if (session && session.status === 'exited') {
      // 创建新会话
      this.sessionId = this._generateSessionId();
      this._startSession();
    }
  }

  /**
   * 构建事件
   * @private
   */
  _buildEvent(data) {
    return {
      event_id: this._generateEventId(),
      timestamp: new Date().toISOString(),
      platform: 'javascript',
      sdk: {
        name: 'sentry-miniprogram-patch',
        version: '1.0.0'
      },
      release: this.config.release,
      environment: this.config.environment,
      tags: { ...this.tags },
      extra: { ...this.extra },
      user: { ...this.userContext },
      breadcrumbs: [...this.breadcrumbs],
      contexts: {
        device: this._getDeviceContext(),
        app: this._getAppContext()
      },
      ...data
    };
  }

  /**
   * 发送事件
   * @private
   */
  async _sendEvent(event) {
    // 采样
    if (Math.random() > this.config.sampleRate) {
      if (this.config.debug) {
        console.log('[SentryPatch] 事件被采样过滤:', event.event_id);
      }
      return;
    }

    // 如果没有配置 DSN，保存到本地
    if (!this.config.dsn) {
      this._saveEventLocally(event);
      return;
    }

    try {
      // 解析 DSN
      const { host, projectId, publicKey } = this._parseDSN(this.config.dsn);
      const url = `https://${host}/api/${projectId}/store/?sentry_key=${publicKey}&sentry_version=7`;

      await uni.request({
        url: url,
        method: 'POST',
        data: event,
        header: {
          'Content-Type': 'application/json'
        }
      });

      if (this.config.debug) {
        console.log('[SentryPatch] 事件已发送:', event.event_id);
      }
    } catch (e) {
      console.warn('[SentryPatch] 发送事件失败:', e);
      this._saveEventLocally(event);
    }
  }

  /**
   * 保存事件到本地
   * @private
   */
  _saveEventLocally(event) {
    try {
      const events = uni.getStorageSync('sentry_events') || [];
      events.push(event);
      
      // 限制本地存储数量
      if (events.length > 50) {
        events.splice(0, events.length - 50);
      }
      
      uni.setStorageSync('sentry_events', events);
      
      if (this.config.debug) {
        console.log('[SentryPatch] 事件已保存到本地:', event.event_id);
      }
    } catch (e) {
      console.warn('[SentryPatch] 保存事件失败:', e);
    }
  }

  /**
   * 解析 DSN
   * @private
   */
  _parseDSN(dsn) {
    try {
      const match = dsn.match(/^https?:\/\/([^@]+)@([^/]+)\/(.+)$/);
      if (match) {
        return {
          publicKey: match[1],
          host: match[2],
          projectId: match[3]
        };
      }
    } catch (e) {
      console.error('[SentryPatch] DSN 解析失败:', e);
    }
    return { host: '', projectId: '', publicKey: '' };
  }

  /**
   * 解析堆栈
   * @private
   */
  _parseStacktrace(stack) {
    if (!stack) return { frames: [] };

    const frames = stack.split('\n').map(line => {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        return {
          function: match[1],
          filename: match[2],
          lineno: parseInt(match[3]),
          colno: parseInt(match[4])
        };
      }
      return { raw: line };
    }).filter(f => f.function || f.raw);

    return { frames: frames.reverse() };
  }

  /**
   * 获取设备上下文
   * @private
   */
  _getDeviceContext() {
    try {
      // #ifdef MP-WEIXIN
      // 使用新的 API 替代废弃的 getSystemInfoSync
      const deviceInfo = uni.getDeviceInfo();
      const windowInfo = uni.getWindowInfo();
      return {
        model: deviceInfo.model,
        brand: deviceInfo.brand,
        screen_width_pixels: windowInfo.screenWidth,
        screen_height_pixels: windowInfo.screenHeight,
        screen_density: deviceInfo.pixelRatio
      };
      // #endif
      
      // #ifndef MP-WEIXIN
      const systemInfo = uni.getSystemInfoSync();
      return {
        model: systemInfo.model,
        brand: systemInfo.brand,
        screen_width_pixels: systemInfo.screenWidth,
        screen_height_pixels: systemInfo.screenHeight,
        screen_density: systemInfo.pixelRatio
      };
      // #endif
    } catch (e) {
      return {};
    }
  }

  /**
   * 获取应用上下文
   * @private
   */
  _getAppContext() {
    return {
      app_name: 'Exam-Master',
      app_version: this.config.release,
      app_build: this.config.release
    };
  }

  /**
   * 生成会话ID
   * @private
   */
  _generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成事件ID
   * @private
   */
  _generateEventId() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

// 创建单例
export const sentryPatch = new SentryMiniProgramPatch();

// 便捷函数
export function initSentry(options) {
  return sentryPatch.init(options);
}

export function captureException(error, context) {
  return sentryPatch.captureException(error, context);
}

export function captureMessage(message, level) {
  return sentryPatch.captureMessage(message, level);
}

export function addBreadcrumb(breadcrumb) {
  return sentryPatch.addBreadcrumb(breadcrumb);
}

export function setUser(user) {
  return sentryPatch.setUser(user);
}

export function setTag(key, value) {
  return sentryPatch.setTag(key, value);
}

// 导出常量
export { BREADCRUMB_TYPES, SEVERITY_LEVELS };

// 默认导出
export default sentryPatch;
