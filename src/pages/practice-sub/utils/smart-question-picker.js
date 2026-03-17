/**
 * 智能组题算法 - 智能刷题功能增强
 *
 * 核心功能：
 * 1. 基于用户画像的个性化组题
 * 2. 难度自适应调整
 * 3. 知识点覆盖优化
 * 4. 时间感知的题目推荐
 * 5. 学习效率最大化
 */

import {
  adaptiveLearningEngine,
  getWeakKnowledgePoints,
  getLearningStats
} from '../../../utils/learning/adaptive-learning-engine.js';
import storageService from '@/services/storageService.js';
import { logger } from '@/utils/logger.js';

// 难度等级定义
const _DIFFICULTY_LEVELS = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
  EXPERT: 4
};

// 用户能力等级
const ABILITY_LEVELS = {
  BEGINNER: { min: 0, max: 40, targetDifficulty: 1.5 },
  INTERMEDIATE: { min: 40, max: 60, targetDifficulty: 2.0 },
  ADVANCED: { min: 60, max: 80, targetDifficulty: 2.5 },
  EXPERT: { min: 80, max: 101, targetDifficulty: 3.0 }
};

// 存储键名
const STORAGE_KEYS = {
  USER_PROFILE: 'smart_picker_user_profile',
  QUESTION_HISTORY: 'smart_picker_question_history',
  PERFORMANCE_METRICS: 'smart_picker_performance'
};

/**
 * 智能组题器
 */
class SmartQuestionPicker {
  constructor() {
    this.userProfile = null;
    this.questionHistory = [];
    this.performanceMetrics = {};
    this.isInitialized = false;
  }

  /**
   * 初始化
   */
  init() {
    if (this.isInitialized) return;

    this._loadUserProfile();
    this._loadQuestionHistory();
    this._loadPerformanceMetrics();

    this.isInitialized = true;
    logger.log('[SmartPicker] 初始化完成');
  }

  /**
   * 智能选题 - 核心算法
   * @param {Array} questionBank - 题库
   * @param {Object} options - 配置选项
   * @returns {Array} 优化后的题目序列
   */
  pickQuestions(questionBank, options = {}) {
    this.init();

    const {
      count = 10,
      mode = 'adaptive',
      categories: _categories = [],
      difficultyRange: _difficultyRange = null,
      timeLimit: _timeLimit = null,
      includeReview = true,
      reviewRatio = 0.2
    } = options;

    if (!questionBank || questionBank.length === 0) {
      logger.warn('[SmartPicker] 题库为空');
      return [];
    }

    // 1. 预处理题目（添加元数据）
    const processedQuestions = this._preprocessQuestions(questionBank);

    // 2. 根据模式选择策略
    let selectedQuestions = [];
    switch (mode) {
      case 'adaptive':
        selectedQuestions = this._adaptivePick(processedQuestions, count, options);
        break;
      case 'weak':
        selectedQuestions = this._weakPointsPick(processedQuestions, count, options);
        break;
      case 'review':
        selectedQuestions = this._reviewPick(processedQuestions, count, options);
        break;
      case 'random':
      default:
        selectedQuestions = this._randomPick(processedQuestions, count);
    }

    // 3. 插入复习题（如果启用）
    if (includeReview && mode !== 'review') {
      selectedQuestions = this._insertReviewQuestions(selectedQuestions, reviewRatio);
    }

    // 4. 优化题目顺序（难度递进）
    selectedQuestions = this._optimizeSequence(selectedQuestions);

    logger.log('[SmartPicker] 选题完成:', {
      mode,
      requested: count,
      selected: selectedQuestions.length
    });

    return selectedQuestions;
  }

