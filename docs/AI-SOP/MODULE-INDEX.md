# Module Index

> Last updated: 2026-03-22 | AI-SOP Version: 1.0
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
- **Auth service (frontend)**: `src/services/api/domains/auth.service.js`
- **Login guard util**: `src/utils/auth/loginGuard.js`
- **Token refresh**: `src/utils/auth/token-refresh-plugin.js`
- **Backend login function**: `laf-backend/functions/login.yaml`
- **Backend auth middleware**: `laf-backend/functions/_shared/auth-middleware.ts`
- **Backend JWT logic**: `laf-backend/functions/_shared/auth.ts`
- **Silent login in App.vue**: `src/App.vue` → `performSilentLogin()`

### Token expired / 401 errors

- **Auth failure handler**: `src/App.vue` → `initApiErrorInterceptor()`
- **Request layer**: `src/services/api/domains/ai.service.js` (emits `authFailure` event)
- **Auth store logout**: `src/stores/modules/auth.js`

---

## Quiz / Practice

### Quiz not loading or behaving incorrectly

- **Quiz engine page**: `src/pages/practice-sub/do-quiz.vue` (3131 lines)
- **Practice hub**: `src/pages/practice/index.vue` (1955 lines)
- **Practice config panel**: `src/components/business/practice/PracticeConfigPanel.vue`
- **Question renderer**: `src/pages/practice-sub/components/question-renderer/question-renderer.vue`
- **Question choice**: `src/pages/practice-sub/components/QuestionChoice.vue`
- **Quiz progress bar**: `src/pages/practice-sub/components/quiz-progress/quiz-progress.vue`
- **Answer sheet**: `src/pages/practice-sub/components/answer-sheet/answer-sheet.vue`
- **Quiz result**: `src/pages/practice-sub/components/quiz-result/quiz-result.vue`
- **Quiz auto-save**: `src/composables/useQuizAutoSave.js`
- **Question normalizer**: `src/utils/practice/question-normalizer.js`
- **Draft detector**: `src/utils/practice/draft-detector.js`

### FSRS scheduling / spaced repetition issues

- **FSRS service (frontend)**: `src/services/fsrs-service.js` (640 lines, singleton scheduler)
- **FSRS optimizer client**: `src/services/fsrs-optimizer-client.js`
- **FSRS optimizer page**: `src/pages/study-detail/FSRSOptimizer.vue`
- **Smart review page**: `src/pages/practice-sub/smart-review.vue`
- **Backend FSRS scheduler**: `laf-backend/functions/_shared/fsrs-scheduler.ts`
- **Backend FSRS service**: `laf-backend/functions/_shared/services/fsrs.service.ts`
- **Backend FSRS optimizer**: `laf-backend/functions/fsrs-optimizer.ts`

### Practice modes / AI generation

- **Practice modes modal**: `src/components/business/practice/PracticeModesModal.vue`
- **AI generation overlay**: `src/components/business/practice/AiGenerationOverlay.vue`
- **Generation progress**: `src/components/business/practice/GenerationProgressBar.vue`
- **AI generation composable**: `src/composables/useAIGeneration.js`
- **Backend generation pipeline**: `laf-backend/functions/_shared/generation/generation-pipeline.ts`

### Answer submission / backend

- **Backend answer submit**: `laf-backend/functions/answer-submit.yaml`
- **Backend question bank**: `laf-backend/functions/question-bank.yaml`
- **Practice service (frontend)**: `src/services/api/domains/practice.service.js`

---

## Knowledge Graph

### Knowledge graph not rendering

- **Knowledge graph page**: `src/pages/knowledge-graph/index.vue` (1961 lines)
- **Force graph component**: `src/pages/knowledge-graph/components/ForceGraph.vue`
- **Force graph (shared)**: `src/components/business/knowledge/ForceGraph.vue`
- **Knowledge engine**: `src/services/knowledge-engine.js` (684 lines)
- **Knowledge points composable**: `src/composables/useKnowledgePoints.js`

