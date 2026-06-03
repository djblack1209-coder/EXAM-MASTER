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

### 2026-06-02 Round 60

- Corrected the public-course release coverage policy for English II: `english2` now starts at 2010, the first real exam year, even when the global coverage request starts at 2005.
- Exported a shared per-track required-year helper from `src/config/bank-registry.js` and reused it in `question-bank-release-gate.mjs` so registry coverage and Source Manifest evidence coverage no longer diverge.
- Added regression coverage for both registry coverage and release gate source evidence: English II `minYear=2005,maxYear=2010` now requires only 2010 and no longer reports 2005-2009 as impossible blockers.
- Validation result: registry/release-gate/backlog Vitest passed, and the real 2005-2020 release audit now reports `requiredSlots=91`, `publishedSlots=64`, `coverageGaps=27`, `sourceEvidenceGaps=1`, `pendingCoverageBlockers=0`, and no answer/grading/bank-file blockers.
- Current 2020 target gaps after policy correction: English I 2018-2020, English II 2010-2020, Math II 2015-2020, and Math III 2014-2020. `math2:2016` remains blocked on missing publishable official source evidence because the known source is mislabeled 2014 content.
- Product rule: release blockers should represent real exam availability, not a uniform year rectangle. Track-specific start years must be applied before prioritizing cleaning work or source-evidence gaps.

### 2026-06-02 Round 61

- Promoted `math3:2015` through a formal Math III page-image bank path after the corrected release-priority queue ranked `2015年考研数学三真题及解析.pdf` first.
- Downloaded the Baidu Netdisk source into ignored `data/raw-inbox/`, confirmed it is a 12-page scanned answer-analysis PDF with no usable text layer, and visually confirmed the content matches 2015 Math III with no ad-only pages.
- Added `scripts/cleaning/build_math3_2015_bank.py`, published `src/config/flashcard-banks/math3-2015.json`, generated 12 answer pages plus 25 question crop assets under `cdn-assets/question-bank/math3-2015`, registered the bank, and regenerated the compressed practice-bank table.
- Validation result: `math3-2015.json` has 23 cards, `{single_choice:8, short_answer:15}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, no missing assets, and OCR leakage scan found no `【答案】` / `【解析】` / choice-answer markers in question images.
- Visual spot checks tuned q02, q05, q06, q13, q15, q17, q18, q19, and q21-b crop boundaries to remove answer/解析 or previous-question residue while preserving complete prompts.
- Release gate result after sequential audit refresh: 2005-2020 public-course `coverageGaps` dropped from 27 to 26, `publishedSlots` rose to 65, `sourceEvidenceGaps` stayed at 1, and release backlog now reports 26 public-course blocked slots.
- Release-priority dry-run after rebuilding the cleaning queue now starts at English II 2010 paired candidates, followed by `2016年考研数学三真题及解析.pdf`, `2020年考研英语一真题.pdf`, and Math II/III follow-up years.
- Frontend polish note: the question-bank year-map header now derives the range from the selected track. English II displays `2010-2026` instead of the old hard-coded `2005-2026`, matching the release policy.

### 2026-06-02 Round 62

- Promoted `math3:2014` through the same formal Math III page-image bank path after the 2020 target still showed Math III 2014 as an uncovered public-course slot.
- Verified the local source `src_bd3bb496ed9148e3cd0127d9-2014年考研数学三真题及解析.pdf`: 13 scanned pages, no usable text layer, SHA-256 `9b80c47a4411a9f006087e0ddf609f9b6d04bd467db1aaa1f4b418c81a647a35`.
- Added `scripts/cleaning/build_math3_2014_bank.py`, published `src/config/flashcard-banks/math3-2014.json`, generated 13 answer pages plus 23 question crop assets under `cdn-assets/question-bank/math3-2014`, registered the bank, and regenerated the compressed practice-bank table.
- Validation result: `math3-2014.json` has 23 cards, `{single_choice:8, short_answer:15}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, no missing assets, and all cards carry `answerEvidenceStatus=matched`.
- Crop QA tightened q02 and q03 after the first OCR leakage scan detected answer/解析 residue; the final leakage scan over all question crop images produced no answer-marker hits.
- Release gate result after sequential audit refresh: 2005-2020 public-course `coverageGaps` dropped to 25, `sourceEvidenceGaps` stayed at 1, and release backlog reports 25 public-course blocked slots.
- Product rule: for scanned Math III answer-analysis PDFs, publish only after both structured registry tests and crop-level leakage scans pass; OCR may guide cropping, but rendered PDF page images remain the release evidence.

### 2026-06-03 Round 63

