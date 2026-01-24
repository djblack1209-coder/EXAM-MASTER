# Bug #003: 首页空白显示问题

**发现时间**: 2026-01-24 07:04  
**优先级**: P1 - High  
**状态**: 🔧 深度调查中 - 临时修复无效

---

## 🐛 问题描述

H5环境成功启动后，访问首页 `http://localhost:5173/` 显示完全空白的页面。

### 现象
- ✅ Vite开发服务器正常运行
- ✅ 页面成功加载（无404错误）
- ✅ Vite HMR连接成功
- ✅ LafService配置正常
- ❌ 页面内容完全不显示（纯白屏）

### 控制台日志
```
[vite] connecting...
[vite] connected.
[LafService] 🔧 配置信息: JSHandle@object
Failed to load resource: the server responded with a status of 404 (Not Found)
```

---

## 🔍 可能原因分析

### 1. 骨架屏未正确隐藏 (最可能)
**文件**: `src/pages/index/index.vue`

**问题代码**:
```vue
<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <!-- 骨架屏 -->
    <base-skeleton v-if="isLoading" :is-dark="isDark"></base-skeleton>
    
    <!-- 实际内容 -->
    <view v-else class="content-container">
      <!-- 页面内容 -->
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      isLoading: true,  // 初始为true
      // ...
    }
  },
  methods: {
    loadData() {
      // ...
      setTimeout(() => {
        this.isLoading = false;  // 500ms后隐藏
      }, 500);
    }
  }
}
</script>
```

**分析**:
- `isLoading` 初始值为 `true`
- `loadData()` 方法应该在500ms后设置为 `false`
- 如果 `loadData()` 未被调用或执行失败，骨架屏将一直显示

### 2. 路由配置问题
**文件**: `pages.json`

首页路由配置：
```json
{
  "path": "src/pages/index/index",
  "style": {
    "navigationBarTitleText": "Exam Master",
    "navigationStyle": "custom"
  }
}
```

**分析**:
- 路由路径正确
- 但H5环境可能需要不同的路径格式

### 3. 组件依赖问题
首页依赖的组件：
- `CustomTabbar` - 自定义底部导航
- `BaseSkeleton` - 骨架屏
- `StudyOverview` - 学习概况

如果任何组件加载失败，可能导致整个页面无法渲染。

### 4. 样式问题
首页使用了大量CSS变量和复杂样式（2000+行），可能存在：
- CSS变量未正确初始化
- 深色模式样式冲突
- 响应式布局问题

---

## 🔧 调试步骤

### Step 1: 检查生命周期调用
在 `src/pages/index/index.vue` 中添加调试日志：

```javascript
onLoad(options) {
  console.log('[index] onLoad called', options);
  // ...
},

onShow() {
  console.log('[index] onShow called');
  // ...
},

loadData() {
  console.log('[index] loadData called');
  console.log('[index] isLoading before:', this.isLoading);
  // ...
  setTimeout(() => {
    this.isLoading = false;
    console.log('[index] isLoading after:', this.isLoading);
  }, 500);
}
```

### Step 2: 简化首页内容
创建最小可复现版本：

```vue
<template>
  <view class="test-container">
    <text>Hello World - 首页测试</text>
  </view>
</template>

<script>
export default {
  onLoad() {
    console.log('首页加载成功');
  }
}
</script>

<style>
.test-container {
  padding: 20px;
  background: white;
}
</style>
```

### Step 3: 检查组件加载
验证依赖组件是否正常：

```javascript
import CustomTabbar from '../../components/custom-tabbar/custom-tabbar.vue';
import BaseSkeleton from '../../components/base-skeleton/base-skeleton.vue';

console.log('CustomTabbar:', CustomTabbar);
console.log('BaseSkeleton:', BaseSkeleton);
```

### Step 4: 检查路由跳转
尝试直接访问其他页面：
- `http://localhost:5173/#/pages/practice/index`
- `http://localhost:5173/#/pages/profile/index`

如果其他页面正常，说明是首页特定问题。

---

## 💡 临时解决方案

### 方案1: 强制隐藏骨架屏
```javascript
data() {
  return {
    isLoading: false,  // 直接设置为false
    // ...
  }
}
```

### 方案2: 移除骨架屏
```vue
<template>
  <view :class="['container', { 'dark-mode': isDark }]">
    <!-- 直接显示内容，不使用骨架屏 -->
    <view class="content-container">
      <!-- 页面内容 -->
    </view>
  </view>
</template>
```

### 方案3: 添加超时保护
```javascript
onLoad() {
  this.loadData();
  
  // 超时保护：5秒后强制隐藏骨架屏
  setTimeout(() => {
    if (this.isLoading) {
      console.warn('[index] 骨架屏超时，强制隐藏');
      this.isLoading = false;
    }
  }, 5000);
}
```

---

## 📊 影响评估

### 用户影响
- **影响范围**: 100% H5用户
- **严重程度**: 高 - 无法访问首页
- **降级方案**: 可直接访问其他页面（如果路由正常）

### 开发影响
- **阻塞功能测试**: 是
- **阻塞UI验证**: 是
- **阻塞性能测试**: 是

---

## 🔧 已尝试的修复

### 修复 #1: 强制隐藏骨架屏 ❌ 无效
**时间**: 2026-01-24 07:05

**修改**:
```javascript
data() {
  return {
    isLoading: false,  // 直接设置为false，跳过骨架屏
    // ...
  }
}
```

**结果**: 页面依然完全空白，说明问题不是骨架屏导致的。

### 调查发现

1. **路由配置正常**: `pages.json` 中首页路径正确
2. **设计系统文件存在**: `design-system.scss` 正常加载
3. **App.vue 正常**: 根组件配置无误
4. **控制台无明显错误**: 只有一个404资源加载失败

### 可能的根本原因

#### 1. CSS 渲染问题 (最可能)
页面可能被渲染了，但CSS导致内容不可见：
- 容器高度为0
- 内容被定位到屏幕外
- z-index层级问题
- 颜色与背景色相同

#### 2. Vue 组件挂载失败
组件可能没有正确挂载到DOM：
- 生命周期钩子未触发
- 模板编译错误
- 组件依赖加载失败

#### 3. H5 平台特定问题
uni-app H5编译可能存在问题：
- `<view>` 标签未正确转换为 `<div>`
- uni-app API在H5环境不兼容
- Vite构建配置问题

## 🎯 下一步行动

1. **创建最小化测试页面**: 排除复杂组件干扰
2. **检查浏览器开发者工具**: 查看DOM结构和CSS
3. **添加console.log**: 确认生命周期执行
4. **检查Vite配置**: 确认H5构建配置正确

---

**记录人**: Cline AI Assistant  
**更新时间**: 2026-01-24 07:04
