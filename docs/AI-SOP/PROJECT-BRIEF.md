# EXAM-MASTER Project Brief

> Last updated: 2026-03-22 | AI-SOP Version: 1.0

## Quick Facts

| Field                | Value                                                       |
| -------------------- | ----------------------------------------------------------- |
| **Product**          | 考研备考小程序 (Graduate Exam Prep App)                     |
| **Tagline**          | AI 助力，一战成硕                                           |
| **Tech Stack**       | uni-app (Vue 3.4) + Laf Cloud (Sealos Serverless) + MongoDB |
| **Platforms**        | WeChat Mini Program (primary), QQ MP, H5 (PWA), App         |
| **Primary Language** | JavaScript (frontend), TypeScript (backend cloud functions) |
| **UI Framework**     | wot-design-uni + custom design system                       |
| **State Management** | Pinia 2.1.7                                                 |
| **Build Tool**       | Vite 5.2.8 via @dcloudio/vite-plugin-uni                    |
| **Node Version**     | >= 20.17.0                                                  |
| **Package Manager**  | npm 10.8.2                                                  |

---

## Project Structure (Top Level)

```
EXAM-MASTER/
├── src/                          # Frontend source (uni-app Vue 3 SFC)
│   ├── pages/                    # Page components (routed via pages.json)
│   ├── components/               # Shared components (base / business / common / charts / layout)
│   ├── services/                 # API facade + domain services + FSRS + knowledge engine
│   ├── stores/                   # Pinia state modules
│   ├── composables/              # Vue 3 composition API hooks
│   ├── utils/                    # Utility libraries (error, analytics, auth, learning, crypto)
│   ├── design/                   # Theme engine (runtime CSS-var switching)
│   ├── styles/                   # SCSS design system, tokens, dark mode
│   ├── custom-tab-bar/           # WeChat MP custom tab bar stub
│   └── static/                   # Static assets (images, icons)
├── laf-backend/                  # Serverless backend (Laf Cloud on Sealos)
│   ├── functions/                # Cloud functions (TypeScript)
│   │   ├── _shared/              # Shared modules (auth, agents, FSRS, orchestration)
│   │   └── *.ts                  # Individual cloud function endpoints
│   ├── database-schema/          # MongoDB collection schemas (JSON Schema)
│   └── data/                     # Static data (school lists)
├── common/                       # Shared config (legacy compat)
├── tests/                        # Test suites
│   ├── unit/                     # Vitest unit tests (~50 spec files)
│   ├── visual/                   # Playwright visual regression tests
│   ├── e2e-regression/           # Playwright E2E regression tests (18 spec files)
│   └── maestro/                  # Maestro mobile E2E flows (6 YAML flows)
├── e2e-tests/                    # WeChat MP automator E2E tests
├── scripts/                      # Build & audit scripts
├── deploy/                       # Deployment config
├── pages.json                    # Route definitions + tabBar + subPackages
├── manifest.json                 # uni-app manifest (appid, permissions)
├── vite.config.js                # Vite build config (multi-platform)
├── vitest.config.js              # Vitest test config
└── package.json                  # Dependencies & scripts
```

---

## Core Features (What Makes This Product)

1. **FSRS-5 Spaced Repetition Engine** — 21-parameter model from `ts-fsrs` v5; 90% target retention; persistent per-card scheduling via `fsrs-service.js`
2. **Knowledge Graph x FSRS Fusion** — Prerequisite DAG (考研 knowledge points) + mastery scoring; topological learning path generation via `knowledge-engine.js`
3. **AI Diagnostic Loop** — Practice -> Data collection -> AI diagnosis -> Study plan -> Smart review; multi-provider AI rotation (10+ providers) via `proxy-ai.ts`
4. **Multi-Agent Classroom** — Teacher/Student/Examiner agent state machine; lesson generation via `agent-orchestrator.ts` + `lesson-generator.ts`
5. **PK Battle with ELO** — Real-time knowledge PK with ELO rating + anti-cheat session verification via `pk-battle.ts`
6. **Anki Bidirectional Import/Export** — `.apkg` file import/export with Cloze deletion support via `anki-import.ts` / `anki-export.ts`
7. **Gamification System** — Duolingo-inspired XP, streaks, achievements, daily challenges via `gamification.js` store
8. **Smart Review (复习)** — FSRS-driven due card scheduling with retrievability-based sorting
9. **Tool Suite** — Photo search (OCR), document conversion, ID photo background removal (traffic acquisition tools)
10. **Social Features** — Friends system, AI friend chat with memory, study groups

