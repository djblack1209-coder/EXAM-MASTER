/**
 * highlight.js 微信小程序降级 shim
 * 代码不做语法高亮，原样显示
 * H5 端不受影响（此 shim 仅在 mp-* 构建时替换真实 highlight.js）
 */
const hljs = {
  registerLanguage() {},
  highlight(code) {
    return { value: code };
  },
  getLanguage() {
    return null;
  }
};
export default hljs;
