/**
 * 日期工具函数
 */

/**
 * 获取今天的日期字符串 (YYYY-MM-DD)
 * @returns {string} 格式如 '2026-03-26'
 */
export function today() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
