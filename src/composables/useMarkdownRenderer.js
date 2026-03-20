/**
 * Markdown + KaTeX 渲染组合式函数
 *
 * 将 markdown 文本（含 LaTeX 公式）转换为 HTML 字符串，
 * 供 uni-app 的 <rich-text> 组件使用。
 *
 * 支持：
 *   - 标准 Markdown 语法（标题、列表、代码块、表格等）
 *   - 行内公式 $...$
 *   - 块级公式 $$...$$
 *
 * 用法：
 *   import { renderMarkdown } from '@/composables/useMarkdownRenderer'
 *   const html = renderMarkdown('求解 $x^2 + 1 = 0$')
 *
 * @module composables/useMarkdownRenderer
 */

import MarkdownIt from 'markdown-it';
import markdownItKatex from 'markdown-it-katex';

// 单例：避免每次调用都重新实例化
const md = new MarkdownIt({
  html: false, // 禁止原始 HTML（安全）
  linkify: true, // 自动识别链接
  typographer: false, // 不做排版替换，保持原文
  breaks: true // 换行符转 <br>
});

md.use(markdownItKatex, {
  throwOnError: false, // 公式解析失败时不抛异常
  errorColor: '#cc0000' // 错误公式标红
});

/**
 * 将 markdown + LaTeX 文本渲染为 HTML
 * @param {string} text - 原始文本
 * @returns {string} HTML 字符串
 */
export function renderMarkdown(text) {
  if (text == null || text === '') return '';

  const str = String(text);

  // 纯空白直接返回
  if (!str.trim()) return '';

  return md.render(str);
}
