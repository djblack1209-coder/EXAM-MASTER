# Backend Memory Engine & Multi-Agent Moat Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the ultimate competitive moat by migrating `ts-fsrs` memory scheduling and `ai-agent-team` orchestration entirely to the Laf Backend. This transforms the app from a simple CRUD client into an Intelligent Learning Engine.

**Architecture:** Use `laf-backend/functions/_shared/services/` to abstract the logic away from raw HTTP handler functions. Create a dedicated `FsrsService` and `AgentService` to process submitted answers and orchestrate AI Tutor responses.

**Tech Stack:** Node.js 18+ / TS, `ts-fsrs`, `ai-agent-team`, Laf Cloud DB

---

### Task 1: Add Backend Dependencies

**Files:**
- Modify: `laf-backend/package.json`

- [ ] **Step 1: Install packages**
```bash
cd laf-backend
npm install ts-fsrs ai-agent-team
cd ..
```

- [ ] **Step 2: Commit**
```bash
git add laf-backend/package.json laf-backend/package-lock.json
git commit -m "chore(backend): install ts-fsrs and ai-agent-team to establish moat"
```

### Task 2: Build the Core FSRS Service

**Files:**
- Create: `laf-backend/functions/_shared/services/fsrs.service.ts`

- [ ] **Step 1: Write the FSRS logic**
```typescript
import { fsrs, generatorParameters, createEmptyCard, Rating, State, type RecordLog } from 'ts-fsrs';
import cloud from '@lafjs/cloud';

const db = cloud.database();

export class FsrsService {
  private f = fsrs(generatorParameters({ maximum_interval: 36500 }));

  /**
   * Process an answer and update its memory state in DB.
   * @param userId The user's ID
   * @param questionId The question ID
   * @param grade FSRS Grade (1: Again, 2: Hard, 3: Good, 4: Easy)
   */
  async processAnswer(userId: string, questionId: string, grade: number) {
    const reviewLogCol = db.collection('review_logs');
    
    // Find existing card state for user+question
    const existingLog = await reviewLogCol
      .where({ user_id: userId, question_id: questionId })
      .orderBy('review', 'desc')
      .get();
      
    let card = createEmptyCard();
    if (existingLog.data && existingLog.data.length > 0) {
      const latest = existingLog.data[0];
      card = {
        due: latest.card.due,
        stability: latest.card.stability,
        difficulty: latest.card.difficulty,
        elapsed_days: latest.card.elapsed_days,
        scheduled_days: latest.card.scheduled_days,
        reps: latest.card.reps,
        lapses: latest.card.lapses,
        state: latest.card.state as State,
        last_review: latest.card.last_review
      };
    }
    
    const now = new Date();
    const scheduledInfo = this.f.repeat(card, now);
    let recordLog: RecordLog;
    
    // Match TS-FSRS Rating Enum
    switch(grade) {
      case 1: recordLog = scheduledInfo[Rating.Again]; break;
      case 2: recordLog = scheduledInfo[Rating.Hard]; break;
      case 3: recordLog = scheduledInfo[Rating.Good]; break;
      case 4: recordLog = scheduledInfo[Rating.Easy]; break;
      default: recordLog = scheduledInfo[Rating.Good];
    }
    
    // Store in DB
    const newLogEntry = {
      user_id: userId,
      question_id: questionId,
      card: recordLog.card,
      log: recordLog.log,
      review: now,
      grade
    };
    
    await reviewLogCol.add(newLogEntry);
    
    return newLogEntry;
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add laf-backend/functions/_shared/services/fsrs.service.ts
git commit -m "feat(backend): implement FsrsService for true memory moat"
```

### Task 3: Build the Agent Tutor Service

**Files:**
- Create: `laf-backend/functions/_shared/services/agent.service.ts`

- [ ] **Step 1: Write the multi-agent tutor logic**
```typescript
import { Agent, Team } from 'ai-agent-team';

export class AgentService {
  /**
   * Provide dynamic feedback for a wrong answer
   */
  async provideTutorFeedback(questionContent: string, userAnswer: string, correctAnswer: string) {
    // In a real env, configure the LLM provider inside ai-agent-team.
    // For our moat, we construct a tutor persona to gently guide the student.
    const tutorAgent = new Agent({
      name: "Tutor",
      role: "A gentle and Socratic post-grad tutor",
      goal: "Analyze the student's mistake and provide a hint or concise explanation.",
      background: "You are an expert at breaking down complex exam concepts without giving away the answer immediately.",
    });

    const team = new Team({
      agents: [tutorAgent],
      tasks: [{
        description: `The student answered "${userAnswer}" to the question "${questionContent}". The correct answer is "${correctAnswer}". Briefly explain why the student might have made this mistake and what the core concept is. Keep it under 50 words.`,
        expectedOutput: "A short, encouraging explanation."
      }]
    });

    try {
      const result = await team.start();
      return result;
    } catch (e) {
      console.error("Agent failed", e);
      return "这道题有点难度，再复习一下核心考点吧！";
    }
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add laf-backend/functions/_shared/services/agent.service.ts
git commit -m "feat(backend): implement multi-agent Tutor Service"
```

### Task 4: Integrate into Answer Submit Endpoint

**Files:**
- Modify: `laf-backend/functions/answer-submit.ts`

- [ ] **Step 1: Connect `answer-submit.ts` to `FsrsService` and `AgentService`**
Update `laf-backend/functions/answer-submit.ts`. Import the services:
`import { FsrsService } from './_shared/services/fsrs.service';`
`import { AgentService } from './_shared/services/agent.service';`

Instead of raw DB inserts inside the handler or relying on frontend FSRS:
```typescript
// ... inside the handleAnswer method ...
const fsrsService = new FsrsService();
const agentService = new AgentService();

// Calculate Grade based on correctness and time (simplified for integration)
const grade = isCorrect ? 3 : 1; 

// Run FSRS scheduling
const memoryState = await fsrsService.processAnswer(userId, questionId, grade);

let tutorFeedback = null;
if (!isCorrect) {
  // Launch the Agent Team if wrong
  tutorFeedback = await agentService.provideTutorFeedback(
    "Sample Question", // In real implementation, pull from DB
    userAnswer,
    "Correct Answer"
  );
}

return {
  code: 0,
  data: {
    isCorrect,
    memoryState,
    tutorFeedback
  }
};
```

- [ ] **Step 2: Commit**
```bash
git add laf-backend/functions/answer-submit.ts
git commit -m "feat(backend): integrate moat services into answer-submit"
```
