# Bug-003 根本原因确认！

## 时间
2026-01-24 08:38

## 🎯 根本原因
**App.vue 在 H5 平台必须有 `<template>` 部分！**

## 测试结果对比

### ❌ 原始 App.vue（空白页面）
```vue
<script>
// 只有 script 和 style，没有 template
export default {
  onLaunch() { ... }
}
</script>

<style>
/* 样式 */
</style>
```
**结果：空白页面**

### ✅ 修复后 App.vue（正常显示）
```vue
<template>
    <view class="app">
        <text>Hello UniApp H5!</text>
    </view>
</template>

<script>
export default {
    onLaunch() {
        console.log('[App] Launch')
    }
}
</script>

<style>
.app {
    padding: 20px;
    font-size: 16px;
}
</style>
```
**结果：✅ 成功显示内容**

## 关键发现

### 1. UniApp H5 vs 小程序的差异
- **小程序平台**：App.vue 不需要 template（因为有 pages.json 管理页面）
- **H5 平台**：App.vue 必须有 template 作为根容器

### 2. 问题不在这些地方
- ❌ 不是 Pinia 的问题
- ❌ 不是 main.js 的问题
- ❌ 不是路由配置的问题
- ✅ 是 App.vue 缺少 template

### 3. 为什么之前没发现
- 原始代码可能是从小程序项目迁移过来的
- 小程序不需要 App.vue 的 template
- H5 平台需要一个根容器来挂载内容

## 正确的 App.vue 结构（H5 平台）

```vue
<template>
    <view class="app">
        <!-- UniApp 会在这里渲染页面内容 -->
        <router-view v-if="false" />
        <!-- 注意：实际上不需要 router-view，UniApp 有自己的页面管理 -->
    </view>
</template>

<script>
import { useUserStore } from './src/stores'
import { qa, injectInterceptor, hookSetData } from './src/utils/debug/qa.js'

// 必须在 App() 之前执行
injectInterceptor()
hookSetData()

export default {
    onLaunch() {
        console.log('App Launch')
        // ... 其他初始化逻辑
    },
    // ... 其他方法
}
</script>

<style lang="scss">
/* 全局样式 */
@import '@/common/styles/common.scss';

page {
    height: 100%;
    background-color: var(--bg-main);
    color: var(--text-body);
}

.app {
    height: 100%;
}
</style>
```

## 修复方案

### 最小修改（推荐）
只需在原始 App.vue 顶部添加：

```vue
<template>
    <view class="app"></view>
</template>
```

### 完整修复
1. 添加 template 部分
2. 保留所有原有的 script 逻辑
3. 保留所有原有的 style 样式

## 技术洞察

### UniApp 跨平台差异
```
小程序平台：
App.vue (script + style) → pages.json → 各个页面

H5 平台：
App.vue (template + script + style) → 页面内容挂载到 template
```

### Vue 3 SSR 警告的原因
```
[Vue warn]: Attempting to hydrate existing markup but container is empty.
```
这个警告出现是因为：
1. Vue 尝试在 `<div id="app">` 中查找内容
2. 但 App.vue 没有 template，所以容器是空的
3. Vue 只能执行完整挂载（full mount）而不是水合（hydrate）

## 状态
🎉 **根本原因已确认！修复方案明确！**

下一步：应用修复并验证完整功能。
