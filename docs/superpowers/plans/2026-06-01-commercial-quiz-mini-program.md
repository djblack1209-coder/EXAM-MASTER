# Commercial Quiz Mini Program Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current mini program into a commercially credible public-course quiz product with polished core practice feedback, stable navigation, release-grade question banks, and audit-ready safety.

**Architecture:** Work in front-end-first vertical slices because the user's strongest dissatisfaction is visual and experiential. Each slice must preserve existing data contracts, add focused tests, update the refactor diary, run lint/test/build, and commit only after verification.

**Tech Stack:** uni-app 3, Vue 3, Pinia, SCSS, Vitest, Laf cloud functions, MongoDB, FSRS, local flashcard bank registry.

---

## Phase Order

## Mini Program Product Boundary

The mini program is the lightweight commercial version, not the full future product. It should keep the polished visual system and the core useful functions, while deferring heavy or unclear surfaces until the mini program is production-ready.

**Keep in mini program:**
- public-course question banks;
- quiz session, progress, sound, haptic, combo feedback, and result review;
- wrong-question review and FSRS memory loop;
- profile, settings, login, privacy, account deletion, and storage safety;
- release-quality question-bank evidence and build checks.

**Defer from mini program for now:**
- professional-course index and school/major discovery surfaces;
- social, invite, friend, PK, leaderboard, and poster-growth surfaces;
- paid AI tutor or complex agent chat;
- monetization UI before the free core loop is production-grade.

**Platform rule:** Start iOS and Android only after the mini program has production-grade core flow, release evidence, security/privacy checks, and store-review materials.

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
- Route/build scope guard so deferred heavy-product surfaces cannot re-enter the registered mini program shell unnoticed.

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

- [x] **Step 5: Commit**

Run:
```bash
git add src/pages/practice-sub/do-quiz.vue src/pages/practice-sub/utils/session-feedback.js tests/unit/session-feedback.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: add commercial quiz session feedback"
```

### Task 4: Guard Lightweight Mini Program Scope

**Files:**
- Modify: `src/pages.json`
- Create: `tests/unit/mini-program-scope-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Remove deferred route registration**

Remove `pages/practice-sub/professional-index` from the WeChat mini program route registry while keeping the historical file available for later product phases.

- [x] **Step 2: Add route and public-copy guard**

Assert that registered mini program routes do not include deferred professional-course, school-selection, social, PK/ranking, invite/poster, or AI tutor surfaces.

- [x] **Step 3: Run focused validation**

Run:
```bash
npm run lint -- tests/unit/mini-program-scope-guard.spec.js
npm run test -- tests/unit/mini-program-scope-guard.spec.js tests/unit/frontend-copy-guard.spec.js tests/unit/practice-dynamic-methods.spec.js tests/unit/session-feedback.spec.js tests/unit/integration-quiz.spec.js
npm run build:mp-weixin
```

Result: passed on 2026-06-01.

- [x] **Step 4: Commit**

Run:
```bash
git add src/pages.json tests/unit/mini-program-scope-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: guard lightweight mini program scope"
```

### Task 5: Standardize Core Shell Navigation

**Files:**
- Modify: `src/pages/index/index.vue`
- Modify: `src/pages/profile/index.vue`
- Modify: `src/pages/settings/index.vue`
- Create: `tests/unit/shell-navigation-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Route core shell jumps through safe navigation**

Home, Profile, and Settings should call `safeNavigateTo`/`safeNavigateBack` for user-triggered route changes instead of owning direct `uni.navigateTo` or `uni.switchTab` fallback branches.

- [x] **Step 2: Add shell navigation guard**

Assert that Home, Practice, Profile, and Settings do not directly call `uni.navigateTo`, `uni.switchTab`, `uni.redirectTo`, or `uni.reLaunch`.

- [x] **Step 3: Run focused validation**

Run:
```bash
npm run lint -- src/pages/index/index.vue src/pages/profile/index.vue src/pages/settings/index.vue tests/unit/shell-navigation-guard.spec.js
npm run test -- tests/unit/shell-navigation-guard.spec.js tests/unit/mini-program-scope-guard.spec.js tests/unit/frontend-copy-guard.spec.js tests/unit/practice-dynamic-methods.spec.js tests/unit/integration-storage-nav.spec.js
npm run build:mp-weixin
```

Result: passed on 2026-06-01.

- [x] **Step 4: Commit**

Run:
```bash
git add src/pages/index/index.vue src/pages/profile/index.vue src/pages/settings/index.vue tests/unit/shell-navigation-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: standardize core shell navigation"
```

### Task 6: Guard Core Shell Page States

**Files:**
- Modify: `src/pages/index/index.vue`
- Create: `tests/unit/core-shell-state-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add Home loading/error/retry surface**

Home should keep its hero usable while surfacing data sync and load-failure states above the first viewport.

- [x] **Step 2: Add core shell state guard**

Assert that Home, Practice, Profile, and Settings keep explicit loading, empty, login/error, and bottom safe-area affordances.

- [x] **Step 3: Run focused validation**

Run:
```bash
npm run lint -- src/pages/index/index.vue tests/unit/core-shell-state-guard.spec.js
npm run test -- tests/unit/core-shell-state-guard.spec.js tests/unit/shell-navigation-guard.spec.js tests/unit/mini-program-scope-guard.spec.js tests/unit/frontend-copy-guard.spec.js tests/unit/practice-dynamic-methods.spec.js
npm run build:mp-weixin
```

Result: passed on 2026-06-01.

- [x] **Step 4: Commit**

Run:
```bash
git add src/pages/index/index.vue tests/unit/core-shell-state-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: guard core shell page states"
```

### Task 7: Guard Core Shell Theme Synchronization

**Files:**
- Modify: `src/pages/index/index.vue`
- Modify: `src/pages/practice/index.vue`
- Modify: `src/pages/profile/index.vue`
- Create: `tests/unit/core-shell-theme-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Normalize theme event listeners**

Home, Practice, and Profile should listen to both `themeUpdate` and `updateTheme`, then unsubscribe from both on unload.

- [x] **Step 2: Add dark-mode shell guard**

Assert that Home, Practice, Profile, and Settings keep dark-mode root binding, theme event wiring, and key dark surface CSS.

- [x] **Step 3: Run focused validation**

Run:
```bash
npm run lint -- src/pages/index/index.vue src/pages/practice/index.vue src/pages/profile/index.vue tests/unit/core-shell-theme-guard.spec.js
npm run test -- tests/unit/core-shell-theme-guard.spec.js tests/unit/core-shell-state-guard.spec.js tests/unit/shell-navigation-guard.spec.js tests/unit/mini-program-scope-guard.spec.js tests/unit/theme.spec.js tests/unit/theme-store.spec.js
npm run build:mp-weixin
```

Result: passed on 2026-06-01.

- [x] **Step 4: Commit**

Run:
```bash
git add src/pages/index/index.vue src/pages/practice/index.vue src/pages/profile/index.vue tests/unit/core-shell-theme-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: guard core shell theme sync"
```

### Task 8: Guard Core Shell Visual Language

**Files:**
- Modify: `src/pages/practice/index.vue`
- Create: `tests/unit/core-shell-visual-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Align Practice shell materials**

Practice should use the shared mobile canvas, topbar, deep hero panel, glass cards, pressable controls, and primary action treatment instead of drifting into a separate black/white card language.

- [x] **Step 2: Add visual language guard**

Assert that core shell pages retain shared shell primitives, press feedback, and tabbar safe-area spacing.

- [x] **Step 3: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice/index.vue tests/unit/core-shell-visual-guard.spec.js
npm run test -- tests/unit/core-shell-visual-guard.spec.js tests/unit/core-shell-theme-guard.spec.js tests/unit/core-shell-state-guard.spec.js tests/unit/shell-navigation-guard.spec.js tests/unit/mini-program-scope-guard.spec.js
npm run build:mp-weixin
```

Result: passed on 2026-06-01.

- [x] **Step 4: Commit**

Run:
```bash
git add src/pages/practice/index.vue tests/unit/core-shell-visual-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: guard core shell visual language"
```

### Task 9: Guard Quiz Session Navigation

**Files:**
- Modify: `src/utils/safe-navigate.js`
- Modify: `src/pages/practice-sub/do-quiz.vue`
- Modify: `tests/unit/real-utils.spec.js`
- Create: `tests/unit/do-quiz-navigation-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add safe redirect helper**

Create `safeRedirectTo` for flows that must replace the current quiz page while keeping fallback behavior.

- [x] **Step 2: Remove direct quiz route calls**

Replace direct `uni.redirectTo` and `uni.navigateTo` calls in `do-quiz` result/diagnosis actions with safe navigation helpers.

- [x] **Step 3: Add quiz navigation guard**

Assert that `do-quiz.vue` does not directly call `uni.navigateTo`, `uni.switchTab`, `uni.redirectTo`, or `uni.reLaunch`.

- [x] **Step 4: Run focused validation**

Run:
```bash
npm run lint -- src/utils/safe-navigate.js src/pages/practice-sub/do-quiz.vue tests/unit/do-quiz-navigation-guard.spec.js tests/unit/real-utils.spec.js
npm run test -- tests/unit/do-quiz-navigation-guard.spec.js tests/unit/real-utils.spec.js tests/unit/integration-storage-nav.spec.js tests/unit/integration-quiz.spec.js tests/unit/session-feedback.spec.js
npm run build:mp-weixin
```

Result: passed on 2026-06-01.

- [x] **Step 5: Commit**

Run:
```bash
git add src/utils/safe-navigate.js src/pages/practice-sub/do-quiz.vue tests/unit/real-utils.spec.js tests/unit/do-quiz-navigation-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: guard quiz session navigation"
```

### Task 10: Clarify Quiz Result Next Action

**Files:**
- Modify: `src/pages/practice-sub/do-quiz.vue`
- Create: `tests/unit/do-quiz-result-surface-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Separate backdrop from progression**

The result backdrop should intercept background taps without calling `closeResult`, so an accidental outside tap cannot advance the quiz.

- [x] **Step 2: Promote next/continue into a bottom primary action**

The result surface should use a status header, scrollable content body, and dedicated bottom action row. The `e2e-quiz-next-btn` contract remains on the deliberate primary action.

- [x] **Step 3: Add result-surface guard**

Assert that the backdrop does not call `closeResult`, the bottom action row remains present, the result body is scrollable, and safe-area/disabled-state contracts remain in place.

- [x] **Step 4: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/do-quiz.vue tests/unit/do-quiz-result-surface-guard.spec.js
npm run test -- tests/unit/do-quiz-result-surface-guard.spec.js tests/unit/do-quiz-feedback-ui.spec.js tests/unit/do-quiz-navigation-guard.spec.js tests/unit/integration-quiz.spec.js tests/unit/session-feedback.spec.js
npm run build:mp-weixin
```

Result: passed on 2026-06-01.

- [x] **Step 5: Commit**

Run:
```bash
git add src/pages/practice-sub/do-quiz.vue tests/unit/do-quiz-result-surface-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: clarify quiz result next action"
```

### Task 11: Guard Answer Confirmation Motion

**Files:**
- Modify: `src/pages/practice-sub/do-quiz.vue`
- Create: `tests/unit/do-quiz-answer-motion-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Audit answer feedback chain**

Confirm that correct/wrong answer events still call the unified quiz feedback sound channel and still set visual feedback classes.

- [x] **Step 2: Reconnect card motion**

Attach `quiz-correct-animation` and `quiz-wrong-animation` to the existing answer motion vocabulary instead of leaving them as `animation: none` no-ops.

- [x] **Step 3: Add answer-motion guard**

Assert that correct/wrong feedback keeps sound routing, animation class assignment, and active visual motion.

- [x] **Step 4: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/do-quiz.vue tests/unit/do-quiz-answer-motion-guard.spec.js
npm run test -- tests/unit/do-quiz-answer-motion-guard.spec.js tests/unit/do-quiz-feedback-ui.spec.js tests/unit/do-quiz-result-surface-guard.spec.js tests/unit/session-feedback.spec.js tests/unit/quiz-sound.spec.js
npm run build:mp-weixin
```

Result: passed on 2026-06-01.

- [x] **Step 5: Commit**

Run:
```bash
git add src/pages/practice-sub/do-quiz.vue tests/unit/do-quiz-answer-motion-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "fix: restore quiz answer motion feedback"
```

### Task 12: Clarify Quiz Session Progress

**Files:**
- Modify: `src/pages/practice-sub/components/quiz-progress/quiz-progress.vue`
- Create: `tests/unit/quiz-progress-experience-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Upgrade progress hierarchy**

Add a percent label, moving progress thumb, clearer current-question label, and compact session state copy.

- [x] **Step 2: Preserve answer distribution**

Show correct/wrong counts when mistakes exist, keep remaining count when clean, and treat neutral flashcard review records as reviewed rather than wrong.

- [x] **Step 3: Add progress experience guard**

Assert that percent, thumb motion, answer distribution, safe totals, accessibility copy, and dark-mode progress details remain in place.

- [x] **Step 4: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/components/quiz-progress/quiz-progress.vue tests/unit/quiz-progress-experience-guard.spec.js
npm run test -- tests/unit/quiz-progress-experience-guard.spec.js tests/unit/quiz-session-contract.spec.js tests/unit/do-quiz-answer-motion-guard.spec.js tests/unit/session-feedback.spec.js
npm run build:mp-weixin
```

Result: passed on 2026-06-01.

- [x] **Step 5: Commit**

Run:
```bash
git add src/pages/practice-sub/components/quiz-progress/quiz-progress.vue tests/unit/quiz-progress-experience-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: clarify quiz session progress"
```

### Task 13: Clarify Answer Sheet Review Surface

**Files:**
- Modify: `src/pages/practice-sub/components/answer-sheet/answer-sheet.vue`
- Create: `tests/unit/answer-sheet-experience-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Clean safe residual tool processes**

Terminate duplicate local Codex tool services and stale local web service processes without killing the Codex parent app.

- [x] **Step 2: Upgrade answer-sheet review state**

Show correct, wrong, reviewed, remaining, and unanswered states in the summary/grid/legend.

- [x] **Step 3: Preserve neutral flashcard semantics**

Treat neutral flashcard records as reviewed, not wrong, and calculate accuracy only from graded correct/wrong records.

- [x] **Step 4: Add answer-sheet guard**

Assert that review summary, neutral semantics, reviewed grid/legend state, and dark-mode coverage remain in place.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/components/answer-sheet/answer-sheet.vue tests/unit/answer-sheet-experience-guard.spec.js
npm run test -- tests/unit/answer-sheet-experience-guard.spec.js tests/unit/quiz-progress-experience-guard.spec.js tests/unit/quiz-session-contract.spec.js
```

Result: passed on 2026-06-01. Full WeChat build intentionally deferred because `ANECompilerService` was consuming sustained high CPU and macOS denied termination.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/practice-sub/components/answer-sheet/answer-sheet.vue tests/unit/answer-sheet-experience-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: clarify answer sheet review state"
```

### Task 14: Guard Answer Sheet Jump Flow

**Files:**
- Modify: `src/pages/practice-sub/do-quiz.vue`
- Modify: `src/pages/practice-sub/components/answer-sheet/answer-sheet.vue`
- Create: `tests/unit/answer-sheet-jump-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Lock jumps during feedback**

Pass a lock flag to the answer sheet while result feedback, AI analysis, or navigation is active.

- [x] **Step 2: Guard parent jump handler**

Prevent locked, invalid, and current-index jumps from resetting quiz state.

- [x] **Step 3: Show locked surface state**

Keep the answer sheet inspectable, but show a compact lock notice and dim non-current cells while jumps are disabled.

- [x] **Step 4: Add jump guard**

Assert that answer-sheet jumps cannot bypass result feedback or active navigation states.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/do-quiz.vue src/pages/practice-sub/components/answer-sheet/answer-sheet.vue tests/unit/answer-sheet-jump-guard.spec.js tests/unit/answer-sheet-experience-guard.spec.js
npm run test -- tests/unit/answer-sheet-jump-guard.spec.js tests/unit/answer-sheet-experience-guard.spec.js tests/unit/do-quiz-result-surface-guard.spec.js tests/unit/integration-quiz.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/practice-sub/do-quiz.vue src/pages/practice-sub/components/answer-sheet/answer-sheet.vue tests/unit/answer-sheet-jump-guard.spec.js tests/unit/answer-sheet-experience-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "fix: guard answer sheet jumps during feedback"
```

