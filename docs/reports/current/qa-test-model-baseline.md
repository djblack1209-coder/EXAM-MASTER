# Exam-Master 阶段A测试建模报告（2026-03-09 Round 1）

## 执行快照

- 备份分支：`test-fix/2026-03-09-round1`
- 扫描范围：`pages.json`、`src/pages/**`、`src/services/lafService.js`、`src/stores/**`、`tests/e2e-regression/**`、`tests/maestro/**`
- 执行动作：完成功能地图、测试矩阵、自动化骨架校验；未改业务页面逻辑
- 当前声明路由：30 个
- 当前自动化资产：Playwright 66 条用例 / 16 个 spec 文件；Maestro 5 条 Android flow

## 环境前置（可直接执行）

当前检测结果：

- 当前 shell 默认 `node -v` = `v18.20.8`，低于 `package.json` 要求的 `>=20.17.0`
- Homebrew 已存在 `node@20`：`/opt/homebrew/opt/node@20`，加 PATH 后可用 `v20.20.0`
- `npm -v` = `11.6.2`，默认 shell 会出现 Node 版本不匹配警告
- `npx playwright --version` = `1.58.2`
- 默认 shell 下 `java -version` 失败，但 Homebrew 已存在 `openjdk`：`/opt/homebrew/opt/openjdk`
- `export PATH="$(brew --prefix node@20)/bin:$(brew --prefix openjdk)/bin:$HOME/.maestro/bin:$PATH" && export JAVA_HOME="$(brew --prefix openjdk)" && maestro --version` 已验证通过，结果为 `2.2.0`
- `npm run test:maestro:syntax` 已通过，说明 Maestro flow 骨架可执行
- `adb devices -l` 已识别真机：`96304553 / model:2107113SG`
- `docs/reports/current/qa-maestro-preflight.md` 显示设备已连接，但第三方包启发式未识别到业务包；阶段B原生回归需显式传入 `APP_ID` 或 `ANDROID_APK_PATH`

一键安装命令（macOS）：

```bash
bash scripts/test/setup-qa-macos.sh
```

手动安装命令（macOS）：

```bash
brew install node@20 openjdk android-platform-tools
export PATH="$(brew --prefix node@20)/bin:$(brew --prefix openjdk)/bin:$HOME/.maestro/bin:$PATH"
export JAVA_HOME="$(brew --prefix openjdk)"
if ! command -v maestro >/dev/null 2>&1; then curl -Ls "https://get.maestro.mobile.dev" | bash; fi
npm ci
npx playwright install chromium
```

成功判定标准：

- `node -v` 输出 `v20.17.x` 或更高兼容版本
- `java -version` 正常输出
- `maestro --version` 正常输出
- `adb devices -l` 仍能看到目标手机为 `device`

---

## A1 功能地图

### A1.1 页面与模块清单

主 Tab：

- 首页：`pages/index/index` -> `src/pages/index/index.vue`
- 刷题：`pages/practice/index` -> `src/pages/practice/index.vue`
- 择校：`pages/school/index` -> `src/pages/school/index.vue`
- 我的：`pages/profile/index` -> `src/pages/profile/index.vue`

认证与启动：

- 启动页：`pages/splash/index`
- 登录页：`pages/login/index`
- 微信回调：`pages/login/wechat-callback`
- QQ 回调：`pages/login/qq-callback`

刷题子链路：

- `pages/practice-sub/import-data`
- `pages/practice-sub/do-quiz`
- `pages/practice-sub/pk-battle`
- `pages/practice-sub/rank`
- `pages/practice-sub/file-manager`
- `pages/practice-sub/mock-exam`

学习辅助与长尾：

- `pages/mistake/index`
- `pages/favorite/index`
- `pages/plan/index`
- `pages/plan/create`
- `pages/study-detail/index`
- `pages/knowledge-graph/index`

工具页：

- `pages/tools/photo-search`
- `pages/tools/doc-convert`
- `pages/tools/id-photo`

账号与社交：

