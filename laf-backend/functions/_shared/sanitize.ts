/**
 * 输入清洗工具集 — 共享模块
 *
 * 通用的输入验证和清洗函数，供多个云函数复用。
 * 从 school-query.ts 提取，消除项目中 4+ 处 escapeRegex 重复定义。
 */

/**
 * 转义正则表达式特殊字符，防止 ReDoS 攻击
 * @param str - 待转义的字符串
 * @returns 转义后的安全字符串
 */
export function escapeRegex(str: string): string {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 将数值限制在指定范围内，无效值返回默认值
 * @param value - 待校验的值（任意类型，会尝试解析为整数）
 * @param options - { min, max, defaultValue }
 * @returns 安全的整数值
 */
export function clampInt(value: unknown, options: { min: number; max: number; defaultValue: number }): number {
  const { min, max, defaultValue } = options;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * 清洗筛选条件值（去首尾空格 + 截断长度）
 * @param value - 待清洗的值
 * @param maxLength - 最大允许长度，默认 64
 * @returns 安全的字符串，非字符串输入返回空串
 */
export function sanitizeFilterValue(value: unknown, maxLength = 64): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

/**
 * 清洗搜索关键词（去首尾空格 + 截断长度）
 * @param value - 待清洗的值
 * @param maxLength - 最大允许长度，默认 80
 * @returns 安全的关键词字符串
 */
export function sanitizeKeyword(value: unknown, maxLength = 80): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

/**
 * 清洗年份值（限制在 2000 ~ 明年范围内）
 * @param value - 待校验的年份值
 * @returns 安全的年份数字，无效值返回 undefined
 */
export function sanitizeYear(value: unknown): number | undefined {
  const currentYear = new Date().getFullYear() + 1;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(currentYear, Math.max(2000, parsed));
}
