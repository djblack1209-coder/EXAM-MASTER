# Exam-Master 阶段A测试建模报告（2026-03-03）

## 执行上下文

- 备份分支：`test-fix/2026-03-03-r1`
- 扫描范围：`src/pages/**`、`src/services/lafService.js`、`src/pages.json`、`laf-backend/functions/**`
- 自动化基线：H5 Playwright（后续可扩展 Appium/Maestro）

---

## A1 功能地图（先建模，不改业务逻辑）

### 1) 页面清单（共 30 个路由页面）

#### Tab 页面（核心入口）

1. `/pages/index/index` 首页
2. `/pages/practice/index` 刷题
3. `/pages/school/index` 择校
4. `/pages/profile/index` 我的

#### 子包页面

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

> 发现：`src/pages/school-sub/ai-consult.vue` 存在，但未注册到 `src/pages.json`，当前不可路由直达。

### 2) 核心链路（必须可用）

1. 启动链路：`splash -> index -> tabBar切换`
2. 登录链路：`login -> callback(wechat/qq) -> index/profile`
3. 刷题链路：`practice -> import-data/do-quiz -> mistake -> review`
4. 择校链路：`school表单 -> school-sub/detail -> AI咨询`
5. 工具链路：`photo-search/doc-convert/id-photo`
6. 账户链路：`profile -> settings -> 更新资料/注销/退出登录`

### 3) 次要链路（非阻塞但高风险）

- `pk-battle -> rank`
- `favorite -> do-quiz?mode=single`
- `plan -> plan/create`
- `knowledge-graph -> practice/index`
- `social/friend-list -> social/friend-profile`

### 4) 页面级交互元素盘点（入口、按钮、表单、弹窗、路由跳转、依赖接口）

