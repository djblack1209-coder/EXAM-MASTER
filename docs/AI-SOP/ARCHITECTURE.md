# EXAM-MASTER System Architecture

> Last updated: 2026-03-22 | AI-SOP Version: 1.0

## High-Level Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────┐
│                        CLIENT (uni-app Vue 3)                      │
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  Pages    │  │Components│  │  Stores  │  │Composable│          │
│  │ (36 pgs) │  │ (50+ vue)│  │ (Pinia)  │  │ (hooks)  │          │
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
│  │  │  api/domains/ (6 domain service files)        │     │        │
│  │  │  ai | auth | practice | school | fav | social │     │        │
│  │  └────┬─────────────────────────────────────────┘     │        │
│  │       │  ┌────────────────────────────┐                │        │
│  │       ├──┤ api/core/request.js        │                │        │
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

Pages are organized into a main package (4 tab pages) and 14 subPackages for WeChat MP size optimization:

| Package           | Pages                                                                                                                           | Purpose                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Main              | `index`, `practice`, `school`, `profile`                                                                                        | Tab bar pages (always loaded) |
| `practice-sub`    | `do-quiz`, `pk-battle`, `rank`, `import-data`, `file-manager`, `mock-exam`, `smart-review`, `question-bank`, `diagnosis-report` | Practice features (9 pages)   |
| `login`           | `index`, `wechat-callback`, `qq-callback`                                                                                       | Authentication (3 pages)      |
| `settings`        | `index`, `privacy`, `terms`                                                                                                     | App settings (3 pages)        |
| `school-sub`      | `detail`                                                                                                                        | School detail page            |
| `social`          | `friend-list`, `friend-profile`                                                                                                 | Social features (2 pages)     |
| `chat`            | `chat`                                                                                                                          | AI chat page                  |
| `mistake`         | `index`                                                                                                                         | Mistake book                  |
| `favorite`        | `index`                                                                                                                         | Favorites collection          |
| `plan`            | `index`, `create`                                                                                                               | Study plan (2 pages)          |
| `study-detail`    | `index`                                                                                                                         | Study statistics detail       |
| `tools`           | `photo-search`, `doc-convert`, `id-photo`                                                                                       | Utility tools (3 pages)       |
| `knowledge-graph` | `index`                                                                                                                         | Knowledge graph visualization |
| `ai-classroom`    | `index`, `classroom`                                                                                                            | AI classroom (2 pages)        |
| `onboarding`      | `index`                                                                                                                         | New user guide                |

### Component Architecture

Components are organized into 5 categories:

```
src/components/
├── base/              # Pure UI primitives (no business logic)
│   ├── base-card/     # Generic card container
│   ├── base-empty/    # Empty state display
│   ├── base-icon/     # Icon component
│   ├── base-skeleton/ # Loading skeleton
│   └── school-skeleton/ # School-specific skeleton
├── business/          # Domain-specific components
│   ├── chat/          # ChatBox, MessageActions, ThinkingBlock, MarkdownRenderer, SuggestedReplies, SessionList
│   ├── index/         # DailyGoalRing, StatsGrid, StudyHeatmap, WelcomeBanner, KnowledgeBubbleField, etc.
│   ├── practice/      # PracticeConfigPanel, AchievementModal, SpeedReadyModal, AiGenerationOverlay, etc.
│   ├── knowledge/     # ForceGraph (D3-like force simulation)
│   └── school/        # SchoolSearchInput
├── charts/            # ECharts wrappers
│   ├── StudyTrend.vue
│   ├── ForgettingCurve.vue
│   └── SkillRadar.vue
├── common/            # Shared utility components
│   ├── CustomModal.vue
│   ├── EmptyState.vue
│   ├── TodoList.vue
│   ├── share-modal.vue
│   ├── ResumePracticeModal.vue
│   ├── offline-indicator.vue
│   ├── privacy-popup.vue
│   └── MiniGuide.vue
├── layout/
│   └── custom-tabbar/ # Custom tab bar component
└── SwipeCard.vue      # Swipeable card interaction
```

### Service Layer

