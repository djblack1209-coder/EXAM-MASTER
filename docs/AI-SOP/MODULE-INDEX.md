# Module Index

> Last updated: 2026-04-23 | AI-SOP Version: 1.1
>
> Use this file to quickly locate relevant files when fixing bugs or adding features.
> Pattern: **When you need to fix: [problem]** → Look at: [files]

---

## Authentication & Login

### User can't login

- **Login page**: `src/pages/login/index.vue`
- **WeChat callback**: `src/pages/login/wechat-callback.vue`
- **QQ callback**: `src/pages/login/qq-callback.vue`
- **Auth store**: `src/stores/modules/auth.js`
- **Login guard util**: `src/utils/auth/loginGuard.js`
- **Token refresh**: `src/utils/auth/token-refresh-plugin.js`
- **Backend login function**: `laf-backend/functions/login.yaml`
- **Backend auth middleware**: `laf-backend/functions/_shared/auth-middleware.ts`
- **Backend JWT logic**: `laf-backend/functions/_shared/auth.ts`
- **Silent login in App.vue**: `src/App.vue` → `performSilentLogin()`

### Onboarding / 新用户引导

- **新用户引导页**: `src/pages/login/onboarding.vue` (1068 行，首次登录后的学科选择 + 目标设定引导流程)

### Token expired / 401 errors

- **Auth failure handler**: `src/App.vue` → `initApiErrorInterceptor()`
- **Auth store logout**: `src/stores/modules/auth.js`

---

## Quiz / Practice

### Quiz not loading or behaving incorrectly

- **Quiz engine page**: `src/pages/practice-sub/do-quiz.vue` (3131 lines)
- **Practice hub**: `src/pages/practice/index.vue` (1955 lines)
- **Quiz progress bar**: `src/pages/practice-sub/components/quiz-progress/quiz-progress.vue`
- **Answer sheet**: `src/pages/practice-sub/components/answer-sheet/answer-sheet.vue`
- **Quiz result**: `src/pages/practice-sub/components/quiz-result/quiz-result.vue` (全屏结果页，含AI推荐下一步+个性化点评，由do-quiz.vue集成)
- **Quiz auto-save**: `src/composables/useQuizAutoSave.js`
- **Question normalizer**: `src/utils/practice/question-normalizer.js`
- **Draft detector**: `src/utils/practice/draft-detector.js`

### FSRS scheduling / spaced repetition issues

- **FSRS service (frontend)**: `src/services/fsrs-service.js` (640 lines, singleton scheduler)
- **FSRS optimizer client**: `src/pages/practice-sub/services/fsrs-optimizer-client.js`
- **FSRS optimizer page**: `src/pages/study-detail/FSRSOptimizer.vue`
- **Smart review page**: `src/pages/practice-sub/smart-review.vue`
- **Backend FSRS scheduler**: `laf-backend/functions/_shared/fsrs-scheduler.ts`
- **Backend FSRS service**: `laf-backend/functions/_shared/services/fsrs.service.ts`
- **Backend FSRS optimizer**: `laf-backend/functions/fsrs-optimizer.ts`

### Practice modes / AI generation

- **Practice modes modal**: `src/components/business/practice/PracticeModesModal.vue`
- **AI generation overlay**: `src/components/business/practice/AiGenerationOverlay.vue`
- **Generation progress**: `src/components/business/practice/GenerationProgressBar.vue`
- **Backend generation pipeline**: `laf-backend/functions/_shared/generation/generation-pipeline.ts`

### Answer submission / backend

- **Backend answer submit**: `laf-backend/functions/answer-submit.yaml`
- **Backend question bank**: `laf-backend/functions/question-bank.yaml`

### Sprint mode / 冲刺模式

- **冲刺模式页面**: `src/pages/practice-sub/sprint-mode.vue` (1041 行，限时刷题 + 倒计时 + 连击机制)

### Error clusters / 错题聚类

- **错题聚类分析页**: `src/pages/practice-sub/error-clusters.vue` (1355 行，按知识点聚合错题 + 薄弱分析)

---

## Knowledge Graph

### Knowledge graph not rendering

- **Knowledge graph page**: `src/pages/knowledge-graph/index.vue` (1961 行)
- **Knowledge engine**: `src/pages/knowledge-graph/knowledge-engine.js` (684 行)

### Mastery / 掌握度总览

- **掌握度总览页**: `src/pages/knowledge-graph/mastery.vue` (1441 行，知识点掌握度可视化 + 复习建议)

---

## AI Chat / Classroom

### Chat not working

- **Chat page**: `src/pages/chat/chat.vue` (2024 行)
- **Backend AI proxy**: `laf-backend/functions/proxy-ai.ts`
- **Backend AI provider factory**: `laf-backend/functions/_shared/ai-providers/provider-factory.ts`

