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

  // 类型（支持判断题自动检测）
  const type = _detectType(raw, options);

  // 答案兼容: answer / correct_answer / correctAnswer
  let answer = raw.answer ?? raw.correct_answer ?? raw.correctAnswer ?? (type === '判断' ? '对' : 'A');
  answer = _normalizeAnswer(answer, type);

  // 分类兼容: category / subject
  const category = raw.category || raw.subject || '未分类';

  // 解析兼容: desc / analysis
  const desc = raw.desc || raw.analysis || raw.explanation || '';

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
 * 检测题目类型（支持判断题自动识别）
 */
function _detectType(raw, options) {
  // 如果已有明确类型，直接使用
  if (raw.type) {
    const t = String(raw.type).trim();
    if (['判断', '判断题', 'truefalse', 'true_false', 'tf'].includes(t.toLowerCase())) return '判断';
    return t;
  }
  // 自动检测：2个选项且内容为对/错类
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
 * 标准化答案（支持选择题 A-D 和判断题 对/错/True/False）
 */
function _normalizeAnswer(answer, type) {
  if (answer === null || answer === undefined) return type === '判断' ? '对' : 'A';

  if (typeof answer === 'number') {
    if (type === '判断') return answer === 1 || answer === 0 ? (answer ? '对' : '错') : '对';
    const letters = ['A', 'B', 'C', 'D'];
    return letters[answer] || 'A';
  }

  const str = String(answer).trim();

  // 判断题答案标准化
  if (type === '判断') {
    const trueValues = ['对', '正确', 'true', 'T', 'A', '√', '1', 'yes', 'Y'];
    const falseValues = ['错', '错误', 'false', 'F', 'B', '×', '✗', '0', 'no', 'N'];
    if (trueValues.some((v) => v.toLowerCase() === str.toLowerCase())) return '对';
    if (falseValues.some((v) => v.toLowerCase() === str.toLowerCase())) return '错';
    return '对'; // 默认
  }

  return str.toUpperCase().charAt(0) || 'A';
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

  const answer = q.answer;
  if (!answer || typeof answer !== 'string') return false;

  // 判断题：2个选项，答案为 对/错
  if (q.type === '判断') {
    if (!Array.isArray(q.options) || q.options.length < 2) return false;
    if (!['对', '错'].includes(answer)) return false;
    return true;
  }

  // 选择题：至少4个选项，答案 A-D
  if (!Array.isArray(q.options) || q.options.length < 4) return false;
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
