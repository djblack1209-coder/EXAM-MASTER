/**
 * 题目质量优化器 - 提升智能生成题目的质量和多样性
 *
 * 核心功能：
 * 1. 题目格式验证和修复
 * 2. 题目去重和相似度检测
 * 3. 难度评估和标注
 * 4. 知识点自动分类
 * 5. 题目质量评分
 */

import { logger } from '@/utils/logger.js';

// 题目质量标准
const QUALITY_STANDARDS = {
  MIN_QUESTION_LENGTH: 10, // 题目最小长度
  MAX_QUESTION_LENGTH: 500, // 题目最大长度
  MIN_OPTION_LENGTH: 2, // 选项最小长度
  MAX_OPTION_LENGTH: 200, // 选项最大长度
  REQUIRED_OPTIONS: 4, // 必需选项数量
  VALID_ANSWERS: ['A', 'B', 'C', 'D'],
  SUPPORTED_TYPES: ['单选', '多选', '判断', '填空', '简答', '论述']
};

// 题型配置
const QUESTION_TYPE_CONFIGS = {
  单选: {
    minOptions: 2,
    maxOptions: 8,
    defaultOptions: 4,
    answerPattern: /^[A-H]$/
  },
  多选: {
    minOptions: 2,
    maxOptions: 8,
    defaultOptions: 4,
    answerPattern: /^[A-H]+$/
  },
  判断: {
    minOptions: 2,
    maxOptions: 2,
    defaultOptions: 2,
    answerPattern: /^(对|错|正确|错误)$/
  },
  填空: {
    minOptions: 0,
    maxOptions: 0,
    defaultOptions: 0,
    answerPattern: /.+/
  },
  简答: {
    minOptions: 0,
    maxOptions: 0,
    defaultOptions: 0,
    answerPattern: /.+/
  },
  论述: {
    minOptions: 0,
    maxOptions: 0,
    defaultOptions: 0,
    answerPattern: /.+/
  }
};

// 难度关键词
const DIFFICULTY_KEYWORDS = {
  easy: ['是什么', '定义', '概念', '基本', '简单', '常见'],
  medium: ['区别', '比较', '分析', '说明', '特点', '作用'],
  hard: ['综合', '评价', '论述', '深入', '复杂', '辩证']
};

// 知识点关键词映射
const CATEGORY_KEYWORDS = {
  马克思主义哲学: ['唯物', '辩证', '认识论', '实践', '矛盾', '否定'],
  毛泽东思想: ['新民主主义', '革命', '毛泽东', '农村包围城市'],
  中国特色社会主义: ['改革开放', '社会主义市场', '中国特色', '新时代'],
  线性代数: ['矩阵', '行列式', '向量', '特征值', '线性方程'],
  高等数学: ['极限', '导数', '积分', '微分', '级数'],
  概率论: ['概率', '分布', '期望', '方差', '随机变量'],
  英语: ['grammar', 'vocabulary', 'reading', 'writing']
};

/**
 * 题目质量优化器
 */
class QuestionQualityOptimizer {
  constructor() {
    this.questionHashes = new Set();
  }

  /**
   * 优化题目列表
   * @param {Array} questions - 原始题目列表
   * @param {Object} options - 配置选项
   * @returns {Array} 优化后的题目列表
   */
  optimizeQuestions(questions, options = {}) {
    if (!Array.isArray(questions) || questions.length === 0) {
      return [];
    }

    const {
      removeDuplicates = true,
      fixFormat = true,
      addMetadata = true,
      filterLowQuality = true,
      minQualityScore = 60
    } = options;

    let optimized = [...questions];

    // 1. 格式修复
    if (fixFormat) {
      optimized = optimized.map((q) => this._fixQuestionFormat(q));
    }

    // 2. 去重
    if (removeDuplicates) {
      optimized = this._removeDuplicates(optimized);
    }

    // 3. 添加元数据
    if (addMetadata) {
      optimized = optimized.map((q) => this._addMetadata(q));
    }

    // 4. 质量过滤
    if (filterLowQuality) {
      optimized = optimized.filter((q) => (q._qualityScore || 0) >= minQualityScore);
    }

    logger.log('[QualityOptimizer] 优化完成:', {
      original: questions.length,
      optimized: optimized.length,
      removed: questions.length - optimized.length
    });

    return optimized;
  }