---

## AI Chat / Classroom

### Chat not working

- **Chat page**: `src/pages/chat/chat.vue` (2024 lines)
- **Chat box component**: `src/components/business/chat/ChatBox.vue`
- **Stream chat composable**: `src/composables/useStreamChat.js`
- **Chat sessions composable**: `src/composables/useChatSessions.js`
- **Chat box composable**: `src/composables/useChatBox.js`
- **Stream service**: `src/services/streamService.js`
- **Markdown renderer**: `src/components/business/chat/MarkdownRenderer.vue`
- **Thinking block**: `src/components/business/chat/ThinkingBlock.vue`
- **Suggested replies**: `src/components/business/chat/SuggestedReplies.vue`
- **Session list**: `src/components/business/chat/SessionList.vue`
- **Message actions**: `src/components/business/chat/MessageActions.vue`
- **AI service (frontend)**: `src/services/api/domains/ai.service.js`
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
- **Welcome banner**: `src/components/business/index/WelcomeBanner.vue`
- **Stats grid**: `src/components/business/index/StatsGrid.vue`
- **Study heatmap**: `src/components/business/index/StudyHeatmap.vue`
- **Daily goal ring**: `src/components/business/index/DailyGoalRing.vue`
- **Knowledge bubbles**: `src/components/business/index/KnowledgeBubbleField.vue`
- **Study time card**: `src/components/business/index/StudyTimeCard.vue`
- **Daily quote card**: `src/components/business/index/DailyQuoteCard.vue`
- **Activity list**: `src/components/business/index/ActivityList.vue`
- **Recommendations**: `src/components/business/index/RecommendationsList.vue`
- **Header bar**: `src/components/business/index/IndexHeaderBar.vue`
- **Quote poster modal**: `src/components/business/index/QuotePosterModal.vue`
- **Formula modal**: `src/components/business/index/FormulaModal.vue`
- **Learning stats composable**: `src/composables/useLearningStats.js`
- **Recommendations composable**: `src/composables/useRecommendations.js`

### Charts not displaying

- **Study trend chart**: `src/components/charts/StudyTrend.vue`
- **Forgetting curve chart**: `src/components/charts/ForgettingCurve.vue`
- **Skill radar chart**: `src/components/charts/SkillRadar.vue`
- **Study trend (detail)**: `src/pages/study-detail/StudyTrendChart.vue`
- **Study heatmap (detail)**: `src/pages/study-detail/StudyHeatmap.vue`
- **Ability radar (detail)**: `src/pages/study-detail/AbilityRadar.vue`
- **ECharts dependency**: `echarts` + `uni-echarts` packages

---

## Mistake Book / Favorites

### Mistake book issues

- **Mistake book page**: `src/pages/mistake/index.vue`
- **Mistake card**: `src/pages/mistake/MistakeCard.vue`
- **Mistake report**: `src/pages/mistake/MistakeReport.vue`
- **Stats card**: `src/pages/mistake/StatsCard.vue`
- **Mistake classifier**: `src/utils/practice/mistake-classifier.js`
- **Mistake auto-collect**: `src/utils/practice/mistake-auto-collect.js`
- **Backend mistake manager**: `laf-backend/functions/mistake-manager.ts`

### Favorites issues

- **Favorites page**: `src/pages/favorite/index.vue`
- **Question favorite util**: `src/utils/favorite/question-favorite.js`
- **Favorite service**: `src/services/api/domains/favorite.service.js`
- **Backend favorite manager**: `laf-backend/functions/favorite-manager.ts`

---

## School / 择校

### School search / detail issues

- **School search page**: `src/pages/school/index.vue` (2396 lines)
- **School detail page**: `src/pages/school-sub/detail.vue`
- **School search input**: `src/components/business/school/SchoolSearchInput.vue`
- **AI consult page**: `src/pages/school-sub/ai-consult.vue`
- **School store**: `src/stores/modules/school.js`
- **School service**: `src/services/api/domains/school.service.js`
- **Backend school query**: `laf-backend/functions/school-query.ts`
- **Backend school crawler**: `laf-backend/functions/school-crawler-api.ts`
- **School data**: `laf-backend/data/schools/`