- Promoted `english2:2010`, the first real English II exam year, from release backlog into the formal practice-bank registry.
- Added `scripts/cleaning/build_english2_2010_bank.py`, which builds 48 cards from local Baidu Netdisk 2010 English II paper, answer-speed, and detailed-analysis PDFs.
- Source evidence uses the answer-speed PDF text layer for question and answer matching, while preserving the original paper and detailed-analysis PDF hashes in `sourceFiles`. Writing cards 47-48 are recorded as official prompt tasks rather than unique model-answer questions.
- Validation result: `english2-2010.json` has 48 cards, all cards carry `answerEvidenceStatus=matched`, q01 answer is `D`, q21 passage contains `Damien Hirst`, q30 answer is `B`, q46 contains the `Sustainability` translation segment, and q48 uses `official_writing_prompt` evidence.
- Registered `english2-2010`, regenerated the compressed practice-bank table, and updated the question-bank year map so English II now reports `正式 2 · 整理中 0 · 待入库 15`.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 25 to 24, `publishedSlots` rose to 67, `sourceEvidenceGaps` stayed at 1, and the release-priority dry-run still shows follow-up English II paired candidates plus remaining English I/Math II/Math III gaps.
- Product rule: for English II historical banks with usable local text layers, answer-speed and detailed-analysis PDFs can provide matched evidence, but writing tasks must stay prompt-based because there is no single official answer.

### 2026-06-03 Round 64

- Promoted `english2:2011` through the same formal English II text-layer bank path after the release-priority queue advanced to the paired 2011 English II sources.
- Downloaded the canonical Baidu Netdisk 2011 document-version, original-paper, answer-speed, and detailed-analysis PDFs into ignored `data/raw-inbox/`, then recorded all four source IDs and SHA-256 hashes in the generated bank.
- Added `scripts/cleaning/build_english2_2011_bank.py`, which builds 48 cards from the 2011 answer-speed PDF text layer and cross-checks stable anchors in the detailed-analysis PDF. Part B is represented as A-G information matching, not the 2010 T/F structure.
- Validation result: `english2-2011.json` has 48 cards, all cards carry `answerEvidenceStatus=matched`, q01 answer is `A`, q21 answer is `B`, q30 answer is `A`, q46 contains the `greenhouse gases` translation segment, and q48 uses `official_writing_prompt` evidence with the domestic car market-share chart prompt.
- Registered `english2-2011`, regenerated the compressed practice-bank table, and updated the question-bank year map so English II now reports `正式 3 · 整理中 0 · 待入库 14`.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 24 to 23, `publishedSlots` rose to 68, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=25` and `publicCourseBlockedSlots=23`, and the release-priority dry-run now starts at English II 2012 paired candidates.
- Product rule: English II historical Part B formats vary by year. The builder should encode the actual exam task shape for each year while keeping writing tasks prompt-based.

### 2026-06-03 Round 65

- Promoted `english2:2012` through the formal English II text-layer bank path after verifying the canonical 2012 document-version, original-paper, answer-speed, and detailed-analysis PDFs in ignored `data/raw-inbox/`.
- Added `scripts/cleaning/build_english2_2012_bank.py`, which builds 48 cards from the 2012 answer-speed PDF text layer, records all four source hashes in `sourceFiles`, and cross-checks detailed-analysis anchors including `G. I. Joe`, Part B historical figures, and the `brain drain` translation passage.
- Validation result: `english2-2012.json` has 48 cards, all cards carry `answerEvidenceStatus=matched`, q01 answer is `A`, q21 answer is `A`, q30 answer is `C`, q46 contains both `brain drain` and `developing countries`, and q48 uses `official_writing_prompt` evidence with the employee work satisfaction survey prompt.
- Registered `english2-2012`, regenerated the compressed practice-bank table, and updated the question-bank year map so English II now reports `正式 4 · 整理中 0 · 待入库 13`.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 23 to 22, `publishedSlots` rose to 69, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=24` and `publicCourseBlockedSlots=22`, and the rebuilt release-priority dry-run now starts at English II 2013 paired candidates.
- Product rule: historical English II text-layer builders must tolerate OCR abbreviations such as `L. A. Unified` without confusing them for answer options; option parsing now uses the trailing A-D option block for 2012 choice questions.

### 2026-06-03 Round 66