| 页面                             | 典型入口                        | 关键交互                             | 表单/输入          | 弹窗/Modal                                                     | 跳转目标                            | 依赖接口                                          |
| -------------------------------- | ------------------------------- | ------------------------------------ | ------------------ | -------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------- |
| `pages/index/index`              | Tab 首页                        | 学习时间、工具入口、登录引导         | 无                 | `PrivacyPopup` `FormulaModal` `QuotePosterModal` `CustomModal` | login/settings/import-data/plan     | 本地存储                                          |
| `pages/practice/index`           | Tab 刷题                        | 开始刷题、PK、导入、错题、收藏       | 无                 | `SpeedReadyModal` `ResumePracticeModal` `PracticeModesModal`   | do-quiz/import-data                 | 本地存储                                          |
| `pages/school/index`             | Tab 择校                        | 分步表单、筛选、提交推荐             | `input` `picker`   | `PrivacyPopup`                                                 | detail（程序内）                    | `/school-query` `/school-crawler-api` `/proxy-ai` |
| `pages/profile/index`            | Tab 我的                        | 打卡、补签、错题入口、学习详情、设置 | 无                 | `PrivacyPopup`                                                 | mistake/study-detail/settings/login | `/user-profile`                                   |
| `pages/login/index`              | 未登录保护                      | 微信/QQ/邮箱登录、验证码、协议       | `input`            | `PrivacyPopup`                                                 | index/privacy/terms                 | `/login` `/send-email-code`                       |
| `pages/practice-sub/import-data` | practice/index                  | 选文件、AI生成、暂停/继续、去刷题    | 无                 | 轻量确认层                                                     | practice                            | `/proxy-ai` + 兼容 uniCloud                       |
| `pages/practice-sub/do-quiz`     | practice/index/mistake/favorite | 选项作答、下一题、退出、笔记         | `textarea`         | `CustomModal`                                                  | import-data                         | 本地存储                                          |
| `pages/practice-sub/pk-battle`   | practice/index                  | 开始对战、退出、看榜单               | 无                 | `CustomModal`                                                  | rank/index/import-data              | `/proxy-ai` + 兼容 uniCloud                       |
| `pages/practice-sub/rank`        | pk-battle                       | 返回、去刷题、发起PK                 | 无                 | 足迹层                                                         | practice                            | `/rank-center` `/proxy-ai`                        |
| `pages/practice-sub/mock-exam`   | practice/index                  | 配置考试、答题、交卷、复盘           | 无                 | 内嵌结果层                                                     | mistake                             | `/question-bank`                                  |
| `pages/school-sub/detail`        | school/index                    | 分享、AI预测、目标切换               | 无                 | 内嵌咨询层                                                     | 上一页                              | `/school-query` `/proxy-ai`                       |
| `pages/settings/index`           | profile/index                   | 修改资料、切主题、账号注销、登出     | `input` `switch`   | `InviteModal` `PosterModal` `ThemeSelectorModal` `AIChatModal` | profile/login/school                | `/account-delete` `/school-query` `/user-profile` |
| `pages/chat/chat`                | profile/index 或入口卡片        | 输入消息、重发、角色切换、语音       | `input`            | 角色选择层                                                     | index                               | `/proxy-ai` `/voice-service`                      |
| `pages/mistake/index`            | profile/practice                | 顺序复习、筛选、高频错题             | 无                 | 清空确认                                                       | practice/do-quiz?mode=review        | 本地存储 + 同步队列                               |
| `pages/favorite/index`           | practice/index                  | 文件夹管理、备注、单题练习           | `input` `textarea` | 轻量弹层                                                       | do-quiz?mode=single                 | 本地存储                                          |
| `pages/plan/index`               | index/profile                   | 创建/删除/查看计划                   | 无                 | 删除确认                                                       | plan/create                         | 本地存储                                          |
| `pages/plan/create`              | plan/index                      | 计划信息录入与保存                   | `input` `textarea` | 日期时间选择                                                   | 上一页                              | 本地存储                                          |
| `pages/tools/photo-search`       | index 快捷入口                  | 拍照/相册、识别、加错题、相似检索    | 无                 | 结果区块                                                       | login/practice                      | `/ai-photo-search`                                |
| `pages/tools/doc-convert`        | index 快捷入口                  | 选文件、转换、轮询状态、下载         | 无                 | 状态区块                                                       | login                               | `/doc-convert`                                    |
| `pages/tools/id-photo`           | index 快捷入口                  | 选图、尺寸/底色/美颜、生成下载       | `switch`           | 结果区块                                                       | login                               | `/photo-bg`                                       |
| `pages/knowledge-graph/index`    | index 卡片入口                  | 节点点击、学习路径、去刷题           | 无                 | 分析面板                                                       | index/practice                      | 本地存储                                          |

### 5) 路由跳转主图（简化）

- 首页：`index -> login/settings/plan/create/practice-sub/import-data`
- 个人：`profile -> settings -> login`
- 刷题：`practice -> do-quiz/import-data/mock-exam/pk-battle/rank/mistake/favorite`
- 错题：`mistake -> do-quiz?mode=review`
- 工具：`tools/* -> login(未登录)`
- 登录回调：`wechat-callback|qq-callback -> index|login`

### 6) 后端依赖函数（按风险）

- P0：`/login` `/send-email-code` `/proxy-ai` `/question-bank`
- P1：`/school-query` `/rank-center` `/doc-convert` `/photo-bg` `/ai-photo-search`
- P2：`/account-delete` `/user-profile` `/social-service` `/invite-service`

---

## A2 测试矩阵

### 冒烟测试（Smoke）

| 用例ID    | 场景           | 成功判定标准                      | 优先级 |
| --------- | -------------- | --------------------------------- | ------ |
| SMOKE-001 | 启动进入首页   | 5s 内出现 TabBar + 首页关键文案   | P0     |
| SMOKE-002 | Tab 四页可切换 | 点击后 URL/页面文案切换成功       | P0     |
| SMOKE-003 | 刷题入口按钮   | “开始刷题/导入/PK” 至少一个可点击 | P0     |
| SMOKE-004 | 登录页渲染     | 登录按钮、输入框、协议入口可见    | P0     |

### 核心流程（Core Flow）

