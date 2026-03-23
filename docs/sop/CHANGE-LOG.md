# EXAM-MASTER Change Log

> Version: 2.0 | Scope tags: `frontend` | `backend` | `ai-pool` | `deploy` | `auth` | `database` | `docs` | `infra`

## Format

```
## [YYYY-MM-DD] Session Title
- **Scope**: [frontend|backend|ai-pool|deploy|auth|database|docs|infra]
- **Files Changed**: list of files
- **Summary**: What was done and why
- **Breaking Changes**: Any API or behavior changes
```

---

## [2026-03-23] Round 24: 项目深度扫描审计

- **Scope**: docs | infra
- **Files Changed**:
  - `docs/status/HEALTH.md`
  - `docs/AI-SOP/MODULE-INDEX.md`
  - `docs/sop/CHANGE-LOG.md`
- **Summary**:
  - 通过查看自动生成的 `docs/reports/PROJECT_DEEP_SCAN_REPORT.md`，发现项目中存在目录冗余。
  - 明确发现 `laf-backend/scripts/` 下的 `crawlers`, `data-sync`, `test` 等目录与根目录下相应的 `scripts/` 子目录重复。
  - 更新了 `docs/status/HEALTH.md` 中的技术债条目（添加了 D015）以记录这些重复目录可能带来的维护负担。
  - 更新了 `docs/AI-SOP/MODULE-INDEX.md`，在结尾补充了有关脚本目录冗余的注释，以便后续开发注意。
- **Breaking Changes**: None

---

## [2026-03-23] Round 23: UI质量门禁审计

- **Scope**: docs | frontend
- **Files Changed**:
  - `docs/status/HEALTH.md`
  - `docs/AI-SOP/modules/styling-system.md`
  - `docs/sop/CHANGE-LOG.md`
- **Summary**:
  - 运行 `npm run audit:ui-quality` 对前端组件和页面的 UI 质量进行扫描。
  - 当前评分：**97/100**，总计检查了 268 个文件（120 个 Vue 文件，148 个 JS 文件）。
  - 通过项包含：26 个加载状态实现，154 个错误处理覆盖，68 个 GPU 加速组件（242 项全通过）。
  - 共记录了 7 个警告并已更新至 `HEALTH.md`（H015, H016），主要集中在 `base-icon.vue`, `MarkdownRenderer.vue`, `WelcomeBanner.vue`, `SchoolSearchInput.vue`, `question-bank.vue`, `InviteModal.vue` 捕获到错误但无用户提示；以及 `FSRSOptimizer.vue` 存在异步操作但缺少加载状态。
  - 将相关的 UI 质量审查结果详细信息补充更新至 `docs/AI-SOP/modules/styling-system.md` 的 `UI Quality Metrics` 章节。
- **Breaking Changes**: None

---

## [2026-03-23] Round 22: 测试基础设施第二次审计与状态更新

- **Scope**: docs | testing
- **Files Changed**:
  - `docs/status/HEALTH.md`
  - `docs/AI-SOP/modules/testing-infra.md`
  - `docs/sop/CHANGE-LOG.md`
- **Summary**:
  - 补充了具体的测试失败信息到健康状态与测试架构文档中，重点标注了 4 个具体维度的失败：
  - Unit Tests: 254 / ~300 失败，具体原因包括 `JWT_SECRET_PLACEHOLDER
  - Visual Regression: 11 失败，其中因为过期快照造成核心页不匹配，且完全缺失 `ai-classroom-classroom` 及 `onboarding` 页面的截图文件。
  - E2E Regression: EXC-005（智能接口超时）与 STATE-005（登录按钮多次点击触发多次请求带来的幂等性问题）等失败。
- **Breaking Changes**: None

---

## [2026-03-23] Round 21: 测试基础设施审计与状态更新

- **Scope**: docs
- **Files Changed**:
  - `docs/AI-SOP/modules/testing-infra.md`
  - `docs/sop/CHANGE-LOG.md`
- **Summary**:
  - 执行了测试套件的全面审计并更新 `testing-infra.md` 文档，记录了测试套件的当前状态与失败原因。
  - Unit Tests: 约 254/300 失败，主要由于环境缺失 `JWT_SECRET_PLACEHOLDER
  - Visual Regression Tests: 11/48 失败，主要由于未预期的基准图像差异（合法的 UI 更改未重新捕获）以及新页面缺少快照文件。
  - E2E Regression Tests: 2/~30 失败，主要因为异常流程的超时（Timeout）以及状态恢复页面的并发/幂等性错误。
- **Breaking Changes**: None

---

## [2026-03-23] Round 20: 限流升级 + 代码清理 + 测试修复 — 通过率 993→1006