- Promoted `english2:2013` through the same formal English II text-layer bank path after downloading the canonical 2013 document-version, original-paper, answer-speed, and detailed-analysis PDFs into ignored `data/raw-inbox/`.
- Added `scripts/cleaning/build_english2_2013_bank.py`, which builds 48 cards from the 2013 answer-speed PDF text layer, records all four source hashes in `sourceFiles`, and cross-checks detailed-analysis anchors including `Average Is Over`, `birds of passage`, `Hair opened on Broadway`, and the part-time job writing chart.
- Validation result: `english2-2013.json` has 48 cards, all cards carry `answerEvidenceStatus=matched`, q01 answer is `A`, q21 answer is `A`, q30 answer is `D`, Part B answers are `FEGCD`, q46 contains `Hair opened on Broadway`, and q48 uses `official_writing_prompt` evidence with the `某高校学生兼职情况` chart prompt.
- Registered `english2-2013`, regenerated the compressed practice-bank table, and updated the question-bank year map so English II now reports `正式 5 · 整理中 0 · 待入库 12`.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 22 to 21, `publishedSlots` rose to 70, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=23` and `publicCourseBlockedSlots=21`, and the rebuilt release-priority dry-run now starts at English II 2014 paired candidates.
- Product rule: English II Part B can be a subtitle-selection task, not only information matching. Builders should keep the actual exam task wording and option labels instead of normalizing all Part B years to one format.

### 2026-06-03 Round 67

- Promoted `english2:2014` through the formal English II text-layer bank path after downloading the canonical 2014 document-version, original-paper, answer-speed, and detailed-analysis PDFs into ignored `data/raw-inbox/`.
- Added `scripts/cleaning/build_english2_2014_bank.py`, which builds 48 cards from the 2014 answer-speed PDF text layer, records all four source hashes in `sourceFiles`, and cross-checks detailed-analysis anchors including `Happy Money`, `illusory superiority`, `Race Against the Machine`, `affordable housing`, `Stone Circle`, and the optimism translation passage.
- Validation result: `english2-2014.json` has 48 cards, all cards carry `answerEvidenceStatus=matched`, q01 answer is `B`, q21 answer is `B`, q30 answer is `D`, Part B answers are `DEGCA`, q46 contains `Most people would define optimism`, and q48 uses `official_writing_prompt` evidence with the `20年间中国城镇人口与乡村人口变化图` chart prompt.
- Registered `english2-2014`, regenerated the compressed practice-bank table, and updated the question-bank year map so English II now reports `正式 6 · 整理中 0 · 待入库 11`.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 21 to 20, `publishedSlots` rose to 71, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=22` and `publicCourseBlockedSlots=20`, and the rebuilt release-priority dry-run now starts at English II 2015 paired candidates.
- Product rule: English II cloze extraction must preserve spacing until blank markers are normalized; 2014 includes ordinary numeric text such as `BMI of 18 to 25`, so blank replacement cannot blindly rewrite every year-like number.

### 2026-06-03 Round 68

- Promoted `english2:2015` through the formal English II text-layer bank path after verifying the canonical 2015 document-version, original-paper, answer-speed, and detailed-analysis PDFs in ignored `data/raw-inbox/`.
- Added `scripts/cleaning/build_english2_2015_bank.py`, which builds 48 cards from the 2015 answer-speed PDF text layer, records all four source hashes in `sourceFiles`, and cross-checks detailed-analysis anchors including home/work stress, first-generation college students, office speak, Obamacare, Old Truths Part B, and the well-traveled road translation passage.
- Validation result: `english2-2015.json` has 48 cards, all cards carry `answerEvidenceStatus=matched`, q01 answer is `A`, q21 answer is `A`, q30 answer is `D`, Part B answers are `DEGAC`, q46 contains `Think about driving a route that's very familiar`, and q48 uses `official_writing_prompt` evidence with the `我国某市居民春节假期花销比例` chart prompt.
- Registered `english2-2015`, regenerated the compressed practice-bank table, and updated the question-bank year map so English II now reports `正式 7 · 整理中 0 · 待入库 10`.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 20 to 19, `publishedSlots` rose to 72, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=21` and `publicCourseBlockedSlots=19`, and the rebuilt release-priority dry-run now starts at English II 2016 paired candidates and Math III 2016.
- Product rule: when an English writing chart is missing from PDF text extraction but visible in the rendered official page, record the chart facts in the prompt evidence instead of deriving them from model essays.

### 2026-06-03 Round 69

- Promoted `english2:2016` through the formal English II text-layer bank path after verifying the canonical 2016 document-version, original-paper, answer-speed, and detailed-analysis PDFs in ignored `data/raw-inbox/`.
- Added `scripts/cleaning/build_english2_2016_bank.py`, which builds 48 cards from the 2016 answer-speed PDF text layer, records all four source hashes in `sourceFiles`, cross-checks detailed-analysis anchors including Flatiron, lesser prairie chicken, Sacred Time, Schneider, Act Your Shoe Size, and the supermarket translation passage, and blocks known OCR/promo leakage in generated cards.
- Validation result: `english2-2016.json` has 48 cards, all cards carry `answerEvidenceStatus=matched`, q01 answer is `C`, q21 answer is `B`, q30 answer is `C`, Part B answers are `CEABD`, q46 contains `The supermarket is designed to lure customers`, and q48 uses `official_writing_prompt` evidence with the `某高校学生旅游目的调查` chart prompt including `其他 15%`.
- Registered `english2-2016`, regenerated the compressed practice-bank table, and updated the question-bank year map so English II now reports `正式 8 · 整理中 0 · 待入库 9`.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 19 to 18, `publishedSlots` rose to 73, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=20` and `publicCourseBlockedSlots=18`, and the rebuilt release-priority dry-run now starts at English II 2017 paired candidates and Math III 2016.
- Product rule: if a historical English source PDF is image-only but its answer-speed companion includes the full paper text layer, use the answer-speed PDF for question/answer matching and preserve the image-only document/original-paper hashes as supporting source evidence.

