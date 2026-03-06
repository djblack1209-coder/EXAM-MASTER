# Scripts Reference

Last updated: 2026-03-07

## Core quality gates

- `npm run lint`: frontend ESLint checks (`--max-warnings=0`, warning 直接失败).
- `npm test`: full Vitest suite.
- `npm run build:h5`: H5 build validation.
- `npm run build:mp-weixin`: WeChat mini-program build validation.
- `npm run test:qa:full-regression`: delivery-grade chain gate (lint/format/laf strict/build/tests/e2e/maestro/secrets/prod-audit/mp-usage).
- `npm run test:qa:full-regression:clean`: wrapper gate, auto-runs under Node 20.17.0 and ensures Playwright Chromium.

## Laf backend safety gates

- `npm run audit:laf:function-sources`: checks TS/JS drift and tracked-source status for `laf-backend/functions`.
- `npm run audit:laf:function-sources -- --strict`: strict mode, fails on drift/untracked source/legacy JS entries.
- `npm run test:cloud:smoke`: live cloud smoke checks (public endpoints + optional auth chain).

Optional auth smoke inputs:

- `SMOKE_EMAIL`
- `SMOKE_PASSWORD`
- `SMOKE_TOKEN` (or `SMOKE_JWT`) to run protected checks without login credentials
- `TOKEN_PLACEHOLDER
- `SMOKE_JWT_SECRET_PLACEHOLDER

Notes:

- `SMOKE_EMAIL` must be a real deliverable mailbox; reserved test domains like `example.com` are rejected by `send-email-code`.

## Project audit scripts

- `npm run audit:deep-scan`: deep project scan report.
- `npm run audit:ui-quality`: UI quality gate report.
- `npm run audit:mp-main-usage`: mini-program main-package usage audit.
- `npm run deps:audit`: npm dependency audit (full tree, non-blocking).
- `npm run deps:audit:prod`: npm dependency audit for production dependencies only (non-blocking).

## Visual regression scripts

- `npm run test:visual`: Playwright visual checks.
- `npm run test:visual:update`: update snapshots.
- `npm run test:visual:ui`: open Playwright UI.

## Generated report outputs

Runtime-generated reports are written to `docs/reports/` and are git-ignored.

- Deep scan/UI: `PROJECT_DEEP_SCAN_REPORT.md`, `ui-quality-report.json`
- Visual: `visual-report/`, `visual-results.json`
- Playwright e2e: `e2e-regression-results.*`, `e2e-regression-html/`, `e2e-compat-results.*`, `e2e-compat-html/`
- Maestro: `maestro-preflight.md`, `maestro-results.xml`, `maestro-web-smoke*.xml`
- Vitest snapshots: `vitest-results*.json`