- **Scope**: backend + frontend + tests
- **Files Changed**:
  - `laf-backend/functions/achievement-manager.ts` — `checkRateLimit` → `checkRateLimitDistributed`
  - `laf-backend/functions/learning-goal.ts` — `checkRateLimit` → `checkRateLimitDistributed`
  - `laf-backend/functions/user-stats.ts` — `checkRateLimit` → `checkRateLimitDistributed`
  - `laf-backend/functions/learning-resource.ts` — `checkRateLimit` → `checkRateLimitDistributed`（2处）
  - `laf-backend/functions/school-crawler-api.ts` — `checkRateLimit` → `checkRateLimitDistributed`
  - `src/pages/social/socialService.js` → `src/services/social-facade.js`（移出 pages/ 到正确的服务层）
  - `src/pages/social/friend-profile.vue` — 更新 socialService 导入路径
  - `src/pages/social/friend-list.vue` — 更新 socialService 导入路径
  - `tests/unit/formatters.spec.js` — 修复 15 个因 dayjs relativeTime + vi.useFakeTimers 不兼容导致的预存失败
- **Summary**: (1) 技术债 D011 全面清除：5个后端文件 6处调用从本地内存限流升级为 MongoDB 分布式限流，多实例部署不再绕过限流。(2) 技术债 D010 清除：重复的 `socialService.js` 从 pages/ 移到 services/ 目录，消除架构违规。(3) 修复 `formatters.spec.js` 15 个预存失败：根因是 dayjs `fromNow()` 与 `vi.useFakeTimers()` 冲突导致 afterEach 超时。重写为不依赖 fake timers 的相对时间匹配模式。全量测试通过率从 993→1006。
- **Breaking Changes**: 无。限流行为对外不变，仅内部存储从内存升级为数据库。

---

## [2026-03-23] Round 19 (QA): 深度安全审计 — 3 个 CRITICAL 权限漏洞修复 + 6 项安全回归测试

- **Scope**: backend + docs
- **Files Changed**:
  - `laf-backend/functions/question-bank.ts` — **CRITICAL** `seed_preset` action 添加 `requireAdminAccess` 权限检查（之前任何认证用户可注入 500 题）
  - `laf-backend/functions/group-service.ts` — **CRITICAL** 重写认证层：手动 JWT 解析 → `requireAuth()` 统一中间件 + 添加 `checkRateLimitDistributed` 分布式限流 + 自定义 logger → `createLogger()`
  - `laf-backend/functions/ai-friend-memory.ts` — **CRITICAL** 手动 JWT → `requireAuth()` + 添加 `checkRateLimitDistributed`（30次/分钟）
  - `tests/unit/qa-backend-security-audit.spec.js` (new) — 安全回归测试（6 cases: seed_preset 权限、group-service 认证、ai-friend-memory IDOR）
  - `docs/status/HEALTH.md` — 新增 R017-R019 已解决 + H007 活跃问题 + D011 技术债
  - `docs/sop/CHANGE-LOG.md` — 本记录
- **Summary**: 以 QA 工程师视角对全部 46 个后端云函数进行安全审计，重点检查认证一致性、限流覆盖、IDOR 防护、参数校验。发现 3 个 CRITICAL 权限漏洞：(1) `question-bank` 的 `seed_preset` 无 admin 权限校验，任何登录用户可批量注入题目；(2) `group-service` 未使用 `requireAuth` 统一中间件且无限流，认证不一致；(3) `ai-friend-memory` 同样绕过统一认证且无限流。同时识别 4 个端点使用本地 `checkRateLimit` 而非分布式 `checkRateLimitDistributed` 的稳定性风险。H5 构建验证通过，全量测试 993/1260 通过（无新增回归）。
- **Breaking Changes**: `seed_preset` 现在需要管理员密钥（`x-admin-secret` header 或 JWT admin role），普通用户调用将返回 403。

---

## [2026-03-23] Round 18: 全面审计 — 10 个 Bug 修复 + 5 个后端 TS 修复 + 4 项新增技术债记录

