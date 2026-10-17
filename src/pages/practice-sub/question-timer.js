import { captureSession, checkSession, assertSession } from '@/services/auth-storage.js';
/**
 * 单题计时器模块 - 采集实际作答间隔，提供限时提醒
 *
 * 核心功能：
 * 1. 单题倒计时 - 可配置每题时限
 * 2. 超时提醒 - 多级提醒（50%、80%、100%）
 * 3. 旧计时记录仅供读取，不推断判分或学习能力
 * 4. 时间预警 - 按配置调整提醒时限
 */

import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
import { getUserId } from '@/services/auth-storage.js';
let timerSequence = 0;
const monotonicNow = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
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
    this._session = captureSession();
    this.settings = { ...DEFAULT_SETTINGS };
    this.currentTimer = null;
    this.startTime = 0;
    this.timeLimit = 0;
    this.elapsed = 0;
    this.elapsedMs = 0;
    this.active = false;
    this.token = null;
    this.owner = null;
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
    if (this.isInitialized && checkSession(this._session) === 'changed') {
      if (this.currentTimer) clearInterval(this.currentTimer);
      Object.assign(this, new QuestionTimer());
    }
    if (!this.isInitialized) this._session = captureSession();
    assertSession(this._session);
    const owner = getUserId() || '';
    if (this.isInitialized && this.owner === owner) return;
    if (this.currentTimer) clearInterval(this.currentTimer);
    this.currentTimer = null;
    this.active = false;
    this.isPaused = false;
    this.elapsedMs = this.elapsed = 0;
    this.token = null;
    this.settings = { ...DEFAULT_SETTINGS };
    this.timeRecords = [];
    this.owner = owner;
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
    this.startTime = monotonicNow();
    this.elapsedMs =
      Number.isFinite(options.initialElapsedMs) && options.initialElapsedMs >= 0
        ? Math.min(options.initialElapsedMs, 86400000)
        : 0;
    this.elapsed = this.elapsedMs / 1000;
    this.active = true;
    this.token = `question_timer_${++timerSequence}`;
    this.notificationsEnabled = options.notificationsEnabled !== false;
    this._timedOut = false;
    this.isPaused = false;
    this._triggeredWarnings = new Set();

    // 启动计时器
    if (this.settings.enabled && this.notificationsEnabled) {
      this._startInterval();
    }

    logger.log('[QuestionTimer] 计时开始:', {
      timeLimit: this.timeLimit,
      difficulty
    });

    return {
      token: this.token,
      timeLimit: this.timeLimit,
      remaining: Math.max(0, this.timeLimit - this.elapsed)
    };
  }

  /**
   * 停止计时
   * @returns {Object} 答题用时信息
   */
  _matches(token) {
    return (
      (token === undefined || token === this.token) &&
      (!this.isInitialized || (checkSession(this._session) === 'current' && (getUserId() || '') === this.owner))
    );
  }

  _sample() {
    if (!this.active || this.isPaused) return;
    const now = monotonicNow();
    this.elapsedMs += Math.max(0, now - this.startTime);
    this.startTime = now;
    this.elapsed = this.elapsedMs / 1000;
  }

  stop(token) {
    if (!this._matches(token)) return { success: false, code: 'TIMER_CONTEXT_CHANGED', elapsed: 0, elapsedMs: 0 };
    this._sample();
    if (this.currentTimer) clearInterval(this.currentTimer);
    this.currentTimer = null;
    this.active = false;
    return {
      success: true,
      elapsed: this.elapsed,
      elapsedMs: Math.round(this.elapsedMs),
      timeLimit: this.timeLimit,
      isTimeout: this.timeLimit > 0 && this.elapsed >= this.timeLimit,
      efficiency: this.timeLimit > 0 ? Math.round((1 - this.elapsed / this.timeLimit) * 100) : 0
    };
  }

  pause(token) {
    if (!this._matches(token)) return false;
    this._sample();
    this.isPaused = true;
    if (this.currentTimer) clearInterval(this.currentTimer);
    this.currentTimer = null;
    return true;
  }

  resume(token) {
    if (!this._matches(token) || !this.active || !this.isPaused) return false;
    this.isPaused = false;
    this.startTime = monotonicNow();
    if (this.settings.enabled && this.notificationsEnabled) this._startInterval();
    return true;
  }

  _startInterval() {
    const session = this._session,
      token = this.token;
    const interval = setInterval(() => {
      if (this._session !== session || this.token !== token || checkSession(session) === 'changed') {
        clearInterval(interval);
        if (this.currentTimer === interval) this.currentTimer = null;
        return;
      }
      if (checkSession(session) === 'current') this._tick();
    }, 1000);
    this.currentTimer = interval;
  }

  getRemaining(token) {
    if (!this._matches(token)) return { success: false, elapsed: 0, elapsedMs: 0 };
    this._sample();
    const remaining = Math.max(0, this.timeLimit - this.elapsed),
      progress = this.timeLimit > 0 ? this.elapsed / this.timeLimit : 0;
    return {
      success: true,
      token: this.token,
      active: this.active,
      paused: this.isPaused,
      remaining,
      elapsed: this.elapsed,
      elapsedMs: Math.round(this.elapsedMs),
      timeLimit: this.timeLimit,
      progress,
      formattedRemaining: this._formatTime(Math.ceil(remaining)),
      formattedElapsed: this._formatTime(Math.floor(this.elapsed)),
      isWarning: progress >= 0.8,
      isDanger: progress >= 0.95
    };
  }

  /**
   * 旧独立写入已退役；作答用时随明确提交进入学习核心。
   */
  recordTime() {
    return { success: false, code: 'LEGACY_TIMER_WRITER_RETIRED' };
  }

  // Old numbers remain readable; they have no verified units or grading authority.
  getTimeStats() {
    this.init();
    const rows = Array.isArray(this.timeRecords) ? this.timeRecords : [];
    const times = rows.filter((r) => r && Number.isFinite(r.timeSpent) && r.timeSpent >= 0).map((r) => r.timeSpent);
    const summary = times.reduce(
      (state, value, index) => ({
        average: state.average + (value - state.average) / (index + 1),
        minimum: Math.min(state.minimum, value),
        maximum: Math.max(state.maximum, value)
      }),
      { average: 0, minimum: Infinity, maximum: 0 }
    );
    return {
      source: 'legacy_timing',
      scoringAuthority: false,
      reliableCount: 0,
      timeUnit: 'unverified_legacy_unit',
      totalQuestions: rows.length,
      validValueCount: times.length,
      omittedValueCount: rows.length - times.length,
      averageTime: times.length ? summary.average : null,
      fastestTime: times.length ? summary.minimum : null,
      slowestTime: times.length ? summary.maximum : null,
      legacyTimeoutMarkCount: rows.filter((r) => r?.isTimeout === true).length,
      efficiencyScore: null,
      recentTrend: null
    };
  }

  getRecommendedTimeLimit(difficulty = 2) {
    this.init();
    const base = Number.isFinite(this.settings.defaultTimeLimit) ? this.settings.defaultTimeLimit : 120;
    const multiplier = this.settings.difficultyMultipliers?.[difficulty] ?? 1;
    return Math.max(30, Math.min(300, Math.round(base * multiplier)));
  }

  getBestTimeSlotAnalysis() {
    this.init();
    return {
      source: 'legacy_timing',
      scoringAuthority: false,
      hasEnoughData: false,
      recommendation: null,
      message: '旧计时记录不能证明学习效率'
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 计时器tick
   */
  _tick() {
    if (this.isPaused || !this.active || !this._matches(this.token)) return;
    this._sample();
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
    if (this.elapsed >= this.timeLimit && !this._timedOut) {
      this._timedOut = true;
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
    // A soft deadline is a reminder; measurement continues until explicit submit/hide.

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
    if (typeof uni !== 'undefined') {
      const saved = storageService.get(STORAGE_KEYS.TIMER_SETTINGS, null, { migrateLegacy: false });
      if (saved) {
        this.settings = { ...DEFAULT_SETTINGS, ...saved };
      }
    }
  }

  /**
   * 保存设置
   */
  _saveSettings() {
    try {
      if (typeof uni !== 'undefined') {
        storageService.save(STORAGE_KEYS.TIMER_SETTINGS, this.settings, true, this._session);
      }
    } catch (e) {
      logger.warn('[QuestionTimer] 保存设置失败:', e);
    }
  }

  /**
   * 加载时间记录
   */
  _loadTimeRecords() {
    if (typeof uni !== 'undefined')
      this.timeRecords = storageService.get(STORAGE_KEYS.TIME_RECORDS, [], { migrateLegacy: false });
  }
}

// 创建单例
export const questionTimer = new QuestionTimer();

// 便捷函数
export function startTimer(options) {
  return questionTimer.start(options);
}

export function stopTimer(token) {
  return questionTimer.stop(token);
}

export function pauseTimer(token) {
  return questionTimer.pause(token);
}

export function resumeTimer(token) {
  return questionTimer.resume(token);
}

export function getRemaining(token) {
  return questionTimer.getRemaining(token);
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