### AI Classroom issues

- **Classroom page**: `src/pages/ai-classroom/classroom.vue`
- **Classroom index**: `src/pages/ai-classroom/index.vue`
- **Backend agent orchestrator**: `laf-backend/functions/agent-orchestrator.ts`
- **Backend lesson generator**: `laf-backend/functions/lesson-generator.ts`
- **Agent types**: `laf-backend/functions/_shared/agents/agent-types.ts`
- **Teacher agent**: `laf-backend/functions/_shared/agents/teacher-agent.ts`
- **Student agent**: `laf-backend/functions/_shared/agents/student-agent.ts`
- **Examiner agent**: `laf-backend/functions/_shared/agents/examiner-agent.ts`
- **State machine**: `laf-backend/functions/_shared/orchestration/state-machine.ts`
- **Agent service**: `laf-backend/functions/_shared/services/agent.service.ts`

---

## PK Battle / Ranking

### PK Battle issues

- **PK Battle page**: `src/pages/practice-sub/pk-battle.vue` (3327 lines)
- **Backend PK service**: `laf-backend/functions/pk-battle.ts`
- **Backend rank center**: `laf-backend/functions/rank-center.yaml`
- **Rank page**: `src/pages/practice-sub/rank.vue`

---

## Home Page / Dashboard

### Home page rendering issues

- **Home page**: `src/pages/index/index.vue` (2310 lines)
- **AI Daily Briefing**: `src/components/business/index/AIDailyBriefing.vue` (AI学习助手，首页核心AI入口)
- **Welcome banner**: `src/components/business/index/WelcomeBanner.vue`
- **Stats grid**: `src/components/business/index/StatsGrid.vue`
- **Study heatmap**: `src/components/business/index/StudyHeatmap.vue`
- **Daily goal ring**: `src/components/business/index/DailyGoalRing.vue`
- **Study time card**: `src/components/business/index/StudyTimeCard.vue`
- **Activity list**: `src/components/business/index/ActivityList.vue`
- **Header bar**: `src/components/business/index/IndexHeaderBar.vue`
- **Formula modal**: `src/components/business/index/FormulaModal.vue`
- **Recommendations composable**: `src/composables/useRecommendations.js`

### Charts not displaying

- **Study trend (detail)**: `src/pages/study-detail/StudyTrendChart.vue`
- **Ability radar (detail)**: `src/pages/study-detail/AbilityRadar.vue`
- **ECharts dependency**: `echarts` + `uni-echarts` packages

---

## Mistake Book / Favorites

### Mistake book issues

- **Mistake book page**: `src/pages/mistake/index.vue` (含知识点聚类视图 + 一键针对训练)
- **Mistake card**: `src/pages/mistake/MistakeCard.vue`
- **Mistake report**: `src/pages/mistake/MistakeReport.vue`
- **Stats card**: `src/pages/mistake/StatsCard.vue`
- **Backend mistake manager**: `laf-backend/functions/mistake-manager.ts`
- **Backend error clustering**: `laf-backend/functions/smart-study-engine.ts` (action: error_clustering)
- **Frontend API**: `src/services/api/domains/study.api.js` → `getErrorClusters()`

### Favorites issues

- **Favorites page**: `src/pages/favorite/index.vue`
- **Question favorite util**: `src/utils/favorite/question-favorite.js`
- **Backend favorite manager**: `laf-backend/functions/favorite-manager.ts`

---

## School / 择校

### School search / detail issues

- **School search page**: `src/pages/school/index.vue` (2396 lines)
- **School detail page**: `src/pages/school-sub/detail.vue`
- **AI consult page**: `src/pages/school-sub/ai-consult.vue`
- **School store**: `src/stores/modules/school.js`
- **Backend school query**: `laf-backend/functions/school-query.ts`
- **Backend school crawler**: `laf-backend/functions/school-crawler-api.ts`
- **School data**: `laf-backend/data/schools/`

---

## Social Features

### Friend list / social issues

- **Friend list**: `src/pages/social/friend-list.vue`
- **Friend profile**: `src/pages/social/friend-profile.vue`
- **Settings friends entry**: `src/pages/settings/FriendsEntryCard.vue`
- **User store (friends)**: `src/stores/modules/user.js`
- **Backend social service**: `laf-backend/functions/social-service.ts`
- **Backend AI friend memory**: `laf-backend/functions/ai-friend-memory.yaml`

---

## Settings / Profile

### Settings page issues