### Task 15: Clarify Result Assist Actions

**Files:**
- Modify: `src/pages/practice-sub/do-quiz.vue`
- Create: `tests/unit/do-quiz-result-assist-actions-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Move secondary actions into result feedback**

Add a compact result-surface assist row for notes, favorite state, and answer-sheet inspection, positioned above the primary next/continue action.

- [x] **Step 2: Lock background question actions**

Keep background note/favorite buttons visible but locked while result feedback, AI analysis, or navigation transition is active.

- [x] **Step 3: Preserve intentional result overlays**

Allow only result-surface note/favorite actions to bypass the feedback lock, and keep answer-sheet opening inspectable with locked jumps.

- [x] **Step 4: Clean note tag visual chips**

Replace stored note tag icon text with compact color dots so the modal avoids emoji-like visual noise.

- [x] **Step 5: Add result assist guard**

Assert that the result assist row, background action lock, result bypass methods, and note-tag cleanup remain in place.

- [x] **Step 6: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/do-quiz.vue tests/unit/do-quiz-result-assist-actions-guard.spec.js
npm run test -- tests/unit/do-quiz-result-assist-actions-guard.spec.js tests/unit/do-quiz-result-surface-guard.spec.js tests/unit/answer-sheet-jump-guard.spec.js tests/unit/integration-quiz.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 7: Commit**

Run:
```bash
git add src/pages/practice-sub/do-quiz.vue tests/unit/do-quiz-result-assist-actions-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: clarify quiz result assist actions"
```

### Task 16: Align Quiz Result Progress Semantics

**Files:**
- Modify: `src/pages/practice-sub/components/quiz-result/quiz-result.vue`
- Create: `tests/unit/quiz-result-progress-semantics-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Reuse shared progress summary**

Make the full-screen quiz report consume `summarizeQuizProgress` instead of recalculating correct/wrong/accuracy locally.

- [x] **Step 2: Preserve neutral review semantics**

Count neutral flashcard/review records as completed/reviewed, not wrong, and keep them out of the accuracy denominator.

- [x] **Step 3: Fix category accuracy**

Calculate category accuracy from graded records only and show a reviewed state for review-only categories.

- [x] **Step 4: Add semantics guard**

Assert that the quiz report cannot return to `total - correct = wrong` math and keeps reviewed display coverage.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/components/quiz-result/quiz-result.vue tests/unit/quiz-result-progress-semantics-guard.spec.js
npm run test -- tests/unit/quiz-result-progress-semantics-guard.spec.js tests/unit/quiz-session-contract.spec.js tests/unit/knowledge-link-flow.spec.js tests/unit/integration-quiz.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/practice-sub/components/quiz-result/quiz-result.vue tests/unit/quiz-result-progress-semantics-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "fix: align quiz result progress semantics"
```

### Task 17: Stabilize Quiz Result Action Dock

**Files:**
- Modify: `src/pages/practice-sub/components/quiz-result/quiz-result.vue`
- Create: `tests/unit/quiz-result-action-dock-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Move completion actions out of scroll content**

Place the final report actions in a stable bottom dock so long reports cannot push primary actions off-screen.

- [x] **Step 2: Add safe-area and dark-mode coverage**

Give the action dock bottom safe-area padding, a top divider, shadow separation, and dark-mode surfaces.

- [x] **Step 3: Align action visual hierarchy**

Replace the older blue raised button treatment with the green/blue financial-app accent and restrained secondary/tertiary actions.

- [x] **Step 4: Add action dock guard**

Assert that completion actions remain outside the scroll view and the old blue raised button style does not return.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/components/quiz-result/quiz-result.vue tests/unit/quiz-result-action-dock-guard.spec.js tests/unit/quiz-result-progress-semantics-guard.spec.js
npm run test -- tests/unit/quiz-result-action-dock-guard.spec.js tests/unit/quiz-result-progress-semantics-guard.spec.js tests/unit/knowledge-link-flow.spec.js tests/unit/integration-quiz.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/practice-sub/components/quiz-result/quiz-result.vue tests/unit/quiz-result-action-dock-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: stabilize quiz result action dock"
```

### Task 18: Surface Practice Bank Readiness

**Files:**
- Modify: `src/pages/practice/index.vue`
- Create: `tests/unit/practice-readiness-card-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add user-facing readiness card**

Show official playable coverage, organizing slots, missing slots, and selected-track readiness in the Practice shell.

- [x] **Step 2: Reuse neutral coverage contract**

Use `buildPublicCourseCoverage` for readiness data while keeping backend release/audit wording out of the UI.

- [x] **Step 3: Match shell visual system**

Style the card with the current green/white light-mode and blue/grey dark-mode financial shell.

- [x] **Step 4: Add readiness guard**

Assert that the Practice page keeps readiness metrics, neutral coverage wiring, and no release-gate copy leaks.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice/index.vue tests/unit/practice-readiness-card-guard.spec.js
npm run test -- tests/unit/practice-readiness-card-guard.spec.js tests/unit/practice-release-guard.spec.js tests/unit/core-shell-visual-guard.spec.js tests/unit/core-shell-state-guard.spec.js tests/unit/mini-program-scope-guard.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/practice/index.vue tests/unit/practice-readiness-card-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: surface practice bank readiness"
```

### Task 19: Clarify Question Bank Slot Readiness

**Files:**
- Modify: `src/pages/practice-sub/question-bank.vue`
- Create: `tests/unit/question-bank-slot-readiness-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add selected-slot readiness copy**

Show `当前状态 / 下一步` inside the selected year detail card for `正式`, `整理中`, and `待入库` slots.

- [x] **Step 2: Make blocked slots intentional**

Keep the primary start action only for clickable `正式` slots and show a muted disabled action row for unavailable slots.

- [x] **Step 3: Complete local dark-mode coverage**

Cover the question-bank hero, tabs, year map, detail card, readiness panel, lists, pending panel, empty state, and action states in dark mode.

- [x] **Step 4: Add slot-readiness guard**

Assert that readiness copy, disabled action treatment, selected unavailable slot rendering, and user-facing wording stay in place.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/question-bank.vue tests/unit/question-bank-slot-readiness-guard.spec.js
npm run test -- tests/unit/question-bank-slot-readiness-guard.spec.js tests/unit/question-bank-year-map.spec.js tests/unit/practice-readiness-card-guard.spec.js tests/unit/frontend-copy-guard.spec.js tests/unit/mini-program-scope-guard.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/practice-sub/question-bank.vue tests/unit/question-bank-slot-readiness-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: clarify question bank slot readiness"
```

### Task 20: Harden Question Bank Start Flow

**Files:**
- Modify: `src/pages/practice-sub/question-bank.vue`
- Create: `tests/unit/question-bank-start-flow-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Use shared safe navigation**

Route question-bank starts through `safeNavigateTo` instead of direct `uni.navigateTo`.

- [x] **Step 2: Contain loading failures**

Keep load failures inside the question-bank page with a clear user-facing toast and no unhandled rejected action.

- [x] **Step 3: Block empty-paper jumps**

Verify that the selected paper produced usable local question IDs before writing `smart_review_ids` and entering `do-quiz`.

- [x] **Step 4: Add start-flow guard**

Assert that loaded papers navigate with verified IDs, empty imports do not navigate, and direct quiz navigation does not return.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/question-bank.vue tests/unit/question-bank-start-flow-guard.spec.js tests/unit/question-bank-slot-readiness-guard.spec.js
npm run test -- tests/unit/question-bank-start-flow-guard.spec.js tests/unit/question-bank-slot-readiness-guard.spec.js tests/unit/question-bank-year-map.spec.js tests/unit/practice-readiness-card-guard.spec.js tests/unit/frontend-copy-guard.spec.js tests/unit/mini-program-scope-guard.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/practice-sub/question-bank.vue tests/unit/question-bank-start-flow-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "fix: harden question bank start flow"
```

### Task 21: Surface Local Question Bank Sync State

**Files:**
- Modify: `src/pages/practice-sub/question-bank.vue`
- Create: `tests/unit/question-bank-local-sync-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Derive local paper counts**

Build a lightweight local paper stats index from `v30_bank` paper IDs and refresh it after successful sync.

- [x] **Step 2: Show sync state in selected-year detail**

Display `本地状态` and `可练题目` for clickable selected slots.

- [x] **Step 3: Show sync state in ready paper cards**

Add a compact local sync pill and question count to each ready paper card.

- [x] **Step 4: Add local sync guard**

Assert loaded and unsynced rendering, count visibility, refresh wiring, and dark-mode coverage.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/question-bank.vue tests/unit/question-bank-local-sync-guard.spec.js tests/unit/question-bank-start-flow-guard.spec.js
npm run test -- tests/unit/question-bank-local-sync-guard.spec.js tests/unit/question-bank-start-flow-guard.spec.js tests/unit/question-bank-slot-readiness-guard.spec.js tests/unit/question-bank-year-map.spec.js tests/unit/practice-readiness-card-guard.spec.js tests/unit/frontend-copy-guard.spec.js tests/unit/mini-program-scope-guard.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/practice-sub/question-bank.vue tests/unit/question-bank-local-sync-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: surface question bank local sync"
```

### Task 22: Explain Question Bank Gap Years

**Files:**
- Modify: `src/pages/practice-sub/question-bank.vue`
- Create: `tests/unit/question-bank-gap-panel-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Derive selected-track gap preview**

Build `selectedGapSlots`, `selectedGapPreview`, and `selectedGapSummary` from unavailable year slots.

- [x] **Step 2: Add user-facing gap reasons**

Show a reason and next step for each unavailable year without backend workflow wording.

- [x] **Step 3: Add lightweight gap panel**

Render the newest six unavailable years in a `待开放清单` panel with dark-mode coverage.

- [x] **Step 4: Add gap panel guard**

Assert summary rendering, track switching, user-facing wording, and dark-mode coverage.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/question-bank.vue tests/unit/question-bank-gap-panel-guard.spec.js tests/unit/question-bank-local-sync-guard.spec.js
npm run test -- tests/unit/question-bank-gap-panel-guard.spec.js tests/unit/question-bank-local-sync-guard.spec.js tests/unit/question-bank-start-flow-guard.spec.js tests/unit/question-bank-slot-readiness-guard.spec.js tests/unit/question-bank-year-map.spec.js tests/unit/practice-readiness-card-guard.spec.js tests/unit/frontend-copy-guard.spec.js tests/unit/mini-program-scope-guard.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/practice-sub/question-bank.vue tests/unit/question-bank-gap-panel-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: explain question bank gap years"
```

### Task 23: Add Recommended Question Bank Start Entry

**Files:**
- Modify: `src/pages/practice-sub/question-bank.vue`
- Create: `tests/unit/question-bank-recommended-start-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Derive the newest playable recommendation**

Build `recommendedSlot`, `recommendedLocalState`, `recommendedSlotRecommendation`, and `recommendedActionText` from the selected track's playable year slots.

- [x] **Step 2: Add the primary recommendation card**

Render `推荐开练` above the year map with direction, year, local question count, and a clear start action.

- [x] **Step 3: Preserve the existing safe start path**

Wire the recommendation action through `loadAndStartSlot(recommendedSlot)` so sync, usable ID verification, and safe navigation stay centralized.

- [x] **Step 4: Add recommendation guard**

Assert default recommendation rendering, synced/unsynced copy, safe start behavior, user-facing wording, and dark-mode coverage.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/question-bank.vue tests/unit/question-bank-recommended-start-guard.spec.js tests/unit/question-bank-gap-panel-guard.spec.js
npm run test -- tests/unit/question-bank-recommended-start-guard.spec.js tests/unit/question-bank-gap-panel-guard.spec.js tests/unit/question-bank-local-sync-guard.spec.js tests/unit/question-bank-start-flow-guard.spec.js tests/unit/question-bank-slot-readiness-guard.spec.js tests/unit/question-bank-year-map.spec.js tests/unit/practice-readiness-card-guard.spec.js tests/unit/frontend-copy-guard.spec.js tests/unit/mini-program-scope-guard.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/practice-sub/question-bank.vue tests/unit/question-bank-recommended-start-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: add question bank recommended start"
```

### Task 24: Tighten Question Bank Ready List Hierarchy

**Files:**
- Modify: `src/pages/practice-sub/question-bank.vue`
- Create: `tests/unit/question-bank-list-hierarchy-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Split primary and secondary playable entries**

Build `secondaryReadyBanks` by filtering the recommended paper out of the selected track's ready bank list.

- [x] **Step 2: Reframe the ready list as supporting browsing**

Add a `更多可练整卷` list heading with count copy, and render the empty state only when there is no recommendation.

- [x] **Step 3: Preserve per-paper sync/start affordances**

Keep local sync pills, question counts, and per-paper start/continue actions for secondary ready papers.

- [x] **Step 4: Add list hierarchy guard**

Assert recommendation/list separation, secondary count copy, one-paper track behavior, and dark-mode heading coverage.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice-sub/question-bank.vue tests/unit/question-bank-list-hierarchy-guard.spec.js tests/unit/question-bank-recommended-start-guard.spec.js
npm run test -- tests/unit/question-bank-list-hierarchy-guard.spec.js tests/unit/question-bank-recommended-start-guard.spec.js tests/unit/question-bank-gap-panel-guard.spec.js tests/unit/question-bank-local-sync-guard.spec.js tests/unit/question-bank-start-flow-guard.spec.js tests/unit/question-bank-slot-readiness-guard.spec.js tests/unit/question-bank-year-map.spec.js tests/unit/practice-readiness-card-guard.spec.js tests/unit/frontend-copy-guard.spec.js tests/unit/mini-program-scope-guard.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/practice-sub/question-bank.vue tests/unit/question-bank-list-hierarchy-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: tighten question bank list hierarchy"
```

### Task 25: Align Practice Home Question-Bank Handoff

**Files:**
- Modify: `src/pages/practice/index.vue`
- Modify: `tests/unit/practice-dynamic-methods.spec.js`
- Create: `tests/unit/practice-question-bank-entry-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Rename the bank-card action semantics**

Change the Practice-page bank card action from `加载` to `查看`, and loaded cards from passive `已加载` to active `继续`.

- [x] **Step 2: Route cards into question-bank detail**

Rename `handleLoadBank` to `openBankDetail` and keep routing through `openQuestionBank(bankId)`.

- [x] **Step 3: Preserve visual states**

Keep dark-mode styling for both detail and continue actions.

- [x] **Step 4: Add handoff guard**

Assert source copy, routing, absence of old load semantics, dynamic method behavior, and dark-mode coverage.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/practice/index.vue tests/unit/practice-question-bank-entry-guard.spec.js tests/unit/practice-dynamic-methods.spec.js
npm run test -- tests/unit/practice-question-bank-entry-guard.spec.js tests/unit/practice-dynamic-methods.spec.js tests/unit/practice-readiness-card-guard.spec.js tests/unit/practice-release-guard.spec.js tests/unit/shell-navigation-guard.spec.js tests/unit/core-shell-visual-guard.spec.js tests/unit/mini-program-scope-guard.spec.js tests/unit/frontend-copy-guard.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/practice/index.vue tests/unit/practice-question-bank-entry-guard.spec.js tests/unit/practice-dynamic-methods.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: align practice question bank handoff"
```

### Task 26: Align Legal Scope With Lightweight Quiz Product

**Files:**
- Modify: `src/pages/settings/index.vue`
- Modify: `src/pages/settings/privacy.vue`
- Modify: `src/pages/settings/terms.vue`
- Create: `tests/unit/settings-legal-scope-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add direct legal entries in Settings**

