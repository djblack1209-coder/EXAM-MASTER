# 前端参考手册

> 合并自 docs/AI-SOP/modules/ 下 4 个前端文档

---

## 一、组件清单

> Auto-generated: 2026-03-22 | Last updated: 2026-03-25 (Round 39 AI助手化)

### Base Components (`src/components/base/`)

Primitive UI building blocks with no business logic.

| Component      | File                                  | Purpose                                                                                                                                                   |
| -------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BaseCard       | `base-card/base-card.vue`             | Generic card container with border, shadow, radius                                                                                                        |
| BaseEmpty      | `base-empty/base-empty.vue`           | Empty state display with icon and message                                                                                                                 |
| BaseIcon       | `base-icon/base-icon.vue`             | **(Round 35k)** SVG icon component — 86 icons (74 base + 12 Lucide-style), 35 aliases. Globally registered in main.js. Supports dark mode theme switching |
| BaseSkeleton   | `base-skeleton/base-skeleton.vue`     | Generic loading skeleton placeholder                                                                                                                      |
| SchoolSkeleton | `school-skeleton/school-skeleton.vue` | School list item loading skeleton                                                                                                                         |

### Business Components (`src/components/business/`)

Domain-specific components organized by feature area.

#### Index (Home Page) Components (`business/index/`)

| Component       | File                  | Purpose                                                                                                   |
| --------------- | --------------------- | --------------------------------------------------------------------------------------------------------- |
| AIDailyBriefing | `AIDailyBriefing.vue` | **(Round 39)** AI每日简报 — 智能任务调度+个性化建议+一键开始最优先任务。基于FSRS/倒计时/错题/进度本地计算 |
| DailyGoalRing   | `DailyGoalRing.vue`   | Circular progress ring for daily goal tracking                                                            |
| StatsGrid       | `StatsGrid.vue`       | Grid of key learning statistics                                                                           |
| StudyHeatmap    | `StudyHeatmap.vue`    | GitHub-style contribution heatmap for study days                                                          |
| WelcomeBanner   | `WelcomeBanner.vue`   | Personalized welcome banner with greeting                                                                 |
| StudyTimeCard   | `StudyTimeCard.vue`   | Today's study time display card                                                                           |
| ActivityList    | `ActivityList.vue`    | Recent learning activity feed                                                                             |
| IndexHeaderBar  | `IndexHeaderBar.vue`  | Home page custom navigation header                                                                        |
| FormulaModal    | `FormulaModal.vue`    | Mathematical formula reference modal                                                                      |

#### Practice Components (`business/practice/`)

| Component             | File                        | Purpose                                         |
| --------------------- | --------------------------- | ----------------------------------------------- |
| GenerationProgressBar | `GenerationProgressBar.vue` | AI question generation progress indicator       |
| PauseBanner           | `PauseBanner.vue`           | Quiz pause state banner                         |
| QuizManageModal       | `QuizManageModal.vue`       | Quiz bank management modal                      |
| GoalSettingModal      | `GoalSettingModal.vue`      | Daily practice goal setting                     |
| AchievementModal      | `AchievementModal.vue`      | Achievement unlocked celebration modal          |
| PracticeModesModal    | `PracticeModesModal.vue`    | Practice mode selection (normal, speed, review) |
| SpeedReadyModal       | `SpeedReadyModal.vue`       | Speed mode countdown ready screen               |
| AiGenerationOverlay   | `AiGenerationOverlay.vue`   | Full-screen AI generation loading overlay       |
| LearningStatsCard     | `LearningStatsCard.vue`     | Compact learning statistics display             |

### Chart Components (`src/components/charts/`)

ECharts-based data visualization components. **v2 (Round 13)**: 搬运 ECharts 官方最佳实践配置。

| Component  | File             | Purpose                                                                                |
| ---------- | ---------------- | -------------------------------------------------------------------------------------- |
| StudyTrend | `StudyTrend.vue` | **v2**: 学习趋势图 — dataZoom 横向滚动 + areaStyle 渐变 + markLine 均值 + HTML tooltip |

### Common Components (`src/components/common/`)

Cross-cutting UI components used across multiple pages.

