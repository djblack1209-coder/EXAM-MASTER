# Exam-Master 阶段A测试建模报告（Round r2）

## 执行快照

- 备份分支：`test-fix/2026-03-03-r2`
- 扫描范围：`pages.json`、`src/pages/**`、`src/services/lafService.js`、`laf-backend/functions/**`
- 自动化方案优先级：`Playwright(H5) -> Appium/Maestro(移动端) -> Detox(RN环境具备时)`

## 环境检查与安装命令

当前检查到本机 Node 版本为 `v18.20.8`，项目要求 `>=20.17.0`（`package.json:94`）。

一键准备命令（建议先执行）：

```bash
source ~/.nvm/nvm.sh && nvm install 20.17.0 && nvm use 20.17.0 && npm ci && npx playwright install chromium
```

成功判定标准：

- `node -v` 输出 `v20.17.0`
- `npm -v` 无 Node 版本告警
- `npx playwright --version` 可正常输出版本

---

## A1 功能地图

### A1.1 页面清单（30个已注册路由）

主包（4）：

1. `/pages/index/index`
2. `/pages/practice/index`
3. `/pages/school/index`
4. `/pages/profile/index`

分包（26）：

5. `/pages/practice-sub/do-quiz`
6. `/pages/practice-sub/pk-battle`
7. `/pages/practice-sub/rank`
8. `/pages/practice-sub/import-data`
9. `/pages/practice-sub/file-manager`
10. `/pages/practice-sub/mock-exam`
11. `/pages/school-sub/detail`
12. `/pages/splash/index`
13. `/pages/login/index`
14. `/pages/login/wechat-callback`
15. `/pages/login/qq-callback`
16. `/pages/settings/index`
17. `/pages/settings/privacy`
18. `/pages/settings/terms`
19. `/pages/social/friend-list`
20. `/pages/social/friend-profile`
21. `/pages/chat/chat`
22. `/pages/mistake/index`
23. `/pages/favorite/index`
24. `/pages/plan/index`
25. `/pages/plan/create`
26. `/pages/study-detail/index`
27. `/pages/tools/photo-search`
28. `/pages/tools/doc-convert`
29. `/pages/tools/id-photo`
30. `/pages/knowledge-graph/index`

额外发现：`src/pages/school-sub/ai-consult.vue` 存在但未在 `pages.json` 注册，无法直接路由访问。

### A1.2 核心链路（必须可用）

1. 启动：`/pages/splash/index -> /pages/index/index`
2. 登录：`/pages/login/index -> /pages/login/wechat-callback | /pages/login/qq-callback -> 首页`
3. 刷题闭环：`/pages/practice/index -> /pages/practice-sub/import-data -> /pages/practice-sub/do-quiz -> /pages/mistake/index`
4. 择校闭环：`/pages/school/index(step1/2/3) -> /pages/school-sub/detail`
5. 工具闭环：`doc-convert | photo-search | id-photo`

### A1.3 次要链路（次要但高风险）

- `/pages/practice-sub/pk-battle -> /pages/practice-sub/rank`
- `/pages/favorite/index -> /pages/practice-sub/do-quiz?mode=single`
- `/pages/plan/index -> /pages/plan/create`
- `/pages/social/friend-list -> /pages/social/friend-profile`
- `/pages/knowledge-graph/index -> /pages/practice/index`

### A1.4 页面交互/路由/API 依赖（重点页）

| 页面                                     | 入口/关键按钮                                  | 表单与输入             | 弹窗/状态层                                                  | 主要跳转                             | 依赖接口                                          |
| ---------------------------------------- | ---------------------------------------------- | ---------------------- | ------------------------------------------------------------ | ------------------------------------ | ------------------------------------------------- |
| `src/pages/login/index.vue`              | 微信/QQ/邮箱登录、发送验证码                   | 邮箱、密码、验证码输入 | 协议勾选/加载状态                                            | `privacy/terms/index`                | `/login` `/send-email-code`                       |
| `src/pages/practice/index.vue`           | 开始刷题、PK、导入、错题、收藏                 | 无                     | `SpeedReadyModal` `ResumePracticeModal` `PracticeModesModal` | `do-quiz/import-data/rank/mock-exam` | 本地题库+学习统计                                 |
| `src/pages/practice-sub/import-data.vue` | 选文件、开始AI出题、暂停/继续、重试            | 无                     | 进度遮罩、极速弹窗、错误重试卡                               | `practice/do-quiz`                   | `/proxy-ai`                                       |
| `src/pages/practice-sub/do-quiz.vue`     | 选项点击、下一题、收藏、笔记、退出             | `textarea`(笔记)       | 结果弹层、恢复进度弹窗、退出确认                             | `import-data`                        | 本地题库+错题写入                                 |
| `src/pages/school/index.vue`             | 三步表单、AI匹配、筛选、院校卡片               | `input/picker`         | 筛选面板、加载骨架                                           | `school-sub/detail`                  | `/school-query` `/proxy-ai` `/school-crawler-api` |
| `src/pages/school-sub/detail.vue`        | AI预测、AI咨询、加入目标院校                   | 无                     | 咨询面板、加载骨架                                           | 返回择校页                           | `/school-query` `/proxy-ai`                       |
| `src/pages/settings/index.vue`           | 修改头像昵称、语音开关、深色模式、清缓存、注销 | `input/switch`         | 邀请、海报、主题、AI聊天、目标院校管理                       | `profile/social/login`               | `/user-profile` `/school-query` `/account-delete` |
| `src/pages/tools/doc-convert.vue`        | 选择类型、选文件、开始转换、下载结果           | 文件选择               | 上传/转换状态卡                                              | `login`(未登录)                      | `/doc-convert`                                    |
| `src/pages/tools/photo-search.vue`       | 拍照、相册、开始识别、加入错题、找相似题       | 无                     | 识别加载层                                                   | `practice/do-quiz`                   | `/ai-photo-search`                                |
| `src/pages/tools/id-photo.vue`           | 选照片、尺寸/底色/美颜、开始制作、保存         | `switch`               | 处理进度                                                     | `login`(未登录)                      | `/photo-bg`                                       |
| `src/pages/chat/chat.vue`                | 发送文本、重试、语音输入、情绪标签             | 消息输入框             | AI好友选择弹窗、typing态                                     | 返回上一页                           | `/voice-service` `/proxy-ai`                      |

