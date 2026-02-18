/**
 * 字段命名规范化工具
 * 解决前后端字段命名不一致问题（snake_case vs camelCase）
 * 
 * 后端数据库统一使用 snake_case，前端内部统一使用 snake_case（与后端保持一致）
 * 本工具提供转换函数，用于：
 * 1. 接收后端数据时规范化字段名
 * 2. 兼容历史遗留的 camelCase 字段
 * 3. 错题数据专用的字段别名映射
 */

// ==================== 通用转换函数 ====================

/**
 * camelCase → snake_case
 * @param {string} str
 * @returns {string}
 */
export function toSnakeCase(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

/**
 * snake_case → camelCase
 * @param {string} str
 * @returns {string}
 */
export function toCamelCase(str) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 将对象的所有键从 camelCase 转为 snake_case
 * @param {Object} obj
 * @returns {Object}
 */
export function keysToSnakeCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toSnakeCase(key)] = value;
  }
  return result;
}

/**
 * 将对象的所有键从 snake_case 转为 camelCase
 * @param {Object} obj
 * @returns {Object}
 */
export function keysToCamelCase(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[toCamelCase(key)] = value;
  }
  return result;
}

// ==================== 错题数据专用规范化 ====================

/**
 * 错题字段别名映射表
 * key = 标准字段名 (snake_case)，value = 可能出现的别名列表
 */
const MISTAKE_FIELD_ALIASES = {
  question_content: ['question', 'title', 'questionContent'],
  correct_answer:   ['answer', 'correctAnswer'],
  user_answer:      ['userChoice', 'userAnswer', 'my_answer'],
  wrong_count:      ['wrongCount', 'error_count'],
  is_mastered:      ['isMastered', 'mastered'],
  created_at:       ['addTime', 'timestamp', 'createdAt', 'create_time'],
  updated_at:       ['updatedAt', 'update_time'],
  last_wrong_time:  ['lastWrongTime'],
  review_count:     ['reviewCount'],
  last_review_time: ['lastReviewTime'],
  next_review_time: ['nextReviewTime'],
  ease_factor:      ['easeFactor'],
  interval_days:    ['intervalDays'],
  error_type:       ['errorType'],
  question_id:      ['questionId'],
  user_id:          ['userId'],
};

/**
 * 规范化单条错题数据
 * 将各种别名字段统一为 snake_case 标准字段名
 * 
 * @param {Object} item - 原始错题对象（可能混合 camelCase 和 snake_case）
 * @returns {Object} 规范化后的错题对象（统一 snake_case）
 */
export function normalizeMistake(item) {
  if (!item || typeof item !== 'object') return item;

  const result = { ...item };

  for (const [standard, aliases] of Object.entries(MISTAKE_FIELD_ALIASES)) {
    // 如果标准字段已有值，跳过
    if (result[standard] !== undefined && result[standard] !== null && result[standard] !== '') {
      continue;
    }
    // 从别名中查找值
    for (const alias of aliases) {
      if (result[alias] !== undefined && result[alias] !== null && result[alias] !== '') {
        result[standard] = result[alias];
        break;
      }
    }
  }

  // 确保关键字段有默认值
  result.wrong_count = result.wrong_count || result.wrongCount || 1;
  result.is_mastered = Boolean(result.is_mastered || result.isMastered || false);
  result.review_count = result.review_count || result.reviewCount || 0;

  return result;
}

/**
 * 批量规范化错题数据
 * @param {Array} items
 * @returns {Array}
 */
export function normalizeMistakes(items) {
  if (!Array.isArray(items)) return [];
  return items.map(normalizeMistake);
}

// ==================== 离线缓存数据同步映射 ====================

/**
 * 将离线缓存的 camelCase 错题数据转为后端 snake_case 格式
 * 专门解决 offline-cache.js 存储的 camelCase 数据同步到后端的问题
 * 
 * @param {Object} cached - 离线缓存的错题对象
 * @returns {Object} 后端格式的错题对象
 */
export function offlineMistakeToBackend(cached) {
  if (!cached || typeof cached !== 'object') return cached;

  return {
    question_id: cached.question_id || cached.questionId || '',
    question_content: cached.question_content || cached.questionContent || cached.question || '',
    user_answer: cached.user_answer || cached.userAnswer || cached.userChoice || '',
    correct_answer: cached.correct_answer || cached.correctAnswer || cached.answer || '',
    wrong_count: cached.wrong_count || cached.wrongCount || 1,
    is_mastered: Boolean(cached.is_mastered || cached.isMastered || false),
    error_type: cached.error_type || cached.errorType || '',
    created_at: cached.created_at || cached.createdAt || cached.addTime || Date.now(),
    updated_at: Date.now(),
    // 保留原始字段（如 _id、subject 等不需要转换的字段）
    ...(cached._id ? { _id: cached._id } : {}),
    ...(cached.subject ? { subject: cached.subject } : {}),
    ...(cached.chapter ? { chapter: cached.chapter } : {}),
    ...(cached.tags ? { tags: cached.tags } : {}),
    ...(cached.options ? { options: cached.options } : {}),
    ...(cached.analysis ? { analysis: cached.analysis } : {}),
  };
}