| Component           | File                      | Purpose                                                               |
| ------------------- | ------------------------- | --------------------------------------------------------------------- |
| CustomModal         | `CustomModal.vue`         | Reusable modal dialog with slot content                               |
| EmptyState          | `EmptyState.vue`          | Empty state with illustration and CTA                                 |
| share-modal         | `share-modal.vue`         | Social sharing modal (WeChat, QQ, poster)                             |
| ResumePracticeModal | `ResumePracticeModal.vue` | "Resume where you left off" prompt                                    |
| offline-indicator   | `offline-indicator.vue`   | Network offline status banner (6 pages)                               |
| ErrorBoundary       | `ErrorBoundary.vue`       | Catches render errors, shows recovery UI (global registered, 5 pages) |
| privacy-popup       | `privacy-popup.vue`       | Privacy agreement popup (first launch)                                |

### Layout Components (`src/components/layout/`)

| Component     | File                              | Purpose                                 |
| ------------- | --------------------------------- | --------------------------------------- |
| custom-tabbar | `custom-tabbar/custom-tabbar.vue` | Custom bottom tab bar (replaces native) |

### 组件统计

- **Total shared components**: ~32
- **Base**: 5 primitives
- **Business**: 18 domain-specific components (across 2 domains)
- **Charts**: 1 ECharts wrapper
- **Common**: 7 cross-cutting components
- **Layout**: 1 tab bar

#### New in Round 13-15

| Component  | File                    | Change                          |
| ---------- | ----------------------- | ------------------------------- |
| StudyTrend | `charts/StudyTrend.vue` | v2: dataZoom+areaStyle+markLine |

---

## 二、页面路由

> Auto-generated: 2026-03-22 | Last updated: 2026-03-26 (Round 53 架构重构)
>
> **Round 53 变更**:
>
> - **D001 service 层重构**：删除 6 个 `.service.js` 文件 (-10,085 行)，`lafService.js` 改为聚合 8 个 `.api.js`
> - **H005 Store 层归位**：31 处 `lafService.xxx()` → Store action（classroomStore 8处, toolsStore 6处, reviewStore 17处）
> - **D004/D009 清理**：废弃 `getApiKey()` 删除，4 个 mixin 迁移为 composable，`src/mixins/` 目录删除

### Main Package (tabBar)

| Page          | Path                           | Lines | Title        | Key Features                                                                               |
| ------------- | ------------------------------ | ----- | ------------ | ------------------------------------------------------------------------------------------ |
| Splash        | `src/pages/splash/index.vue`   | 562   | Exam Master  | Brand animation, auto-redirect                                                             |
| Home          | `src/pages/index/index.vue`    | 2310  | (custom nav) | ECharts, FSRS review, heatmap, knowledge bubbles, daily quote, stats grid, recommendations |
| Practice Hub  | `src/pages/practice/index.vue` | 1955  | 智能刷题     | Quiz config panel, Anki import, AI generation, practice modes, learning stats              |
| School Search | `src/pages/school/index.vue`   | 2396  | 择校分析     | Province filter, school list, hot schools, search input                                    |
| Profile       | `src/pages/profile/index.vue`  | 1907  | 个人中心     | User stats, VIP status, settings entry, gamification display                               |

### Sub-Package: practice-sub

