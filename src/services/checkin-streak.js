/**
 * 签到连续天数统计服务
 */
import { reactive, computed } from 'vue';
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { CHECKIN_STATUS, CHECKIN_REWARD, STREAK_MULTIPLIER, getStreakMultiplier } from '@/config/game-constants.js';

const MAX_RECOVERY_CARDS = 99;

export const REWARD_CONFIG = {
  base: CHECKIN_REWARD.BASE,
  streakMultiplier: STREAK_MULTIPLIER,
  milestones: CHECKIN_REWARD.MILESTONES
};

function toSafeInt(value, min, max, fallback = min) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isDateString(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function createDefaultCheckinData() {
  return {
    currentStreak: 0,
    longestStreak: 0,
    totalCheckins: 0,
    lastCheckinDate: null,
    checkinHistory: [],
    todayChecked: false,
    missedDays: 0,
    recoveryCards: 0
  };
}

function resetCheckinData(target) {
  Object.assign(target, createDefaultCheckinData());
}

export class CheckinStreakService {
  constructor() {
    this.data = reactive(createDefaultCheckinData());
    this.userId = null;
    this.listeners = new Map();
  }

  async init(userId) {
    this.userId = userId;
    await this._loadData();
    this._checkTodayStatus();
    this._checkMissedDays();
    return this.getCheckinInfo();
  }

  async checkIn() {
    if (this.data.todayChecked) {
      return { success: false, message: '今日已打卡', data: this.getCheckinInfo() };
    }

    const today = this._getDateString(new Date());
    const yesterday = this._getDateString(this._getYesterday());
    const isConsecutive = this.data.lastCheckinDate === yesterday || !this.data.lastCheckinDate;

    this.data.currentStreak = isConsecutive ? this.data.currentStreak + 1 : 1;
    this.data.longestStreak = Math.max(this.data.longestStreak, this.data.currentStreak);
    this.data.totalCheckins += 1;
    this.data.lastCheckinDate = today;
    this.data.todayChecked = true;
    this.data.missedDays = 0;

    const reward = this._calculateReward();
    this.data.checkinHistory.push({
      date: today,
      status: CHECKIN_STATUS.CHECKED,
      streak: this.data.currentStreak,
      reward
    });

    const milestone = this._checkMilestone();
    await this._saveData();
    this._emit('checkin', { streak: this.data.currentStreak, reward, milestone });

    return {
      success: true,
      message: '打卡成功',
      data: { streak: this.data.currentStreak, reward, milestone, ...this.getCheckinInfo() }
    };
  }

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

  getMonthCalendar(year, month) {
    const calendar = [];
    const lastDay = new Date(year, month + 1, 0);
    const today = this._getDateString(new Date());

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = this._getDateString(new Date(year, month, day));
      const record = this.data.checkinHistory.find((item) => item.date === date);
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

  getStatistics() {
    return {
      total: this.data.totalCheckins,
      currentStreak: this.data.currentStreak,
      longestStreak: this.data.longestStreak,
      recoveryCards: this.data.recoveryCards
    };
  }

  addRecoveryCards(count) {
    return this._grantRecoveryCards(count);
  }

  getRecoveryCards() {
    return this.data.recoveryCards;
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    this.listeners.get(event)?.delete(callback);
  }

  async _loadData() {
    try {
      resetCheckinData(this.data);
      const saved = storageService.get(`checkin_${this.userId}`);
      if (saved && typeof saved === 'object') {
        Object.assign(this.data, saved);
      } else if (typeof saved === 'string') {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          Object.assign(this.data, parsed);
        }
      }
      this._normalizeLoadedData();
    } catch (error) {
      logger.error('[CheckinStreak] Load error:', error);
      try {
        storageService.remove(`checkin_${this.userId}`);
      } catch {
        /* ignore cleanup failure */
      }
      resetCheckinData(this.data);
      this._normalizeLoadedData();
    }
  }

  async _saveData() {
    try {
      this._normalizeLoadedData();
      storageService.save(`checkin_${this.userId}`, {
        currentStreak: this.data.currentStreak,
        longestStreak: this.data.longestStreak,
        totalCheckins: this.data.totalCheckins,
        lastCheckinDate: this.data.lastCheckinDate,
        checkinHistory: this.data.checkinHistory.slice(-365),
        recoveryCards: this.data.recoveryCards
      });
    } catch (error) {
      logger.error('[CheckinStreak] Save error:', error);
    }
  }

  _normalizeLoadedData() {
    this.data.currentStreak = toSafeInt(this.data.currentStreak, 0, 36500, 0);
    this.data.longestStreak = toSafeInt(this.data.longestStreak, 0, 36500, this.data.currentStreak);
    this.data.totalCheckins = toSafeInt(this.data.totalCheckins, 0, 365000, 0);
    this.data.recoveryCards = toSafeInt(this.data.recoveryCards, 0, MAX_RECOVERY_CARDS, 0);
    this.data.missedDays = toSafeInt(this.data.missedDays, 0, 36500, 0);

    if (this.data.longestStreak < this.data.currentStreak) {
      this.data.longestStreak = this.data.currentStreak;
    }

    this.data.lastCheckinDate = isDateString(this.data.lastCheckinDate) ? this.data.lastCheckinDate : null;
    this.data.checkinHistory = Array.isArray(this.data.checkinHistory)
      ? this.data.checkinHistory.filter((record) => record && isDateString(record.date)).slice(-365)
      : [];
  }

  _calculateReward() {
    const multiplier = getStreakMultiplier(this.data.currentStreak);
    return {
      exp: Math.round(REWARD_CONFIG.base.exp * multiplier),
      coins: Math.round(REWARD_CONFIG.base.coins * multiplier),
      multiplier
    };
  }

  _checkMilestone() {
    const milestone = REWARD_CONFIG.milestones[this.data.currentStreak] || null;
    if (milestone?.recoveryCards) {
      this._grantRecoveryCards(milestone.recoveryCards);
    }
    if (milestone) {
      this._emit('milestone', { days: this.data.currentStreak, reward: milestone });
    }
    return milestone;
  }

  _getNextMilestone() {
    return (
      Object.keys(REWARD_CONFIG.milestones)
        .map(Number)
        .sort((a, b) => a - b)
        .filter((days) => days > this.data.currentStreak)
        .map((days) => ({
          days,
          remaining: days - this.data.currentStreak,
          reward: REWARD_CONFIG.milestones[days]
        }))[0] || null
    );
  }

  _checkTodayStatus() {
    this.data.todayChecked = this.data.lastCheckinDate === this._getDateString(new Date());
  }

  _checkMissedDays() {
    if (!this.data.lastCheckinDate) {
      this.data.missedDays = 0;
      return;
    }
    const diffDays = this._dayNumber(this._getDateString(new Date())) - this._dayNumber(this.data.lastCheckinDate);
    if (diffDays > 1) {
      const previousStreak = this.data.currentStreak;
      this.data.missedDays = diffDays - 1;
      this.data.currentStreak = 0;
      this._emit('missed', { missedDays: this.data.missedDays, lastStreak: previousStreak });
    } else {
      this.data.missedDays = 0;
    }
  }

  _grantRecoveryCards(count) {
    const parsedCount = Number.parseInt(String(count), 10);
    if (!Number.isInteger(parsedCount) || parsedCount <= 0) {
      logger.warn('[CheckinStreak] 非法补签卡发放请求已忽略:', count);
      return false;
    }

    this.data.recoveryCards = Math.min(MAX_RECOVERY_CARDS, this.data.recoveryCards + Math.min(parsedCount, 5));
    return true;
  }

  _getDateString(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  _getYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }

  _dayNumber(dateStr) {
    const [year, month, day] = String(dateStr).split('-').map(Number);
    if (!year || !month || !day) return 0;
    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  }

  _emit(event, data) {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        logger.error('[CheckinStreak] Event handler error:', error);
      }
    });
  }
}

export const checkinStreak = new CheckinStreakService();

export function getCheckinStreak() {
  return checkinStreak.getCheckinInfo();
}

export function recordCheckin() {
  return checkinStreak.checkIn();
}

export function isCheckedInToday() {
  return checkinStreak.getCheckinInfo().todayChecked;
}

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

export default {
  CheckinStreakService,
  checkinStreak,
  getCheckinStreak,
  recordCheckin,
  isCheckedInToday,
  useCheckinStreak
};
