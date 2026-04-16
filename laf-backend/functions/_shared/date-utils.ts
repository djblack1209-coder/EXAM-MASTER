/**
 * 日期工具函数 — 共享模块
 *
 * 通用的日期计算工具，供排行榜、统计等场景复用。
 * 从 pk-battle.ts 和 rank-center.ts 提取，消除重复定义。
 */

/**
 * 获取本周一的日期字符串（ISO 格式 yyyy-MM-dd）
 * 周日视为上一周的最后一天（ISO 8601 标准）
 */
export function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now.setDate(diff));
  return weekStart.toISOString().split('T')[0];
}

/**
 * 获取本月第一天的日期字符串（格式 yyyy-MM-01）
 */
export function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}
