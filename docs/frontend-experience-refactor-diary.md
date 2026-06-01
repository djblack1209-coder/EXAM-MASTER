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
