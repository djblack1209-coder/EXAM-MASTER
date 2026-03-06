# Exam-Master 阶段A测试建模报告（Round r6）

## 执行快照

- 当前分支：`test-fix/2026-03-03-r6`（符合 `test-fix/<date>-<round>` 规范）
- 本阶段范围：`pages.json`、`src/pages/**/*.vue`、`src/services/lafService.js`、`tests/e2e-regression/**`
- 本阶段动作：仅做测试建模与测试骨架完善，不改业务逻辑

## 环境前置检查

当前本机 Node 版本为 `v18.20.8`，低于项目要求 `>=20.17.0`（见 `package.json:94`）。

一键安装命令：

```bash
source ~/.nvm/nvm.sh && nvm install 20.17.0 && nvm use 20.17.0 && npm ci && npx playwright install chromium
```

成功判定标准：

- `node -v` 输出 `v20.17.0`
- `npm -v` 无 Node 版本告警
- `npx playwright --version` 正常输出版本号

---

## A1 功能地图

### A1.1 页面清单（已注册路由）

来源：`pages.json:2` 与 `pages.json:36`。

- 主包 4 页：
  - `/pages/index/index`
  - `/pages/practice/index`
  - `/pages/school/index`
  - `/pages/profile/index`
- 分包 26 页：
  - `/pages/practice-sub/do-quiz`
  - `/pages/practice-sub/pk-battle`
  - `/pages/practice-sub/rank`
  - `/pages/practice-sub/import-data`
  - `/pages/practice-sub/file-manager`
  - `/pages/practice-sub/mock-exam`
  - `/pages/school-sub/detail`
  - `/pages/splash/index`
  - `/pages/login/index`
  - `/pages/login/wechat-callback`
  - `/pages/login/qq-callback`
  - `/pages/settings/index`
  - `/pages/settings/privacy`
  - `/pages/settings/terms`
  - `/pages/social/friend-list`
  - `/pages/social/friend-profile`
  - `/pages/chat/chat`
  - `/pages/mistake/index`
  - `/pages/favorite/index`
  - `/pages/plan/index`
  - `/pages/plan/create`
  - `/pages/study-detail/index`
  - `/pages/tools/photo-search`
  - `/pages/tools/doc-convert`
  - `/pages/tools/id-photo`
  - `/pages/knowledge-graph/index`

补充发现：`src/pages/school-sub/ai-consult.vue` 存在但未在 `pages.json` 注册，不可直接路由访问。

### A1.2 入口与核心跳转

- 启动入口：`src/pages/splash/index.vue` 重定向到首页（`/pages/index/index`）
- 主导航入口：`pages.json:328` 自定义 TabBar（首页/刷题/择校/我的）
- 首页聚合入口：`src/pages/index/index.vue`（工具入口、计划编辑、推荐项）
- 刷题业务入口：`src/pages/practice/index.vue`（开始刷题、PK、导入、错题、排行榜）
- 我的页入口：`src/pages/profile/index.vue`（设置、统计、打卡、错题、登录）

### A1.3 核心链路（必须可用）

1. 启动链路：`/pages/splash/index -> /pages/index/index`
2. 登录链路：`/pages/login/index -> /pages/login/wechat-callback|qq-callback -> 首页`
3. 刷题闭环：`/pages/practice/index -> /pages/practice-sub/import-data -> /pages/practice-sub/do-quiz -> /pages/mistake/index`
4. 择校闭环：`/pages/school/index -> /pages/school-sub/detail`
5. 工具闭环：`/pages/tools/doc-convert|photo-search|id-photo`

### A1.4 次要链路（次要但高风险）

- `/pages/practice-sub/pk-battle -> /pages/practice-sub/rank`
- `/pages/favorite/index -> /pages/practice-sub/do-quiz`
- `/pages/plan/index -> /pages/plan/create`
- `/pages/social/friend-list -> /pages/social/friend-profile`
- `/pages/knowledge-graph/index -> /pages/practice/index`

### A1.5 重点页面交互/弹窗/API 依赖