### 2026-06-03 Round 70

- Promoted `english2:2017` through the formal English II text-layer bank path after verifying the canonical 2017 document-version, original-paper, answer-speed, and detailed-analysis PDFs in ignored `data/raw-inbox/`.
- Added `scripts/cleaning/build_english2_2017_bank.py`, which builds 48 cards from the 2017 answer-speed PDF text layer, records all four source hashes in `sourceFiles`, cross-checks detailed-analysis anchors including Parkrun, Jenny Radesky, gap year, Max Moritz, Jay Dunwell, and the Fashion Media & Promotion translation passage, and blocks the known promo tail line.
- Validation result: `english2-2017.json` has 48 cards, all cards carry `answerEvidenceStatus=matched`, q01 answer is `C`, q21 answer is `A`, q30 answer is `A`, Part B answers are `EAGBF`, q46 contains `My dream has always been to work somewhere`, and q48 uses `official_writing_prompt` evidence with the `2013-2015年我国博物馆数量和参观人数` chart prompt including `4165`, `4692`, `6378`, and `7811`.
- Registered `english2-2017`, regenerated the compressed practice-bank table, and updated the question-bank year map so English II now reports `正式 9 · 整理中 0 · 待入库 8`.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 18 to 17, `publishedSlots` rose to 74, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=19` and `publicCourseBlockedSlots=17`, and the rebuilt release-priority dry-run now starts at English II 2018 paired candidates plus Math III 2016.
- Product rule: English II Part B can be person-to-information matching. Builders should preserve the left-column names and A-G statement options rather than converting the task into a generic subtitle prompt.

### 2026-06-03 Round 71

- Promoted `english2:2018` through the formal English II text-layer bank path after verifying the canonical 2018 document-version, original-paper, answer-speed, and detailed-analysis PDFs in ignored `data/raw-inbox/`.
- Added `scripts/cleaning/build_english2_2018_bank.py`, which builds 48 cards from the 2018 answer-speed PDF text layer, records all four source hashes in `sourceFiles`, cross-checks detailed-analysis anchors including Stephen Koziatek, renewable energy, WhatsApp, Cal Newport, `Five ways to make conversation with anyone`, and Bill Gates, and strips PDF page-footer/OCR noise from generated cards.
- Validation result: `english2-2018.json` has 48 cards, all cards carry `answerEvidenceStatus=matched`, q01 answer is `D`, q21 answer is `B`, q30 answer is `C`, Part B answers are `AFEBD`, q46 contains `A fifth grader gets a homework assignment to select his future career path` without the `英语（二）试题` page footer, and q48 uses `official_writing_prompt` evidence with the `2017年某市消费者选择餐厅时的关注因素` chart prompt including `特色36.3%`, `服务26.8%`, `环境23.8%`, `价格8.4%`, and `其他4.7%`.
- Registered `english2-2018`, regenerated the compressed practice-bank table, and updated the question-bank year map so English II now reports `正式 10 · 整理中 0 · 待入库 7`.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 17 to 16, `publishedSlots` rose to 75, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=18` and `publicCourseBlockedSlots=16`, and the rebuilt release-priority dry-run now starts at English II 2019 paired candidates followed by Math III 2016.
- Product rule: when a text-layer English translation prompt includes printable page footer text, the builder should remove it before hashing/storing `targetSegment`, and focused bank data specs should assert the footer phrase is absent from the loaded compressed bank.

### 2026-06-03 Round 72