---

## Key File Paths (Quick Reference)

| What                | Path                                                                        |
| ------------------- | --------------------------------------------------------------------------- |
| Main entry          | `src/main.js`                                                               |
| App root            | `src/App.vue` (773 lines, global styles + theme init)                       |
| Page routes         | `pages.json` (36 pages across 14 subPackages)                               |
| Global config       | `common/config.js`                                                          |
| Vite config         | `vite.config.js`                                                            |
| **Core Pages**      |                                                                             |
| Home page           | `src/pages/index/index.vue` (2310 lines)                                    |
| Practice hub        | `src/pages/practice/index.vue` (1955 lines)                                 |
| Quiz engine         | `src/pages/practice-sub/do-quiz.vue` (3131 lines)                           |
| PK Battle           | `src/pages/practice-sub/pk-battle.vue` (3327 lines)                         |
| Login               | `src/pages/login/index.vue` (1890 lines)                                    |
| AI Chat             | `src/pages/chat/chat.vue` (2024 lines)                                      |
| Knowledge Graph     | `src/pages/knowledge-graph/index.vue` (1961 lines)                          |
| School Search       | `src/pages/school/index.vue` (2396 lines)                                   |
| **Services**        |                                                                             |
| API facade          | `src/services/lafService.js`                                                |
| Core request        | `src/services/api/core/request.js`                                          |
| AI service          | `src/services/api/domains/ai.service.js` (2436 lines, master request infra) |
| FSRS service        | `src/services/fsrs-service.js` (640 lines)                                  |
| Knowledge engine    | `src/services/knowledge-engine.js` (684 lines)                              |
| Storage service     | `src/services/storageService.js`                                            |
| Stream chat         | `src/services/streamService.js`                                             |
| **Stores**          |                                                                             |
| User (facade)       | `src/stores/modules/user.js`                                                |
| Auth                | `src/stores/modules/auth.js`                                                |
| Study progress      | `src/stores/modules/study.js`                                               |
| Gamification        | `src/stores/modules/gamification.js`                                        |
| Theme               | `src/stores/modules/theme.js`                                               |
| Learning trajectory | `src/stores/modules/learning-trajectory-store.js`                           |
| **Design**          |                                                                             |
| Design tokens       | `src/styles/_design-tokens.scss`                                            |
| Theme engine        | `src/design/theme-engine.js`                                                |
| Dark mode vars      | `src/styles/_dark-mode-vars.scss`                                           |
| **Backend**         |                                                                             |
| Backend functions   | `laf-backend/functions/`                                                    |
| Auth middleware     | `laf-backend/functions/_shared/auth-middleware.ts`                          |
| FSRS scheduler      | `laf-backend/functions/_shared/fsrs-scheduler.ts`                           |
| Agent orchestrator  | `laf-backend/functions/agent-orchestrator.ts`                               |
| DB schemas          | `laf-backend/database-schema/`                                              |

---

## Dependencies (npm packages)

### Production Dependencies

| Package                 | Version     | Purpose                               |
| ----------------------- | ----------- | ------------------------------------- |
| `vue`                   | 3.4.21      | Core UI framework                     |
| `pinia`                 | 2.1.7       | State management                      |
| `@dcloudio/uni-*`       | 3.0.0-alpha | uni-app cross-platform framework      |
| `ts-fsrs`               | ^5.3.1      | FSRS-5 spaced repetition algorithm    |
| `echarts`               | ^6.0.0      | Chart visualization                   |
| `uni-echarts`           | ^2.5.1      | ECharts adapter for uni-app           |
| `wot-design-uni`        | ^1.14.0     | UI component library                  |
| `dayjs`                 | ^1.11.20    | Date manipulation                     |
| `katex`                 | ^0.16.38    | LaTeX math rendering                  |
| `markdown-it`           | ^14.1.1     | Markdown parsing                      |
| `markdown-it-katex`     | ^2.0.3      | KaTeX plugin for markdown-it          |
| `mp-html`               | ^2.5.2      | Rich text rendering for mini programs |
| `canvas-confetti`       | ^1.9.4      | Celebration animations                |
| `driver.js`             | ^1.4.0      | Feature tour / onboarding guide       |
| `@vueuse/core`          | ^14.2.1     | Vue composition utilities             |
| `@formkit/auto-animate` | ^0.9.0      | Automatic transition animations       |

