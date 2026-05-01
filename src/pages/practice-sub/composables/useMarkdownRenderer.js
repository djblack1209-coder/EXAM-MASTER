/**
 * Markdown + KaTeX 渲染组合式函数 — MVP stub
 *
 * markdown-it + katex 已在 MVP 中移除以减小包体积 (~400KB)。
 * 所有渲染函数退化为返回纯文本，APP 版本将恢复完整渲染。
 *
 * @module composables/useMarkdownRenderer
 */

/**
 * 将文本渲染为 HTML（异步版本）— MVP 返回纯文本
 * @param {string} text - 原始文本
 * @returns {Promise<string>}
 */
export async function renderMarkdownAsync(text) {
  if (text == null || text === '') return '';
  return String(text);
}

/**
 * 将文本渲染为 HTML（同步版本）— MVP 返回纯文本
 * @param {string} text - 原始文本
 * @returns {string}
 */
export function renderMarkdown(text) {
  if (text == null || text === '') return '';
  return String(text);
}

/**
 * 预加载渲染器 — MVP no-op
 * @returns {Promise<void>}
 */
export function preloadMarkdownRenderer() {
  return Promise.resolve();
}
