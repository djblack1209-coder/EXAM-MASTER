/**
 * 错题分类器 - 检查点2.3
 * 智能分析错题并生成分类标签
 *
 * 功能：
 * 1. 知识点提取
 * 2. 难度评估
 * 3. 错误类型识别
 * 4. 标签生成
 */

// 知识点关键词库
const KNOWLEDGE_KEYWORDS = {
  // 政治
  '马克思主义': ['马克思', '恩格斯', '唯物', '辩证法', '历史唯物主义', '剩余价值'],
  '毛泽东思想': ['毛泽东', '新民主主义', '人民民主专政', '群众路线'],
  '中国特色社会主义': ['习近平', '新时代', '中国梦', '四个全面', '五位一体'],
  '思想道德': ['道德', '价值观', '人生观', '世界观', '理想信念'],
  '法律基础': ['宪法', '法律', '法治', '权利', '义务'],

  // 英语
  '词汇': ['词汇', '单词', 'vocabulary', 'word'],
  '语法': ['语法', '时态', '从句', '主谓', 'grammar'],
  '阅读理解': ['阅读', '理解', '文章', 'reading', 'passage'],
  '写作': ['写作', '作文', '表达', 'writing', 'essay'],
  '翻译': ['翻译', 'translation', '译文'],

  // 数学
  '高等数学': ['极限', '导数', '积分', '微分', '级数'],
  '线性代数': ['矩阵', '行列式', '向量', '特征值', '线性方程'],
  '概率统计': ['概率', '统计', '分布', '期望', '方差', '随机变量'],

  // 专业课
  '计算机基础': ['算法', '数据结构', '操作系统', '网络', '数据库'],
  '经济学': ['供给', '需求', '市场', '价格', '成本', '利润'],
  '管理学': ['管理', '组织', '领导', '决策', '战略']
};

// 错误类型关键词
const _ERROR_TYPE_KEYWORDS = {
  'concept_confusion': ['概念', '定义', '含义', '理解'],
  'calculation_error': ['计算', '运算', '求解', '公式'],
  'memory_lapse': ['记忆', '背诵', '记住', '忘记'],
  'logic_error': ['逻辑', '推理', '判断', '分析'],
  'careless_mistake': ['粗心', '马虎', '看错', '漏看'],
  'knowledge_gap': ['不会', '没学', '不懂', '陌生']
};

// 难度评估因子
const DIFFICULTY_FACTORS = {
  questionLength: { weight: 0.2, threshold: { easy: 50, medium: 100, hard: 150 } },
  optionComplexity: { weight: 0.3, threshold: { easy: 20, medium: 40, hard: 60 } },
  keywordDensity: { weight: 0.3 },
  wrongRate: { weight: 0.2 }
};

/**
 * 错题分类器
 */
