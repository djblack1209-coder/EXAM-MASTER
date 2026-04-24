# Frontend Stores Inventory

> Auto-generated: 2026-03-22
>
> All stores use Pinia `defineStore()` with setup function syntax (Composition API).
> Entry point: `src/stores/index.js` re-exports all stores.

## Store Architecture

The user store is a **facade pattern** that composes 4 sub-stores:

```
useUserStore (facade)
├── useAuthStore      → token, isLogin, login(), logout(), silentLogin()
├── useProfileStore   → userInfo, planProgress, updateProfile()
├── useVipStore       → vipStatus, vipLevel, isVip, vipDaysLeft
└── useInviteStore    → inviteCode, inviteCount, inviteRewards
```

---

## Store Modules

### useUserStore (Facade)

| Property | Path                                                                        | Purpose                                         |
| -------- | --------------------------------------------------------------------------- | ----------------------------------------------- |
| File     | `src/stores/modules/user.js`                                                | Composes auth + profile + vip + invite + social |
| State    | `token`, `isLogin`, `userInfo`, `vipStatus`, `inviteCode`, `friendsList`    | Unified access                                  |
| Actions  | `login()`, `logout()`, `silentLogin()`, `fetchFriends()`, `updateProfile()` | Delegates to sub-stores                         |

### useAuthStore

| Property | Path                                                               | Purpose                  |
| -------- | ------------------------------------------------------------------ | ------------------------ |
| File     | `src/stores/modules/auth.js`                                       | Authentication state     |
| State    | `token` (ref), `isLogin` (computed)                                | JWT token & login status |
| Actions  | `setToken()`, `clearToken()`, `syncLoginStatus()`, `silentLogin()` | Token management         |

### useProfileStore

| Property | Path                                                    | Purpose                     |
| -------- | ------------------------------------------------------- | --------------------------- |
| File     | `src/stores/modules/profile.js`                         | User profile data           |
| State    | `userInfo` (ref), `planProgress` (ref)                  | Profile & learning progress |
| Actions  | `setUserInfo()`, `updateProfile()`, `loadFromStorage()` | Profile management          |

### useVipStore (已移除)

> VIP 功能已整体移除。相关状态已合并到 useUserStore facade 中，独立的 vip.js 文件已删除。

### useInviteStore

| Property | Path                                         | Purpose                  |
| -------- | -------------------------------------------- | ------------------------ |
| File     | `src/stores/modules/invite.js`               | Invite & referral system |
| State    | `inviteCode`, `inviteCount`, `inviteRewards` | Invite tracking          |
| Computed | `totalInviteRewards`                         | Sum of rewards           |

### useStudyStore

| Property    | Path                                                                                                                                                 | Purpose                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| File        | `src/stores/modules/study.js`                                                                                                                        | Aggregate study metrics |
| State       | `studyProgress` (totalQuestions, completedQuestions, correctQuestions, studyDays, studyMinutes, lastStudyDate), `currentQuestion`, `questionHistory` | Learning metrics        |
| Computed    | `completionRate`, `accuracyRate`                                                                                                                     | Derived metrics         |
| Actions     | `recordAnswer()`, `loadProgress()`, `saveProgress()`, `resetProgress()`                                                                              | Metric updates          |
| Persistence | Via `storageService`, key configured in `APP_CONFIG`                                                                                                 | Local storage           |

### useGamificationStore

| Property    | Path                                                                                             | Purpose                   |
| ----------- | ------------------------------------------------------------------------------------------------ | ------------------------- |
| File        | `src/stores/modules/gamification.js`                                                             | XP, streaks, achievements |
| State       | `xp`, `level`, `streakDays`, `achievements`, `dailyChallenges`                                   | Gamification data         |
| Constants   | `XP_REWARDS` (CORRECT_ANSWER: 10, STREAK_BONUS: 5, PERFECT_SCORE: 50, FIRST_PRACTICE: 20)        | XP values                 |
| Constants   | `STREAK_MILESTONES` [3, 7, 14, 30, 60, 100, 365]                                                 | Streak milestones         |
| Constants   | `ACHIEVEMENT_DEFS` (first_blood, streak_3/7/14/30, etc.)                                         | Achievement definitions   |
| Actions     | `awardXP()`, `recordCorrectAnswer()`, `recordMistake()`, `checkAchievements()`, `updateStreak()` | Gamification logic        |
| Persistence | Key: `gamification_state`                                                                        | Local storage             |

### useThemeStore

| Property | Path                                                                       | Purpose             |
| -------- | -------------------------------------------------------------------------- | ------------------- |
| File     | `src/stores/modules/theme.js`                                              | Theme management    |
| State    | `themeType` ('wise' or 'bitget'), `isDark` (boolean)                       | Theme settings      |
| Actions  | `setThemeType()`, `setDarkMode()`, `initFromStorage()`, `getThemeTokens()` | Theme switching     |
| Events   | Emits `themeTypeUpdate` via uni.$emit                                      | Global notification |

### useAppStore (已移除)

> App 运行时上下文 store 已移除。系统信息和网络状态现由各 composable 局部管理。

### useSchoolStore

| Property    | Path                                                           | Purpose                            |
| ----------- | -------------------------------------------------------------- | ---------------------------------- |
| File        | `src/stores/modules/school.js`                                 | School selection                   |
| State       | `info` (ref: Object)                                           | Selected school/major/target score |
| Computed    | `hasPlan` (boolean)                                            | Whether user has set school target |
| Actions     | `setInfo()`, `loadFromStorage()`, `saveToStorage()`, `clear()` | School selection management        |
| Persistence | Key: `school_selection_info`                                   | Local storage                      |

### useTodoStore

| Property    | Path                                                                         | Purpose               |
| ----------- | ---------------------------------------------------------------------------- | --------------------- |
| File        | `src/stores/modules/todo.js`                                                 | Daily task management |
| State       | `tasks` (array of {id, title, done, priority, tag, tagColor})                | Task list             |
| Actions     | `addTask()`, `removeTask()`, `toggleTask()`, `reorderTasks()`, `loadTasks()` | CRUD operations       |
| Persistence | Key: `my_tasks`                                                              | Local storage         |
| Default     | Creates 3 default tasks on first load                                        | Pre-seeded content    |

### useLearningTrajectoryStore

| Property    | Path                                                                                              | Purpose                      |
| ----------- | ------------------------------------------------------------------------------------------------- | ---------------------------- |
| File        | `src/stores/modules/learning-trajectory-store.js`                                                 | Fine-grained learning events |
| State       | `trajectory` (event array), `knowledgeMastery` (per-point scores), `sessions` (learning sessions) | Event stream                 |
| Event Types | `BUBBLE_CLICK`, `ANSWER_QUESTION`, `REVIEW_CARD`, `START_SESSION`, `END_SESSION`                  | Trajectory events            |
| Actions     | `addTrajectory()`, `updateMastery()`, `startSession()`, `endSession()`, `getStats()`              | Event recording              |
| Persistence | Keys: `learning_trajectory`, `knowledge_mastery`, `learning_sessions`                             | Local storage                |

---

## Store Dependencies

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

## Summary

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