  /**
   * 获取下一道推荐题目
   * @param {Object} currentQuestion - 当前题目
   * @param {boolean} wasCorrect - 当前题目是否答对
   * @param {number} timeSpent - 答题用时（毫秒）
   * @param {Array} remainingQuestions - 剩余题目
   * @returns {Object} 推荐的下一道题目
   */
  getNextQuestion(currentQuestion, wasCorrect, timeSpent, remainingQuestions) {
    this.init();

    // 更新用户画像
    this._updateUserProfile(currentQuestion, wasCorrect, timeSpent);

    if (!remainingQuestions || remainingQuestions.length === 0) {
      return null;
    }

    // 计算每道题的推荐分数
    const scoredQuestions = remainingQuestions.map((q) => ({
      question: q,
      score: this._calculateRecommendationScore(q, wasCorrect, timeSpent)
    }));

    // 按分数排序
    scoredQuestions.sort((a, b) => b.score - a.score);

    // 返回最高分的题目
    const recommended = scoredQuestions[0];

    return {
      question: recommended.question,
      reason: this._getRecommendationReason(recommended.question, wasCorrect),
      score: recommended.score
    };
  }

  /**
   * 获取用户学习报告
   * @returns {Object} 学习报告
   */
  getLearningReport() {
    this.init();

    const stats = getLearningStats();
    const weakPoints = getWeakKnowledgePoints();

    // 计算能力等级
    const abilityLevel = this._calculateAbilityLevel();

    // 计算学习趋势
    const trend = this._calculateLearningTrend();

    // 生成建议
    const recommendations = this._generateRecommendations(stats, weakPoints, trend);

    return {
      // 基础统计
      totalQuestions: stats.totalQuestions,
      totalCorrect: stats.totalCorrect,
      overallAccuracy: stats.overallAccuracy,

      // 今日数据
      todayQuestions: stats.todayQuestions,
      todayAccuracy: stats.todayAccuracy,

      // 能力评估
      abilityLevel: abilityLevel.level,
      abilityScore: abilityLevel.score,
      abilityDescription: abilityLevel.description,

      // 薄弱知识点
      weakPoints: weakPoints.slice(0, 5),
      weakPointsCount: weakPoints.length,

      // 学习趋势
      trend: trend,

      // 个性化建议
      recommendations: recommendations,

      // 预计提升
      estimatedImprovement: this._estimateImprovement(stats, weakPoints)
    };
  }

  /**
   * 更新答题记录
   * @param {Object} question - 题目
   * @param {boolean} isCorrect - 是否正确
   * @param {number} timeSpent - 用时
   */
  recordAnswer(question, isCorrect, timeSpent) {
    this.init();

    const record = {
      questionId: question.id || question.question,
      category: question.category || '未分类',
      difficulty: question.difficulty || 2,
      isCorrect,
      timeSpent,
      timestamp: Date.now()
    };

    this.questionHistory.push(record);
    this._saveQuestionHistory();

    // 更新性能指标
    this._updatePerformanceMetrics(record);
  }

  // ==================== 私有方法 ====================

  /**
   * 预处理题目
   */
  _preprocessQuestions(questions) {
    return questions.map((q, index) => {
      // 计算题目难度（如果没有）
      const difficulty = q.difficulty || this._estimateDifficulty(q);

      // 计算题目权重
      const weight = this._calculateQuestionWeight(q);

      return {
        ...q,
        _index: index,
        _difficulty: difficulty,
        _weight: weight,
        _category: q.category || '未分类',
        _lastAnswered: this._getLastAnsweredTime(q),
        _correctRate: this._getQuestionCorrectRate(q)
      };
    });
  }

  /**
   * 自适应选题
   */
  _adaptivePick(questions, count, options) {
    const userAbility = this._calculateAbilityLevel();
    const targetDifficulty = userAbility.targetDifficulty;

    // 按难度匹配度排序
    const scored = questions.map((q) => ({
      question: q,
      score: this._calculateAdaptiveScore(q, targetDifficulty, options)
    }));

    scored.sort((a, b) => b.score - a.score);

    // 选择前N道，但保证知识点覆盖
    return this._ensureCategoryCoverage(
      scored.slice(0, count * 2).map((s) => s.question),
      count
    );
  }