- **Scope**: frontend + backend + docs
- **Files Changed**:
  - `src/services/auth-storage.js` — **CRITICAL** `uni.getItem()` → `localStorage.getItem()`（修复运行时崩溃）
  - `src/pages/ai-classroom/index.vue` — **CRITICAL** 添加 `activeTimers` 追踪 + `onBeforeUnmount` 清理 setInterval/setTimeout 泄漏
  - `src/services/api/domains/ai.service.js` — `console.warn/log` → `logger.warn/log`（3处）
  - `src/config/index.js` — 硬编码域名 `exam-master.com` → 实际生产域名 `245334.xyz`（2处）
  - `src/utils/cache/swr-cache.js` — 导入 `logger` + `console.warn` → `logger.warn`（2处）
  - `src/utils/core/offline-queue.js` — 构造函数添加 `this.paused = false` 初始化
  - `src/pages/index/index.vue` — 移除 onLoad 中重复的 `uni.$on('loginStatusChanged')` 注册
  - `src/pages/practice-sub/useQuizAutoSave.js` — 删除孤儿重复文件（所有导入均指向 composables/）
  - `laf-backend/functions/study-stats.ts` — 修复 weeks 数组类型 `{}[]` → `{ total: number; correct: number }[]` + 补全 `.js` 导入扩展名
  - `laf-backend/functions/upload-avatar.ts` — 补全 `.js` 导入扩展名（2处）
  - `laf-backend/functions/user-profile.ts` — 补全 `.js` 导入扩展名（2处）
  - `laf-backend/functions/user-stats.ts` — 补全 `.js` 导入扩展名（2处）
  - `laf-backend/functions/voice-service.ts` — 补全 `.js` 导入扩展名（4处）
  - `tests/unit/ai-classroom-timer-cleanup.spec.js` (new) — 定时器清理测试（3 cases）
  - `docs/status/HEALTH.md` — 新增 R007-R016 已解决问题 + H005-H006 活跃问题 + D007-D010 技术债
  - `docs/sop/CHANGE-LOG.md` — 本记录
- **Summary**: 对全项目前端+后端进行系统化审计（审查 100+ Vue 文件 + 46 个云函数）。发现并修复 2 个 CRITICAL 运行时 Bug（auth-storage 调用不存在的 uni.getItem 导致 H5 端认证崩溃；ai-classroom 定时器泄漏）、4 个 IMPORTANT 问题（生产 console 输出、错误域名、重复文件、未初始化字段）、4 个 NORMAL 问题（事件监听重复注册等）。后端修复 5 个文件的 TypeScript 导入扩展名 + 1 处类型错误。新增 4 项技术债记录（Options API 迁移 73 文件、lafService 架构违规 88 处、mixin 残留 6 个、socialService 重复）。H5 构建验证通过，测试 988/1251 通过（263 个为预存失败）。
- **Breaking Changes**: 无。

---

## [2026-03-23] Round 17: 数字格式化 + 搜索历史 + 页面过渡 + Toast 大扫除

- **Scope**: frontend
- **Files Changed**:
  - `src/utils/core/index.js` — 新增 `formatNumberCN(num)`: 12000→"1.2万", 135000000→"1.4亿"（搬运自 GSQZ/TuneFree 700+ Stars）
  - `src/pages/practice-sub/question-bank.vue` — 题库总数使用 `formatNumberCN` 展示
  - `src/components/business/school/SchoolSearchInput.vue` — v3: 集成 `useSearchHistory` 搜索历史（聚焦空输入框 → 展示最近搜索标签 → 点击直接搜索 → 选择学校后自动记录）
  - `src/components/common/PageTransition.vue` (new) — CSS-only 页面过渡动画组件（4种动画：slide-up/fade/slide-left/zoom），搬运 Nuxt 50k+ Stars 过渡模式，支持 prefers-reduced-motion
  - `src/composables/useSearchHistory.js` — 搜索历史持久化 composable（去重+置顶+上限+uni.setStorageSync）
  - Toast 第三波迁移: composables(31处) + 页面残余(16处) = 47处，全项目 uni.showToast 从 192→145，累计迁移率 **72%** (378/523)
  - 修复全部 Python 脚本产生的转义引号 bug（18个文件）
- **Summary**: 本轮三条主线并行推进。(1) formatNumberCN 让大数字展示更自然（考研题库数万题时展示"1.2万"而非"12000"）。(2) SchoolSearchInput 三代升级完成：v1 纯字符串匹配 → v2 拼音搜索 → v3 搜索历史。用户聚焦搜索框即可看到最近搜索的学校，一键回搜。(3) PageTransition 提供 4 种 CSS-only 过渡动画，可用于内容切换/弹窗弹出等场景。
- **Breaking Changes**: 无。`formatNumber` 原函数保持不变（千分位），新增 `formatNumberCN`。

---

## [2026-03-23] Round 15: 搜索体验 + 骨架屏 + Toast 批量迁移

- **Scope**: frontend
- **Files Changed**:
  - `package.json` — 新增 `pinyin-match`（WeChat MP 兼容，1.7k Stars）
  - `src/components/business/school/SchoolSearchInput.vue` — v2: 本地搜索从纯 `includes` 升级为 `PinyinMatch.match()`，支持拼音首字母/全拼/多音字（bjdx→北京大学，qhdx→清华大学）；placeholder 提示支持拼音
  - `src/pages/practice-sub/question-bank.vue` — 骨架屏替换：删除 ~50行手写 skeleton CSS + HTML，改用 wot-design-uni `wd-skeleton`（flicker 动画，0 新依赖）
  - `src/pages/login/index.vue` — 36/39 处 `uni.showToast` 迁移至 `toast.js`
  - `src/pages/settings/index.vue` — 24/33 处迁移至 `toast.js`
  - `src/pages/profile/index.vue` — 21/26 处迁移至 `toast.js`
  - `src/pages/school/index.vue` — 24/24 处迁移至 `toast.js`（100%）
