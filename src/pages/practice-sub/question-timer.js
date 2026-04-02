/**
 * 单题计时器模块 - 提供单题限时、超时提醒、答题效率分析
 *
 * 核心功能：
 * 1. 单题倒计时 - 可配置每题时限
 * 2. 超时提醒 - 多级提醒（50%、80%、100%）
 * 3. 答题效率分析 - 统计平均用时、最快/最慢题目
 * 4. 时间预警 - 根据题目难度动态调整时限
 */

import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
const STORAGE_KEYS = {
  TIMER_SETTINGS: 'question_timer_settings',
  TIME_RECORDS: 'question_time_records'
};

// 默认配置
const DEFAULT_SETTINGS = {
  enabled: true,
  defaultTimeLimit: 120, // 默认每题120秒
  warningThresholds: [0.5, 0.8, 1.0], // 50%、80%、100%时提醒
  difficultyMultipliers: {
    1: 0.8, // 简单题 80% 时间
    2: 1.0, // 中等题 100% 时间
    3: 1.3, // 困难题 130% 时间
    4: 1.5 // 专家题 150% 时间
  },
  autoSubmitOnTimeout: false, // 超时是否自动提交
  showCountdown: true, // 是否显示倒计时
  vibrationAlert: true // 是否震动提醒
};

/**
 * 单题计时器类
 */
