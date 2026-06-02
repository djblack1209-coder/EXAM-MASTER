# Frontend Experience Refactor Diary

> Started: 2026-06-01
> Goal: rebuild the mini-program learning experience around the current 3-tab product, using v1.0.0 as visual reference without copying its old product surface.

## Direction

- Product feel: Baicizhan-like answer certainty, Duolingo-like session momentum, Wise-light trust, Bitget/Plasma-dark information depth.
- Current source of truth: `src/pages.json` and the active mini-program routes, not historical v1 pages.
- v1.0.0 role: visual DNA only. Do not restore obsolete surfaces such as the old school-selection tab.

## Engineering Rules

- Preserve existing quiz, bank, auth, and progress logic unless a UI bug forces a narrow fix.
- Keep all visible icons inside the icon system or static assets. No emoji as UI icons.
- Keep sound and haptic feedback behind preferences.
- Use one motion vocabulary: press scale, progress glide, card entrance, answer feedback, completion fanfare.
- Use theme tokens for color. Avoid hard-coded light/dark patches in new UI.
- Every visible page must handle loading, empty, error, and bottom safe-area states.

## Audit Checklist

- Navigation: tab routes, subpage routes, and fallback navigation do not throw or blank.
- Theme: light/dark mode changes the full shell, cards, text, modals, and icons.
- Quiz core: progress is visible, answer feedback is immediate, sound/haptic are consistent, and result/next actions are stable.
- Layout: no nested-card clutter, no tabbar overlap, no text overflow on 375px width.
- Product cleanup: no visible school-selection surface unless it is part of the current mini-program scope.

## Phase Log

### 2026-06-01

- Started from current dirty worktree. There are existing user changes in question-bank and quiz files, so refactor must be incremental.
- Found existing `quiz-sound.js` already supports tap/correct/wrong/combo/flip/complete sounds with haptic fallback.
- First change target: centralize haptic preference and make quiz progress visually clearer before broader shell work.
- Added settings toggles for quiz sound and haptic feedback.
- Made tabbar, home, and practice pages subscribe to theme updates instead of relying on incidental parent state.
- Verification: targeted lint passed; `frontend-copy-guard` and `practice-dynamic-methods` passed; `npm run build:mp-weixin` passed.

### 2026-06-01 Round 2

- Checkpoint commit created before continuing: `4cb5148`.
- Removed visible emoji celebrations from the quiz completion page; replaced them with `BaseIcon` marks.
- Tightened quiz card, option, and answer-result panel styling so the core flow feels like one system.
- Added dark-mode guardrails to the quiz page cards, options, timers, and result panel.

### 2026-06-01 Round 3

- Commit created: `61672d7`.
- Cleaned the settings page away from the obsolete school-selection surface:
  - visible "报考院校/目标院校" became "备考方向/已载题库";
  - the old target-school modal, handlers, and dead CSS were removed;
  - the cartoon shield image was replaced with `BaseIcon`.
- Added dark-mode coverage to the profile page and quiz progress component so core tabs no longer visually snap between themes.
- Core path audit result: no visible emoji/cartoon/school-selection copy remains in Home, Practice, Quiz, Result, Profile, Settings, tabbar, or common modal surfaces. Remaining `user_school_info` is a compatibility storage key, not visible UI.
- Verification: targeted lint passed, `frontend-copy-guard`/`practice-dynamic-methods`/`integration-quiz` passed, and `npm run build:mp-weixin` passed.

### 2026-06-01 Round 4

- Planning update: added `docs/superpowers/plans/2026-06-01-commercial-quiz-mini-program.md` to define the next commercial-release sequence:
  1. core practice feel;
  2. shell and route cohesion;
  3. question-bank commercial readiness;
  4. account/security/privacy;
  5. monetization-ready polish.
- Current execution slice: core practice feel, focused on answer-session momentum.
- Added a pure session-feedback utility for correct streaks, combo milestones, combo levels, and compact feedback copy.
- Connected correct-answer streak milestones to the quiz page with a restrained floating combo indicator and existing combo sound/haptic channel.
- Product rule: combo feedback is milestone-based, not every-answer noise. Wrong answers, next-question navigation, page hide, and unload clear the feedback state.

