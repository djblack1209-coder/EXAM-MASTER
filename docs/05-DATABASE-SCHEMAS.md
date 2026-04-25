# Database Schema Summary

> Auto-generated: 2026-03-22
>
> All schemas stored at `laf-backend/database-schema/`
> Database: MongoDB (via Laf Cloud on Sealos)

## Collections Overview

| Collection            | Schema File                       | Description                                                       |
| --------------------- | --------------------------------- | ----------------------------------------------------------------- |
| `users`               | `users.schema.json`               | User accounts, profile, stats, achievements array                 |
| `questions`           | `questions.schema.json`           | Question bank (v2.0 enhanced)                                     |
| `practice_records`    | `practice_records.schema.json`    | Answer history (v2.0 enhanced)                                    |
| `mistake_book`        | `mistake_book.schema.json`        | Error collection with tags (v2.0 enhanced)                        |
| `favorites`           | `favorites.schema.json`           | Question favorites                                                |
| `friends`             | `friends.schema.json`             | Friend relationships (v2.0 enhanced)                              |
| `pk_records`          | `pk_records.schema.json`          | PK battle history and ELO records                                 |
| `study_plans`         | `study_plans.schema.json`         | User study plans and goals                                        |
| `learning_goals`      | `learning_goals.schema.json`      | Daily/weekly/custom learning goals                                |
| `goal_progress`       | `goal_progress.schema.json`       | Daily progress records per goal type                              |
| `learning_progress`   | `learning_progress.schema.json`   | User learning resource progress                                   |
| `learning_resources`  | `learning_resources.schema.json`  | Recommended learning resources                                    |
| `resource_favorites`  | `resource_favorites.schema.json`  | User-favorited learning resources                                 |
| `groups`              | `groups.schema.json`              | Study group basic info                                            |
| `group_members`       | `group_members.schema.json`       | User-group membership                                             |
| `group_resources`     | `group_resources.schema.json`     | Shared resources within groups                                    |
| `achievements`        | `achievements.schema.json`        | Achievement definitions (data stored in users.achievements array) |
| `idempotency_records` | `idempotency_records.schema.json` | Idempotency keys for duplicate request prevention                 |
| schools               | `school-schema.js`                | School data (province, major, score lines)                        |

## Key Collection Details

### users

```
{
  _id: ObjectId,
  email: string,              // Login email
  nickName: string,           // Display name
  avatarUrl: string,          // Avatar URL
  provider: string,           // Auth provider (email, wechat, qq)
  openId: string,             // WeChat/QQ openId
  unionId: string,            // Cross-platform union ID
  passwordHash: string,       // Bcrypt hash (email users)

  // Study stats
  totalQuestions: number,
  correctQuestions: number,
  studyDays: number,
  studyMinutes: number,
  lastStudyDate: Date,
  streakDays: number,

  // Gamification
  xp: number,
  level: number,
  achievements: [{            // Embedded achievement records
    id: string,
    unlockedAt: Date,
    name: string
  }],

  // ELO rating
  eloRating: number,
  pkWins: number,
  pkLosses: number,

  // VIP
  vipLevel: number,
  vipExpiry: Date,

  // Settings
  examType: string,           // Target exam type
  targetSchoolId: string,
  targetMajorId: string,

  createdAt: Date,
  updatedAt: Date
}
```

### questions

```
{
  _id: ObjectId,
  userId: string,             // Owner (user-uploaded questions)
  subject: string,            // Subject category
  chapter: string,            // Chapter/topic
  type: string,               // single, multiple, judge, fill, essay
  question: string,           // Question text (supports HTML/KaTeX)
  options: [string],          // Choice options array
  answer: string | [string],  // Correct answer(s)
  explanation: string,        // Answer explanation
  difficulty: number,         // 1-5 difficulty rating

  // FSRS metadata
  fsrsState: {
    stability: number,
    difficulty: number,
    due: Date,
    state: number             // 0=New, 1=Learning, 2=Review, 3=Relearning
  },

  // Source tracking
  source: string,             // manual, ai, anki, import
  tags: [string],

  createdAt: Date,
  updatedAt: Date
}
```

### practice_records

```
{
  _id: ObjectId,
  userId: string,
  questionId: string,
  answer: string | [string],
  isCorrect: boolean,
  timeSpent: number,          // Seconds
  sessionId: string,          // Practice session ID
  mode: string,               // normal, speed, review, mock, pk

  createdAt: Date
}
```

### mistake_book

```
{
  _id: ObjectId,
  userId: string,
  questionId: string,
  question: string,           // Snapshot of question text
  userAnswer: string,
  correctAnswer: string,
  subject: string,
  chapter: string,
  tags: [string],             // User-defined tags
  errorType: string,          // concept, calculation, careless, unknown
  reviewCount: number,        // Times reviewed
  lastReviewDate: Date,
  isResolved: boolean,        // Marked as understood

  createdAt: Date,
  updatedAt: Date
}
```

### pk_records

```
{
  _id: ObjectId,
  sessionId: string,          // Unique battle session ID
  player1Id: string,
  player2Id: string,
  player1Score: number,
  player2Score: number,
  winnerId: string,
  subject: string,
  questionCount: number,
  questions: [ObjectId],

  // ELO changes
  player1EloChange: number,
  player2EloChange: number,

  duration: number,           // Seconds
  status: string,             // waiting, active, completed, abandoned

  createdAt: Date
}
```

### friends

```
{
  _id: ObjectId,
  userId: string,             // Requester
  friendId: string,           // Target
  status: string,             // pending, accepted, blocked

  // AI friend features
  aiMemory: [{
    role: string,
    content: string,
    timestamp: Date
  }],

  createdAt: Date,
  updatedAt: Date
}
```

### learning_goals

```
{
  _id: ObjectId,
  userId: string,
  type: string,               // daily, weekly, custom
  category: string,           // questions, time, review
  target: number,             // Target value
  current: number,            // Current progress
  isActive: boolean,

  createdAt: Date,
  updatedAt: Date
}
```

### idempotency_records

```
{
  _id: ObjectId,
  key: string,                // Unique idempotency key
  response: Object,           // Cached response
  expiresAt: Date,            // TTL for auto-cleanup

  createdAt: Date
}
```

## Indexes

Key indexes (created via cloud function `db-create-indexes`):

- `users`: `{ email: 1 }` (unique), `{ openId: 1 }`, `{ unionId: 1 }`
- `questions`: `{ userId: 1, subject: 1 }`, `{ "fsrsState.due": 1 }`
- `practice_records`: `{ userId: 1, createdAt: -1 }`, `{ sessionId: 1 }`
- `mistake_book`: `{ userId: 1, isResolved: 1 }`, `{ userId: 1, subject: 1 }`
- `favorites`: `{ userId: 1, questionId: 1 }` (unique compound)
- `friends`: `{ userId: 1, friendId: 1 }` (unique compound)
- `pk_records`: `{ sessionId: 1 }` (unique), `{ player1Id: 1 }`, `{ player2Id: 1 }`
- `idempotency_records`: `{ key: 1 }` (unique), `{ expiresAt: 1 }` (TTL)

## Summary

- **Total collections**: 19
- **Core user data**: users, questions, practice_records, mistake_book, favorites
- **Social**: friends, groups, group_members, group_resources
- **Gamification**: achievements (embedded in users)
- **Study planning**: study_plans, learning_goals, goal_progress, learning_progress
- **Resources**: learning_resources, resource_favorites
- **Battle**: pk_records
- **Infrastructure**: idempotency_records