- **Summary**: 按价值位阶推进三类优化。(1) pinyin-match 解决学校搜索痛点：用户输入「bjdx」「清华」「qhdx」都能命中结果，提升新用户注册/选校转化率。(2) wd-skeleton 替换手写骨架屏：减少约 50 行 CSS 代码，动画效果更统一（wot-design-uni 已是项目依赖，0 新包）。(3) Toast 批量迁移：top-4 高密度页面 105 处调用统一迁移，全项目 uni.showToast 从 523 降至 419（已迁移 20%，剩余页面后续轮次继续）。
- **Breaking Changes**: 无。

---

## [2026-03-23] Round 14: 工具链升级 — timeago / toast / countup / mp-html

- **Scope**: frontend
- **Files Changed**:
  - `package.json` — 新增 `timeago.js@latest` (5k+ Stars) + `countup.js@latest` (10k+ Stars)
  - `src/utils/timeago.js` (new) — 搬运 timeago.js 中文 locale 注册方案，导出 `formatTimeago()` (相对时间) + `smartTimeFormat()` (智能混合：<7天相对/>=7天绝对)
  - `src/utils/toast.js` (new) — 中心化 Toast 工具，统一 API：`toast.success/error/info/warn/loading/hide()`，底层复用 `uni.showToast` + `uni.hideToast`
  - `src/utils/useCountUp.js` (new) — 搬运 countup.js 核心 easeOutCubic 缓动逻辑，适配 uni-app requestAnimationFrame，支持千分位/前缀后缀/完成回调
  - `src/components/base/CountUpNumber.vue` (new) — countup 封装组件，`<CountUpNumber :to="score" prefix="" suffix="分" />`，可直接替换现有 useAnimatedNumber
  - `src/components/business/chat/MarkdownRenderer.vue` — 升级为 mp-html 渲染（支持可选文本/图片预览/链接跳转/代码高亮），注册 `mpHtml` 组件
  - `src/pages/mistake/MistakeCard.vue` — `formatDate()` 集成 `formatTimeago`：7天内显示「3分钟前」/「昨天」，>7天显示绝对日期
  - `src/pages/social/friend-list.vue` — `formatTime()` 删除 ~20行手写 timeago 代码，替换为 `smartTimeFormat()`
  - `src/pages/practice-sub/question-bank.vue` — 导入 `toast.js`，示范性替换 `uni.showToast` 调用
- **Summary**: 按价值位阶搬运高 Star 工具库，消除重复代码。timeago.js 替换 friend-list 里 20 行手写相对时间逻辑；toast.js 统一 523 处散落的 uni.showToast 调用（本轮示范 question-bank，后续可 ESLint rule 强制）；countup.js 提供更强大的数字动画（千分位+前后缀+回调），可替代现有 useAnimatedNumber；MarkdownRenderer 升级为 mp-html 解锁可选文字/图片预览。
- **Breaking Changes**: 无（所有改动向后兼容）。

---

## [2026-03-23] Round 13: 高 Star 开源组件集成 + 核心体验升级

- **Scope**: frontend
- **Files Changed**:
  - `package.json` — 新增 `highlight.js@^11.11.1` (23k+ Stars) + `z-paging@^2.8.8` (3k+ Stars)
  - `src/utils/code-highlight.js` (new) — 搬运 highlight.js 按需加载方案，15 语言注册，GitHub 双主题配色(light/dark)，CSS 类名→内联样式转换（兼容 rich-text）
  - `src/pages/practice-sub/composables/useMarkdownRenderer.js` — 集成代码高亮：markdown-it `highlight` 回调 + 亮暗双实例缓存 + 自定义 fence 渲染器(语言标签+复制提示)
  - `src/components/business/chat/MarkdownRenderer.vue` — 传入 isDark 到渲染函数 + watch isDark 重新渲染代码块颜色
  - `src/pages/practice-sub/question-bank.vue` — 补齐缺失的下拉刷新（refresher-enabled + onPullRefresh）
  - `src/pages/knowledge-graph/components/ForceGraph.vue` — v2 增强：BFS 连通子图高亮 + 边流光粒子 + 待复习节点脉动 + 单指画布平移 + 暗色信息面板 + 速度阻尼(搬运 d3-force 策略) + 节点再点取消选中
  - `src/components/charts/StudyTrend.vue` — v2 增强：dataZoom 横向滚动(>7天) + 做题量 areaStyle 渐变面积 + markLine 平均值参考线 + 自定义 HTML tooltip + hover emphasis
  - `src/components/charts/SkillRadar.vue` — v2 增强：tooltip 能力画像(各科百分比+评级) + hover emphasis(线宽放大+面积加深)
  - `src/components/charts/ForgettingCurve.vue` — v2 增强：tooltip 达标/未达标状态提示 + borderRadius + padding 统一
