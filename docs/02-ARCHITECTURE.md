# EXAM-MASTER System Architecture

> Last updated: 2026-04-23 | AI-SOP Version: 1.1

## High-Level Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                        CLIENT (uni-app Vue 3)                      │
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  Pages    │  │Components│  │  Stores  │  │Composable│          │
│  │ (45 pgs) │  │ (31 vue) │  │ (Pinia)  │  │ (hooks)  │          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│       │              │             │              │                │
│       └──────────────┴─────────────┴──────────────┘                │
│                              │                                     │
│  ┌───────────────────────────┴───────────────────────────┐        │
│  │              Service Layer                             │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐        │        │
│  │  │lafService│  │fsrs-svc  │  │knowledge-eng │        │        │
│  │  │(API fac.)│  │(schedule)│  │(graph+FSRS)  │        │        │
│  │  └────┬─────┘  └──────────┘  └──────────────┘        │        │
│  │       │                                                │        │
│  │  ┌────┴─────────────────────────────────────────┐     │        │
│  │  │  api/domains/ (15 domain service files)       │     │        │
│  │  │  ai | auth | practice | school | fav | social │     │        │
│  │  │  group | invite | resource | smart-study      │     │        │
│  │  │  stats | study | tools | user | _request-core │     │        │
│  │  └────┬─────────────────────────────────────────┘     │        │
│  │       │  ┌────────────────────────────┐                │        │
│  │       ├──┤ api/domains/_request-core  │                │        │
│  │       │  │ (retry, cache, sign, dedup)│                │        │
│  │       │  └────────────────────────────┘                │        │
│  └───────┴───────────────────────────────────────────────┘        │
│                              │                                     │
│                   uni.request (HTTP POST)                          │
└──────────────────────────────┬────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌───────────────────────────────────────────────────────────────────┐
│              BACKEND (Laf Cloud on Sealos)                        │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │              Cloud Functions (TypeScript)                │      │
│  │                                                          │      │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐ │      │
│  │  │proxy-ai │ │pk-battle │ │answer-sub. │ │login     │ │      │
│  │  │(AI hub) │ │(ELO+anti)│ │(FSRS upd.) │ │(JWT auth)│ │      │
│  │  └─────────┘ └──────────┘ └────────────┘ └──────────┘ │      │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐             │      │
│  │  │anki-imp. │ │lesson-gen│ │agent-orch. │  ...30 more │      │
│  │  └──────────┘ └──────────┘ └────────────┘             │      │
│  │                                                          │      │
│  │  ┌─────────────── _shared/ ──────────────────────┐     │      │
│  │  │ auth.ts          auth-middleware.ts            │     │      │
│  │  │ api-response.ts  validator.ts                  │     │      │
│  │  │ fsrs-scheduler.ts                              │     │      │
│  │  │ perf-monitor.ts                                │     │      │
│  │  │ embedding.ts     generation-pipeline.ts        │     │      │
│  │  │ agents/ (teacher, student, examiner)           │     │      │
│  │  │ orchestration/state-machine.ts                 │     │      │
│  │  │ ai-providers/provider-factory.ts               │     │      │
│  │  │ services/ (agent.service, fsrs.service)        │     │      │
│  │  └───────────────────────────────────────────────┘     │      │
│  └─────────────────────────────────────────────────────────┘      │
│                              │                                     │
│                              ▼                                     │
│  ┌─────────────────────────────────────────────────────────┐      │
│  │                    MongoDB (19 collections)              │      │
│  │  users | questions | practice_records | mistake_book     │      │
│  │  favorites | friends | pk_records | study_plans          │      │
│  │  learning_goals | goal_progress | learning_progress      │      │
│  │  learning_resources | resource_favorites                 │      │
│  │  groups | group_members | group_resources                │      │
│  │  achievements | idempotency_records                      │      │
│  └─────────────────────────────────────────────────────────┘      │
│                                                                    │
│  ┌────────────────────┐  ┌────────────────────────────┐          │
│  │ AI Provider Pool   │  │ External Services           │          │
│  │ (10+ LLM APIs via  │  │ - Sealos Object Storage    │          │
│  │  provider-factory)  │  │ - Email (Tencent Cloud)    │          │
│  └────────────────────┘  │ - WeChat Open Platform      │          │
│                           └────────────────────────────────┘      │
└───────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Page Organization