### 2026-06-01 Round 5

- Product boundary clarified: the mini program is the lightweight commercial version, not the full future product.
- Keep the mini program focused on public-course question banks, quiz sessions, progress, sound/haptic/combo feedback, wrong-question review, FSRS, profile, settings, login, privacy, and release evidence.
- Defer professional-course index, school/major discovery, social/invite/PK/leaderboard/poster growth, paid AI tutor, and complex agent chat until after the mini program core is production-grade.
- Removed the professional-course/material-index entry from the Practice page so the core center does not expose school/major discovery copy.
- Removed unused invite/social/AI tutor styling leftovers from Settings. This keeps the lightweight app visually polished without implying unavailable features.

### 2026-06-01 Round 6

- Tightened the mini program boundary at the route-registration layer, not only in visible page cards.
- Removed the deferred `professional-index` route from `src/pages.json`, so the WeChat build no longer registers the professional-course index as part of the lightweight product.
- Added `mini-program-scope-guard` to keep registered routes and core public pages free of deferred school-selection, social, PK/ranking, invite/poster, and AI tutor surfaces.
- Product rule: historical or backend support files can remain for later phases, but any user-reachable mini program route must match the lightweight commercial scope.

### 2026-06-01 Round 7

- Continued Phase 2 shell cohesion by standardizing route actions in the core four-page shell.
- Home, Profile, and Settings now route their user-triggered jumps through `safeNavigateTo`/`safeNavigateBack`, so tab pages, ordinary pages, and fallback behavior share one navigation path.
- Added `shell-navigation-guard` to prevent `uni.navigateTo`, `uni.switchTab`, `uni.redirectTo`, or `uni.reLaunch` from being reintroduced directly in Home, Practice, Profile, or Settings.
- Product rule: shell pages should not own navigation fallback logic. They express intent; the shared safe-navigation utility owns route type detection, transition defaults, and fallbacks.

### 2026-06-01 Round 8

- Continued Phase 2 by making the Home shell resilient to data-loading failures without blanking the first screen.
- Added a compact loading/error/retry state strip above the Home hero. It keeps the page usable if local progress or bank status cannot be read, while still surfacing a clear recovery action.
- Added `core-shell-state-guard` so Home, Practice, Profile, and Settings retain explicit loading, empty, error/login, and bottom safe-area affordances.
- Product rule: lightweight pages may be simple, but every core page must show a deliberate state when data is loading, missing, failed, or positioned near the tabbar.

### 2026-06-01 Round 9

- Continued Phase 2 by tightening theme synchronization across the core shell.
- Home, Practice, and Profile now listen to both `themeUpdate` and `updateTheme`, matching Settings and reducing the chance of stale light/dark state after toggles.
- Added `core-shell-theme-guard` so Home, Practice, Profile, and Settings must keep a dark-mode root class, event subscription/unsubscription, and core dark surface CSS coverage.
- Product rule: theme switching is a shell contract. Core pages must react to both legacy and current theme events until the rest of the app is fully normalized.

### 2026-06-01 Round 10

- Continued Phase 2 visual cohesion by pulling Practice back onto the shared lightweight financial shell language.
- Practice now uses the shared mobile canvas/topbar/deep-panel/glass-surface/primary-action mixins for its page background, hero, cards, empty state, and primary actions.
- Added `core-shell-visual-guard` so Home, Practice, Profile, and Settings keep shared shell primitives, press feedback, and bottom safe-area affordances.
- Product rule: individual pages can vary their content density, but the shell material, primary action treatment, press behavior, and tabbar spacing should stay consistent.

### 2026-06-01 Round 11

- Continued Phase 2 stability by tightening navigation inside the core quiz session page.
- Added `safeRedirectTo` for replace-current-page flows such as starting the recommended smart-review session after completion.
- `do-quiz` result actions and diagnosis actions now use safe navigation helpers instead of direct `uni.redirectTo`/`uni.navigateTo` calls.
- Added `do-quiz-navigation-guard` so quiz-session exits, result actions, and review jumps cannot reintroduce direct route calls.
- Product rule: the quiz page is the highest-stakes flow. Every exit, restart, review, and result action should share fallback behavior with the rest of the shell.