| Page               | Path                                          | Lines | Title      | Key Features                                                                                     |
| ------------------ | --------------------------------------------- | ----- | ---------- | ------------------------------------------------------------------------------------------------ |
| Quiz Engine        | `src/pages/practice-sub/do-quiz.vue`          | 1774  | 刷题进行中 | R43拆分: script -87%，逻辑提取到5个composable (useQuizState/Timer/Submit/Navigation/FSRS)        |
| PK Battle          | `src/pages/practice-sub/pk-battle.vue`        | 1959  | PK 对战    | R45拆分: script -92%，逻辑提取到4个mixin (pkMatching/Gameplay/Result/Share)                      |
| Ranking            | `src/pages/practice-sub/rank.vue`             | 1758  | 学霸排行榜 | Leaderboard, weekly/monthly/all-time, user rank card                                             |
| Import Data        | `src/pages/practice-sub/import-data.vue`      | 2851  | 资料导入   | Anki .apkg import, file upload, format conversion, progress tracking                             |
| File Manager       | `src/pages/practice-sub/file-manager.vue`     | 624   | 文件管理   | Uploaded files list, delete, preview                                                             |
| Mock Exam          | `src/pages/practice-sub/mock-exam.vue`        | ~1600 | 模拟考试   | **[ENHANCED]** 计时压力感(warning/danger) + 实时IRT分数预测 + 每题用时 + 分科统计 + 离线三层降级 |
| Smart Review       | `src/pages/practice-sub/smart-review.vue`     | 950   | 智能复习   | FSRS-driven due cards, retrievability sorting                                                    |
| Question Bank      | `src/pages/practice-sub/question-bank.vue`    | 487   | 考研题库   | Browse question bank, filter by subject/chapter                                                  |
| Diagnosis Report   | `src/pages/practice-sub/diagnosis-report.vue` | 1035  | 学习诊断   | AI analysis, weak points, improvement plan                                                       |
| **Error Clusters** | `src/pages/practice-sub/error-clusters.vue`   | ~215  | 错题归因   | **[NEW]** 错题按error_type×category聚类，趋势分析，severity分级                                  |
| **Sprint Mode**    | `src/pages/practice-sub/sprint-mode.vue`      | ~225  | 冲刺模式   | **[NEW]** ROI优先级排序，考试倒计时，战略放弃建议                                                |

### Sub-Package: login

| Page            | Path                                  | Lines | Title    | Key Features                                            |
| --------------- | ------------------------------------- | ----- | -------- | ------------------------------------------------------- |
| Login           | `src/pages/login/index.vue`           | 1890  | 登录     | Email + code, WeChat login, QQ login, privacy agreement |
| WeChat Callback | `src/pages/login/wechat-callback.vue` | 366   | 微信登录 | OAuth callback handler                                  |
| QQ Callback     | `src/pages/login/qq-callback.vue`     | 499   | QQ登录   | OAuth callback handler                                  |

### Sub-Package: settings

| Page             | Path                             | Lines | Title    | Key Features                                                 |
| ---------------- | -------------------------------- | ----- | -------- | ------------------------------------------------------------ |
| Settings         | `src/pages/settings/index.vue`   | 2132  | 系统设置 | Theme switch, account mgmt, about, feedback, AI tutor config |
| Privacy Policy   | `src/pages/settings/privacy.vue` | 229   | 隐私政策 | Static content                                               |
| Terms of Service | `src/pages/settings/terms.vue`   | 231   | 用户协议 | Static content                                               |

### Sub-Package: social

| Page           | Path                                  | Lines | Title    | Key Features                              |
| -------------- | ------------------------------------- | ----- | -------- | ----------------------------------------- |
| Friend List    | `src/pages/social/friend-list.vue`    | 1513  | 我的好友 | Friend list, add friend, search, requests |
| Friend Profile | `src/pages/social/friend-profile.vue` | 867   | 好友资料 | Friend stats, AI chat, study comparison   |

### Sub-Package: chat

| Page    | Path                      | Lines | Title    | Key Features                                                     |
| ------- | ------------------------- | ----- | -------- | ---------------------------------------------------------------- |
| AI Chat | `src/pages/chat/chat.vue` | 2024  | 智能对话 | Streaming SSE chat, Markdown rendering, KaTeX, code highlighting |

### Sub-Package: mistake

| Page         | Path                          | Lines | Title  | Key Features                                            |
| ------------ | ----------------------------- | ----- | ------ | ------------------------------------------------------- |
| Mistake Book | `src/pages/mistake/index.vue` | 1161  | 错题本 | Error collection, filter by subject/type, stats, export |

### Sub-Package: favorite

| Page      | Path                           | Lines | Title    | Key Features                           |
| --------- | ------------------------------ | ----- | -------- | -------------------------------------- |
| Favorites | `src/pages/favorite/index.vue` | 1339  | 我的收藏 | Saved questions, folders, quick access |

### Sub-Package: plan

| Page              | Path                          | Lines | Title        | Key Features                                      |
| ----------------- | ----------------------------- | ----- | ------------ | ------------------------------------------------- |
| Plan List         | `src/pages/plan/index.vue`    | 1184  | 我的学习计划 | Plan overview, progress tracking, daily tasks     |
| Create Plan       | `src/pages/plan/create.vue`   | 759   | 创建学习计划 | Plan wizard, goal setting, schedule configuration |
| **Adaptive Plan** | `src/pages/plan/adaptive.vue` | ~235  | 智能学习计划 | **[NEW]** AI自适应7天计划，阶段划分，每日任务卡片 |

