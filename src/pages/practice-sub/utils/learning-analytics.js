/**
 * Re-export shim — 实际实现已合并至 @/utils/analytics/learning-analytics.js
 * 请勿在此文件中添加任何逻辑。
 */
export {
  learningAnalytics,
  recordAnswer,
  getHeatmapData,
  getAccuracyTrend,
  getKnowledgePointAnalysis,
  getStreakData,
  getAchievements,
  getComprehensiveReport,
  getMultiDimensionReport,
  getLearningEfficiency,
  getProgressTrend,
  getPeerComparison,
  predictScore,
  ACHIEVEMENTS
} from '@/utils/analytics/learning-analytics.js';

export { default } from '@/utils/analytics/learning-analytics.js';
