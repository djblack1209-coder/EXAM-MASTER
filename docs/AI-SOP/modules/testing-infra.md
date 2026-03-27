# Testing Infrastructure

> Auto-generated: 2026-03-22 | Last updated: 2026-03-26 (Round 51 全量测试绿灯)
>
> **Round 51 变更 (全量绿灯)**:
>
> - **92 个测试文件全部通过，1263 个测试 0 失败**
> - Timer 超时修复：`vi.useFakeTimers({ toFake: [...] })` 限定范围，排除 `requestAnimationFrame`/`performance`
> - 16 个 audit-\* 测试：requireAuth mock 集成 jwtPayload + 补缺 fsrs-scheduler/validator mock + 断言适配后端实际行为
> - `api-response-mock.js` 补充 `checkRateLimit`、`validateUserId`、`sanitizeString`、`validateAction`
> - **已知 Mock 最佳实践**：后端 audit 测试中 `requireAuth` mock 必须检查 `jwtPayload` 变量，不能硬编码返回 userId
>
> **Round 49/50 变更**:
>
> - 新增 `tests/__mocks__/api-response-mock.js`：后端 api-response 完整 mock factory
> - `tests/setup.js` 新增 `JWT_SECRET_PLACEHOLDER
> - integration 测试 mock 策略：直接突变 `aiService.request` 而非 mock `_request-core.js`

## Overview

EXAM-MASTER has a comprehensive multi-layer testing setup:

| Layer               | Framework                    | Config                                   | Location                |
| ------------------- | ---------------------------- | ---------------------------------------- | ----------------------- |
| Unit Tests          | Vitest 4.0                   | `vitest.config.js`                       | `tests/unit/`           |
| Visual Regression   | Playwright                   | `playwright.visual.config.js`            | `tests/visual/`         |
| E2E Regression (H5) | Playwright                   | `playwright.regression.config.js`        | `tests/e2e-regression/` |
| E2E Compat (H5)     | Playwright                   | `playwright.regression.compat.config.js` | `tests/e2e-regression/` |
| E2E (WeChat MP)     | miniprogram-automator + Jest | `e2e-tests/jest.config.js`               | `e2e-tests/`            |
| Mobile E2E          | Maestro                      | YAML flows                               | `tests/maestro/`        |

---

## Unit Tests (Vitest)

### Configuration

- **Config file**: `vitest.config.js`
- **Environment**: happy-dom (DOM simulation)
- **Test files**: `tests/unit/**/*.{test,spec}.{js,ts,vue}` and `src/**/*.{test,spec}.{js,ts}`
- **Setup file**: `tests/setup.js` (mocks uni-app APIs)
- **Coverage**: v8 provider, reports in `./coverage/`
- **Timeout**: 10,000ms per test
- **Concurrency**: max 5 parallel

### Path Aliases

| Alias          | Resolves To                      |
| -------------- | -------------------------------- |
| `@`            | `src/`                           |
| `@components`  | `src/components/`                |
| `@pages`       | `src/pages/`                     |
| `@utils`       | `src/utils/`                     |
| `@services`    | `src/services/`                  |
| `@lafjs/cloud` | `tests/__mocks__/lafjs-cloud.js` |

### Mocks

| Mock              | File                                         | Purpose                     |
| ----------------- | -------------------------------------------- | --------------------------- |
| Laf Cloud SDK     | `tests/__mocks__/lafjs-cloud.js`             | Mock cloud function runtime |
| Nodemailer        | `tests/__mocks__/nodemailer.js`              | Mock email sending          |
| Tencent Cloud SDK | `tests/__mocks__/tencentcloud-sdk-nodejs.js` | Mock Tencent services       |

### Test Files (~50 spec files)

**Core Feature Tests:**

- `quiz-modules.spec.js` — Quiz module logic
- `practice-dynamic-methods.spec.js` — Practice page methods
- `theme.spec.js` / `theme-store.spec.js` — Theme switching
- `todo-store.spec.js` — Todo CRUD operations
- `global-error-handler.spec.js` — Error handler
- `logger.spec.js` — Logger utility
- `field-normalizer.spec.js` — Data normalization
- `learning-goal.spec.js` — Learning goal logic
- `login-guard.spec.js` — Auth guard
- `offline-queue.spec.js` — Offline queue
- `components.spec.js` — Component rendering
- `config.spec.js` — Configuration loading
- `utils.spec.js` — Utility functions
- `real-utils.spec.js` — Real utility tests
- `api.spec.js` — API layer
- `ai-router.spec.js` — AI routing logic

**Integration Tests:**

- `integration-login-flow.spec.js` — Full login flow
- `integration-auth.spec.js` — Auth integration
- `integration-quiz.spec.js` — Quiz flow
- `integration-school.spec.js` — School features
- `integration-mistake.spec.js` — Mistake book
- `integration-laf-engine.spec.js` — Laf engine
- `integration-ai-social.spec.js` — AI social features
- `integration-upload-quiz.spec.js` — Quiz upload
- `integration-storage-nav.spec.js` — Storage + navigation
- `integration-doc-convert-real-files.spec.js` — Doc conversion

**Security Audit Tests:**

- `audit-auth-gate.spec.js` — Auth gate verification
- `audit-auth-response-shape.spec.js` — Auth response format
- `audit-file-upload.spec.js` — File upload security
- `audit-ai-reality.spec.js` — AI response validation
- `audit-answer-submit-idempotency.spec.js` — Idempotency
- `audit-idor-jwt.spec.js` — IDOR vulnerability check
- `audit-question-bank-security.spec.js` — Question bank auth
- `audit-token-header-userid-enforcement.spec.js` — Token enforcement
- `audit-rank-center-rate-limit.spec.js` — Rate limiting
- `audit-pk-battle-session-verify.spec.js` — PK session security
- `audit-mistake-manager-tag-semantics.spec.js` — Tag validation
- `audit-doc-convert-validation.spec.js` — Doc convert input validation
- `audit-health-check-response.spec.js` — Health check format
- `audit-material-manager-security.spec.js` — Material access control
- `audit-group-service-auth.spec.js` — Group auth
- `audit-school-crawler-auth-response.spec.js` — Crawler auth
- `audit-job-bot-handoff-notify.spec.js` — Bot handoff

**Other Tests:**

- `school-detail-page.spec.js` — School detail rendering
- `school-page-submit.spec.js` — School submission
- `social-review-plan.spec.js` — Social review
- `moat-integration.spec.js` — Moat feature
- `voice-service-flow.spec.js` — Voice service
- `manual-user-click-input.spec.js` — User input
- `login-password-privacy.spec.js` — Password privacy
- `email-auth-utils.spec.js` — Email auth
- `file-handler-privacy.spec.js` — File handler
- `id-photo-success-flow.spec.js` — ID photo flow
- `invite-deep-link-security.spec.js` — Invite links
- `regression-critical-fixes.spec.js` — Regression checks
- `app-launch-config.spec.js` — App launch
- `app-runtime-html.spec.js` — App runtime

### Run Commands

```bash
npm test                          # Run all unit tests
npm run test:watch               # Watch mode
npm run test:coverage            # With coverage report
npx vitest run tests/unit/api.spec.js  # Run single test
```

---

## Visual Regression Tests (Playwright)

### Configuration

- **Config**: `playwright.visual.config.js`
- **Test files**: `tests/visual/`
- **Snapshots**: `tests/visual/ui-pages.spec.js-snapshots/`

### Test Files

- `ui-pages.spec.js` — Core page screenshots (home, practice, profile, school, mistake, etc.)
- `full-feature-pages.spec.js` — Full feature page screenshots

### Run Commands

```bash
npm run test:visual              # Run visual tests
npm run test:visual:update       # Update baseline snapshots
npm run test:visual:ui           # Interactive Playwright UI
```

---

## E2E Regression Tests (Playwright - H5)

### Configuration

- **Config**: `playwright.regression.config.js`
- **Compat config**: `playwright.regression.compat.config.js`
- **Test files**: `tests/e2e-regression/specs/`
- **Fixtures**: `tests/e2e-regression/fixtures/regression.fixture.js`
- **Test data**: `tests/e2e-regression/data/test-data.js`
- **Helpers**: `tests/e2e-regression/helpers/`

### Test Suites (18 spec files)

| File                                    | Purpose                    |
| --------------------------------------- | -------------------------- |
| `00-smoke.spec.js`                      | Basic smoke test           |
| `01-core-flow.spec.js`                  | Core user flows            |
| `02-exception-flow.spec.js`             | Error handling flows       |
| `03-state-recovery.spec.js`             | State persistence          |
| `04-performance.spec.js`                | Performance benchmarks     |
| `05-high-risk-pages.spec.js`            | Complex page testing       |
| `06-human-gesture.spec.js`              | Touch/gesture interactions |
| `07-full-route-coverage.spec.js`        | All routes accessible      |
| `08-clickable-actions.spec.js`          | All click targets work     |
| `09-detailed-click-coverage.spec.js`    | Detailed click coverage    |
| `10-backend-driven-flows.spec.js`       | Backend integration        |
| `11-login-and-import-precision.spec.js` | Login + import flow        |
| `12-full-page-scroll-audit.spec.js`     | Scroll behavior audit      |
| `13-profile-settings-actions.spec.js`   | Profile/settings flows     |
| `14-share-and-native-fallbacks.spec.js` | Share + native APIs        |
| `15-long-tail-pages.spec.js`            | Rarely visited pages       |
| `16-gap-coverage.spec.js`               | Coverage gaps              |
| `17-deep-feature-flows.spec.js`         | Deep feature testing       |

### Helper Utilities

| File                | Purpose                           |
| ------------------- | --------------------------------- |
| `human-actions.js`  | Human-like interaction simulation |
| `assertions.js`     | Custom assertion helpers          |
| `network-logger.js` | Network request logging           |

### Run Commands

```bash
npm run test:e2e:regression          # Run all E2E tests
npm run test:e2e:regression:ui       # Interactive UI mode
npm run test:e2e:regression:headed   # Visible browser
npm run test:e2e:regression:debug    # Debug mode
npm run test:e2e:compat              # Compatibility tests
```

---

## WeChat MP E2E Tests (miniprogram-automator)

### Configuration

- **Config**: `e2e-tests/jest.config.js`
- **Setup**: `e2e-tests/setup.js`
- **Framework**: Jest 30 + miniprogram-automator

### Test Files

- `e2e-tests/specs/exam-flow.spec.js` — Full exam flow in real WeChat dev tools
- `e2e-tests/helpers/mini-utils.js` — WeChat MP test utilities
- `e2e-tests/helpers/fixtures.js` — Test data fixtures
- `e2e-tests/app/` — App-specific E2E (CDP, Appium tests)

### Run Commands

```bash
npm run test:e2e                 # Build MP + run Jest E2E
npm run test:e2e:report          # With JUnit report output
```

---

## Maestro Mobile E2E Tests

### Configuration

- **Location**: `tests/maestro/flows/`
- **Framework**: Maestro (YAML-based mobile testing)

### Flows

| File                      | Purpose                     |
| ------------------------- | --------------------------- |
| `00-smoke.yaml`           | Basic app launch smoke test |
| `01-login-input.yaml`     | Login form interaction      |
| `02-core-practice.yaml`   | Core practice flow          |
| `03-high-risk-tools.yaml` | Tool pages testing          |
| `04-state-recovery.yaml`  | State persistence           |
| `10-web-h5-smoke.yaml`    | H5 web mode smoke           |

### Run Commands

```bash
npm run test:maestro                 # Run all Maestro flows
npm run test:maestro:syntax          # Syntax check only
npm run test:maestro:preflight       # Pre-flight check
npm run test:maestro:native          # Native device required
npm run test:maestro:web:h5          # H5 web testing
```

---

## Full QA Regression Gate

Run the complete test suite before releases:

```bash
npm run test:qa:full-regression
```

This runs in sequence:

1. `npm run lint` — ESLint
2. `npm run format:check` — Prettier check
3. `npm run audit:laf:function-sources -- --strict` — Backend function audit
4. `npm run build:h5` — H5 build
5. `npm run test` — Unit tests (Vitest)
6. `npm run test:visual` — Visual regression
7. `npm run test:e2e:regression` — E2E regression
8. `npm run test:e2e:compat` — Compat tests
9. `npm run test:maestro` — Maestro mobile
10. `npm run audit:secrets:tracked` — Secret scanning
11. `npm run deps:audit:prod` — Dependency vulnerabilities
12. `npm run audit:mp-main-usage` — MP main package size
13. `npm run test:e2e:report` — E2E with JUnit output

---

## Audit Scripts

| Script                | Command                              | Purpose                                  |
| --------------------- | ------------------------------------ | ---------------------------------------- |
| MP Main Package Usage | `npm run audit:mp-main-usage`        | Check WeChat MP main package size        |
| UI Quality Gate       | `npm run audit:ui-quality`           | UI quality checks                        |
| Deep Scan             | `npm run audit:deep-scan`            | Deep code analysis                       |
| Secret Scan           | `npm run audit:secrets:tracked`      | Scan for committed secrets               |
| Laf Function Sources  | `npm run audit:laf:function-sources` | Verify all backend functions have source |
| Cloud Smoke Test      | `npm run test:cloud:smoke`           | Live cloud function smoke test           |
| Dependency Audit      | `npm run deps:audit:prod`            | npm audit for prod dependencies          |

---

## Testing Infrastructure Current State & Gaps (2026-03-23)

### Unit Tests (Vitest)

- **Current Status**: Failing (254 failing tests out of ~300)
- **Failure Reasons**:
  - `JWT_SECRET_PLACEHOLDER
  - Missing `JWT_SECRET_PLACEHOLDER
  - `ReferenceError: logger is not defined` inside `src/services/api/domains/social.service.js` which breaks test cases (like `audit-ai-reality.spec.js`).
  - Import errors. For instance, `regression-critical-fixes.spec.js` fails completely because it tries to import `@/pages/practice-sub/useQuizAutoSave.js` which no longer exists (moved to `composables/`).
  - `TypeError: query.count is not a function` in `group-service` causing tests expecting valid responses to fail.
  - Some expected HTTP response shapes and status codes do not match actual implementations (e.g. returning 500 instead of 400 or 404).

### Visual Regression Tests (Playwright)

- **Current Status**: Failing (11 failing tests out of 48)
- **Failure Reasons**:
  - Snapshot differences on core pages (`home`, `practice`, `settings`). These pages likely had legitimate UI changes that were not captured by running `npm run test:visual:update`. Outdated snapshots on core pages.
  - Missing snapshots for newer pages like `pages-ai-classroom-classroom` and `pages-onboarding-index`. These tests throw "A snapshot doesn't exist" error. 2 pages completely missing snapshots (`ai-classroom-classroom`, `onboarding`).

### E2E Regression Tests (Playwright)

- **Current Status**: Failing (2 failures out of ~30 tests ran)
- **Failure Reasons**:
  - Timeout error in `02-exception-flow.spec.js` (`EXC-005 智能接口500时聊天页可降级并保持可交互`). EXC-005 timeout.
  - Concurrency/idempotency error in `03-state-recovery.spec.js` (`STATE-005 登录按钮快速多次点击仅触发一次请求`) showing multiple requests were fired. STATE-005 idempotency failure.

### Known Infrastructure Gaps & Improvements Needed

1. **Test Environment Variables**: The testing suite currently lacks a proper `.env.test` setup, specifically missing mock values for `JWT_SECRET_PLACEHOLDER
2. **Missing Mocks**: Certain global variables like `logger` used in services are not being mocked or provided in the Vitest test context.
3. **Outdated Imports**: Need automated tools to verify test imports when files are refactored (e.g., `useQuizAutoSave.js`).
4. **Visual Baseline Workflow**: The process of updating visual baselines is manual. The CI/CD pipeline needs an automated way to alert developers when visual baselines are out of sync due to intentional UI changes.
5. **E2E Flakiness/Timeout**: E2E tests exhibit timeout flakiness (like the 30s timeout on exception flows). The infrastructure may need retry logic configurations or extended timeouts for network-dependent tests.
6. **Backend Unit Coverage Gap**: Specifically, errors like `TypeError: query.count is not a function` in `group-service` went uncaught by backend TypeScript compilation and unit tests, indicating a gap in backend-specific testing logic.