### Backend Dependencies (laf-backend)

| Package         | Version | Purpose                                  |
| --------------- | ------- | ---------------------------------------- |
| `ts-fsrs`       | ^5.2.3  | Server-side FSRS scheduling              |
| `ai-agent-team` | ^2.0.1  | Multi-agent orchestration framework      |
| `jszip`         | ^3.10.1 | ZIP file handling (Anki .apkg)           |
| `sql.js`        | ^1.14.1 | SQLite in-memory (Anki database parsing) |

### Key Dev Dependencies

| Package            | Version | Purpose                         |
| ------------------ | ------- | ------------------------------- |
| `vitest`           | ^4.0.18 | Unit testing framework          |
| `@playwright/test` | ^1.57.0 | E2E & visual regression testing |
| `happy-dom`        | ^20.5.0 | DOM simulation for tests        |
| `eslint`           | ^9.39.2 | Code linting                    |
| `prettier`         | ^3.5.3  | Code formatting                 |
| `sass`             | ^1.97.3 | SCSS preprocessing              |
| `husky`            | ^9.1.7  | Git hooks                       |
| `commitlint`       | ^20.4.1 | Commit message linting          |
| `vite-plugin-pwa`  | ^1.2.0  | PWA support (H5 only)           |

---

## Recent Changes Summary

### Round 1: Content Engine & FSRS (commit c36c3ec)

- Phase 1-4 content engine implementation
- FSRS scheduling integration
- RAG (Retrieval-Augmented Generation) pipeline
- Major UX overhaul

### Round 2: Gamification & Social (commits dbd28b6 - da26a64)

- 3D card flip animation, Anki Cloze support, homepage heatmap
- Splash brand animation, quiz celebration effects
- ID photo and document conversion tools (traffic acquisition)
- Share functionality, pull-to-refresh on 5 pages

### Round 3: AI Provider Expansion & Performance (commits c760197 - 7eef506)

- Expanded AI provider pool (10+ providers including NVIDIA, Volcengine, SiliconFlow)
- WeChat subscription message service for study reminders
- Service file deduplication (5 domain services reuse ai.service infrastructure)
- Composables/utils moved out of main package to subpackage for WeChat MP size optimization
- 3 runtime error fixes from WeChat dev console

---

## Known Issues / Technical Debt

1. **Large page files** — `do-quiz.vue` (3131 lines) and `pk-battle.vue` (3327 lines) need component extraction
2. **Domain service duplication** — All 5 domain services (auth, practice, school, favorite, social) still contain a full copy of the request infrastructure (~2000 lines each) despite the dedup effort
3. **Options API legacy** — Some pages still use Options API instead of `<script setup>` Composition API
4. **Missing composable extraction** — Home page (2310 lines) and practice page (1955 lines) have inline logic that should be extracted to composables
5. **Deprecated code paths** — `common/config.js` contains deprecated `getApiKey()` for backward compatibility

---

## How to Build & Run

```bash
# Install dependencies
npm install

# Frontend development (H5 / browser)
npm run dev:h5

# Frontend development (WeChat Mini Program)
npm run dev:mp-weixin

# Frontend build (H5)
npm run build:h5

# Frontend build (WeChat MP)
npm run build:mp-weixin

# Backend: Deployed to Laf Cloud (sealos.run)
# Use `laf deploy` in laf-backend/ directory

# Unit tests
npm test                    # or: npx vitest run

# Visual regression tests
npm run test:visual         # Playwright visual snapshots

# E2E regression tests
npm run test:e2e:regression # Playwright browser tests

# Maestro mobile E2E
npm run test:maestro        # Maestro flow tests

# Full QA regression gate
npm run test:qa:full-regression

# Lint & format
npm run lint
npm run format
```

---

## Environment Variables

| Variable            | Purpose                         | File               |
| ------------------- | ------------------------------- | ------------------ |
| `VITE_API_BASE_URL` | Backend API base URL            | `.env.*`           |
| `VITE_API_TIMEOUT`  | API request timeout (ms)        | `.env.*`           |
| `VITE_SENTRY_DSN`   | Sentry error tracking DSN       | `.env.*`           |
| `VITE_DEV_PORT`     | Dev server port (default: 5173) | `.env.development` |

> Note: `.env.local` is gitignored and used for local overrides. Never commit API keys to the frontend.

---

## 用户痛点地图 (User Pain Map)