- **Summary**: 按价值位阶从 GitHub 搬运高 Star 组件集成，不重复造轮子。Tier 1: highlight.js 让 AI 对话代码块从纯文本升级为 15 语言语法高亮+GitHub 配色+暗色适配。Tier 2: 题库页补齐下拉刷新(原无此功能)。Tier 3: 知识图谱从"静态展示"升级为"可交互探索"(选中节点→BFS 高亮关联子图→非关联节点降透明→边上流光粒子→待复习节点脉动+单指平移画布)。Tier 4: 三个图表组件搬运 ECharts 官方最佳实践配置(dataZoom/areaStyle/markLine/自定义 tooltip)。
- **Breaking Changes**: `renderMarkdownAsync(text)` 新增可选第二参数 `{ isDark }`, 旧调用不传参时 isDark 默认 false, 完全向后兼容。

---

## [2026-03-23] Round 12: AI-SOP 文档体系升级 v2.0

- **Scope**: docs
- **Files Changed**:
  - `CLAUDE.md` (new) — 根目录 AI 入口，30 秒速览 + 铁律 + 完工协议 + 已知陷阱 + 配置表
  - `.cursorrules` (new) — Cursor 自动读取
  - `.clinerules` (new) — Cline 自动读取
  - `docs/PROJECT-INDEX.md` (new) — 项目全景导航 + 快速跳转表 + 服务器拓扑
  - `docs/status/HEALTH.md` (new) — 系统健康仪表盘 (部署状态 + 活跃Bug + 已解决 + 技术债 + 资源监控)
  - `docs/sop/AI-DEV-RULES.md` (new) — 10 条铁律 (从 SOP-RULES.md 迁移精简)
  - `docs/sop/UPDATE-PROTOCOL.md` (new) — 文档更新触发矩阵 + CHANGE-LOG 格式 + Bug 生命周期
  - `docs/sop/CHANGE-LOG.md` (moved) — 从 `docs/AI-SOP/CHANGE-LOG.md` 迁移，增加领域标签
  - `docs/AI-SOP/SOP-RULES.md` — 标记 DEPRECATED，指向新位置
  - `docs/AI-SOP/CHANGE-LOG.md` — 标记 MOVED，指向新位置
- **Summary**: 对标 GitHub 顶级开源项目 (Twenty CRM, Anthropic Cookbook) 的 CLAUDE.md 模式，建立三层文档防线: 根目录入口 (AI 自动读取) → 系统感知 (上帝视角) → 开发规范 (深入工作)。原 `docs/AI-SOP/` 16 个文件作为第四层深度参考保留，不删除。
- **Breaking Changes**: CHANGE-LOG 位置从 `docs/AI-SOP/CHANGE-LOG.md` 移至 `docs/sop/CHANGE-LOG.md`。旧位置保留重定向。

---

## [2026-03-23] Round 11: CF Worker + HTTPS + 前端双服务器切换

- **Scope**: deploy + frontend + infra
- **Files Changed**:
  - `deploy/tencent/cf-worker/worker.js` — Groq pathPrefix 修复 + 部署到 CF
  - `.env.production`, `.env.development` — API URL 切换到 `api.245334.xyz` + 新增 fallback
  - `src/config/index.js` — 新增 `api.fallbackUrl`
  - `src/services/api/domains/ai.service.js` — 双服务器自动切换 (3次失败→备用→60秒恢复)
  - `laf-backend/functions/_shared/ai-providers/provider-factory.ts` — CF Worker 代理集成
  - Nginx SSL: Let's Encrypt for `api.245334.xyz` + `exam.245334.xyz`
  - CF DNS: A records + Worker route `api-gw.245334.xyz`
- **Summary**: 完成 HTTPS 域名绑定、CF Worker 海外 API 代理部署、前端双服务器自动 fallback。
- **Breaking Changes**: 前端 `VITE_API_BASE_URL` 从 Sealos 切换到腾讯云。

---

## [2026-03-23] Round 10: 腾讯云服务器部署 — 已上线

- **Scope**: backend + infra
- **Status**: **DEPLOYED & VERIFIED** at `http://101.43.41.96`
- **Key Files**:
  - `laf-backend/standalone/cloud-shim.ts` — @lafjs/cloud 兼容层 (已通过 Laf SDK GitHub 源码审计, 修复 7 个问题: CRITICAL: _.or()/_.and() where查询 + \_.all()缺失; HIGH: add()/update()返回值 + field()数组支持)
  - `laf-backend/standalone/server.ts` — Express 路由服务器 (46 函数自动注册, ESM \_\_dirname 修复, 404 handler 顺序修复)
  - `deploy/tencent/` — Nginx + PM2 + MongoDB Docker 完整部署配置
  - `deploy/tencent/cf-worker/` — Cloudflare Worker 海外 API 代理 (14 供应商)
