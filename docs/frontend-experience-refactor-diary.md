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
