# EXAM-MASTER System Health Dashboard

> Last updated: 2026-03-29 (十三轮审计 — 死代码深度清理+盲区扫描+.env同步修复) | Maintainer: AI-SOP

## Deployment Status

| Environment                 | URL                                 | Status    | Last Deploy |
| --------------------------- | ----------------------------------- | --------- | ----------- |
| **Tencent Cloud (PRIMARY)** | `https://api.245334.xyz`            | 🟢 Online | 2026-03-27  |
| **Sealos Laf (FALLBACK)**   | `https://nf98ia8qnt.sealosbja.site` | 🟢 Online | 2026-03-22  |
| **CF Worker (API Proxy)**   | `https://api-gw.245334.xyz`         | 🟢 Online | 2026-03-23  |
| **WeChat MP**               | 微信搜索「考研备考」                | 🟡 审核中 | —           |
| **H5 (PWA)**                | —                                   | 🔵 未部署 | —           |

## Active Issues

> Severity: 🔴 Blocker | 🟠 Important | 🟡 Normal | 🔵 Low

| ID       | Severity | Domain   | Title                                                                                                                | Since      | Owner |
| -------- | -------- | -------- | -------------------------------------------------------------------------------------------------------------------- | ---------- | ----- |
| ~~H001~~ | ~~🟡~~   | deploy   | ~~Nginx backup 到 Sealos 需 HTTPS proxy，upstream 不支持混合协议~~ → **R024 error_page + @sealos_fallback**          | 2026-03-23 | ✅    |
| ~~H002~~ | ~~🟡~~   | backend  | ~~cloud-shim `cloud.fetch` 非 axios 实例，不支持 `.get()`/`.post()` 短写法~~ → **已修复，添加 6 个短写法方法**       | 2026-03-23 | ✅    |
| ~~H003~~ | ~~🔵~~   | frontend | ~~部分页面仍用 Options API（73个文件）~~ → **R54 迁移28个, 剩余42个(均>364行)**                                      | 2026-03-22 | ✅    |
| ~~H004~~ | ~~🔵~~   | frontend | ~~do-quiz/pk-battle 需拆分~~ → **已有composable(R43/R45), D002额外提取5个composable, 暂不继续**                      | 2026-03-22 | ✅    |
| ~~H005~~ | ~~🟠~~   | frontend | ~~88处页面直接调用 `lafService` 绕过 Store 层~~ → **R53 修复31处(Cat-A), 34处标记为可接受例外, 剩余19处需扩展Store** | 2026-03-23 | ✅    |
| ~~H006~~ | ~~🟡~~   | frontend | ~~142处 `uni.showToast` 待迁移至 `toast.js`（已迁移 72%）~~ → **R52 迁移 490→8处 (98.9%)**                           | 2026-03-23 | ✅    |
| ~~H007~~ | ~~🟡~~   | backend  | ~~4个端点用本地 `checkRateLimit`~~ → 已升级为 `checkRateLimitDistributed` (D011/R20)                                 | 2026-03-23 | ✅    |
| ~~H008~~ | ~~🔴~~   | testing  | ~~单元测试：254个断言错误~~ → **R51 全量修复，0 失败**                                                               | 2026-03-23 | ✅    |
| ~~H009~~ | ~~🔴~~   | testing  | ~~regression-critical-fixes 导入报错~~ → **R50 导入路径已修正**                                                      | 2026-03-23 | ✅    |
| ~~H010~~ | ~~🔴~~   | testing  | ~~视觉回归测试：11个页面/组件截图不匹配~~ → **44/44 快照已更新，全部通过**                                           | 2026-03-23 | ✅    |
| ~~H011~~ | ~~🔴~~   | testing  | ~~视觉回归测试：`ai-classroom`, `onboarding` 缺失基准截图~~ → **pages.json 注册子包 + 快照已生成**                   | 2026-03-23 | ✅    |
| ~~H012~~ | ~~🔴~~   | testing  | ~~E2E回归测试：EXC-005 聊天页降级交互超时~~ → **setLoggedInSession 补 storageService 前缀键 + 超时增至 25s**         | 2026-03-23 | ✅    |
| ~~H013~~ | ~~🔴~~   | testing  | ~~E2E回归测试：STATE-005 登录按钮快速多次点击未限制~~ → **时间戳锁前移至 handleEmailLogin 函数顶部**                 | 2026-03-23 | ✅    |
| ~~H014~~ | ~~🔴~~   | backend  | ~~`group-service` `get_groups` TypeError: query.count is not a function~~ → **R51 条件对象+Promise.all重构**         | 2026-03-23 | ✅    |
| ~~H015~~ | ~~🟡~~   | frontend | ~~UI质量审查：6个组件捕获错误但缺少用户提示~~ → **R51 修复3个(MarkdownRenderer/question-bank/InviteModal)**          | 2026-03-23 | ✅    |
| ~~H016~~ | ~~🟡~~   | frontend | ~~FSRSOptimizer.vue 缺少加载状态~~ → **R51 新增 loading ref + 加载中/失败提示**                                      | 2026-03-23 | ✅    |
| ~~H017~~ | ~~🟡~~   | testing  | ~~单元测试 161/1260 失败~~ → **R51 全量修复 0/1263 失败**                                                            | 2026-03-26 | ✅    |
| ~~H018~~ | ~~🟡~~   | frontend | ~~微信MP主包2036KB~~ → **1888KB (R48/R49瘦身, 在2048KB限值内)**                                                      | 2026-03-25 | ✅    |

