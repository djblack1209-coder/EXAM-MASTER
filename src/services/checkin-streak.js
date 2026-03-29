/**
 * 打卡连续天数统计服务
 * 检查点4.4: 每日打卡 - 连续天数统计
 *
 * 功能：
 * - 每日打卡记录
 * - 连续天数计算
 * - 打卡日历展示
 * - 打卡奖励计算
 * - 断签检测
 */

import { logger } from '@/utils/logger.js';
import { reactive, computed } from 'vue';
import storageService from '@/services/storageService.js';
import { CHECKIN_STATUS, CHECKIN_REWARD, STREAK_MULTIPLIER, getStreakMultiplier } from '@/config/game-constants.js';

// 本地别名 — 保持内部 REWARD_CONFIG.xxx 形式不变，减少改动面
const REWARD_CONFIG = {
  base: CHECKIN_REWARD.BASE,
  streakMultiplier: STREAK_MULTIPLIER,
  milestones: CHECKIN_REWARD.MILESTONES
};

class CheckinStreakService {
  constructor() {
    // 打卡数据
    this.data = reactive({
      currentStreak: 0, // 当前连续天数
      longestStreak: 0, // 最长连续天数
      totalCheckins: 0, // 总打卡天数
      lastCheckinDate: null, // 最后打卡日期
      checkinHistory: [], // 打卡历史 [{date, status, reward}]
      todayChecked: false, // 今日是否已打卡
      missedDays: 0, // 断签天数
      recoveryCards: 0 // 补签卡数量
    });

    // 用户ID
    this.userId = null;

    // 事件监听器
    this.listeners = new Map();
  }

  /**
   * 初始化
   */
  async init(userId) {
    this.userId = userId;

    try {
      // 加载数据
      await this._loadData();

      // 检查今日状态
      this._checkTodayStatus();

      // 检查是否断签
      this._checkMissedDays();

      logger.log('[CheckinStreak] Initialized:', {
        currentStreak: this.data.currentStreak,
        todayChecked: this.data.todayChecked
      });
    } catch (error) {
      logger.error('[CheckinStreak] Init error:', error);
    }
  }

  /**
   * 执行打卡
   */
  async checkIn() {
    // 检查是否已打卡
    if (this.data.todayChecked) {
      return {
        success: false,
        message: '今日已打卡',
        data: this.getCheckinInfo()
      };
    }

    const today = this._getDateString(new Date());
    const yesterday = this._getDateString(this._getYesterday());

    // 检查是否连续
    const isConsecutive = this.data.lastCheckinDate === yesterday;

    // 更新连续天数
    if (isConsecutive || !this.data.lastCheckinDate) {
      this.data.currentStreak += 1;
    } else {
      // 断签了，重新开始
      this.data.currentStreak = 1;
    }

    // 更新最长连续
    if (this.data.currentStreak > this.data.longestStreak) {
      this.data.longestStreak = this.data.currentStreak;
    }

    // 计算奖励
    const reward = this._calculateReward();

    // 记录打卡
    const checkinRecord = {
      date: today,
      status: CHECKIN_STATUS.CHECKED,
      streak: this.data.currentStreak,
      reward
    };

    this.data.checkinHistory.push(checkinRecord);
    this.data.lastCheckinDate = today;
    this.data.totalCheckins += 1;
    this.data.todayChecked = true;
    this.data.missedDays = 0;

    // 检查里程碑
    const milestone = this._checkMilestone();

    // 保存数据
    await this._saveData();

    // 触发事件
    this._emit('checkin', {
      streak: this.data.currentStreak,
      reward,
      milestone
    });

    return {
      success: true,
      message: '打卡成功',
      data: {
        streak: this.data.currentStreak,
        reward,
        milestone,
        ...this.getCheckinInfo()
      }
    };
  }

  /**
   * 计算奖励
   */
  _calculateReward() {
    const { base } = REWARD_CONFIG;

    // 使用统一的连续天数倍率计算
    const multiplier = getStreakMultiplier(this.data.currentStreak);

    return {
      exp: Math.round(base.exp * multiplier),
      coins: Math.round(base.coins * multiplier),
      multiplier
    };
  }

  /**
   * 检查里程碑
   */
  _checkMilestone() {
    const { milestones } = REWARD_CONFIG;
    const milestone = milestones[this.data.currentStreak];

    if (milestone) {
      // ✅ F015: 里程碑达成时自动发放补签卡
      if (milestone.recoveryCards && milestone.recoveryCards > 0) {
        this._grantRecoveryCards(milestone.recoveryCards);
        logger.log(`[CheckinStreak] 里程碑奖励: +${milestone.recoveryCards} 补签卡`);
      }

      this._emit('milestone', {
        days: this.data.currentStreak,
        reward: milestone
      });
      return milestone;
    }

    return null;
  }