### 2026-06-01 Round 12

- Continued quiz-core polish by separating the result backdrop from the next-question action. Tapping outside the result card now only blocks background interaction instead of advancing the session.
- Rebuilt the result surface into three stable zones: status header, scrollable explanation content, and a dedicated bottom primary action.
- Kept the `e2e-quiz-next-btn` contract while moving it into a clearer bottom action row with disabled and accessibility states.
- Added `do-quiz-result-surface-guard` so future edits cannot reattach the backdrop to `closeResult`, remove the bottom action row, or drop safe-area/disabled-state coverage.
- Product rule: the answer result surface is part of the core rhythm. Progression should require a deliberate primary action, while long explanations must not hide the next action.

### 2026-06-01 Round 13

- Audited the answer feedback chain after the result-surface change: sound/haptic routing was active, but the visual feedback classes had drifted into `animation: none`.
- Reconnected `quiz-correct-animation` and `quiz-wrong-animation` to the existing `correctPulse`, `wrongShake`, `correctGlow`, and `wrongGlow` motion vocabulary.
- Added `do-quiz-answer-motion-guard` so the core answer confirmation moment cannot silently lose visual motion while sound and haptics still fire.
- Product rule: Baicizhan-like certainty needs all three channels together: visual confirmation, sound cue, and haptic fallback.

### 2026-06-01 Round 14

- Continued core-practice polish by upgrading the quiz progress component from a simple bar/dot rail into a clearer session status surface.
- Added a percent label, moving progress thumb, stronger current-question label, and compact answered/correct/wrong summary.
- Fixed neutral flashcard review records so they display as reviewed progress instead of being treated like wrong answers in the dot rail.
- Added `quiz-progress-experience-guard` to preserve percent, thumb motion, answer distribution, safe totals, accessible copy, and dark-mode detail coverage.
- Product rule: users should always know where they are in the session without opening the answer sheet.

### 2026-06-01 Round 15

- Performed a local process cleanup before continuing: terminated duplicate Codegraph, Playwright, XcodeBuildMCP, Computer Use, and stale gunicorn tool processes.
- Found accumulated `<defunct>` processes under the Codex parent process; these cannot be killed directly and require the parent app to reap or restart.
- Found `ANECompilerService` using sustained high CPU, but macOS denied termination. Continued with lightweight validation to avoid adding load.
- Continued the quiz-progress loop by upgrading the answer sheet into a clearer review surface.
- Answer sheet now separates correct, wrong, reviewed, unanswered, and remaining counts; neutral flashcard records no longer lower accuracy or appear as wrong.
- Added `answer-sheet-experience-guard` so the answer sheet stays aligned with the progress rail and preserves dark-mode reviewed-state coverage.

### 2026-06-01 Round 16

- Tightened the answer-sheet jump flow so the answer sheet can be inspected during result feedback without bypassing the deliberate next/continue action.
- `do-quiz` now passes `isAnswerSheetJumpLocked` to the answer sheet whenever a result panel, AI analysis, or navigation transition is active.
- `handleJumpToQuestion` now refuses locked jumps, ignores invalid/current indexes, and only resets question state for deliberate valid jumps.
- Added a visible answer-sheet lock notice and dimmed locked cells while preserving the current-cell emphasis.
- Added `answer-sheet-jump-guard` to prevent result feedback from being bypassed by answer-sheet jumps.

### 2026-06-01 Round 17

- Continued result-feedback polish by moving secondary actions into the result surface itself.
- The result card now exposes compact assist actions for notes, favorite state, and the answer sheet above the primary next/continue action.
- Background question-card note/favorite buttons now visibly lock during result feedback, AI analysis, or navigation transitions, while result-surface actions can still open the intended overlay.
- Note tag chips now use color dots instead of exposing the stored tag icon text, keeping the mini-program UI free of stray emoji-like labels.
- Added `do-quiz-result-assist-actions-guard` so the result assist row, background action lock, result bypass methods, and note-tag cleanup stay in place.

