# Exam-Master 阶段A测试建模报告（Round r1）

## 执行快照

- 备份分支：`test-fix/2026-03-04-r1`
- 执行范围：`pages.json`、`src/pages/**`、`src/services/lafService.js`、`tests/e2e-regression/**`、`tests/maestro/**`
- 执行动作：仅做测试建模与自动化骨架校验，不改业务逻辑代码

## 环境前置（可直接执行）

当前环境检测：

- `node -v` = `v18.20.8`（低于项目要求 `>=20.17.0`，见 `package.json:101`）
- `npm -v` = `11.6.2`（已提示 Node 版本不匹配）

一键安装与准备命令：

```bash
source ~/.nvm/nvm.sh && nvm install 20.17.0 && nvm use 20.17.0 && npm ci && npx playwright install chromium
```

Maestro（如本机未完整安装）一键命令：

```bash
bash scripts/test/setup-maestro-macos.sh
```

成功判定标准：

- `node -v` 输出 `v20.17.0`
- `npx playwright --version` 正常输出
- `npm run test:maestro:syntax` 输出 `[maestro-check] all flow syntax checks passed`

---

## A1 功能地图

### A1.1 页面清单（路由注册）

来源：`pages.json:2`。

- 主包 4 页：
  - `/pages/index/index`
  - `/pages/practice/index`
  - `/pages/school/index`
  - `/pages/profile/index`
- 分包 26 页（practice-sub/school-sub/splash/login/settings/social/chat/mistake/favorite/plan/study-detail/tools/knowledge-graph）

关键补充：`src/pages/school-sub/ai-consult.vue` 存在但未在 `pages.json` 独立注册，由详情页组件化调用。

### A1.2 核心链路（必须可用）

1. 启动链路：`/pages/splash/index` -> `/pages/index/index`（`src/pages/splash/index.vue:38`）
2. 登录链路：`/pages/login/index` -> 回调页 -> 首页（`src/pages/login/index.vue:924`）
3. 刷题主链路：`/pages/practice/index` -> `/pages/practice-sub/import-data` -> `/pages/practice-sub/do-quiz` -> `/pages/mistake/index`
4. 择校主链路：`/pages/school/index` -> `/pages/school-sub/detail`（`src/pages/school/index.vue:1211`）
5. 工具主链路：`/pages/tools/doc-convert`、`/pages/tools/photo-search`、`/pages/tools/id-photo`

### A1.3 次要链路（高风险）

- PK 与排行：`/pages/practice-sub/pk-battle` -> `/pages/practice-sub/rank`
- 社交：`/pages/social/friend-list` -> `/pages/social/friend-profile`
- 学习计划：`/pages/plan/index` -> `/pages/plan/create`
- 聊天：`/pages/chat/chat`（文本/语音/重试）

### A1.4 重点页面交互地图（入口/表单/弹窗/路由/API）

