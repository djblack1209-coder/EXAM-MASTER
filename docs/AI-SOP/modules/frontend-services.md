# Frontend Services Inventory

> Auto-generated: 2026-03-22 | Last updated: 2026-03-25 (Round 41 全维度审计重构)

## API Layer

### Core Request Infrastructure

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

### Domain Services (Round 41 按领域拆分)

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

### Service Facade

| File          | Path                         | Lines | Purpose                                                             |
| ------------- | ---------------------------- | ----- | ------------------------------------------------------------------- |
| lafService.js | `src/services/lafService.js` | 55    | Facade: merges all 6 domain services + tool APIs into single export |

**Usage pattern:**

```js
import { lafService } from '@/services/lafService.js';
const result = await lafService.proxyAI(messages, options);
const schools = await lafService.getSchoolList(params);
```

---

## Core Services

### FSRS Service

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

### Knowledge Engine

| File                | Path                               | Lines | Purpose                              |
| ------------------- | ---------------------------------- | ----- | ------------------------------------ |
| knowledge-engine.js | `src/services/knowledge-engine.js` | 684   | Knowledge graph x FSRS fusion engine |

**Key exports:**

- `calculateMastery(knowledgePoint)` — Weighted mastery (40% FSRS retrievability + 60% accuracy)
- `getLearningPath(subject)` — Topological sort of knowledge points based on prerequisites
- `getGraphData(subject)` — Nodes/edges data for force-directed graph visualization
- `isPrerequisiteMet(knowledgePoint)` — Check if prerequisites mastered (>70%)

**Prerequisite DAG:** Defines dependencies between 考研 knowledge points (e.g., probability depends on calculus).

### Storage Service

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

### Stream Service

| File             | Path                            | Lines | Purpose                   |
| ---------------- | ------------------------------- | ----- | ------------------------- |
| streamService.js | `src/services/streamService.js` | ~320  | SSE streaming for AI chat |

**Key exports:**

- `streamChat(messages, onChunk, onDone, onError)` — Stream AI response chunks
- `parseSSEChunk(chunk)` — Parse Server-Sent Events format
- `abortStream()` — Cancel ongoing stream

---

## Utility Services

| File                     | Path                                    | Purpose                                                                                             |
| ------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------- |
| toast.js                 | `src/utils/toast.js`                    | **(Round 14)** 中心化 Toast：success/error/info/warning/loading/hide                                |
| auth-storage.js          | `src/services/auth-storage.js`          | Auth token persistence (R18: 修复 `uni.getItem` → `localStorage.getItem`)                           |
| checkin-streak.js        | `src/services/checkin-streak.js`        | Daily check-in streak calculation                                                                   |
| streak-recovery.js       | `src/services/streak-recovery.js`       | Streak recovery (freeze, skip) logic                                                                |
| fsrs-optimizer-client.js | `src/services/fsrs-optimizer-client.js` | Client for cloud FSRS parameter optimization                                                        |
| offline-cache-service.js | `src/services/offline-cache-service.js` | Offline data caching + answer queue + sync; exports `saveOfflineAnswer`, `checkOfflineAvailability` |
| subscribe-message.js     | `src/services/subscribe-message.js`     | WeChat subscription message API                                                                     |

---

## Composables (Vue 3 Hooks)

| File                     | Path                                       | Purpose                                 |
| ------------------------ | ------------------------------------------ | --------------------------------------- |
| useQuizAutoSave.js       | `src/composables/useQuizAutoSave.js`       | Auto-save quiz progress with debouncing |
| useNavigation.js         | `src/composables/useNavigation.js`         | Safe uni-app page navigation            |
| useTodo.js               | `src/composables/useTodo.js`               | Todo list CRUD tied to todo store       |
| usePracticeNavigation.js | `src/composables/usePracticeNavigation.js` | Practice-specific navigation logic      |
| useRecommendations.js    | `src/composables/useRecommendations.js`    | AI-powered learning recommendations     |
| useLearningStyle.js      | `src/composables/useLearningStyle.js`      | Adaptive learning style detection       |
| useTheme.js              | `src/composables/useTheme.js`              | Theme switching reactive hook           |
