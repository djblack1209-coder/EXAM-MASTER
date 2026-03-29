# Pinia 文档摘要缓存

> 项目版本：Pinia 2.1.7 | Vue 3.4.21

## storeToRefs 解构保持响应式

- **来源**：https://pinia.vuejs.org/zh/core-concepts/#using-the-store
- **结论**：直接解构 store 会丢失响应式。必须用 `storeToRefs(store)` 解构 state 和 getters。actions 不需要 storeToRefs，直接解构即可。
- **日期**：2026-03-29

## 组件外使用 Store（路由守卫/工具函数）

- **来源**：https://pinia.vuejs.org/zh/core-concepts/outside-component-usage.html
- **结论**：在 `setup()` 之外使用 store（比如路由守卫、工具函数里），必须确保 Pinia 实例已经创建并安装到 app 上。否则会报 `getActivePinia was called with no active Pinia`。解法：在函数内部调用 `useXxxStore()`，不要在模块顶层调用。
- **日期**：2026-03-29

## Setup Store 语法

- **来源**：https://pinia.vuejs.org/zh/core-concepts/#setup-stores
- **结论**：本项目统一使用 setup store 语法（`defineStore('id', () => { ... })`）。ref() 变成 state，computed() 变成 getters，function 变成 actions。
- **日期**：2026-03-29
