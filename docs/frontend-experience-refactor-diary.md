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

### 2026-06-01 Round 25

- Continued Phase 3 by adding a clear `推荐开练` entry above the year map.
- The recommendation selects the current track's newest playable year, so users see the primary action before scanning the full 2005-2026 grid.
- The card reuses the existing local sync state: unsynced papers show `同步并开始`, while local papers show `继续本卷` with the usable question count.
- The action still calls the existing load-and-start path, preserving bank sync, usable question ID verification, and safe navigation into the quiz page.
- Added `question-bank-recommended-start-guard` to protect recommendation rendering, local-state copy, safe start wiring, user-facing wording, and dark-mode coverage.

### 2026-06-01 Round 26

- Tightened the question-bank page hierarchy after adding the recommendation card.
- The ready-paper list now becomes `更多可练整卷` and excludes the recommended paper, so the page has one clear primary start action instead of repeating the same卷 twice.
- Tracks with only one playable paper now show the recommendation and year map without an unnecessary empty list state.
- The secondary list keeps local sync pills and per-paper start actions, but reads as browsing support rather than the main path.
- Added `question-bank-list-hierarchy-guard` to protect recommendation/list separation, count copy, empty-state behavior, and dark-mode heading coverage.

### 2026-06-01 Round 27

- Tightened the Practice home to Question Bank handoff so the app no longer presents two competing bank-start mental models.
- Practice-page bank cards now say `查看 / 继续` and open the corresponding question-bank detail instead of implying that the home page itself owns import/start behavior.
- The question-bank page remains the single place responsible for local sync, usable question ID verification, recommended start, and safe navigation into quiz.
- Updated the dynamic-method guard from `handleLoadBank` to `openBankDetail` and added `practice-question-bank-entry-guard` for source-level copy, routing, and dark-mode coverage.
- Product rule: the shell should orient and route; the question-bank subpage should decide readiness and training entry.

### 2026-06-01 Round 28

- Started Phase 4 account, security, and privacy readiness from the user-facing compliance surfaces.
- Settings now exposes direct entries for `隐私政策` and `用户协议` instead of leaving `安全与隐私` as a static row.
- Privacy policy copy now matches the lightweight quiz product: question-bank sync, quiz records, wrong review, favorites, progress, local cache, and account deletion.
- User agreement copy no longer claims deferred school-selection or AI tutor surfaces; it describes the current public-course quiz mini program and learning-reference boundary.
- Added `settings-legal-scope-guard` to protect legal-entry routing, current product scope, deferred-feature cleanup, and account-deletion cooling-period copy.

### 2026-06-01 Round 29

- Continued Phase 4 by hardening the logout path inside Settings.
- `LogoutButton` now returns users to Home through `safeNavigateTo('/pages/index/index')` instead of directly calling `uni.reLaunch`, so it shares the same tab-page fallback behavior as the rest of the shell.
- Settings now handles the `logged-out` event with `handleLoggedOut`, clearing both `userInfo` and any in-memory account-deletion status.
- The logout flow still removes `userInfo`, `EXAM_USER_ID`, and `EXAM_TOKEN`, emits `loginStatusChanged`, and shows the existing success feedback.
- Added `settings-logout-flow-guard` to protect safe navigation, sensitive-key cleanup, event broadcast, and deletion-state reset.

### 2026-06-01 Round 30

- Continued Phase 4 by hardening the account-deletion API entry points before they reach the shared Laf request layer.
- `requestAccountDeletion`, `cancelAccountDeletion`, and `getAccountDeletionStatus` now require either a stored token or restored user id before sending `/account-delete`.
- Unauthenticated account-deletion actions return a local `401 / 请先登录` response and do not call the cloud function, reducing noisy anonymous requests around a high-risk account action.
- Existing authenticated behavior still preserves the explicit `request / cancel / status` action payloads used by the backend safety audit.
- Added `account-deletion-api-auth-guard` and updated the Laf integration test so the normal account-deletion path deliberately models a logged-in user.

### 2026-06-01 Round 31

- Continued Phase 4 by normalizing Settings account identity handling around the account-safety UI.
- Settings now derives `currentUserId` from `uid / _id / userId / id / EXAM_USER_ID`, so restored Laf sessions and local-profile sessions both show the correct login badge and account-deletion section.
- Deletion status checks now use the same normalized login state instead of relying on `userInfo.uid` only.
- Avatar upload, local profile save, and avatar-click status copy now share the normalized identity path; local fallback IDs are generated through `ensureLocalUserId`.
- Added `settings-account-identity-guard` so future Settings edits do not hide account safety behind one legacy id shape.

### 2026-06-01 Round 32

- Continued Phase 4 by tightening the high-risk account purge manual trigger.
- `account-purge` now accepts the administrator purge token only from the `x-admin-token` header, with `X-Admin-Token` compatibility, and no longer accepts `body.adminToken`.
- Scheduled purge contexts still run without being mistaken for HTTP manual triggers.
- Added audit coverage proving body-only admin tokens are rejected, header tokens are accepted, and account-delete/token binding tests remain green.
- Product rule: destructive administrator credentials should not travel in request bodies where they are more likely to appear in logs, replay payloads, or debugging snapshots.

