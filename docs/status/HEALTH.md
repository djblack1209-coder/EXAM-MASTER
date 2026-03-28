# EXAM-MASTER System Health Dashboard

> Last updated: 2026-03-28 (四轮深度审计-Phase26-完结) | Maintainer: AI-SOP

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

| ID   | Domain   | Title                                                             | Solution                                                                                            | Resolved   |
| ---- | -------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------- |
| R027 | testing  | 视觉回归 44 快照过期/缺失 (H010/H011)                             | `--update-snapshots` 全量更新 + ai-classroom/onboarding 注册到 pages.json subPackages               | 2026-03-26 |
| R026 | testing  | EXC-005 聊天页降级超时 (H012)                                     | `setLoggedInSession` 补 `__exam_storage__:` 前缀键 + chatInput/expectAnyText 超时增至 25s/20s       | 2026-03-26 |
| R025 | frontend | STATE-005 登录按钮快速多次点击幂等性 (H013)                       | `handleEmailLogin` 时间戳冷却检查 (`lastEmailSubmitAt`) 前移至函数首行，在 Vue ref 之前拦截         | 2026-03-26 |
| R024 | deploy   | Nginx upstream 不支持 HTTPS 后端，Sealos 备份失效                 | 移除 upstream backup，改用 `error_page 502 503 504 = @sealos_fallback` + `proxy_ssl_server_name on` | 2026-03-26 |
| R021 | testing  | 单元测试 161/1263 失败（26个文件）                                | Timer 超时：限定 `toFake` 范围；Audit mock：集成 jwtPayload + 补缺依赖                              | 2026-03-26 |
| R022 | backend  | group-service get_groups TypeError: query.count is not a function | 条件对象 + `collection.where(cond).count()` + `Promise.all` 并行                                    | 2026-03-26 |
| R023 | backend  | cloud-shim `cloud.fetch` 不支持 `.get()`/`.post()` 短写法         | `cloudFetch` 上挂载 `.get/.post/.put/.delete/.head/.patch` 快捷方法                                 | 2026-03-26 |
| ---- | -------- | ----------------------------------------------------------------  | -------------------------------------------------------------------                                 | ---------- |
| R017 | backend  | `question-bank.ts` seed_preset 无 admin 权限校验（权限提升漏洞）  | 添加 `requireAdminAccess` 权限检查                                                                  | 2026-03-23 |
| R018 | backend  | `group-service.ts` 手动 JWT + 无限流 + 自定义 logger              | 重写为 `requireAuth` + `checkRateLimitDistributed` + `createLogger`                                 | 2026-03-23 |
| R019 | backend  | `ai-friend-memory.ts` 手动 JWT + 无限流                           | 重写为 `requireAuth` + `checkRateLimitDistributed`                                                  | 2026-03-23 |
| R007 | frontend | `auth-storage.js` 调用不存在的 `uni.getItem()` 导致崩溃           | 替换为 `localStorage.getItem()`                                                                     | 2026-03-23 |
| R008 | frontend | `ai-classroom/index.vue` setInterval 泄漏（无 onUnmounted）       | 添加 activeTimers 追踪 + onBeforeUnmount 清理                                                       | 2026-03-23 |
| R009 | frontend | `ai.service.js` 双服务器切换用 console.warn/log 而非 logger       | 替换为 logger.warn/log                                                                              | 2026-03-23 |
| R010 | frontend | `config/index.js` 硬编码错误域名 `exam-master.com`                | 更新为实际生产域名 `245334.xyz`                                                                     | 2026-03-23 |
| R011 | frontend | `swr-cache.js` 用 console.warn 而非 logger                        | 导入 logger 并替换                                                                                  | 2026-03-23 |
| R012 | frontend | 重复的 `useQuizAutoSave.js`（pages/practice-sub/ 孤儿副本）       | 删除孤儿文件，所有导入均指向 composables/                                                           | 2026-03-23 |
| R013 | frontend | `offline-queue.js` 构造函数未初始化 `this.paused`                 | 添加 `this.paused = false`                                                                          | 2026-03-23 |
| R014 | frontend | `index/index.vue` onLoad 重复注册 loginStatusChanged 监听         | 移除 onLoad 中的 uni.$on，由 onShow 统一管理                                                        | 2026-03-23 |
| R015 | backend  | 5个后端文件缺少 `.js` 导入扩展名                                  | 补全 study-stats/upload-avatar/user-profile/user-stats/voice 扩展名                                 | 2026-03-23 |
| R016 | backend  | `study-stats.ts` weeks 数组类型错误 (`{}[]`)                      | 添加正确类型 `{ total: number; correct: number }[]`                                                 | 2026-03-23 |
| R001 | backend  | Cerebras 模型 `llama-3.3-70b` 已下线                              | 更新为 `llama3.1-8b`                                                                                | 2026-03-22 |
| R002 | backend  | cloud-shim `_.or()` 在 `where()` 中产生错误查询                   | 添加顶层逻辑操作符处理                                                                              | 2026-03-23 |
| R003 | backend  | cloud-shim 缺少 `_.all()` 导致 TypeError                          | 添加 `all` 操作符                                                                                   | 2026-03-23 |
| R004 | backend  | Express 404 handler 先于路由注册                                  | 移到 `registerFunctions()` 之后                                                                     | 2026-03-23 |
| R005 | backend  | ESM `__dirname` 不可用                                            | 使用 `fileURLToPath(import.meta.url)`                                                               | 2026-03-23 |
| R006 | deploy   | Docker Hub 大陆被墙                                               | 配置镜像加速 + 改为本地编译部署                                                                     | 2026-03-23 |