- Rechecked the development environment before continuing: `codegraph status` and the Codegraph MCP live check both report an up-to-date index with 611 files, 9,517 nodes, and 22,092 edges; the `openai-curated/*/83d1f0d2 -> 2b564709` plugin cache symlinks have no broken links; tracked workspace was clean before the 2019 work started.
- Promoted `english2:2019` through the formal English II text-layer bank path after verifying the canonical 2019 document-version, original-paper, answer-speed, and detailed-analysis PDFs in ignored `data/raw-inbox/`.
- Added `scripts/cleaning/build_english2_2019_bank.py`, which builds 48 cards from the 2019 answer-speed PDF text layer, records all four source hashes in `sourceFiles`, cross-checks detailed-analysis anchors including `When Guilt Is Good`, `Forest Carbon Plan`, American farm labor, plastics policy, James Herriot, and homebuying Part B, and strips PDF page-footer/OCR noise from generated cards.
- Validation result: `english2-2019.json` has 48 cards, all cards carry `answerEvidenceStatus=matched`, q01 answer is `C`, q21 answer is `C`, q30 answer is `A`, Part B answers are `DGFCB`, q46 contains `It is easy to underestimate English writer James Herriot` without the `英语（二）试题` page footer, and q48 uses `official_writing_prompt` evidence with the `某高校2013年和2018年本科毕业生去向统计` chart prompt including `68.1%`, `60.7%`, `26.3%`, `34.0%`, `1.3%`, and `2.6%`.
- Registered `english2-2019`, regenerated the compressed practice-bank table, and updated the question-bank year map so English II now reports `正式 11 · 整理中 0 · 待入库 6`.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 16 to 15, `publishedSlots` rose to 76, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=17` and `publicCourseBlockedSlots=15`, and the rebuilt release-priority dry-run now starts at English II 2020 paired candidates followed by Math III 2016/2017.
- Product rule: when a writing chart's labels and values are only visible in the rendered official page, render the page and encode those chart facts in the official prompt evidence instead of relying on the degraded text layer.

### 2026-06-03 Round 73

- Rechecked the active development environment before continuing: Codegraph MCP status reports 613 indexed files, 9,574 nodes, 22,457 edges, Poppler/Node/Python tooling is available, and `.codegraph/`, `.env*`, `data/raw-inbox/`, cleaning queues, reports, caches, and `node_modules/` remain ignored and untracked.
- Promoted `english2:2020` through the formal English II text-layer bank path after verifying the canonical 2020 document-version, original-paper, answer-speed, and detailed-analysis PDFs in ignored `data/raw-inbox/`.
- Added `scripts/cleaning/build_english2_2020_bank.py`, which builds 48 cards from the 2020 answer-speed PDF text layer, records all four source hashes in `sourceFiles`, cross-checks detailed-analysis anchors including rats/robotic rats, CEO pay, Madrid/Ulez, Generation Z, `Five Ways to Win Over Everyone in the Office`, and failure translation, and strips 公众号 headers, PDF footers, promo-tail text, and OCR noise from generated cards.
- Validation result: `english2-2020.json` has 48 cards, all cards carry `answerEvidenceStatus=matched`, q01 answer is `B`, q21 answer is `A`, q30 answer is `A`, Part B answers are `EFDAC`, q46 contains `It's almost impossible to go through life without experiencing some kind of failure`, and q48 uses `official_writing_prompt` evidence with the `某高校学生手机阅读目的调查` chart prompt including `59.5%`, `21.3%`, `17.0%`, and `2.2%`.
- Registered `english2-2020`, regenerated the compressed practice-bank table, and updated the question-bank year map so English II now reports `正式 12 · 整理中 0 · 待入库 5`.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 15 to 14, `publishedSlots` rose to 77, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=16` and `publicCourseBlockedSlots=14`, and the rebuilt release-priority dry-run now starts at Math III 2016, Math III 2017, then English I 2020.
- Product rule: 2020 English II source PDFs may mix clean official text with 公众号 page headers and promo tail pages; text-layer builders must filter those source artifacts before hashing/storing learner-facing card content.

### 2026-06-03 Round 74

- Promoted `math3:2016` through the formal Math III page-image bank path after release-priority moved past English II 2020.
- Environment check: Codegraph MCP stayed healthy, and Poppler, ffmpeg, tesseract, Node, npm, Python, and git were available. The AI cleaning runner downloaded the source successfully but hit an unsupported iflow model and a timed-out nvidia batch, so the release path switched to deterministic PDF rendering, OCR audit, and visual crop QA.
- Added `scripts/cleaning/build_math3_2016_bank.py`, published `src/config/flashcard-banks/math3-2016.json`, generated 19 answer/evidence pages plus 28 question crop assets under `cdn-assets/question-bank/math3-2016`, registered the bank, and regenerated the compressed practice-bank table.
- Source audit: `src_fb595cd0da81efa6da3993c7-2016年考研数学三真题及解析.pdf` is a 24-page scanned PDF with no usable text layer; pages 1-4 are the original paper, pages 5-19 are answer analysis, and pages 20-24 are promotional noise excluded from card evidence.
- Validation result: `math3-2016.json` has 23 cards, `{short_answer:15, single_choice:8}`, section counts `{填空题:6, 选择题:8, 解答题:9}`, all cards carry `answerEvidenceStatus=matched`, q07 answer is `A`, q11 answer is `D`, q14 answer is `C`, and q23 answer evidence ends at `answer-page-19.jpg`.
- Crop QA masks q11's source-printed `[D]` answer bracket and OCR spot checks for q11/q20/q23 found no answer/analysis leakage in question images.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 14 to 13, `publishedSlots` rose to 78, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=15` and `publicCourseBlockedSlots=13`, and the rebuilt release-priority dry-run now starts at Math III 2017 followed by Math III 2018 and English I 2020.

