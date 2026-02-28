# Scripts Reference

Last updated: 2026-02-28

## Core quality gates

- `npm run lint`: frontend ESLint checks.
- `npm test`: full Vitest suite.
- `npm run build:h5`: H5 build validation.
- `npm run build:mp-weixin`: WeChat mini-program build validation.

## Laf backend safety gates

- `npm run audit:laf:function-sources`: checks TS/JS drift and tracked-source status for `laf-backend/functions`.
- `npm run audit:laf:function-sources -- --strict`: strict mode, fails on drift/untracked source/legacy JS entries.
- `npm run test:cloud:smoke`: live cloud smoke checks (public endpoints + optional auth chain).

Optional auth smoke inputs:

- `SMOKE_EMAIL`
- `SMOKE_PASSWORD`

## Project audit scripts

- `npm run audit:deep-scan`: deep project scan report.
- `npm run audit:ui-quality`: UI quality gate report.
- `npm run audit:mp-main-usage`: mini-program main-package usage audit.

## Visual regression scripts

- `npm run test:visual`: Playwright visual checks.
- `npm run test:visual:update`: update snapshots.
- `npm run test:visual:ui`: open Playwright UI.

## Generated report outputs

Runtime-generated reports are written to `docs/reports/` and are git-ignored:

- `docs/reports/PROJECT_DEEP_SCAN_REPORT.md`
- `docs/reports/ui-quality-report.json`
- `docs/reports/visual-report/`
- `docs/reports/visual-results.json`
