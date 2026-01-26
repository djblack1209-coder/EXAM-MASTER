/**
 * 自适应学习引擎 - 检查点 5.3
 * 基于遗忘曲线的智能抽题算法
 * 
 * 核心功能：
 * 1. 艾宾浩斯遗忘曲线计算
 * 2. 错题智能插入（第5、10题自动插入复习题）
 * 3. 知识点薄弱分析
 * 4. 个性化学习路径推荐
 */

// 存储键名
const STORAGE_KEYS = {
  MISTAKE_BOOK: 'mistake_book',
  LEARNING_HISTORY: 'adaptive_learning_history',
  KNOWLEDGE_MAP: 'adaptive_knowledge_map',
  REVIEW_SCHEDULE: 'adaptive_review_schedule'
};

// 艾宾浩斯遗忘曲线复习间隔（小时）
const EBBINGHAUS_INTERVALS = [
  0.33,    // 20分钟
  1,       // 1小时
  8,       // 8小时
  24,      // 1天
  48,      // 2天
  168,     // 7天
  360,     // 15天
  720      // 30天
];

// 记忆保持率阈值
const RETENTION_THRESHOLD = 0.6; // 低于60%需要复习

// 复习题插入位置
const REVIEW_INSERT_POSITIONS = [5, 10, 15, 20, 25]; // 第5、10、15、20、25题后插入复习题

/**
 * 自适应学习引擎
 */
class AdaptiveLearningEngine {
  constructor() {
    this.mistakeBook = [];
    this.learningHistory = [];
    this.knowledgeMap = {};
    this.reviewSchedule = [];
    this.isInitialized = false;
  }

  /**
   * 初始化引擎
   */
  init() {
    if (this.isInitialized) return;

    this._loadMistakeBook();
    this._loadLearningHistory();
    this._loadKnowledgeMap();
    this._loadReviewSchedule();

    this.isInitialized = true;
    console.log('[AdaptiveLearning] 初始化完成，错题数:', this.mistakeBook.length);
  }

  /**
   * 生成自适应题目序列
   * @param {Array} originalQuestions - 原始题目列表
   * @param {Object} options - 配置选项
   * @returns {Array} 优化后的题目序列
   */
  generateAdaptiveSequence(originalQuestions, options = {}) {
    this.init();

    const {
      insertReviewQuestions = true,  // 是否插入复习题
      prioritizeWeak = true,         // 是否优先薄弱知识点
      maxReviewRatio = 0.3           // 复习题最大占比
    } = options;

    if (!originalQuestions || originalQuestions.length === 0) {
      return [];
    }

    let sequence = [...originalQuestions];

    // 1. 如果启用薄弱知识点优先，重新排序
    if (prioritizeWeak) {
      sequence = this._prioritizeWeakKnowledge(sequence);
    }

    // 2. 如果启用复习题插入，在指定位置插入
    if (insertReviewQuestions) {
      sequence = this._insertReviewQuestions(sequence, maxReviewRatio);
    }

    console.log('[AdaptiveLearning] 生成自适应序列，原始:', originalQuestions.length, '优化后:', sequence.length);

    return sequence;
  }

  /**
   * 获取需要复习的题目
   * @param {number} limit - 最大数量
   * @returns {Array} 需要复习的题目列表
   */
  getReviewQuestions(limit = 10) {
    this.init();

    const now = Date.now();
    const reviewNeeded = [];

    for (const mistake of this.mistakeBook) {
      // 跳过已掌握的题目
      if (mistake.is_mastered) continue;

      // 计算记忆保持率
      const retention = this._calculateRetention(mistake);

      // 低于阈值需要复习
      if (retention < RETENTION_THRESHOLD) {
        reviewNeeded.push({
          ...mistake,
          retention: retention,
          priority: this._calculateReviewPriority(mistake, retention)
        });
      }
    }

    // 按优先级排序
    reviewNeeded.sort((a, b) => b.priority - a.priority);

    return reviewNeeded.slice(0, limit);
  }

