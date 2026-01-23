## 问题分析

报错信息：`TypeError: this.loadTasks is not a function` 发生在 `refreshData` 方法中，该方法在 `onShow` 生命周期钩子中被调用。

## 根本原因

在 `pages/index/index.vue` 文件中：
1. `refreshData` 方法（第617行）调用了 `this.loadTasks()`
2. 但组件的 `methods` 中没有定义 `loadTasks` 方法
3. 任务列表是通过 `todoStore` 管理的，组件中使用了 `this.todoStore.sortedTasks` 来获取任务列表
4. 在 `created` 生命周期钩子中调用了 `this.todoStore.initTasks()` 来初始化任务

## 修复方案

将 `refreshData` 方法中的 `this.loadTasks()` 替换为 `this.todoStore.initTasks()`，因为任务列表的刷新应该通过 todoStore 来完成。

## 修复步骤

1. 打开 `pages/index/index.vue` 文件
2. 定位到 `refreshData` 方法（第617行）
3. 将 `this.loadTasks()` 替换为 `this.todoStore.initTasks()`
4. 保存文件

## 预期效果

修复后，当页面显示时，`onShow` 方法会调用 `refreshData` 方法，其中会正确调用 `this.todoStore.initTasks()` 来刷新任务列表，而不会触发 `this.loadTasks is not a function` 错误。