  /**
   * 检查今日状态
   */
  _checkTodayStatus() {
    const today = this._getDateString(new Date());
    this.data.todayChecked = this.data.lastCheckinDate === today;
  }

  /**
   * 检查断签天数
   */
  _checkMissedDays() {
    if (!this.data.lastCheckinDate) {
      this.data.missedDays = 0;
      return;
    }

    const todayStr = this._getDateString(new Date());
    const lastCheckinStr = this.data.lastCheckinDate;

    const toDayNumber = (dateStr) => {
      const [y, m, d] = String(dateStr)
        .split('-')
        .map((n) => Number(n));
      if (!y || !m || !d) return null;
      return Math.floor(Date.UTC(y, m - 1, d) / (24 * 60 * 60 * 1000));
    };

    const todayNum = toDayNumber(todayStr);
    const lastNum = toDayNumber(lastCheckinStr);
    if (todayNum === null || lastNum === null) {
      this.data.missedDays = 0;
      return;
    }

    const diffDays = Math.max(0, todayNum - lastNum);

    // 超过1天未打卡视为断签
    if (diffDays > 1) {
      const previousStreak = this.data.currentStreak;
      this.data.missedDays = diffDays - 1;
      this.data.currentStreak = 0;

      // 触发断签事件
      this._emit('missed', {
        missedDays: this.data.missedDays,
        lastStreak: previousStreak
      });
    } else {
      this.data.missedDays = 0;
    }
  }

  _toSafeInt(value, min, max, fallback = min) {
    const parsed = Number.parseInt(String(value), 10);
    if (!Number.isInteger(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, parsed));
  }

  _normalizeLoadedData() {
    this.data.currentStreak = this._toSafeInt(this.data.currentStreak, 0, 36500, 0);
    this.data.longestStreak = this._toSafeInt(this.data.longestStreak, 0, 36500, this.data.currentStreak);
    this.data.totalCheckins = this._toSafeInt(this.data.totalCheckins, 0, 365000, 0);
    this.data.recoveryCards = this._toSafeInt(this.data.recoveryCards, 0, 99, 0);

    if (this.data.longestStreak < this.data.currentStreak) {
      this.data.longestStreak = this.data.currentStreak;
    }

    if (!Array.isArray(this.data.checkinHistory)) {
      this.data.checkinHistory = [];
    }

    this.data.checkinHistory = this.data.checkinHistory
      .filter((record) => record && typeof record.date === 'string')
      .slice(-365);

    if (typeof this.data.lastCheckinDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(this.data.lastCheckinDate)) {
      this.data.lastCheckinDate = null;
    }
  }

  /**
   * 获取打卡信息
   */
  getCheckinInfo() {
    return {
      currentStreak: this.data.currentStreak,
      longestStreak: this.data.longestStreak,
      totalCheckins: this.data.totalCheckins,
      todayChecked: this.data.todayChecked,
      lastCheckinDate: this.data.lastCheckinDate,
      missedDays: this.data.missedDays,
      recoveryCards: this.data.recoveryCards,
      nextReward: this._calculateReward(),
      nextMilestone: this._getNextMilestone()
    };
  }

  /**
   * 获取下一个里程碑
   */
  _getNextMilestone() {
    const { milestones } = REWARD_CONFIG;
    const milestoneDays = Object.keys(milestones)
      .map(Number)
      .sort((a, b) => a - b);

    for (const days of milestoneDays) {
      if (days > this.data.currentStreak) {
        return {
          days,
          remaining: days - this.data.currentStreak,
          reward: milestones[days]
        };
      }
    }

    return null;
  }

  /**
   * 获取月度打卡日历
   */
  getMonthCalendar(year, month) {
    const calendar = [];
    const lastDay = new Date(year, month + 1, 0);
    const today = this._getDateString(new Date());

    // 填充日历
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = this._getDateString(new Date(year, month, day));
      const record = this.data.checkinHistory.find((r) => r.date === date);

      calendar.push({
        date,
        day,
        status: record?.status || (date < today ? CHECKIN_STATUS.MISSED : CHECKIN_STATUS.NOT_CHECKED),
        isToday: date === today,
        isFuture: date > today,
        streak: record?.streak || 0
      });
    }

