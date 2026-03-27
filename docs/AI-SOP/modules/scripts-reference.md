# Scripts Reference

Last updated: 2026-03-25

## Core quality gates

- `npm run lint`: frontend ESLint checks (不再用 `|| true`，错误会正确终止).
- `npm test`: full Vitest suite.
- `npm run build:h5`: H5 build validation.
- `npm run build:mp-weixin`: WeChat mini-program build validation.
- `npm run test:qa:full-regression`: delivery-grade chain gate (lint/format/laf strict/build/tests/e2e/maestro/secrets/prod-audit/mp-usage).
- `npm run test:qa:full-regression:clean`: wrapper gate, auto-runs under Node 20.17.0 and ensures Playwright Chromium.

## Electron / 桌面端 (Round 38 新增)

- `npm run electron:dev`: 构建 H5 + 启动 Electron 开发模式
- `npm run electron:build:mac`: 构建 macOS .dmg 安装包
- `npm run electron:build:win`: 构建 Windows .exe 安装包
- `npm run electron:build:all`: 同时构建 Mac + Win
- `node scripts/build/build-all-platforms.mjs`: 一键全平台构建 (Mac/Win/H5/MP/Android/iOS)

## App 构建

- `npm run app:build:android`: 构建 Android APK
- `npm run app:build:ios`: 构建 iOS IPA

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