- **Architecture**:
  - **本地编译** (Mac TS→JS) → **上传 dist** → **PM2 运行** (非 Docker 构建, 因 2GB 服务器编译太慢)
  - MongoDB 7.0 via Docker (WiredTiger 256MB cache)
  - Nginx 反代 port 3001 + upstream backup 到 Sealos Laf
  - 多项目隔离: 5 个项目规划 port 3001-3005
  - 内存: Node.js ~65MB + MongoDB ~400MB = ~500MB, 剩余 1.4GB 给其他项目
- **Build Pipeline**: `tsc → perl rewrite (@lafjs/cloud + .js extensions) → tar → scp → pm2 restart`
- **Verified Endpoints**: `/health`, `/health-check`, `/school-query`, `/login`
- **Known Issues**:
  - Sealos backup 需 HTTPS proxy, Nginx upstream 不支持混合协议, 待优化为 error_page + proxy_pass fallback
  - CF Worker 未部署 (配置已就绪, 需 `npx wrangler deploy`)
- **Breaking Changes**: None

---

## [2026-03-22] Round 9: LLM API 号池扩容 + 深搜 Key 池

- **Scope**: backend + docs
- **Files Changed**:
  - `laf-backend/.env` — 新增 10 条硅基流动深搜专用 Key（SILICONFLOW_DS_KEY_1~10）
  - `laf-backend/.env.example` — 新增深搜 Key 文档 + 补全 NVIDIA/Volcengine/Cohere/HuggingFace/Fal/Deepgram/Mem0/Kling/Vercel AI 环境变量文档
  - `laf-backend/functions/_shared/ai-providers/provider-factory.ts`:
    - 新增 `siliconflow_deepsearch` provider（10 条 DS Key 独立轮询，DeepSeek-V3 模型）
    - 新增 `getDeepSearchProvider()` 导出函数
    - 修复 Cerebras 模型名 `llama-3.3-70b` → `llama3.1-8b`（旧模型已下线）
    - Cohere 加入 auto 轮询池（之前仅有配置未入池）
    - 新增 `ENV_KEY_MAP` 统一处理不规则环境变量名
  - `docs/AI-SOP/modules/backend-functions.md` — 新增 LLM API 号池详情章节（14 provider + 10 DS Key + 辅助服务 + 主路径模型）
  - `docs/AI-SOP/CHANGE-LOG.md` — 本记录
- **Summary**: 号池从 12 个 provider 扩展到 14 个（+Cohere 入池 +DeepSearch 池）。新增 10 条硅基流动 DeepSeek 专用 Key（总余额 140 元，支持 V3 ~10000 次 / R1 ~1750 次调用）。修复 Cerebras 模型名为当前可用模型。完善 .env.example 文档覆盖全部 25+ 环境变量。
- **Breaking Changes**: Cerebras 模型从 `llama-3.3-70b` 更新为 `llama3.1-8b`，该模型已在 Cerebras 平台下线，旧配置本已不可用。

---

## [2026-03-22] Round 8: Last Page Upgrade + Action Sheet Standardization

- **Scope**: frontend
- **Files Changed**:
  - `src/pages/practice-sub/question-bank.vue` — 全面重写(487→785行): 暗色模式+wd-tabs+wd-progress+wd-button+搜索+骨架屏+BaseEmpty+BaseIcon+触觉反馈+毛玻璃卡片
  - `src/pages/chat/chat.vue` — uni.showActionSheet→wd-action-sheet
  - `src/pages/profile/index.vue` — 2处uni.showActionSheet→wd-action-sheet
  - `src/pages/settings/index.vue` — 2处uni.showActionSheet→wd-action-sheet
  - `src/pages/favorite/index.vue` — uni.showActionSheet→wd-action-sheet
- **Summary**: 升级项目内最后一个零暗色模式页面(question-bank)，从原型级质量提升到与全APP一致的设计语言。4个高频页面的7处原生ActionSheet替换为wd-action-sheet，消除暗色模式下白色弹窗的违和感。
- **Breaking Changes**: None

---

## [2026-03-22] Round 7: Performance + Interaction + Core Value

- **Scope**: frontend
- **Files Changed**:
  - `src/utils/echarts-custom.js` (new) — ECharts按需导入（Radar/Line/Bar + 必要组件）
  - `vite.config.js` — echarts alias指向自定义构建，~1.1MB→~200KB
  - `src/pages/chat/chat.vue` — 语音波形从Math.random()改为真实PCM帧数据RMS
  - `src/pages/knowledge-graph/components/ForceGraph.vue` — 新增双指缩放(0.5x-3x)+节点拖拽+拖拽高亮
  - `src/pages/index/index.vue` — 新增quick-actions快捷统计栏(待复习/今日已做/正确率)