  /**
   * 验证单个题目
   * @param {Object} question - 题目对象
   * @returns {Object} 验证结果
   */
  validateQuestion(question) {
    const errors = [];
    const warnings = [];

    // 检查题目内容
    const questionText = question.question || question.title || '';
    if (!questionText) {
      errors.push('题目内容为空');
    } else if (questionText.length < QUALITY_STANDARDS.MIN_QUESTION_LENGTH) {
      warnings.push('题目内容过短');
    } else if (questionText.length > QUALITY_STANDARDS.MAX_QUESTION_LENGTH) {
      warnings.push('题目内容过长');
    }

    // 检查题型
    const type = question.type || '单选';
    if (!QUALITY_STANDARDS.SUPPORTED_TYPES.includes(type)) {
      warnings.push('题型不支持');
    }

    // 检查选项（根据题型）
    const config = QUESTION_TYPE_CONFIGS[type];
    const options = question.options || [];

    if (config.minOptions > 0) {
      if (!Array.isArray(options)) {
        errors.push('选项格式错误');
      } else if (options.length < config.minOptions) {
        errors.push(`选项数量不足，至少需要${config.minOptions}个选项`);
      } else if (options.length > config.maxOptions) {
        errors.push(`选项数量过多，最多${config.maxOptions}个选项`);
      } else {
        options.forEach((opt, idx) => {
          if (!opt || opt.length < QUALITY_STANDARDS.MIN_OPTION_LENGTH) {
            warnings.push(`选项${String.fromCharCode(65 + idx)}内容过短`);
          }
        });
      }
    }

    // 检查答案
    const answer = question.answer || question.correct_answer || question.correctAnswer || '';
    if (!answer) {
      errors.push('答案为空');
    } else if (!config.answerPattern.test(answer.toString())) {
      errors.push('答案格式错误');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: this._calculateQualityScore(question, errors, warnings)
    };
  }

  /**
   * 评估题目难度
   * @param {Object} question - 题目对象
   * @returns {Object} 难度评估结果
   */
  assessDifficulty(question) {
    const questionText = (question.question || question.title || '').toLowerCase();
    const optionsText = (question.options || []).join(' ').toLowerCase();
    const fullText = questionText + ' ' + optionsText;

    let easyScore = 0;
    let mediumScore = 0;
    let hardScore = 0;

    // 基于关键词评估
    for (const keyword of DIFFICULTY_KEYWORDS.easy) {
      if (fullText.includes(keyword)) easyScore++;
    }
    for (const keyword of DIFFICULTY_KEYWORDS.medium) {
      if (fullText.includes(keyword)) mediumScore++;
    }
    for (const keyword of DIFFICULTY_KEYWORDS.hard) {
      if (fullText.includes(keyword)) hardScore++;
    }

    // 基于文本长度评估
    const textLength = fullText.length;
    if (textLength < 100) easyScore += 2;
    else if (textLength < 200) mediumScore += 2;
    else hardScore += 2;

    // 基于选项复杂度评估
    if (question.options && question.options.length > 0) {
      const avgOptionLength =
        question.options.reduce((sum, opt) => sum + (opt || '').length, 0) / question.options.length;
      if (avgOptionLength < 20) easyScore++;
      else if (avgOptionLength < 50) mediumScore++;
      else hardScore++;
    }

    // 基于题型评估
    const type = question.type || '单选';
    if (type === '单选' || type === '判断') {
      easyScore++;
    } else if (type === '多选' || type === '填空') {
      mediumScore++;
    } else if (type === '简答' || type === '论述') {
      hardScore++;
    }

    // 确定难度等级
    let difficulty = 'medium';
    let difficultyScore = 2;

    if (hardScore > mediumScore && hardScore > easyScore) {
      difficulty = 'hard';
      difficultyScore = 3;
    } else if (easyScore > mediumScore && easyScore > hardScore) {
      difficulty = 'easy';
      difficultyScore = 1;
    }

    return {
      difficulty,
      difficultyScore,
      confidence: Math.max(easyScore, mediumScore, hardScore) / (easyScore + mediumScore + hardScore + 1),
      details: { easyScore, mediumScore, hardScore }
    };
  }

