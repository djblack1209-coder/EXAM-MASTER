# DOC-FETCH-RULES — 官方文档强制查阅规则

> 版本：2.0 | 适用对象：所有 AI 助手
>
> **一句话原则**：AI 的训练数据有截止日期，写代码前必须查官方文档，以文档为唯一真相。

---

## 第零条：优先级铁律

```
AI 训练记忆 < 项目已有代码 < 官方文档 < 官方 GitHub 源码
```

冲突时永远以右侧为准。禁止用"我记得"跳过文档查阅。

---

## 第一条：查还是不查？三级分类

不是每次调用 API 都要拉文档——那样效率太低。按以下分级执行：

### 🔴 必查（不查 = 修改不可信）

| 场景                                     | 原因                               |
| ---------------------------------------- | ---------------------------------- |
| 第一次使用某 API / 某功能                | 零经验，必须确认签名               |
| 遇到报错                                 | 先查官方 Issue，不猜原因           |
| 安装/升级依赖包                          | 必须读 Breaking Changes            |
| 写 MongoDB 聚合管道 / 复杂查询           | 操作符语法极易出错                 |
| 微信小程序平台特有 API                   | 平台差异大，必须查                 |
| 修改构建配置（Vite / ESLint / tsconfig） | 配置项版本敏感                     |
| 修复已经修了两次以上的 Bug               | 说明之前的修法有问题，必须回到文档 |

### 🟡 建议查（不确定就查）

| 场景                         | 原因                         |
| ---------------------------- | ---------------------------- |
| API 参数超过 3 个            | 参数顺序/类型容易记混        |
| 使用不常见的 Vue 3 内置组件  | Teleport/Suspense 等用法特殊 |
| 跨组件通信（provide/inject） | 响应式丢失是常见坑           |
| Store 在组件外使用           | Pinia 有特殊要求             |

### 🟢 不用查

| 场景                                           | 原因                         |
| ---------------------------------------------- | ---------------------------- |
| `ref()` / `reactive()` / `computed()` 基础用法 | 项目中已有大量正确用例可参考 |
| `console.log()` 等 JS 原生 API                 | 无版本差异                   |
| 项目中已有 5 处以上正确用例的模式              | 复制已验证的模式即可         |

---

## 第二条：怎么查？三层查阅策略

按效率从高到低，优先用上层，上层不够再往下走：

### 第 1 层：Context7 精准查询（优先使用）

本项目已接入 Context7 文档查询工具，能精准返回特定 API 的代码片段，不浪费上下文窗口。

```
# 步骤 1：解析库 ID
context7_resolve_library_id("pinia", "如何在组件外使用 store")

# 步骤 2：精准查询
context7_query_docs("/vuejs/pinia", "在路由守卫中使用 store 的正确方式")
```

**适用场景**：查特定 API 用法、查特定功能的代码示例。

### 第 2 层：本地文档摘要缓存

高频易错点的关键结论预存在 `docs/doc-cache/` 目录中，AI 优先读本地缓存。

```
# 目录结构
docs/doc-cache/
├── README.md          ← 缓存使用说明
├── vue3.md            ← Vue 3 高频易错点摘要
├── pinia.md           ← Pinia 关键用法摘要
├── uniapp.md          ← uni-app 平台差异摘要
├── mongodb.md         ← MongoDB 查询/聚合摘要
├── wechat-mp.md       ← 微信小程序 API 摘要
├── eslint-v9.md       ← ESLint v9 flat config 摘要
└── typescript.md      ← TypeScript 配置和类型工具摘要
```

**适用场景**：已知的高频坑点、项目特有的配置约定。
**维护规则**：每次通过在线文档解决了一个坑，把结论追加到对应缓存文件中。

### 第 3 层：在线拉取官方文档（兜底）

Context7 查不到、本地缓存没覆盖时，才用 `web_fetch` 拉取官方文档。

