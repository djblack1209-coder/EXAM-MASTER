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