  /**
   * 薄弱知识点优先选题
   */
  _weakPointsPick(questions, count, _options) {
    const weakPoints = getWeakKnowledgePoints();
    const weakCategories = new Set(weakPoints.map((w) => w.category));

    // 优先选择薄弱知识点的题目
    const weakQuestions = questions.filter((q) => weakCategories.has(q._category));
    const otherQuestions = questions.filter((q) => !weakCategories.has(q._category));

    // 70%薄弱题 + 30%其他题
    const weakCount = Math.ceil(count * 0.7);
    const otherCount = count - weakCount;

    const selected = [
      ...this._randomSample(weakQuestions, weakCount),
      ...this._randomSample(otherQuestions, otherCount)
    ];

    return selected;
  }

  /**
   * 复习模式选题
   */
  _reviewPick(questions, count, _options) {
    // 获取需要复习的题目
    const reviewQuestions = adaptiveLearningEngine.getReviewQuestions(count);

    if (reviewQuestions.length >= count) {
      return reviewQuestions.slice(0, count);
    }

    // 不够则补充随机题目
    const remaining = count - reviewQuestions.length;
    const additionalQuestions = this._randomSample(
      questions.filter((q) => !reviewQuestions.find((r) => r.id === q.id)),
      remaining
    );

    return [...reviewQuestions, ...additionalQuestions];
  }

  /**
   * 随机选题
   */
  _randomPick(questions, count) {
    return this._randomSample(questions, count);
  }

  /**
   * 计算自适应分数
   */
  _calculateAdaptiveScore(question, targetDifficulty, _options) {
    let score = 100;

    // 1. 难度匹配度（越接近目标难度分数越高）
    const difficultyDiff = Math.abs(question._difficulty - targetDifficulty);
    score -= difficultyDiff * 20;

    // 2. 知识点薄弱度加分
    const weakPoints = getWeakKnowledgePoints();
    const isWeak = weakPoints.find((w) => w.category === question._category);
    if (isWeak) {
      score += (1 - isWeak.accuracy) * 30;
    }

    // 3. 最近未做过的题目加分
    const daysSinceLastAnswered = question._lastAnswered
      ? (Date.now() - question._lastAnswered) / (1000 * 60 * 60 * 24)
      : 30;
    score += Math.min(daysSinceLastAnswered, 30);

    // 4. 历史正确率低的题目加分
    if (question._correctRate !== null && question._correctRate < 0.6) {
      score += (1 - question._correctRate) * 20;
    }

    return score;
  }

  /**
   * 计算推荐分数
   */
  _calculateRecommendationScore(question, wasCorrect, timeSpent) {
    let score = 50;

    // 如果上一题答错，推荐相似难度或稍低难度的题
    if (!wasCorrect) {
      const currentDifficulty = this.userProfile?.currentDifficulty || 2;
      const difficultyDiff = Math.abs(question._difficulty - (currentDifficulty - 0.3));
      score -= difficultyDiff * 15;
    } else {
      // 答对了，可以尝试稍难的题
      const currentDifficulty = this.userProfile?.currentDifficulty || 2;
      const difficultyDiff = Math.abs(question._difficulty - (currentDifficulty + 0.2));
      score -= difficultyDiff * 10;
    }

    // 知识点多样性
    const recentCategories = this._getRecentCategories(5);
    if (!recentCategories.includes(question._category)) {
      score += 15;
    }

    // 时间因素：如果用时过长，推荐简单题
    if (timeSpent > 60000) {
      score += (3 - question._difficulty) * 10;
    }

    return score;
  }

  /**
   * 确保知识点覆盖
   */
  _ensureCategoryCoverage(questions, count) {
    const categoryMap = new Map();
    const result = [];

    // 按知识点分组
    for (const q of questions) {
      const category = q._category;
      if (!categoryMap.has(category)) {
        categoryMap.set(category, []);
      }
      categoryMap.get(category).push(q);
    }

    // 轮询选择，确保覆盖
    const categories = Array.from(categoryMap.keys());
    let categoryIndex = 0;

    while (result.length < count && result.length < questions.length) {
      const category = categories[categoryIndex % categories.length];
      const categoryQuestions = categoryMap.get(category);

      if (categoryQuestions && categoryQuestions.length > 0) {
        result.push(categoryQuestions.shift());
      }

      categoryIndex++;

      // 防止死循环
      if (categoryIndex > count * categories.length) break;
    }

    return result;
  }