### 2026-06-01 Round 33

- Continued Phase 4 by hardening local storage safety around Settings cache clearing and identity persistence.
- Default `storageService.clear()` now preserves login state while migrating legacy plaintext `EXAM_TOKEN`, `EXAM_USER_ID`, and `userInfo` into encrypted keys, then removes the plaintext copies.
- Fixed V2 local obfuscation for short identity strings such as `user_keep`, `user_123`, and `u1` by storing the encoded plaintext length before Feistel padding.
- Added storage tests proving cache clearing keeps the authenticated session readable without leaving plaintext identity keys behind.
- Product rule: cache cleanup should free app data, not silently weaken identity storage or accidentally log users out.

### 2026-06-01 Round 34

- Continued Phase 4 by moving recent account/privacy/storage hardening into the release gate instead of leaving it as scattered test knowledge.
- `release-external-gate` now reports a `phase4Safety` section and blocks publish mode if the account-deletion auth guard, account-purge header guard, legal/privacy scope guard, or sensitive-storage cleanup guard is missing.
- Added `--safety-tests-dir` so the gate can be tested against an isolated empty directory and still use the real `tests/unit` directory by default.
- The external release report now records required/present safety evidence counts without writing secrets or running heavyweight builds.
- Product rule: a commercial mini program release should fail closed when high-risk account, privacy, or storage regressions lose their guardrails.

### 2026-06-01 Round 35

- Continued the release-readiness chain by teaching the release backlog about the new `phase4Safety` external-gate section.
- Phase 4 safety blockers now become `phase4_safety_evidence` backlog items instead of being mixed into generic external evidence.
- The backlog next action now points release operators toward restoring the account-deletion, privacy/legal, and sensitive-storage guard tests before publishing.
- Markdown output now includes a dedicated `Phase 4 安全证据阻塞` section, making the release report easier to read for non-technical review.
- Product rule: release tooling should tell the operator which commercial trust layer failed, not only that an external gate is blocked.

### 2026-06-01 Round 36

- Tightened the release backlog evidence shape after refreshing the generated reports.
- `wechatDevice` blockers no longer carry Phase 4-specific `requiredEvidenceCount` or `presentEvidenceCount` fields with meaningless zero values.
- `phase4Safety` blockers still preserve the safety evidence counters, so account/privacy/storage guard coverage remains visible where it belongs.
- Regenerated the backlog report to verify it still reports 81 blockers and 66 public-course blocked slots, then avoided committing timestamp-only report churn.
- Product rule: release reports should keep each field tied to the layer it explains, especially when the report is meant for non-technical review.

### 2026-06-01 Round 37

- Shifted from safety gate hardening to the largest remaining release blocker: public-course question-bank coverage.
- `cleaning_queue.py` now reads the release backlog by default and prioritizes tasks from `nextBalancedPublicCourseSlots` / `publicCourseSlotBacklog` before generic high-priority sources.
- Matching tasks now carry `releaseBacklogSlot`, `releaseBacklogRank`, `releaseBlockerCode`, `releaseSourceEvidenceStatus`, and `releaseSlotStatus`, making the handoff from release backlog to cleaning work explicit.
- Limited queue summaries now count preserved/changed tasks only after truncation, so `--limit` can no longer produce negative `newOrChangedTasks`.
- Dry-run verification showed the first 20 cleaning tasks all target release backlog slots, starting with `politics:2023` and `english1:2018`.
- Product rule: content work should be ordered by what reduces commercial release blockers fastest, not by generic source age or manifest ordering.

### 2026-06-01 Round 38

- Closed the handoff gap between the release-prioritized queue generator and the cleaning runner.
- `run_cleaning_queue.py` now respects `releaseBacklogRank` during its own pending-task selection, so runner filters such as `--source-type official_paper --paper-role main` keep commercial release blockers ahead of generic same-priority work.
- Added a runner regression test proving a release backlog task such as `english1:2018` is selected before a generic `politics:2005` task with the same priority.
- Regenerated the ignored local cleaning queue: 824 pending release-backlog tasks are now visible to the runner, including 168 automation-actionable tasks and 656 manual-blocked tasks.
- Dry-run verification now starts with `politics:2023`, `english1:2018`, and other release backlog papers, which makes the next real cleaning batch point at the highest release value.
- Product rule: every automation layer that selects content work must preserve the same release-blocker priority, otherwise a correct backlog can still produce slow commercial progress.

### 2026-06-01 Round 39