Make `安全与隐私` open the privacy policy and add a direct `用户协议` row.

- [x] **Step 2: Scope privacy copy to the current product**

Describe quiz records, wrong review, favorites, progress, local cache, account deletion, and data deletion rights without deferred feature claims.

- [x] **Step 3: Scope terms copy to the current product**

Describe public-course quiz, wrong review, favorites, and learning progress. Remove school-selection and AI tutor claims.

- [x] **Step 4: Add legal scope guard**

Assert legal entry routing, lightweight product copy, no deferred feature wording, and 7-day account deletion cooling-period copy.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/settings/index.vue src/pages/settings/privacy.vue src/pages/settings/terms.vue tests/unit/settings-legal-scope-guard.spec.js
npm run test -- tests/unit/settings-legal-scope-guard.spec.js tests/unit/mini-program-scope-guard.spec.js tests/unit/frontend-copy-guard.spec.js tests/unit/shell-navigation-guard.spec.js tests/unit/core-shell-state-guard.spec.js tests/unit/core-shell-theme-guard.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/settings/index.vue src/pages/settings/privacy.vue src/pages/settings/terms.vue tests/unit/settings-legal-scope-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "feat: align legal scope for quiz product"
```

### Task 27: Harden Settings Logout Flow

**Files:**
- Modify: `src/pages/settings/LogoutButton.vue`
- Modify: `src/pages/settings/index.vue`
- Create: `tests/unit/settings-logout-flow-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Route logout completion through safe navigation**

Replace the direct Home `uni.reLaunch` call in `LogoutButton` with `safeNavigateTo('/pages/index/index')`.

- [x] **Step 2: Reset Settings account state after logout**

Handle the `logged-out` event with `handleLoggedOut`, clearing user info and in-memory deletion status.

- [x] **Step 3: Preserve sensitive-key cleanup**

Keep removal of `userInfo`, `EXAM_USER_ID`, and `EXAM_TOKEN`, plus the login-status broadcast.

- [x] **Step 4: Add logout flow guard**

Assert safe navigation, no direct relaunch, sensitive-key cleanup, status broadcast, and deletion-state reset.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/settings/LogoutButton.vue src/pages/settings/index.vue tests/unit/settings-logout-flow-guard.spec.js
npm run test -- tests/unit/settings-logout-flow-guard.spec.js tests/unit/settings-legal-scope-guard.spec.js tests/unit/shell-navigation-guard.spec.js tests/unit/core-shell-state-guard.spec.js tests/unit/core-shell-theme-guard.spec.js tests/unit/integration-storage-nav.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/settings/LogoutButton.vue src/pages/settings/index.vue tests/unit/settings-logout-flow-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "fix: harden settings logout flow"
```

### Task 28: Guard Account Deletion API Auth

**Files:**
- Modify: `src/services/api/domains/user.api.js`
- Modify: `tests/unit/integration-laf-engine.spec.js`
- Create: `tests/unit/account-deletion-api-auth-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add front-end auth preflight**

Before calling `/account-delete`, require either `EXAM_TOKEN` or `EXAM_USER_ID` through the shared auth-storage entry points.

- [x] **Step 2: Keep unauthenticated deletion local**

Return `{ code: 401, success: false, message: '请先登录', data: null }` for request, cancel, and status actions when no credential exists, without calling the shared request layer.

- [x] **Step 3: Preserve explicit backend action payloads**

Authenticated request, cancel, and status calls must still send `{ action: 'request' }`, `{ action: 'cancel' }`, and `{ action: 'status' }` exactly.

- [x] **Step 4: Add API auth guard**

Assert unauthenticated account-deletion actions do not call `request`, and authenticated token/user-id states still reach the account-delete endpoint.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/services/api/domains/user.api.js tests/unit/account-deletion-api-auth-guard.spec.js tests/unit/integration-laf-engine.spec.js
npm run test -- tests/unit/account-deletion-api-auth-guard.spec.js tests/unit/integration-laf-engine.spec.js tests/unit/settings-logout-flow-guard.spec.js tests/unit/settings-legal-scope-guard.spec.js tests/unit/audit-account-delete-safety.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/services/api/domains/user.api.js tests/unit/account-deletion-api-auth-guard.spec.js tests/unit/integration-laf-engine.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "fix: guard account deletion auth"
```

### Task 29: Normalize Settings Account Identity

**Files:**
- Modify: `src/pages/settings/index.vue`
- Create: `tests/unit/settings-account-identity-guard.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add normalized account identity state**

Derive `currentUserId` from `uid`, `_id`, `userId`, `id`, and cached `EXAM_USER_ID`, then expose `isAccountLoggedIn`.

- [x] **Step 2: Use normalized login state in account-safety UI**

Use `isAccountLoggedIn` for the login badge, account-deletion section, and deletion-status refresh instead of relying on `userInfo.uid`.

- [x] **Step 3: Reuse normalized identity for profile-side effects**

Use `currentUserId` for avatar upload and `EXAM_USER_ID` persistence, and generate local fallback IDs through `ensureLocalUserId`.

- [x] **Step 4: Add Settings identity guard**

Assert Settings keeps normalized identity fields, does not regress to `userInfo.uid` visibility checks, and saves the normalized ID.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/pages/settings/index.vue tests/unit/settings-account-identity-guard.spec.js
npm run test -- tests/unit/settings-account-identity-guard.spec.js tests/unit/settings-logout-flow-guard.spec.js tests/unit/settings-legal-scope-guard.spec.js tests/unit/account-deletion-api-auth-guard.spec.js tests/unit/integration-profile.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/pages/settings/index.vue tests/unit/settings-account-identity-guard.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "fix: normalize settings account identity"
```

### Task 30: Harden Account Purge Admin Trigger

**Files:**
- Modify: `laf-backend/functions/account-purge.ts`
- Modify: `tests/unit/audit-account-purge-field-mapping.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add header-only admin token audit**

Assert manual HTTP purge rejects `body.adminToken`, accepts `x-admin-token`, and still allows scheduled non-HTTP contexts.

- [x] **Step 2: Remove body admin token fallback**

Read the administrator purge token only from `x-admin-token` / `X-Admin-Token` headers before executing account purge.

- [x] **Step 3: Preserve purge safety behavior**

Keep missing-token rejection, scheduled-task handling, partial-failure retry marking, and account-delete/token-binding audit coverage intact.

- [x] **Step 4: Run focused validation**

Run:
```bash
npm run lint -- laf-backend/functions/account-purge.ts tests/unit/audit-account-purge-field-mapping.spec.js
npm run test -- tests/unit/audit-account-purge-field-mapping.spec.js tests/unit/audit-account-delete-safety.spec.js tests/unit/audit-token-header-userid-enforcement.spec.js
```

Result: tests passed on 2026-06-01. Lint exited 0; ESLint reported `laf-backend/functions/account-purge.ts` is ignored by current config.

- [x] **Step 5: Commit**

Run:
```bash
git add laf-backend/functions/account-purge.ts tests/unit/audit-account-purge-field-mapping.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "fix: harden account purge admin trigger"
```

### Task 31: Harden Sensitive Storage Cleanup

**Files:**
- Modify: `src/services/storageService.js`
- Modify: `src/utils/crypto/cipher.js`
- Modify: `tests/unit/storage-service.spec.js`
- Modify: `tests/unit/integration-storage-nav.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add cache-clear plaintext identity regression tests**

Assert default cache clearing keeps `EXAM_TOKEN`, `EXAM_USER_ID`, and `userInfo` readable while removing plaintext copies and preserving encrypted copies.

- [x] **Step 2: Add short identity cipher regression tests**

Assert V2 obfuscation round-trips short identity strings such as `user_keep`, `user_123`, and `u1`.

- [x] **Step 3: Fix V2 obfuscation padding**

Store encoded plaintext length in the V2 payload and trim decrypted bytes before URI decoding, so Feistel padding cannot corrupt short strings.

- [x] **Step 4: Migrate plaintext sensitive globals during clear**

When preserving global keys, migrate legacy plaintext sensitive keys into `_enc_` storage and remove plaintext only after the encrypted value is readable.

- [x] **Step 5: Run focused validation**

Run:
```bash
npm run lint -- src/utils/crypto/cipher.js src/services/storageService.js tests/unit/storage-service.spec.js tests/unit/integration-storage-nav.spec.js
npm run test -- tests/unit/storage-service.spec.js tests/unit/integration-storage-nav.spec.js tests/unit/auth-storage.spec.js tests/unit/settings-logout-flow-guard.spec.js tests/unit/account-deletion-api-auth-guard.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add src/services/storageService.js src/utils/crypto/cipher.js tests/unit/storage-service.spec.js tests/unit/integration-storage-nav.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "fix: harden sensitive storage cleanup"
```

### Task 32: Add Phase 4 Safety Release Gate

**Files:**
- Modify: `scripts/build/release-external-gate.mjs`
- Modify: `tests/unit/release-external-gate.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add failing safety evidence gate test**

Assert release mode blocks publishing when the Phase 4 account deletion, account purge, legal/privacy, or sensitive storage guard tests are missing.

- [x] **Step 2: Add Phase 4 safety section to external release gate**

Add `phase4Safety` to the release report and make it check for required test evidence before `canPublish=true`.

- [x] **Step 3: Keep the gate configurable for isolated tests**

Add `--safety-tests-dir` so tests can point the gate at an empty temporary directory without modifying the real repo.

- [x] **Step 4: Run focused validation**

Run:
```bash
npm run lint -- src/services/storageService.js src/utils/crypto/cipher.js src/services/api/domains/user.api.js src/pages/settings/index.vue src/pages/settings/privacy.vue src/pages/settings/terms.vue tests/unit/release-external-gate.spec.js tests/unit/account-deletion-api-auth-guard.spec.js tests/unit/audit-account-purge-field-mapping.spec.js tests/unit/storage-service.spec.js tests/unit/settings-legal-scope-guard.spec.js tests/unit/settings-account-identity-guard.spec.js
npm run test -- tests/unit/release-external-gate.spec.js tests/unit/account-deletion-api-auth-guard.spec.js tests/unit/audit-account-purge-field-mapping.spec.js tests/unit/storage-service.spec.js tests/unit/integration-storage-nav.spec.js tests/unit/settings-legal-scope-guard.spec.js tests/unit/settings-account-identity-guard.spec.js tests/unit/settings-logout-flow-guard.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 5: Commit**

Run:
```bash
git add scripts/build/release-external-gate.mjs tests/unit/release-external-gate.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: gate phase four safety evidence"
```

### Task 33: Surface Phase 4 Safety In Release Backlog

**Files:**
- Modify: `scripts/build/release-blocker-backlog.mjs`
- Modify: `tests/unit/release-blocker-backlog.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add backlog classification test**

Assert `externalAudit.sections.phase4Safety` blockers become `phase4_safety_evidence` backlog items instead of generic external evidence.

- [x] **Step 2: Implement Phase 4 workstream mapping**

Map `phase4Safety` to a dedicated workstream with a next action focused on restoring account deletion, privacy/legal, and sensitive storage guard tests.

- [x] **Step 3: Add Markdown section**

Render a `Phase 4 安全证据阻塞` section so release operators can see the missing safety guard without reading raw JSON.

- [x] **Step 4: Run focused validation**

Run:
```bash
npm run lint -- tests/unit/release-blocker-backlog.spec.js tests/unit/release-external-gate.spec.js tests/unit/release-scripts.spec.js
npm run test -- tests/unit/release-blocker-backlog.spec.js tests/unit/release-external-gate.spec.js tests/unit/release-scripts.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 5: Commit**

Run:
```bash
git add scripts/build/release-blocker-backlog.mjs tests/unit/release-blocker-backlog.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: surface phase four release blockers"
```

### Task 34: Keep Backlog Evidence Fields Scoped

**Files:**
- Modify: `scripts/build/release-blocker-backlog.mjs`
- Modify: `tests/unit/release-blocker-backlog.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add non-Phase4 evidence field guard**

Assert `wechatDevice` backlog items do not carry `requiredEvidenceCount` or `presentEvidenceCount`, because those fields only describe Phase 4 safety tests.

- [x] **Step 2: Scope safety counters to Phase 4**

Build the common external evidence payload first, then attach safety counts only when `sectionName === 'phase4Safety'`.

- [x] **Step 3: Regenerate backlog and avoid timestamp-only churn**

Run `npm run audit:release:backlog` to confirm the generated report still has 81 blockers and 66 public-course blocked slots, then avoid committing a pure `generatedAt` diff.

- [x] **Step 4: Run focused validation**

Run:
```bash
npm run lint -- tests/unit/release-blocker-backlog.spec.js
npm run test -- tests/unit/release-blocker-backlog.spec.js
```

Result: passed on 2026-06-01.

- [x] **Step 5: Commit**

Run:
```bash
git add scripts/build/release-blocker-backlog.mjs tests/unit/release-blocker-backlog.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: scope backlog safety evidence fields"
```

### Task 35: Prioritize Cleaning Queue By Release Backlog

**Files:**
- Modify: `scripts/baidu/cleaning_queue.py`
- Modify: `tests/unit/test_baidu_cleaning_queue.py`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add release-backlog priority test**

Assert a source belonging to `nextBalancedPublicCourseSlots` is placed before generic same-priority sources and receives release backlog metadata.

- [x] **Step 2: Add release backlog lookup and task metadata**

Read `nextBalancedPublicCourseSlots` / `publicCourseSlotBacklog`, attach `releaseBacklogSlot`, `releaseBacklogRank`, `releaseBlockerCode`, and related status fields to matching tasks.

- [x] **Step 3: Sort queue by release blocker rank before generic priority**

Keep completed tasks at the bottom, then sort pending tasks by release backlog rank, source priority, track/year/name.

- [x] **Step 4: Fix limited summary counts**

When `--limit` truncates the queue, calculate preserved/changed counts from returned tasks only so summaries cannot report negative `newOrChangedTasks`.

- [x] **Step 5: Run focused validation**

Run:
```bash
python3 -m unittest tests.unit.test_baidu_cleaning_queue
python3 -m unittest tests.unit.test_baidu_cleaning_runner
python3 scripts/baidu/cleaning_queue.py --self-test
python3 scripts/baidu/cleaning_queue.py --dry-run --limit 20
```

Result: passed on 2026-06-01. Dry-run first 20 tasks all hit release backlog slots.

- [x] **Step 6: Commit**

Run:
```bash
git add scripts/baidu/cleaning_queue.py tests/unit/test_baidu_cleaning_queue.py docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: prioritize release backlog cleaning queue"
```

### Task 36: Keep Cleaning Runner On Release Priority

**Files:**
- Modify: `scripts/baidu/run_cleaning_queue.py`
- Modify: `tests/unit/test_baidu_cleaning_runner.py`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add runner selection regression test**

Assert `select_pending_tasks` keeps a task with `releaseBacklogRank: 0` ahead of a generic same-priority official-paper task, even when the generic task has an earlier year.

- [x] **Step 2: Apply release backlog rank inside runner sorting**

Add `releaseBacklogRank` to `cleaning_task_sort_key`, so the runner does not undo the release-prioritized ordering created by `cleaning_queue.py`.

- [x] **Step 3: Regenerate local ignored queue**

Run `python3 scripts/baidu/cleaning_queue.py` to refresh the ignored local queue used by the runner.

Result: `totalTasks=1600`, `pendingTasks=1593`, `releaseBacklogTasks=824`, `releaseBacklogPendingTasks=824`, `releaseBacklogAutomationActionablePendingTasks=168`, `releaseBacklogManualBlockedPendingTasks=656`.

- [x] **Step 4: Verify runner dry-run ordering**

Run:
```bash
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
```

Result: passed on 2026-06-01. The first planned tasks now start with `politics:2023`, `english1:2018`, and other release backlog papers instead of generic 2005-order work.

- [x] **Step 5: Run final focused validation**