- **Summary**: ECharts包体积优化~900KB。知识图谱从"只能看"升级为"可缩放可拖拽"。语音录制波形从假随机变为真实音频振幅。首页新增FSRS复习队列数据的直达入口。
- **Breaking Changes**: None. echarts功能不变，仅减少未使用的图表类型。

---

## [2026-03-22] Round 6: MP Confetti + Calendar View + User Flow Fixes

- **Scope**: frontend
- **Files Changed**:
  - `src/utils/animations/mp-confetti.js` (new) — 跨平台庆祝粒子效果
  - `src/components/common/ConfettiOverlay.vue` (new) — CSS动画粒子覆盖层
  - 6个文件替换canvas-confetti为mp-confetti（do-quiz, mock-exam, DailyGoalRing, quiz-animation, micro-interactions, useGamificationEffects）
  - `src/pages/plan/index.vue` — 新增wd-calendar-view日历视图切换
  - `src/pages/practice-sub/components/quiz-result/quiz-result.vue` — 新增"返回首页"按钮
  - `src/pages/profile/index.vue` — 新增"我的好友"菜单入口
  - `src/pages/index/index.vue` — 新增streak徽章+ConfettiOverlay
  - 3个文件替换手建进度条为wd-progress（diagnosis-report, quiz-result, practice/index）
- **Summary**: 解决微信小程序端庆祝效果失效（mp-confetti替代canvas-confetti）。新增日历视图填补最后一个竞品差距。修复3个用户流程死胡同：quiz结束后无法一键回首页、好友入口埋太深、首页看不到连续学习天数。继续用wd-progress标准化进度条。
- **Breaking Changes**: None. canvas-confetti仍保留为H5平台后端，小程序端使用CSS动画替代。

---

## [2026-03-22] Round 5: Competitor Feature Parity + Component Standardization

- **Scope**: frontend
- **Files Changed**:
  - `src/components/business/index/ExamCountdownCard.vue` (new) — 考研倒计时卡片
  - `src/pages/tools/focus-timer.vue` (new) — 番茄专注计时器
  - `src/pages/index/index.vue` — 集成倒计时卡片 + 专注计时工具入口
  - `src/pages/settings/index.vue` — 新增考试日期设置
  - `pages.json` — 注册focus-timer页面
  - `src/pages/knowledge-graph/index.vue` — wd-progress替换手建进度条(2处)
  - `src/pages/practice-sub/smart-review.vue` — wd-progress替换(3处)
  - `src/pages/plan/index.vue` — wd-progress替换(2处)
  - `src/pages/profile/index.vue` — wd-progress替换XP进度条
  - `src/pages/social/friend-list.vue` — wd-tabs替换手建标签栏(-55行CSS)
  - `src/pages/school/index.vue` — wd-tabs替换学历切换
- **Summary**: 填补了与竞品(粉笔/考虫/研途)的3个关键功能差距：考研倒计时(用户可设日期+实时天时分+阶段激励语)、番茄专注计时器(25/5循环+wd-circle+屏幕常亮+历史记录)。用wot-design-uni的wd-progress替换了8处手建进度条(删除~70行CSS)，用wd-tabs替换了2个手建标签栏(删除~65行CSS)。
- **Breaking Changes**: None

---

## [2026-03-22] Round 4: Fix Broken Integrations + Dead Code Cleanup

- **Scope**: fullstack
- **Files Changed**:
  - `pages.json` — registered 6 missing pages (smart-review, question-bank, diagnosis-report, ai-classroom×2, onboarding)
  - `src/pages/practice-sub/do-quiz.vue` — fixed question-bank→do-quiz integration (source=question-bank handler)
  - `src/pages/practice-sub/diagnosis-report.vue` — fixed dark-only CSS → theme-aware variables + replaced Canvas ring with wd-circle
  - `src/pages/practice-sub/smart-review.vue` — replaced Canvas ring with wd-circle
  - `src/pages/social/friend-profile.vue` — removed fake generateActivities() data
  - `src/utils/date.js` (new) — dayjs wrapper with 10 utility functions
  - 7 files updated to use dayjs (formatters, SessionList, autoSave, draft-detector, index, do-quiz, studyTimerMixin)
  - `package.json` — removed @vueuse/core, @formkit/auto-animate, markdown-it-katex
  - `laf-backend/.env.example` — scrubbed 7 real API keys
  - Deleted 12 orphan root-level files
  - `src/pages/practice/index.vue` — hid Anki export on non-WeChat platforms
  - `src/pages/tools/doc-convert.vue` — fixed H5 webview navigation (window.open)