### Sub-Package: study-detail

| Page         | Path                               | Lines | Title    | Key Features                                        |
| ------------ | ---------------------------------- | ----- | -------- | --------------------------------------------------- |
| Study Detail | `src/pages/study-detail/index.vue` | 707   | 学习详情 | Detailed stats, trend chart, heatmap, ability radar |

### Sub-Package: tools

| Page         | Path                               | Lines | Title      | Key Features                                     |
| ------------ | ---------------------------------- | ----- | ---------- | ------------------------------------------------ |
| Photo Search | `src/pages/tools/photo-search.vue` | 1796  | 拍照搜题   | Camera/gallery input, OCR, AI answer generation  |
| Doc Convert  | `src/pages/tools/doc-convert.vue`  | 1510  | 文档转换   | File format conversion (PDF, DOCX, etc.)         |
| ID Photo     | `src/pages/tools/id-photo.vue`     | 1479  | 证件照制作 | Background removal, color change, size selection |

### Sub-Package: knowledge-graph

| Page                 | Path                                    | Lines | Title      | Key Features                                            |
| -------------------- | --------------------------------------- | ----- | ---------- | ------------------------------------------------------- |
| Knowledge Graph      | `src/pages/knowledge-graph/index.vue`   | 1961  | 知识图谱   | Force-directed graph, node interaction, mastery display |
| **Mastery Overview** | `src/pages/knowledge-graph/mastery.vue` | ~220  | 掌握度全景 | **[NEW]** 各知识点掌握度可视化，科目分组，趋势指示      |

### Sub-Package: ai-classroom

| Page               | Path                                   | Lines | Title   | Key Features                                             |
| ------------------ | -------------------------------------- | ----- | ------- | -------------------------------------------------------- |
| AI Classroom Index | `src/pages/ai-classroom/index.vue`     | 544   | AI 课堂 | Lesson selection, subject browser (R18: 修复 timer leak) |
| AI Classroom       | `src/pages/ai-classroom/classroom.vue` | 751   | AI 课堂 | Interactive lesson, teacher/student/examiner agents      |

### Sub-Package: school-sub

| Page          | Path                                  | Lines | Title    | Key Features                             |
| ------------- | ------------------------------------- | ----- | -------- | ---------------------------------------- |
| School Detail | `src/pages/school-sub/detail.vue`     | 1417  | 院校详情 | Score lines, major info, admission stats |
| AI Consult    | `src/pages/school-sub/ai-consult.vue` | —     | —        | AI school counseling                     |

### Sub-Package: login (含 onboarding)

| Page       | Path                                | Lines | Title    | Key Features                |
| ---------- | ----------------------------------- | ----- | -------- | --------------------------- |
| Onboarding | `src/pages/login/onboarding.vue`    | —     | 新手引导 | Feature tour with driver.js |

### Page-Local Components

Some pages have co-located components in their directories:

