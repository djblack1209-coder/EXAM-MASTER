# ESLint v9 文档摘要缓存

> 项目版本：ESLint ^9.39.2 | eslint-plugin-vue ^10.7.0

## Flat Config 与 v8 .eslintrc 完全不同

- **来源**：https://eslint.org/docs/latest/use/configure/configuration-files
- **结论**：ESLint v9 使用 `eslint.config.js`（flat config），导出一个数组。不再支持 `.eslintrc.*` 文件。配置结构：`[{ files: [...], rules: {...} }]`。不再有 `env`、`extends`、`overrides` 等字段。插件通过 `import` 引入，不再用字符串名称。
- **日期**：2026-03-29

## eslint-plugin-vue 在 flat config 中的配置

- **来源**：https://eslint.vuejs.org/user-guide/#usage
- **结论**：`import pluginVue from 'eslint-plugin-vue'` 然后在配置数组中展开 `...pluginVue.configs['flat/recommended']`。不再用 `extends: ['plugin:vue/vue3-recommended']` 这种旧语法。
- **日期**：2026-03-29