  /**
   * 插入复习题
   */
  _insertReviewQuestions(questions, ratio) {
    const reviewCount = Math.floor(questions.length * ratio);
    if (reviewCount === 0) return questions;

    const reviewQuestions = adaptiveLearningEngine.getReviewQuestions(reviewCount);
    if (reviewQuestions.length === 0) return questions;

    const result = [...questions];
    const insertPositions = [5, 10, 15, 20].filter((p) => p < result.length);

    let reviewIndex = 0;
    for (const pos of insertPositions) {
      if (reviewIndex >= reviewQuestions.length) break;

      result.splice(pos + reviewIndex, 0, {
        ...reviewQuestions[reviewIndex],
        _isReview: true,
        _reviewReason: '遗忘曲线提示复习'
      });
      reviewIndex++;
    }

    return result;
  }

  /**
   * 优化题目顺序（难度递进）
   */
  _optimizeSequence(questions) {
    if (questions.length <= 3) return questions;

    // 分成三段：简单 -> 中等 -> 困难
    const sorted = [...questions].sort((a, b) => (a._difficulty || 2) - (b._difficulty || 2));

    const easyCount = Math.ceil(questions.length * 0.3);
    const hardCount = Math.ceil(questions.length * 0.3);
    const mediumCount = questions.length - easyCount - hardCount;

    const easy = sorted.slice(0, easyCount);
    const medium = sorted.slice(easyCount, easyCount + mediumCount);
    const hard = sorted.slice(easyCount + mediumCount);

    // 打乱每段内部顺序
    this._shuffle(easy);
    this._shuffle(medium);
    this._shuffle(hard);

    return [...easy, ...medium, ...hard];
  }

  /**
   * 计算用户能力等级
   */
  _calculateAbilityLevel() {
    const stats = getLearningStats();
    const accuracy = parseFloat(stats.overallAccuracy) || 0;

    for (const [level, config] of Object.entries(ABILITY_LEVELS)) {
      if (accuracy >= config.min && accuracy < config.max) {
        return {
          level,
          score: accuracy,
          targetDifficulty: config.targetDifficulty,
          description: this._getAbilityDescription(level, accuracy)
        };
      }
    }

    return {
      level: 'BEGINNER',
      score: accuracy,
      targetDifficulty: 1.5,
      description: '继续努力，打好基础'
    };
  }

  /**
   * 获取能力描述
   */
  _getAbilityDescription(level, _accuracy) {
    const descriptions = {
      BEGINNER: '基础阶段，建议多做简单题巩固基础',
      INTERMEDIATE: '进步中，可以尝试中等难度题目',
      ADVANCED: '表现优秀，可以挑战更难的题目',
      EXPERT: '学霸级别，保持状态冲刺高分'
    };
    return descriptions[level] || '继续加油';
  }

  /**
   * 计算学习趋势
   */
  _calculateLearningTrend() {
    if (this.questionHistory.length < 10) {
      return { direction: 'stable', change: 0, description: '数据不足' };
    }

    // 比较最近10题和之前10题的正确率
    const recent = this.questionHistory.slice(-10);
    const previous = this.questionHistory.slice(-20, -10);

    const recentAccuracy = recent.filter((r) => r.isCorrect).length / recent.length;
    const previousAccuracy =
      previous.length > 0 ? previous.filter((r) => r.isCorrect).length / previous.length : recentAccuracy;

    const change = recentAccuracy - previousAccuracy;

    if (change > 0.1) {
      return { direction: 'up', change, description: '进步明显，继续保持！' };
    } else if (change < -0.1) {
      return { direction: 'down', change, description: '有所下滑，建议复习巩固' };
    } else {
      return { direction: 'stable', change, description: '状态稳定' };
    }
  }

