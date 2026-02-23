/**
 * 自适应学习引擎
 * 基于遗忘曲线和知识图谱，智能推荐复习题目
 */

import storageService from '@/services/storageService.js';

/**
 * 计算记忆保持率（基于艾宾浩斯遗忘曲线简化模型）
 */
function _calcRetention(lastTime, reviewCount = 0) {
  const elapsed = (Date.now() - lastTime) / (1000 * 60 * 60 * 24); // 天数
  const stability = 1 + reviewCount * 0.5;
  return Math.exp(-elapsed / stability);
}

class AdaptiveLearningEngine {
  constructor() {
    this.isInitialized = false;
    this.mistakeBook = [];
    this.learningHistory = [];
    this.knowledgeMap = {};
    this.reviewSchedule = [];
  }

  init() {
    if (this.isInitialized) return;
    this._loadMistakeBook();
    this._loadLearningHistory();
    this.isInitialized = true;
  }

  _loadMistakeBook() {
    try {
      this.mistakeBook = storageService.get('mistake_book', []);
    } catch (_e) {
      this.mistakeBook = [];
    }
  }

  _loadLearningHistory() {
    try {
      this.learningHistory = storageService.get('learning_history', []);
    } catch (_e) {
      this.learningHistory = [];
    }
  }

  _save() {
    try {
      storageService.save('mistake_book', this.mistakeBook);
      storageService.save('learning_history', this.learningHistory);
    } catch (_e) {
      // 静默
    }
  }
}

// 单例
const adaptiveLearningEngine = new AdaptiveLearningEngine();

/**
 * 生成自适应题目序列
 */
function generateAdaptiveSequence(questions, options = {}) {
  if (!questions || !Array.isArray(questions) || questions.length === 0) return [];

  adaptiveLearningEngine.init();

  const { insertReviewQuestions = true, prioritizeWeak = true } = options || {};

  if (!insertReviewQuestions && !prioritizeWeak) {
    return [...questions];
  }

  // 简单实现：返回原始序列（无错题本时不插入复习题）
  const result = [...questions];
  return result;
}

/**
 * 获取需要复习的题目
 */
function getReviewQuestions(limit = 10) {
  adaptiveLearningEngine.init();

  const candidates = adaptiveLearningEngine.mistakeBook
    .filter((m) => !m.is_mastered)
    .map((m) => {
      const lastTime = m.last_wrong_time || m.last_review_time || m.created_at || Date.now();
      const retention = _calcRetention(lastTime, m.review_count || 0);
      const priority = (1 - retention) * (m.wrong_count || 1);
      return { ...m, retention, priority };
    })
    .filter((m) => m.retention < 0.9)
    .sort((a, b) => b.priority - a.priority);

  return candidates.slice(0, limit);
}

/**
 * 获取下一道推荐题目
 */
function getNextRecommendedQuestion(currentIndex, questions) {
  if (!questions || currentIndex >= questions.length - 1) return null;

  adaptiveLearningEngine.init();

  // 每5题插入一道复习题
  const isReviewPosition = (currentIndex + 1) % 5 === 0;

  if (isReviewPosition) {
    const reviewQuestions = getReviewQuestions(1);
    if (reviewQuestions.length > 0) {
      const reviewQ = { ...reviewQuestions[0], _isReview: true };
      return {
        isReview: true,
        question: reviewQ,
        reason: '根据遗忘曲线，建议复习此题'
      };
    }
  }

  return {
    isReview: false,
    question: questions[currentIndex + 1]
  };
}

/**
 * 记录答题结果
 */
function recordAnswer(question, isCorrect, timeSpent) {
  adaptiveLearningEngine.init();

  const record = {
    questionId: question?.id || '',
    category: question?.category || '',
    isCorrect,
    timeSpent,
    timestamp: Date.now()
  };

  adaptiveLearningEngine.learningHistory.push(record);

  // 更新知识图谱
  if (record.category) {
    if (!adaptiveLearningEngine.knowledgeMap[record.category]) {
      adaptiveLearningEngine.knowledgeMap[record.category] = { total: 0, correct: 0, lastPractice: 0 };
    }
    const kp = adaptiveLearningEngine.knowledgeMap[record.category];
    kp.total++;
    if (isCorrect) kp.correct++;
    kp.lastPractice = Date.now();
  }

  // 答错加入复习计划
  if (!isCorrect) {
    adaptiveLearningEngine.reviewSchedule.push({
      questionId: record.questionId,
      scheduledTime: Date.now() + 24 * 60 * 60 * 1000
    });
  }
}

/**
 * 获取薄弱知识点
 */
function getWeakKnowledgePoints() {
  adaptiveLearningEngine.init();

  const map = adaptiveLearningEngine.knowledgeMap;
  const categories = Object.keys(map);
  if (categories.length === 0) return [];

  return categories
    .map((cat) => {
      const data = map[cat];
      const accuracy = data.total > 0 ? data.correct / data.total : 0;
      return {
        category: cat,
        accuracy,
        total: data.total,
        correct: data.correct,
        recommendation: accuracy < 0.4 ? '建议重点复习' : accuracy < 0.6 ? '建议加强练习' : '继续保持'
      };
    })
    .filter((p) => p.accuracy < 0.6)
    .sort((a, b) => a.accuracy - b.accuracy);
}

/**
 * 获取学习统计
 */
function getLearningStats() {
  adaptiveLearningEngine.init();

  const history = adaptiveLearningEngine.learningHistory;
  const totalQuestions = history.length;
  const totalCorrect = history.filter((r) => r.isCorrect).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();
  const todayQuestions = history.filter((r) => r.timestamp >= todayTimestamp).length;

  const mistakeCount = adaptiveLearningEngine.mistakeBook.filter((m) => !m.is_mastered).length;
  const masteredCount = adaptiveLearningEngine.mistakeBook.filter((m) => m.is_mastered).length;

  return {
    totalQuestions,
    totalCorrect,
    overallAccuracy: totalQuestions > 0 ? ((totalCorrect / totalQuestions) * 100).toFixed(1) : 0,
    todayQuestions,
    mistakeCount,
    masteredCount
  };
}

/**
 * 记录复习结果
 */
function recordReview(mistakeId, isCorrect) {
  adaptiveLearningEngine.init();

  const mistake = adaptiveLearningEngine.mistakeBook.find((m) => m.id === mistakeId);
  if (!mistake) return;

  mistake.review_count = (mistake.review_count || 0) + 1;

  if (isCorrect) {
    mistake.mastery_level = Math.min(100, (mistake.mastery_level || 0) + 20);
  } else {
    mistake.mastery_level = Math.max(0, (mistake.mastery_level || 0) - 10);
  }

  mistake.is_mastered = mistake.mastery_level >= 80;
  mistake.last_review_time = Date.now();
}

export {
  adaptiveLearningEngine,
  generateAdaptiveSequence,
  getReviewQuestions,
  getNextRecommendedQuestion,
  recordAnswer,
  getWeakKnowledgePoints,
  getLearningStats,
  recordReview
};