- `pages/settings/index`
- `pages/settings/privacy`
- `pages/settings/terms`
- `pages/social/friend-list`
- `pages/social/friend-profile`
- `pages/chat/chat`

择校详情：

- `pages/school-sub/detail`
- 组件化 AI 咨询面板：`src/pages/school-sub/ai-consult.vue`（未独立注册路由）

### A1.2 核心链路（必须可用）

1. 启动链路：`pages/splash/index` -> `pages/index/index`
2. 登录链路：`pages/login/index` -> OAuth/邮箱登录 -> 首页或原目标页
3. 刷题主链路：`pages/practice/index` -> `pages/practice-sub/import-data` -> `pages/practice-sub/do-quiz` -> `pages/mistake/index`
4. 择校主链路：`pages/school/index` -> 推荐结果 -> `pages/school-sub/detail`
5. 个人中心链路：`pages/profile/index` -> `pages/settings/index` -> 资料更新/退出登录

### A1.3 次要链路（高风险但非首要主链）

- PK/排行：`pages/practice-sub/pk-battle` -> `pages/practice-sub/rank`
- 社交：`pages/social/friend-list` -> `pages/social/friend-profile`
- AI 助手：`pages/practice/index`/`pages/settings/index` -> `pages/chat/chat`
- 学习计划：`pages/plan/index` -> `pages/plan/create`
- 工具链：`pages/tools/*`

### A1.4 重点页面交互地图（入口 / 表单 / 弹层 / 跳转 / 接口）

| 页面                                     | 入口                   | 关键按钮/动作                                           | 表单/输入                     | 弹层/状态层                            | 跳转                                             | 依赖接口/能力                                                             |
| ---------------------------------------- | ---------------------- | ------------------------------------------------------- | ----------------------------- | -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| `src/pages/login/index.vue`              | 多数登录守卫页         | 微信/QQ/邮箱登录、发送验证码、切换注册/登录             | 邮箱、密码、验证码、协议勾选  | 隐私弹窗、平台提示                     | 首页、隐私、协议、回调页                         | `lafService.login`、`lafService.sendEmailCode`                            |
| `src/pages/index/index.vue`              | 启动页后落地、Tab      | 工具卡、刷题入口、计划编辑、分享/收藏                   | Todo 输入                     | 空题库、分享、金句海报、公式、登录提示 | 刷题、设置、学习详情、工具页、计划页             | 本地 store + `storageService`                                             |
| `src/pages/practice/index.vue`           | Tab、首页 CTA          | 开始刷题、PK、导入、排行、错题、收藏                    | 无主表单                      | 练习模式、恢复练习、目标设置、奖励弹层 | `do-quiz`、`import-data`、`pk-battle`、`rank` 等 | 本地题库 + 导航 mixin                                                     |
| `src/pages/practice-sub/import-data.vue` | 首页/刷题空状态        | 选文件、开始生成、暂停、继续、清空题库                  | 文件选择                      | 生成中、暂停、错误、完成态             | 回刷题、去做题                                   | `lafService.proxyAI('generate')`、文件能力                                |
| `src/pages/practice-sub/do-quiz.vue`     | 刷题页、错题页、收藏页 | 选答案、下一题、退出、收藏、笔记                        | 笔记输入                      | 空题库、退出确认、完成、恢复练习       | 导入页、错题页                                   | `storageService`、自适应选题、离线恢复                                    |
| `src/pages/school/index.vue`             | Tab                    | 上一步/下一步、智能推荐、筛选、查看详情                 | 本校/目标院校/专业/英语证书等 | 筛选面板、离线/异常提示                | `school-sub/detail`                              | `getHotSchools`、`request('/school-crawler-api')`、`proxyAI('recommend')` |
| `src/pages/school-sub/detail.vue`        | 择校结果卡片           | 分享、AI 预测、AI 咨询、收藏目标院校                    | 咨询输入                      | AI 咨询面板                            | 返回上一页                                       | `getSchoolDetail`、`proxyAI('predict')`                                   |
| `src/pages/profile/index.vue`            | Tab                    | 登录/编辑资料、打卡、错题、学习详情、设置               | 昵称/头像等                   | 连续打卡与补签提示                     | 登录、设置、错题、学习详情                       | `lafService.updateUserProfile`、本地学习数据                              |
| `src/pages/settings/index.vue`           | 个人中心               | 目标院校、AI 导师、好友入口、清缓存、退出登录、申请注销 | 昵称、院校、专业              | 邀请、海报、主题、目标院校、注销确认   | 好友列表、返回个人中心                           | `searchSchools`、`/user-profile`、账号删除接口                            |
| `src/pages/chat/chat.vue`                | 刷题/设置              | 发送消息、重试、切换 AI 角色、语音输入                  | 文本输入                      | 好友选择、隐私弹窗、失败提示           | 登录或首页回退                                   | `lafService.aiFriendChat`、`lafService.speechToText`、麦克风权限          |
| `src/pages/tools/doc-convert.vue`        | 首页工具卡             | 选文件、开始转换、轮询状态、下载                        | 文件选择、转换类型            | 登录引导、转换错误提示                 | 登录页                                           | `submitDocConvert`、`getDocConvertStatus`、`getDocConvertResult`          |
| `src/pages/tools/photo-search.vue`       | 首页工具卡             | 相机/相册、识别、重试、加错题、去刷题                   | 学科选择                      | 隐私弹窗、识别中、失败提示             | 刷题页、登录页                                   | `lafService.photoSearch`、相机/相册权限                                   |
| `src/pages/tools/id-photo.vue`           | 首页工具卡             | 上传图片、切背景、生成、保存                            | 尺寸/背景色/美颜开关          | 登录引导、处理错误                     | 登录页                                           | `getPhotoConfig`、`processIdPhoto`、相册权限                              |