### 2026-06-03 Round 75

- Promoted `math3:2017` through the formal Math III page-image bank path after the release-priority queue advanced to `2017年考研数学三真题及解析.pdf`.
- Environment check: Codegraph MCP reports 617 indexed files, 9,681 nodes, and 22,720 edges; Poppler, ffmpeg, tesseract, Node, npm, Python, `rg`, and git are available. The AI cleaning runner downloaded the ignored source but again hit unsupported/timeout LLM backends, so the release path used deterministic PDF rendering, OCR audit, and visual crop QA.
- Added `scripts/cleaning/build_math3_2017_bank.py`, published `src/config/flashcard-banks/math3-2017.json`, generated 9 answer/evidence pages plus 24 question crop assets under `cdn-assets/question-bank/math3-2017`, registered the bank, and regenerated the compressed practice-bank table.
- Source audit: `src_1903dd7b391b0dc5da099c74-2017年考研数学三真题及解析.pdf` is a 9-page scanned PDF with no usable text layer; questions and answer analysis are interleaved on the same pages, so pre-answer question images must be per-question crops.
- Validation result: `math3-2017.json` has 23 cards, `{single_choice:8, short_answer:15}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, all cards carry `answerEvidenceStatus=matched`, q01 answer is `A`, q04 answer is `C`, q08 answer is `B`, q09 answer is `π^3/2`, q14 answer is `9/2`, q15 answer contains `2/3`, and q23 answer evidence ends at `answer-page-09.jpg`.
- Crop QA tightened q03/q07/q08/q10/q13/q14/q15/q18/q20/q21/q22 after OCR/visual checks found early answer-analysis leakage or over-tight crops; the final OCR leakage scan over all 24 question images found no `详解`/answer-selection markers.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 13 to 12, `publishedSlots` rose to 79, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=14` and `publicCourseBlockedSlots=12`, and the rebuilt release-priority dry-run now starts at Math III 2018 followed by Math III 2019, English I 2020, and Math II 2017.

### 2026-06-03 Round 76

- Promoted `math3:2018` through the same deterministic Math III page-image bank path after the release-priority queue advanced to `2018年考研数学三真题及解析.pdf`.
- Environment check: Codegraph MCP reports 620 indexed files, 9,732 nodes, and 22,817 edges; Poppler, ffmpeg, tesseract, Node, npm, Python, `rg`, and git are available. The AI cleaning runner downloaded the ignored source but hit the same unsupported/slow backend pattern, so the release path stayed on PDF rendering, OCR audit, and visual crop QA.
- Added `scripts/cleaning/build_math3_2018_bank.py`, published `src/config/flashcard-banks/math3-2018.json`, generated 14 answer/evidence pages plus 24 question crop assets under `cdn-assets/question-bank/math3-2018`, registered the bank, and regenerated the compressed practice-bank table.
- Source audit: `src_96a8e7cbc8f19d8e26451784-2018年考研数学三真题及解析.pdf` is a 14-page scanned PDF with no usable text layer; questions and answer analysis are interleaved on the same pages, and page 14 is q23 answer continuation rather than an ad-only page.
- Validation result: `math3-2018.json` has 23 cards, `{single_choice:8, short_answer:15}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, all cards carry `answerEvidenceStatus=matched`, q01 answer is `D`, q02 answer is `D`, q08 answer is `B`, q09 answer is `y=4x-3`, q14 answer is `1/3`, and q23 answer evidence ends at `answer-page-14.jpg`.
- Crop QA tightened q02/q04/q07/q12/q13/q14/q21/q22/q23 after OCR/visual checks found early answer-analysis leakage, missing prompt lines, or previous-question residue; the final OCR leakage scan over all 24 question images found no answer/analysis markers. The source PDF's q01 prompt contains the original `错误!未找到引用源` text, which is preserved as source text rather than treated as a leakage marker.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 12 to 11, `publishedSlots` rose to 80, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=13` and `publicCourseBlockedSlots=11`, and the rebuilt release-priority dry-run now starts at Math III 2019 followed by Math III 2020, English I 2020, and Math II 2017.