Pages are organized into a main package (5 pages including splash) and 16 subPackages for WeChat MP size optimization, total 45 registered pages:

| Package           | Pages                                                                                                                                               | Purpose                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Main              | `splash/index`, `index`, `practice`, `school`, `profile`                                                                                            | 启动页 + Tab bar pages (5 pages)       |
| `practice-sub`    | `do-quiz`, `pk-battle`, `rank`, `import-data`, `question-bank`, `file-manager`, `mock-exam`, `diagnosis-report`, `smart-review`, `error-clusters`, `sprint-mode` | 练习功能 (11 pages)                    |
| `school-sub`      | `detail`, `ai-consult`                                                                                                                              | 院校详情 + AI 咨询 (2 pages)           |
| `login`           | `index`, `wechat-callback`, `qq-callback`, `onboarding`                                                                                             | 认证 + 新用户引导 (4 pages)            |
| `settings`        | `index`, `privacy`, `terms`                                                                                                                         | 设置页 (3 pages)                       |
| `social`          | `friend-list`, `friend-profile`                                                                                                                     | 社交功能 (2 pages)                     |
| `chat`            | `chat`                                                                                                                                              | AI 聊天                                |
| `mistake`         | `index`                                                                                                                                             | 错题本                                 |
| `favorite`        | `index`                                                                                                                                             | 收藏夹                                 |
| `plan`            | `index`, `create`, `adaptive`                                                                                                                       | 学习计划 (3 pages)                     |
| `study-detail`    | `index`                                                                                                                                             | 学习统计详情                           |
| `tools`           | `photo-search`, `id-photo`, `doc-convert`, `focus-timer`                                                                                            | 工具集合 (4 pages)                     |
| `knowledge-graph` | `index`, `mastery`                                                                                                                                  | 知识图谱 + 掌握度 (2 pages)            |
| `ai-classroom`    | `index`, `classroom`                                                                                                                                | AI 课堂 (2 pages)                      |
| `group`           | `index`                                                                                                                                             | 学习小组                               |
| `resource`        | `index`                                                                                                                                             | 学习资源                               |
| `common`          | `404`                                                                                                                                               | 通用错误页                             |

> 注：onboarding（新用户引导）位于 login 子包内，不是独立子包。

### Component Architecture

Components are organized into 4 categories（共 31 个 .vue 文件）:

```
src/components/
├── base/              # 纯 UI 基础组件（无业务逻辑）
│   ├── base-card/     # 通用卡片容器
│   ├── base-empty/    # 空状态展示
│   ├── base-icon/     # 图标组件
│   ├── base-skeleton/ # 加载骨架屏
│   ├── em3d-switch/   # 3D 切换效果
│   └── school-skeleton/ # 院校专用骨架屏
├── business/          # 业务领域组件
│   ├── index/         # 首页: AIDailyBriefing, ActivityList, DailyGoalRing,
│   │                  #   FormulaModal, IndexHeaderBar, StatsGrid,
│   │                  #   StudyHeatmap, StudyTimeCard, WelcomeBanner
│   ├── practice/      # 练习: AchievementModal, AiGenerationOverlay,
│   │                  #   GenerationProgressBar, GoalSettingModal,
│   │                  #   LearningStatsCard, PauseBanner,
│   │                  #   PracticeModesModal, QuizManageModal, SpeedReadyModal
│   └── school/        # （不存在，院校相关组件已内联到页面中）
├── common/            # 共享工具组件
│   ├── CustomModal.vue
│   ├── EmptyState.vue
│   ├── ResumePracticeModal.vue
│   ├── offline-indicator.vue
│   ├── privacy-popup.vue
│   └── share-modal.vue
└── layout/
    └── custom-tabbar/ # 自定义底部 Tab 栏
```

> 注：聊天相关组件（MessageActions、ThinkingBlock）位于 `src/pages/chat/components/`，不在全局 components 目录下。

### Service Layer