Run:
```bash
python3 -m unittest tests.unit.test_baidu_cleaning_queue tests.unit.test_baidu_cleaning_runner
python3 scripts/baidu/cleaning_queue.py --self-test
python3 scripts/baidu/run_cleaning_queue.py --self-test
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Result: passed on 2026-06-01.

- [x] **Step 6: Commit**

Run:
```bash
git add scripts/baidu/run_cleaning_queue.py tests/unit/test_baidu_cleaning_runner.py docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: run cleaning queue by release priority"
```

### Task 37: Harden Real Cleaning Smoke And Quality Gates

**Files:**
- Modify: `scripts/pipeline/pdf2flashcard-v2.py`
- Modify: `scripts/baidu/run_cleaning_queue.py`
- Modify: `tests/unit/test_pdf2flashcard_v2.py`
- Modify: `tests/unit/test_baidu_cleaning_runner.py`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Restore usable Baidu cleaning runtime**

Move the hung ignored `.venv-baidu` aside and rebuild `.venv-baidu` with Python 3.12 plus `requirements-baidu.txt`.

- [x] **Step 2: Add LLM request controls**

Make `LLM_REQUEST_TIMEOUT_SECONDS`, `LLM_MAX_RETRIES`, `LLM_MAX_TOKENS`, and `PDF2FLASHCARD_BATCH_CHAR_LIMIT` configurable so real cleaning can run against free or low-cost model limits without hanging.

- [x] **Step 3: Fail fast on stable provider errors**

Treat unsupported models, invalid accounts, access denied, identity verification, credit card verification, and token-limit errors as stable backend failures so fallback moves on quickly.

- [x] **Step 4: Add batch-level zero-card fallback**

When a question-like batch returns zero cards, try the next configured backend instead of silently accepting a likely missing block.

- [x] **Step 5: Normalize deterministic politics exam types**

Apply the fixed politics structure after LLM parsing: 1-16 single choice, 17-33 multi choice, 34-38 analysis.

- [x] **Step 6: Add runner-side quality gate**

For main politics papers, require at least 38 total cards, 16 single-choice, 17 multi-choice, and 5 analysis cards before the task can be marked completed. Persist `typeCounts` and `qualityIssues` for operator review.

- [x] **Step 7: Run real single-paper smoke**

Run:
```bash
LLM_DISABLED_PROVIDERS=llm_primary,iflow,nvidia LLM_REQUEST_TIMEOUT_SECONDS=8 LLM_MAX_RETRIES=1 PDF2FLASHCARD_BATCH_CHAR_LIMIT=1400 LLM_MAX_TOKENS=2048 python3 scripts/baidu/run_cleaning_queue.py --limit 1 --source-type official_paper --paper-role main
```

Result: download and text-layer extraction worked for `politics:2023`. The first run exposed provider failures; the guarded rerun produced 38 cards with 5 analysis items when fallback succeeded, and failed closed when cached/provider behavior still missed the required politics distribution.

- [x] **Step 8: Run final validation**

Run:
```bash
.venv-baidu/bin/python -m unittest tests.unit.test_pdf2flashcard_v2
python3 -m unittest tests.unit.test_baidu_cleaning_runner tests.unit.test_baidu_cleaning_queue
python3 scripts/baidu/cleaning_queue.py --self-test
python3 scripts/baidu/run_cleaning_queue.py --self-test
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Result: passed on 2026-06-01. Regenerated the ignored local queue after real smoke testing so the next dry-run again starts with `politics:2023`.

- [x] **Step 9: Commit**

Run:
```bash
git add scripts/pipeline/pdf2flashcard-v2.py scripts/baidu/run_cleaning_queue.py tests/unit/test_pdf2flashcard_v2.py tests/unit/test_baidu_cleaning_runner.py docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: harden cleaning runner quality gates"
```

### Task 38: Stabilize Question-Like Batch Fallback

**Files:**
- Modify: `scripts/pipeline/pdf2flashcard-v2.py`
- Modify: `tests/unit/test_pdf2flashcard_v2.py`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add empty-cache regression test**

Assert a question-like batch with a cached empty result ignores that cache and sends a fresh LLM request.

- [x] **Step 2: Add duplicate-number regression test**

Assert a question-like batch whose first backend returns only already-seen question numbers falls back to the next backend and preserves the new analysis question.

- [x] **Step 3: Implement cache and duplicate safeguards**

Add `PDF2FLASHCARD_ALLOW_EMPTY_CACHE` as an explicit opt-in for empty cache hits, and reject duplicate-only question-like batch output before accepting a backend.

- [x] **Step 4: Re-run real politics smoke**

Run:
```bash
rm -f data/ai-cache/pdf2flashcard-cache.json data/ai-cache/pdf2flashcard-usage.json
python3 scripts/baidu/cleaning_queue.py --previous-queue /tmp/exam-master-no-previous-cleaning-queue.json
LLM_DISABLED_PROVIDERS=llm_primary,iflow,nvidia LLM_REQUEST_TIMEOUT_SECONDS=8 LLM_MAX_RETRIES=1 PDF2FLASHCARD_BATCH_CHAR_LIMIT=1400 LLM_MAX_TOKENS=2048 python3 scripts/baidu/run_cleaning_queue.py --limit 1 --source-type official_paper --paper-role main
```

Result: `politics:2023` completed with `questionCount=38`, `typeCounts={single_choice:16,multi_choice:17,analysis:5}`, `qualityIssues=[]`, and `answerEvidenceStatus=missing_answers` because `politics-2023-035` still lacks an answer.

- [x] **Step 5: Run final validation**

Run:
```bash
.venv-baidu/bin/python -m unittest tests.unit.test_pdf2flashcard_v2
python3 -m unittest tests.unit.test_baidu_cleaning_runner tests.unit.test_baidu_cleaning_queue
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Result: passed on 2026-06-01. Dry-run now starts after `politics:2023` because the ignored local queue has that structure-cleaning task completed with one missing-answer evidence blocker.

- [x] **Step 6: Commit**

Run:
```bash
git add scripts/pipeline/pdf2flashcard-v2.py tests/unit/test_pdf2flashcard_v2.py docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: stabilize question batch fallback"
```

### Task 39: Repair Politics 2023 Answer Evidence

**Files:**
- Modify: `scripts/baidu/answer_evidence_repair.py`
- Modify: `tests/unit/test_answer_evidence_repair.py`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add politics answer-point repair test**

Assert `35.【答案要点】...` style answer text can repair a missing politics subjective answer.

- [x] **Step 2: Parse numbered answer-point sections**

Add `parse_numbered_answer_point_sections` and feed those candidates into the existing conservative answer evidence repair flow as `companion_numbered_answer_text`.

- [x] **Step 3: Run real dry-run repair**

Run:
```bash
.venv-baidu/bin/python scripts/baidu/answer_evidence_repair.py --target data/flashcards/politics-2023.json --companion data/flashcards/politics-support-6d757672-2023.json --output data/answer-evidence-repair-report.json
```

Result: `repaired=1`, `remainingMissing=0`, `conflicts=0`.

- [x] **Step 4: Write repair to local ignored bank and queue**

Run:
```bash
.venv-baidu/bin/python scripts/baidu/answer_evidence_repair.py --target data/flashcards/politics-2023.json --companion data/flashcards/politics-support-6d757672-2023.json --output data/answer-evidence-repair-report.json --write
```

Result: `politics:2023` now has `questionCount=38`, `missingAnswerCount=0`, `answerEvidenceStatus=candidate_repaired`, and `answerEvidenceMaterialized=38` in the repair report.

- [x] **Step 5: Run final validation**

Run:
```bash
python3 -m unittest tests.unit.test_answer_evidence_repair
python3 -m unittest tests.unit.test_baidu_cleaning_runner tests.unit.test_baidu_cleaning_queue
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Result: passed on 2026-06-01. Dry-run now advances past `politics:2023` because its local structure and candidate answer evidence are complete.

- [x] **Step 6: Commit**

Run:
```bash
git add scripts/baidu/answer_evidence_repair.py tests/unit/test_answer_evidence_repair.py docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: repair numbered politics answer evidence"
```

### Task 40: Gate English 2018 Structure And Support Isolation

**Files:**
- Modify: `scripts/pipeline/pdf2flashcard-v2.py`
- Modify: `scripts/baidu/run_cleaning_queue.py`
- Modify: `tests/unit/test_pdf2flashcard_v2.py`
- Modify: `tests/unit/test_baidu_cleaning_runner.py`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add English deterministic type normalization**

Normalize English I/II cards after LLM parsing: questions 1-45 are choice, 46-50 are translation, and 51-52 are essay. Add a regression test proving 41-45 and 51-52 no longer stay as generic analysis cards.

- [x] **Step 2: Add English main-paper quality gates**

Require English I 2005+ main papers to produce at least 52 cards, 45 choice items, 5 translation items, and 2 essay items. Require English II 2010+ main papers to produce at least 48 cards, 45 choice items, 1 translation item, and 2 essay items.

- [x] **Step 3: Gate incomplete choice options**

Fail release-quality main papers when choice cards have fewer than 4 options. This allows English 41-45 A-G style items while blocking malformed 0/1/2/3-option cards.

- [x] **Step 4: Fix answer-support output isolation**

Use the same support-evidence detector for `output_subject_for_task`, so support files such as `2018年真题及答案速查.pdf` write to `english-support-<source>-2018.json` instead of overwriting `english1-2018.json`.

- [x] **Step 5: Run real English I 2018 cleaning and support repair**

Run:
```bash
LLM_DISABLED_PROVIDERS=llm_primary,iflow,nvidia LLM_REQUEST_TIMEOUT_SECONDS=8 LLM_MAX_RETRIES=1 PDF2FLASHCARD_BATCH_CHAR_LIMIT=1400 LLM_MAX_TOKENS=2048 .venv-baidu/bin/python scripts/baidu/run_cleaning_queue.py --task-id clean_c744b4e71478d47555f063fd --limit 1 --source-type official_paper --paper-role main
LLM_DISABLED_PROVIDERS=llm_primary,iflow,nvidia LLM_REQUEST_TIMEOUT_SECONDS=8 LLM_MAX_RETRIES=1 PDF2FLASHCARD_BATCH_CHAR_LIMIT=1400 LLM_MAX_TOKENS=2048 .venv-baidu/bin/python scripts/baidu/run_cleaning_queue.py --task-id clean_c852e6675cee3f2df6dd6456 --limit 1 --source-type official_paper --paper-role support
.venv-baidu/bin/python scripts/baidu/answer_evidence_repair.py --target data/flashcards/english1-2018.json --companion data/flashcards/english-support-ebf94bb2-2018.json --output data/answer-evidence-repair-report.json --write --mark-companions-supporting
```

Result: `english1:2018` has `questionCount=52`, `typeCounts={single_choice:45,translation:5,essay:2}`, `missingAnswerCount=0`, and `answerEvidenceStatus=candidate_repaired`. It remains failed for `english1_choice_option_count_below_minimum` because 10 choice cards still have fewer than 4 options.

- [x] **Step 6: Run final validation**

Run:
```bash
.venv-baidu/bin/python -m unittest tests.unit.test_pdf2flashcard_v2 tests.unit.test_baidu_cleaning_runner tests.unit.test_answer_evidence_repair
python3 -m unittest discover -s tests/unit -p 'test_baidu_cleaning_runner.py'
python3 scripts/baidu/run_cleaning_queue.py --self-test
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Result: passed on 2026-06-01. Dry-run still starts with another `english1:2018` main/analysis PDF because the first main source is now structurally counted and answer-repaired but correctly blocked on option integrity.

- [x] **Step 7: Commit**

Run:
```bash
git add scripts/pipeline/pdf2flashcard-v2.py scripts/baidu/run_cleaning_queue.py tests/unit/test_pdf2flashcard_v2.py tests/unit/test_baidu_cleaning_runner.py docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: gate english cleaning quality"
```

### Task 41: Repair English 2018 Option Integrity

**Files:**
- Modify: `scripts/baidu/run_cleaning_queue.py`
- Modify: `scripts/baidu/answer_evidence_repair.py`
- Modify: `tests/unit/test_baidu_cleaning_runner.py`
- Modify: `tests/unit/test_answer_evidence_repair.py`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Reproduce same-slot downgrade risk**

Ran the next official main source:
```bash
LLM_DISABLED_PROVIDERS=llm_primary,iflow,nvidia LLM_REQUEST_TIMEOUT_SECONDS=8 LLM_MAX_RETRIES=1 PDF2FLASHCARD_BATCH_CHAR_LIMIT=1400 LLM_MAX_TOKENS=2048 .venv-baidu/bin/python scripts/baidu/run_cleaning_queue.py --task-id clean_c87c00b1ce6850cfb497859d --limit 1 --source-type official_paper --paper-role main
```

Result: the later 2018 English I analysis source produced only 47 cards and failed the English structure gate. This exposed a downgrade risk because it wrote to the same canonical `english1-2018.json` path as the better 52-card main source.

- [x] **Step 2: Preserve better canonical outputs**

Added a runner regression test and implementation so failed candidates restore a better existing canonical output. The task still records the failed candidate result, but the local bank file is no longer downgraded.

- [x] **Step 3: Repair options from companion cleaned JSON**

Extended `answer_evidence_repair.py` to repair incomplete choice options by `year:number` when a companion cleaned JSON has at least 4 options. This repaired English I 2018 cards 11, 14, 17, and 18 from `english-support-ebf94bb2-2018.json`.

- [x] **Step 4: Repair options from target source text**

Added source-text option extraction for numbered A-D choices and English 41-45 A-G new-type sections, with Apple OCR fallback for scanned PDFs. Also fixed duplicate `outputPath` queue mapping so answer repair chooses the better 52-card source task as the target evidence owner.

- [x] **Step 5: Run real English I 2018 option repair**

Run:
```bash
.venv-baidu/bin/python scripts/baidu/answer_evidence_repair.py --target data/flashcards/english1-2018.json --companion data/flashcards/english-support-ebf94bb2-2018.json --output data/answer-evidence-repair-report.json --write --mark-companions-supporting
```

Result: `repairedOptions=6` from the original main PDF OCR text, after the earlier 4 companion option repairs. The local `english1-2018.json` now has 52 cards, `{single_choice:45, translation:5, essay:2}`, `missingAnswerCount=0`, and `qualityIssues=[]`.

- [x] **Step 6: Run final validation**

Run:
```bash
.venv-baidu/bin/python -m unittest tests.unit.test_baidu_cleaning_runner tests.unit.test_answer_evidence_repair tests.unit.test_pdf2flashcard_v2
.venv-baidu/bin/python scripts/baidu/run_cleaning_queue.py --self-test
.venv-baidu/bin/python scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Result: passed on 2026-06-02. Dry-run now advances past `english1:2018`; the next main release-priority task is `2005数一标准答案及解析.pdf`.

- [x] **Step 7: Commit**

Run:
```bash
git add scripts/baidu/run_cleaning_queue.py scripts/baidu/answer_evidence_repair.py tests/unit/test_baidu_cleaning_runner.py tests/unit/test_answer_evidence_repair.py docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: repair english option evidence"
```

Result: committed as `52b459c chore: repair english option evidence`, followed by `a762196 chore: trim llm batch headroom` for the next English 2019 run stability pass.

### Task 42: Rebuild English 2019 From Answer-Speed Source

**Files:**
- Modify: `scripts/baidu/answer_evidence_repair.py`
- Modify: `tests/unit/test_answer_evidence_repair.py`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Pull deterministic companion source**

Run:
```bash
set -a && source .env && set +a && .venv-baidu/bin/python scripts/baidu/pan.py download '/EXAM-MASTER/考研历年真题/02.考研英语/01.考研英语【历年真题】/03.考研真相系列/26考研真相/英一/真题册+答案速查/2019年真题及答案速查/2019年真题及答案速查.pdf' data/raw-inbox/2019年真题及答案速查.pdf
```

Result: downloaded ignored local source `data/raw-inbox/2019年真题及答案速查.pdf`. The file has a usable text layer with the full 2019 English I paper plus answer-speed table.

- [x] **Step 2: Extend option repair for companion source text**

