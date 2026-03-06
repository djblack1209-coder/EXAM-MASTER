# Exam-Master QA Regression Report (2026-03-06 r1)

## Scope

- Backup branch: `test-fix/2026-03-06-r1`
- Execution strategy: full automated regression first, then batch fix, then full rerun
- Covered suites:
  - Playwright regression: smoke + core flow + exception + state recovery + performance + top risk pages + full route coverage
  - Playwright compat: mobile/desktop multi-viewport replay
  - Maestro: syntax + preflight + runtime suite (device-aware)

## Commands and Pass Criteria

1. Switch runtime and verify versions

```bash
eval "$(fnm env)" && fnm use 20.17.0 && node -v && npm -v
```

Success criteria:

- `node -v` is `v20.17.0`
- `npm -v` is `10.8.2`

2. Install Playwright browser runtime (blocker fix)

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npx playwright install chromium
```

Success criteria:

- `chromium-1208` and `chromium_headless_shell-1208` downloaded to local Playwright cache

3. Full regression (single viewport)

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:e2e:regression
```

Success criteria:

- Console summary: `32 passed`
- Artifacts generated:
  - `docs/reports/e2e-regression-results.json`
  - `docs/reports/e2e-regression-results.xml`
  - `docs/reports/e2e-regression-html/index.html`

4. Full compatibility regression (mobile + desktop)

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:e2e:compat
```

Success criteria:

- Console summary: `96 passed`
- Artifacts generated:
  - `docs/reports/e2e-compat-results.json`
  - `docs/reports/e2e-compat-results.xml`
  - `docs/reports/e2e-compat-html/index.html`

5. Maestro execution path (device-aware fallback)

```bash
eval "$(fnm env)" && fnm use 20.17.0 && npm run test:maestro
```

Success criteria:

- `docs/reports/maestro-preflight.md` generated
- `docs/reports/maestro-results.xml` generated

## B1 Result Summary

### First full run (before fix)

- `npm run test:e2e:regression` blocked at launcher level
- Observed error (P0 blocker):

```text
Error: browserType.launch: Executable doesn't exist at .../chromium_headless_shell-1208/.../chrome-headless-shell
Please run: npx playwright install
```

- Impact: all Playwright cases blocked (effectively 32/32 unexecutable in this pass)

### After batch fix and full rerun

- Playwright regression: 32 total, 32 passed, 0 failed
- Playwright compat: 96 total, 96 passed, 0 failed
- Maestro runtime: 1 skipped (no Android device/emulator connected), 0 failed

## By Suite (Post-fix)

- `A2-冒烟测试`: 3/3 passed
- `A2-核心流程`: 3/3 passed
- `A2-异常流程`: 5/5 passed
- `A2-状态恢复与幂等`: 5/5 passed
- `A2-基础性能门禁`: 2/2 passed
- `A2-高风险页面可达性`: 11/11 passed
- `A2-人工手势模拟`: 1/1 passed
- `A2-全量页面覆盖与 UI 健康度`: 2/2 passed

Compatibility replay kept all categories green across:

- `mobile-390x844`
- `mobile-375x667`
- `desktop-1440x900`

## B2 Failed Item Detail (initial blocked run)

### DEF-20260306-001

- Title: Playwright browser binary missing blocks all E2E cases
- Priority: P0
- Scope: global (all H5 automated flows)
- Repro steps:
  1. `eval "$(fnm env)" && fnm use 20.17.0`
  2. `npm run test:e2e:regression`
- Expected: Playwright launches browser and executes all test cases
- Actual: launcher fails before test execution due missing headless shell executable
- Evidence:
  - Error snippet shown in command output (`browserType.launch: Executable doesn't exist ... chromium_headless_shell-1208`)
- Initial root cause:
  - Local Playwright browser cache not provisioned on this machine/session
  - Test command does not auto-install runtime dependency
- Fix action:
  - Executed `npx playwright install chromium`
- Verification:
  - Full rerun green: `32 passed` + `96 passed`
- Status: Closed

## C Batch Fix and Regression

- Batch policy followed: blocker fixed first, then full rerun (not one-by-one patching)
- Fix set in this round:
  - Environment/runtime fix: Playwright browser install
- Regression rerun after fix:
  - Core path re-executed 100% (login -> practice -> quiz/import -> result routes)
  - Top high-risk pages replayed (HR-001 ~ HR-011)
  - Full route coverage (light/dark)

## Remaining Blockers

- Native mobile runtime remains blocked by environment only:
  - No Android device/emulator connected (`docs/reports/maestro-results.xml` shows skipped)

## This Round Metrics

- Newly found issues: 2
  - 1 x P0 blocker fixed (Playwright runtime)
  - 1 x P1 environment blocker open (no Android device)
- Fixed issues: 1
- Unresolved blockers: 1

## Next Round Plan

1. Connect Android emulator/device, rerun `npm run test:maestro` to clear native skipped gate.
2. Keep daily gate on `npm run test:e2e:regression && npm run test:e2e:compat` for regression drift.
3. If native run reveals recurring defects twice, output RCA + permanent fix patch in the next round.
