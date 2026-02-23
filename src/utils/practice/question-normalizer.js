/**
 * 题目标准化模块
 * 统一不同来源的题目格式，验证题目有效性，清洗AI输入
 */

/**
 * 标准化单道题目
 * @param {Object} raw - 原始题目对象
 * @returns {Object} 标准化后的题目
 */
export function normalizeQuestion(raw) {
  if (!raw || typeof raw !== 'object') {
    return { question: '', options: [], answer: 'A', category: '未分类', type: '单选', desc: '' };
  }

  // 题干兼容: question / title / content
  const question = raw.question || raw.title || raw.content || '';

  // 选项
  const options = Array.isArray(raw.options) ? raw.options : [];

  // 答案兼容: answer / correct_answer / correctAnswer
  let answer = raw.answer ?? raw.correct_answer ?? raw.correctAnswer ?? 'A';
  answer = _normalizeAnswer(answer);

  // 分类兼容: category / subject
  const category = raw.category || raw.subject || '未分类';

  // 解析兼容: desc / analysis
  const desc = raw.desc || raw.analysis || '';

  // 类型
  const type = raw.type || '单选';

  return {
    ...raw,
    question,
    options,
    answer,
    category,
    desc,
    type
  };
}

/**
 * 标准化答案为大写首字母
 */
function _normalizeAnswer(answer) {
  if (answer === null || answer === undefined) return 'A';

  if (typeof answer === 'number') {
    const letters = ['A', 'B', 'C', 'D'];
    return letters[answer] || 'A';
  }

  const str = String(answer).trim().toUpperCase();
  return str.charAt(0) || 'A';
}

/**
 * 验证题目是否有效
 * @param {Object} q - 题目对象
 * @returns {boolean}
 */
export function isValidQuestion(q) {
  if (!q) return false;

  // 题干非空
  const question = q.question || '';
  if (!question.trim()) return false;

  // 选项至少4个且为数组
  if (!Array.isArray(q.options) || q.options.length < 4) return false;

  // 答案有效 (A-D)
  const answer = q.answer;
  if (!answer || typeof answer !== 'string') return false;
  if (!['A', 'B', 'C', 'D'].includes(answer.toUpperCase())) return false;

  return true;
}

/**
 * 批量标准化并过滤无效题目
 * @param {Array} questions - 原始题目数组
 * @returns {Array} 有效的标准化题目
 */
export function normalizeAndValidateQuestions(questions) {
  if (!Array.isArray(questions)) return [];

  return questions
    .map((raw) => {
      // 额外兼容: correct 字段 (数字索引)
      if (raw.correct !== undefined && raw.answer === undefined && raw.correct_answer === undefined) {
        raw.answer = raw.correct;
      }
      // 无答案时默认 A
      if (
        raw.answer === undefined &&
        raw.correct_answer === undefined &&
        raw.correctAnswer === undefined &&
        raw.correct === undefined
      ) {
        raw.answer = 'A';
      }
      return normalizeQuestion(raw);
    })
    .filter(isValidQuestion);
}

/**
 * 清洗AI输入文本
 * @param {any} text - 输入文本
 * @param {number} maxLen - 最大长度，默认8000
 * @returns {string} 清洗后的文本
 */
export function sanitizeAIInput(text, maxLen = 8000) {
  if (text === null || text === undefined || typeof text !== 'string' || text === '') {
    return '';
  }

  // 移除控制字符（保留换行 \n \r \t）
  let cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // trim
  cleaned = cleaned.trim();

  // 截断
  if (cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen);
  }

  return cleaned;
}
