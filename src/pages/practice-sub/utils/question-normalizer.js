/**
 * 题目标准化与验证工具
 * 从 practice/index.vue 提取的纯函数，便于独立测试和复用
 *
 * @module question-normalizer
 */

/**
 * 检测题目类型（支持判断题自动识别）
 */
function _detectType(raw, options) {
  if (raw.type) {
    const t = String(raw.type).trim();
    if (['判断', '判断题', 'truefalse', 'true_false', 'tf'].includes(t.toLowerCase())) return '判断';
    return t;
  }
  if (Array.isArray(options) && options.length === 2) {
    const pair = options.map((o) => String(o).trim());
    const tfPairs = [
      ['对', '错'],
      ['正确', '错误'],
      ['True', 'False'],
      ['T', 'F'],
      ['√', '×'],
      ['是', '否']
    ];
    if (tfPairs.some(([a, b]) => (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a))) {
      return '判断';
    }
  }
  return '单选';
}

/**
 * 标准化判断题/选择题答案
 */
function _normalizeAnswer(answer, type) {
  if (answer === null || answer === undefined) return type === '判断' ? '对' : 'A';
  if (typeof answer === 'number') {
    if (type === '判断') return answer ? '对' : '错';
    const letters = ['A', 'B', 'C', 'D'];
    return letters[answer] || 'A';
  }
  const str = String(answer).trim();
  if (type === '判断') {
    const trueValues = ['对', '正确', 'true', 't', 'a', '√', '1', 'yes', 'y'];
    const falseValues = ['错', '错误', 'false', 'f', 'b', '×', '✗', '0', 'no', 'n'];
    if (trueValues.includes(str.toLowerCase())) return '对';
    if (falseValues.includes(str.toLowerCase())) return '错';
    return '对';
  }
  return str.toUpperCase().charAt(0) || 'A';
}

/**
 * 标准化单个题目字段名
 * @param {Object} q - 原始题目对象
 * @returns {Object} 标准化后的题目
 */
export function normalizeQuestion(q) {
  const question = q.question || q.title || q.content || '';
  let options = q.options || [];
  if (!Array.isArray(options)) options = [];
  const type = _detectType(q, options);
  const answer = _normalizeAnswer(q.answer || q.correct_answer || q.correctAnswer || '', type);
  const category = q.category || q.subject || '未分类';
  const desc = q.desc || q.analysis || q.explanation || '';

  return {
    ...q,
    question,
    options,
    answer,
    category,
    desc,
    type
  };
}

/**
 * 验证题目是否有效（有题干、至少4个选项、合法答案）
 * @param {Object} q - 标准化后的题目
 * @returns {boolean}
 */
export function isValidQuestion(q) {
  if (!q || !q.question || !q.question.trim()) return false;
  const answer = q.answer;
  if (!answer) return false;

  // 判断题：2+选项，答案为 对/错
  if (q.type === '判断') {
    return Array.isArray(q.options) && q.options.length >= 2 && ['对', '错'].includes(answer);
  }
  // 选择题：4+选项，答案 A-D
  return Array.isArray(q.options) && q.options.length >= 4 && ['A', 'B', 'C', 'D'].includes(answer);
}

/**
 * 标准化并验证题目数组（增强版，处理数字答案等边界情况）
 * @param {Array} questions - 原始题目数组
 * @returns {Array} 有效题目数组
 */
export function normalizeAndValidateQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return questions
    .map((q) => {
      // 额外兼容: correct 字段 (数字索引)
      if (q.correct !== undefined && q.answer === undefined && q.correct_answer === undefined) {
        q.answer = q.correct;
      }
      return normalizeQuestion(q);
    })
    .filter(isValidQuestion);
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
