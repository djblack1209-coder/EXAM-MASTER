/**
 * 页面追踪 Mixin - 检查点 5.1
 * 自动上报页面停留时间和用户行为
 *
 * 使用方式：
 * import { trackingMixin } from '@/utils/analytics/tracking-mixin.js'
 * export default {
 *   mixins: [trackingMixin],
 *   ...
 * }
 */

import { analytics } from './event-bus-analytics.js';
import { logger } from '@/utils/logger.js';

// 页面停留时间阈值（毫秒）
const STAY_TIME_THRESHOLDS = {
  SHORT: 5000, // 5秒 - 快速浏览
  MEDIUM: 30000, // 30秒 - 正常浏览
  LONG: 120000, // 2分钟 - 深度阅读
  VERY_LONG: 300000 // 5分钟 - 沉浸学习
};

/**
 * 页面追踪 Mixin
 */
export const trackingMixin = {
  data() {
    return {
      _tracking: {
        pageEnterTime: 0,
        pageRoute: '',
        isTracking: false,
        heartbeatTimer: null,
        interactionCount: 0,
        scrollDepth: 0
      }
    };
  },

  onLoad(options) {
    this._startPageTracking(options);
  },

  onShow() {
    // 页面重新显示时恢复追踪
    if (this._tracking && !this._tracking.isTracking) {
      this._tracking.pageEnterTime = Date.now();
      this._tracking.isTracking = true;
      this._startHeartbeat();
    }
  },

  onHide() {
    // 页面隐藏时暂停追踪并上报
    this._pausePageTracking();
  },

  onUnload() {
    // 页面卸载时结束追踪
    this._endPageTracking();
  },

  methods: {
    /**
     * 开始页面追踪
     */
    _startPageTracking(options = {}) {
      const pages = getCurrentPages();
      const currentPage = pages[pages.length - 1];

      this._tracking = {
        pageEnterTime: Date.now(),
        pageRoute: currentPage?.route || 'unknown',
        isTracking: true,
        heartbeatTimer: null,
        interactionCount: 0,
        scrollDepth: 0,
        pageOptions: options
      };

      // 上报页面进入事件
      analytics.track('page_enter', {
        page: this._tracking.pageRoute,
        options: options,
        timestamp: this._tracking.pageEnterTime,
        referrer: pages.length > 1 ? pages[pages.length - 2]?.route : 'direct'
      });

      // 启动心跳上报
      this._startHeartbeat();

      logger.log('[TrackingMixin] 开始追踪页面:', this._tracking.pageRoute);
    },

    /**
     * 启动心跳上报（每30秒上报一次活跃状态）
     */
    _startHeartbeat() {
      if (this._tracking.heartbeatTimer) {
        clearInterval(this._tracking.heartbeatTimer);
      }

      this._tracking.heartbeatTimer = setInterval(() => {
        if (this._tracking.isTracking) {
          const stayTime = Date.now() - this._tracking.pageEnterTime;

          analytics.track('page_heartbeat', {
            page: this._tracking.pageRoute,
            stayTime: stayTime,
            interactionCount: this._tracking.interactionCount,
            scrollDepth: this._tracking.scrollDepth
          });
        }
      }, 30000); // 30秒心跳
    },

    /**
     * 暂停页面追踪
     */
    _pausePageTracking() {
      if (!this._tracking.isTracking) return;

      const stayTime = Date.now() - this._tracking.pageEnterTime;

      analytics.track('page_hide', {
        page: this._tracking.pageRoute,
        stayTime: stayTime,
        stayTimeLevel: this._getStayTimeLevel(stayTime),
        interactionCount: this._tracking.interactionCount,
        scrollDepth: this._tracking.scrollDepth
      });

      this._tracking.isTracking = false;

      if (this._tracking.heartbeatTimer) {
        clearInterval(this._tracking.heartbeatTimer);
        this._tracking.heartbeatTimer = null;
      }
    },

    /**
     * 结束页面追踪
     */
    _endPageTracking() {
      if (!this._tracking.pageEnterTime) return;

      const stayTime = Date.now() - this._tracking.pageEnterTime;

      // 上报页面离开事件
      analytics.track('page_leave', {
        page: this._tracking.pageRoute,
        stayTime: stayTime,
        stayTimeLevel: this._getStayTimeLevel(stayTime),
        interactionCount: this._tracking.interactionCount,
        scrollDepth: this._tracking.scrollDepth
      });

      // 清理定时器
      if (this._tracking.heartbeatTimer) {
        clearInterval(this._tracking.heartbeatTimer);
        this._tracking.heartbeatTimer = null;
      }

      logger.log('[TrackingMixin] 结束追踪页面:', this._tracking.pageRoute, '停留时间:', stayTime + 'ms');
    },

    /**
     * 获取停留时间等级
     */
    _getStayTimeLevel(stayTime) {
      if (stayTime >= STAY_TIME_THRESHOLDS.VERY_LONG) return 'very_long';
      if (stayTime >= STAY_TIME_THRESHOLDS.LONG) return 'long';
      if (stayTime >= STAY_TIME_THRESHOLDS.MEDIUM) return 'medium';
      if (stayTime >= STAY_TIME_THRESHOLDS.SHORT) return 'short';
      return 'bounce';
    },

    /**
     * 记录用户交互（供页面调用）
     */
    trackInteraction(action, data = {}) {
      this._tracking.interactionCount++;

      analytics.track('user_interaction', {
        page: this._tracking.pageRoute,
        action: action,
        interactionIndex: this._tracking.interactionCount,
        stayTime: Date.now() - this._tracking.pageEnterTime,
        ...data
      });
    },

    /**
     * 记录滚动深度（供页面调用）
     */
    trackScrollDepth(depth) {
      if (depth > this._tracking.scrollDepth) {
        this._tracking.scrollDepth = depth;

        // 每达到25%的里程碑上报一次
        const milestones = [25, 50, 75, 100];
        const milestone = milestones.find((m) => depth >= m && this._tracking.scrollDepth < m);

        if (milestone) {
          analytics.track('scroll_milestone', {
            page: this._tracking.pageRoute,
            depth: milestone,
            stayTime: Date.now() - this._tracking.pageEnterTime
          });
        }
      }
    },

    /**
     * 记录按钮点击（供页面调用）
     */
    trackButtonClick(buttonName, data = {}) {
      this.trackInteraction('button_click', {
        buttonName: buttonName,
        ...data
      });
    },

    /**
     * 记录表单提交（供页面调用）
     */
    trackFormSubmit(formName, data = {}) {
      this.trackInteraction('form_submit', {
        formName: formName,
        ...data
      });
    }
  }
};

/**
 * 快速追踪页面浏览（不使用 mixin 时使用）
 * @param {string} pageName - 页面名称/标识
 * @param {Object} [data={}] - 附加追踪数据
 */
export function trackPageView(pageName, data = {}) {
  analytics.track('page_view', {
    page: pageName,
    timestamp: Date.now(),
    ...data
  });
}

/**
 * 快速追踪事件（不使用 mixin 时使用）
 * @param {string} eventName - 事件名称/标识
 * @param {Object} [data={}] - 事件负载数据
 */
export function trackEvent(eventName, data = {}) {
  analytics.track(eventName, data);
}

export default trackingMixin;