| Component          | Path                                                                        | Parent Page     |
| ------------------ | --------------------------------------------------------------------------- | --------------- |
| quiz-progress      | `src/pages/practice-sub/components/quiz-progress/quiz-progress.vue`         | do-quiz         |
| answer-sheet       | `src/pages/practice-sub/components/answer-sheet/answer-sheet.vue`           | do-quiz         |
| quiz-result        | `src/pages/practice-sub/components/quiz-result/quiz-result.vue`             | do-quiz         |
| TutorFeedbackCard  | `src/pages/practice-sub/components/quiz-result/TutorFeedbackCard.vue`       | quiz-result     |
| MemoryStatsRow     | `src/pages/practice-sub/components/quiz-result/MemoryStatsRow.vue`          | quiz-result     |
| xp-toast           | `src/pages/practice-sub/components/xp-toast/xp-toast.vue`                   | do-quiz         |
| base-loading       | `src/pages/practice-sub/components/base-loading/base-loading.vue`           | do-quiz         |
| RichText           | `src/pages/practice-sub/components/RichText.vue`                            | do-quiz         |
| EnhancedProgress   | `src/pages/practice-sub/EnhancedProgress.vue`                               | do-quiz         |
| knowledge-graph.js | `src/pages/knowledge-graph/knowledge-graph.js`                             | knowledge-graph |
| plan-skeleton      | `src/pages/plan/components/plan-skeleton/plan-skeleton.vue`                 | plan            |
| mistake-skeleton   | `src/pages/mistake/components/mistake-skeleton/mistake-skeleton.vue`        | mistake         |
| MistakeCard        | `src/pages/mistake/MistakeCard.vue`                                         | mistake         |
| MistakeReport      | `src/pages/mistake/MistakeReport.vue`                                       | mistake         |
| StatsCard          | `src/pages/mistake/StatsCard.vue`                                           | mistake         |
| FSRSOptimizer      | `src/pages/study-detail/FSRSOptimizer.vue`                                  | study-detail    |
| StudyTrendChart    | `src/pages/study-detail/StudyTrendChart.vue`                                | study-detail    |
| AbilityRadar       | `src/pages/study-detail/AbilityRadar.vue`                                   | study-detail    |
| ThemeSelectorModal | `src/pages/settings/ThemeSelectorModal.vue`                                 | settings        |
| AITutorList        | `src/pages/settings/AITutorList.vue`                                        | settings        |
| AIChatModal        | `src/pages/settings/AIChatModal.vue`                                        | settings        |
| InviteModal        | `src/pages/settings/InviteModal.vue`                                        | settings        |
| PosterModal        | `src/pages/settings/PosterModal.vue`                                        | settings        |
| FriendsEntryCard   | `src/pages/settings/FriendsEntryCard.vue`                                   | settings        |
| LogoutButton       | `src/pages/settings/LogoutButton.vue`                                       | settings        |

### 页面统计

- **Total pages**: 36
- **Total page lines**: ~49,870
- **Largest page**: pk-battle.vue (3327 lines)
- **Heaviest sub-package**: practice-sub (9 pages, ~15,639 lines)

---

## 三、状态管理

> Auto-generated: 2026-03-22
>
> All stores use Pinia `defineStore()` with setup function syntax (Composition API).
> Entry point: `src/stores/index.js` re-exports all stores.

### Store Architecture

The user store is a **facade pattern** that composes 4 sub-stores:

```
useUserStore (facade)
├── useAuthStore      → token, isLogin, login(), logout(), silentLogin()
├── useProfileStore   → userInfo, planProgress, updateProfile()
├── useVipStore       → vipStatus, vipLevel, isVip, vipDaysLeft
└── useInviteStore    → inviteCode, inviteCount, inviteRewards
```

### Store Modules

#### useUserStore (Facade)

| Property | Path                                                                        | Purpose                                         |
| -------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| File     | `src/stores/modules/user.js`                                                | Composes auth + profile + vip + invite + social |
| State    | `token`, `isLogin`, `userInfo`, `vipStatus`, `inviteCode`, `friendsList`    | Unified access                                  |
| Actions  | `login()`, `logout()`, `silentLogin()`, `fetchFriends()`, `updateProfile()` | Delegates to sub-stores                         |

#### useAuthStore

| Property | Path                                                               | Purpose                  |
| -------- | ------------------------------------------------------------------ | ------------------------ |
| File     | `src/stores/modules/auth.js`                                       | Authentication state     |
| State    | `token` (ref), `isLogin` (computed)                                | JWT token & login status |
| Actions  | `setToken()`, `clearToken()`, `syncLoginStatus()`, `silentLogin()` | Token management         |

#### useProfileStore

| Property | Path                                                    | Purpose                     |
| -------- | ------------------------------------------------------- | --------------------------- |
| File     | `src/stores/modules/profile.js`                         | User profile data           |
| State    | `userInfo` (ref), `planProgress` (ref)                  | Profile & learning progress |
| Actions  | `setUserInfo()`, `updateProfile()`, `loadFromStorage()` | Profile management          |

#### useVipStore (已移除)

> VIP 功能已整体移除。相关状态已合并到 useUserStore facade 中，独立的 vip.js 文件已删除。

#### useInviteStore

| Property | Path                                         | Purpose                  |
| -------- | -------------------------------------------- | ------------------------ |
| File     | `src/stores/modules/invite.js`               | Invite & referral system |
| State    | `inviteCode`, `inviteCount`, `inviteRewards` | Invite tracking          |
| Computed | `totalInviteRewards`                         | Sum of rewards           |

