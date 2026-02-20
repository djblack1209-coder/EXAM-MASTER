/**
 * API 响应运行时验证工具 (F002)
 *
 * 对后端返回的数据做结构/类型校验，防止脏数据进入前端渲染层。
 * 配合 lafService 的 normalizeResponse 使用。
 *
 * @module utils/response-validator
 */

import { logger } from './logger.js';

/**
 * 验证值是否符合预期类型
 * @param {*} value - 待验证值
 * @param {string} type - 期望类型: 'string'|'number'|'boolean'|'array'|'object'
 * @returns {boolean}
 */
function isType(value, type) {
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  return typeof value === type;
}

/**
 * 验证 API 响应数据结构
 *
 * @param {Object} data - 待验证的响应数据
 * @param {Object} schema - 字段定义 { fieldName: { type, required?, default?, validator? } }
 * @param {string} [context=''] - 调用上下文（用于日志）
 * @returns {{ valid: boolean, data: Object, errors: string[] }} 验证结果 + 修复后的数据
 *
 * @example
 * const { valid, data, errors } = validateResponse(apiData, {
 *   list: { type: 'array', required: true, default: [] },
 *   total: { type: 'number', required: false, default: 0 },
 *   hasMore: { type: 'boolean', default: false },
 * }, 'getMistakes');
 */
export function validateResponse(data, schema, context = '') {
  const errors = [];
  const result = { ...data };
  const prefix = context ? `[${context}] ` : '';

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      data: buildDefaults(schema),
      errors: [`${prefix}响应数据为空或非对象`]
    };
  }

  for (const [field, rule] of Object.entries(schema)) {
    const value = data[field];

    // 缺失字段
    if (value === undefined || value === null) {
      if (rule.required) {
        errors.push(`${prefix}缺少必需字段: ${field}`);
      }
      if (rule.default !== undefined) {
        result[field] = typeof rule.default === 'function' ? rule.default() : rule.default;
      }
      continue;
    }

    // 类型检查
    if (rule.type && !isType(value, rule.type)) {
      errors.push(`${prefix}字段 ${field} 类型错误: 期望 ${rule.type}, 实际 ${typeof value}`);
      if (rule.default !== undefined) {
        result[field] = typeof rule.default === 'function' ? rule.default() : rule.default;
      }
      continue;
    }

    // 自定义验证器
    if (rule.validator && typeof rule.validator === 'function') {
      const msg = rule.validator(value);
      if (msg) {
        errors.push(`${prefix}字段 ${field} 验证失败: ${msg}`);
      }
    }
  }

  if (errors.length > 0) {
    logger.warn('[ResponseValidator]', errors.join('; '));
  }

  return {
    valid: errors.length === 0,
    data: result,
    errors
  };
}

/**
 * 根据 schema 构建默认值对象
 */
function buildDefaults(schema) {
  const result = {};
  for (const [field, rule] of Object.entries(schema)) {
    if (rule.default !== undefined) {
      result[field] = typeof rule.default === 'function' ? rule.default() : rule.default;
    }
  }
  return result;
}

// ==================== 预定义 Schema ====================

/** 分页列表响应 */
export const ListSchema = {
  list: { type: 'array', required: true, default: () => [] },
  total: { type: 'number', required: false, default: 0 },
  hasMore: { type: 'boolean', required: false, default: false }
};

/** 用户信息响应 */
export const UserInfoSchema = {
  userId: { type: 'string', required: true },
  nickname: { type: 'string', required: false, default: '用户' },
  avatar: { type: 'string', required: false, default: '' }
};

/** AI 生成响应 */
export const AIResponseSchema = {
  content: { type: 'string', required: true, default: '' },
  model: { type: 'string', required: false },
  usage: { type: 'object', required: false }
};

/** 错题列表响应 */
export const MistakeListSchema = {
  list: { type: 'array', required: true, default: () => [] },
  total: { type: 'number', required: false, default: 0 },
  categories: { type: 'array', required: false, default: () => [] }
};

/** 学习统计响应 */
export const StatsSchema = {
  totalQuestions: { type: 'number', required: false, default: 0 },
  correctRate: { type: 'number', required: false, default: 0 },
  studyDays: { type: 'number', required: false, default: 0 },
  studyMinutes: { type: 'number', required: false, default: 0 }
};

/**
 * 快捷验证：验证并返回安全数据，失败时返回默认值
 * @param {Object} data - API 响应 data 字段
 * @param {Object} schema - 验证 schema
 * @param {string} [context] - 上下文
 * @returns {Object} 验证/修复后的数据
 */
export function safeData(data, schema, context) {
  const { data: result } = validateResponse(data, schema, context);
  return result;
}

export default {
  validateResponse,
  safeData,
  ListSchema,
  UserInfoSchema,
  AIResponseSchema,
  MistakeListSchema,
  StatsSchema
};