| 页面                                     | 关键按钮/操作                            | 表单输入              | 弹窗/状态层                                                                  | 路由跳转                             | 依赖接口                                          |
| ---------------------------------------- | ---------------------------------------- | --------------------- | ---------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------- |
| `src/pages/login/index.vue`              | 微信/QQ/邮箱登录、发送验证码             | 邮箱/密码/验证码      | `PrivacyPopup` + `showModal`                                                 | 回首页、隐私协议页                   | `/login` `/send-email-code`                       |
| `src/pages/practice/index.vue`           | 开始刷题、PK、导入、错题、排行榜         | 无                    | `SpeedReadyModal` `ResumePracticeModal` `PracticeModesModal`                 | `do-quiz/import-data/rank/mock-exam` | 本地题库 + 统计                                   |
| `src/pages/practice-sub/import-data.vue` | 选文件、开始AI出题、暂停/继续/重试       | 无                    | 多个 `showModal` 进度/中断弹窗                                               | 回刷题页、去做题页                   | `/proxy-ai`                                       |
| `src/pages/practice-sub/do-quiz.vue`     | 选项点击、收藏、下一题、退出             | 笔记 `textarea`       | `CustomModal`（空题库/退出/完成）                                            | 返回刷题/导入                        | 本地题库、错题写入                                |
| `src/pages/school/index.vue`             | 三步择校、筛选、结果卡片                 | 输入院校/专业、picker | `PrivacyPopup` + `showModal`                                                 | `school-sub/detail`                  | `/school-query` `/proxy-ai` `/school-crawler-api` |
| `src/pages/settings/index.vue`           | 修改昵称、主题、AI聊天、清缓存、注销账号 | 昵称输入              | `InviteModal` `PosterModal` `ThemeSelectorModal` `AIChatModal` + `showModal` | 个人页/登录页                        | `/user-profile` `/school-query` `/account-delete` |
| `src/pages/chat/chat.vue`                | 文本发送、语音输入、重试                 | 消息输入框            | 错误提示 `showModal`                                                         | 返回首页                             | `/proxy-ai` `/voice-service`                      |
| `src/pages/tools/doc-convert.vue`        | 选文件、开始转换、下载结果               | 文件选择              | 转换状态卡 + `showModal`                                                     | 未登录跳转登录                       | `/doc-convert`                                    |
| `src/pages/tools/photo-search.vue`       | 拍照/相册、识别、加入错题                | 无                    | 识别进度 `showModal`                                                         | 跳转刷题/登录                        | `/ai-photo-search`                                |
| `src/pages/tools/id-photo.vue`           | 选尺寸/底色、开始制作、保存              | 参数选择              | 处理进度 `showModal`                                                         | 未登录跳转登录                       | `/photo-bg`                                       |

---

## A2 测试矩阵

### 1) 冒烟测试（P0）

- `SMOKE-001` 启动后首页结构可见（`tests/e2e-regression/specs/00-smoke.spec.js:21`）
- `SMOKE-002` 刷题页关键入口可见（`tests/e2e-regression/specs/00-smoke.spec.js:29`）
- `SMOKE-003` 择校页表单可操作（`tests/e2e-regression/specs/00-smoke.spec.js:39`）

成功判定标准：3 条均通过，且无白屏/运行时未就绪阻塞。

### 2) 核心流程（P0/P1）

- `CORE-001` 登录输入链路（`tests/e2e-regression/specs/01-core-flow.spec.js:18`）
- `CORE-002` 登录后进入刷题并打开做题页（`tests/e2e-regression/specs/01-core-flow.spec.js:35`）
- `CORE-003` 学习计划创建页可达（`tests/e2e-regression/specs/01-core-flow.spec.js:78`）

成功判定标准：P0 全通过，P1 通过率 >= 95%。

### 3) 异常流程（P0/P1）

- 空输入校验：`EXC-001`（`02-exception-flow.spec.js:15`）
- 未选文件拦截：`EXC-002`（`02-exception-flow.spec.js:27`）
- 断网恢复：`EXC-003`（`02-exception-flow.spec.js:39`）
- 弱网恢复：`EXC-004`（`02-exception-flow.spec.js:51`）
- 接口 500 降级：`EXC-005`（`02-exception-flow.spec.js:61`）

成功判定标准：断网/弱网/500 场景下页面不崩溃，用户可继续交互。

