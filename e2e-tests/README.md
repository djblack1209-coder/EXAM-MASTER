# WeChat Mini Program E2E Tests

This folder contains a dedicated end-to-end test framework built with:

- `miniprogram-automator`
- `jest`

## Directory

```text
e2e-tests/
  jest.config.js
  setup.js
  helpers/
    mini-utils.js
    fixtures.js
  specs/
    exam-flow.spec.js
```

## Preconditions

1. Open WeChat DevTools and enable **Settings -> Security -> Service Port**.
2. Ensure the service port matches `19099` (or pass a custom port).
3. Build mini program output before tests (`npm run build:mp-weixin`).

## Run

```bash
npm run test:e2e
```

Generate machine-readable reports (JSON + JUnit XML):

```bash
npm run test:e2e:report
```

Report files:

- `test-results/e2e/jest-results.json`
- `test-results/e2e/junit.xml`

During startup, the suite will:

1. Try connecting to the existing DevTools WebSocket endpoint.
2. If no automation target is active, call HTTP `/v2/open` to open this project.
3. If still unavailable, fallback to CLI launch.

For deterministic test data, app runtime exposes `globalThis.__E2E_BRIDGE__` in non-release environments.
The bridge is used to seed login state and question-bank fixtures without manual selector mapping.

## Covered Cases

- Test Case 1: User Login & Auth
- Test Case 2: Exam & Question Navigation
- Test Case 3: Submission & Results
- Test Case 4: Result Actions (Retry)
- Test Case 5: History Persistence (Retry + Second Submission)
- Test Case 6: Import Flow (Entry + Controls Rendering)
- Test Case 7: Route Coverage Smoke (All Declared Pages)
- Test Case 8: Core Interactions (Tabs + Tools + Settings + School Form)
- Test Case 9: Theme/UI (Light + Dark Rendering on Key Pages)
- Test Case 10: Route Coverage Smoke (Dark Mode)
- Test Case 11: Practice Deep Interactions (Battle + Menu Route Matrix)
- Test Case 12: School Deep Interactions (Result Cards + Target + Detail Actions)
- Test Case 13: Profile/Settings Persistence (Checkin + Voice + Theme Switch)

## CI (Self-Hosted)

Workflow file: `.github/workflows/mp-e2e-self-hosted.yml`

Runner prerequisites:

1. macOS self-hosted runner with GUI session.
2. WeChat DevTools installed and logged in.
3. DevTools security setting "Service Port" enabled.

The workflow uploads:

- `test-results/e2e`
- `e2e-tests/error-screenshots`
- `e2e-tests/ui-snapshots`

## Optional Environment Variables

- `WECHAT_DEVTOOLS_PORT` (default: `19099`)
- `WECHAT_WS_ENDPOINT` (default: `ws://127.0.0.1:<port>`)
- `WECHAT_HTTP_ENDPOINT` (default: `http://127.0.0.1:<port>`)
- `WECHAT_DEVTOOLS_CLI_PATH` (required only if tests must auto-launch DevTools)
- `WECHAT_PROJECT_PATH` (defaults to workspace root)
- `WECHAT_AUTOMATOR_LAUNCH_PORT` (optional dedicated auto-launch port)

## Failure Screenshots

When a test fails, a screenshot is saved to:

- `e2e-tests/error-screenshots/`