```
src/services/
├── lafService.js              # 门面模式：合并所有领域服务为单一导出
├── fsrs-service.js            # FSRS-5 间隔重复调度器（单例）
├── storageService.js          # 本地存储抽象层 (uni.setStorage)
├── auth-storage.js            # 认证 token 持久化
├── checkin-streak.js          # 每日打卡连续记录
├── streak-recovery.js         # 连续打卡恢复逻辑
├── subscribe-message.js       # 微信订阅消息
└── api/
    └── domains/               # API 领域服务（15 个文件）
        ├── _request-core.js   # 请求核心（重试、缓存、签名、去重）
        ├── ai.api.js          # AI 相关 API
        ├── auth.api.js        # 认证 API
        ├── favorite.api.js    # 收藏 API
        ├── group.api.js       # 学习小组 API
        ├── invite.api.js      # 邀请 API
        ├── practice.api.js    # 练习 API
        ├── resource.api.js    # 学习资源 API
        ├── school.api.js      # 院校 API
        ├── smart-study.api.js # 智能学习 API
        ├── social.api.js      # 社交 API
        ├── stats.api.js       # 统计 API
        ├── study.api.js       # 学习 API
        ├── tools.api.js       # 工具 API
        └── user.api.js        # 用户 API
```

> 注：以下服务已迁移到页面子包内部：
> - `knowledge-engine.js` → `src/pages/knowledge-graph/knowledge-engine.js`
> - `fsrs-optimizer-client.js` → `src/pages/practice-sub/services/fsrs-optimizer-client.js`
> - `offline-cache-service.js` → `src/pages/practice-sub/services/offline-cache-service.js`

### Composables (Vue 3 Hooks)

```
src/composables/               # 共 15 个 composable
├── useBankStatus.js           # 题库状态检查
├── useDailyQuote.js           # 每日一言
├── useDynamicMixin.js         # 动态混入
├── useHomeReview.js           # 首页复习推荐
├── useHomeStats.js            # 首页统计数据
├── useLearningStyle.js        # 自适应学习风格检测
├── useNavigation.js           # 安全页面导航工具
├── usePracticeNavigation.js   # 练习专用导航
├── useQuizAutoSave.js         # 答题自动保存（带防抖）
├── useRecommendations.js      # 学习推荐引擎
├── useStudyTimer.js           # 学习计时器
├── useStyleOnboarding.js      # 学习风格引导
├── useTheme.js                # 主题切换 hook
├── useTodo.js                 # 待办清单 CRUD
└── useTracking.js             # 学习行为追踪
```

### Store Architecture (Pinia)

```
src/stores/
├── index.js                           # 统一导出所有 store
└── modules/                           # 共 18 个 store 模块
    ├── user.js                        # 门面：组合 auth + profile + invite + social
    ├── auth.js                        # 认证状态（token、isLogin、silentLogin）
    ├── profile.js                     # 用户个人资料
    ├── invite.js                      # 邀请码与奖励
    ├── study.js                       # 聚合学习指标（总数、正确率、天数、分钟数）
    ├── stats.js                       # 学习统计数据
    ├── gamification.js                # 经验值、连续打卡、成就、每日挑战
    ├── theme.js                       # 主题类型 (wise/bitget) + 深色模式
    ├── school.js                      # 目标院校选择
    ├── todo.js                        # 每日任务清单
    ├── favorite.js                    # 收藏管理
    ├── group.js                       # 学习小组
    ├── practice-engine.js             # 练习引擎状态
    ├── resource.js                    # 学习资源
    ├── review.js                      # 复习状态
    ├── study-engine.js                # 学习引擎
    ├── tools.js                       # 工具状态
    └── learning-trajectory-store.js   # 细粒度学习事件流
```

---

## Backend Architecture

### Cloud Functions

Each cloud function is a standalone HTTP endpoint deployed to Laf Cloud (Sealos). Functions receive HTTP POST requests with JSON body and return JSON responses.

**Core Functions:**