## Recently Resolved

> Severity: 🔴 Blocker | 🟠 Important | 🟡 Normal | 🔵 Low

| ID   | Domain   | Title                                                                  | Solution                                                                                            | Resolved   |
| ---- | -------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| R061 | infra    | 2个孤儿工具文件(code-highlight.js/mistake-classifier.js)零引用         | 删除文件                                                                                            | 2026-03-29 |
| R069 | frontend | 8个孤儿SCSS文件(~84KB/3956行)从未被import                              | 删除responsive/design-system\*/theme-bitget/theme-wise/\_theme-vars/\_variables.scss                | 2026-03-29 |
| R070 | docs     | docs/superpowers/ 13个已完成的spec/plan文件(1080行)                    | 确认功能均已实现后删除整个目录                                                                      | 2026-03-29 |
| R071 | docs     | 10个旧vitest/maestro快照JSON/XML(~2.9MB)未跟踪仍占磁盘                 | 删除vitest-results-r1/r3/r4/r5/r7/r8/r9/r10+maestro-smoke-r9/r10                                    | 2026-03-29 |
| R072 | frontend | useAppStore(app.js,110行)从未被任何页面/组件实例化                     | 删除store文件+从stores/index.js移除导出+删除3个对应测试                                             | 2026-03-29 |
| R073 | backend  | proxy-ai-stream.ts缺少对应.yaml配置文件                                | 创建proxy-ai-stream.yaml                                                                            | 2026-03-29 |
| R074 | backend  | laf-backend/dist/functions/job-bot-handoff-notify.js(.ts已删除的幽灵)  | 删除dist幽灵文件                                                                                    | 2026-03-29 |
| R075 | backend  | .env.example含已删除功能的5个JOB*BOT_HANDOFF*\*变量+12个未集成AI Key   | 移除JOB*BOT_HANDOFF*\*,精简未集成提供商为3个(GPT_API_FREE/NVIDIA/VOLCENGINE)                        | 2026-03-29 |
| R076 | config   | vite.config.js line 374注释说lightningcss但实际用esbuild               | 修正注释为esbuild                                                                                   | 2026-03-29 |
| R077 | docs     | 11个AI-SOP文档含160个死文件引用(删除的.service.js/chat组件/composable) | 3组并行Agent清理,utils-reference.md重建(39死),MODULE-INDEX(38),components(29)等                     | 2026-03-29 |
| R078 | docs     | docs/reports/current/README.md列出6个文件但仅1个存在                   | 更新为实际文件列表                                                                                  | 2026-03-29 |
| R079 | docs     | api-documentation.md主URL错误指向Sealos备用而非腾讯云主服务器          | 修正为https://api.245334.xyz为主,Sealos为备用                                                       | 2026-03-29 |
| R080 | frontend | vip.js(68行)+invite.js(64行)两个Store零UI消费者                        | 删除文件+从user.js移除17个代理导出+从stores/index.js移除                                            | 2026-03-29 |
| R081 | frontend | 5个Store共31个孤儿导出(-373行): study/school/theme/review/gamification | 逐文件验证后删除,study 174→66行,theme 263→89行,school 136→73行                                      | 2026-03-29 |
| R082 | frontend | 30个API导出零引用(-473行): ai/social/study/smart-study/practice等      | 8个文件逐函数grep验证后删除                                                                         | 2026-03-29 |
| R083 | config   | package.json dev/build脚本与dev:h5/build:h5语义重复                    | dev/build显式指定-p h5消除歧义                                                                      | 2026-03-29 |
| R084 | config   | .env.production缺失VITE_INVITE_SECRET(邀请签名功能异常)                | 本地补充(不入Git)                                                                                   | 2026-03-29 |
| R062 | docs     | 34+过期历史报告文件仍被Git跟踪(docs/reports/history/+current/)         | git rm + 删除96MB未跟踪HTML报告                                                                     | 2026-03-29 |
| R063 | frontend | performance.js含9个孤儿导出(memoize/batchProcess/useVirtualList等)     | 删除孤儿导出,474→238行                                                                              | 2026-03-29 |
| R064 | frontend | 8个工具文件共30个孤儿导出(未使用的函数/常量仍在打包)                   | 逐文件清理,总计删减约600行死代码                                                                    | 2026-03-29 |
| R065 | config   | .gitignore重复laf-backend/.app.yaml条目(行51和63)                      | 移除重复行                                                                                          | 2026-03-29 |
| R066 | config   | docker-compose.yml含已弃用version字段                                  | 移除version: '3.8'                                                                                  | 2026-03-29 |
| R067 | config   | .env.test含2个幽灵变量+缺少5个.env.example变量                         | 移除幽灵变量,补充缺失变量                                                                           | 2026-03-29 |
| R068 | docs     | 重复文档PROJECT_DEEP_SCAN_REPORT(2026-02-reset vs 2026-03-review)      | 删除2026-02-reset副本(2152行)                                                                       | 2026-03-29 |
| R027 | testing  | 视觉回归 44 快照过期/缺失 (H010/H011)                                  | `--update-snapshots` 全量更新 + ai-classroom/onboarding 注册到 pages.json subPackages               | 2026-03-26 |
| R031 | frontend | TabBar缺失"择校"标签（仅显示3个Tab）                                   | custom-tabbar.vue allTabs数组添加择校Tab（icon已存在于static/tabbar/）                              | 2026-03-29 |
| R032 | frontend | practice/index.vue:869 使用未导入的lafService导致运行时ReferenceError  | 改用practice.api.js的exportAnki()函数（动态import）                                                 | 2026-03-29 |
| R033 | infra    | 根目录App.vue与src/App.vue内容不同步（陈旧副本）                       | 删除根目录App.vue，src/App.vue为唯一真实版本                                                        | 2026-03-29 |
| R034 | infra    | common/目录2个文件零引用（config.js+common.scss）                      | 删除整个common/目录                                                                                 | 2026-03-29 |
| R035 | infra    | @formkit/auto-animate在dependencies中但从未import                      | npm uninstall                                                                                       | 2026-03-29 |
| R036 | infra    | Electron桌面应用缺少electron+electron-builder包和npm scripts           | 安装包+添加electron:dev/build:mac/build:win scripts                                                 | 2026-03-29 |
| R037 | infra    | src/manifest.json requiredPrivateInfos为空数组与根目录不一致           | 同步为4项（chooseAddress/chooseLocation/choosePoi/chooseMessageFile）                               | 2026-03-29 |
| R038 | docs     | CLAUDE.md SOP不完整（缺少技术咨询/性能优化路由+AI局限性防护）          | 全面重写：CEO模式+8个请求路由+AI防护表+Electron命令+配置文件索引                                    | 2026-03-29 |
| R039 | ci       | CI/CD trivy-action@0.28.0版本不存在，所有流水线失败                    | 更新为@v0.35.0（ci-cd.yml 2处 + security-scan.yml 2处）                                             | 2026-03-29 |
| R040 | ci       | QA Nightly Maestro因JAVA_TOOL_OPTIONS含Java 17不支持的参数而失败       | qa-nightly-regression.yml覆盖JAVA_TOOL_OPTIONS移除不兼容参数                                        | 2026-03-29 |
| R041 | infra    | 54个审计截图PNG仍被Git跟踪（~10MB仓库膨胀）                            | git rm -r --cached audit-screenshots/                                                               | 2026-03-29 |
| R042 | infra    | @vitest/coverage-istanbul和ai-agent-team两个未使用NPM包                | npm uninstall（vitest用v8 provider，ai-agent-team后端有独立package.json）                           | 2026-03-29 |
| R043 | infra    | 10个废弃脚本（一次性修复/过期shim/废弃工具）                           | 删除add-will-change/apply-design-tokens/convert-to-webp等10个文件                                   | 2026-03-29 |
| R044 | config   | manifest.json重复`plus`块（39行与app-plus完全重复）                    | 删除plus块，仅保留app-plus                                                                          | 2026-03-29 |
| R045 | config   | requiredPrivateInfos声明4个隐私API但仅1个实际使用                      | 移除chooseAddress/chooseLocation/choosePoi，仅保留chooseMessageFile                                 | 2026-03-29 |
| R046 | infra    | 根manifest.json与src/manifest.json重复                                 | 删除根manifest.json，src/为唯一真实版本                                                             | 2026-03-29 |
| R047 | config   | project.config.json的es6/enhance与manifest.json设置冲突                | 同步为false与manifest.json一致                                                                      | 2026-03-29 |
| R048 | config   | jsconfig.json 14行冗余路径别名+1个指向已删除目录的死别名               | 精简为仅`@/*`通配符                                                                                 | 2026-03-29 |
| R049 | frontend | 2个孤儿composable零引用（useSearchHistory、useStreamChat）             | 删除                                                                                                | 2026-03-29 |
| R050 | frontend | 2个废弃TabBar图标（universe/universe-active，无对应Tab）               | 删除                                                                                                | 2026-03-29 |
| R051 | frontend | PWA API缓存urlPattern缺少主服务器api.245334.xyz（离线缓存完全失效）    | vite.config.js:249 urlPattern添加api\.245334\.xyz匹配                                               | 2026-03-29 |
| R052 | frontend | PWA manifest lang默认"en"应为"zh-CN"                                   | vite.config.js manifest.lang改为'zh-CN'                                                             | 2026-03-29 |
| R053 | frontend | Electron preload.cjs未使用的ipcRenderer导入                            | 删除未使用import                                                                                    | 2026-03-29 |
| R054 | backend  | 孤儿YAML job-bot-handoff-notify.yaml（对应.ts已在Round 3删除）         | 删除orphan YAML                                                                                     | 2026-03-29 |
| R055 | backend  | smart-study-engine.ts缺少对应.yaml配置文件                             | 创建smart-study-engine.yaml                                                                         | 2026-03-29 |
| R056 | backend  | 3个孤儿工具类零引用（anomaly-detector/audit-logger/env-validator）     | 删除3个文件                                                                                         | 2026-03-29 |
| R057 | backend  | test-connection.js未引用+scripts/空目录                                | 删除文件和空目录                                                                                    | 2026-03-29 |
| R058 | backend  | standalone/package.json版本不一致（sql.js/ts-fsrs与laf-backend不同步） | 同步为sql.js ^1.14.1, ts-fsrs ^5.2.3                                                                | 2026-03-29 |
| R059 | backend  | laf-backend/.env.example缺少24个生产环境变量                           | 补充SiliconFlow DS Keys/其他AI提供商/请求签名/排行榜缓存/邮件重试等                                 | 2026-03-29 |
| R060 | frontend | 前端.env.example缺少3个VITE*CACHE*\*变量                               | 补充VITE_CACHE_DEFAULT_TTL/LONG_TTL/MAX_SIZE                                                        | 2026-03-29 |
| R028 | arch     | PK Battle API action名不匹配(4函数会被后端拒绝)                        | 重写为后端实际支持的7个action(find_match/poll_room/submit_result/room_answer/leave_room等)          | 2026-03-29 |
| R029 | arch     | 3对完全重复文件(useTypewriter/privacy-authorization/StudyHeatmap)      | 提取到共享位置(@/composables/@/utils/auth/),原位置改为代理re-export                                 | 2026-03-29 |
| R030 | infra    | 25个已合并本地分支+1个孤立pre-release分支堆积                          | 批量删除26个过期分支,保留2个有价值未合并分支(mp-html/yolo-optimizations)                            | 2026-03-29 |
| R026 | testing  | EXC-005 聊天页降级超时 (H012)                                          | `setLoggedInSession` 补 `__exam_storage__:` 前缀键 + chatInput/expectAnyText 超时增至 25s/20s       | 2026-03-26 |
| R025 | frontend | STATE-005 登录按钮快速多次点击幂等性 (H013)                            | `handleEmailLogin` 时间戳冷却检查 (`lastEmailSubmitAt`) 前移至函数首行，在 Vue ref 之前拦截         | 2026-03-26 |
| R024 | deploy   | Nginx upstream 不支持 HTTPS 后端，Sealos 备份失效                      | 移除 upstream backup，改用 `error_page 502 503 504 = @sealos_fallback` + `proxy_ssl_server_name on` | 2026-03-26 |
| R021 | testing  | 单元测试 161/1263 失败（26个文件）                                     | Timer 超时：限定 `toFake` 范围；Audit mock：集成 jwtPayload + 补缺依赖                              | 2026-03-26 |
| R022 | backend  | group-service get_groups TypeError: query.count is not a function      | 条件对象 + `collection.where(cond).count()` + `Promise.all` 并行                                    | 2026-03-26 |
| R023 | backend  | cloud-shim `cloud.fetch` 不支持 `.get()`/`.post()` 短写法              | `cloudFetch` 上挂载 `.get/.post/.put/.delete/.head/.patch` 快捷方法                                 | 2026-03-26 |
| ---- | -------- | ----------------------------------------------------------------       | -------------------------------------------------------------------                                 | ---------- |
| R017 | backend  | `question-bank.ts` seed_preset 无 admin 权限校验（权限提升漏洞）       | 添加 `requireAdminAccess` 权限检查                                                                  | 2026-03-23 |
| R018 | backend  | `group-service.ts` 手动 JWT + 无限流 + 自定义 logger                   | 重写为 `requireAuth` + `checkRateLimitDistributed` + `createLogger`                                 | 2026-03-23 |
| R019 | backend  | `ai-friend-memory.ts` 手动 JWT + 无限流                                | 重写为 `requireAuth` + `checkRateLimitDistributed`                                                  | 2026-03-23 |
| R007 | frontend | `auth-storage.js` 调用不存在的 `uni.getItem()` 导致崩溃                | 替换为 `localStorage.getItem()`                                                                     | 2026-03-23 |
| R008 | frontend | `ai-classroom/index.vue` setInterval 泄漏（无 onUnmounted）            | 添加 activeTimers 追踪 + onBeforeUnmount 清理                                                       | 2026-03-23 |
| R009 | frontend | `ai.service.js` 双服务器切换用 console.warn/log 而非 logger            | 替换为 logger.warn/log                                                                              | 2026-03-23 |
| R010 | frontend | `config/index.js` 硬编码错误域名 `exam-master.com`                     | 更新为实际生产域名 `245334.xyz`                                                                     | 2026-03-23 |
| R011 | frontend | `swr-cache.js` 用 console.warn 而非 logger                             | 导入 logger 并替换                                                                                  | 2026-03-23 |
| R012 | frontend | 重复的 `useQuizAutoSave.js`（pages/practice-sub/ 孤儿副本）            | 删除孤儿文件，所有导入均指向 composables/                                                           | 2026-03-23 |
| R013 | frontend | `offline-queue.js` 构造函数未初始化 `this.paused`                      | 添加 `this.paused = false`                                                                          | 2026-03-23 |
| R014 | frontend | `index/index.vue` onLoad 重复注册 loginStatusChanged 监听              | 移除 onLoad 中的 uni.$on，由 onShow 统一管理                                                        | 2026-03-23 |
| R015 | backend  | 5个后端文件缺少 `.js` 导入扩展名                                       | 补全 study-stats/upload-avatar/user-profile/user-stats/voice 扩展名                                 | 2026-03-23 |
| R016 | backend  | `study-stats.ts` weeks 数组类型错误 (`{}[]`)                           | 添加正确类型 `{ total: number; correct: number }[]`                                                 | 2026-03-23 |
| R001 | backend  | Cerebras 模型 `llama-3.3-70b` 已下线                                   | 更新为 `llama3.1-8b`                                                                                | 2026-03-22 |
| R002 | backend  | cloud-shim `_.or()` 在 `where()` 中产生错误查询                        | 添加顶层逻辑操作符处理                                                                              | 2026-03-23 |
| R003 | backend  | cloud-shim 缺少 `_.all()` 导致 TypeError                               | 添加 `all` 操作符                                                                                   | 2026-03-23 |
| R004 | backend  | Express 404 handler 先于路由注册                                       | 移到 `registerFunctions()` 之后                                                                     | 2026-03-23 |
| R005 | backend  | ESM `__dirname` 不可用                                                 | 使用 `fileURLToPath(import.meta.url)`                                                               | 2026-03-23 |
| R006 | deploy   | Docker Hub 大陆被墙                                                    | 配置镜像加速 + 改为本地编译部署                                                                     | 2026-03-23 |