| 页面                                     | 关键入口按钮                     | 表单输入            | 弹窗/状态层           | 路由跳转                                        | 依赖接口                                                                  |
| ---------------------------------------- | -------------------------------- | ------------------- | --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------- |
| `src/pages/login/index.vue`              | 微信/QQ/邮箱登录、发送验证码     | 邮箱/密码/验证码    | 协议勾选、QQ 环境提示 | 登录后 `redirectTo` + `switchTab`               | `lafService.login`、`lafService.sendEmailCode`                            |
| `src/pages/practice/index.vue`           | 开始刷题、PK、导入、错题、排行榜 | 无                  | 多个模式/恢复弹层     | 跳 `do-quiz/import-data/pk-battle/rank`         | 本地题库 + 组合式 AI 出题                                                 |
| `src/pages/practice-sub/import-data.vue` | 选文件、开始 AI 出题、暂停/继续  | 文件输入            | 取消/重试/完成确认    | 回刷题页、进做题页                              | `lafService.proxyAI('generate')`                                          |
| `src/pages/practice-sub/do-quiz.vue`     | 选项作答、下一题、退出           | 笔记输入            | 空题库/退出/完成弹窗  | 回刷题页/导入页                                 | AI 解析 + 离线队列提交                                                    |
| `src/pages/school/index.vue`             | 三步择校、筛选、详情             | 多字段输入 + picker | 离线降级提示          | 去 `school-sub/detail`                          | `getHotSchools`、`request('/school-crawler-api')`、`proxyAI('recommend')` |
| `src/pages/settings/index.vue`           | 目标院校管理、清缓存、注销账号   | 昵称/院校/专业输入  | 清理确认/注销流程弹窗 | `switchTab`、`navigateTo('/pages/login/index')` | `searchSchools`、账号删除接口、`/user-profile`                            |
| `src/pages/chat/chat.vue`                | 发送消息、语音、重试             | 消息输入框          | 菜单/错误提示         | 返回失败时 `reLaunch`                           | `aiFriendChat`、`speechToText`                                            |
| `src/pages/tools/doc-convert.vue`        | 选文件、开始转换、下载           | 文件选择            | 登录引导/失败提示     | 未登录转登录页                                  | `submitDocConvert`、`getDocConvertStatus`、`getDocConvertResult`          |
| `src/pages/tools/photo-search.vue`       | 拍照/相册识别                    | 无                  | 登录引导/识别失败提示 | 跳刷题页                                        | `photoSearch`                                                             |
| `src/pages/tools/id-photo.vue`           | 选尺寸底色、开始制作、保存       | 参数选择 + 开关     | 登录引导/制作错误提示 | 跳登录页                                        | `getPhotoConfig`、`processIdPhoto`                                        |

### A1.5 Top 10 高风险页面（阶段B优先）

1. `pages/login/index`（多端登录分支复杂）
2. `pages/practice-sub/import-data`（长链路异步状态机）
3. `pages/practice-sub/do-quiz`（作答/恢复/离线提交）
4. `pages/school/index`（多数据源 + AI 推荐）
5. `pages/settings/index`（账号敏感操作集中）
6. `pages/profile/index`（头像上传双链路）
7. `pages/chat/chat`（文本+语音+重试）
8. `pages/practice-sub/pk-battle`（匹配/结算状态复杂）
9. `pages/tools/photo-search`（拍照识别链路敏感）
10. `pages/practice-sub/mock-exam`（考试状态恢复与交卷）

成功判定标准：

- 页面清单与 `pages.json` 完整对应
- 核心链路与次要链路均有明确页面路径
- Top 10 高风险页可映射到自动化用例

---

## A2 测试矩阵

### 1) 冒烟测试（P0）

- `SMOKE-001` 启动并显示首页结构（`tests/e2e-regression/specs/00-smoke.spec.js:21`）
- `SMOKE-002` 刷题页关键入口可见（`tests/e2e-regression/specs/00-smoke.spec.js:29`）
- `SMOKE-003` 择校页表单可操作（`tests/e2e-regression/specs/00-smoke.spec.js:39`）

### 2) 核心流程（P0/P1）

- `CORE-001` 登录页输入与触发登录（`tests/e2e-regression/specs/01-core-flow.spec.js:54`）
- `CORE-002` 登录后进入刷题并可到做题页（`tests/e2e-regression/specs/01-core-flow.spec.js:66`）
- `CORE-003` 学习计划结果页可达（`tests/e2e-regression/specs/01-core-flow.spec.js:103`）

### 3) 异常流程（P0/P1）

- 空输入校验：`EXC-001`（`tests/e2e-regression/specs/02-exception-flow.spec.js:15`）
- 未选文件拦截：`EXC-002`（`tests/e2e-regression/specs/02-exception-flow.spec.js:27`）
- 断网恢复：`EXC-003`（`tests/e2e-regression/specs/02-exception-flow.spec.js:39`）
- 弱网可交互：`EXC-004`（`tests/e2e-regression/specs/02-exception-flow.spec.js:51`）
- 接口 500 降级：`EXC-005`（`tests/e2e-regression/specs/02-exception-flow.spec.js:61`）

### 4) 状态恢复（P0/P1）

