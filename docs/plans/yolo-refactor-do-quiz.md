# YOLO 模式重构计划: 拆解 do-quiz.vue

## 任务 1: 抽离 UI 渲染组件 (Question Renderer)
**目标文件:** `src/pages/practice-sub/do-quiz.vue`
**操作:** 
1. 在 `src/pages/practice-sub/components/` 目录下创建专门针对不同题型的渲染组件（如 `QuestionChoice.vue` 用于单选/多选，`QuestionEssay.vue` 用于简答/填空）。
2. 将 `do-quiz.vue` 中的对应模板片段（`<template>`）转移到这些子组件中。
3. 保证这些子组件通过 `props` 接收题目数据，通过 `emits` 传递用户选择的答案。

## 任务 2: 抽离 FSRS 和核心逻辑为 Composables
**目标文件:** `src/pages/practice-sub/do-quiz.vue`
**操作:** 
1. 创建 `src/pages/practice-sub/composables/useQuizEngine.js` 和 `src/pages/practice-sub/composables/useFSRS.js`（如果尚未存在）。
2. 将混杂在 `do-quiz.vue` 中的答题控制逻辑（例如计分、判题、生成自适应题序）剥离出来。
3. 在 `do-quiz.vue` 中导入这些 Composables。

## 任务 3: 移除性能毒药 (UX 优化)
**目标文件:** `src/pages/practice-sub/do-quiz.vue` 和 `src/pages/practice-sub/styles/`
**操作:**
1. 找出所有带有 `backdrop-filter: blur` 的毛玻璃类（如 `.apple-glass-card`, `.aurora-bg`）并进行轻量化降级（例如使用纯色半透明背景 `rgba`），或者通过媒体查询针对小程序端直接屏蔽复杂滤镜。
2. 简化动画层，确保只使用 `transform` 和 `opacity` 进行 GPU 加速。
