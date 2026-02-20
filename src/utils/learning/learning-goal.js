/**
 * 学习目标设定与提醒模块 - 帮助用户制定和追踪学习目标
 *
 * 核心功能：
 * 1. 目标设定 - 每日/每周/自定义目标
 * 2. 进度追踪 - 实时追踪目标完成情况
 * 3. 智能提醒 - 定时提醒、进度提醒
 * 4. 目标分析 - 完成率统计、趋势分析
 */

import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';
const STORAGE_KEYS = {
  GOALS: 'learning_goals',
  GOAL_RECORDS: 'learning_goal_records',
  REMINDER_SETTINGS: 'learning_reminder_settings'
};

// 目标类型定义
const GOAL_TYPES = {
  DAILY_QUESTIONS: {
    id: 'daily_questions',
    name: '每日刷题',
    unit: '道',
    icon: '📝',
    defaultValue: 20,
    minValue: 5,
    maxValue: 200
  },
  DAILY_ACCURACY: {
    id: 'daily_accuracy',
    name: '每日正确率',
    unit: '%',
    icon: '🎯',
    defaultValue: 70,
    minValue: 50,
    maxValue: 100
  },
  DAILY_TIME: {
    id: 'daily_time',
    name: '每日学习时长',
    unit: '分钟',
    icon: '⏰',
    defaultValue: 60,
    minValue: 15,
    maxValue: 480
  },
  WEEKLY_QUESTIONS: {
    id: 'weekly_questions',
    name: '每周刷题',
    unit: '道',
    icon: '📚',
    defaultValue: 100,
    minValue: 20,
    maxValue: 1000
  },
  STREAK_DAYS: {
    id: 'streak_days',
    name: '连续学习天数',
    unit: '天',
    icon: '🔥',
    defaultValue: 7,
    minValue: 3,
    maxValue: 365
  },
  WEAK_POINT_IMPROVE: {
    id: 'weak_point_improve',
    name: '薄弱知识点提升',
    unit: '个',
    icon: '💪',
    defaultValue: 3,
    minValue: 1,
    maxValue: 20
  }
};

// 提醒类型
const REMINDER_TYPES = {
  MORNING: { id: 'morning', name: '早间提醒', defaultTime: '08:00', message: '新的一天开始了，来刷几道题吧！' },
  AFTERNOON: { id: 'afternoon', name: '午间提醒', defaultTime: '14:00', message: '午后时光，适合学习充电！' },
  EVENING: { id: 'evening', name: '晚间提醒', defaultTime: '20:00', message: '今天的学习目标完成了吗？' },
  CUSTOM: { id: 'custom', name: '自定义提醒', defaultTime: '19:00', message: '该学习啦！' }
};

/**
 * 学习目标管理器
 */
class LearningGoalManager {
  constructor() {
    this.goals = [];
    this.records = [];
    this.reminderSettings = {
      enabled: true,
      reminders: []
    };
    this.isInitialized = false;
  }

  /**
   * 初始化
   */
  init() {
    if (this.isInitialized) return;
    this._loadGoals();
    this._loadRecords();
    this._loadReminderSettings();
    this.isInitialized = true;
    logger.log('[LearningGoal] 初始化完成');

    // ✅ F012: 异步从后端拉取目标并合并（不阻塞本地使用）
    this._fetchAndMergeFromServer();
  }