### A1.5 高风险页清单（阶段B优先）

1. `src/pages/login/index.vue`：多端登录分支 + 协议勾选 + 验证码倒计时
2. `src/pages/login/wechat-callback.vue`：OAuth `state` 与重定向恢复
3. `src/pages/login/qq-callback.vue`：OAuth `state` 与回退策略
4. `src/pages/practice-sub/import-data.vue`：长任务状态机 + 文件能力
5. `src/pages/practice-sub/do-quiz.vue`：作答、恢复、笔记、收藏、离线状态
6. `src/pages/school/index.vue`：多步骤表单 + AI 推荐 + 多数据源
7. `src/pages/school-sub/detail.vue`：详情缓存 + AI 咨询 + 目标院校收藏
8. `src/pages/chat/chat.vue`：文本/语音/重试 + 登录守卫
9. `src/pages/practice-sub/pk-battle.vue`：计时、结算、分享、回合切换
10. `src/pages/tools/photo-search.vue` / `src/pages/tools/doc-convert.vue` / `src/pages/tools/id-photo.vue`：原生能力 + 网络依赖强

成功判定标准：

- 30 个声明路由均已归类到功能模块
- 每条核心链路都有起点、关键动作、结果页
- 高风险页面可以映射到自动化脚本与阶段B优先级

---

## A2 测试矩阵

