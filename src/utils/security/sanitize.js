/**
 * 全局输入净化工具
 *
 * 统一的 XSS 防护和输入校验，供所有页面/组件共享。
 * 之前 sanitizeInput 在 settings/index.vue 和 plan/create.vue 中重复定义，
 * 现在提取为全局单例。
 *
 * @module utils/security/sanitize
 */

/**
 * 净化用户输入 — 移除危险字符
 * @param {string} input - 原始输入
 * @param {number} [maxLength=200] - 最大字符数
 * @param {Object} [options] - 选项
 * @param {boolean} [options.allowEmoji=false] - 是否允许 Emoji
 * @param {boolean} [options.allowHtml=false] - 是否保留尖括号（极少使用）
 * @returns {string} 净化后的字符串
 */
export function sanitizeInput(input, maxLength = 200, options = {}) {
  const { allowEmoji = false, allowHtml = false } = options;
  if (!input) return '';

  let result = String(input);

  // 移除控制字符（保留换行和制表符）
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 移除 HTML 危险字符
  if (!allowHtml) {
    result = result.replace(/[<>"'&]/g, '');
  }

  // 可选：过滤 Emoji，只保留中文、英文、数字和常用标点
  if (!allowEmoji) {
    result = result.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\-_.,!?，。！？、:;：；()（）\n\t]/g, '');
  }

  return result.trim().slice(0, maxLength);
}

/**
 * 净化 AI 对话输入 — 比 sanitizeInput 宽松，保留更多字符
 * 用于 AI 聊天、AI 课堂等场景，用户可能输入公式、代码片段等
 * @param {string} input - 原始输入
 * @param {number} [maxLength=8000] - 最大字符数
 * @returns {string} 净化后的字符串
 */
export function sanitizeAIChatInput(input, maxLength = 8000) {
  if (!input) return '';

  let result = String(input);

  // 移除控制字符（保留换行和制表符）
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // 移除 HTML 标签（防止注入），但保留尖括号的文本用途（如数学公式 a < b）
  // 策略：移除完整的 HTML 标签模式，而不是单独的尖括号
  result = result.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  result = result.replace(/<\s*style[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '');
  result = result.replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');
  result = result.replace(/<\s*object[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '');
  result = result.replace(/<\s*embed[^>]*\/?>/gi, '');
  result = result.replace(/<\s*svg[^>]*>[\s\S]*?<\s*\/\s*svg\s*>/gi, '');
  result = result.replace(/<\s*math[^>]*>[\s\S]*?<\s*\/\s*math\s*>/gi, '');
  result = result.replace(/<\s*link[^>]*\/?>/gi, '');
  result = result.replace(/<\s*meta[^>]*\/?>/gi, '');
  result = result.replace(/<\s*base[^>]*\/?>/gi, '');
  // 移除所有事件处理器属性（覆盖无引号值的情况）
  result = result.replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 移除危险 URI 伪协议（防止 javascript:/data: 注入）
  result = result.replace(/\b(?:javascript|data|vbscript)\s*:/gi, '');

  return result.trim().slice(0, maxLength);
}

/**
 * HTML 实体转义 — 用于将文本安全地嵌入 HTML 上下文
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