  /**
   * 获取下一道推荐题目
   * @param {number} currentIndex - 当前题目索引
   * @param {Array} questions - 题目列表
   * @returns {Object|null} 推荐的下一道题目
   */
  getNextRecommendedQuestion(currentIndex, questions) {
    this.init();

    // 检查是否应该插入复习题
    if (REVIEW_INSERT_POSITIONS.includes(currentIndex + 1)) {
      const reviewQuestion = this._getReviewQuestionForInsert();
      if (reviewQuestion) {
        console.log('[AdaptiveLearning] 在第', currentIndex + 1, '题后插入复习题');
        return {
          question: reviewQuestion,
          isReview: true,
          reason: '根据遗忘曲线，这道题需要复习'
        };
      }
    }

    // 返回原序列的下一题
    if (currentIndex + 1 < questions.length) {
      return {
        question: questions[currentIndex + 1],
        isReview: false,
        reason: null
      };
    }

    return null;
  }

  /**
   * 记录答题结果
   * @param {Object} question - 题目
   * @param {boolean} isCorrect - 是否正确
   * @param {number} timeSpent - 用时（毫秒）
   */
  recordAnswer(question, isCorrect, timeSpent = 0) {
    this.init();

    const record = {
      questionId: question.id || question.question,
      category: question.category || '未分类',
      isCorrect: isCorrect,
      timeSpent: timeSpent,
      timestamp: Date.now()
    };

    // 添加到学习历史
    this.learningHistory.push(record);
    this._saveLearningHistory();

    // 更新知识图谱
    this._updateKnowledgeMap(question, isCorrect);

    // 如果答错，更新错题本中的复习计划
    if (!isCorrect) {
      this._updateReviewSchedule(question);
    }

    // 如果答对复习题，更新掌握度
    if (isCorrect && question._isReview) {
      this._updateMasteryLevel(question);
    }
  }

  /**
   * 获取知识点薄弱分析
   * @returns {Array} 薄弱知识点列表
   */
  getWeakKnowledgePoints() {
    this.init();

    const weakPoints = [];

    for (const [category, data] of Object.entries(this.knowledgeMap)) {
      const accuracy = data.correct / (data.total || 1);
      
      if (accuracy < 0.6) { // 正确率低于60%
        weakPoints.push({
          category: category,
          accuracy: accuracy,
          totalQuestions: data.total,
          wrongCount: data.total - data.correct,
          lastPractice: data.lastPractice,
          recommendation: this._getRecommendation(accuracy)
        });
      }
    }

    // 按正确率升序排序（最薄弱的在前）
    weakPoints.sort((a, b) => a.accuracy - b.accuracy);

    return weakPoints;
  }