| 测试域             | 目标                                     | 主要自动化文件                                                                                  | 成功判定标准                                      |
| ------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 冒烟测试           | 启动、首页、刷题页、择校页可渲染可点击   | `tests/e2e-regression/specs/00-smoke.spec.js`                                                   | 首页根节点可见，关键入口可点击                    |
| 核心流程           | 登录 -> 刷题 -> 做题；学习计划可达       | `tests/e2e-regression/specs/01-core-flow.spec.js`                                               | 核心跳转完成，无白屏/死链                         |
| 异常流程           | 空输入、未选文件、断网、弱网、接口 500   | `tests/e2e-regression/specs/02-exception-flow.spec.js`                                          | 有前端校验或降级提示，页面不崩                    |
| 状态恢复           | 返回键、多击防抖、切后台、刷新、重复登录 | `tests/e2e-regression/specs/03-state-recovery.spec.js`                                          | 状态可恢复，无重复提交                            |
| 基础性能           | 首屏时间、首页到刷题页响应               | `tests/e2e-regression/specs/04-performance.spec.js`                                             | 阈值低于 `tests/e2e-regression/data/test-data.js` |
| 高风险页面         | 11 个高风险页面可达                      | `tests/e2e-regression/specs/05-high-risk-pages.spec.js`                                         | 页面渲染成功，核心文案出现                        |
| 人工手势           | 滑动后仍可交互                           | `tests/e2e-regression/specs/06-human-gesture.spec.js`                                           | 上滑后点击不失效                                  |
| 全路由健康度       | 30 个声明路由全覆盖，亮/暗主题巡检       | `tests/e2e-regression/specs/07-full-route-coverage.spec.js`                                     | 路由可达，无运行时致命异常                        |
| 真实点击覆盖       | 首页/刷题/个人中心/设置/文件能力真实点击 | `tests/e2e-regression/specs/08-clickable-actions.spec.js`、`09-detailed-click-coverage.spec.js` | 点击后跳转、弹层或控件状态真实变化                |
| 后端驱动流转       | 择校推荐、AI 聊天等依赖接口渲染          | `tests/e2e-regression/specs/10-backend-driven-flows.spec.js`                                    | mock/拦截响应被正确消费                           |
| 登录与导入精细回归 | 密码可见性、验证码倒计时、导入页布局     | `tests/e2e-regression/specs/11-login-and-import-precision.spec.js`                              | UI 与状态机符合预期                               |
| 页面滚动巡检       | 全量页面模拟人工滑动并截图               | `tests/e2e-regression/specs/12-full-page-scroll-audit.spec.js`                                  | 输出巡检截图，不出现卡死                          |
| 个人中心/设置      | 协议链接、主题切换、清缓存、注销流程     | `tests/e2e-regression/specs/13-profile-settings-actions.spec.js`                                | 所有敏感入口可触达并可回退                        |
| 分享与原生降级     | H5 分享降级、协议可访问                  | `tests/e2e-regression/specs/14-share-and-native-fallbacks.spec.js`                              | H5 下复制/回退链路可用                            |
| 长尾页面           | 收藏、文件管理、好友、知识图谱、学习计划 | `tests/e2e-regression/specs/15-long-tail-pages.spec.js`                                         | 非主链路高风险页不崩且可完成关键动作              |
| Android 真机冒烟   | 启动、登录输入、刷题、状态恢复           | `tests/maestro/flows/*.yaml`                                                                    | 真机点击、返回、切换页面成功                      |

执行基线：

- `npx playwright test --config=playwright.regression.config.js --list` 当前输出：`Total: 66 tests in 16 files`
- 兼容项目：`mobile-390x844`、`mobile-375x667`、`desktop-1440x900`
- 原生优先级：H5 用 Playwright，全真机用 Maestro

成功判定标准：

- 单轮至少覆盖冒烟 + 核心流程 + 高风险页面
- 阶段B前至少完成 H5 全量用例枚举与 Android 真机预检
- 每个风险域都能映射到可执行脚本

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
    ├── 06-human-gesture.spec.js
    ├── 07-full-route-coverage.spec.js
    ├── 08-clickable-actions.spec.js
    ├── 09-detailed-click-coverage.spec.js
    ├── 10-backend-driven-flows.spec.js
    ├── 11-login-and-import-precision.spec.js
    ├── 12-full-page-scroll-audit.spec.js
    ├── 13-profile-settings-actions.spec.js
    ├── 14-share-and-native-fallbacks.spec.js
    └── 15-long-tail-pages.spec.js