```
# 拉取时注意：只拉特定页面，不拉首页/目录页
web_fetch("https://pinia.vuejs.org/zh/core-concepts/outside-component-usage.html")
# ✅ 好：精准页面

web_fetch("https://pinia.vuejs.org/zh/")
# ❌ 差：首页内容太多，浪费上下文
```

---

## 第三条：版本锁定文档索引

> 版本号来自项目 `package.json`，非"最新"。查文档时必须对照此版本。

### 前端核心

| 技术               | 项目版本    | Context7 ID         | 官方文档                               |
| ------------------ | ----------- | ------------------- | -------------------------------------- |
| **Vue 3**          | 3.4.21      | `/vuejs/core`       | https://cn.vuejs.org/api/              |
| **Pinia**          | 2.1.7       | `/vuejs/pinia`      | https://pinia.vuejs.org/zh/            |
| **uni-app**        | 3.0.0-alpha | `/dcloudio/uni-app` | https://uniapp.dcloud.net.cn/          |
| **Vite**           | 5.2.8       | `/vitejs/vite`      | https://cn.vitejs.dev/config/          |
| **wot-design-uni** | ^1.14.0     | —                   | https://wot-design-uni.netlify.app/    |
| **ECharts**        | 5.x         | `/apache/echarts`   | https://echarts.apache.org/zh/api.html |
| **KaTeX**          | ^0.16.38    | —                   | https://katex.org/docs/supported.html  |

### 后端与运行时

| 技术           | 项目版本  | Context7 ID             | 官方文档                                   |
| -------------- | --------- | ----------------------- | ------------------------------------------ |
| **TypeScript** | 5.x       | `/microsoft/TypeScript` | https://www.typescriptlang.org/docs/       |
| **Node.js**    | >=20.17.0 | `/nodejs/node`          | https://nodejs.org/docs/latest-v20.x/api/  |
| **Express.js** | 4.x       | `/expressjs/express`    | https://expressjs.com/zh-cn/4x/api.html    |
| **MongoDB**    | 7.x       | `/mongodb/docs`         | https://www.mongodb.com/zh-cn/docs/manual/ |

### 测试工具

| 技术                | 项目版本 | Context7 ID             | 官方文档                          |
| ------------------- | -------- | ----------------------- | --------------------------------- |
| **Vitest**          | ^4.0.18  | `/vitest-dev/vitest`    | https://cn.vitest.dev/            |
| **Playwright**      | ^1.57.0  | `/microsoft/playwright` | https://playwright.dev/docs/intro |
| **@vue/test-utils** | ^2.4.6   | —                       | https://test-utils.vuejs.org/     |

### 工具链

| 技术                  | 项目版本                 | 官方文档                          |
| --------------------- | ------------------------ | --------------------------------- |
| **ESLint**            | ^9.39.2 (v9 flat config) | https://eslint.org/docs/latest/   |
| **eslint-plugin-vue** | ^10.7.0                  | https://eslint.vuejs.org/         |
| **Prettier**          | ^3.5.3                   | https://prettier.io/docs/en/      |
| **Husky**             | ^9.1.7                   | https://typicode.github.io/husky/ |

### 平台 API

| 平台               | 官方文档                                                    |
| ------------------ | ----------------------------------------------------------- |
| **微信小程序 API** | https://developers.weixin.qq.com/miniprogram/dev/api/       |
| **微信小程序框架** | https://developers.weixin.qq.com/miniprogram/dev/reference/ |
| **QQ 小程序 API**  | https://q.qq.com/wiki/develop/miniprogram/API/              |

### 运维

| 技术                   | 官方文档                                          |
| ---------------------- | ------------------------------------------------- |
| **Nginx**              | https://nginx.org/en/docs/                        |
| **PM2**                | https://pm2.keymetrics.io/docs/usage/quick-start/ |
| **Docker**             | https://docs.docker.com/                          |
| **Cloudflare Workers** | https://developers.cloudflare.com/workers/        |