| Function                          | Purpose                                       | Auth Required |
| --------------------------------- | --------------------------------------------- | ------------- |
| `proxy-ai.ts`                     | AI request proxy with multi-provider rotation | Yes           |
| `pk-battle.ts`                    | PK battle matching, session, ELO calculation  | Yes           |
| `answer-submit.ts` (via practice) | Submit answers, update FSRS state             | Yes           |
| `login.ts`                        | Email/WeChat/QQ login, JWT token issuance     | No            |
| `send-email-code.ts`              | Email verification code                       | No            |
| `question-bank.ts`                | Question CRUD, AI generation                  | Yes           |
| `mistake-manager.ts`              | Mistake book operations                       | Yes           |
| `favorite-manager.ts`             | Question favorites                            | Yes           |
| `rank-center.ts` (via rank)       | Leaderboard with rate limiting                | Yes           |
| `study-stats.ts`                  | Study statistics aggregation                  | Yes           |
| `user-stats.ts`                   | User profile statistics                       | Yes           |
| `school-query.ts`                 | School search & filtering                     | No            |
| `school-crawler-api.ts`           | School data crawling                          | Admin         |
| `achievement-manager.ts`          | Achievement unlocking                         | Yes           |
| `agent-orchestrator.ts`           | Multi-agent classroom orchestration           | Yes           |
| `lesson-generator.ts`             | AI lesson content generation                  | Yes           |
| `anki-import.ts`                  | Import .apkg files                            | Yes           |
| `anki-export.ts`                  | Export to .apkg format                        | Yes           |
| `fsrs-optimizer.ts`               | Server-side FSRS parameter optimization       | Yes           |
| `rag-ingest.ts`                   | RAG document ingestion                        | Yes           |
| `social-service.ts`               | Friend requests, status                       | Yes           |
| `invite-service.ts`               | Invite system                                 | Yes           |
| `learning-goal.ts`                | Learning goal CRUD                            | Yes           |
| `learning-resource.ts`            | Learning resource recommendations             | Yes           |
| `material-manager.ts`             | Study material management                     | Yes           |
| `upload-avatar.ts`                | Avatar upload to object storage               | Yes           |
| `photo-bg.ts`                     | Photo background removal                      | Yes           |
| `id-photo-segment-base64.ts`      | ID photo segmentation                         | Yes           |
| `health-check.ts`                 | Service health monitoring                     | No            |
| `account-delete.ts`               | Account deletion request                      | Yes           |
| `account-purge.ts`                | Account data purge (GDPR)                     | Admin         |
| `data-cleanup.ts`                 | Database cleanup jobs                         | Admin         |
| `group-service.ts`                | Study group management                        | Yes           |

### Shared Modules (\_shared/)

| Module                              | Purpose                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `auth.ts`                           | JWT creation/verification, password hashing                              |
| `auth-middleware.ts`                | `requireAuth()` middleware for cloud functions                           |
| `admin-auth.ts`                     | Admin-level authentication                                               |
| `api-response.ts`                   | Standardized response helpers (`ok()`, `unauthorized()`, `badRequest()`) |
| `validator.ts`                      | Request parameter validation                                             |
| `perf-monitor.ts`                   | Performance monitoring & logging                                         |
| `fsrs-scheduler.ts`                 | Server-side FSRS scheduling                                              |
| `embedding.ts`                      | Text embedding for RAG                                                   |
| `generation/generation-pipeline.ts` | AI question generation pipeline                                          |
| `orchestration/state-machine.ts`    | Multi-agent state machine                                                |
| `agents/teacher-agent.ts`           | Teacher agent behavior                                                   |
| `agents/student-agent.ts`           | Student agent behavior                                                   |
| `agents/examiner-agent.ts`         | Examiner agent behavior                                                  |
| `agents/agent-types.ts`             | Agent type definitions                                                   |
| `ai-providers/provider-factory.ts`  | Multi-provider AI API rotation                                           |
| `services/agent.service.ts`         | Agent orchestration service                                              |
| `services/fsrs.service.ts`          | FSRS scheduling service                                                  |

---

## Data Flow: User Answers Quiz

```
1. User taps answer in do-quiz.vue
   │
2. ├── Update local question state (Vue reactivity)
   │
3. ├── fsrs-service.scheduleCard(questionId, rating)
   │   └── ts-fsrs calculates next review date
   │       └── storageService.save('fsrs_card_{id}', cardState)
   │
4. ├── studyStore.recordAnswer(isCorrect)
   │   └── Update aggregate metrics (totalQuestions, correctQuestions)
   │
5. ├── gamificationStore.awardXP(XP_REWARDS.CORRECT_ANSWER)
   │   └── Check achievement/streak milestones
   │
6. ├── learningTrajectoryStore.record(ANSWER_QUESTION, data)
   │   └── Append to event stream, update knowledge mastery
   │
7. └── lafService.submitAnswer(questionId, answer, isCorrect)
        └── HTTP POST → answer-submit cloud function
            └── Update practice_records in MongoDB
                └── Update user stats
```

