/**
 * 代码高亮工具 — 微信小程序端使用轻量替代
 */
export function highlightCode(code, _language = '') {
  // 小程序端不加载完整 highlight.js，返回原始代码
  return code || '';
}

export function getSupportedLanguages() {
  return ['javascript', 'python', 'java', 'c', 'cpp', 'html', 'css', 'sql'];
}