- Moved from dry-run queue readiness into a real single-paper cleaning smoke on the top release blocker, `politics:2023`.
- Rebuilt the ignored `.venv-baidu` runtime with Python 3.12 after the old Python 3.14 virtualenv hung during startup; the old env was preserved as `.venv-baidu.broken-*`.
- `pdf2flashcard-v2.py` now has configurable LLM request timeout, retry count, output token limit, and batch character limit, so bad or slow OpenAI-compatible providers cannot freeze the cleaning runner.
- Stable provider failures such as unsupported models, invalid accounts, identity verification, credit-card verification, and free-token limits are now detected and disabled quickly during fallback.
- Added batch-level fallback when a question-like text batch returns zero cards, which improved the 2023 politics smoke from 34 cards / 1 analysis item to 38 cards / 5 analysis items when fallback providers were available.
- Added deterministic politics exam type normalization: questions 1-16 are single choice, 17-33 are multi choice, and 34-38 are analysis, correcting LLM misclassification without relying on prompt luck.
- Added runner-side quality gates for public politics papers, so incomplete or misdistributed outputs are marked `failed` with `qualityIssues` instead of being treated as release-ready cleaned banks.
- Real smoke result: download and text extraction work; cleaned output is still blocked from completion when provider fallback misses the full politics distribution, which is the correct commercial-safe behavior.
- Product rule: content automation must fail closed on incomplete or structurally suspicious papers; releasing fewer wrong questions is worse than clearly blocking the slot.

### 2026-06-01 Round 40

- Stabilized the `politics:2023` real cleaning smoke after the first quality gate exposed a second failure mode.
- Empty LLM cache entries for question-like batches are now treated as cache misses unless explicitly allowed, so a previous bad `[]` response cannot permanently suppress a question block.
- Question-like batches that return only already-seen question numbers now trigger backend fallback, preventing later analysis questions from being swallowed as duplicates of an earlier analysis item.
- Re-ran `politics:2023` after clearing the ignored local AI cache; the runner completed with 38 cards, 16 single-choice, 17 multi-choice, 5 analysis, and no structural quality issues.
- The completed task still reports `missingAnswerCount=1` and `answerEvidenceStatus=missing_answers` for `politics-2023-035`, so the next release task is answer evidence repair, not UI or queue ordering.
- Product rule: a source can pass structure cleaning while still being blocked on answer evidence; the automation must preserve that distinction instead of pretending the slot is publish-ready.

### 2026-06-01 Round 41

- Repaired the remaining `politics:2023` answer evidence gap without forcing the 30-batch answer PDF through the full LLM cleaner.
- Added support for numbered politics answer-point sections such as `35.【答案要点】...` in `answer_evidence_repair.py`.
- Created an ignored minimal companion descriptor pointing at the existing 2023 politics answer-analysis PDF, then ran answer repair against `data/flashcards/politics-2023.json`.
- Real repair result: `repairedAnswers=1`, `remainingMissingAnswers=0`, `numberedAnswerTextCandidates=5`, and the queue task now reports `answerEvidenceStatus=candidate_repaired`.
- `politics-2023-035` now has candidate answer evidence from `data/raw-inbox/src_6d757672897de533d4ff50b6-2023考研政治真题及答案解析.pdf`.
- Product rule: expensive LLM support cleaning is not the right first tool when the answer PDF already has deterministic numbered answer sections; use structured extraction first, then reserve LLM for genuinely ambiguous repair.

### 2026-06-01 Round 42

- Continued the release-blocker queue on `english1:2018`.
- Added deterministic English paper structure guards: 2005+ English I requires 52 cards, 45 choice items, 5 translation items, and 2 essay items; English II uses the 2010+ 48-card structure.
- Extended English card normalization so questions 1-45 are choice, 46-50 are translation, and 51-52 are essay, correcting LLM misclassification of 41-45 and 51-52.
- Fixed support-material isolation: files such as `2018年真题及答案速查.pdf` now write to `english-support-<source>-2018.json` instead of overwriting the main `english1-2018.json` bank.
- Real `english1:2018` result: main-paper cleaning produced 52 cards with `{single_choice:45, translation:5, essay:2}` and no missing answers after candidate repair from `data/raw-inbox/src_c2b2d9106a7394b9ebf94bb2-2018年真题及答案速查.pdf`.
- Added a choice-option quality gate. The current `english1:2018` local output still has 10 choice cards with fewer than 4 options, so the queue keeps this task failed with `qualityIssues` even though `missingAnswerCount=0` and `answerEvidenceStatus=candidate_repaired`.
- Product rule: candidate answer evidence and correct paper-level counts are not enough for release. Choice-card option integrity must pass before a bank is treated as publishable.

### 2026-06-02 Round 43

- Finished the `english1:2018` option-integrity blocker exposed in Round 42.
- Added quality-aware canonical output preservation in `run_cleaning_queue.py`: a later failed same-slot main source can no longer overwrite a better existing `data/flashcards/<track>-<year>.json` output.
- Extended `answer_evidence_repair.py` beyond answers so it can repair incomplete choice options from same-year companion cleaned JSON by `year:number`, and from the target source text when companion output lacks options.
- Added Apple OCR fallback to answer evidence repair source-text extraction, allowing scanned target PDFs to supply deterministic A-D and English 41-45 A-G option candidates without another LLM pass.
- Fixed duplicate `outputPath` queue lookup in answer repair so the best same-output task is used as the source evidence owner; this prevents the poorer 47-card 2018 English analysis run from stealing source evidence from the 52-card main run.
- Real `english1:2018` result: local bank now has 52 cards, `{single_choice:45, translation:5, essay:2}`, `missingAnswerCount=0`, and zero choice-option quality issues. Options 11/14/17/18 were repaired from `english-support-ebf94bb2-2018.json`; options 26 and 41-45 were repaired from the original main PDF OCR text.
- Release caveat: repaired answers and options are still `candidate_matched` / `candidate_repaired` evidence, not final publishable verified evidence.
- Product rule: when multiple source PDFs compete for one public-course slot, the automation must preserve the best cleaned bank and use weaker later runs only as supplemental evidence, never as a downgrade.