  /**
   * 生成个性化建议
   */
  _generateRecommendations(stats, weakPoints, trend) {
    const recommendations = [];

    // 基于正确率的建议
    const accuracy = parseFloat(stats.overallAccuracy) || 0;
    if (accuracy < 50) {
      recommendations.push({
        type: 'accuracy',
        priority: 'high',
        title: '提升正确率',
        content: '建议从简单题目开始，逐步提升难度',
        action: '开始基础练习'
      });
    }

    // 基于薄弱知识点的建议
    if (weakPoints.length > 0) {
      const topWeak = weakPoints[0];
      recommendations.push({
        type: 'weak_point',
        priority: 'high',
        title: `强化「${topWeak.category}」`,
        content: `该知识点正确率仅 ${(topWeak.accuracy * 100).toFixed(0)}%，建议重点练习`,
        action: '专项练习'
      });
    }

    // 基于学习趋势的建议
    if (trend.direction === 'down') {
      recommendations.push({
        type: 'trend',
        priority: 'medium',
        title: '复习巩固',
        content: '最近正确率有所下滑，建议复习错题',
        action: '复习错题'
      });
    }

    // 基于学习量的建议
    if (stats.todayQuestions < 10) {
      recommendations.push({
        type: 'quantity',
        priority: 'low',
        title: '增加练习量',
        content: `今日仅完成 ${stats.todayQuestions} 题，建议每日至少完成 20 题`,
        action: '继续刷题'
      });
    }

    return recommendations;
  }

  /**
   * 预估提升空间
   */
  _estimateImprovement(stats, weakPoints) {
    const currentAccuracy = parseFloat(stats.overallAccuracy) || 0;

    // 如果薄弱知识点提升到60%，整体能提升多少
    let potentialImprovement = 0;
    for (const weak of weakPoints) {
      const improvementPotential = (0.6 - weak.accuracy) * (weak.totalQuestions / (stats.totalQuestions || 1));
      potentialImprovement += improvementPotential * 100;
    }

    return {
      currentAccuracy: currentAccuracy,
      potentialAccuracy: Math.min(100, currentAccuracy + potentialImprovement),
      improvementPoints: potentialImprovement.toFixed(1),
      focusAreas: weakPoints.slice(0, 3).map((w) => w.category)
    };
  }

  /**
   * 更新用户画像
   */
  _updateUserProfile(question, isCorrect, timeSpent) {
    if (!this.userProfile) {
      this.userProfile = {
        currentDifficulty: 2,
        recentAccuracy: 0.5,
        averageTimePerQuestion: 30000,
        strongCategories: [],
        weakCategories: []
      };
    }

    // 更新当前难度
    if (isCorrect) {
      this.userProfile.currentDifficulty = Math.min(4, this.userProfile.currentDifficulty + 0.1);
    } else {
      this.userProfile.currentDifficulty = Math.max(1, this.userProfile.currentDifficulty - 0.2);
    }

    // 更新平均用时
    this.userProfile.averageTimePerQuestion = this.userProfile.averageTimePerQuestion * 0.9 + timeSpent * 0.1;

    this._saveUserProfile();
  }

  /**
   * 获取推荐原因
   */
  _getRecommendationReason(question, wasCorrect) {
    if (question._isReview) {
      return '这是一道复习题，帮助巩固记忆';
    }

    if (!wasCorrect) {
      return '上一题答错了，这道题难度适中，帮助恢复信心';
    }

    const weakPoints = getWeakKnowledgePoints();
    const isWeak = weakPoints.find((w) => w.category === question._category);
    if (isWeak) {
      return `「${question._category}」是你的薄弱知识点，多练习可以提升`;
    }

    return '根据你的学习情况智能推荐';
  }

  // ==================== 工具方法 ====================

  _estimateDifficulty(question) {
    // 基于题目长度和选项复杂度估算难度
    const questionLength = (question.question || '').length;
    const optionsLength = (question.options || []).reduce((sum, opt) => sum + (opt || '').length, 0);

    const totalLength = questionLength + optionsLength;

    if (totalLength < 100) return 1;
    if (totalLength < 200) return 2;
    if (totalLength < 300) return 3;
    return 4;
  }

