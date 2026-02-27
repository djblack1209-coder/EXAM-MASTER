/**
 * Re-export shim - 实际实现已合并至 @/utils/learning/adaptive-learning-engine.js
 * 请勿在此文件中添加任何逻辑。
 */
export {
  adaptiveLearningEngine,
  generateAdaptiveSequence,
  getReviewQuestions,
  getNextRecommendedQuestion,
  recordAnswer,
  getWeakKnowledgePoints,
  getLearningStats,
  recordReview
} from '@/utils/learning/adaptive-learning-engine.js';

export { default } from '@/utils/learning/adaptive-learning-engine.js';
