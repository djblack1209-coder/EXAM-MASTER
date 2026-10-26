// 原生导航 API 要求实色字符串，由构建从唯一 SCSS 源注入。
// 不另存色板，不在运行时加载或解析样式源码。
const primitives = __YOZI_TOKENS__;
export const tokens = Object.freeze({
  light: Object.freeze(primitives.light),
  dark: Object.freeze(primitives.dark)
});

export const museTokens = Object.freeze(primitives.muse);