Add dotted English option parsing (`A. ... B. ...`) and companion source-text option candidates to `answer_evidence_repair.py`, so lightweight companion wrappers can supply options from PDFs/TXT files without first running a full LLM cleaned JSON pass.

- [x] **Step 3: Rebuild the local 2019 English structure**

Run:
```bash
python3 scripts/baidu/english_passage_repair.py --target data/flashcards/english1-2019.json --source-pdf data/raw-inbox/2019年真题及答案速查.pdf --output /tmp/english1-2019-passage-repair-report.json --write --repair-cloze-cards --repair-part-b-cards --reset-part-b-answers --repair-translation-cards --reset-translation-answers
```

Result: `cardCount=52`, `clozeRebuiltCount=20`, `translationSegmentCount=5`, `translationRebuiltCount=5`, and `translationAddedCount=2`.

- [x] **Step 4: Repair answers and remaining options from answer-speed text**

Run with an ignored wrapper JSON pointing at `data/raw-inbox/2019年真题及答案速查.pdf`:
```bash
python3 scripts/baidu/answer_evidence_repair.py --target data/flashcards/english1-2019.json --companion /tmp/english1-2019-answer-wrapper.json --output /tmp/english1-2019-repair-report.json --write
```

Result: `repairedAnswers=10`, `repairedOptions=3`, `remainingMissingAnswers=0`, `companionSourceOptionCandidates=45`, `answerKeyTextCandidates=45`, `answerKeyGroupCandidates=9`, and `numberedAnswerTextCandidates=5`.

- [x] **Step 5: Verify release-quality structure**

Run:
```bash
python3 - <<'PY'
import json
from pathlib import Path
from scripts.baidu.run_cleaning_queue import output_result_for_path
queue=json.loads(Path('data/cleaning-queue.json').read_text())
task=next(t for t in queue['tasks'] if t.get('taskId')=='clean_a178787993d76cdd19ba4f51')
print(output_result_for_path(task, Path('data/flashcards/english1-2019.json')))
PY
```

Result: `questionCount=52`, `missingAnswerCount=0`, `typeCounts={single_choice:45,translation:5,essay:2}`, and `qualityIssues=[]`.

- [x] **Step 6: Run validation**

Run:
```bash
python3 -m unittest tests.unit.test_baidu_cleaning_runner tests.unit.test_baidu_cleaning_queue tests.unit.test_answer_evidence_repair tests.unit.test_english_passage_repair
.venv-baidu/bin/python -m unittest tests.unit.test_pdf2flashcard_v2
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Result: passed on 2026-06-02. Dry-run now points at `2019考研英语一真题及解析.pdf`, then the next math release backlog tasks.

- [x] **Step 7: Commit**

Run:
```bash
git add scripts/baidu/answer_evidence_repair.py tests/unit/test_answer_evidence_repair.py docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git commit -m "chore: repair english companion option evidence"
```

Result: committed after validation on 2026-06-02.

### Task 59: Block Mislabeled Math II 2016 Source

**Files:**
- Add: `scripts/baidu/source_quality.py`
- Modify: `scripts/baidu/source_manifest.py`
- Modify: `scripts/baidu/manifest_quality.py`
- Modify: `scripts/baidu/public_course_candidate_coverage.py`
- Modify: `scripts/baidu/cleaning_queue.py`
- Modify: `scripts/baidu/run_cleaning_queue.py`
- Modify: `scripts/build/question-bank-release-gate.mjs`
- Modify: `scripts/build/release-blocker-backlog.mjs`
- Modify: `tests/unit/test_source_manifest_year.py`
- Modify: `tests/unit/test_baidu_cleaning_queue.py`
- Modify: `tests/unit/test_baidu_cleaning_runner.py`
- Modify: `tests/unit/question-bank-release-gate.spec.js`
- Modify: `tests/unit/release-blocker-backlog.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`
- Modify: `data/release-blocker-backlog.json`

- [x] **Step 1: Confirm the source mismatch**

Downloaded/inspected the release-priority `math2:2016` source:

```text
data/raw-inbox/src_97fdbcbd12d0815374fbe91f-2016考研数学二真题.pdf
```

Result: `pdfinfo` reports 14 scanned pages with no usable text layer. OCR and visual comparison show the title says `2016 年考研数学二真题与解析`, but the first-page questions match the already published `math2-2014` exam. Pages 11-14 are promotional/software pages. Publishing it as `math2:2016` would be wrong.

- [x] **Step 2: Add a reusable source-quality blocker**

Added `scripts/baidu/source_quality.py` with a known-source override for `src_97fdbcbd12d0815374fbe91f`. The override injects `source_content_mismatch` and `manual_review_required`, sets `legalReview.publishBlocked=true`, and stores a source-quality review note.

Wired the override into Source Manifest normalization, manifest quality, raw candidate coverage, cleaning queue generation, and runner task selection. This protects both refreshed manifest state and stale queues that still contain the old `download_and_extract` task.

- [x] **Step 3: Keep release evidence from counting the bad source**

Updated `question-bank-release-gate.mjs` so known `source_content_mismatch` rows are not auto-pairable evidence, even if their path looks like a combined `paper_answer` PDF.

Updated release backlog required-field copy and tests so `math2:2016` is reported as `missing_publishable_official_source` with candidate blockers:

```text
riskFlags=manual_review_required,source_content_mismatch
legalReview.publishBlocked=true
source_content_mismatch
```

- [x] **Step 4: Run validation**

Run:
```bash
python3 -m unittest tests.unit.test_source_manifest_year tests.unit.test_baidu_cleaning_runner tests.unit.test_baidu_cleaning_queue tests.unit.test_public_course_candidate_coverage tests.unit.test_public_course_source_audit
npx vitest run tests/unit/question-bank-release-gate.spec.js tests/unit/release-blocker-backlog.spec.js tests/unit/release-scripts.spec.js
python3 scripts/baidu/source_manifest.py --self-test
python3 scripts/baidu/manifest_quality.py --self-test
python3 scripts/baidu/cleaning_queue.py --self-test
python3 scripts/baidu/run_cleaning_queue.py --self-test
node scripts/build/question-bank-release-gate.mjs
node scripts/build/release-blocker-backlog.mjs
python3 scripts/baidu/manifest_quality.py
python3 scripts/baidu/public_course_candidate_coverage.py
python3 scripts/baidu/cleaning_queue.py
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Result: passed on 2026-06-02. Release metrics now report `coverageGaps=55`, `blockers=68`, `sourceEvidenceGaps=12`, and `publicCourseBlockedSlots=55`. The release-priority dry-run skips the bad `math2:2016` source and starts at `2015年考研数学三真题及解析.pdf`, followed by `2020年考研英语一真题.pdf`, `2017考研数学二真题.pdf`, and `2016年考研数学三真题及解析.pdf`.

- [x] **Step 5: Commit**

Run:
```bash
git add scripts/baidu/source_quality.py scripts/baidu/source_manifest.py scripts/baidu/manifest_quality.py scripts/baidu/public_course_candidate_coverage.py scripts/baidu/cleaning_queue.py scripts/baidu/run_cleaning_queue.py scripts/build/question-bank-release-gate.mjs scripts/build/release-blocker-backlog.mjs tests/unit/test_source_manifest_year.py tests/unit/test_baidu_cleaning_queue.py tests/unit/test_baidu_cleaning_runner.py tests/unit/question-bank-release-gate.spec.js tests/unit/release-blocker-backlog.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md docs/08C-SCRIPTS-REFERENCE.md docs/12-CHANGELOG.md data/release-blocker-backlog.json
git -c core.hooksPath=/dev/null commit -m "chore: block mislabeled math2 2016 source"
```

Result: ready to commit after validation on 2026-06-02.

### Task 51: Publish Math I 2018 Page-Image Bank

**Files:**
- Modify: `scripts/cleaning/build_math1_history_banks.py`
- Modify: `tests/unit/test_build_math1_history_banks.py`
- Modify: `src/config/bank-registry.js`
- Modify: `src/pages/practice-sub/bank-data-table.js`
- Add: `src/config/flashcard-banks/math1-2018.json`
- Add: `cdn-assets/question-bank/math1-2018/*`
- Modify: `data/release-blocker-backlog.json`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`

- [x] **Step 1: Inspect the source and add a failing structure test**

Downloaded the release-priority source:

```bash
.venv-baidu/bin/python scripts/baidu/pan.py download \
  '/EXAM-MASTER/考研历年真题/03.考研数学/01.考研数学【历年真题】/考研数学真题【真题及解析】（1987-2023）/【完整版】数学一真题答案解析/2018-数一考研真题及答案 .pdf' \
  'data/raw-inbox/src_2cd530d0c9237cd5d84c348f-2018数一考研真题及答案.pdf'
```

Rendered the PDF for visual inspection and confirmed an 8-page scanned paper-answer layout with same-page `【解析】` blocks. Added the 2018 structure test first; it failed with `KeyError: 2018`, confirming the test was guarding the missing spec.

- [x] **Step 2: Extend the Math I history builder**

Added `math1_2018_answers()` and a 2018 `SourceSpec`:

```text
card_numbers_for_spec(math1-2018) == 1..23
sections == 8 choice + 6 fill + 9 solution
q05 == ["q05a", "q05b"]
sourceId == src_2cd530d0c9237cd5d84c348f
```

The spec uses manual crop boxes for every question because the source mixes question text and analysis on the same page. q16 has a white drawbox mask to hide the same-line `【解析】` start while preserving the question prompt. `render_pdf_assets()` now renders into a throwaway `_rendered` subdirectory and deletes it afterward, avoiding tracked `tmp/pdfs/math1-history-release-assets` churn from non-padded Poppler filenames.

- [x] **Step 3: Generate, register, and regenerate compressed data**

Run:

```bash
python3 scripts/cleaning/build_math1_history_banks.py --years 2018 --force-assets
node scripts/build/generate-compressed-bank-modules.mjs
```

Result: generated `src/config/flashcard-banks/math1-2018.json` and 40 assets under `cdn-assets/question-bank/math1-2018`; compressed bank modules now include 71 published banks.

- [x] **Step 4: Run validation**

Run:

```bash
python3 -m unittest tests.unit.test_build_math1_history_banks
npm run test -- tests/unit/question-bank-release-gate.spec.js tests/unit/flashcard-bank-registry.spec.js
node scripts/build/question-bank-release-gate.mjs
node scripts/build/release-blocker-backlog.mjs
python3 scripts/baidu/cleaning_queue.py
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
```

Additional OCR leakage scan:

```bash
for p in cdn-assets/question-bank/math1-2018/question-*.jpg; do
  txt=$(tesseract "$p" stdout -l chi_sim+eng --psm 6 2>/dev/null || true)
  if printf '%s' "$txt" | rg -q '【分析|【详解|【解析|分析】|详解】|解析】|选[[:space:]]*[ABCD]|故选|因此选|\[[[:space:]]*[ABCD][[:space:]]*\]'; then
    echo "BAD $p"
  fi
done
```

Result: passed on 2026-06-02. `math1-2018.json` has 23 cards, `{flashcard:14, short_answer:9}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, 24 question crop assets, 8 answer pages, 8 paper pages, and no missing asset references. Sequential release audit refresh reports `coverageGaps=61`, `blockers=73`, `publicCourseBlockedSlots=61`; the next main queue dry-run starts at `2019数一真题及答案解析.pdf`.

- [x] **Step 5: Commit**

Run after final diff/whitespace checks:

```bash
git add scripts/cleaning/build_math1_history_banks.py tests/unit/test_build_math1_history_banks.py src/config/bank-registry.js src/pages/practice-sub/bank-data-table.js src/config/flashcard-banks/math1-2018.json cdn-assets/question-bank/math1-2018 data/release-blocker-backlog.json docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md docs/08C-SCRIPTS-REFERENCE.md docs/12-CHANGELOG.md
git -c core.hooksPath=/dev/null commit -m "chore: publish math1 2018 bank"
```

Result: committed after validation on 2026-06-02.

### Task 53: Publish Math I 2020 Page-Image Bank

**Files:**
- Modify: `scripts/cleaning/build_math1_history_banks.py`
- Modify: `tests/unit/test_build_math1_history_banks.py`
- Modify: `src/config/bank-registry.js`
- Modify: `src/pages/practice-sub/bank-data-table.js`
- Add: `src/config/flashcard-banks/math1-2020.json`
- Add: `cdn-assets/question-bank/math1-2020/*`
- Modify: `data/release-blocker-backlog.json`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`

- [x] **Step 1: Download, inspect, and add a failing structure test**

Downloaded the release-priority source:

```bash
.venv-baidu/bin/python scripts/baidu/pan.py download \
  '/EXAM-MASTER/考研历年真题/03.考研数学/01.考研数学【历年真题】/考研数学真题【真题及解析】（1987-2023）/【完整版】数学一真题答案解析/2020-数一真题答案解析 .pdf' \
  'data/raw-inbox/src_188f7642349fab77f135c2f5-2020数一真题答案解析.pdf'
```

Confirmed with `pdfinfo`, `pdftotext`, rendered page images, and visual inspection that it is a 13-page scanned answer-analysis PDF with same-page answers/解析 and no usable text layer. Added the 2020 structure test first; it failed with `KeyError: 2020`, proving the missing spec was guarded.

- [x] **Step 2: Extend the Math I history builder**

Added `math1_2020_answers()` and a 2020 `SourceSpec`:

```text
card_numbers_for_spec(math1-2020) == 1..23
sections == 8 choice + 6 fill + 9 solution
q08 == ["q08a", "q08b"]
sourceId == src_188f7642349fab77f135c2f5
```

The spec uses manual crop boxes for every question because the source mixes question text with same-page answers and analysis. q10, q14, q15, q16, and q23 crop heights were tuned after visual inspection before final generation.

- [x] **Step 3: Generate, register, and regenerate compressed data**

Run:

```bash
python3 scripts/cleaning/build_math1_history_banks.py --years 2020 --force-assets
node scripts/build/generate-compressed-bank-modules.mjs
```

Result: generated `src/config/flashcard-banks/math1-2020.json` and 50 assets under `cdn-assets/question-bank/math1-2020`; compressed bank modules now include 73 published banks.

- [x] **Step 4: Run validation**

Run:

```bash
python3 -m unittest tests.unit.test_build_math1_history_banks
npm run test -- tests/unit/question-bank-release-gate.spec.js tests/unit/flashcard-bank-registry.spec.js
node scripts/build/question-bank-release-gate.mjs
node scripts/build/release-blocker-backlog.mjs
python3 scripts/baidu/cleaning_queue.py
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
```

Additional OCR leakage scan:

```bash
for p in cdn-assets/question-bank/math1-2020/question-*.jpg; do
  txt=$(tesseract "$p" stdout -l chi_sim+eng --psm 6 2>/dev/null || true)
  if printf '%s' "$txt" | rg -q '【分析|【详解|【解析|【答案|分析】|详解】|解析】|答案】|选[[:space:]]*[ABCD]|故选|因此选|\[[[:space:]]*[ABCD][[:space:]]*\]'; then
    echo "BAD $p"
  fi
done
```

Result: passed on 2026-06-02. `math1-2020.json` has 23 cards, `{flashcard:14, short_answer:9}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, 24 question crop assets, 13 answer pages, 13 paper pages, and no missing asset references. Sequential release audit refresh reports `coverageGaps=59`, `blockers=71`, `publicCourseBlockedSlots=59`; the next main queue dry-run starts at `2021数一真题答案解析.pdf`.

- [x] **Step 5: Commit**

Run after final diff/whitespace checks:

```bash
git add scripts/cleaning/build_math1_history_banks.py tests/unit/test_build_math1_history_banks.py src/config/bank-registry.js src/pages/practice-sub/bank-data-table.js src/config/flashcard-banks/math1-2020.json cdn-assets/question-bank/math1-2020 data/release-blocker-backlog.json docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md docs/08C-SCRIPTS-REFERENCE.md docs/12-CHANGELOG.md
git -c core.hooksPath=/dev/null commit -m "chore: publish math1 2020 bank"
```