#### useStudyStore

| Property    | Path                                                                                                                                                 | Purpose                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| File        | `src/stores/modules/study.js`                                                                                                                        | Aggregate study metrics |
| State       | `studyProgress` (totalQuestions, completedQuestions, correctQuestions, studyDays, studyMinutes, lastStudyDate), `currentQuestion`, `questionHistory` | Learning metrics        |
| Computed    | `completionRate`, `accuracyRate`                                                                                                                     | Derived metrics         |
| Actions     | `recordAnswer()`, `loadProgress()`, `saveProgress()`, `resetProgress()`                                                                              | Metric updates          |
| Persistence | Via `storageService`, key configured in `APP_CONFIG`                                                                                                 | Local storage           |

#### useGamificationStore

| Property    | Path                                                                                             | Purpose                   |
| ----------- | ------------------------------------------------------------------------------------------------ | ------------------------- |
| File        | `src/stores/modules/gamification.js`                                                             | XP, streaks, achievements |
| State       | `xp`, `level`, `streakDays`, `achievements`, `dailyChallenges`                                   | Gamification data         |
| Constants   | `XP_REWARDS` (CORRECT_ANSWER: 10, STREAK_BONUS: 5, PERFECT_SCORE: 50, FIRST_PRACTICE: 20)        | XP values                 |
| Constants   | `STREAK_MILESTONES` [3, 7, 14, 30, 60, 100, 365]                                                 | Streak milestones         |
| Constants   | `ACHIEVEMENT_DEFS` (first_blood, streak_3/7/14/30, etc.)                                         | Achievement definitions   |
| Actions     | `awardXP()`, `recordCorrectAnswer()`, `recordMistake()`, `checkAchievements()`, `updateStreak()` | Gamification logic        |
| Persistence | Key: `gamification_state`                                                                        | Local storage             |

#### useThemeStore

| Property | Path                                                                       | Purpose             |
| -------- | -------------------------------------------------------------------------- | ------------------- |
| File     | `src/stores/modules/theme.js`                                              | Theme management    |
| State    | `themeType` ('wise' or 'bitget'), `isDark` (boolean)                       | Theme settings      |
| Actions  | `setThemeType()`, `setDarkMode()`, `initFromStorage()`, `getThemeTokens()` | Theme switching     |
| Events   | Emits `themeTypeUpdate` via uni.$emit                                      | Global notification |

#### useAppStore (已移除)

> App 运行时上下文 store 已移除。系统信息和网络状态现由各 composable 局部管理。

#### useSchoolStore

| Property    | Path                                                           | Purpose                            |
| ----------- | -------------------------------------------------------------- | ---------------------------------- |
| File        | `src/stores/modules/school.js`                                 | School selection                   |
| State       | `info` (ref: Object)                                           | Selected school/major/target score |
| Computed    | `hasPlan` (boolean)                                            | Whether user has set school target |
| Actions     | `setInfo()`, `loadFromStorage()`, `saveToStorage()`, `clear()` | School selection management        |
| Persistence | Key: `school_selection_info`                                   | Local storage                      |

#### useTodoStore

| Property    | Path                                                                         | Purpose               |
| ----------- | ---------------------------------------------------------------------------- | --------------------- |
| File        | `src/stores/modules/todo.js`                                                 | Daily task management |
| State       | `tasks` (array of {id, title, done, priority, tag, tagColor})                | Task list             |
| Actions     | `addTask()`, `removeTask()`, `toggleTask()`, `reorderTasks()`, `loadTasks()` | CRUD operations       |
| Persistence | Key: `my_tasks`                                                              | Local storage         |
| Default     | Creates 3 default tasks on first load                                        | Pre-seeded content    |

#### useLearningTrajectoryStore

| Property    | Path                                                                                              | Purpose                      |
| ----------- | ------------------------------------------------------------------------------------------------- | ---------------------------- |
| File        | `src/stores/modules/learning-trajectory-store.js`                                                 | Fine-grained learning events |
| State       | `trajectory` (event array), `knowledgeMastery` (per-point scores), `sessions` (learning sessions) | Event stream                 |
| Event Types | `BUBBLE_CLICK`, `ANSWER_QUESTION`, `REVIEW_CARD`, `START_SESSION`, `END_SESSION`                  | Trajectory events            |
| Actions     | `addTrajectory()`, `updateMastery()`, `startSession()`, `endSession()`, `getStats()`              | Event recording              |
| Persistence | Keys: `learning_trajectory`, `knowledge_mastery`, `learning_sessions`                             | Local storage                |