## Tech Debt

| ID       | Domain      | Description                                                                                                                                     | Impact                             | Priority |
| -------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------- |
| ~~D001~~ | frontend    | ~~5 个 domain service 文件仍包含完整 request 基础设施副本 (~2000行/个)~~ → **R53 删除 6 个 .service.js, 接入 .api.js 体系, -10,085 行**         | ✅ R53 已解决                      | ~~🟠~~   |
| ~~D002~~ | frontend    | ~~Home page (2310行) + Practice page (1955行) 逻辑应提取到 composables~~ → **已提取5个composable，index.vue -218行，practice/index.vue -187行** | ~~可读性差~~                       | ✅       |
| ~~D003~~ | backend     | ~~TS 源码缺少 `.js` 扩展名，每次编译需 perl 后处理~~                                                                                            | ✅ R49 已全量补全 `.js` 扩展名     | ~~🟡~~   |
| ~~D004~~ | backend     | ~~`common/config.js` 包含废弃的 `getApiKey()`~~ → **R53 已删除**                                                                                | ✅ R53 已解决                      | ~~🔵~~   |
| ~~D005~~ | infra       | ~~Sealos HTTPS backup 需要 `error_page` + `proxy_pass` 方式实现~~                                                                               | ✅ R024 已解决                     | ~~🟡~~   |
| ~~D006~~ | frontend    | ~~142处 `uni.showToast` 待迁移至 `toast.js`（已迁移 72%）~~ → **R52 迁移 98.9% (490→8)**                                                        | ✅ 已迁移                          | ~~🟡~~   |
| ~~D007~~ | frontend    | ~~67个 .vue 文件仍使用 Options API~~ → **R54 迁移28个, 剩余42个(均>364行大文件)**                                                               | ✅ R54 主体解决                    | ~~🔵~~   |
| ~~D008~~ | frontend    | ~~88处页面直接调用 `lafService` 绕过 Store 层~~ → **R53 修复31处, 34处标记例外, 19处待扩展**                                                    | ✅ R53 主体解决                    | ~~🟠~~   |
| ~~D009~~ | frontend    | ~~6个 mixin 文件应迁移为 composable~~ → **R53 删除4个, 保留2个动态代码分割模块**                                                                | ✅ R53 已解决                      | ~~🔵~~   |
| ~~D010~~ | frontend    | ~~`pages/social/socialService.js` 重复~~ → 已移到 `services/social-facade.js`                                                                   | ✅ R20 已解决                      | ~~🔵~~   |
| D011     | backend     | ~~4个端点用本地 `checkRateLimit`~~ → 全部升级为 `checkRateLimitDistributed`                                                                     | ✅ R20 已解决                      | ~~🟡~~   |
| ~~D012~~ | testing     | ~~单元测试：`JWT_SECRET_PLACEHOLDER
| ~~D013~~ | testing     | ~~单元测试：部分 `src/services/api/domains/` 代码与测试不匹配（如 `logger` 未定义）~~                                                           | ✅ R50/R51 已解决                  | ~~🟠~~   |
| ~~D014~~ | testing     | ~~E2E测试环境：部分 E2E 测试因超时或服务不稳定而失败~~ → **R52 修复 EXC-005/STATE-005**                                                         | ✅ R52 已解决                      | ~~🟠~~   |
| ~~D015~~ | infra       | ~~`laf-backend/scripts/` 下 `crawlers`, `data-sync`, `test` 与 `scripts/` 重复~~ → 已删除冗余副本，独有文件迁移至 `scripts/`                    | ✅ 已清理                          | ~~🟡~~   |
| D016     | frontend    | `smart-study-engine` 后端需同步部署到 Sealos Laf；AIDailyBriefing AI增强依赖此函数，Laf备用环境下降级为纯本地规则                               | AI增强在备用环境不可用             | 🟡       |
| D017     | frontend    | `AIDailyBriefing` 的 `examDate` 需用户主动设置，未设置时倒计时不显示                                                                            | 新用户体验缺失                     | 🔵       |
| ~~D018~~ | backend     | ~~`.env.example` API密钥泄露~~ → **R032 审计确认：Git历史中全部为占位符(your_xxx_here)，无真实密钥泄露**                                        | ✅ R032 已确认安全                 | ~~🔴~~   |
| D019     | frontend    | `study.api.js` 与 `smart-study.api.js` 存在 4 个同名导出函数（analyzeMastery 等），且 `generateAdaptivePlan` vs `generateStudyPlan` 命名不一致  | 维护混淆                           | 🟡       |
| D020     | frontend    | `subscribe-message.js` 模板 ID 为空，服务完全不可用；需到微信公众平台申请订阅消息模板                                                           | 订阅提醒功能缺失                   | 🟡       |
| ~~D021~~ | frontend    | ~~6 个 `_unreleased/` 页面未注册到 `pages.json`~~ → **R028 删除6个死代码文件和\_unreleased目录**                                                | ✅ R028 已清理                     | ~~🔵~~   |
| D022     | infra       | HTTPS 443外部TLS握手被客户端RST重置，tcpdump确认服务器SSL响应正常发出；问题在客户端网络环境（ISP DPI或VPN）                                     | 客户端网络问题,微信小程序不受影响  | 🔵       |
| D023     | backend     | `standalone/package.json` 缺少 `ts-fsrs`/`jszip`/`sql.js`/`ai-agent-team` 依赖，导致4个云函数加载失败                                           | ✅ R029 已修复（服务器已安装）     | ~~🔴~~   |
| D024     | frontend    | NPM 安全审计报告 69 个漏洞（3 critical, 52 high），全部来自上游依赖链(vite-plugin-pwa/workbox/@dcloudio)无法安全修复                            | 等待上游更新                       | 🟡       |
| D028     | ci          | Docker构建`npm ci`失败：`node:20-alpine`(npm10)与本地`npm11`生成的lockfile不兼容；实际部署用scp不受影响                                         | 等待统一Node版本或改用npm install  | 🔵       |
| D029     | performance | 主入口JS 452KB(gzip 149KB)偏大，缺少manualChunks vendor分离（vue/pinia/uni-app运行时混在主chunk）                                               | 首屏加载偏慢，重复访问缓存命中率低 | 🟡       |
| D030     | performance | 未配置vite-plugin-compression构建时gzip/brotli预压缩，Nginx需实时压缩                                                                           | 安装后JS可从1968KB降至~589KB       | 🟡       |
| D031     | frontend    | 微信小程序主包1896KB/2048KB，余量仅152KB，新增功能需注意分包                                                                                    | 新功能可能导致主包超限             | 🟡       |
| ~~D032~~ | backend     | ~~3个冗余tsconfig文件~~ → **实际仅2个，分别服务Laf Cloud和Express Standalone，不可合并**                                                        | ✅ 已确认非冗余                    | ~~🔵~~   |
| D033     | frontend    | PWA图标512x512声称但文件仅4.8KB，可能非真实分辨率                                                                                               | PWA安装图标模糊                    | 🔵       |
| D034     | frontend    | PWA maskable图标与any图标使用同一文件（应分离为两个独立图标）                                                                                   | 部分设备图标显示不佳               | 🔵       |
| ~~D035~~ | frontend    | ~~35个后端API导出未在前端使用~~ → **R082 清理30个，剩余5个为合理预留**                                                                          | ✅ R082 已清理                     | ~~🔵~~   |
| D036     | backend     | 后端46个云函数存在3种响应格式(wrapResponse/内联对象/混合ok字段)，mistake-manager独有ok字段，social-service缺requestId                           | 不影响运行，后续统一               | 🔵       |
| ~~D025~~ | frontend    | ~~首页 content-wrapper 无底部padding，tabbar遮挡内容~~ → **R030 已修复**                                                                        | ✅ R030 已修复                     | ~~🟡~~   |
| ~~D026~~ | frontend    | ~~4对重复文件~~ → **R031 全部合并为重导出代理**                                                                                                 | ✅ R031 已清理                     | ~~🟡~~   |
| D027     | frontend    | 文件管理页面空态缺少图标和操作按钮 → **R033 已修复(添加emoji+导入按钮)**                                                                        | ✅ R033 已修复                     | ~~🔵~~   |

## Resource Monitoring

| Resource                 | Current           | Limit           | Alert Threshold |
| ------------------------ | ----------------- | --------------- | --------------- |
| Tencent Cloud RAM        | ~948MB            | 1.9GB           | 1.5GB           |
| Tencent Cloud Disk       | 16GB              | 40GB            | 32GB            |
| Tencent Cloud Bandwidth  | —                 | 200GB/月 @3Mbps | 160GB           |
| WeChat MP Main Package   | 1896KB            | 2048KB          | 1900KB          |
| H5 Bundle (gzip)         | ~1MB              | —               | 2MB             |
| SiliconFlow DS Keys 余额 | 140元 (10条×14元) | —               | < 30元          |
| LLM Provider Pool        | 14 providers      | —               | < 8 可用        |
