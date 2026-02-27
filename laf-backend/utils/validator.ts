/**
 * 参数校验工具库
 *
 * 核心原则：不信任前端传来的任何数据
 * 前端校验过的，后端必须再校验一遍（长度、类型、格式）
 *
 * @version 1.0.0
 * @author EXAM-MASTER Backend Team
 */

// ==================== 类型定义 ====================

export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: unknown[];
  custom?: (value: unknown) => boolean | string;
  sanitize?: boolean; // 是否自动清理危险字符
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: Record<string, unknown>;
}

// ==================== 危险字符过滤 ====================

// XSS 危险字符（移除 g 标志，避免 lastIndex 状态导致交替漏检）
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i,
  /javascript:/i,
  /on\w+\s*=/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /<link/i,
  /<meta/i
];

// MongoDB 注入危险字符（移除 g 标志，避免 lastIndex 状态导致交替漏检）
const INJECTION_PATTERNS = [/\$where/i, /\$regex/i, /\$gt/i, /\$lt/i, /\$ne/i, /\$or/i, /\$and/i];

/**
 * 清理字符串中的危险字符
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;

  let result = input;

  // 移除 XSS 危险内容
  for (const pattern of XSS_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // HTML 实体编码
  result = result
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return result.trim();
}

/**
 * 检查是否包含 MongoDB 注入风险
 */
export function hasInjectionRisk(input: unknown): boolean {
  if (typeof input === 'string') {
    return INJECTION_PATTERNS.some((pattern) => pattern.test(input));
  }
  if (typeof input === 'object' && input !== null) {
    // 检查对象的键是否以 $ 开头
    return Object.keys(input).some((key) => key.startsWith('$'));
  }
  return false;
}

// ==================== 核心校验函数 ====================

/**
 * 校验单个字段
 */
export function validateField(
  value: unknown,
  rule: ValidationRule,
  fieldName: string
): { valid: boolean; error?: string; sanitized?: unknown } {
  // 1. 必填检查
  if (rule.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: `${fieldName} 不能为空` };
  }

  // 如果非必填且值为空，跳过后续校验
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return { valid: true, sanitized: value };
  }

  // 2. 类型检查
  if (rule.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rule.type) {
      return { valid: false, error: `${fieldName} 类型错误，期望 ${rule.type}，实际 ${actualType}` };
    }
  }

  let sanitizedValue = value;

  // 3. 字符串校验
  if (typeof value === 'string') {
    // 长度检查
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return { valid: false, error: `${fieldName} 长度不能少于 ${rule.minLength} 个字符` };
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return { valid: false, error: `${fieldName} 长度不能超过 ${rule.maxLength} 个字符` };
    }

    // 正则匹配
    if (rule.pattern && !rule.pattern.test(value)) {
      return { valid: false, error: `${fieldName} 格式不正确` };
    }

    // 危险字符清理
    if (rule.sanitize !== false) {
      sanitizedValue = sanitizeString(value);
    }
  }

  // 4. 数字校验
  if (typeof value === 'number') {
    if (isNaN(value)) {
      return { valid: false, error: `${fieldName} 必须是有效数字` };
    }
    if (rule.min !== undefined && value < rule.min) {
      return { valid: false, error: `${fieldName} 不能小于 ${rule.min}` };
    }
    if (rule.max !== undefined && value > rule.max) {
      return { valid: false, error: `${fieldName} 不能大于 ${rule.max}` };
    }
  }

  // 5. 数组校验
  if (Array.isArray(value)) {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return { valid: false, error: `${fieldName} 至少需要 ${rule.minLength} 个元素` };
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return { valid: false, error: `${fieldName} 最多允许 ${rule.maxLength} 个元素` };
    }
  }

  // 6. 枚举校验
  if (rule.enum && !rule.enum.includes(value)) {
    return { valid: false, error: `${fieldName} 值不在允许范围内` };
  }

  // 7. 自定义校验
  if (rule.custom) {
    const customResult = rule.custom(value);
    if (customResult !== true) {
      return {
        valid: false,
        error: typeof customResult === 'string' ? customResult : `${fieldName} 校验失败`
      };
    }
  }

  // 8. 注入风险检查
  if (hasInjectionRisk(value)) {
    return { valid: false, error: `${fieldName} 包含非法字符` };
  }

  return { valid: true, sanitized: sanitizedValue };
}