### 4) 状态恢复与幂等（P0/P1）

- 返回键恢复：`STATE-001`（`03-state-recovery.spec.js:15`）
- 多次点击防重：`STATE-002`（`03-state-recovery.spec.js:27`）
- 切后台恢复：`STATE-003`（`03-state-recovery.spec.js:40`）
- 刷新会话保留：`STATE-004`（`03-state-recovery.spec.js:50`）
- 登录防重复提交：`STATE-005`（`03-state-recovery.spec.js:60`）

成功判定标准：无重复请求风暴、无状态丢失、无异常跳转。

### 5) 人工手势模拟（新增，P1）

- `HUMAN-001` 首页连续上滑后保持可交互（`tests/e2e-regression/specs/06-human-gesture.spec.js:16`）

成功判定标准：完成两次滑动后关键文本仍可见，页面可继续响应。

### 6) 高风险页面回归（Top 10+）

覆盖文件：`tests/e2e-regression/specs/05-high-risk-pages.spec.js:14`

已覆盖：登录、择校、导入、做题、PK、模考、文档转换、拍照搜题、证件照、设置、聊天（11页）。

成功判定标准：11 页全部可达且关键词断言通过。

### 7) 基础性能门禁（P1）

- `PERF-001` 首屏时间（`04-performance.spec.js:15`）
- `PERF-002` 首页到刷题交互响应（`04-performance.spec.js:31`）

阈值配置：`tests/e2e-regression/data/test-data.js:23`

---

## A3 自动化测试骨架

### A3.1 目录结构

```text
tests/e2e-regression/
├── data/test-data.js
├── fixtures/regression.fixture.js
├── helpers/assertions.js
├── helpers/human-actions.js
├── helpers/network-logger.js
└── specs/
    ├── 00-smoke.spec.js
    ├── 01-core-flow.spec.js
    ├── 02-exception-flow.spec.js
    ├── 03-state-recovery.spec.js
    ├── 04-performance.spec.js
    ├── 05-high-risk-pages.spec.js
    └── 06-human-gesture.spec.js
```

### A3.2 测试数据与账号管理

- 测试账号/阈值：`tests/e2e-regression/data/test-data.js`
- 真实账号注入：环境变量 `E2E_EMAIL`、`E2E_PASSWORD`
- 无真实账号时自动 mock 登录态：`regression.fixture.js:35`

### A3.3 公共方法（人工行为）

- 点击/输入：`helpers/human-actions.js:7`、`helpers/human-actions.js:15`
- 上滑手势：`helpers/human-actions.js:30`
- 返回键：`helpers/human-actions.js:43`
- 切后台恢复：`helpers/human-actions.js:47`
- 断网/弱网：`helpers/human-actions.js:57`、`helpers/human-actions.js:62`

### A3.4 失败自动证据

- 失败截图：`fixtures/regression.fixture.js:67`
- 网络日志抓取：`helpers/network-logger.js:16`
- 每例附带 `network-log.json`：`helpers/network-logger.js:72`

### A3.5 可执行命令（阶段B直接使用）

```bash
# 全量回归（冒烟+核心流程+异常+状态+性能+高风险+手势）
npm run test:e2e:regression

# 有头模式（观察“人工点击/滑动”）
npm run test:e2e:regression:headed

# UI 模式（用于排查失败）
npm run test:e2e:regression:ui
```

成功判定标准：

- 报告文件生成：
  - `docs/reports/e2e-regression-html/index.html`
  - `docs/reports/e2e-regression-results.json`
  - `docs/reports/e2e-regression-results.xml`
- 失败证据可追溯：`test-results/e2e-regression/**/failure-screen.png`
- 请求日志可追溯：`test-results/e2e-regression/**/network-log.json`

---

## 阶段A完成结论

1. 已完成全量功能建模（页面、入口、按钮、表单、弹窗、路由、依赖接口）
2. 已形成可执行测试矩阵（P0/P1/P2 维度）
3. 自动化骨架已就绪，具备人工点击/输入/滑动/返回/切后台/弱网/断网恢复能力
4. 进入阶段B前仅需先将 Node 升级到 20.17.0
