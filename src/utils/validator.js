/**
 * ✅ S006/F011: 前端通用输入验证工具
 * 与后端 validator.ts 规则对齐，提供前置校验，减少无效请求
 *
 * @module utils/validator
 */

// XSS 危险模式
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe/gi,
  /<object/gi,
  /<embed/gi
];

/**
 * 清理字符串中的 XSS 危险字符
 * @param {string} input
 * @returns {string}
 */
export function sanitize(input) {
  if (typeof input !== 'string') return input;
  let result = input;
  for (const p of XSS_PATTERNS) {
    result = result.replace(p, '');
  }
  return result
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * 校验单个字段
 * @param {*} value - 字段值
 * @param {Object} rule - 校验规则 { required, type, minLength, maxLength, min, max, pattern, enum, custom }
 * @param {string} name - 字段名（用于错误提示）
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateField(value, rule, name = '字段') {
  if (rule.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: `${name}不能为空` };
  }
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return { valid: true };
  }
  if (rule.type) {
    const actual = Array.isArray(value) ? 'array' : typeof value;
    if (actual !== rule.type) {
      return { valid: false, error: `${name}类型错误` };
    }
  }
  if (typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return { valid: false, error: `${name}长度不能少于${rule.minLength}个字符` };
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return { valid: false, error: `${name}长度不能超过${rule.maxLength}个字符` };
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      return { valid: false, error: `${name}格式不正确` };
    }
  }
  if (typeof value === 'number') {
    if (isNaN(value)) return { valid: false, error: `${name}必须是有效数字` };
    if (rule.min !== undefined && value < rule.min) return { valid: false, error: `${name}不能小于${rule.min}` };
    if (rule.max !== undefined && value > rule.max) return { valid: false, error: `${name}不能大于${rule.max}` };
  }
  if (Array.isArray(value)) {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return { valid: false, error: `${name}至少需要${rule.minLength}项` };
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return { valid: false, error: `${name}最多允许${rule.maxLength}项` };
    }
  }
  if (rule.enum && !rule.enum.includes(value)) {
    return { valid: false, error: `${name}值不在允许范围内` };
  }
  if (rule.custom) {
    const r = rule.custom(value);
    if (r !== true) return { valid: false, error: typeof r === 'string' ? r : `${name}校验失败` };
  }
  return { valid: true };
}

/**
 * 批量校验
 * @param {Object} data - 待校验数据
 * @param {Object} schema - 校验规则 { fieldName: rule }
 * @returns {{ valid: boolean, errors: string[], firstError: string|null }}
 */
export function validate(data, schema) {
  const errors = [];
  for (const [field, rule] of Object.entries(schema)) {
    const result = validateField(data[field], rule, rule.label || field);
    if (!result.valid && result.error) errors.push(result.error);
  }
  return { valid: errors.length === 0, errors, firstError: errors[0] || null };
}

// ==================== 常用预设规则 ====================

export const Rules = {
  /** 邮箱 */
  email: {
    required: true, type: 'string', label: '邮箱',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, maxLength: 100
  },
  /** 密码（至少8位，含字母和数字） */
  password: {
    required: true, type: 'string', label: '密码',
    minLength: 8, maxLength: 64,
    custom: (v) => /[a-zA-Z]/.test(v) && /\d/.test(v) ? true : '密码需包含字母和数字'
  },
  /** 验证码（6位数字） */
  verifyCode: {
    required: true, type: 'string', label: '验证码',
    pattern: /^\d{6}$/, minLength: 6, maxLength: 6
  },
  /** 昵称 */
  nickname: { type: 'string', label: '昵称', minLength: 1, maxLength: 32 },
  /** 搜索关键词 */
  keyword: { type: 'string', label: '搜索关键词', minLength: 1, maxLength: 50 },
  /** 题目内容 */
  questionContent: { required: true, type: 'string', label: '题目内容', minLength: 5, maxLength: 5000 },
  /** 分页页码 */
  page: { type: 'number', label: '页码', min: 1, max: 1000 },
  /** 分页大小 */
  pageSize: { type: 'number', label: '每页数量', min: 1, max: 100 }
};

// ==================== 快捷校验函数 ====================

/**
 * 校验登录参数
 */
export function validateLogin(data) {
  if (data.type === 'email') {
    return validate(data, { email: Rules.email, password: Rules.password });
  }
  // 微信登录只需 code
  return validate(data, {
    code: { required: true, type: 'string', label: '登录凭证', minLength: 1 }
  });
}

/**
 * 校验注册参数
 */
export function validateRegister(data) {
  return validate(data, {
    email: Rules.email,
    password: Rules.password,
    verifyCode: Rules.verifyCode
  });
}

/**
 * 校验 AI 输入内容（防空值、防超长）
 */
export function validateAIInput(content) {
  return validateField(content, {
    required: true, type: 'string', minLength: 1, maxLength: 10000
  }, 'AI输入内容');
}

export default { validate, validateField, sanitize, Rules, validateLogin, validateRegister, validateAIInput };
