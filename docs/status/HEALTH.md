# EXAM-MASTER System Health Dashboard

> Last updated: 2026-03-23 | Maintainer: AI-SOP

## Deployment Status

| Environment                 | URL                                 | Status    | Last Deploy |
| --------------------------- | ----------------------------------- | --------- | ----------- |
| **Tencent Cloud (PRIMARY)** | `https://api.245334.xyz`            | 🟢 Online | 2026-03-23  |
| **Sealos Laf (FALLBACK)**   | `https://nf98ia8qnt.sealosbja.site` | 🟢 Online | 2026-03-22  |
| **CF Worker (API Proxy)**   | `https://api-gw.245334.xyz`         | 🟢 Online | 2026-03-23  |
| **WeChat MP**               | 微信搜索「考研备考」                | 🟡 审核中 | —           |
| **H5 (PWA)**                | —                                   | 🔵 未部署 | —           |

## Active Issues

> Severity: 🔴 Blocker | 🟠 Important | 🟡 Normal | 🔵 Low

| ID   | Severity | Domain   | Title                                                                                                 | Since      | Owner |
| ---- | -------- | -------- | ----------------------------------------------------------------------------------------------------- | ---------- | ----- |
| H001 | 🟡       | deploy   | Nginx backup 到 Sealos 需 HTTPS proxy，upstream 不支持混合协议                                        | 2026-03-23 | —     |
| H002 | 🟡       | backend  | cloud-shim `cloud.fetch` 非 axios 实例，不支持 `.get()`/`.post()` 短写法                              | 2026-03-23 | —     |
| H003 | 🔵       | frontend | 部分页面仍用 Options API 未迁移到 `<script setup>`（73个文件）                                        | 2026-03-22 | —     |
| H004 | 🔵       | frontend | `do-quiz.vue` (3131行) 和 `pk-battle.vue` (3327行) 需要组件拆分                                       | 2026-03-22 | —     |
| H005 | 🟠       | frontend | 88处页面直接调用 `lafService` 绕过 Store 层（架构违规）                                               | 2026-03-23 | —     |
| H006 | 🟡       | frontend | 142处 `uni.showToast` 待迁移至 `toast.js`（已迁移 72%）                                               | 2026-03-23 | —     |
| H007 | 🟡       | backend  | 4个端点用本地 `checkRateLimit` 而非分布式 `checkRateLimitDistributed`                                 | 2026-03-23 | —     |
| H008 | 🔴       | testing  | 单元测试：254个断言错误 (含状态码 500/401/404/400 校验异常及 `ReferenceError: logger is not defined`，缺少 `JWT_SECRET_PLACEHOLDER
| H009 | 🔴       | testing  | 单元测试：`tests/unit/regression-critical-fixes.spec.js` 导入报错导致套件失败，缺少 `useQuizAutoSave.js` | 2026-03-23 | —     |
| H010 | 🔴       | testing  | 视觉回归测试：11个页面/组件截图不匹配 (`home`, `practice`, `settings` 等，过期快照)                       | 2026-03-23 | —     |
| H011 | 🔴       | testing  | 视觉回归测试：`ai-classroom`, `onboarding` 完全缺失基准截图                                           | 2026-03-23 | —     |
| H012 | 🔴       | testing  | E2E回归测试：异常流程 (EXC-005) 聊天页降级交互响应超时 (Timeout)                                      | 2026-03-23 | —     |
| H013 | 🔴       | testing  | E2E回归测试：状态恢复 (STATE-005) 登录按钮快速多次点击未限制请求 (幂等性失败)                             | 2026-03-23 | —     |
| H014 | 🔴       | backend  | `group-service` `get_groups` 执行报错 `TypeError: query.count is not a function`                      | 2026-03-23 | —     |

## Recently Resolved

| ID   | Domain   | Title                                                            | Solution                                                            | Resolved   |
| ---- | -------- | ---------------------------------------------------------------- | ------------------------------------------------------------------- | ---------- |
| R017 | backend  | `question-bank.ts` seed_preset 无 admin 权限校验（权限提升漏洞） | 添加 `requireAdminAccess` 权限检查                                  | 2026-03-23 |
| R018 | backend  | `group-service.ts` 手动 JWT + 无限流 + 自定义 logger             | 重写为 `requireAuth` + `checkRateLimitDistributed` + `createLogger` | 2026-03-23 |
| R019 | backend  | `ai-friend-memory.ts` 手动 JWT + 无限流                          | 重写为 `requireAuth` + `checkRateLimitDistributed`                  | 2026-03-23 |
| R007 | frontend | `auth-storage.js` 调用不存在的 `uni.getItem()` 导致崩溃          | 替换为 `localStorage.getItem()`                                     | 2026-03-23 |
| R008 | frontend | `ai-classroom/index.vue` setInterval 泄漏（无 onUnmounted）      | 添加 activeTimers 追踪 + onBeforeUnmount 清理                       | 2026-03-23 |
| R009 | frontend | `ai.service.js` 双服务器切换用 console.warn/log 而非 logger      | 替换为 logger.warn/log                                              | 2026-03-23 |
| R010 | frontend | `config/index.js` 硬编码错误域名 `exam-master.com`               | 更新为实际生产域名 `245334.xyz`                                     | 2026-03-23 |
| R011 | frontend | `swr-cache.js` 用 console.warn 而非 logger                       | 导入 logger 并替换                                                  | 2026-03-23 |
| R012 | frontend | 重复的 `useQuizAutoSave.js`（pages/practice-sub/ 孤儿副本）      | 删除孤儿文件，所有导入均指向 composables/                           | 2026-03-23 |
| R013 | frontend | `offline-queue.js` 构造函数未初始化 `this.paused`                | 添加 `this.paused = false`                                          | 2026-03-23 |
| R014 | frontend | `index/index.vue` onLoad 重复注册 loginStatusChanged 监听        | 移除 onLoad 中的 uni.$on，由 onShow 统一管理                        | 2026-03-23 |
| R015 | backend  | 5个后端文件缺少 `.js` 导入扩展名                                 | 补全 study-stats/upload-avatar/user-profile/user-stats/voice 扩展名 | 2026-03-23 |
| R016 | backend  | `study-stats.ts` weeks 数组类型错误 (`{}[]`)                     | 添加正确类型 `{ total: number; correct: number }[]`                 | 2026-03-23 |
| R001 | backend  | Cerebras 模型 `llama-3.3-70b` 已下线                             | 更新为 `llama3.1-8b`                                                | 2026-03-22 |
| R002 | backend  | cloud-shim `_.or()` 在 `where()` 中产生错误查询                  | 添加顶层逻辑操作符处理                                              | 2026-03-23 |
| R003 | backend  | cloud-shim 缺少 `_.all()` 导致 TypeError                         | 添加 `all` 操作符                                                   | 2026-03-23 |
| R004 | backend  | Express 404 handler 先于路由注册                                 | 移到 `registerFunctions()` 之后                                     | 2026-03-23 |
| R005 | backend  | ESM `__dirname` 不可用                                           | 使用 `fileURLToPath(import.meta.url)`                               | 2026-03-23 |
| R006 | deploy   | Docker Hub 大陆被墙                                              | 配置镜像加速 + 改为本地编译部署                                     | 2026-03-23 |

## Tech Debt

| ID       | Domain   | Description                                                                       | Impact                     | Priority |
| -------- | -------- | --------------------------------------------------------------------------------- | -------------------------- | -------- |
| D001     | frontend | 5 个 domain service 文件仍包含完整 request 基础设施副本 (~2000行/个)              | 维护困难，改动需同步 6 处  | 🟠       |
| D002     | frontend | Home page (2310行) + Practice page (1955行) 逻辑应提取到 composables              | 可读性差                   | 🟡       |
| D003     | backend  | TS 源码缺少 `.js` 扩展名，每次编译需 perl 后处理（已修复5个文件）                 | 构建流程脆弱               | 🟡       |
| D004     | backend  | `common/config.js` 包含废弃的 `getApiKey()`                                       | 混淆新开发者               | 🔵       |
| D005     | infra    | Sealos HTTPS backup 需要 `error_page` + `proxy_pass` 方式实现                     | 故障转移不完整             | 🟡       |
| D006     | frontend | 142处 `uni.showToast` 待迁移至 `toast.js`（已迁移 72%）                           | UX 不一致                  | 🟡       |
| D007     | frontend | 73个 .vue 文件仍使用 Options API（应迁移到 `<script setup>`）                     | 代码不一致                 | 🔵       |
| D008     | frontend | 88处页面直接调用 `lafService` 绕过 Store 层                                       | 架构违规                   | 🟠       |
| D009     | frontend | 6个 mixin 文件应迁移为 composable（部分已有对应 composable）                      | 代码重复                   | 🔵       |
| ~~D010~~ | frontend | ~~`pages/social/socialService.js` 重复~~ → 已移到 `services/social-facade.js`     | ✅ R20 已解决              | ~~🔵~~   |
| D011     | backend  | ~~4个端点用本地 `checkRateLimit`~~ → 全部升级为 `checkRateLimitDistributed`       | ✅ R20 已解决              | ~~🟡~~   |
| D012     | testing  | 单元测试：`JWT_SECRET_PLACEHOLDER
| D013     | testing  | 单元测试：部分 `src/services/api/domains/` 代码与测试不匹配（如 `logger` 未定义） | 单元测试脆性大             | 🟠       |
| D014     | testing  | E2E测试环境：部分 E2E 测试因超时或服务不稳定而失败                                | 回归测试稳定性差           | 🟠       |

## Resource Monitoring

| Resource                 | Current           | Limit           | Alert Threshold |
| ------------------------ | ----------------- | --------------- | --------------- |
| Tencent Cloud RAM        | ~950MB            | 1.9GB           | 1.5GB           |
| Tencent Cloud Disk       | 11GB              | 40GB            | 32GB            |
| Tencent Cloud Bandwidth  | —                 | 200GB/月 @3Mbps | 160GB           |
| SiliconFlow DS Keys 余额 | 140元 (10条×14元) | —               | < 30元          |
| LLM Provider Pool        | 14 providers      | —               | < 8 可用        |
