/**
 * 知识点气泡交互处理器
 * 解决检查点1.4：知识点推荐气泡点击仅跳转问题
 *
 * 功能：
 * 1. 缩放动画效果
 * 2. 轨迹记录
 * 3. 点击反馈
 * 4. 气泡状态管理
 */

// 存储键名
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
const STORAGE_KEYS = {
  CLICK_HISTORY: 'bubble_click_history',
  INTERACTION_STATS: 'bubble_interaction_stats'
};

/**
 * 气泡交互处理类
 */
class BubbleInteraction {
  constructor() {
    this.clickHistory = [];
    this.interactionStats = {};
    this.animatingBubbles = new Set();
  }

  /**
   * 初始化
   */
  init() {
    try {
      this.clickHistory = storageService.get(STORAGE_KEYS.CLICK_HISTORY, []);
      this.interactionStats = storageService.get(STORAGE_KEYS.INTERACTION_STATS, {});
    } catch (e) {
      console.error('[BubbleInteraction] 初始化失败:', e);
    }
  }

  /**
   * 处理气泡点击
   * @param {Object} bubble - 气泡数据
   * @param {Object} options - 配置选项
   */
  async handleClick(bubble, options = {}) {
    const {
      enableAnimation = true,
      enableVibration = true,
      enableTracking = true,
      onAnimationStart,
      onAnimationEnd
    } = options;

    // 防止重复点击
    if (this.animatingBubbles.has(bubble.id)) {
      return { success: false, reason: 'animating' };
    }

    // 震动反馈
    if (enableVibration) {
      this.vibrate();
    }

    // 播放动画
    if (enableAnimation) {
      await this.playClickAnimation(bubble, { onAnimationStart, onAnimationEnd });
    }

    // 记录轨迹
    if (enableTracking) {
      this.recordClick(bubble);
    }

    return { success: true, bubble };
  }

  /**
   * 播放点击动画
   * @param {Object} bubble - 气泡数据
   * @param {Object} callbacks - 回调函数
   */
  async playClickAnimation(bubble, callbacks = {}) {
    const { onAnimationStart, onAnimationEnd } = callbacks;

    this.animatingBubbles.add(bubble.id);

    // 触发动画开始回调
    if (onAnimationStart) {
      onAnimationStart(bubble);
    }

    // 返回动画配置
    const animation = {
      id: bubble.id,
      type: 'scale',
      duration: 300,
      keyframes: [
        { scale: 1, opacity: 1 },
        { scale: 1.15, opacity: 0.9 },
        { scale: 0.95, opacity: 1 },
        { scale: 1, opacity: 1 }
      ],
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    };

    // 等待动画完成
    await new Promise((resolve) => {
      setTimeout(() => {
        this.animatingBubbles.delete(bubble.id);

        // 触发动画结束回调
        if (onAnimationEnd) {
          onAnimationEnd(bubble);
        }

        resolve();
      }, animation.duration);
    });

    return animation;
  }

  /**
   * 获取气泡动画样式
   * @param {string} bubbleId - 气泡ID
   * @param {boolean} isAnimating - 是否正在动画
   */
  getAnimationStyle(bubbleId, isAnimating) {
    if (!isAnimating) {
      return {};
    }

    return {
      animation: 'bubbleClick 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      transformOrigin: 'center center'
    };
  }

  /**
   * 获取 CSS 动画关键帧
   */
  getAnimationKeyframes() {
    return `
      @keyframes bubbleClick {
        0% { transform: scale(1); opacity: 1; }
        30% { transform: scale(1.15); opacity: 0.9; }
        60% { transform: scale(0.95); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      
      @keyframes bubbleGlow {
        0% { box-shadow: 0 0 20rpx currentColor; }
        50% { box-shadow: 0 0 40rpx currentColor; }
        100% { box-shadow: 0 0 20rpx currentColor; }
      }
      
      @keyframes bubbleRipple {
        0% { transform: scale(0); opacity: 0.5; }
        100% { transform: scale(2); opacity: 0; }
      }
    `;
  }

