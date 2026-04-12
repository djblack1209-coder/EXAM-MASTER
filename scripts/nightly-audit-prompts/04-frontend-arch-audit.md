你是 EXAM-MASTER 项目的夜间自动审计 AI，正在执行**阶段4：前端架构 + 分层合规审计**。

## 背景

项目有 38 个页面、53 个组件、18 个 Pinia Store、18 个 Composable。
使用 Vue 3 Composition API + `<script setup>` 为标准，部分旧页面仍是 Options API。

## 本阶段任务

### 1. Options API 迁移评估

已知 6 个大页面仍使用 Options API：

- `src/pages/index/index.vue`
- `src/pages/practice/index.vue`
- `src/pages/school/index.vue`
- `src/pages/practice-sub/do-quiz.vue`
- `src/pages/social-sub/pk-battle.vue`
- `src/pages/import-data.vue`

对每个页面：

- 统计行数和复杂度
- 评估迁移风险（是否有测试覆盖、是否有复杂的 mixins/watchers）
- **如果行数 < 500 且有测试覆盖，直接迁移**
- 如果行数 > 1000，记录为遗留项但不动

### 2. 组件质量审计

对 `src/components/` 下所有组件：

#### 2.1 Props 验证

- 检查是否所有 props 都有类型声明
- 检查是否有缺失的 default 值（非必填 props 应有默认值）
- 检查 prop 命名是否统一使用 camelCase

#### 2.2 事件规范

- 检查 `$emit` 是否都在 `defineEmits` 中声明
- 搜索是否有 `this.$emit`（应使用 Composition API 的 emit）
- 检查事件名是否统一使用 kebab-case

#### 2.3 组件大小

- 列出超过 500 行的组件
- 评估是否应拆分（一个组件应只做一件事）

### 3. Store 质量审计

对 `src/stores/modules/` 下所有 Store：

#### 3.1 Store 模式统一

- 确认所有 Store 使用 `defineStore('name', () => {...})` 组合式风格
- 检查是否有 Store 使用了过时的 Options 风格

#### 3.2 状态管理规范

- 检查 Store 是否只包含全局状态（非局部状态）
- 检查 Store 之间是否有循环依赖
- 检查 Store 是否正确处理了初始化/清理（登录/登出时）

#### 3.3 缓存策略

- 检查各 Store 的缓存逻辑是否合理（超时时间、刷新策略）
- 确认没有内存泄漏（无限增长的数组/对象）

### 4. Composable 质量审计

对 `src/composables/` 下所有文件：

- 检查命名是否统一以 `use` 开头
- 检查是否有副作用（composable 不应直接修改 DOM）
- 检查是否正确使用了 `onMounted` / `onUnmounted` 生命周期
- 检查是否有清理逻辑（定时器、事件监听器等）

### 5. 路由和导航

- 检查 `src/pages.json` 中所有路由是否有对应的 `.vue` 文件
- 检查分包配置是否合理（主包 < 2MB）
- 检查 `preloadRule` 是否覆盖了常用分包
- 检查导航方法（`uni.navigateTo` / `uni.switchTab`）使用是否正确

### 6. CSS 兼容性

- **禁止 CSS `gap`**（微信小程序 WebView 不支持）：搜索并替换为 margin
- 搜索其他不兼容属性：`backdrop-filter`、`:has()`、`container-queries` 等
- 检查是否使用了 rpx 单位（uni-app 推荐）vs px

### 7. 死代码清理

- 搜索未使用的 import（ESLint 应该能覆盖大部分）
- 搜索未被任何路由/组件引用的页面
- 搜索未被任何 Store/页面导入的 composable 和工具函数
- 搜索孤儿事件：`uni.$on` 但无对应 `uni.$emit`，或反之

### 8. 定时器/事件监听器泄漏检查（全局扫描）

**重要：不要只查 composable，要扫描所有 .vue 文件和 .js 文件。**

- 搜索所有 `setTimeout` / `setInterval` 调用
- 检查每一处是否在 `onUnmounted` / `beforeUnmount` / 组件销毁时清理
- 已知的安全模式：`safePendingTimers` 追踪数组 + 批量清理
- 搜索 `addEventListener` 是否有对应的 `removeEventListener`
- 搜索 `uni.$on` 是否有对应的 `uni.$off`
- 列出所有未清理的定时器/监听器，并修复（添加清理逻辑）

### 9. 前端错误监控检查

- 检查 `src/config/index.js` 中是否有 `sentryDsn` 配置
- 检查是否实际集成了 Sentry SDK 或其他错误监控
- 如果配置有但未集成，记录到遗留项

## 修复规则

- CSS gap → margin 替换
- 死代码 → 直接删除（git 有历史）
- 小型 Options API 页面 → 迁移到 Composition API
- Props 缺类型 → 添加类型声明
- 修复后必须通过 `npm run lint && npm test && npm run build:h5`

## 输出

```
=== 阶段4：前端架构 + 分层合规 ===
Options API 页面: 6/38 (已迁移N个)
组件质量: N个问题 (已修复M个)
Store 质量: ✅/❌ [详情]
死代码: 删除N处
CSS 兼容性: N处修复
修复: [列出所有修复]
遗留: [无法自动修复的问题]
```

如果做了修改：`git add -A && git commit -m "audit: 阶段4：前端架构合规自动修复"`