| 用例ID   | 场景           | 成功判定标准                          | 优先级 |
| -------- | -------------- | ------------------------------------- | ------ |
| CORE-001 | 邮箱登录       | 输入后触发登录请求，无前端报错        | P0     |
| CORE-002 | 登录后进刷题   | 到达 `practice/index` 且可继续下一步  | P0     |
| CORE-003 | 导入资料到做题 | `import-data -> do-quiz` 路径打通     | P0     |
| CORE-004 | 择校推荐       | 提交后进入推荐结果或详情              | P0     |
| CORE-005 | 错题复习       | `mistake -> do-quiz?mode=review` 可达 | P1     |
| CORE-006 | 设置资料更新   | 昵称/院校修改后状态保持               | P1     |

### 异常流程（输入/接口/网络）

| 用例ID  | 场景                      | 成功判定标准               | 优先级 |
| ------- | ------------------------- | -------------------------- | ------ |
| EXC-001 | 空输入提交择校            | 出现可理解校验提示，不崩溃 | P0     |
| EXC-002 | 非法输入（过长/特殊字符） | 被拦截或后端友好返回       | P1     |
| EXC-003 | 文档转换未选文件提交      | 阻止提交并提示             | P1     |
| EXC-004 | AI 接口 500               | 页面可恢复并显示错误提示   | P0     |
| EXC-005 | 请求超时                  | 有 loading 结束和重试入口  | P1     |
| EXC-006 | 全局断网                  | 离线提示出现，恢复后可继续 | P0     |

### 状态恢复/幂等

| 用例ID    | 场景          | 成功判定标准               | 优先级 |
| --------- | ------------- | -------------------------- | ------ |
| STATE-001 | 返回键链路    | 返回后页面状态合理，无白屏 | P0     |
| STATE-002 | 快速连点提交  | 无重复导航/重复提交副作用  | P0     |
| STATE-003 | 切后台再回来  | 页面可继续交互，状态不丢失 | P0     |
| STATE-004 | 刷新/重进 App | 登录态与关键缓存符合预期   | P1     |

### 兼容性与性能

| 用例ID   | 场景           | 成功判定标准                 | 优先级 |
| -------- | -------------- | ---------------------------- | ------ |
| COMP-001 | iPhone SE 视口 | 主要内容可见，不发生错位遮挡 | P1     |
| COMP-002 | iPhone 12 视口 | 无关键控件溢出               | P1     |
| PERF-001 | 首屏渲染时间   | DCL < 3500ms                 | P1     |
| PERF-002 | 首页到刷题交互 | 响应 < 1000ms                | P1     |

---

## A3 自动化测试骨架（已落地）

### 1) 新增目录与文件

- 配置：`playwright.regression.config.js`
- 数据：`tests/e2e-regression/data/test-data.js`
- 公共能力：
  - `tests/e2e-regression/helpers/human-actions.js`
  - `tests/e2e-regression/helpers/assertions.js`
  - `tests/e2e-regression/helpers/network-logger.js`
- Fixture（失败自动截图 + 网络日志）：`tests/e2e-regression/fixtures/regression.fixture.js`
- 回归套件：
  - `tests/e2e-regression/specs/00-smoke.spec.js`
  - `tests/e2e-regression/specs/01-core-flow.spec.js`
  - `tests/e2e-regression/specs/02-exception-flow.spec.js`
  - `tests/e2e-regression/specs/03-state-recovery.spec.js`
  - `tests/e2e-regression/specs/04-performance.spec.js`
  - `tests/e2e-regression/specs/05-high-risk-pages.spec.js`
- 使用说明：`tests/e2e-regression/README.md`

### 2) 新增可执行命令

已写入 `package.json`：

- `npm run test:e2e:regression`
- `npm run test:e2e:regression:ui`
- `npm run test:e2e:regression:headed`
- `npm run test:e2e:regression:debug`

### 3) 成功判定标准（阶段A）

- 完成页面/入口/交互/API 的功能建模
- 完成可执行测试矩阵定义
- 完成可运行的回归测试骨架（含日志与失败证据机制）
- 未改动业务功能逻辑（仅新增测试基建）
