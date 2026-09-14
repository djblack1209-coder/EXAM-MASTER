# Testing Infrastructure

> Auto-generated: 2026-03-22 | Last updated: 2026-06-17 (release gate baseline refresh)
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
> - `tests/setup.js` 新增 `JWT_SECRET`/`PASSWORD_SALT` 环境变量配置
> - integration 测试 mock 策略：直接突变 `aiService.request` 而非 mock `_request-core.js`

## 公开作品的验证入口（2026-09-13）

上方 Round 记录为历史结果。当前测试数量与通过情况以实际执行和 GitHub Actions 为准，不写入固定通过率徽章。

```bash
npm test -- tests/unit/ai-provider-pool.spec.js tests/unit/guest-demo-boundary.spec.js tests/unit/offline-business-closure.spec.js
TZ=America/New_York npm test -- tests/unit/offline-business-closure.spec.js
TZ=Asia/Shanghai npm test -- tests/unit/offline-business-closure.spec.js
```

演示边界测试验证：生产条件拒绝加载、构建期开关不能被运行期开关绕过、示例来源不可作为正式题库。日期测试覆盖本地晚间、清晨与夏令时边界。

Python 管线与质量检查可在现有 `.venv-baidu` 环境运行：

```bash
.venv-baidu/bin/python -m unittest tests.unit.test_pdf2flashcard_v2 tests.unit.test_flashcard_quality
```

上述用例使用隔离数据和替代服务，不进行真实模型付费调用。本地 H5 截图验证示例答题流程；生产、真实 AI 和微信设备需要独立验收。

## Overview

EXAM-MASTER has a comprehensive multi-layer testing setup:

| Layer      | Framework  | Config             | Location      |
| ---------- | ---------- | ------------------ | ------------- |
| Unit Tests | Vitest 4.0 | `vitest.config.js` | `tests/unit/` |

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
npm run test:baidu:pipeline       # Run Baidu/Python pipeline tests with .venv-baidu
npm run test:watch               # Watch mode
npm run test:coverage            # With coverage report
npx vitest run tests/unit/api.spec.js  # Run single test
```

`npm test` runs Vitest directly. Do not pass Jest-only flags such as `--runInBand`; Vitest 4 rejects unknown options. For a narrower regression, run specific files with `npx vitest run <file...>`.

`npm run test:baidu:pipeline` uses `.venv-baidu/bin/python` instead of the system `python3`, so Baidu OCR/PDF/OpenAI dependencies are tested from the project-managed Python runtime.

---

## QA Gate

发布前运行核心质量检查：

```bash
npm run lint                          # ESLint
npm run format:check                  # Prettier check
npm run audit:laf:function-sources -- --strict  # Backend function audit
npm run build:h5                      # H5 build
npm run test                          # Unit tests (Vitest)
npm run audit:secrets:tracked         # Secret scanning
npm run deps:audit:prod               # Dependency vulnerabilities
npm run audit:mp-main-usage           # MP main package size
```

当前 release-blocker triage 的最小复核链：

```bash
npm run audit:secrets:tracked
npm run audit:laf:function-sources -- --strict
npm run audit:question-bank:report
npm run baidu:flashcards:quality
npm run audit:release:backlog
npx vitest run tests/unit/audit-tracked-secrets-script.spec.js tests/unit/release-blocker-backlog.spec.js tests/unit/question-bank-release-gate.spec.js tests/unit/politics-2023-data.spec.js tests/unit/release-scripts.spec.js
```

这些命令只证明脚本、题库门禁和当前报告可复跑；它们不会替代真实手机微信 evidence、外部官方题源下载/登记、逐题视觉裁切核验或人工答案证据确认。若修改了前端交互、公共组件、Store、Service 或 Laf 云函数，还必须按 `docs/10-DEV-RULES.md` 选择对应功能区验证。

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

- **Current Status**: All passing in the latest local full run (97 suites, 1085 tests on 2026-05-24)
- **Historical Issues (已修复)**:
  - `JWT_SECRET` 环境变量已通过 `.env.test` 配置。
  - `social.service.js` 已重命名为 `social.api.js`，import 路径已对齐。
  - `useQuizAutoSave.js` 已迁移到 `composables/`，测试 import 已更新。
  - HTTP 响应状态码已对齐实际实现。

### Known Infrastructure Gaps & Improvements Needed

1. **Test Environment Variables**: The testing suite currently lacks a proper `.env.test` setup, specifically missing mock values for `JWT_SECRET`, which completely invalidates security and API unit tests.
2. **Missing Mocks**: Certain global variables like `logger` used in services are not being mocked or provided in the Vitest test context.
3. **Outdated Imports**: Need automated tools to verify test imports when files are refactored (e.g., `useQuizAutoSave.js`).
4. **Backend Unit Coverage Gap**: Specifically, errors like `TypeError: query.count is not a function` in `group-service` went uncaught by backend TypeScript compilation and unit tests, indicating a gap in backend-specific testing logic.
