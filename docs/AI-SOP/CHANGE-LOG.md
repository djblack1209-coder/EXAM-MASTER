# EXAM-MASTER Change Log

> **MOVED** → `docs/sop/CHANGE-LOG.md`
>
> This file is kept as a redirect. All new entries go to `docs/sop/CHANGE-LOG.md`.

---

> AI-SOP Version: 1.0 | Track all AI-assisted changes here.

## Format

```
## [YYYY-MM-DD] Session Title
- **Scope**: [frontend|backend|fullstack|docs]
- **Files Changed**: list of files
- **Summary**: What was done and why
- **Breaking Changes**: Any API or behavior changes
```

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