---

## A2 测试矩阵

### 1) 冒烟（Smoke）

| 用例ID    | 场景           | 成功判定标准                            | 优先级 |
| --------- | -------------- | --------------------------------------- | ------ |
| SMOKE-001 | 启动后首页可见 | 5秒内出现Tab文案（首页/刷题/择校/我的） | P0     |
| SMOKE-002 | 刷题页入口可见 | “开始刷题/导入”至少一项可交互           | P0     |
| SMOKE-003 | 择校页可输入   | 表单输入框可输入、下一步按钮状态正确    | P0     |

### 2) 核心流程（Core Flow）

| 用例ID   | 场景               | 成功判定标准                     | 优先级 |
| -------- | ------------------ | -------------------------------- | ------ |
| CORE-001 | 登录输入流         | 登录页可输入并触发登录动作       | P0     |
| CORE-002 | 登录后到刷题       | 到达刷题页且关键入口可见         | P0     |
| CORE-003 | 学习计划创建页可达 | 从计划页可到创建页并显示保存按钮 | P1     |

### 3) 异常流程（输入/网络/超时）

| 用例ID  | 场景             | 成功判定标准               | 优先级 |
| ------- | ---------------- | -------------------------- | ------ |
| EXC-001 | 择校空输入提交   | 出现前端校验提示且无崩溃   | P0     |
| EXC-002 | 文档转换未选文件 | 阻止提交并提示“请选择文件” | P1     |
| EXC-003 | 断网恢复         | 断网后恢复并可继续交互     | P0     |
| EXC-004 | 弱网进入聊天页   | 页面仍可渲染并可操作       | P1     |

### 4) 状态恢复（返回/连点/后台恢复）

| 用例ID    | 场景           | 成功判定标准                     | 优先级 |
| --------- | -------------- | -------------------------------- | ------ |
| STATE-001 | 返回上一页     | `goBack` 后 URL 合理且页面不白屏 | P0     |
| STATE-002 | 快速三连点     | 不出现重复导航或崩溃             | P0     |
| STATE-003 | 切后台再恢复   | 页面仍可继续操作                 | P0     |
| STATE-004 | 刷新后会话保留 | 登录态基础数据仍可读取           | P1     |

### 5) 兼容与性能

| 用例ID   | 场景           | 成功判定标准      | 优先级 |
| -------- | -------------- | ----------------- | ------ |
| PERF-001 | 首屏时间       | DCL < 3500ms      | P1     |
| PERF-002 | 首页到刷题响应 | 页面切换 < 1000ms | P1     |

---

## A3 自动化骨架（已落地）

### 目录结构

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
    └── 05-high-risk-pages.spec.js
```

### 覆盖能力对应关系

- 人工行为模拟：`helpers/human-actions.js`（点击/输入/滑动/返回/切后台/断网/弱网）
- 失败自动截图：`fixtures/regression.fixture.js`（失败时附加 `failure-screen.png`）
- 网络请求日志：`helpers/network-logger.js`（每用例输出 `network-log.json`）
- 前10高风险页面：`specs/05-high-risk-pages.spec.js`（已扩展为 10+ 页面）

### 可直接执行命令

```bash
# 全量回归（阶段B将执行）
npm run test:e2e:regression

# 有头模式（可视化观察人工点击）
npm run test:e2e:regression:headed

# UI模式
npm run test:e2e:regression:ui
```

### 输出产物路径

- HTML 报告：`docs/reports/e2e-regression-html/index.html`
- JSON 报告：`docs/reports/e2e-regression-results.json`
- JUnit 报告：`docs/reports/e2e-regression-results.xml`
- 失败截图/视频/trace：`test-results/e2e-regression/`
- 网络日志：`test-results/e2e-regression/**/network-log.json`

### 阶段A完成判定

1. 功能地图完成并覆盖页面/入口/路由/API
2. 测试矩阵完成并区分 P0/P1/P2
3. 自动化骨架已具备：人工行为模拟、失败截图、网络日志、高风险页面回归