```
src/services/
├── api/
│   ├── core/
│   │   └── request.js         # Base request infrastructure (retry, cache, dedup, sign)
│   └── domains/
│       ├── ai.service.js      # Master service (2436 lines): AI, school, auth, favorites, practice, social
│       ├── auth.service.js    # Auth domain (reuses ai.service request infra)
│       ├── practice.service.js # Practice domain
│       ├── school.service.js  # School domain
│       ├── favorite.service.js # Favorites domain
│       └── social.service.js  # Social domain
├── lafService.js              # Facade: merges all domain services into single export
├── fsrs-service.js            # FSRS-5 spaced repetition scheduler (singleton)
├── knowledge-engine.js        # Knowledge graph x FSRS fusion engine
├── storageService.js          # Local storage abstraction (uni.setStorage)
├── streamService.js           # SSE/streaming for AI chat
├── auth-storage.js            # Auth token persistence
├── checkin-streak.js          # Daily check-in streak tracking
├── streak-recovery.js         # Streak recovery logic
├── fsrs-optimizer-client.js   # Client for cloud FSRS parameter optimization
├── offline-cache-service.js   # Offline data caching
├── onboarding-service.js      # New user onboarding flow
└── subscribe-message.js       # WeChat subscription messages
```

### Composables (Vue 3 Hooks)

```
src/composables/
├── useStreamChat.js           # SSE streaming chat integration
├── useQuizAutoSave.js         # Quiz auto-save with debouncing
├── useNavigation.js           # Safe page navigation utilities
├── useTodo.js                 # Todo list CRUD operations
├── useVirtualScroll.js        # Virtual scrolling for long lists
├── usePracticeNavigation.js   # Practice-specific navigation
├── useRecommendations.js      # Learning recommendations engine
├── useLearningStats.js        # Learning statistics computation
├── useLearningStyle.js        # Adaptive learning style detection
├── useChatSessions.js         # Chat session management
├── useKnowledgePoints.js      # Knowledge point UI interactions
├── useChatBox.js              # Chat input/output management
├── useAnimatedNumber.js       # Smooth number transition animations
├── useAIGeneration.js         # AI question generation flow
└── useTheme.js                # Theme switching hook
```

### Store Architecture (Pinia)

```
src/stores/
├── index.js                           # Re-exports all stores
└── modules/
    ├── user.js                        # Facade: composes auth + profile + vip + invite + social
    ├── auth.js                        # Authentication state (token, isLogin, silentLogin)
    ├── profile.js                     # User profile data
    ├── vip.js                         # VIP membership status
    ├── invite.js                      # Invite code & rewards
    ├── study.js                       # Aggregate study metrics (total, correct, days, minutes)
    ├── gamification.js                # XP, streaks, achievements, daily challenges
    ├── theme.js                       # Theme type (wise/bitget) + dark mode
    ├── app.js                         # Device info, network status, navbar
    ├── school.js                      # Target school selection
    ├── todo.js                        # Daily task list
    └── learning-trajectory-store.js   # Fine-grained learning event stream
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
| `agents/examiner-agent.ts`          | Examiner agent behavior                                                  |
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
│  streamService.streamChat(messages, onChunk)          │
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
├── _design-tokens.scss          # Core SCSS variables (auto-injected via vite.config.js additionalData)
├── _dark-mode-vars.scss         # Dark mode CSS variable overrides (@mixin dark-mode-vars)
├── _variables.scss              # Legacy SCSS variables
├── _theme-vars.scss             # Theme variable aliases
├── _wot-theme.scss              # wot-design-uni theme overrides
├── design-system.scss           # Design system v1
├── design-system-v2.scss        # Design system v2
├── design-system-mp.scss        # Mini program specific styles
├── theme-wise.scss              # Wise theme (green + white, default)
├── theme-bitget.scss            # Bitget Wallet theme (dark blue)
├── button-animations.scss       # Global button press animations
└── responsive.scss              # Responsive breakpoints

src/design/
└── theme-engine.js              # Runtime theme switching (CSS class + CSS vars)

src/App.vue                      # Global styles: :root CSS variables, utility classes,
                                 # Apple Glass effects, click feedback, dark mode transitions
```

### Theme System

- **Dual theme support**: Wise (green/white) and Bitget (dark blue)
- **Dark mode**: CSS custom properties + `prefers-color-scheme` media query + manual `.dark` class
- **Theme engine** (`theme-engine.js`): Runtime switching via `applyTheme()`, `watchTheme()`
- **SCSS tokens** auto-injected into every component via Vite `additionalData`
- **CSS variable cascade**: `:root` defines light mode → `@media (prefers-color-scheme: dark)` overrides → `.dark` class overrides
