# uni-app 文档摘要缓存

> 项目版本：uni-app 3.0.0-alpha | Vue 3.4.21

## 条件编译语法

- **来源**：https://uniapp.dcloud.net.cn/tutorial/platform.html
- **结论**：`#ifdef MP-WEIXIN` 表示仅在微信小程序编译，`#ifndef MP-WEIXIN` 表示除了微信小程序外都编译。写在 `<template>`、`<script>`、`<style>` 和 `pages.json` 中都有效。注意是注释语法：JS 用 `// #ifdef`，CSS 用 `/* #ifdef */`，HTML 用 `<!-- #ifdef -->`。
- **日期**：2026-03-29

## 页面生命周期 vs 组件生命周期

- **来源**：https://uniapp.dcloud.net.cn/tutorial/page.html#lifecycle
- **结论**：页面有 `onLoad`、`onShow`、`onReady`、`onHide`、`onUnload` 等生命周期，组件没有这些。组件只能用 Vue 的 `onMounted`、`onUnmounted` 等。在 `<script setup>` 中用 `import { onLoad, onShow } from '@dcloudio/uni-app'`。
- **日期**：2026-03-29

## 分包配置

- **来源**：https://uniapp.dcloud.net.cn/collocation/pages.html#subpackages
- **结论**：`pages.json` 中 `subPackages` 数组配置分包，每个分包有 `root`（分包根目录）和 `pages`（分包页面列表）。主包不超过 2MB，每个分包不超过 2MB，总计不超过 20MB。静态资源也算在包大小里。
- **日期**：2026-03-29

## canvas-confetti 微信小程序不支持

- **来源**：项目已知坑
- **结论**：`canvas-confetti` 库依赖 DOM Canvas API，微信小程序中不可用。本项目用 `mp-confetti.js`（CSS 动画方案）替代。
- **日期**：2026-03-29