/**
 * 批量校验参数
 */
export function validate(data: Record<string, unknown>, schema: ValidationSchema): ValidationResult {
  const errors: string[] = [];
  const sanitized: Record<string, unknown> = {};

  for (const [fieldName, rule] of Object.entries(schema)) {
    const value = data[fieldName];
    const result = validateField(value, rule, fieldName);

    if (!result.valid && result.error) {
      errors.push(result.error);
    } else {
      sanitized[fieldName] = result.sanitized;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

// ==================== 预定义校验规则 ====================

/**
 * 常用校验规则
 */
export const CommonRules = {
  // 用户 ID
  userId: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    maxLength: 64,
    pattern: /^[a-zA-Z0-9_-]+$/
  },

  // 微信 openid
  openid: {
    required: true,
    type: 'string' as const,
    minLength: 28,
    maxLength: 128
  },

  // 昵称
  nickname: {
    type: 'string' as const,
    maxLength: 32,
    sanitize: true
  },

  // 分页参数
  page: {
    type: 'number' as const,
    min: 1,
    max: 1000
  },

  limit: {
    type: 'number' as const,
    min: 1,
    max: 100
  },

  // 题目内容
  questionContent: {
    required: true,
    type: 'string' as const,
    minLength: 5,
    maxLength: 2000,
    sanitize: true
  },

  // 答案
  answer: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    maxLength: 10,
    pattern: /^[A-Ha-h]+$/
  },

  // 分数
  score: {
    type: 'number' as const,
    min: 0,
    max: 1000000
  },

  // 科目分类
  category: {
    type: 'string' as const,
    enum: ['政治', '英语', '数学', '专业课', '综合']
  },

  // 难度
  difficulty: {
    type: 'string' as const,
    enum: ['easy', 'medium', 'hard']
  },

  // 操作类型
  action: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    maxLength: 50,
    pattern: /^[a-zA-Z_]+$/
  }
};

// ==================== 快捷校验函数 ====================

/**
 * 校验用户登录参数
 */
export function validateLoginParams(data: unknown): ValidationResult {
  return validate(data, {
    code: {
      required: true,
      type: 'string',
      minLength: 10,
      maxLength: 100
    }
  });
}

/**
 * 校验错题操作参数
 */
export function validateMistakeParams(data: unknown): ValidationResult {
  return validate(data, {
    action: CommonRules.action,
    userId: CommonRules.userId,
    data: {
      type: 'object'
    }
  });
}

/**
 * 校验排行榜参数
 */
export function validateRankParams(data: unknown): ValidationResult {
  return validate(data, {
    action: CommonRules.action,
    uid: {
      type: 'string',
      maxLength: 64
    },
    score: CommonRules.score,
    rankType: {
      type: 'string',
      enum: ['daily', 'weekly', 'monthly', 'total']
    },
    limit: CommonRules.limit
  });
}

/**
 * 校验社交服务参数
 */
export function validateSocialParams(data: unknown): ValidationResult {
  return validate(data, {
    action: CommonRules.action,
    userId: {
      type: 'string',
      maxLength: 64
    },
    targetUid: {
      type: 'string',
      maxLength: 64
    },
    keyword: {
      type: 'string',
      minLength: 2,
      maxLength: 50,
      sanitize: true
    }
  });
}

// ==================== 导出 ====================

export default {
  validate,
  validateField,
  sanitizeString,
  hasInjectionRisk,
  CommonRules,
  validateLoginParams,
  validateMistakeParams,
  validateRankParams,
  validateSocialParams
};
