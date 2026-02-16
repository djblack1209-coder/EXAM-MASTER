/**
 * 通用格式化工具函数
 * F002-I1a: 从 index/index.vue 提取，供多页面复用
 */

/**
 * 将时间戳格式化为相对时间（如"刚刚"、"3分钟前"、"2天前"）
 * @param {number|string|Date} timestamp - 时间戳（毫秒）、日期字符串或 Date 对象
 * @param {string} [fallback='刚刚'] - timestamp 为空时的默认返回值
 * @returns {string}
 */
export function formatRelativeTime(timestamp, fallback = '刚刚') {
  if (!timestamp) return fallback;

  const now = Date.now();
  const time = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  const diff = now - time;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`;
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`;
  } else {
    return `${Math.floor(diff / day)}天前`;
  }
}

/**
 * 获取名称的首字母/首字缩写（用于头像占位）
 * @param {string} name - 用户名
 * @returns {string} 最多2个字符的缩写
 */
export function getInitials(name) {
  if (!name) return '';
  // 如果是默认名称"小伙伴"，返回空（使用图标）
  if (name === '小伙伴') return '';
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  // 中文名取前两个字符
  return name.substring(0, 2).toUpperCase();
}