- **Settings page**: `src/pages/settings/index.vue` (2132 lines)
- **Profile page**: `src/pages/profile/index.vue` (1907 lines)
- **Privacy page**: `src/pages/settings/privacy.vue`
- **Terms page**: `src/pages/settings/terms.vue`
- **Theme selector**: `src/pages/settings/ThemeSelectorModal.vue`
- **AI tutor list**: `src/pages/settings/AITutorList.vue`
- **AI chat modal**: `src/pages/settings/AIChatModal.vue`
- **Invite modal**: `src/pages/settings/InviteModal.vue`
- **Poster modal**: `src/pages/settings/PosterModal.vue`
- **Logout button**: `src/pages/settings/LogoutButton.vue`
- **Profile store**: `src/stores/modules/profile.js`

---

## Theme / Styling

### Theme not switching properly

- **Theme engine**: `src/design/theme-engine.js`
- **Theme store**: `src/stores/modules/theme.js`
- **Theme composable**: `src/composables/useTheme.js`
- **App.vue theme init**: `src/App.vue` → `initThemeSystem()` / `switchTheme()`
- **Design tokens**: `src/styles/_design-tokens.scss`
- **Dark mode vars**: `src/styles/_dark-mode-vars.scss`
- **Wot theme mapping**: `src/styles/_wot-theme.scss`

---

## Data Import / Export

### Anki import/export issues

- **Import data page**: `src/pages/practice-sub/import-data.vue` (2851 lines)
- **File manager page**: `src/pages/practice-sub/file-manager.vue`
- **Backend Anki import**: `laf-backend/functions/anki-import.ts`
- **Backend Anki export**: `laf-backend/functions/anki-export.ts`
- **Backend material manager**: `laf-backend/functions/material-manager.ts`

---

## Tools (Traffic Acquisition)

### Photo search / ID photo / Doc convert issues

- **Photo search page**: `src/pages/tools/photo-search.vue`
- **Doc convert page**: `src/pages/tools/doc-convert.vue`
- **ID photo page**: `src/pages/tools/id-photo.vue`
- **Backend photo-bg**: `laf-backend/functions/photo-bg.ts`
- **Backend ID photo**: `laf-backend/functions/id-photo-segment-base64.ts`
- **Backend doc convert**: `laf-backend/functions/doc-convert.yaml`
- **Image base64 util**: `src/utils/helpers/image-base64.js`

### Focus timer / 专注计时

- **专注计时页**: `src/pages/tools/focus-timer.vue` (568 行，番茄钟 + 学习时长统计)

---

## Study Plan / Goals

### Study plan issues

- **Plan index**: `src/pages/plan/index.vue` (含AI自适应7天计划，接入generate_plan API)
- **Plan create**: `src/pages/plan/create.vue`
- **Todo store**: `src/stores/modules/todo.js`
- **Todo composable**: `src/composables/useTodo.js`
- **Learning goal util**: `src/utils/learning/learning-goal.js`
- **Backend learning goal**: `laf-backend/functions/learning-goal.ts`

### Adaptive plan / 自适应学习计划

- **自适应计划页**: `src/pages/plan/adaptive.vue` (1240 行，AI 根据学习数据动态调整每日计划)

---

## Study Stats / Detail

### Stats not showing

- **Study detail page**: `src/pages/study-detail/index.vue` (含AI学习洞察卡片)
- **Study trend chart**: `src/pages/study-detail/StudyTrendChart.vue`
- **Ability radar**: `src/pages/study-detail/AbilityRadar.vue`
- **Study store**: `src/stores/modules/study.js`
- **Learning trajectory store**: `src/stores/modules/learning-trajectory-store.js`
- **Gamification store**: `src/stores/modules/gamification.js`
- **Learning analytics**: `src/pages/practice-sub/utils/learning-analytics.js`
- **Backend study stats**: `laf-backend/functions/study-stats.ts`
- **Backend user stats**: `laf-backend/functions/user-stats.ts`

---

## Error Handling / Network

### Global error handling

- **Error handler**: `src/utils/error/global-error-handler.js`
- **Logger**: `src/utils/logger.js`
- **Network monitor**: `src/utils/core/network-monitor.js`
- **Offline queue**: `src/utils/core/offline-queue.js`
- **Offline cache service**: `src/pages/practice-sub/services/offline-cache-service.js`
- **Offline indicator**: `src/components/common/offline-indicator.vue`

---

## Build / Configuration

### Build failures

- **Vite config**: `vite.config.js`
- **Vitest config**: `vitest.config.js`
- **ESLint config**: `eslint.config.js`
- **Manifest**: `src/manifest.json`
- **Pages config**: `pages.json`
- **Environment vars**: `.env`, `.env.development`, `.env.production`
- **Build scripts**: `scripts/build/`
- **Playwright configs**: `playwright.regression.config.js`, `playwright.regression.compat.config.js`

---

## Infrastructure / Scripts

- **Scripts 统一位置**: 所有脚本文件统一存放在根目录 `scripts/` 下。`laf-backend/scripts/` 下原有的 `crawlers`、`data-sync`、`test` 冗余副本已于 2026-03-26 清理（D015 已解决）。