### 2026-06-03 Round 77

- Rechecked the development environment before continuing: Codegraph MCP reports 623 indexed files, 9,822 nodes, and 22,990 edges; duplicate MCP server processes were reduced back to a single active codegraph/context7/xcodebuild/playwright set; no cleaning runner, pdf2flashcard, or tesseract process was left running.
- Promoted `math3:2019` through the same deterministic Math III page-image bank path after the release-priority queue advanced to `2019年考研数学三真题及解析.pdf`.
- Added `scripts/cleaning/build_math3_2019_bank.py`, published `src/config/flashcard-banks/math3-2019.json`, generated 12 answer/evidence pages plus 25 question crop assets under `cdn-assets/question-bank/math3-2019`, registered the bank, and regenerated the compressed practice-bank table.
- Source audit: `src_72f4c3221cc958781119c8d1-2019年考研数学三真题及解析.pdf` is a 12-page scanned PDF with no usable text layer; questions and answer analysis are interleaved on the same pages, q04 crosses pages 1-2, q22 uses page 10 plus page 11 top, and page 12 is q23 answer continuation rather than an ad-only page.
- Validation result: `math3-2019.json` has 23 cards, `{single_choice:8, short_answer:15}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, all cards carry `answerEvidenceStatus=matched`, q01 answer is `C`, q04 answer is `B`, q08 answer is `A`, q09 answer is `e^(-1)`, q14 answer is `2/3`, q21 answer contains `x=3`, and q23 answer evidence ends at `answer-page-12.jpg`.
- Crop QA tightened q01/q02/q03/q04/q06/q07/q08/q09/q11/q12/q14/q15/q17/q19/q21/q22/q23 after OCR/visual checks found early answer-analysis leakage, blank crops, answer markers, or previous-question residue; the final OCR leakage scan over all 25 question images found no answer/analysis markers.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 11 to 10, `publishedSlots` rose to 81, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=12` and `publicCourseBlockedSlots=10`, and the rebuilt release-priority dry-run now starts at Math III 2020 followed by English I 2020 and Math II 2017-2020.

### 2026-06-03 Round 78

- Promoted `math3:2020` through the deterministic Math III page-image bank path after release-priority advanced to `2020年考研数学三真题及解析.pdf`.
- Added `scripts/cleaning/build_math3_2020_bank.py`, published `src/config/flashcard-banks/math3-2020.json`, generated 5 paper pages, 13 answer pages, and 24 question crop assets under `cdn-assets/question-bank/math3-2020`, registered the bank, and regenerated the compressed practice-bank table.
- Source audit: `src_5b15e18fa7b78e9d43c07840-2020年考研数学三真题及解析.pdf` is an 18-page scanned PDF with no usable text layer; pages 1-5 are the original paper, pages 6-18 are answer analysis, and q06 is split across paper pages 2-3.
- Validation result: `math3-2020.json` has 23 cards, `{single_choice:8, short_answer:15}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, all cards carry `answerEvidenceStatus=matched`, q01 answer is `B`, q06 answer is `D`, q14 answer is `8/7`, q17 answer contains `e^(-x)cos2x`, and q23 answer evidence ends at `answer-page-13.jpg`.
- Crop QA tightened q19/q20 after visual checks found overlapping prompt boundaries; the final OCR leakage scan over all 24 question images found no answer/analysis markers.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 10 to 9, `publishedSlots` rose to 82, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=11` and `publicCourseBlockedSlots=9`, and the rebuilt release-priority dry-run now starts at English I 2020 followed by Math II 2017-2020.

### 2026-06-03 Round 79