Result: committed after validation on 2026-06-02.

### Task 54: Publish Math I 2021 Page-Image Bank

**Files:**
- Modify: `scripts/cleaning/build_math1_history_banks.py`
- Modify: `tests/unit/test_build_math1_history_banks.py`
- Modify: `src/config/bank-registry.js`
- Modify: `src/pages/practice-sub/bank-data-table.js`
- Add: `src/config/flashcard-banks/math1-2021.json`
- Add: `cdn-assets/question-bank/math1-2021/*`
- Modify: `data/release-blocker-backlog.json`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`

- [x] **Step 1: Inspect the source and add a failing structure test**

Used the release-priority source:

```bash
data/raw-inbox/src_95ea7f661510831db3a2eb9e-2021数一真题答案解析.pdf
```

Confirmed with `pdfinfo`, `pdftotext`, rendered page images, and visual inspection that it is a 16-page scanned answer-analysis PDF with same-page answers/解析 and no usable text layer. Added the 2021 structure test first; it failed with `KeyError: 2021`, proving the missing spec was guarded.

- [x] **Step 2: Extend the Math I history builder**

Added `math1_2021_answers()` and a 2021 `SourceSpec`:

```text
card_numbers_for_spec(math1-2021) == 1..22
sections == 10 choice + 6 fill + 6 solution
q09 == ["q09a", "q09b"]
q22 == ["q22a", "q22b"]
sourceId == src_95ea7f661510831db3a2eb9e
```

The spec uses manual crop boxes for every question because the source mixes question text with same-page answers and analysis. q05, q09a, q20, and q21 crop heights were tuned after OCR/visual inspection. q22 uses a two-image prompt so the third subquestion at the top of page 16 remains visible before grading.

- [x] **Step 3: Generate, register, and regenerate compressed data**

Run:

```bash
python3 scripts/cleaning/build_math1_history_banks.py --years 2021 --force-assets
node scripts/build/generate-compressed-bank-modules.mjs
```

Result: generated `src/config/flashcard-banks/math1-2021.json` and 56 assets under `cdn-assets/question-bank/math1-2021`; compressed bank modules now include 74 published banks. `math1-2021` is registered as a special 10/6/6 entry rather than added to the 2005-2020 8/6/9 mapped block.

- [x] **Step 4: Run validation**

Run:

```bash
python3 -m unittest tests.unit.test_build_math1_history_banks
npm run test -- tests/unit/question-bank-release-gate.spec.js tests/unit/flashcard-bank-registry.spec.js
node scripts/build/question-bank-release-gate.mjs
node scripts/build/release-blocker-backlog.mjs
python3 scripts/baidu/cleaning_queue.py
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
```

Additional OCR leakage scan:

```bash
for p in cdn-assets/question-bank/math1-2021/question-*.jpg; do
  txt=$(tesseract "$p" stdout -l chi_sim+eng --psm 6 2>/dev/null || true)
  if printf '%s' "$txt" | rg -q '【分析|【详解|【解析|【答案|分析】|详解】|解析】|答案】|选[[:space:]]*[ABCD]|故选|因此选|应选|故应选|\[[[:space:]]*[ABCD][[:space:]]*\]'; then
    echo "BAD $p"
  fi
