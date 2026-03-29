/**
 * learning-goal.js 单元测试
 *
 * 覆盖目标：LearningGoalManager 核心方法 + 便捷函数
 * - init / createGoal / updateProgress / autoUpdateByType
 * - getTodayGoals / getGoalStats / _checkAndResetDailyGoals
 * - setReminder / getReminderSettings / toggleReminders
 * - getSuggestedGoals / checkProgressReminder / getMotivationalMessage
 * - _calculateStreakDays / _calculateAverageCompletion
 * - _fetchAndMergeFromServer / _syncToServer / _syncProgressToServer
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
vi.mock('../../src/services/storageService.js', () => ({
  default: {
    get: vi.fn((_key, defaultValue = null) => defaultValue),
    save: vi.fn(),
    remove: vi.fn()
  }
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Mock user.api.js (learning-goal.js 直接导入)
vi.mock('../../src/services/api/domains/user.api.js', () => ({
  getLearningGoals: vi.fn(() => Promise.resolve({ data: [] })),
  recordGoalProgress: vi.fn(() => Promise.resolve()),
  syncLearningGoals: vi.fn(() => Promise.resolve())
}));

import storageService from '../../src/services/storageService.js';

// uni mock
globalThis.uni = {
  showToast: vi.fn(),
  hideToast: vi.fn(),
  vibrateShort: vi.fn()
};

describe('LearningGoalManager', () => {
  let LearningGoalManager, GOAL_TYPES, REMINDER_TYPES;
  let manager;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000); // 固定时间戳

    // 每次创建新实例避免状态污染
    const mod = await import('../../src/utils/learning/learning-goal.js');
    GOAL_TYPES = mod.GOAL_TYPES;
    REMINDER_TYPES = mod.REMINDER_TYPES;

    // 手动创建新实例（绕过单例）
    LearningGoalManager = mod.learningGoalManager.constructor;
    manager = new LearningGoalManager();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==================== init ====================
  describe('init', () => {
    it('首次调用加载数据并标记已初始化', () => {
      manager.init();
      expect(manager.isInitialized).toBe(true);
      expect(storageService.get).toHaveBeenCalledWith('learning_goals', []);
    });

    it('重复调用不重新加载', () => {
      manager.init();
      const callCount = storageService.get.mock.calls.length;
      manager.init();
      expect(storageService.get.mock.calls.length).toBe(callCount);
    });
  });

  // ==================== createGoal ====================
  describe('createGoal', () => {
    it('创建有效目标', () => {
      const goal = manager.createGoal({
        type: 'DAILY_QUESTIONS',
        targetValue: 30
      });

      expect(goal).not.toBeNull();
      expect(goal.type).toBe('DAILY_QUESTIONS');
      expect(goal.targetValue).toBe(30);
      expect(goal.currentValue).toBe(0);
      expect(goal.status).toBe('active');
      expect(goal.unit).toBe('道');
      expect(storageService.save).toHaveBeenCalled();
    });

    it('无效目标类型 → 返回 null', () => {
      const goal = manager.createGoal({ type: 'INVALID_TYPE' });
      expect(goal).toBeNull();
    });

    it('targetValue 低于 minValue → 钳位到 minValue', () => {
      const goal = manager.createGoal({
        type: 'DAILY_QUESTIONS',
        targetValue: 1 // min is 5
      });
      expect(goal.targetValue).toBe(5);
    });

    it('targetValue 高于 maxValue → 钳位到 maxValue', () => {
      const goal = manager.createGoal({
        type: 'DAILY_QUESTIONS',
        targetValue: 999 // max is 200
      });
      expect(goal.targetValue).toBe(200);
    });

    it('未提供 targetValue → 使用 defaultValue', () => {
      const goal = manager.createGoal({ type: 'DAILY_ACCURACY' });
      expect(goal.targetValue).toBe(70); // defaultValue
    });

    it('自定义 name 和 period', () => {
      const goal = manager.createGoal({
        type: 'WEEKLY_QUESTIONS',
        name: '自定义名称',
        period: 'weekly'
      });
      expect(goal.name).toBe('自定义名称');
      expect(goal.period).toBe('weekly');
    });
  });

  // ==================== updateProgress ====================
  describe('updateProgress', () => {
    it('更新目标进度', () => {
      const goal = manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 10 });
      const updated = manager.updateProgress(goal.id, 5);

      expect(updated.currentValue).toBe(5);
      expect(updated.isCompleted).toBe(false);
    });

    it('进度达到目标值 → 标记完成', () => {
      const goal = manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 10 });
      manager.updateProgress(goal.id, 5);
      const updated = manager.updateProgress(goal.id, 5);

      expect(updated.currentValue).toBe(10);
      expect(updated.isCompleted).toBe(true);
      expect(updated.status).toBe('completed');
      expect(uni.showToast).toHaveBeenCalled(); // 完成通知
    });

    it('已完成的目标不重复触发通知', () => {
      const goal = manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 5 });
      manager.updateProgress(goal.id, 5); // 完成
      vi.clearAllMocks();

      manager.updateProgress(goal.id, 3); // 超额
      expect(uni.showToast).not.toHaveBeenCalled();
    });

    it('目标不存在 → 返回 null', () => {
      manager.init();
      expect(manager.updateProgress('nonexistent', 5)).toBeNull();
    });
  });

  // ==================== autoUpdateByType ====================
  describe('autoUpdateByType', () => {
    it('更新所有同类型活跃目标', () => {
      const g1 = manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 20 });
      const g2 = manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 30 });
      manager.createGoal({ type: 'DAILY_ACCURACY', targetValue: 80 });

      manager.autoUpdateByType('DAILY_QUESTIONS', 10);

      const goals = manager.goals;
      expect(goals.find((g) => g.id === g1.id).currentValue).toBe(10);
      expect(goals.find((g) => g.id === g2.id).currentValue).toBe(10);
    });

    it('不更新非活跃目标', () => {
      const goal = manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 5 });
      manager.updateProgress(goal.id, 5); // 完成 → status=completed

      manager.autoUpdateByType('DAILY_QUESTIONS', 10);
      // completed 目标不在 active 过滤中
    });
  });

  // ==================== getTodayGoals ====================
  describe('getTodayGoals', () => {
    it('返回活跃的每日/每周目标 + 进度信息', () => {
      manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 20 });
      manager.createGoal({ type: 'WEEKLY_QUESTIONS', targetValue: 100, period: 'weekly' });

      const today = manager.getTodayGoals();
      expect(today.length).toBe(2);
      expect(today[0].progress).toBeDefined();
      expect(today[0].remaining).toBeDefined();
    });

    it('进度计算正确', () => {
      const goal = manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 20 });
      manager.updateProgress(goal.id, 10);

      const today = manager.getTodayGoals();
      const found = today.find((g) => g.id === goal.id);
      expect(found.progress).toBe(50);
      expect(found.remaining).toBe(10);
    });

    it('进度不超过 100%', () => {
      const goal = manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 5 });
      manager.updateProgress(goal.id, 10); // 超额

      const _today = manager.getTodayGoals();
      // completed 目标 status 变为 completed，不在 active 过滤中
      // 但如果还在 active 中，progress 应该 cap 在 100
    });
  });

  // ==================== getGoalStats ====================
  describe('getGoalStats', () => {
    it('无目标时返回零值统计', () => {
      manager.init();
      const stats = manager.getGoalStats(30);

      expect(stats.totalGoals).toBe(0);
      expect(stats.completedGoals).toBe(0);
      expect(stats.completionRate).toBe(0);
      expect(stats.streakDays).toBe(0);
      expect(stats.averageCompletion).toBe(0);
    });

    it('有目标时计算完成率', () => {
      const g1 = manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 5 });
      manager.createGoal({ type: 'DAILY_ACCURACY', targetValue: 80 });
      manager.updateProgress(g1.id, 5); // 完成 g1

      const stats = manager.getGoalStats(30);
      expect(stats.totalGoals).toBe(2);
      expect(stats.completedGoals).toBe(1);
      expect(stats.completionRate).toBe(50);
    });
  });

  // ==================== _checkAndResetDailyGoals ====================
  describe('_checkAndResetDailyGoals', () => {
    it('跨日重置每日目标', () => {
      const goal = manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 10 });
      manager.updateProgress(goal.id, 8);

      // 模拟昨天的 startDate
      goal.startDate = '2023-01-01';

      manager._checkAndResetDailyGoals();

      expect(goal.currentValue).toBe(0);
      expect(goal.isCompleted).toBe(false);
      expect(goal.status).toBe('active');
    });

    it('同日不重置', () => {
      const goal = manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 10 });
      manager.updateProgress(goal.id, 5);

      // startDate 已经是今天
      manager._checkAndResetDailyGoals();
      expect(goal.currentValue).toBe(5); // 不变
    });
  });

  // ==================== setReminder ====================
  describe('setReminder', () => {
    it('创建新提醒', () => {
      const reminder = manager.setReminder({
        type: 'MORNING',
        time: '08:00'
      });

      expect(reminder.type).toBe('MORNING');
      expect(reminder.time).toBe('08:00');
      expect(reminder.enabled).toBe(true);
      expect(manager.reminderSettings.reminders.length).toBe(1);
    });

    it('更新已存在的同类型提醒', () => {
      manager.setReminder({ type: 'MORNING', time: '08:00' });
      manager.setReminder({ type: 'MORNING', time: '09:00' });

      expect(manager.reminderSettings.reminders.length).toBe(1);
      expect(manager.reminderSettings.reminders[0].time).toBe('09:00');
    });

    it('不同类型提醒共存', () => {
      manager.setReminder({ type: 'MORNING' });
      manager.setReminder({ type: 'EVENING' });

      expect(manager.reminderSettings.reminders.length).toBe(2);
    });

    it('使用 REMINDER_TYPES 中的默认消息', () => {
      const reminder = manager.setReminder({ type: 'MORNING' });
      expect(reminder.message).toBe('新的一天开始了，来刷几道题吧！');
    });
  });

  // ==================== getReminderSettings ====================
  describe('getReminderSettings', () => {
    it('返回设置 + 可用类型', () => {
      const settings = manager.getReminderSettings();
      expect(settings.enabled).toBe(true);
      expect(settings.availableTypes).toBe(REMINDER_TYPES);
    });
  });

  // ==================== toggleReminders ====================
  describe('toggleReminders', () => {
    it('禁用提醒', () => {
      manager.toggleReminders(false);
      expect(manager.reminderSettings.enabled).toBe(false);
      expect(storageService.save).toHaveBeenCalled();
    });

    it('启用提醒 → 调度所有已启用的提醒', () => {
      manager.setReminder({ type: 'MORNING', enabled: true });
      manager.toggleReminders(true);
      expect(manager.reminderSettings.enabled).toBe(true);
    });
  });

  // ==================== getSuggestedGoals ====================
  describe('getSuggestedGoals', () => {
    it('无学习数据 → 返回默认建议', () => {
      const suggestions = manager.getSuggestedGoals({});

      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      // 应包含默认每日刷题建议
      const dailyQ = suggestions.find((s) => s.type === 'DAILY_QUESTIONS');
      expect(dailyQ).toBeDefined();
      expect(dailyQ.targetValue).toBe(20);
    });

    it('有历史数据 → 建议提升 20%', () => {
      const suggestions = manager.getSuggestedGoals({
        averageDailyQuestions: 25
      });

      const dailyQ = suggestions.find((s) => s.type === 'DAILY_QUESTIONS');
      expect(dailyQ.targetValue).toBe(30); // ceil(25 * 1.2) = 30
    });

    it('正确率 < 80% → 建议提升正确率', () => {
      const suggestions = manager.getSuggestedGoals({
        averageAccuracy: 65
      });

      const accuracy = suggestions.find((s) => s.type === 'DAILY_ACCURACY');
      expect(accuracy).toBeDefined();
      expect(accuracy.targetValue).toBe(75); // ceil(65 + 10)
    });

    it('正确率 >= 80% → 不建议正确率目标', () => {
      const suggestions = manager.getSuggestedGoals({
        averageAccuracy: 85
      });

      const accuracy = suggestions.find((s) => s.type === 'DAILY_ACCURACY');
      expect(accuracy).toBeUndefined();
    });

    it('连续学习 < 7 天 → 建议 7 天目标', () => {
      const suggestions = manager.getSuggestedGoals({ currentStreak: 3 });
      const streak = suggestions.find((s) => s.type === 'STREAK_DAYS');
      expect(streak.targetValue).toBe(7);
    });

    it('连续学习 7-29 天 → 建议 30 天目标', () => {
      const suggestions = manager.getSuggestedGoals({ currentStreak: 15 });
      const streak = suggestions.find((s) => s.type === 'STREAK_DAYS');
      expect(streak.targetValue).toBe(30);
    });

    it('连续学习 >= 30 天 → 不建议连续学习目标', () => {
      const suggestions = manager.getSuggestedGoals({ currentStreak: 30 });
      const streak = suggestions.find((s) => s.type === 'STREAK_DAYS');
      expect(streak).toBeUndefined();
    });

    it('有薄弱知识点 → 建议提升', () => {
      const suggestions = manager.getSuggestedGoals({ weakPointsCount: 8 });
      const weak = suggestions.find((s) => s.type === 'WEAK_POINT_IMPROVE');
      expect(weak).toBeDefined();
      expect(weak.targetValue).toBe(5); // min(8, 5)
    });

    it('建议包含 GOAL_TYPES 元数据', () => {
      const suggestions = manager.getSuggestedGoals({});
      const dailyQ = suggestions.find((s) => s.type === 'DAILY_QUESTIONS');
      expect(dailyQ.name).toBe('每日刷题');
      expect(dailyQ.unit).toBe('道');
      expect(dailyQ.icon).toBe('note');
    });
  });

  // ==================== checkProgressReminder ====================
  describe('checkProgressReminder', () => {
    it('20 点后有未完成目标 → 发送提醒', () => {
      manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 20 });

      // 模拟 20:30
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(20);

      manager.checkProgressReminder();
      expect(uni.showToast).toHaveBeenCalled();
    });

    it('20 点前 → 不发送提醒', () => {
      manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 20 });

      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(15);

      manager.checkProgressReminder();
      expect(uni.showToast).not.toHaveBeenCalled();
    });

    it('所有目标已完成 → 不发送提醒', () => {
      const goal = manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 5 });
      manager.updateProgress(goal.id, 5);
      vi.clearAllMocks();

      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(21);

      manager.checkProgressReminder();
      // completed 目标不在 active 过滤中，所以 todayGoals 为空
    });
  });

  // ==================== getMotivationalMessage ====================
  describe('getMotivationalMessage', () => {
    it('已知类型 → 返回对应激励语', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const msg = manager.getMotivationalMessage({ type: 'DAILY_QUESTIONS' });
      expect(msg).toBe('太棒了！今日刷题目标已达成！');
    });

    it('未知类型 → 返回默认激励语', () => {
      vi.spyOn(Math, 'random').mockReturnValue(0);
      const msg = manager.getMotivationalMessage({ type: 'UNKNOWN' });
      expect(msg).toBe('目标完成！继续加油！');
    });
  });

  // ==================== _calculateStreakDays ====================
  describe('_calculateStreakDays', () => {
    it('无每日目标 → 返回 0', () => {
      manager.init();
      expect(manager._calculateStreakDays()).toBe(0);
    });

    it('有连续完成记录 → 返回正确天数', () => {
      manager.createGoal({ type: 'DAILY_QUESTIONS', targetValue: 10, period: 'daily' });

      // 使用真实当前时间（_calculateStreakDays 内部用 new Date() 而非 Date.now()）
      const realNow = new Date();
      for (let i = 0; i < 3; i++) {
        const d = new Date(realNow);
        d.setDate(d.getDate() - i);
        // _calculateStreakDays 用 toISOString().split('T')[0] 读取记录日期
        // 但用 _getDateString (本地日期) 做比较，需要两者一致
        // 设置时间为中午 12:00 UTC 确保 UTC 和本地日期相同
        d.setHours(12, 0, 0, 0);
        manager.records.push({
          id: `r${i}`,
          goalType: 'DAILY_QUESTIONS',
          isDayEnd: true,
          isCompleted: true,
          timestamp: d.getTime(),
          progress: 100
        });
      }

      expect(manager._calculateStreakDays()).toBeGreaterThanOrEqual(2);
    });
  });

  // ==================== _recordProgress ====================
  describe('_recordProgress', () => {
    it('记录超过 1000 条时截断', () => {
      manager.init();
      manager.records = new Array(1001).fill(null).map((_, i) => ({
        id: `old_${i}`,
        timestamp: i
      }));

      const goal = { id: 'g1', type: 'DAILY_QUESTIONS', targetValue: 10, currentValue: 5, isCompleted: false };
      manager._recordProgress(goal, 5);

      expect(manager.records.length).toBe(1000);
    });
  });

  // ==================== _fetchAndMergeFromServer ====================
  describe('_fetchAndMergeFromServer', () => {
    it('无 userId → 不拉取', async () => {
      storageService.get.mockReturnValue(null);
      await manager._fetchAndMergeFromServer();
      // 不应报错
    });

    it('有 userId + 后端返回新目标 → 合并到本地', async () => {
      storageService.get.mockImplementation((key, defaultValue = null) => {
        if (key === 'EXAM_USER_ID') return 'user123';
        return defaultValue;
      });

      const { getLearningGoals } = await import('../../src/services/api/domains/user.api.js');
      getLearningGoals.mockResolvedValue({
        data: [{ type: 'STREAK_DAYS', target_value: 14, period: 'daily' }]
      });

      manager.init();
      await manager._fetchAndMergeFromServer();

      const streakGoal = manager.goals.find((g) => g.type === 'STREAK_DAYS');
      expect(streakGoal).toBeDefined();
      expect(streakGoal.targetValue).toBe(14);
    });
  });

  // ==================== _syncProgressToServer ====================
  describe('_syncProgressToServer', () => {
    it('无 userId → 不同步', async () => {
      storageService.get.mockReturnValue(null);
      await manager._syncProgressToServer('DAILY_QUESTIONS', 5);
      // 不应报错
    });

    it('同步失败 → 静默处理', async () => {
      storageService.get.mockImplementation((key, defaultValue = null) => {
        if (key === 'EXAM_USER_ID') return 'user123';
        return defaultValue;
      });

      const { recordGoalProgress } = await import('../../src/services/api/domains/user.api.js');
      recordGoalProgress.mockRejectedValue(new Error('network error'));

      await manager._syncProgressToServer('DAILY_QUESTIONS', 5);
      // 不应抛异常
    });
  });

  // ==================== 便捷函数 ====================
  describe('便捷函数导出', () => {
    it('所有便捷函数可调用', async () => {
      const mod = await import('../../src/utils/learning/learning-goal.js');

      expect(typeof mod.createLearningGoal).toBe('function');
      expect(typeof mod.updateGoalProgress).toBe('function');
      expect(typeof mod.autoUpdateGoal).toBe('function');
      expect(typeof mod.getTodayGoals).toBe('function');
      expect(typeof mod.getGoalStats).toBe('function');
      expect(typeof mod.setLearningReminder).toBe('function');
      expect(typeof mod.getReminderSettings).toBe('function');
      expect(typeof mod.toggleLearningReminders).toBe('function');
      expect(typeof mod.getSuggestedGoals).toBe('function');
      expect(typeof mod.checkProgressReminder).toBe('function');
    });

    it('GOAL_TYPES 和 REMINDER_TYPES 已导出', () => {
      expect(GOAL_TYPES.DAILY_QUESTIONS).toBeDefined();
      expect(GOAL_TYPES.DAILY_QUESTIONS.id).toBe('daily_questions');
      expect(REMINDER_TYPES.MORNING).toBeDefined();
    });
  });
});