  _calculateQuestionWeight(question) {
    let weight = 1;

    // 有解析的题目权重更高
    if (question.desc || question.analysis) {
      weight += 0.2;
    }

    // 有分类的题目权重更高
    if (question.category && question.category !== '未分类') {
      weight += 0.1;
    }

    return weight;
  }

  _getLastAnsweredTime(question) {
    const record = this.questionHistory.find((r) => r.questionId === question.id || r.questionId === question.question);
    return record ? record.timestamp : null;
  }

  _getQuestionCorrectRate(question) {
    const records = this.questionHistory.filter(
      (r) => r.questionId === question.id || r.questionId === question.question
    );

    if (records.length === 0) return null;

    return records.filter((r) => r.isCorrect).length / records.length;
  }

  _getRecentCategories(count) {
    return this.questionHistory
      .slice(-count)
      .map((r) => r.category)
      .filter((c) => c);
  }

  _randomSample(array, count) {
    const shuffled = [...array];
    this._shuffle(shuffled);
    return shuffled.slice(0, count);
  }

  _shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  _updatePerformanceMetrics(record) {
    const category = record.category;

    if (!this.performanceMetrics[category]) {
      this.performanceMetrics[category] = {
        total: 0,
        correct: 0,
        totalTime: 0
      };
    }

    this.performanceMetrics[category].total++;
    if (record.isCorrect) {
      this.performanceMetrics[category].correct++;
    }
    this.performanceMetrics[category].totalTime += record.timeSpent;

    this._savePerformanceMetrics();
  }

  // ==================== 数据持久化 ====================

  _loadUserProfile() {
    try {
      this.userProfile = storageService.get(STORAGE_KEYS.USER_PROFILE, null);
    } catch (_e) {
      this.userProfile = null;
    }
  }

  _saveUserProfile() {
    try {
      storageService.save(STORAGE_KEYS.USER_PROFILE, this.userProfile);
    } catch (_e) {
      logger.error('[SmartPicker] 保存用户画像失败:', _e);
    }
  }

  _loadQuestionHistory() {
    try {
      this.questionHistory = storageService.get(STORAGE_KEYS.QUESTION_HISTORY, []);
    } catch (_e) {
      this.questionHistory = [];
    }
  }

  _saveQuestionHistory() {
    try {
      // 只保留最近500条
      if (this.questionHistory.length > 500) {
        this.questionHistory = this.questionHistory.slice(-500);
      }
      storageService.save(STORAGE_KEYS.QUESTION_HISTORY, this.questionHistory);
    } catch (_e) {
      logger.error('[SmartPicker] 保存答题历史失败:', _e);
    }
  }

  _loadPerformanceMetrics() {
    try {
      this.performanceMetrics = storageService.get(STORAGE_KEYS.PERFORMANCE_METRICS, {});
    } catch (_e) {
      this.performanceMetrics = {};
    }
  }

  _savePerformanceMetrics() {
    try {
      storageService.save(STORAGE_KEYS.PERFORMANCE_METRICS, this.performanceMetrics);
    } catch (_e) {
      logger.error('[SmartPicker] 保存性能指标失败:', _e);
    }
  }
}

// 创建单例
export const smartQuestionPicker = new SmartQuestionPicker();

// 便捷函数
export function pickQuestions(questionBank, options) {
  return smartQuestionPicker.pickQuestions(questionBank, options);
}

export function getNextQuestion(currentQuestion, wasCorrect, timeSpent, remainingQuestions) {
  return smartQuestionPicker.getNextQuestion(currentQuestion, wasCorrect, timeSpent, remainingQuestions);
}

export function getLearningReport() {
  return smartQuestionPicker.getLearningReport();
}

export function recordSmartAnswer(question, isCorrect, timeSpent) {
  return smartQuestionPicker.recordAnswer(question, isCorrect, timeSpent);
}

export default smartQuestionPicker;