class QuestionTimer {
  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.currentTimer = null;
    this.startTime = 0;
    this.timeLimit = 0;
    this.elapsed = 0;
    this.isPaused = false;
    this.callbacks = {
      onTick: null,
      onWarning: null,
      onTimeout: null
    };
    this.timeRecords = [];
    this.isInitialized = false;
  }

  /**
   * 初始化
   */
  init() {
    if (this.isInitialized) return;
    this._loadSettings();
    this._loadTimeRecords();
    this.isInitialized = true;
    logger.log('[QuestionTimer] 初始化完成');
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
   * 开始计时
   * @param {Object} options - 配置选项
   * @param {number} options.difficulty - 题目难度 (1-4)
   * @param {number} options.customTimeLimit - 自定义时限（秒）
   * @param {Function} options.onTick - 每秒回调
   * @param {Function} options.onWarning - 警告回调
   * @param {Function} options.onTimeout - 超时回调
   */
  start(options = {}) {
    this.init();
    this.stop(); // 停止之前的计时器

    const { difficulty = 2, customTimeLimit = null, onTick = null, onWarning = null, onTimeout = null } = options;

    // 计算时限
    const baseLimit = customTimeLimit || this.settings.defaultTimeLimit;
    const multiplier = this.settings.difficultyMultipliers[difficulty] || 1.0;
    this.timeLimit = Math.round(baseLimit * multiplier);

    // 设置回调
    this.callbacks = { onTick, onWarning, onTimeout };

    // 重置状态
    this.startTime = Date.now();
    this.elapsed = 0;
    this.isPaused = false;
    this._triggeredWarnings = new Set();

    // 启动计时器
    if (this.settings.enabled) {
      this.currentTimer = setInterval(() => this._tick(), 1000);
    }

    logger.log('[QuestionTimer] 计时开始:', {
      timeLimit: this.timeLimit,
      difficulty
    });

    return {
      timeLimit: this.timeLimit,
      remaining: this.timeLimit
    };
  }

  /**
   * 停止计时
   * @returns {Object} 答题用时信息
   */
  stop() {
    if (this.currentTimer) {
      clearInterval(this.currentTimer);
      this.currentTimer = null;
    }

    const result = {
      elapsed: this.elapsed,
      timeLimit: this.timeLimit,
      isTimeout: this.elapsed >= this.timeLimit,
      efficiency: this.timeLimit > 0 ? Math.round((1 - this.elapsed / this.timeLimit) * 100) : 0
    };

    return result;
  }

  /**
   * 暂停计时
   */
  pause() {
    this.isPaused = true;
    if (this.currentTimer) {
      clearInterval(this.currentTimer);
      this.currentTimer = null;
    }
  }

  /**
   * 恢复计时
   */
  resume() {
    if (this.isPaused && this.settings.enabled) {
      this.isPaused = false;
      this.currentTimer = setInterval(() => this._tick(), 1000);
    }
  }

  /**
   * 获取剩余时间
   * @returns {Object} 剩余时间信息
   */
  getRemaining() {
    const remaining = Math.max(0, this.timeLimit - this.elapsed);
    const progress = this.timeLimit > 0 ? this.elapsed / this.timeLimit : 0;

    return {
      remaining,
      elapsed: this.elapsed,
      timeLimit: this.timeLimit,
      progress,
      formattedRemaining: this._formatTime(remaining),
      formattedElapsed: this._formatTime(this.elapsed),
      isWarning: progress >= 0.8,
      isDanger: progress >= 0.95
    };
  }

  /**
   * 记录答题时间
   * @param {Object} data - 答题数据
   */
  recordTime(data) {
    this.init();

    const record = {
      questionId: data.questionId,
      category: data.category || '未分类',
      difficulty: data.difficulty || 2,
      timeSpent: data.timeSpent || this.elapsed,
      timeLimit: this.timeLimit,
      isCorrect: data.isCorrect,
      isTimeout: data.timeSpent >= this.timeLimit,
      timestamp: Date.now()
    };

    this.timeRecords.push(record);
    this._saveTimeRecords();

    return record;
  }

  /**
   * 获取答题时间统计
   * @returns {Object} 时间统计
   */
  getTimeStats() {
    this.init();

    if (this.timeRecords.length === 0) {
      return {
        totalQuestions: 0,
        averageTime: 0,
        fastestTime: 0,
        slowestTime: 0,
        timeoutCount: 0,
        timeoutRate: 0,
        efficiencyScore: 0,
        categoryStats: {},
        recentTrend: 'stable'
      };
    }

    const times = this.timeRecords.map((r) => r.timeSpent);
    const totalTime = times.reduce((sum, t) => sum + t, 0);
    const averageTime = Math.round(totalTime / times.length);
    const fastestTime = Math.min(...times);
    const slowestTime = Math.max(...times);
    const timeoutCount = this.timeRecords.filter((r) => r.isTimeout).length;

    // 按分类统计
    const categoryStats = {};
    for (const record of this.timeRecords) {
      const cat = record.category;
      if (!categoryStats[cat]) {
        categoryStats[cat] = { total: 0, totalTime: 0, timeouts: 0 };
      }
      categoryStats[cat].total++;
      categoryStats[cat].totalTime += record.timeSpent;
      if (record.isTimeout) categoryStats[cat].timeouts++;
    }

    // 计算每个分类的平均时间
    for (const cat of Object.keys(categoryStats)) {
      categoryStats[cat].averageTime = Math.round(categoryStats[cat].totalTime / categoryStats[cat].total);
    }

    // 计算效率分数
    const efficiencyScore = this._calculateEfficiencyScore();

    // 计算最近趋势
    const recentTrend = this._calculateRecentTrend();

    return {
      totalQuestions: this.timeRecords.length,
      averageTime,
      fastestTime,
      slowestTime,
      timeoutCount,
      timeoutRate: Math.round((timeoutCount / this.timeRecords.length) * 100),
      efficiencyScore,
      categoryStats,
      recentTrend,
      formattedAverage: this._formatTime(averageTime),
      formattedFastest: this._formatTime(fastestTime),
      formattedSlowest: this._formatTime(slowestTime)
    };
  }

  /**
   * 获取推荐时限
   * @param {Object} question - 题目信息
   * @returns {number} 推荐时限（秒）
   */
  getRecommendedTimeLimit(question) {
    this.init();

    const category = question.category || '未分类';
    const difficulty = question.difficulty || 2;

    // 基于历史数据计算推荐时限
    const categoryRecords = this.timeRecords.filter((r) => r.category === category && r.isCorrect);

    let baseTime = this.settings.defaultTimeLimit;

    if (categoryRecords.length >= 5) {
      // 使用该分类正确答题的平均时间 * 1.5 作为推荐时限
      const avgTime = categoryRecords.reduce((sum, r) => sum + r.timeSpent, 0) / categoryRecords.length;
      baseTime = Math.round(avgTime * 1.5);
    }

    // 应用难度系数
    const multiplier = this.settings.difficultyMultipliers[difficulty] || 1.0;
    const recommended = Math.round(baseTime * multiplier);

    // 限制在合理范围内
    return Math.max(30, Math.min(300, recommended));
  }

  /**
   * 获取最佳答题时段分析
   * @returns {Object} 时段分析
   */
  getBestTimeSlotAnalysis() {
    this.init();

    if (this.timeRecords.length < 10) {
      return {
        hasEnoughData: false,
        message: '数据不足，需要至少10道题的记录'
      };
    }

    // 按小时分组
    const hourlyStats = {};
    for (let h = 0; h < 24; h++) {
      hourlyStats[h] = { total: 0, correct: 0, totalTime: 0 };
    }

    for (const record of this.timeRecords) {
      const hour = new Date(record.timestamp).getHours();
      hourlyStats[hour].total++;
      if (record.isCorrect) hourlyStats[hour].correct++;
      hourlyStats[hour].totalTime += record.timeSpent;
    }

    // 找出最佳时段
    let bestHour = 0;
    let bestScore = 0;

    for (const [hour, stats] of Object.entries(hourlyStats)) {
      if (stats.total >= 3) {
        const accuracy = stats.correct / stats.total;
        const avgTime = stats.totalTime / stats.total;
        const efficiency = 1 - avgTime / this.settings.defaultTimeLimit;
        const score = accuracy * 0.7 + Math.max(0, efficiency) * 0.3;

        if (score > bestScore) {
          bestScore = score;
          bestHour = parseInt(hour);
        }
      }
    }

    // 生成时段建议
    const timeSlots = {
      morning: { start: 6, end: 12, label: '上午' },
      afternoon: { start: 12, end: 18, label: '下午' },
      evening: { start: 18, end: 22, label: '晚上' },
      night: { start: 22, end: 6, label: '深夜' }
    };

    let bestSlot = 'morning';
    for (const [slot, config] of Object.entries(timeSlots)) {
      if (bestHour >= config.start && bestHour < config.end) {
        bestSlot = slot;
        break;
      }
    }

    return {
      hasEnoughData: true,
      bestHour,
      bestSlot,
      bestSlotLabel: timeSlots[bestSlot].label,
      hourlyStats,
      recommendation: `你在${timeSlots[bestSlot].label} ${bestHour}:00 左右学习效率最高`
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 计时器tick
   */
  _tick() {
    if (this.isPaused) return;

    this.elapsed++;
    const remaining = Math.max(0, this.timeLimit - this.elapsed);
    const progress = this.elapsed / this.timeLimit;

    // 调用tick回调
    if (this.callbacks.onTick) {
      this.callbacks.onTick({
        elapsed: this.elapsed,
        remaining,
        progress,
        formattedRemaining: this._formatTime(remaining),
        formattedElapsed: this._formatTime(this.elapsed)
      });
    }

    // 检查警告阈值
    for (const threshold of this.settings.warningThresholds) {
      if (progress >= threshold && !this._triggeredWarnings.has(threshold)) {
        this._triggeredWarnings.add(threshold);
        this._triggerWarning(threshold, remaining);
      }
    }

    // 检查超时
    if (this.elapsed >= this.timeLimit) {
      this._triggerTimeout();
    }
  }

  /**
   * 触发警告
   */
  _triggerWarning(threshold, remaining) {
    const warningLevel = threshold >= 1.0 ? 'danger' : threshold >= 0.8 ? 'warning' : 'info';

    // 震动提醒
    if (this.settings.vibrationAlert) {
      try {
        if (typeof uni !== 'undefined' && typeof uni.vibrateShort === 'function') {
          uni.vibrateShort();
        }
      } catch (e) {
        logger.warn('[QuestionTimer] 震动提醒失败:', e);
      }
    }

    // 调用警告回调
    if (this.callbacks.onWarning) {
      this.callbacks.onWarning({
        threshold,
        level: warningLevel,
        remaining,
        message: this._getWarningMessage(threshold, remaining)
      });
    }
  }

  /**
   * 触发超时
   */
  _triggerTimeout() {
    this.stop();

    if (this.callbacks.onTimeout) {
      this.callbacks.onTimeout({
        elapsed: this.elapsed,
        timeLimit: this.timeLimit,
        autoSubmit: this.settings.autoSubmitOnTimeout
      });
    }
  }

  /**
   * 获取警告消息
   */
  _getWarningMessage(threshold, remaining) {
    if (threshold >= 1.0) {
      return '时间到！';
    } else if (threshold >= 0.8) {
      return `还剩 ${remaining} 秒，请加快速度！`;
    } else {
      return `已用时过半，还剩 ${remaining} 秒`;
    }
  }

  /**
   * 计算效率分数
   */
  _calculateEfficiencyScore() {
    if (this.timeRecords.length === 0) return 0;

    let totalScore = 0;
    for (const record of this.timeRecords) {
      // 基础分：正确得60分，错误得20分
      let score = record.isCorrect ? 60 : 20;

      // 时间效率加分：用时越少加分越多（最多40分）
      if (record.timeLimit > 0) {
        const timeRatio = record.timeSpent / record.timeLimit;
        if (timeRatio <= 0.5) {
          score += 40; // 用时不到一半，满分
        } else if (timeRatio <= 0.8) {
          score += 30; // 用时80%以内
        } else if (timeRatio < 1.0) {
          score += 20; // 未超时
        }
        // 超时不加分
      }

      totalScore += score;
    }

    return Math.round(totalScore / this.timeRecords.length);
  }

  /**
   * 计算最近趋势
   */
  _calculateRecentTrend() {
    if (this.timeRecords.length < 10) return 'stable';

    const recent = this.timeRecords.slice(-10);
    const previous = this.timeRecords.slice(-20, -10);

    if (previous.length === 0) return 'stable';

    const recentAvg = recent.reduce((sum, r) => sum + r.timeSpent, 0) / recent.length;
    const previousAvg = previous.reduce((sum, r) => sum + r.timeSpent, 0) / previous.length;

    // [AUDIT R298] 防止 previousAvg 为 0 时除零产生 Infinity
    if (previousAvg === 0) return 'stable';
    const change = (recentAvg - previousAvg) / previousAvg;

    if (change < -0.1) return 'improving'; // 用时减少10%以上
    if (change > 0.1) return 'slowing'; // 用时增加10%以上
    return 'stable';
  }

  /**
   * 格式化时间
   */
  _formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  }

  /**
   * 加载设置
   */
  _loadSettings() {
    try {
      if (typeof uni !== 'undefined') {
        const saved = storageService.get(STORAGE_KEYS.TIMER_SETTINGS);
        if (saved) {
          this.settings = { ...DEFAULT_SETTINGS, ...saved };
        }
      }
    } catch (e) {
      logger.warn('[QuestionTimer] 加载设置失败:', e);
    }
  }

  /**
   * 保存设置
   */
  _saveSettings() {
    try {
      if (typeof uni !== 'undefined') {
        storageService.save(STORAGE_KEYS.TIMER_SETTINGS, this.settings);
      }
    } catch (e) {
      logger.warn('[QuestionTimer] 保存设置失败:', e);
    }
  }

  /**
   * 加载时间记录
   */
  _loadTimeRecords() {
    try {
      if (typeof uni !== 'undefined') {
        this.timeRecords = storageService.get(STORAGE_KEYS.TIME_RECORDS, []);
      }
    } catch (_e) {
      this.timeRecords = [];
    }
  }

  /**
   * 保存时间记录
   */
  _saveTimeRecords() {
    try {
      if (typeof uni !== 'undefined') {
        // 只保留最近500条
        if (this.timeRecords.length > 500) {
          this.timeRecords = this.timeRecords.slice(-500);
        }
        storageService.save(STORAGE_KEYS.TIME_RECORDS, this.timeRecords);
      }
    } catch (e) {
      logger.warn('[QuestionTimer] 保存时间记录失败:', e);
    }
  }
}

// 创建单例
export const questionTimer = new QuestionTimer();

// 便捷函数
export function startTimer(options) {
  return questionTimer.start(options);
}

export function stopTimer() {
  return questionTimer.stop();
}

export function pauseTimer() {
  return questionTimer.pause();
}

export function resumeTimer() {
  return questionTimer.resume();
}

export function getRemaining() {
  return questionTimer.getRemaining();
}

export function recordTime(data) {
  return questionTimer.recordTime(data);
}

export function getTimeStats() {
  return questionTimer.getTimeStats();
}

export function getTimerSettings() {
  return questionTimer.getSettings();
}

export function updateTimerSettings(settings) {
  return questionTimer.updateSettings(settings);
}

export function getRecommendedTimeLimit(question) {
  return questionTimer.getRecommendedTimeLimit(question);
}

export function getBestTimeSlotAnalysis() {
  return questionTimer.getBestTimeSlotAnalysis();
}

export default questionTimer;