> Updated: 2026-03-23 | Source: CPO 产品立项分析

**目标用户画像**：大三/大四学生，备考考研（统考+专业课），日均可用备考时间 4-8 小时，手机为主要学习工具，焦虑感强（"一战成硕"心态），价格敏感。

| 用户旅程阶段  | 用户行为               | 当前体验           | 真实痛点                              | 痛点烈度   |
| :------------ | :--------------------- | :----------------- | :------------------------------------ | :--------- |
| 1. 选校定目标 | 搜索院校、设定考试日期 | ✅ 拼音搜索+倒计时 | 无数据驱动的院校推荐（报录比/分数线） | 🔥🔥🔥     |
| 2. 搜集资料   | 找真题、看经验贴       | ⚠️ 基础CRUD        | 资源不按目标院校匹配                  | 🔥🔥🔥     |
| 3. 制定计划   | 写学习计划             | ⚠️ 手动创建        | 计划不自适应（剩余时间×当前水平）     | 🔥🔥🔥🔥🔥 |
| 4. 日常刷题   | 选题做题               | ✅ FSRS+AI+多模式  | 缺少"我能考多少分"的水平感知          | 🔥🔥🔥     |
| 5. 错题复习   | 翻错题本               | ⚠️ 错题+FSRS复习   | 同类错题不聚合，治标不治本            | 🔥🔥🔥🔥🔥 |
| 6. 模拟考试   | 做整套真题             | ⚠️ 基础模考        | 无时间压力+无分数预测                 | 🔥🔥🔥🔥   |
| 7. 薄弱突破   | 看诊断、针对性强化     | ⚠️ 知识图谱+诊断   | 识别弱点但不自动生成训练卷            | 🔥🔥🔥🔥   |
| 8. 考前冲刺   | 最后30天冲刺           | ❌ 无              | 不知该放弃什么、重点抓什么            | 🔥🔥🔥🔥🔥 |
| 9. 学习坚持   | 打卡、找同伴           | ✅ XP/排行/PK      | 一个人备考孤独                        | 🔥🔥🔥     |
| 10. 碎片学习  | 地铁/排队刷题          | ❌ 无离线          | 断网=无法学习                         | 🔥🔥🔥🔥   |

---

## 竞品分析 (Competitive Analysis)

> Updated: 2026-03-23 | Source: CTO 竞品技术拆解

| 竞品名 | 核心功能                  | 技术亮点              | 差评高频词               | 我们可超越的点                          |
| :----- | :------------------------ | :-------------------- | :----------------------- | :-------------------------------------- |
| 粉笔   | 百万题库+AI刷题+直播+模考 | IRT自适应、大规模标注 | 重复率高/吃内存/广告多   | FSRS-5更精准+知识图谱+零广告+轻量小程序 |
| Anki   | 纯SRS+卡牌+插件生态       | SM-2→FSRS开源插件     | 太丑/学习曲线陡/手机收费 | 已集成FSRS-5+原生做题+游戏化+社交       |
| 考虫   | 系统课+社群+计划+打卡     | 直播互动、社群运营    | 课程贵/退费难/更新慢     | AI多Agent课堂替代昂贵直播课             |

---

## GitHub 积木库清单 (Open Source Building Blocks)

> Updated: 2026-03-23 | Source: GitHub 积木库搜索

| 功能领域       | 推荐库                                 | Stars | 协议 | 用途           | 状态                         |
| :------------- | :------------------------------------- | :---- | :--- | :------------- | :--------------------------- |
| FSRS算法       | `open-spaced-repetition/fsrs4anki`     | 2.5k+ | MIT  | 参考参数优化器 | ✅ 已集成 `ts-fsrs` v5.3.1   |
| FSRS基准       | `open-spaced-repetition/srs-benchmark` | 500+  | MIT  | 验证算法优越性 | 参考中                       |
| 离线缓存       | Google Workbox                         | 12k+  | MIT  | PWA/H5 离线    | ⏳ 待集成                    |
| 文本Embedding  | 已有 `embedding.ts`                    | —     | —    | 错题聚类       | ✅ 已有，待扩展              |
| 适应性学习计划 | 自建：知识图谱+FSRS+倒计时             | —     | —    | 三数据源融合   | 🚀 待开发                    |
| 图标系统       | Lucide Icons (风格参考)                | 10k+  | ISC  | SVG商业图标    | ✅ 86个SVG (自建+Lucide风格) |