  /**
   * 自动分类题目
   * @param {Object} question - 题目对象
   * @returns {string} 分类结果
   */
  categorizeQuestion(question) {
    const questionText = (question.question || question.title || '').toLowerCase();
    const optionsText = (question.options || []).join(' ').toLowerCase();
    const fullText = questionText + ' ' + optionsText;

    let bestCategory = '未分类';
    let maxScore = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      let score = 0;
      for (const keyword of keywords) {
        if (fullText.includes(keyword.toLowerCase())) {
          score++;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  /**
   * 检测题目相似度
   * @param {Object} question1 - 题目1
   * @param {Object} question2 - 题目2
   * @returns {number} 相似度 (0-1)
   */
  calculateSimilarity(question1, question2) {
    const text1 = (question1.question || question1.title || '').toLowerCase();
    const text2 = (question2.question || question2.title || '').toLowerCase();

    if (!text1 || !text2) return 0;

    // 简单的Jaccard相似度
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * 生成题目摘要
   * @param {Object} question - 题目对象
   * @returns {string} 摘要
   */
  generateSummary(question) {
    const questionText = question.question || question.title || '';
    const maxLength = 50;

    if (questionText.length <= maxLength) {
      return questionText;
    }

    return questionText.substring(0, maxLength - 3) + '...';
  }

  // ==================== 私有方法 ====================

  /**
   * 修复题目格式
   */
  _fixQuestionFormat(question) {
    const fixed = { ...question };

    // 修复题目内容
    fixed.question = (fixed.question || fixed.title || '').trim();
    delete fixed.title;

    // 修复题型
    fixed.type = fixed.type || '单选';
    if (!QUALITY_STANDARDS.SUPPORTED_TYPES.includes(fixed.type)) {
      fixed.type = '单选';
    }

    const config = QUESTION_TYPE_CONFIGS[fixed.type];

    // 修复选项
    if (config.minOptions > 0) {
      if (Array.isArray(fixed.options)) {
        fixed.options = fixed.options.map((opt, idx) => {
          if (!opt) return `${String.fromCharCode(65 + idx)}. 选项${idx + 1}`;

          // 确保选项有标签
          const optStr = opt.toString().trim();
          if (!optStr.match(/^[A-Z]\./i)) {
            return `${String.fromCharCode(65 + idx)}. ${optStr}`;
          }
          return optStr;
        });

        // 确保选项数量符合要求
        while (fixed.options.length < config.defaultOptions) {
          const idx = fixed.options.length;
          fixed.options.push(`${String.fromCharCode(65 + idx)}. 选项${idx + 1}`);
        }
      } else {
        fixed.options = [];
        for (let i = 0; i < config.defaultOptions; i++) {
          fixed.options.push(`${String.fromCharCode(65 + i)}. 选项${i + 1}`);
        }
      }
    } else {
      delete fixed.options;
    }

    // 修复答案
    let answer = (fixed.answer || fixed.correct_answer || fixed.correctAnswer || '').toString().trim();

    if (fixed.type === '单选' && /^[0-3]$/.test(answer)) {
      answer = String.fromCharCode(65 + parseInt(answer));
    }

    fixed.answer = answer;
    delete fixed.correct_answer;
    delete fixed.correctAnswer;

    // 修复解析
    fixed.desc = fixed.desc || fixed.analysis || fixed.explanation || '';
    delete fixed.analysis;
    delete fixed.explanation;

    // 修复来源
    fixed.source = fixed.source || this.annotateSource(fixed);

    return fixed;
  }

  /**
   * 去除重复题目
   */
  _removeDuplicates(questions) {
    const seen = new Set();
    const unique = [];

    for (const question of questions) {
      const hash = this._generateQuestionHash(question);

      if (!seen.has(hash)) {
        seen.add(hash);
        unique.push(question);
      }
    }

    return unique;
  }

  /**
   * 生成题目哈希
   */
  _generateQuestionHash(question) {
    const text = (question.question || question.title || '').toLowerCase();
    const options = (question.options || []).join('').toLowerCase();

    // 简单哈希：取前50个字符 + 选项
    return (text.substring(0, 50) + options.substring(0, 50)).replace(/\s/g, '');
  }

  /**
   * 标注题目来源
   * @param {Object} question - 题目对象
   * @returns {string} 题目来源
   */
  annotateSource(question) {
    if (question.source) {
      return question.source;
    }

    // 基于题目特征推断来源
    const questionText = (question.question || '').toLowerCase();

    if (questionText.includes('真题') || question.year) {
      return question.year ? `${question.year}真题` : '历年真题';
    } else if (questionText.includes('模拟') || questionText.includes('练习')) {
      return '模拟题';
    } else if (questionText.includes('预测') || questionText.includes('押题')) {
      return '预测题';
    } else {
      return '练习题';
    }
  }

  /**
   * 添加元数据
   */
  _addMetadata(question) {
    const validation = this.validateQuestion(question);
    const difficulty = this.assessDifficulty(question);
    const category = question.category || this.categorizeQuestion(question);

    return {
      ...question,
      category,
      difficulty: difficulty.difficulty,
      _difficultyScore: difficulty.difficultyScore,
      _qualityScore: validation.score,
      _isValid: validation.isValid,
      _warnings: validation.warnings,
      _summary: this.generateSummary(question),
      _source: this.annotateSource(question)
    };
  }

  /**
   * 计算质量分数
   */
  _calculateQualityScore(question, errors, warnings) {
    let score = 100;

    // 错误扣分
    score -= errors.length * 30;

    // 警告扣分
    score -= warnings.length * 10;

    // 内容质量加分
    const questionText = question.question || question.title || '';
    if (questionText.length >= 20 && questionText.length <= 300) {
      score += 5;
    }

    // 有解析加分
    if (question.desc || question.analysis) {
      score += 10;
    }

    // 有分类加分
    if (question.category && question.category !== '未分类') {
      score += 5;
    }

    // 有来源加分
    if (question.source && question.source !== '练习题') {
      score += 5;
    }

    // 题型多样性加分
    if (['多选', '简答', '论述'].includes(question.type)) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }
}

// 创建单例
export const questionQualityOptimizer = new QuestionQualityOptimizer();

// 便捷函数
export function optimizeQuestions(questions, options) {
  return questionQualityOptimizer.optimizeQuestions(questions, options);
}

export function validateQuestion(question) {
  return questionQualityOptimizer.validateQuestion(question);
}

export function assessDifficulty(question) {
  return questionQualityOptimizer.assessDifficulty(question);
}

export function categorizeQuestion(question) {
  return questionQualityOptimizer.categorizeQuestion(question);
}

export function calculateSimilarity(q1, q2) {
  return questionQualityOptimizer.calculateSimilarity(q1, q2);
}

export function annotateSource(question) {
  return questionQualityOptimizer.annotateSource(question);
}

export default questionQualityOptimizer;
