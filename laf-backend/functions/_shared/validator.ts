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
  sanitize?: boolean;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: Record<string, unknown>;
}

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

// P0 修复: 移除所有正则的 g 标志，避免 lastIndex 导致间歇性漏检
// 使用不可变正则模式，每次调用 test() 都是独立的
const INJECTION_PATTERNS = [
  /\$where/i,
  /\$regex/i,
  /\$gt/i,
  /\$lt/i,
  /\$ne/i,
  /\$or/i,
  /\$and/i,
  /\$in/i,
  /\$nin/i,
  /\$exists/i
];

export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return input;

  let result = input;
  // 使用 replaceAll 替代带 g 标志的 replace，避免 lastIndex 问题
  for (const pattern of XSS_PATTERNS) {
    result = result.replace(pattern, '');
  }

  result = result
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return result.trim();
}

export function hasInjectionRisk(input: unknown): boolean {
  if (typeof input === 'string') {
    // P0 修复: 使用 some() 确保每次都是新的正则实例测试
    // 避免正则 lastInde染导致漏检
    return INJECTION_PATTERNS.some((pattern) => {
      // 每次创建新的正则实例，确保 lastIndex 为 0
      const freshPattern = new RegExp(pattern.source, pattern.flags);
      return freshPattern.test(input);
    });
  }
  if (typeof input === 'object' && input !== null) {
    return Object.keys(input).some((key) => key.startsWith('$'));
  }
  return false;
}

export function validateField(
  value: unknown,
  rule: ValidationRule,
  fieldName: string
): { valid: boolean; error?: string; sanitized?: unknown } {
  if (rule.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: `${fieldName} 不能为空` };
  }

  if (!rule.required && (value === undefined || value === null || value === '')) {
    return { valid: true, sanitized: value };
  }

  if (rule.type) {
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rule.type) {
      return { valid: false, error: `${fieldName} 类型错误，期望 ${rule.type}，实际 ${actualType}` };
    }
  }

  let sanitizedValue = value;

  if (typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return { valid: false, error: `${fieldName} 长度不能少于 ${rule.minLength} 个字符` };
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return { valid: false, error: `${fieldName} 长度不能超过 ${rule.maxLength} 个字符` };
    }
    if (rule.pattern && !rule.pattern.test(value)) {
      return { valid: false, error: `${fieldName} 格式不正确` };
    }
    if (rule.sanitize !== false) {
      sanitizedValue = sanitizeString(value);
    }
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return { valid: false, error: `${fieldName} 必须是有效数字` };
    }
    if (rule.min !== undefined && value < rule.min) {
      return { valid: false, error: `${fieldName} 不能小于 ${rule.min}` };
    }
    if (rule.max !== undefined && value > rule.max) {
      return { valid: false, error: `${fieldName} 不能大于 ${rule.max}` };
    }
  }

  if (Array.isArray(value)) {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return { valid: false, error: `${fieldName} 至少需要 ${rule.minLength} 个元素` };
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return { valid: false, error: `${fieldName} 最多允许 ${rule.maxLength} 个元素` };
    }
  }

  if (rule.enum && !rule.enum.includes(value)) {
    return { valid: false, error: `${fieldName} 值不在允许范围内` };
  }

  if (rule.custom) {
    const customResult = rule.custom(value);
    if (customResult !== true) {
      return { valid: false, error: typeof customResult === 'string' ? customResult : `${fieldName} 校验失败` };
    }
  }

  if (hasInjectionRisk(value)) {
    return { valid: false, error: `${fieldName} 包含非法字符` };
  }

  return { valid: true, sanitized: sanitizedValue };
}

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