### 2026-06-02 Round 44

- Advanced the release-priority queue from `english1:2018` to `english1:2019`.
- Downloaded the official 2019 English I answer-speed PDF into ignored `data/raw-inbox/` and used it as deterministic source text instead of forcing a long companion LLM run.
- Rebuilt the local `english1:2019` bank with `english_passage_repair.py`: the answer-speed PDF text layer restored 52 cards, 45 single-choice cards, 5 translation cards, and 2 essay cards.
- Extended `answer_evidence_repair.py` so companion source wrappers can also supply option candidates, including English `A. ... B. ...` dotted option rows and 41-45 A-G Part B paragraphs.
- Real `english1:2019` repair result: `repairedAnswers=10`, `repairedOptions=3`, `remainingMissingAnswers=0`, and runner-quality evaluation now reports `questionCount=52`, `typeCounts={single_choice:45,translation:5,essay:2}`, and `qualityIssues=[]`.
- Release caveat: the repaired 2019 English answers/options are still candidate evidence sourced from the answer-speed PDF and must go through the verified evidence flow before public promotion.
- Product rule: when a companion answer PDF has a clean text layer, use it to rebuild deterministic English structure and evidence first; LLM reruns are the fallback, not the default.

### 2026-06-02 Round 45

- Removed a queue-ordering blocker left after the `english1:2019` repair: English analysis sources named `真题及解析` / `真题及答案解析` are now classified as support evidence, matching existing `真题解析` / `答案解析` handling.
- Kept the math combined-paper exceptions intact, so release-backlog math files such as `2006数一标准答案及解析.pdf` still remain eligible as main-paper tasks.
- Added a runner regression test proving `2019考研英语一真题及解析.pdf` and `2019考研英语（一）真题及答案解析.pdf` are excluded from `--paper-role main` and included under `--paper-role support`.
- Updated a quality-preservation test fixture from an English analysis filename to a pure main-paper filename, preserving the test's intended coverage now that analysis sources are correctly treated as support evidence.
- Verification passed: runner queue tests, main-paper dry-run, and `git diff --check`.
- Dry-run now advances the main release-priority queue past already-repaired English analysis sources and starts at `2006数一标准答案及解析.pdf`, followed by `2016考研数学二真题.pdf`, `2015年考研数学三真题及解析.pdf`, and `2020年考研英语一真题.pdf`.
- Product rule: support/analysis materials can be evidence for repairing a bank, but they must not consume main-paper cleaning slots once the release slot already has a stronger canonical bank.

### 2026-06-02 Round 46

- Added math public-course structural quality gates before running the next real release-priority math cleaning batch.
- `math1`, `math2`, and `math3` main papers now require at least 23 cards, at least 8 choice-like cards, and at least 9 `short_answer` cards before the runner can treat an output as structurally clean.
- The choice-like count accepts both `single_choice` and the older math1 history-bank `flashcard` representation, so existing published history banks are not penalized by a naming mismatch.
- Added runner tests covering an incomplete `math2:2016` output and a valid `math1:2012` history-style distribution.
- Verification passed: runner queue tests, main-paper dry-run, and `git diff --check`.
- Release caveat: this is a structural fail-closed gate only. It does not verify formulas, page-image evidence, or answer correctness; those still require source/evidence repair or a purpose-built math builder for publishable output.
- Product rule: when entering a new subject family, add the minimum structural gate before the first real queue run so partial extractions cannot quietly become completed commercial backlog slots.

### 2026-06-02 Round 47

- Promoted the next release-priority math slot, `math1:2006`, through the formal page-image bank path instead of the generic LLM cleaner.
- Extended `build_math1_history_banks.py` to include 2006, whose historical structure is 6 fill-in-the-blank, 8 choice, and 9 solution questions rather than the later Math I ordering.
- Added manual per-question crop boxes for the 2006 PDF so pre-answer question images do not expose same-page answers or explanations; multi-part crops such as 9/18/19/22 now use stable `q09a/q09b`-style refs.
- Registered `math1-2006` in the public bank registry and regenerated the compressed bank table, bringing the formal enabled-bank count to 68 and public-course coverage gaps down to 64.
- Tightened the release gate source-role inference so same-year historical math files named `YYYY-数一/二/三标准答案及解析.pdf` count as combined `paper_answer` evidence, while mismatched-year files remain answer-only.
- Validation result: `math1-2006.json` has 23 cards, `{single_choice:8, short_answer:15}`, section counts `{填空题:6, 选择题:8, 解答题:9}`, `missingAnswerCount=0`, runner `qualityIssues=[]`, and `bankFileInventoryBlockers=0`.
- Release gate result: `math1:2006` no longer appears in the refreshed backlog; total blockers dropped to 76, public-course blocked slots to 64, and source-evidence gaps to 11.
- Product rule: formula-heavy math PDFs should prefer authoritative page-image banks with audited crops over lossy OCR/LLM text extraction when the source layout mixes questions and explanations.