  /**
   * 记录点击轨迹
   * @param {Object} bubble - 气泡数据
   */
  recordClick(bubble) {
    const record = {
      bubbleId: bubble.id,
      title: bubble.title,
      mastery: bubble.mastery,
      timestamp: Date.now(),
      date: new Date().toISOString().split('T')[0]
    };

    // 添加到历史记录
    this.clickHistory.unshift(record);

    // 限制历史记录数量
    if (this.clickHistory.length > 500) {
      this.clickHistory = this.clickHistory.slice(0, 500);
    }

    // 更新统计
    if (!this.interactionStats[bubble.id]) {
      this.interactionStats[bubble.id] = {
        clickCount: 0,
        lastClick: null,
        firstClick: record.timestamp
      };
    }
    this.interactionStats[bubble.id].clickCount++;
    this.interactionStats[bubble.id].lastClick = record.timestamp;

    // 保存到本地
    this.saveData();

    // 发送事件（用于学习轨迹记录）
    uni.$emit('bubble:clicked', record);

    logger.log('[BubbleInteraction] 记录点击:', bubble.title);
  }

  /**
   * 获取点击历史
   * @param {Object} options - 查询选项
   */
  getClickHistory(options = {}) {
    const { bubbleId, limit = 50, startDate, endDate } = options;

    let history = [...this.clickHistory];

    // 按气泡ID筛选
    if (bubbleId) {
      history = history.filter((h) => h.bubbleId === bubbleId);
    }

    // 按日期筛选
    if (startDate) {
      history = history.filter((h) => h.date >= startDate);
    }
    if (endDate) {
      history = history.filter((h) => h.date <= endDate);
    }

    // 限制数量
    return history.slice(0, limit);
  }

  /**
   * 获取气泡统计
   * @param {string} bubbleId - 气泡ID
   */
  getBubbleStats(bubbleId) {
    if (bubbleId) {
      return this.interactionStats[bubbleId] || null;
    }
    return this.interactionStats;
  }

  /**
   * 获取热门气泡（按点击次数排序）
   * @param {number} limit - 返回数量
   */
  getHotBubbles(limit = 5) {
    const bubbles = Object.entries(this.interactionStats)
      .map(([id, stats]) => ({
        id,
        ...stats
      }))
      .sort((a, b) => b.clickCount - a.clickCount)
      .slice(0, limit);

    return bubbles;
  }

  /**
   * 获取今日点击统计
   */
  getTodayStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayClicks = this.clickHistory.filter((h) => h.date === today);

    // 按气泡分组统计
    const byBubble = {};
    todayClicks.forEach((click) => {
      if (!byBubble[click.bubbleId]) {
        byBubble[click.bubbleId] = {
          title: click.title,
          count: 0
        };
      }
      byBubble[click.bubbleId].count++;
    });

    return {
      totalClicks: todayClicks.length,
      uniqueBubbles: Object.keys(byBubble).length,
      byBubble
    };
  }

  /**
   * 震动反馈
   */
  vibrate() {
    try {
      uni.vibrateShort({ type: 'light' });
    } catch (_e) {}
  }

  /**
   * 保存数据到本地
   */
  saveData() {
    try {
      storageService.save(STORAGE_KEYS.CLICK_HISTORY, this.clickHistory);
      storageService.save(STORAGE_KEYS.INTERACTION_STATS, this.interactionStats);
    } catch (e) {
      console.error('[BubbleInteraction] 保存失败:', e);
    }
  }

  /**
   * 清除历史记录
   */
  clearHistory() {
    this.clickHistory = [];
    this.interactionStats = {};
    this.saveData();
    logger.log('[BubbleInteraction] 历史已清除');
  }
}

// 导出单例
export const bubbleInteraction = new BubbleInteraction();

// 初始化
bubbleInteraction.init();

export default bubbleInteraction;