---

## Authentication Flow

```
1. User opens app → App.vue onLaunch()
   │
2. └── userStore.silentLogin()
        │
3.      ├── Check local storage for token + userInfo
        │   ├── Found → Validate token expiry
        │   │   ├── Valid → Set isLogin=true, emit loginStatusChanged
        │   │   └── Expired → Clear storage, remain logged out
        │   └── Not found → Remain logged out (new user)
        │
4. User navigates to protected page
   │
5. └── loginGuard checks isLogin
        ├── Logged in → Allow access
        └── Not logged in → Redirect to /pages/login/index
             │
6.           └── User enters email + verification code
                  │
7.                └── lafService.login({ email, code, platform })
                      │
8.                    └── login.ts cloud function
                          ├── Verify email code
                          ├── Find/create user in MongoDB
                          ├── Generate JWT token
                          └── Return { token, userInfo }
                               │
9.                              └── authStore.setToken(token)
                                    profileStore.setUserInfo(userInfo)
                                    storageService.save('EXAM_TOKEN', token)
```

---

## AI Integration Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Frontend AI Calls                    │
│                                                       │
│  lafService.proxyAI(messages, options)                │
│  lafService.adaptiveQuestionPick(params)              │
│  lafService.deepMistakeAnalysis(mistakes)             │
│  lafService.photoSearch(imageBase64)                  │
│  lafService.aiFriendChat(messages, friendId)          │
└─────────────────────┬────────────────────────────────┘
                      │ HTTP POST
                      ▼
┌──────────────────────────────────────────────────────┐
│              proxy-ai.ts (Backend Hub)                │
│                                                       │
│  1. Authenticate request (requireAuth)                │
│  2. Select AI provider (provider-factory.ts)          │
│     ├── Provider pool: 10+ LLM APIs                  │
│     ├── Rotation strategy: round-robin + fallback     │
│     └── Rate limit awareness per provider             │
│  3. Forward request to selected provider              │
│  4. Handle streaming (SSE) or batch response          │
│  5. Log usage metrics (perf-monitor.ts)               │
│  6. Return response to client                         │
└──────────────────────────────────────────────────────┘
```

### Multi-Agent Classroom Flow

```
agent-orchestrator.ts
  │
  ├── TeacherAgent (teaches concept) ──→ Generate lesson content
  │     └── Uses lesson-generator.ts
  │
  ├── ExaminerAgent (tests understanding) ──→ Generate quiz questions
  │     └── Uses generation-pipeline.ts
  │
  └── StudentAgent (simulates learner) ──→ Provide feedback
        └── State machine tracks: IDLE → TEACHING → EXAMINING → REVIEWING
```

---

## Design System Architecture

```
src/styles/
├── _design-tokens.scss          # 核心 SCSS 变量（通过 vite.config.js additionalData 自动注入）
├── _dark-mode-vars.scss         # 深色模式 CSS 变量覆盖（@mixin dark-mode-vars）
├── _wot-theme.scss              # wot-design-uni 主题覆盖
└── button-animations.scss       # 全局按钮按压动画

src/design/
└── theme-engine.js              # 运行时主题切换（CSS class + CSS vars）

src/App.vue                      # 全局样式：:root CSS 变量、工具类、
                                 # Apple Glass 效果、点击反馈、深色模式过渡
```

### Theme System

- **Dual theme support**: Wise (green/white) and Bitget (dark blue)
- **Dark mode**: CSS custom properties + `prefers-color-scheme` media query + manual `.dark` class
- **Theme engine** (`theme-engine.js`): Runtime switching via `applyTheme()`, `watchTheme()`
- **SCSS tokens** auto-injected into every component via Vite `additionalData`
- **CSS variable cascade**: `:root` defines light mode → `@media (prefers-color-scheme: dark)` overrides → `.dark` class overrides
