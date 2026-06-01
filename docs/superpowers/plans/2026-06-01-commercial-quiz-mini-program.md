# Commercial Quiz Mini Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current mini program into a commercially credible public-course quiz product with polished core practice feedback, stable navigation, release-grade question banks, and audit-ready safety.

**Architecture:** Work in front-end-first vertical slices because the user's strongest dissatisfaction is visual and experiential. Each slice must preserve existing data contracts, add focused tests, update the refactor diary, run lint/test/build, and commit only after verification.

**Tech Stack:** uni-app 3, Vue 3, Pinia, SCSS, Vitest, Laf cloud functions, MongoDB, FSRS, local flashcard bank registry.

---

## Phase Order

### Phase 1: Core Practice Feel

**Why first:** This is the product's main commercial surface. Users judge quality within the first few answers.

**Scope:**
- Progress clarity: persistent count, dot rail, visible answered state.
- Immediate feedback: correct/wrong panel, sound, haptic, combo rhythm, completion fanfare.
- Stability: no blank page on next, result, back, restart, or dark/light switch.
- Test target: `tests/unit/session-feedback.spec.js`, `tests/unit/integration-quiz.spec.js`, `tests/unit/quiz-sound.spec.js`.

### Phase 2: Shell And Route Cohesion

**Why second:** Once the practice moment feels good, the three-tab shell must feel like one product.

**Scope:**
- Home, Practice, Profile, Settings visual consistency.
- `safeNavigateTo` for all user-triggered jumps where possible.
- Loading, empty, error, and safe-area states on core pages.
- No visible obsolete school-selection surface.

### Phase 3: Question Bank Commercial Readiness

**Why third:** Polished UI cannot compensate for missing or unreliable content.

**Scope:**
- Release coverage dashboard for public-course banks.
- Import/loaded-bank status that normal users can understand.
- Evidence audit for answer keys, source images, and disabled years.
- Backend/API gap list only after front-end bank flow is stable.

### Phase 4: Account, Security, And Privacy

**Why fourth:** Commercial release requires trust and review compliance.

**Scope:**
- Login, deletion cooling period, privacy/terms route checks.
- Storage keys and sensitive data audit.
- Token/user-id enforcement tests and cloud function smoke checks.

### Phase 5: Monetization-Ready Polish

**Why last:** Subscription or paid features should not be designed before the free core loop is clearly excellent.

**Scope:**
- Achievement/XP model based on real session state.
- Premium bank or analytics surfaces.
- Release notes, screenshots, store-submission checklist.

## Current Execution Slice

### Task 1: Add Session Feedback Domain Utility

**Files:**
- Create: `src/pages/practice-sub/utils/session-feedback.js`
- Create: `tests/unit/session-feedback.spec.js`

- [x] **Step 1: Add pure streak/combo helpers**

Create `calculateCorrectStreak`, `shouldShowCombo`, `getComboLevel`, and `buildComboFeedback`.

- [x] **Step 2: Add focused unit tests**

Run: `npm run test -- tests/unit/session-feedback.spec.js`

Expected: all tests pass.

### Task 2: Connect Combo Feedback To Quiz Page

**Files:**
- Modify: `src/pages/practice-sub/do-quiz.vue`

- [x] **Step 1: Import session feedback helpers**
- [x] **Step 2: Add `comboFeedback` state and timer cleanup**
- [x] **Step 3: Trigger combo feedback only after correct answers**
- [x] **Step 4: Clear feedback on wrong answer, next question, hide, and unload**
- [x] **Step 5: Add restrained floating combo UI in light/dark mode**

### Task 3: Documentation And Verification

**Files:**
- Modify: `docs/frontend-experience-refactor-diary.md`
- Create: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Record planning logic and current slice**
- [x] **Step 2: Run lint**

Run:
```bash
npm run lint -- src/pages/practice-sub/do-quiz.vue src/pages/practice-sub/utils/session-feedback.js tests/unit/session-feedback.spec.js
```

- [x] **Step 3: Run focused tests**

Run:
```bash
npm run test -- tests/unit/session-feedback.spec.js tests/unit/quiz-sound.spec.js tests/unit/integration-quiz.spec.js tests/unit/frontend-copy-guard.spec.js
```

- [x] **Step 4: Build WeChat mini program**

Run:
```bash
npm run build:mp-weixin
```

- [ ] **Step 5: Commit**

Run:
```bash
git add src/pages/practice-sub/do-quiz.vue src/pages/practice-sub/utils/session-feedback.js tests/unit/session-feedback.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: add commercial quiz session feedback"
```
