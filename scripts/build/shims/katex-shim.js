/**
 * KaTeX 微信小程序降级 shim
 * 将 LaTeX 公式原样显示（带斜体样式标识）
 * H5 端不受影响（此 shim 仅在 mp-* 构建时替换真实 katex）
 */
const katex = {
  renderToString(latex, opts) {
    const tag = opts && opts.displayMode ? 'div' : 'span';
    return '<' + tag + ' style="font-family:serif;font-style:italic;color:#6366f1">' + latex + '</' + tag + '>';
  }
};
export default katex;