### 2026-06-01 Round 18

- Aligned the full-screen quiz report with the same progress semantics used by the progress rail and answer sheet.
- `quiz-result` now reuses `summarizeQuizProgress`, so neutral flashcard/review records count as completed/reviewed but do not count as wrong or lower accuracy.
- The report stats row now shows reviewed count when neutral records exist instead of hiding them inside the wrong-answer count.
- Category rows now calculate accuracy only from graded records and show an `已复习` state for review-only categories.
- Added `quiz-result-progress-semantics-guard` so the final report cannot drift back to `total - correct = wrong` math.

### 2026-06-01 Round 19

- Tightened the full-screen quiz report action layout so completion actions stay in a stable bottom dock instead of being pushed down by scrollable report content.
- The action dock now includes safe-area padding, a clear top divider, and dark-mode coverage.
- Reworked the report primary/secondary/tertiary buttons away from the older blue game-like treatment toward the same green/blue financial-app accent used in the core quiz feedback.
- Added `quiz-result-action-dock-guard` to keep completion actions outside the scroll view and prevent the old blue raised button style from returning.

### 2026-06-01 Round 20

- Started Phase 3 question-bank commercial readiness from the user-facing Practice shell.
- Added a lightweight `题库就绪度` card that shows official playable coverage, organizing slots, missing slots, and the selected track's readiness in plain user language.
- The readiness card uses `buildPublicCourseCoverage` but avoids backend release/audit terminology in the UI.
- Styled the card with the existing Wise-like light mode and Bitget-like dark mode shell materials.
- Added `practice-readiness-card-guard` so the Practice page keeps a public-course readiness signal without leaking release-gate wording.

### 2026-06-01 Round 21

- Continued Phase 3 by tightening the true question-bank year detail surface.
- Added a compact `当前状态 / 下一步` readiness panel for the selected year, so unavailable years read as intentionally blocked instead of broken or empty.
- Added a muted disabled action row for `整理中` and `待入库` slots, while keeping the primary start button only for `正式` slots.
- Filled in dark-mode coverage for the question-bank page's hero, tabs, year map, detail card, paper list, pending panel, empty state, and action states.
- Added `question-bank-slot-readiness-guard` so selected slot readiness, disabled actions, and user-facing wording stay protected.

### 2026-06-01 Round 22

- Continued Phase 3 by hardening the question-bank start path from year/list actions into the quiz session.
- `question-bank` now uses the shared safe-navigation helper for entering `do-quiz`, so this subpage follows the same fallback behavior as the core shell.
- Loading failures are contained inside the question-bank page with a clear toast instead of bubbling into an unhandled rejected action.
- The page now verifies that the selected paper actually produced usable local question IDs before writing `smart_review_ids` and navigating.
- Added `question-bank-start-flow-guard` so direct quiz navigation, empty-paper jumps, and missing start-path feedback cannot regress.

### 2026-06-01 Round 23

- Continued Phase 3 by making local question-bank sync state visible before users enter a paper.
- The selected year detail now shows `本地状态` and `可练题目`, distinguishing `未同步 / 待同步` from `已同步 / N 题`.
- Ready paper cards now carry the same local sync pill and question count, so list-level and detail-level status match.
- The local count is derived from `v30_bank` paper IDs and refreshed after every successful sync, rather than trusting the historical loaded-bank flag alone.
- Added `question-bank-local-sync-guard` to protect loaded/unsynced rendering, count visibility, refresh wiring, and dark-mode coverage.

### 2026-06-01 Round 24

- Continued Phase 3 by making unavailable years scannable instead of leaving them as unexplained grey slots.
- Added a `待开放清单` panel for the selected track, showing the closest unavailable years with their status, reason, and next step.
- The panel summarizes `整理中 / 待入库` counts and limits the preview to the newest six gaps so it stays lightweight on mobile.
- Kept the copy user-facing: reasons use `资料暂未入库` or existing disabled explanations, without backend release workflow terms.
- Added `question-bank-gap-panel-guard` to protect gap summary rendering, track switching, user-facing wording, and dark-mode coverage.