tests/maestro/
├── flows/00-smoke.yaml
├── flows/01-login-input.yaml
├── flows/02-core-practice.yaml
├── flows/03-high-risk-tools.yaml
├── flows/04-state-recovery.yaml
└── README.md
```

### A3.2 测试数据与账号管理

- 测试账号与性能阈值：`tests/e2e-regression/data/test-data.js`
- 真实账号通过环境变量注入：`E2E_EMAIL`、`E2E_PASSWORD`、`E2E_NICKNAME`
- 无真实账号时，Playwright fixture 可直接注入 mock 登录态：`tests/e2e-regression/fixtures/regression.fixture.js`
- 路由查询参数映射：`tests/shared/page-routes.js`

### A3.3 公共方法（模拟人工行为）

- 点击：`tests/e2e-regression/helpers/human-actions.js`
- 输入：`tests/e2e-regression/helpers/human-actions.js`
- 滑动：`tests/e2e-regression/helpers/human-actions.js`
- 返回：`tests/e2e-regression/helpers/human-actions.js`
- 切后台恢复：`tests/e2e-regression/helpers/human-actions.js`
- 断网：`tests/e2e-regression/helpers/human-actions.js`
- 弱网：`tests/e2e-regression/helpers/human-actions.js`
- 截图挂载：`tests/e2e-regression/fixtures/regression.fixture.js`
- 网络日志：`tests/e2e-regression/helpers/network-logger.js`

### A3.4 失败证据自动化

- 失败自动截图：Playwright `screenshot: 'only-on-failure'`
- 失败 trace/video：`playwright.regression.config.js`
- 每例网络日志：`test-results/e2e-regression/**/network-log.json`
- Android 设备预检报告：`docs/reports/current/qa-maestro-preflight.md`
- 真机截图/日志目录：`test-results/maestro/`

### A3.5 本轮补齐项

- 新增统一环境脚本：`scripts/test/setup-qa-macos.sh`
- 修复 Maestro 预检脚本的候选包提取错误：`scripts/test/maestro-preflight.sh`
- 更新 E2E / Maestro 说明文档：`tests/e2e-regression/README.md`、`tests/maestro/README.md`

成功判定标准：

- 环境脚本可完成 Node 20 + Java + adb + Maestro + Playwright 安装准备
- 预检脚本可稳定生成设备报告
- Playwright 与 Maestro 都有可复制执行的命令入口

---

## 阶段A可执行命令清单

```bash
# 1) 安装阶段B所需环境
bash scripts/test/setup-qa-macos.sh

# 2) 列出全量 H5 回归用例
npx playwright test --config=playwright.regression.config.js --list

# 3) 生成当前手机预检报告
MAESTRO_PREFLIGHT_REPORT="docs/reports/current/qa-maestro-preflight.md" npm run test:maestro:preflight

# 4) 校验 Maestro flow 语法
npm run test:maestro:syntax

# 5) 阶段B即将执行的 H5 全量回归
npm run test:e2e:regression

# 6) 阶段B即将执行的多分辨率兼容回归
npm run test:e2e:compat

# 7) 阶段B即将执行的 Android 真机回归
APP_ID="your.real.app.id" npm run test:maestro
```

对应成功判定标准：

- 命令1结束后 `node -v`、`java -version`、`maestro --version` 均正常
- 命令2输出 `Total: 66 tests in 16 files`
- 命令3生成 `docs/reports/current/qa-maestro-preflight.md`
- 命令4输出 `all flow syntax checks passed`
- 命令5/6 生成 HTML/JSON/JUnit 报告与失败截图/trace/network-log
- 命令7 生成 `docs/reports/maestro-results.xml` 与 `test-results/maestro/`

---

## 阶段A结论

1. 已完成 30 个声明路由的功能建模，并明确核心链路、次要链路与高风险页。
2. 已形成覆盖冒烟、核心流程、异常流程、状态恢复、兼容性、性能与长尾页面的测试矩阵。
3. 现有自动化骨架已满足“模拟人工点击 + 输入 + 滑动 + 返回 + 切后台 + 断网/弱网 + 失败留证”。
4. 当前进入阶段B的主要阻塞从“安装缺失”收敛为“shell 环境未切换到 Node 20/OpenJDK + 原生包名需显式提供”。