export const mistakeClassifier = {
  /**
   * 分类错题
   * @param {Object} question - 题目信息
   * @param {string|number} userAnswer - 用户答案
   * @returns {Object} 分类结果
   */
  async classify(question, userAnswer) {
    const questionText = question.question || question.title || '';
    const options = question.options || [];
    const correctAnswer = question.answer || '';

    // 1. 提取知识点
    const knowledgePoints = this.extractKnowledgePoints(questionText, options);

    // 2. 评估难度
    const difficulty = this.assessDifficulty(questionText, options);

    // 3. 识别错误类型
    const errorType = this.identifyErrorType(questionText, userAnswer, correctAnswer, options);

    // 4. 生成标签
    const tags = this.generateTags(knowledgePoints, difficulty, errorType, question);

    // 5. 确定分类
    const category = this.determineCategory(knowledgePoints, question);

    return {
      knowledgePoints,
      difficulty,
      errorType,
      tags,
      category,
      confidence: this.calculateConfidence(knowledgePoints, difficulty)
    };
  },

  /**
   * 提取知识点
   * @param {string} questionText - 题目文本
   * @param {Array} options - 选项
   * @returns {Array} 知识点列表
   */
  extractKnowledgePoints(questionText, options) {
    const fullText = questionText + ' ' + options.join(' ');
    const knowledgePoints = [];

    for (const [point, keywords] of Object.entries(KNOWLEDGE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (fullText.includes(keyword)) {
          if (!knowledgePoints.includes(point)) {
            knowledgePoints.push(point);
          }
          break;
        }
      }
    }

    // 如果没有匹配到，尝试从题目分类中获取
    if (knowledgePoints.length === 0) {
      knowledgePoints.push('综合知识');
    }

    return knowledgePoints.slice(0, 3); // 最多返回3个知识点
  },

  /**
   * 评估难度
   * @param {string} questionText - 题目文本
   * @param {Array} options - 选项
   * @returns {string} 难度等级：easy, medium, hard
   */
  assessDifficulty(questionText, options) {
    let score = 0;

    // 题目长度因子
    const qLength = questionText.length;
    if (qLength > DIFFICULTY_FACTORS.questionLength.threshold.hard) {
      score += 3 * DIFFICULTY_FACTORS.questionLength.weight;
    } else if (qLength > DIFFICULTY_FACTORS.questionLength.threshold.medium) {
      score += 2 * DIFFICULTY_FACTORS.questionLength.weight;
    } else {
      score += 1 * DIFFICULTY_FACTORS.questionLength.weight;
    }

    // 选项复杂度因子
    const avgOptionLength = options.reduce((sum, opt) => sum + (opt?.length || 0), 0) / Math.max(options.length, 1);
    if (avgOptionLength > DIFFICULTY_FACTORS.optionComplexity.threshold.hard) {
      score += 3 * DIFFICULTY_FACTORS.optionComplexity.weight;
    } else if (avgOptionLength > DIFFICULTY_FACTORS.optionComplexity.threshold.medium) {
      score += 2 * DIFFICULTY_FACTORS.optionComplexity.weight;
    } else {
      score += 1 * DIFFICULTY_FACTORS.optionComplexity.weight;
    }

    // 专业术语密度
    const technicalTerms = ['定理', '公式', '原理', '定义', '概念', '理论', '方法', '模型'];
    const termCount = technicalTerms.filter((term) => questionText.includes(term)).length;
    score += Math.min(termCount / 3, 1) * 3 * DIFFICULTY_FACTORS.keywordDensity.weight;

    // 归一化并返回难度等级
    const normalizedScore = score / 3;
    if (normalizedScore >= 0.7) return 'hard';
    if (normalizedScore >= 0.4) return 'medium';
    return 'easy';
  },

  /**
   * 识别错误类型
   * @param {string} questionText - 题目文本
   * @param {string|number} userAnswer - 用户答案
   * @param {string} correctAnswer - 正确答案
   * @param {Array} options - 选项
   * @returns {string} 错误类型
   */
  identifyErrorType(questionText, _userAnswer, _correctAnswer, _options) {
    // 基于题目特征推断错误类型
    const fullText = questionText.toLowerCase();

    // 检查是否是计算题
    if (/[0-9+\-*/=]/.test(questionText) || fullText.includes('计算') || fullText.includes('求')) {
      return 'calculation_error';
    }

    // 检查是否是概念题
    if (fullText.includes('概念') || fullText.includes('定义') || fullText.includes('是指')) {
      return 'concept_confusion';
    }

    // 检查是否是记忆题
    if (fullText.includes('哪一年') || fullText.includes('谁') || fullText.includes('什么时候')) {
      return 'memory_lapse';
    }

    // 检查是否是逻辑推理题
    if (fullText.includes('推断') || fullText.includes('判断') || fullText.includes('分析')) {
      return 'logic_error';
    }

    // 默认为知识盲区
    return 'knowledge_gap';
  },

  /**
   * 生成标签
   * @param {Array} knowledgePoints - 知识点
   * @param {string} difficulty - 难度
   * @param {string} errorType - 错误类型
   * @param {Object} question - 题目信息
   * @returns {Array} 标签列表
   */
  generateTags(knowledgePoints, difficulty, errorType, question) {
    const tags = [];

    // 添加知识点标签
    knowledgePoints.forEach((kp) => {
      tags.push({ type: 'knowledge', value: kp, label: kp });
    });

    // 添加难度标签
    const difficultyLabels = { easy: '简单', medium: '中等', hard: '困难' };
    tags.push({ type: 'difficulty', value: difficulty, label: difficultyLabels[difficulty] || '中等' });

    // 添加错误类型标签
    const errorTypeLabels = {
      'concept_confusion': '概念混淆',
      'calculation_error': '计算错误',
      'memory_lapse': '记忆遗忘',
      'logic_error': '逻辑错误',
      'careless_mistake': '粗心大意',
      'knowledge_gap': '知识盲区'
    };
    tags.push({ type: 'error', value: errorType, label: errorTypeLabels[errorType] || '未知' });

    // 添加题型标签
    if (question.type) {
      tags.push({ type: 'question_type', value: question.type, label: question.type });
    }

    // 添加来源标签
    if (question.source) {
      tags.push({ type: 'source', value: question.source, label: question.source });
    }

    return tags;
  },

  /**
   * 确定分类
   * @param {Array} knowledgePoints - 知识点
   * @param {Object} question - 题目信息
   * @returns {string} 分类
   */
  determineCategory(knowledgePoints, question) {
    // 优先使用题目自带的分类
    if (question.category && question.category !== '未分类') {
      return question.category;
    }

    // 根据知识点推断分类
    if (knowledgePoints.length > 0) {
      const point = knowledgePoints[0];

      // 政治类
      if (['马克思主义', '毛泽东思想', '中国特色社会主义', '思想道德', '法律基础'].includes(point)) {
        return '政治';
      }

      // 英语类
      if (['词汇', '语法', '阅读理解', '写作', '翻译'].includes(point)) {
        return '英语';
      }

      // 数学类
      if (['高等数学', '线性代数', '概率统计'].includes(point)) {
        return '数学';
      }

      // 专业课
      if (['计算机基础', '经济学', '管理学'].includes(point)) {
        return '专业课';
      }
    }

    return '综合';
  },

  /**
   * 计算分类置信度
   * @param {Array} knowledgePoints - 知识点
   * @param {string} difficulty - 难度
   * @returns {number} 置信度 0-1
   */
  calculateConfidence(knowledgePoints, difficulty) {
    let confidence = 0.5; // 基础置信度

    // 知识点匹配增加置信度
    if (knowledgePoints.length > 0 && knowledgePoints[0] !== '综合知识') {
      confidence += 0.2 * Math.min(knowledgePoints.length, 2);
    }

    // 难度评估增加置信度
    if (difficulty) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1);
  }
};

export default mistakeClassifier;