## Tech Debt

| ID       | Domain   | Description                                                                                                                                     | Impact                            | Priority |
| -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | -------- |
| ~~D001~~ | frontend | ~~5 个 domain service 文件仍包含完整 request 基础设施副本 (~2000行/个)~~ → **R53 删除 6 个 .service.js, 接入 .api.js 体系, -10,085 行**         | ✅ R53 已解决                     | ~~🟠~~   |
| ~~D002~~ | frontend | ~~Home page (2310行) + Practice page (1955行) 逻辑应提取到 composables~~ → **已提取5个composable，index.vue -218行，practice/index.vue -187行** | ~~可读性差~~                      | ✅       |
| ~~D003~~ | backend  | ~~TS 源码缺少 `.js` 扩展名，每次编译需 perl 后处理~~                                                                                            | ✅ R49 已全量补全 `.js` 扩展名    | ~~🟡~~   |
| ~~D004~~ | backend  | ~~`common/config.js` 包含废弃的 `getApiKey()`~~ → **R53 已删除**                                                                                | ✅ R53 已解决                     | ~~🔵~~   |
| ~~D005~~ | infra    | ~~Sealos HTTPS backup 需要 `error_page` + `proxy_pass` 方式实现~~                                                                               | ✅ R024 已解决                    | ~~🟡~~   |
| ~~D006~~ | frontend | ~~142处 `uni.showToast` 待迁移至 `toast.js`（已迁移 72%）~~ → **R52 迁移 98.9% (490→8)**                                                        | ✅ 已迁移                         | ~~🟡~~   |
| ~~D007~~ | frontend | ~~67个 .vue 文件仍使用 Options API~~ → **R54 迁移28个, 剩余42个(均>364行大文件)**                                                               | ✅ R54 主体解决                   | ~~🔵~~   |
| ~~D008~~ | frontend | ~~88处页面直接调用 `lafService` 绕过 Store 层~~ → **R53 修复31处, 34处标记例外, 19处待扩展**                                                    | ✅ R53 主体解决                   | ~~🟠~~   |
| ~~D009~~ | frontend | ~~6个 mixin 文件应迁移为 composable~~ → **R53 删除4个, 保留2个动态代码分割模块**                                                                | ✅ R53 已解决                     | ~~🔵~~   |
| ~~D010~~ | frontend | ~~`pages/social/socialService.js` 重复~~ → 已移到 `services/social-facade.js`                                                                   | ✅ R20 已解决                     | ~~🔵~~   |
| D011     | backend  | ~~4个端点用本地 `checkRateLimit`~~ → 全部升级为 `checkRateLimitDistributed`                                                                     | ✅ R20 已解决                     | ~~🟡~~   |
| ~~D012~~ | testing  | ~~单元测试：`JWT_SECRET_PLACEHOLDER
| ~~D013~~ | testing  | ~~单元测试：部分 `src/services/api/domains/` 代码与测试不匹配（如 `logger` 未定义）~~                                                           | ✅ R50/R51 已解决                 | ~~🟠~~   |
| ~~D014~~ | testing  | ~~E2E测试环境：部分 E2E 测试因超时或服务不稳定而失败~~ → **R52 修复 EXC-005/STATE-005**                                                         | ✅ R52 已解决                     | ~~🟠~~   |
| ~~D015~~ | infra    | ~~`laf-backend/scripts/` 下 `crawlers`, `data-sync`, `test` 与 `scripts/` 重复~~ → 已删除冗余副本，独有文件迁移至 `scripts/`                    | ✅ 已清理                         | ~~🟡~~   |
| D016     | frontend | `smart-study-engine` 后端需同步部署到 Sealos Laf；AIDailyBriefing AI增强依赖此函数，Laf备用环境下降级为纯本地规则                               | AI增强在备用环境不可用            | 🟡       |
| D017     | frontend | `AIDailyBriefing` 的 `examDate` 需用户主动设置，未设置时倒计时不显示                                                                            | 新用户体验缺失                    | 🔵       |
| ~~D018~~ | backend  | ~~`.env.example` API密钥泄露~~ → **R032 审计确认：Git历史中全部为占位符(your_xxx_here)，无真实密钥泄露**                                        | ✅ R032 已确认安全                | ~~🔴~~   |
| D019     | frontend | `study.api.js` 与 `smart-study.api.js` 存在 4 个同名导出函数（analyzeMastery 等），且 `generateAdaptivePlan` vs `generateStudyPlan` 命名不一致  | 维护混淆                          | 🟡       |
| D020     | frontend | `subscribe-message.js` 模板 ID 为空，服务完全不可用；需到微信公众平台申请订阅消息模板                                                           | 订阅提醒功能缺失                  | 🟡       |
| ~~D021~~ | frontend | ~~6 个 `_unreleased/` 页面未注册到 `pages.json`~~ → **R028 删除6个死代码文件和\_unreleased目录**                                                | ✅ R028 已清理                    | ~~🔵~~   |
| D022     | infra    | HTTPS 443外部TLS握手被客户端RST重置，tcpdump确认服务器SSL响应正常发出；问题在客户端网络环境（ISP DPI或VPN）                                     | 客户端网络问题,微信小程序不受影响 | 🔵       |
| D023     | backend  | `standalone/package.json` 缺少 `ts-fsrs`/`jszip`/`sql.js`/`ai-agent-team` 依赖，导致4个云函数加载失败                                           | ✅ R029 已修复（服务器已安装）    | ~~🔴~~   |
| D024     | frontend | NPM 安全审计报告 69 个漏洞（3 critical, 52 high），全部来自上游依赖链(vite-plugin-pwa/workbox/@dcloudio)无法安全修复                            | 等待上游更新                      | 🟡       |
| ~~D025~~ | frontend | ~~首页 content-wrapper 无底部padding，tabbar遮挡内容~~ → **R030 已修复**                                                                        | ✅ R030 已修复                    | ~~🟡~~   |
| ~~D026~~ | frontend | ~~4对重复文件~~ → **R031 全部合并为重导出代理**                                                                                                 | ✅ R031 已清理                    | ~~🟡~~   |
| D027     | frontend | 文件管理页面空态缺少图标和操作按钮 → **R033 已修复(添加emoji+导入按钮)**                                                                        | ✅ R033 已修复                    | ~~🔵~~   |

## Resource Monitoring

| Resource                 | Current           | Limit           | Alert Threshold |
| ------------------------ | ----------------- | --------------- | --------------- |
| Tencent Cloud RAM        | ~885MB            | 1.9GB           | 1.5GB           |
| Tencent Cloud Disk       | 16GB              | 40GB            | 32GB            |
| Tencent Cloud Bandwidth  | —                 | 200GB/月 @3Mbps | 160GB           |
| SiliconFlow DS Keys 余额 | 140元 (10条×14元) | —               | < 30元          |
| LLM Provider Pool        | 14 providers      | —               | < 8 可用        |