---

## Social Features

### Friend list / social issues

- **Friend list**: `src/pages/social/friend-list.vue`
- **Friend profile**: `src/pages/social/friend-profile.vue`
- **Settings friends entry**: `src/pages/settings/FriendsEntryCard.vue`
- **Social service**: `src/services/api/domains/social.service.js`
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
- **VIP store**: `src/stores/modules/vip.js`
- **Invite store**: `src/stores/modules/invite.js`

---

## Theme / Styling

### Theme not switching properly

- **Theme engine**: `src/design/theme-engine.js`
- **Theme store**: `src/stores/modules/theme.js`
- **Theme composable**: `src/composables/useTheme.js`
- **App.vue theme init**: `src/App.vue` → `initThemeSystem()` / `switchTheme()`
- **Design tokens**: `src/styles/_design-tokens.scss`
- **Dark mode vars**: `src/styles/_dark-mode-vars.scss`
- **Theme vars**: `src/styles/_theme-vars.scss`
- **Wise theme**: `src/styles/theme-wise.scss`
- **Bitget theme**: `src/styles/theme-bitget.scss`
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

---

## Study Plan / Goals

### Study plan issues

- **Plan index**: `src/pages/plan/index.vue`
- **Plan create**: `src/pages/plan/create.vue`
- **Todo store**: `src/stores/modules/todo.js`
- **Todo composable**: `src/composables/useTodo.js`
- **Todo list component**: `src/components/common/TodoList.vue`
- **Todo editor**: `src/components/common/todo-editor.vue`
- **Learning goal util**: `src/utils/learning/learning-goal.js`
- **Backend learning goal**: `laf-backend/functions/learning-goal.ts`

---

## Study Stats / Detail

### Stats not showing

- **Study detail page**: `src/pages/study-detail/index.vue`
- **Study trend chart**: `src/pages/study-detail/StudyTrendChart.vue`
- **Study heatmap**: `src/pages/study-detail/StudyHeatmap.vue`
- **Ability radar**: `src/pages/study-detail/AbilityRadar.vue`
- **Study store**: `src/stores/modules/study.js`
- **Learning trajectory store**: `src/stores/modules/learning-trajectory-store.js`
- **Gamification store**: `src/stores/modules/gamification.js`
- **Learning analytics**: `src/utils/analytics/learning-analytics.js`
- **Backend study stats**: `laf-backend/functions/study-stats.ts`
- **Backend user stats**: `laf-backend/functions/user-stats.ts`

---

## Error Handling / Network

### Global error handling

- **Error handler**: `src/utils/error/global-error-handler.js`
- **Logger**: `src/utils/logger.js`
- **Network monitor**: `src/utils/core/network-monitor.js`
- **Offline queue**: `src/utils/core/offline-queue.js`
- **Offline cache service**: `src/services/offline-cache-service.js`
- **Offline indicator**: `src/components/common/offline-indicator.vue`
- **SWR cache**: `src/utils/cache/swr-cache.js`

---

## Build / Configuration

### Build failures

- **Vite config**: `vite.config.js`
- **Vitest config**: `vitest.config.js`
- **ESLint config**: `eslint.config.js`
- **Manifest**: `manifest.json`
- **Pages config**: `pages.json`
- **Environment vars**: `.env`, `.env.development`, `.env.production`
- **Build scripts**: `scripts/build/`
- **Playwright configs**: `playwright.regression.config.js`, `playwright.visual.config.js`

---

## Infrastructure / Scripts

### Duplicate directories

- **Note**: The `laf-backend/scripts/` directory contains subdirectories (`crawlers`, `data-sync`, `test`) that duplicate those in the root `scripts/` directory. Be aware of this redundancy.