### Store Dependencies

```
useUserStore → useAuthStore, useProfileStore, useVipStore, useInviteStore
useStudyStore → storageService, APP_CONFIG
useGamificationStore → storageService
useLearningTrajectoryStore → storageService
useThemeStore → storageService
useSchoolStore → storageService
useTodoStore → storageService
useAppStore → (no external deps)
```

### Store 汇总

| Store               | Key Responsibility         | Persistence                  |
| ------------------- | -------------------------- | ---------------------------- |
| user                | Auth + profile facade      | Via sub-stores               |
| auth                | JWT token, login status    | `EXAM_TOKEN`, `EXAM_USER_ID` |
| profile             | User profile data          | `userInfo`                   |
| vip                 | VIP membership             | Via profile                  |
| invite              | Referral system            | Via profile                  |
| study               | Aggregate learning metrics | APP_CONFIG key               |
| gamification        | XP, streaks, achievements  | `gamification_state`         |
| theme               | Theme type + dark mode     | `theme_type`, `theme_mode`   |
| app                 | Device info, network       | In-memory only               |
| school              | Target school selection    | `school_selection_info`      |
| todo                | Daily task list            | `my_tasks`                   |
| learning-trajectory | Fine-grained event stream  | `learning_trajectory`        |

---

## 四、服务层

> Auto-generated: 2026-03-22 | Last updated: 2026-03-25 (Round 41 全维度审计重构)

### API Layer

#### Core Request Infrastructure

| File              | Path                                        | Lines | Purpose                                                      |
| ----------------- | ------------------------------------------- | ----- | ------------------------------------------------------------ |
| \_request-core.js | `src/services/api/domains/_request-core.js` | 592   | **请求基础设施**: 签名、重试、缓存、限流、去重、双服务器切换 |

**Key features of the request layer:**

- Automatic retry with exponential backoff
- Response caching (SWR pattern)
- Request deduplication (same URL + params)
- FNV-1a request signing (anti-tamper)
- Network connectivity pre-check
- Frontend rate limiting
- Auth token injection (Bearer)
- Standardized error normalization

#### Domain Services (Round 41 按领域拆分)

| File              | Path                                        | Lines | Domain                                     |
| ----------------- | ------------------------------------------- | ----- | ------------------------------------------ |
| \_request-core.js | `src/services/api/domains/_request-core.js` | 592   | 请求基础设施                               |
| auth.api.js       | `src/services/api/domains/auth.api.js`      | 65    | 登录、邮箱验证码                           |
| school.api.js     | `src/services/api/domains/school.api.js`    | 99    | 院校查询、热门院校、省份列表               |
| ai.api.js         | `src/services/api/domains/ai.api.js`        | 662   | AI 代理、流式聊天、诊断、拍照搜题、AI 课堂 |
| practice.api.js   | `src/services/api/domains/practice.api.js`  | 253   | 题库、答题提交、错题、收藏、FSRS           |
| social.api.js     | `src/services/api/domains/social.api.js`    | 116   | 好友系统、排行榜、邀请奖励                 |
| user.api.js       | `src/services/api/domains/user.api.js`      | 307   | 用户档案、账号注销、统计、学习目标、成就   |
| tools.api.js      | `src/services/api/domains/tools.api.js`     | 85    | 去背景、语音识别/合成、音色列表            |
| study.api.js      | `src/services/api/domains/study.api.js`     | 159   | 学习统计、学习资源、首页数据               |

#### Service Facade

| File          | Path                         | Lines | Purpose                                                             |
| ------------- | ---------------------------- | ----- | ------------------------------------------------------------------- |
| lafService.js | `src/services/lafService.js` | 55    | Facade: merges all 6 domain services + tool APIs into single export |

**Usage pattern:**

```js
import { lafService } from '@/services/lafService.js';
const result = await lafService.proxyAI(messages, options);
const schools = await lafService.getSchoolList(params);
```

### Core Services

#### FSRS Service

