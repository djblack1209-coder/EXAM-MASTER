# Bug-003 更深层分析

## 时间
2026-01-24 08:40

## 问题
添加了 `<template><view class="app"></view></template>` 后，页面仍然空白。

## 分析

### UniApp H5 渲染机制
在 UniApp H5 模式下：
1. `index.html` 有 `<div id="app"></div>`
2. Vue 应用挂载到这个 div
3. App.vue 的 template 被渲染到 #app
4. **但是页面内容需要通过 UniApp 的路由系统渲染**

### 关键问题
App.vue 的 template 只是一个容器，实际页面内容应该由：
- pages.json 定义的页面
- UniApp 的路由系统
- 自动渲染到 App.vue 的 template 中

### 可能的原因
1. **App.vue 的 template 需要特殊标记让 UniApp 知道在哪里渲染页面**
2. 或者 UniApp 会自动将页面内容注入到 template 的根元素中
3. 或者需要使用 `<router-view>` 或类似的组件

## 下一步
查看 UniApp 官方文档或示例项目，了解 App.vue 在 H5 模式下的正确结构。