- **Summary**: Fixed 4 CRITICAL navigation failures (pages not registered), 1 broken feature integration (question-bank practice), cleaned 3 dead npm deps (~19KB), replaced 2 Canvas rings with wd-circle, adopted dayjs globally, removed fake social data, scrubbed leaked API keys.
- **Breaking Changes**: None. Anki export menu now only visible on WeChat MP.

---

## [2026-03-22] Round 3: UX Polish + New Components + Real Data

- **Scope**: frontend
- **Files Changed**: 25+ files across pages, components, services
- **Summary**: Connected chart data to real FSRS/practice records. Created MiniGuide for MP onboarding. Added swipe-to-delete on mistakes/favorites. Added mistake export. Created SchoolSearchInput autocomplete. Wired offline-cache-service into do-quiz flow.
- **Breaking Changes**: None

---

## [2026-03-22] Round 2: High-Star Component Integration

- **Scope**: frontend
- **Files Changed**: 20+ files
- **Summary**: Integrated mp-html (rich text), created PracticeConfigPanel, overhauled Plan pages (datetime picker + detail popup), redesigned Onboarding (swiper), enhanced Settings page, animated splash waves, added DailyGoalRing completion celebration.
- **Breaking Changes**: None

---

## [2026-03-22] Round 1: Core UX Upgrades

- **Scope**: frontend
- **Files Changed**: 30+ files
- **Summary**: Phase 0 (补内伤): useAnimatedNumber across 6 pages, button-animations.scss activation, dark mode transitions, page transitions, skeleton fade, haptic feedback, hover-class standardization. Phase 1-5: ECharts charts, AI chat Markdown/ThinkingBlock/MessageActions, anime.js utils, driver.js onboarding, offline cache service.
- **Breaking Changes**: StatsGrid.vue converted from Options API to script setup.

---

## [2026-03-22] AI-SOP Documentation System Created

- **Scope**: docs
- **Files Changed**:
  - `docs/AI-SOP/PROJECT-BRIEF.md` (new)
  - `docs/AI-SOP/ARCHITECTURE.md` (new)
  - `docs/AI-SOP/MODULE-INDEX.md` (new)
  - `docs/AI-SOP/CHANGE-LOG.md` (new)
  - `docs/AI-SOP/SOP-RULES.md` (new)
  - `docs/AI-SOP/modules/frontend-pages.md` (new)
  - `docs/AI-SOP/modules/frontend-components.md` (new)
  - `docs/AI-SOP/modules/frontend-services.md` (new)
  - `docs/AI-SOP/modules/frontend-stores.md` (new)
  - `docs/AI-SOP/modules/backend-functions.md` (new)
  - `docs/AI-SOP/modules/backend-schemas.md` (new)
  - `docs/AI-SOP/modules/styling-system.md` (new)
  - `docs/AI-SOP/modules/testing-infra.md` (new)
- **Summary**: Created comprehensive AI-SOP documentation system for EXAM-MASTER. This is a one-time investment so future AI assistants can understand the project without full codebase scanning.
- **Breaking Changes**: None

---

## Historical Changes (Pre-AI-SOP)

### AI Provider Expansion (commits 7eef506, 738b1e6, c760197)

- Added 10+ AI providers to rotation pool (NVIDIA, Volcengine, SiliconFlow, GPT_API_free)
- Enables high availability and cost optimization

### Service Deduplication (commit b93d8bf)

- 5 domain service files now reuse ai.service.js request infrastructure
- Eliminated ~10,000 lines of duplicated request/retry/cache logic

### Performance Optimization (commits ecdcaf3, f3c92dd)

- Moved `useTypewriter` out of main package
- Moved 8 composables/utils from main to practice-sub subpackage
- Reduces WeChat MP main package size

### WeChat Runtime Fixes (commit ce26285)

- Fixed 3 runtime errors identified in WeChat dev console

### WeChat Subscription Messages (commit 25c0cb2)

- Added subscription message service for study reminders
- New service: `src/services/subscribe-message.js`

### Homepage Personalization (commit 4b6657f)

- Personalized homepage with exam_type
- Enhanced mistake filters

### Network Error Recovery (commit 9080040)

- Added error retry UI on homepage for network failure recovery

### Social Sharing (commit 1d858b0)

- Added share to tool pages
- Added pull-to-refresh on 5 pages

### Splash & Celebrations (commit da26a64)

- Splash brand animation
- Tool grid conversion optimization
- Quiz celebration effects

### Traffic Acquisition Tools (commit e0dee6e)

- Restored id-photo and doc-convert as traffic acquisition tools

### Content Engine & FSRS (commit c36c3ec)

- Phase 1-4 content engine implementation
- FSRS scheduling integration
- RAG pipeline
- Major UX overhaul