### 2026-06-02 Round 48

- Promoted `math1:2005` through the same formal page-image bank path after the release-priority queue exposed a local source but no publishable registered bank.
- Extended `build_math1_history_banks.py` with a 2005 source spec, 5-value crop boxes, and optional `drawbox` crop masks so answer brackets in the 8 choice questions can be hidden without truncating formulas or options.
- Published `src/config/flashcard-banks/math1-2005.json` plus 50 page/crop assets under `cdn-assets/question-bank/math1-2005`, then registered the bank and regenerated the compressed practice-bank table.
- Validation result: `math1-2005.json` has 23 cards, `{single_choice:8, short_answer:15}`, section counts `{填空题:6, 选择题:8, 解答题:9}`, no missing answers, no missing assets, and the OCR leakage scan found no `【分析】` / `【详解】` / `[A-D]` markers in question images.
- Release gate result: formal enabled-bank count rose to 69, public-course coverage gaps dropped to 63, total release blockers dropped to 75, and `math1:2005` no longer appears in the refreshed backlog.
- Source caveat: the available 2005 Math I file is `2005数一标准答案及解析.pdf`, not a standalone blank paper. The builder masks choice-answer brackets and crops away explanations, but fill-in-the-blank questions 1-6 still come from source pages where the answer is already filled inline.
- Product rule: when the only local source is an answer-analysis edition, make the leakage controls and remaining source limitations explicit instead of pretending the artifact is equivalent to a clean standalone exam paper.

### 2026-06-02 Round 49

- Audited the `politics:2023` local source pair before promoting its candidate-repaired flashcards into the publishable path.
- Extended `audit_public_course_2025.py` so it can audit arbitrary public-course history roots with `--root`, infer track/year/role metadata, and flag politics answer or paper-answer PDFs that lack numbered `【答案】` / `【答案要点】` markers.
- Real source audit result for `data/raw-inbox/public-course-history/politics/2023`: the paper PDF is readable, but the paper-answer PDF is blocked with `missing_answer_markers:10,11`.
- Confirmed this is a source-quality blocker, not a parser-only issue: the source answer PDF jumps from answer 9 to answer 12, so `politics:2023` must not be treated as publishable `matched` evidence from the current answer source.
- Updated release backlog action selection so a loaded local source audit with a blocked answer companion keeps the slot at `blocked_before_auto_pair` even when Source Manifest already has candidate/publishable-looking source rows.
- Verification passed: source-audit unit tests, release-backlog Vitest, real `politics:2023` source audit to `/tmp`, temporary backlog with `local_answer_file_blocked`, question-bank release gate, default release backlog, and release-priority cleaning dry-run.
- Product rule: candidate-repaired answers are useful for local cleaning progress, but incomplete answer-source coverage must stop auto-pairing and formal publication until a complete authoritative answer source or independently verified evidence is available.

### 2026-06-02 Round 50

- Promoted `math1:2007` through the formal Math I page-image bank path instead of the generic LLM cleaner that had already hung on the scanned formula-heavy PDF.
- Extended `build_math1_history_banks.py` for the 2007 historical structure: 24 cards, 10 choice, 6 fill-in-the-blank, and 8 solution questions.
- Added 2007-specific answer keys, section/type mapping, expected-card helpers, and manual crop boxes. Split cross-page/long prompts such as q09 and q24 into stable multi-image refs while keeping q19 as a question-only crop.
- Published `src/config/flashcard-banks/math1-2007.json` plus 51 page/crop assets under `cdn-assets/question-bank/math1-2007`, registered the bank, and regenerated the compressed practice-bank table.
- Validation result: `math1-2007.json` has 24 cards, `{single_choice:10, short_answer:14}`, section counts `{选择题:10, 填空题:6, 解答题:8}`, no missing assets, and the OCR leakage scan found no `【分析】` / `【详解】` / `[A-D]` markers in question images.
- Release gate result: public-course coverage gaps dropped to 62, release blockers dropped to 74, public-course blocked slots dropped to 62, and `math1:2007` no longer appears in the refreshed release backlog.
- Source caveat: the available 2007 Math I file is `2007数一标准答案及解析.pdf`, not a standalone blank paper. Choice-answer brackets are masked and explanations are cropped away, but fill-in-the-blank source pages still include filled answers where the source has no blank-paper equivalent.
- Product rule: for scanned math answer-analysis editions, a publishable practice artifact requires both structural registration and crop-level leakage checks; passing the release gate is not a substitute for inspecting the actual question images.