    return calendar;
  }

  /**
   * 获取打卡统计
   */
  getStatistics() {
    const now = new Date();
    const thisMonth = this.data.checkinHistory.filter((r) => {
      const date = new Date(r.date);
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });

    const thisWeek = this.data.checkinHistory.filter((r) => {
      const date = new Date(r.date);
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      return date >= weekStart;
    });

    return {
      total: this.data.totalCheckins,
      thisMonth: thisMonth.length,
      thisWeek: thisWeek.length,
      currentStreak: this.data.currentStreak,
      longestStreak: this.data.longestStreak,
      averagePerWeek: this._calculateAveragePerWeek()
    };
  }

  /**
   * 计算周平均打卡
   */
  _calculateAveragePerWeek() {
    if (this.data.checkinHistory.length === 0) return 0;

    const firstCheckin = new Date(this.data.checkinHistory[0].date);
    const now = new Date();
    const weeks = Math.max(1, Math.ceil((now.getTime() - firstCheckin.getTime()) / (7 * 24 * 60 * 60 * 1000)));

    return Math.round((this.data.totalCheckins / weeks) * 10) / 10;
  }

  /**
   * 获取日期字符串
   */
  _getDateString(date) {
    // [AUDIT FIX] 使用本地日期而非 UTC，避免跨时区用户打卡/连续签到在错误时间重置
    const pad = (n) => String(n).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  /**
   * 获取昨天日期
   */
  _getYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  /**
   * 加载数据
   */
  async _loadData() {
    try {
      const key = `checkin_${this.userId}`;
      const saved = storageService.get(key);

      if (saved) {
        if (typeof saved === 'object') {
          Object.assign(this.data, saved);
        } else if (typeof saved === 'string') {
          const data = JSON.parse(saved);
          Object.assign(this.data, data);
        }

        this._normalizeLoadedData();
      }
    } catch (error) {
      logger.error('[CheckinStreak] Load error:', error);
      // 损坏数据清理，防止每次启动重复失败
      try {
        const key = `checkin_${this.userId}`;
        storageService.remove(key);
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * 保存数据
   */
  async _saveData() {
    try {
      this._normalizeLoadedData();

      const key = `checkin_${this.userId}`;
      storageService.save(key, {
        currentStreak: this.data.currentStreak,
        longestStreak: this.data.longestStreak,
        totalCheckins: this.data.totalCheckins,
        lastCheckinDate: this.data.lastCheckinDate,
        checkinHistory: this.data.checkinHistory.slice(-365), // 只保留一年
        recoveryCards: this.data.recoveryCards
      });
    } catch (error) {
      logger.error('[CheckinStreak] Save error:', error);
    }
  }

  /**
   * 添加补签卡
   */
  _grantRecoveryCards(count) {
    const parsedCount = Number.parseInt(String(count), 10);
    if (!Number.isInteger(parsedCount) || parsedCount <= 0) {
      logger.warn('[CheckinStreak] 非法补签卡发放请求已忽略:', count);
      return false;
    }

    // 限制单次发放额度，避免异常调用导致本地数据被批量注入
    const safeGrant = Math.min(parsedCount, 5);
    this.data.recoveryCards = Math.min(99, this.data.recoveryCards + safeGrant);
    this._saveData();
    return true;
  }

  addRecoveryCards(count) {
    return this._grantRecoveryCards(count);
  }

  /**
   * 获取补签卡数量
   */
  getRecoveryCards() {
    return this.data.recoveryCards;
  }

  /**
   * 添加事件监听
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  /**
   * 移除事件监听
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  /**
   * 触发事件
   */
  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          logger.error(`[CheckinStreak] Event handler error:`, e);
        }
      });
    }
  }
}

// 单例导出
export const checkinStreak = new CheckinStreakService();

// 导出类和常量
export { CheckinStreakService, CHECKIN_STATUS, REWARD_CONFIG };

// Vue组合式API Hook
/**
 * 签到打卡组合式 API Hook
 * 提供响应式的签到信息、统计数据，以及签到/日历/补签卡等操作方法
 * @returns {{ checkinInfo: import('vue').ComputedRef, statistics: import('vue').ComputedRef, init: Function, checkIn: Function, getMonthCalendar: Function, getRecoveryCards: Function, onCheckin: Function, onMissed: Function, onMilestone: Function }}
 */
export function useCheckinStreak() {
  const checkinInfo = computed(() => checkinStreak.getCheckinInfo());
  const statistics = computed(() => checkinStreak.getStatistics());

  return {
    checkinInfo,
    statistics,
    init: (userId) => checkinStreak.init(userId),
    checkIn: () => checkinStreak.checkIn(),
    getMonthCalendar: (year, month) => checkinStreak.getMonthCalendar(year, month),
    getRecoveryCards: () => checkinStreak.getRecoveryCards(),
    onCheckin: (callback) => checkinStreak.on('checkin', callback),
    onMissed: (callback) => checkinStreak.on('missed', callback),
    onMilestone: (callback) => checkinStreak.on('milestone', callback)
  };
}
