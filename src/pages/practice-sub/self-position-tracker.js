/**
 * 自己位置高亮追踪服务
 * 检查点4.1: 排行榜实时更新 - 自己位置高亮
 *
 * 功能：
 * - 在排行榜中追踪并高亮当前用户位置
 * - 位置变化动画效果
 * - 自动滚动到自己位置
 * - 排名变化提示（上升/下降）
 */

import { ref, reactive, computed } from 'vue';
import { rankingSocket } from './ranking-socket';

// 高亮状态类型
const HIGHLIGHT_TYPE = {
  NONE: 'none',
  SELF: 'self', // 自己的位置
  RISING: 'rising', // 排名上升
  FALLING: 'falling', // 排名下降
  NEW_ENTRY: 'new_entry' // 新进榜
};

// 动画配置
const ANIMATION_CONFIG = {
  highlightDuration: 3000, // 高亮持续时间
  scrollDuration: 500, // 滚动动画时间
  pulseCount: 3, // 脉冲动画次数
  rankChangeShowTime: 5000 // 排名变化显示时间
};

class SelfPositionTracker {
  constructor() {
    // 当前用户ID
    this.userId = ref(null);

    // 位置状态
    this.position = reactive({
      currentRank: 0,
      previousRank: 0,
      score: 0,
      percentile: 0, // 超过百分比
      totalUsers: 0,
      isInTop: false, // 是否在榜单内
      highlightType: HIGHLIGHT_TYPE.NONE,
      rankChange: 0, // 排名变化值
      showRankChange: false // 是否显示排名变化
    });

    // 滚动相关
    this.scrollState = reactive({
      targetIndex: -1,
      isScrolling: false,
      scrollViewId: null
    });

    // 高亮定时器
    this.highlightTimer = null;
    this.rankChangeTimer = null;

    // 初始化监听
    this._initListeners();
  }

  /**
   * 初始化WebSocket监听
   */
  _initListeners() {
    // 监听排行榜更新
    rankingSocket.on('rankingUpdate', (data) => {
      this._updatePosition(data);
    });

    // 监听位置变化
    rankingSocket.on('positionChange', (data) => {
      this._handlePositionChange(data);
    });
  }

  /**
   * 设置当前用户ID
   */
  setUserId(userId) {
    this.userId.value = userId;
  }

  /**
   * 更新位置信息
   */
  _updatePosition(rankingData) {
    if (!this.userId.value || !rankingData.list) return;

    const { list, total } = rankingData;
    const userIndex = list.findIndex((item) => item.userId === this.userId.value);

    if (userIndex !== -1) {
      const userData = list[userIndex];
      const newRank = userIndex + 1;

      // 保存之前的排名
      if (this.position.currentRank > 0) {
        this.position.previousRank = this.position.currentRank;
      }

      // 更新当前位置
      this.position.currentRank = newRank;
      this.position.score = userData.score || 0;
      this.position.totalUsers = total || list.length;
      this.position.isInTop = true;

      // 计算超过百分比
      this.position.percentile = Math.round(((this.position.totalUsers - newRank) / this.position.totalUsers) * 100);

      // 设置高亮
      this._setHighlight(HIGHLIGHT_TYPE.SELF);

      // 更新滚动目标
      this.scrollState.targetIndex = userIndex;
    } else {
      // 不在榜单内
      this.position.isInTop = false;
      this.position.currentRank = 0;
      this.scrollState.targetIndex = -1;
    }
  }

  /**
   * 处理位置变化
   */
  _handlePositionChange(data) {
    if (data.userId !== this.userId.value) return;

    const { rank, previousRank, score } = data;

    // 计算排名变化
    const change = previousRank - rank;
    this.position.rankChange = change;
    this.position.previousRank = previousRank;
    this.position.currentRank = rank;
    this.position.score = score;

    // 设置高亮类型
    if (change > 0) {
      this._setHighlight(HIGHLIGHT_TYPE.RISING);
    } else if (change < 0) {
      this._setHighlight(HIGHLIGHT_TYPE.FALLING);
    }

    // 显示排名变化
    this._showRankChange();

    // 触发滚动到自己位置
    this.scrollToSelf();
  }

  /**
   * 设置高亮状态
   */
  _setHighlight(type) {
    // 清除之前的定时器
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
    }

    this.position.highlightType = type;

