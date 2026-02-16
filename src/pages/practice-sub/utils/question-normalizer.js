/**
 * 题目标准化与验证工具
 * 从 practice/index.vue 提取的纯函数，便于独立测试和复用
 *
 * @module question-normalizer
 */

/**
 * 标准化单个题目字段名
 * @param {Object} q - 原始题目对象
 * @returns {Object} 标准化后的题目
 */
export function normalizeQuestion(q) {
  const answer = q.answer || q.correct_answer || q.correctAnswer || '';
  const question = q.question || q.title || q.content || '';
  let options = q.options || [];
  if (!Array.isArray(options)) options = [];
  const category = q.category || q.subject || '未分类';
  const desc = q.desc || q.analysis || q.explanation || '';

  return {
    ...q,
    question, options,
    answer: answer.toUpperCase().charAt(0),
    category, desc,
    type: q.type || '单选'
  };
}

/**
 * 验证题目是否有效（有题干、至少4个选项、合法答案）
 * @param {Object} q - 标准化后的题目
 * @returns {boolean}
 */
export function isValidQuestion(q) {
  return !!(q.question && q.question.trim().length > 0 &&
    Array.isArray(q.options) && q.options.length >= 4 &&
    q.answer && ['A', 'B', 'C', 'D'].includes(q.answer));
}

/**
 * 标准化并验证题目数组（增强版，处理数字答案等边界情况）
 * @param {Array} questions - 原始题目数组
 * @returns {Array} 有效题目数组
 */
export function normalizeAndValidateQuestions(questions) {
  const normalizedQs = questions.map((q) => {
    let answer = q.answer || q.correct_answer || q.correctAnswer || '';
    if (!answer && q.correct !== undefined) answer = q.correct;

    if (typeof answer === 'number') {
      const letters = ['A', 'B', 'C', 'D'];
      answer = letters[answer] || 'A';
    } else if (answer) {
      answer = answer.toString().toUpperCase().charAt(0);
    } else {
      answer = 'A';
    }

    const question = q.question || q.title || q.content || '';
    let options = q.options || [];
    if (!Array.isArray(options)) options = [];
    const category = q.category || q.subject || '未分类';
    const desc = q.desc || q.analysis || q.explanation || '';

    return {
      ...q,
      question, options, answer, category, desc,
      type: q.type || '单选'
    };
  });

  return normalizedQs.filter((q) =>
    q.question &&
    q.question.trim().length > 0 &&
    Array.isArray(q.options) &&
    q.options.length >= 4 &&
    q.answer &&
    ['A', 'B', 'C', 'D'].includes(q.answer)
  );
}

/**
 * 清洗发送给 AI 的用户输入
 * 移除控制字符、截断过长内容
 * @param {string} text - 原始文本
 * @param {number} maxLen - 最大长度
 * @returns {string} 清洗后的文本
 */
export function sanitizeAIInput(text, maxLen = 8000) {
  if (!text || typeof text !== 'string') return '';
  // 移除不可见控制字符（保留换行和空格）
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  if (cleaned.length > maxLen) {
    cleaned = cleaned.substring(0, maxLen);
  }
  return cleaned.trim();
}