### 2026-06-02 Round 51

- Promoted `math1:2018` from the release-priority queue through the formal Math I page-image bank path, bypassing generic LLM cleaning for the scanned formula-heavy PDF.
- Downloaded the Baidu source `2018-数一考研真题及答案 .pdf` into local raw-inbox, confirmed it has 8 scanned pages and no usable text layer, then added a 2018 `SourceSpec` with 23 cards.
- Published `src/config/flashcard-banks/math1-2018.json` plus 40 page/crop assets under `cdn-assets/question-bank/math1-2018`, registered the bank, and regenerated the compressed practice-bank table.
- Validation result: `math1-2018.json` has 23 cards, `{flashcard:14, short_answer:9}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, no missing assets, and the OCR leakage scan found no `【分析】` / `【详解】` / `【解析】` / choice-answer markers in question images.
- Release gate result after sequential audit refresh: public-course coverage gaps dropped to 61, release blockers dropped to 73, public-course blocked slots dropped to 61, and the release-priority dry-run now starts at `2019数一真题及答案解析.pdf`.
- Source caveat: the available 2018 Math I file is a same-page question-and-analysis PDF, not a standalone blank paper. The builder crops away visible analysis and masks q16's same-line `【解析】` start, while answer evidence remains the original rendered PDF pages.
- Product rule: when a math source combines question and analysis on the same page, publishability depends on per-crop leakage inspection plus answer-page evidence, not on OCR text extraction.

### 2026-06-02 Round 52

- Promoted `math1:2019` through the same formal Math I page-image bank path after the release-priority queue advanced to `2019数一真题及答案解析.pdf`.
- Confirmed the local source is a 15-page scanned answer-analysis PDF with no usable text layer, so the builder uses rendered PDF page images plus audited per-question crops rather than OCR-derived formula text.
- Added a 2019 structure regression test and a `SourceSpec` with 23 cards, `{选择题:8, 填空题:6, 解答题:9}`. Cross-page prompts q04, q06, and q13 use stable multi-image refs (`q04a/q04b`, `q06a/q06b`, `q13a/q13b`).
- Published `src/config/flashcard-banks/math1-2019.json` plus 56 page/crop assets under `cdn-assets/question-bank/math1-2019`, registered the bank, and regenerated the compressed practice-bank table.
- Validation result: `math1-2019.json` has 23 cards, `{flashcard:14, short_answer:9}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, no missing assets, and the OCR leakage scan found no `【分析】` / `【详解】` / `【解析】` / `【答案】` / choice-answer markers in question images.
- Visual spot checks covered cross-page q04/q06/q13, fill-in-the-blank q09/q10/q14, and solution prompts q15-q23. q18 and q22 crop heights were tuned before final generation to remove an answer-formula edge and preserve the third subquestion.
- Release gate result after sequential audit refresh: public-course coverage gaps dropped to 60, release blockers dropped to 72, public-course blocked slots dropped to 60, and the release-priority dry-run now starts at `2020数一真题答案解析.pdf`.
- Source caveat: the available 2019 Math I file is an answer-analysis edition, not a standalone blank paper. Publishability still depends on crop-level leakage controls, while answer evidence remains the original rendered PDF pages.
- Product rule: for modern Math I answer-analysis PDFs, treat manual crop QA as part of the release artifact, not as an optional post-processing check.

### 2026-06-02 Round 53