    // 自动取消高亮
    this.highlightTimer = setTimeout(() => {
      this.position.highlightType = HIGHLIGHT_TYPE.SELF;
    }, ANIMATION_CONFIG.highlightDuration);
  }

  /**
   * 显示排名变化
   */
  _showRankChange() {
    // 清除之前的定时器
    if (this.rankChangeTimer) {
      clearTimeout(this.rankChangeTimer);
    }

    this.position.showRankChange = true;

    // 自动隐藏
    this.rankChangeTimer = setTimeout(() => {
      this.position.showRankChange = false;
    }, ANIMATION_CONFIG.rankChangeShowTime);
  }

  /**
   * 滚动到自己位置
   */
  async scrollToSelf(options = {}) {
    const {
      scrollViewId = this.scrollState.scrollViewId,
      animated = true,
      offset = 100 // 偏移量，让自己位置显示在中间
    } = options;

    if (this.scrollState.targetIndex < 0 || !scrollViewId) {
      return false;
    }

    this.scrollState.isScrolling = true;

    try {
      // 计算滚动位置
      const itemHeight = 80; // 假设每个排行项高度80px
      const scrollTop = Math.max(0, this.scrollState.targetIndex * itemHeight - offset);

      // #ifdef H5
      const scrollView = document.getElementById(scrollViewId);
      if (scrollView) {
        scrollView.scrollTo({
          top: scrollTop,
          behavior: animated ? 'smooth' : 'auto'
        });
      }
      // #endif

      // #ifdef MP-WEIXIN || APP-PLUS
      uni.pageScrollTo({
        scrollTop,
        duration: animated ? ANIMATION_CONFIG.scrollDuration : 0
      });
      // #endif

      await new Promise((resolve) => setTimeout(resolve, ANIMATION_CONFIG.scrollDuration));

      return true;
    } finally {
      this.scrollState.isScrolling = false;
    }
  }

  /**
   * 设置滚动视图ID
   */
  setScrollViewId(id) {
    this.scrollState.scrollViewId = id;
  }

  /**
   * 获取高亮样式类
   */
  getHighlightClass(itemUserId) {
    if (itemUserId !== this.userId.value) {
      return '';
    }

    const classes = ['self-position'];

    switch (this.position.highlightType) {
      case HIGHLIGHT_TYPE.RISING:
        classes.push('rank-rising', 'pulse-animation');
        break;
      case HIGHLIGHT_TYPE.FALLING:
        classes.push('rank-falling');
        break;
      case HIGHLIGHT_TYPE.NEW_ENTRY:
        classes.push('new-entry', 'pulse-animation');
        break;
      case HIGHLIGHT_TYPE.SELF:
        classes.push('highlighted');
        break;
    }

    return classes.join(' ');
  }

  /**
   * 获取排名变化文本
   */
  getRankChangeText() {
    if (!this.position.showRankChange || this.position.rankChange === 0) {
      return '';
    }

    const change = this.position.rankChange;
    if (change > 0) {
      return `↑ ${change}`;
    } else {
      return `↓ ${Math.abs(change)}`;
    }
  }

  /**
   * 获取排名变化样式
   */
  getRankChangeStyle() {
    if (this.position.rankChange > 0) {
      return { color: '#52c41a' }; // 绿色，上升
    } else if (this.position.rankChange < 0) {
      return { color: '#ff4d4f' }; // 红色，下降
    }
    return {};
  }

  /**
   * 检查是否是自己
   */
  isSelf(userId) {
    return userId === this.userId.value;
  }

  /**
   * 获取位置信息
   */
  getPosition() {
    return this.position;
  }

  /**
   * 清理资源
   */
  destroy() {
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
    }
    if (this.rankChangeTimer) {
      clearTimeout(this.rankChangeTimer);
    }
  }
}

// 单例导出
export const selfPositionTracker = new SelfPositionTracker();

// 导出类和常量
export { SelfPositionTracker, HIGHLIGHT_TYPE, ANIMATION_CONFIG };

// Vue组合式API Hook
export function useSelfPosition() {
  const position = computed(() => selfPositionTracker.getPosition());

  return {
    // 状态
    position,

    // 方法
    setUserId: (id) => selfPositionTracker.setUserId(id),
    setScrollViewId: (id) => selfPositionTracker.setScrollViewId(id),
    scrollToSelf: (options) => selfPositionTracker.scrollToSelf(options),
    getHighlightClass: (userId) => selfPositionTracker.getHighlightClass(userId),
    getRankChangeText: () => selfPositionTracker.getRankChangeText(),
    getRankChangeStyle: () => selfPositionTracker.getRankChangeStyle(),
    isSelf: (userId) => selfPositionTracker.isSelf(userId),
    destroy: () => selfPositionTracker.destroy()
  };
}

// 高亮样式（可在组件中引入）
export const highlightStyles = `
.self-position {
  position: relative;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.1) 0%, rgba(64, 158, 255, 0.05) 100%);
  border-left: 3px solid #409eff;
  transition: all 0.3s ease;
}

.self-position.highlighted {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.15) 0%, rgba(64, 158, 255, 0.08) 100%);
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.2);
}

.self-position.rank-rising {
  background: linear-gradient(135deg, rgba(82, 196, 26, 0.15) 0%, rgba(82, 196, 26, 0.05) 100%);
  border-left-color: #52c41a;
}

.self-position.rank-falling {
  background: linear-gradient(135deg, rgba(255, 77, 79, 0.1) 0%, rgba(255, 77, 79, 0.05) 100%);
  border-left-color: #ff4d4f;
}

.self-position.new-entry {
  background: linear-gradient(135deg, rgba(250, 173, 20, 0.15) 0%, rgba(250, 173, 20, 0.05) 100%);
  border-left-color: #faad14;
}

.pulse-animation {
  animation: pulse 0.6s ease-in-out 3;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.02);
  }
}

.rank-change-badge {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: bold;
  animation: fadeInOut 5s ease-in-out;
}

.rank-change-badge.rising {
  background: rgba(82, 196, 26, 0.2);
  color: #52c41a;
}

.rank-change-badge.falling {
  background: rgba(255, 77, 79, 0.2);
  color: #ff4d4f;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(-50%) translateX(10px); }
  10% { opacity: 1; transform: translateY(-50%) translateX(0); }
  80% { opacity: 1; }
  100% { opacity: 0; }
}
`;