- 返回键：`STATE-001`（`tests/e2e-regression/specs/03-state-recovery.spec.js:15`）
- 多次点击防重：`STATE-002`（`tests/e2e-regression/specs/03-state-recovery.spec.js:27`）
- 切后台恢复：`STATE-003`（`tests/e2e-regression/specs/03-state-recovery.spec.js:40`）
- 刷新会话保持：`STATE-004`（`tests/e2e-regression/specs/03-state-recovery.spec.js:50`）
- 登录防重复提交：`STATE-005`（`tests/e2e-regression/specs/03-state-recovery.spec.js:60`）

### 5) 兼容性（分辨率/设备形态）

- Playwright 兼容项目：`mobile-390x844`、`mobile-375x667`、`desktop-1440x900`（`playwright.regression.compat.config.js:35`）
- 命令：`npm run test:e2e:compat`

### 6) 基础性能（门禁）

- 首屏时间：`PERF-001`（`tests/e2e-regression/specs/04-performance.spec.js:15`）
- 交互响应：`PERF-002`（`tests/e2e-regression/specs/04-performance.spec.js:31`）
- 阈值配置：`tests/e2e-regression/data/test-data.js:23`

### 7) 前 10 高风险页面（含扩展到 11 页）

- 高风险回归脚本：`tests/e2e-regression/specs/05-high-risk-pages.spec.js:14`
- 当前覆盖 11 页（含聊天页扩展）

成功判定标准：

- `npx playwright test --config=playwright.regression.config.js --list` 输出 30 条用例
- 覆盖冒烟 + 核心流程 + 高风险页面 + 异常/状态/性能

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

- 测试账号、性能阈值：`tests/e2e-regression/data/test-data.js`
- 真实账号通过环境变量注入：`E2E_EMAIL`、`E2E_PASSWORD`
- 无真实账号时自动注入 mock 登录态：`tests/e2e-regression/fixtures/regression.fixture.js:35`

### A3.3 公共方法（模拟人工行为）

- 点击：`tests/e2e-regression/helpers/human-actions.js:18`
- 输入：`tests/e2e-regression/helpers/human-actions.js:26`
- 滑动：`tests/e2e-regression/helpers/human-actions.js:43`
- 返回：`tests/e2e-regression/helpers/human-actions.js:56`
- 切后台恢复：`tests/e2e-regression/helpers/human-actions.js:60`
- 断网：`tests/e2e-regression/helpers/human-actions.js:70`
- 弱网：`tests/e2e-regression/helpers/human-actions.js:75`

### A3.4 失败证据自动化

- 失败自动截图：`tests/e2e-regression/fixtures/regression.fixture.js:67`
- 请求日志抓取与落盘：`tests/e2e-regression/helpers/network-logger.js:64`
- 每例附带 `network-log.json`：`tests/e2e-regression/helpers/network-logger.js:72`

### A3.5 移动端自动化骨架（Maestro）

- 流程目录：`tests/maestro/flows`
- 语法校验：`npm run test:maestro:syntax`
- 预检报告：`npm run test:maestro:preflight`

成功判定标准：

- 语法校验通过（已验证）
- 生成预检文件：`docs/reports/maestro-preflight.md`
- Playwright 与 Maestro 都有可执行命令入口

---

## 阶段A可执行命令清单

```bash
# 1) 校验 E2E 用例清单
npx playwright test --config=playwright.regression.config.js --list

# 2) 校验 Maestro flow 语法
npm run test:maestro:syntax

# 3) 生成 Maestro 设备预检报告
npm run test:maestro:preflight

# 4) 阶段B将直接执行的全量回归命令
npm run test:e2e:regression
```

对应成功判定标准：

- 命令1输出 `Total: 30 tests in 7 files`
- 命令2输出 `all flow syntax checks passed`
- 命令3输出 `report written: docs/reports/maestro-preflight.md`
- 命令4生成 HTML/JSON/JUnit 报告与失败截图网络日志

---

## 阶段A结论

1. 已完成页面与流程建模（含入口、按钮、表单、弹窗、路由、接口依赖）。
2. 已落地覆盖矩阵：冒烟 + 核心流程 + 异常流程 + 状态恢复 + 兼容性 + 基础性能。
3. 自动化骨架满足“模拟人工点击/输入/滑动/返回/切后台/弱网/断网恢复 + 失败证据留存”。
4. 可直接进入阶段B执行全量回归并产出缺陷清单。