- Promoted `english1:2020` through the formal English I text-layer bank path before returning to UI polish, because the current release blocker priority is still public-course coverage and cleaning quality.
- Rechecked the local development environment: CodeGraph is initialized and callable, Poppler/Node/Python tooling is available, and ignored runtime artifacts such as raw PDFs, cleaning queues, reports, caches, and virtualenvs remain outside the tracked commit scope.
- Added `scripts/cleaning/build_english1_2020_bank.py`, published `src/config/flashcard-banks/english1-2020.json`, generated 31 page assets under `cdn-assets/question-bank/english1-2020`, registered the bank, and regenerated the compressed practice-bank table.
- Source audit: the 15-page original-paper PDF is a real English I 2020 source but includes promotional header noise, so release question evidence uses the cleaner 16-page answer-speed PDF text layer and rendered pages; the original paper, detailed-analysis PDF, and document-version scan are retained in `sourceFiles`.
- Validation result: `english1-2020.json` has 52 cards, all cards carry `answerEvidenceStatus=matched`, q01/q21/q30/q41/q45 answers are `C/C/D/C/D`, q46 contains `With the Church's teachings and ways of thinking`, q51 is the singing-contest notice, and q52 is the `习惯` writing prompt. The generated bank blocks the 2020 English II mobile-reading chart and failure-translation source bleed.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 9 to 8, `publishedSlots` rose to 83, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=10` and `publicCourseBlockedSlots=8`, and the rebuilt release-priority dry-run now starts at Math II 2017-2020.

### 2026-06-03 Round 80

- Promoted `math2:2017` through the deterministic Math II page-image bank path after release-priority advanced to `2017考研数学二真题.pdf`.
- Rechecked the local development environment: CodeGraph MCP is healthy, Poppler/ffmpeg/tesseract/Node/Python tooling is available, and the generic cleaning runner's LLM parse was stopped after the ignored PDF download because deterministic page rendering is the safer release path for formula-heavy scanned math sources.
- Added `scripts/cleaning/build_math2_2017_bank.py`, published `src/config/flashcard-banks/math2-2017.json`, generated 10 answer/evidence pages and 24 question crop assets under `cdn-assets/question-bank/math2-2017`, registered the bank, and regenerated the compressed practice-bank table.
- Source audit: `src_f91df4734f54ab6decaa093b-2017考研数学二真题.pdf` is an 11-page scanned PDF with no usable text layer; questions and answer analysis are interleaved on pages 1-10, and page 11 is promotional tail text that is excluded from card evidence.
- Validation result: `math2-2017.json` has 23 cards, `{single_choice:8, short_answer:15}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, all cards carry `answerEvidenceStatus=matched`, q01 answer is `A`, q04 answer is `C`, q06 answer is `C`, q08 answer is `B`, q09 answer is `y=x+2`, q14 answer is `-1`, q15 contains `2/3`, q20 contains `5π/4`, and q23 answer evidence ends at `answer-page-10.jpg`.
- Crop QA tightened q01/q02/q03/q04/q05/q06/q07/q08/q13/q14/q16/q17/q18/q21/q23 after OCR/visual checks found answer labels, previous-answer residue, or overly tight formulas; the final OCR leakage scan over all 24 question images found no answer/analysis markers.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 8 to 7, `publishedSlots` rose to 84, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=9` and `publicCourseBlockedSlots=7`, and the rebuilt release-priority dry-run now starts at Math II 2018-2020.

### 2026-06-03 Round 80

- Repaired the local plugin cache symlink `openai-curated/build-web-data-visualization/83d1f0d2` to point at the valid `0732ec94` cache and reran the plugin symlink scan: 26 symlinks checked, 0 broken. CodeGraph MCP remained callable with 627+ indexed files, and all discovered `SKILL.md` files retained frontmatter.
- Promoted `math2:2017` through the deterministic Math II page-image bank path after release-priority advanced to `2017考研数学二真题.pdf`.
- Added `scripts/cleaning/build_math2_2017_bank.py`, published `src/config/flashcard-banks/math2-2017.json`, generated 10 answer/evidence pages plus 24 question crop assets under `cdn-assets/question-bank/math2-2017`, registered the bank, and regenerated the compressed practice-bank table.
- Source audit: `src_f91df4734f54ab6decaa093b-2017考研数学二真题.pdf` is an 11-page scanned answer-analysis PDF with no usable text layer; questions and answer analysis are interleaved on the same pages, and page 11 is promotional tail text excluded from card evidence.
- Validation result: `math2-2017.json` has 23 cards, `{single_choice:8, short_answer:15}`, section counts `{选择题:8, 填空题:6, 解答题:9}`, all cards carry `answerEvidenceStatus=matched`, q01 answer is `A`, q04/q06 follow the worked-solution conclusion `C`, q09 answer is `y=x+2`, q14 answer is `-1`, q20 contains `5π/4`, and q23 answer evidence ends at `answer-page-10.jpg`.
- Crop QA tightened q07/q13/q17/q23 after OCR/visual checks found answer or解析 leakage; the final OCR leakage scan over all question images found no actual `【答案】` / `【解析】` markers. q09 still contains the official instruction phrase `请将答案写在答题纸`, which is not an answer reveal.
- Release gate result: 2005-2020 public-course `coverageGaps` dropped from 8 to 7, `publishedSlots` rose to 84, `sourceEvidenceGaps` stayed at 1, release backlog reports `blockers=9` and `publicCourseBlockedSlots=7`, and the rebuilt release-priority dry-run now starts at Math II 2018-2020.
