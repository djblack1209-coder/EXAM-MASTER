# wot-design-uni 文档摘要缓存

> 项目版本：wot-design-uni ^1.14.0

## 组件按需引入

- **来源**：https://wot-design-uni.netlify.app/guide/quick-use.html
- **结论**：本项目使用 `easycom` 自动按需引入 wot-design-uni 组件，在 `pages.json` 中配置了 easycom 规则。使用时直接在 template 中写 `<wd-button>` 即可，不需要手动 import。
- **日期**：2026-03-29

## 组件样式覆盖

- **来源**：https://wot-design-uni.netlify.app/guide/custom-style.html
- **结论**：优先用组件提供的 `custom-class` 和 `custom-style` props 覆盖样式。如果需要深度覆盖，使用 `:deep()` 选择器。避免直接修改组件库源码。
- **日期**：2026-03-29
