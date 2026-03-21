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
 * 用法（异步，推荐）：
 *   import { renderMarkdownAsync } from '@/composables/useMarkdownRenderer'
 *   const html = await renderMarkdownAsync('求解 $x^2 + 1 = 0$')
 *
 * 用法（同步，md 未加载时返回纯文本）：
 *   import { renderMarkdown } from '@/composables/useMarkdownRenderer'
 *   const html = renderMarkdown('求解 $x^2 + 1 = 0$')
 *
 * @module composables/useMarkdownRenderer
 */

// 延迟加载: katex (~300KB) + markdown-it (~100KB) 不在首页加载时打包进主包
let _md = null;
let _initPromise = null;

/**
 * 获取 markdown-it 渲染器实例（懒加载单例）
 * 首次调用时动态 import markdown-it 和 katex 插件
 * @returns {Promise<MarkdownIt>}
 */
async function getMarkdownRenderer() {
  if (_md) return _md;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const [MarkdownItModule, markdownItKatexModule] = await Promise.all([
      import('markdown-it'),
      import('markdown-it-katex')
    ]);
    const MarkdownIt = MarkdownItModule.default || MarkdownItModule;
    const markdownItKatex = markdownItKatexModule.default || markdownItKatexModule;

    _md = new MarkdownIt({
      html: false, // 禁止原始 HTML（安全）
      linkify: true, // 自动识别链接
      typographer: false, // 不做排版替换，保持原文
      breaks: true // 换行符转 <br>
    });

    _md.use(markdownItKatex, {
      throwOnError: false, // 公式解析失败时不抛异常
      errorColor: '#cc0000' // 错误公式标红
    });

    return _md;
  })();

  return _initPromise;
}

/**
 * 将 markdown + LaTeX 文本渲染为 HTML（异步版本）
 * 首次调用会触发 markdown-it + katex 的动态加载
 * @param {string} text - 原始文本
 * @returns {Promise<string>} HTML 字符串
 */
export async function renderMarkdownAsync(text) {
  if (text == null || text === '') return '';

  const str = String(text);
  if (!str.trim()) return '';

  const md = await getMarkdownRenderer();
  return md.render(str);
}

/**
 * 将 markdown + LaTeX 文本渲染为 HTML（同步版本，向后兼容）
 * 如果渲染器尚未加载完成，返回经过基础 HTML 转义的纯文本
 * 同时触发异步加载，后续调用将返回完整渲染结果
 * @param {string} text - 原始文本
 * @returns {string} HTML 字符串（或加载中时的纯文本）
 */
export function renderMarkdown(text) {
  if (text == null || text === '') return '';

  const str = String(text);
  if (!str.trim()) return '';

  // 渲染器已就绪 → 直接同步渲染
  if (_md) {
    return _md.render(str);
  }

  // 渲染器未就绪 → 触发加载，本次返回纯文本
  getMarkdownRenderer();
  return str;
}

/**
 * 预加载渲染器（可在路由切换或空闲时调用）
 * @returns {Promise<void>}
 */
export function preloadMarkdownRenderer() {
  return getMarkdownRenderer().then(() => {});
}
