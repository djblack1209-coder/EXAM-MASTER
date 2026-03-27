/**
 * 页面追踪 Composable（从 tracking-mixin 迁移）
 * 自动上报页面停留时间和用户行为
 *
 * 在 setup() 中调用即可自动注册 uni-app 页面生命周期钩子：
 *   onLoad → page_enter
 *   onShow → 恢复追踪
 *   onHide → page_hide
 *   onUnload → page_leave
 *
 * @module composables/useTracking
 */
import { onLoad, onShow, onHide, onUnload } from '@dcloudio/uni-app';
import { analytics } from '@/utils/analytics/event-bus-analytics.js';
import { logger } from '@/utils/logger.js';

// 页面停留时间阈值（毫秒）
const STAY_TIME_THRESHOLDS = {
  SHORT: 5000, // 5秒 - 快速浏览
  MEDIUM: 30000, // 30秒 - 正常浏览
  LONG: 120000, // 2分钟 - 深度阅读
  VERY_LONG: 300000 // 5分钟 - 沉浸学习
};

export function useTracking() {
  // 内部状态（不需要响应式，纯追踪用途）
  const tracking = {
    pageEnterTime: 0,
    pageRoute: '',
    isTracking: false,
    heartbeatTimer: null,
    interactionCount: 0,
    scrollDepth: 0,
    pageOptions: null
  };

  // ---- 内部方法 ----

  function _getStayTimeLevel(stayTime) {
    if (stayTime >= STAY_TIME_THRESHOLDS.VERY_LONG) return 'very_long';
    if (stayTime >= STAY_TIME_THRESHOLDS.LONG) return 'long';
    if (stayTime >= STAY_TIME_THRESHOLDS.MEDIUM) return 'medium';
    if (stayTime >= STAY_TIME_THRESHOLDS.SHORT) return 'short';
    return 'bounce';
  }

  function _startHeartbeat() {
    if (tracking.heartbeatTimer) {
      clearInterval(tracking.heartbeatTimer);
    }
    tracking.heartbeatTimer = setInterval(() => {
      if (tracking.isTracking) {
        const stayTime = Date.now() - tracking.pageEnterTime;
        analytics.track('page_heartbeat', {
          page: tracking.pageRoute,
          stayTime,
          interactionCount: tracking.interactionCount,
          scrollDepth: tracking.scrollDepth
        });
      }
    }, 30000); // 30秒心跳
  }

  function _startPageTracking(options = {}) {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];

    tracking.pageEnterTime = Date.now();
    tracking.pageRoute = currentPage?.route || 'unknown';
    tracking.isTracking = true;
    tracking.heartbeatTimer = null;
    tracking.interactionCount = 0;
    tracking.scrollDepth = 0;
    tracking.pageOptions = options;

    // 上报页面进入事件
    analytics.track('page_enter', {
      page: tracking.pageRoute,
      options,
      timestamp: tracking.pageEnterTime,
      referrer: pages.length > 1 ? pages[pages.length - 2]?.route : 'direct'
    });

    _startHeartbeat();
    logger.log('[useTracking] 开始追踪页面:', tracking.pageRoute);
  }

  function _pausePageTracking() {
    if (!tracking.isTracking) return;

    const stayTime = Date.now() - tracking.pageEnterTime;
    analytics.track('page_hide', {
      page: tracking.pageRoute,
      stayTime,
      stayTimeLevel: _getStayTimeLevel(stayTime),
      interactionCount: tracking.interactionCount,
      scrollDepth: tracking.scrollDepth
    });

    tracking.isTracking = false;
    if (tracking.heartbeatTimer) {
      clearInterval(tracking.heartbeatTimer);
      tracking.heartbeatTimer = null;
    }
  }

  function _endPageTracking() {
    if (!tracking.pageEnterTime) return;

    const stayTime = Date.now() - tracking.pageEnterTime;
    analytics.track('page_leave', {
      page: tracking.pageRoute,
      stayTime,
      stayTimeLevel: _getStayTimeLevel(stayTime),
      interactionCount: tracking.interactionCount,
      scrollDepth: tracking.scrollDepth
    });

    if (tracking.heartbeatTimer) {
      clearInterval(tracking.heartbeatTimer);
      tracking.heartbeatTimer = null;
    }
    logger.log('[useTracking] 结束追踪页面:', tracking.pageRoute, '停留时间:', stayTime + 'ms');
  }

  // ---- 注册 uni-app 页面生命周期钩子 ----

  onLoad((options) => {
    _startPageTracking(options);
  });

  onShow(() => {
    // 页面重新显示时恢复追踪
    if (!tracking.isTracking) {
      tracking.pageEnterTime = Date.now();
      tracking.isTracking = true;
      _startHeartbeat();
    }
  });

  onHide(() => {
    _pausePageTracking();
  });

  onUnload(() => {
    _endPageTracking();
  });

  // ---- 供页面调用的追踪方法 ----

  /**
   * 记录用户交互
   * @param {string} action - 交互动作名称
   * @param {Object} data - 附加数据
   */
  function trackInteraction(action, data = {}) {
    tracking.interactionCount++;
    analytics.track('user_interaction', {
      page: tracking.pageRoute,
      action,
      interactionIndex: tracking.interactionCount,
      stayTime: Date.now() - tracking.pageEnterTime,
      ...data
    });
  }

  /**
   * 记录滚动深度
   * @param {number} depth - 滚动深度百分比 (0-100)
   */
  function trackScrollDepth(depth) {
    if (depth > tracking.scrollDepth) {
      const milestones = [25, 50, 75, 100];
      const milestone = milestones.find((m) => depth >= m && tracking.scrollDepth < m);
      tracking.scrollDepth = depth;
      if (milestone) {
        analytics.track('scroll_milestone', {
          page: tracking.pageRoute,
          depth: milestone,
          stayTime: Date.now() - tracking.pageEnterTime
        });
      }
    }
  }

  /**
   * 记录按钮点击
   * @param {string} buttonName - 按钮名称
   * @param {Object} data - 附加数据
   */
  function trackButtonClick(buttonName, data = {}) {
    trackInteraction('button_click', { buttonName, ...data });
  }

  /**
   * 记录表单提交
   * @param {string} formName - 表单名称
   * @param {Object} data - 附加数据
   */
  function trackFormSubmit(formName, data = {}) {
    trackInteraction('form_submit', { formName, ...data });
  }

  return {
    trackInteraction,
    trackScrollDepth,
    trackButtonClick,
    trackFormSubmit
  };
}

export default useTracking;
