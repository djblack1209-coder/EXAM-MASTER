/**
 * 学习目标模块 — 分包代理
 * 实际实现位于 @/utils/learning/learning-goal.js（单一数据源）
 * 本文件仅做 re-export，避免代码重复
 */
export {
  learningGoalManager,
  createLearningGoal,
  updateGoalProgress,
  autoUpdateGoal,
  getTodayGoals,
  getGoalStats,
  setLearningReminder,
  getReminderSettings,
  toggleLearningReminders,
  getSuggestedGoals,
  checkProgressReminder,
  GOAL_TYPES,
  REMINDER_TYPES
} from '@/utils/learning/learning-goal.js';

export { default } from '@/utils/learning/learning-goal.js';