  /**
   * 创建学习目标
   * @param {Object} goalData - 目标数据
   * @returns {Object} 创建的目标
   */
  createGoal(goalData) {
    this.init();

    const goalType = GOAL_TYPES[goalData.type];
    if (!goalType) {
      logger.warn('[LearningGoal] 无效的目标类型:', goalData.type);
      return null;
    }

    const goal = {
      id: this._generateId(),
      type: goalData.type,
      name: goalData.name || goalType.name,
      targetValue: Math.max(
        goalType.minValue,
        Math.min(goalType.maxValue, goalData.targetValue || goalType.defaultValue)
      ),
      currentValue: 0,
      unit: goalType.unit,
      icon: goalType.icon,
      // 周期设置
      period: goalData.period || 'daily', // daily | weekly | custom
      startDate: goalData.startDate || this._getDateString(new Date()),
      endDate: goalData.endDate || null,
      // 状态
      status: 'active', // active | completed | paused | expired
      isCompleted: false,
      completedAt: null,
      // 元数据
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.goals.push(goal);
    this._saveGoals();

    return goal;
  }

  /**
   * 更新目标进度
   * @param {string} goalId - 目标ID
   * @param {number} value - 新增值
   * @returns {Object} 更新后的目标
   */
  updateProgress(goalId, value) {
    this.init();

    const goal = this.goals.find((g) => g.id === goalId);
    if (!goal) {
      logger.warn('[LearningGoal] 目标不存在:', goalId);
      return null;
    }

    goal.currentValue += value;
    goal.updatedAt = Date.now();

    // 检查是否完成
    if (goal.currentValue >= goal.targetValue && !goal.isCompleted) {
      goal.isCompleted = true;
      goal.completedAt = Date.now();
      goal.status = 'completed';
      this._triggerCompletionNotification(goal);
    }

    this._saveGoals();
    this._recordProgress(goal, value);

    // ✅ F012: 异步同步进度增量到后端
    this._syncProgressToServer(goal.type, value);

    return goal;
  }

  /**
   * 根据类型自动更新目标
   * @param {string} type - 目标类型
   * @param {number} value - 新增值
   */
  autoUpdateByType(type, value) {
    this.init();

    const activeGoals = this.goals.filter((g) => g.type === type && g.status === 'active');

    for (const goal of activeGoals) {
      this.updateProgress(goal.id, value);
    }
  }

  /**
   * 获取今日目标
   * @returns {Array} 今日目标列表
   */
  getTodayGoals() {
    this.init();
    this._checkAndResetDailyGoals();

    return this.goals
      .filter((g) => g.status === 'active' && (g.period === 'daily' || g.period === 'weekly'))
      .map((g) => ({
        ...g,
        progress: Math.min(100, Math.round((g.currentValue / g.targetValue) * 100)),
        remaining: Math.max(0, g.targetValue - g.currentValue)
      }));
  }

  /**
   * 获取目标完成统计
   * @param {number} days - 统计天数
   * @returns {Object} 统计数据
   */
  getGoalStats(days = 30) {
    this.init();

    const now = Date.now();
    const startTime = now - days * 24 * 60 * 60 * 1000;

    // 筛选时间范围内的记录
    const recentRecords = this.records.filter((r) => r.timestamp >= startTime);

    // 按日期分组统计
    const dailyStats = {};
    for (const record of recentRecords) {
      const dateStr = new Date(record.timestamp).toISOString().split('T')[0];
      if (!dailyStats[dateStr]) {
        dailyStats[dateStr] = {
          date: dateStr,
          goalsSet: 0,
          goalsCompleted: 0,
          totalProgress: 0
        };
      }
      dailyStats[dateStr].goalsSet++;
      if (record.isCompleted) {
        dailyStats[dateStr].goalsCompleted++;
      }
      dailyStats[dateStr].totalProgress += record.progress;
    }

    // 计算完成率
    const completedGoals = this.goals.filter((g) => g.isCompleted).length;
    const totalGoals = this.goals.length;
    const completionRate = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;

    // 计算连续完成天数
    const streakDays = this._calculateStreakDays();

    return {
      totalGoals,
      completedGoals,
      completionRate,
      streakDays,
      dailyStats: Object.values(dailyStats).sort((a, b) => new Date(a.date) - new Date(b.date)),
      averageCompletion: this._calculateAverageCompletion(days)
    };
  }

  /**
   * 设置提醒
   * @param {Object} reminderData - 提醒数据
   * @returns {Object} 设置的提醒
   */
  setReminder(reminderData) {
    this.init();

    const reminder = {
      id: this._generateId(),
      type: reminderData.type || 'CUSTOM',
      time: reminderData.time || '19:00',
      message: reminderData.message || REMINDER_TYPES[reminderData.type]?.message || '该学习啦！',
      enabled: reminderData.enabled !== false,
      repeatDays: reminderData.repeatDays || [1, 2, 3, 4, 5, 6, 0], // 默认每天
      createdAt: Date.now()
    };

    // 检查是否已存在同类型提醒
    const existingIndex = this.reminderSettings.reminders.findIndex((r) => r.type === reminder.type);

    if (existingIndex >= 0) {
      this.reminderSettings.reminders[existingIndex] = reminder;
    } else {
      this.reminderSettings.reminders.push(reminder);
    }

    this._saveReminderSettings();
    this._scheduleReminder(reminder);

    return reminder;
  }

  /**
   * 获取提醒设置
   * @returns {Object} 提醒设置
   */
  getReminderSettings() {
    this.init();
    return {
      ...this.reminderSettings,
      availableTypes: REMINDER_TYPES
    };
  }

  /**
   * 切换提醒开关
   * @param {boolean} enabled - 是否启用
   */
  toggleReminders(enabled) {
    this.init();
    this.reminderSettings.enabled = enabled;
    this._saveReminderSettings();

    if (enabled) {
      this._scheduleAllReminders();
    } else {
      this._cancelAllReminders();
    }
  }

  /**
   * 获取智能建议目标
   * @param {Object} learningData - 学习数据
   * @returns {Array} 建议目标
   */
  getSuggestedGoals(learningData = {}) {
    this.init();

    const suggestions = [];
    const { averageDailyQuestions = 0, averageAccuracy = 0, currentStreak = 0, weakPointsCount = 0 } = learningData;

    // 基于历史数据建议每日刷题目标
    if (averageDailyQuestions > 0) {
      const suggestedQuestions = Math.ceil(averageDailyQuestions * 1.2); // 提升20%
      suggestions.push({
        type: 'DAILY_QUESTIONS',
        targetValue: Math.min(suggestedQuestions, 50),
        reason: `基于你的历史数据，建议每日完成 ${suggestedQuestions} 道题`
      });
    } else {
      suggestions.push({
        type: 'DAILY_QUESTIONS',
        targetValue: 20,
        reason: '建议从每日20道题开始，逐步提升'
      });
    }

    // 基于正确率建议
    if (averageAccuracy > 0 && averageAccuracy < 80) {
      suggestions.push({
        type: 'DAILY_ACCURACY',
        targetValue: Math.min(Math.ceil(averageAccuracy + 10), 90),
        reason: '提升正确率是提高成绩的关键'
      });
    }

    // 连续学习建议
    if (currentStreak < 7) {
      suggestions.push({
        type: 'STREAK_DAYS',
        targetValue: 7,
        reason: '坚持7天养成学习习惯'
      });
    } else if (currentStreak < 30) {
      suggestions.push({
        type: 'STREAK_DAYS',
        targetValue: 30,
        reason: '挑战30天连续学习'
      });
    }

    // 薄弱知识点建议
    if (weakPointsCount > 0) {
      suggestions.push({
        type: 'WEAK_POINT_IMPROVE',
        targetValue: Math.min(weakPointsCount, 5),
        reason: `你有 ${weakPointsCount} 个薄弱知识点需要提升`
      });
    }

    return suggestions.map((s) => ({
      ...s,
      ...GOAL_TYPES[s.type]
    }));
  }

  /**
   * 检查并发送进度提醒
   */
  checkProgressReminder() {
    this.init();

    const todayGoals = this.getTodayGoals();
    const now = new Date();
    const hour = now.getHours();

    // 晚上8点检查进度
    if (hour >= 20) {
      const incompleteGoals = todayGoals.filter((g) => !g.isCompleted);

      if (incompleteGoals.length > 0) {
        const _totalRemaining = incompleteGoals.reduce((sum, g) => sum + g.remaining, 0);
        this._sendNotification({
          title: '学习目标提醒',
          content: `今日还有 ${incompleteGoals.length} 个目标未完成，加油！`,
          data: { type: 'progress_reminder', goals: incompleteGoals }
        });
      }
    }
  }

  /**
   * 获取目标完成激励语
   * @param {Object} goal - 完成的目标
   * @returns {string} 激励语
   */
  getMotivationalMessage(goal) {
    const messages = {
      DAILY_QUESTIONS: ['太棒了！今日刷题目标已达成！', '坚持就是胜利，继续保持！', '学习小能手就是你！'],
      DAILY_ACCURACY: ['正确率达标！你的努力有了回报！', '准确度提升中，继续加油！', '稳扎稳打，成绩会越来越好！'],
      DAILY_TIME: ['今日学习时长达标！', '时间投入是成功的基础！', '专注学习，收获满满！'],
      STREAK_DAYS: ['连续学习记录刷新！', '坚持的力量是无穷的！', '习惯养成中，继续保持！'],
      WEAK_POINT_IMPROVE: ['薄弱知识点攻克成功！', '查漏补缺，进步明显！', '知识盲区越来越少了！']
    };

    const typeMessages = messages[goal.type] || ['目标完成！继续加油！'];
    return typeMessages[Math.floor(Math.random() * typeMessages.length)];
  }

  // ==================== 私有方法 ====================

  /**
   * 检查并重置每日目标
   */
  _checkAndResetDailyGoals() {
    const today = this._getDateString(new Date());

    for (const goal of this.goals) {
      if (goal.period === 'daily' && goal.startDate !== today) {
        // 记录昨日完成情况
        if (goal.currentValue > 0) {
          this._recordProgress(goal, 0, true);
        }

        // 重置每日目标
        goal.startDate = today;
        goal.currentValue = 0;
        goal.isCompleted = false;
        goal.completedAt = null;
        goal.status = 'active';
        goal.updatedAt = Date.now();
      }
    }

    this._saveGoals();
  }

  /**
   * 记录进度
   */
  _recordProgress(goal, addedValue, isDayEnd = false) {
    const record = {
      id: this._generateId(),
      goalId: goal.id,
      goalType: goal.type,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      addedValue,
      progress: Math.round((goal.currentValue / goal.targetValue) * 100),
      isCompleted: goal.isCompleted,
      isDayEnd,
      timestamp: Date.now()
    };

    this.records.push(record);

    // 只保留最近1000条记录
    if (this.records.length > 1000) {
      this.records = this.records.slice(-1000);
    }

    this._saveRecords();
  }

  /**
   * 触发完成通知
   */
  _triggerCompletionNotification(goal) {
    const message = this.getMotivationalMessage(goal);

    this._sendNotification({
      title: '🎉 目标达成！',
      content: message,
      data: { type: 'goal_completed', goal }
    });

    // 震动反馈
    try {
      if (typeof uni !== 'undefined' && typeof uni.vibrateShort === 'function') {
        uni.vibrateShort({ type: 'heavy' });
      }
    } catch (e) {
      logger.warn('[LearningGoal] 震动反馈失败:', e);
    }
  }

  /**
   * 发送通知
   */
  _sendNotification(notification) {
    try {
      if (typeof uni !== 'undefined') {
        uni.showToast({
          title: notification.content,
          icon: 'none',
          duration: 3000
        });
      }
    } catch (e) {
      logger.warn('[LearningGoal] 发送通知失败:', e);
    }
  }

  /**
   * 计算连续完成天数
   */
  _calculateStreakDays() {
    const dailyGoals = this.goals.filter((g) => g.period === 'daily');
    if (dailyGoals.length === 0) return 0;

    // 按日期分组检查完成情况
    const completionByDate = {};
    for (const record of this.records) {
      if (record.isDayEnd && record.isCompleted) {
        const dateStr = new Date(record.timestamp).toISOString().split('T')[0];
        completionByDate[dateStr] = true;
      }
    }

    // 计算连续天数
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = this._getDateString(date);

      if (completionByDate[dateStr]) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  }

  /**
   * 计算平均完成率
   */
  _calculateAverageCompletion(days) {
    const now = Date.now();
    const startTime = now - days * 24 * 60 * 60 * 1000;

    const recentRecords = this.records.filter((r) => r.timestamp >= startTime && r.isDayEnd);

    if (recentRecords.length === 0) return 0;

    const totalProgress = recentRecords.reduce((sum, r) => sum + r.progress, 0);
    return Math.round(totalProgress / recentRecords.length);
  }

  /**
   * 调度提醒
   */
  _scheduleReminder(reminder) {
    // 在小程序环境中，使用订阅消息或本地通知
    // 这里提供基础实现，实际需要根据平台调整
    logger.log('[LearningGoal] 提醒已设置:', reminder);
  }

  /**
   * 调度所有提醒
   */
  _scheduleAllReminders() {
    for (const reminder of this.reminderSettings.reminders) {
      if (reminder.enabled) {
        this._scheduleReminder(reminder);
      }
    }
  }

  /**
   * 取消所有提醒
   */
  _cancelAllReminders() {
    logger.log('[LearningGoal] 所有提醒已取消');
  }

  /**
   * 获取日期字符串
   */
  _getDateString(date) {
    // [AUDIT FIX] 使用本地日期而非 UTC，避免跨时区用户每日目标在错误时间重置
    const pad = (n) => String(n).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
  }

  /**
   * 生成唯一ID
   */
  _generateId() {
    return 'goal_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  /**
   * 加载目标
   */
  _loadGoals() {
    try {
      if (typeof uni !== 'undefined') {
        this.goals = storageService.get(STORAGE_KEYS.GOALS, []);
      }
    } catch (_e) {
      this.goals = [];
    }
  }

  /**
   * 保存目标
   */
  _saveGoals() {
    try {
      if (typeof uni !== 'undefined') {
        storageService.save(STORAGE_KEYS.GOALS, this.goals);
        // ✅ F012: 触发后端同步（异步，不阻塞本地保存）
        this._syncToServer();
      }
    } catch (e) {
      logger.warn('[LearningGoal] 保存目标失败:', e);
    }
  }

  /**
   * ✅ F012: 从后端拉取目标并与本地合并
   * 策略：后端有而本地没有的 → 添加到本地；本地有而后端没有的 → 保留本地（下次 _syncToServer 会上传）
   */
  async _fetchAndMergeFromServer() {
    try {
      const userId = storageService.get('EXAM_USER_ID');
      if (!userId) return;

      const { lafService } = await import('@/services/lafService.js');
      const res = await lafService.getLearningGoals({ status: 'active' });
      const serverGoals = res?.data || [];
      if (!Array.isArray(serverGoals) || serverGoals.length === 0) return;

      let changed = false;
      const localTypes = new Set(this.goals.map((g) => g.type));

      for (const sg of serverGoals) {
        if (!localTypes.has(sg.type)) {
          // 后端有、本地没有 → 添加到本地
          this.goals.push({
            id: sg._id || this._generateId(),
            type: sg.type,
            name: sg.label || GOAL_TYPES[sg.type]?.name || sg.type,
            targetValue: sg.target_value || GOAL_TYPES[sg.type]?.defaultValue || 20,
            currentValue: sg.current_value || 0,
            unit: sg.unit || GOAL_TYPES[sg.type]?.unit || '',
            icon: GOAL_TYPES[sg.type]?.icon || '',
            period: sg.period || 'daily',
            startDate: sg.start_date ? this._getDateString(new Date(sg.start_date)) : this._getDateString(new Date()),
            endDate: sg.end_date ? this._getDateString(new Date(sg.end_date)) : null,
            status: sg.status || 'active',
            isCompleted: false,
            completedAt: null,
            createdAt: sg.created_at || Date.now(),
            updatedAt: sg.updated_at || Date.now()
          });
          changed = true;
        }
      }

      if (changed) {
        storageService.save(STORAGE_KEYS.GOALS, this.goals);
        logger.log(`[LearningGoal] 从后端合并了新目标，当前共 ${this.goals.length} 个`);
      }
    } catch (e) {
      // 拉取失败不影响本地使用
      logger.warn('[LearningGoal] 后端目标拉取失败:', e.message);
    }
  }

  /**
   * ✅ F012: 同步进度增量到后端（fire-and-forget）
   */
  async _syncProgressToServer(type, value) {
    try {
      const userId = storageService.get('EXAM_USER_ID');
      if (!userId) return;

      const { lafService } = await import('@/services/lafService.js');
      if (lafService && typeof lafService.recordGoalProgress === 'function') {
        await lafService.recordGoalProgress(type, value);
      }
    } catch (e) {
      logger.warn('[LearningGoal] 进度同步失败:', e.message);
    }
  }

  /**
   * ✅ F012: 同步学习目标到后端
   * 采用本地优先策略：先保存本地，再异步同步到服务器
   * 同步失败不影响本地使用，下次保存时会重试
   */
  async _syncToServer() {
    try {
      const userId = storageService.get('EXAM_USER_ID');
      if (!userId) return; // 未登录不同步

      const syncData = {
        goals: this.goals,
        updatedAt: Date.now()
      };

      // 标记待同步
      storageService.save('learning_goals_pending_sync', true);

      // 尝试调用后端接口（lafService 中需要实现对应接口）
      const { lafService } = await import('@/services/lafService.js');
      if (lafService && typeof lafService.syncLearningGoals === 'function') {
        await lafService.syncLearningGoals(userId, syncData);
        storageService.remove('learning_goals_pending_sync');
        logger.log('[LearningGoal] 目标已同步到服务器');
      }
    } catch (e) {
      // 同步失败不影响本地使用，下次保存时重试
      logger.warn('[LearningGoal] 后端同步失败（将在下次保存时重试）:', e.message);
    }
  }

  /**
   * 加载记录
   */
  _loadRecords() {
    try {
      if (typeof uni !== 'undefined') {
        this.records = storageService.get(STORAGE_KEYS.GOAL_RECORDS, []);
      }
    } catch (_e) {
      this.records = [];
    }
  }

  /**
   * 保存记录
   */
  _saveRecords() {
    try {
      if (typeof uni !== 'undefined') {
        storageService.save(STORAGE_KEYS.GOAL_RECORDS, this.records);
      }
    } catch (e) {
      logger.warn('[LearningGoal] 保存记录失败:', e);
    }
  }

  /**
   * 加载提醒设置
   */
  _loadReminderSettings() {
    try {
      if (typeof uni !== 'undefined') {
        const saved = storageService.get(STORAGE_KEYS.REMINDER_SETTINGS);
        if (saved) {
          this.reminderSettings = { ...this.reminderSettings, ...saved };
        }
      }
    } catch (e) {
      logger.warn('[LearningGoal] 加载提醒设置失败:', e);
    }
  }

  /**
   * 保存提醒设置
   */
  _saveReminderSettings() {
    try {
      if (typeof uni !== 'undefined') {
        storageService.save(STORAGE_KEYS.REMINDER_SETTINGS, this.reminderSettings);
      }
    } catch (e) {
      logger.warn('[LearningGoal] 保存提醒设置失败:', e);
    }
  }
}

// 创建单例
export const learningGoalManager = new LearningGoalManager();

// 便捷函数
export function createLearningGoal(goalData) {
  return learningGoalManager.createGoal(goalData);
}

export function updateGoalProgress(goalId, value) {
  return learningGoalManager.updateProgress(goalId, value);
}

export function autoUpdateGoal(type, value) {
  return learningGoalManager.autoUpdateByType(type, value);
}

export function getTodayGoals() {
  return learningGoalManager.getTodayGoals();
}

export function getGoalStats(days) {
  return learningGoalManager.getGoalStats(days);
}

export function setLearningReminder(reminderData) {
  return learningGoalManager.setReminder(reminderData);
}

export function getReminderSettings() {
  return learningGoalManager.getReminderSettings();
}

export function toggleLearningReminders(enabled) {
  return learningGoalManager.toggleReminders(enabled);
}

export function getSuggestedGoals(learningData) {
  return learningGoalManager.getSuggestedGoals(learningData);
}

export function checkProgressReminder() {
  return learningGoalManager.checkProgressReminder();
}

export { GOAL_TYPES, REMINDER_TYPES };
export default learningGoalManager;
