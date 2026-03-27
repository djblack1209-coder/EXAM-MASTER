/**
 * 刷题手势操作模块 - 支持左右滑动切换题目
 *
 * 核心功能：
 * 1. 左右滑动切换题目
 * 2. 滑动动画效果
 * 3. 边界检测与反馈
 * 4. 手势灵敏度配置
 */

import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { getWindowInfo as _getWindowInfo } from '@/utils/core/system.js';
import { toast } from '@/utils/toast.js';
const STORAGE_KEY = 'swipe_gesture_settings';

// 默认配置
const DEFAULT_SETTINGS = {
  enabled: true,
  minSwipeDistance: 50, // 最小滑动距离（px）
  maxSwipeTime: 300, // 最大滑动时间（ms）
  swipeThreshold: 0.3, // 滑动阈值（屏幕宽度的比例）
  enableVibration: true, // 是否启用震动反馈
  enableAnimation: true, // 是否启用动画
  animationDuration: 300, // 动画时长（ms）
  allowSwipeWhenAnswered: false // 已答题时是否允许滑动
};

/**
 * 滑动手势管理器
 */
class SwipeGestureManager {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.currentX = 0;
    this.isTracking = false;
    this.screenWidth = 375;
    this.callbacks = {
      onSwipeLeft: null,
      onSwipeRight: null,
      onSwipeStart: null,
      onSwipeMove: null,
      onSwipeEnd: null,
      onBoundaryReached: null
    };
    this.isInitialized = false;
  }

  /**
   * 初始化
   * @param {Object} options - 配置选项
   */
  init(options = {}) {
    if (this.isInitialized) return;

    this._loadSettings();

    // 获取屏幕宽度
    try {
      if (typeof uni !== 'undefined') {
        this.screenWidth = _getWindowInfo().windowWidth;
      }
    } catch (_e) {
      this.screenWidth = 375;
    }

    // 合并配置
    if (options.settings) {
      this.settings = { ...this.settings, ...options.settings };
    }

    this.isInitialized = true;
    logger.log('[SwipeGesture] 初始化完成');
  }

  /**
   * 更新设置
   * @param {Object} newSettings - 新设置
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    this._saveSettings();
  }

  /**
   * 获取当前设置
   * @returns {Object} 当前设置
   */
  getSettings() {
    this.init();
    return { ...this.settings };
  }

  /**
   * 绑定回调函数
   * @param {Object} callbacks - 回调函数集合
   */
  bindCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * 处理触摸开始
   * @param {Object} event - 触摸事件
   * @param {Object} context - 上下文信息
   * @returns {Object} 处理结果
   */
  handleTouchStart(event, context = {}) {
    if (!this.settings.enabled) return { handled: false };

    const touch = event.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startTime = Date.now();
    this.currentX = touch.clientX;
    this.isTracking = true;

    if (this.callbacks.onSwipeStart) {
      this.callbacks.onSwipeStart({
        startX: this.startX,
        startY: this.startY,
        context
      });
    }

    return { handled: true, startX: this.startX, startY: this.startY };
  }

  /**
   * 处理触摸移动
   * @param {Object} event - 触摸事件
   * @param {Object} context - 上下文信息
   * @returns {Object} 处理结果
   */
  handleTouchMove(event, context = {}) {
    if (!this.settings.enabled || !this.isTracking) return { handled: false };

    const touch = event.touches[0];
    this.currentX = touch.clientX;
    const currentY = touch.clientY;

    const deltaX = this.currentX - this.startX;
    const deltaY = currentY - this.startY;

    // 判断是否为水平滑动（水平位移大于垂直位移）
    if (Math.abs(deltaX) < Math.abs(deltaY)) {
      // 垂直滑动，不处理
      return { handled: false, isVertical: true };
    }

    // 计算滑动进度
    const progress = deltaX / this.screenWidth;
    const direction = deltaX > 0 ? 'right' : 'left';

    // 边界检测
    const { currentIndex, totalQuestions, hasAnswered } = context;
    const isAtStart = currentIndex === 0 && direction === 'right';
    const isAtEnd = currentIndex === totalQuestions - 1 && direction === 'left';

    // 已答题且不允许滑动
    if (hasAnswered && !this.settings.allowSwipeWhenAnswered) {
      return { handled: false, reason: 'answered' };
    }

    if (this.callbacks.onSwipeMove) {
      this.callbacks.onSwipeMove({
        deltaX,
        deltaY,
        progress,
        direction,
        isAtStart,
        isAtEnd,
        context
      });
    }

    return {
      handled: true,
      deltaX,
      progress,
      direction,
      isAtStart,
      isAtEnd
    };
  }

  /**
   * 处理触摸结束
   * @param {Object} event - 触摸事件
   * @param {Object} context - 上下文信息
   * @returns {Object} 处理结果
   */
  handleTouchEnd(event, context = {}) {
    if (!this.settings.enabled || !this.isTracking) return { handled: false };

    this.isTracking = false;

    const endTime = Date.now();
    const duration = endTime - this.startTime;
    const deltaX = this.currentX - this.startX;
    const distance = Math.abs(deltaX);
    const direction = deltaX > 0 ? 'right' : 'left';

    // 判断是否为有效滑动
    const isValidSwipe = this._isValidSwipe(distance, duration);

    if (!isValidSwipe) {
      if (this.callbacks.onSwipeEnd) {
        this.callbacks.onSwipeEnd({
          success: false,
          reason: 'invalid_swipe',
          deltaX,
          duration,
          context
        });
      }
      return { handled: true, success: false, reason: 'invalid_swipe' };
    }

    // 边界检测
    const { currentIndex, totalQuestions, hasAnswered } = context;
    const isAtStart = currentIndex === 0;
    const isAtEnd = currentIndex === totalQuestions - 1;

    // 已答题检测
    if (hasAnswered && !this.settings.allowSwipeWhenAnswered) {
      return { handled: true, success: false, reason: 'answered' };
    }

    // 处理边界情况
    if (direction === 'right' && isAtStart) {
      this._triggerBoundaryFeedback('start');
      if (this.callbacks.onBoundaryReached) {
        this.callbacks.onBoundaryReached({ boundary: 'start', context });
      }
      return { handled: true, success: false, reason: 'boundary_start' };
    }

    if (direction === 'left' && isAtEnd) {
      this._triggerBoundaryFeedback('end');
      if (this.callbacks.onBoundaryReached) {
        this.callbacks.onBoundaryReached({ boundary: 'end', context });
      }
      return { handled: true, success: false, reason: 'boundary_end' };
    }

    // 触发滑动回调
    this._triggerSwipeFeedback();

    if (direction === 'left' && this.callbacks.onSwipeLeft) {
      this.callbacks.onSwipeLeft({ deltaX, duration, context });
    } else if (direction === 'right' && this.callbacks.onSwipeRight) {
      this.callbacks.onSwipeRight({ deltaX, duration, context });
    }

    if (this.callbacks.onSwipeEnd) {
      this.callbacks.onSwipeEnd({
        success: true,
        direction,
        deltaX,
        duration,
        context
      });
    }

    return {
      handled: true,
      success: true,
      direction,
      deltaX,
      duration
    };
  }

  /**
   * 获取滑动动画样式
   * @param {number} deltaX - 水平位移
   * @param {boolean} isAnimating - 是否正在动画
   * @returns {Object} 样式对象
   */
  getSwipeStyle(deltaX, isAnimating = false) {
    if (!this.settings.enableAnimation) {
      return {};
    }

    const transform = `translateX(${deltaX}px)`;
    const transition = isAnimating ? `transform ${this.settings.animationDuration}ms ease-out` : 'none';

    return {
      transform,
      transition,
      webkitTransform: transform,
      webkitTransition: transition
    };
  }

  /**
   * 生成进入动画样式
   * @param {string} direction - 进入方向 ('left' | 'right')
   * @returns {Object} 动画配置
   */
  getEnterAnimation(direction) {
    const startX = direction === 'left' ? this.screenWidth : -this.screenWidth;

    return {
      from: { transform: `translateX(${startX}px)`, opacity: 0 },
      to: { transform: 'translateX(0)', opacity: 1 },
      duration: this.settings.animationDuration,
      easing: 'ease-out'
    };
  }

  /**
   * 生成离开动画样式
   * @param {string} direction - 离开方向 ('left' | 'right')
   * @returns {Object} 动画配置
   */
  getLeaveAnimation(direction) {
    const endX = direction === 'left' ? -this.screenWidth : this.screenWidth;

    return {
      from: { transform: 'translateX(0)', opacity: 1 },
      to: { transform: `translateX(${endX}px)`, opacity: 0 },
      duration: this.settings.animationDuration,
      easing: 'ease-in'
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 判断是否为有效滑动
   */
  _isValidSwipe(distance, duration) {
    // 距离检测
    if (distance < this.settings.minSwipeDistance) {
      return false;
    }

    // 时间检测（快速滑动）
    if (duration < this.settings.maxSwipeTime) {
      return true;
    }

    // 距离阈值检测（慢速但距离足够）
    const threshold = this.screenWidth * this.settings.swipeThreshold;
    return distance >= threshold;
  }

  /**
   * 触发滑动反馈
   */
  _triggerSwipeFeedback() {
    if (!this.settings.enableVibration) return;

    try {
      if (typeof uni !== 'undefined' && typeof uni.vibrateShort === 'function') {
        uni.vibrateShort({ type: 'light' });
      }
    } catch (e) {
      logger.warn('[SwipeGesture] 震动反馈失败:', e);
    }
  }

  /**
   * 触发边界反馈
   */
  _triggerBoundaryFeedback(boundary) {
    if (!this.settings.enableVibration) return;

    try {
      if (typeof uni !== 'undefined' && typeof uni.vibrateShort === 'function') {
        uni.vibrateShort({ type: 'heavy' });
      }
    } catch (e) {
      logger.warn('[SwipeGesture] 边界震动反馈失败:', e);
    }

    // 显示提示
    const message = boundary === 'start' ? '已经是第一题了' : '已经是最后一题了';
    try {
      if (typeof uni !== 'undefined') {
        toast.info(message, 1500);
      }
    } catch (e) {
      logger.warn('[SwipeGesture] 显示提示失败:', e);
    }
  }

  /**
   * 加载设置
   */
  _loadSettings() {
    try {
      if (typeof uni !== 'undefined') {
        const saved = storageService.get(STORAGE_KEY);
        if (saved) {
          this.settings = { ...DEFAULT_SETTINGS, ...saved };
        }
      }
    } catch (e) {
      logger.warn('[SwipeGesture] 加载设置失败:', e);
    }
  }

  /**
   * 保存设置
   */
  _saveSettings() {
    try {
      if (typeof uni !== 'undefined') {
        storageService.save(STORAGE_KEY, this.settings);
      }
    } catch (e) {
      logger.warn('[SwipeGesture] 保存设置失败:', e);
    }
  }
}

// 创建单例
export const swipeGestureManager = new SwipeGestureManager();

// 便捷函数
export function initSwipeGesture(options) {
  return swipeGestureManager.init(options);
}

export function bindSwipeCallbacks(callbacks) {
  return swipeGestureManager.bindCallbacks(callbacks);
}

export function handleTouchStart(event, context) {
  return swipeGestureManager.handleTouchStart(event, context);
}

export function handleTouchMove(event, context) {
  return swipeGestureManager.handleTouchMove(event, context);
}

export function handleTouchEnd(event, context) {
  return swipeGestureManager.handleTouchEnd(event, context);
}

export function getSwipeStyle(deltaX, isAnimating) {
  return swipeGestureManager.getSwipeStyle(deltaX, isAnimating);
}

export function getSwipeSettings() {
  return swipeGestureManager.getSettings();
}

export function updateSwipeSettings(settings) {
  return swipeGestureManager.updateSettings(settings);
}

export default swipeGestureManager;