  /**
   * 获取学习统计
   * @returns {Object} 学习统计数据
   */
  getLearningStats() {
    this.init();

    const today = new Date().toISOString().split('T')[0];
    const todayRecords = this.learningHistory.filter(r => 
      new Date(r.timestamp).toISOString().split('T')[0] === today
    );

    const totalCorrect = this.learningHistory.filter(r => r.isCorrect).length;
    const totalQuestions = this.learningHistory.length;

    return {
      totalQuestions: totalQuestions,
      totalCorrect: totalCorrect,
      overallAccuracy: totalQuestions > 0 ? (totalCorrect / totalQuestions * 100).toFixed(1) : 0,
      todayQuestions: todayRecords.length,
      todayCorrect: todayRecords.filter(r => r.isCorrect).length,
      todayAccuracy: todayRecords.length > 0 
        ? (todayRecords.filter(r => r.isCorrect).length / todayRecords.length * 100).toFixed(1) 
        : 0,
      mistakeCount: this.mistakeBook.filter(m => !m.is_mastered).length,
      masteredCount: this.mistakeBook.filter(m => m.is_mastered).length,
      weakPointsCount: this.getWeakKnowledgePoints().length
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 计算记忆保持率（艾宾浩斯遗忘曲线）
   * @param {Object} mistake - 错题记录
   * @returns {number} 记忆保持率 (0-1)
   */
  _calculateRetention(mistake) {
    const now = Date.now();
    const lastReview = mistake.last_review_time || mistake.last_wrong_time || mistake.created_at;
    const timeSinceReview = (now - new Date(lastReview).getTime()) / (1000 * 60 * 60); // 小时

    // 复习次数影响遗忘速度
    const reviewCount = mistake.review_count || 0;
    const stabilityFactor = 1 + reviewCount * 0.5; // 复习越多，遗忘越慢

    // 艾宾浩斯遗忘曲线公式：R = e^(-t/S)
    // R: 记忆保持率, t: 时间, S: 记忆稳定性
    const retention = Math.exp(-timeSinceReview / (24 * stabilityFactor));

    return Math.max(0, Math.min(1, retention));
  }

  /**
   * 计算复习优先级
   * @param {Object} mistake - 错题记录
   * @param {number} retention - 记忆保持率
   * @returns {number} 优先级分数
   */
  _calculateReviewPriority(mistake, retention) {
    let priority = 0;

    // 1. 记忆保持率越低，优先级越高
    priority += (1 - retention) * 50;

    // 2. 错误次数越多，优先级越高
    const wrongCount = mistake.wrong_count || 1;
    priority += Math.min(wrongCount * 5, 25);

    // 3. 最近错误的题目优先级更高
    const daysSinceLastWrong = (Date.now() - (mistake.last_wrong_time || Date.now())) / (1000 * 60 * 60 * 24);
    if (daysSinceLastWrong < 1) {
      priority += 15;
    } else if (daysSinceLastWrong < 3) {
      priority += 10;
    }

    // 4. 复习次数少的优先
    const reviewCount = mistake.review_count || 0;
    priority += Math.max(0, 10 - reviewCount * 2);

    return priority;
  }

  /**
   * 优先薄弱知识点
   * @param {Array} questions - 题目列表
   * @returns {Array} 重新排序的题目列表
   */
  _prioritizeWeakKnowledge(questions) {
    const weakPoints = this.getWeakKnowledgePoints();
    const weakCategories = new Set(weakPoints.map(w => w.category));

    // 分离薄弱知识点题目和其他题目
    const weakQuestions = questions.filter(q => weakCategories.has(q.category));
    const otherQuestions = questions.filter(q => !weakCategories.has(q.category));

    // 交替排列：每3道普通题后插入1道薄弱题
    const result = [];
    let weakIndex = 0;
    let otherIndex = 0;

    while (otherIndex < otherQuestions.length || weakIndex < weakQuestions.length) {
      // 添加3道普通题
      for (let i = 0; i < 3 && otherIndex < otherQuestions.length; i++) {
        result.push(otherQuestions[otherIndex++]);
      }
      // 添加1道薄弱题
      if (weakIndex < weakQuestions.length) {
        result.push(weakQuestions[weakIndex++]);
      }
    }

    return result;
  }

  /**
   * 插入复习题
   * @param {Array} questions - 题目列表
   * @param {number} maxRatio - 最大复习题占比
   * @returns {Array} 插入复习题后的列表
   */
  _insertReviewQuestions(questions, maxRatio) {
    const reviewQuestions = this.getReviewQuestions(Math.floor(questions.length * maxRatio));
    
    if (reviewQuestions.length === 0) {
      return questions;
    }

    const result = [...questions];
    let reviewIndex = 0;

    // 在指定位置插入复习题
    for (const position of REVIEW_INSERT_POSITIONS) {
      if (position <= result.length && reviewIndex < reviewQuestions.length) {
        const reviewQ = {
          ...reviewQuestions[reviewIndex],
          _isReview: true,
          _reviewReason: `遗忘曲线提示：记忆保持率 ${(reviewQuestions[reviewIndex].retention * 100).toFixed(0)}%`
        };
        result.splice(position, 0, reviewQ);
        reviewIndex++;
      }
    }

    return result;
  }

  /**
   * 获取用于插入的复习题
   * @returns {Object|null} 复习题
   */
  _getReviewQuestionForInsert() {
    const reviewQuestions = this.getReviewQuestions(1);
    
    if (reviewQuestions.length > 0) {
      return {
        ...reviewQuestions[0],
        _isReview: true,
        _reviewReason: `遗忘曲线提示：这道题需要复习（记忆保持率 ${(reviewQuestions[0].retention * 100).toFixed(0)}%）`
      };
    }

    return null;
  }

  /**
   * 更新知识图谱
   * @param {Object} question - 题目
   * @param {boolean} isCorrect - 是否正确
   */
  _updateKnowledgeMap(question, isCorrect) {
    const category = question.category || '未分类';

    if (!this.knowledgeMap[category]) {
      this.knowledgeMap[category] = {
        total: 0,
        correct: 0,
        lastPractice: null
      };
    }

    this.knowledgeMap[category].total++;
    if (isCorrect) {
      this.knowledgeMap[category].correct++;
    }
    this.knowledgeMap[category].lastPractice = Date.now();

    this._saveKnowledgeMap();
  }

  /**
   * 更新复习计划
   * @param {Object} question - 题目
   */
  _updateReviewSchedule(question) {
    const questionId = question.id || question.question;
    
    // 查找现有计划
    let schedule = this.reviewSchedule.find(s => s.questionId === questionId);
    
    if (!schedule) {
      schedule = {
        questionId: questionId,
        question: question,
        reviewStage: 0,
        nextReviewTime: Date.now() + EBBINGHAUS_INTERVALS[0] * 60 * 60 * 1000
      };
      this.reviewSchedule.push(schedule);
    } else {
      // 答错了，重置复习阶段
      schedule.reviewStage = 0;
      schedule.nextReviewTime = Date.now() + EBBINGHAUS_INTERVALS[0] * 60 * 60 * 1000;
    }

    this._saveReviewSchedule();
  }

  /**
   * 更新掌握度
   * @param {Object} question - 题目
   */
  _updateMasteryLevel(question) {
    const questionId = question.id || question.question;
    
    // 更新错题本中的掌握度
    const mistakeIndex = this.mistakeBook.findIndex(m => 
      m.id === questionId || m.question === questionId || m.question_content === questionId
    );

    if (mistakeIndex >= 0) {
      const mistake = this.mistakeBook[mistakeIndex];
      mistake.review_count = (mistake.review_count || 0) + 1;
      mistake.last_review_time = Date.now();
      mistake.mastery_level = Math.min(100, (mistake.mastery_level || 0) + 20);

      if (mistake.mastery_level >= 80) {
        mistake.is_mastered = true;
      }

      // 保存到本地
      uni.setStorageSync(STORAGE_KEYS.MISTAKE_BOOK, this.mistakeBook);
    }

    // 更新复习计划
    const scheduleIndex = this.reviewSchedule.findIndex(s => s.questionId === questionId);
    if (scheduleIndex >= 0) {
      const schedule = this.reviewSchedule[scheduleIndex];
      schedule.reviewStage = Math.min(schedule.reviewStage + 1, EBBINGHAUS_INTERVALS.length - 1);
      schedule.nextReviewTime = Date.now() + EBBINGHAUS_INTERVALS[schedule.reviewStage] * 60 * 60 * 1000;
      this._saveReviewSchedule();
    }
  }

  /**
   * 获取学习建议
   * @param {number} accuracy - 正确率
   * @returns {string} 建议
   */
  _getRecommendation(accuracy) {
    if (accuracy < 0.3) {
      return '建议重新学习基础概念，多做相关练习';
    } else if (accuracy < 0.5) {
      return '建议加强练习，注意总结错题规律';
    } else {
      return '继续保持，适当复习巩固';
    }
  }

  // ==================== 数据加载/保存 ====================

  _loadMistakeBook() {
    try {
      this.mistakeBook = uni.getStorageSync(STORAGE_KEYS.MISTAKE_BOOK) || [];
    } catch (e) {
      this.mistakeBook = [];
    }
  }

  _loadLearningHistory() {
    try {
      this.learningHistory = uni.getStorageSync(STORAGE_KEYS.LEARNING_HISTORY) || [];
    } catch (e) {
      this.learningHistory = [];
    }
  }

  _saveLearningHistory() {
    try {
      // 只保留最近1000条记录
      if (this.learningHistory.length > 1000) {
        this.learningHistory = this.learningHistory.slice(-1000);
      }
      uni.setStorageSync(STORAGE_KEYS.LEARNING_HISTORY, this.learningHistory);
    } catch (e) {
      console.error('[AdaptiveLearning] 保存学习历史失败:', e);
    }
  }

  _loadKnowledgeMap() {
    try {
      this.knowledgeMap = uni.getStorageSync(STORAGE_KEYS.KNOWLEDGE_MAP) || {};
    } catch (e) {
      this.knowledgeMap = {};
    }
  }

  _saveKnowledgeMap() {
    try {
      uni.setStorageSync(STORAGE_KEYS.KNOWLEDGE_MAP, this.knowledgeMap);
    } catch (e) {
      console.error('[AdaptiveLearning] 保存知识图谱失败:', e);
    }
  }

  _loadReviewSchedule() {
    try {
      this.reviewSchedule = uni.getStorageSync(STORAGE_KEYS.REVIEW_SCHEDULE) || [];
    } catch (e) {
      this.reviewSchedule = [];
    }
  }

  _saveReviewSchedule() {
    try {
      uni.setStorageSync(STORAGE_KEYS.REVIEW_SCHEDULE, this.reviewSchedule);
    } catch (e) {
      console.error('[AdaptiveLearning] 保存复习计划失败:', e);
    }
  }
}

// 创建单例
export const adaptiveLearningEngine = new AdaptiveLearningEngine();

// 便捷函数
export function generateAdaptiveSequence(questions, options) {
  return adaptiveLearningEngine.generateAdaptiveSequence(questions, options);
}

export function getReviewQuestions(limit) {
  return adaptiveLearningEngine.getReviewQuestions(limit);
}

export function getNextRecommendedQuestion(currentIndex, questions) {
  return adaptiveLearningEngine.getNextRecommendedQuestion(currentIndex, questions);
}

export function recordAnswer(question, isCorrect, timeSpent) {
  return adaptiveLearningEngine.recordAnswer(question, isCorrect, timeSpent);
}

export function getWeakKnowledgePoints() {
  return adaptiveLearningEngine.getWeakKnowledgePoints();
}

export function getLearningStats() {
  return adaptiveLearningEngine.getLearningStats();
}

/**
 * 记录复习结果（便捷函数）
 * @param {string} mistakeId - 错题ID
 * @param {boolean} isCorrect - 是否正确
 */
export function recordReview(mistakeId, isCorrect) {
  adaptiveLearningEngine.init();
  
  // 在错题本中查找对应题目
  const mistake = adaptiveLearningEngine.mistakeBook.find(m => 
    m.id === mistakeId || m._id === mistakeId
  );
  
  if (mistake) {
    // 更新复习次数和时间
    mistake.review_count = (mistake.review_count || 0) + 1;
    mistake.last_review_time = Date.now();
    
    if (isCorrect) {
      // 答对了，增加掌握度
      mistake.mastery_level = Math.min(100, (mistake.mastery_level || 0) + 20);
      if (mistake.mastery_level >= 80) {
        mistake.is_mastered = true;
      }
    } else {
      // 答错了，降低掌握度
      mistake.mastery_level = Math.max(0, (mistake.mastery_level || 0) - 10);
      mistake.is_mastered = false;
    }
    
    // 保存到本地存储
    try {
      uni.setStorageSync(STORAGE_KEYS.MISTAKE_BOOK, adaptiveLearningEngine.mistakeBook);
      console.log('[AdaptiveLearning] 复习记录已保存:', mistakeId, isCorrect ? '正确' : '错误');
    } catch (e) {
      console.error('[AdaptiveLearning] 保存复习记录失败:', e);
    }
  } else {
    console.warn('[AdaptiveLearning] 未找到错题:', mistakeId);
  }
}

export default adaptiveLearningEngine;
