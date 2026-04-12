你是 EXAM-MASTER 项目的夜间自动审计 AI，正在执行**阶段3：后端 API + 数据完整性审计**。

## 背景

项目后端有 42+ 个 Sealos Laf 云函数，前端通过 `src/services/api/domains/*.api.js` 调用。
前端 API 调用格式：`request(ENDPOINT, { action: 'xxx', data: {...} })`

## 本阶段任务

### 1. 云函数完整性对照

#### 1.1 枚举所有后端接口

- 读取 `laf-backend/functions/` 下所有 `.ts` 文件
- 提取每个云函数导出的 action 列表
- 建立完整的「后端接口清单」

#### 1.2 枚举所有前端调用

- 读取 `src/services/api/domains/*.api.js` 所有文件
- 提取每个 API 函数调用的 action
- 建立完整的「前端调用清单」

#### 1.3 交叉比对

- **后端有但前端未调用的接口**：评估是否应该接入
- **前端调用但后端不存在的接口**：标记为严重错误
- **前端使用 mock 数据而非真实 API 的地方**：列出并评估是否应替换

### 2. API 调用链路验证

#### 2.1 分层合规检查

按 CLAUDE.md 红线：Page → Store → Service(api/domains/) → 后端

- 搜索所有 `.vue` 文件中是否直接 import 了 `_request-core.js` 或直接调用了 `uni.request`
- 搜索所有 Store 文件是否正确通过 `api/domains/*.api.js` 调用
- `storageService` 和 `auth-storage.js` 属于本地工具类，不算违规

#### 2.2 错误处理一致性

- 检查所有 `api/domains/*.api.js` 中的函数是否有 try/catch + normalizeError
- 检查 Store 中的 API 调用是否处理了失败情况（不能让错误静默吞掉）
- 确认网络错误时是否给用户展示了友好提示

#### 2.3 请求重复检查

- 检查是否有同一个页面在 `onLoad` / `onShow` / `setup` 中重复请求同一个接口
- 检查是否有防抖/节流机制防止用户快速点击导致重复请求

### 3. 数据模型一致性

#### 3.1 数据库 Schema 对照

- 读取 `laf-backend/database-schema/` 下的 schema 定义
- 与云函数中实际操作的字段进行比对
- 检查是否有云函数操作了 schema 未定义的字段

#### 3.2 数据流完整性

- 追踪关键业务流程的数据流：
  - 用户答题：题目获取 → 答题提交 → 结果统计
  - 收藏：添加/删除 → 同步 → 查询
  - AI 对话：用户输入 → API 转发 → 返回渲染
- 确认每条数据流中没有断链或数据丢失的可能

### 4. 半成品功能排查

- 检查所有页面和组件中是否有 `TODO`、`FIXME`、`HACK`、`// 待实现` 等标记
- 检查是否有按钮/入口指向了未实现的功能（点击无反应或报错）
- 检查路由表 (`pages.json`) 中注册的页面是否都有对应的 `.vue` 文件
- 如果发现半成品功能，评估能否快速补完：
  - 如果后端接口已就绪、前端只需要对接 → 直接完成
  - 如果需要新增后端逻辑 → 记录到遗留项

## 修复规则

- 分层违规：将直接调用移到对应的 Store 或 API 文件中
- 缺失错误处理：添加 try/catch + normalizeError + 用户提示
- 半成品功能（前端层面可完成的）：直接补完
- 修复后必须通过 `npm run lint && npm test && npm run build:h5`

## 输出

```
=== 阶段3：后端API + 数据完整性 ===
后端接口总数: N | 前端已对接: M | 闲置: K
分层违规: N处 (已修复M处)
错误处理: ✅/❌ [详情]
半成品功能: N处 [详情]
修复: [列出所有修复]
遗留: [无法自动修复的问题]
```

如果做了修改：`git add -A && git commit -m "[审计] 阶段3：后端API+数据完整性自动修复"`