| File            | Path                           | Lines | Purpose                                        |
| --------------- | ------------------------------ | ----- | ---------------------------------------------- |
| fsrs-service.js | `src/services/fsrs-service.js` | 640   | FSRS-5 spaced repetition scheduler (singleton) |

**Key exports:**

- `scheduleCard(questionId, rating)` — Schedule next review
- `createNewCard(questionId)` — Initialize FSRS state for new question
- `getDueCards(allCards)` — Get cards due for review, sorted by retrievability
- `getReviewStats(questionIds)` — Get aggregate review statistics
- `updateUserParams(params)` — Hot-swap personalized FSRS parameters

**Constants:**

- FSRS-5 default weights: 21 parameters
- Target retention: 90%
- Storage key pattern: `fsrs_card_{questionId}`

#### Knowledge Engine

| File                | Path                               | Lines | Purpose                              |
| ------------------- | ---------------------------------- | ----- | ------------------------------------ |
| knowledge-engine.js | `src/pages/knowledge-graph/knowledge-engine.js` | —     | Knowledge graph x FSRS fusion engine |

**Key exports:**

- `calculateMastery(knowledgePoint)` — Weighted mastery (40% FSRS retrievability + 60% accuracy)
- `getLearningPath(subject)` — Topological sort of knowledge points based on prerequisites
- `getGraphData(subject)` — Nodes/edges data for force-directed graph visualization
- `isPrerequisiteMet(knowledgePoint)` — Check if prerequisites mastered (>70%)

**Prerequisite DAG:** Defines dependencies between 考研 knowledge points (e.g., probability depends on calculus).

#### Storage Service

| File              | Path                             | Lines | Purpose                           |
| ----------------- | -------------------------------- | ----- | --------------------------------- |
| storageService.js | `src/services/storageService.js` | ~200  | Unified local storage abstraction |

**Key exports:**

- `save(key, value, sync)` — Save to uni storage
- `get(key, defaultValue)` — Read from uni storage
- `remove(key, sync)` — Delete from storage
- `clear(sync, options)` — Clear all storage
- `getUserId()` — Get current user ID from storage
- `getStorageInfo()` — Get storage usage stats

#### Stream Service (已移除)

> SSE 流式服务已移除，AI 聊天打字效果现由 `src/composables/useTypewriter.js` 纯前端实现。

### Utility Services

| File                     | Path                                    | Purpose                                                                                             |
| ------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| toast.js                 | `src/utils/toast.js`                    | **(Round 14)** 中心化 Toast：success/error/info/warning/loading/hide                                |
| auth-storage.js          | `src/services/auth-storage.js`          | Auth token persistence (R18: 修复 `uni.getItem` → `localStorage.getItem`)                           |
| checkin-streak.js        | `src/services/checkin-streak.js`        | Daily check-in streak calculation                                                                   |
| streak-recovery.js       | `src/services/streak-recovery.js`       | Streak recovery (freeze, skip) logic                                                                |
| fsrs-optimizer-client.js | `src/pages/practice-sub/services/fsrs-optimizer-client.js` | Client for cloud FSRS parameter optimization                                                        |
| offline-cache-service.js | `src/pages/practice-sub/services/offline-cache-service.js` | Offline data caching + answer queue + sync; exports `saveOfflineAnswer`, `checkOfflineAvailability` |
| subscribe-message.js     | `src/services/subscribe-message.js`     | WeChat subscription message API                                                                     |

### Composables (Vue 3 Hooks)

| File                     | Path                                       | Purpose                                 |
| ------------------------ | ------------------------------------------ | --------------------------------------- |
| useQuizAutoSave.js       | `src/composables/useQuizAutoSave.js`       | Auto-save quiz progress with debouncing |
| useNavigation.js         | `src/composables/useNavigation.js`         | Safe uni-app page navigation            |
| useTodo.js               | `src/composables/useTodo.js`               | Todo list CRUD tied to todo store       |
| usePracticeNavigation.js | `src/composables/usePracticeNavigation.js` | Practice-specific navigation logic      |
| useRecommendations.js    | `src/composables/useRecommendations.js`    | AI-powered learning recommendations     |
| useLearningStyle.js      | `src/composables/useLearningStyle.js`      | Adaptive learning style detection       |
| useTheme.js              | `src/composables/useTheme.js`              | Theme switching reactive hook           |