---

## 第四条：文档查阅标准流程

```
收到任务
  │
  ├─ 识别涉及哪些技术 → 按第一条分级判断"查不查"
  │
  ├─ 🔴 必查 / 🟡 不确定
  │     │
  │     ├─ 第1层：Context7 精准查询（优先）
  │     │     └─ 找到 → 确认 API 签名 → 开始写代码
  │     │
  │     ├─ 第2层：读 docs/doc-cache/ 对应文件
  │     │     └─ 有对应条目 → 确认后开始写代码
  │     │
  │     └─ 第3层：web_fetch 拉取官方特定页面
  │           └─ 找到 → 确认 + 把关键结论追加到 doc-cache → 开始写代码
  │
  └─ 🟢 不用查 → 直接写代码（参考项目中已有正确用例）
```

---

## 第五条：报错处理 — 先查后改

遇到报错，**禁止凭经验直接改**，必须按以下顺序：

```
1. 完整复制报错信息
2. 识别报错来自哪个库（看 stack trace）
3. 查项目当前使用的版本号（package.json）
4. Context7 查询该库对应报错的解决方案
5. 查不到 → GitHub Issues 搜索报错关键词
6. 确认是否为已知 bug → 查 Changelog
7. 基于文档给出修复方案
8. 修复 + 运行验证
```

**特殊规则**：如果同一个 Bug 修了两次还没修好，必须回到第 4 步重新查文档，不允许继续"试错式修复"。

---

## 第六条：禁止行为

| 禁止                            | 原因                               |
| ------------------------------- | ---------------------------------- |
| 凭记忆写 API 参数名             | 版本不同参数可能已变               |
| 从已有的错误代码复制粘贴        | 会扩散 bug                         |
| 没查文档就说"应该可以"          | 猜测不是工程                       |
| 跳过 Changelog 直接升级依赖     | Breaking Change 会导致崩溃         |
| 用第三方博客替代官方文档        | 博客可能过时                       |
| `web_fetch` 拉取文档首页/目录页 | 内容太多浪费上下文，必须拉特定页面 |

---

## 第七条：文档缓存维护规则

`docs/doc-cache/` 目录是"经验库"——每次通过查文档解决了问题，把结论沉淀下来：

```markdown
# 追加格式示例（追加到 docs/doc-cache/pinia.md）

## storeToRefs 在 setup store 中的用法

- 来源：https://pinia.vuejs.org/zh/core-concepts/#using-the-store
- 结论：在 setup store 中，必须用 storeToRefs() 解构才能保持响应式，直接解构会丢失响应式
- 日期：2026-03-29
```

**维护时机**：

- 修完一个因文档不熟导致的 bug → 追加
- 发现版本升级导致的 Breaking Change → 追加
- 发现项目特有的平台差异坑 → 追加

**不追加的情况**：

- JS 原生 API（不会变）
- 项目中已有 5 处以上正确用例的模式（直接参考代码）

---

## 第八条：与现有规则的集成

本规则与 `CLAUDE.md` 和 `AI-DEV-RULES.md` 并行生效：

**AI-DEV-RULES Rule 1（Read Before Code）扩展为**：

```
1. 读 CLAUDE.md
2. 读 docs/status/HEALTH.md
3. 读 docs/AI-SOP/MODULE-INDEX.md
4.【新增】按第一条分级判断，查阅对应技术的官方文档
5. 开始写代码
```

**CHANGE-LOG 更新时**，如果本次修改参考了文档，追加一行：

```markdown
- 参考文档：[文档名称](URL)
```

---

## 附录：版本更新检查清单

每次升级 `package.json` 中的依赖版本后，必须同步更新：

1. 本文件第三条中的"项目版本"列
2. `docs/doc-cache/` 中对应技术的缓存文件（标记旧版内容、补充新版变化）
3. 运行完整质量关卡（lint + test + build）确认升级无破坏