done
```

Result: passed on 2026-06-02. `math1-2021.json` has 22 cards, `{flashcard:16, short_answer:6}`, section counts `{选择题:10, 填空题:6, 解答题:6}`, 24 question crop assets, 16 answer pages, 16 paper pages, and no missing asset references. Sequential release audit refresh reports `coverageGaps=58`, `blockers=70`, `publicCourseBlockedSlots=58`; the next main queue dry-run starts at `2022数一真题答案解析.pdf`.

- [x] **Step 5: Commit**

Run after final diff/whitespace checks:

```bash
git add scripts/cleaning/build_math1_history_banks.py tests/unit/test_build_math1_history_banks.py src/config/bank-registry.js src/pages/practice-sub/bank-data-table.js src/config/flashcard-banks/math1-2021.json cdn-assets/question-bank/math1-2021 data/release-blocker-backlog.json docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md docs/08C-SCRIPTS-REFERENCE.md docs/12-CHANGELOG.md
git -c core.hooksPath=/dev/null commit -m "chore: publish math1 2021 bank"
```

Result: committed after validation on 2026-06-02.

### Task 55: Publish Math I 2022 Page-Image Bank

**Files:**
- Modify: `scripts/cleaning/build_math1_history_banks.py`
- Modify: `tests/unit/test_build_math1_history_banks.py`
- Modify: `src/config/bank-registry.js`
- Modify: `src/pages/practice-sub/bank-data-table.js`
- Add: `src/config/flashcard-banks/math1-2022.json`
- Add: `cdn-assets/question-bank/math1-2022/*`
- Modify: `data/release-blocker-backlog.json`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`

- [x] **Step 1: Inspect the source and add a failing structure test**

Used the release-priority source:

```bash
data/raw-inbox/src_97122ca7e5901e146b32e0c1-2022数一真题答案解析.pdf
```

Confirmed with `pdfinfo`, `pdftotext`, rendered page images, and visual inspection that it is an 11-page answer-analysis PDF with same-page answers/解析 and a weak text layer. Added the 2022 structure test before implementation to lock the 22-card 10/6/6 shape and q13/q22 evidence layout.

- [x] **Step 2: Extend the Math I history builder**

Added `math1_2022_answers()` and a 2022 `SourceSpec`:

```text
card_numbers_for_spec(math1-2022) == 1..22
sections == 10 choice + 6 fill + 6 solution
q13 == ["q13a", "q13b"]
answer_pages[22] == [10, 11]
sourceId == src_97122ca7e5901e146b32e0c1
```

The spec uses manual crop boxes for every question because the source mixes question text with same-page answers and analysis. q04, q06, q08, q12, q13, q18, q19, q20, q21, and q22 crop boundaries were tuned after OCR/visual inspection to remove leakage while preserving complete prompts.

- [x] **Step 3: Generate, register, and regenerate compressed data**

Run:

```bash
python3 scripts/cleaning/build_math1_history_banks.py --years 2022 --force-assets
node scripts/build/generate-compressed-bank-modules.mjs
```

Result: generated `src/config/flashcard-banks/math1-2022.json` and 45 assets under `cdn-assets/question-bank/math1-2022`; compressed bank modules now include 75 published banks. `math1-2022` is registered as a special 10/6/6 entry rather than added to the 2005-2020 8/6/9 mapped block.

- [x] **Step 4: Run validation**

Run:

```bash
python3 -m unittest tests.unit.test_build_math1_history_banks
npm run test -- tests/unit/question-bank-release-gate.spec.js tests/unit/flashcard-bank-registry.spec.js
node scripts/build/question-bank-release-gate.mjs
node scripts/build/release-blocker-backlog.mjs
python3 scripts/baidu/cleaning_queue.py
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Additional OCR leakage scan:

```bash
for p in cdn-assets/question-bank/math1-2022/question-*.jpg; do
  txt=$(tesseract "$p" stdout -l chi_sim+eng --psm 6 2>/dev/null || true)
  if printf '%s' "$txt" | rg -q '【分析|【详解|【解析|【答案|分析】|详解】|解析】|答案】|选[[:space:]]*[ABCD]|故选|因此选|应选|故应选|\[[[:space:]]*[ABCD][[:space:]]*\]'; then
    echo "BAD $p"
  fi
done
```

Result: passed on 2026-06-02. `math1-2022.json` has 22 cards, `{flashcard:16, short_answer:6}`, section counts `{选择题:10, 填空题:6, 解答题:6}`, 23 question crop assets, 11 answer pages, 11 paper pages, and no missing asset references. Sequential release audit refresh reports `coverageGaps=57`, `blockers=69`, `publicCourseBlockedSlots=57`; the next main queue dry-run starts at `1987数一真题、标准答案及解析.pdf`.

- [x] **Step 5: Commit**

Run after final diff/whitespace checks:

```bash
git add scripts/cleaning/build_math1_history_banks.py tests/unit/test_build_math1_history_banks.py src/config/bank-registry.js src/pages/practice-sub/bank-data-table.js src/config/flashcard-banks/math1-2022.json cdn-assets/question-bank/math1-2022 data/release-blocker-backlog.json docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md docs/08C-SCRIPTS-REFERENCE.md docs/12-CHANGELOG.md
git -c core.hooksPath=/dev/null commit -m "chore: publish math1 2022 bank"
```

Result: committed after validation on 2026-06-02.

### Task 56: Fix Historical Math Source Manifest Year Inference

**Files:**
- Modify: `scripts/baidu/source_manifest.py`
- Modify: `tests/unit/test_source_manifest_year.py`
- Modify: `data/release-blocker-backlog.json`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`

- [x] **Step 1: Reproduce the queue-year mismatch**

After publishing `math1-2022`, the release-priority dry-run incorrectly started with:

```text
1987数一真题、标准答案及解析.pdf
1988数一真题、标准答案及解析.pdf
1989数一真题、标准答案及解析.pdf
```

Those files were attached to `releaseBacklogSlot=math1:2023` because Source Manifest rejected 1980s filename years and then picked 2023 from the parent directory range `1987-2023`.

- [x] **Step 2: Add regression coverage and fix inference**

Added tests proving:

```text
1987数一真题、标准答案及解析.pdf -> year 1987
stale manifest row year=2023 + 1988 filename -> year 1988
```

Updated `source_manifest.py` so valid source years are 1980-2035 and a clear filename year refreshes stale derived manifest years before fallback path-range matching.

- [x] **Step 3: Refresh reports and queue**

Run:

```bash
python3 -m unittest tests.unit.test_source_manifest_year tests.unit.test_baidu_cleaning_queue tests.unit.test_baidu_cleaning_runner
python3 scripts/baidu/source_manifest.py --self-test
python3 scripts/baidu/source_manifest.py --input data/source-manifest.json --existing data/source-manifest.json --output data/source-manifest.json --source-channel netdisk_full_path
python3 scripts/baidu/manifest_quality.py --manifest data/source-manifest.json --output data/source-manifest-quality.json
node scripts/build/question-bank-release-gate.mjs
node scripts/build/release-blocker-backlog.mjs
python3 scripts/baidu/cleaning_queue.py
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Result: passed on 2026-06-02. Release metrics stayed at `coverageGaps=57`, `blockers=69`, `publicCourseBlockedSlots=57`, while release queue metadata dropped the misclassified 1987/1988/1989 rows and now starts at `2023数一真题答案解析.pdf`.

- [x] **Step 4: Commit**

Run:

```bash
git add scripts/baidu/source_manifest.py tests/unit/test_source_manifest_year.py data/release-blocker-backlog.json docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md docs/08C-SCRIPTS-REFERENCE.md docs/12-CHANGELOG.md
git -c core.hooksPath=/dev/null commit -m "chore: fix historical math source years"
```

Result: committed after validation on 2026-06-02.

### Task 57: Publish Math I 2023 Page-Image Bank

**Files:**
- Modify: `scripts/cleaning/build_math1_history_banks.py`
- Modify: `tests/unit/test_build_math1_history_banks.py`
- Modify: `src/config/bank-registry.js`
- Modify: `src/pages/practice-sub/bank-data-table.js`
- Add: `src/config/flashcard-banks/math1-2023.json`
- Add: `cdn-assets/question-bank/math1-2023/*`
- Modify: `data/release-blocker-backlog.json`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`

- [x] **Step 1: Inspect the corrected 2023 source**

Used the corrected release-priority queue item:

```text
data/raw-inbox/src_aa313861bc3f906e2af834b1-2023数一真题答案解析.pdf
```

The source has 16 pages and a weak text layer, so it follows the 2021/2022 page-image bank path rather than generic OCR/LLM cleaning. Visual inspection confirmed the 22-card new structure:

```text
1-10 选择题
11-16 填空题
17-22 解答题
```

- [x] **Step 2: Add 2023 source spec and regression coverage**

Added `math1_2023_answers()` plus a 2023 `SourceSpec` with manual per-question crop boxes. Split prompts:

```text
q07 -> q07a/q07b
q09 -> q09a/q09b
q20 -> q20a/q20b
q22 -> q22a/q22b
```

Regression coverage now asserts:

```text
card_numbers_for_spec(math1-2023) == 1..22
sections == 10 choice + 6 fill + 6 solution
type mapping == flashcard for 1-16, short_answer for 17-22
sourceId == src_aa313861bc3f906e2af834b1
```

- [x] **Step 3: Build and register the bank**

Run:

```bash
python3 -m unittest tests.unit.test_build_math1_history_banks
python3 scripts/cleaning/build_math1_history_banks.py --years 2023 --force-assets
node scripts/build/generate-compressed-bank-modules.mjs
```

Result: generated `src/config/flashcard-banks/math1-2023.json` and 58 assets under `cdn-assets/question-bank/math1-2023`; compressed bank modules now include 76 published banks. `math1-2023` is registered as a special 10/6/6 entry.

- [x] **Step 4: Verify question-image leakage and release metrics**

Run:

```bash
for p in cdn-assets/question-bank/math1-2023/question-*.jpg; do
  txt=$(tesseract "$p" stdout -l chi_sim+eng --psm 6 2>/dev/null || true)
  if printf '%s' "$txt" | rg -q '【分析|【详解|【解析|【答案|分析】|详解】|解析】|答案】|选[[:space:]]*[ABCD]|故选|因此选|应选|故应选|\[[[:space:]]*[ABCD][[:space:]]*\]'; then
    echo "BAD $p"
  fi
done
npm run test -- tests/unit/question-bank-release-gate.spec.js tests/unit/flashcard-bank-registry.spec.js
node scripts/build/question-bank-release-gate.mjs
node scripts/build/release-blocker-backlog.mjs
python3 scripts/baidu/cleaning_queue.py
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Result: passed on 2026-06-02. `math1-2023.json` has 22 cards, `{flashcard:16, short_answer:6}`, section counts `{选择题:10, 填空题:6, 解答题:6}`, 26 question crop assets, 16 answer pages, 16 paper pages, and no missing asset references. Sequential release audit refresh reports `coverageGaps=56`, `blockers=68`, `publicCourseBlockedSlots=56`; the next main queue dry-run starts at `2024年数学一真题及参考答案.pdf`.

- [x] **Step 5: Commit**

Run after final diff/whitespace checks:

```bash
git add scripts/cleaning/build_math1_history_banks.py tests/unit/test_build_math1_history_banks.py src/config/bank-registry.js src/pages/practice-sub/bank-data-table.js src/config/flashcard-banks/math1-2023.json cdn-assets/question-bank/math1-2023 data/release-blocker-backlog.json docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md docs/08C-SCRIPTS-REFERENCE.md docs/12-CHANGELOG.md
git -c core.hooksPath=/dev/null commit -m "chore: publish math1 2023 bank"
```

Result: committed after validation on 2026-06-02.

### Task 58: Publish Math I 2024 Page-Image Bank

**Files:**
- Modify: `scripts/cleaning/build_math1_history_banks.py`
- Modify: `tests/unit/test_build_math1_history_banks.py`
- Modify: `tests/unit/flashcard-bank-registry.spec.js`
- Modify: `src/config/bank-registry.js`
- Modify: `src/pages/practice-sub/bank-data-table.js`
- Add: `src/config/flashcard-banks/math1-2024.json`
- Add: `cdn-assets/question-bank/math1-2024/*`
- Modify: `data/release-blocker-backlog.json`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`

- [x] **Step 1: Download and inspect the 2024 source**

Used the release-priority queue item:

```text
clean_b118f0d19796f4fd11ca197b 2024年数学一真题及参考答案.pdf
```

Downloaded only the PDF through `pan.py download` to avoid running generic OCR/LLM cleaning:

```text
data/raw-inbox/src_a98e37e10d544ea2a7f1791b-2024年数学一真题及参考答案.pdf
```

`pdfinfo` reports 6 pages and 1,688,844 bytes. Page 6 is ad-only, so the release spec renders only pages 1-5 as question/answer evidence.

- [x] **Step 2: Add 2024 source spec and regression coverage**

Added `math1_2024_answers()` plus a 2024 `SourceSpec` with manual per-question crop boxes. The bank follows the newer 22-card Math I structure:

```text
1-10 选择题
11-16 填空题
17-22 解答题
```

Regression coverage now asserts the 2024 section/type mapping, `rendered_page_count == 5`, q04 answer evidence across pages 1-2, and the Baidu source id/file name.

- [x] **Step 3: Build, register, and refresh modules**

Run:

```bash
python3 -m unittest tests.unit.test_build_math1_history_banks
python3 scripts/cleaning/build_math1_history_banks.py --years 2024 --force-assets
node scripts/build/generate-compressed-bank-modules.mjs
```

Result: generated `src/config/flashcard-banks/math1-2024.json` and 32 assets under `cdn-assets/question-bank/math1-2024`; compressed bank modules now include 77 published banks. `math1-2024` is registered as a formal 10/6/6 entry.

- [x] **Step 4: Verify question-image leakage and release metrics**

Run:

```bash
for p in cdn-assets/question-bank/math1-2024/question-*.jpg; do
  text=$(tesseract "$p" stdout -l chi_sim+eng --psm 6 2>/dev/null | tr -d '[:space:]')
  if printf '%s' "$text" | rg -q '答案|解析|详解|【答案】|\[答案\]'; then
    printf '%s\t%s\n' "$(basename "$p")" "$text"
  fi
done
npm run test -- tests/unit/question-bank-release-gate.spec.js tests/unit/flashcard-bank-registry.spec.js
node scripts/build/question-bank-release-gate.mjs
node scripts/build/release-blocker-backlog.mjs
python3 scripts/baidu/cleaning_queue.py
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Result: passed on 2026-06-02. `math1-2024.json` has 22 cards, `{flashcard:16, short_answer:6}`, section counts `{选择题:10, 填空题:6, 解答题:6}`, 22 question crop assets, 5 answer pages, 5 paper pages, and no missing asset references. Sequential release audit refresh reports `coverageGaps=55`, `blockers=67`, `publicCourseBlockedSlots=55`; the next main queue dry-run starts at `2016考研数学二真题.pdf`.

- [x] **Step 5: Commit**

Run after final diff/whitespace checks:

```bash
git add scripts/cleaning/build_math1_history_banks.py tests/unit/test_build_math1_history_banks.py tests/unit/flashcard-bank-registry.spec.js src/config/bank-registry.js src/pages/practice-sub/bank-data-table.js src/config/flashcard-banks/math1-2024.json cdn-assets/question-bank/math1-2024 data/release-blocker-backlog.json docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md docs/08C-SCRIPTS-REFERENCE.md docs/12-CHANGELOG.md
git -c core.hooksPath=/dev/null commit -m "chore: publish math1 2024 bank"
```

Result: committed after validation on 2026-06-02.

### Task 52: Publish Math I 2019 Page-Image Bank

**Files:**
- Modify: `scripts/cleaning/build_math1_history_banks.py`
- Modify: `tests/unit/test_build_math1_history_banks.py`
- Modify: `src/config/bank-registry.js`
- Modify: `src/pages/practice-sub/bank-data-table.js`
- Add: `src/config/flashcard-banks/math1-2019.json`
- Add: `cdn-assets/question-bank/math1-2019/*`
- Modify: `data/release-blocker-backlog.json`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`

- [x] **Step 1: Inspect the source and add a failing structure test**

Used the release-priority source:

```bash
data/raw-inbox/src_f326d54beafcd7be5faed00f-2019数一真题及答案解析.pdf
```

Confirmed with `pdfinfo`, `pdftotext`, rendered page images, and visual inspection that it is a 15-page scanned answer-analysis PDF with same-page answers/解析 and no usable text layer. Added the 2019 structure test first; it failed with `KeyError: 2019`, proving the missing spec was guarded.

- [x] **Step 2: Extend the Math I history builder**

Added `math1_2019_answers()` and a 2019 `SourceSpec`:

```text
card_numbers_for_spec(math1-2019) == 1..23
sections == 8 choice + 6 fill + 9 solution
q04 == ["q04a", "q04b"]
q06 == ["q06a", "q06b"]
q13 == ["q13a", "q13b"]
sourceId == src_f326d54beafcd7be5faed00f
```

The spec uses manual crop boxes for every question because the source mixes question text with same-page answers and analysis. q18 and q22 crop heights were tuned after visual inspection before final generation.

- [x] **Step 3: Generate, register, and regenerate compressed data**

Run:

```bash
python3 scripts/cleaning/build_math1_history_banks.py --years 2019 --force-assets
node scripts/build/generate-compressed-bank-modules.mjs
```

Result: generated `src/config/flashcard-banks/math1-2019.json` and 56 assets under `cdn-assets/question-bank/math1-2019`; compressed bank modules now include 72 published banks.

- [x] **Step 4: Run validation**

Run:

```bash
python3 -m unittest tests.unit.test_build_math1_history_banks
npm run test -- tests/unit/question-bank-release-gate.spec.js tests/unit/flashcard-bank-registry.spec.js
node scripts/build/question-bank-release-gate.mjs
node scripts/build/release-blocker-backlog.mjs
python3 scripts/baidu/cleaning_queue.py
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
```

Additional OCR leakage scan:

```bash
for p in cdn-assets/question-bank/math1-2019/question-*.jpg; do
  txt=$(tesseract "$p" stdout -l chi_sim+eng --psm 6 2>/dev/null || true)
  if printf '%s' "$txt" | rg -q '【分析|【详解|【解析|【答案|分析】|详解】|解析】|答案】|选[[:space:]]*[ABCD]|故选|因此选|\[[[:space:]]*[ABCD][[:space:]]*\]'; then
    echo "BAD $p"
  fi
done
```

Result: passed on 2026-06-02. `math1-2019.json` has 23 cards, `{flashcard:14, short_answer:9}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, 26 question crop assets, 15 answer pages, 15 paper pages, and no missing asset references. Sequential release audit refresh reports `coverageGaps=60`, `blockers=72`, `publicCourseBlockedSlots=60`; the next main queue dry-run starts at `2020数一真题答案解析.pdf`.

- [x] **Step 5: Commit**

Run after final diff/whitespace checks:

```bash
git add scripts/cleaning/build_math1_history_banks.py tests/unit/test_build_math1_history_banks.py src/config/bank-registry.js src/pages/practice-sub/bank-data-table.js src/config/flashcard-banks/math1-2019.json cdn-assets/question-bank/math1-2019 data/release-blocker-backlog.json docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md docs/08C-SCRIPTS-REFERENCE.md docs/12-CHANGELOG.md
git -c core.hooksPath=/dev/null commit -m "chore: publish math1 2019 bank"
```

Result: committed after validation on 2026-06-02.

### Task 48: Publish Math I 2007 Page-Image Bank

**Files:**
- Modify: `scripts/cleaning/build_math1_history_banks.py`
- Add: `tests/unit/test_build_math1_history_banks.py`
- Add: `src/config/flashcard-banks/math1-2007.json`
- Add: `cdn-assets/question-bank/math1-2007/*`
- Modify: `src/config/bank-registry.js`
- Modify: `src/pages/practice-sub/bank-data-table.js`
- Modify: `data/release-blocker-backlog.json`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`

- [x] **Step 1: Add 2007 Math I historical structure**

Extended `build_math1_history_banks.py` so `math1:2007` uses its historical 24-card shape: 10 choice, 6 fill-in-the-blank, and 8 solution questions.

The 2007 spec uses explicit crop boxes and multi-image refs for cross-page prompts such as q09 and q24. Choice-answer brackets are hidden with white `drawbox` masks, and long solution questions are cropped to the prompt before `【分析】` / `【详解】`.

- [x] **Step 2: Add regression coverage**

Added `tests/unit/test_build_math1_history_banks.py` assertions for:

```text
card_numbers_for_spec(math1-2007) == 1..24
section/type boundaries: 1-10 choice, 11-16 fill, 17-24 solution
q09 -> q09a/q09b
q19 -> q19a
q24 -> q24a/q24b
```

- [x] **Step 3: Generate bank and assets**

Run:
```bash
python3 scripts/cleaning/build_math1_history_banks.py --years 2007 --force-assets
```

Result: generated `src/config/flashcard-banks/math1-2007.json` and 51 assets under `cdn-assets/question-bank/math1-2007`.

Structured output:

```text
total_cards=24
typeCounts={single_choice:10, short_answer:14}
sectionCounts={选择题:10, 填空题:6, 解答题:8}
sourceFile=src_b6edc23c70615d39f9fbe692-2007数一标准答案及解析.pdf
sha256=sha256:677b494e3ef715ed06bb9300dd417d75cf501f5b3bce8befc2a8a5019a9997b3
```

- [x] **Step 4: Verify question-image leakage**

Run:
```bash
for p in cdn-assets/question-bank/math1-2007/question-*.jpg; do
  txt=$(tesseract "$p" stdout -l chi_sim+eng --psm 6 2>/dev/null || true)
  if printf '%s' "$txt" | rg -q '【分析|【详解|分析】|详解】|\[[[:space:]]*[ABCD][[:space:]]*\]'; then
    echo "BAD $p"
    printf '%s\n' "$txt" | sed -n '1,14p'
  fi
done
```

Result: no leaked analysis/detail tags or `[A-D]` answer brackets were detected in generated question images. Manual visual inspection also checked q09a/q09b, q19a, q22, and q24b after crop tuning.

- [x] **Step 5: Register and refresh release reports**

Run:
```bash
node scripts/build/generate-compressed-bank-modules.mjs
node scripts/build/question-bank-release-gate.mjs
node scripts/build/release-blocker-backlog.mjs
python3 scripts/baidu/cleaning_queue.py
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
```

Result: formal enabled-bank count rose to 70, public-course coverage gaps fell to 62, release blockers fell to 74, public-course blocked slots fell to 62, and `math1:2007` no longer appears in the refreshed backlog.

The refreshed runner dry-run now skips 2007 and begins with later release-priority tasks including `2018数一考研真题及答案.pdf`, `2019数一真题及答案解析.pdf`, and `2016考研数学二真题.pdf`.

### Task 45: Publish Math I 2006 Page-Image Bank

**Files:**
- Modify: `scripts/cleaning/build_math1_history_banks.py`
- Modify: `scripts/build/question-bank-release-gate.mjs`
- Modify: `src/config/bank-registry.js`
- Modify: `src/pages/practice-sub/bank-data-table.js`
- Modify: `data/release-blocker-backlog.json`
- Modify: `tests/unit/question-bank-release-gate.spec.js`
- Create: `src/config/flashcard-banks/math1-2006.json`
- Create: `cdn-assets/question-bank/math1-2006/*.jpg`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`

- [x] **Step 1: Use the page-image builder path**

Chose `build_math1_history_banks.py` instead of a generic LLM cleaning run for `2006数一标准答案及解析.pdf`, because the source is formula-heavy and mixes题面, answers, and explanations on rendered pages.

- [x] **Step 2: Add the 2006 Math I source spec**

Added a 2006 `SourceSpec`, default-year inclusion, 2006-specific section/type mapping, A-D choice placeholders, and support for nonnumeric question crop refs such as `q09a` / `q09b`.

- [x] **Step 3: Add audited manual crops**

Added fixed crop boxes for the 23-question 2006 source so the pre-answer question images hide same-page answer/explanation text while preserving formula and diagram fidelity.

- [x] **Step 4: Build and register the bank**

Run:
```bash
python3 scripts/cleaning/build_math1_history_banks.py --years 2006 --force-assets
node scripts/build/generate-compressed-bank-modules.mjs
node scripts/build/question-bank-release-gate.mjs
node scripts/build/release-blocker-backlog.mjs
```

Result: `math1-2006` now has 23 cards, `{single_choice:8, short_answer:15}`, `missingAnswerCount=0`, and runner `qualityIssues=[]`. The formal enabled-bank count rose to 68 and coverage gaps fell to 64.

- [x] **Step 5: Close the same-source Source Manifest blocker**

Added release-gate coverage for historical math files named `YYYY-数一/二/三标准答案及解析.pdf`. Same-year files now infer as `paper_answer`, while mismatched-year files stay answer-only to avoid hiding manifest slot errors.

Result: the refreshed backlog removes both `coverage_missing:math1:2006` and `source_evidence_missing:math1:2006`; total release blockers dropped to 76, public-course blocked slots to 64, and `sourceEvidenceGaps` to 11.

### Task 46: Publish Math I 2005 Page-Image Bank

**Files:**
- Modify: `scripts/cleaning/build_math1_history_banks.py`
- Modify: `src/config/bank-registry.js`
- Modify: `src/pages/practice-sub/bank-data-table.js`
- Modify: `data/release-blocker-backlog.json`
- Create: `src/config/flashcard-banks/math1-2005.json`
- Create: `cdn-assets/question-bank/math1-2005/*.jpg`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`

- [x] **Step 1: Select the 2005 source path**

Used the existing Math I historical page-image builder instead of the generic LLM cleaner. The local source is `data/raw-inbox/src_c4907b9c46d2472fb0b3365c-2005数一标准答案及解析.pdf`, a scanned answer-analysis PDF with 13 pages and no reliable text layer.

Source caveat: this is not a standalone blank paper. Choice answer brackets can be masked from pre-answer question crops, but fill-in-the-blank questions 1-6 are already filled inline in the source page.

- [x] **Step 2: Add 2005 crop and mask support**

Extended `SourceSpec` with optional `question_crop_masks` and taught `crop_question_assets()` to combine ffmpeg `crop` with one or more white `drawbox` masks. The 2005 choice questions use wider crop boxes to preserve formulas/options, then mask the visible answer bracket area.

- [x] **Step 3: Build and inspect the bank**

Run:
```bash
python3 scripts/cleaning/build_math1_history_banks.py --years 2005 --force-assets
```

Result: generated `math1-2005` with 23 cards and 50 assets. Structure is `{single_choice:8, short_answer:15}` with sections `{填空题:6, 选择题:8, 解答题:9}`.

- [x] **Step 4: Verify question-image leakage**

Run:
```bash
for p in cdn-assets/question-bank/math1-2005/question-*.jpg; do
  txt=$(tesseract "$p" stdout -l chi_sim+eng --psm 6 2>/dev/null || true)
  if printf '%s' "$txt" | rg -q '【分析|【详解|分析】|详解】|\[[[:space:]]*[ABCD][[:space:]]*\]'; then
    echo "BAD $p"
    printf '%s\n' "$txt" | sed -n '1,14p'
  fi
done
```

Result: no leaked analysis/detail tags or `[A-D]` answer brackets were detected in generated question images. Manual visual inspection also caught and fixed over-cropped q08/q10/q12/q14 choices before release registration.

- [x] **Step 5: Register and refresh release reports**

Run:
```bash
node scripts/build/generate-compressed-bank-modules.mjs
node scripts/build/question-bank-release-gate.mjs
node scripts/build/release-blocker-backlog.mjs
```

Result: formal enabled-bank count rose to 69, public-course coverage gaps fell to 63, release blockers fell to 75, public-course blocked slots fell to 63, and `math1:2005` no longer appears in the refreshed backlog.

### Task 44: Gate Math Main-Paper Cleaning Structure

**Files:**
- Modify: `scripts/baidu/run_cleaning_queue.py`
- Modify: `tests/unit/test_baidu_cleaning_runner.py`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add math structural minimums**

Added `math1`, `math2`, and `math3` quality minimums to the cleaning runner: `total>=23`, `choice_like>=8`, and `short_answer>=9`.

The `choice_like` count accepts both `single_choice` and the older math1 history-bank `flashcard` representation so valid local history banks are not penalized by type naming drift.

- [x] **Step 2: Add regression coverage**

Added runner tests proving an incomplete `math2:2016` distribution is flagged, while a valid `math1:2012` history-style distribution with 14 `flashcard` cards and 9 `short_answer` cards passes.

- [x] **Step 3: Run validation**

Run:
```bash
python3 -m unittest tests.unit.test_baidu_cleaning_runner tests.unit.test_baidu_cleaning_queue
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Result: passed on 2026-06-02. Main dry-run still starts at `2006数一标准答案及解析.pdf`, but future real math cleaning runs now fail closed on incomplete structure.

- [x] **Step 4: Commit**

Run:
```bash
git add scripts/baidu/run_cleaning_queue.py tests/unit/test_baidu_cleaning_runner.py docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git -c core.hooksPath=/dev/null commit -m "chore: gate math cleaning structure"
```

Result: committed after validation on 2026-06-02.

### Task 43: Classify English Analysis Sources As Support Evidence

**Files:**
- Modify: `scripts/baidu/run_cleaning_queue.py`
- Modify: `tests/unit/test_baidu_cleaning_runner.py`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`

- [x] **Step 1: Add queue classification coverage**

Added a runner regression test proving English files named `2019考研英语一真题及解析.pdf` and `2019考研英语（一）真题及答案解析.pdf` are support evidence, not main-paper cleaning tasks.

- [x] **Step 2: Extend support-evidence naming rules**

Updated `is_support_evidence_task()` so `真题及解析` is treated like existing `真题解析` / `答案解析` support material. Math combined-paper exceptions remain intact, so math release tasks such as `2006数一标准答案及解析.pdf` still stay in the main queue.

- [x] **Step 3: Re-run release-priority dry-run**

Run:
```bash
python3 -m unittest tests.unit.test_baidu_cleaning_runner tests.unit.test_baidu_cleaning_queue
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
git diff --check
```

Result: passed on 2026-06-02. Main dry-run now advances past the already-repaired English analysis sources and starts at `2006数一标准答案及解析.pdf`, followed by `2016考研数学二真题.pdf`, `2015年考研数学三真题及解析.pdf`, and `2020年考研英语一真题.pdf`.

- [x] **Step 4: Commit**

Run:
```bash
git add scripts/baidu/run_cleaning_queue.py tests/unit/test_baidu_cleaning_runner.py docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md
git -c core.hooksPath=/dev/null commit -m "chore: classify english analysis sources as support"
```

Result: committed after validation on 2026-06-02.

### Task 47: Audit Politics 2023 Answer Source Completeness

**Files:**
- Modify: `scripts/cleaning/audit_public_course_2025.py`
- Modify: `scripts/build/release-blocker-backlog.mjs`
- Add: `tests/unit/test_public_course_source_audit.py`
- Modify: `tests/unit/release-blocker-backlog.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`

- [x] **Step 1: Turn the 2023 politics source finding into an audit gate**

Extended `audit_public_course_2025.py` beyond the default 2025 root:

```bash
python3 scripts/cleaning/audit_public_course_2025.py \
  --root data/raw-inbox/public-course-history/politics/2023 \
  --audit-output /tmp/politics-2023-source-audit.json \
  --skip-draft
```

The script now infers history-root track/year/role metadata and checks politics answer or paper-answer PDFs for numbered `【答案】` / `【答案要点】` markers.

Result: the real `politics:2023` local audit reports two readable files, with the paper-answer source blocked by `missing_answer_markers:10,11`.

- [x] **Step 2: Keep release backlog from treating incomplete answer sources as auto-pairable**

Updated `release-blocker-backlog.mjs` so coverage rows also consult `sourceManifestRegistrationChecklist`. When a loaded local source audit has a blocked paper/answer companion, the slot next action now points operators to fix or replace that local answer source before auto-pairing, even if Source Manifest already has candidate/publishable-looking rows for the same slot.

Regression coverage locks the `politics:2023` case: readable `paper` plus blocked `paper_answer` produces `blocked_before_auto_pair`, `local_answer_file_blocked`, and an action that says to resolve the answer-file blocker before continuing.

- [x] **Step 3: Run validation**

Run:
```bash
python3 -m unittest tests.unit.test_public_course_source_audit
npm run test -- tests/unit/release-blocker-backlog.spec.js
python3 scripts/cleaning/audit_public_course_2025.py --root data/raw-inbox/public-course-history/politics/2023 --audit-output /tmp/politics-2023-source-audit.json --skip-draft
node scripts/build/release-blocker-backlog.mjs --local-source-audit /tmp/politics-2023-source-audit.json --output /tmp/release-blocker-backlog.json --markdown /tmp/release-blocker-backlog.md
node scripts/build/question-bank-release-gate.mjs
node scripts/build/release-blocker-backlog.mjs
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 8 --source-type official_paper --paper-role main
```

Result: passed on 2026-06-02. The temporary `politics:2023` backlog reports `sourceEvidenceStatus=publishable_source_present`, `checklistStatus=blocked_before_auto_pair`, and `blockers=["local_answer_file_blocked"]`; the action is to supplement or replace the incomplete answer file before refreshing Source Manifest auto-pairing. The default release backlog remains at 75 blockers and 63 public-course blocked slots after the latest report refresh.

- [x] **Step 4: Commit**

Run:
```bash
git add scripts/cleaning/audit_public_course_2025.py scripts/build/release-blocker-backlog.mjs tests/unit/test_public_course_source_audit.py tests/unit/release-blocker-backlog.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md docs/08C-SCRIPTS-REFERENCE.md docs/12-CHANGELOG.md data/release-blocker-backlog.json
git -c core.hooksPath=/dev/null commit -m "chore: audit politics answer source completeness"
```

Result: committed after validation on 2026-06-02.

### Task 60: Correct English II Coverage Start Year

**Files:**
- Modify: `src/config/bank-registry.js`
- Modify: `scripts/build/question-bank-release-gate.mjs`
- Modify: `tests/unit/flashcard-bank-registry.spec.js`
- Modify: `tests/unit/question-bank-release-gate.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`

- [x] **Step 1: Add failing coverage regression**

Added registry coverage for the real English II start year:

```bash
npm test -- tests/unit/flashcard-bank-registry.spec.js
```

Initial result: failed because `english2` still required 2005 as the first slot when the global audit range was 2005-2020.

- [x] **Step 2: Share per-track required-year policy**

Added `buildPublicCourseRequiredYearsForTrack()` with `english2` starting at 2010 and used it inside `buildPublicCourseCoverage()`.

Added release-gate coverage proving Source Manifest evidence also ignores English II 2005-2009, so the source-evidence report cannot keep impossible blockers after registry coverage is corrected.

- [x] **Step 3: Run validation and 2020 audit**

Run:
```bash
npm test -- tests/unit/flashcard-bank-registry.spec.js tests/unit/question-bank-release-gate.spec.js tests/unit/release-blocker-backlog.spec.js
node scripts/build/question-bank-release-gate.mjs --min-year=2005 --max-year=2020
```

Result: passed on 2026-06-02. The real 2005-2020 audit now reports `requiredSlots=91`, `publishedSlots=64`, `coverageGaps=27`, `sourceEvidenceGaps=1`, and `pendingCoverageBlockers=0`.

Remaining real 2020 target gaps: English I 2018-2020, English II 2010-2020, Math II 2015-2020, Math III 2014-2020. `math2:2016` remains source-blocked because the current candidate is known mislabeled 2014 content.

- [x] **Step 4: Commit**

Run:
```bash
git add src/config/bank-registry.js scripts/build/question-bank-release-gate.mjs tests/unit/flashcard-bank-registry.spec.js tests/unit/question-bank-release-gate.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md docs/08C-SCRIPTS-REFERENCE.md docs/12-CHANGELOG.md
git -c core.hooksPath=/dev/null commit -m "chore: correct english2 coverage start year"
```

Result: committed after validation on 2026-06-02.

### Task 61: Publish Math III 2015 Page-Image Bank

**Files:**
- Add: `scripts/cleaning/build_math3_2015_bank.py`
- Add: `src/config/flashcard-banks/math3-2015.json`
- Add: `cdn-assets/question-bank/math3-2015/*`
- Modify: `src/config/bank-registry.js`
- Modify: `src/pages/practice-sub/bank-data-table.js`
- Modify: `src/pages/practice-sub/question-bank.vue`
- Modify: `tests/unit/flashcard-bank-registry.spec.js`
- Modify: `tests/unit/question-bank-year-map.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`
- Modify: `data/release-blocker-backlog.json`

- [x] **Step 1: Add failing registry coverage**

Added a registry/load regression for `math3-2015` expecting 23 cards, matched evidence, answer `D` for q01, answer `1/2` for q14, and a q23 question image under `question-bank/math3-2015`.

Initial result:
```bash
npm test -- tests/unit/flashcard-bank-registry.spec.js
```

Failed because `math3-2015` was not registered or compressed yet.

- [x] **Step 2: Verify source and build page-image bank**

Downloaded the Baidu Netdisk source into ignored raw-inbox:

```bash
set -a && source .env && set +a && .venv-baidu/bin/python scripts/baidu/pan.py download \
  '/EXAM-MASTER/考研历年真题/03.考研数学/01.考研数学【历年真题】/考研数学真题【真题及解析】（1987-2023）/【完整版】数学三真题答案解析/2015年考研数学三真题及解析 .pdf' \
  'data/raw-inbox/src_08c2498ac7b58e3542942300-2015年考研数学三真题及解析.pdf'
```

Source audit: 12-page scanned answer-analysis PDF, no usable text layer, no ad-only page, content matches 2015 Math III. Added `build_math3_2015_bank.py` with 23 cards, rendered answer pages, and per-question crops.

- [x] **Step 3: Register and refresh practice data**

Run:
```bash
python3 scripts/cleaning/build_math3_2015_bank.py --force-assets
node scripts/build/generate-compressed-bank-modules.mjs
```

Result: published `src/config/flashcard-banks/math3-2015.json` plus 37 assets under `cdn-assets/question-bank/math3-2015`.

- [x] **Step 4: Run validation**

Run:
```bash
npm test -- tests/unit/flashcard-bank-registry.spec.js tests/unit/question-bank-year-map.spec.js tests/unit/question-bank-release-gate.spec.js tests/unit/release-blocker-backlog.spec.js
node scripts/build/question-bank-release-gate.mjs --min-year=2005 --max-year=2020
node scripts/build/release-blocker-backlog.mjs
python3 scripts/baidu/cleaning_queue.py
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 12 --source-type official_paper --paper-role main --max-year 2020
```

Question-image leakage scan:
```bash
bad=0
for p in cdn-assets/question-bank/math3-2015/question-*.jpg; do
  txt=$(tesseract "$p" stdout -l chi_sim+eng --psm 6 2>/dev/null || true)
  if printf '%s' "$txt" | rg -q '【答案|【解析|答案】|解析】|故选|所以选|选[ABCDEF]|\[[[:space:]]*[ABCD][[:space:]]*\]'; then
    echo "BAD $p"
    bad=$((bad+1))
  fi
done
test "$bad" -eq 0
```

Result: passed on 2026-06-02. The 2005-2020 release gate now reports `coverageGaps=26`, `sourceEvidenceGaps=1`, and `pendingCoverageBlockers=0`; release backlog reports 26 public-course blocked slots. Rebuilt cleaning queue no longer schedules `math3:2015`.

- [x] **Step 5: Commit**

Run:
```bash
git add scripts/cleaning/build_math3_2015_bank.py src/config/flashcard-banks/math3-2015.json cdn-assets/question-bank/math3-2015 src/config/bank-registry.js src/pages/practice-sub/bank-data-table.js src/pages/practice-sub/question-bank.vue tests/unit/flashcard-bank-registry.spec.js tests/unit/question-bank-year-map.spec.js docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md docs/08C-SCRIPTS-REFERENCE.md docs/12-CHANGELOG.md data/release-blocker-backlog.json
git -c core.hooksPath=/dev/null commit -m "chore: publish math3 2015 bank"
```

Result: committed after validation on 2026-06-02.

### Task 62: Publish Math III 2014 Page-Image Bank

**Files:**
- Add: `scripts/cleaning/build_math3_2014_bank.py`
- Add: `src/config/flashcard-banks/math3-2014.json`
- Add: `cdn-assets/question-bank/math3-2014/*`
- Modify: `src/config/bank-registry.js`
- Modify: `src/pages/practice-sub/bank-data-table.js`
- Modify: `tests/unit/flashcard-bank-registry.spec.js`
- Modify: `tests/unit/question-bank-year-map.spec.js`
- Modify: `docs/frontend-experience-refactor-diary.md`
- Modify: `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md`
- Modify: `docs/08C-SCRIPTS-REFERENCE.md`
- Modify: `docs/12-CHANGELOG.md`
- Modify: `data/release-blocker-backlog.json`

- [x] **Step 1: Add failing registry coverage**

Added a registry/load regression for `math3-2014` expecting 23 cards, matched answer evidence, answer `A` for q01, answer `2 / (5n)` for q14, and a q23 question image under `question-bank/math3-2014`.

Initial result:
```bash
npm test -- tests/unit/flashcard-bank-registry.spec.js
```

Failed because `math3-2014` was not registered or compressed yet.

- [x] **Step 2: Verify source and build page-image bank**

Used local raw-inbox source:

```text
data/raw-inbox/src_bd3bb496ed9148e3cd0127d9-2014年考研数学三真题及解析.pdf
```

Source audit: 13-page scanned answer-analysis PDF, no usable text layer, SHA-256 `9b80c47a4411a9f006087e0ddf609f9b6d04bd467db1aaa1f4b418c81a647a35`. Added `build_math3_2014_bank.py` with 23 cards, rendered answer pages, and per-question crops.

- [x] **Step 3: Register and refresh practice data**

Run:
```bash
python3 scripts/cleaning/build_math3_2014_bank.py --force-assets
node scripts/build/generate-compressed-bank-modules.mjs
```

Result: published `src/config/flashcard-banks/math3-2014.json` plus 36 assets under `cdn-assets/question-bank/math3-2014`.

- [x] **Step 4: Run validation**

Run:
```bash
npm test -- tests/unit/flashcard-bank-registry.spec.js tests/unit/question-bank-year-map.spec.js tests/unit/question-bank-release-gate.spec.js tests/unit/release-blocker-backlog.spec.js
node scripts/build/question-bank-release-gate.mjs --min-year=2005 --max-year=2020
node scripts/build/release-blocker-backlog.mjs
python3 scripts/baidu/run_cleaning_queue.py --dry-run --limit 12 --source-type official_paper --paper-role main --max-year 2020
git diff --check
```

Question-image leakage scan:
```bash
bad=0
for p in cdn-assets/question-bank/math3-2014/question-*.jpg; do
  txt=$(tesseract "$p" stdout -l chi_sim+eng --psm 6 2>/dev/null || true)
  if printf '%s' "$txt" | rg -q '【答案|【解析|答案】|解析】|故选|所以选|选[ABCDEF]|\[[[:space:]]*[ABCD][[:space:]]*\]'; then
    echo "BAD $p"
    bad=$((bad+1))
  fi
done
test "$bad" -eq 0
```

Result: passed on 2026-06-02. q02/q03 crop heights were tightened after the first leakage scan; the final scan produced no answer-marker hits. The 2005-2020 release gate reports `coverageGaps=25`, `sourceEvidenceGaps=1`, and `pendingCoverageBlockers=0`; release backlog reports 25 public-course blocked slots.

- [x] **Step 5: Commit**

Run:
```bash
git add data/release-blocker-backlog.json docs/08C-SCRIPTS-REFERENCE.md docs/12-CHANGELOG.md docs/frontend-experience-refactor-diary.md docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md src/config/bank-registry.js src/pages/practice-sub/bank-data-table.js tests/unit/flashcard-bank-registry.spec.js tests/unit/question-bank-year-map.spec.js scripts/cleaning/build_math3_2014_bank.py src/config/flashcard-banks/math3-2014.json cdn-assets/question-bank/math3-2014
git -c core.hooksPath=/dev/null commit -m "chore: publish math3 2014 bank"
```

Result: committed after validation on 2026-06-02.