- Promoted `math1:2020` through the formal Math I page-image bank path after the release-priority queue advanced to `2020数一真题答案解析.pdf`.
- Downloaded the Baidu source into ignored `data/raw-inbox/`, confirmed it is a 13-page scanned answer-analysis PDF with no usable text layer, then added a 2020 `SourceSpec` with 23 cards.
- Added a 2020 structure regression test and a full set of manual crop boxes. q08 uses `q08a/q08b` because the prompt starts at the bottom of page 4 and continues on page 5.
- Published `src/config/flashcard-banks/math1-2020.json` plus 50 page/crop assets under `cdn-assets/question-bank/math1-2020`, registered the bank, and regenerated the compressed practice-bank table.
- Validation result: `math1-2020.json` has 23 cards, `{flashcard:14, short_answer:9}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, no missing assets, and the OCR leakage scan found no `【分析】` / `【详解】` / `【解析】` / `【答案】` / choice-answer markers in question images.
- Visual spot checks tuned q10, q14, q15, q16, and q23 crop heights to remove answer/解析 edges while preserving complete prompts.
- Release gate result after sequential audit refresh: public-course coverage gaps dropped to 59, release blockers dropped to 71, public-course blocked slots dropped to 59, and the release-priority dry-run now starts at `2021数一真题答案解析.pdf`.
- Source caveat: the available 2020 Math I file is an answer-analysis edition, not a standalone blank paper. User-facing question images depend on crop-level leakage controls, while answer evidence remains the original rendered PDF pages.
- Product rule: when an answer-analysis source has no text layer, do not let generic OCR/LLM cleaning create the commercial artifact; ship through audited page-image evidence.

### 2026-06-02 Round 54

- Promoted `math1:2021` through the formal Math I page-image bank path after the release-priority queue advanced to `2021数一真题答案解析.pdf`.
- Confirmed the source is a 16-page scanned answer-analysis PDF with no usable text layer, then added a 2021 `SourceSpec` for the newer 22-card structure: 10 choice, 6 fill-in-the-blank, and 6 solution questions.
- Added a 2021 structure regression test covering `card_numbers_for_spec == 1..22`, q09/q22 multi-image prompts, and 2021-specific section/type mapping.
- Published `src/config/flashcard-banks/math1-2021.json` plus 56 page/crop assets under `cdn-assets/question-bank/math1-2021`, registered the bank as a special 10/6/6 Math I entry, and regenerated the compressed practice-bank table.
- Validation result: `math1-2021.json` has 22 cards, `{flashcard:16, short_answer:6}`, section counts `{选择题:10, 填空题:6, 解答题:6}`, no missing assets, and the OCR leakage scan found no `【分析】` / `【详解】` / `【解析】` / `【答案】` / choice-answer markers in question images.
- Visual spot checks tuned q05, q09a, q20, and q21 crop heights to remove answer/解析 leakage while preserving complete prompts. q22 uses `q22a/q22b` because the third subquestion starts at the top of the next page.
- Release gate result after sequential audit refresh: public-course coverage gaps dropped to 58, release blockers dropped to 70, public-course blocked slots dropped to 58, and the release-priority dry-run now starts at `2022数一真题答案解析.pdf`.
- Source caveat: the available 2021 Math I file is an answer-analysis edition. User-facing question images depend on crop-level leakage controls, while answer evidence remains the original rendered PDF pages.
- Product rule: run `question-bank-release-gate` before `release-blocker-backlog`; running them in parallel can make the backlog read the previous audit and temporarily leave a newly published slot in the queue.

### 2026-06-02 Round 55

- Promoted `math1:2022` through the formal Math I page-image bank path after the release-priority queue advanced to `2022数一真题答案解析.pdf`.
- Confirmed the source is an 11-page answer-analysis PDF with a weak text layer, then added a 2022 `SourceSpec` for the newer 22-card structure: 10 choice, 6 fill-in-the-blank, and 6 solution questions.
- Added a 2022 structure regression test covering `card_numbers_for_spec == 1..22`, q13 split question crops, q22 answer evidence across pages 10-11, and the 2022 source id/file name.
- Published `src/config/flashcard-banks/math1-2022.json` plus 45 page/crop assets under `cdn-assets/question-bank/math1-2022`, registered the bank as a special 10/6/6 Math I entry, and regenerated the compressed practice-bank table.
- Validation result: `math1-2022.json` has 22 cards, `{flashcard:16, short_answer:6}`, section counts `{选择题:10, 填空题:6, 解答题:6}`, no missing assets, and the OCR leakage scan found no `【分析】` / `【详解】` / `【解析】` / `【答案】` / choice-answer markers in question images.
- Visual spot checks tuned q04, q06, q08, q12, q13, q18, q19, q20, q21, and q22 crop boundaries to remove same-page answer/解析 leakage while preserving complete prompts.
- Release gate result after sequential audit refresh: public-course coverage gaps dropped to 57, release blockers dropped to 69, public-course blocked slots dropped to 57, and the release-priority dry-run now starts at `1987数一真题、标准答案及解析.pdf`.
- Source caveat: the available 2022 Math I file is an answer-analysis edition. User-facing question images depend on crop-level leakage controls, while answer evidence remains the original rendered PDF pages.

### 2026-06-02 Round 56

- Fixed Source Manifest year inference for historical math files before continuing the queue: filenames such as `1987数一真题、标准答案及解析.pdf` now resolve to 1987 instead of inheriting 2023 from the parent directory range `1987-2023`.
- Extended `source_manifest.py` to accept 1980-2035 release-source years and to let an explicit filename year refresh stale derived `year` values already present in ignored local manifest data.
- Added regression coverage proving both fresh 1987 math source records and stale manifest rows with `year=2023` are corrected from the filename.
- Refreshed ignored Source Manifest runtime state, question-bank release gate, release backlog, and cleaning queue. Release metrics stayed at `coverageGaps=57`, `blockers=69`, `publicCourseBlockedSlots=57`.
- Release-priority dry-run now starts at the real `2023数一真题答案解析.pdf`, followed by `2024年数学一真题及参考答案.pdf`, instead of incorrectly scheduling 1987/1988/1989 files against `math1:2023`.
- Product rule: when source folders include historical ranges, filename-level year evidence must outrank parent-directory range years before release backlog metadata is attached.

### 2026-06-02 Round 57

- Promoted `math1:2023` through the formal Math I page-image bank path after the corrected release-priority queue advanced to `2023数一真题答案解析.pdf`.
- Confirmed the source is a 16-page weak-text answer-analysis PDF, then added a 2023 `SourceSpec` for the newer 22-card structure: 10 choice, 6 fill-in-the-blank, and 6 solution questions.
- Added a 2023 structure regression test covering `card_numbers_for_spec == 1..22`, q07/q09/q20/q22 multi-image prompts, q20 answer evidence across pages 12-14, and the 2023 source id/file name.
- Published `src/config/flashcard-banks/math1-2023.json` plus 58 page/crop assets under `cdn-assets/question-bank/math1-2023`, registered the bank as a special 10/6/6 Math I entry, and regenerated the compressed practice-bank table.
- Validation result: `math1-2023.json` has 22 cards, `{flashcard:16, short_answer:6}`, section counts `{选择题:10, 填空题:6, 解答题:6}`, no missing assets, and the OCR leakage scan found no `【分析】` / `【详解】` / `【解析】` / `【答案】` / choice-answer markers in question images.
- Visual spot checks covered q01, q07, q09, q20, and q22; q22b was trimmed after the first inspection to remove the next-page `【解析】` edge while preserving the final prompt.
- Release gate result after sequential audit refresh: public-course coverage gaps dropped to 56, release blockers dropped to 68, public-course blocked slots dropped to 56, and the release-priority dry-run now starts at `2024年数学一真题及参考答案.pdf`.
- Source caveat: the available 2023 Math I file is an answer-analysis edition. User-facing question images depend on crop-level leakage controls, while answer evidence remains the original rendered PDF pages.

### 2026-06-02 Round 58

- Promoted `math1:2024` through the formal Math I page-image bank path after the release-priority queue advanced to `2024年数学一真题及参考答案.pdf`.
- Downloaded the Baidu source into ignored `data/raw-inbox/`, confirmed it is a 6-page Word-exported PDF with readable text, and excluded the final ad-only page from rendered release assets.
- Added a 2024 `SourceSpec` for the newer 22-card structure: 10 choice, 6 fill-in-the-blank, and 6 solution questions. q04 keeps answer evidence across pages 1-2 because its answer sits at the next page top.
- Published `src/config/flashcard-banks/math1-2024.json` plus 32 page/crop assets under `cdn-assets/question-bank/math1-2024`, registered the bank, and regenerated the compressed practice-bank table.
- Validation result: `math1-2024.json` has 22 cards, `{flashcard:16, short_answer:6}`, section counts `{选择题:10, 填空题:6, 解答题:6}`, 22 question crop assets, 5 answer pages, 5 paper pages, no missing assets, and no OCR-detected `答案/解析/详解` leakage in question images.
- Visual spot checks covered q02, q10, q21, and q22; q02 was narrowed after inspection to remove an advertising edge while preserving all options.
- Release gate result after sequential audit refresh: public-course coverage gaps dropped to 55, release blockers dropped to 67, public-course blocked slots dropped to 55, and the release-priority dry-run now starts at `2016考研数学二真题.pdf`.
- Source caveat: the available 2024 Math I source is still a combined question-answer PDF, not a standalone blank paper. User-facing question crops hide same-page answers, while answer evidence remains original rendered PDF pages.

### 2026-06-02 Round 59

- Audited the next release-priority source `math2:2016` before publishing because the downloaded PDF is scanned, has no usable text layer, and mixes questions with same-page explanations.
- OCR/visual comparison showed `2016考研数学二真题.pdf` advertises 2016 in the title, but its first-page questions match the already published `math2-2014` question set. Pages 11-14 are promotional/software pages and are not valid exam evidence.
- Added `scripts/baidu/source_quality.py` as a shared source-quality override registry. The known bad source `src_97fdbcbd12d0815374fbe91f` is now tagged with `source_content_mismatch` and `manual_review_required`, with `legalReview.publishBlocked=true`.
- Wired the override into Source Manifest normalization, manifest quality, raw candidate coverage, cleaning queue generation, and the cleaning runner. Even an old queue containing the previous `download_and_extract` task will now skip this source in runner selection.
- Updated `question-bank-release-gate.mjs` and release backlog diagnostics so the source no longer satisfies `math2:2016` publishable evidence. The refreshed backlog lists `math2:2016` as `missing_publishable_official_source` with the mismatch risk in candidate samples.
- Validation result: Python unit set, question-bank release gate Vitest, release backlog Vitest, release scripts Vitest, self-tests, sequential release audit/backlog refresh, manifest quality, candidate coverage, cleaning queue rebuild, release-priority dry-run, and `git diff --check` all passed.
- Release metrics after the correction: public-course coverage gaps stay at 55, release blockers rise to 68 because the previously miscounted source-evidence blocker is now visible, source evidence gaps are 12, and public-course blocked slots stay at 55.
- Release-priority dry-run now skips `2016考研数学二真题.pdf` and starts at `2015年考研数学三真题及解析.pdf`, followed by `2020年考研英语一真题.pdf`, `2017考研数学二真题.pdf`, and `2016年考研数学三真题及解析.pdf`.
- Product rule: never publish a public-course slot from filename/year metadata alone. When visual/OCR inspection shows the content is a different year, the source must become a manual-review blocker even if it looked like an official combined paper-answer PDF.
